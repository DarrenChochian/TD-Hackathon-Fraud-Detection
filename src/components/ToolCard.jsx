import { statusStyles } from '../utils/chat'

export default function ToolCard({ message, onToggle }) {
  const style = statusStyles(message.status)
  
  return (
    <div className="flex justify-start">
      <div
        className="w-full max-w-[95%] rounded-xl border overflow-hidden"
        style={{
          borderColor: style.borderColor,
          background:
            'radial-gradient(150% 130% at 45% -20%, rgba(130, 144, 180, 0.17) 0%, rgba(31, 37, 53, 0.72) 55%, rgba(8, 11, 18, 0.94) 100%)',
          boxShadow: 'inset 0 1px rgba(158, 172, 205, 0.18)',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          className="w-full px-3 py-2 text-left flex items-start gap-2 cursor-pointer"
          style={{ color: 'rgba(228, 235, 255, 0.94)' }}
        >
          <span className="text-xs mt-0.5" style={{ color: style.textColor }}>
            {message.expanded ? '▾' : '▸'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate" style={{ color: style.textColor }}>
              {message.toolName || 'tool'}
            </div>
            <div className="text-xs opacity-85 truncate">{message.argsPreview || 'no args'}</div>
          </div>
          <span
            className="text-[10px] px-2 py-1 rounded-full shrink-0 uppercase"
            style={{
              backgroundColor: style.badgeBg,
              color: style.badgeText,
            }}
          >
            {message.status || 'running'}
          </span>
        </button>

        {message.expanded && (
          <div
            className="px-3 py-2 border-t text-xs whitespace-pre-wrap"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(224, 233, 255, 0.95)',
            }}
          >
            {message.error || message.outputPreview || 'No output preview'}
          </div>
        )}
      </div>
    </div>
  )
}
