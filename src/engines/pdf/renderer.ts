/**
 * PDF Page Renderer (TASK-06B): render một trang PDF lên canvas
 * bằng PDF.js, tách kích thước vật lý (bitmap) khỏi kích thước CSS
 * hiển thị qua devicePixelRatio, và quản lý vòng đời render.
 *
 * Nguyên tắc:
 * - Hệ tọa độ kết quả là CSS pixel: canvas.style luôn là kích
 *   thước viewport tại scale yêu cầu; bitmap canvas được nhân
 *   devicePixelRatio và PDF.js nhận `transform` tương ứng để vẽ
 *   sắc nét trên màn hình HiDPI.
 * - Mỗi PdfPageRenderer có registry render đang chạy theo canvas
 *   (WeakMap nội bộ của instance — không global state). Render
 *   mới trên cùng một canvas sẽ HỦY render cũ và CHỜ nó kết thúc
 *   hẳn rồi mới vẽ, nên render cũ không bao giờ ghi đè render mới.
 * - Hủy: `cancel(canvas)` / `cancelAll()`. Promise của render bị
 *   hủy luôn reject PdfRenderError kind 'cancelled'.
 * - Lỗi của loader (tài liệu đóng, index sai) được truyền NGUYÊN
 *   VẸN (PdfLoadError / PdfPageIndexError); lỗi render của PDF.js
 *   được gói PdfRenderError kind 'render-failed' kèm cause.
 * - Tài liệu bị đóng giữa lúc render: PDF.js tự hủy render task
 *   khi loading task destroy → bề mặt thành 'cancelled'.
 */
import type { PageViewport, RenderTask } from 'pdfjs-dist'
import {
  PdfLoadError,
  PdfPageIndexError,
  PdfRenderError,
  isRenderingCancelledError,
} from './errors'
import { assertValidScale } from './geometry'
import type { PdfDocumentHandle } from './loader'

export interface PdfPageRenderOptions {
  /** Scale hiển thị (mặc định 1). */
  scale?: number
  /**
   * Tỉ lệ điểm ảnh thiết bị. Mặc định lấy từ
   * `globalThis.devicePixelRatio` (1 nếu môi trường không có).
   */
  devicePixelRatio?: number
  /** Màu nền truyền cho PDF.js (tùy chọn). */
  background?: string
}

export interface PdfPageRenderResult {
  index: number
  scale: number
  rotation: number
  /** Kích thước hiển thị CSS (px) — bằng viewport tại scale. */
  cssWidth: number
  cssHeight: number
  /** Kích thước bitmap vật lý của canvas (đã nhân devicePixelRatio). */
  pixelWidth: number
  pixelHeight: number
  devicePixelRatio: number
  /** Viewport PDF.js tại scale yêu cầu (cho TASK-06D dùng tiếp). */
  viewport: PageViewport
}

interface ActiveRender {
  cancelRequested: boolean
  task: RenderTask | null
  settled: Promise<void>
  settle: () => void
  cancel: () => void
}

function resolveDevicePixelRatio(explicit: number | undefined): number {
  const value =
    explicit ??
    (typeof globalThis !== 'undefined' && typeof globalThis.devicePixelRatio === 'number'
      ? globalThis.devicePixelRatio
      : 1)
  if (!Number.isFinite(value) || value <= 0) {
    throw new PdfRenderError(
      'invalid-argument',
      `Invalid devicePixelRatio ${String(value)}: must be a positive finite number.`,
    )
  }
  return value
}

function assertCanvas(canvas: HTMLCanvasElement): void {
  const candidate = canvas as Partial<HTMLCanvasElement> | null | undefined
  if (
    candidate === null ||
    candidate === undefined ||
    typeof candidate.width !== 'number' ||
    typeof candidate.height !== 'number' ||
    typeof candidate.style !== 'object' ||
    candidate.style === null
  ) {
    throw new PdfRenderError(
      'invalid-argument',
      'renderPdfPage requires a valid HTMLCanvasElement.',
    )
  }
}

export class PdfPageRenderer {
  private readonly active = new WeakMap<HTMLCanvasElement, ActiveRender>()
  private readonly activeSet = new Set<ActiveRender>()

  /**
   * Render một trang lên canvas. Entry được ghi vào registry NGAY
   * khi gọi (đồng bộ) nên cancel() gọi ngay sau đó vẫn có tác dụng.
   */
  render(
    handle: PdfDocumentHandle,
    index: number,
    canvas: HTMLCanvasElement,
    options: PdfPageRenderOptions = {},
  ): Promise<PdfPageRenderResult> {
    // Canvas được kiểm tra TRƯỚC khi dùng làm khóa WeakMap — canvas
    // null/không hợp lệ phải nhận PdfRenderError, không phải
    // TypeError thô của WeakMap.
    try {
      assertCanvas(canvas)
    } catch (error) {
      return Promise.reject(error)
    }
    let settleFn: () => void = () => undefined
    const settled = new Promise<void>((resolve) => {
      settleFn = resolve
    })
    const entry: ActiveRender = {
      cancelRequested: false,
      task: null,
      settled,
      settle: settleFn,
      cancel: () => {
        entry.cancelRequested = true
        entry.task?.cancel()
      },
    }
    const previous = this.active.get(canvas)
    this.active.set(canvas, entry)
    this.activeSet.add(entry)
    return this.run(handle, index, canvas, options, entry, previous).finally(() => {
      if (this.active.get(canvas) === entry) this.active.delete(canvas)
      this.activeSet.delete(entry)
      entry.settle()
    })
  }

  /** Hủy render đang chạy trên canvas này (không có thì là no-op). */
  cancel(canvas: HTMLCanvasElement): void {
    this.active.get(canvas)?.cancel()
  }

  /** Hủy mọi render đang chạy của renderer này. */
  cancelAll(): void {
    for (const entry of [...this.activeSet]) entry.cancel()
  }

  /** Dọn dẹp: hủy tất cả; gọi nhiều lần an toàn. */
  dispose(): void {
    this.cancelAll()
  }

  /** Có render nào đang chạy trên canvas này không. */
  isRendering(canvas: HTMLCanvasElement): boolean {
    return this.active.has(canvas)
  }

  private async run(
    handle: PdfDocumentHandle,
    index: number,
    canvas: HTMLCanvasElement,
    options: PdfPageRenderOptions,
    entry: ActiveRender,
    previous: ActiveRender | undefined,
  ): Promise<PdfPageRenderResult> {
    assertCanvas(canvas)
    const scale = options.scale ?? 1
    assertValidScale(scale)
    const devicePixelRatio = resolveDevicePixelRatio(options.devicePixelRatio)

    // Render cũ trên cùng canvas phải kết thúc hẳn trước khi ta
    // chạm vào canvas, nếu không PDF.js có thể vẽ lẫn hai lượt.
    if (previous !== undefined) {
      previous.cancel()
      await previous.settled
    }
    if (entry.cancelRequested) {
      throw new PdfRenderError('cancelled', 'PDF page render was cancelled.')
    }

    // Lỗi của loader (đã đóng/index sai) truyền nguyên vẹn. Lỗi
    // THÔ của PDF.js ở bước lấy trang (ví dụ transport bị destroy
    // vì tài liệu đóng giữa chừng) được phân loại tại đây — không
    // để lỗi không-định-dạng thoát ra khỏi renderer.
    let page: Awaited<ReturnType<PdfDocumentHandle['getNativePage']>>
    try {
      page = await handle.getNativePage(index)
    } catch (error) {
      if (error instanceof PdfLoadError || error instanceof PdfPageIndexError) throw error
      if (entry.cancelRequested || isRenderingCancelledError(error) || handle.closed) {
        throw new PdfRenderError('cancelled', 'PDF page render was cancelled.', { cause: error })
      }
      throw new PdfRenderError('render-failed', `PDF.js failed to load page ${index} for rendering.`, {
        cause: error,
      })
    }
    if (entry.cancelRequested) {
      throw new PdfRenderError('cancelled', 'PDF page render was cancelled.')
    }

    const viewport = page.getViewport({ scale })
    const cssWidth = viewport.width
    const cssHeight = viewport.height
    const pixelWidth = Math.max(1, Math.round(cssWidth * devicePixelRatio))
    const pixelHeight = Math.max(1, Math.round(cssHeight * devicePixelRatio))
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const task = page.render({
      canvas,
      viewport,
      transform: devicePixelRatio !== 1 ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] : undefined,
      background: options.background,
    })
    entry.task = task
    if (entry.cancelRequested) task.cancel()

    try {
      await task.promise
    } catch (error) {
      if (entry.cancelRequested || isRenderingCancelledError(error)) {
        throw new PdfRenderError('cancelled', 'PDF page render was cancelled.', { cause: error })
      }
      throw new PdfRenderError('render-failed', `PDF.js failed to render page ${index}.`, {
        cause: error,
      })
    }
    if (entry.cancelRequested) {
      throw new PdfRenderError('cancelled', 'PDF page render was cancelled.')
    }
    return {
      index,
      scale,
      rotation: viewport.rotation,
      cssWidth,
      cssHeight,
      pixelWidth,
      pixelHeight,
      devicePixelRatio,
      viewport,
    }
  }
}

/** Tạo một renderer mới (mỗi viewer nên giữ một instance riêng). */
export function createPdfPageRenderer(): PdfPageRenderer {
  return new PdfPageRenderer()
}
