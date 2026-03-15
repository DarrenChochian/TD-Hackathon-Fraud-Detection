export default function ChatIcon({ onClick, open, onMouseEnter, onMouseLeave }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-12 h-12 rounded-full flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-110 active:scale-95 border"
      style={{
        background: 'rgba(10, 12, 18, 0.65)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 132, 198, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px rgba(255, 255, 255, 0.1)',
      }}
      title={open ? 'Close chat' : 'Open chat'}
    >
      <div className="w-1 h-1 rounded-full bg-white" />
      <div className="w-1 h-1 rounded-full bg-white" />
      <div className="w-1 h-1 rounded-full bg-white" />
    </button>
  )
}
