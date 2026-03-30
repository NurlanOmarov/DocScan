import React, { useState } from 'react'

interface CaptureButtonProps {
  onCapture: () => void
  disabled?: boolean
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({ onCapture, disabled = false }) => {
  const [pressing, setPressing] = useState(false)

  const handlePress = () => {
    if (disabled) return
    setPressing(true)
    onCapture()
    setTimeout(() => setPressing(false), 300)
  }

  return (
    <button
      onPointerDown={handlePress}
      disabled={disabled}
      className={`
        relative flex-shrink-0
        w-20 h-20 rounded-full
        transition-transform duration-150
        focus:outline-none
        disabled:opacity-50
        ${pressing ? 'scale-90' : 'scale-100 active:scale-90'}
      `}
      aria-label="Снять"
    >
      {/* Outer ring */}
      <span
        className="absolute inset-0 rounded-full border-4 border-white opacity-80"
      />
      {/* Inner circle */}
      <span
        className={`
          absolute inset-2 rounded-full
          transition-all duration-150
          ${pressing ? 'bg-white/70 scale-90' : 'bg-white'}
        `}
      />
    </button>
  )
}
