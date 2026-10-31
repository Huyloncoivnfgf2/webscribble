/**
 * TASK-05G — Kiểm thử tích hợp toàn bộ công cụ qua DrawingEngine
 * (pointer down/move/up/cancel đầy đủ): preview, hoàn tất, object lưu
 * đúng Surface, renderer hiển thị, không sinh object rác từ thao tác
 * không hợp lệ; Selection & Eraser trên cảnh có nét chồng/giao nhau,
 * và nguyên tắc không đụng object không liên quan.
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine, type DrawingTool } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'page-1'

function setup() {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
  const placements: { x: number; y: number }[] = []
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => createCamera(),
    onTextPlacementRequested: (position) => placements.push(position),
    textMeasurer: {
      measureWidth: (line, style) => [...line].length * style.fontSize * 0.5,
      lineHeight: (style) => style.fontSize * 1.25,
    },
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  return { element, scheduler, surface, engine, placements }
}

type Ev = ReturnType<typeof pointerEvent>

function down(el: FakeCanvasElement, x: number, y: number, t: number, extra?: Partial<Ev>): void {
  el.dispatch('pointerdown', pointerEvent({ clientX: x, clientY: y, timeStamp: t, ...extra }))
}
function move(el: FakeCanvasElement, x: number, y: number, t: number, extra?: Partial<Ev>): void {
  el.dispatch('pointermove', pointerEvent({ clientX: x, clientY: y, timeStamp: t, ...extra }))
}
function up(el: FakeCanvasElement, x: number, y: number, t: number): void {
  el.dispatch('pointerup', pointerEvent({ clientX: x, clientY: y, timeStamp: t, buttons: 0 }))
}
function cancel(el: FakeCanvasElement, x: number, y: number, t: number): void {
  el.dispatch('pointercancel', pointerEvent({ clientX: x, clientY: y, timeStamp: t, buttons: 0 }))
}
function drag(el: FakeCanvasElement, from: [number, number], to: [number, number], t0 = 0): void {
  down(el, from[0], from[1], t0)
  move(el, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, t0 + 10)
  move(el, to[0], to[1], t0 + 20)
  up(el, to[0], to[1], t0 + 30)
}

describe('A1 — từng công cụ: down/move/up, preview, hoàn tất, lưu Surface', () => {
  it('pen: preview hiển thị trong lúc kéo (renderer vẽ dù Surface chưa có object); up → object hợp lệ', () => {
    const { element, scheduler, surface, engine } = setup()
    down(element, 10, 10, 0)
    move(element, 40, 10, 10)
    expect(surface.objectCount).toBe(0)
    scheduler.runAll()
    expect(element.ctx.fills.length).toBeGreaterThanOrEqual(1) // preview được vẽ
    up(element, 60, 10, 20)
    expect(surface.objectCount).toBe(1)
    const stroke = surface.listObjects()[0]
    expect(stroke.type).toBe('pen')
    expect(validateDrawingObject(stroke).valid).toBe(true)
    expect(engine.history.undoCount).toBe(1)
  })

  it('pen: pointer CANCEL giữa nét → nét được hoàn tất và giữ lại (chính sách 05C), không treo trạng thái', () => {
    const { element, surface, engine } = setup()
    down(element, 10, 10, 0)
    move(element, 50, 10, 10)
    cancel(element, 50, 10, 20)
    expect(surface.objectCount).toBe(1)
    expect(engine.isDrawingInProgress).toBe(false)
    expect(engine.history.undoCount).toBe(1)
    // Thao tác tiếp theo hoạt động bình thường.
    drag(element, 10, 30, 100)
    expect(surface.objectCount).toBe(2)
  })

  it('highlighter: object đúng loại và style mặc định (size 14, opacity 0.4)', () => {
    const { element, surface, engine } = setup()
    engine.setTool('highlighter')
    drag(element, 0, 20, 100)
    const object = surface.listObjects()[0]
    expect(object.type).toBe('highlighter')
    if (object.type === 'highlighter') {
      expect(object.style.size).toBe(14)
      expect(object.style.opacity).toBeCloseTo(0.4)
    }
  })

  it('4 loại shape: mỗi loại tạo đúng object; cancel giữa chừng giữ hình hợp lệ', () => {
    const { element, surface, engine } = setup()
    const tools: DrawingTool[] = ['line', 'rectangle', 'ellipse', 'arrow']
    tools.forEach((tool, i) => {
      engine.setTool(tool)
      drag(element, [10, 10 + i * 30], [90, 40 + i * 30], i * 100)
    })
    expect(surface.listObjects().map((o) => o.type)).toEqual(tools)
    for (const object of surface.listObjects()) {
      expect(validateDrawingObject(object).valid).toBe(true)
    }
    // Cancel với hình đang kéo dở nhưng đã có kích thước → giữ lại.
    engine.setTool('rectangle')
    down(element, 200, 10, 500)
    move(element, 260, 50, 510)
    cancel(element, 260, 50, 520)
    expect(surface.objectCount).toBe(5)
    expect(engine.isDrawingInProgress).toBe(false)
  })

  it('thao tác không hợp lệ không sinh object rác: hình suy biến, click không kéo với shape, move/up lạc không có down', () => {
    const { element, surface, engine } = setup()
    engine.setTool('rectangle')
    down(element, 50, 50, 0)
    up(element, 50, 50, 10) // click không kéo → discarded
    expect(surface.objectCount).toBe(0)
    expect(engine.history.undoCount).toBe(0)

    // move/up khi không có thao tác nào đang diễn ra → bị bỏ qua an toàn.
    move(element, 100, 100, 20)
    up(element, 100, 100, 30)
    expect(surface.objectCount).toBe(0)

    engine.setTool('line')
    down(element, 0, 0, 40)
    up(element, 1, 0, 50) // ngắn hơn minSize → discarded
    expect(surface.objectCount).toBe(0)
    expect(engine.history.undoCount).toBe(0)
  })

  it('pen click một điểm (down+up cùng chỗ) tạo nét chấm 1 điểm hợp lệ — không phải rác', () => {
    const { element, surface } = setup()
    down(element, 30, 30, 0)
    up(element, 30, 30, 10)
    expect(surface.objectCount).toBe(1)
    const dot = surface.listObjects()[0]
    if (dot.type !== 'pen') throw new Error('expected pen')
    expect(dot.points).toHaveLength(1)
    expect(validateDrawingObject(dot).valid).toBe(true)
  })

  it('text: down chỉ phát yêu cầu đặt text (không tạo object); addTextObject mới tạo', () => {
    const { element, surface, engine, placements } = setup()
    engine.setTool('text')
    down(element, 40, 60, 0)
    expect(placements).toEqual([{ x: 40, y: 60 }])
    expect(surface.objectCount).toBe(0)
    const created = engine.addTextObject({ position: placements[0], text: 'Chào buổi sáng' })
    expect(surface.getObject(created.id)).toBe(created)
  })
})

describe('A2 — Selection & Eraser trên cảnh chồng/giao nhau', () => {
  function crossingScene() {
    const ctx = setup()
    // Nét ngang và nét dọc cắt nhau tại (50, 50); một nét ngang khác song song cách 30 đơn vị.
    drag(ctx.element, [0, 50], [100, 50], 0)
    drag(ctx.element, [50, 0], [50, 100], 100)
    drag(ctx.element, [0, 80], [100, 80], 200)
    const [horizontal, vertical, parallel] = ctx.surface.listObjects()
    return { ...ctx, horizontal, vertical, parallel }
  }

  it('stroke eraser chạm đúng điểm GIAO nhau → cả hai nét giao nhau bị xóa, nét song song không liên quan còn nguyên', () => {
    const { element, surface, engine, parallel } = crossingScene()
    engine.setTool('stroke-eraser')
    down(element, 50, 50, 300)
    up(element, 50, 50, 310)
    expect(surface.objectCount).toBe(1)
    expect(surface.listObjects()[0]).toBe(parallel)
  })

  it('stroke eraser chạm một nét trong hai nét sát nhau → chỉ nét đó bị xóa, nét kia nguyên tham chiếu', () => {
    const { element, surface, engine, horizontal, parallel } = crossingScene()
    engine.setTool('stroke-eraser')
    // (20, 50) chỉ thuộc nét ngang đầu; nét dọc ở x=50 cách 30, nét song song ở y=80 cách 30 — đều ngoài bán kính hiệu dụng 11.5.
    down(element, 20, 50, 300)
    up(element, 20, 50, 310)
    expect(surface.hasObject(horizontal.id)).toBe(false)
    expect(surface.listObjects()).toContain(parallel)
    expect(surface.objectCount).toBe(2)
  })

  it('segment eraser cắt một nét trong cảnh chồng nhau → nét còn lại nguyên vẹn tuyệt đối', () => {
    const { element, surface, engine, vertical } = crossingScene()
    const verticalSnapshot = surface.getObject(vertical.id)
    engine.setTool('segment-eraser')
    down(element, 20, 50, 300) // giữa nét ngang, xa nét dọc (x=50)
    up(element, 20, 50, 310)
    expect(surface.getObject(vertical.id)).toBe(verticalSnapshot)
    expect(surface.objectCount).toBe(4) // nét ngang tách thành 2 đoạn + nét dọc + nét song song
  })

  it('rect selection chỉ lấy object trong vùng; move không đụng object ngoài lựa chọn', () => {
    const { element, surface, engine, horizontal, vertical, parallel } = crossingScene()
    engine.setTool('select-rect')
    drag(element, [-5, 40], [105, 60], 300) // dải ngang ôm nét ngang, cắt nét dọc, không chạm nét y=80
    const selected = engine.getSelection()
    expect(new Set(selected)).toEqual(new Set([horizontal.id, vertical.id]))
    engine.moveSelectionBy({ x: 0, y: 200 })
    expect(surface.getObject(parallel.id)).toBe(parallel) // nguyên tham chiếu
    expect(surface.getObject(horizontal.id)?.bounds.minY).toBeCloseTo(horizontal.bounds.minY + 200)
  })

  it('lasso ôm đúng một nét trong cảnh chồng nhau', () => {
    const { element, engine, parallel } = crossingScene()
    engine.setTool('select-lasso')
    // Lasso ôm đoạn trái của nét song song (x −5..30) — nét dọc ở x=50 nằm ngoài vòng.
    down(element, -5, 70, 300)
    move(element, 30, 70, 310)
    move(element, 30, 90, 320)
    move(element, -5, 90, 330)
    up(element, -5, 90, 340)
    expect(engine.getSelection()).toEqual([parallel.id])
  })

  it('delete selection chỉ xóa object đã chọn', () => {
    const { element, surface, engine, parallel } = crossingScene()
    engine.setTool('select-rect')
    drag(element, [-5, 70], [30, 90], 300) // chỉ ôm đoạn trái của nét song song
    expect(engine.getSelection()).toEqual([parallel.id])
    expect(engine.deleteSelection()).toBe(1)
    expect(surface.objectCount).toBe(2)
    expect(surface.hasObject(parallel.id)).toBe(false)
  })
})
