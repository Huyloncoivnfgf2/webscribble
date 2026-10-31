import { describe, expect, it } from 'vitest'
import { createLine, createPenStroke } from '../../src/engines/drawing/objects'
import { InMemorySurface } from '../../src/engines/drawing/surface'

const PAGE_ID = 'document:doc-1:1'
const BOARD_ID = 'whiteboard:board-1'

function makeSurfaces() {
  return {
    page: new InMemorySurface(PAGE_ID, 'document-page', { width: 595, height: 842 }),
    board: new InMemorySurface(BOARD_ID, 'whiteboard', { width: 794, height: 1123 }),
  }
}

describe('InMemorySurface basics', () => {
  it('exposes its identity and size', () => {
    const { page } = makeSurfaces()
    expect(page.id).toBe(PAGE_ID)
    expect(page.kind).toBe('document-page')
    expect(page.size).toEqual({ width: 595, height: 842 })
    expect(page.objectCount).toBe(0)
  })

  it('rejects a non-positive size', () => {
    expect(() => new InMemorySurface('x', 'whiteboard', { width: 0, height: 10 })).toThrow()
  })

  it('adds, gets, lists and removes objects', () => {
    const { page } = makeSurfaces()
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [{ x: 1, y: 1, pressure: 0.5, time: 0 }],
    })
    const line = createLine({
      surfaceId: PAGE_ID,
      start: { x: 0, y: 0 },
      end: { x: 9, y: 9 },
    })
    page.addObject(stroke)
    page.addObject(line)
    expect(page.objectCount).toBe(2)
    expect(page.getObject(stroke.id)).toBe(stroke)
    expect(page.hasObject(line.id)).toBe(true)
    expect(page.listObjects()).toEqual([stroke, line])

    expect(page.removeObject(stroke.id)).toBe(true)
    expect(page.removeObject(stroke.id)).toBe(false)
    expect(page.getObject(stroke.id)).toBeUndefined()
    expect(page.objectCount).toBe(1)

    page.clear()
    expect(page.objectCount).toBe(0)
    expect(page.listObjects()).toEqual([])
  })

  it('rejects a duplicate object id', () => {
    const { page } = makeSurfaces()
    const stroke = createPenStroke({
      surfaceId: PAGE_ID,
      points: [{ x: 1, y: 1, pressure: 0.5, time: 0 }],
    })
    page.addObject(stroke)
    expect(() => page.addObject(stroke)).toThrow()
  })
})

describe('surface isolation', () => {
  it('refuses an object that belongs to another surface', () => {
    const { page, board } = makeSurfaces()
    const foreign = createPenStroke({
      surfaceId: BOARD_ID,
      points: [{ x: 1, y: 1, pressure: 0.5, time: 0 }],
    })
    expect(() => page.addObject(foreign)).toThrow()
    expect(page.objectCount).toBe(0)
    board.addObject(foreign)
    expect(board.objectCount).toBe(1)
  })

  it('keeps two surfaces fully independent (Split Mode model, DEC-020)', () => {
    const { page, board } = makeSurfaces()
    const onPage = createLine({
      surfaceId: PAGE_ID,
      start: { x: 0, y: 0 },
      end: { x: 5, y: 5 },
    })
    const onBoard = createLine({
      surfaceId: BOARD_ID,
      start: { x: 0, y: 0 },
      end: { x: 5, y: 5 },
    })
    page.addObject(onPage)
    board.addObject(onBoard)

    expect(page.listObjects()).toEqual([onPage])
    expect(board.listObjects()).toEqual([onBoard])
    expect(page.getObject(onBoard.id)).toBeUndefined()
    expect(board.getObject(onPage.id)).toBeUndefined()

    board.clear()
    expect(board.objectCount).toBe(0)
    expect(page.objectCount).toBe(1)
  })
})
