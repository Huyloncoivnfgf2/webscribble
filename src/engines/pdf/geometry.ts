/**
 * Hình học trang PDF (TASK-06B): mọi số đo đều lấy từ
 * PDF.js `getViewport()` — không tự tính hình học PDF. Hệ tọa độ
 * làm việc là CSS pixel tại scale yêu cầu (viewport của PDF.js);
 * devicePixelRatio chỉ ảnh hưởng độ phân giải raster ở tầng render,
 * KHÔNG thuộc hình học này. Chuyển đổi tọa độ annotation thuộc
 * TASK-06D — ở đây chỉ cung cấp viewport và kích thước.
 */
import type { PageViewport } from 'pdfjs-dist'
import { PdfRenderError } from './errors'
import type { PdfDocumentHandle } from './loader'

export interface PdfPageGeometry {
  /** Chỉ số trang zero-based. */
  index: number
  /** Scale của viewport được yêu cầu. */
  scale: number
  /** Góc xoay hiệu dụng của trang (0/90/180/270). */
  rotation: number
  /** Kích thước trang tại scale 1 (điểm PDF = CSS px tại scale 1). */
  pageWidth: number
  pageHeight: number
  /** Kích thước viewport tại scale yêu cầu (CSS px). */
  viewportWidth: number
  viewportHeight: number
  /** Viewport native của PDF.js tại scale yêu cầu (cho TASK-06D). */
  viewport: PageViewport
}

/** Scale phải là số hữu hạn dương — dùng chung cho geometry và render. */
export function assertValidScale(scale: number): void {
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
    throw new PdfRenderError(
      'invalid-argument',
      `Invalid scale ${String(scale)}: scale must be a positive finite number.`,
    )
  }
}

/**
 * Đọc hình học của một trang qua handle của TASK-06A. Index
 * zero-based; index sai và tài liệu đã đóng do getNativePage của
 * loader xử lý (PdfPageIndexError / PdfLoadError kind 'closed').
 */
export async function getPdfPageGeometry(
  handle: PdfDocumentHandle,
  index: number,
  scale = 1,
): Promise<PdfPageGeometry> {
  assertValidScale(scale)
  const page = await handle.getNativePage(index)
  const unitViewport = page.getViewport({ scale: 1 })
  const viewport = scale === 1 ? unitViewport : page.getViewport({ scale })
  return {
    index,
    scale,
    rotation: viewport.rotation,
    pageWidth: unitViewport.width,
    pageHeight: unitViewport.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    viewport,
  }
}
