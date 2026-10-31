import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { createHighlighterStroke, createPenStroke } from '../../src/engines/drawing/objects'
import {
  drawStroke,
  isStrokeObject,
  strokeOutlinePoints,
} from '../../src/engines/drawing/renderer'
import type { StrokeObject } from '../../src/engines/drawing/types'
import { FakeContext2D } from './fakes'

const SURFACE = 'document:doc-1:1'

function penStroke(pressures: number[] = [0.5, 0.5, 0.5]): StrokeObject {
  return createPenStroke({
    surfaceId: SURFACE,
    points: [
      { x: 10, y: 50, pressure: pressures[0], time: 0 },
      { x: 60, y: 50, pressure: pressures[1], time: 10 },
      { x: 110, y: 50, pressure: pressures[2], time: 20 },
    ],
  })
}

function outlineHeight(object: StrokeObject): number {
  const outline = strokeOutlinePoints(object, createCamera())
  const ys = outline.map((p) => p.y)
  return Math.max(...ys) - Math.min(...ys)
}

describe('strokeOutlinePoints', () => {
  it('tạo đa giác hợp lệ cho nét pen (kể cả nét 1 điểm — chấm)', () => {
    const outline = strokeOutlinePoints(penStroke(), createCamera())
    expect(outline.length).toBeGreaterThanOrEqual(10)
    const dot = createPenStroke({
      surfaceId: SURFACE,
      points: [{ x: 20, y: 20, pressure: 0.5, time: 0 }],
    })
    expect(strokeOutlinePoints(dot, createCamera()).length).toBeGreaterThanOrEqual(10)
  })

  it('pressure cao cho nét dày hơn pressure thấp (pen biến thiên theo pressure)', () => {
    const thick = outlineHeight(penStroke([0.95, 0.95, 0.95]))
    const thin = outlineHeight(penStroke([0.05, 0.05, 0.05]))
    expect(thick).toBeGreaterThan(thin)
  })

  it('highlighter có độ dày đều ~ size, không phụ thuộc pressure', () => {
    const highlighter = createHighlighterStroke({
      surfaceId: SURFACE,
      points: [
        { x: 10, y: 50, pressure: 0.1, time: 0 },
        { x: 110, y: 50, pressure: 0.9, time: 10 },
      ],
    })
    const height = outlineHeight(highlighter)
    expect(height).toBeGreaterThan(12)
    expect(height).toBeLessThan(16)
  })

  it('zoom 2 phóng outline lên ~2 lần so với zoom 1', () => {
    const object = penStroke()
    const atZoom1 = strokeOutlinePoints(object, createCamera({ zoom: 1 }))
    const atZoom2 = strokeOutlinePoints(object, createCamera({ zoom: 2 }))
    const width = (pts: { x: number }[]) =>
      Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    const ratio = width(atZoom2) / width(atZoom1)
    expect(ratio).toBeGreaterThan(1.8)
    expect(ratio).toBeLessThan(2.2)
  })

  it('pan camera dịch outline nhưng không đổi hình dạng', () => {
    const object = penStroke()
    const base = strokeOutlinePoints(object, createCamera())
    const panned = strokeOutlinePoints(object, createCamera({ x: 30, y: 0 }))
    // Camera x=30 → mọi điểm màn hình lùi 30 theo trục x.
    expect(panned[0].x).toBeCloseTo(base[0].x - 30, 6)
    expect(panned[0].y).toBeCloseTo(base[0].y, 6)
  })
})

describe('drawStroke', () => {
  it('vẽ bằng fill path với màu + opacity của style, khôi phục context sau vẽ', () => {
    const ctx = new FakeContext2D()
    const object = penStroke()
    const drawn = drawStroke(ctx, object, createCamera())
    expect(drawn).toBe(true)
    const names = ctx.calls.map((c) => c.name)
    expect(names[0]).toBe('save')
    expect(names[names.length - 1]).toBe('restore')
    expect(ctx.countCalls('beginPath')).toBe(1)
    expect(ctx.countCalls('moveTo')).toBe(1)
    expect(ctx.countCalls('lineTo')).toBeGreaterThan(5)
    expect(ctx.countCalls('closePath')).toBe(1)
    expect(ctx.fills).toEqual([{ fillStyle: '#111827', globalAlpha: 1 }])
  })

  it('highlighter vẽ với opacity 0.4 theo style của nó', () => {
    const ctx = new FakeContext2D()
    const highlighter = createHighlighterStroke({
      surfaceId: SURFACE,
      points: [
        { x: 10, y: 10, pressure: 0.5, time: 0 },
        { x: 80, y: 10, pressure: 0.5, time: 10 },
      ],
    })
    expect(drawStroke(ctx, highlighter, createCamera())).toBe(true)
    expect(ctx.fills).toEqual([{ fillStyle: '#fde047', globalAlpha: 0.4 }])
  })

  it('không sửa dữ liệu nguồn khi render (object bị đóng băng sâu vẫn vẽ được)', () => {
    const object = penStroke()
    const snapshot = JSON.stringify(object)
    Object.freeze(object)
    Object.freeze(object.points)
    for (const point of object.points) Object.freeze(point)
    Object.freeze(object.style)
    Object.freeze(object.bounds)
    const ctx = new FakeContext2D()
    expect(drawStroke(ctx, object, createCamera({ x: 5, y: 5, zoom: 2 }))).toBe(true)
    expect(JSON.stringify(object)).toBe(snapshot)
  })

  it('isStrokeObject chỉ nhận pen/highlighter', () => {
    expect(isStrokeObject({ type: 'pen' })).toBe(true)
    expect(isStrokeObject({ type: 'highlighter' })).toBe(true)
    expect(isStrokeObject({ type: 'line' })).toBe(false)
    expect(isStrokeObject({ type: 'text' })).toBe(false)
  })
})
