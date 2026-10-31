import { describe, expect, it } from 'vitest'
import { computeObjectBounds } from '../../src/engines/drawing/geometry'
import type { PointerInputEvent, PointerSample } from '../../src/engines/drawing/input'
import { ShapeBuilder, type ShapeTool } from '../../src/engines/drawing/shapeBuilder'
import type { ShapeStyle } from '../../src/engines/drawing/types'
import { validateDrawingObject } from '../../src/engines/drawing/validation'

const SURFACE = 'document:doc-1:1'

function sample(x: number, y: number): PointerSample {
  return {
    pointerId: 1,
    pointerType: 'mouse',
    position: { x, y },
    screenPosition: { x, y },
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    time: 1000,
    buttons: 1,
  }
}

function event(type: PointerInputEvent['type'], s: PointerSample): PointerInputEvent {
  return { type, sample: s }
}

function drag(
  b: ShapeBuilder,
  from: { x: number; y: number },
  to: { x: number; y: number },
  endType: 'up' | 'cancel' = 'up',
) {
  b.handleEvent(event('down', sample(from.x, from.y)))
  b.handleEvent(event('move', sample(to.x, to.y)))
  return b.handleEvent(event(endType, sample(to.x, to.y)))
}

const TOOLS: ShapeTool[] = ['line', 'rectangle', 'ellipse', 'arrow']

describe('ShapeBuilder — tạo từng loại hình', () => {
  it('tạo đúng loại object cho cả 4 công cụ, qua factory nên bounds/validation chuẩn', () => {
    for (const tool of TOOLS) {
      const b = new ShapeBuilder({ surfaceId: SURFACE, tool })
      const result = drag(b, { x: 10, y: 10 }, { x: 60, y: 40 })
      if (result.type !== 'completed') throw new Error(`expected completion for ${tool}`)
      expect(result.object.type).toBe(tool)
      expect(result.object.start).toEqual({ x: 10, y: 10 })
      expect(result.object.end).toEqual({ x: 60, y: 40 })
      // Bounds chuẩn = bounds do computeObjectBounds suy ra (đã gồm
      // nửa độ dày nét; arrow gồm đầu mũi tên — TASK-05E).
      expect(result.object.bounds).toEqual(computeObjectBounds(result.object))
      expect(result.endedBy).toBe('up')
      expect(validateDrawingObject(result.object).valid).toBe(true)
      expect(b.isActive).toBe(false)
    }
  })

  it('kéo ngược chiều: start/end giữ nguyên như thao tác, bounds vẫn chuẩn hóa', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    const result = drag(b, { x: 60, y: 40 }, { x: 10, y: 10 })
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.start).toEqual({ x: 60, y: 40 })
    expect(result.object.bounds).toEqual({ minX: 9, minY: 9, maxX: 61, maxY: 41 })
  })

  it('trong lúc kéo: preview phản ánh điểm hiện tại và dùng chung ID với object cuối', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'ellipse' })
    b.handleEvent(event('down', sample(0, 0)))
    b.handleEvent(event('move', sample(30, 20)))
    const preview1 = b.previewObject()
    expect(preview1?.end).toEqual({ x: 30, y: 20 })
    expect(b.currentPoint).toEqual({ x: 30, y: 20 })
    b.handleEvent(event('move', sample(50, 25)))
    const preview2 = b.previewObject()
    expect(preview2?.end).toEqual({ x: 50, y: 25 })
    const result = b.handleEvent(event('up', sample(50, 25)))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.object.id).toBe(preview1?.id)
    expect(b.previewObject()).toBeNull()
  })

  it('style tùy chỉnh đi vào object; mặc định rectangle không có fill', () => {
    const plain = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    const plainResult = drag(plain, { x: 0, y: 0 }, { x: 40, y: 30 })
    if (plainResult.type !== 'completed') throw new Error('expected completion')
    expect(plainResult.object.style.fillColor).toBeNull()

    const style: Partial<ShapeStyle> = { fillColor: '#dbeafe', strokeColor: '#dc2626', strokeWidth: 5 }
    const styled = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle', style })
    const styledResult = drag(styled, { x: 0, y: 0 }, { x: 40, y: 30 })
    if (styledResult.type !== 'completed') throw new Error('expected completion')
    expect(styledResult.object.style).toMatchObject(style)
  })
})

describe('ShapeBuilder — chính sách hình suy biến', () => {
  it('chạm mà không kéo (kích thước 0) → discarded, không tạo object', () => {
    for (const tool of TOOLS) {
      const b = new ShapeBuilder({ surfaceId: SURFACE, tool })
      b.handleEvent(event('down', sample(10, 10)))
      const result = b.handleEvent(event('up', sample(10, 10)))
      expect(result).toEqual({ type: 'discarded', reason: 'too-small' })
      expect(b.isActive).toBe(false)
      expect(b.finishShape()).toBeNull()
    }
  })

  it('line ngắn hơn minSize bị bỏ; đúng bằng minSize thì giữ', () => {
    const tiny = new ShapeBuilder({ surfaceId: SURFACE, tool: 'line' })
    expect(drag(tiny, { x: 0, y: 0 }, { x: 1, y: 0 }).type).toBe('discarded')
    const exact = new ShapeBuilder({ surfaceId: SURFACE, tool: 'line' })
    expect(drag(exact, { x: 0, y: 0 }, { x: 2, y: 0 }).type).toBe('completed')
  })

  it('rectangle quá mỏng (một chiều < minSize) bị bỏ dù chiều kia dài', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    expect(drag(b, { x: 0, y: 0 }, { x: 100, y: 1 }).type).toBe('discarded')
    const ok = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    expect(drag(ok, { x: 0, y: 0 }, { x: 100, y: 2 }).type).toBe('completed')
  })

  it('preview vẫn hiển thị khi hình đang suy biến (chính sách chỉ áp dụng lúc hoàn tất)', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    b.handleEvent(event('down', sample(10, 10)))
    const preview = b.previewObject()
    expect(preview).not.toBeNull()
    expect(preview?.bounds).toEqual({ minX: 9, minY: 9, maxX: 11, maxY: 11 })
  })

  it('minSize cấu hình được: minSize 0 giữ cả hình một điểm', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'line', minSize: 0 })
    b.handleEvent(event('down', sample(5, 5)))
    const result = b.handleEvent(event('up', sample(5, 5)))
    expect(result.type).toBe('completed')
  })
})

describe('ShapeBuilder — gián đoạn & hủy', () => {
  it('cancel giữ hình hợp lệ với endedBy cancel; hình suy biến thì bỏ', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'arrow' })
    const result = drag(b, { x: 0, y: 0 }, { x: 80, y: 30 }, 'cancel')
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.endedBy).toBe('cancel')

    const tiny = new ShapeBuilder({ surfaceId: SURFACE, tool: 'arrow' })
    tiny.handleEvent(event('down', sample(0, 0)))
    expect(tiny.handleEvent(event('cancel', sample(0, 0)))).toEqual({
      type: 'discarded',
      reason: 'too-small',
    })
  })

  it('down mới giữa chừng hoàn tất hình cũ và bắt đầu hình mới', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'line' })
    b.handleEvent(event('down', sample(0, 0)))
    b.handleEvent(event('move', sample(50, 0)))
    const interrupted = b.handleEvent(event('down', sample(100, 100)))
    if (interrupted.type !== 'completed') throw new Error('expected completion')
    expect(interrupted.endedBy).toBe('interrupted')
    expect(interrupted.startedNewShape).toBe(true)
    expect(b.isActive).toBe(true)
    expect(b.startPoint).toEqual({ x: 100, y: 100 })
  })

  it('abandon hủy hình; move/up khi không có hình bị bỏ qua; down NaN bị bỏ qua', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'ellipse' })
    expect(b.handleEvent(event('move', sample(1, 1)))).toEqual({ type: 'ignored' })
    expect(b.handleEvent(event('up', sample(1, 1)))).toEqual({ type: 'ignored' })
    b.handleEvent(event('down', sample(0, 0)))
    b.handleEvent(event('move', sample(30, 30)))
    b.abandon()
    expect(b.isActive).toBe(false)
    expect(b.handleEvent(event('up', sample(30, 30)))).toEqual({ type: 'ignored' })

    const nanSample = { ...sample(0, 0), position: { x: Number.NaN, y: 0 } }
    expect(b.handleEvent(event('down', nanSample))).toEqual({ type: 'ignored' })
    expect(b.isActive).toBe(false)
  })

  it('finishShape công khai: hoàn tất hình hợp lệ, null với hình suy biến', () => {
    const b = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    b.handleEvent(event('down', sample(0, 0)))
    b.handleEvent(event('move', sample(20, 20)))
    const finished = b.finishShape()
    expect(finished?.type).toBe('rectangle')
    expect(b.finishShape()).toBeNull()

    const tiny = new ShapeBuilder({ surfaceId: SURFACE, tool: 'rectangle' })
    tiny.handleEvent(event('down', sample(0, 0)))
    expect(tiny.finishShape()).toBeNull()
  })
})
