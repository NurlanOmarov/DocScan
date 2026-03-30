import { create } from 'zustand'

export type AppState = 'idle' | 'scanning' | 'captured' | 'preview' | 'uploading' | 'done'

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

  setState: (s) => set({ state: s }),
  setCapturedFrame: (f) => set({ capturedFrame: f }),
  setCorners: (c) => set({ corners: c }),
  setProcessedBlob: (b) => set({ processedBlob: b }),
  setUploadProgress: (p) => set({ uploadProgress: p }),

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

  toggleAutoMode: () => set((state) => ({ autoMode: !state.autoMode })),
  toggleFlash: () => set((state) => ({ flashOn: !state.flashOn })),
  setIsDraggingCorner: (isDragging) => set({ isDraggingCorner: isDragging }),

  openViewer: (index) => set({ viewerOpen: true, viewerDocIndex: index }),
  closeViewer: () => set({ viewerOpen: false }),
  setViewerDocIndex: (i) => set({ viewerDocIndex: i }),
}))
