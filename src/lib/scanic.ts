// Wrapper around the scanic library for document scanning
// scanic provides WASM-based document edge detection

/**
 * Normalizes ImageData contrast by stretching the histogram to [0, 255].
 * This significantly helps with low-contrast images (e.g. light documents on light tables).
 */
function normalizeImageDataContrast(imageData: ImageData): ImageData {
  const data = imageData.data
  let min = 255
  let max = 0

  // 1. Find min/max luminosity (using quick approximation: (R+G+B)/3)
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
    if (avg < min) min = avg
    if (avg > max) max = avg
  }

  // If already high contrast or too dark, skip stretching
  if (max - min < 10) return imageData

  // 2. Create Lookup Table (LUT) for faster processing
  const lut = new Uint8ClampedArray(256)
  const range = max - min
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.min(255, Math.max(0, ((i - min) / range) * 255))
  }

  // 3. Apply LUT
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }

  return imageData
}

let scanner: unknown = null
let extractFn: unknown = null
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
}

export async function initScanic(): Promise<void> {
  try {
    // Dynamic import to handle WASM initialization
    const scanic = await import('scanic')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = scanic as any
    
    const ScannerClass = mod.Scanner ?? mod.default?.Scanner ?? mod.default
    extractFn = mod.extractDocument ?? mod.default?.extractDocument

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
  input: ImageData | HTMLCanvasElement
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

  // Sensitivity improvement: pre-process for contrast
  let processingInput = input
  if (input instanceof HTMLCanvasElement) {
    const ctx = input.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, input.width, input.height)
      const normalized = normalizeImageDataContrast(imageData)
      
      // We don't want to modify the source canvas directly to avoid artifacts in final extract,
      // but scanic's WASM layer works best on higher contrast. 
      // It's better to provide ImageData to scanic.
      processingInput = normalized
    }
  } else if (input instanceof ImageData) {
    // Since we're modifying the ImageData in place or returning a copy, 
    // it's safer to clone if we don't want to affect the caller's data
    processingInput = normalizeImageDataContrast(new ImageData(
      new Uint8ClampedArray(input.data),
      input.width,
      input.height
    ))
  }

  return s.scan(processingInput, {
    mode: 'detect',
    maxProcessingDimension: 800,
    // Balanced thresholds: low enough to catch faint edges, high enough to reject noise
    lowThreshold: 25,
    highThreshold: 75,
    // Larger dilation kernel to bridge edge gaps on light backgrounds
    dilationKernelSize: 7,
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
  if (!initialized) {
    throw new Error('Scanic not initialized')
  }

  const options: ScanOptions = {
    mode: 'extract',
    output: 'canvas',
    maxProcessingDimension: 1600,
  }

  // If corners are provided, use the native extractDocument function 
  // which skips detection and uses corners directly for perspective warp.
  if (corners && extractFn) {
    const denormalizedCorners = {
      topLeft: { x: corners.topLeft.x * canvas.width, y: corners.topLeft.y * canvas.height },
      topRight: { x: corners.topRight.x * canvas.width, y: corners.topRight.y * canvas.height },
      bottomRight: { x: corners.bottomRight.x * canvas.width, y: corners.bottomRight.y * canvas.height },
      bottomLeft: { x: corners.bottomLeft.x * canvas.width, y: corners.bottomLeft.y * canvas.height },
    }

    const ex = extractFn as (
      image: HTMLCanvasElement,
      corners: { topLeft: Corner; topRight: Corner; bottomRight: Corner; bottomLeft: Corner },
      options: ScanOptions
    ) => Promise<ScanResult>

    return ex(canvas, denormalizedCorners, options)
  }

  // Fallback to scan() if corners aren't provided 
  // (though in this app they usually are from the UI)
  if (scanner) {
    const s = scanner as {
      scan(
        input: HTMLCanvasElement,
        options: ScanOptions
      ): Promise<ScanResult>
    }
    return s.scan(canvas, options)
  }

  throw new Error('Scanner or extract function not available')
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
