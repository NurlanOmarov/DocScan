/**
 * Perspective translation utility using homography.
 * Provides a pure JS implementation of a 4-point perspective transform.
 */

interface Point {
  x: number
  y: number
}

interface Corners {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

/**
 * Solves a linear system of equations using Gaussian elimination.
 * Ax = b
 */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(A[i][i])
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i])
        maxRow = k
      }
    }

    // Swap maximum row with current row
    const tmpA = A[maxRow]
    A[maxRow] = A[i]
    A[i] = tmpA
    const tmpB = b[maxRow]
    b[maxRow] = b[i]
    b[i] = tmpB

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i]
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0
        } else {
          A[k][j] += c * A[i][j]
        }
      }
      b[k] += c * b[i]
    }
  }

  // Solve equation Ax=b for upper triangular matrix
  const x = new Array(n).fill(0)
  for (let i = n - 1; i > -1; i--) {
    x[i] = b[i] / A[i][i]
    for (let k = i - 1; k > -1; k--) {
      b[k] -= A[k][i] * x[i]
    }
  }
  return x
}

/**
 * Calculates the homography matrix coefficients for a 4-point transform.
 * Maps (x,y) coordinates to (u,v) coordinates.
 */
export function getHomographyMatrix(src: Point[], dst: Point[]): number[] {
  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    b.push(u)
    b.push(v)
  }

  const h = solve(A, b)
  h.push(1) // h8 is 1
  return h
}

/**
 * Performs a perspective transform on a source canvas and returns a new canvas.
 * This is a "dumb" transform: it exactly follows the 4 provided points.
 */
export async function transformPerspective(
  source: HTMLCanvasElement | ImageData,
  corners: Corners,
  targetWidth?: number,
  targetHeight?: number
): Promise<HTMLCanvasElement> {
  const srcWidth = source instanceof HTMLCanvasElement ? source.width : source.width
  const srcHeight = source instanceof HTMLCanvasElement ? source.height : source.height

  // 1. Determine target dimensions based on average edge lengths if not provided
  const w1 = Math.hypot(corners.topRight.x - corners.topLeft.x, corners.topRight.y - corners.topLeft.y)
  const w2 = Math.hypot(corners.bottomRight.x - corners.bottomLeft.x, corners.bottomRight.y - corners.bottomLeft.y)
  const h1 = Math.hypot(corners.bottomLeft.x - corners.topLeft.x, corners.bottomLeft.y - corners.topLeft.y)
  const h2 = Math.hypot(corners.bottomRight.x - corners.topRight.x, corners.bottomRight.y - corners.topRight.y)

  const tw = targetWidth || Math.round((w1 + w2) / 2)
  const th = targetHeight || Math.round((h1 + h2) / 2)

  const output = document.createElement('canvas')
  output.width = tw
  output.height = th
  const ctx = output.getContext('2d')!

  const srcImg = document.createElement('canvas')
  srcImg.width = srcWidth
  srcImg.height = srcHeight
  const srcCtx = srcImg.getContext('2d', { willReadFrequently: true })!
  if (source instanceof HTMLCanvasElement) {
    srcCtx.drawImage(source, 0, 0)
  } else {
    srcCtx.putImageData(source, 0, 0)
  }

  // Calculate homography matrix: maps destination (0..tw, 0..th) back to source points
  const dstPts = [
    { x: 0, y: 0 },
    { x: tw, y: 0 },
    { x: tw, y: th },
    { x: 0, y: th },
  ]
  const srcPts = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ]

  // We want to map EACH pixel of the output back to the source image.
  // Homography(dst -> src)
  const h = getHomographyMatrix(dstPts, srcPts)

  // For high performance and standard Canvas API, we use triangle subdivision.
  // We split the output into a grid and use setTransform for each affine triangle.
  const GRID_SIZE = 16 // 16x16 grid for smooth perspective
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      // Current grid cell in destination
      const u0 = (gx / GRID_SIZE) * tw
      const v0 = (gy / GRID_SIZE) * th
      const u1 = ((gx + 1) / GRID_SIZE) * tw
      const v1 = ((gy + 1) / GRID_SIZE) * th

      // Map 4 corners of the cell back to source using homography
      const map = (u: number, v: number) => {
        const w = h[6] * u + h[7] * v + h[8]
        return {
          x: (h[0] * u + h[1] * v + h[2]) / w,
          y: (h[3] * u + h[4] * v + h[5]) / w,
        }
      }

      const p00 = map(u0, v0)
      const p10 = map(u1, v0)
      const p01 = map(u0, v1)
      const p11 = map(u1, v1)

      // Draw two triangles for this grid cell
      drawTriangle(ctx, srcImg, u0, v0, u1, v0, u0, v1, p00.x, p00.y, p10.x, p10.y, p01.x, p01.y)
      drawTriangle(ctx, srcImg, u1, v1, u0, v1, u1, v0, p11.x, p11.y, p01.x, p01.y, p10.x, p10.y)
    }
  }

  return output
}

/**
 * Draws a source triangle to a destination triangle using affine transform.
 */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  u0: number, v0: number, u1: number, v1: number, u2: number, v2: number
) {
  ctx.save()

  // Create clipping path
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.closePath()
  ctx.clip()

  // Compute affine transform: maps (u,v) -> (x,y)
  // Linear system:
  // u0*a + v0*b + c = x0
  // u1*a + v1*b + c = x1
  // u2*a + v2*b + c = x2
  const det = (u0 - u2) * (v1 - v2) - (u1 - u2) * (v0 - v2)
  const a = ((x0 - x2) * (v1 - v2) - (x1 - x2) * (v0 - v2)) / det
  const b = ((u0 - u2) * (x1 - x2) - (u1 - u2) * (x0 - x2)) / det
  const c = x0 - u0 * a - v0 * b

  const d = ((y0 - y2) * (v1 - v2) - (y1 - y2) * (v0 - v2)) / det
  const e = ((u0 - u2) * (y1 - y2) - (u1 - u2) * (y0 - y2)) / det
  const f = y0 - u0 * d - v0 * e

  ctx.setTransform(a, d, b, e, c, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}
