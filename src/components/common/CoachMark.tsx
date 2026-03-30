import React, { useState, useEffect } from 'react'

const COACH_MARK_KEY = 'docscan_coached'

interface Step {
  title: string
  description: string
  icon: string
}

const STEPS: Step[] = [
  {
    title: 'Направьте камеру на документ',
    description:
      'Держите документ ровно, на хорошо освещённой поверхности. Приложение автоматически обнаружит края.',
    icon: '📄',
  },
  {
    title: 'Автоматический захват',
    description:
      'При хорошем обнаружении рамка станет зелёной и документ будет сфотографирован автоматически. Или нажмите кнопку затвора вручную.',
    icon: '🎯',
  },
  {
    title: 'Проверьте и отправьте',
    description:
      'После захвата вы увидите выпрямленный документ. Проверьте качество и отправьте или переснимите.',
    icon: '✅',
  },
]

export const CoachMark: React.FC = () => {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const coached = localStorage.getItem(COACH_MARK_KEY)
    if (!coached) {
      setVisible(true)
    }
  }, [])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    localStorage.setItem(COACH_MARK_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={handleNext}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Content */}
      <div
        className="relative z-10 mx-6 max-w-sm bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-emerald-500'
                  : i < step
                  ? 'w-2 bg-emerald-700'
                  : 'w-2 bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-center text-5xl mb-4">{current.icon}</div>

        {/* Text */}
        <h3 className="text-white text-lg font-semibold text-center mb-2">
          {current.title}
        </h3>
        <p className="text-slate-300 text-sm text-center leading-relaxed mb-6">
          {current.description}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors"
          >
            Пропустить
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            {step < STEPS.length - 1 ? 'Далее' : 'Начать'}
          </button>
        </div>
      </div>
    </div>
  )
}
