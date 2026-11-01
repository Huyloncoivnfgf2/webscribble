/**
 * Test TASK-14A — tự cuộn khi viết (src/engines/drawing/autoScroll.ts).
 *
 * Ba lớp: (1) hàm thuần tính vận tốc theo vị trí con trỏ; (2)
 * AutoScrollController với container giả + scheduler tay — mô
 * phỏng giữ pointer ở mép dưới và kiểm tra scrollTop tăng đúng
 * tỉ lệ thời gian (test tích hợp theo brief); (3) attachAutoScroll
 * với target giả: cổng theo công cụ, chỉ theo dõi pointer chính
 * đầu tiên, dừng khi pointer lên, gỡ sạch khi detach.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  AutoScrollController,
  attachAutoScroll,
  computeAutoScrollVelocity,
  dispatchAutoScrollMove,
  shouldAutoScrollForTool,
  type AutoScrollPointerEventLike,
  type AutoScrollRect,
  type FrameSchedulerLike,
  type ScrollContainerLike,
} from '../../src/engines/drawing/autoScroll'

const RECT: AutoScrollRect = { left: 0, top: 0, width: 400, height: 300 }
const OPTS = { edgeThresholdPx: 50, maxSpeedPxPerSecond: 600 }

describe('computeAutoScrollVelocity', () => {
  it('vùng an toàn (giữa khung) -> không cuộn', () => {
    expect(computeAutoScrollVelocity({ x: 200, y: 150 }, RECT, OPTS)).toEqual({
      vx: 0,
      vy: 0,
    })
  })

  it('đúng biên vùng đệm -> vẫn 0', () => {
    // Cách mép dưới đúng 50px (bằng ngưỡng) và mép phải đúng 50px.
    expect(computeAutoScrollVelocity({ x: 350, y: 250 }, RECT, OPTS)).toEqual({
      vx: 0,
      vy: 0,
    })
  })

  it('giữa vùng đệm dưới -> tốc độ tỉ lệ tuyến tính', () => {
    // Cách mép dưới 25px = nửa vùng đệm -> nửa tốc độ tối đa.
    const v = computeAutoScrollVelocity({ x: 200, y: 275 }, RECT, OPTS)
    expect(v.vy).toBeCloseTo(300)
    expect(v.vx).toBe(0)
  })

  it('sát mép dưới -> tốc độ tối đa', () => {
    const v = computeAutoScrollVelocity({ x: 200, y: 300 }, RECT, OPTS)
    expect(v.vy).toBe(600)
  })

  it('ngoài khung (qua mép) -> kẹp ở tối đa, không tăng vô hạn', () => {
    const v = computeAutoScrollVelocity({ x: 200, y: 420 }, RECT, OPTS)
    expect(v.vy).toBe(600)
  })

  it('mép phải hoạt động độc lập với trục dọc', () => {
    const v = computeAutoScrollVelocity({ x: 390, y: 100 }, RECT, OPTS)
    expect(v.vx).toBeCloseTo(600 * (1 - 10 / 50))
    expect(v.vy).toBe(0)
  })

  it('cả hai mép cùng lúc -> cả hai trục', () => {
    const v = computeAutoScrollVelocity({ x: 400, y: 300 }, RECT, OPTS)
    expect(v).toEqual({ vx: 600, vy: 600 })
  })

  it('mép trên/trái không bao giờ cuộn ngược', () => {
    const v = computeAutoScrollVelocity({ x: 0, y: 0 }, RECT, OPTS)
    expect(v).toEqual({ vx: 0, vy: 0 })
  })

  it('rect có offset (khung không ở góc cửa sổ) vẫn đúng', () => {
    const rect: AutoScrollRect = { left: 100, top: 200, width: 400, height: 300 }
    // Điểm sát mép dưới thật của khung: y = 200 + 300 = 500.
    const v = computeAutoScrollVelocity({ x: 300, y: 500 }, rect, OPTS)
    expect(v.vy).toBe(600)
  })

  it('dữ liệu NaN -> 0, không ném lỗi', () => {
    expect(
      computeAutoScrollVelocity({ x: Number.NaN, y: 300 }, RECT, OPTS),
    ).toEqual({ vx: 0, vy: 0 })
    expect(
      computeAutoScrollVelocity({ x: 200, y: 300 }, { ...RECT, width: Number.NaN }, OPTS),
    ).toEqual({ vx: 0, vy: 0 })
  })

  it('tốc độ tăng đơn điệu khi tiến dần tới mép', () => {
    const speeds = [260, 275, 290, 299].map(
      (y) => computeAutoScrollVelocity({ x: 200, y }, RECT, OPTS).vy,
    )
    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1])
    }
  })
})

class FakeScheduler implements FrameSchedulerLike {
  private nextId = 1
  private readonly pending = new Map<number, (time: number) => void>()

  request(callback: (time: number) => void): number {
    const id = this.nextId
    this.nextId += 1
    this.pending.set(id, callback)
    return id
  }

  cancel(id: number): void {
    this.pending.delete(id)
  }

  /** Chạy mọi callback đang chờ với mốc thời gian cho trước. */
  step(time: number): void {
    const callbacks = [...this.pending.values()]
    this.pending.clear()
    for (const cb of callbacks) cb(time)
  }

  get pendingCount(): number {
    return this.pending.size
  }
}

class FakeContainer implements ScrollContainerLike {
  scrollTop = 0
  scrollLeft = 0
  private readonly rect: AutoScrollRect

  constructor(rect: AutoScrollRect = RECT) {
    this.rect = rect
  }

  getBoundingClientRect(): AutoScrollRect {
    return this.rect
  }
}

describe('AutoScrollController', () => {
  it('giữ pointer ở mép dưới: scrollTop tăng tỉ lệ theo thời gian', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const controller = new AutoScrollController({
      container,
      scheduler,
      options: OPTS,
    })
    controller.start(1, { x: 200, y: 300 }) // sát mép dưới -> 600px/s
    scheduler.step(0) // frame đầu: dt = 0
    expect(container.scrollTop).toBe(0)
    scheduler.step(100) // +0,1s -> +60px
    expect(container.scrollTop).toBeCloseTo(60)
    scheduler.step(200)
    expect(container.scrollTop).toBeCloseTo(120)
    expect(container.scrollLeft).toBe(0)
    controller.stop()
  })

  it('stop() dừng hẳn: frame sau không cuộn thêm, không còn frame chờ', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const controller = new AutoScrollController({
      container,
      scheduler,
      options: OPTS,
    })
    controller.start(1, { x: 200, y: 300 })
    scheduler.step(0)
    scheduler.step(100)
    const at = container.scrollTop
    controller.stop()
    expect(controller.isActive).toBe(false)
    expect(scheduler.pendingCount).toBe(0)
    scheduler.step(500)
    expect(container.scrollTop).toBe(at)
  })

  it('pointer trong vùng an toàn: vòng lặp chạy nhưng không cuộn', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const onScrolled = vi.fn()
    const controller = new AutoScrollController({
      container,
      scheduler,
      options: OPTS,
      onScrolled,
    })
    controller.start(1, { x: 200, y: 150 })
    scheduler.step(0)
    scheduler.step(100)
    scheduler.step(200)
    expect(container.scrollTop).toBe(0)
    expect(onScrolled).not.toHaveBeenCalled()
    expect(controller.isActive).toBe(true) // vẫn theo dõi, chỉ là chưa cần cuộn
    controller.stop()
  })

  it('updatePointer vào vùng mép mới bắt đầu cuộn; onScrolled nhận delta + pointer', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const onScrolled = vi.fn()
    const controller = new AutoScrollController({
      container,
      scheduler,
      options: OPTS,
      onScrolled,
    })
    controller.start(7, { x: 200, y: 150 }, 'pen')
    scheduler.step(0)
    scheduler.step(100)
    expect(container.scrollTop).toBe(0)
    controller.updatePointer({ x: 390, y: 150 }) // sát mép phải
    scheduler.step(200)
    expect(container.scrollLeft).toBeGreaterThan(0)
    expect(container.scrollTop).toBe(0)
    expect(onScrolled).toHaveBeenCalled()
    const info = onScrolled.mock.calls[0][0] as {
      pointerId: number
      pointerType: string
      clientPoint: { x: number; y: number }
      delta: { dx: number; dy: number }
    }
    expect(info.pointerId).toBe(7)
    expect(info.pointerType).toBe('pen')
    expect(info.clientPoint).toEqual({ x: 390, y: 150 })
    expect(info.delta.dx).toBeGreaterThan(0)
    expect(info.delta.dy).toBe(0)
    controller.stop()
  })

  it('dt lớn bất thường (tab treo) bị kẹp, không nhảy cuộn', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const controller = new AutoScrollController({
      container,
      scheduler,
      options: OPTS,
    })
    controller.start(1, { x: 200, y: 300 })
    scheduler.step(0)
    scheduler.step(60_000) // 60 giây sau mới có frame — dt kẹp ở 0,1s
    expect(container.scrollTop).toBeCloseTo(60)
    controller.stop()
  })
})

class FakeTarget {
  private readonly listeners = new Map<
    string,
    Set<(event: AutoScrollPointerEventLike) => void>
  >()

  addEventListener(
    type: string,
    listener: (event: AutoScrollPointerEventLike) => void,
  ): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(
    type: string,
    listener: (event: AutoScrollPointerEventLike) => void,
  ): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: AutoScrollPointerEventLike): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0
  }
}

function pointerEvent(
  partial: Partial<AutoScrollPointerEventLike>,
): AutoScrollPointerEventLike {
  return {
    pointerId: 1,
    clientX: 200,
    clientY: 150,
    isPrimary: true,
    pointerType: 'pen',
    ...partial,
  }
}

describe('attachAutoScroll', () => {
  it('pointer ở mép dưới khi đang vẽ -> scrollTop tăng; pointer lên -> dừng', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const target = new FakeTarget()
    const onScrolled = vi.fn()
    const detach = attachAutoScroll({
      target,
      container,
      scheduler,
      options: OPTS,
      isEnabled: () => true,
      onScrolled,
    })
    target.emit('pointerdown', pointerEvent({ clientY: 298 }))
    scheduler.step(0)
    scheduler.step(100)
    expect(container.scrollTop).toBeGreaterThan(0)
    expect(onScrolled).toHaveBeenCalled()
    target.emit('pointerup', pointerEvent({}))
    const at = container.scrollTop
    scheduler.step(300)
    expect(container.scrollTop).toBe(at)
    detach()
  })

  it('cổng tắt (không phải công cụ nét) -> pointerdown bị bỏ qua hoàn toàn', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const target = new FakeTarget()
    const detach = attachAutoScroll({
      target,
      container,
      scheduler,
      options: OPTS,
      isEnabled: () => false,
      onScrolled: () => undefined,
    })
    target.emit('pointerdown', pointerEvent({ clientY: 300 }))
    scheduler.step(0)
    scheduler.step(100)
    expect(container.scrollTop).toBe(0)
    detach()
  })

  it('pointer thứ hai và pointer không chính bị bỏ qua', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const target = new FakeTarget()
    const detach = attachAutoScroll({
      target,
      container,
      scheduler,
      options: OPTS,
      isEnabled: () => true,
      onScrolled: () => undefined,
    })
    target.emit(
      'pointerdown',
      pointerEvent({ pointerId: 5, isPrimary: false, clientY: 300 }),
    )
    scheduler.step(0)
    scheduler.step(100)
    expect(container.scrollTop).toBe(0)
    // Pointer chính vẽ ở vùng an toàn; pointer phụ chạm mép không được cướp phiên.
    target.emit('pointerdown', pointerEvent({ pointerId: 1, clientY: 150 }))
    target.emit('pointerdown', pointerEvent({ pointerId: 2, clientY: 300 }))
    target.emit('pointermove', pointerEvent({ pointerId: 2, clientY: 300 }))
    scheduler.step(200)
    scheduler.step(300)
    expect(container.scrollTop).toBe(0)
    target.emit('pointerup', pointerEvent({ pointerId: 1 }))
    detach()
  })

  it('detach gỡ hết listener và dừng vòng cuộn', () => {
    const scheduler = new FakeScheduler()
    const container = new FakeContainer()
    const target = new FakeTarget()
    const detach = attachAutoScroll({
      target,
      container,
      scheduler,
      options: OPTS,
      isEnabled: () => true,
      onScrolled: () => undefined,
    })
    target.emit('pointerdown', pointerEvent({ clientY: 300 }))
    detach()
    expect(target.listenerCount('pointerdown')).toBe(0)
    expect(target.listenerCount('pointermove')).toBe(0)
    expect(target.listenerCount('pointerup')).toBe(0)
    expect(target.listenerCount('pointercancel')).toBe(0)
    scheduler.step(0)
    scheduler.step(100)
    expect(container.scrollTop).toBe(0)
  })
})

describe('shouldAutoScrollForTool', () => {
  it('chỉ pen và highlighter được tự cuộn', () => {
    expect(shouldAutoScrollForTool('pen')).toBe(true)
    expect(shouldAutoScrollForTool('highlighter')).toBe(true)
    expect(shouldAutoScrollForTool('stroke-eraser')).toBe(false)
    expect(shouldAutoScrollForTool('select')).toBe(false)
    expect(shouldAutoScrollForTool('lasso')).toBe(false)
    expect(shouldAutoScrollForTool('rectangle')).toBe(false)
    expect(shouldAutoScrollForTool('text')).toBe(false)
  })
})

describe('dispatchAutoScrollMove', () => {
  it('môi trường không có PointerEvent -> trả false, không ném lỗi', () => {
    // Môi trường node của vitest không có PointerEvent toàn cục.
    if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'function') {
      return // môi trường có PointerEvent: nhánh này thuộc Browser QA
    }
    const target = { dispatchEvent: () => true }
    expect(
      dispatchAutoScrollMove(target, {
        delta: { dx: 0, dy: 10 },
        clientPoint: { x: 10, y: 10 },
        pointerId: 1,
        pointerType: 'pen',
      }),
    ).toBe(false)
  })
})
