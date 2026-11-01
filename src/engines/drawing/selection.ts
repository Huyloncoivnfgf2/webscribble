/**
 * Selection Engine (TASK-05E): chọn DrawingObject bằng vùng chữ nhật
 * hoặc lasso tự do, và di chuyển nhiều object cùng lúc.
 *
 * Quy tắc chọn (đã chốt ở brief TASK-05E): object được chọn khi BẤT
 * KỲ phần nào của nó giao với vùng chọn. Việc kiểm tra gồm hai tầng:
 * 1. Lọc ứng viên bằng bounds — an toàn vì bounds của mọi object nay
 *    là phạm vi mực vẽ thật (nét: gồm nửa độ dày; hình: gồm nửa độ
 *    dày nét; arrow: gồm cả đầu mũi tên — xem geometry.ts).
 * 2. Kết luận bằng HÌNH HỌC THẬT theo từng loại object (đoạn thẳng,
 *    polyline có bán kính, polygon vùng kín, hình ellipse xấp xỉ
 *    polygon) — không kết luận chỉ từ bounding box.
 *
 * Lasso tự cắt bị TỪ CHỐI tường minh (sự kiện discarded với lý do
 * 'self-intersecting') thay vì cố suy diễn vùng chọn mơ hồ.
 *
 * Di chuyển dùng `translateObject` (hàm thuần) + `moveObjects` ghi
 * qua `DrawingSurface.updateObjects` — cập nhật nguyên tử: một lỗi ở
 * bất kỳ object nào hủy toàn bộ lần di chuyển.
 */

import {
  arrowHeadLength,
  arrowHeadPoints,
  boundsFromPoints,
  boundsIntersect,
  computeObjectBounds,
  isSimplePolygon,
  pointInPolygon,
  polygonArea,
  polygonsIntersect,
  segmentToSegmentDistance,
} from './geometry'
import { worldToScreen, type Camera } from './coordinates'
import type { CanvasContextLike } from './renderer'
import type { DrawingSurface } from './surface'
import type { Bounds, DrawingObject, ObjectId, Point, StrokeObject } from './types'
import { isStrokeKind, STROKE_PROFILES } from './strokeProfiles'
import type { PointerInputEvent, PointerSample } from './input'

// ---------------------------------------------------------------------------
// Vùng chọn & kiểm tra giao nhau
// ---------------------------------------------------------------------------

export type SelectionRegion =
  | { kind: 'rect'; rect: Bounds }
  | { kind: 'polygon'; points: readonly Point[] }

/** Polygon (world coordinates) của một vùng chọn. */
export function regionToPolygon(region: SelectionRegion): Point[] {
  if (region.kind === 'polygon') return [...region.points]
  const { minX, minY, maxX, maxY } = region.rect
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

function boxPolygon(minX: number, minY: number, maxX: number, maxY: number): Point[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

/** Xấp xỉ ellipse bằng polygon nhiều cạnh cho kiểm tra giao nhau. */
export function ellipseToPolygon(start: Point, end: Point, segments = 48): Point[] {
  const centerX = (start.x + end.x) / 2
  const centerY = (start.y + end.y) / 2
  const radiusX = Math.abs(end.x - start.x) / 2
  const radiusY = Math.abs(end.y - start.y) / 2
  const points: Point[] = []
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    points.push({
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
    })
  }
  return points
}

/**
 * Polyline có bán kính mực (nét/đường thẳng) có giao với polygon
 * không: đỉnh nằm trong polygon, hoặc khoảng cách từ bất kỳ đoạn nào
 * tới bất kỳ cạnh nào của polygon ≤ bán kính.
 */
function polylineIntersectsPolygon(
  points: readonly Point[],
  radius: number,
  polygon: readonly Point[],
): boolean {
  if (points.length === 0 || polygon.length < 3) return false
  for (const point of points) {
    if (pointInPolygon(point, polygon)) return true
  }
  const segments: [Point, Point][] = []
  if (points.length === 1) {
    segments.push([points[0], points[0]])
  } else {
    for (let i = 0; i + 1 < points.length; i += 1) {
      segments.push([points[i], points[i + 1]])
    }
  }
  for (const [a, b] of segments) {
    for (let j = 0; j < polygon.length; j += 1) {
      const c = polygon[j]
      const d = polygon[(j + 1) % polygon.length]
      if (segmentToSegmentDistance(a, b, c, d) <= radius) return true
    }
  }
  return false
}

/** Kiểm tra giao nhau HÌNH HỌC THẬT giữa một object và một vùng chọn. */
export function objectIntersectsRegion(
  object: DrawingObject,
  region: SelectionRegion,
): boolean {
  const polygon = regionToPolygon(region)
  if (polygon.length < 3) return false
  // Tầng 1: lọc ứng viên bằng bounds (bounds nay là phạm vi mực thật).
  if (!boundsIntersect(object.bounds, boundsFromPoints(polygon))) return false
  // Tầng 2: kết luận bằng hình học theo loại object.
  if (isStrokeKind(object.type)) {
    const stroke = object as StrokeObject
    return polylineIntersectsPolygon(
      stroke.points,
      (stroke.style.size * STROKE_PROFILES[stroke.type].sizeScale) / 2,
      polygon,
    )
  }
  switch (object.type) {
    case 'line':
      return polylineIntersectsPolygon(
        [object.start, object.end],
        object.style.strokeWidth / 2,
        polygon,
      )
    case 'arrow': {
      const shaft = polylineIntersectsPolygon(
        [object.start, object.end],
        object.style.strokeWidth / 2,
        polygon,
      )
      if (shaft) return true
      const { wingA, wingB } = arrowHeadPoints(
        object.end,
        object.start,
        arrowHeadLength(object.style.strokeWidth),
      )
      return polygonsIntersect([object.end, wingA, wingB], polygon)
    }
    case 'rectangle':
      return polygonsIntersect(
        boxPolygon(
          Math.min(object.start.x, object.end.x),
          Math.min(object.start.y, object.end.y),
          Math.max(object.start.x, object.end.x),
          Math.max(object.start.y, object.end.y),
        ),
        polygon,
      )
    case 'ellipse':
      return polygonsIntersect(ellipseToPolygon(object.start, object.end), polygon)
    case 'text':
      return polygonsIntersect(
        boxPolygon(
          object.bounds.minX,
          object.bounds.minY,
          object.bounds.maxX,
          object.bounds.maxY,
        ),
        polygon,
      )
  }
}

/** Chọn mọi object giao với vùng chọn; trả về danh sách ID theo thứ tự dữ liệu. */
export function selectObjects(
  objects: readonly DrawingObject[],
  region: SelectionRegion,
): ObjectId[] {
  const ids: ObjectId[] = []
  for (const object of objects) {
    if (objectIntersectsRegion(object, region)) {
      ids.push(object.id)
    }
  }
  return ids
}

// ---------------------------------------------------------------------------
// Thao tác kéo tạo vùng chọn (gesture builders)
// ---------------------------------------------------------------------------

export type SelectionDiscardReason = 'too-small' | 'self-intersecting' | 'degenerate' | 'cancelled'

export type SelectionGestureEvent =
  | { type: 'started' }
  | { type: 'updated' }
  | { type: 'completed'; region: SelectionRegion }
  | { type: 'discarded'; reason: SelectionDiscardReason }
  | { type: 'ignored' }

function isFiniteSample(sample: PointerSample): boolean {
  return Number.isFinite(sample.position.x) && Number.isFinite(sample.position.y)
}

/** Kéo tạo vùng chọn hình chữ nhật. */
export class RectSelectionBuilder {
  private anchor: Point | null = null
  private current: Point | null = null

  get isActive(): boolean {
    return this.anchor !== null
  }

  /** Vùng chọn hiện tại trong lúc kéo (để render xem trước). */
  get previewRegion(): SelectionRegion | null {
    if (this.anchor === null || this.current === null) return null
    return {
      kind: 'rect',
      rect: {
        minX: Math.min(this.anchor.x, this.current.x),
        minY: Math.min(this.anchor.y, this.current.y),
        maxX: Math.max(this.anchor.x, this.current.x),
        maxY: Math.max(this.anchor.y, this.current.y),
      },
    }
  }

  handleEvent(event: PointerInputEvent): SelectionGestureEvent {
    switch (event.type) {
      case 'down': {
        if (!isFiniteSample(event.sample)) return { type: 'ignored' }
        this.anchor = { ...event.sample.position }
        this.current = { ...event.sample.position }
        return { type: 'started' }
      }
      case 'move': {
        if (!this.isActive || !isFiniteSample(event.sample)) return { type: 'ignored' }
        this.current = { ...event.sample.position }
        return { type: 'updated' }
      }
      case 'up': {
        if (!this.isActive) return { type: 'ignored' }
        // Vị trí thả chuột là cạnh cuối của vùng chọn — phải áp vào
        // trước khi chốt, giống các builder tạo object.
        if (isFiniteSample(event.sample)) {
          this.current = { ...event.sample.position }
        }
        const region = this.previewRegion
        this.reset()
        if (region === null || region.kind !== 'rect') return { type: 'ignored' }
        if (region.rect.maxX - region.rect.minX === 0 && region.rect.maxY - region.rect.minY === 0) {
          return { type: 'discarded', reason: 'too-small' }
        }
        return { type: 'completed', region }
      }
      case 'cancel': {
        if (!this.isActive) return { type: 'ignored' }
        this.reset()
        return { type: 'discarded', reason: 'cancelled' }
      }
    }
  }

  private reset(): void {
    this.anchor = null
    this.current = null
  }
}

/** Khoảng cách lấy mẫu tối thiểu giữa hai điểm lasso liên tiếp (world units). */
export const LASSO_MIN_POINT_DISTANCE = 1

/** Vẽ đường tự do tạo vùng chọn lasso (đóng polygon khi hoàn tất). */
export class LassoSelectionBuilder {
  private points: Point[] = []
  private readonly minPointDistance: number

  constructor(minPointDistance: number = LASSO_MIN_POINT_DISTANCE) {
    this.minPointDistance = minPointDistance
  }

  get isActive(): boolean {
    return this.points.length > 0
  }

  /** Các điểm đã thu thập (bản sao) để render đường lasso đang vẽ. */
  get previewPoints(): readonly Point[] {
    return [...this.points]
  }

  handleEvent(event: PointerInputEvent): SelectionGestureEvent {
    switch (event.type) {
      case 'down': {
        if (!isFiniteSample(event.sample)) return { type: 'ignored' }
        this.points = [{ ...event.sample.position }]
        return { type: 'started' }
      }
      case 'move': {
        if (!this.isActive || !isFiniteSample(event.sample)) return { type: 'ignored' }
        this.appendPoint(event.sample.position)
        return { type: 'updated' }
      }
      case 'up': {
        if (!this.isActive) return { type: 'ignored' }
        if (isFiniteSample(event.sample)) {
          this.appendPoint(event.sample.position)
        }
        const points = [...this.points]
        this.points = []
        if (points.length < 3) return { type: 'discarded', reason: 'too-small' }
        // Tự cắt kiểm tra TRƯỚC diện tích: hình nơ tự cắt có diện tích
        // triệt tiêu lẫn nhau nên kiểm tra diện tích trước sẽ báo sai lý do.
        if (!isSimplePolygon(points)) {
          return { type: 'discarded', reason: 'self-intersecting' }
        }
        if (Math.abs(polygonArea(points)) <= 1e-9) {
          return { type: 'discarded', reason: 'degenerate' }
        }
        return { type: 'completed', region: { kind: 'polygon', points } }
      }
      case 'cancel': {
        if (!this.isActive) return { type: 'ignored' }
        this.points = []
        return { type: 'discarded', reason: 'cancelled' }
      }
    }
  }

  private appendPoint(point: Point): void {
    const last = this.points[this.points.length - 1]
    if (last === undefined || Math.hypot(point.x - last.x, point.y - last.y) >= this.minPointDistance) {
      this.points.push({ ...point })
    }
  }
}

// ---------------------------------------------------------------------------
// Di chuyển object
// ---------------------------------------------------------------------------

/**
 * Bản sao của object đã dịch chuyển theo `delta` (hàm thuần, không
 * sửa object gốc): mọi tọa độ gốc đều tịnh tiến, bounds tính lại từ
 * dữ liệu đã dịch bằng `computeObjectBounds` nên luôn nhất quán.
 * ID/surfaceId/createdAt/style/nội dung giữ nguyên.
 */
export function translateObject(object: DrawingObject, delta: Point): DrawingObject {
  const move = (point: Point): Point => ({ x: point.x + delta.x, y: point.y + delta.y })
  let moved: DrawingObject
  switch (object.type) {
    case 'pen':
    case 'highlighter':
    case 'pencil':
    case 'ballpoint':
    case 'marker':
    case 'fine-pen':
    case 'thick-pen':
    case 'watercolor':
      moved = {
        ...object,
        points: object.points.map((point) => ({ ...point, ...move(point) })),
      }
      break
    case 'line':
    case 'rectangle':
    case 'ellipse':
    case 'arrow':
      moved = { ...object, start: move(object.start), end: move(object.end) }
      break
    case 'text':
      moved = { ...object, position: move(object.position) }
      break
  }
  return { ...moved, bounds: computeObjectBounds(moved) }
}

/**
 * Di chuyển nhiều object trên một surface theo cùng một delta, ghi
 * NGUYÊN TỬ qua `updateObjects`: ID không tồn tại hoặc dữ liệu sau
 * dịch không hợp lệ → ném lỗi và KHÔNG object nào thay đổi. Delta
 * (0, 0) hoặc danh sách rỗng là no-op trả về [].
 */
export function moveObjects(
  surface: DrawingSurface,
  ids: readonly ObjectId[],
  delta: Point,
): DrawingObject[] {
  if (ids.length === 0 || (delta.x === 0 && delta.y === 0)) return []
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new Error(`moveObjects: delta must be finite, got (${delta.x}, ${delta.y})`)
  }
  const uniqueIds = [...new Set(ids)]
  const originals = uniqueIds.map((id) => {
    const object = surface.getObject(id)
    if (object === undefined) {
      throw new Error(`moveObjects: object ${id} not found on surface ${surface.id}`)
    }
    return object
  })
  const translated = originals.map((object) => translateObject(object, delta))
  return [...surface.updateObjects(translated)]
}

// ---------------------------------------------------------------------------
// Vẽ vùng chọn & khung object được chọn (overlay, không phải dữ liệu)
// ---------------------------------------------------------------------------

export interface SelectionDrawOptions {
  color?: string
  lineWidth?: number
}

const DEFAULT_SELECTION_COLOR = '#2563eb'

function traceScreenPolygon(
  ctx: CanvasContextLike,
  screenPoints: readonly Point[],
  close: boolean,
): void {
  if (screenPoints.length === 0) return
  ctx.beginPath()
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y)
  for (let i = 1; i < screenPoints.length; i += 1) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y)
  }
  if (close) ctx.closePath()
  ctx.stroke()
}

function withSelectionStyle(
  ctx: CanvasContextLike,
  options: SelectionDrawOptions,
  draw: () => void,
): void {
  ctx.save()
  try {
    ctx.strokeStyle = options.color ?? DEFAULT_SELECTION_COLOR
    ctx.lineWidth = options.lineWidth ?? 1.5
    ctx.globalAlpha = 1
    ctx.setLineDash([6, 4])
    draw()
  } finally {
    ctx.restore()
  }
}

/** Vẽ vùng chọn (rect hoặc polygon đã đóng) dạng nét đứt. */
export function drawSelectionRegion(
  ctx: CanvasContextLike,
  region: SelectionRegion,
  camera: Camera,
  options: SelectionDrawOptions = {},
): void {
  withSelectionStyle(ctx, options, () => {
    const screen = regionToPolygon(region).map((point) => worldToScreen(point, camera))
    traceScreenPolygon(ctx, screen, true)
  })
}

/** Vẽ đường lasso đang vẽ dở (chưa đóng) dạng nét đứt. */
export function drawLassoPreview(
  ctx: CanvasContextLike,
  points: readonly Point[],
  camera: Camera,
  options: SelectionDrawOptions = {},
): void {
  if (points.length < 2) return
  withSelectionStyle(ctx, options, () => {
    const screen = points.map((point) => worldToScreen(point, camera))
    traceScreenPolygon(ctx, screen, false)
  })
}

/** Vẽ khung bounds nét đứt quanh từng object đang được chọn. */
export function drawSelectedBounds(
  ctx: CanvasContextLike,
  objects: readonly DrawingObject[],
  camera: Camera,
  options: SelectionDrawOptions = {},
): void {
  withSelectionStyle(ctx, options, () => {
    for (const object of objects) {
      const topLeft = worldToScreen(
        { x: object.bounds.minX, y: object.bounds.minY },
        camera,
      )
      const bottomRight = worldToScreen(
        { x: object.bounds.maxX, y: object.bounds.maxY },
        camera,
      )
      traceScreenPolygon(
        ctx,
        [
          topLeft,
          { x: bottomRight.x, y: topLeft.y },
          bottomRight,
          { x: topLeft.x, y: bottomRight.y },
        ],
        true,
      )
    }
  })
}
