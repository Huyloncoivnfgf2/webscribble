/**
 * Kiểm thử tích hợp TASK-05E qua DrawingEngine: chọn bằng thao tác
 * kéo thật (pointer → Input Manager → Selection Builder → Surface),
 * di chuyển/xóa lựa chọn, hai chế độ tẩy qua công cụ của engine, và
 * tính nhất quán tọa độ world khi camera pan.
 */
import { describe, expect, it } from 'vitest'
import { createCamera, type Camera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'page-1'

function setup(camera: Camera = createCamera()) {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => camera,
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  return { element, scheduler, surface, engine }
}

function drawStroke(
  element: FakeCanvasElement,
  from: [number, number],
  to: [number, number],
  steps = 5,
): void {
  element.dispatch(
    'pointerdown',
    pointerEvent({ clientX: from[0], clientY: from[1], timeStamp: 0 }),
  )
  for (let i = 1; i <= steps; i += 1) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps
    const y = from[1] + ((to[1] - from[1]) * i) / steps
    element.dispatch('pointermove', pointerEvent({ clientX: x, clientY: y, timeStamp: i * 10 }))
  }
  element.dispatch(
    'pointerup',
    pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: 100, buttons: 0 }),
  )
}

function dragRect(
  element: FakeCanvasElement,
  from: [number, number],
  to: [number, number],
): void {
  element.dispatch(
    'pointerdown',
    pointerEvent({ clientX: from[0], clientY: from[1], timeStamp: 200 }),
  )
  element.dispatch(
    'pointermove',
    pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: 210 }),
  )
  element.dispatch(
    'pointerup',
    pointerEvent({ clientX: to[0], clientY: to[1], timeStamp: 220, buttons: 0 }),
  )
}

describe('DrawingEngine — Selection qua thao tác kéo', () => {
  it('select-rect: kéo quanh nét → getSelection chứa đúng ID; kéo vùng trống → chọn rỗng', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [10, 10], [110, 10])
    const strokeId = surface.listObjects()[0].id

    engine.setTool('select-rect')
    dragRect(element, [0, 0], [130, 30])
    expect(engine.getSelection()).toEqual([strokeId])

    dragRect(element, [300, 300], [400, 400])
    expect(engine.getSelection()).toEqual([])
  })

  it('select-lasso: vẽ vòng quanh nét → được chọn', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [20, 50], [120, 50])
    const strokeId = surface.listObjects()[0].id
    engine.setTool('select-lasso')
    element.dispatch('pointerdown', pointerEvent({ clientX: 5, clientY: 30, timeStamp: 200 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 140, clientY: 30, timeStamp: 210 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 140, clientY: 70, timeStamp: 220 }))
    element.dispatch('pointermove', pointerEvent({ clientX: 5, clientY: 70, timeStamp: 230 }))
    element.dispatch(
      'pointerup',
      pointerEvent({ clientX: 5, clientY: 70, timeStamp: 240, buttons: 0 }),
    )
    expect(engine.getSelection()).toEqual([strokeId])
  })

  it('moveSelectionBy di chuyển object đã chọn; deleteSelection xóa chúng', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [10, 10], [60, 10])
    const strokeId = surface.listObjects()[0].id
    engine.setTool('select-rect')
    dragRect(element, [0, 0], [80, 30])
    expect(engine.moveSelectionBy({ x: 100, y: 50 })).toBe(true)
    const moved = surface.getObject(strokeId)
    if (moved?.type !== 'pen') throw new Error('expected pen')
    expect(moved.points[0]).toMatchObject({ x: 110, y: 60 })
    expect(engine.deleteSelection()).toBe(1)
    expect(surface.objectCount).toBe(0)
    expect(engine.getSelection()).toEqual([])
    expect(engine.moveSelectionBy({ x: 1, y: 1 })).toBe(false)
  })

  it('camera pan: thao tác theo tọa độ màn hình vẫn chọn đúng object ở tọa độ world', () => {
    const camera = createCamera({ x: 100, y: 0, zoom: 1 })
    const { element, surface, engine } = setup(camera)
    // Vẽ ở client 10..60 → world 110..160.
    drawStroke(element, [10, 10], [60, 10])
    const stroke = surface.listObjects()[0]
    if (stroke.type !== 'pen') throw new Error('expected pen')
    expect(stroke.points[0].x).toBe(110)

    engine.setTool('select-rect')
    // Kéo client (0,0)-(70,30) → world (100,0)-(170,30): bao nét.
    dragRect(element, [0, 0], [70, 30])
    expect(engine.getSelection()).toEqual([stroke.id])
  })

  it('overlay: sau khi chọn, khung hình vẽ có nét đứt bao quanh object đã chọn', () => {
    const { element, scheduler, engine } = setup()
    drawStroke(element, [10, 10], [60, 10])
    engine.setTool('select-rect')
    dragRect(element, [0, 0], [80, 30])
    scheduler.runAll()
    expect(element.ctx.countCalls('setLineDash')).toBeGreaterThanOrEqual(1)
    expect(element.ctx.dashSegments).toEqual([6, 4])
  })
})

describe('DrawingEngine — Eraser qua công cụ', () => {
  it('stroke-eraser: chạm vào nét → nét bị xóa khỏi Surface', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [10, 50], [110, 50])
    engine.setTool('stroke-eraser')
    element.dispatch('pointerdown', pointerEvent({ clientX: 60, clientY: 50, timeStamp: 300 }))
    expect(surface.objectCount).toBe(0)
  })

  it('segment-eraser: chạm giữa nét → nét tách thành 2 đoạn; ID đã chọn bị loại khỏi lựa chọn', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [0, 50], [200, 50], 10)
    const strokeId = surface.listObjects()[0].id
    engine.setTool('select-rect')
    dragRect(element, [-10, 30], [210, 70])
    expect(engine.getSelection()).toEqual([strokeId])

    engine.setTool('segment-eraser')
    element.dispatch('pointerdown', pointerEvent({ clientX: 100, clientY: 50, timeStamp: 300 }))
    expect(surface.objectCount).toBe(2)
    expect(surface.hasObject(strokeId)).toBe(false)
    // Object gốc đã bị thay thế → lựa chọn không còn giữ ID chết.
    expect(engine.getSelection()).toEqual([])
  })

  it('setEraserSize áp dụng cho phiên tẩy đang mở và các phiên sau', () => {
    const { element, surface, engine } = setup()
    drawStroke(element, [10, 50], [110, 50])
    engine.setTool('stroke-eraser')
    engine.setEraserSize(4) // bán kính 2 + nửa nét 1.5 = 3.5 < khoảng cách 6 → trượt
    element.dispatch('pointerdown', pointerEvent({ clientX: 60, clientY: 56, timeStamp: 300 }))
    element.dispatch(
      'pointerup',
      pointerEvent({ clientX: 60, clientY: 56, timeStamp: 350, buttons: 0 }),
    )
    expect(surface.objectCount).toBe(1)
    engine.setEraserSize(30) // hiệu dụng 16.5 ≥ 6 → trúng
    element.dispatch('pointerdown', pointerEvent({ clientX: 60, clientY: 56, timeStamp: 400 }))
    expect(surface.objectCount).toBe(0)
    expect(engine.eraserSize).toBe(30)
  })

  it('con trỏ tẩy được vẽ phủ (vòng tròn) tại vị trí pointer gần nhất', () => {
    const { element, scheduler, engine } = setup()
    drawStroke(element, [10, 50], [110, 50])
    engine.setTool('stroke-eraser')
    element.dispatch('pointerdown', pointerEvent({ clientX: 300, clientY: 300, timeStamp: 300 }))
    scheduler.runAll()
    const ellipses = element.ctx.calls.filter((call) => call.name === 'ellipse')
    expect(ellipses.length).toBeGreaterThanOrEqual(1)
    const last = ellipses[ellipses.length - 1]
    expect(last.args[0]).toBe(300)
    expect(last.args[1]).toBe(300)
    expect(last.args[2]).toBe(10) // bán kính mặc định = eraserSize 20 / 2 ở zoom 1
  })
})
