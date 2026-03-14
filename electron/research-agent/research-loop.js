const fs = require('fs')
const path = require('path')
const { RESEARCH_TOOLS } = require('./tool-schema')
const { executeToolCalls } = require('./tool-executor')

function createResearchLoop({ config, backboardClient, jinaClient, sessionStore, projectRoot }) {
  const systemPromptPath = path.join(projectRoot, 'electron', 'research-agent', 'system-prompt.md')

  function readSystemPrompt() {
    return fs.readFileSync(systemPromptPath, 'utf8')
  }

  async function ensureSession(onEvent) {
    const existing = sessionStore.load()
    if (existing?.assistantId && existing?.threadId) {
      return existing
    }

    onEvent({ type: 'progress', message: 'Initializing research assistant...' })
    const assistant = await backboardClient.createAssistant({
      name: 'Research Agent',
      systemPrompt: readSystemPrompt(),
      tools: RESEARCH_TOOLS,
    })

    const thread = await backboardClient.createThread(assistant.assistant_id)
    const session = {
      assistantId: assistant.assistant_id,
      threadId: thread.thread_id,
    }

    sessionStore.save(session)
    return session
  }

  async function run({ prompt, runId, onEvent }) {
    const session = await ensureSession(onEvent)
    onEvent({ type: 'progress', message: 'Submitting prompt to research agent...' })

    let normalized = backboardClient.normalizeMessageResponse(
      await backboardClient.addMessage({
        threadId: session.threadId,
        content: prompt,
        llmProvider: config.backboardProvider,
        modelName: config.backboardModel,
      }),
    )

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
      })

      normalized = backboardClient.normalizeMessageResponse(
        await backboardClient.submitToolOutputs({
          threadId: session.threadId,
          runId: normalized.runId,
          toolOutputs,
        }),
      )
    }

    const summary = finalSummary || normalized.content || ''

    return {
      runId,
      summary,
      threadId: session.threadId,
      assistantId: session.assistantId,
    }
  }

  return {
    run,
  }
}

module.exports = {
  createResearchLoop,
}
