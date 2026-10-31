import { describe, expect, it } from 'vitest'
import { strokeBounds } from '../../src/engines/drawing/geometry'
import type { PointerInputEvent, PointerSample } from '../../src/engines/drawing/input'
import { StrokeBuilder } from '../../src/engines/drawing/strokeBuilder'
import { isDrawingObject, validateDrawingObject } from '../../src/engines/drawing/validation'

const SURFACE = 'document:doc-1:1'

function sample(partial: Partial<PointerSample> = {}): PointerSample {
  return {
    pointerId: 1,
    pointerType: 'pen',
    position: partial.position ?? { x: 10, y: 10 },
    screenPosition: partial.screenPosition ?? partial.position ?? { x: 10, y: 10 },
    pressure: partial.pressure ?? 0.5,
    tiltX: 0,
    tiltY: 0,
    time: partial.time ?? 1000,
    buttons: 1,
  }
}

function event(type: PointerInputEvent['type'], s: PointerSample): PointerInputEvent {
  return { type, sample: s }
}

function builder(tool: 'pen' | 'highlighter' = 'pen', style?: { size?: number; color?: string }) {
  return new StrokeBuilder({ surfaceId: SURFACE, tool, style })
}

describe('StrokeBuilder — vòng đời nét', () => {
  it('down bắt đầu nét, move thêm điểm, up hoàn tất thành object hợp lệ', () => {
    const b = builder()
    expect(b.handleEvent(event('down', sample()))).toEqual({ type: 'started' })
    expect(b.isActive).toBe(true)
    expect(b.pointCount).toBe(1)

    expect(
      b.handleEvent(event('move', sample({ position: { x: 20, y: 14 }, time: 1016 }))),
    ).toEqual({ type: 'updated' })
    b.handleEvent(event('move', sample({ position: { x: 30, y: 12 }, time: 1032 })))
    expect(b.pointCount).toBe(3)

    // TASK-05G: mẫu up nay mang vị trí nhả bút THẬT (trùng điểm move
    // cuối) — trước đây builder bỏ qua vị trí của sự kiện up.
    const result = b.handleEvent(
      event('up', sample({ position: { x: 30, y: 12 }, time: 1040 })),
    )
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.endedBy).toBe('up')
    const object = result.object
    expect(object.type).toBe('pen')
    expect(object.surfaceId).toBe(SURFACE)
    expect(object.points).toHaveLength(3)
    expect(validateDrawingObject(object).valid).toBe(true)
    expect(isDrawingObject(object)).toBe(true)
    expect(b.isActive).toBe(false)
  })

  it('một chạm nhẹ (down + up, không move) vẫn tạo nét 1 điểm hợp lệ', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    const result = b.handleEvent(event('up', sample({ time: 1010 })))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.points).toHaveLength(1)
    expect(validateDrawingObject(result.object).valid).toBe(true)
  })

  it('move/up/cancel khi chưa có nét đều bị bỏ qua', () => {
    const b = builder()
    expect(b.handleEvent(event('move', sample()))).toEqual({ type: 'ignored' })
    expect(b.handleEvent(event('up', sample()))).toEqual({ type: 'ignored' })
    expect(b.handleEvent(event('cancel', sample()))).toEqual({ type: 'ignored' })
    expect(b.finishStroke()).toBeNull()
    expect(b.previewObject()).toBeNull()
  })

  it('down với tọa độ không hợp lệ không mở nét', () => {
    const b = builder()
    const bad = sample({ position: { x: Number.NaN, y: 0 } })
    expect(b.handleEvent(event('down', bad))).toEqual({ type: 'ignored' })
    expect(b.isActive).toBe(false)
  })
})

describe('StrokeBuilder — regression TASK-05G', () => {
  it('điểm nhả bút (up) khác vị trí move cuối PHẢI thuộc về nét — trước đây bị đánh rơi làm nét cụt', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ position: { x: 0, y: 0 }, time: 1000 })))
    b.handleEvent(event('move', sample({ position: { x: 50, y: 0 }, time: 1010 })))
    const result = b.handleEvent(
      event('up', sample({ position: { x: 120, y: 0 }, time: 1020 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [50, 0],
      [120, 0],
    ])
    expect(result.object.bounds.maxX).toBeGreaterThan(120)
  })

  it('cancel ở vị trí mới cũng bổ sung điểm cuối trước khi hoàn tất', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ position: { x: 0, y: 0 }, time: 1000 })))
    const result = b.handleEvent(
      event('cancel', sample({ position: { x: 40, y: 0 }, time: 1010 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.points.map((p) => p.x)).toEqual([0, 40])
  })
})

describe('StrokeBuilder — timestamp & pressure', () => {
  it('time của StrokePoint là ms tương đối từ điểm đầu (DEC-025)', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ time: 5000 })))
    b.handleEvent(event('move', sample({ position: { x: 12, y: 10 }, time: 5016 })))
    b.handleEvent(event('move', sample({ position: { x: 14, y: 10 }, time: 5050 })))
    const result = b.handleEvent(
      event('up', sample({ position: { x: 14, y: 10 }, time: 5060 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.points.map((p) => p.time)).toEqual([0, 16, 50])
  })

  it('thời gian không bao giờ giảm dù mẫu đến lệch thứ tự', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ time: 1000 })))
    b.handleEvent(event('move', sample({ position: { x: 12, y: 10 }, time: 900 })))
    b.handleEvent(event('move', sample({ position: { x: 14, y: 10 }, time: 950 })))
    const result = b.handleEvent(
      event('up', sample({ position: { x: 14, y: 10 }, time: 960 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    const times = result.object.points.map((p) => p.time)
    expect(times).toEqual([0, 0, 0])
    expect(validateDrawingObject(result.object).valid).toBe(true)
  })

  it('pressure được giữ nguyên từ sample vào điểm', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ pressure: 0.2 })))
    b.handleEvent(event('move', sample({ position: { x: 12, y: 10 }, pressure: 0.9, time: 1010 })))
    const result = b.handleEvent(
      event('up', sample({ position: { x: 12, y: 10 }, time: 1020 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.points.map((p) => p.pressure)).toEqual([0.2, 0.9])
  })

  it('điểm trùng hoàn toàn bị bỏ qua; trùng vị trí nhưng khác pressure thì giữ', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    b.handleEvent(event('move', sample({ time: 1010 }))) // y hệt điểm đầu
    expect(b.pointCount).toBe(1)
    b.handleEvent(event('move', sample({ pressure: 0.8, time: 1020 }))) // khác pressure
    expect(b.pointCount).toBe(2)
  })
})

describe('StrokeBuilder — bounds & công cụ', () => {
  it('bounds của object hoàn tất bằng strokeBounds (gồm nửa độ dày nét)', () => {
    const b = builder()
    b.handleEvent(event('down', sample({ position: { x: 10, y: 10 } })))
    b.handleEvent(event('move', sample({ position: { x: 30, y: 20 }, time: 1010 })))
    const during = b.currentBounds
    const result = b.handleEvent(event('up', sample({ time: 1020 })))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.bounds).toEqual(strokeBounds(result.object.points, result.object.style.size))
    // Bounds trong lúc vẽ khớp bounds cuối cùng.
    expect(during).toEqual(result.object.bounds)
  })

  it('highlighter dùng style mặc định riêng và tạo đúng loại object', () => {
    const b = builder('highlighter')
    b.handleEvent(event('down', sample()))
    const result = b.handleEvent(event('up', sample({ time: 1010 })))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.type).toBe('highlighter')
    expect(result.object.style).toEqual({ color: '#fde047', size: 14, opacity: 0.4 })
    expect(validateDrawingObject(result.object).valid).toBe(true)
  })

  it('style tùy chỉnh (size) ảnh hưởng bounds qua độ dày nét', () => {
    const b = builder('pen', { size: 10 })
    b.handleEvent(event('down', sample({ position: { x: 100, y: 100 } })))
    const result = b.handleEvent(
      event('up', sample({ position: { x: 100, y: 100 }, time: 1010 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.bounds).toEqual({ minX: 95, minY: 95, maxX: 105, maxY: 105 })
  })
})

describe('StrokeBuilder — gián đoạn, cancel, xem trước', () => {
  it('cancel hoàn tất nét và giữ phần đã vẽ, ghi rõ endedBy', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    b.handleEvent(event('move', sample({ position: { x: 20, y: 20 }, time: 1010 })))
    const result = b.handleEvent(
      event('cancel', sample({ position: { x: 20, y: 20 }, time: 1020 })),
    )
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.endedBy).toBe('cancel')
    expect(result.object.points).toHaveLength(2)
    expect(b.isActive).toBe(false)
  })

  it('down mới giữa nét: hoàn tất nét cũ (interrupted) và bắt đầu nét mới', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    b.handleEvent(event('move', sample({ position: { x: 20, y: 20 }, time: 1010 })))
    const interrupted = b.handleEvent(
      event('down', sample({ position: { x: 100, y: 100 }, time: 2000 })),
    )
    if (interrupted.type !== 'completed') throw new Error('expected completion')
    expect(interrupted.endedBy).toBe('interrupted')
    expect(interrupted.startedNewStroke).toBe(true)
    expect(interrupted.object.points).toHaveLength(2)
    expect(b.isActive).toBe(true)
    expect(b.pointCount).toBe(1)

    const second = b.handleEvent(event('up', sample({ time: 2010 })))
    if (second.type !== 'completed') throw new Error('expected completion')
    expect(second.object.id).not.toBe(interrupted.object.id)
    expect(second.object.points[0]).toMatchObject({ x: 100, y: 100, time: 0 })
  })

  it('abandon hủy nét mà không tạo object', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    b.handleEvent(event('move', sample({ position: { x: 20, y: 20 }, time: 1010 })))
    b.abandon()
    expect(b.isActive).toBe(false)
    expect(b.handleEvent(event('up', sample({ time: 1020 })))).toEqual({ type: 'ignored' })
  })

  it('previewObject dùng chung ID với object cuối cùng và không lộ mảng điểm nội bộ', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    b.handleEvent(event('move', sample({ position: { x: 20, y: 20 }, time: 1010 })))
    const preview = b.previewObject()
    if (preview === null) throw new Error('expected preview')
    expect(preview.points).toHaveLength(2)
    // Sửa mảng điểm của preview không ảnh hưởng builder.
    ;(preview.points as Array<unknown>).push({ x: 0, y: 0, pressure: 0, time: 0 })
    expect(b.pointCount).toBe(2)

    const result = b.handleEvent(event('up', sample({ time: 1020 })))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.id).toBe(preview.id)
    expect(result.object.createdAt).toBe(preview.createdAt)
    expect(b.previewObject()).toBeNull()
  })

  it('finishStroke công khai hoàn tất nét đang dở (đổi công cụ/detach)', () => {
    const b = builder()
    b.handleEvent(event('down', sample()))
    const finished = b.finishStroke()
    if (finished === null) throw new Error('expected object')
    expect(finished.points).toHaveLength(1)
    expect(b.isActive).toBe(false)
    expect(b.finishStroke()).toBeNull()
  })
})
