const crypto = require('crypto')
const { createResearchConfig } = require('./config')
const { createBackboardClient } = require('./backboard-client')
const { createJinaClient } = require('./jina-client')
const { createSessionStore } = require('./session-store')
const { createResearchLoop } = require('./research-loop')

function registerResearchAgentIpc({ ipcMain, projectRoot, userDataPath }) {
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
    })

    services = {
      researchLoop,
    }

    return services
  }

  ipcMain.handle('research:run', async (event, payload) => {
    const prompt = payload?.prompt
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required')
    }

    const runId = crypto.randomUUID()
    const sendEvent = (data) => {
      event.sender.send('research:event', {
        ...data,
        runId,
        ts: new Date().toISOString(),
      })
    }

    sendEvent({ type: 'started', message: 'Research started.' })

    try {
      const result = await getServices().researchLoop.run({
        prompt,
        runId,
        onEvent: sendEvent,
      })

      sendEvent({ type: 'completed', message: 'Research completed.', summary: result.summary })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research failed'
      sendEvent({ type: 'error', message })
      throw error
    }
  })
}

module.exports = {
  registerResearchAgentIpc,
}
