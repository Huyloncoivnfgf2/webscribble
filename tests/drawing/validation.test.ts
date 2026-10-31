import { describe, expect, it } from 'vitest'
import {
  createArrow,
  createEllipse,
  createHighlighterStroke,
  createLine,
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import type { DrawingObject } from '../../src/engines/drawing/types'
import {
  isDrawingObject,
  validateDrawingObject,
} from '../../src/engines/drawing/validation'

const SURFACE = 'document:doc-9:2'

function oneOfEachType(): DrawingObject[] {
  const strokePoints = [
    { x: 0, y: 0, pressure: 0.5, time: 0 },
    { x: 5, y: 5, pressure: 0.7, time: 12 },
  ]
  const start = { x: 0, y: 0 }
  const end = { x: 40, y: 30 }
  return [
    createPenStroke({ surfaceId: SURFACE, points: strokePoints }),
    createHighlighterStroke({ surfaceId: SURFACE, points: strokePoints }),
    createLine({ surfaceId: SURFACE, start, end }),
    createRectangle({ surfaceId: SURFACE, start, end }),
    createEllipse({ surfaceId: SURFACE, start, end }),
    createArrow({ surfaceId: SURFACE, start, end }),
    createText({
      surfaceId: SURFACE,
      position: { x: 1, y: 2 },
      text: 'Xin chào',
      width: 80,
      height: 20,
    }),
  ]
}

describe('validateDrawingObject — happy path', () => {
  it('accepts every object type produced by the factories', () => {
    for (const object of oneOfEachType()) {
      const result = validateDrawingObject(object)
      expect(result.errors).toEqual([])
      expect(result.valid).toBe(true)
      expect(isDrawingObject(object)).toBe(true)
    }
  })

  it('accepts objects after a JSON round-trip (persistence-ready)', () => {
    for (const object of oneOfEachType()) {
      const revived: unknown = JSON.parse(JSON.stringify(object))
      expect(validateDrawingObject(revived).valid).toBe(true)
      expect(isDrawingObject(revived)).toBe(true)
    }
  })
})

describe('validateDrawingObject — rejections', () => {
  it('rejects non-objects and null', () => {
    expect(validateDrawingObject(null).valid).toBe(false)
    expect(validateDrawingObject('pen').valid).toBe(false)
    expect(validateDrawingObject(42).valid).toBe(false)
  })

  it('rejects a missing or empty id / surfaceId', () => {
    const [pen] = oneOfEachType()
    expect(validateDrawingObject({ ...pen, id: '' }).valid).toBe(false)
    expect(validateDrawingObject({ ...pen, surfaceId: '' }).valid).toBe(false)
  })

  it('rejects an unknown type', () => {
    const [pen] = oneOfEachType()
    const result = validateDrawingObject({ ...pen, type: 'scribble' })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('type')
  })

  it('rejects non-finite coordinates', () => {
    const [pen] = oneOfEachType()
    if (pen.type !== 'pen') throw new Error('expected a pen stroke')
    const broken = {
      ...pen,
      points: [{ x: Number.NaN, y: 0, pressure: 0.5, time: 0 }],
      bounds: pen.bounds,
    }
    expect(validateDrawingObject(broken).valid).toBe(false)
  })

  it('rejects pressure outside [0, 1]', () => {
    const stroke = createPenStroke({
      surfaceId: SURFACE,
      points: [{ x: 0, y: 0, pressure: 1.4, time: 0 }],
    })
    const result = validateDrawingObject(stroke)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('pressure')
  })

  it('rejects decreasing point times inside a stroke', () => {
    const stroke = createPenStroke({
      surfaceId: SURFACE,
      points: [
        { x: 0, y: 0, pressure: 0.5, time: 0 },
        { x: 4, y: 4, pressure: 0.5, time: 50 },
        { x: 8, y: 8, pressure: 0.5, time: 20 },
      ],
    })
    const result = validateDrawingObject(stroke)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('non-decreasing')
  })

  it('rejects bounds that do not match the object data', () => {
    const line = createLine({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    })
    const tampered = { ...line, bounds: { minX: 0, minY: 0, maxX: 999, maxY: 999 } }
    const result = validateDrawingObject(tampered)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('bounds')
  })

  it('rejects an empty points array', () => {
    const [pen] = oneOfEachType()
    expect(validateDrawingObject({ ...pen, points: [] }).valid).toBe(false)
  })
})
