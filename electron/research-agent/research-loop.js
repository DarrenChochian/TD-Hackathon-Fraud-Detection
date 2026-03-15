const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { RESEARCH_TOOLS } = require('./tool-schema')
const { executeToolCalls } = require('./tool-executor')

const ATTACHMENT_SAFE_SYSTEM_PROMPT = [
  'You are FRAUDLY, a scam prevention agent.',
  'Analyze the user request and any attached files/images using the attachments as primary evidence.',
  'Do not call tools or rely on external web research in this mode.',
  'Return concise markdown that directly answers the user request.',
  'If the user asks for specific fields or sections, follow that exact format.',
].join('\n')

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
  ].join('\n')
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
      summary: finalSummary || normalized.content || '',
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

        const seededSession = await seedAttachmentContext({
          chatId: normalizedChatId,
          originalPrompt: prompt,
          summary: attachmentResult.summary,
          onEvent,
        })

        return {
          runId,
          summary: attachmentResult.summary,
          threadId: seededSession.threadId,
          assistantId: seededSession.assistantId,
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
