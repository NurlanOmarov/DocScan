import React, { useEffect, useRef } from 'react'
import { type Corners } from '../../store/scannerStore'
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

export const DocumentOverlay: React.FC<DocumentOverlayProps> = ({
  corners,
  confidence,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevConfidenceRef = useRef<Confidence>('none')

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
    if (!corners || confidence === 'none') {
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
        // Dot
        ctx.beginPath()
        ctx.arc(m.x, m.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fill()

        // Corner L-shape
        ctx.beginPath()
        ctx.moveTo(m.x + m.dx * cornerLen, m.y)
        ctx.lineTo(m.x, m.y)
        ctx.lineTo(m.x, m.y + m.dy * cornerLen)
        ctx.stroke()
      })
      return
    }

    const color = CONFIDENCE_COLORS[confidence]
    const fill = CONFIDENCE_FILL[confidence]

    const pts = [
      { x: corners.topLeft.x * width, y: corners.topLeft.y * height },
      { x: corners.topRight.x * width, y: corners.topRight.y * height },
      { x: corners.bottomRight.x * width, y: corners.bottomRight.y * height },
      { x: corners.bottomLeft.x * width, y: corners.bottomLeft.y * height },
    ]

    // 1. Draw Glow/Shadow behind the polygon
    ctx.shadowBlur = 15
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

    // 3. Main Outline with Gradient
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 4. Subtle pulse for 'high' confidence
    if (confidence === 'high') {
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.2 + pulse * 0.3})`
      ctx.lineWidth = 8 + pulse * 4
      ctx.stroke()
    }

    // 5. Corner Handles (Dots)
    pts.forEach((p) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'white'
      ctx.fill()
    })

    prevConfidenceRef.current = confidence
  }, [corners, confidence, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
    />
  )
}
