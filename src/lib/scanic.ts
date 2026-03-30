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
  dilationKernelSize?: number
  dilationIterations?: number
  minArea?: number
  epsilon?: number
  debug?: boolean
  corners?: {
    topLeft: Corner
    topRight: Corner
    bottomRight: Corner
    bottomLeft: Corner
  }
  points?: number[] // [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]
  contour?: number[] // Alias for points
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
    lowThreshold: 50,
    highThreshold: 150,
    minArea: 20000,
    dilationKernelSize: 5,
    epsilon: 0.02,
  })
}

export async function extractDocument(
  canvas: HTMLCanvasElement,
  corners?: {
    topLeft: Corner
    topRight: Corner
    bottomRight: Corner
    bottomLeft: Corner
  }
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

  const options: ScanOptions = {
    mode: 'extract',
    output: 'canvas',
    maxProcessingDimension: 1600,
  }

  // If corners are provided, denormalize them and provide in multiple formats for robustness
  if (corners) {
    const tl = { x: corners.topLeft.x * canvas.width, y: corners.topLeft.y * canvas.height }
    const tr = { x: corners.topRight.x * canvas.width, y: corners.topRight.y * canvas.height }
    const br = { x: corners.bottomRight.x * canvas.width, y: corners.bottomRight.y * canvas.height }
    const bl = { x: corners.bottomLeft.x * canvas.width, y: corners.bottomLeft.y * canvas.height }

    options.corners = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl }
    options.points = [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]
    options.contour = options.points
  }

  return s.scan(canvas, options)
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
