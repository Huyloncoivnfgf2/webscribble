import { describe, expect, it } from 'vitest'
import {
  PointerInputManager,
  normalizePointerKind,
  normalizePressure,
  normalizeTilt,
  pointerEventToSample,
  type PointerEventLike,
  type PointerInputEvent,
  type PointerTargetLike,
} from '../../src/engines/drawing/input'
import { createCamera, type Camera } from '../../src/engines/drawing/coordinates'

/** Phần tử đích giả: ghi lại listener + capture, phát sự kiện theo yêu cầu. */
class FakeTarget implements PointerTargetLike {
  readonly listeners = new Map<string, Set<(event: PointerEventLike) => void>>()
  readonly captured = new Set<number>()
  rect = { left: 100, top: 50 }
  throwOnCapture = false

  addEventListener(type: string, listener: (event: PointerEventLike) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: (event: PointerEventLike) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  setPointerCapture(pointerId: number): void {
    if (this.throwOnCapture) throw new Error('NotFoundError (giả lập)')
    this.captured.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  getBoundingClientRect(): { left: number; top: number } {
    return this.rect
  }

  dispatch(type: string, event: PointerEventLike): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

const DEFAULT_POINTER_ID = 1

/** Tạo sự kiện pointer giả với mặc định hợp lệ, ghi đè theo nhu cầu. */
function ev(partial: Partial<PointerEventLike> = {}): PointerEventLike {
  return {
    pointerId: partial.pointerId ?? DEFAULT_POINTER_ID,
    pointerType: partial.pointerType ?? 'mouse',
    clientX: partial.clientX ?? 100,
    clientY: partial.clientY ?? 50,
    pressure: partial.pressure,
    tiltX: partial.tiltX,
    tiltY: partial.tiltY,
    button: partial.button ?? 0,
    buttons: partial.buttons ?? 1,
    isPrimary: partial.isPrimary ?? true,
    timeStamp: partial.timeStamp ?? 1000,
    getCoalescedEvents: partial.getCoalescedEvents,
  }
}

function setup(camera: Camera = createCamera()) {
  const target = new FakeTarget()
  const events: PointerInputEvent[] = []
  const manager = new PointerInputManager({
    target,
    getCamera: () => camera,
    onEvent: (event) => events.push(event),
  })
  manager.attach()
  return { target, events, manager }
}

describe('PointerInputManager — mouse', () => {
  it('emits down/move/up with world positions, then clears the active pointer', () => {
    const { target, events, manager } = setup()
    // rect tại (100, 50): client (100, 50) chính là góc phần tử → world (0, 0).
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    expect(manager.activePointerId).toBe(1)
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 160, clientY: 90 }))
    target.dispatch('pointerup', ev({ pointerId: 1, buttons: 0 }))

    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'up'])
    expect(events[0].sample.position).toEqual({ x: 0, y: 0 })
    expect(events[1].sample.position).toEqual({ x: 60, y: 40 })
    expect(events[0].sample.pointerType).toBe('mouse')
    expect(events[0].sample.time).toBe(1000)
    expect(manager.activePointerId).toBeNull()
  })

  it('ignores move/up when no stroke is active', () => {
    const { target, events } = setup()
    target.dispatch('pointermove', ev({ pointerId: 9 }))
    target.dispatch('pointerup', ev({ pointerId: 9 }))
    expect(events).toEqual([])
  })

  it('ignores a down with a secondary button (right click)', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1, button: 2, buttons: 2 }))
    expect(events).toEqual([])
    expect(manager.activePointerId).toBeNull()
  })
})

describe('PointerInputManager — touch & stylus', () => {
  it('normalizes touch input', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 7, pointerType: 'touch' }))
    expect(events).toHaveLength(1)
    expect(events[0].sample.pointerType).toBe('touch')
  })

  it('passes through pen pressure and tilt untouched', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({
      pointerId: 3,
      pointerType: 'pen',
      pressure: 0.72,
      tiltX: 35,
      tiltY: -20,
    }))
    const sample = events[0].sample
    expect(sample.pointerType).toBe('pen')
    expect(sample.pressure).toBeCloseTo(0.72)
    expect(sample.tiltX).toBe(35)
    expect(sample.tiltY).toBe(-20)
  })

  it('keeps a genuine light pen pressure of 0 instead of replacing it', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 3, pointerType: 'pen', pressure: 0 }))
    expect(events[0].sample.pressure).toBe(0)
  })
})

describe('pressure & tilt normalization + fallback', () => {
  it('normalizePressure clamps and falls back per device', () => {
    expect(normalizePressure(1.4, 'pen', true)).toBe(1)
    expect(normalizePressure(-0.2, 'pen', true)).toBe(0)
    // Mouse/touch báo 0 trong lúc nhấn (không có cảm biến lực) → 0.5.
    expect(normalizePressure(0, 'mouse', true)).toBe(0.5)
    expect(normalizePressure(0, 'touch', true)).toBe(0.5)
    // Bút báo 0 là dữ liệu thật → giữ nguyên.
    expect(normalizePressure(0, 'pen', true)).toBe(0)
    // Thiếu dữ liệu: đang nhấn → 0.5, không nhấn → 0.
    expect(normalizePressure(undefined, 'mouse', true)).toBe(0.5)
    expect(normalizePressure(undefined, 'mouse', false)).toBe(0)
    expect(normalizePressure(Number.NaN, 'pen', true)).toBe(0.5)
    // Giá trị bình thường giữ nguyên.
    expect(normalizePressure(0.3, 'mouse', true)).toBe(0.3)
  })

  it('missing pressure/tilt on a pen event fall back gracefully', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 4, pointerType: 'pen' }))
    const sample = events[0].sample
    expect(sample.pressure).toBe(0.5) // không có dữ liệu, đang nhấn
    expect(sample.tiltX).toBe(0)
    expect(sample.tiltY).toBe(0)
  })

  it('normalizeTilt clamps to [-90, 90] and defaults to 0', () => {
    expect(normalizeTilt(120)).toBe(90)
    expect(normalizeTilt(-120)).toBe(-90)
    expect(normalizeTilt(15)).toBe(15)
    expect(normalizeTilt(undefined)).toBe(0)
    expect(normalizeTilt(Number.NaN)).toBe(0)
  })

  it('normalizePointerKind maps unknown values to unknown', () => {
    expect(normalizePointerKind('mouse')).toBe('mouse')
    expect(normalizePointerKind('touch')).toBe('touch')
    expect(normalizePointerKind('pen')).toBe('pen')
    expect(normalizePointerKind('trackpad')).toBe('unknown')
    expect(normalizePointerKind(undefined)).toBe('unknown')
    expect(normalizePointerKind('')).toBe('unknown')
  })
})

describe('pointer capture', () => {
  it('captures on down and releases on up', () => {
    const { target, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    expect(target.hasPointerCapture(1)).toBe(true)
    target.dispatch('pointerup', ev({ pointerId: 1, buttons: 0 }))
    expect(target.hasPointerCapture(1)).toBe(false)
    expect(manager.activePointerId).toBeNull()
  })

  it('releases capture on cancel and emits a cancel event', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 120, clientY: 60 }))
    target.dispatch('pointercancel', ev({ pointerId: 1, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'cancel'])
    expect(target.hasPointerCapture(1)).toBe(false)
    // Sau cancel, move của pointer đó bị bỏ qua.
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 130, clientY: 70 }))
    expect(events).toHaveLength(3)
  })

  it('survives a setPointerCapture failure and keeps working', () => {
    const { target, events } = setup()
    target.throwOnCapture = true
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 110, clientY: 60 }))
    target.dispatch('pointerup', ev({ pointerId: 1, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down', 'move', 'up'])
  })
})

describe('pointer identity & interference', () => {
  it('a second pointer cannot interfere with an active stroke', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointerdown', ev({ pointerId: 2, pointerType: 'touch' }))
    target.dispatch('pointermove', ev({ pointerId: 2, clientX: 500, clientY: 500 }))
    target.dispatch('pointerup', ev({ pointerId: 2, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down'])
    expect(manager.activePointerId).toBe(1)
    // Pointer gốc vẫn kết thúc bình thường; sau đó pointer khác mới bắt đầu được.
    target.dispatch('pointerup', ev({ pointerId: 1, buttons: 0 }))
    target.dispatch('pointerdown', ev({ pointerId: 2, pointerType: 'touch' }))
    expect(events.map((e) => e.type)).toEqual(['down', 'up', 'down'])
    expect(manager.activePointerId).toBe(2)
  })

  it('ignores non-primary pointers entirely', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 5, pointerType: 'touch', isPrimary: false }))
    expect(events).toEqual([])
    expect(manager.activePointerId).toBeNull()
  })
})

describe('coordinate conversion', () => {
  it('converts client → element → world through the camera', () => {
    const camera = createCamera({ x: 10, y: 20, zoom: 2 })
    const { target, events } = setup(camera)
    // rect (100, 50): client (210, 150) → screen (110, 100) → world (65, 70).
    target.dispatch('pointerdown', ev({ pointerId: 1, clientX: 210, clientY: 150 }))
    expect(events[0].sample.screenPosition).toEqual({ x: 110, y: 100 })
    expect(events[0].sample.position).toEqual({ x: 65, y: 70 })
  })

  it('uses the latest camera for every event (mid-stroke pan/zoom)', () => {
    let camera = createCamera()
    const target = new FakeTarget()
    const events: PointerInputEvent[] = []
    const manager = new PointerInputManager({
      target,
      getCamera: () => camera,
      onEvent: (event) => events.push(event),
    })
    manager.attach()
    target.dispatch('pointerdown', ev({ pointerId: 1, clientX: 200, clientY: 150 }))
    camera = createCamera({ x: 0, y: 0, zoom: 2 })
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 200, clientY: 150 }))
    expect(events[0].sample.position).toEqual({ x: 100, y: 100 })
    expect(events[1].sample.position).toEqual({ x: 50, y: 50 })
  })

  it('pointerEventToSample returns null for invalid core data', () => {
    const rect = { left: 0, top: 0 }
    const camera = createCamera()
    expect(pointerEventToSample(ev({ clientX: Number.NaN }), rect, camera)).toBeNull()
    expect(pointerEventToSample(ev({ clientY: Infinity }), rect, camera)).toBeNull()
    expect(pointerEventToSample(ev({ pointerId: Number.NaN }), rect, camera)).toBeNull()
  })
})

describe('coalesced events', () => {
  it('expands a move into its coalesced samples, in order', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    const coalesced = [
      ev({ pointerId: 1, clientX: 110, clientY: 55, timeStamp: 1010 }),
      ev({ pointerId: 1, clientX: 120, clientY: 60, timeStamp: 1020 }),
      ev({ pointerId: 1, clientX: 130, clientY: 65, timeStamp: 1030 }),
    ]
    target.dispatch('pointermove', ev({
      pointerId: 1,
      clientX: 130,
      clientY: 65,
      getCoalescedEvents: () => coalesced,
    }))
    const moves = events.filter((e) => e.type === 'move')
    expect(moves).toHaveLength(3)
    expect(moves.map((m) => m.sample.time)).toEqual([1010, 1020, 1030])
    expect(moves[2].sample.position).toEqual({ x: 30, y: 15 })
  })

  it('falls back to the event itself when coalesced is empty or unsupported', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointermove', ev({
      pointerId: 1,
      clientX: 115,
      clientY: 55,
      getCoalescedEvents: () => [],
    }))
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 125, clientY: 60 }))
    const moves = events.filter((e) => e.type === 'move')
    expect(moves).toHaveLength(2)
    expect(moves[0].sample.position).toEqual({ x: 15, y: 5 })
  })
})

describe('invalid input & lifecycle', () => {
  it('drops a down with NaN coordinates without starting a stroke', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1, clientX: Number.NaN }))
    expect(events).toEqual([])
    expect(manager.activePointerId).toBeNull()
    expect(target.captured.size).toBe(0)
  })

  it('an up with invalid coordinates still ends the stroke and releases capture', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointerup', ev({ pointerId: 1, clientX: Number.NaN, buttons: 0 }))
    // Không phát thêm sự kiện 'up' (dữ liệu hỏng) nhưng trạng thái được dọn sạch.
    expect(events.map((e) => e.type)).toEqual(['down'])
    expect(manager.activePointerId).toBeNull()
    expect(target.hasPointerCapture(1)).toBe(false)
  })

  it('skips invalid samples inside a coalesced batch but keeps valid ones', () => {
    const { target, events } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    target.dispatch('pointermove', ev({
      pointerId: 1,
      getCoalescedEvents: () => [
        ev({ pointerId: 1, clientX: Number.NaN }),
        ev({ pointerId: 1, clientX: 140, clientY: 80 }),
      ],
    }))
    const moves = events.filter((e) => e.type === 'move')
    expect(moves).toHaveLength(1)
    expect(moves[0].sample.position).toEqual({ x: 40, y: 30 })
  })

  it('attach is idempotent and detach stops all input', () => {
    const target = new FakeTarget()
    const events: PointerInputEvent[] = []
    const manager = new PointerInputManager({
      target,
      getCamera: () => createCamera(),
      onEvent: (event) => events.push(event),
    })
    manager.attach()
    manager.attach()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    expect(events).toHaveLength(1) // không bị phát trùng do attach hai lần
    manager.detach()
    expect(manager.isAttached).toBe(false)
    target.dispatch('pointermove', ev({ pointerId: 1 }))
    target.dispatch('pointerdown', ev({ pointerId: 2 }))
    expect(events).toHaveLength(1)
  })

  it('detach during an active stroke releases capture and resets state silently', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    manager.detach()
    expect(manager.activePointerId).toBeNull()
    expect(target.hasPointerCapture(1)).toBe(false)
    expect(events.map((e) => e.type)).toEqual(['down'])
  })

  it('reset mid-stroke drops the active pointer; the rest of that gesture is ignored', () => {
    const { target, events, manager } = setup()
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    manager.reset()
    expect(manager.activePointerId).toBeNull()
    expect(target.hasPointerCapture(1)).toBe(false)
    target.dispatch('pointermove', ev({ pointerId: 1, clientX: 130, clientY: 70 }))
    target.dispatch('pointerup', ev({ pointerId: 1, buttons: 0 }))
    expect(events.map((e) => e.type)).toEqual(['down'])
    // Pointer hoạt động lại bình thường từ lần down kế tiếp.
    target.dispatch('pointerdown', ev({ pointerId: 1 }))
    expect(manager.activePointerId).toBe(1)
    expect(events.map((e) => e.type)).toEqual(['down', 'down'])
  })
})
