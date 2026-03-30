import React from 'react'
import { useScannerStore, type ScannerSettings } from '../../store/scannerStore'

export const SettingsView: React.FC = () => {
  const { settings, updateScannerSetting, resetSettings, setState } = useScannerStore()

  const handleSliderChange = (key: keyof ScannerSettings, value: number) => {
    updateScannerSetting(key, value)
  }

  const handleToggleChange = (key: keyof ScannerSettings) => {
    updateScannerSetting(key, !settings[key])
  }

  const SettingRow: React.FC<{
    label: string
    description: string
    min: number
    max: number
    step: number
    value: number
    onChange: (val: number) => void
  }> = ({ label, description, min, max, step, value, onChange }) => (
    <div className="mb-6 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
      <div className="flex justify-between items-center mb-1">
        <label className="text-white font-medium text-sm">{label}</label>
        <span className="text-emerald-400 font-mono text-xs bg-emerald-400/10 px-2 py-1 rounded">{value}</span>
      </div>
      <p className="text-slate-400 text-xs mb-3">{description}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-500">{min}</span>
        <span className="text-[10px] text-slate-500">{max}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-12 pb-6 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 z-10">
        <div>
          <h2 className="text-white text-xl font-bold">Настройки отладки</h2>
          <p className="text-slate-400 text-xs mt-1">Тонкая настройка алгоритмов детекции</p>
        </div>
        <button
          onClick={() => setState('idle')}
          className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-2">
        <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider mb-4 px-1">Алгоритм Canny (Грани)</h3>
        
        <SettingRow
          label="Нижний порог (Low Threshold)"
          description="Чувствительность к слабым граням. Уменьшите для светлых поверхностей."
          min={5}
          max={150}
          step={1}
          value={settings.lowThreshold}
          onChange={(val) => handleSliderChange('lowThreshold', val)}
        />

        <SettingRow
          label="Верхний порог (High Threshold)"
          description="Порог для уверенных граней. Большой разрыв с нижним убирает шум."
          min={10}
          max={300}
          step={1}
          value={settings.highThreshold}
          onChange={(val) => handleSliderChange('highThreshold', val)}
        />

        <SettingRow
          label="Ядро дилатации (Dilation)"
          description="Толщина линий граней. Помогает соединять разрывы. (Нечетное)"
          min={1}
          max={15}
          step={1}
          value={settings.dilationKernelSize}
          onChange={(val) => handleSliderChange('dilationKernelSize', val)}
        />

        <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider mb-4 pt-4 px-1">Геометрия и Площадь</h3>

        <SettingRow
          label="Коэффициент Epsilon"
          description="Точность аппроксимации углов. Меньше = точнее, Больше = стабильнее."
          min={0.005}
          max={0.1}
          step={0.005}
          value={settings.epsilon}
          onChange={(val) => handleSliderChange('epsilon', val)}
        />

        <SettingRow
          label="Мин. площадь документа"
          description="Документ должен занимать % кадра. Отсекает мелкий мусор."
          min={0.01}
          max={0.5}
          step={0.01}
          value={settings.minAreaRatio}
          onChange={(val) => handleSliderChange('minAreaRatio', val)}
        />

        <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider mb-4 pt-4 px-1">Стабилизация</h3>

        <SettingRow
          label="Сглаживание (Smoothing)"
          description="Как плавно рамка следует за документом. Меньше = «жидкая», Больше = резкая."
          min={0.01}
          max={1}
          step={0.01}
          value={settings.smoothingFactor}
          onChange={(val) => handleSliderChange('smoothingFactor', val)}
        />

        <SettingRow
          label="Порог движения"
          description="Микро-движение меньше этого порога игнорируется для фиксации рамки."
          min={0.001}
          max={0.1}
          step={0.001}
          value={settings.movementThreshold}
          onChange={(val) => handleSliderChange('movementThreshold', val)}
        />

        <div className="pt-6 border-t border-slate-800">
           <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div>
              <label className="text-white font-medium text-sm block">Debug-слой</label>
              <p className="text-slate-400 text-[10px]">Показывать результат детектора краев (Canny)</p>
            </div>
            <button
               onClick={() => handleToggleChange('debugOverlay')}
               className={`w-12 h-6 rounded-full transition-colors relative ${settings.debugOverlay ? 'bg-emerald-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.debugOverlay ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="pt-10 flex flex-col gap-3">
          <button
            onClick={resetSettings}
            className="w-full py-4 rounded-2xl bg-red-600/10 text-red-500 font-medium hover:bg-red-600/20 transition-colors border border-red-600/20"
          >
            Сбросить всё
          </button>
        </div>
      </div>

      {/* Footer sticky info */}
      <div className="p-4 bg-slate-800 border-t border-slate-700 text-center">
         <p className="text-slate-500 text-[10px]">DocScan Engine v1.1 • WASM Core</p>
      </div>
    </div>
  )
}
