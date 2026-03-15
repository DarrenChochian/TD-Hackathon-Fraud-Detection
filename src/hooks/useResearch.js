import { useState, useEffect, useRef } from 'react'
import { buildInitialChatMessages, createMessageId, toolEntryIdFromEvent, initialMessagesForChat } from '../utils/chat'
import { CHAT_DEFINITIONS, CHAT_IDS } from '../utils/constants'

export function useResearch() {
  const [chatMessages, setChatMessages] = useState(() => buildInitialChatMessages(CHAT_DEFINITIONS))
  const [runningByChat, setRunningByChat] = useState({})
  const runningByChatRef = useRef({})

  useEffect(() => {
    runningByChatRef.current = runningByChat
  }, [runningByChat])

  useEffect(() => {
    window.electronAPI
      ?.initializeResearchChats?.(CHAT_IDS)
      .catch((error) => console.error('Failed to initialize research chats:', error))
  }, [])

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

  const runResearchPrompt = async ({ chatId, text, resetThread = false, replaceChatMessages = false, attachmentFilePaths = [] }) => {
    const normalizedChatId = String(chatId || '').trim()
    const prompt = String(text || '').trim()
    if (!normalizedChatId || !prompt || runningByChatRef.current[normalizedChatId]) return false

    if (replaceChatMessages) {
      setChatMessages((prev) => ({
        ...prev,
        [normalizedChatId]: initialMessagesForChat(normalizedChatId),
      }))
    }

    appendMessage(normalizedChatId, {
      id: createMessageId('user'),
      type: 'text',
      role: 'user',
      text: prompt,
    })

    if (!window.electronAPI?.runResearch) {
      appendMessage(normalizedChatId, {
        id: createMessageId('error'),
        type: 'text',
        role: 'assistant',
        text: 'Research backend is unavailable.',
      })
      return false
    }

    setRunningByChat((prev) => ({
      ...prev,
      [normalizedChatId]: true,
    }))

    try {
      if (resetThread) {
        await window.electronAPI?.resetResearchThread?.(normalizedChatId)
      }

      await window.electronAPI.runResearch({
        chatId: normalizedChatId,
        prompt,
        attachmentFilePaths,
      })
      return true
    } catch {
      setRunningByChat((prev) => {
        const next = { ...prev }
        delete next[normalizedChatId]
        return next
      })
      return false
    }
  }

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onResearchEvent?.((payload) => {
      const chatId = String(payload?.chatId || '').trim()
      if (!chatId) return

      if (payload.type === 'tool_call_started' || payload.type === 'tool_call_finished') {
        const toolName = String(payload?.toolName || '').toLowerCase()
        if (toolName === 'message' || toolName === 'summary') return

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

  return {
    chatMessages,
    setChatMessages,
    runningByChat,
    runningByChatRef,
    appendMessage,
    toggleToolCard,
    runResearchPrompt,
  }
}
