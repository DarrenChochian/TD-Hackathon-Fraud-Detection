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
  lastAnalysisAt,
  monitorLogs = [],
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
        <div>Last monitor verdict: {lastAnalysisAt || 'n/a'}</div>
        <div className="mt-2 rounded-lg border p-2" style={{ borderColor: 'rgba(255, 132, 198, 0.18)', background: 'rgba(8, 11, 17, 0.45)' }}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: PINK_LIGHT }}>
            Monitor Progress
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] leading-4" style={{ color: 'rgba(226, 233, 255, 0.82)' }}>
            {monitorLogs.length > 0 ? monitorLogs.map((entry) => (
              <div key={entry.id} className="break-words">
                <span style={{ color: 'rgba(255, 184, 222, 0.9)' }}>{entry.at}</span>
                {' · '}
                <span>{entry.message}</span>
              </div>
            )) : <div>No monitor activity yet.</div>}
          </div>
        </div>
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
