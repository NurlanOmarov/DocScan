import React from 'react'

interface ZoomControlsProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFitWidth: () => void
  onFullscreen: () => void
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFitWidth,
  onFullscreen,
}) => {
  const percent = Math.round(scale * 100)

  return (
    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5 border border-white/10">
      <button
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors"
        aria-label="Уменьшить"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <button
        onClick={onReset}
        className="px-2 py-1 text-xs text-white/80 hover:text-white font-mono min-w-[48px] text-center hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Сбросить масштаб"
      >
        {percent}%
      </button>

      <button
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors"
        aria-label="Увеличить"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <div className="w-px h-5 bg-white/20 mx-0.5" />

      <button
        onClick={onFitWidth}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors"
        aria-label="По ширине"
        title="По ширине"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <button
        onClick={onFullscreen}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors"
        aria-label="Полный экран"
        title="Полный экран"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  )
}
