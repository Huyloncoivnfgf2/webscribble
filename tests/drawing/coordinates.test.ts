import { describe, expect, it } from 'vitest'
import {
  createCamera,
  panCameraByScreenDelta,
  pinchCamera,
  screenToWorld,
  worldToScreen,
  zoomCameraAtScreenPoint,
} from '../../src/engines/drawing/coordinates'
import type { Point } from '../../src/engines/drawing/types'

const POINTS: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: -37.5, y: 123.25 },
  { x: 794, y: 1123 },
]

describe('worldToScreen / screenToWorld', () => {
  it('is identity for the default camera', () => {
    const camera = createCamera()
    for (const point of POINTS) {
      expect(worldToScreen(point, camera)).toEqual(point)
      expect(screenToWorld(point, camera)).toEqual(point)
    }
  })

  it('applies camera offset and zoom', () => {
    const camera = createCamera({ x: 10, y: 20, zoom: 2 })
    expect(worldToScreen({ x: 10, y: 20 }, camera)).toEqual({ x: 0, y: 0 })
    expect(worldToScreen({ x: 15, y: 25 }, camera)).toEqual({ x: 10, y: 10 })
  })

  it('round-trips for assorted cameras and points', () => {
    const cameras = [
      createCamera({ x: 0, y: 0, zoom: 1 }),
      createCamera({ x: -120, y: 45, zoom: 0.5 }),
      createCamera({ x: 300, y: 300, zoom: 2.75 }),
      createCamera({ x: 12.5, y: -8.25, zoom: 1.3 }),
    ]
    for (const camera of cameras) {
      for (const point of POINTS) {
        const roundTripped = screenToWorld(worldToScreen(point, camera), camera)
        expect(roundTripped.x).toBeCloseTo(point.x, 9)
        expect(roundTripped.y).toBeCloseTo(point.y, 9)
      }
    }
  })

  it('does not mutate the input point or camera', () => {
    const camera = createCamera({ x: 5, y: 5, zoom: 2 })
    const point = { x: 7, y: 9 }
    worldToScreen(point, camera)
    screenToWorld(point, camera)
    expect(point).toEqual({ x: 7, y: 9 })
    expect(camera).toEqual({ x: 5, y: 5, zoom: 2 })
  })
})

describe('panCameraByScreenDelta', () => {
  it('moves the viewed world opposite to the drag direction', () => {
    const camera = createCamera({ x: 0, y: 0, zoom: 2 })
    const panned = panCameraByScreenDelta(camera, { x: 40, y: 20 })
    expect(panned).toEqual({ x: -20, y: -10, zoom: 2 })
  })

  it('keeps the dragged world point under the cursor', () => {
    const camera = createCamera({ x: 100, y: 80, zoom: 1.5 })
    const screenPoint = { x: 200, y: 150 }
    const worldBefore = screenToWorld(screenPoint, camera)
    const delta = { x: 35, y: -20 }
    const panned = panCameraByScreenDelta(camera, delta)
    const movedScreen = worldToScreen(worldBefore, panned)
    expect(movedScreen.x).toBeCloseTo(screenPoint.x + delta.x, 9)
    expect(movedScreen.y).toBeCloseTo(screenPoint.y + delta.y, 9)
  })
})

describe('zoomCameraAtScreenPoint', () => {
  it('keeps the world point under the anchor fixed on screen', () => {
    const camera = createCamera({ x: 40, y: 60, zoom: 1 })
    const anchor = { x: 320, y: 200 }
    const worldBefore = screenToWorld(anchor, camera)
    const zoomed = zoomCameraAtScreenPoint(camera, anchor, 2.5)
    expect(zoomed.zoom).toBe(2.5)
    const screenAfter = worldToScreen(worldBefore, zoomed)
    expect(screenAfter.x).toBeCloseTo(anchor.x, 9)
    expect(screenAfter.y).toBeCloseTo(anchor.y, 9)
  })

  it('rejects a non-positive zoom', () => {
    const camera = createCamera()
    expect(() => zoomCameraAtScreenPoint(camera, { x: 0, y: 0 }, 0)).toThrow()
    expect(() => createCamera({ zoom: -1 })).toThrow()
  })
})

describe('pinchCamera', () => {
  it('zoom x2 tại trung điểm đứng yên: điểm world dưới trung điểm giữ nguyên vị trí', () => {
    const camera = createCamera()
    const anchor = screenToWorld({ x: 200, y: 150 }, camera)
    const next = pinchCamera(
      camera,
      { midpoint: { x: 200, y: 150 }, distance: 100 },
      { midpoint: { x: 200, y: 150 }, distance: 200 },
    )
    expect(next.zoom).toBeCloseTo(2)
    const projected = worldToScreen(anchor, next)
    expect(projected.x).toBeCloseTo(200)
    expect(projected.y).toBeCloseTo(150)
  })

  it('pan thuần (khoảng cách không đổi): điểm world đi theo trung điểm', () => {
    const camera = createCamera()
    const anchor = screenToWorld({ x: 200, y: 150 }, camera)
    const next = pinchCamera(
      camera,
      { midpoint: { x: 200, y: 150 }, distance: 120 },
      { midpoint: { x: 230, y: 170 }, distance: 120 },
    )
    expect(next.zoom).toBe(1)
    const projected = worldToScreen(anchor, next)
    expect(projected.x).toBeCloseTo(230)
    expect(projected.y).toBeCloseTo(170)
  })

  it('khoảng cách 0 hoặc NaN: chỉ pan, không ném lỗi, không zoom', () => {
    const camera = createCamera()
    const next = pinchCamera(
      camera,
      { midpoint: { x: 0, y: 0 }, distance: 0 },
      { midpoint: { x: 10, y: 5 }, distance: 80 },
    )
    expect(next.zoom).toBe(1)
    const nanNext = pinchCamera(
      camera,
      { midpoint: { x: 0, y: 0 }, distance: Number.NaN },
      { midpoint: { x: 10, y: 5 }, distance: 80 },
    )
    expect(nanNext.zoom).toBe(1)
  })
})
