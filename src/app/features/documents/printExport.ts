/**
 * In / lưu PDF kèm chú thích (TASK-07E, DEC-030): dùng cơ
 * chế in của chính trình duyệt (người dùng chọn "Lưu thành
 * PDF" trong hộp thoại in) thay vì sinh PDF bằng thư viện —
 * bản in gồm văn bản vector của editor + ảnh chụp canvas
 * chú thích ở độ phân giải bitmap thật (CSS × DPR) chèn
 * thay canvas trong lúc in (canvas sống in không ổn định
 * trên một số trình duyệt, ảnh thì luôn được).
 *
 * Việc sinh file PDF bằng code (pdf-lib) thuộc phạm vi
 * Export Engine của TASK-09 — không gộp vào task này.
 */

export interface PrintableCanvasLike {
  width: number
  height: number
  toDataURL: (type: string) => string
}

export interface AnnotationPrintImage {
  src: string
  bitmapWidth: number
  bitmapHeight: number
}

/** Chụp canvas chú thích thành ảnh in. Canvas rỗng/không hợp lệ → null. */
export function buildAnnotationPrintImage(
  canvas: PrintableCanvasLike,
): AnnotationPrintImage | null {
  if (!(canvas.width > 0) || !(canvas.height > 0)) return null
  let src: string
  try {
    src = canvas.toDataURL('image/png')
  } catch {
    return null
  }
  if (typeof src !== 'string' || !src.startsWith('data:image/png')) return null
  return { src, bitmapWidth: canvas.width, bitmapHeight: canvas.height }
}

/**
 * Chuẩn bị bản in (chèn ảnh chú thích + bật lớp CSS in) rồi
 * mở hộp thoại in của trình duyệt. Trả false nếu không lấy
 * được ảnh chú thích — caller vẫn có thể in nội dung thường.
 */
export function printWithAnnotations(card: HTMLElement, canvas: HTMLCanvasElement): boolean {
  const image = buildAnnotationPrintImage(canvas)
  if (image === null) return false
  const img = document.createElement('img')
  img.className = 'ws-print-annotation'
  img.src = image.src
  img.alt = ''
  img.style.position = 'absolute'
  img.style.inset = '0'
  img.style.width = '100%'
  img.style.height = '100%'
  card.appendChild(img)
  document.body.classList.add('ws-printing')
  const cleanup = () => {
    img.remove()
    document.body.classList.remove('ws-printing')
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  // Phòng thủ: afterprint không tới (một số trình duyệt di
  // động) thì tự dọn sau 60 giây để giao diện không kẹt lớp in.
  window.setTimeout(cleanup, 60_000)
  window.print()
  return true
}
