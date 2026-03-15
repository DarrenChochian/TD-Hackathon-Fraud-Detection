import { PINK_GLOSS_FILL, PINK_GLOSS_SHADOW, NEUTRAL_CARD_FILL } from '../utils/constants'

export default function ChatIcon({ onClick, open, onMouseEnter, onMouseLeave }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95"
      style={{
        background: open ? PINK_GLOSS_FILL : NEUTRAL_CARD_FILL,
        borderColor: open ? 'rgba(255, 190, 229, 0.9)' : 'rgba(123, 136, 168, 0.3)',
        border: '1px solid',
        boxShadow: open ? PINK_GLOSS_SHADOW : '0 0 0 1px rgba(121, 134, 166, 0.18), inset 0 1px rgba(158, 172, 205, 0.18)',
        color: open ? '#ffe7f5' : 'rgba(224, 232, 255, 0.9)',
      }}
      title={open ? 'Close chat' : 'Open chat'}
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </button>
  )
}
