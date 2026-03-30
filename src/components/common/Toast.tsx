import React, { useEffect, useState } from 'react'
import { useScannerStore } from '../../store/scannerStore'

const TYPE_STYLES = {
  info: 'bg-blue-600 border-blue-400',
  warning: 'bg-yellow-600 border-yellow-400',
  error: 'bg-red-600 border-red-400',
}

const TYPE_ICONS = {
  info: (
    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
}

export const Toast: React.FC = () => {
  const toast = useScannerStore((s) => s.toast)
  const clearToast = useScannerStore((s) => s.clearToast)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (toast) {
      setLeaving(false)
      setVisible(true)
      const timer = setTimeout(() => {
        setLeaving(true)
        setTimeout(() => {
          setVisible(false)
          clearToast()
        }, 300)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, clearToast])

  if (!toast || !visible) return null

  const handleClose = () => {
    setLeaving(true)
    setTimeout(() => {
      setVisible(false)
      clearToast()
    }, 300)
  }

  return (
    <div
      className={`fixed top-4 left-4 right-4 z-[100] flex justify-center pointer-events-none`}
    >
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl border
          text-white text-sm font-medium shadow-2xl
          pointer-events-auto max-w-sm w-full
          ${TYPE_STYLES[toast.type]}
          ${leaving ? 'animate-fade-out' : 'animate-fade-in'}
        `}
      >
        {TYPE_ICONS[toast.type]}
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={handleClose}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Закрыть"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
