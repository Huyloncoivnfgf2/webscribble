/**
 * Shape Builder (TASK-05D): tầng biến chuỗi PointerInputEvent thành
 * DrawingObject dạng hình vector hai điểm (line / rectangle / ellipse /
 * arrow) theo mô hình dữ liệu TASK-05A.
 *
 * Quy tắc vòng đời — cùng họ với StrokeBuilder (TASK-05C):
 * - `down` bắt đầu tạo hình tại điểm neo (sinh ID ngay để preview và
 *   object cuối cùng dùng chung một ID), `move` cập nhật điểm đối
 *   diện, `up` hoàn tất.
 * - `cancel` hoàn tất và giữ hình nếu hình hợp lệ (hệ thống cướp cử
 *   chỉ không phải ý định hủy của người dùng); hình suy biến thì bỏ.
 * - `down` mới giữa chừng: hoàn tất hình cũ (nếu hợp lệ) rồi bắt đầu
 *   hình mới; `abandon()` là đường hủy tường minh duy nhất.
 *
 * Chính sách hình suy biến (kích thước 0 / quá nhỏ), áp dụng khi HOÀN
 * TẤT (preview trong lúc kéo vẫn hiển thị bình thường):
 * - line/arrow: độ dài đường chéo < `minSize` → bỏ (discarded).
 * - rectangle/ellipse: chiều rộng HOẶC chiều cao < `minSize` → bỏ
 *   (hình cần có diện tích; một "nét thẳng" không phải hình chữ nhật).
 * `minSize` tính theo world units, mặc định DEFAULT_MIN_SHAPE_SIZE,
 * cấu hình được khi tạo builder.
 *
 * Hình được tạo qua factory của TASK-05A nên bounds luôn là
 * `shapeBounds` chuẩn hóa (kéo ngược chiều vẫn đúng). Dữ liệu là
 * vector (start/end + style) — không rasterize.
 */

import {
  createArrow,
  createEllipse,
  createLine,
  createObjectId,
  createRectangle,
} from './objects'
import { shapeBounds } from './geometry'
import type {
  ObjectId,
  Point,
  ShapeObject,
  ShapeStyle,
  SurfaceId,
} from './types'
import type { PointerInputEvent, PointerSample } from './input'

export type ShapeTool = 'line' | 'rectangle' | 'ellipse' | 'arrow'

export type ShapeEndReason = 'up' | 'cancel' | 'interrupted'

/** Kích thước tối thiểu mặc định của một hình hoàn tất (world units). */
export const DEFAULT_MIN_SHAPE_SIZE = 2

export type ShapeBuilderEvent =
  | { type: 'started' }
  | { type: 'updated' }
  | {
      type: 'completed'
      object: ShapeObject
      endedBy: ShapeEndReason
      startedNewShape?: boolean
    }
  | { type: 'discarded'; reason: 'too-small' }
  | { type: 'ignored' }

export interface ShapeBuilderOptions {
  surfaceId: SurfaceId
  tool: ShapeTool
  style?: Partial<ShapeStyle>
  minSize?: number
}

export class ShapeBuilder {
  private readonly surfaceId: SurfaceId
  private readonly tool: ShapeTool
  private readonly style: Partial<ShapeStyle> | undefined
  private readonly minSize: number

  private shapeId: ObjectId | null = null
  private createdAt = 0
  private start: Point | null = null
  private end: Point | null = null

  constructor(options: ShapeBuilderOptions) {
    this.surfaceId = options.surfaceId
    this.tool = options.tool
    this.style = options.style
    this.minSize = options.minSize ?? DEFAULT_MIN_SHAPE_SIZE
    if (!(this.minSize >= 0)) {
      throw new Error(`ShapeBuilder: minSize must be >= 0, got ${this.minSize}`)
    }
  }

  get isActive(): boolean {
    return this.shapeId !== null
  }

  get startPoint(): Point | null {
    return this.start === null ? null : { ...this.start }
  }

  get currentPoint(): Point | null {
    return this.end === null ? null : { ...this.end }
  }

  /** Xử lý một sự kiện đầu vào đã chuẩn hóa. */
  handleEvent(event: PointerInputEvent): ShapeBuilderEvent {
    switch (event.type) {
      case 'down':
        return this.handleDown(event.sample)
      case 'move': {
        if (!this.isActive) return { type: 'ignored' }
        if (!isFiniteSample(event.sample)) return { type: 'ignored' }
        this.end = { ...event.sample.position }
        return { type: 'updated' }
      }
      case 'up':
        return this.finishFromEvent('up')
      case 'cancel':
        return this.finishFromEvent('cancel')
    }
  }

  /**
   * Hoàn tất hình đang tạo và trả về object; null khi không có hình
   * hoặc hình suy biến (bị bỏ theo chính sách kích thước).
   */
  finishShape(): ShapeObject | null {
    if (!this.isActive) return null
    return this.buildObject()
  }

  /** Hủy bỏ hình đang tạo mà KHÔNG tạo object — quyết định tường minh của tầng gọi. */
  abandon(): void {
    this.reset()
  }

  /**
   * Object tạm thời để render xem trước trong lúc kéo (cùng ID với
   * object cuối cùng). Hiển thị kể cả khi hình đang ở kích thước suy
   * biến; chính sách bỏ hình chỉ áp dụng khi hoàn tất.
   */
  previewObject(): ShapeObject | null {
    if (!this.isActive || this.shapeId === null || this.start === null || this.end === null) {
      return null
    }
    return this.createShape({
      id: this.shapeId,
      createdAt: this.createdAt,
      start: this.start,
      end: this.end,
    })
  }

  /** Hình hiện tại có đạt kích thước tối thiểu để được giữ lại hay không. */
  private isViable(): boolean {
    if (this.start === null || this.end === null) return false
    const bounds = shapeBounds(this.start, this.end)
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    if (this.tool === 'line' || this.tool === 'arrow') {
      return Math.hypot(width, height) >= this.minSize
    }
    return width >= this.minSize && height >= this.minSize
  }

  private handleDown(sample: PointerSample): ShapeBuilderEvent {
    if (!isFiniteSample(sample)) return { type: 'ignored' }
    if (this.isActive) {
      const previous = this.buildObject()
      this.beginShape(sample)
      if (previous !== null) {
        return {
          type: 'completed',
          object: previous,
          endedBy: 'interrupted',
          startedNewShape: true,
        }
      }
      return { type: 'started' }
    }
    this.beginShape(sample)
    return { type: 'started' }
  }

  private finishFromEvent(reason: 'up' | 'cancel'): ShapeBuilderEvent {
    if (!this.isActive) return { type: 'ignored' }
    const object = this.buildObject()
    if (object === null) {
      return { type: 'discarded', reason: 'too-small' }
    }
    return { type: 'completed', object, endedBy: reason }
  }

  private beginShape(sample: PointerSample): void {
    this.reset()
    this.shapeId = createObjectId()
    this.createdAt = Date.now()
    this.start = { ...sample.position }
    this.end = { ...sample.position }
  }

  private buildObject(): ShapeObject | null {
    if (this.shapeId === null || this.start === null || this.end === null) {
      this.reset()
      return null
    }
    if (!this.isViable()) {
      this.reset()
      return null
    }
    const object = this.createShape({
      id: this.shapeId,
      createdAt: this.createdAt,
      start: this.start,
      end: this.end,
    })
    this.reset()
    return object
  }

  private createShape(input: {
    id: ObjectId
    createdAt: number
    start: Point
    end: Point
  }): ShapeObject {
    const factoryInput = {
      surfaceId: this.surfaceId,
      id: input.id,
      createdAt: input.createdAt,
      start: input.start,
      end: input.end,
      style: this.style,
    }
    switch (this.tool) {
      case 'line':
        return createLine(factoryInput)
      case 'rectangle':
        return createRectangle(factoryInput)
      case 'ellipse':
        return createEllipse(factoryInput)
      case 'arrow':
        return createArrow(factoryInput)
    }
  }

  private reset(): void {
    this.shapeId = null
    this.createdAt = 0
    this.start = null
    this.end = null
  }
}

function isFiniteSample(sample: PointerSample): boolean {
  return Number.isFinite(sample.position.x) && Number.isFinite(sample.position.y)
}
