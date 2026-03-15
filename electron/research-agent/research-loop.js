const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { RESEARCH_TOOLS } = require('./tool-schema')
const { executeToolCalls } = require('./tool-executor')

const ATTACHMENT_SAFE_SYSTEM_PROMPT = [
  'You are FRAUDLY, a scam prevention agent.',
  'Analyze the user request and any attached files/images using the attachments as primary evidence.',
  'Do not call tools or rely on external web research in this mode.',
  'Your job in this mode is to extract evidence from the attachment, not to give the final researched verdict.',
  'Return concise markdown with only the facts you can support from the attachment.',
  'Your output must prioritize exact text extraction from the screenshot over interpretation.',
  'If a line of text is readable, preserve the wording closely and quote it.',
  'Pay special attention to company names, bank names, brand names, abbreviations, and claims like "I am from TD", "this is TD", "from Amazon", or "from your bank".',
  'Do not confuse the app or platform hosting the conversation with the company named inside the conversation.',
  'Use this exact format:',
  '## Visible Text',
  '- Quote the most important readable lines from the screenshot.',
  '## Claimed Company',
  '- State the company or brand named in the conversation. If none is visible, say "Company not found".',
  '## Platform',
  '- State the platform hosting the conversation if visible.',
  '## Red Flags Seen',
  '- List requests for sensitive data, urgency, payment claims, links, phone numbers, or impersonation cues.',
  '## Uncertainty',
  '- Mention any text that was hard to read or ambiguous.',
].join('\n')

function extractClaimedCompany(summary) {
  const text = String(summary || '')
  if (!text.trim()) return ''

  const claimedSectionMatch = text.match(/##\s*Claimed Company\s*\n([\s\S]*?)(?:\n##\s|$)/i)
  if (claimedSectionMatch) {
    const cleaned = claimedSectionMatch[1]
      .replace(/^[\s*-]+/gm, '')
      .replace(/Company not found.*$/im, '')
      .trim()
    if (cleaned) {
      const firstLine = cleaned.split('\n').find((line) => line.trim())
      if (firstLine) return firstLine.trim()
    }
  }

  const patterns = [
    /\b(?:i am|i'm|im)\s+from\s+([A-Z][A-Za-z0-9&.' -]{1,40})/i,
    /\bfrom\s+([A-Z]{2,10})\b/,
    /\bthis is\s+([A-Z][A-Za-z0-9&.' -]{1,40})/i,
    /\brepresent(?:ing)?\s+([A-Z][A-Za-z0-9&.' -]{1,40})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const candidate = match[1].trim().replace(/[.,:;!?]+$/, '')
    if (!candidate || /^(discord|messenger|instagram|whatsapp|gmail|email|sms)$/i.test(candidate)) continue
    return candidate
  }

  return ''
}

function buildAttachmentEvidenceMessage(summary) {
  const normalizedSummary = String(summary || '').trim()
  if (!normalizedSummary) return ''

  return [
    'Attachment analysis evidence:',
    normalizedSummary,
    '',
    'Use the attachment analysis above as primary evidence for your answer.',
    'You may use tools for additional verification or follow-up research if helpful.',
  ].join('\n')
}

function buildAttachmentContextSeed({ originalPrompt, summary }) {
  const evidenceMessage = buildAttachmentEvidenceMessage(summary)
  return [
    'Context from a prior attachment-based analysis.',
    '',
    'Original user request:',
    String(originalPrompt || '').trim(),
    '',
    evidenceMessage,
    '',
    'Use this attachment evidence as the factual basis for any later tool-enabled research.',
    'If a company is named in the evidence, compare the suspicious claims against the company\'s official fraud, support, and contact-policy pages.',
  ].join('\n')
}

function buildAttachmentResearchPrompt({ originalPrompt, summary, claimedCompanyHint }) {
  return [
    'Use the prior attachment evidence already in the thread to answer this request.',
    'Do not ask for the screenshot again.',
    'If the screenshot is on a platform like Discord, Messenger, Instagram, email, or SMS, do not confuse the platform with the company being impersonated.',
    'Prioritize the company the suspicious sender claims to represent or the company tied to the requested payment/account verification.',
    claimedCompanyHint
      ? `Most likely claimed company detected from the screenshot evidence: ${claimedCompanyHint}`
      : 'No reliable claimed-company hint was extracted from the screenshot evidence.',
    'If a company is named or strongly implied, research its official website and official fraud/contact/support policies before concluding.',
    'Explicitly compare what the suspicious party said with what the company says it will or will not do.',
    'If no company can be identified from the evidence, state "Company not found" and continue with general scam analysis only.',
    '',
    'Original request to fulfill:',
    String(originalPrompt || '').trim(),
    '',
    'Attachment evidence summary:',
    String(summary || '').trim() || '(no attachment evidence available)',
  ].join('\n')
}

function sanitizeSummary(summary) {
  let text = String(summary || '').trim()
  if (!text) return ''

  text = text.replace(/\r\n/g, '\n')

  const lines = text.split('\n')
  while (lines.length > 0) {
    const lastLine = String(lines[lines.length - 1] || '').trim()
    if (!lastLine) {
      lines.pop()
      continue
    }

    const looksDanglingMarkdown =
      lastLine.length < 40 &&
      (/\*\*$/.test(lastLine) ||
        /^\*\*[^*]*\)?$/.test(lastLine) ||
        /^[-*]\s*$/.test(lastLine) ||
        /^[([{\-*_`]+$/.test(lastLine))

    if (!looksDanglingMarkdown) break
    lines.pop()
  }

  text = lines.join('\n').trim()
  text = text.replace(/\*\*([^*\n]{0,40})$/, '$1').trim()
  return text
}

function createResearchLoop({ config, backboardClient, jinaClient, sessionStore, projectRoot }) {
  const systemPromptPath = path.join(projectRoot, 'electron', 'research-agent', 'system-prompt.md')
  let assistantPromise = null
  const threadPromisesByChatId = new Map()
  const activeRunsByChatId = new Map()

  function isThreadNotFoundError(error) {
    if (!(error instanceof Error)) return false
    return error.message.includes('Backboard API error (404)') && /thread not found/i.test(error.message)
  }

  function isAssistantNotFoundError(error) {
    if (!(error instanceof Error)) return false
    return error.message.includes('Backboard API error (404)') && /assistant not found/i.test(error.message)
  }

  function readSystemPrompt() {
    return fs.readFileSync(systemPromptPath, 'utf8')
  }

  function shouldUseAttachmentSafeMode(attachmentFilePaths) {
    return config.backboardProvider === 'anthropic' && Array.isArray(attachmentFilePaths) && attachmentFilePaths.length > 0
  }

  function loadSession() {
    return (
      sessionStore.load() || {
        assistantId: null,
        assistantFingerprint: null,
        threadsByChatId: {},
      }
    )
  }

  function resetSession() {
    sessionStore.save({
      assistantId: null,
      assistantFingerprint: null,
      threadsByChatId: {},
    })
  }

  function buildAssistantFingerprint({ systemPrompt }) {
    const payload = JSON.stringify({
      systemPrompt,
      tools: RESEARCH_TOOLS,
      provider: config.backboardProvider,
      model: config.backboardModel,
    })

    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  function clearThreadForChat(chatId) {
    const session = loadSession()
    if (!session.threadsByChatId?.[chatId]) return

    const nextThreads = { ...(session.threadsByChatId || {}) }
    delete nextThreads[chatId]
    sessionStore.save({
      assistantId: session.assistantId,
      assistantFingerprint: session.assistantFingerprint,
      threadsByChatId: nextThreads,
    })
  }

  async function ensureAssistant(onEvent) {
    const systemPrompt = readSystemPrompt()
    const assistantFingerprint = buildAssistantFingerprint({ systemPrompt })
    const session = loadSession()
    if (session.assistantId && session.assistantFingerprint === assistantFingerprint) {
      return session
    }

    if (assistantPromise) {
      return assistantPromise
    }

    assistantPromise = (async () => {
      const latest = loadSession()
      if (latest.assistantId && latest.assistantFingerprint === assistantFingerprint) {
        return latest
      }

      onEvent({
        type: 'progress',
        message: latest.assistantId
          ? 'Research assistant config changed. Reinitializing...'
          : 'Initializing research assistant...',
      })

      const assistant = await backboardClient.createAssistant({
        name: 'Research Agent',
        systemPrompt,
        tools: RESEARCH_TOOLS,
      })

      const next = {
        assistantId: assistant.assistant_id,
        assistantFingerprint,
        threadsByChatId: {},
      }
      sessionStore.save(next)
      return next
    })()

    try {
      return await assistantPromise
    } finally {
      assistantPromise = null
    }
  }

  async function ensureThreadForChat({ chatId, onEvent }) {
    const normalizedChatId = String(chatId || '').trim()
    if (!normalizedChatId) {
      throw new Error('chatId is required')
    }

    const session = await ensureAssistant(onEvent)
    const latestSession = loadSession()
    const existingThreadId = latestSession.threadsByChatId?.[normalizedChatId] || session.threadsByChatId?.[normalizedChatId]
    if (existingThreadId) {
      return {
        assistantId: latestSession.assistantId || session.assistantId,
        threadId: existingThreadId,
      }
    }

    const inFlight = threadPromisesByChatId.get(normalizedChatId)
    if (inFlight) {
      return inFlight
    }

    const threadPromise = (async () => {
      const refreshedSession = await ensureAssistant(onEvent)
      const persistedSession = loadSession()
      const persistedThreadId = persistedSession.threadsByChatId?.[normalizedChatId]
      if (persistedThreadId) {
        return {
          assistantId: persistedSession.assistantId || refreshedSession.assistantId,
          threadId: persistedThreadId,
        }
      }

      onEvent({ type: 'progress', message: 'Initializing chat thread...' })
      let thread
      try {
        thread = await backboardClient.createThread(refreshedSession.assistantId)
      } catch (error) {
        if (!isAssistantNotFoundError(error)) {
          throw error
        }

        onEvent({ type: 'progress', message: 'Assistant expired. Reinitializing...' })
        resetSession()
        const recreatedSession = await ensureAssistant(onEvent)
        thread = await backboardClient.createThread(recreatedSession.assistantId)
      }
      const latest = loadSession()
      const next = {
        assistantId: latest.assistantId || refreshedSession.assistantId,
        assistantFingerprint: latest.assistantFingerprint || refreshedSession.assistantFingerprint,
        threadsByChatId: {
          ...(latest.threadsByChatId || {}),
          [normalizedChatId]: thread.thread_id,
        },
      }

      sessionStore.save(next)
      return {
        assistantId: next.assistantId,
        threadId: thread.thread_id,
      }
    })()

    threadPromisesByChatId.set(normalizedChatId, threadPromise)

    try {
      return await threadPromise
    } finally {
      threadPromisesByChatId.delete(normalizedChatId)
    }
  }

  async function initializeChats({ chatIds, onEvent }) {
    const uniqueChatIds = Array.from(
      new Set(
        (Array.isArray(chatIds) ? chatIds : [])
          .map((chatId) => String(chatId || '').trim())
          .filter(Boolean),
      ),
    )

    if (uniqueChatIds.length === 0) {
      return {
        initialized: 0,
      }
    }

    for (const chatId of uniqueChatIds) {
      await ensureThreadForChat({ chatId, onEvent })
    }
    return {
      initialized: uniqueChatIds.length,
    }
  }

  async function runAttachmentSafeAnalysis({ prompt, runId, onEvent, attachmentFilePaths }) {
    onEvent({ type: 'progress', message: 'Using attachment-safe analysis mode...' })

    const assistant = await backboardClient.createAssistant({
      name: 'Research Agent (Attachment-safe)',
      systemPrompt: ATTACHMENT_SAFE_SYSTEM_PROMPT,
      tools: [],
    })

    const thread = await backboardClient.createThread(assistant.assistant_id)
    const normalized = backboardClient.normalizeMessageResponse(
      await backboardClient.addMessage({
        threadId: thread.thread_id,
        content: prompt,
        llmProvider: config.backboardProvider,
        modelName: config.backboardModel,
        attachmentFilePaths,
      }),
    )

    return {
      runId,
      summary: normalized.content || '',
      threadId: thread.thread_id,
      assistantId: assistant.assistant_id,
    }
  }

  async function seedAttachmentContext({ chatId, originalPrompt, summary, onEvent }) {
    const session = await ensureThreadForChat({ chatId, onEvent })
    await backboardClient.addMessage({
      threadId: session.threadId,
      content: buildAttachmentContextSeed({ originalPrompt, summary }),
      llmProvider: config.backboardProvider,
      modelName: config.backboardModel,
      attachmentFilePaths: [],
      sendToLlm: false,
    })

    return session
  }

  async function runToolEnabledConversation({ chatId, prompt, onEvent }) {
    let session = await ensureThreadForChat({ chatId, onEvent })
    onEvent({ type: 'progress', message: 'Submitting prompt to research agent...' })

    let normalized
    try {
      normalized = backboardClient.normalizeMessageResponse(
        await backboardClient.addMessage({
          threadId: session.threadId,
          content: prompt,
          llmProvider: config.backboardProvider,
          modelName: config.backboardModel,
          attachmentFilePaths: [],
        }),
      )
    } catch (error) {
      if (!isThreadNotFoundError(error)) {
        throw error
      }

      onEvent({ type: 'progress', message: 'Stored thread is invalid. Recreating thread...' })
      clearThreadForChat(chatId)
      session = await ensureThreadForChat({ chatId, onEvent })

      normalized = backboardClient.normalizeMessageResponse(
        await backboardClient.addMessage({
          threadId: session.threadId,
          content: prompt,
          llmProvider: config.backboardProvider,
          modelName: config.backboardModel,
          attachmentFilePaths: [],
        }),
      )
    }

    let finalSummary = ''

    while (normalized.status === 'REQUIRES_ACTION' && normalized.toolCalls.length > 0) {
      onEvent({
        type: 'progress',
        message: `Executing ${normalized.toolCalls.length} tool call(s)...`,
      })

      const toolOutputs = await executeToolCalls(normalized.toolCalls, {
        jinaClient,
        onProgress: onEvent,
        onSummary: (summary) => {
          finalSummary = summary
        },
        onToolLifecycle: onEvent,
      })

      normalized = backboardClient.normalizeMessageResponse(
        await backboardClient.submitToolOutputs({
          threadId: session.threadId,
          runId: normalized.runId,
          toolOutputs,
        }),
      )
    }

    return {
      summary: sanitizeSummary(finalSummary || normalized.content || ''),
      threadId: session.threadId,
      assistantId: session.assistantId,
    }
  }

  async function run({ chatId, prompt, runId, onEvent, attachmentFilePaths = [] }) {
    const normalizedChatId = String(chatId || '').trim()
    if (!normalizedChatId) {
      throw new Error('chatId is required')
    }

    if (activeRunsByChatId.has(normalizedChatId)) {
      throw new Error('Research run is already in progress for this chat')
    }

    const runPromise = (async () => {
      if (shouldUseAttachmentSafeMode(attachmentFilePaths)) {
        const attachmentResult = await runAttachmentSafeAnalysis({
          prompt,
          runId,
          onEvent,
          attachmentFilePaths,
        })
        const claimedCompanyHint = extractClaimedCompany(attachmentResult.summary)

        const seededSession = await seedAttachmentContext({
          chatId: normalizedChatId,
          originalPrompt: prompt,
          summary: attachmentResult.summary,
          onEvent,
        })

        const researchedResult = await runToolEnabledConversation({
          chatId: normalizedChatId,
          prompt: buildAttachmentResearchPrompt({
            originalPrompt: prompt,
            summary: attachmentResult.summary,
            claimedCompanyHint,
          }),
          onEvent,
        })

        return {
          runId,
          summary: researchedResult.summary,
          threadId: researchedResult.threadId || seededSession.threadId,
          assistantId: researchedResult.assistantId || seededSession.assistantId,
        }
      }

      const conversationResult = await runToolEnabledConversation({
        chatId: normalizedChatId,
        prompt,
        onEvent,
      })

      return {
        runId,
        summary: conversationResult.summary,
        threadId: conversationResult.threadId,
        assistantId: conversationResult.assistantId,
      }
    })()

    activeRunsByChatId.set(normalizedChatId, runPromise)
    try {
      return await runPromise
    } finally {
      if (activeRunsByChatId.get(normalizedChatId) === runPromise) {
        activeRunsByChatId.delete(normalizedChatId)
      }
    }
  }

  function resetThread(chatId) {
    const normalizedChatId = String(chatId || '').trim()
    if (!normalizedChatId) {
      throw new Error('chatId is required')
    }
    if (activeRunsByChatId.has(normalizedChatId)) {
      throw new Error('Cannot reset thread while research is running for this chat')
    }

    clearThreadForChat(normalizedChatId)
    return {
      ok: true,
      chatId: normalizedChatId,
    }
  }

  return {
    initializeChats,
    run,
    resetThread,
  }
}

module.exports = {
  createResearchLoop,
}
