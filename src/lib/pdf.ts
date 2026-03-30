import { jsPDF } from 'jspdf'

/**
 * Converts an image (blob URL) to a PDF Blob.
 * The PDF page size will match the image dimensions to preserve quality.
 */
export async function generatePDF(imageUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const width = img.width
        const height = img.height
        const orientation = width > height ? 'landscape' : 'portrait'
        
        // Create PDF with custom size matching the image
        // Using 'px' units and passing the exact dimensions
        const pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling']
        })

        // Add image to fill the entire page
        pdf.addImage(img, 'JPEG', 0, 0, width, height)
        
        const blob = pdf.output('blob')
        resolve(blob)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image for PDF generation'))
    img.src = imageUrl
  })
}

/**
 * Shares a PDF file using the Web Share API if supported.
 */
export async function shareFile(blob: Blob, fileName: string): Promise<boolean> {
  if (!navigator.share) return false

  try {
    const file = new File([blob], fileName, { type: 'application/pdf' })
    
    // Check if the browser supports sharing this specific file
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false
    }

    await navigator.share({
      files: [file],
      title: fileName,
    })
    return true
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Sharing failed:', err)
    }
    return false
  }
}
