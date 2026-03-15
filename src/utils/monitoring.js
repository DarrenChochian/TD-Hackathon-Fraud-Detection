const MONITOR_BLOCK_REGEX = /```fraud-monitor\s*([\s\S]*?)(?:```|$)/i

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLooseText(value) {
  return normalizeText(value).replace(/[^a-z0-9 ]/g, '')
}

function normalizeStatus(status) {
  const normalized = normalizeText(status)
  return normalized === 'suspicious' ? 'suspicious' : 'safe'
}

function normalizeRiskLevel(riskLevel) {
  const normalized = normalizeText(riskLevel)
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return 'low'
}

function parseMonitorBlock(summary) {
  const match = String(summary || '').match(MONITOR_BLOCK_REGEX)
  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export function stripMonitorBlock(summary) {
  return String(summary || '')
    .replace(MONITOR_BLOCK_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseMonitorSummary(summary) {
  const parsed = parseMonitorBlock(summary) || {}
  const displaySummary = stripMonitorBlock(summary)
  const incidentTitle = String(parsed.incidentTitle || parsed.title || '').trim()
  const quickDebrief = String(parsed.quickDebrief || parsed.brief || '').trim()
  const fingerprint = String(parsed.fingerprint || '').trim()

  return {
    status: normalizeStatus(parsed.status),
    riskLevel: normalizeRiskLevel(parsed.riskLevel),
    incidentTitle,
    quickDebrief,
    fingerprint,
    sameIncidentAsPrevious: typeof parsed.sameIncidentAsPrevious === 'boolean' ? parsed.sameIncidentAsPrevious : null,
    meaningfulChange: typeof parsed.meaningfulChange === 'boolean' ? parsed.meaningfulChange : null,
    displaySummary: displaySummary || quickDebrief || incidentTitle,
    rawSummary: String(summary || '').trim(),
  }
}

export function isSuspiciousMonitorResult(result) {
  return result?.status === 'suspicious'
}

export function isSameIncident(activeIncident, nextResult) {
  if (!activeIncident || !nextResult) return false
  if (nextResult.sameIncidentAsPrevious === false) return false
  if (nextResult.sameIncidentAsPrevious === true) return true

  const currentFingerprint = normalizeLooseText(activeIncident.fingerprint)
  const nextFingerprint = normalizeLooseText(nextResult.fingerprint)
  if (currentFingerprint && nextFingerprint) {
    return currentFingerprint === nextFingerprint
  }

  const currentTitle = normalizeLooseText(activeIncident.title)
  const nextTitle = normalizeLooseText(nextResult.incidentTitle)
  return Boolean(currentTitle && nextTitle && currentTitle === nextTitle)
}

export function hasMeaningfulIncidentChange(activeIncident, nextResult) {
  if (!activeIncident || !nextResult) return true
  if (nextResult.meaningfulChange === false) return false
  if (nextResult.meaningfulChange === true) return true

  if (normalizeText(activeIncident.riskLevel) !== normalizeText(nextResult.riskLevel)) {
    return true
  }

  if (normalizeLooseText(activeIncident.title) !== normalizeLooseText(nextResult.incidentTitle)) {
    return true
  }

  if (normalizeLooseText(activeIncident.quickDebrief) !== normalizeLooseText(nextResult.quickDebrief)) {
    return true
  }

  return false
}

export function buildIncidentAlertTitle(result) {
  const riskLabel = String(result?.riskLevel || 'high').trim().toUpperCase()
  const title = String(result?.incidentTitle || 'Possible fraud detected').trim()
  return `${riskLabel} RISK: ${title}`
}

export function buildIncidentChatSummary(result) {
  const title = String(result?.incidentTitle || 'Possible fraud detected').trim()
  const quickDebrief = String(result?.quickDebrief || '').trim()
  const displaySummary = String(result?.displaySummary || '').trim()

  if (quickDebrief) return `## ${title}\n\n${quickDebrief}`
  if (displaySummary) return displaySummary
  return `## ${title}`
}

export function buildMonitorVerdictLog(result) {
  if (!result) return 'Verdict unavailable'

  if (result.status === 'suspicious') {
    const riskLevel = String(result.riskLevel || 'high').toUpperCase()
    const reasoning = String(result.quickDebrief || result.incidentTitle || 'Suspicious indicators detected').trim()
    return `Verdict: ${riskLevel} suspicious — ${reasoning}`
  }

  const reasoning = String(result.quickDebrief || result.displaySummary || 'No suspicious indicators detected').trim()
  return `Verdict: safe — ${reasoning}`
}
