import React, { useEffect, useState } from 'react'
import { useScannerStore } from './store/scannerStore'
import { initScanic } from './lib/scanic'
import { CameraView } from './components/Scanner/CameraView'
import { PreviewCanvas } from './components/Preview/PreviewCanvas'
import { UploadProgress } from './components/Upload/UploadProgress'
import { DocumentList } from './components/Viewer/DocumentList'
import { Toast } from './components/common/Toast'
import { Spinner } from './components/common/Spinner'

// Idle / welcome screen
const IdleScreen: React.FC = () => {
  const setState = useScannerStore((s) => s.setState)
  const documents = useScannerStore((s) => s.documents)

  return (
    <div className="flex flex-col h-full bg-slate-900 items-center justify-center px-8">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-emerald-600/20 border-2 border-emerald-500/40 flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-white text-3xl font-bold mb-2">DocScan</h1>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => setState('scanning')}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/25"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Начать сканирование
        </button>

        {documents.length > 0 && (
          <button
            onClick={() => setState('done')}
            className="w-full py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-base transition-all active:scale-95 flex items-center justify-center gap-3 border border-slate-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Мои документы
            <span className="ml-auto bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {documents.length}
            </span>
          </button>
        )}
      </div>

    </div>
  )
}

// Done / success screen
const DoneScreen: React.FC = () => {
  const setState = useScannerStore((s) => s.setState)
  const documents = useScannerStore((s) => s.documents)

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Success banner */}
      <div className="flex-shrink-0 flex flex-col items-center px-6 pt-12 pb-6 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-slate-700">
        <div className="w-16 h-16 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold mb-1">Документ сохранён</h2>
        <p className="text-slate-400 text-sm text-center">
          {documents.length > 0 && `Всего документов: ${documents.length}`}
        </p>

        <div className="flex gap-3 mt-5 w-full max-w-xs">
          <button
            onClick={() => setState('scanning')}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors active:scale-95"
          >
            Сканировать ещё
          </button>
          <button
            onClick={() => setState('idle')}
            className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition-colors active:scale-95"
          >
            На главную
          </button>
        </div>
      </div>

      {/* Document list */}
      <DocumentList />
    </div>
  )
}

// Main app
function App() {
  const state = useScannerStore((s) => s.state)
  const toast = useScannerStore((s) => s.toast)
  const showToast = useScannerStore((s) => s.showToast)
  const [scanicReady, setScanicReady] = useState(false)

  useEffect(() => {
    initScanic()
      .then(() => setScanicReady(true))
      .catch(() => {
        setScanicReady(true) // Continue even if scanic fails
        showToast('Детекция недоступна. Вы можете захватить вручную', 'warning')
      })
  }, [showToast])

  return (
    <div className="h-full w-full relative bg-slate-900 overflow-hidden">
      {/* Loading overlay while scanic initializes */}
      {!scanicReady && state === 'idle' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={40} />
            <p className="text-slate-400 text-sm">Инициализация...</p>
          </div>
        </div>
      )}

      {state === 'idle' && <IdleScreen />}
      {(state === 'scanning' || state === 'captured') && <CameraView />}
      {state === 'preview' && <PreviewCanvas />}
      {state === 'uploading' && <UploadProgress />}
      {state === 'done' && <DoneScreen />}

      {toast && <Toast />}
    </div>
  )
}

export default App
