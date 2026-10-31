/**
 * Cấu hình PDF.js (TASK-06A, DEC-016): worker được ĐÓNG GÓI CÙNG
 * ỨNG DỤNG qua Vite (`?url` trỏ vào file worker trong pdfjs-dist) —
 * không CDN, không URL ngoài. Việc cấu hình diễn ra một lần, lười
 * (lazy) tại lần mở tài liệu đầu tiên.
 *
 * Trong môi trường Node (unit test), Vitest alias 'pdfjs-dist' sang
 * bản legacy vốn tự dùng fake worker trong tiến trình, nên workerSrc
 * chỉ được đặt khi đang chạy trong trình duyệt.
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let configured = false

export function ensurePdfjsConfigured(): void {
  if (configured) return
  configured = true
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  }
}

export { pdfjsLib }
