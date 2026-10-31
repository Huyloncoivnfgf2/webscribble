/**
 * Kiểm thử hình học giao nhau/khoảng cách và bounds mới của hình
 * (TASK-05E): các hàm thuần trong geometry.ts làm nền cho Selection
 * và Eraser, cộng việc sửa bounds để bao phủ mực vẽ thật (nửa độ dày
 * nét của hình; đầu mũi tên của arrow).
 */
import { describe, expect, it } from 'vitest'
import {
  arrowBounds,
  arrowHeadLength,
  arrowHeadPoints,
  computeObjectBounds,
  isSimplePolygon,
  pointInPolygon,
  pointToSegmentDistance,
  polygonsIntersect,
  segmentToSegmentDistance,
  segmentsIntersect,
  shapeObjectBounds,
} from '../../src/engines/drawing/geometry'
import { createArrow } from '../../src/engines/drawing/objects'

const SQ = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('pointToSegmentDistance', () => {
  it('hình chiếu nằm trong đoạn → khoảng cách vuông góc', () => {
    expect(pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
  })

  it('hình chiếu ngoài đoạn → khoảng cách tới đầu gần nhất', () => {
    expect(pointToSegmentDistance({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
  })

  it('đoạn suy biến thành điểm', () => {
    expect(pointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5)
  })
})

describe('segmentsIntersect & segmentToSegmentDistance', () => {
  it('hai đoạn cắt nhau → giao nhau, khoảng cách 0', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 10 }
    const c = { x: 0, y: 10 }
    const d = { x: 10, y: 0 }
    expect(segmentsIntersect(a, b, c, d)).toBe(true)
    expect(segmentToSegmentDistance(a, b, c, d)).toBe(0)
  })

  it('chạm đầu mút và chồng collinear cũng tính là giao nhau', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }),
    ).toBe(true)
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }),
    ).toBe(true)
  })

  it('hai đoạn song song cách nhau 3 đơn vị', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    const c = { x: 0, y: 3 }
    const d = { x: 10, y: 3 }
    expect(segmentsIntersect(a, b, c, d)).toBe(false)
    expect(segmentToSegmentDistance(a, b, c, d)).toBe(3)
  })
})

describe('pointInPolygon', () => {
  it('trong / ngoài / trên biên', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, SQ)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, SQ)).toBe(false)
    expect(pointInPolygon({ x: 0, y: 5 }, SQ)).toBe(true) // trên biên tính là trong
    expect(pointInPolygon({ x: -1, y: -1 }, SQ)).toBe(false)
  })

  it('polygon lõm: điểm trong vùng lõm ngoài polygon', () => {
    // Hình chữ L: phần notch ở góc trên phải là NGOÀI.
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(pointInPolygon({ x: 2, y: 7 }, lShape)).toBe(true)
    expect(pointInPolygon({ x: 7, y: 7 }, lShape)).toBe(false)
  })
})

describe('polygonsIntersect', () => {
  it('chồng lấp một phần, chứa toàn bộ, rời nhau, chạm cạnh', () => {
    const overlap = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ]
    const inside = [
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]
    const apart = [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
    ]
    const touching = [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
    ]
    expect(polygonsIntersect(SQ, overlap)).toBe(true)
    expect(polygonsIntersect(SQ, inside)).toBe(true)
    expect(polygonsIntersect(SQ, apart)).toBe(false)
    expect(polygonsIntersect(SQ, touching)).toBe(true)
  })
})

describe('isSimplePolygon', () => {
  it('vuông và tam giác là polygon đơn giản; hình nơ (tự cắt) thì không', () => {
    expect(isSimplePolygon(SQ)).toBe(true)
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ]),
    ).toBe(true)
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe(false)
  })

  it('dưới 3 điểm → không đơn giản', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false)
  })
})

describe('bounds hình sau TASK-05E — bao phủ mực vẽ thật', () => {
  it('shapeObjectBounds = hộp hai điểm nới nửa độ dày nét', () => {
    expect(shapeObjectBounds({ x: 10, y: 10 }, { x: 60, y: 40 }, 2)).toEqual({
      minX: 9,
      minY: 9,
      maxX: 61,
      maxY: 41,
    })
    expect(shapeObjectBounds({ x: 10, y: 10 }, { x: 60, y: 40 }, 6)).toEqual({
      minX: 7,
      minY: 7,
      maxX: 63,
      maxY: 43,
    })
  })

  it('arrowBounds ngang: đầu mũi tên làm bounds cao hơn hộp thân (cánh ±4, đệm nét 1)', () => {
    const bounds = arrowBounds({ x: 0, y: 0 }, { x: 100, y: 0 }, 2)
    expect(bounds.minX).toBeCloseTo(-1)
    expect(bounds.minY).toBeCloseTo(-5)
    expect(bounds.maxX).toBeCloseTo(101)
    expect(bounds.maxY).toBeCloseTo(5)
  })

  it('arrowBounds dọc hướng lên: cánh tỏa ngang quanh đầu nhọn', () => {
    const bounds = arrowBounds({ x: 50, y: 100 }, { x: 50, y: 0 }, 2)
    expect(bounds.minX).toBeCloseTo(45)
    expect(bounds.maxX).toBeCloseTo(55)
    expect(bounds.minY).toBeCloseTo(-1)
    expect(bounds.maxY).toBeCloseTo(101)
  })

  it('arrowHeadLength tỉ lệ với độ dày nét; hai cánh đối xứng quanh trục thân', () => {
    expect(arrowHeadLength(2)).toBe(8)
    expect(arrowHeadLength(3)).toBe(12)
    const { wingA, wingB } = arrowHeadPoints({ x: 100, y: 0 }, { x: 0, y: 0 }, 10)
    expect(wingA.y).toBeCloseTo(5)
    expect(wingB.y).toBeCloseTo(-5)
    expect(wingA.x).toBeCloseTo(wingB.x)
    expect(wingA.x).toBeLessThan(100)
  })

  it('bounds lưu trong ArrowObject khớp computeObjectBounds (validation nhất quán)', () => {
    const arrow = createArrow({
      surfaceId: 's',
      start: { x: 0, y: 50 },
      end: { x: 100, y: 50 },
    })
    expect(arrow.bounds).toEqual(computeObjectBounds(arrow))
    // Đầu mũi tên (cánh y 46..54) nằm trọn trong bounds đã lưu.
    expect(arrow.bounds.minY).toBeLessThanOrEqual(46)
    expect(arrow.bounds.maxY).toBeGreaterThanOrEqual(54)
  })
})
