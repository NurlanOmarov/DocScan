// Wrapper around the scanic library for document scanning
// scanic provides WASM-based document edge detection

let scanner: unknown = null
let initialized = false

interface ScanOptions {
  mode?: 'detect' | 'extract'
  output?: 'canvas' | 'imagedata' | 'dataurl'
  maxProcessingDimension?: number
  lowThreshold?: number
  highThreshold?: number
  minArea?: number
  debug?: boolean
}

export async function initScanic(): Promise<void> {
  try {
    // Dynamic import to handle WASM initialization
    const scanic = await import('scanic')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = scanic as any
    const ScannerClass = mod.Scanner ?? mod.default?.Scanner ?? mod.default

    if (!ScannerClass) {
      throw new Error('Scanner class not found in scanic module')
    }

    scanner = new ScannerClass()
    await (scanner as { initialize(): Promise<void> }).initialize()
    initialized = true
  } catch (err) {
    console.error('Failed to initialize scanic:', err)
    initialized = false
    throw err
  }
}

export async function detectDocument(
  imageData: ImageData | HTMLCanvasElement
): Promise<ScanResult> {
  if (!initialized || !scanner) {
    throw new Error('Scanic not initialized')
  }

  const s = scanner as {
    scan(
      input: ImageData | HTMLCanvasElement,
      options: ScanOptions
    ): Promise<ScanResult>
  }

  return s.scan(imageData, {
    mode: 'detect',
    maxProcessingDimension: 800,
  })
}

export async function extractDocument(
  canvas: HTMLCanvasElement
): Promise<ScanResult> {
  if (!initialized || !scanner) {
    throw new Error('Scanic not initialized')
  }

  const s = scanner as {
    scan(
      input: HTMLCanvasElement,
      options: ScanOptions
    ): Promise<ScanResult>
  }

  return s.scan(canvas, {
    mode: 'extract',
    output: 'canvas',
  })
}

export function isInitialized(): boolean {
  return initialized
}

export interface Corner {
  x: number
  y: number
}

export interface ScanResult {
  success: boolean
  corners?: {
    topLeft: Corner
    topRight: Corner
    bottomRight: Corner
    bottomLeft: Corner
  }
  output?: HTMLCanvasElement | ImageData | string
  contour?: number[]
  timings?: Record<string, number>
  message?: string
}
