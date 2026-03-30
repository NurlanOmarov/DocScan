import React, { useEffect, useRef, useCallback } from 'react'
import { useScannerStore, type Corners } from '../../store/scannerStore'
import { type Confidence } from '../../hooks/useScanner'

interface DocumentOverlayProps {
  corners: Corners | null
  confidence: Confidence
  width: number
  height: number
  videoWidth: number
  videoHeight: number
}

// Helper to map coordinates between container (screen) and video (full frame)
// accounts for object-fit: cover
const getMapping = (width: number, height: number, vWidth: number, vHeight: number) => {
  if (!vWidth || !vHeight) return { scale: 1, offsetX: 0, offsetY: 0, visibleVideoWidth: width, visibleVideoHeight: height }
  
  const vRatio = vWidth / vHeight
  const cRatio = width / height
  
  let scale, offsetX = 0, offsetY = 0
  let visibleVideoWidth = width
  let visibleVideoHeight = height

  if (vRatio > cRatio) {
    // Video is wider than container, sides are cut off
    scale = height / vHeight
    visibleVideoWidth = vWidth * scale
    offsetX = (visibleVideoWidth - width) / 2
  } else {
    // Video is taller than container, top/bottom are cut off
    scale = width / vWidth
    visibleVideoHeight = vHeight * scale
    offsetY = (visibleVideoHeight - height) / 2
  }

  return { scale, offsetX, offsetY, visibleVideoWidth, visibleVideoHeight }
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

const TOUCH_THRESHOLD = 35
const EDGE_THRESHOLD = 30

type DragTarget =
  | { kind: 'corner'; key: keyof Corners }
  | { kind: 'edge'; side: 'left' | 'right' | 'top' | 'bottom' }
  | null

export const DocumentOverlay: React.FC<DocumentOverlayProps> = ({
  corners,
  confidence,
  width,
  height,
  videoWidth,
  videoHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef<DragTarget>(null)
  const { setCorners, setIsDraggingCorner, autoMode } = useScannerStore()

  const mapping = getMapping(width, height, videoWidth, videoHeight)

  // Convert normalized video coords → container pixels
  const toScreen = useCallback((nx: number, ny: number) => ({
    x: nx * mapping.visibleVideoWidth - mapping.offsetX,
    y: ny * mapping.visibleVideoHeight - mapping.offsetY,
  }), [mapping])

  // Convert container pixels → normalized video coords
  const toNorm = useCallback((x: number, y: number) => ({
    nx: Math.max(0, Math.min(1, (x + mapping.offsetX) / mapping.visibleVideoWidth)),
    ny: Math.max(0, Math.min(1, (y + mapping.offsetY) / mapping.visibleVideoHeight)),
  }), [mapping])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!corners) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 1. Check corners first
    const cornerKeys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
    let closestCorner: keyof Corners | null = null
    let minDist = TOUCH_THRESHOLD

    cornerKeys.forEach(key => {
      const sc = toScreen(corners[key].x, corners[key].y)
      const dist = Math.hypot(x - sc.x, y - sc.y)
      if (dist < minDist) {
        minDist = dist
        closestCorner = key
      }
    })

    if (closestCorner) {
      draggingRef.current = { kind: 'corner', key: closestCorner }
      setIsDraggingCorner(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // 2. Check edge midpoints
    const tl = toScreen(corners.topLeft.x, corners.topLeft.y)
    const tr = toScreen(corners.topRight.x, corners.topRight.y)
    const br = toScreen(corners.bottomRight.x, corners.bottomRight.y)
    const bl = toScreen(corners.bottomLeft.x, corners.bottomLeft.y)

    const edgeMids: { side: 'left' | 'right' | 'top' | 'bottom'; mx: number; my: number }[] = [
      { side: 'top',    mx: (tl.x + tr.x) / 2, my: (tl.y + tr.y) / 2 },
      { side: 'right',  mx: (tr.x + br.x) / 2, my: (tr.y + br.y) / 2 },
      { side: 'bottom', mx: (br.x + bl.x) / 2, my: (br.y + bl.y) / 2 },
      { side: 'left',   mx: (bl.x + tl.x) / 2, my: (bl.y + tl.y) / 2 },
    ]

    let closestEdge: 'left' | 'right' | 'top' | 'bottom' | null = null
    let minEdgeDist = EDGE_THRESHOLD

    edgeMids.forEach(({ side, mx, my }) => {
      const dist = Math.hypot(x - mx, y - my)
      if (dist < minEdgeDist) {
        minEdgeDist = dist
        closestEdge = side
      }
    })

    if (closestEdge) {
      draggingRef.current = { kind: 'edge', side: closestEdge }
      setIsDraggingCorner(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [corners, mapping, toScreen, setIsDraggingCorner])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !corners) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { nx, ny } = toNorm(x, y)

    const drag = draggingRef.current

    if (drag.kind === 'corner') {
      setCorners({ ...corners, [drag.key]: { x: nx, y: ny } })
    } else {
      // Edge dragging: move both corners of that side
      const updated = { ...corners }
      switch (drag.side) {
        case 'left':
          updated.topLeft = { x: nx, y: corners.topLeft.y }
          updated.bottomLeft = { x: nx, y: corners.bottomLeft.y }
          break
        case 'right':
          updated.topRight = { x: nx, y: corners.topRight.y }
          updated.bottomRight = { x: nx, y: corners.bottomRight.y }
          break
        case 'top':
          updated.topLeft = { x: corners.topLeft.x, y: ny }
          updated.topRight = { x: corners.topRight.x, y: ny }
          break
        case 'bottom':
          updated.bottomLeft = { x: corners.bottomLeft.x, y: ny }
          updated.bottomRight = { x: corners.bottomRight.x, y: ny }
          break
      }
      setCorners(updated)
    }
  }, [corners, toNorm, setCorners])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // Fallback
      }
    }
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

    // Draw viewfinder guide in center when no document and not interacting
    if (!corners || (confidence === 'none' && !draggingRef.current && autoMode)) {
      const padX = width * 0.25 // Match manual mode margins
      const padY = height * 0.2
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

    // 0. Debug Visualization (Raw and Final Contours from the store)
    const { settings, debugInfo } = useScannerStore.getState()
    if (settings.debugOverlay && debugInfo) {
      // Draw all raw contours in faint red
      if (debugInfo.rawContours) {
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)' // Red
        debugInfo.rawContours.forEach((c: any) => {
          if (!c.points || c.points.length < 3) return
          ctx.beginPath()
          const p0 = toScreen(c.points[0].x / 800, c.points[0].y / 600) // Library uses 800px width for processing
          ctx.moveTo(p0.x, p0.y)
          for (let i = 1; i < c.points.length; i++) {
            const p = toScreen(c.points[i].x / 800, c.points[i].y / 600)
            ctx.lineTo(p.x, p.y)
          }
          ctx.closePath()
          ctx.stroke()
        })
      }

      // Draw final filtered contours in faint green
      if (debugInfo.finalContours) {
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)' // Emerald
        debugInfo.finalContours.forEach((c: any) => {
          if (!c.points || c.points.length < 3) return
          ctx.beginPath()
          const p0 = toScreen(c.points[0].x / 800, c.points[0].y / 600)
          ctx.moveTo(p0.x, p0.y)
          for (let i = 1; i < c.points.length; i++) {
            const p = toScreen(c.points[i].x / 800, c.points[i].y / 600)
            ctx.lineTo(p.x, p.y)
          }
          ctx.closePath()
          ctx.stroke()
        })
      }
    }

    const color = draggingRef.current ? 'rgba(16, 185, 129, 0.9)' : CONFIDENCE_COLORS[confidence]
    const fill = draggingRef.current ? 'rgba(16, 185, 129, 0.15)' : CONFIDENCE_FILL[confidence]

    // Map normalized video corners to container pixels for drawing
    const pts = [
      { 
        x: corners.topLeft.x * mapping.visibleVideoWidth - mapping.offsetX, 
        y: corners.topLeft.y * mapping.visibleVideoHeight - mapping.offsetY 
      },
      { 
        x: corners.topRight.x * mapping.visibleVideoWidth - mapping.offsetX, 
        y: corners.topRight.y * mapping.visibleVideoHeight - mapping.offsetY 
      },
      { 
        x: corners.bottomRight.x * mapping.visibleVideoWidth - mapping.offsetX, 
        y: corners.bottomRight.y * mapping.visibleVideoHeight - mapping.offsetY 
      },
      { 
        x: corners.bottomLeft.x * mapping.visibleVideoWidth - mapping.offsetX, 
        y: corners.bottomLeft.y * mapping.visibleVideoHeight - mapping.offsetY 
      },
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
      const isDragging = draggingRef.current?.kind === 'corner' && draggingRef.current.key === key

      ctx.beginPath()
      ctx.arc(p.x, p.y, isDragging ? 12 : 9, 0, Math.PI * 2)
      ctx.fillStyle = isDragging ? '#fff' : color
      ctx.fill()

      if (!isDragging) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'white'
        ctx.fill()
      } else {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2)
        ctx.stroke()
      }
    })

    // 6. Edge midpoint handles (━)
    const edgeMids = [
      { side: 'top',    sx: pts[0].x, sy: pts[0].y, ex: pts[1].x, ey: pts[1].y },
      { side: 'right',  sx: pts[1].x, sy: pts[1].y, ex: pts[2].x, ey: pts[2].y },
      { side: 'bottom', sx: pts[2].x, sy: pts[2].y, ex: pts[3].x, ey: pts[3].y },
      { side: 'left',   sx: pts[3].x, sy: pts[3].y, ex: pts[0].x, ey: pts[0].y },
    ]

    edgeMids.forEach(({ side, sx, sy, ex, ey }) => {
      const mx = (sx + ex) / 2
      const my = (sy + ey) / 2
      const isEdgeDragging = draggingRef.current?.kind === 'edge' && draggingRef.current.side === side
      const isVertical = side === 'left' || side === 'right'

      const hw = isVertical ? 4 : 14  // half-width of handle bar
      const hh = isVertical ? 14 : 4  // half-height of handle bar

      ctx.beginPath()
      ctx.roundRect(mx - hw, my - hh, hw * 2, hh * 2, 3)
      ctx.fillStyle = isEdgeDragging ? '#fff' : 'rgba(255,255,255,0.75)'
      ctx.fill()

      if (isEdgeDragging) {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // 7. Draw Instruction Hint in Manual Mode
    if (!autoMode && !draggingRef.current && corners) {
      ctx.font = '500 15px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const hint = 'Тяните углы или стороны'
      const metrics = ctx.measureText(hint)
      const padding = 12
      const bgW = metrics.width + padding * 2
      const bgH = 32
      const bgX = width / 2 - bgW / 2
      const bgY = height / 2 - bgH / 2

      ctx.beginPath()
      ctx.roundRect(bgX, bgY, bgW, bgH, 16)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.stroke()

      ctx.fillStyle = 'white'
      ctx.fillText(hint, width / 2, height / 2)
    }
  }, [corners, confidence, width, height, autoMode, mapping])

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
