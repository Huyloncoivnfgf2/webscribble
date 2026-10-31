/**
 * Stroke Builder (TASK-05C, Phần A): tầng biến chuỗi PointerInputEvent
 * (từ Input Manager, TASK-05B) thành DrawingObject loại pen/highlighter
 * hoàn chỉnh (mô hình dữ liệu TASK-05A).
 *
 * Quy tắc đã thiết kế:
 * - `down` bắt đầu nét mới (sinh ID + createdAt ngay từ đầu để bản xem
 *   trước và object cuối cùng dùng chung một ID), `move` thêm điểm,
 *   `up` hoàn tất nét.
 * - **`cancel` = hoàn tất nét và GIỮ phần đã vẽ**, giống `up`, chỉ khác
 *   ở trường `endedBy` của kết quả: pointercancel hầu như luôn do hệ
 *   thống cướp cử chỉ (cuộn trang, thông báo…) chứ không phải ý định
 *   xóa của người dùng — vứt nét sẽ làm mất dữ liệu oan. Tầng tích hợp
 *   đọc `endedBy` nếu muốn chính sách khác.
 * - Nét đang dở gặp `down` mới (gián đoạn): nét cũ được hoàn tất với
 *   `endedBy: 'interrupted'` trước khi nét mới bắt đầu — không mất nét.
 * - `StrokePoint.time` là ms tương đối từ điểm đầu của nét (DEC-025);
 *   thời gian không bao giờ giảm (mẫu đến muộn/lệch đồng hồ bị kẹp về
 *   mốc của điểm trước) để dữ liệu luôn qua được validation (TASK-05A).
 * - Điểm trùng hoàn toàn (x, y, pressure) với điểm liền trước bị bỏ
 *   qua: không mang thêm hình học, chỉ phình dữ liệu.
 * - Raw points là dữ liệu chính; builder không tạo bitmap, không tạo
 *   outline. Bounds do factory của TASK-05A tính khi hoàn tất nét
 *   (strokeBounds, đã gồm nửa độ dày nét).
 */

import { expandBounds } from './geometry'
import {
  createHighlighterStroke,
  createObjectId,
  createPenStroke,
  DEFAULT_HIGHLIGHTER_STYLE,
  DEFAULT_PEN_STYLE,
} from './objects'
import type {
  Bounds,
  ObjectId,
  StrokeObject,
  StrokePoint,
  StrokeStyle,
  SurfaceId,
} from './types'
import type { PointerInputEvent, PointerSample } from './input'

export type StrokeTool = 'pen' | 'highlighter'

/** Lý do một nét kết thúc. */
export type StrokeEndReason = 'up' | 'cancel' | 'interrupted'

export type StrokeBuilderEvent =
  | { type: 'started' }
  | { type: 'updated' }
  | {
      type: 'completed'
      object: StrokeObject
      endedBy: StrokeEndReason
      /** True khi nét hoàn tất này bị một `down` mới ngắt (và nét mới đã bắt đầu). */
      startedNewStroke?: boolean
    }
  | { type: 'ignored' }

export interface StrokeBuilderOptions {
  surfaceId: SurfaceId
  tool: StrokeTool
  style?: Partial<StrokeStyle>
}

export class StrokeBuilder {
  private readonly surfaceId: SurfaceId
  private readonly tool: StrokeTool
  private readonly style: Partial<StrokeStyle> | undefined

  private points: StrokePoint[] = []
  private pointBounds: Bounds | null = null
  private strokeId: ObjectId | null = null
  private createdAt = 0
  private startTime = 0

  constructor(options: StrokeBuilderOptions) {
    this.surfaceId = options.surfaceId
    this.tool = options.tool
    this.style = options.style
  }

  get isActive(): boolean {
    return this.strokeId !== null
  }

  get pointCount(): number {
    return this.points.length
  }

  /** Bản sao các điểm đã thu thập của nét đang vẽ (rỗng nếu không vẽ). */
  get currentPoints(): readonly StrokePoint[] {
    return [...this.points]
  }

  /**
   * Bounds của nét đang vẽ (đã gồm nửa độ dày nét, khớp bounds mà
   * factory sẽ tính khi hoàn tất), hoặc null khi không có nét nào.
   */
  get currentBounds(): Bounds | null {
    if (this.pointBounds === null) return null
    return expandBounds(this.pointBounds, this.resolvedStyle().size / 2)
  }

  /** Xử lý một sự kiện đầu vào đã chuẩn hóa. */
  handleEvent(event: PointerInputEvent): StrokeBuilderEvent {
    switch (event.type) {
      case 'down':
        return this.handleDown(event.sample)
      case 'move': {
        if (!this.isActive) return { type: 'ignored' }
        this.appendSample(event.sample)
        return { type: 'updated' }
      }
      case 'up':
        return this.finishFromEvent('up', event.sample)
      case 'cancel':
        return this.finishFromEvent('cancel', event.sample)
    }
  }

  /**
   * Hoàn tất nét đang vẽ và trả về object (null nếu không có nét).
   * Tầng tích hợp dùng khi đổi công cụ hoặc detach giữa chừng để
   * không mất phần đã vẽ.
   */
  finishStroke(): StrokeObject | null {
    if (!this.isActive) return null
    return this.buildObject()
  }

  /** Hủy bỏ nét đang vẽ mà KHÔNG tạo object — quyết định tường minh của tầng gọi. */
  abandon(): void {
    this.reset()
  }

  /**
   * Object tạm thời của nét đang vẽ để render xem trước trực tiếp
   * (cùng ID/createdAt với object cuối cùng; điểm là bản sao vì nét
   * còn đang thu thập). Null khi không có nét.
   */
  previewObject(): StrokeObject | null {
    if (!this.isActive || this.strokeId === null || this.points.length === 0) return null
    return this.createStroke({
      id: this.strokeId,
      createdAt: this.createdAt,
      points: [...this.points],
    })
  }

  private handleDown(sample: PointerSample): StrokeBuilderEvent {
    if (!isFiniteSample(sample)) return { type: 'ignored' }
    if (this.isActive) {
      // Gián đoạn: hoàn tất nét cũ trước, rồi bắt đầu nét mới.
      const previous = this.buildObject()
      this.beginStroke(sample)
      return {
        type: 'completed',
        object: previous,
        endedBy: 'interrupted',
        startedNewStroke: true,
      }
    }
    this.beginStroke(sample)
    return { type: 'started' }
  }

  private finishFromEvent(
    reason: 'up' | 'cancel',
    sample: PointerSample,
  ): StrokeBuilderEvent {
    if (!this.isActive) return { type: 'ignored' }
    // Điểm cuối của thao tác (vị trí nhả bút) thuộc về nét: bổ sung
    // trước khi hoàn tất, nếu không nét sẽ cụt tại sự kiện move cuối
    // (phát hiện ở TASK-05G — ShapeBuilder và Selection builder đều
    // đã áp vị trí up). Chỉ bổ sung khi vị trí THỰC SỰ khác điểm cuối
    // hiện tại: mẫu up/cancel thường có pressure = 0 nên phép khử
    // trùng theo cả pressure của appendSample không loại được nó,
    // nhưng một điểm trùng vị trí không thêm hình học nào cho nét.
    const last = this.points[this.points.length - 1]
    if (
      last === undefined ||
      last.x !== sample.position.x ||
      last.y !== sample.position.y
    ) {
      this.appendSample(sample)
    }
    const object = this.buildObject()
    return { type: 'completed', object, endedBy: reason }
  }

  private beginStroke(sample: PointerSample): void {
    this.reset()
    this.strokeId = createObjectId()
    this.createdAt = Date.now()
    this.startTime = sample.time
    this.appendSample(sample)
  }

  private appendSample(sample: PointerSample): void {
    if (!isFiniteSample(sample)) return
    const last = this.points[this.points.length - 1]
    const relative = Math.max(0, sample.time - this.startTime)
    const time = last === undefined ? 0 : Math.max(last.time, relative)
    const pressure = clamp01(sample.pressure)
    const point = { x: sample.position.x, y: sample.position.y, pressure, time }
    if (
      last !== undefined &&
      last.x === point.x &&
      last.y === point.y &&
      last.pressure === point.pressure
    ) {
      return // điểm trùng hoàn toàn — bỏ qua
    }
    this.points.push(point)
    this.pointBounds = this.pointBounds === null
      ? { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
      : {
          minX: Math.min(this.pointBounds.minX, point.x),
          minY: Math.min(this.pointBounds.minY, point.y),
          maxX: Math.max(this.pointBounds.maxX, point.x),
          maxY: Math.max(this.pointBounds.maxY, point.y),
        }
  }

  private buildObject(): StrokeObject {
    if (this.strokeId === null || this.points.length === 0) {
      throw new Error('StrokeBuilder: cannot finish a stroke with no points')
    }
    // Chuyển quyền sở hữu mảng điểm cho object; builder bắt đầu mảng mới.
    const points = this.points
    const object = this.createStroke({
      id: this.strokeId,
      createdAt: this.createdAt,
      points,
    })
    this.reset()
    return object
  }

  private createStroke(input: {
    id: ObjectId
    createdAt: number
    points: readonly StrokePoint[]
  }): StrokeObject {
    const factoryInput = {
      surfaceId: this.surfaceId,
      id: input.id,
      createdAt: input.createdAt,
      points: input.points,
      style: this.style,
    }
    return this.tool === 'pen'
      ? createPenStroke(factoryInput)
      : createHighlighterStroke(factoryInput)
  }

  /** Style hiệu dụng (mặc định của công cụ trộn với style tùy chỉnh). */
  private resolvedStyle(): StrokeStyle {
    const base = this.tool === 'pen' ? DEFAULT_PEN_STYLE : DEFAULT_HIGHLIGHTER_STYLE
    return { ...base, ...this.style }
  }

  private reset(): void {
    this.points = []
    this.pointBounds = null
    this.strokeId = null
    this.createdAt = 0
    this.startTime = 0
  }
}

function isFiniteSample(sample: PointerSample): boolean {
  return Number.isFinite(sample.position.x) && Number.isFinite(sample.position.y)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}
