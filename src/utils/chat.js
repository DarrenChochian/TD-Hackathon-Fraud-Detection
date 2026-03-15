export function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function truncate(text, max = 90) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function initialMessagesForChat(chatId) {
  return [
    {
      id: `${chatId}-welcome`,
      type: 'text',
      role: 'assistant',
      text: 'Hello! How can I help you today?',
    },
  ]
}

export function buildInitialChatMessages(chatDefinitions) {
  return Object.fromEntries(chatDefinitions.map((chat) => [chat.id, initialMessagesForChat(chat.id)]))
}

export function buildSuspiciousScanPrompt({ screenshotResult, callerTranscript, userTranscript }) {
  const caller = String(callerTranscript || '').trim() || '(no caller transcript yet)'
  const user = String(userTranscript || '').trim() || '(no user transcript yet)'
  const capturedAt = new Date().toISOString()
  const screenshotName = String(screenshotResult?.filePath || '')
    .split(/[/\\]/)
    .filter(Boolean)
    .pop() || 'screenshot.png'

  return [
    'Analyze this interaction for scam risk.',
    'A screenshot image is attached to this message. Use it as primary evidence.',
    `Screenshot captured at: ${capturedAt}`,
    `Attached screenshot filename: ${screenshotName}`,
    `Screenshot size: ${screenshotResult.width}x${screenshotResult.height}`,
    '',
    'Focus on signs such as:',
    '- Requests for personal information (DOB, SSN, card/account details, PIN, OTP, passwords)',
    '- Untrusted or mismatched domains/links',
    '- Urgency/threat language or pressure tactics',
    '- Requests for payment, gift cards, crypto, wire transfer, or remote-access tools',
    '',
    'Transcript context:',
    `- Caller: ${caller}`,
    `- User: ${user}`,
    '',
    'Return:',
    '1) Risk level (low/medium/high)',
    '2) Red flags found (if any)',
    '3) Immediate next steps for the user',
  ].join('\n')
}

export function statusStyles(status) {
  if (status === 'success') {
    return {
      borderColor: 'rgba(34, 197, 94, 0.35)',
      textColor: 'rgb(134 239 172)',
      badgeBg: 'rgba(34, 197, 94, 0.15)',
      badgeText: 'rgb(134 239 172)',
    }
  }
  if (status === 'error') {
    return {
      borderColor: 'rgba(239, 68, 68, 0.4)',
      textColor: 'rgb(252 165 165)',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeText: 'rgb(252 165 165)',
    }
  }
  return {
    borderColor: 'rgba(255, 90, 168, 0.45)',
    textColor: '#ff8ec8',
    badgeBg: 'rgba(255, 90, 168, 0.15)',
    badgeText: '#ff8ec8',
  }
}

export function previewForHistory(message) {
  if (!message) return 'No activity yet'
  if (message.type === 'tool') {
    return `${message.toolName || 'tool'} (${message.status || 'running'}) • ${message.argsPreview || 'no args'}`
  }
  return message.text || 'No activity yet'
}

export function toolEntryIdFromEvent(payload) {
  const runId = payload?.runId || 'run'
  const toolCallId = payload?.toolCallId || `${payload?.toolName || 'tool'}-${payload?.argsPreview || 'args'}`
  return `tool-${runId}-${toolCallId}`
}
