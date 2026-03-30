import React, { useState } from 'react'
import { useScannerStore } from '../../store/scannerStore'
import { generatePDF, shareFile } from '../../lib/pdf'
import { Spinner } from '../common/Spinner'

interface ViewerToolbarProps {
  docIndex: number
  onClose: () => void
}

export const ViewerToolbar: React.FC<ViewerToolbarProps> = ({ docIndex, onClose }) => {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const documents = useScannerStore((s) => s.documents)
  const removeDocument = useScannerStore((s) => s.removeDocument)
  const renameDocument = useScannerStore((s) => s.renameDocument)
  const showToast = useScannerStore((s) => s.showToast)

  const doc = documents[docIndex]
  if (!doc) return null

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = doc.url
    a.download = `${doc.name}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDownloadPDF = async () => {
    setIsProcessing(true)
    try {
      const blob = await generatePDF(doc.url)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('PDF сохранён', 'info')
    } catch (err) {
      console.error(err)
      showToast('Ошибка генерации PDF', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleShare = async () => {
    setIsProcessing(true)
    try {
      const blob = await generatePDF(doc.url)
      const success = await shareFile(blob, `${doc.name}.pdf`)
      if (!success && !navigator.share) {
        showToast('Обмен файлами не поддерживается в этом браузере', 'warning')
      }
    } catch (err) {
      console.error(err)
      showToast('Ошибка при отправке', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = () => {
    const confirmed = window.confirm(`Удалить документ «${doc.name}»?`)
    if (confirmed) {
      removeDocument(doc.id)
      showToast('Документ удалён', 'info')
      onClose()
    }
  }

  const handleRename = () => {
    setNewName(doc.name)
    setRenaming(true)
  }

  const handleRenameSubmit = () => {
    if (newName.trim()) {
      renameDocument(doc.id, newName.trim())
      showToast('Название изменено', 'info')
    }
    setRenaming(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
      {/* Close */}
      <button
        onClick={onClose}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Закрыть"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Title / rename */}
      <div className="flex-1 mx-3">
        {renaming ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleRenameSubmit() }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-emerald-400"
              placeholder="Название документа"
            />
          </form>
        ) : (
          <button
            onClick={handleRename}
            className="text-white font-medium text-sm truncate hover:text-emerald-300 transition-colors text-left w-full"
            title="Нажмите для переименования"
          >
            {doc.name}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleRename}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          aria-label="Переименовать"
          title="Переименовать"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={handleDownload}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          aria-label="Скачать JPG"
          title="Скачать JPG"
          disabled={isProcessing}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        <button
          onClick={handleDownloadPDF}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-emerald-400 transition-colors"
          aria-label="Скачать PDF"
          title="Скачать PDF"
          disabled={isProcessing}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          onClick={handleShare}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors ml-1 shadow-lg shadow-emerald-600/20"
          aria-label="Поделиться"
          title="Поделиться"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Spinner size={16} />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <button
          onClick={handleDelete}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-600/20 text-white/70 hover:text-red-400 transition-colors"
          aria-label="Удалить"
          title="Удалить"
          disabled={isProcessing}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
