import { useEffect, useRef, useState, useCallback } from 'react'
import { detectDocument, extractDocument, isInitialized, type ScanResult } from '../lib/scanic'
import { useScannerStore, type Corners } from '../store/scannerStore'

export type Confidence = 'none' | 'low' | 'medium' | 'high'

interface UseScannerResult {
  corners: Corners | null
  confidence: Confidence
  capture: () => void
  isDetecting: boolean
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const DETECTION_INTERVAL_MS = 100 // 10 FPS
const STABLE_FRAMES_REQUIRED = 10 // 1 second at 10 FPS

function computeContourArea(corners: Corners): number {
  // Shoelace formula for quadrilateral area
  const pts = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ]
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}

function getConfidence(result: ScanResult): Confidence {
  if (!result.success || !result.corners) return 'none'

  const corners = result.corners as Corners
  const area = computeContourArea(corners)
  const totalArea = CANVAS_WIDTH * CANVAS_HEIGHT
  const ratio = area / totalArea

  if (ratio < 0.05) return 'none'
  if (ratio < 0.15) return 'low'
  if (ratio < 0.35) return 'medium'
  return 'high'
}

export function useScanner(
  videoRef: React.RefObject<HTMLVideoElement>
): UseScannerResult {
  const [corners, setCorners] = useState<Corners | null>(null)
  const [confidence, setConfidence] = useState<Confidence>('none')
  const [isDetecting, setIsDetecting] = useState(false)

  const rafRef = useRef<number>(0)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastDetectionRef = useRef<number>(0)
  const stableFramesRef = useRef<number>(0)
  const capturedRef = useRef<boolean>(false)

  const {
    state,
    autoMode,
    setState,
    setCapturedFrame,
    setCorners: storeSetCorners,
    setProcessedBlob,
    showToast,
  } = useScannerStore()

  // Initialize offscreen canvas
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    offscreenCanvasRef.current = canvas
  }, [])

  const processFrame = useCallback(async () => {
    const video = videoRef.current
    const canvas = offscreenCanvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    if (!isInitialized()) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = Date.now()
    if (now - lastDetectionRef.current < DETECTION_INTERVAL_MS) return
    lastDetectionRef.current = now

    try {
      ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      const result = await detectDocument(canvas)

      const conf = getConfidence(result)
      setConfidence(conf)

      if (result.success && result.corners) {
        const scaledCorners: Corners = {
          topLeft: {
            x: result.corners.topLeft.x / CANVAS_WIDTH,
            y: result.corners.topLeft.y / CANVAS_HEIGHT,
          },
          topRight: {
            x: result.corners.topRight.x / CANVAS_WIDTH,
            y: result.corners.topRight.y / CANVAS_HEIGHT,
          },
          bottomRight: {
            x: result.corners.bottomRight.x / CANVAS_WIDTH,
            y: result.corners.bottomRight.y / CANVAS_HEIGHT,
          },
          bottomLeft: {
            x: result.corners.bottomLeft.x / CANVAS_WIDTH,
            y: result.corners.bottomLeft.y / CANVAS_HEIGHT,
          },
        }
        setCorners(scaledCorners)
      } else {
        setCorners(null)
      }

      // Auto-capture logic
      if (autoMode && conf === 'high') {
        stableFramesRef.current += 1
        if (stableFramesRef.current >= STABLE_FRAMES_REQUIRED && !capturedRef.current) {
          capturedRef.current = true
          doCapture()
        }
      } else {
        stableFramesRef.current = 0
        capturedRef.current = false
      }
    } catch {
      // Detection error is non-fatal
    }
  }, [videoRef, autoMode])

  const doCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = offscreenCanvasRef.current
    if (!video || !canvas) return

    // Capture full resolution frame
    const captureCanvas = document.createElement('canvas')
    captureCanvas.width = video.videoWidth || CANVAS_WIDTH
    captureCanvas.height = video.videoHeight || CANVAS_HEIGHT
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
    const imageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height)

    setCapturedFrame(imageData)
    setState('captured')

    // Process extraction
    extractDocument(captureCanvas)
      .then((result) => {
        if (result.success && result.output instanceof HTMLCanvasElement) {
          result.output.toBlob(
            (blob) => {
              if (blob) {
                // Compress if > 2MB
                if (blob.size > 2 * 1024 * 1024) {
                  compressBlob(result.output as HTMLCanvasElement, 0.6).then((compressed) => {
                    setProcessedBlob(compressed)
                    setState('preview')
                  })
                } else {
                  setProcessedBlob(blob)
                  setState('preview')
                }
              }
            },
            'image/jpeg',
            0.85
          )
        } else {
          // Fallback: use captured frame as-is
          captureCanvas.toBlob(
            (blob) => {
              if (blob) {
                setProcessedBlob(blob)
              }
              setState('preview')
            },
            'image/jpeg',
            0.85
          )
        }
      })
      .catch(() => {
        // Extraction failed, use raw frame
        captureCanvas.toBlob(
          (blob) => {
            if (blob) {
              setProcessedBlob(blob)
            }
            setState('preview')
          },
          'image/jpeg',
          0.85
        )
        showToast('Детекция недоступна. Вы можете захватить вручную', 'warning')
      })
  }, [videoRef, setCapturedFrame, setState, setProcessedBlob, showToast])

  async function compressBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/jpeg',
        quality
      )
    })
  }

  // Animation frame loop
  useEffect(() => {
    if (state !== 'scanning') {
      setIsDetecting(false)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      return
    }

    setIsDetecting(true)
    capturedRef.current = false
    stableFramesRef.current = 0

    function loop() {
      processFrame()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      setIsDetecting(false)
    }
  }, [state, processFrame])

  // Sync corners to store
  useEffect(() => {
    storeSetCorners(corners)
  }, [corners, storeSetCorners])

  const capture = useCallback(() => {
    if (capturedRef.current) return
    capturedRef.current = true
    doCapture()
  }, [doCapture])

  return { corners, confidence, capture, isDetecting }
}
