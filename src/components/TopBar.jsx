import { useState, useRef, useEffect } from 'react'
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
  const [position, setPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const longPressTimerRef = useRef(null)
  const dragStartRef = useRef(null)
  const hasDraggedRef = useRef(false)
  const isPointerDownRef = useRef(false)
  const isHoveringRef = useRef(false)
  const containerRef = useRef(null)

  const handlePointerDown = (e) => {
    // Only accept left mouse button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return
    
    isPointerDownRef.current = true
    hasDraggedRef.current = false
    
    const rect = containerRef.current.getBoundingClientRect()
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      rectX: rect.left,
      rectY: rect.top,
    }

    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        setIsDragging(true)
        hasDraggedRef.current = true
        // Initialize position if not already set, so it stops being centered
        if (!position) {
          setPosition({ x: rect.left, y: rect.top })
        }
      }
    }, 150)
  }

  useEffect(() => {
    const handlePointerMove = (e) => {
      // If pointer moves significantly before the timer fires, cancel the long press
      if (isPointerDownRef.current && !isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.pointerX
        const dy = e.clientY - dragStartRef.current.pointerY
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          clearTimeout(longPressTimerRef.current)
        }
      }

      if (isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.pointerX
        const dy = e.clientY - dragStartRef.current.pointerY
        setPosition({
          x: dragStartRef.current.rectX + dx,
          y: dragStartRef.current.rectY + dy,
        })
      }
    }

    const handlePointerUp = (e) => {
      clearTimeout(longPressTimerRef.current)
      
      const wasPointerDown = isPointerDownRef.current
      isPointerDownRef.current = false
      
      if (isDragging) {
        setIsDragging(false)
        // Reset hasDragged after a short delay so click events on children can be blocked
        setTimeout(() => {
          hasDraggedRef.current = false
        }, 50)
      }

      // If pointer was down, we might have suppressed a leave event.
      // Re-evaluate if we are still hovering.
      if (wasPointerDown) {
        setTimeout(() => {
          if (!isHoveringRef.current) {
            onMouseLeave?.(e)
          }
        }, 0)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, onMouseLeave, position])

  const handleMouseEnterWrapper = (e) => {
    isHoveringRef.current = true
    if (isDragging || isPointerDownRef.current) return
    onMouseEnter?.(e)
  }

  const handleMouseLeaveWrapper = (e) => {
    isHoveringRef.current = false
    if (isDragging || isPointerDownRef.current) return
    onMouseLeave?.(e)
  }

  const handleClickCapture = (e) => {
    if (hasDraggedRef.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const baseClasses = "overlay-interactive absolute z-20 flex items-center gap-3"
  const placementClasses = position 
    ? "" // Removed when positioned explicitly
    : "top-4 left-1/2 -translate-x-1/2"

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnterWrapper}
      onMouseLeave={handleMouseLeaveWrapper}
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
      className={`${baseClasses} ${placementClasses}`}
      style={{
        ...(position ? { left: `${position.x}px`, top: `${position.y}px` } : {}),
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Adding a transparent absolute background to capture clicks across the whole flex gap area */}
      <div className="absolute inset-0 bg-transparent" />

      <div
        className="flex items-center gap-3 px-3 h-12 rounded-full border relative pointer-events-auto"
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
      <div className="relative pointer-events-auto">
        <ChatIcon
          onClick={onChatToggle}
          open={chatOpen}
        />
      </div>
    </div>
  )
}
