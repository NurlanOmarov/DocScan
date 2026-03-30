import React from 'react'
import { useScannerStore } from '../../store/scannerStore'
import { Spinner } from '../common/Spinner'

export const UploadProgress: React.FC = () => {
  const uploadProgress = useScannerStore((s) => s.uploadProgress)

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900 px-8">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            <Spinner size={96} color="#10b981" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-white text-xl font-semibold text-center mb-2">
          Загрузка документа
        </h2>
        <p className="text-slate-400 text-sm text-center mb-8">
          Пожалуйста, подождите...
        </p>

        {/* Progress bar */}
        <div className="relative">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Прогресс</span>
            <span className="text-white font-semibold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
