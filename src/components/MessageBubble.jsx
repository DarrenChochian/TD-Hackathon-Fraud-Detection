import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { USER_BUBBLE_FILL, USER_BUBBLE_SHADOW } from '../utils/constants'

function MarkdownMessage({ text, className = 'text-sm' }) {
  return (
    <div className={`${className} break-words`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-5 list-disc last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-5 list-decimal last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline decoration-current break-all">
              {children}
            </a>
          ),
          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-md bg-black/35 p-2">{children}</pre>,
          code: ({ inline, children }) =>
            inline ? (
              <code className="rounded bg-black/30 px-1 py-0.5">{children}</code>
            ) : (
              <code className="text-xs">{children}</code>
            ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-white/30 pl-3 italic">{children}</blockquote>
          ),
        }}
      >
        {String(text ?? '')}
      </ReactMarkdown>
    </div>
  )
}

export default function MessageBubble({ message }) {
  if (message.type === 'progress') {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[95%] rounded-lg px-3 py-2 border text-xs"
          style={{
            background:
              'radial-gradient(140% 130% at 45% -10%, rgba(126, 140, 176, 0.18) 0%, rgba(29, 35, 50, 0.8) 100%)',
            borderColor: 'rgba(121, 134, 167, 0.3)',
            boxShadow: 'inset 0 1px rgba(159, 173, 205, 0.2)',
            color: 'rgba(228, 235, 255, 0.92)',
          }}
        >
          <MarkdownMessage text={message.text} className="text-xs" />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl border ${
          message.role === 'user'
            ? 'relative origin-top-right overflow-hidden rounded-br-md px-3 py-1'
            : 'rounded-bl-md px-4 py-2.5'
        }`}
        style={{
          background:
            message.role === 'user'
              ? USER_BUBBLE_FILL
              : 'radial-gradient(160% 130% at 40% -20%, rgba(122, 137, 173, 0.18) 0%, rgba(30, 36, 51, 0.72) 52%, rgba(8, 11, 18, 0.94) 100%)',
          borderColor:
            message.role === 'user' ? 'rgba(255, 186, 226, 0.95)' : 'rgba(122, 136, 170, 0.26)',
          boxShadow:
            message.role === 'user'
              ? USER_BUBBLE_SHADOW
              : '0 0 0 1px rgba(121, 134, 166, 0.18), inset 0 1px rgba(158, 172, 205, 0.18)',
          color: message.role === 'user' ? '#ffe8f7' : 'rgba(226, 233, 255, 0.95)',
        }}
      >
        <MarkdownMessage
          text={message.text}
          className={message.role === 'user' ? 'text-base lg:text-lg' : 'text-sm'}
        />
      </div>
    </div>
  )
}
