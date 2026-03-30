import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useScannerStore } from '../../store/scannerStore'
import { ViewerToolbar } from './ViewerToolbar'
import { ZoomControls } from './ZoomControls'

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const ZOOM_STEP = 0.25

export const DocumentViewer: React.FC = () => {
  const documents = useScannerStore((s) => s.documents)
  const viewerDocIndex = useScannerStore((s) => s.viewerDocIndex)
  const closeViewer = useScannerStore((s) => s.closeViewer)
  const setViewerDocIndex = useScannerStore((s) => s.setViewerDocIndex)

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const lastTapRef = useRef(0)
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null)
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null)

  const doc = documents[viewerDocIndex]

  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s))

  const resetZoom = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const fitWidth = useCallback(() => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img) return
    const newScale = container.clientWidth / img.naturalWidth
    setScale(clampScale(newScale))
    setTranslate({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    setScale((s) => clampScale(s + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => clampScale(s - ZOOM_STEP))
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const goNext = useCallback(() => {
    if (viewerDocIndex < documents.length - 1) {
      setViewerDocIndex(viewerDocIndex + 1)
      resetZoom()
    }
  }, [viewerDocIndex, documents.length, setViewerDocIndex, resetZoom])

  const goPrev = useCallback(() => {
    if (viewerDocIndex > 0) {
      setViewerDocIndex(viewerDocIndex - 1)
      resetZoom()
    }
  }, [viewerDocIndex, setViewerDocIndex, resetZoom])

  // Keyboard handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': closeViewer(); break
        case 'ArrowLeft': goPrev(); break
        case 'ArrowRight': goNext(); break
        case '+': case '=': zoomIn(); break
        case '-': zoomOut(); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeViewer, goPrev, goNext, zoomIn, zoomOut])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setScale((s) => clampScale(s + delta))
  }, [])

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y }
  }, [scale, translate])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setTranslate({ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers
  const getTouchDist = (e: React.TouchEvent) => {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartRef.current = { dist: getTouchDist(e), scale }
      swipeStartRef.current = null
    } else if (e.touches.length === 1) {
      const now = Date.now()
      const touch = e.touches[0]

      // Double tap
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0
        if (scale !== 1) {
          resetZoom()
        } else {
          setScale(2)
        }
        return
      }
      lastTapRef.current = now

      swipeStartRef.current = { x: touch.clientX, y: touch.clientY, t: now }
      dragStartRef.current = { x: touch.clientX, y: touch.clientY, tx: translate.x, ty: translate.y }
    }
  }, [scale, translate, resetZoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()

    if (e.touches.length === 2 && pinchStartRef.current) {
      const dist = getTouchDist(e)
      const newScale = clampScale((dist / pinchStartRef.current.dist) * pinchStartRef.current.scale)
      setScale(newScale)
      return
    }

    if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - dragStartRef.current.x
      const dy = touch.clientY - dragStartRef.current.y
      setTranslate({ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy })
    }
  }, [scale])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    pinchStartRef.current = null

    if (e.changedTouches.length === 1 && swipeStartRef.current && scale <= 1) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - swipeStartRef.current.x
      const dy = touch.clientY - swipeStartRef.current.y
      const dt = Date.now() - swipeStartRef.current.t
      const speed = Math.hypot(dx, dy) / dt

      if (speed > 0.3 && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 40) {
        if (dx < 0) goNext()
        else goPrev()
      } else if (speed > 0.3 && dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        closeViewer()
      }
    }
    swipeStartRef.current = null
  }, [scale, goNext, goPrev, closeViewer])

  if (!doc) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <ViewerToolbar docIndex={viewerDocIndex} onClose={closeViewer} />

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default', touchAction: 'none' }}
      >
        <img
          ref={imgRef}
          src={doc.url}
          alt={doc.name}
          draggable={false}
          className="max-w-none select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />

        {/* Prev/Next navigation arrows */}
        {viewerDocIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
            aria-label="Предыдущий"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {viewerDocIndex < documents.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
            aria-label="Следующий"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Page indicator */}
        {documents.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {documents.map((_, i) => (
              <button
                key={i}
                onClick={() => { setViewerDocIndex(i); resetZoom() }}
                className={`h-1.5 rounded-full transition-all ${
                  i === viewerDocIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom zoom controls */}
      <div className="flex justify-center pb-6 pt-3 bg-black/40">
        <ZoomControls
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          onFitWidth={fitWidth}
          onFullscreen={toggleFullscreen}
        />
        {isFullscreen && (
          <span className="absolute right-4 bottom-6 text-xs text-white/40">
            Нажмите Esc для выхода
          </span>
        )}
      </div>
    </div>
  )
}
