import React, { useRef } from 'react'
import { CaptureButton } from './CaptureButton'
import { useScannerStore } from '../../store/scannerStore'

interface ControlBarProps {
  onCapture: () => void
  onFileLoaded: (imageData: ImageData, blob: Blob) => void
  disabled?: boolean
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onCapture,
  onFileLoaded,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { autoMode, flashOn, toggleAutoMode, toggleFlash } = useScannerStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          if (blob) onFileLoaded(imageData, blob)
          URL.revokeObjectURL(url)
        },
        'image/jpeg',
        0.85
      )
    }
    img.src = url

    // Reset input
    e.target.value = ''
  }

  return (
    <div className="flex items-center justify-between px-8 py-6 bg-black/40 backdrop-blur-sm">
      {/* Gallery button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-95"
        aria-label="Загрузить из галереи"
      >
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </button>

      {/* Auto mode toggle */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={toggleAutoMode}
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95
            ${autoMode
              ? 'bg-emerald-600 border border-emerald-400'
              : 'bg-white/10 border border-white/20 hover:bg-white/20'
            }
          `}
          aria-label={autoMode ? 'Отключить авторежим' : 'Включить авторежим'}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </button>
        <span className="text-xs text-white/60 font-medium">
          {autoMode ? 'Авто' : 'Ручной'}
        </span>
      </div>

      {/* Capture button */}
      <CaptureButton onCapture={onCapture} disabled={disabled} />

      {/* Flash toggle */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={toggleFlash}
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95
            ${flashOn
              ? 'bg-yellow-500 border border-yellow-300'
              : 'bg-white/10 border border-white/20 hover:bg-white/20'
            }
          `}
          aria-label={flashOn ? 'Выключить вспышку' : 'Включить вспышку'}
        >
          <svg
            className="w-6 h-6 text-white"
            fill={flashOn ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </button>
        <span className="text-xs text-white/60 font-medium">
          {flashOn ? 'Вспышка' : 'Свет'}
        </span>
      </div>

      {/* Placeholder to balance layout */}
      <div className="w-14 h-14" />
    </div>
  )
}
