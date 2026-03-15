import { useRef, useState } from 'react'
import { createAndStartRecorderWithFallback, createAudioLevelMonitor, stopStream, createNormalizedAudioStream } from '../utils/audio'
import { AUDIO_CHUNK_MS } from '../utils/constants'

export function useMediaCapture() {
  const [sourceAudioLevels, setSourceAudioLevels] = useState({ caller: 0, user: 0 })
  const mediaCaptureRef = useRef({
    micStream: null,
    desktopStream: null,
    callerRecorder: null,
    userRecorder: null,
    cleanupFns: [],
  })

  const cleanupMediaCapture = () => {
    const media = mediaCaptureRef.current

    for (const recorder of [media.callerRecorder, media.userRecorder]) {
      if (!recorder) continue
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // Ignore recorder stop errors.
      }
    }

    stopStream(media.micStream)
    stopStream(media.desktopStream)

    for (const cleanup of media.cleanupFns || []) {
      try {
        cleanup()
      } catch {
        // Ignore cleanup callback errors.
      }
    }

    mediaCaptureRef.current = {
      micStream: null,
      desktopStream: null,
      callerRecorder: null,
      userRecorder: null,
      cleanupFns: [],
    }

    setSourceAudioLevels({ caller: 0, user: 0 })
  }

  const startMediaCapture = async ({ onDesktopEnded }) => {
    let micStream = null
    let desktopStream = null

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      throw new Error('Microphone permission denied or unavailable.')
    }

    try {
      desktopStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: true,
      })
    } catch {
      stopStream(micStream)
      throw new Error('Desktop capture permission denied or unavailable.')
    }

    if (typeof MediaRecorder === 'undefined') {
      stopStream(micStream)
      stopStream(desktopStream)
      throw new Error('MediaRecorder is unavailable in this runtime.')
    }

    const callerAudioTrack = desktopStream.getAudioTracks()[0] || null
    const userAudioTrack = micStream.getAudioTracks()[0] || null

    if (callerAudioTrack) {
      console.log('[caller-audio-track]', {
        id: callerAudioTrack.id,
        kind: callerAudioTrack.kind,
        label: callerAudioTrack.label,
        enabled: callerAudioTrack.enabled,
        muted: callerAudioTrack.muted,
        readyState: callerAudioTrack.readyState,
      })
      try {
        console.log('[caller-audio-track-settings]', callerAudioTrack.getSettings?.())
      } catch {
        // Ignore settings read errors.
      }
      callerAudioTrack.onmute = () => console.warn('[caller-audio-track] muted')
      callerAudioTrack.onunmute = () => console.log('[caller-audio-track] unmuted')
      callerAudioTrack.onended = () => console.warn('[caller-audio-track] ended')
    }

    const cleanupFns = []

    const callerNormalized = callerAudioTrack ? createNormalizedAudioStream(callerAudioTrack) : null
    const userNormalized = userAudioTrack ? createNormalizedAudioStream(userAudioTrack) : null

    const callerStream = callerNormalized?.stream || null
    const userStream = userNormalized?.stream || null

    if (callerNormalized?.cleanup) cleanupFns.push(callerNormalized.cleanup)
    if (userNormalized?.cleanup) cleanupFns.push(userNormalized.cleanup)

    if (callerStream) {
      const monitor = createAudioLevelMonitor({
        source: 'caller',
        stream: callerStream,
        onLevel: (level) => setSourceAudioLevels((prev) => ({ ...prev, caller: level })),
      })
      cleanupFns.push(monitor.cleanup)
    }

    if (userStream) {
      const monitor = createAudioLevelMonitor({
        source: 'user',
        stream: userStream,
        onLevel: (level) => setSourceAudioLevels((prev) => ({ ...prev, user: level })),
      })
      cleanupFns.push(monitor.cleanup)
    }

    let callerRecorder = null
    let userRecorder = null
    const recorderFailures = []

    if (callerStream) {
      try {
        const { recorder, usedMimeType } = createAndStartRecorderWithFallback({
          source: 'caller',
          stream: callerStream,
          onChunk: (chunk) => window.electronAPI?.sendTranscriptionAudioChunk?.('caller', chunk),
          timesliceMs: AUDIO_CHUNK_MS,
        })
        callerRecorder = recorder
        console.log('[recorder:caller] initialized with', usedMimeType)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'caller recorder init failed'
        console.error('[recorder:caller] failed', error)
        recorderFailures.push(message)
      }
    }

    if (userStream) {
      try {
        const { recorder, usedMimeType } = createAndStartRecorderWithFallback({
          source: 'user',
          stream: userStream,
          onChunk: (chunk) => window.electronAPI?.sendTranscriptionAudioChunk?.('user', chunk),
          timesliceMs: AUDIO_CHUNK_MS,
        })
        userRecorder = recorder
        console.log('[recorder:user] initialized with', usedMimeType)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'user recorder init failed'
        console.error('[recorder:user] failed', error)
        recorderFailures.push(message)
      }
    }

    const activeSources = []
    if (callerRecorder) activeSources.push('caller')
    if (userRecorder) activeSources.push('user')

    if (onDesktopEnded) {
      for (const track of desktopStream.getVideoTracks()) {
        track.onended = onDesktopEnded
      }
    }

    mediaCaptureRef.current = {
      micStream,
      desktopStream,
      callerRecorder,
      userRecorder,
      cleanupFns,
    }

    return {
      activeSources,
      callerStream,
      userStream,
      recorderFailures,
    }
  }

  return {
    sourceAudioLevels,
    startMediaCapture,
    cleanupMediaCapture,
    mediaCaptureRef,
  }
}
