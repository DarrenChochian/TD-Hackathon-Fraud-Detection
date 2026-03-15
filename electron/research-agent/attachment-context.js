const fs = require('fs/promises')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'])
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.log', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.xml', '.yml', '.yaml',
])

function isImageAttachment(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase())
}

function isTextAttachment(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase())
}

function truncate(text, max = 8000) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n…[truncated]`
}

function redactSensitiveText(text) {
  const patterns = [
    /\b([A-Za-z0-9_]*(?:api[_-]?key|token|secret|password|passwd|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)[A-Za-z0-9_]*)\b\s*[:=]\s*(["']?)([^\s"',}]{4,})(\2)/gi,
    /(Bearer\s+)([A-Za-z0-9._-]{10,})/g,
  ]

  let sanitized = String(text || '')
  sanitized = sanitized.replace(patterns[0], (_match, key, quoteStart, _value, quoteEnd) => {
    const quote = quoteStart || quoteEnd || ''
    return `${key}=${quote}[REDACTED]${quote}`
  })
  sanitized = sanitized.replace(patterns[1], '$1[REDACTED]')

  const lines = sanitized.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (!/(api[_-]?key|token|secret|password|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)/i.test(lines[index])) {
      continue
    }

    for (let offset = 1; offset <= 2; offset += 1) {
      const nextIndex = index + offset
      if (nextIndex >= lines.length) break
      if (/^[A-Za-z0-9._:-]{4,}$/.test(lines[nextIndex].trim()) && !lines[nextIndex].includes('=')) {
        lines[nextIndex] = '[REDACTED]'
      }
    }
  }

  return lines.join('\n')
}

async function ensureMacOSImageOcrHelper({ projectRoot, userDataPath }) {
  const sourcePath = path.join(projectRoot, 'electron', 'research-agent', 'image-ocr.swift')
  const binaryPath = path.join(userDataPath, 'bin', 'research-image-ocr')

  const [sourceStats, binaryStats] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(binaryPath).catch(() => null),
  ])

  if (binaryStats && binaryStats.mtimeMs >= sourceStats.mtimeMs) {
    return binaryPath
  }

  await fs.mkdir(path.dirname(binaryPath), { recursive: true })
  await execFileAsync('/usr/bin/xcrun', ['swiftc', '-O', sourcePath, '-o', binaryPath])
  return binaryPath
}

async function extractImageText({ filePath, projectRoot, userDataPath }) {
  if (process.platform === 'darwin') {
    const helperPath = await ensureMacOSImageOcrHelper({ projectRoot, userDataPath })
    const { stdout } = await execFileAsync(helperPath, [filePath], { maxBuffer: 1024 * 1024 * 8 })
    return truncate(redactSensitiveText(stdout), 12000)
  }

  if (process.platform === 'win32') {
    const scriptPath = path.join(projectRoot, 'electron', 'research-agent', 'image-ocr.ps1')
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      filePath,
    ], { maxBuffer: 1024 * 1024 * 8 })
    return truncate(redactSensitiveText(stdout), 12000)
  }

  throw new Error('Local OCR is currently supported on macOS and Windows only')
}

async function extractTextAttachment(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return truncate(redactSensitiveText(content), 12000)
}

async function buildAttachmentContext({ attachmentFilePaths = [], projectRoot, userDataPath, onEvent }) {
  const sections = []

  for (const rawFilePath of attachmentFilePaths) {
    const filePath = String(rawFilePath || '').trim()
    if (!filePath) continue

    const fileName = path.basename(filePath)
    try {
      if (isImageAttachment(filePath)) {
        onEvent?.({ type: 'progress', message: `Extracting text from ${fileName}...` })
        const ocrText = await extractImageText({ filePath, projectRoot, userDataPath })
        sections.push([
          `Attachment file: ${fileName}`,
          'Attachment type: image',
          'Locally extracted OCR text:',
          ocrText || '(no text detected)',
        ].join('\n'))
        continue
      }

      if (isTextAttachment(filePath)) {
        onEvent?.({ type: 'progress', message: `Reading text attachment ${fileName}...` })
        const text = await extractTextAttachment(filePath)
        sections.push([
          `Attachment file: ${fileName}`,
          'Attachment type: text',
          'Extracted text:',
          text || '(empty file)',
        ].join('\n'))
        continue
      }

      sections.push([
        `Attachment file: ${fileName}`,
        'Attachment type: unsupported for local extraction',
        'Only the filename is available to the model for this attachment.',
      ].join('\n'))
    } catch (error) {
      sections.push([
        `Attachment file: ${fileName}`,
        `Attachment extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ].join('\n'))
    }
  }

  if (sections.length === 0) return ''

  return [
    'Primary evidence extracted locally from attachments:',
    ...sections,
    '',
    'Treat the attachment evidence above as primary evidence for your analysis.',
  ].join('\n\n')
}

module.exports = {
  buildAttachmentContext,
}
