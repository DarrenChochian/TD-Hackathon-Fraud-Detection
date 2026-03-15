const fs = require('fs')
const path = require('path')

function createChatHistoryStore({ projectRoot }) {
  const storageDir = path.join(projectRoot, 'storage')

  function ensureStorageDir() {
    fs.mkdirSync(storageDir, { recursive: true })
  }

  function historyPathForChat(chatId) {
    return path.join(storageDir, `chat-history-${chatId}.json`)
  }

  function load(chatId) {
    const filePath = historyPathForChat(chatId)
    if (!fs.existsSync(filePath)) return []
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function append({ chatId, prompt, response }) {
    ensureStorageDir()
    const history = load(chatId)
    history.push({
      timestamp: new Date().toISOString(),
      prompt,
      response,
    })
    fs.writeFileSync(historyPathForChat(chatId), JSON.stringify(history, null, 2), 'utf8')
  }

  return { load, append }
}

module.exports = { createChatHistoryStore }
