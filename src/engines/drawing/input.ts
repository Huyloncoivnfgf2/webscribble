/**
 * Input Manager của Drawing Engine (TASK-05B).
 *
 * Tầng tiếp nhận và chuẩn hóa đầu vào Pointer Events (mouse / touch /
 * stylus) thành các mẫu (sample) thống nhất cho Drawing Engine.
 *
 * Nguyên tắc:
 * - Đây là Input Manager DUY NHẤT cho cả 3 chế độ (DEC-015) — nó không
 *   biết gì về PDF, DOCX, bảng trắng hay surface nào đang hiển thị.
 * - Manager KHÔNG tự vẽ, KHÔNG tạo DrawingObject, KHÔNG quản lý
 *   history/undo. Nó chỉ phát ra các sự kiện đã chuẩn hóa qua callback;
 *   tầng xây nét (stroke builder, task sau) sẽ biến chuỗi sample thành
 *   StrokeObject.
 * - Tọa độ được chuẩn hóa về WORLD coordinates ngay tại đây (qua
 *   Camera hiện tại + `screenToWorld`), vì dữ liệu của Drawing Engine
 *   luôn là world coordinates (TASK-05A).
 * - Chỉ MỘT pointer được theo dõi tại một thời điểm: pointer thứ hai
 *   (kể cả chạm đa điểm) bị bỏ qua hoàn toàn — TASK-05B không triển
 *   khai multi-touch gesture.
 */

import { screenToWorld, type Camera } from './coordinates'
import type { Point } from './types'

/** Loại thiết bị trỏ đã chuẩn hóa. */
export type PointerKind = 'mouse' | 'touch' | 'pen' | 'unknown'

/**
 * Pressure dùng thay thế khi thiết bị/trình duyệt không cung cấp lực
 * nhấn thật nhưng pointer đang ở trạng thái nhấn — khớp quy ước của
 * StrokePoint (types.ts): 0.5 khi thiết bị không có pressure.
 */
export const FALLBACK_PRESSURE = 0.5

/** Một mẫu đầu vào đã chuẩn hóa, tại một thời điểm của một pointer. */
export interface PointerSample {
  pointerId: number
  pointerType: PointerKind
  /** Vị trí trong WORLD coordinates của bề mặt. */
  position: Point
  /** Vị trí theo CSS px tương đối với góc trên-trái của phần tử đích. */
  screenPosition: Point
  /** Lực nhấn đã chuẩn hóa về 0..1 (xem `normalizePressure`). */
  pressure: number
  /** Độ nghiêng bút theo trục X, độ, -90..90; 0 khi không có dữ liệu. */
  tiltX: number
  /** Độ nghiêng bút theo trục Y, độ, -90..90; 0 khi không có dữ liệu. */
  tiltY: number
  /**
   * Mốc thời gian của sự kiện gốc (`PointerEvent.timeStamp`, ms).
   * Lớp xây nét trừ đi time của sample 'down' để ra `StrokePoint.time`
   * tương đối theo DEC-025.
   */
  time: number
  /** Mặt nạ nút đang nhấn của sự kiện gốc (`PointerEvent.buttons`). */
  buttons: number
}

export type PointerInputEventType = 'down' | 'move' | 'up' | 'cancel'

/** Sự kiện đầu vào đã chuẩn hóa mà Input Manager phát ra. */
export interface PointerInputEvent {
  type: PointerInputEventType
  sample: PointerSample
}

export type PointerInputHandler = (event: PointerInputEvent) => void

/**
 * Phần tối thiểu của DOM PointerEvent mà Input Manager cần. Trình
 * duyệt truyền PointerEvent thật (thỏa mãn cấu trúc này); unit test
 * truyền đối tượng giả — nhờ vậy logic chuẩn hóa kiểm thử được mà
 * không cần môi trường DOM.
 */
export interface PointerEventLike {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
  pressure?: number
  tiltX?: number
  tiltY?: number
  button?: number
  buttons?: number
  isPrimary?: boolean
  timeStamp: number
  getCoalescedEvents?: () => PointerEventLike[]
}

/**
 * Phần tối thiểu của phần tử đích (HTMLElement trong trình duyệt)
 * mà Input Manager cần: nghe sự kiện, pointer capture và vị trí hiển
 * thị để đổi tọa độ client → tọa độ phần tử.
 */
export interface PointerTargetLike {
  addEventListener(type: string, listener: (event: PointerEventLike) => void): void
  removeEventListener(type: string, listener: (event: PointerEventLike) => void): void
  setPointerCapture(pointerId: number): void
  releasePointerCapture(pointerId: number): void
  hasPointerCapture(pointerId: number): boolean
  getBoundingClientRect(): { left: number; top: number }
}

/** Chuẩn hóa `pointerType` thô của trình duyệt. */
export function normalizePointerKind(raw: string | undefined): PointerKind {
  switch (raw) {
    case 'mouse':
    case 'touch':
    case 'pen':
      return raw
    default:
      return 'unknown'
  }
}

/**
 * Chuẩn hóa pressure về 0..1:
 * - Giá trị hữu hạn: kẹp về [0, 1]. Riêng trường hợp giá trị = 0 trong
 *   lúc đang nhấn ở thiết bị KHÔNG phải bút (mouse/touch thường không
 *   có cảm biến lực; một số trình duyệt báo 0 thay vì 0.5 theo đặc tả)
 *   → dùng FALLBACK_PRESSURE. Với bút, 0 là dữ liệu thật (chạm rất
 *   nhẹ/nghiêng) nên giữ nguyên.
 * - Thiếu dữ liệu (undefined/NaN — trình duyệt cũ): FALLBACK_PRESSURE
 *   khi đang nhấn, 0 khi không nhấn.
 */
export function normalizePressure(
  raw: number | undefined,
  kind: PointerKind,
  buttonsPressed: boolean,
): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const clamped = Math.min(1, Math.max(0, raw))
    if (clamped === 0 && buttonsPressed && kind !== 'pen') {
      return FALLBACK_PRESSURE
    }
    return clamped
  }
  return buttonsPressed ? FALLBACK_PRESSURE : 0
}

/** Chuẩn hóa độ nghiêng: kẹp về [-90, 90]; thiếu dữ liệu → 0. */
export function normalizeTilt(raw: number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(90, Math.max(-90, raw))
  }
  return 0
}

/**
 * Đổi một sự kiện pointer thô thành PointerSample: tọa độ client →
 * tọa độ phần tử (trừ góc của rect) → world coordinates qua camera.
 * Trả về null khi dữ liệu cốt lõi không hợp lệ (pointerId hoặc tọa độ
 * không phải số hữu hạn) — sự kiện như vậy bị Input Manager bỏ qua.
 */
export function pointerEventToSample(
  event: PointerEventLike,
  rect: { left: number; top: number },
  camera: Camera,
): PointerSample | null {
  if (!Number.isFinite(event.pointerId)) return null
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null
  const screenPosition: Point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  const kind = normalizePointerKind(event.pointerType)
  const buttons = typeof event.buttons === 'number' && Number.isFinite(event.buttons)
    ? event.buttons
    : 0
  return {
    pointerId: event.pointerId,
    pointerType: kind,
    position: screenToWorld(screenPosition, camera),
    screenPosition,
    pressure: normalizePressure(event.pressure, kind, (buttons & 1) !== 0),
    tiltX: normalizeTilt(event.tiltX),
    tiltY: normalizeTilt(event.tiltY),
    time: Number.isFinite(event.timeStamp) ? event.timeStamp : 0,
    buttons,
  }
}

export interface PointerInputManagerOptions {
  target: PointerTargetLike
  /**
   * Cung cấp Camera hiện tại của bề mặt; được gọi lại cho MỌI sự kiện
   * để pan/zoom thay đổi giữa chừng vẫn cho tọa độ đúng.
   */
  getCamera: () => Camera
  onEvent: PointerInputHandler
}

/**
 * Input Manager: gắn vào một phần tử đích, nghe pointerdown/move/up/
 * cancel và phát sự kiện đã chuẩn hóa. Vòng đời: `attach()` để bắt đầu
 * nghe, `detach()` để gỡ (gọi lại attach/detach nhiều lần là an toàn).
 *
 * Trong lúc một pointer đang hoạt động (đã down, chưa up/cancel), mọi
 * sự kiện của pointer khác đều bị bỏ qua. Pointer đang hoạt động được
 * set pointer capture ngay khi down để move/up ngoài phần tử vẫn tới
 * được manager; capture được giải phóng khi up/cancel.
 */
export class PointerInputManager {
  private readonly target: PointerTargetLike
  private readonly getCamera: () => Camera
  private readonly onEvent: PointerInputHandler
  private attached = false
  private currentPointerId: number | null = null

  constructor(options: PointerInputManagerOptions) {
    this.target = options.target
    this.getCamera = options.getCamera
    this.onEvent = options.onEvent
  }

  /** ID của pointer đang hoạt động, hoặc null khi không có thao tác nào. */
  get activePointerId(): number | null {
    return this.currentPointerId
  }

  get isAttached(): boolean {
    return this.attached
  }

  attach(): void {
    if (this.attached) return
    this.target.addEventListener('pointerdown', this.handleDown)
    this.target.addEventListener('pointermove', this.handleMove)
    this.target.addEventListener('pointerup', this.handleUp)
    this.target.addEventListener('pointercancel', this.handleCancel)
    this.attached = true
  }

  detach(): void {
    if (!this.attached) return
    this.target.removeEventListener('pointerdown', this.handleDown)
    this.target.removeEventListener('pointermove', this.handleMove)
    this.target.removeEventListener('pointerup', this.handleUp)
    this.target.removeEventListener('pointercancel', this.handleCancel)
    this.attached = false
    this.reset()
  }

  /**
   * Đặt lại trạng thái theo dõi: bỏ pointer đang hoạt động và giải
   * phóng capture của nó mà KHÔNG phát sự kiện. Dùng khi tầng trên đổi
   * ngữ cảnh giữa một thao tác (ví dụ DrawingEngine đổi công cụ giữa
   * nét): sau reset, phần còn lại của thao tác vật lý cũ (move/up)
   * bị bỏ qua và pointer chỉ hoạt động lại từ lần down kế tiếp.
   */
  reset(): void {
    if (this.currentPointerId !== null) {
      this.releaseCapture(this.currentPointerId)
      this.currentPointerId = null
    }
  }

  private toSample(event: PointerEventLike): PointerSample | null {
    return pointerEventToSample(event, this.target.getBoundingClientRect(), this.getCamera())
  }

  private capture(pointerId: number): void {
    try {
      this.target.setPointerCapture(pointerId)
    } catch {
      // Một số trình duyệt ném lỗi nếu pointer không còn hoạt động;
      // thiếu capture không được phép làm hỏng luồng nhập liệu.
    }
  }

  private releaseCapture(pointerId: number): void {
    try {
      if (this.target.hasPointerCapture(pointerId)) {
        this.target.releasePointerCapture(pointerId)
      }
    } catch {
      // Giải phóng capture thất bại không được phép làm hỏng luồng.
    }
  }

  private handleDown = (event: PointerEventLike): void => {
    if (this.currentPointerId !== null) return // đang có thao tác khác
    if (event.isPrimary === false) return // chỉ pointer chính
    if (typeof event.button === 'number' && event.button !== 0) return // chỉ nút chính
    const sample = this.toSample(event)
    if (sample === null) return
    this.currentPointerId = sample.pointerId
    this.capture(sample.pointerId)
    this.onEvent({ type: 'down', sample })
  }

  private handleMove = (event: PointerEventLike): void => {
    if (this.currentPointerId === null || event.pointerId !== this.currentPointerId) return
    if (event.isPrimary === false) return
    // Ưu tiên các sự kiện con đã gộp (coalesced) để không mất điểm
    // trên thiết bị tần suất cao; trình duyệt không hỗ trợ thì dùng
    // chính sự kiện này (feature-detect, xem ISSUE-006).
    const coalesced = typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : undefined
    const rawEvents = coalesced !== undefined && coalesced.length > 0 ? coalesced : [event]
    for (const raw of rawEvents) {
      const sample = this.toSample(raw)
      if (sample !== null) {
        this.onEvent({ type: 'move', sample })
      }
    }
  }

  private handleUp = (event: PointerEventLike): void => {
    this.finishStroke(event, 'up')
  }

  private handleCancel = (event: PointerEventLike): void => {
    this.finishStroke(event, 'cancel')
  }

  private finishStroke(event: PointerEventLike, type: 'up' | 'cancel'): void {
    if (this.currentPointerId === null || event.pointerId !== this.currentPointerId) return
    const pointerId = this.currentPointerId
    const sample = this.toSample(event)
    try {
      // Sự kiện kết thúc có dữ liệu hỏng vẫn phải kết thúc thao tác;
      // khi đó bỏ qua việc phát sự kiện nhưng vẫn dọn trạng thái.
      if (sample !== null) {
        this.onEvent({ type, sample })
      }
    } finally {
      this.releaseCapture(pointerId)
      this.currentPointerId = null
    }
  }
}
