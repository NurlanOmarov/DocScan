import { useEffect, useRef, useState, useCallback } from 'react'

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  error: string | null
  isReady: boolean
  switchFlash: (on: boolean) => Promise<void>
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let mediaStream: MediaStream | null = null

    async function startCamera() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        setStream(mediaStream)
        setError(null)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled && videoRef.current) {
              videoRef.current.play().then(() => {
                if (!cancelled) setIsReady(true)
              }).catch(() => {
                if (!cancelled) setIsReady(true)
              })
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Camera error:', err)
          if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError') {
              setError('Доступ к камере запрещён. Разрешите доступ в настройках браузера.')
            } else if (err.name === 'NotFoundError') {
              setError('Камера не найдена на устройстве.')
            } else if (err.name === 'NotSupportedError') {
              setError('Камера не поддерживается в этом браузере.')
            } else {
              setError('Камера недоступна. Загрузите фото из галереи.')
            }
          } else {
            setError('Камера недоступна. Загрузите фото из галереи.')
          }
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop())
      }
      setIsReady(false)
      setStream(null)
    }
  }, [])

  const switchFlash = useCallback(
    async (on: boolean) => {
      if (!stream) return
      const tracks = stream.getVideoTracks()
      if (tracks.length === 0) return
      try {
        await tracks[0].applyConstraints({
          advanced: [{ torch: on } as MediaTrackConstraintSet],
        })
      } catch {
        console.warn('Flash/torch not supported on this device')
      }
    },
    [stream]
  )

  return { videoRef, stream, error, isReady, switchFlash }
}
