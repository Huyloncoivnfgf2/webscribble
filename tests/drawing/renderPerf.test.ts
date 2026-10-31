/**
 * TASK-05G (C) — Benchmark/stress test cho rendering, selection và
 * history. Mục đích: ghi nhận thời gian đo được trong MÔI TRƯỜNG NÀY
 * (Node + Vitest + FakeContext2D ghi lệnh, không phải GPU trình
 * duyệt) và chặn các thoái hóa dạng treo/phình thời gian — KHÔNG đặt
 * ngưỡng hiệu năng tùy tiện cho thiết bị thật. Số đo được in ra log
 * để đưa vào báo cáo kèm bối cảnh môi trường.
 */
import { describe, expect, it } from 'vitest'
import { CanvasRenderer } from '../../src/engines/drawing/canvasRenderer'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { HistoryManager, performAddObject } from '../../src/engines/drawing/history'
import { createPenStroke } from '../../src/engines/drawing/objects'
import { selectObjects } from '../../src/engines/drawing/selection'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { StrokePoint } from '../../src/engines/drawing/types'
import { FakeCanvasElement, FakeFrameScheduler } from './fakes'

const PAGE_ID = 'page-1'
const HANG_GUARD_MS = 15_000

function strokePoints(count: number, seed = 0): StrokePoint[] {
  const points: StrokePoint[] = []
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: (seed % 700) + i * 1.5,
      y: 100 + Math.sin(i / 6 + seed) * 24,
      pressure: 0.5,
      time: i * 8,
    })
  }
  return points
}

function scene(strokeCount: number, pointsPerStroke: number): InMemorySurface {
  const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
  for (let s = 0; s < strokeCount; s += 1) {
    surface.addObject(createPenStroke({ surfaceId: PAGE_ID, points: strokePoints(pointsPerStroke, s) }))
  }
  return surface
}

function makeRenderer(surface: InMemorySurface, zoom = 1) {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const camera = { ...createCamera(), zoom }
  const renderer = new CanvasRenderer({
    canvas: element,
    getObjects: () => surface.listObjects(),
    getCamera: () => camera,
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  renderer.resize(794, 1123)
  return { element, scheduler, renderer }
}

function measure(label: string, fn: () => void): number {
  const start = performance.now()
  fn()
  const elapsed = performance.now() - start
  console.log(`[perf] ${label}: ${elapsed.toFixed(1)}ms`)
  return elapsed
}

describe('C — stress render toàn Surface', () => {
  it.each([100, 500, 1000])('renderNow với %i nét × 50 điểm: vẽ đủ từng nét, không treo', (count) => {
    const surface = scene(count, 50)
    const { element, renderer } = makeRenderer(surface)
    const elapsed = measure(`render ${count} strokes x50pts`, () => renderer.renderNow())
    expect(element.ctx.fills).toHaveLength(count)
    expect(elapsed).toBeLessThan(HANG_GUARD_MS)
  })

  it('một nét 10.000 điểm: render hoàn tất, outline được tính từ raw points', () => {
    const surface = scene(1, 10_000)
    const { element, renderer } = makeRenderer(surface)
    const elapsed = measure('render 1 stroke x10000pts', () => renderer.renderNow())
    expect(element.ctx.fills).toHaveLength(1)
    expect(element.ctx.calls.filter((c) => c.name === 'lineTo').length).toBeGreaterThan(5_000)
    expect(elapsed).toBeLessThan(HANG_GUARD_MS)
  })

  it('render ở zoom 3 với 500 nét: vẫn đủ số nét, thời gian không phình bất thường', () => {
    const surface = scene(500, 50)
    const { element, renderer } = makeRenderer(surface, 3)
    const elapsed = measure('render 500 strokes zoom=3', () => renderer.renderNow())
    expect(element.ctx.fills).toHaveLength(500)
    expect(elapsed).toBeLessThan(HANG_GUARD_MS)
  })
})

describe('C — vòng đời render: gộp frame, dispose, DPR', () => {
  it('50 lần requestRender liên tiếp chỉ tạo MỘT frame (không có nhiều vòng rAF)', () => {
    const surface = scene(10, 20)
    const { element, scheduler, renderer } = makeRenderer(surface)
    for (let i = 0; i < 50; i += 1) renderer.requestRender()
    expect(scheduler.pendingCount).toBe(1)
    scheduler.runAll()
    expect(element.ctx.countCalls('clearRect')).toBe(1)
  })

  it('dispose hủy frame đang chờ; requestRender/renderNow sau dispose là no-op an toàn', () => {
    const surface = scene(10, 20)
    const { element, scheduler, renderer } = makeRenderer(surface)
    renderer.requestRender()
    expect(scheduler.pendingCount).toBe(1)
    renderer.dispose()
    expect(scheduler.pendingCount).toBe(0)
    renderer.requestRender()
    expect(scheduler.pendingCount).toBe(0)
    renderer.renderNow()
    expect(element.ctx.countCalls('clearRect')).toBe(0)
  })

  it('DPR 2: backing store gấp đôi kích thước CSS và transform dùng đúng DPR', () => {
    const surface = scene(1, 5)
    const element = new FakeCanvasElement()
    const scheduler = new FakeFrameScheduler()
    const renderer = new CanvasRenderer({
      canvas: element,
      getObjects: () => surface.listObjects(),
      getCamera: () => createCamera(),
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
      getDevicePixelRatio: () => 2,
    })
    renderer.resize(120, 80)
    expect(element.width).toBe(240)
    expect(element.height).toBe(160)
    renderer.renderNow()
    const transforms = element.ctx.calls.filter((c) => c.name === 'setTransform')
    // Transform theo DPR (2,0,0,2) phải được áp trong quá trình vẽ.
    expect(transforms.some((c) => c.args.slice(0, 4).join(',') === '2,0,0,2')).toBe(true)
  })
})

describe('C — stress selection & history', () => {
  it('selectObjects trên 1.000 nét với vùng chọn phủ một nửa: đúng số lượng, không treo', () => {
    const surface = scene(1000, 50)
    const region = { kind: 'rect' as const, rect: { minX: 0, minY: 0, maxX: 400, maxY: 1123 } }
    let selected: string[] = []
    const elapsed = measure('selectObjects 1000 strokes', () => {
      selected = selectObjects(surface.listObjects(), region)
    })
    // Nét s bắt đầu tại x = s % 700: 401 nét (s 0..400) + 300 nét (s 700..999,
    // bắt đầu 0..299) chạm vùng, cộng hiệu ứng biên → 702.
    expect(selected.length).toBeGreaterThan(400)
    expect(selected.length).toBeLessThan(750)
    expect(elapsed).toBeLessThan(HANG_GUARD_MS)
  })

  it('history: 200 lần add + 200 undo + 200 redo trên Surface 500 object — trạng thái cuối đúng', () => {
    const surface = scene(500, 10)
    const history = new HistoryManager(surface, { limit: 1000 })
    const addedIds: string[] = []
    const addElapsed = measure('history 200 adds', () => {
      for (let i = 0; i < 200; i += 1) {
        const object = createPenStroke({ surfaceId: PAGE_ID, points: strokePoints(5, 1000 + i) })
        addedIds.push(object.id)
        history.execute('add', (s) => performAddObject(s, object))
      }
    })
    expect(surface.objectCount).toBe(700)
    const undoElapsed = measure('history 200 undos', () => {
      for (let i = 0; i < 200; i += 1) history.undo()
    })
    expect(surface.objectCount).toBe(500)
    const redoElapsed = measure('history 200 redos', () => {
      for (let i = 0; i < 200; i += 1) history.redo()
    })
    expect(surface.objectCount).toBe(700)
    expect(surface.listObjects().slice(500).map((o) => o.id)).toEqual(addedIds)
    expect(Math.max(addElapsed, undoElapsed, redoElapsed)).toBeLessThan(HANG_GUARD_MS)
  })
})
