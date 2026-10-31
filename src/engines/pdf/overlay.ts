/**
 * PDF Annotation Overlay (TASK-06D): lớp tích hợp hiển thị
 * annotation của một trang PDF trên canvas TRONG SUỐT riêng, đặt
 * trùng khít lên canvas PDF.
 *
 * Cách tích hợp (từ audit source TASK-06D):
 * - PDF được vẽ bởi PdfPageRenderer của TASK-06B lên canvas PDF;
 *   overlay không bao giờ vẽ lên canvas đó.
 * - Annotation được vẽ bởi CanvasRenderer của chính Drawing
 *   Engine lên canvas overlay: nó tự xóa trong suốt (chỉ
 *   clearRect), tự nhân bitmap theo DPR và vẽ mọi object qua
 *   camera. Camera của overlay luôn là { x: 0, y: 0, zoom: scale }
 *   vì world của trang được định nghĩa là khung trang đã hiển
 *   thị tại scale 1 (= viewport scale 1 của PDF.js) — xem
 *   annotationMapping.ts. Nhờ vậy annotation bám đúng nội dung
 *   PDF ở mọi scale và mọi rotation mà không cần biến đổi riêng.
 * - Overlay đồng bộ với dữ liệu qua subscription trên
 *   NotifyingSurface của session (TASK-06C): thêm/sửa/xóa/
 *   undo/redo đều tự vẽ lại, không polling. Session đóng → lần
 *   thay đổi kế tiếp (hoặc lần render kế tiếp) sẽ tự dispose
 *   overlay.
 */
import { CanvasRenderer, type CanvasLike } from '../drawing/canvasRenderer'
import type { Camera } from '../drawing/coordinates'
import type { AnnotationSurfaceSession } from '../annotation/annotationEngine'
import { NotifyingSurface } from '../annotation/notifyingSurface'
import { createPdfAnnotationMapping, type PdfAnnotationMapping } from './annotationMapping'
import { assertValidScale } from './geometry'
import type { PdfDocumentHandle } from './loader'
import { PdfPageRenderer, type PdfPageRenderResult } from './renderer'

export type PdfAnnotationOverlayErrorKind = 'disposed' | 'session-closed' | 'invalid-argument'

export class PdfAnnotationOverlayError extends Error {
  readonly kind: PdfAnnotationOverlayErrorKind

  constructor(kind: PdfAnnotationOverlayErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfAnnotationOverlayError'
    this.kind = kind
  }
}

export interface PdfAnnotationOverlayOptions {
  handle: PdfDocumentHandle
  pageIndex: number
  session: AnnotationSurfaceSession
  pdfCanvas: HTMLCanvasElement
  annotationCanvas: HTMLCanvasElement
  /** Scale ban đầu (mặc định 1). */
  scale?: number
  /**
   * DPR cố định; bỏ trống thì đọc trực tiếp từ môi trường mỗi lần
   * dùng (window.devicePixelRatio).
   */
  devicePixelRatio?: number
  /** Tiêm PdfPageRenderer riêng nếu cần (mặc định tự tạo). */
  pdfRenderer?: PdfPageRenderer
  /** Tiêm frame scheduler cho CanvasRenderer (kiểm thử). */
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
  /**
   * Ai sở hữu việc VẼ lớp annotation lên annotationCanvas:
   * - 'managed' (mặc định): overlay tự vẽ bằng CanvasRenderer
   *   của nó — dùng khi không có tương tác.
   * - 'external': overlay chỉ render PDF, đặt kích thước CSS
   *   và cung cấp mapping; việc vẽ annotation do một
   *   DrawingEngine gắn trên cùng canvas đảm nhiệm. Khi có
   *   tương tác, canvas annotation phải có MỘT chủ render duy
   *   nhất: hai CanvasRenderer độc lập sẽ cùng clear/vẽ lại
   *   toàn cảnh trên cùng một canvas theo hai hàng đợi rAF
   *   riêng — khung hình preview/con trỏ công cụ của engine
   *   có thể bị lần vẽ của renderer còn lại xóa giữa chừng,
   *   và mọi thay đổi bị vẽ hai lần vô ích (TASK-06E).
   */
  annotationRendering?: 'managed' | 'external'
}

function assertCanvasLike(canvas: HTMLCanvasElement, role: string): void {
  const candidate = canvas as Partial<HTMLCanvasElement> | null | undefined
  if (
    candidate === null ||
    candidate === undefined ||
    typeof candidate.width !== 'number' ||
    typeof candidate.style !== 'object' ||
    candidate.style === null
  ) {
    throw new PdfAnnotationOverlayError(
      'invalid-argument',
      `PdfAnnotationOverlay requires a valid canvas for ${role}.`,
    )
  }
}

export class PdfAnnotationOverlay {
  private readonly handle: PdfDocumentHandle
  private readonly pageIndex: number
  private readonly session: AnnotationSurfaceSession
  private readonly pdfCanvas: HTMLCanvasElement
  private readonly annotationCanvas: HTMLCanvasElement
  private readonly pdfRenderer: PdfPageRenderer
  private readonly annotationRenderer: CanvasRenderer | null
  private readonly camera: Camera
  private currentScale: number
  private explicitDpr: number | undefined
  private currentMapping: PdfAnnotationMapping | null = null
  private unsubscribe: (() => void) | null = null
  private disposedFlag = false

  constructor(options: PdfAnnotationOverlayOptions) {
    assertCanvasLike(options.pdfCanvas, 'the PDF page')
    assertCanvasLike(options.annotationCanvas, 'the annotation layer')
    const scale = options.scale ?? 1
    assertValidScale(scale)
    if (options.devicePixelRatio !== undefined) {
      if (!Number.isFinite(options.devicePixelRatio) || options.devicePixelRatio <= 0) {
        throw new PdfAnnotationOverlayError(
          'invalid-argument',
          `Invalid devicePixelRatio ${String(options.devicePixelRatio)}.`,
        )
      }
    }
    this.handle = options.handle
    this.pageIndex = options.pageIndex
    this.session = options.session
    this.pdfCanvas = options.pdfCanvas
    this.annotationCanvas = options.annotationCanvas
    this.pdfRenderer = options.pdfRenderer ?? new PdfPageRenderer()
    this.currentScale = scale
    this.explicitDpr = options.devicePixelRatio
    this.camera = { x: 0, y: 0, zoom: scale }

    this.annotationRenderer =
      options.annotationRendering === 'external'
        ? null
        : new CanvasRenderer({
            // CanvasRenderer khai báo giao diện canvas tối thiểu của
            // riêng nó (CanvasLike); HTMLCanvasElement thỏa mãn về cấu
            // trúc khi gọi getContext('2d') nhưng chữ ký overload của
            // DOM không khớp trực tiếp — ép kiểu tại biên này.
            canvas: this.annotationCanvas as unknown as CanvasLike,
            getObjects: () => this.session.surface.listObjects(),
            getCamera: () => this.camera,
            getDevicePixelRatio: () => this.effectiveDpr(),
            requestFrame: options.requestFrame,
            cancelFrame: options.cancelFrame,
          })

    // Đồng bộ thay đổi annotation → vẽ lại (không polling). Surface
    // của session là NotifyingSurface (TASK-06C); nếu caller đưa
    // session lạ không có cơ chế thông báo, overlay vẫn hoạt động
    // ở chế độ render thủ công qua render()/refreshAnnotations().
    // Ở chế độ 'external', subscription chỉ còn giữ vai trò bảo
    // vệ vòng đời (tự dispose khi session đóng) — việc vẽ do
    // DrawingEngine bên ngoài đảm nhiệm.
    const surface = this.session.surface
    if (surface instanceof NotifyingSurface) {
      this.unsubscribe = surface.subscribe(() => {
        if (this.disposedFlag) return
        if (this.session.closed) {
          this.dispose()
          return
        }
        this.annotationRenderer?.requestRender()
      })
    }
  }

  get disposed(): boolean {
    return this.disposedFlag
  }

  get scale(): number {
    return this.currentScale
  }

  /** Mapping tọa độ của lần render gần nhất (null nếu chưa render). */
  get mapping(): PdfAnnotationMapping | null {
    return this.currentMapping
  }

  /**
   * Render PDF (lên canvas PDF) và annotation (lên canvas
   * overlay) tại scale hiện tại. Trả kết quả render PDF của
   * TASK-06B.
   */
  async render(): Promise<PdfPageRenderResult> {
    this.assertUsable()
    const result = await this.pdfRenderer.render(this.handle, this.pageIndex, this.pdfCanvas, {
      scale: this.currentScale,
      devicePixelRatio: this.explicitDpr,
    })
    if (this.disposedFlag) return result
    this.currentMapping = createPdfAnnotationMapping(result.viewport, {
      devicePixelRatio: this.effectiveDpr(),
    })
    this.annotationCanvas.style.width = `${result.viewport.width}px`
    this.annotationCanvas.style.height = `${result.viewport.height}px`
    if (this.annotationRenderer !== null) {
      this.annotationRenderer.resize(result.viewport.width, result.viewport.height)
      this.annotationRenderer.renderNow()
    }
    return result
  }

  /** Đổi scale: cập nhật camera + kích thước và render lại cả hai lớp. */
  async setScale(scale: number): Promise<PdfPageRenderResult> {
    assertValidScale(scale)
    this.currentScale = scale
    this.camera.zoom = scale
    return this.render()
  }

  /**
   * Đổi DPR (ví dụ chuyển màn hình): chỉ bitmap và transform thay
   * đổi — dữ liệu annotation và hệ tọa độ CSS giữ nguyên.
   */
  async setDevicePixelRatio(devicePixelRatio: number): Promise<PdfPageRenderResult> {
    if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
      throw new PdfAnnotationOverlayError(
        'invalid-argument',
        `Invalid devicePixelRatio ${String(devicePixelRatio)}.`,
      )
    }
    this.explicitDpr = devicePixelRatio
    return this.render()
  }

  /**
   * Vẽ lại riêng lớp annotation từ dữ liệu hiện tại. Ở chế độ
   * 'external' hàm này không làm gì — DrawingEngine bên ngoài
   * tự vẽ lại khi dữ liệu đổi.
   */
  refreshAnnotations(): void {
    if (this.disposedFlag) return
    this.annotationRenderer?.renderNow()
  }

  /** Hủy lượt render PDF đang chạy (nếu có). */
  cancel(): void {
    this.pdfRenderer.cancel(this.pdfCanvas)
  }

  /** Hủy subscription, dọn renderer; gọi nhiều lần an toàn. */
  dispose(): void {
    if (this.disposedFlag) return
    this.disposedFlag = true
    this.unsubscribe?.()
    this.unsubscribe = null
    this.annotationRenderer?.dispose()
    this.pdfRenderer.cancel(this.pdfCanvas)
  }

  private effectiveDpr(): number {
    if (this.explicitDpr !== undefined) return this.explicitDpr
    const dpr = (globalThis as { devicePixelRatio?: unknown }).devicePixelRatio
    return typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  }

  private assertUsable(): void {
    if (this.disposedFlag) {
      throw new PdfAnnotationOverlayError('disposed', 'This PDF annotation overlay has been disposed.')
    }
    if (this.session.closed) {
      this.dispose()
      throw new PdfAnnotationOverlayError(
        'session-closed',
        'The annotation session is closed; the overlay has been disposed.',
      )
    }
  }
}

/** Tạo overlay cho một trang PDF và session annotation của nó. */
export function createPdfAnnotationOverlay(
  options: PdfAnnotationOverlayOptions,
): PdfAnnotationOverlay {
  return new PdfAnnotationOverlay(options)
}
