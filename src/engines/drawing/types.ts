/**
 * Mô hình dữ liệu của Drawing Engine (TASK-05A).
 *
 * Nguyên tắc đã chốt:
 * - Một Drawing Engine dùng chung cho cả 3 chế độ (DEC-015) — file này
 *   không biết gì về PDF, DOCX hay bảng trắng; mọi object chỉ gắn với
 *   một `surfaceId`.
 * - Tọa độ của object là World Coordinates của bề mặt — không phụ thuộc
 *   camera/zoom/pan (camera nằm ở `coordinates.ts`).
 * - Stroke lưu raw points (điểm thô + pressure + time), KHÔNG lưu
 *   outline đã render và KHÔNG lưu bitmap canvas (kết quả khảo sát
 *   TASK-01, Luồng C).
 * - Mọi object là dữ liệu thuần, tuần tự hóa được (JSON) để sẵn sàng
 *   cho persistence (TASK-08) và sao lưu (DEC-022).
 */

export type ObjectId = string
export type SurfaceId = string

/** Điểm trong hệ tọa độ thế giới (world coordinates) của bề mặt. */
export interface Point {
  x: number
  y: number
}

/** Một điểm thô của nét vẽ. */
export interface StrokePoint extends Point {
  /** Lực nhấn, chuẩn hóa 0..1 (0.5 khi thiết bị không có pressure). */
  pressure: number
  /** Mốc thời gian của điểm, tính bằng ms kể từ điểm đầu tiên của nét. */
  time: number
}

/** Hộp bao (axis-aligned bounding box) trong world coordinates. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Kiểu đường nét cho pen/highlighter. */
export interface StrokeStyle {
  color: string
  /** Độ dày nét theo đơn vị world. */
  size: number
  /** 0..1 */
  opacity: number
}

/** Kiểu cho các hình vector (line, rectangle, ellipse, arrow). */
export interface ShapeStyle {
  strokeColor: string
  strokeWidth: number
  /** Màu tô nền, hoặc null nếu không tô. */
  fillColor: string | null
  /** 0..1 */
  opacity: number
}

/** Kiểu cho object văn bản. */
export interface TextStyle {
  color: string
  fontSize: number
  fontFamily: string
}

interface DrawingObjectBase {
  id: ObjectId
  surfaceId: SurfaceId
  bounds: Bounds
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms. */
  updatedAt: number
}

export interface PenStrokeObject extends DrawingObjectBase {
  type: 'pen'
  points: readonly StrokePoint[]
  style: StrokeStyle
}

export interface HighlighterStrokeObject extends DrawingObjectBase {
  type: 'highlighter'
  points: readonly StrokePoint[]
  style: StrokeStyle
}

export interface LineObject extends DrawingObjectBase {
  type: 'line'
  start: Point
  end: Point
  style: ShapeStyle
}

export interface RectangleObject extends DrawingObjectBase {
  type: 'rectangle'
  start: Point
  end: Point
  style: ShapeStyle
}

export interface EllipseObject extends DrawingObjectBase {
  type: 'ellipse'
  start: Point
  end: Point
  style: ShapeStyle
}

export interface ArrowObject extends DrawingObjectBase {
  type: 'arrow'
  start: Point
  end: Point
  style: ShapeStyle
}

export interface TextObject extends DrawingObjectBase {
  type: 'text'
  position: Point
  text: string
  /**
   * Kích thước vùng chứa văn bản theo đơn vị world. Lớp tạo/sửa text
   * (task sau) chịu trách nhiệm đo và cập nhật hai giá trị này — nhờ vậy
   * bounds của text luôn tính được mà không cần renderer.
   */
  width: number
  height: number
  style: TextStyle
}

/** Union type-safe của mọi object mà Drawing Engine quản lý. */
export type DrawingObject =
  | PenStrokeObject
  | HighlighterStrokeObject
  | LineObject
  | RectangleObject
  | EllipseObject
  | ArrowObject
  | TextObject

export type DrawingObjectType = DrawingObject['type']

/** Các object dạng nét vẽ tự do (có raw points). */
export type StrokeObject = PenStrokeObject | HighlighterStrokeObject

/** Các object hình vector hai điểm (start/end). */
export type ShapeObject = LineObject | RectangleObject | EllipseObject | ArrowObject
