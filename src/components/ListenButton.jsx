import { PINK_GLOSS_FILL, PINK_GLOSS_SHADOW } from '../utils/constants'

function WaveformIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 14v-4h2v4H4zm4 2v-8h2v8H8zm4-4V6h2v6h-2zm4 2V4h2v8h-2zm4 4V2h2v14h-2z" />
    </svg>
  )
}

export default function ListenButton({ isListening, onClick, disabled, onMouseEnter, onMouseLeave }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
      style={{
        background: PINK_GLOSS_FILL,
        borderColor: 'rgba(255, 194, 231, 0.88)',
        boxShadow: PINK_GLOSS_SHADOW,
      }}
    >
      <WaveformIcon className={`w-4 h-4 text-white ${isListening ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-medium text-white whitespace-nowrap">
        {disabled ? 'Connecting…' : isListening ? 'Listening…' : 'Start Listening'}
      </span>
    </button>
  )
}
