import React, { useEffect, useRef, useCallback } from 'react'
import { useScannerStore, type Corners } from '../../store/scannerStore'
import { type Confidence } from '../../hooks/useScanner'

interface DocumentOverlayProps {
  corners: Corners | null
  confidence: Confidence
  width: number
  height: number
}

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  none: 'rgba(255, 255, 255, 0.3)',
  low: 'rgba(239, 68, 68, 0.7)',
  medium: 'rgba(234, 179, 8, 0.7)',
  high: 'rgba(16, 185, 129, 0.7)',
}

const CONFIDENCE_FILL: Record<Confidence, string> = {
  none: 'rgba(255, 255, 255, 0.03)',
  low: 'rgba(239, 68, 68, 0.1)',
  medium: 'rgba(234, 179, 8, 0.1)',
  high: 'rgba(16, 185, 129, 0.1)',
}

const TOUCH_THRESHOLD = 30

export const DocumentOverlay: React.FC<DocumentOverlayProps> = ({
  corners,
  confidence,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef<keyof Corners | null>(null)
  const { setCorners, setIsDraggingCorner } = useScannerStore()

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!corners) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const keys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
    let closestKey: keyof Corners | null = null
    let minDist = TOUCH_THRESHOLD

    keys.forEach(key => {
      const cx = corners[key].x * width
      const cy = corners[key].y * height
      const dist = Math.hypot(x - cx, y - cy)
      if (dist < minDist) {
        minDist = dist
        closestKey = key
      }
    })

    if (closestKey) {
      draggingRef.current = closestKey
      setIsDraggingCorner(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [corners, width, height, setIsDraggingCorner])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !corners) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.max(0, Math.min(width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(height, e.clientY - rect.top))

    const updated: Corners = {
      ...corners,
      [draggingRef.current]: { x: x / width, y: y / height }
    }
    setCorners(updated)
  }, [corners, width, height, setCorners])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
    setIsDraggingCorner(false)
  }, [setIsDraggingCorner])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    // Draw viewfinder guide in center when no document
    if (!corners || (confidence === 'none' && !draggingRef.current)) {
      const padX = width * 0.12
      const padY = height * 0.18
      const cornerLen = 30
      const radius = 4

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      const markers = [
        { x: padX, y: padY, dx: 1, dy: 1 },
        { x: width - padX, y: padY, dx: -1, dy: 1 },
        { x: width - padX, y: height - padY, dx: -1, dy: -1 },
        { x: padX, y: height - padY, dx: 1, dy: -1 },
      ]

      markers.forEach((m) => {
        ctx.beginPath()
        ctx.arc(m.x, m.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(m.x + m.dx * cornerLen, m.y)
        ctx.lineTo(m.x, m.y)
        ctx.lineTo(m.x, m.y + m.dy * cornerLen)
        ctx.stroke()
      })
      return
    }

    const color = draggingRef.current ? 'rgba(16, 185, 129, 0.9)' : CONFIDENCE_COLORS[confidence]
    const fill = draggingRef.current ? 'rgba(16, 185, 129, 0.15)' : CONFIDENCE_FILL[confidence]

    const pts = [
      { x: corners.topLeft.x * width, y: corners.topLeft.y * height },
      { x: corners.topRight.x * width, y: corners.topRight.y * height },
      { x: corners.bottomRight.x * width, y: corners.bottomRight.y * height },
      { x: corners.bottomLeft.x * width, y: corners.bottomLeft.y * height },
    ]

    // 1. Draw Glow/Shadow behind the polygon
    ctx.shadowBlur = draggingRef.current ? 20 : 15
    ctx.shadowColor = color
    
    // 2. Inner Fill
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    // Reset shadow for stroke
    ctx.shadowBlur = 0

    // 3. Main Outline
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    
    ctx.strokeStyle = color
    ctx.lineWidth = draggingRef.current ? 5 : 4
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 4. Subtle pulse for 'high' confidence
    if (confidence === 'high' && !draggingRef.current) {
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.2 + pulse * 0.3})`
      ctx.lineWidth = 10 + pulse * 4
      ctx.stroke()
    }

    // 5. Corner Handles (Dots)
    pts.forEach((p, i) => {
      const key = (['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as (keyof Corners)[])[i]
      const isDragging = draggingRef.current === key

      ctx.beginPath()
      ctx.arc(p.x, p.y, isDragging ? 10 : 8, 0, Math.PI * 2)
      ctx.fillStyle = isDragging ? '#fff' : color
      ctx.fill()
      
      if (!isDragging) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'white'
        ctx.fill()
      } else {
        // Draw crosshair or larger target for active drag
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
  }, [corners, confidence, width, height])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-[5] touch-none ${corners ? 'cursor-move' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}
    />
  )
}
