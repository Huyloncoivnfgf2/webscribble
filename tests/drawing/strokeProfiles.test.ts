import { describe, expect, it } from 'vitest'
import { getStroke } from 'perfect-freehand'
import { createCamera, worldToScreen } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { createStrokeOfKind } from '../../src/engines/drawing/objects'
import {
  drawStroke,
  strokeOutlinePoints,
  type CanvasContextLike,
} from '../../src/engines/drawing/renderer'
import { STROKE_KINDS, STROKE_PROFILES } from '../../src/engines/drawing/strokeProfiles'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { StrokeKind, StrokeObject, StrokePoint } from '../../src/engines/drawing/types'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import { FakeCanvasElement, FakeContext2D, FakeFrameScheduler, pointerEvent } from './fakes'

const SURFACE_ID = 'document:doc-pens:0'

const POINTS: StrokePoint[] = [
  { x: 10, y: 40, pressure: 0.2, time: 0 },
  { x: 40, y: 46, pressure: 0.6, time: 16 },
  { x: 70, y: 38, pressure: 0.9, time: 32 },
  { x: 100, y: 44, pressure: 0.4, time: 48 },
]

function strokeOf(kind: StrokeKind, style?: Partial<StrokeObject['style']>): StrokeObject {
  return createStrokeOfKind(kind, {
    surfaceId: SURFACE_ID,
    points: POINTS,
    style: { size: 4, opacity: 1, color: '#111827', ...style },
  })
}

/** Outline tính bằng tham số perfect-freehand GỐC của TASK-05 (trước TASK-14D). */
function legacyOutline(object: StrokeObject, thinning: number) {
  const camera = createCamera({ x: 0, y: 0, zoom: 1.5 })
  const screenPoints = object.points.map((point) => {
    const screen = worldToScreen(point, camera)
    return { x: screen.x, y: screen.y, pressure: point.pressure }
  })
  return getStroke(screenPoints, {
    size: object.style.size * camera.zoom,
    thinning,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: true,
  }).map(([x, y]) => ({ x, y }))
}

/** Bề dày outline ở băng giữa nét (bỏ hai đầu thon). */
function midBandHeight(object: StrokeObject): number {
  const outline = strokeOutlinePoints(object, createCamera())
  const mid = outline.filter((p) => p.x >= 40 && p.x <= 70)
  const ys = mid.map((p) => p.y)
  return Math.max(...ys) - Math.min(...ys)
}

describe('Hồ sơ bút — khóa tương thích ngược (DEC-036)', () => {
  it('outline của pen giống HỆT tham số gốc (thinning 0.5)', () => {
    const object = strokeOf('pen')
    expect(strokeOutlinePoints(object, createCamera({ x: 0, y: 0, zoom: 1.5 }))).toEqual(
      legacyOutline(object, 0.5),
    )
  })

  it('outline của highlighter giống HỆT tham số gốc (thinning 0)', () => {
    const object = strokeOf('highlighter')
    expect(strokeOutlinePoints(object, createCamera({ x: 0, y: 0, zoom: 1.5 }))).toEqual(
      legacyOutline(object, 0),
    )
  })

  it('hồ sơ pen/highlighter giữ đúng hệ số 1 và một lớp tô', () => {
    for (const kind of ['pen', 'highlighter'] as const) {
      const profile = STROKE_PROFILES[kind]
      expect(profile.sizeScale).toBe(1)
      expect(profile.opacityScale).toBe(1)
      expect(profile.passes).toBe(1)
      expect(profile.simulatePressure).toBe(false)
    }
  })
})

describe('Hồ sơ bút — sáu loại mới', () => {
  it('đủ 8 loại; factory tạo đúng type + style mặc định từ hồ sơ', () => {
    expect(STROKE_KINDS).toHaveLength(8)
    for (const kind of STROKE_KINDS) {
      const object = strokeOf(kind)
      expect(object.type).toBe(kind)
      expect(validateDrawingObject(object).valid).toBe(true)
      const bare = createStrokeOfKind(kind, { surfaceId: SURFACE_ID, points: POINTS })
      expect(bare.style).toEqual(STROKE_PROFILES[kind].defaultStyle)
    }
  })

  it('bề dày hiệu dụng: nét mảnh < pen < nét dày; màu nước to hơn pen', () => {
    const fine = midBandHeight(strokeOf('fine-pen'))
    const pen = midBandHeight(strokeOf('pen'))
    const thick = midBandHeight(strokeOf('thick-pen'))
    const water = midBandHeight(strokeOf('watercolor'))
    expect(fine).toBeLessThan(pen)
    expect(thick).toBeGreaterThan(pen)
    expect(water).toBeGreaterThan(pen)
  })

  it('bút bi: bề dày gần như không đổi theo áp lực; pen thì thay đổi rõ', () => {
    const heightAt = (kind: StrokeKind, pressure: number) => {
      const object = createStrokeOfKind(kind, {
        surfaceId: SURFACE_ID,
        points: POINTS.map((p) => ({ ...p, pressure })),
        style: { size: 4, opacity: 1, color: '#111827' },
      })
      return midBandHeight(object)
    }
    const ballRatio = heightAt('ballpoint', 0.15) / heightAt('ballpoint', 0.9)
    const penRatio = heightAt('pen', 0.15) / heightAt('pen', 0.9)
    expect(ballRatio).toBeGreaterThan(0.75)
    expect(penRatio).toBeLessThan(ballRatio)
  })

  it('vẽ: màu nước tô 3 lớp alpha thấp; chì mờ hơn pen; pen đúng 1 lớp alpha gốc', () => {
    const draw = (kind: StrokeKind) => {
      const ctx = new FakeContext2D()
      drawStroke(ctx as unknown as CanvasContextLike, strokeOf(kind), createCamera())
      return ctx
    }
    const pen = draw('pen')
    expect(pen.fills).toHaveLength(1)
    expect(pen.fills[0].globalAlpha).toBe(1)

    const pencil = draw('pencil')
    expect(pencil.fills).toHaveLength(1)
    expect(pencil.fills[0].globalAlpha).toBeCloseTo(0.8, 5)

    const water = draw('watercolor')
    expect(water.fills).toHaveLength(3)
    expect(water.fills[0].globalAlpha).toBeCloseTo(0.16, 5)
  })

  it('validation từ chối loại bút lạ', () => {
    const object = strokeOf('pencil') as unknown as Record<string, unknown>
    const corrupted = { ...object, type: 'neon' }
    expect(validateDrawingObject(corrupted).valid).toBe(false)
  })
})

describe('Engine — vẽ bằng loại bút mới + tẩy giữ loại', () => {
  function setup() {
    const element = new FakeCanvasElement()
    const scheduler = new FakeFrameScheduler()
    const surface = new InMemorySurface(SURFACE_ID, 'document-page', { width: 794, height: 1123 })
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
    return { element, surface, engine }
  }

  function drawLine(element: FakeCanvasElement): void {
    element.dispatch('pointerdown', pointerEvent({ clientX: 20, clientY: 100, timeStamp: 1000 }))
    for (let i = 1; i <= 8; i += 1) {
      element.dispatch(
        'pointermove',
        pointerEvent({ clientX: 20 + i * 20, clientY: 100, timeStamp: 1000 + i * 16 }),
      )
    }
    element.dispatch('pointerup', pointerEvent({ clientX: 180, clientY: 100, timeStamp: 1200 }))
  }

  it.each(['pencil', 'ballpoint', 'marker', 'fine-pen', 'thick-pen', 'watercolor'] as const)(
    'vẽ bằng %s -> object đúng loại, hợp lệ',
    (kind) => {
      const { element, surface, engine } = setup()
      engine.setTool(kind, { color: '#111827', size: 4 })
      drawLine(element)
      const [object] = surface.listObjects()
      expect(object.type).toBe(kind)
      expect(validateDrawingObject(object).valid).toBe(true)
    },
  )

  it('tẩy đoạn GIỮ nguyên loại bút của phần còn lại', () => {
    const { element, surface, engine } = setup()
    engine.setTool('pencil', { color: '#111827', size: 4 })
    drawLine(element)
    expect(surface.objectCount).toBe(1)
    engine.setTool('segment-eraser')
    engine.setEraserSize(10)
    // Một chạm tẩy giữa nét -> nét bị cắt thành các đoạn chì:
    element.dispatch('pointerdown', pointerEvent({ clientX: 100, clientY: 100, timeStamp: 2000 }))
    element.dispatch('pointerup', pointerEvent({ clientX: 100, clientY: 100, timeStamp: 2016 }))
    const remaining = surface.listObjects()
    expect(remaining.length).toBeGreaterThan(0)
    for (const object of remaining) {
      expect(object.type).toBe('pencil')
      expect(validateDrawingObject(object).valid).toBe(true)
    }
  })
})
