import { useState, useEffect } from 'react'
import { stopStream } from '../utils/audio'

export function usePermissions() {
  const [permissionStatus, setPermissionStatus] = useState({
    microphone: 'unknown',
    screen: 'unknown',
    screenshot: 'unknown',
  })

  const refreshPermissionStatus = async () => {
    if (!window.electronAPI?.getMediaPermissionStatus) return
    try {
      const status = await window.electronAPI.getMediaPermissionStatus()
      setPermissionStatus((prev) => ({
        ...prev,
        ...status,
      }))
    } catch {
      // Ignore permission refresh errors.
    }
  }

  const requestPermission = async (kind) => {
    const normalizedKind = String(kind || '').toLowerCase()

    const result = await window.electronAPI?.requestMediaPermission?.(normalizedKind)

    if (normalizedKind === 'screen' || normalizedKind === 'screenshot') {
      if (result?.status !== 'granted') {
        try {
          const permissionStream = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: true })
          stopStream(permissionStream)
        } catch {
          // Ignore permission prompt cancellations.
        }
      }
    }

    await refreshPermissionStatus()
    return result
  }

  useEffect(() => {
    refreshPermissionStatus()
  }, [])

  return {
    permissionStatus,
    requestPermission,
    refreshPermissionStatus,
  }
}
