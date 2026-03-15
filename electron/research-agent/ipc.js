const crypto = require('crypto')
const { createResearchConfig } = require('./config')
const { createBackboardClient } = require('./backboard-client')
const { createJinaClient } = require('./jina-client')
const { createSessionStore } = require('./session-store')
const { createResearchLoop } = require('./research-loop')
const { createChatHistoryStore } = require('./chat-history-store')

function registerResearchAgentIpc({ ipcMain, projectRoot, userDataPath }) {
  const chatHistoryStore = createChatHistoryStore({ projectRoot })
  let services = null

  function getServices() {
    if (services) return services

    const config = createResearchConfig({ projectRoot })
    const backboardClient = createBackboardClient({
      apiKey: config.backboardApiKey,
      baseUrl: config.backboardBaseUrl,
    })
    const jinaClient = createJinaClient({ apiKey: config.jinaApiKey })
    const sessionStore = createSessionStore({ userDataPath })
    const researchLoop = createResearchLoop({
      config,
      backboardClient,
      jinaClient,
      sessionStore,
      projectRoot,
      userDataPath,
    })

    services = {
      researchLoop,
    }

    return services
  }

  ipcMain.handle('research:get-history', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    if (!chatId) return []
    return chatHistoryStore.load(chatId)
  })

  ipcMain.handle('research:list-chats', async () => chatHistoryStore.listChats())

  ipcMain.handle('research:ensure-chat', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    const title = String(payload?.title || '').trim()
    if (!chatId) {
      throw new Error('chatId is required')
    }

    return chatHistoryStore.ensureChat(chatId, title ? { title } : undefined)
  })

  ipcMain.handle('research:create-analysis-chat', async (_, payload) => {
    const title = String(payload?.title || '').trim()
    return chatHistoryStore.createAnalysisChat(title ? { title } : undefined)
  })

  ipcMain.handle('research:set-chat-title', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    const title = String(payload?.title || '').trim()

    if (!chatId) {
      throw new Error('chatId is required')
    }
    if (!title) {
      throw new Error('title is required')
    }

    return chatHistoryStore.setChatTitle(chatId, title)
  })

  ipcMain.handle('research:append-entry', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    const prompt = typeof payload?.prompt === 'string' ? payload.prompt : ''
    const response = String(payload?.response || '').trim()

    if (!chatId) {
      throw new Error('chatId is required')
    }
    if (!response) {
      throw new Error('response is required')
    }

    chatHistoryStore.append({ chatId, prompt, response })
    return chatHistoryStore.ensureChat(chatId)
  })

  ipcMain.handle('research:import-run', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    const run = payload?.run

    if (!chatId) {
      throw new Error('chatId is required')
    }
    if (!run || typeof run !== 'object') {
      throw new Error('run is required')
    }

    return chatHistoryStore.importRun({ chatId, run })
  })

  ipcMain.handle('research:initialize-chats', async (_, payload) => {
    const chatIds = Array.isArray(payload?.chatIds) ? payload.chatIds : []
    return getServices().researchLoop.initializeChats({
      chatIds,
      onEvent: () => {},
    })
  })

  ipcMain.handle('research:reset-thread', async (_, payload) => {
    const chatId = String(payload?.chatId || '').trim()
    if (!chatId) {
      throw new Error('chatId is required')
    }

    return getServices().researchLoop.resetThread(chatId)
  })

  ipcMain.handle('research:run-background', async (_, payload) => {
    const prompt = payload?.prompt
    const chatId = String(payload?.chatId || 'background-monitor').trim()
    const historyChatId = String(payload?.historyChatId || '').trim()
    const displayPrompt = String(payload?.displayPrompt || '').trim()
    const attachmentFilePaths = Array.isArray(payload?.attachmentFilePaths)
      ? payload.attachmentFilePaths.map((value) => String(value || '').trim()).filter(Boolean)
      : []
    const shouldResetThread = payload?.resetThread !== false
    const runId = crypto.randomUUID()
    const collectedToolCalls = []
    let lastProgressMessage = ''

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required')
    }

    const sendEvent = (data) => {
      if (!historyChatId) return

      if (data?.type === 'tool_call_started' || data?.type === 'tool_call_finished') {
        const existingIndex = collectedToolCalls.findIndex((entry) => entry.toolCallId === data.toolCallId)
        const nextToolCall = {
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          argsPreview: data.argsPreview,
          status: data.status,
          outputPreview: data.outputPreview,
          error: data.error,
          ts: data.ts,
        }

        if (existingIndex >= 0) {
          collectedToolCalls[existingIndex] = {
            ...collectedToolCalls[existingIndex],
            ...nextToolCall,
          }
        } else {
          collectedToolCalls.push(nextToolCall)
        }

        chatHistoryStore.recordToolCall({
          chatId: historyChatId,
          runId,
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          argsPreview: data.argsPreview,
          status: data.status,
          outputPreview: data.outputPreview,
          error: data.error,
          ts: data.ts,
        })
      }

      if (data?.type === 'started' || data?.type === 'progress') {
        lastProgressMessage = String(data.message || lastProgressMessage || '')
      }

      _.sender.send('research:event', {
        ...data,
        chatId: historyChatId,
        background: true,
        runId,
        ts: new Date().toISOString(),
      })
    }

    if (shouldResetThread) {
      getServices().researchLoop.resetThread(chatId)
    }

    if (historyChatId) {
      chatHistoryStore.startRun({
        chatId: historyChatId,
        runId,
        prompt: displayPrompt || prompt,
        contextPrompt: prompt,
      })
      sendEvent({ type: 'started', message: 'Background research started.' })
    }

    try {
      const result = await getServices().researchLoop.run({
        chatId,
        prompt,
        runId,
        onEvent: sendEvent,
        attachmentFilePaths,
      })

      if (historyChatId) {
        chatHistoryStore.completeRun({ chatId: historyChatId, runId, response: result.summary })
        sendEvent({ type: 'completed', message: 'Background research completed.', summary: result.summary })
      }

      return {
        ...result,
        run: {
          runId,
          timestamp: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          prompt: displayPrompt || prompt,
          contextPrompt: prompt,
          response: result.summary,
          error: '',
          toolCalls: collectedToolCalls,
          progressMessage: lastProgressMessage,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research failed'
      if (historyChatId) {
        chatHistoryStore.failRun({ chatId: historyChatId, runId, error: message })
        sendEvent({ type: 'error', message })
      }
      throw error
    }
  })

  ipcMain.handle('research:run', async (event, payload) => {
    const prompt = payload?.prompt
    const chatId = String(payload?.chatId || '').trim()
    const displayPrompt = String(payload?.displayPrompt || '').trim()
    const contextPrompt = String(payload?.contextPrompt || '').trim()
    const attachmentFilePaths = Array.isArray(payload?.attachmentFilePaths)
      ? payload.attachmentFilePaths.map((value) => String(value || '').trim()).filter(Boolean)
      : []
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required')
    }
    if (!chatId) {
      throw new Error('chatId is required')
    }

    const runId = crypto.randomUUID()
    const sendEvent = (data) => {
      if (data?.type === 'tool_call_started' || data?.type === 'tool_call_finished') {
        chatHistoryStore.recordToolCall({
          chatId,
          runId,
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          argsPreview: data.argsPreview,
          status: data.status,
          outputPreview: data.outputPreview,
          error: data.error,
          ts: data.ts,
        })
      }

      event.sender.send('research:event', {
        ...data,
        chatId,
        runId,
        ts: new Date().toISOString(),
      })
    }

    sendEvent({ type: 'started', message: 'Research started.' })
    chatHistoryStore.startRun({
      chatId,
      runId,
      prompt: displayPrompt || prompt,
      contextPrompt: contextPrompt || prompt,
    })

    try {
      const result = await getServices().researchLoop.run({
        chatId,
        prompt,
        runId,
        onEvent: sendEvent,
        attachmentFilePaths,
      })

      chatHistoryStore.completeRun({ chatId, runId, response: result.summary })
      sendEvent({ type: 'completed', message: 'Research completed.', summary: result.summary })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research failed'
      chatHistoryStore.failRun({ chatId, runId, error: message })
      sendEvent({ type: 'error', message })
      throw error
    }
  })
}

module.exports = {
  registerResearchAgentIpc,
}
