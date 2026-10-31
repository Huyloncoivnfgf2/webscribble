/**
 * Ánh xạ tọa độ cho Annotation Overlay (TASK-06D) — cầu nối giữa
 * năm hệ tọa độ:
 *
 * 1. PDF user space: gốc dưới-trái, y hướng lên, đơn vị điểm PDF
 *    (không gian gốc của nội dung PDF).
 * 2. World (không gian annotation): khung trang ĐÃ HIỂN THỊ tại
 *    scale 1 — gốc trên-trái, y hướng xuống, đơn vị điểm PDF.
 *    Đây là hệ tọa độ DrawingObject được lưu (surface của trang
 *    có kích thước bằng viewport scale 1).
 * 3. Viewport (CSS px): world × scale — trùng tọa độ CSS của
 *    canvas PDF và canvas overlay.
 * 4. Canvas physical px: viewport × devicePixelRatio — chỉ tồn
 *    tại ở bitmap; KHÔNG bao giờ đi vào dữ liệu annotation.
 *
 * Mọi phép biến đổi liên quan tới PDF user space đều đi qua
 * `convertToViewportPoint` / `convertToPdfPoint` của chính
 * PageViewport (PDF.js tự xử lý flip trục y, rotation 0/90/180/
 * 270 và offset của trang) — module này không tự viết công thức
 * hình học PDF. Hệ quả của định nghĩa world: world ↔ viewport là
 * phép nhân scale thuần nhất ở MỌI rotation, nên overlay chỉ cần
 * camera zoom = scale của Drawing Engine.
 */
import type { PageViewport } from 'pdfjs-dist'
import type { Point } from '../drawing/types'
import { PdfRenderError } from './errors'

export interface PdfAnnotationMapping {
  /** Scale của viewport dùng để dựng mapping. */
  readonly scale: number
  /** Rotation hiệu dụng của trang (0/90/180/270). */
  readonly rotation: number
  readonly devicePixelRatio: number
  /** Kích thước world (trang hiển thị tại scale 1). */
  readonly pageWidth: number
  readonly pageHeight: number
  /** Kích thước viewport/CSS tại scale hiện tại. */
  readonly viewportWidth: number
  readonly viewportHeight: number

  worldToViewportPoint(point: Point): Point
  viewportToWorldPoint(point: Point): Point
  worldToPdfPoint(point: Point): Point
  pdfToWorldPoint(point: Point): Point
  viewportToCanvasPoint(point: Point): Point
  canvasToViewportPoint(point: Point): Point
  worldToCanvasPoint(point: Point): Point
  canvasToWorldPoint(point: Point): Point
}

function resolveDpr(explicit: number | undefined): number {
  const value =
    explicit ??
    (typeof globalThis !== 'undefined' && typeof globalThis.devicePixelRatio === 'number'
      ? globalThis.devicePixelRatio
      : 1)
  if (!Number.isFinite(value) || value <= 0) {
    throw new PdfRenderError(
      'invalid-argument',
      `Invalid devicePixelRatio ${String(value)} for annotation mapping.`,
    )
  }
  return value
}

/**
 * Dựng mapping từ MỘT PageViewport bất kỳ của trang (thường là
 * viewport của lần render hiện tại). Vì viewport tại scale s
 * bằng đúng s lần viewport tại scale 1, các phép chuyển đổi về
 * world đều chuẩn hóa qua scale của viewport được đưa vào.
 */
export function createPdfAnnotationMapping(
  viewport: PageViewport,
  options: { devicePixelRatio?: number } = {},
): PdfAnnotationMapping {
  const scale = viewport.scale
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new PdfRenderError('invalid-argument', `Invalid viewport scale ${String(scale)}.`)
  }
  const devicePixelRatio = resolveDpr(options.devicePixelRatio)
  const pageWidth = viewport.width / scale
  const pageHeight = viewport.height / scale

  const worldToViewportPoint = (point: Point): Point => ({
    x: point.x * scale,
    y: point.y * scale,
  })
  const viewportToWorldPoint = (point: Point): Point => ({
    x: point.x / scale,
    y: point.y / scale,
  })
  const worldToPdfPoint = (point: Point): Point => {
    const [x, y] = viewport.convertToPdfPoint(point.x * scale, point.y * scale)
    return { x, y }
  }
  const pdfToWorldPoint = (point: Point): Point => {
    const [x, y] = viewport.convertToViewportPoint(point.x, point.y)
    return { x: x / scale, y: y / scale }
  }
  const viewportToCanvasPoint = (point: Point): Point => ({
    x: point.x * devicePixelRatio,
    y: point.y * devicePixelRatio,
  })
  const canvasToViewportPoint = (point: Point): Point => ({
    x: point.x / devicePixelRatio,
    y: point.y / devicePixelRatio,
  })

  return {
    scale,
    rotation: viewport.rotation,
    devicePixelRatio,
    pageWidth,
    pageHeight,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    worldToViewportPoint,
    viewportToWorldPoint,
    worldToPdfPoint,
    pdfToWorldPoint,
    viewportToCanvasPoint,
    canvasToViewportPoint,
    worldToCanvasPoint: (point) => viewportToCanvasPoint(worldToViewportPoint(point)),
    canvasToWorldPoint: (point) => viewportToWorldPoint(canvasToViewportPoint(point)),
  }
}
