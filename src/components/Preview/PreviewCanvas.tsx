import React, { useEffect, useState } from 'react'
import { useScannerStore } from '../../store/scannerStore'
import { Spinner } from '../common/Spinner'
import { CornerEditor } from './CornerEditor'

interface UploadResult {
  success: boolean
  id?: string
  name?: string
  url?: string
  thumbnail_url?: string
}

async function simulateUpload(
  blob: Blob,
  onProgress: (p: number) => void
): Promise<UploadResult> {
  return new Promise((resolve) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        onProgress(100)
        setTimeout(() => {
          const url = URL.createObjectURL(blob)
          resolve({
            success: true,
            id: `doc_${Date.now()}`,
            name: `Документ ${new Date().toLocaleDateString('ru-RU')}`,
            url,
            thumbnail_url: url,
          })
        }, 300)
      } else {
        onProgress(Math.round(progress))
      }
    }, 150)
  })
}

export const PreviewCanvas: React.FC = () => {
  const [showEditor, setShowEditor] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)

  const {
    autoMode,
    capturedFrame,
    processedBlob,
    setUploadProgress,
    addDocument,
    setState,
    showToast,
  } = useScannerStore()

  // Auto-open editor if we just did a manual capture (no blob yet)
  useEffect(() => {
    if (!autoMode && !processedBlob && capturedFrame) {
      setShowEditor(true)
    }
  }, [autoMode, processedBlob, capturedFrame])

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Manage preview URL lifecycle
  useEffect(() => {
    if (!processedBlob) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(processedBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [processedBlob])

  const handleUpload = async () => {
    if (!processedBlob) return
    setUploading(true)
    setUploadError(false)
    setState('uploading')

    try {
      // Try real API first, fall back to simulation
      const useRealApi = false // Set to true when backend is available

      let result: UploadResult

      if (useRealApi) {
        result = await new Promise<UploadResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100))
            }
          }
          xhr.onload = () => {
            try {
              resolve(JSON.parse(xhr.responseText) as UploadResult)
            } catch {
              reject(new Error('Invalid server response'))
            }
          }
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.open('POST', '/api/upload')
          const form = new FormData()
          form.append('document', processedBlob, 'scan.jpg')
          xhr.send(form)
        })
      } else {
        result = await simulateUpload(processedBlob, setUploadProgress)
      }

      if (result.success && result.id) {
        addDocument({
          id: result.id,
          name: result.name ?? `Документ ${new Date().toLocaleDateString('ru-RU')}`,
          date: new Date().toISOString(),
          url: result.url ?? '',
          thumbnailUrl: result.thumbnail_url ?? result.url ?? '',
        })
        setState('done')
      } else {
        throw new Error('Upload failed')
      }
    } catch {
      setUploadError(true)
      setUploading(false)
      setState('preview')
      showToast('Ошибка загрузки. Попробуйте снова.', 'error')
    }
  }

  if (showEditor) {
    return <CornerEditor onClose={() => setShowEditor(false)} />
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <button
          onClick={() => setState('scanning')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Переснять
        </button>
        <span className="text-white font-semibold">Предпросмотр</span>
        <button
          onClick={() => setShowEditor(true)}
          className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
        >
          Правка
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
        {!processedBlob || !previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size={48} />
            <p className="text-slate-400 text-sm">Обработка документа...</p>
          </div>
        ) : (
          <div className="relative max-w-full max-h-full">
            <img
              src={previewUrl}
              alt="Сканированный документ"
              className="max-w-full max-h-full rounded-lg shadow-2xl object-contain bg-slate-800"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
              onError={() => showToast('Ошибка отображения превью', 'error')}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 px-4 pb-8 pt-4 bg-slate-800/50 border-t border-slate-700">
        {uploadError && (
          <div className="mb-3 flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300 text-sm flex-1">Ошибка загрузки</span>
            <button
              onClick={handleUpload}
              className="text-red-300 hover:text-white text-sm font-medium underline"
            >
              Повторить
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setState('scanning')}
            className="flex-1 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-base transition-colors active:scale-95"
          >
            Переснять
          </button>
          <button
            onClick={handleUpload}
            disabled={!processedBlob || uploading}
            className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Spinner size={20} color="white" />
                <span>Загрузка...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Отправить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
