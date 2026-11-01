/**
 * Test TASK-14B — gesture hai ngón (input.ts + engine.ts).
 *
 * Ba lớp: (1) PointerInputManager với hai pointer touch giả lập:
 * chuỗi sự kiện pinch start/update/end đúng trung điểm/khoảng
 * cách, không sự kiện vẽ nào lọt sau khi gesture bắt đầu, pointer
 * còn lại bị tiêu thụ tới khi nhấc hẳn; các cặp thiết bị khác
 * (pen+touch, mouse+touch) KHÔNG kích hoạt gesture — chốt an
 * toàn lòng bàn tay. (2) Tích hợp DrawingEngine: nét vẽ dở bị
 * HỦY khi ngón thứ hai chạm (surface rỗng, history rỗng); một
 * ngón touch vẫn vẽ thành object như thường. (3) pinchCamera áp
 * qua chuỗi sự kiện thật: zoom đúng tỉ lệ, điểm neo giữ nguyên.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createCamera,
  pinchCamera,
  screenToWorld,
  worldToScreen,
  type Camera,
} from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import {
  PointerInputManager,
  type PinchGestureEvent,
  type PointerEventLike,
  type PointerInputEvent,
  type PointerTargetLike,
} from '../../src/engines/drawing/input'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

class FakeTarget implements PointerTargetLike {
  private readonly listeners = new Map<
    string,
    Set<(event: PointerEventLike) => void>
  >()
  private readonly captured = new Set<number>()

  addEventListener(
    type: string,
    listener: (event: PointerEventLike) => void,
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
    listener: (event: PointerEventLike) => void,
  ): void {
    this.listeners.get(type)?.delete(listener)
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  getBoundingClientRect(): { left: number; top: number } {
    return { left: 0, top: 0 }
  }

  dispatch(type: string, event: PointerEventLike): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function touch(
  partial: Partial<PointerEventLike>,
): PointerEventLike {
  return pointerEvent({ pointerType: 'touch', ...partial })
}

function setupManager(withGesture: boolean) {
  const target = new FakeTarget()
  const events: PointerInputEvent[] = []
  const gestures: PinchGestureEvent[] = []
  const manager = new PointerInputManager({
    target,
    getCamera: () => createCamera(),
    onEvent: (event) => events.push(event),
    ...(withGesture
      ? { onGesture: (event: PinchGestureEvent) => gestures.push(event) }
      : {}),
  })
  manager.attach()
  return { target, events, gestures, manager }
}

describe('PointerInputManager — gesture hai ngón', () => {
  it('hai ngón touch: start/update/end đúng trung điểm + khoảng cách, chặn mọi sự kiện vẽ sau start', () => {
    const { target, events, gestures } = setupManager(true)
    target.dispatch('pointerdown', touch({ pointerId: 1, clientX: 100, clientY: 100 }))
    target.dispatch('pointermove', touch({ pointerId: 1, clientX: 110, clientY: 100 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move'])

    target.dispatch(
      'pointerdown',
      touch({ pointerId: 2, clientX: 210, clientY: 100, isPrimary: false }),
    )
    expect(gestures).toHaveLength(1)
    expect(gestures[0].phase).toBe('start')
    // Trung điểm của (110,100) và (210,100); khoảng cách 100.
    expect(gestures[0].midpoint).toEqual({ x: 160, y: 100 })
    expect(gestures[0].distance).toBeCloseTo(100)
    expect(gestures[0].previousDistance).toBeCloseTo(100)
    // Không có thêm sự kiện vẽ nào từ pointer thứ hai.
    expect(events).toHaveLength(2)

    target.dispatch(
      'pointermove',
      touch({ pointerId: 2, clientX: 260, clientY: 100, isPrimary: false }),
    )
    expect(gestures).toHaveLength(2)
    expect(gestures[1].phase).toBe('update')
    expect(gestures[1].midpoint).toEqual({ x: 185, y: 100 })
    expect(gestures[1].distance).toBeCloseTo(150)
    expect(gestures[1].previousMidpoint).toEqual({ x: 160, y: 100 })
    expect(gestures[1].previousDistance).toBeCloseTo(100)
    expect(gestures[1].midpointClient.x - gestures[1].previousMidpointClient.x).toBeCloseTo(25)

    // Di chuyển ngón đầu cũng ra update; vẫn không có sự kiện vẽ.
    target.dispatch('pointermove', touch({ pointerId: 1, clientX: 100, clientY: 120 }))
    expect(gestures).toHaveLength(3)
    expect(gestures[2].distance).toBeCloseTo(Math.hypot(160, 20))
    expect(events).toHaveLength(2)

    // Nhấc một ngón -> end; ngón còn lại bị tiêu thụ tới khi nhấc hẳn.
    target.dispatch(
      'pointerup',
      touch({ pointerId: 2, clientX: 260, clientY: 100, isPrimary: false, buttons: 0 }),
    )
    expect(gestures).toHaveLength(4)
    expect(gestures[3].phase).toBe('end')
    target.dispatch('pointermove', touch({ pointerId: 1, clientX: 130, clientY: 130 }))
    target.dispatch('pointerup', touch({ pointerId: 1, clientX: 130, clientY: 130, buttons: 0 }))
    expect(events).toHaveLength(2) // không down/move/up nào lọt thêm
    expect(gestures).toHaveLength(4)

    // Thao tác mới sau khi cả hai ngón đã nhấc: vẽ lại bình thường.
    target.dispatch('pointerdown', touch({ pointerId: 1, clientX: 50, clientY: 50 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'down'])
  })

  it('pen đang vẽ + touch chạm vào (lòng bàn tay): KHÔNG gesture, pen vẽ tiếp bình thường', () => {
    const { target, events, gestures } = setupManager(true)
    target.dispatch('pointerdown', pointerEvent({ pointerId: 1, pointerType: 'pen', clientX: 10, clientY: 10 }))
    target.dispatch(
      'pointerdown',
      touch({ pointerId: 2, clientX: 200, clientY: 200, isPrimary: false }),
    )
    expect(gestures).toHaveLength(0)
    target.dispatch('pointermove', pointerEvent({ pointerId: 1, pointerType: 'pen', clientX: 40, clientY: 40 }))
    target.dispatch('pointermove', touch({ pointerId: 2, clientX: 210, clientY: 210, isPrimary: false }))
    target.dispatch('pointerup', pointerEvent({ pointerId: 1, pointerType: 'pen', clientX: 40, clientY: 40, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'up'])
    expect(gestures).toHaveLength(0)
  })

  it('touch trước + pen sau, mouse trước + touch sau: đều không gesture', () => {
    const a = setupManager(true)
    a.target.dispatch('pointerdown', touch({ pointerId: 1, clientX: 0, clientY: 0 }))
    a.target.dispatch(
      'pointerdown',
      pointerEvent({ pointerId: 2, pointerType: 'pen', clientX: 90, clientY: 0, isPrimary: false }),
    )
    expect(a.gestures).toHaveLength(0)

    const b = setupManager(true)
    b.target.dispatch('pointerdown', pointerEvent({ pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 }))
    b.target.dispatch(
      'pointerdown',
      touch({ pointerId: 2, clientX: 90, clientY: 0, isPrimary: false }),
    )
    expect(b.gestures).toHaveLength(0)
  })

  it('không đăng ký onGesture: pointer thứ hai bị bỏ qua như hành vi cũ', () => {
    const { target, events } = setupManager(false)
    target.dispatch('pointerdown', touch({ pointerId: 1, clientX: 0, clientY: 0 }))
    target.dispatch('pointerdown', touch({ pointerId: 2, clientX: 90, clientY: 0, isPrimary: false }))
    target.dispatch('pointermove', touch({ pointerId: 1, clientX: 20, clientY: 0 }))
    target.dispatch('pointerup', touch({ pointerId: 1, clientX: 20, clientY: 0, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'up'])
  })

  it('pointer thứ ba trong lúc gesture bị bỏ qua hoàn toàn', () => {
    const { target, gestures } = setupManager(true)
    target.dispatch('pointerdown', touch({ pointerId: 1, clientX: 0, clientY: 0 }))
    target.dispatch('pointerdown', touch({ pointerId: 2, clientX: 100, clientY: 0, isPrimary: false }))
    target.dispatch('pointerdown', touch({ pointerId: 3, clientX: 200, clientY: 0, isPrimary: false }))
    target.dispatch('pointermove', touch({ pointerId: 3, clientX: 220, clientY: 0, isPrimary: false }))
    expect(gestures.map((g) => g.phase)).toEqual(['start'])
  })
})

describe('DrawingEngine — hủy nét khi gesture bắt đầu', () => {
  function setupEngine(onPinchGesture?: (event: PinchGestureEvent) => void) {
    const element = new FakeCanvasElement()
    const scheduler = new FakeFrameScheduler()
    const surface = new InMemorySurface('document:doc-1:0', 'document-page', {
      width: 800,
      height: 600,
    })
    const engine = new DrawingEngine({
      surface,
      element,
      getCamera: () => createCamera(),
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
      getDevicePixelRatio: () => 1,
      ...(onPinchGesture !== undefined ? { onPinchGesture } : {}),
    })
    engine.attach()
    engine.resize(800, 600)
    scheduler.runAll()
    return { element, surface, engine }
  }

  it('một ngón touch vẽ trọn vẹn thành một object (hành vi cũ giữ nguyên)', () => {
    const { element, surface } = setupEngine()
    element.dispatch('pointerdown', touch({ pointerId: 1, clientX: 10, clientY: 10, timeStamp: 100 }))
    element.dispatch('pointermove', touch({ pointerId: 1, clientX: 60, clientY: 30, timeStamp: 116 }))
    element.dispatch('pointerup', touch({ pointerId: 1, clientX: 60, clientY: 30, timeStamp: 132, buttons: 0 }))
    expect(surface.listObjects()).toHaveLength(1)
  })

  it('đang vẽ dở + ngón thứ hai chạm: nét bị hủy, surface rỗng, history rỗng', () => {
    const onPinchGesture = vi.fn()
    const { element, surface, engine } = setupEngine(onPinchGesture)
    element.dispatch('pointerdown', touch({ pointerId: 1, clientX: 10, clientY: 10, timeStamp: 100 }))
    element.dispatch('pointermove', touch({ pointerId: 1, clientX: 60, clientY: 30, timeStamp: 116 }))
    expect(engine.isDrawingInProgress).toBe(true)

    element.dispatch(
      'pointerdown',
      touch({ pointerId: 2, clientX: 200, clientY: 100, isPrimary: false, timeStamp: 132 }),
    )
    expect(onPinchGesture).toHaveBeenCalled()
    expect(onPinchGesture.mock.calls[0][0].phase).toBe('start')
    expect(engine.isDrawingInProgress).toBe(false)

    element.dispatch('pointermove', touch({ pointerId: 1, clientX: 90, clientY: 50, timeStamp: 148 }))
    element.dispatch('pointerup', touch({ pointerId: 1, clientX: 90, clientY: 50, timeStamp: 164, buttons: 0 }))
    element.dispatch(
      'pointerup',
      touch({ pointerId: 2, clientX: 200, clientY: 100, isPrimary: false, timeStamp: 164, buttons: 0 }),
    )
    expect(surface.listObjects()).toHaveLength(0)
    expect(engine.canUndo).toBe(false)
  })

  it('chuỗi gesture qua engine áp pinchCamera: zoom đúng tỉ lệ, điểm neo đứng yên', () => {
    let camera: Camera = createCamera()
    const anchorWorld = screenToWorld({ x: 200, y: 150 }, camera)
    const { element } = setupEngine((event) => {
      if (event.phase === 'update') {
        camera = pinchCamera(
          camera,
          { midpoint: event.previousMidpoint, distance: event.previousDistance },
          { midpoint: event.midpoint, distance: event.distance },
        )
      }
    })
    element.dispatch('pointerdown', touch({ pointerId: 1, clientX: 150, clientY: 150, timeStamp: 100 }))
    element.dispatch(
      'pointerdown',
      touch({ pointerId: 2, clientX: 250, clientY: 150, isPrimary: false, timeStamp: 110 }),
    )
    // Giãn CẢ hai ngón đối xứng: khoảng cách 100 -> 200 (x2),
    // trung điểm giữ nguyên (200,150).
    element.dispatch('pointermove', touch({ pointerId: 1, clientX: 100, clientY: 150, timeStamp: 126 }))
    element.dispatch(
      'pointermove',
      touch({ pointerId: 2, clientX: 300, clientY: 150, isPrimary: false, timeStamp: 130 }),
    )
    expect(camera.zoom).toBeCloseTo(2)
    // Điểm world dưới trung điểm không đổi vị trí màn hình.
    const anchored = worldToScreen(anchorWorld, camera)
    expect(anchored.x).toBeCloseTo(200)
    expect(anchored.y).toBeCloseTo(150)
    element.dispatch('pointerup', touch({ pointerId: 1, clientX: 150, clientY: 150, timeStamp: 140, buttons: 0 }))
    element.dispatch(
      'pointerup',
      touch({ pointerId: 2, clientX: 350, clientY: 150, isPrimary: false, timeStamp: 140, buttons: 0 }),
    )
  })
})
