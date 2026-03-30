import React, { useRef, useEffect, useState } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { useScanner } from '../../hooks/useScanner'
import { DocumentOverlay } from './DocumentOverlay'
import { ControlBar } from './ControlBar'
import { useScannerStore } from '../../store/scannerStore'
import { Spinner } from '../common/Spinner'
import { CoachMark } from '../common/CoachMark'

export const CameraView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 375, height: 667 })
  const [flashEffect, setFlashEffect] = useState(false)

  const { videoRef, error, isReady, switchFlash } = useCamera()
  const { corners, confidence, capture } = useScanner(videoRef)
  const {
    flashOn,
    showToast,
    setState,
    setCapturedFrame,
    setProcessedBlob,
    settings,
    updateScannerSetting,
    isDarkEnvironmentDetected
  } = useScannerStore()
  const highContrastMode = settings.highContrastMode

  // Update dimensions on resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const [videoResolution, setVideoResolution] = useState({ width: 0, height: 0 })

  // Capture video resolution when ready
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleLoaded = () => {
      setVideoResolution({
        width: video.videoWidth,
        height: video.videoHeight
      })
    }
    if (video.readyState >= 1) {
      handleLoaded()
    }
    video.addEventListener('loadedmetadata', handleLoaded)
    return () => video.removeEventListener('loadedmetadata', handleLoaded)
  }, [videoRef, isReady])

  // Flash control
  useEffect(() => {
    switchFlash(flashOn)
  }, [flashOn, switchFlash])

  // Show camera error
  useEffect(() => {
    if (error) {
      showToast(error, 'error')
    }
  }, [error, showToast])

  const handleCapture = () => {
    setFlashEffect(true)
    setTimeout(() => setFlashEffect(false), 300)
    capture()
  }

  const handleFileLoaded = (imageData: ImageData, blob: Blob) => {
    setCapturedFrame(imageData)
    setProcessedBlob(blob)
    setState('preview')
  }

  const confidenceLabel: Record<typeof confidence, string> = {
    none: '',
    low: 'Слабый сигнал',
    medium: 'Наводка...',
    high: 'Готово к съёмке',
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Loading overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <Spinner size={48} />
          <p className="mt-4 text-white/70 text-sm">Инициализация камеры...</p>
        </div>
      )}

      {/* Camera error fallback */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 px-8">
          <div className="text-6xl mb-4">📷</div>
          <h3 className="text-white text-lg font-semibold mb-2 text-center">
            Камера недоступна
          </h3>
          <p className="text-slate-400 text-sm text-center mb-6">{error}</p>
          <label className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium cursor-pointer transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Загрузить из галереи
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const img = new Image()
                const url = URL.createObjectURL(file)
                img.onload = () => {
                  const canvas = document.createElement('canvas')
                  canvas.width = img.width
                  canvas.height = img.height
                  const ctx = canvas.getContext('2d')!
                  ctx.drawImage(img, 0, 0)
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                  canvas.toBlob(
                    (blob) => {
                      if (blob) handleFileLoaded(imageData, blob)
                      URL.revokeObjectURL(url)
                    },
                    'image/jpeg',
                    0.85
                  )
                }
                img.src = url
              }}
            />
          </label>
          <button
            onClick={() => setState('idle')}
            className="mt-3 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Назад
          </button>
        </div>
      )}

      {/* Document overlay */}
      {isReady && (
        <DocumentOverlay
          corners={corners}
          confidence={confidence}
          width={dimensions.width}
          height={dimensions.height}
          videoWidth={videoResolution.width}
          videoHeight={videoResolution.height}
        />
      )}

      {/* Capture flash effect */}
      {flashEffect && (
        <div className="absolute inset-0 bg-white z-20 pointer-events-none capture-flash" />
      )}

      {/* Top bar */}
      {isReady && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-safe-top pt-4 pb-3 bg-gradient-to-b from-black/60 to-transparent z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setState('idle')}
              className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
              aria-label="Назад"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Background Mode Toggle */}
            <button
              onClick={() => updateScannerSetting('highContrastMode', !highContrastMode)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                highContrastMode ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'bg-black/30 text-white hover:bg-black/50'
              }`}
              title={highContrastMode ? "Темный стол (Вкл)" : "Светлый стол (Вкл)"}
            >
              {highContrastMode ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                </svg>
              )}
            </button>
          </div>

          <span className="text-white font-semibold text-base hidden sm:block">Сканер</span>

          <div className="flex items-center gap-2">
            {/* Auto-hint for dark environment */}
            {!highContrastMode && isDarkEnvironmentDetected && (
               <div className="animate-pulse bg-amber-400/20 text-amber-300 text-[10px] px-2 py-1 rounded-md border border-amber-400/30 whitespace-nowrap">
                 Темный стол?
               </div>
            )}
            
            {/* Confidence indicator */}
            <div
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all
                ${confidence === 'none' ? 'opacity-0' : 'opacity-100'}
                ${confidence === 'high' ? 'bg-emerald-600 text-white' : ''}
                ${confidence === 'medium' ? 'bg-yellow-600 text-white' : ''}
                ${confidence === 'low' ? 'bg-red-600 text-white' : ''}
              `}
            >
              {confidenceLabel[confidence]}
            </div>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      {isReady && !error && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <ControlBar
            onCapture={handleCapture}
            onFileLoaded={handleFileLoaded}
            disabled={false}
          />
        </div>
      )}

      {/* Coach mark */}
      <CoachMark />
    </div>
  )
}
