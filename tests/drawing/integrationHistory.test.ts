/**
 * TASK-05G (A3) — Chuỗi History kết hợp nhiều loại object qua
 * DrawingEngine: vẽ → xóa/di chuyển/tẩy → undo từng bước → redo từng
 * bước, xác nhận không ghi hai lần, không mất object, không sinh ID
 * mới khi redo, không sai thứ tự vẽ, trạng thái cuối bằng đúng trạng
 * thái trước khi undo (cùng tham chiếu object).
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { DrawingObject } from '../../src/engines/drawing/types'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'page-1'

function setup() {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => createCamera(),
    textMeasurer: {
      measureWidth: (line, style) => [...line].length * style.fontSize * 0.5,
      lineHeight: (style) => style.fontSize * 1.25,
    },
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  return { element, scheduler, surface, engine }
}

function drag(
  el: FakeCanvasElement,
  from: [number, number],
  to: [number, number],
  t0 = 0,
): void {
  el.dispatch('pointerdown', pointerEvent({ clientX: from[0], clientY: from[1], timeStamp: t0 }))
  el.dispatch(
    'pointermove',
    pointerEvent({
      clientX: (from[0] + to[0]) / 2,
      clientY: (from[1] + to[1]) / 2,
      timeStamp: t0 + 10,
    }),
  )
  el.dispatch('pointerup', pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: t0 + 20, buttons: 0 }))
}

function tap(el: FakeCanvasElement, at: [number, number], t0 = 0): void {
  el.dispatch('pointerdown', pointerEvent({ clientX: at[0], clientY: at[1], timeStamp: t0 }))
  el.dispatch('pointerup', pointerEvent({ clientX: at[0], clientY: at[1], timeStamp: t0 + 10, buttons: 0 }))
}

/** Chuỗi thao tác hỗn hợp dùng chung: pen, rectangle, text, highlighter, move, segment-erase, delete. */
function buildMixedChain(ctx: ReturnType<typeof setup>) {
  const { element, surface, engine } = ctx
  engine.setTool('pen')
  drag(element, [0, 20], [200, 20], 0) // 1: pen dài để tẩy đoạn
  engine.setTool('rectangle')
  drag(element, [10, 60], [90, 110], 100) // 2: rectangle
  engine.addTextObject({ position: { x: 120, y: 60 }, text: 'Chuỗi' }) // 3: text
  engine.setTool('highlighter')
  drag(element, [0, 150], [120, 150], 200) // 4: highlighter
  engine.setTool('select-rect')
  drag(element, [0, 50], [200, 120], 300) // chọn rectangle + text
  engine.moveSelectionBy({ x: 5, y: 5 }) // 5: move nhóm
  engine.setTool('segment-eraser')
  tap(element, [100, 20], 400) // 6: cắt pen thành 2 đoạn
  engine.setTool('select-rect')
  drag(element, [100, 140], [260, 170], 500) // chọn highlighter (đã ở y=150)
  engine.deleteSelection() // 7: xóa highlighter
  return surface.listObjects()
}

describe('A3 — chuỗi hỗn hợp đầy đủ', () => {
  it('7 thao tác = đúng 7 command; undo từng bước giảm đúng số object; redo từng bước khôi phục CHÍNH XÁC trạng thái trước undo (cùng tham chiếu, cùng thứ tự)', () => {
    const ctx = setup()
    const { surface, engine } = ctx
    const finalState: readonly DrawingObject[] = buildMixedChain(ctx)
    // Trạng thái cuối: 2 đoạn pen + rectangle + text = 4 object.
    expect(finalState).toHaveLength(4)
    expect(engine.history.undoCount).toBe(7)
    const finalIds = finalState.map((o) => o.id)

    // Số object sau mỗi lần undo (đi ngược chuỗi thực hiện 7→1):
    // undo delete → 5 (highlighter trở lại); undo segment-erase → 4 (pen hợp nhất);
    // undo move → 4; undo highlighter → 3; undo text → 2; undo rectangle → 1; undo pen → 0.
    const expectedCounts = [5, 4, 4, 3, 2, 1, 0]
    for (const expected of expectedCounts) {
      expect(engine.undo()).toBe(true)
      expect(surface.objectCount).toBe(expected)
    }
    expect(engine.undo()).toBe(false)
    expect(engine.canUndo).toBe(false)
    expect(engine.history.redoCount).toBe(7)

    for (let i = 0; i < 7; i += 1) {
      expect(engine.redo()).toBe(true)
    }
    expect(engine.redo()).toBe(false)
    // Trạng thái sau redo toàn bộ: cùng ID, cùng thứ tự, cùng THAM CHIẾU object.
    expect(surface.listObjects().map((o) => o.id)).toEqual(finalIds)
    surface.listObjects().forEach((object, i) => {
      expect(object).toBe(finalState[i])
    })
  })

  it('vẽ → xóa → undo → redo: object quay lại rồi biến mất đúng một lần mỗi chiều', () => {
    const { element, surface, engine } = setup()
    drag(element, [10, 10], [80, 10], 0)
    const stroke = surface.listObjects()[0]
    engine.setTool('select-rect')
    drag(element, [0, 0], [100, 30], 100)
    engine.deleteSelection()
    expect(surface.objectCount).toBe(0)
    expect(engine.history.undoCount).toBe(2)
    engine.undo()
    expect(surface.getObject(stroke.id)).toBe(stroke)
    engine.redo()
    expect(surface.objectCount).toBe(0)
    engine.undo()
    engine.undo()
    expect(surface.objectCount).toBe(0)
    expect(engine.canUndo).toBe(false)
  })

  it('undo → thao tác mới → nhánh redo bị xóa (mức engine, sau chuỗi hỗn hợp)', () => {
    const ctx = setup()
    const { element, surface, engine } = ctx
    buildMixedChain(ctx)
    engine.undo()
    engine.undo()
    expect(engine.canRedo).toBe(true)
    engine.setTool('pen')
    drag(element, [0, 300], [60, 300], 900)
    expect(engine.canRedo).toBe(false)
    expect(engine.redo()).toBe(false)
    // Sau 2 lần undo: 5 → 4 object; vẽ thêm 1 nét mới → 5.
    expect(surface.objectCount).toBe(5)
  })

  it('thứ tự vẽ được giữ qua move + segment-erase + undo liên tiếp', () => {
    const { element, surface, engine } = setup()
    drag(element, [0, 20], [200, 20], 0) // A: pen
    engine.setTool('rectangle')
    drag(element, [10, 60], [90, 110], 100) // B: rectangle
    drag(element, [0, 200], [80, 240], 200) // C: rectangle thứ hai (cùng công cụ)
    const orderBefore = surface.listObjects().map((o) => o.id)
    engine.setTool('segment-eraser')
    tap(element, [100, 20], 300) // cắt A
    const orderAfterErase = surface.listObjects().map((o) => o.id)
    // Các đoạn của A đứng tại vị trí của A (đầu danh sách), không nhảy xuống cuối.
    expect(orderAfterErase.slice(2)).toEqual(orderBefore.slice(1))
    expect(orderAfterErase).toHaveLength(4)
    engine.undo()
    expect(surface.listObjects().map((o) => o.id)).toEqual(orderBefore)
    engine.redo()
    expect(surface.listObjects().map((o) => o.id)).toEqual(orderAfterErase)
  })
})
