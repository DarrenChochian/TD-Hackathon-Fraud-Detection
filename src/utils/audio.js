import { AUDIO_MIME_CANDIDATES } from './constants'

export function getRecorderOptionCandidates() {
  if (typeof MediaRecorder === 'undefined') return []

  const options = [undefined]
  if (typeof MediaRecorder.isTypeSupported === 'function') {
    for (const candidate of AUDIO_MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        options.push({ mimeType: candidate })
      }
    }
  }

  return options
}

export function createAndStartRecorderWithFallback({ source, stream, onChunk, timesliceMs }) {
  const optionsList = getRecorderOptionCandidates()
  const failures = []

  for (const options of optionsList) {
    let recorder = null
    try {
      recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream)
      recorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) return
        const chunk = await event.data.arrayBuffer()
        onChunk(chunk)
      }
      recorder.onerror = (event) => {
        console.error(`[recorder:${source}] media recorder error`, event)
      }

      recorder.start(timesliceMs)
      return { recorder, usedMimeType: options?.mimeType || 'default' }
    } catch (error) {
      if (recorder) {
        try {
          if (recorder.state !== 'inactive') recorder.stop()
        } catch {
          // Ignore recorder cleanup errors.
        }
      }
      failures.push({
        mimeType: options?.mimeType || 'default',
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }
  }

  const details = failures.map((item) => `${item.mimeType}: ${item.message}`).join(' | ')
  throw new Error(`MediaRecorder start failed for ${source} (${details || 'no supported option'})`)
}

export function createAudioLevelMonitor({ source, stream, onLevel }) {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) {
      return { cleanup: () => {} }
    }

    const audioContext = new AudioContextCtor()
    const sourceNode = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    const data = new Uint8Array(analyser.fftSize)

    sourceNode.connect(analyser)

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128
        sum += normalized * normalized
      }

      const rms = Math.sqrt(sum / data.length)
      onLevel(Math.round(rms * 1000) / 10)
    }, 200)

    return {
      cleanup: () => {
        clearInterval(interval)
        try {
          sourceNode.disconnect()
        } catch {
          // Ignore disconnection errors.
        }
        try {
          analyser.disconnect()
        } catch {
          // Ignore disconnection errors.
        }
        try {
          audioContext.close()
        } catch {
          // Ignore context close errors.
        }
      },
    }
  } catch (error) {
    console.warn(`[audio-monitor:${source}] failed to initialize`, error)
    return { cleanup: () => {} }
  }
}

export function stopStream(stream) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // Ignore track stop errors.
    }
  }
}

export function createNormalizedAudioStream(track) {
  const rawStream = new MediaStream([track])

  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) {
      return {
        stream: rawStream,
        cleanup: () => {},
      }
    }

    const audioContext = new AudioContextCtor()
    const sourceNode = audioContext.createMediaStreamSource(rawStream)
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 1
    const destination = audioContext.createMediaStreamDestination()
    sourceNode.connect(gainNode)
    gainNode.connect(destination)

    return {
      stream: destination.stream,
      cleanup: () => {
        try {
          sourceNode.disconnect()
        } catch {
          // Ignore disconnection errors.
        }
        try {
          gainNode.disconnect()
        } catch {
          // Ignore disconnection errors.
        }
        try {
          audioContext.close()
        } catch {
          // Ignore context close errors.
        }
      },
    }
  } catch (error) {
    console.warn('[audio-normalize] fallback to raw track stream', error)
    return {
      stream: rawStream,
      cleanup: () => {},
    }
  }
}
