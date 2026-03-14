const fs = require('fs')
const path = require('path')

function createSessionStore({ userDataPath }) {
  const sessionPath = path.join(userDataPath, 'research-agent-session.json')

  function load() {
    if (!fs.existsSync(sessionPath)) return null
    try {
      const raw = fs.readFileSync(sessionPath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null
      return {
        assistantId: parsed.assistantId || null,
        threadId: parsed.threadId || null,
      }
    } catch {
      return null
    }
  }

  function save({ assistantId, threadId }) {
    const payload = {
      assistantId,
      threadId,
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(sessionPath, JSON.stringify(payload, null, 2), 'utf8')
  }

  return {
    load,
    save,
    sessionPath,
  }
}

module.exports = {
  createSessionStore,
}
