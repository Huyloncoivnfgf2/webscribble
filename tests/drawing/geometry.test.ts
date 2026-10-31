import { describe, expect, it } from 'vitest'
import {
  boundsCenter,
  boundsFromPoints,
  boundsHeight,
  boundsIntersect,
  boundsWidth,
  computeObjectBounds,
  expandBounds,
  isPointInBounds,
  shapeBounds,
  strokeBounds,
  textBounds,
  unionBounds,
} from '../../src/engines/drawing/geometry'
import { createLine, createPenStroke, createText } from '../../src/engines/drawing/objects'

const SURFACE = 'whiteboard:board-1'

describe('boundsFromPoints', () => {
  it('computes the enclosing box', () => {
    expect(
      boundsFromPoints([
        { x: 5, y: 7 },
        { x: -3, y: 2 },
        { x: 9, y: 20 },
      ]),
    ).toEqual({ minX: -3, minY: 2, maxX: 9, maxY: 20 })
  })

  it('applies padding evenly', () => {
    expect(boundsFromPoints([{ x: 10, y: 10 }], 2)).toEqual({
      minX: 8,
      minY: 8,
      maxX: 12,
      maxY: 12,
    })
  })

  it('throws for an empty point list', () => {
    expect(() => boundsFromPoints([])).toThrow()
  })
})

describe('specialized bounds', () => {
  it('strokeBounds pads by half the stroke size', () => {
    expect(strokeBounds([{ x: 0, y: 0 }, { x: 10, y: 4 }], 6)).toEqual({
      minX: -3,
      minY: -3,
      maxX: 13,
      maxY: 7,
    })
  })

  it('shapeBounds normalizes reversed corners', () => {
    expect(shapeBounds({ x: 30, y: 40 }, { x: 10, y: 5 })).toEqual({
      minX: 10,
      minY: 5,
      maxX: 30,
      maxY: 40,
    })
  })

  it('textBounds derives from position and size', () => {
    expect(textBounds({ x: 3, y: 4 }, 50, 12)).toEqual({
      minX: 3,
      minY: 4,
      maxX: 53,
      maxY: 16,
    })
  })
})

describe('computeObjectBounds', () => {
  it('matches the bounds stored by each factory', () => {
    const pen = createPenStroke({
      surfaceId: SURFACE,
      points: [
        { x: 1, y: 2, pressure: 0.5, time: 0 },
        { x: 8, y: 9, pressure: 0.5, time: 10 },
      ],
    })
    const line = createLine({
      surfaceId: SURFACE,
      start: { x: 9, y: 1 },
      end: { x: 2, y: 7 },
    })
    const text = createText({
      surfaceId: SURFACE,
      position: { x: 4, y: 4 },
      text: 'abc',
      width: 30,
      height: 10,
    })
    for (const object of [pen, line, text]) {
      expect(computeObjectBounds(object)).toEqual(object.bounds)
    }
  })
})

describe('bounds operations', () => {
  const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
  const b = { minX: 5, minY: -5, maxX: 20, maxY: 3 }

  it('unionBounds contains both inputs', () => {
    expect(unionBounds(a, b)).toEqual({ minX: 0, minY: -5, maxX: 20, maxY: 10 })
  })

  it('expandBounds grows and shrinks evenly', () => {
    expect(expandBounds(a, 2)).toEqual({ minX: -2, minY: -2, maxX: 12, maxY: 12 })
    expect(expandBounds(a, -1)).toEqual({ minX: 1, minY: 1, maxX: 9, maxY: 9 })
  })

  it('boundsIntersect detects overlap and separation', () => {
    expect(boundsIntersect(a, b)).toBe(true)
    expect(boundsIntersect(a, { minX: 30, minY: 30, maxX: 40, maxY: 40 })).toBe(false)
    // Chạm biên vẫn tính là giao nhau.
    expect(boundsIntersect(a, { minX: 10, minY: 0, maxX: 12, maxY: 2 })).toBe(true)
  })

  it('isPointInBounds includes the border', () => {
    expect(isPointInBounds({ x: 10, y: 10 }, a)).toBe(true)
    expect(isPointInBounds({ x: 10.5, y: 5 }, a)).toBe(false)
  })

  it('reports width, height and center', () => {
    expect(boundsWidth(a)).toBe(10)
    expect(boundsHeight(a)).toBe(10)
    expect(boundsCenter(a)).toEqual({ x: 5, y: 5 })
  })
})
