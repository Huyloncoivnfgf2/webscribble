/**
 * Kiểm thử `insertObjectAt` (bổ sung ở TASK-05F cho History): chèn
 * nguyên bản tại đúng vị trí trong thứ tự vẽ — tiền đề để undo khôi
 * phục chính xác cả dữ liệu lẫn thứ tự chồng lớp. Kèm kiểm chứng
 * `replaceObject` giữ vị trí của object bị thay (đổi ở TASK-05F).
 */
import { describe, expect, it } from 'vitest'
import {
  createLine,
  createPenStroke,
} from '../../src/engines/drawing/objects'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { StrokePoint } from '../../src/engines/drawing/types'

const PAGE = 'page-1'
const BOARD = 'board-1'

function dot(id: string, x: number, surfaceId = PAGE) {
  const points: StrokePoint[] = [{ x, y: 0, pressure: 0.5, time: 0 }]
  return createPenStroke({ surfaceId, points, id, createdAt: 1000 })
}

function seeded() {
  const surface = new InMemorySurface(PAGE, 'document-page', { width: 794, height: 1123 })
  const a = dot('a', 0)
  const b = dot('b', 10)
  const c = dot('c', 20)
  surface.addObject(a)
  surface.addObject(b)
  surface.addObject(c)
  return { surface, a, b, c }
}

describe('insertObjectAt', () => {
  it('chèn vào đầu/giữa/cuối đúng vị trí và giữ NGUYÊN BẢN object (kể cả updatedAt)', () => {
    const { surface } = seeded()
    const head = dot('head', -10)
    surface.insertObjectAt(0, head)
    expect(surface.listObjects().map((o) => o.id)).toEqual(['head', 'a', 'b', 'c'])
    // Object được chèn nguyên tham chiếu — không sao chép, không sửa updatedAt.
    expect(surface.getObject('head')).toBe(head)
    expect(surface.getObject('head')?.updatedAt).toBe(1000)

    const mid = dot('mid', 15)
    surface.insertObjectAt(3, mid)
    expect(surface.listObjects().map((o) => o.id)).toEqual(['head', 'a', 'b', 'mid', 'c'])

    const tail = dot('tail', 30)
    surface.insertObjectAt(surface.objectCount, tail)
    expect(surface.listObjects().map((o) => o.id)).toEqual([
      'head',
      'a',
      'b',
      'mid',
      'c',
      'tail',
    ])
  })

  it('từ chối: index ngoài [0, objectCount], index không nguyên, trùng ID, sai surface, dữ liệu hỏng — Surface không đổi', () => {
    const { surface, a } = seeded()
    const before = surface.listObjects()
    expect(() => surface.insertObjectAt(-1, dot('x', 0))).toThrow(/out of range/)
    expect(() => surface.insertObjectAt(4, dot('x', 0))).toThrow(/out of range/)
    expect(() => surface.insertObjectAt(1.5, dot('x', 0))).toThrow(/out of range/)
    expect(() => surface.insertObjectAt(0, a)).toThrow(/duplicate/)
    expect(() => surface.insertObjectAt(0, dot('x', 0, BOARD))).toThrow(/belonging to surface/)
    const invalid = { ...dot('bad', 0), bounds: { minX: 0, minY: 0, maxX: 999, maxY: 999 } }
    expect(() => surface.insertObjectAt(0, invalid)).toThrow(/invalid object/)
    expect(surface.listObjects()).toEqual(before)
    expect(surface.objectCount).toBe(3)
  })
})

describe('replaceObject giữ vị trí (TASK-05F)', () => {
  it('các object thay thế đứng tại vị trí của object bị thay, không nhảy xuống cuối', () => {
    const { surface, b } = seeded()
    const segA = dot('seg-a', 11)
    const segB = dot('seg-b', 12)
    surface.replaceObject(b.id, [segA, segB])
    expect(surface.listObjects().map((o) => o.id)).toEqual(['a', 'seg-a', 'seg-b', 'c'])

    surface.replaceObject('seg-a', [])
    expect(surface.listObjects().map((o) => o.id)).toEqual(['a', 'seg-b', 'c'])
  })

  it('line cũng giữ vị trí khi bị thay bằng một object khác loại', () => {
    const surface = new InMemorySurface(PAGE, 'document-page', { width: 794, height: 1123 })
    const first = dot('first', 0)
    const line = createLine({
      surfaceId: PAGE,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
      id: 'the-line',
    })
    const last = dot('last', 20)
    surface.addObject(first)
    surface.addObject(line)
    surface.addObject(last)
    surface.replaceObject('the-line', [dot('replacement', 5)])
    expect(surface.listObjects().map((o) => o.id)).toEqual(['first', 'replacement', 'last'])
  })
})
