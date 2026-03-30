import React, { useState, useMemo } from 'react'
import { useScannerStore } from '../../store/scannerStore'
import { DocumentCard } from './DocumentCard'
import { DocumentViewer } from './DocumentViewer'

export const DocumentList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const documents = useScannerStore((s) => s.documents)
  const viewerOpen = useScannerStore((s) => s.viewerOpen)
  const setState = useScannerStore((s) => s.setState)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase()
    return documents.filter((d) => d.name.toLowerCase().includes(q))
  }, [documents, searchQuery])

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-safe-top pt-4 pb-3 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white font-bold text-xl">Документы</h1>
          <button
            onClick={() => setState('scanning')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-medium transition-colors active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Новый скан
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Поиск документов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {documents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-white text-lg font-semibold mb-2">
              Нет документов
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Отсканируйте ваш первый документ, нажав кнопку «Новый скан»
            </p>
            <button
              onClick={() => setState('scanning')}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Начать сканирование
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-400 text-sm">
              По запросу «{searchQuery}» ничего не найдено
            </p>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-xs mb-3">
              {filtered.length} {getDocWord(filtered.length)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((doc) => {
                // Find actual index in documents array
                const actualIndex = documents.findIndex((d) => d.id === doc.id)
                return (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    index={actualIndex}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Document viewer modal */}
      {viewerOpen && <DocumentViewer />}
    </div>
  )
}

function getDocWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19) return 'документов'
  if (mod10 === 1) return 'документ'
  if (mod10 >= 2 && mod10 <= 4) return 'документа'
  return 'документов'
}
