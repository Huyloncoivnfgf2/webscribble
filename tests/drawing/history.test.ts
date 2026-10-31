/**
 * Kiểm thử History Manager (TASK-05F): command tổng quát
 * SurfaceChangeCommand + các performer, undo/redo chính xác (nguyên
 * bản object, đúng vị trí, không tạo ID mới), nhánh redo bị xóa khi
 * có thao tác mới, giới hạn lịch sử, và cô lập theo Surface.
 */
import { describe, expect, it } from 'vitest'
import {
  HistoryManager,
  mergeChanges,
  performAddObject,
  performMoveObjects,
  performRemoveObjects,
  performReplaceObject,
  performUpdateObjects,
  SurfaceChangeCommand,
} from '../../src/engines/drawing/history'
import {
  createPenStroke,
  createRectangle,
} from '../../src/engines/drawing/objects'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { StrokePoint } from '../../src/engines/drawing/types'

const PAGE = 'page-1'
const BOARD = 'board-1'

function stroke(id: string, x0: number, surfaceId = PAGE) {
  const points: StrokePoint[] = [
    { x: x0, y: 0, pressure: 0.5, time: 0 },
    { x: x0 + 10, y: 0, pressure: 0.5, time: 10 },
  ]
  return createPenStroke({ surfaceId, points, id, createdAt: 1000 })
}

function surfaceWith(ids: string[]) {
  const surface = new InMemorySurface(PAGE, 'document-page', { width: 794, height: 1123 })
  const objects = ids.map((id, i) => stroke(id, i * 20))
  for (const object of objects) surface.addObject(object)
  return { surface, objects }
}

function ids(surface: InMemorySurface): string[] {
  return surface.listObjects().map((object) => object.id)
}

// ---------------------------------------------------------------------------
// Command & performers
// ---------------------------------------------------------------------------

describe('SurfaceChangeCommand — Add / Remove / Update / Replace', () => {
  it('Add: undo gỡ object; redo đưa lại ĐÚNG object ban đầu (cùng tham chiếu, không ID mới)', () => {
    const { surface } = surfaceWith([])
    const history = new HistoryManager(surface)
    const a = stroke('a', 0)
    expect(history.execute('add', (s) => performAddObject(s, a))).toBe(true)
    expect(surface.getObject('a')).toBe(a)

    expect(history.undo()).toBe(true)
    expect(surface.objectCount).toBe(0)
    expect(history.redo()).toBe(true)
    expect(surface.getObject('a')).toBe(a)
  })

  it('Remove ở giữa: undo khôi phục đúng VỊ TRÍ trong thứ tự vẽ', () => {
    const { surface, objects } = surfaceWith(['a', 'b', 'c'])
    const history = new HistoryManager(surface)
    history.execute('remove', (s) => performRemoveObjects(s, ['b']))
    expect(ids(surface)).toEqual(['a', 'c'])
    history.undo()
    expect(ids(surface)).toEqual(['a', 'b', 'c'])
    expect(surface.getObject('b')).toBe(objects[1])
    history.redo()
    expect(ids(surface)).toEqual(['a', 'c'])
  })

  it('Update: undo khôi phục object gốc NGUYÊN BẢN (cả updatedAt cũ); redo áp đúng bản đã lưu, không làm mới updatedAt lần nữa', () => {
    const { surface, objects } = surfaceWith(['a'])
    const history = new HistoryManager(surface)
    const original = objects[0]
    history.execute('update', (s) =>
      performUpdateObjects(s, [{ ...original, points: [{ x: 99, y: 99, pressure: 1, time: 0 }], bounds: { minX: 97.5, minY: 97.5, maxX: 100.5, maxY: 100.5 } }]),
    )
    const storedAfter = surface.getObject('a')
    expect(storedAfter).not.toBe(original)
    expect(storedAfter?.updatedAt).toBeGreaterThanOrEqual(original.updatedAt)

    history.undo()
    expect(surface.getObject('a')).toBe(original) // nguyên tham chiếu & updatedAt gốc
    history.redo()
    expect(surface.getObject('a')).toBe(storedAfter) // đúng bản đã lưu sau update
  })

  it('Replace (mô hình Segment Eraser): undo trả nét gốc về đúng vị trí; redo tái tạo đúng các đoạn (cùng ID)', () => {
    const { surface, objects } = surfaceWith(['a', 'b', 'c'])
    const history = new HistoryManager(surface)
    const seg1 = stroke('seg-1', 22)
    const seg2 = stroke('seg-2', 28)
    history.execute('replace', (s) => performReplaceObject(s, 'b', [seg1, seg2]))
    expect(ids(surface)).toEqual(['a', 'seg-1', 'seg-2', 'c'])

    history.undo()
    expect(ids(surface)).toEqual(['a', 'b', 'c'])
    expect(surface.getObject('b')).toBe(objects[1])
    history.redo()
    expect(ids(surface)).toEqual(['a', 'seg-1', 'seg-2', 'c'])
    expect(surface.getObject('seg-1')).toBe(seg1)
  })

  it('command.execute(surface) tương đương redo: áp lại trạng thái sau', () => {
    const { surface } = surfaceWith([])
    const a = stroke('a', 0)
    const change = performAddObject(surface, a)
    const command = new SurfaceChangeCommand('add', change)
    command.undo(surface)
    expect(surface.objectCount).toBe(0)
    command.execute(surface)
    expect(surface.getObject('a')).toBe(a)
    expect(command.isEmpty).toBe(false)
    expect(command.label).toBe('add')
  })

  it('thao tác thất bại: ném lỗi, Surface và history đều không đổi', () => {
    const { surface, objects } = surfaceWith(['a'])
    const history = new HistoryManager(surface)
    // Add trùng ID → addObject ném lỗi.
    expect(() => history.execute('dup', (s) => performAddObject(s, objects[0]))).toThrow(
      /duplicate/,
    )
    // Update ID không tồn tại → performer ném lỗi trước khi ghi.
    expect(() =>
      history.execute('missing', (s) => performUpdateObjects(s, [stroke('ghost', 0)])),
    ).toThrow(/not found/)
    expect(surface.getObject('a')).toBe(objects[0])
    expect(surface.objectCount).toBe(1)
    expect(history.undoCount).toBe(0)
    expect(history.canUndo).toBe(false)
  })

  it('thao tác không thay đổi dữ liệu không được ghi: xóa ID lạ, di chuyển delta 0, command rỗng', () => {
    const { surface } = surfaceWith(['a'])
    const history = new HistoryManager(surface)
    expect(history.execute('noop', (s) => performRemoveObjects(s, ['missing']))).toBe(false)
    expect(history.execute('noop', (s) => performMoveObjects(s, ['a'], { x: 0, y: 0 }))).toBe(false)
    expect(
      history.record(new SurfaceChangeCommand('empty', { before: [], after: [] })),
    ).toBe(false)
    expect(history.undoCount).toBe(0)
  })

  it('Move nhiều object là MỘT command: undo một lần trả cả nhóm về chỗ cũ', () => {
    const { surface } = surfaceWith(['a', 'b', 'c'])
    const history = new HistoryManager(surface)
    history.execute('move', (s) => performMoveObjects(s, ['a', 'c'], { x: 100, y: 50 }))
    expect(history.undoCount).toBe(1)
    expect(surface.getObject('a')?.bounds.minX).toBeCloseTo(100 - 1.5)
    expect(surface.getObject('c')?.bounds.minX).toBeCloseTo(140 - 1.5)
    history.undo()
    expect(surface.getObject('a')?.bounds.minX).toBeCloseTo(-1.5)
    expect(surface.getObject('c')?.bounds.minX).toBeCloseTo(40 - 1.5)
    history.redo()
    expect(surface.getObject('a')?.bounds.minX).toBeCloseTo(100 - 1.5)
  })
})

describe('mergeChanges — gộp thay đổi liên tiếp (Segment Eraser nhiều bước)', () => {
  it('nét bị thay hai lần liên tiếp: change gộp chỉ còn nét gốc ↔ các đoạn cuối cùng', () => {
    const { surface, objects } = surfaceWith(['a'])
    const original = objects[0]
    const segA = stroke('seg-a', 1)
    const segB = stroke('seg-b', 5)
    const segA1 = stroke('seg-a1', 1)
    const segA2 = stroke('seg-a2', 3)
    const first = performReplaceObject(surface, 'a', [segA, segB])
    const second = performReplaceObject(surface, 'seg-a', [segA1, segA2])
    const merged = mergeChanges([first, second], surface)
    if (merged === null) throw new Error('expected a merged change')
    expect(merged.before.map((e) => e.object.id)).toEqual(['a'])
    expect(new Set(merged.after.map((e) => e.object.id))).toEqual(
      new Set(['seg-a1', 'seg-a2', 'seg-b']),
    )

    const command = new SurfaceChangeCommand('segment eraser', merged)
    command.undo(surface)
    expect(ids(surface)).toEqual(['a'])
    expect(surface.getObject('a')).toBe(original)
    command.redo(surface)
    expect(new Set(ids(surface))).toEqual(new Set(['seg-a1', 'seg-a2', 'seg-b']))
  })
})

// ---------------------------------------------------------------------------
// HistoryManager
// ---------------------------------------------------------------------------

describe('HistoryManager — chuỗi undo/redo và giới hạn', () => {
  it('nhiều thao tác liên tiếp: undo nhiều lần, redo nhiều lần, đúng thứ tự LIFO', () => {
    const { surface } = surfaceWith([])
    const history = new HistoryManager(surface)
    for (const id of ['a', 'b', 'c']) {
      history.execute('add', (s) => performAddObject(s, stroke(id, 0)))
    }
    expect(history.undoCount).toBe(3)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(true)
    expect(ids(surface)).toEqual(['a'])
    expect(history.redoCount).toBe(2)

    expect(history.redo()).toBe(true)
    expect(ids(surface)).toEqual(['a', 'b'])
    expect(history.redo()).toBe(true)
    expect(ids(surface)).toEqual(['a', 'b', 'c'])
    expect(history.redo()).toBe(false)
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(false)
    expect(surface.objectCount).toBe(0)
  })

  it('thao tác mới sau undo XÓA nhánh redo cũ', () => {
    const { surface } = surfaceWith([])
    const history = new HistoryManager(surface)
    history.execute('add', (s) => performAddObject(s, stroke('a', 0)))
    history.execute('add', (s) => performAddObject(s, stroke('b', 20)))
    history.undo()
    expect(history.canRedo).toBe(true)
    history.execute('add', (s) => performAddObject(s, stroke('x', 40)))
    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBe(false)
    expect(ids(surface)).toEqual(['a', 'x'])
  })

  it('giới hạn history: vượt giới hạn thì command cũ nhất bị loại, dữ liệu Surface không bị ảnh hưởng', () => {
    const { surface } = surfaceWith([])
    const history = new HistoryManager(surface, { limit: 3 })
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      history.execute('add', (s) => performAddObject(s, stroke(id, 0)))
    }
    expect(history.historyLimit).toBe(3)
    expect(history.undoCount).toBe(3)
    expect(surface.objectCount).toBe(5)
    history.undo()
    history.undo()
    history.undo()
    expect(history.undo()).toBe(false)
    // Chỉ 3 thao tác gần nhất hoàn tác được: a và b (quá khứ xa) còn lại.
    expect(ids(surface)).toEqual(['a', 'b'])
  })

  it('giới hạn không hợp lệ bị từ chối; clear() xóa lịch sử mà không đụng dữ liệu', () => {
    const { surface } = surfaceWith([])
    expect(() => new HistoryManager(surface, { limit: 0 })).toThrow(/positive integer/)
    expect(() => new HistoryManager(surface, { limit: 2.5 })).toThrow(/positive integer/)
    const history = new HistoryManager(surface)
    history.execute('add', (s) => performAddObject(s, stroke('a', 0)))
    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.undoCount).toBe(0)
    expect(surface.objectCount).toBe(1)
  })
})

describe('History độc lập theo Surface (mô hình Split, DEC-020)', () => {
  it('undo/redo trên Surface A không ảnh hưởng Surface B', () => {
    const pageSurface = new InMemorySurface(PAGE, 'document-page', { width: 794, height: 1123 })
    const boardSurface = new InMemorySurface(BOARD, 'whiteboard', { width: 1200, height: 800 })
    const pageHistory = new HistoryManager(pageSurface)
    const boardHistory = new HistoryManager(boardSurface)
    pageHistory.execute('add', (s) => performAddObject(s, stroke('p1', 0, PAGE)))
    boardHistory.execute('add', (s) => performAddObject(s, stroke('w1', 0, BOARD)))
    boardHistory.execute('add', (s) => performAddObject(s, stroke('w2', 20, BOARD)))

    expect(pageHistory.undo()).toBe(true)
    expect(pageSurface.objectCount).toBe(0)
    expect(boardSurface.objectCount).toBe(2)
    expect(boardHistory.undoCount).toBe(2)
    expect(boardHistory.canRedo).toBe(false)

    expect(pageHistory.redo()).toBe(true)
    expect(pageSurface.objectCount).toBe(1)
    expect(boardSurface.objectCount).toBe(2)
    expect(boardHistory.undo()).toBe(true)
    expect(boardSurface.objectCount).toBe(1)
    expect(pageSurface.objectCount).toBe(1)
  })

  it('một HistoryManager gắn đúng một Surface (readonly surface)', () => {
    const { surface } = surfaceWith([])
    const history = new HistoryManager(surface)
    expect(history.surface).toBe(surface)
    const rect = createRectangle({
      surfaceId: PAGE,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    })
    history.execute('add', (s) => performAddObject(s, rect))
    history.undo()
    expect(surface.objectCount).toBe(0)
  })
})
