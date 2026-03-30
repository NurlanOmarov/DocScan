import React, { useState, useRef } from 'react'
import { useScannerStore, type Document } from '../../store/scannerStore'

interface DocumentCardProps {
  doc: Document
  index: number
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, index }) => {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const openViewer = useScannerStore((s) => s.openViewer)
  const removeDocument = useScannerStore((s) => s.removeDocument)
  const renameDocument = useScannerStore((s) => s.renameDocument)
  const showToast = useScannerStore((s) => s.showToast)

  const formattedDate = new Date(doc.date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(doc.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleNameSubmit = () => {
    if (editName.trim() && editName !== doc.name) {
      renameDocument(doc.id, editName.trim())
      showToast('Название изменено', 'info')
    }
    setEditing(false)
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = doc.url
    a.download = `${doc.name}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm(`Удалить «${doc.name}»?`)
    if (confirmed) {
      removeDocument(doc.id)
      showToast('Документ удалён', 'info')
    }
  }

  return (
    <div
      className="group relative bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-emerald-600/50 transition-all cursor-pointer active:scale-95"
      onClick={() => openViewer(index)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] bg-slate-700 overflow-hidden">
        <img
          src={doc.thumbnailUrl}
          alt={doc.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Hover actions overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); openViewer(index) }}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            aria-label="Просмотр"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={handleDownload}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            aria-label="Скачать"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="w-10 h-10 rounded-full bg-red-500/40 hover:bg-red-500/60 flex items-center justify-center text-white transition-colors"
            aria-label="Удалить"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); handleNameSubmit() }}>
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-slate-700 border border-emerald-500 rounded-lg px-2 py-1 text-white text-sm focus:outline-none"
              autoFocus
            />
          </form>
        ) : (
          <p
            className="text-white text-sm font-medium truncate cursor-text hover:text-emerald-300 transition-colors"
            onClick={handleNameClick}
            title="Нажмите для переименования"
          >
            {doc.name}
          </p>
        )}
        <p className="text-slate-400 text-xs mt-1">{formattedDate}</p>
      </div>
    </div>
  )
}
