import { describe, expect, it } from 'vitest'
import { CanvasRenderer } from '../../src/engines/drawing/canvasRenderer'
import { createCamera, type Camera } from '../../src/engines/drawing/coordinates'
import { createLine, createPenStroke } from '../../src/engines/drawing/objects'
import type { DrawingObject } from '../../src/engines/drawing/types'
import { FakeCanvas, FakeFrameScheduler } from './fakes'

const SURFACE = 'document:doc-1:1'

function aPen(): DrawingObject {
  return createPenStroke({
    surfaceId: SURFACE,
    points: [
      { x: 10, y: 10, pressure: 0.5, time: 0 },
      { x: 60, y: 10, pressure: 0.5, time: 10 },
    ],
  })
}

function setup(dpr = 1) {
  const canvas = new FakeCanvas()
  const scheduler = new FakeFrameScheduler()
  let objects: DrawingObject[] = []
  let previews: DrawingObject[] = []
  let camera: Camera = createCamera()
  const renderer = new CanvasRenderer({
    canvas,
    getObjects: () => objects,
    getPreviewObjects: () => previews,
    getCamera: () => camera,
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => dpr,
  })
  return {
    canvas,
    scheduler,
    renderer,
    setObjects(next: DrawingObject[]) {
      objects = next
    },
    setPreviews(next: DrawingObject[]) {
      previews = next
    },
    setCamera(next: Camera) {
      camera = next
    },
  }
}

describe('CanvasRenderer — resize & DPR', () => {
  it('backing store = kích thước CSS × DPR; kích thước không hợp lệ bị từ chối', () => {
    const { canvas, renderer } = setup(2)
    renderer.resize(400, 300)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(renderer.cssSize).toEqual({ width: 400, height: 300 })
    expect(renderer.backingSize).toEqual({ width: 800, height: 600 })
    expect(() => renderer.resize(0, 100)).toThrow()
    expect(() => renderer.resize(Number.NaN, 100)).toThrow()
  })

  it('renderNow xóa bằng transform đơn vị rồi vẽ theo transform DPR', () => {
    const { canvas, renderer, setObjects } = setup(2)
    renderer.resize(400, 300)
    setObjects([aPen()])
    canvas.ctx.calls.length = 0
    renderer.renderNow()
    const calls = canvas.ctx.calls
    expect(calls[0]).toEqual({ name: 'setTransform', args: [1, 0, 0, 1, 0, 0] })
    expect(calls[1]).toEqual({ name: 'clearRect', args: [0, 0, 800, 600] })
    expect(calls[2]).toEqual({ name: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
    expect(canvas.ctx.countCalls('fill')).toBe(1)
  })
})

describe('CanvasRenderer — lịch render bằng rAF', () => {
  it('nhiều requestRender liên tiếp gộp thành một frame duy nhất', () => {
    const { canvas, renderer, scheduler, setObjects } = setup()
    renderer.resize(200, 200)
    scheduler.runAll() // frame của resize
    canvas.ctx.calls.length = 0
    setObjects([aPen()])
    renderer.requestRender()
    renderer.requestRender()
    renderer.requestRender()
    expect(scheduler.pendingCount).toBe(1)
    expect(renderer.isFramePending).toBe(true)
    scheduler.runAll()
    expect(renderer.isFramePending).toBe(false)
    expect(canvas.ctx.countCalls('fill')).toBe(1) // chỉ vẽ đúng một lần
  })

  it('dispose hủy frame đang chờ; requestRender/renderNow sau dispose đều vô hiệu', () => {
    const { canvas, renderer, scheduler, setObjects } = setup()
    renderer.resize(200, 200)
    scheduler.runAll()
    canvas.ctx.calls.length = 0
    setObjects([aPen()])
    renderer.requestRender()
    renderer.dispose()
    expect(scheduler.pendingCount).toBe(0)
    expect(scheduler.cancelled.length).toBe(1)
    scheduler.runAll()
    renderer.requestRender()
    renderer.renderNow()
    expect(canvas.ctx.calls).toEqual([])
    expect(renderer.isDisposed).toBe(true)
  })
})

describe('CanvasRenderer — nội dung vẽ', () => {
  it('redraw toàn bộ từ dữ liệu nguồn: thêm object thì lần vẽ sau có thêm nét', () => {
    const { canvas, renderer, setObjects } = setup()
    renderer.resize(300, 300)
    setObjects([aPen()])
    renderer.renderNow()
    expect(canvas.ctx.countCalls('fill')).toBe(1)
    setObjects([aPen(), aPen()])
    renderer.renderNow()
    expect(canvas.ctx.countCalls('fill')).toBe(3) // 1 cũ + 2 mới (vẽ lại từ đầu)
  })

  it('bỏ qua object không phải nét (line) và vẽ preview sau object chính', () => {
    const { canvas, renderer, setObjects, setPreviews } = setup()
    renderer.resize(300, 300)
    const line = createLine({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 50, y: 50 },
    })
    setObjects([line])
    renderer.renderNow()
    expect(canvas.ctx.countCalls('fill')).toBe(0)
    setPreviews([aPen()])
    renderer.renderNow()
    expect(canvas.ctx.countCalls('fill')).toBe(1)
  })

  it('đổi camera rồi render lại: tọa độ vẽ đổi, dữ liệu object không đổi', () => {
    const { canvas, renderer, setObjects, setCamera } = setup()
    renderer.resize(300, 300)
    const pen = aPen()
    const snapshot = JSON.stringify(pen)
    setObjects([pen])
    renderer.renderNow()
    const firstMove = canvas.ctx.calls.find((c) => c.name === 'moveTo')
    canvas.ctx.calls.length = 0
    setCamera(createCamera({ x: 40, y: 0 }))
    renderer.renderNow()
    const secondMove = canvas.ctx.calls.find((c) => c.name === 'moveTo')
    expect(firstMove).toBeDefined()
    expect(secondMove).toBeDefined()
    expect(secondMove?.args[0]).not.toBeCloseTo(firstMove?.args[0] as number, 3)
    expect(JSON.stringify(pen)).toBe(snapshot)
  })
})
