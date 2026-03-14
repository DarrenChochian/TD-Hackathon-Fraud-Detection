const fs = require('fs')
const path = require('path')

function parseEnvContent(content) {
  const result = {}
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }
  return result
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  return parseEnvContent(content)
}

function createResearchConfig({ projectRoot }) {
  const exampleEnv = readEnvFile(path.join(projectRoot, '.env.example'))
  const localEnv = readEnvFile(path.join(projectRoot, '.env'))

  const env = {
    ...exampleEnv,
    ...localEnv,
    ...process.env,
  }

  const required = ['JINA_API_KEY', 'BACKBOARD_API_KEY', 'BACKBOARD_PROVIDER', 'BACKBOARD_MODEL']
  const missing = required.filter((key) => !env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return {
    jinaApiKey: env.JINA_API_KEY,
    backboardApiKey: env.BACKBOARD_API_KEY,
    backboardProvider: env.BACKBOARD_PROVIDER,
    backboardModel: env.BACKBOARD_MODEL,
    backboardBaseUrl: env.BACKBOARD_BASE_URL || 'https://app.backboard.io/api',
  }
}

module.exports = {
  createResearchConfig,
}
