/**
 * Tự cuộn khi viết (TASK-14A) — Drawing Engine dùng chung (DEC-015).
 *
 * Khi người dùng vẽ một nét dài và con trỏ tiến gần mép dưới hoặc
 * mép phải của khung cuộn, khung tự cuộn theo để nét vẽ tiếp tục
 * được — hành vi quen thuộc của các app viết tay (Scrble Ink...).
 * Phạm vi đã chốt: CHỈ mép dưới và mép phải (hướng viết tự nhiên
 * trái→phải, trên→xuống); CHỈ khi đang vẽ bằng công cụ nét
 * (pen/highlighter) — không cuộn khi chọn hoặc tẩy.
 *
 * Tầng này thuần logic + một controller framework-free:
 * - `computeAutoScrollVelocity` là hàm thuần: vị trí con trỏ
 *   (client) + hình chữ nhật của khung cuộn -> vận tốc cuộn
 *   (px/giây) theo từng trục.
 * - `AutoScrollController` giữ vòng requestAnimationFrame: mỗi
 *   frame cộng vận tốc × dt vào scrollTop/scrollLeft của khung.
 * - `attachAutoScroll` nối controller với sự kiện pointer trên
 *   canvas vẽ và cổng theo công cụ; tầng UI chỉ cung cấp callback
 *   `onScrolled` (phát pointermove tổng hợp để Input Manager —
 *   vốn đọc lại getBoundingClientRect cho MỌI sự kiện — tự nối
 *   dài nét theo tọa độ world mới sau khi cuộn).
 *
 * Tọa độ vẽ KHÔNG đi qua file này: Input Manager (input.ts) đổi
 * client -> world qua coordinates.ts như cũ; cuộn DOM chỉ dời
 * vị trí hiển thị của canvas, rect đọc lại mỗi sự kiện nên các
 * điểm tiếp theo tự khớp. Camera/dữ liệu nét không bị đụng tới.
 */

import type { Point } from './types'

/** Hình chữ nhật hiển thị của khung cuộn (CSS px, tọa độ client). */
export interface AutoScrollRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AutoScrollOptions {
  /** Độ rộng vùng đệm tính từ mép (px): vào sâu trong vùng này thì bắt đầu cuộn. */
  edgeThresholdPx: number
  /** Tốc độ cuộn tối đa khi con trỏ chạm/sát mép (px/giây). */
  maxSpeedPxPerSecond: number
}

export const DEFAULT_AUTO_SCROLL_OPTIONS: AutoScrollOptions = {
  edgeThresholdPx: 48,
  maxSpeedPxPerSecond: 600,
}

function sanitizeOptions(
  options: Partial<AutoScrollOptions> | undefined,
): AutoScrollOptions {
  const edge = options?.edgeThresholdPx
  const max = options?.maxSpeedPxPerSecond
  return {
    edgeThresholdPx:
      typeof edge === 'number' && Number.isFinite(edge) && edge > 0
        ? edge
        : DEFAULT_AUTO_SCROLL_OPTIONS.edgeThresholdPx,
    maxSpeedPxPerSecond:
      typeof max === 'number' && Number.isFinite(max) && max >= 0
        ? max
        : DEFAULT_AUTO_SCROLL_OPTIONS.maxSpeedPxPerSecond,
  }
}

/**
 * Tốc độ trên một trục theo khoảng cách từ điểm tới mép đang xét:
 * ngoài vùng đệm -> 0; chạm mép hoặc ra ngoài khung -> tối đa;
 * ở giữa vùng đệm -> tỉ lệ tuyến tính theo độ sâu.
 */
function axisSpeed(distanceToEdge: number, edge: number, max: number): number {
  if (!Number.isFinite(distanceToEdge)) return 0
  if (distanceToEdge >= edge) return 0
  if (distanceToEdge <= 0) return max
  return max * (1 - distanceToEdge / edge)
}

/**
 * Vận tốc cuộn (px/giây) cho một vị trí con trỏ. Chỉ hai mép
 * dưới (vy > 0) và phải (vx > 0) được xét; mép trên/trái luôn 0.
 * Dữ liệu không hợp lệ (NaN) cho vận tốc 0 — thà không cuộn còn
 * hơn cuộn sai.
 */
export function computeAutoScrollVelocity(
  clientPoint: Point,
  rect: AutoScrollRect,
  options?: Partial<AutoScrollOptions>,
): { vx: number; vy: number } {
  if (
    !Number.isFinite(clientPoint.x) ||
    !Number.isFinite(clientPoint.y) ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height)
  ) {
    return { vx: 0, vy: 0 }
  }
  const { edgeThresholdPx, maxSpeedPxPerSecond } = sanitizeOptions(options)
  return {
    vx: axisSpeed(
      rect.left + rect.width - clientPoint.x,
      edgeThresholdPx,
      maxSpeedPxPerSecond,
    ),
    vy: axisSpeed(
      rect.top + rect.height - clientPoint.y,
      edgeThresholdPx,
      maxSpeedPxPerSecond,
    ),
  }
}

/** Phần tối thiểu của một phần tử cuộn được mà controller cần. */
export interface ScrollContainerLike {
  getBoundingClientRect(): AutoScrollRect
  scrollTop: number
  scrollLeft: number
}

/** Bộ lập lịch khung hình tiêm được (mặc định: rAF của trình duyệt). */
export interface FrameSchedulerLike {
  request(callback: (time: number) => void): number
  cancel(id: number): void
}

const defaultScheduler: FrameSchedulerLike = {
  request(callback) {
    const raf = (globalThis as { requestAnimationFrame?: unknown })
      .requestAnimationFrame
    if (typeof raf === 'function') {
      return (raf as (cb: (time: number) => void) => number).call(
        globalThis,
        callback,
      )
    }
    return 0
  },
  cancel(id) {
    const caf = (globalThis as { cancelAnimationFrame?: unknown })
      .cancelAnimationFrame
    if (typeof caf === 'function') {
      ;(caf as (handle: number) => void).call(globalThis, id)
    }
  },
}

export interface AutoScrollDelta {
  dx: number
  dy: number
}

export interface AutoScrolledInfo {
  /** Độ cuộn THỰC TẾ vừa áp (sau khi container tự kẹp ở biên). */
  delta: AutoScrollDelta
  /** Vị trí client gần nhất của pointer đang vẽ. */
  clientPoint: Point
  pointerId: number
  pointerType: string
}

export interface AutoScrollControllerOptions {
  container: ScrollContainerLike
  scheduler?: FrameSchedulerLike
  options?: Partial<AutoScrollOptions>
  onScrolled?: (info: AutoScrolledInfo) => void
}

/** Giới hạn dt của một frame để tab bị treo lâu không gây cú nhảy cuộn lớn. */
const MAX_FRAME_DT_SECONDS = 0.1

/**
 * Vòng lặp tự cuộn cho MỘT pointer đang vẽ. `start` khi pointer
 * xuống, `updatePointer` theo mỗi move, `stop` khi pointer lên/
 * hủy. Controller không tự nghe sự kiện DOM — dùng `attachAutoScroll`
 * hoặc tự nối ở tầng trên.
 */
export class AutoScrollController {
  private readonly container: ScrollContainerLike
  private readonly scheduler: FrameSchedulerLike
  private readonly scrollOptions: AutoScrollOptions
  private readonly onScrolled: ((info: AutoScrolledInfo) => void) | undefined
  private frameId: number | null = null
  private lastTime: number | null = null
  private pointer: Point | null = null
  private activePointerId: number | null = null
  private activePointerType = 'unknown'

  constructor(options: AutoScrollControllerOptions) {
    this.container = options.container
    this.scheduler = options.scheduler ?? defaultScheduler
    this.scrollOptions = sanitizeOptions(options.options)
    this.onScrolled = options.onScrolled
  }

  get isActive(): boolean {
    return this.frameId !== null
  }

  get pointerId(): number | null {
    return this.activePointerId
  }

  start(pointerId: number, clientPoint: Point, pointerType = 'unknown'): void {
    this.activePointerId = pointerId
    this.activePointerType = pointerType
    this.pointer = { x: clientPoint.x, y: clientPoint.y }
    if (this.frameId === null) {
      this.lastTime = null
      this.frameId = this.scheduler.request(this.tick)
    }
  }

  updatePointer(clientPoint: Point): void {
    if (this.activePointerId === null) return
    this.pointer = { x: clientPoint.x, y: clientPoint.y }
  }

  stop(): void {
    if (this.frameId !== null) {
      this.scheduler.cancel(this.frameId)
      this.frameId = null
    }
    this.lastTime = null
    this.pointer = null
    this.activePointerId = null
    this.activePointerType = 'unknown'
  }

  private tick = (time: number): void => {
    this.frameId = null
    if (this.activePointerId === null || this.pointer === null) return
    const dt =
      this.lastTime === null
        ? 0
        : Math.min(
            MAX_FRAME_DT_SECONDS,
            Math.max(0, (time - this.lastTime) / 1000),
          )
    this.lastTime = time
    if (dt > 0) {
      const velocity = computeAutoScrollVelocity(
        this.pointer,
        this.container.getBoundingClientRect(),
        this.scrollOptions,
      )
      const dx = velocity.vx * dt
      const dy = velocity.vy * dt
      if (dx !== 0 || dy !== 0) {
        const beforeLeft = this.container.scrollLeft
        const beforeTop = this.container.scrollTop
        this.container.scrollLeft = beforeLeft + dx
        this.container.scrollTop = beforeTop + dy
        const actual: AutoScrollDelta = {
          dx: this.container.scrollLeft - beforeLeft,
          dy: this.container.scrollTop - beforeTop,
        }
        if (
          (actual.dx !== 0 || actual.dy !== 0) &&
          this.onScrolled !== undefined &&
          this.activePointerId !== null &&
          this.pointer !== null
        ) {
          this.onScrolled({
            delta: actual,
            clientPoint: { ...this.pointer },
            pointerId: this.activePointerId,
            pointerType: this.activePointerType,
          })
        }
      }
    }
    this.frameId = this.scheduler.request(this.tick)
  }
}

/**
 * Cổng công cụ: tự cuộn CHỈ bật khi đang vẽ nét. Select, tẩy,
 * hình khối, chữ — không cuộn (đúng phạm vi TASK-14A).
 */
export function shouldAutoScrollForTool(tool: string): boolean {
  return tool === 'pen' || tool === 'highlighter'
}

/** Phần tối thiểu của sự kiện pointer mà attach cần đọc. */
export interface AutoScrollPointerEventLike {
  pointerId: number
  clientX: number
  clientY: number
  isPrimary?: boolean
  pointerType?: string
}

/** Phần tối thiểu của phần tử đích (canvas vẽ) mà attach cần. */
export interface AutoScrollTargetLike {
  addEventListener(
    type: string,
    listener: (event: AutoScrollPointerEventLike) => void,
  ): void
  removeEventListener(
    type: string,
    listener: (event: AutoScrollPointerEventLike) => void,
  ): void
}

export interface AttachAutoScrollOptions {
  target: AutoScrollTargetLike
  container: ScrollContainerLike
  /** Đọc tươi tại thời điểm pointerdown: công cụ hiện tại có phải công cụ nét không. */
  isEnabled: () => boolean
  onScrolled: (info: AutoScrolledInfo) => void
  scheduler?: FrameSchedulerLike
  options?: Partial<AutoScrollOptions>
}

/**
 * Nối tự cuộn vào một canvas vẽ: nghe pointerdown/move/up/cancel
 * trên chính canvas (song song với Input Manager — không chặn,
 * không sửa sự kiện nào). Chỉ theo dõi pointer chính đầu tiên;
 * pointer thứ hai bị bỏ qua. Trả về hàm gỡ sạch listener + dừng
 * vòng cuộn.
 */
export function attachAutoScroll(options: AttachAutoScrollOptions): () => void {
  const controller = new AutoScrollController({
    container: options.container,
    scheduler: options.scheduler,
    options: options.options,
    onScrolled: options.onScrolled,
  })
  let trackedPointerId: number | null = null

  const handleDown = (event: AutoScrollPointerEventLike): void => {
    if (trackedPointerId !== null) return
    if (event.isPrimary === false) return
    if (!options.isEnabled()) return
    trackedPointerId = event.pointerId
    controller.start(
      event.pointerId,
      { x: event.clientX, y: event.clientY },
      typeof event.pointerType === 'string' ? event.pointerType : 'unknown',
    )
  }
  const handleMove = (event: AutoScrollPointerEventLike): void => {
    if (trackedPointerId === null || event.pointerId !== trackedPointerId) {
      return
    }
    controller.updatePointer({ x: event.clientX, y: event.clientY })
  }
  const handleEnd = (event: AutoScrollPointerEventLike): void => {
    if (trackedPointerId === null || event.pointerId !== trackedPointerId) {
      return
    }
    trackedPointerId = null
    controller.stop()
  }

  options.target.addEventListener('pointerdown', handleDown)
  options.target.addEventListener('pointermove', handleMove)
  options.target.addEventListener('pointerup', handleEnd)
  options.target.addEventListener('pointercancel', handleEnd)
  return () => {
    options.target.removeEventListener('pointerdown', handleDown)
    options.target.removeEventListener('pointermove', handleMove)
    options.target.removeEventListener('pointerup', handleEnd)
    options.target.removeEventListener('pointercancel', handleEnd)
    trackedPointerId = null
    controller.stop()
  }
}

/**
 * Phát một pointermove TỔNG HỢP trên canvas sau khi khung đã
 * cuộn: con trỏ vật lý đứng yên thì trình duyệt không phát move
 * mới, trong khi điểm world dưới con trỏ đã đổi — sự kiện tổng
 * hợp này (đúng pointerId/client cũ) làm Input Manager đọc rect
 * mới và nối dài nét. Trả về false khi môi trường không có
 * PointerEvent (khi đó nét chỉ tiếp tục ở move thật kế tiếp).
 */
export function dispatchAutoScrollMove(
  target: { dispatchEvent(event: Event): boolean },
  info: AutoScrolledInfo,
): boolean {
  const Ctor = (
    globalThis as { PointerEvent?: typeof PointerEvent }
  ).PointerEvent
  if (typeof Ctor !== 'function') return false
  const event = new Ctor('pointermove', {
    bubbles: false,
    cancelable: false,
    pointerId: info.pointerId,
    pointerType: info.pointerType,
    clientX: info.clientPoint.x,
    clientY: info.clientPoint.y,
    buttons: 1,
    isPrimary: true,
  })
  return target.dispatchEvent(event)
}
