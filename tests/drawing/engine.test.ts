import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'document:doc-1:1'
const BOARD_ID = 'whiteboard:board-1'

function setup(surfaceId: string = PAGE_ID) {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(
    surfaceId,
    surfaceId.startsWith('whiteboard') ? 'whiteboard' : 'document-page',
    { width: 794, height: 1123 },
  )
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => createCamera(),
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  engine.resize(800, 600)
  scheduler.runAll()
  return { element, scheduler, surface, engine }
}

function drawStrokeOn(
  element: FakeCanvasElement,
  points: Array<{ x: number; y: number; time: number; pressure?: number }>,
): void {
  const first = points[0]
  element.dispatch(
    'pointerdown',
    pointerEvent({ clientX: first.x, clientY: first.y, timeStamp: first.time, pressure: first.pressure }),
  )
  for (const point of points.slice(1)) {
    element.dispatch(
      'pointermove',
      pointerEvent({ clientX: point.x, clientY: point.y, timeStamp: point.time, pressure: point.pressure }),
    )
  }
  const last = points[points.length - 1]
  element.dispatch(
    'pointerup',
    pointerEvent({ clientX: last.x, clientY: last.y, timeStamp: last.time + 5, buttons: 0 }),
  )
}

describe('DrawingEngine — luồng vẽ trọn vẹn', () => {
  it('pointer → builder → surface: nét hoàn tất nằm trong Surface với dữ liệu hợp lệ', () => {
    const { element, surface } = setup()
    drawStrokeOn(element, [
      { x: 10, y: 10, time: 1000 },
      { x: 30, y: 16, time: 1016 },
      { x: 50, y: 12, time: 1032 },
    ])
    expect(surface.objectCount).toBe(1)
    const [object] = surface.listObjects()
    expect(object.type).toBe('pen')
    if (object.type !== 'pen') throw new Error('expected pen')
    expect(object.points.map((p) => [p.x, p.y])).toEqual([
      [10, 10],
      [30, 16],
      [50, 12],
    ])
    expect(object.points.map((p) => p.time)).toEqual([0, 16, 32])
    expect(validateDrawingObject(object).valid).toBe(true)
  })

  it('nét đang vẽ được lên lịch render (preview), nét xong nằm trong Surface', () => {
    const { element, scheduler, surface, engine } = setup()
    element.dispatch('pointerdown', pointerEvent({ clientX: 5, clientY: 5, timeStamp: 100 }))
    expect(engine.isDrawingInProgress).toBe(true)
    expect(scheduler.pendingCount).toBe(1)
    scheduler.runAll()
    // Frame đã chạy: preview được vẽ (1 fill) dù Surface còn trống.
    expect(surface.objectCount).toBe(0)
    expect(element.ctx.countCalls('fill')).toBe(1)
    element.dispatch('pointerup', pointerEvent({ clientX: 5, clientY: 5, timeStamp: 120, buttons: 0 }))
    expect(engine.isDrawingInProgress).toBe(false)
    expect(surface.objectCount).toBe(1)
    scheduler.runAll()
    expect(element.ctx.countCalls('fill')).toBe(2)
  })
})

describe('DrawingEngine — công cụ & vòng đời', () => {
  it('đổi công cụ giữa nét: nét cũ được chốt vào Surface, nét sau là highlighter', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', pointerEvent({ clientX: 0, clientY: 0, timeStamp: 0 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 20, clientY: 0, timeStamp: 10 }))
    engine.setTool('highlighter')
    expect(engine.tool).toBe('highlighter')
    expect(surface.objectCount).toBe(1)
    expect(surface.listObjects()[0].type).toBe('pen')

    drawStrokeOn(element, [
      { x: 0, y: 100, time: 2000 },
      { x: 60, y: 100, time: 2010 },
    ])
    expect(surface.objectCount).toBe(2)
    expect(surface.listObjects()[1].type).toBe('highlighter')
  })

  it('detach giữa nét chốt nét vào Surface và chặn đầu vào sau đó', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', pointerEvent({ clientX: 0, clientY: 0, timeStamp: 0 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 15, clientY: 15, timeStamp: 10 }))
    engine.detach()
    expect(surface.objectCount).toBe(1)
    element.dispatch('pointerdown', pointerEvent({ clientX: 50, clientY: 50, timeStamp: 100 }))
    element.dispatch('pointerup', pointerEvent({ clientX: 50, clientY: 50, timeStamp: 110, buttons: 0 }))
    expect(surface.objectCount).toBe(1)
  })

  it('hai engine trên hai surface hoàn toàn độc lập (mô hình Split, DEC-020)', () => {
    const a = setup(PAGE_ID)
    const b = setup(BOARD_ID)
    drawStrokeOn(a.element, [
      { x: 1, y: 1, time: 0 },
      { x: 9, y: 9, time: 10 },
    ])
    expect(a.surface.objectCount).toBe(1)
    expect(b.surface.objectCount).toBe(0)
    drawStrokeOn(b.element, [
      { x: 2, y: 2, time: 0 },
      { x: 8, y: 8, time: 10 },
    ])
    expect(a.surface.objectCount).toBe(1)
    expect(b.surface.objectCount).toBe(1)
    expect(a.surface.listObjects()[0].surfaceId).toBe(PAGE_ID)
    expect(b.surface.listObjects()[0].surfaceId).toBe(BOARD_ID)
  })
})

describe('DrawingEngine — Shape & Text (TASK-05D)', () => {
  it('công cụ rectangle: kéo chuột tạo rectangle trong Surface với bounds đúng', () => {
    const { element, surface, engine } = setup()
    engine.setTool('rectangle')
    element.dispatch('pointerdown', pointerEvent({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 90, clientY: 60, timeStamp: 10 }))
    expect(engine.isDrawingInProgress).toBe(true)
    element.dispatch('pointerup', pointerEvent({ clientX: 90, clientY: 60, timeStamp: 20, buttons: 0 }))
    expect(surface.objectCount).toBe(1)
    const [object] = surface.listObjects()
    expect(object.type).toBe('rectangle')
    expect(object.bounds).toEqual({ minX: 9, minY: 9, maxX: 91, maxY: 61 })
    expect(validateDrawingObject(object).valid).toBe(true)
  })

  it('hình suy biến qua engine bị loại, không vào Surface', () => {
    const { element, surface, engine } = setup()
    engine.setTool('line')
    element.dispatch('pointerdown', pointerEvent({ clientX: 30, clientY: 30, timeStamp: 0 }))
    element.dispatch('pointerup', pointerEvent({ clientX: 30, clientY: 30, timeStamp: 10, buttons: 0 }))
    expect(surface.objectCount).toBe(0)
  })

  it('công cụ text: down phát yêu cầu đặt text; addTextObject tạo TextObject hợp lệ', () => {
    const element = new FakeCanvasElement()
    const scheduler = new FakeFrameScheduler()
    const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
    const placements: { x: number; y: number }[] = []
    const engine = new DrawingEngine({
      surface,
      element,
      getCamera: () => createCamera(),
      tool: 'text',
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
    element.dispatch('pointerdown', pointerEvent({ clientX: 30, clientY: 40, timeStamp: 0 }))
    expect(placements).toEqual([{ x: 30, y: 40 }])
    expect(surface.objectCount).toBe(0) // down chỉ yêu cầu vị trí, chưa tạo object

    const created = engine.addTextObject({ position: placements[0], text: 'Ghi chú bài học' })
    expect(created.type).toBe('text')
    expect(created.width).toBeGreaterThan(0)
    expect(created.height).toBe(20)
    expect(surface.objectCount).toBe(1)
    expect(validateDrawingObject(created).valid).toBe(true)
    expect(() => engine.addTextObject({ position: { x: 0, y: 0 }, text: '  ' })).toThrow()
  })

  it('addTextObject dùng bộ đo canvas của chính engine khi không được tiêm measurer', () => {
    const { engine, surface } = setup()
    const created = engine.addTextObject({ position: { x: 5, y: 5 }, text: 'abcd' })
    // FakeContext2D đo: 4 ký tự × 16 × 0.5 = 32.
    expect(created.width).toBe(32)
    expect(created.height).toBe(20)
    expect(surface.objectCount).toBe(1)
  })
})
