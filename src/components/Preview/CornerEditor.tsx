import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useScannerStore, type Corners, type Corner } from '../../store/scannerStore'
import { extractDocument } from '../../lib/scanic'

const HANDLE_RADIUS = 20
const HANDLE_INNER = 10

type CornerKey = keyof Corners

interface CornerEditorProps {
  onClose?: () => void
}

export const CornerEditor: React.FC<CornerEditorProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<CornerKey | null>(null)
  const [applying, setApplying] = useState(false)

  const {
    capturedFrame,
    corners,
    processedBlob,
    setCorners,
    setProcessedBlob,
    setIsDraggingCorner,
    setState,
    showToast,
  } = useScannerStore()

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !capturedFrame) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw image
    const imgCanvas = document.createElement('canvas')
    imgCanvas.width = capturedFrame.width
    imgCanvas.height = capturedFrame.height
    const imgCtx = imgCanvas.getContext('2d')!
    imgCtx.putImageData(capturedFrame, 0, 0)
    ctx.drawImage(imgCanvas, 0, 0, canvas.width, canvas.height)

    if (!corners) return

    const W = canvas.width
    const H = canvas.height

    const pts: Record<CornerKey, { x: number; y: number }> = {
      topLeft: { x: corners.topLeft.x * W, y: corners.topLeft.y * H },
      topRight: { x: corners.topRight.x * W, y: corners.topRight.y * H },
      bottomRight: { x: corners.bottomRight.x * W, y: corners.bottomRight.y * H },
      bottomLeft: { x: corners.bottomLeft.x * W, y: corners.bottomLeft.y * H },
    }

    // Draw polygon
    ctx.beginPath()
    ctx.moveTo(pts.topLeft.x, pts.topLeft.y)
    ctx.lineTo(pts.topRight.x, pts.topRight.y)
    ctx.lineTo(pts.bottomRight.x, pts.bottomRight.y)
    ctx.lineTo(pts.bottomLeft.x, pts.bottomLeft.y)
    ctx.closePath()
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)'
    ctx.fill()

    // Draw handles
    ;(Object.keys(pts) as CornerKey[]).forEach((key) => {
      const p = pts[key]
      const isActive = draggingRef.current === key

      // Outer ring
      ctx.beginPath()
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = isActive ? 'rgba(16,185,129,1)' : 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Inner dot
      ctx.beginPath()
      ctx.arc(p.x, p.y, HANDLE_INNER, 0, Math.PI * 2)
      ctx.fillStyle = isActive ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.9)'
      ctx.fill()
    })
  }, [capturedFrame, corners])

  // Set canvas size from container
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !capturedFrame) return

    const ratio = capturedFrame.width / capturedFrame.height
    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const containerRatio = containerW / containerH

    let w: number, h: number
    if (ratio > containerRatio) {
      w = containerW
      h = containerW / ratio
    } else {
      h = containerH
      w = containerH * ratio
    }

    canvas.width = Math.round(w)
    canvas.height = Math.round(h)
    draw()
  }, [capturedFrame, draw])

  // Initialize default corners if none exist in the editor
  useEffect(() => {
    if (!corners && capturedFrame) {
      setCorners({
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.9, y: 0.1 },
        bottomRight: { x: 0.9, y: 0.9 },
        bottomLeft: { x: 0.1, y: 0.9 },
      })
    }
  }, [corners, capturedFrame, setCorners])

  useEffect(() => {
    draw()
  }, [corners, draw])

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Corner | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    },
    []
  )

  const findHitCorner = useCallback(
    (px: number, py: number): CornerKey | null => {
      if (!corners) return null
      const canvas = canvasRef.current
      if (!canvas) return null
      const W = canvas.width
      const H = canvas.height

      const keys: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
      for (const key of keys) {
        const c = corners[key]
        const cx = c.x * W
        const cy = c.y * H
        const dist = Math.hypot(px - cx, py - cy)
        if (dist <= HANDLE_RADIUS + 10) return key
      }
      return null
    },
    [corners]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pt = getCanvasPoint(e.clientX, e.clientY)
      if (!pt) return
      const hit = findHitCorner(pt.x, pt.y)
      if (hit) {
        draggingRef.current = hit
        setIsDraggingCorner(true)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
    },
    [getCanvasPoint, findHitCorner, setIsDraggingCorner]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !corners) return
      const canvas = canvasRef.current
      if (!canvas) return

      const pt = getCanvasPoint(e.clientX, e.clientY)
      if (!pt) return

      const nx = Math.max(0, Math.min(1, pt.x / canvas.width))
      const ny = Math.max(0, Math.min(1, pt.y / canvas.height))

      const updated: Corners = {
        ...corners,
        [draggingRef.current]: { x: nx, y: ny },
      }
      setCorners(updated)
    },
    [corners, setCorners, getCanvasPoint]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch { /* ignore */ }
    }
    draggingRef.current = null
    setIsDraggingCorner(false)
  }, [setIsDraggingCorner])

  const handleApply = useCallback(async () => {
    if (!capturedFrame) return
    setApplying(true)

    const activeCorners = corners || {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    }

    const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
      new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('toBlob timeout')
          resolve(null)
        }, 5000)
        canvas.toBlob((blob) => {
          clearTimeout(timeout)
          resolve(blob)
        }, 'image/jpeg', quality)
      })

    // Native canvas crop as reliable fallback (no WASM required)
    const nativeCrop = (): HTMLCanvasElement => {
      const W = capturedFrame.width
      const H = capturedFrame.height
      const tl = { x: activeCorners.topLeft.x * W, y: activeCorners.topLeft.y * H }
      const tr = { x: activeCorners.topRight.x * W, y: activeCorners.topRight.y * H }
      const br = { x: activeCorners.bottomRight.x * W, y: activeCorners.bottomRight.y * H }
      const bl = { x: activeCorners.bottomLeft.x * W, y: activeCorners.bottomLeft.y * H }

      const minX = Math.max(0, Math.min(tl.x, tr.x, br.x, bl.x))
      const minY = Math.max(0, Math.min(tl.y, tr.y, br.y, bl.y))
      const maxX = Math.max(0, Math.min(W, Math.max(tl.x, tr.x, br.x, bl.x)))
      const maxY = Math.max(0, Math.min(H, Math.max(tl.y, tr.y, br.y, bl.y)))

      const cropW = Math.max(32, Math.round(maxX - minX))
      const cropH = Math.max(32, Math.round(maxY - minY))

      const srcCanvas = document.createElement('canvas')
      srcCanvas.width = W
      srcCanvas.height = H
      srcCanvas.getContext('2d', { willReadFrequently: true })!.putImageData(capturedFrame, 0, 0)

      const out = document.createElement('canvas')
      out.width = cropW
      out.height = cropH
      out.getContext('2d')!.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
      return out
    }

    try {
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = capturedFrame.width
      sourceCanvas.height = capturedFrame.height
      sourceCanvas.getContext('2d', { willReadFrequently: true })!.putImageData(capturedFrame, 0, 0)

      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ms)
          ),
        ])

      let blob: Blob | null = null

      try {
        const result = await withTimeout(extractDocument(sourceCanvas, activeCorners), 8000)
        if (result.success && result.output instanceof HTMLCanvasElement) {
          blob = await toBlob(result.output, 0.85)
        }
      } catch (err) {
        console.warn('WASM extraction failed or timed out:', err)
      }

      // Fallback to native crop if WASM gave nothing
      if (!blob) {
        try {
          blob = await toBlob(nativeCrop(), 0.85)
        } catch (err) {
          console.error('Native crop failed:', err)
        }
      }

      // Last resort: full frame
      if (!blob) {
        blob = await toBlob(sourceCanvas, 0.85)
      }

      if (blob) {
        setProcessedBlob(blob)
        setState('preview')
        onClose?.()
      } else {
        throw new Error('All image capture methods failed')
      }
    } catch (err) {
      console.error('handleApply error:', err)
      showToast('Ошибка обработки', 'error')
    } finally {
      setApplying(false)
    }
  }, [capturedFrame, corners, setProcessedBlob, setState, showToast, onClose])

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 relative z-[30]">
        <button
          onClick={() => {
            setIsDraggingCorner(false)
            if (!processedBlob) {
              setState('scanning')
            } else {
              onClose?.()
              setState('preview')
            }
          }}
          className="text-slate-400 hover:text-white text-sm transition-colors px-3 py-2"
        >
          Отмена
        </button>
        <span className="text-white font-semibold text-sm">Корректировка углов</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setIsDraggingCorner(false)
            draggingRef.current = null
            handleApply()
          }}
          disabled={applying}
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors px-3 py-2 disabled:opacity-50"
        >
          {applying ? 'Обработка...' : 'Применить'}
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs py-2 px-4">
        Перетащите угловые точки для точной настройки
      </p>

      <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  )
}
