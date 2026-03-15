import FraudlyLogo from './FraudlyLogo'
import ListenButton from './ListenButton'
import ChatIcon from './ChatIcon'

export default function TopBar({
  isListening,
  onToggleListen,
  transcriptionState,
  chatOpen,
  onChatToggle,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="overlay-interactive absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3"
    >
      <div
        className="flex items-center gap-3 px-3 h-12 rounded-full border"
        style={{
          background: 'rgba(10, 12, 18, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 132, 198, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        <FraudlyLogo />
        <ListenButton
          isListening={isListening}
          onClick={onToggleListen}
          disabled={transcriptionState === 'connecting'}
        />
      </div>
      <ChatIcon
        onClick={onChatToggle}
        open={chatOpen}
      />
    </div>
  )
}
