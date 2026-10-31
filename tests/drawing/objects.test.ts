import { describe, expect, it } from 'vitest'
import {
  createArrow,
  createEllipse,
  createHighlighterStroke,
  createLine,
  createObjectId,
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import type { StrokePoint } from '../../src/engines/drawing/types'

const SURFACE = 'document:doc-1:1'

function points(): StrokePoint[] {
  return [
    { x: 10, y: 10, pressure: 0.5, time: 0 },
    { x: 20, y: 14, pressure: 0.6, time: 16 },
    { x: 30, y: 12, pressure: 0.4, time: 32 },
  ]
}

describe('createObjectId', () => {
  it('generates unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 2000; i += 1) ids.add(createObjectId())
    expect(ids.size).toBe(2000)
  })

  it('never repeats an id across factory-created objects', () => {
    const a = createPenStroke({ surfaceId: SURFACE, points: points() })
    const b = createPenStroke({ surfaceId: SURFACE, points: points() })
    expect(a.id).not.toBe(b.id)
  })
})

describe('stroke factories', () => {
  it('creates a pen stroke with raw points, style and timestamps', () => {
    const stroke = createPenStroke({ surfaceId: SURFACE, points: points() })
    expect(stroke.type).toBe('pen')
    expect(stroke.surfaceId).toBe(SURFACE)
    expect(stroke.points).toHaveLength(3)
    expect(stroke.points[1]).toEqual({ x: 20, y: 14, pressure: 0.6, time: 16 })
    expect(stroke.style.size).toBeGreaterThan(0)
    expect(stroke.createdAt).toBeGreaterThan(0)
    expect(stroke.updatedAt).toBe(stroke.createdAt)
    // Bounds bao quanh điểm, nới bằng nửa độ dày nét (3 / 2 = 1.5).
    expect(stroke.bounds).toEqual({ minX: 8.5, minY: 8.5, maxX: 31.5, maxY: 15.5 })
  })

  it('creates a highlighter with its own defaults', () => {
    const stroke = createHighlighterStroke({ surfaceId: SURFACE, points: points() })
    expect(stroke.type).toBe('highlighter')
    expect(stroke.style.opacity).toBeLessThan(1)
    expect(stroke.style.size).toBeGreaterThan(3)
  })

  it('merges a partial style over the defaults', () => {
    const stroke = createPenStroke({
      surfaceId: SURFACE,
      points: points(),
      style: { color: '#dc2626' },
    })
    expect(stroke.style.color).toBe('#dc2626')
    expect(stroke.style.size).toBe(3)
  })

  it('rejects an empty point list', () => {
    expect(() => createPenStroke({ surfaceId: SURFACE, points: [] })).toThrow()
    expect(() => createHighlighterStroke({ surfaceId: SURFACE, points: [] })).toThrow()
  })

  it('keeps raw points as given (no outline is stored)', () => {
    const input = points()
    const stroke = createPenStroke({ surfaceId: SURFACE, points: input })
    expect(stroke.points).toEqual(input)
    expect(stroke).not.toHaveProperty('outline')
  })
})

describe('shape factories', () => {
  const start = { x: 50, y: 60 }
  const end = { x: 10, y: 20 }

  it('creates a line and normalizes its bounds', () => {
    const line = createLine({ surfaceId: SURFACE, start, end })
    expect(line.type).toBe('line')
    expect(line.start).toEqual(start)
    expect(line.end).toEqual(end)
    expect(line.bounds).toEqual({ minX: 9, minY: 19, maxX: 51, maxY: 61 })
  })

  it('creates rectangle, ellipse and arrow objects', () => {
    expect(createRectangle({ surfaceId: SURFACE, start, end }).type).toBe('rectangle')
    expect(createEllipse({ surfaceId: SURFACE, start, end }).type).toBe('ellipse')
    const arrow = createArrow({ surfaceId: SURFACE, start, end })
    expect(arrow.type).toBe('arrow')
    expect(arrow.bounds).toEqual({ minX: 9, minY: 19, maxX: 51, maxY: 61 })
  })

  it('supports a fill color through style', () => {
    const rect = createRectangle({
      surfaceId: SURFACE,
      start,
      end,
      style: { fillColor: '#dbeafe' },
    })
    expect(rect.style.fillColor).toBe('#dbeafe')
    expect(rect.style.strokeWidth).toBe(2)
  })
})

describe('createText', () => {
  it('creates a text object with position, content and size', () => {
    const text = createText({
      surfaceId: SURFACE,
      position: { x: 100, y: 200 },
      text: 'Ghi chú',
      width: 120,
      height: 24,
    })
    expect(text.type).toBe('text')
    expect(text.text).toBe('Ghi chú')
    expect(text.bounds).toEqual({ minX: 100, minY: 200, maxX: 220, maxY: 224 })
  })

  it('rejects non-positive width or height', () => {
    expect(() =>
      createText({
        surfaceId: SURFACE,
        position: { x: 0, y: 0 },
        text: 'x',
        width: 0,
        height: 10,
      }),
    ).toThrow()
  })
})
