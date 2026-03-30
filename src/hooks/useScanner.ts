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

function getConfidence(result: ScanResult, canvasWidth: number, canvasHeight: number): Confidence {
  if (!result.success || !result.corners) return 'none'

  const corners = result.corners as Corners
  const { isValid, score } = validateGeometry(corners)
  if (!isValid) return 'none'

  // Normalize corners to [0..1] using the canvas dimensions (library returns absolute coords)
  const normCorners: Corners = {
    topLeft:     { x: corners.topLeft.x / canvasWidth,     y: corners.topLeft.y / canvasHeight },
    topRight:    { x: corners.topRight.x / canvasWidth,    y: corners.topRight.y / canvasHeight },
    bottomRight: { x: corners.bottomRight.x / canvasWidth, y: corners.bottomRight.y / canvasHeight },
    bottomLeft:  { x: corners.bottomLeft.x / canvasWidth,  y: corners.bottomLeft.y / canvasHeight },
  }

  const area = computeContourArea(normCorners)
  // area is now in normalized [0..1] space, total = 1.0

  // Document should occupy significant space in frame
  if (area < 0.08) return 'low'
  if (area < 0.20 || score < 0.65) return 'medium'
  if (area > 0.92) return 'medium' // Too close

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
  const confidenceBufferRef = useRef<Confidence[]>([])
  
  const smoothingFactor = 0.2 // 0.2 = 20% new frame, 80% previous (lower = smoother)
  const MOVEMENT_THRESHOLD = 0.02 // 2% screen movement allowed for stability

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

  // Initialize offscreen canvas based on video aspect ratio
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleResize = () => {
      if (!video.videoWidth || !video.videoHeight) return
      const canvas = offscreenCanvasRef.current || document.createElement('canvas')
      const ratio = video.videoWidth / video.videoHeight
      const targetWidth = CANVAS_WIDTH
      const targetHeight = Math.round(targetWidth / ratio)
      
      canvas.width = targetWidth
      canvas.height = targetHeight
      offscreenCanvasRef.current = canvas
    }

    if (video.readyState >= 1) {
      handleResize()
    }
    video.addEventListener('loadedmetadata', handleResize)
    return () => video.removeEventListener('loadedmetadata', handleResize)
  }, [videoRef])

  // Provide default corners for manual mode if none exist
  useEffect(() => {
    if (!autoMode && !corners && state === 'scanning') {
      setCorners({
        topLeft: { x: 0.12, y: 0.15 },
        topRight: { x: 0.88, y: 0.15 },
        bottomRight: { x: 0.88, y: 0.72 },
        bottomLeft: { x: 0.12, y: 0.72 },
      })
    }
  }, [autoMode, corners, state, setCorners])

  const doCapture = useCallback((currentCorners?: Corners | null) => {
    const video = videoRef.current
    const canvas = offscreenCanvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    // Capture full resolution frame
    const captureCanvas = document.createElement('canvas')
    captureCanvas.width = video.videoWidth
    captureCanvas.height = video.videoHeight
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
    const imageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height)

    // Sync corners: prefer passed ones, then store ones
    const activeCorners = currentCorners || corners

    setCapturedFrame(imageData)
    setState('preview')

    // If manual mode: don't extract yet, just use current corners or set defaults if none exist
    if (!autoMode) {
      if (!activeCorners) {
        setCorners({
          topLeft: { x: 0.12, y: 0.15 },
          topRight: { x: 0.88, y: 0.15 },
          bottomRight: { x: 0.88, y: 0.72 },
          bottomLeft: { x: 0.12, y: 0.72 },
        })
      }
      setProcessedBlob(null)
      return
    }

    // Process extraction (Auto-mode only)
    extractDocument(captureCanvas, activeCorners || undefined)
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
  }, [videoRef, autoMode, corners, setCapturedFrame, setState, setCorners, setProcessedBlob, showToast])

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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const result = await detectDocument(canvas)

      // Library returns corners in original video resolution (scaleFactor already applied internally)
      const videoEl = videoRef.current
      const origW = videoEl?.videoWidth || canvas.width
      const origH = videoEl?.videoHeight || canvas.height

      // 1. Raw confidence (pass original dims for correct area calc)
      const rawConf = getConfidence(result, origW, origH)
      
      // 2. Confidence Hysteresis (Majority Vote over 5 frames)
      confidenceBufferRef.current.push(rawConf)
      if (confidenceBufferRef.current.length > 5) {
        confidenceBufferRef.current.shift()
      }

      // Count occurrences of each confidence level in the buffer
      const counts: Record<Confidence, number> = { none: 0, low: 0, medium: 0, high: 0 }
      confidenceBufferRef.current.forEach(c => counts[c]++)
      
      // We only upgrade/downgrade level if it's the dominant level in the buffer
      // (Simple majority of 3+ frames out of 5)
      let stableConf = confidence
      for (const level of ['high', 'medium', 'low', 'none'] as Confidence[]) {
        if (counts[level] >= 3) {
          stableConf = level
          break
        }
      }

      if (stableConf !== confidence) {
        setConfidence(stableConf)
      }

      const conf = stableConf

      if (result.success && result.corners) {
        const rawCorners: Corners = {
          topLeft: {
            x: result.corners.topLeft.x / origW,
            y: result.corners.topLeft.y / origH,
          },
          topRight: {
            x: result.corners.topRight.x / origW,
            y: result.corners.topRight.y / origH,
          },
          bottomRight: {
            x: result.corners.bottomRight.x / origW,
            y: result.corners.bottomRight.y / origH,
          },
          bottomLeft: {
            x: result.corners.bottomLeft.x / origW,
            y: result.corners.bottomLeft.y / origH,
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
            const adaptiveSmoothing = (conf === 'high' && stableFramesRef.current > 5) ? 0.05 : smoothingFactor
            
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

        // Auto-capture logic
        if (autoMode && conf === 'high') {
          stableFramesRef.current += 1
          if (stableFramesRef.current >= STABLE_FRAMES_REQUIRED && !capturedRef.current) {
            capturedRef.current = true
            doCapture(finalCorners)
          }
        } else {
          stableFramesRef.current = 0
          capturedRef.current = false
        }
      } else {
        // If detection fails and we're NOT dragging, clear
        if (!isDraggingCorner) {
          lastValidCornersRef.current = null
          setCorners(null)
        }
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
    doCapture(corners)
  }, [doCapture, corners])

  return { corners, confidence, capture, isDetecting }
}
