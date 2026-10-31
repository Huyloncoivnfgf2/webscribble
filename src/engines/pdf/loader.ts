/**
 * PDF Document Loader (TASK-06A): mở tài liệu PDF bằng PDF.js, đọc
 * metadata và thông tin trang, quản lý vòng đời tài liệu. CHƯA
 * render — render thuộc TASK-06B (qua `getNativePage`).
 *
 * Quy ước:
 * - Index trang ở API này là ZERO-BASED (thống nhất với quy ước
 *   surfaceId của TASK-08A); PDF.js dùng 1-based ở bên trong.
 * - Dữ liệu nguồn không bị biến đổi: Blob chỉ được đọc qua
 *   arrayBuffer(); ArrayBuffer/Uint8Array do caller đưa vào được
 *   SAO CHÉP trước khi giao cho PDF.js (PDF.js có thể transfer và
 *   detach buffer nó nhận — bản sao bảo vệ dữ liệu của caller, ví
 *   dụ Blob gốc trong DocumentRepository không bao giờ bị chạm vào).
 * - Đóng tài liệu = destroy loading task: giải phóng document và
 *   worker riêng của task; gọi close nhiều lần an toàn.
 */
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import {
  PdfLoadError,
  PdfPageIndexError,
  classifyPdfError,
  hasPdfSignature,
} from './errors'
import { ensurePdfjsConfigured, pdfjsLib } from './pdfjs'

export interface PdfMetadata {
  title: string | null
  author: string | null
  subject: string | null
  creator: string | null
  producer: string | null
  /** Phiên bản PDF (ví dụ "1.4") nếu PDF.js cung cấp. */
  pdfVersion: string | null
  pageCount: number
}

export interface PdfPageInfo {
  /** Chỉ số trang zero-based. */
  index: number
  /** Kích thước trang theo điểm PDF (viewport tại scale 1, đã gồm rotation). */
  width: number
  height: number
  /** Góc xoay của trang: 0/90/180/270. */
  rotation: number
}

export interface PdfDocumentHandle {
  readonly pageCount: number
  readonly metadata: PdfMetadata
  readonly closed: boolean
  /** Thông tin trang theo index zero-based. */
  getPage(index: number): Promise<PdfPageInfo>
  /**
   * Trang native của PDF.js — điểm truy cập dành cho TASK-06B
   * (render). Tầng UI không nên dùng trực tiếp.
   */
  getNativePage(index: number): Promise<PDFPageProxy>
  /** Đóng tài liệu và giải phóng tài nguyên; gọi lại là no-op. */
  close(): Promise<void>
}

export type PdfSource = Blob | ArrayBuffer | Uint8Array

export interface OpenPdfOptions {
  /** Hủy việc mở tài liệu đang diễn ra (loading task bị destroy). */
  signal?: AbortSignal
}

async function sourceToBytes(source: PdfSource): Promise<Uint8Array> {
  if (source instanceof Blob) {
    // arrayBuffer() của Blob là bản dữ liệu mới mỗi lần đọc — giao
    // thẳng cho PDF.js, Blob gốc (vd trong DocumentRepository) không
    // bị ảnh hưởng kể cả khi PDF.js detach buffer này.
    return new Uint8Array(await source.arrayBuffer())
  }
  if (source instanceof Uint8Array) {
    return new Uint8Array(source) // sao chép — bảo vệ buffer của caller
  }
  return new Uint8Array(new Uint8Array(source)) // ArrayBuffer: sao chép tương tự
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

class PdfDocumentHandleImpl implements PdfDocumentHandle {
  readonly pageCount: number
  readonly metadata: PdfMetadata
  private readonly loadingTask: PDFDocumentLoadingTask
  private readonly document: PDFDocumentProxy
  private readonly pageCache = new Map<number, Promise<PDFPageProxy>>()
  private closedFlag = false

  constructor(
    loadingTask: PDFDocumentLoadingTask,
    document: PDFDocumentProxy,
    metadata: PdfMetadata,
  ) {
    this.loadingTask = loadingTask
    this.document = document
    this.pageCount = document.numPages
    this.metadata = metadata
  }

  get closed(): boolean {
    return this.closedFlag
  }

  async getNativePage(index: number): Promise<PDFPageProxy> {
    this.assertOpen()
    if (!Number.isInteger(index) || index < 0 || index >= this.pageCount) {
      throw new PdfPageIndexError(index, this.pageCount)
    }
    let cached = this.pageCache.get(index)
    if (cached === undefined) {
      cached = this.document.getPage(index + 1) // PDF.js dùng 1-based
      this.pageCache.set(index, cached)
    }
    return cached
  }

  async getPage(index: number): Promise<PdfPageInfo> {
    const page = await this.getNativePage(index)
    const viewport = page.getViewport({ scale: 1 })
    return { index, width: viewport.width, height: viewport.height, rotation: page.rotate }
  }

  async close(): Promise<void> {
    if (this.closedFlag) return
    this.closedFlag = true
    this.pageCache.clear()
    await this.loadingTask.destroy()
  }

  private assertOpen(): void {
    if (this.closedFlag) {
      throw new PdfLoadError('closed', 'This PDF document has been closed.')
    }
  }
}

/**
 * Mở một tài liệu PDF. Mọi lỗi đều là PdfLoadError đã phân loại
 * (không phải PDF, hỏng, có mật khẩu, bị hủy, lỗi worker...).
 */
export async function openPdfDocument(
  source: PdfSource,
  options: OpenPdfOptions = {},
): Promise<PdfDocumentHandle> {
  ensurePdfjsConfigured()
  const { signal } = options
  if (signal?.aborted) {
    throw new PdfLoadError('cancelled', 'PDF loading was cancelled before it started.')
  }

  const data = await sourceToBytes(source)
  if (signal?.aborted) {
    throw new PdfLoadError('cancelled', 'PDF loading was cancelled before it started.')
  }
  if (!hasPdfSignature(data)) {
    throw new PdfLoadError('not-a-pdf', 'The provided data is not a PDF file (missing %PDF- signature).')
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    // Lưu ý: pdfjs-dist v6 không còn tùy chọn isEvalSupported (đã bị
    // gỡ vì PDF.js không còn đường eval để tắt) — không có gì phải cấu
    // hình thêm về mặt này.
  })

  const abortListener = () => {
    void loadingTask.destroy()
  }
  signal?.addEventListener('abort', abortListener, { once: true })
  try {
    const document = await loadingTask.promise
    if (signal?.aborted) {
      await loadingTask.destroy()
      throw new PdfLoadError('cancelled', 'PDF loading was cancelled.')
    }
    const rawMetadata = await document.getMetadata()
    const info = (rawMetadata.info ?? {}) as Record<string, unknown>
    const metadata: PdfMetadata = {
      title: asStringOrNull(info.Title),
      author: asStringOrNull(info.Author),
      subject: asStringOrNull(info.Subject),
      creator: asStringOrNull(info.Creator),
      producer: asStringOrNull(info.Producer),
      pdfVersion: asStringOrNull(info.PDFFormatVersion),
      pageCount: document.numPages,
    }
    return new PdfDocumentHandleImpl(loadingTask, document, metadata)
  } catch (error) {
    // Nếu lỗi không phải do chính handle quản lý, bảo đảm loading
    // task không chạy ngầm: destroy là idempotent ở phía PDF.js.
    if (error instanceof PdfLoadError) throw error
    void loadingTask.destroy().catch(() => undefined)
    if (signal?.aborted) {
      throw new PdfLoadError('cancelled', 'PDF loading was cancelled.', { cause: error })
    }
    throw classifyPdfError(error)
  } finally {
    signal?.removeEventListener('abort', abortListener)
  }
}
