import { BG_PANEL, BORDER_PINK, GLASS_BACKDROP, NEUTRAL_PANEL_FILL, NEUTRAL_PANEL_SHADOW, PINK_LIGHT } from '../utils/constants'

export default function TranscriptionDebug({
  transcriptionSessionState,
  sourceStates,
  sourceChunkCounts,
  sourceAudioLevels,
  latestTranscripts,
  transcriptKinds,
  lastTranscriptionActivityAt,
  screenshotStatus,
  lastScreenshotAt,
  transcriptionWarning,
  transcriptionError,
  isMac,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="overlay-interactive absolute right-4 top-24 w-72 rounded-xl border p-3 z-10"
      style={{
        backgroundColor: BG_PANEL,
        backgroundImage: NEUTRAL_PANEL_FILL,
        borderColor: BORDER_PINK,
        boxShadow: NEUTRAL_PANEL_SHADOW,
        backdropFilter: GLASS_BACKDROP,
        WebkitBackdropFilter: GLASS_BACKDROP,
      }}
    >
      <div className="text-xs font-semibold uppercase mb-2" style={{ color: PINK_LIGHT }}>
        Transcription Debug
      </div>
      <div className="text-xs space-y-1" style={{ color: 'rgba(226, 233, 255, 0.92)' }}>
        <div>Session: <span className="font-semibold">{transcriptionSessionState}</span></div>
        <div>Caller source: <span className="font-semibold">{sourceStates.caller}</span> · chunks {sourceChunkCounts.caller}</div>
        <div>User source: <span className="font-semibold">{sourceStates.user}</span> · chunks {sourceChunkCounts.user}</div>
        <div>Caller level: {sourceAudioLevels.caller.toFixed(1)}</div>
        <div>User level: {sourceAudioLevels.user.toFixed(1)}</div>
        <div className="truncate">Caller ({transcriptKinds.caller}): {latestTranscripts.caller || '...'}</div>
        <div className="truncate">User ({transcriptKinds.user}): {latestTranscripts.user || '...'}</div>
        <div>Last activity: {lastTranscriptionActivityAt ? new Date(lastTranscriptionActivityAt).toLocaleTimeString() : 'n/a'}</div>
        <div>Screenshot: {screenshotStatus}{lastScreenshotAt ? ` @ ${lastScreenshotAt}` : ''}</div>
        {isMac && (
          <div style={{ color: '#fbbf24' }}>
            macOS: if desktop audio is silent, verify Screen Recording + system audio permissions.
          </div>
        )}
        {transcriptionWarning && <div style={{ color: '#fbbf24' }}>{transcriptionWarning}</div>}
        {transcriptionError && <div style={{ color: '#f87171' }}>{transcriptionError}</div>}
      </div>
    </div>
  )
}
