import { useEffect, useRef, useState } from 'react'
import CircularText from './components/CircularText'
import SettingsPanel from './components/SettingsPanel'

function WaveformIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 14v-4h2v4H4zm4 2v-8h2v8H8zm4-4V6h2v6h-2zm4 2V4h2v8h-2zm4 4V2h2v14h-2z" />
    </svg>
  )
}

const BUTTON_WIDTH = 64
const BUTTON_HEIGHT = 64

const PINK_LIGHT = '#ff8ec8'
const BORDER_PINK = 'rgba(255, 132, 198, 0.32)'
const BG_PANEL = 'rgba(10, 12, 18, 0.82)'
const GLASS_BACKDROP = 'blur(18px) saturate(150%)'
const NEUTRAL_PANEL_FILL =
  'radial-gradient(180% 140% at 45% -25%, rgba(82, 94, 122, 0.15) 0%, rgba(18, 22, 33, 0.9) 52%, rgba(7, 9, 15, 0.97) 100%)'
const NEUTRAL_PANEL_HEADER =
  'linear-gradient(180deg, rgba(98, 112, 143, 0.16), rgba(22, 27, 39, 0.84) 68%, rgba(9, 12, 19, 0.94))'
const NEUTRAL_PANEL_SHADOW =
  '0 0 0 1px rgba(116, 128, 158, 0.16), inset 0 -1.2px rgba(5, 7, 12, 0.92), inset 0 0.7px rgba(154, 167, 198, 0.2), 0 20px 44px rgba(0, 0, 0, 0.54), 0 8px 22px rgba(2, 4, 10, 0.56)'
const NEUTRAL_CARD_FILL =
  'radial-gradient(170% 130% at 46% -20%, rgba(124, 138, 172, 0.14) 0%, rgba(25, 30, 43, 0.82) 56%, rgba(8, 11, 17, 0.95) 100%)'
const PINK_GLOSS_FILL =
  'radial-gradient(179.05% 132.83% at 46.18% -23.44%, #ff9bd8 0%, #ff5aa8 35%, #bb2f7a 72%, #6b1b4a 100%)'
const PINK_GLOSS_FILL_DARK =
  'radial-gradient(170% 135% at 46% -24%, rgba(255, 176, 224, 0.34) 0%, rgba(155, 44, 109, 0.58) 42%, rgba(23, 9, 28, 0.92) 100%)'
const PINK_GLOSS_SHADOW =
  '0 0 0 0.7px rgba(255, 133, 199, 0.95), inset 0 -1.35px rgba(93, 10, 57, 0.9), inset 0 0.7px rgba(255, 205, 233, 0.8), 0 9px 28px rgba(134, 25, 90, 0.56), 0 30px 45px rgba(0, 0, 0, 0.28)'
const USER_BUBBLE_FILL = PINK_GLOSS_FILL
const USER_BUBBLE_SHADOW = PINK_GLOSS_SHADOW

const CHAT_DEFINITIONS = [
  { id: '1', title: 'Chat 1' },
  { id: '2', title: 'Chat 2' },
  { id: '3', title: 'Chat 3' },
]

const CHAT_IDS = CHAT_DEFINITIONS.map((chat) => chat.id)

function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function truncate(text, max = 90) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function initialMessagesForChat(chatId) {
  return [
    {
      id: `${chatId}-welcome`,
      type: 'text',
      role: 'assistant',
      text: 'Hello! How can I help you today?',
    },
  ]
}

function buildInitialChatMessages() {
  return Object.fromEntries(CHAT_DEFINITIONS.map((chat) => [chat.id, initialMessagesForChat(chat.id)]))
}

function statusStyles(status) {
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
    textColor: PINK_LIGHT,
    badgeBg: 'rgba(255, 90, 168, 0.15)',
    badgeText: PINK_LIGHT,
  }
}

function previewForHistory(message) {
  if (!message) return 'No activity yet'
  if (message.type === 'tool') {
    return `${message.toolName || 'tool'} (${message.status || 'running'}) • ${message.argsPreview || 'no args'}`
  }
  return message.text || 'No activity yet'
}

function toolEntryIdFromEvent(payload) {
  const runId = payload?.runId || 'run'
  const toolCallId = payload?.toolCallId || `${payload?.toolName || 'tool'}-${payload?.argsPreview || 'args'}`
  return `tool-${runId}-${toolCallId}`
}

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [chatMessages, setChatMessages] = useState(() => buildInitialChatMessages())
  const [input, setInput] = useState('')
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hotkey, setHotkey] = useState('Alt+K')
  const [mainPanelHotkey, setMainPanelHotkey] = useState('Alt+L')
  const [mainPanelHotkeyFailed, setMainPanelHotkeyFailed] = useState(false)
  const [settingsHotkeyFailed, setSettingsHotkeyFailed] = useState(false)
  const [runningByChat, setRunningByChat] = useState({})
  const interactiveHoverCountRef = useRef(0)

  useEffect(() => {
    window.electronAPI?.getHotkey?.().then((res) => {
      if (res?.accelerator) setHotkey(res.accelerator)
    })
    window.electronAPI?.getMainPanelHotkey?.().then((res) => {
      if (res?.accelerator) setMainPanelHotkey(res.accelerator)
    })
  }, [])

  const setOverlayInteractivity = (interactive) => {
    window.electronAPI?.setOverlayInteractivity?.(interactive)
  }

  const resetOverlayInteractivity = () => {
    interactiveHoverCountRef.current = 0
    setOverlayInteractivity(false)
  }

  const handleInteractiveEnter = () => {
    interactiveHoverCountRef.current += 1
    if (interactiveHoverCountRef.current === 1) {
      setOverlayInteractivity(true)
    }
  }

  const handleInteractiveLeave = () => {
    interactiveHoverCountRef.current = Math.max(0, interactiveHoverCountRef.current - 1)
    if (interactiveHoverCountRef.current === 0) {
      setOverlayInteractivity(false)
    }
  }

  const appendMessage = (chatId, message) => {
    setChatMessages((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), message],
    }))
  }

  const toggleToolCard = (chatId, messageId) => {
    setChatMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((message) =>
        message.id === messageId ? { ...message, expanded: !message.expanded } : message,
      ),
    }))
  }

  useEffect(() => {
    setOverlayInteractivity(false)
    return () => setOverlayInteractivity(false)
  }, [])

  useEffect(() => {
    const unsubSettings = window.electronAPI?.onOpenSettings?.(() => {
      setSettingsOpen((v) => {
        if (v) resetOverlayInteractivity()
        return !v
      })
    })
    const unsubMainPanel = window.electronAPI?.onMainPanelOpen?.(() => {
      console.log('[renderer] main-panel:open received')
      setModalOpen((prev) => {
        if (prev) {
          setSelectedChatId(null)
          resetOverlayInteractivity()
        } else {
          setSelectedChatId(CHAT_DEFINITIONS[0]?.id ?? null)
        }
        return !prev
      })
    })
    const unsubRegistration = window.electronAPI?.onHotkeyRegistrationResult?.((result) => {
      console.log('[renderer] hotkey:registration-result', result)
      if (result?.settings) {
        setHotkey(result.settings.accelerator)
        setSettingsHotkeyFailed(!result.settings.ok)
      }
      if (result?.mainPanel) {
        setMainPanelHotkey(result.mainPanel.accelerator)
        setMainPanelHotkeyFailed(!result.mainPanel.ok)
      }
    })
    return () => {
      unsubSettings?.()
      unsubMainPanel?.()
      unsubRegistration?.()
    }
  }, [])

  useEffect(() => {
    window.electronAPI
      ?.initializeResearchChats?.(CHAT_IDS)
      .catch((error) => console.error('Failed to initialize research chats:', error))
  }, [])

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onResearchEvent?.((payload) => {
      const chatId = String(payload?.chatId || '').trim()
      if (!chatId) return

      if (payload.type === 'tool_call_started' || payload.type === 'tool_call_finished') {
        setChatMessages((prev) => {
          const nextChatMessages = [...(prev[chatId] || [])]
          const messageId = toolEntryIdFromEvent(payload)
          const existingIndex = nextChatMessages.findIndex((message) => message.id === messageId)
          const existing = existingIndex >= 0 ? nextChatMessages[existingIndex] : null

          const nextMessage = {
            id: messageId,
            type: 'tool',
            role: 'assistant',
            toolCallId: payload.toolCallId || '',
            toolName: payload.toolName || 'tool',
            argsPreview: payload.argsPreview || existing?.argsPreview || 'no args',
            status:
              payload.status || (payload.type === 'tool_call_started' ? 'running' : existing?.status || 'success'),
            outputPreview: payload.outputPreview || existing?.outputPreview || '',
            error: payload.error || existing?.error || '',
            expanded: existing?.expanded || false,
          }

          if (existingIndex >= 0) {
            nextChatMessages[existingIndex] = nextMessage
          } else {
            nextChatMessages.push(nextMessage)
          }

          return {
            ...prev,
            [chatId]: nextChatMessages,
          }
        })
      } else if (payload.type === 'started' || payload.type === 'progress') {
        appendMessage(chatId, {
          id: createMessageId('progress'),
          type: 'progress',
          role: 'assistant',
          text: payload.message || 'Working...',
        })
      } else if (payload.type === 'completed') {
        if (payload.summary) {
          appendMessage(chatId, {
            id: createMessageId('assistant'),
            type: 'text',
            role: 'assistant',
            text: payload.summary,
          })
        }
        setRunningByChat((prev) => {
          const next = { ...prev }
          delete next[chatId]
          return next
        })
      } else if (payload.type === 'error') {
        appendMessage(chatId, {
          id: createMessageId('error'),
          type: 'text',
          role: 'assistant',
          text: `Research failed: ${payload.message || 'Unknown error'}`,
        })
        setRunningByChat((prev) => {
          const next = { ...prev }
          delete next[chatId]
          return next
        })
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  const handleOverlayClose = () => {
    setModalOpen(false)
    setSelectedChatId(null)
    resetOverlayInteractivity()
  }

  const handleChatClose = () => {
    setSelectedChatId(null)
    resetOverlayInteractivity()
  }

  const handleToggle = () => {
    if (modalOpen) {
      handleOverlayClose()
      return
    }
    setModalOpen(true)
    setSelectedChatId(CHAT_DEFINITIONS[0]?.id ?? null)
  }

  const handleSend = async (event) => {
    event.preventDefault()

    const chatId = selectedChatId
    const text = input.trim()
    if (!chatId || !text || runningByChat[chatId]) return

    setInput('')
    appendMessage(chatId, {
      id: createMessageId('user'),
      type: 'text',
      role: 'user',
      text,
    })

    if (!window.electronAPI?.runResearch) {
      appendMessage(chatId, {
        id: createMessageId('error'),
        type: 'text',
        role: 'assistant',
        text: 'Research backend is unavailable.',
      })
      return
    }

    setRunningByChat((prev) => ({
      ...prev,
      [chatId]: true,
    }))

    try {
      await window.electronAPI.runResearch({
        chatId,
        prompt: text,
      })
    } catch {
      setRunningByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        return next
      })
    }
  }

  const historyWithPreview = CHAT_DEFINITIONS.map((chat) => {
    const messagesForChat = chatMessages[chat.id] || []
    const lastMessage = messagesForChat[messagesForChat.length - 1]
    return {
      ...chat,
      preview: truncate(previewForHistory(lastMessage)),
    }
  })

  const messages = selectedChatId ? (chatMessages[selectedChatId] || []) : []
  const selectedChatIsRunning = selectedChatId ? Boolean(runningByChat[selectedChatId]) : false

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={handleInteractiveEnter}
        onMouseLeave={handleInteractiveLeave}
        style={{
          width: BUTTON_WIDTH,
          height: BUTTON_HEIGHT,
          background: PINK_GLOSS_FILL,
          border: '1px solid rgba(255, 186, 226, 0.82)',
          boxShadow: PINK_GLOSS_SHADOW,
        }}
        className="overlay-interactive absolute top-5 right-5 text-sm font-semibold text-white border-0 rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95 z-20"
        title={modalOpen ? `Close (${mainPanelHotkey})` : `Open (${mainPanelHotkey})`}
      >
        <CircularText text="FRAUDLY" onHover="speedUp" spinDuration={20} className="custom-class" />
      </button>

      {/* Settings gear button - below FRAUDLY button */}
      <button
        type="button"
        onClick={() => setSettingsOpen((v) => { if (v) resetOverlayInteractivity(); return !v })}
        onMouseEnter={handleInteractiveEnter}
        onMouseLeave={handleInteractiveLeave}
        className="overlay-interactive absolute right-6 top-[90px] w-8 h-8 flex items-center justify-center rounded-lg border cursor-pointer transition-all hover:scale-110 active:scale-95 z-20"
        style={{
          background: settingsOpen ? PINK_GLOSS_FILL : NEUTRAL_CARD_FILL,
          borderColor: settingsOpen ? 'rgba(255, 190, 229, 0.9)' : 'rgba(123, 136, 168, 0.3)',
          color: settingsOpen ? '#ffe7f5' : 'rgba(224, 232, 255, 0.9)',
          boxShadow: settingsOpen ? PINK_GLOSS_SHADOW : NEUTRAL_PANEL_SHADOW,
          backdropFilter: GLASS_BACKDROP,
          WebkitBackdropFilter: GLASS_BACKDROP,
        }}
        title={`Settings (${hotkey})`}
      >
        ⚙
      </button>

      {modalOpen && (
        <>
          <button
            type="button"
            onClick={() => setIsListening((v) => !v)}
            onMouseEnter={handleInteractiveEnter}
            onMouseLeave={handleInteractiveLeave}
            className={`overlay-interactive absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-2xl border-2 cursor-pointer overflow-hidden
              transition-all duration-300 ease-out
              hover:scale-[1.02] active:scale-[0.98]
              ${isListening
                ? 'flex flex-col items-center justify-center w-[200px] min-h-[72px] py-2 px-5 gap-1'
                : 'flex flex-row items-center justify-center min-w-[160px] min-h-[48px] py-2.5 px-4 gap-3'
              }`}
            style={{
              background: isListening ? PINK_GLOSS_FILL : PINK_GLOSS_FILL_DARK,
              borderColor: isListening ? 'rgba(255, 194, 231, 0.88)' : BORDER_PINK,
              boxShadow: isListening ? PINK_GLOSS_SHADOW : '0 0 0 1px rgba(255, 122, 193, 0.28), inset 0 1px rgba(255, 198, 229, 0.24), 0 10px 24px rgba(68, 18, 48, 0.42)',
              backdropFilter: GLASS_BACKDROP,
              WebkitBackdropFilter: GLASS_BACKDROP,
            }}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90 shrink-0">
                  Transcribe
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <WaveformIcon className="w-5 h-5 text-white animate-pulse" />
                  <span className="text-sm font-medium text-white whitespace-nowrap">Listening…</span>
                </div>
              </>
            ) : (
              <>
                <WaveformIcon className="w-5 h-5 text-white flex-shrink-0" />
                <span className="text-sm font-medium text-white whitespace-nowrap">Start listening</span>
              </>
            )}
          </button>

          <div className="absolute left-4 top-24 bottom-4 flex items-stretch gap-6 z-10">
            <div
              onMouseEnter={handleInteractiveEnter}
              onMouseLeave={handleInteractiveLeave}
              className="overlay-interactive shrink-0 flex flex-col rounded-2xl border-2 overflow-hidden transition-[width] duration-200"
              style={{
                width: sidebarExpanded ? 220 : 56,
                backgroundColor: BG_PANEL,
                backgroundImage: NEUTRAL_PANEL_FILL,
                borderColor: BORDER_PINK,
                boxShadow: NEUTRAL_PANEL_SHADOW,
                backdropFilter: GLASS_BACKDROP,
                WebkitBackdropFilter: GLASS_BACKDROP,
              }}
            >
              <div
                className="flex items-center justify-between gap-2 px-2 py-2 border-b shrink-0"
                style={{
                  background: NEUTRAL_PANEL_HEADER,
                  borderColor: 'rgba(124, 136, 168, 0.22)',
                  color: 'rgba(228, 236, 255, 0.96)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSidebarExpanded((v) => !v)}
                  className="flex items-center justify-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                  style={{ color: 'rgba(228, 236, 255, 0.9)' }}
                >
                  <span className="text-sm font-medium">{sidebarExpanded ? '◀ History' : '▶'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOverlayClose}
                  className="w-7 h-7 p-0 flex items-center justify-center rounded cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                  style={{ color: 'rgba(228, 236, 255, 0.9)' }}
                  title="Close overlay"
                >
                  ×
                </button>
              </div>

              {sidebarExpanded && (
                <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                  {historyWithPreview.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => setSelectedChatId((current) => (current === chat.id ? null : chat.id))}
                      className={`w-full text-left px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                        selectedChatId === chat.id
                          ? 'border-pink-500/50'
                          : 'border-transparent hover:border-pink-500/20'
                      }`}
                      style={{
                        background:
                          selectedChatId === chat.id
                            ? 'radial-gradient(170% 130% at 45% -20%, rgba(255, 170, 223, 0.32) 0%, rgba(204, 52, 131, 0.8) 58%, rgba(91, 24, 63, 0.95) 100%)'
                            : 'rgba(18, 22, 33, 0.82)',
                        color: selectedChatId === chat.id ? '#ffe7f5' : 'rgba(226, 233, 255, 0.82)',
                        boxShadow:
                          selectedChatId === chat.id
                            ? '0 0 0 1px rgba(255, 164, 218, 0.75), inset 0 1px rgba(255, 216, 237, 0.66), inset 0 -1px rgba(84, 16, 56, 0.85), 0 8px 18px rgba(108, 24, 74, 0.48)'
                            : '0 0 0 1px rgba(121, 133, 165, 0.2), inset 0 1px rgba(164, 177, 208, 0.14)',
                      }}
                    >
                      <div className="text-sm font-medium truncate">{chat.title}</div>
                      <div className="text-xs opacity-70 truncate">{chat.preview}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedChatId && (
              <div
                onMouseEnter={handleInteractiveEnter}
                onMouseLeave={handleInteractiveLeave}
                className="overlay-interactive ml-1 w-[28rem] shrink-0 flex flex-col rounded-2xl border-2 overflow-hidden"
                style={{
                  backgroundColor: BG_PANEL,
                  backgroundImage: NEUTRAL_PANEL_FILL,
                  borderColor: BORDER_PINK,
                  boxShadow: NEUTRAL_PANEL_SHADOW,
                  backdropFilter: GLASS_BACKDROP,
                  WebkitBackdropFilter: GLASS_BACKDROP,
                }}
              >
                <div
                  className="flex items-center justify-end gap-2 px-4 py-3 shrink-0 border-b"
                  style={{
                    background: NEUTRAL_PANEL_HEADER,
                    borderColor: 'rgba(124, 136, 168, 0.22)',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleChatClose}
                    className="w-8 h-8 p-0 text-xl leading-none rounded-lg cursor-pointer transition-colors border border-transparent hover:border-pink-500/50 shrink-0"
                    style={{ color: 'rgba(228, 236, 255, 0.9)' }}
                    title="Close chat"
                  >
                    ×
                  </button>
                </div>

                <div
                  className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(18, 23, 34, 0.84) 0%, rgba(8, 11, 18, 0.94) 100%)',
                  }}
                >
                  {messages.map((message) => {
                    if (message.type === 'progress') {
                      return (
                        <div key={message.id} className="flex justify-start">
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
                            {message.text}
                          </div>
                        </div>
                      )
                    }

                    if (message.type === 'tool') {
                      const style = statusStyles(message.status)
                      return (
                        <div key={message.id} className="flex justify-start">
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
                              onClick={() => toggleToolCard(selectedChatId, message.id)}
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

                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
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
                          <span className={`whitespace-pre-wrap ${message.role === 'user' ? 'text-base lg:text-lg' : 'text-sm'}`}>
                            {message.text}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <form
                  onSubmit={handleSend}
                  className="p-4 border-t shrink-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(100, 113, 145, 0.16), rgba(10, 13, 21, 0.88) 76%)',
                    borderColor: 'rgba(121, 134, 167, 0.26)',
                  }}
                >
                  <div
                    className="flex gap-2 rounded-xl border overflow-hidden"
                    style={{
                      borderColor: 'rgba(122, 136, 170, 0.32)',
                      background: 'rgba(11, 14, 23, 0.82)',
                      boxShadow: 'inset 0 1px rgba(155, 169, 202, 0.2)',
                    }}
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={selectedChatIsRunning ? 'Researching...' : 'Type a message...'}
                      disabled={selectedChatIsRunning}
                      className="flex-1 min-w-0 px-4 py-3 text-sm text-white placeholder-zinc-500 bg-transparent border-0 outline-none disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={selectedChatIsRunning || !input.trim()}
                      className="px-4 py-3 text-sm font-medium text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background: PINK_GLOSS_FILL,
                        borderLeft: '1px solid rgba(255, 165, 218, 0.65)',
                        boxShadow: 'inset 0 1px rgba(255, 208, 234, 0.66)',
                      }}
                    >
                      {selectedChatIsRunning ? 'Running' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
      {settingsOpen && (
        <SettingsPanel
          currentHotkey={hotkey}
          onHotkeyChange={setHotkey}
          settingsHotkeyFailed={settingsHotkeyFailed}
          mainPanelHotkey={mainPanelHotkey}
          onMainPanelHotkeyChange={setMainPanelHotkey}
          mainPanelHotkeyFailed={mainPanelHotkeyFailed}
          onClose={() => { setSettingsOpen(false); resetOverlayInteractivity() }}
          onInteractiveEnter={handleInteractiveEnter}
          onInteractiveLeave={handleInteractiveLeave}
        />
      )}
    </div>
  )
}
