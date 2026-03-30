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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    // Draw viewfinder guide in center when no document
    if (!corners || confidence === 'none') {
      const padX = width * 0.1
      const padY = height * 0.15
      const guideW = width - padX * 2
      const guideH = height - padY * 2
      const cornerLen = 24
      const radius = 3

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'

      // Draw corner markers
      const corners2 = [
        { x: padX, y: padY },
        { x: padX + guideW, y: padY },
        { x: padX + guideW, y: padY + guideH },
        { x: padX, y: padY + guideH },
      ]

      const directions = [
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
      ]

      corners2.forEach((c, i) => {
        const d = directions[i]
        ctx.beginPath()
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(c.x + d.dx * cornerLen, c.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(c.x, c.y + d.dy * cornerLen)
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

    // Fill
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    // Stroke
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Corner circles
    pts.forEach((p) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'white'
      ctx.fill()
    })
  }, [corners, confidence, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
