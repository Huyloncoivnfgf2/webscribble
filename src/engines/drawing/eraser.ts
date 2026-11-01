/**
 * Eraser Engine (TASK-05E): hai chế độ tẩy cho nét pen/highlighter.
 *
 * - Stroke Eraser: vùng tẩy chạm vào nét nào (theo khoảng cách hình
 *   học thật giữa đường đi của tẩy và từng đoạn của nét, cộng nửa độ
 *   dày nét) thì xóa TOÀN BỘ nét đó qua `removeObject`. Shape/Text
 *   không bao giờ bị tác động.
 * - Segment Eraser: chỉ xóa phần nét nằm trong vùng tẩy, giữ lại các
 *   đoạn còn lại. Phần còn lại được tạo thành object MỚI (ID mới, qua
 *   factory của TASK-05A) và thay thế NGUYÊN TỬ bằng `replaceObject`
 *   của TASK-05A — object gốc không bao giờ bị sửa trực tiếp, và nếu
 *   việc thay thế thất bại thì surface giữ nguyên trạng.
 *
 * Cả hai chế độ xử lý đường đi của tẩy như một dãy hình tròn chồng
 * lấp (tâm cách nhau tối đa một bán kính) suy ra từ các mẫu pointer
 * liên tiếp — đủ dày để không bỏ sót phần nét giữa hai mẫu thưa.
 * Không thực hiện pixel erasing: dữ liệu nét luôn là raw points.
 */

import { boundsFromPoints, boundsIntersect, expandBounds, segmentToSegmentDistance } from './geometry'
import { createStrokeOfKind } from './objects'
import { isStrokeKind, STROKE_PROFILES } from './strokeProfiles'
import type { PointerInputEvent } from './input'
import type { DrawingSurface } from './surface'
import type { ObjectId, Point, StrokeObject, StrokePoint } from './types'

/** Đường kính vùng tẩy mặc định (world units). */
export const DEFAULT_ERASER_SIZE = 20

function isStrokeObject(object: { type: string }): object is StrokeObject {
  return isStrokeKind(object.type)
}

/** Bán kính hiệu dụng khi tẩy một nét: bán kính tẩy + nửa độ dày nét (tẩy theo mực, không chỉ theo đường tâm). */
export function effectiveEraseRadius(object: StrokeObject, eraserRadius: number): number {
  return eraserRadius + (object.style.size * STROKE_PROFILES[object.type].sizeScale) / 2
}

/**
 * Nét có bị đường tẩy (đoạn from → to, bán kính eraserRadius) chạm
 * vào không — kết luận bằng khoảng cách đoạn–đoạn thật; bounds chỉ
 * dùng để loại nhanh ứng viên không thể chạm.
 */
export function strokeHitByEraser(
  object: StrokeObject,
  from: Point,
  to: Point,
  eraserRadius: number,
): boolean {
  const radius = effectiveEraseRadius(object, eraserRadius)
  const pathBounds = expandBounds(boundsFromPoints([from, to]), radius)
  if (!boundsIntersect(object.bounds, pathBounds)) return false
  if (object.points.length === 1) {
    const only = object.points[0]
    return segmentToSegmentDistance(only, only, from, to) <= radius
  }
  for (let i = 0; i + 1 < object.points.length; i += 1) {
    if (
      segmentToSegmentDistance(object.points[i], object.points[i + 1], from, to) <= radius
    ) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Cắt nét bằng một hình tròn tẩy (lõi của Segment Eraser)
// ---------------------------------------------------------------------------

/** Nội suy điểm nét tại tham số t trên đoạn a → b (áp suất và thời gian nội suy tuyến tính, giữ thứ tự thời gian). */
function lerpStrokePoint(a: StrokePoint, b: StrokePoint, t: number): StrokePoint {
  if (t === 0) return a
  if (t === 1) return b
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    time: a.time + (b.time - a.time) * t,
  }
}

/**
 * Các khoảng tham số [t0, t1] của đoạn a → b nằm NGOÀI hình tròn
 * (tâm center, bán kính radius). Đoạn thẳng cắt hình tròn tại tối đa
 * hai điểm nên phần trong là một khoảng liên tục; phần ngoài là 0, 1
 * hoặc 2 khoảng.
 */
export function segmentOutsideCircleIntervals(
  a: Point,
  b: Point,
  center: Point,
  radius: number,
): [number, number][] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fx = a.x - center.x
  const fy = a.y - center.y
  const A = dx * dx + dy * dy
  if (A === 0) {
    return Math.hypot(fx, fy) > radius ? [[0, 1]] : []
  }
  const B = 2 * (fx * dx + fy * dy)
  const C = fx * fx + fy * fy - radius * radius
  const discriminant = B * B - 4 * A * C
  if (discriminant <= 0) {
    // Đường thẳng không cắt hình tròn: toàn bộ đoạn hoặc trong hoặc ngoài.
    const tMin = Math.max(0, Math.min(1, -B / (2 * A)))
    const closest = {
      x: a.x + dx * tMin - center.x,
      y: a.y + dy * tMin - center.y,
    }
    return Math.hypot(closest.x, closest.y) > radius ? [[0, 1]] : []
  }
  const sqrt = Math.sqrt(discriminant)
  const tEnter = (-B - sqrt) / (2 * A)
  const tExit = (-B + sqrt) / (2 * A)
  const intervals: [number, number][] = []
  if (tEnter > 0) intervals.push([0, Math.min(tEnter, 1)])
  if (tExit < 1) intervals.push([Math.max(tExit, 0), 1])
  return intervals.filter(([t0, t1]) => t1 > t0)
}

/**
 * Xóa phần của một nét nằm trong hình tròn tẩy (tâm center, bán kính
 * eraserRadius — bán kính hiệu dụng cộng nửa độ dày nét).
 *
 * Trả về:
 * - `null` khi nét không bị ảnh hưởng (không cần thay object);
 * - `[]` khi toàn bộ nét bị xóa;
 * - danh sách các đoạn điểm còn lại (mỗi đoạn ≥ 1 điểm; thứ tự điểm
 *   và thứ tự thời gian được giữ nguyên; điểm biên được nội suy tại
 *   đúng giao điểm với vòng tròn).
 */
export function eraseCircleFromStroke(
  object: StrokeObject,
  center: Point,
  eraserRadius: number,
): StrokePoint[][] | null {
  const radius = effectiveEraseRadius(object, eraserRadius)
  const points = object.points
  if (points.length === 1) {
    const only = points[0]
    return Math.hypot(only.x - center.x, only.y - center.y) <= radius ? [] : null
  }
  const runs: StrokePoint[][] = []
  let current: StrokePoint[] = []
  let erasedAny = false
  const closeRun = (): void => {
    if (current.length > 0) {
      runs.push(current)
      current = []
    }
  }
  const pushPoint = (point: StrokePoint): void => {
    const last = current[current.length - 1]
    if (
      last === undefined ||
      last.x !== point.x ||
      last.y !== point.y ||
      last.time !== point.time
    ) {
      current.push(point)
    }
  }
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const intervals = segmentOutsideCircleIntervals(a, b, center, radius)
    const coversWholeSegment =
      intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 1
    if (!coversWholeSegment) erasedAny = true
    if (intervals.length === 0) {
      closeRun()
      continue
    }
    for (const [t0, t1] of intervals) {
      const start = lerpStrokePoint(a, b, t0)
      const end = lerpStrokePoint(a, b, t1)
      const last = current[current.length - 1]
      if (
        last !== undefined &&
        (last.x !== start.x || last.y !== start.y || last.time !== start.time)
      ) {
        // Phần giữ lại không nối tiếp với đoạn đang gom → đoạn mới.
        closeRun()
      }
      pushPoint(start)
      pushPoint(end)
    }
  }
  closeRun()
  return erasedAny ? runs : null
}

/** Các tâm hình tròn tẩy dọc đoạn from → to, cách nhau tối đa một bán kính để phủ liên tục. */
export function eraserCircleCenters(from: Point, to: Point, radius: number): Point[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance === 0) return [{ ...from }]
  const step = Math.max(radius, 1e-6)
  const count = Math.max(1, Math.ceil(distance / step))
  const centers: Point[] = []
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    centers.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return centers
}

// ---------------------------------------------------------------------------
// Phiên tẩy theo sự kiện pointer (dùng bởi DrawingEngine)
// ---------------------------------------------------------------------------

export interface EraserToolOptions {
  surface: DrawingSurface
  size?: number
}

export interface EraserGestureOutcome {
  /** ID của các object đã bị xóa hoặc bị thay thế trong sự kiện này. */
  changedObjectIds: ObjectId[]
}

const EMPTY_OUTCOME: EraserGestureOutcome = { changedObjectIds: [] }

abstract class EraserToolBase {
  protected readonly surface: DrawingSurface
  private eraserSize: number
  private active = false
  private lastPoint: Point | null = null

  constructor(options: EraserToolOptions) {
    this.surface = options.surface
    this.eraserSize = options.size ?? DEFAULT_ERASER_SIZE
    assertValidSize(this.eraserSize)
  }

  /** Đường kính vùng tẩy (world units). */
  get size(): number {
    return this.eraserSize
  }

  set size(value: number) {
    assertValidSize(value)
    this.eraserSize = value
  }

  /** Bán kính vùng tẩy (world units). */
  get radius(): number {
    return this.eraserSize / 2
  }

  get isActive(): boolean {
    return this.active
  }

  /** Vị trí pointer gần nhất (cho tầng view vẽ con trỏ tẩy). */
  get lastPosition(): Point | null {
    return this.lastPoint === null ? null : { ...this.lastPoint }
  }

  handleEvent(event: PointerInputEvent): EraserGestureOutcome {
    const position = event.sample.position
    if (
      position === undefined ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return EMPTY_OUTCOME
    }
    switch (event.type) {
      case 'down': {
        this.active = true
        this.lastPoint = { ...position }
        return { changedObjectIds: this.eraseAlong(position, position) }
      }
      case 'move': {
        if (!this.active) return EMPTY_OUTCOME
        const from = this.lastPoint ?? position
        const changed = this.eraseAlong(from, position)
        this.lastPoint = { ...position }
        return { changedObjectIds: changed }
      }
      case 'up':
      case 'cancel': {
        this.active = false
        this.lastPoint = { ...position }
        return EMPTY_OUTCOME
      }
    }
  }

  protected abstract eraseAlong(from: Point, to: Point): ObjectId[]
}

function assertValidSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Eraser size must be a positive finite number, got ${size}`)
  }
}

/** Stroke Eraser: chạm vào nét nào xóa toàn bộ nét đó. */
export class StrokeEraserTool extends EraserToolBase {
  protected eraseAlong(from: Point, to: Point): ObjectId[] {
    const erased: ObjectId[] = []
    for (const object of this.surface.listObjects()) {
      if (!isStrokeObject(object)) continue
      if (strokeHitByEraser(object, from, to, this.radius)) {
        this.surface.removeObject(object.id)
        erased.push(object.id)
      }
    }
    return erased
  }
}

/** Segment Eraser: chỉ xóa phần nét trong vùng tẩy, thay thế nguyên tử các đoạn còn lại. */
export class SegmentEraserTool extends EraserToolBase {
  protected eraseAlong(from: Point, to: Point): ObjectId[] {
    const changed: ObjectId[] = []
    for (const center of eraserCircleCenters(from, to, this.radius)) {
      this.eraseOneCircle(center, changed)
    }
    return changed
  }

  private eraseOneCircle(center: Point, changed: ObjectId[]): void {
    // Chụp danh sách hiện tại: mỗi lần thay thế đổi ID object nên các
    // hình tròn sau luôn làm việc trên trạng thái mới nhất.
    for (const object of [...this.surface.listObjects()]) {
      if (!isStrokeObject(object)) continue
      const runs = eraseCircleFromStroke(object, center, this.radius)
      if (runs === null) continue
      // Đoạn còn lại GIỮ NGUYÊN loại bút của nét gốc (TASK-14D):
      const replacements = runs.map((runPoints) =>
        createStrokeOfKind(object.type, {
          surfaceId: object.surfaceId,
          points: runPoints,
          style: object.style,
          createdAt: object.createdAt,
        }),
      )
      this.surface.replaceObject(object.id, replacements)
      if (!changed.includes(object.id)) changed.push(object.id)
    }
  }
}
