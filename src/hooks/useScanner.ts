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

function lerpPoint(p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  }
}

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

/**
 * Checks if a quadrilateral is convex and has reasonable angles (60-120 degrees)
 */
function validateGeometry(corners: Corners): { isValid: boolean; score: number } {
  const pts = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ]

  // 1. Check Convexity using cross products
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % 4]
    const p3 = pts[(i + 2) % 4]
    const cp = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)
    if (i === 0) sign = Math.sign(cp)
    else if (Math.sign(cp) !== sign || cp === 0) return { isValid: false, score: 0 }
  }

  // 2. Check Angles and Aspect Ratio
  // We want angles close to 90 degrees.
  let angleScore = 0
  for (let i = 0; i < 4; i++) {
    const p1 = pts[(i + 3) % 4]
    const p2 = pts[i]
    const p3 = pts[(i + 1) % 4]

    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }

    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

    const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI)
    if (angle < 45 || angle > 135) return { isValid: false, score: 0 }
    angleScore += 1 - Math.abs(angle - 90) / 45
  }

  return { isValid: true, score: angleScore / 4 }
}

function getConfidence(result: ScanResult): Confidence {
  if (!result.success || !result.corners) return 'none'

  const corners = result.corners as Corners
  const { isValid, score } = validateGeometry(corners)
  if (!isValid) return 'none'

  const area = computeContourArea(corners)
  const totalArea = CANVAS_WIDTH * CANVAS_HEIGHT
  const ratio = area / totalArea

  // Document should occupy significant space
  if (ratio < 0.1) return 'low'
  if (ratio < 0.25 || score < 0.7) return 'medium'
  if (ratio > 0.85) return 'medium' // Too close, might be cut off

  return 'high'
}

export function useScanner(
  videoRef: React.RefObject<HTMLVideoElement>
): UseScannerResult {
  const [confidence, setConfidence] = useState<Confidence>('none')
  const [isDetecting, setIsDetecting] = useState(false)

  const rafRef = useRef<number>(0)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastDetectionRef = useRef<number>(0)
  const stableFramesRef = useRef<number>(0)
  const capturedRef = useRef<boolean>(false)

  // Smoothing and stabilization refs
  const lastValidCornersRef = useRef<Corners | null>(null)
  const smoothingFactor = 0.4 // 0.4 = 40% new frame, 60% previous (lower = smoother)
  const MOVEMENT_THRESHOLD = 0.015 // 1.5% screen movement allowed for stability

  const {
    state,
    corners,
    autoMode,
    setState,
    setCapturedFrame,
    setCorners,
    setProcessedBlob,
    showToast,
    isDraggingCorner,
  } = useScannerStore()

  // Initialize offscreen canvas
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    offscreenCanvasRef.current = canvas
  }, [])

  // Provide default corners for manual mode if none exist
  useEffect(() => {
    if (!autoMode && !corners && state === 'scanning') {
      setCorners({
        topLeft: { x: 0.25, y: 0.2 },
        topRight: { x: 0.75, y: 0.2 },
        bottomRight: { x: 0.75, y: 0.8 },
        bottomLeft: { x: 0.25, y: 0.8 },
      })
    }
  }, [autoMode, corners, state, setCorners])

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
    setState('preview')

    // If manual mode: don't extract yet, just use current corners or set defaults if none exist
    if (!autoMode) {
      if (!corners) {
        setCorners({
          topLeft: { x: 0.25, y: 0.2 },
          topRight: { x: 0.75, y: 0.2 },
          bottomRight: { x: 0.75, y: 0.8 },
          bottomLeft: { x: 0.25, y: 0.8 },
        })
      }
      setProcessedBlob(null)
      return
    }

    // Process extraction (Auto-mode only)
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
                  })
                } else {
                  setProcessedBlob(blob)
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
              if (blob) setProcessedBlob(blob)
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
            if (blob) setProcessedBlob(blob)
          },
          'image/jpeg',
          0.85
        )
        showToast('Детекция недоступна. Вы можете настроить границы вручную', 'warning')
      })
  }, [videoRef, autoMode, setCapturedFrame, setState, setCorners, setProcessedBlob, showToast])

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

    // If manual mode is on, we skip automatic document detection entirely
    if (!autoMode) {
      setConfidence('none')
      return
    }

    try {
      ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      const result = await detectDocument(canvas)

      const conf = getConfidence(result)
      setConfidence(conf)

      if (result.success && result.corners) {
        const rawCorners: Corners = {
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

        if (isDraggingCorner) return
        
        let finalCorners = rawCorners

        // Temporal Smoothing (Lerp) with Adaptive Lock-on
        if (lastValidCornersRef.current && conf !== 'none') {
          // Check if document moved significantly
          const dx = Math.abs(rawCorners.topLeft.x - lastValidCornersRef.current.topLeft.x)
          const dy = Math.abs(rawCorners.topLeft.y - lastValidCornersRef.current.topLeft.y)

          if (dx < MOVEMENT_THRESHOLD && dy < MOVEMENT_THRESHOLD) {
            // Adaptive smoothing: if stable, use MUCH smaller factor (Lock-on)
            const adaptiveSmoothing = (conf === 'high' && stableFramesRef.current > 5) ? 0.08 : smoothingFactor
            
            finalCorners = {
              topLeft: lerpPoint(lastValidCornersRef.current.topLeft, rawCorners.topLeft, adaptiveSmoothing),
              topRight: lerpPoint(lastValidCornersRef.current.topRight, rawCorners.topRight, adaptiveSmoothing),
              bottomRight: lerpPoint(
                lastValidCornersRef.current.bottomRight,
                rawCorners.bottomRight,
                adaptiveSmoothing
              ),
              bottomLeft: lerpPoint(
                lastValidCornersRef.current.bottomLeft,
                rawCorners.bottomLeft,
                adaptiveSmoothing
              ),
            }
          }
        }

        lastValidCornersRef.current = finalCorners
        setCorners(finalCorners)
      } else {
        // If detection fails and we're NOT dragging, clear
        if (!isDraggingCorner) {
          lastValidCornersRef.current = null
          setCorners(null)
        }
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
  }, [videoRef, autoMode, doCapture, setCorners, isDraggingCorner, smoothingFactor])

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

  const capture = useCallback(() => {
    if (capturedRef.current) return
    capturedRef.current = true
    doCapture()
  }, [doCapture])

  return { corners, confidence, capture, isDetecting }
}
