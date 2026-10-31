import { describe, expect, it } from 'vitest'
import {
  createLine,
  createPenStroke,
  createText,
} from '../../src/engines/drawing/objects'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { DrawingObject } from '../../src/engines/drawing/types'

const PAGE_ID = 'document:doc-1:1'
const BOARD_ID = 'whiteboard:board-1'

function pageSurface() {
  return new InMemorySurface(PAGE_ID, 'document-page', { width: 595, height: 842 })
}

function seedLine(surface: InMemorySurface) {
  const line = createLine({
    surfaceId: PAGE_ID,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 10 },
    createdAt: 1000,
  })
  surface.addObject(line)
  return line
}

describe('updateObject — success', () => {
  it('moves an object: new geometry, refreshed bounds and updatedAt', () => {
    const surface = pageSurface()
    const line = seedLine(surface)

    const moved = createLine({
      id: line.id,
      surfaceId: PAGE_ID,
      start: { x: 100, y: 100 },
      end: { x: 130, y: 90 },
      createdAt: line.createdAt,
    })
    const stored = surface.updateObject(moved)

    expect(stored.id).toBe(line.id)
    expect(stored.bounds).toEqual({ minX: 99, minY: 89, maxX: 131, maxY: 101 })
    expect(stored.createdAt).toBe(1000)
    expect(stored.updatedAt).toBeGreaterThan(1000)
    expect(surface.getObject(line.id)).toBe(stored)
    expect(surface.objectCount).toBe(1)
  })

  it('edits a text object (content and size)', () => {
    const surface = pageSurface()
    const text = createText({
      surfaceId: PAGE_ID,
      position: { x: 10, y: 10 },
      text: 'Bản nháp',
      width: 60,
      height: 20,
      createdAt: 1000,
    })
    surface.addObject(text)

    const edited = createText({
      id: text.id,
      surfaceId: PAGE_ID,
      position: { x: 10, y: 10 },
      text: 'Bản chính thức dài hơn',
      width: 150,
      height: 20,
      createdAt: text.createdAt,
    })
    const stored = surface.updateObject(edited)
    expect(stored.type).toBe('text')
    if (stored.type === 'text') {
      expect(stored.text).toBe('Bản chính thức dài hơn')
      expect(stored.bounds.maxX).toBe(160)
    }
  })

  it('changes style while keeping identity and position in list order', () => {
    const surface = pageSurface()
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [{ x: 1, y: 1, pressure: 0.5, time: 0 }],
    })
    const line = seedLine(surface)
    surface.addObject(stroke)

    const restyled = createPenStroke({
      id: stroke.id,
      surfaceId: PAGE_ID,
      points: stroke.points,
      style: { color: '#dc2626', size: 6 },
      createdAt: stroke.createdAt,
    })
    surface.updateObject(restyled)

    const list = surface.listObjects()
    expect(list.map((object) => object.id)).toEqual([line.id, stroke.id])
    const updated = list[1]
    expect(updated.type).toBe('pen')
    if (updated.type === 'pen') {
      expect(updated.style.color).toBe('#dc2626')
      expect(updated.style.size).toBe(6)
    }
  })
})

describe('updateObject — failures leave the original untouched', () => {
  it('throws for an unknown id (this is also how id changes are rejected)', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const stranger = createLine({
      surfaceId: PAGE_ID,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    })
    expect(() => surface.updateObject(stranger)).toThrow(/not found/)
    expect(surface.getObject(line.id)).toBe(line)
    expect(surface.objectCount).toBe(1)
  })

  it('throws when the replacement belongs to another surface', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const foreign = createLine({
      id: line.id,
      surfaceId: BOARD_ID,
      start: { x: 5, y: 5 },
      end: { x: 6, y: 6 },
    })
    expect(() => surface.updateObject(foreign)).toThrow(/belonging to surface/)
    expect(surface.getObject(line.id)).toBe(line)
  })

  it('throws for invalid data (tampered bounds) and keeps the original', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const tampered: DrawingObject = {
      ...line,
      bounds: { minX: 0, minY: 0, maxX: 999, maxY: 999 },
    }
    expect(() => surface.updateObject(tampered)).toThrow(/invalid object/)
    expect(surface.getObject(line.id)).toBe(line)
  })
})

describe('updateObjects — atomic batch', () => {
  it('updates several objects at once', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [{ x: 2, y: 2, pressure: 0.5, time: 0 }],
    })
    surface.addObject(stroke)

    const stored = surface.updateObjects([
      createLine({
        id: line.id,
        surfaceId: PAGE_ID,
        start: { x: 50, y: 50 },
        end: { x: 60, y: 60 },
        createdAt: line.createdAt,
      }),
      createPenStroke({
        id: stroke.id,
        surfaceId: PAGE_ID,
        points: stroke.points,
        style: { color: '#2563eb' },
        createdAt: stroke.createdAt,
      }),
    ])
    expect(stored).toHaveLength(2)
    expect(surface.getObject(line.id)?.bounds).toEqual({
      minX: 49,
      minY: 49,
      maxX: 61,
      maxY: 61,
    })
    expect(surface.objectCount).toBe(2)
  })

  it('applies nothing when one item of the batch is invalid', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [{ x: 2, y: 2, pressure: 0.5, time: 0 }],
    })
    surface.addObject(stroke)

    const goodUpdate = createLine({
      id: line.id,
      surfaceId: PAGE_ID,
      start: { x: 50, y: 50 },
      end: { x: 60, y: 60 },
      createdAt: line.createdAt,
    })
    const badUpdate: DrawingObject = { ...stroke, bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } }

    expect(() => surface.updateObjects([goodUpdate, badUpdate])).toThrow(/invalid object/)
    // Object đầu tiên trong batch cũng KHÔNG được ghi.
    expect(surface.getObject(line.id)).toBe(line)
    expect(surface.getObject(stroke.id)).toBe(stroke)
  })

  it('rejects duplicate ids inside one batch', () => {
    const surface = pageSurface()
    const line = seedLine(surface)
    const again = createLine({
      id: line.id,
      surfaceId: PAGE_ID,
      start: { x: 1, y: 1 },
      end: { x: 2, y: 2 },
      createdAt: line.createdAt,
    })
    expect(() => surface.updateObjects([again, again])).toThrow(/duplicate id .* in update batch/)
    expect(surface.getObject(line.id)).toBe(line)
  })
})

describe('replaceObject — segment eraser model', () => {
  function longStroke(surface: InMemorySurface) {
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [
        { x: 0, y: 0, pressure: 0.5, time: 0 },
        { x: 10, y: 0, pressure: 0.5, time: 10 },
        { x: 20, y: 0, pressure: 0.5, time: 20 },
        { x: 30, y: 0, pressure: 0.5, time: 30 },
      ],
    })
    surface.addObject(stroke)
    return stroke
  }

  function segment(points: Array<{ x: number; y: number; pressure: number; time: number }>) {
    return createPenStroke({ surfaceId: PAGE_ID, points })
  }

  it('replaces one stroke with the remaining segments', () => {
    const surface = pageSurface()
    const stroke = longStroke(surface)
    const segA = segment([
      { x: 0, y: 0, pressure: 0.5, time: 0 },
      { x: 10, y: 0, pressure: 0.5, time: 10 },
    ])
    const segB = segment([{ x: 30, y: 0, pressure: 0.5, time: 0 }])

    surface.replaceObject(stroke.id, [segA, segB])

    expect(surface.getObject(stroke.id)).toBeUndefined()
    expect(surface.getObject(segA.id)).toBe(segA)
    expect(surface.getObject(segB.id)).toBe(segB)
    expect(surface.objectCount).toBe(2)
  })

  it('an empty replacement list deletes the object (fully erased)', () => {
    const surface = pageSurface()
    const stroke = longStroke(surface)
    surface.replaceObject(stroke.id, [])
    expect(surface.objectCount).toBe(0)
  })

  it('fails atomically: unknown id, reused id, collision, foreign and invalid replacements', () => {
    const surface = pageSurface()
    const stroke = longStroke(surface)
    const other = seedLine(surface)
    const seg = segment([{ x: 0, y: 0, pressure: 0.5, time: 0 }])

    expect(() => surface.replaceObject('missing-id', [seg])).toThrow(/not found/)
    expect(() =>
      surface.replaceObject(stroke.id, [{ ...seg, id: stroke.id }]),
    ).toThrow(/must not reuse/)
    expect(() =>
      surface.replaceObject(stroke.id, [{ ...seg, id: other.id }]),
    ).toThrow(/duplicate object id/)
    expect(() =>
      surface.replaceObject(stroke.id, [{ ...seg, surfaceId: BOARD_ID }]),
    ).toThrow(/belonging to surface/)
    const invalid: DrawingObject = { ...seg, bounds: { minX: 0, minY: 0, maxX: 42, maxY: 42 } }
    expect(() => surface.replaceObject(stroke.id, [invalid])).toThrow(/invalid replacement/)

    // Sau mọi thất bại: dữ liệu gốc còn nguyên vẹn.
    expect(surface.getObject(stroke.id)).toBe(stroke)
    expect(surface.getObject(other.id)).toBe(other)
    expect(surface.objectCount).toBe(2)
  })

  it('keeps surfaces isolated when updating (Split Mode, DEC-020)', () => {
    const page = pageSurface()
    const board = new InMemorySurface(BOARD_ID, 'whiteboard', { width: 794, height: 1123 })
    const line = seedLine(page)
    const boardStroke = createPenStroke({
      surfaceId: BOARD_ID,
      points: [{ x: 3, y: 3, pressure: 0.5, time: 0 }],
    })
    board.addObject(boardStroke)

    page.updateObject(
      createLine({
        id: line.id,
        surfaceId: PAGE_ID,
        start: { x: 7, y: 7 },
        end: { x: 8, y: 8 },
        createdAt: line.createdAt,
      }),
    )

    expect(board.getObject(boardStroke.id)).toBe(boardStroke)
    expect(board.objectCount).toBe(1)
    expect(page.objectCount).toBe(1)
  })
})
