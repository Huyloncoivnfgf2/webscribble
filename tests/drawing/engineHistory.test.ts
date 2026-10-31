/**
 * Kiểm thử tích hợp History qua DrawingEngine (TASK-05F): mọi thao
 * tác của engine — vẽ nét/hình/text, di chuyển lựa chọn, hai chế độ
 * tẩy — đều thành đúng MỘT command; undo/redo khôi phục chính xác và
 * yêu cầu renderer vẽ lại; hai engine trên hai Surface (Split) có
 * lịch sử độc lập.
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine, type DrawingTool } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'page-1'
const BOARD_ID = 'board-1'

function setup(surfaceId = PAGE_ID, kind: 'document-page' | 'whiteboard' = 'document-page') {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(surfaceId, kind, { width: 794, height: 1123 })
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
  element: FakeCanvasElement,
  from: [number, number],
  to: [number, number],
  steps = 4,
  startTime = 0,
): void {
  element.dispatch(
    'pointerdown',
    pointerEvent({ clientX: from[0], clientY: from[1], timeStamp: startTime }),
  )
  for (let i = 1; i <= steps; i += 1) {
    element.dispatch(
      'pointermove',
      pointerEvent({
        clientX: from[0] + ((to[0] - from[0]) * i) / steps,
        clientY: from[1] + ((to[1] - from[1]) * i) / steps,
        timeStamp: startTime + i * 10,
      }),
    )
  }
  element.dispatch(
    'pointerup',
    pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: startTime + 100, buttons: 0 }),
  )
}

function tap(element: FakeCanvasElement, at: [number, number], time = 500): void {
  element.dispatch('pointerdown', pointerEvent({ clientX: at[0], clientY: at[1], timeStamp: time }))
  element.dispatch(
    'pointerup',
    pointerEvent({ clientX: at[0], clientY: at[1], timeStamp: time + 10, buttons: 0 }),
  )
}

describe('DrawingEngine + History — tạo object', () => {
  it('nét Pen: preview đang vẽ dở không ghi history; hoàn tất mới tạo đúng một command; undo/redo giữ nguyên ID', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', pointerEvent({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 30, clientY: 10, timeStamp: 10 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 60, clientY: 10, timeStamp: 20 }))
    expect(engine.isDrawingInProgress).toBe(true)
    expect(engine.history.undoCount).toBe(0) // đang vẽ dở — chưa có command
    expect(surface.objectCount).toBe(0)

    element.dispatch(
      'pointerup',
      pointerEvent({ clientX: 60, clientY: 10, timeStamp: 30, buttons: 0 }),
    )
    expect(surface.objectCount).toBe(1)
    expect(engine.history.undoCount).toBe(1)
    const id = surface.listObjects()[0].id
    expect(engine.undo()).toBe(true)
    expect(surface.objectCount).toBe(0)
    expect(engine.canRedo).toBe(true)
    expect(engine.redo()).toBe(true)
    expect(surface.listObjects()[0].id).toBe(id)
  })

  it('một lần kéo sạch (down → nhiều move → up) tạo đúng một command', () => {
    const { element, surface, engine } = setup()
    drag(element, [10, 20], [210, 20], 20)
    expect(surface.objectCount).toBe(1)
    expect(engine.history.undoCount).toBe(1)
    const id = surface.listObjects()[0].id
    engine.undo()
    expect(surface.objectCount).toBe(0)
    engine.redo()
    expect(surface.listObjects()[0].id).toBe(id)
  })

  it('Highlighter: undo/redo qua engine', () => {
    const { element, surface, engine } = setup()
    engine.setTool('highlighter')
    drag(element, [0, 30], [100, 30])
    expect(surface.listObjects()[0].type).toBe('highlighter')
    engine.undo()
    expect(surface.objectCount).toBe(0)
    engine.redo()
    expect(surface.objectCount).toBe(1)
  })

  it('từng loại Shape: mỗi hình một command; undo hết → trống; redo hết → đủ lại với cùng ID', () => {
    const { element, surface, engine } = setup()
    const tools: DrawingTool[] = ['line', 'rectangle', 'ellipse', 'arrow']
    const createdIds: string[] = []
    tools.forEach((tool, i) => {
      engine.setTool(tool)
      drag(element, [10 + i * 5, 10], [80 + i * 5, 60], 3, i * 200)
      createdIds.push(surface.listObjects()[surface.objectCount - 1].id)
    })
    expect(surface.objectCount).toBe(4)
    expect(engine.history.undoCount).toBe(4)
    for (let i = 0; i < 4; i += 1) engine.undo()
    expect(surface.objectCount).toBe(0)
    for (let i = 0; i < 4; i += 1) engine.redo()
    expect(surface.listObjects().map((o) => o.id)).toEqual(createdIds)
    expect(surface.listObjects().map((o) => o.type)).toEqual(tools)
  })

  it('Text: addTextObject ghi một command; undo/redo giữ nguyên ID và nội dung', () => {
    const { surface, engine } = setup()
    const text = engine.addTextObject({ position: { x: 10, y: 10 }, text: 'Hoàn tác tôi' })
    expect(engine.history.undoCount).toBe(1)
    engine.undo()
    expect(surface.objectCount).toBe(0)
    engine.redo()
    const restored = surface.getObject(text.id)
    expect(restored).toBe(text)
  })
})

describe('DrawingEngine + History — di chuyển & xóa lựa chọn', () => {
  it('di chuyển NHIỀU object đã chọn là một command; undo trả cả nhóm về vị trí cũ', () => {
    const { element, surface, engine } = setup()
    drag(element, [10, 10], [60, 10], 3, 0)
    drag(element, [10, 40], [60, 40], 3, 300)
    const [first, second] = surface.listObjects()
    engine.setTool('select-rect')
    drag(element, [0, 0], [80, 60], 1, 600)
    expect(engine.getSelection()).toHaveLength(2)
    const undoBefore = engine.history.undoCount

    expect(engine.moveSelectionBy({ x: 50, y: 50 })).toBe(true)
    expect(engine.history.undoCount).toBe(undoBefore + 1)
    engine.undo()
    expect(surface.getObject(first.id)?.bounds).toEqual(first.bounds)
    expect(surface.getObject(second.id)?.bounds).toEqual(second.bounds)
    engine.redo()
    expect(surface.getObject(first.id)?.bounds.minX).toBeCloseTo(first.bounds.minX + 50)
  })

  it('xóa lựa chọn là một command và undo khôi phục cả nhóm', () => {
    const { element, surface, engine } = setup()
    drag(element, [10, 10], [60, 10], 3, 0)
    drag(element, [10, 40], [60, 40], 3, 300)
    engine.setTool('select-rect')
    drag(element, [0, 0], [80, 60], 1, 600)
    expect(engine.deleteSelection()).toBe(2)
    expect(surface.objectCount).toBe(0)
    engine.undo()
    expect(surface.objectCount).toBe(2)
    engine.redo()
    expect(surface.objectCount).toBe(0)
  })
})

describe('DrawingEngine + History — Eraser được gom nhóm', () => {
  it('Stroke Eraser: một lần kéo xóa 3 nét = MỘT command; undo khôi phục cả 3 theo đúng thứ tự', () => {
    const { element, surface, engine } = setup()
    drag(element, [10, 10], [60, 10], 3, 0)
    drag(element, [10, 30], [60, 30], 3, 300)
    drag(element, [10, 50], [60, 50], 3, 600)
    const originalIds = surface.listObjects().map((o) => o.id)
    const undoBefore = engine.history.undoCount

    engine.setTool('stroke-eraser')
    // Kéo tẩy dọc từ trên xuống, quét qua cả ba nét.
    element.dispatch('pointerdown', pointerEvent({ clientX: 35, clientY: 0, timeStamp: 900 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 35, clientY: 25, timeStamp: 910 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 35, clientY: 55, timeStamp: 920 }))
    element.dispatch(
      'pointerup',
      pointerEvent({ clientX: 35, clientY: 55, timeStamp: 930, buttons: 0 }),
    )
    expect(surface.objectCount).toBe(0)
    expect(engine.history.undoCount).toBe(undoBefore + 1) // đúng MỘT command cho cả lần kéo

    engine.undo()
    expect(surface.listObjects().map((o) => o.id)).toEqual(originalIds)
    engine.redo()
    expect(surface.objectCount).toBe(0)
  })

  it('Segment Eraser: undo khôi phục nét gốc nguyên bản; redo tái tạo đúng các đoạn (cùng ID đoạn)', () => {
    const { element, surface, engine } = setup()
    drag(element, [0, 50], [200, 50], 10, 0)
    const original = surface.listObjects()[0]
    const undoBefore = engine.history.undoCount

    engine.setTool('segment-eraser')
    tap(element, [100, 50], 500)
    expect(surface.objectCount).toBe(2)
    expect(engine.history.undoCount).toBe(undoBefore + 1)
    const segmentIds = surface.listObjects().map((o) => o.id)

    engine.undo()
    expect(surface.objectCount).toBe(1)
    expect(surface.listObjects()[0]).toBe(original)
    engine.redo()
    expect(surface.listObjects().map((o) => o.id)).toEqual(segmentIds)
  })

  it('Segment Eraser kéo dài qua nhiều move vẫn là một command', () => {
    const { element, surface, engine } = setup()
    drag(element, [0, 50], [300, 50], 15, 0)
    const undoBefore = engine.history.undoCount
    engine.setTool('segment-eraser')
    element.dispatch('pointerdown', pointerEvent({ clientX: 40, clientY: 50, timeStamp: 500 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 120, clientY: 50, timeStamp: 510 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 200, clientY: 50, timeStamp: 520 }))
    element.dispatch(
      'pointerup',
      pointerEvent({ clientX: 200, clientY: 50, timeStamp: 530, buttons: 0 }),
    )
    expect(engine.history.undoCount).toBe(undoBefore + 1)
    // Vùng tẩy phủ x ≈ 28.5..211.5: còn hai đoạn — đầu nét bên trái và cuối nét bên phải.
    expect(surface.objectCount).toBe(2)
    engine.undo()
    expect(surface.objectCount).toBe(1)
    engine.redo()
    expect(surface.objectCount).toBe(2)
  })

  it('lần tẩy không chạm gì thì không tạo command', () => {
    const { element, engine } = setup()
    drag(element, [10, 10], [60, 10], 3, 0)
    const undoBefore = engine.history.undoCount
    engine.setTool('stroke-eraser')
    tap(element, [400, 400], 500)
    expect(engine.history.undoCount).toBe(undoBefore)
  })
})

describe('DrawingEngine + History — redraw & cô lập', () => {
  it('undo/redo yêu cầu renderer vẽ lại từ Surface', () => {
    const { element, scheduler, engine } = setup()
    drag(element, [10, 10], [60, 10], 3, 0)
    scheduler.runAll()
    const clearsBefore = element.ctx.countCalls('clearRect')
    engine.undo()
    scheduler.runAll()
    expect(element.ctx.countCalls('clearRect')).toBeGreaterThan(clearsBefore)
    const clearsAfterUndo = element.ctx.countCalls('clearRect')
    engine.redo()
    scheduler.runAll()
    expect(element.ctx.countCalls('clearRect')).toBeGreaterThan(clearsAfterUndo)
  })

  it('camera/preview không tạo history: requestRender thuần túy không đổi undoCount', () => {
    const { engine } = setup()
    engine.requestRender()
    expect(engine.history.undoCount).toBe(0)
    expect(engine.canUndo).toBe(false)
    expect(engine.undo()).toBe(false)
  })

  it('hai engine trên hai Surface (Split): lịch sử hoàn toàn độc lập', () => {
    const a = setup(PAGE_ID, 'document-page')
    const b = setup(BOARD_ID, 'whiteboard')
    drag(a.element, [10, 10], [60, 10], 3, 0)
    drag(b.element, [10, 10], [60, 10], 3, 0)
    drag(b.element, [10, 30], [60, 30], 3, 300)
    expect(a.engine.history).not.toBe(b.engine.history)

    a.engine.undo()
    expect(a.surface.objectCount).toBe(0)
    expect(b.surface.objectCount).toBe(2)
    expect(b.engine.history.undoCount).toBe(2)
    b.engine.undo()
    expect(b.surface.objectCount).toBe(1)
    expect(a.engine.canRedo).toBe(true)
  })
})
