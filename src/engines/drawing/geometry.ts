import type { Bounds, DrawingObject, Point, StrokeObject } from './types'
import { isStrokeKind, STROKE_PROFILES } from './strokeProfiles'

/**
 * Tính bounds từ một tập điểm, nới rộng đều `padding` về mọi phía.
 * Ném lỗi nếu tập điểm rỗng — một object không có điểm nào là không hợp lệ.
 */
export function boundsFromPoints(points: readonly Point[], padding = 0): Bounds {
  if (points.length === 0) {
    throw new Error('boundsFromPoints: cannot compute bounds of an empty point list')
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  }
}

/** Bounds của một nét vẽ: bao quanh raw points, nới bằng nửa độ dày nét. */
export function strokeBounds(points: readonly Point[], size: number): Bounds {
  return boundsFromPoints(points, size / 2)
}

/** Bounds của hình hai điểm: chuẩn hóa hai góc đối diện bất kể thứ tự kéo. */
export function shapeBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

/**
 * Bounds THẬT của một hình hai điểm (line/rectangle/ellipse): hộp hai
 * điểm nới bằng nửa độ dày nét — phần mực vẽ thực tế luôn nằm trong
 * bounds này (cùng nguyên tắc với strokeBounds của nét viết tay).
 */
export function shapeObjectBounds(start: Point, end: Point, strokeWidth: number): Bounds {
  return expandBounds(shapeBounds(start, end), strokeWidth / 2)
}

// ---------------------------------------------------------------------------
// Hình học đầu mũi tên (dùng chung cho bounds, renderer và selection)
// ---------------------------------------------------------------------------

/** Nửa góc mở của đầu mũi tên (30°). */
export const ARROW_HEAD_HALF_ANGLE = Math.PI / 6

/** Chiều dài đầu mũi tên theo độ dày nét (đơn vị world). */
export const ARROW_HEAD_WIDTH_FACTOR = 4

/** Chiều dài đầu mũi tên (world units) cho một độ dày nét. */
export function arrowHeadLength(strokeWidth: number): number {
  return strokeWidth * ARROW_HEAD_WIDTH_FACTOR
}

/**
 * Hai điểm cánh của đầu mũi tên: `tip` là đầu nhọn, `from` là điểm
 * đuôi để suy ra hướng. Hàm thuần hình học, dùng ở world coordinates.
 */
export function arrowHeadPoints(
  tip: Point,
  from: Point,
  headLength: number,
): { wingA: Point; wingB: Point } {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const wingAngleA = angle + Math.PI - ARROW_HEAD_HALF_ANGLE
  const wingAngleB = angle - Math.PI + ARROW_HEAD_HALF_ANGLE
  return {
    wingA: {
      x: tip.x + headLength * Math.cos(wingAngleA),
      y: tip.y + headLength * Math.sin(wingAngleA),
    },
    wingB: {
      x: tip.x + headLength * Math.cos(wingAngleB),
      y: tip.y + headLength * Math.sin(wingAngleB),
    },
  }
}

/**
 * Bounds THẬT của arrow: hộp thân ∪ hộp đầu mũi tên, tất cả nới bằng
 * nửa độ dày nét. (Trước TASK-05E, bounds của arrow chỉ là hộp hai
 * điểm — đầu mũi tên vẽ tràn ra ngoài bounds; đã sửa tại đây theo yêu
 * cầu kiểm tra của TASK-05E để selection/eraser lọc ứng viên an toàn.)
 */
export function arrowBounds(start: Point, end: Point, strokeWidth: number): Bounds {
  const { wingA, wingB } = arrowHeadPoints(end, start, arrowHeadLength(strokeWidth))
  const full = unionBounds(shapeBounds(start, end), boundsFromPoints([end, wingA, wingB]))
  return expandBounds(full, strokeWidth / 2)
}

/** Bounds của object text từ vị trí và kích thước vùng chứa. */
export function textBounds(position: Point, width: number, height: number): Bounds {
  return {
    minX: position.x,
    minY: position.y,
    maxX: position.x + width,
    maxY: position.y + height,
  }
}

/** Tính lại bounds chuẩn của một object từ dữ liệu riêng của nó. */
export function computeObjectBounds(object: DrawingObject): Bounds {
  // Nét tự do: bounds theo cỡ HIỆU DỤNG (size x hệ số hồ sơ,
  // TASK-14D) — khớp bounds mà factory đã ghi khi tạo object:
  if (isStrokeKind(object.type)) {
    const stroke = object as StrokeObject
    return strokeBounds(
      stroke.points,
      stroke.style.size * STROKE_PROFILES[stroke.type].sizeScale,
    )
  }
  switch (object.type) {
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return shapeObjectBounds(object.start, object.end, object.style.strokeWidth)
    case 'arrow':
      return arrowBounds(object.start, object.end, object.style.strokeWidth)
    case 'text':
      return textBounds(object.position, object.width, object.height)
  }
}

/** Bounds nhỏ nhất chứa cả hai bounds đầu vào. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

/** Nới (hoặc thu, nếu amount âm) bounds đều về mọi phía. */
export function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  }
}

/** Hai bounds có giao nhau không (dùng cho selection về sau). */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/** Điểm có nằm trong bounds không (bao gồm biên). */
export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

/** So sánh hai bounds với sai số cho phép (dùng khi kiểm chứng dữ liệu). */
export function boundsEqual(a: Bounds, b: Bounds, epsilon = 1e-6): boolean {
  return (
    Math.abs(a.minX - b.minX) <= epsilon &&
    Math.abs(a.minY - b.minY) <= epsilon &&
    Math.abs(a.maxX - b.maxX) <= epsilon &&
    Math.abs(a.maxY - b.maxY) <= epsilon
  )
}

export function boundsWidth(bounds: Bounds): number {
  return bounds.maxX - bounds.minX
}

export function boundsHeight(bounds: Bounds): number {
  return bounds.maxY - bounds.minY
}

export function boundsCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

// ---------------------------------------------------------------------------
// Hình học giao nhau & khoảng cách (Selection/Eraser, TASK-05E)
// ---------------------------------------------------------------------------

const EPSILON = 1e-9

/** Khoảng cách từ điểm tới đoạn thẳng (0 nếu hình chiếu rơi ngoài đoạn thì tới đầu gần nhất). */
export function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq),
  )
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(value) <= EPSILON) return 0
  return value > 0 ? 1 : 2
}

function onSegment(a: Point, point: Point, b: Point): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  )
}

/** Hai đoạn thẳng có giao nhau không (chạm đầu mút và chồng collinear cũng tính). */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(a, c, b)) return true
  if (o2 === 0 && onSegment(a, d, b)) return true
  if (o3 === 0 && onSegment(c, a, d)) return true
  if (o4 === 0 && onSegment(c, b, d)) return true
  return false
}

/** Khoảng cách nhỏ nhất giữa hai đoạn thẳng (0 khi chúng giao nhau). */
export function segmentToSegmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  )
}

/** Điểm có nằm trong polygon không (điểm trên biên tính là ở trong). */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false
  // Trên biên → trong.
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (pointToSegmentDistance(point, a, b) <= EPSILON) return true
  }
  // Ray casting theo trục +x.
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    const crosses =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    if (crosses) inside = !inside
  }
  return inside
}

/** Hai polygon (vùng kín) có giao nhau không: cạnh cắt nhau hoặc một vùng chứa đỉnh của vùng kia. */
export function polygonsIntersect(
  a: readonly Point[],
  b: readonly Point[],
): boolean {
  if (a.length === 0 || b.length === 0) return false
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i]
    const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j]
      const b2 = b[(j + 1) % b.length]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a)
}

/**
 * Polygon có đơn giản (không tự cắt) không: mọi cặp cạnh không kề nhau
 * đều không giao nhau. Cạnh kề chỉ được gặp nhau ở đỉnh chung.
 */
export function isSimplePolygon(polygon: readonly Point[]): boolean {
  const n = polygon.length
  if (n < 3) return false
  for (let i = 0; i < n; i += 1) {
    const a1 = polygon[i]
    const a2 = polygon[(i + 1) % n]
    for (let j = i + 1; j < n; j += 1) {
      // Bỏ qua cạnh kề và cặp cạnh đầu–cuối (chung đỉnh đầu).
      if (j === i + 1) continue
      if (i === 0 && j === n - 1) continue
      const b1 = polygon[j]
      const b2 = polygon[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}

/** Diện tích có dấu của polygon (0 khi suy biến thẳng hàng). */
export function polygonArea(polygon: readonly Point[]): number {
  let area = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

