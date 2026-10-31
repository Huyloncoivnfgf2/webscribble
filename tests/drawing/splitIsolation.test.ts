/**
 * TASK-05G (B) — Hai DrawingEngine trên hai Surface (mô hình Split
 * Mode, DEC-020): dữ liệu, lựa chọn, camera, công cụ, history và vòng
 * đời attach/detach hoàn toàn độc lập; không có trạng thái toàn cục.
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

function makeEngine(surfaceId: string, kind: 'document-page' | 'whiteboard', cameraX = 0) {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(surfaceId, kind, { width: 794, height: 1123 })
  const camera = { ...createCamera(), x: cameraX }
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => camera,
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  return { element, scheduler, surface, engine, camera }
}

function drag(el: FakeCanvasElement, from: [number, number], to: [number, number], t0 = 0): void {
  el.dispatch('pointerdown', pointerEvent({ clientX: from[0], clientY: from[1], timeStamp: t0 }))
  el.dispatch('pointermove', pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: t0 + 10 }))
  el.dispatch('pointerup', pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: t0 + 20, buttons: 0 }))
}

describe('B — hai engine độc lập (Split model)', () => {
  it('vẽ ở Document không chạm Whiteboard và ngược lại; mỗi object mang surfaceId của bề mặt mình', () => {
    const doc = makeEngine('doc-page-1', 'document-page')
    const board = makeEngine('board-1', 'whiteboard')
    drag(doc.element, [10, 10], [80, 10])
    expect(doc.surface.objectCount).toBe(1)
    expect(board.surface.objectCount).toBe(0)
    expect(doc.surface.listObjects()[0].surfaceId).toBe('doc-page-1')
    drag(board.element, [10, 10], [80, 10])
    expect(board.surface.listObjects()[0].surfaceId).toBe('board-1')
    expect(doc.surface.objectCount).toBe(1)
  })

  it('camera riêng: cùng tọa độ màn hình, hai engine cho tọa độ world khác nhau đúng theo camera của mình', () => {
    const doc = makeEngine('doc-page-1', 'document-page', 0)
    const board = makeEngine('board-1', 'whiteboard', 100)
    drag(doc.element, [10, 10], [80, 10])
    drag(board.element, [10, 10], [80, 10])
    expect(doc.surface.listObjects()[0].bounds.minX).toBeCloseTo(10 - 1.5)
    expect(board.surface.listObjects()[0].bounds.minX).toBeCloseTo(110 - 1.5)
  })

  it('selection không dùng chung: chọn ở Document, Whiteboard không có lựa chọn', () => {
    const doc = makeEngine('doc-page-1', 'document-page')
    const board = makeEngine('board-1', 'whiteboard')
    drag(doc.element, [10, 10], [80, 10])
    drag(board.element, [10, 10], [80, 10])
    doc.engine.setTool('select-rect')
    drag(doc.element, [0, 0], [100, 30], 100)
    expect(doc.engine.getSelection()).toHaveLength(1)
    expect(board.engine.getSelection()).toHaveLength(0)
  })

  it('đổi công cụ ở một engine không ảnh hưởng engine còn lại', () => {
    const doc = makeEngine('doc-page-1', 'document-page')
    const board = makeEngine('board-1', 'whiteboard')
    doc.engine.setTool('stroke-eraser')
    expect(board.engine.tool).toBe('pen')
    drag(board.element, [10, 10], [80, 10])
    expect(board.surface.objectCount).toBe(1) // vẫn vẽ pen bình thường
    expect(board.surface.listObjects()[0].type).toBe('pen')
  })

  it('detach một engine: engine kia vẫn vẽ/undo bình thường; engine bị detach bỏ qua sự kiện', () => {
    const doc = makeEngine('doc-page-1', 'document-page')
    const board = makeEngine('board-1', 'whiteboard')
    doc.engine.detach()
    drag(doc.element, [10, 10], [80, 10])
    expect(doc.surface.objectCount).toBe(0)
    drag(board.element, [10, 10], [80, 10])
    expect(board.surface.objectCount).toBe(1)
    expect(board.engine.undo()).toBe(true)
    expect(board.surface.objectCount).toBe(0)
  })

  it('history độc lập ở mức engine hoàn chỉnh: chuỗi undo/redo đan xen giữa hai bề mặt', () => {
    const doc = makeEngine('doc-page-1', 'document-page')
    const board = makeEngine('board-1', 'whiteboard')
    drag(doc.element, [10, 10], [80, 10], 0)
    drag(board.element, [10, 10], [80, 10], 0)
    drag(doc.element, [10, 40], [80, 40], 100)
    board.engine.undo()
    expect(board.surface.objectCount).toBe(0)
    expect(doc.surface.objectCount).toBe(2)
    doc.engine.undo()
    expect(doc.surface.objectCount).toBe(1)
    board.engine.redo()
    expect(board.surface.objectCount).toBe(1)
    expect(doc.engine.canRedo).toBe(true)
    expect(board.engine.canRedo).toBe(false)
  })

  it('hai engine dùng chung một phần tử canvas là cấu hình SAI — mỗi engine một phần tử riêng là điều kiện cô lập (ghi nhận, không hỗ trợ dùng chung)', () => {
    // Kiểm chứng điều kiện tiền đề: engine gắn listener lên phần tử
    // được cấp; Split Mode cấp hai canvas khác nhau (xem các test trên).
    const a = makeEngine('a', 'document-page')
    const b = makeEngine('b', 'whiteboard')
    expect(a.element).not.toBe(b.element)
    expect(a.engine.history).not.toBe(b.engine.history)
    expect(a.engine.history.surface).toBe(a.surface)
    expect(b.engine.history.surface).toBe(b.surface)
  })
})
