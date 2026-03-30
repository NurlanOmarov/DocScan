import { create } from 'zustand'

export type AppState = 'idle' | 'scanning' | 'captured' | 'preview' | 'uploading' | 'done' | 'settings'

export interface ScannerSettings {
  lowThreshold: number
  highThreshold: number
  dilationKernelSize: number
  epsilon: number
  smoothingFactor: number
  movementThreshold: number
  minAreaRatio: number
  debugOverlay: boolean
  highContrastMode: boolean
}

const DEFAULT_SETTINGS: ScannerSettings = {
  lowThreshold: 100,
  highThreshold: 75,
  dilationKernelSize: 7,
  epsilon: 0.02,
  smoothingFactor: 0.2,
  movementThreshold: 0.02,
  minAreaRatio: 0.08,
  debugOverlay: false,
  highContrastMode: false,
}

const loadSettings = (): ScannerSettings => {
  try {
    const saved = localStorage.getItem('docscan_settings')
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return DEFAULT_SETTINGS
}

export interface Corner {
  x: number
  y: number
}

export interface Corners {
  topLeft: Corner
  topRight: Corner
  bottomRight: Corner
  bottomLeft: Corner
}

export interface Document {
  id: string
  name: string
  date: string
  url: string
  thumbnailUrl: string
}

interface ToastData {
  message: string
  type: 'info' | 'warning' | 'error'
}

interface ScannerStore {
  state: AppState
  capturedFrame: ImageData | null
  corners: Corners | null
  processedBlob: Blob | null
  uploadProgress: number
  documents: Document[]
  toast: ToastData | null
  autoMode: boolean
  flashOn: boolean
  isDraggingCorner: boolean
  viewerOpen: boolean
  viewerDocIndex: number
  settings: ScannerSettings
  debugInfo: any | null
  isDarkEnvironmentDetected: boolean

  setState: (s: AppState) => void
  setCapturedFrame: (f: ImageData | null) => void
  setCorners: (c: Corners | null) => void
  setProcessedBlob: (b: Blob | null) => void
  setUploadProgress: (p: number) => void
  addDocument: (doc: Document) => void
  removeDocument: (id: string) => void
  renameDocument: (id: string, name: string) => void
  showToast: (message: string, type?: 'info' | 'warning' | 'error') => void
  clearToast: () => void
  toggleAutoMode: () => void
  toggleFlash: () => void
  setIsDraggingCorner: (isDragging: boolean) => void
  openViewer: (index: number) => void
  closeViewer: () => void
  setViewerDocIndex: (i: number) => void
  updateScannerSetting: (key: keyof ScannerSettings, value: any) => void
  setDebugInfo: (info: any | null) => void
  setIsDarkEnvironmentDetected: (isDark: boolean) => void
  resetSettings: () => void
}

export const useScannerStore = create<ScannerStore>()((set) => ({
  state: 'idle',
  capturedFrame: null,
  corners: null,
  processedBlob: null,
  uploadProgress: 0,
  documents: [],
  toast: null,
  autoMode: true,
  flashOn: false,
  isDraggingCorner: false,
  viewerOpen: false,
  viewerDocIndex: 0,
  settings: loadSettings(),
  debugInfo: null,
  isDarkEnvironmentDetected: false,

  setState: (s) => set({ state: s }),
  setCapturedFrame: (f) => set({ capturedFrame: f }),
  setCorners: (c) => set({ corners: c }),
  setProcessedBlob: (b) => set({ processedBlob: b }),
  setUploadProgress: (p) => set({ uploadProgress: p }),
  setDebugInfo: (info) => set({ debugInfo: info }),
  setIsDarkEnvironmentDetected: (d) => set({ isDarkEnvironmentDetected: d }),

  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),

  renameDocument: (id, name) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, name } : d
      ),
    })),

  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),

  toggleAutoMode: () => set((state) => {
    const nextAutoMode = !state.autoMode
    return {
      autoMode: nextAutoMode,
      // If we're turning off autoMode, clear the current corners
      // so the hook can re-initialize with a fresh manual centered rect
      corners: nextAutoMode ? state.corners : null
    }
  }),
  toggleFlash: () => set((state) => ({ flashOn: !state.flashOn })),
  setIsDraggingCorner: (isDragging) => set({ isDraggingCorner: isDragging }),

  openViewer: (index) => set({ viewerOpen: true, viewerDocIndex: index }),
  closeViewer: () => set({ viewerOpen: false }),
  setViewerDocIndex: (i) => set({ viewerDocIndex: i }),

  updateScannerSetting: (key, value) => set((state) => {
    const newSettings = { ...state.settings, [key]: value }
    localStorage.setItem('docscan_settings', JSON.stringify(newSettings))
    return { settings: newSettings }
  }),

  resetSettings: () => set(() => {
    localStorage.removeItem('docscan_settings')
    return { settings: DEFAULT_SETTINGS }
  }),
}))
