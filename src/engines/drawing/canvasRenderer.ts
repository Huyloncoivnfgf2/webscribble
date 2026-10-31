/**
 * Canvas Renderer (TASK-05C, Phần C): quản lý việc vẽ lại toàn cảnh
 * (mọi DrawingObject dạng nét trên một Surface + nét đang vẽ dở) lên
 * một canvas, điều phối bằng requestAnimationFrame.
 *
 * Nguyên tắc:
 * - Canvas bitmap chỉ là BẢN TRÌNH DIỄN: mọi lần vẽ đều dựng lại từ
 *   dữ liệu object do tầng gọi cung cấp (`getObjects` /
 *   `getPreviewObjects`) — redraw toàn bộ từ Surface luôn khả thi,
 *   bitmap hỏng/mất không làm mất dữ liệu.
 * - `requestRender()` gộp nhiều yêu cầu trong cùng một khung hình
 *   thành MỘT lần vẽ (không render lặp vô ích); gọi sau `dispose()`
 *   là vô hiệu.
 * - Kích thước: tầng gọi khai báo kích thước CSS (`resize(cssW, cssH)`);
 *   renderer nhân với devicePixelRatio để đặt backing store, và khi vẽ
 *   dùng `setTransform(dpr, …)` để mọi tọa độ vẽ tính theo CSS px —
 *   nhờ vậy CSS size và backing-store size không bao giờ làm lệch tọa
 *   độ, nét vẫn sắc trên màn hình mật độ cao.
 * - Camera (x/y/zoom) lấy qua `getCamera()` ở mỗi lần vẽ nên pan/zoom
 *   chỉ cần `requestRender()` là có khung hình mới.
 * - Lớp này không biết Surface cụ thể là PDF/DOCX/bảng trắng (DEC-015)
 *   và render MỌI loại DrawingObject qua `drawObject` (nét viết tay từ
 *   TASK-05C; hình vector + text từ TASK-05D).
 */

import type { Camera } from './coordinates'
import type { DrawingObject } from './types'
import { drawObject, type CanvasContextLike } from './renderer'

/** Context 2D đầy đủ cho việc vẽ toàn cảnh (thêm transform + xóa). */
export interface CanvasSurfaceContextLike extends CanvasContextLike {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
  clearRect(x: number, y: number, width: number, height: number): void
}

/** Phần tối thiểu của HTMLCanvasElement mà CanvasRenderer cần. */
export interface CanvasLike {
  width: number
  height: number
  getContext(contextId: string): CanvasSurfaceContextLike | null
}

export type FrameRequester = (callback: () => void) => number
export type FrameCanceller = (handle: number) => void

export interface CanvasRendererOptions {
  canvas: CanvasLike
  /** Các object đã hoàn tất (thường là `surface.listObjects()`). */
  getObjects: () => readonly DrawingObject[]
  /** Các object xem trước (nét đang vẽ dở) — vẽ sau, ở trạng thái chưa hoàn tất. */
  getPreviewObjects?: () => readonly DrawingObject[]
  /**
   * Lớp vẽ phủ chạy SAU mọi object (vùng chọn đang kéo, khung bounds
   * của object được chọn, vòng tròn con trỏ tẩy — TASK-05E). Trả về
   * null khi không có gì để phủ.
   */
  getOverlay?: () => OverlayDrawer | null
  getCamera: () => Camera
  /** Tiêm vào khi kiểm thử; mặc định dùng requestAnimationFrame của trình duyệt. */
  requestFrame?: FrameRequester
  cancelFrame?: FrameCanceller
  /** Tiêm vào khi kiểm thử; mặc định đọc `window.devicePixelRatio`. */
  getDevicePixelRatio?: () => number
}

/** Hàm vẽ phủ: nhận context đã áp transform DPR và camera hiện tại. */
export type OverlayDrawer = (ctx: CanvasSurfaceContextLike, camera: Camera) => void

function defaultRequestFrame(callback: () => void): number {
  return globalThis.requestAnimationFrame(callback)
}

function defaultCancelFrame(handle: number): void {
  globalThis.cancelAnimationFrame(handle)
}

function defaultDevicePixelRatio(): number {
  const dpr = globalThis.devicePixelRatio
  return typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0 ? dpr : 1
}

export class CanvasRenderer {
  private readonly canvas: CanvasLike
  private readonly getObjects: () => readonly DrawingObject[]
  private readonly getPreviewObjects: (() => readonly DrawingObject[]) | undefined
  private readonly getOverlay: (() => OverlayDrawer | null) | undefined
  private readonly getCamera: () => Camera
  private readonly requestFrameFn: FrameRequester
  private readonly cancelFrameFn: FrameCanceller
  private readonly getDpr: () => number

  private pendingFrame: number | null = null
  private disposed = false
  private cssWidth = 0
  private cssHeight = 0

  constructor(options: CanvasRendererOptions) {
    this.canvas = options.canvas
    this.getObjects = options.getObjects
    this.getPreviewObjects = options.getPreviewObjects
    this.getOverlay = options.getOverlay
    this.getCamera = options.getCamera
    this.requestFrameFn = options.requestFrame ?? defaultRequestFrame
    this.cancelFrameFn = options.cancelFrame ?? defaultCancelFrame
    this.getDpr = options.getDevicePixelRatio ?? defaultDevicePixelRatio
  }

  get isFramePending(): boolean {
    return this.pendingFrame !== null
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /** Kích thước CSS hiện tại mà renderer đang quản lý. */
  get cssSize(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight }
  }

  /** Kích thước backing store thực tế của canvas. */
  get backingSize(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height }
  }

  /**
   * Khai báo kích thước hiển thị (CSS px) của canvas. Backing store
   * được đặt lại = CSS × DPR và một lần vẽ lại được lên lịch.
   */
  resize(cssWidth: number, cssHeight: number): void {
    if (
      !Number.isFinite(cssWidth) ||
      !Number.isFinite(cssHeight) ||
      cssWidth <= 0 ||
      cssHeight <= 0
    ) {
      throw new Error(
        `CanvasRenderer.resize: size must be positive and finite, got ${cssWidth}x${cssHeight}`,
      )
    }
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    const dpr = this.getDpr()
    this.canvas.width = Math.round(cssWidth * dpr)
    this.canvas.height = Math.round(cssHeight * dpr)
    this.requestRender()
  }

  /** Lên lịch vẽ lại ở khung hình tiếp theo (gộp trùng lặp). */
  requestRender(): void {
    if (this.disposed || this.pendingFrame !== null) return
    this.pendingFrame = this.requestFrameFn(() => {
      this.pendingFrame = null
      if (!this.disposed) {
        this.renderNow()
      }
    })
  }

  /** Vẽ lại toàn bộ ngay lập tức từ dữ liệu hiện tại. */
  renderNow(): void {
    if (this.disposed) return
    const ctx = this.canvas.getContext('2d')
    if (ctx === null) return
    const dpr = this.getDpr()
    // Xóa toàn bộ backing store ở transform đơn vị, rồi vẽ theo CSS px.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const camera = this.getCamera()
    for (const object of this.getObjects()) {
      drawObject(ctx, object, camera, { complete: true })
    }
    if (this.getPreviewObjects !== undefined) {
      for (const object of this.getPreviewObjects()) {
        drawObject(ctx, object, camera, { complete: false })
      }
    }
    if (this.getOverlay !== undefined) {
      const overlay = this.getOverlay()
      if (overlay !== null) {
        overlay(ctx, camera)
      }
    }
  }

  /** Hủy frame đang chờ và vô hiệu hóa renderer. */
  dispose(): void {
    if (this.pendingFrame !== null) {
      this.cancelFrameFn(this.pendingFrame)
      this.pendingFrame = null
    }
    this.disposed = true
  }
}
