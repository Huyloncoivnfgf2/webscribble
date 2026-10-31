/**
 * Kiểm thử Eraser Engine (TASK-05E): Stroke Eraser (xóa toàn bộ nét
 * khi chạm, theo khoảng cách hình học thật) và Segment Eraser (cắt
 * phần nét trong hình tròn tẩy bằng hình học đoạn–tròn, thay thế
 * nguyên tử qua replaceObject với ID mới).
 */
import { describe, expect, it } from 'vitest'
import {
  eraseCircleFromStroke,
  eraserCircleCenters,
  segmentOutsideCircleIntervals,
  SegmentEraserTool,
  strokeHitByEraser,
  StrokeEraserTool,
} from '../../src/engines/drawing/eraser'
import type { PointerInputEvent, PointerSample } from '../../src/engines/drawing/input'
import {
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import type { StrokeObject, StrokePoint } from '../../src/engines/drawing/types'

const SURFACE = 'page-1'

function horizontalStroke(y = 0, size = 3): StrokeObject {
  const points: StrokePoint[] = []
  for (let x = 0; x <= 100; x += 10) {
    points.push({ x, y, pressure: 0.5, time: x })
  }
  return createPenStroke({ surfaceId: SURFACE, points, style: { size } })
}

function sample(x: number, y: number): PointerSample {
  return {
    pointerId: 1,
    pointerType: 'pen',
    position: { x, y },
    screenPosition: { x, y },
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    time: 0,
    buttons: 1,
  }
}

function event(type: PointerInputEvent['type'], x: number, y: number): PointerInputEvent {
  return { type, sample: sample(x, y) }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

// ---------------------------------------------------------------------------
// Hình học đoạn – hình tròn
// ---------------------------------------------------------------------------

describe('segmentOutsideCircleIntervals', () => {
  it('đoạn cắt ngang hình tròn → hai khoảng ngoài với biên đúng giao điểm', () => {
    const intervals = segmentOutsideCircleIntervals(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 0 },
      10,
    )
    expect(intervals).toHaveLength(2)
    expect(intervals[0][0]).toBe(0)
    expect(intervals[0][1]).toBeCloseTo(0.4)
    expect(intervals[1][0]).toBeCloseTo(0.6)
    expect(intervals[1][1]).toBe(1)
  })

  it('đoạn hoàn toàn ngoài → [[0,1]]; hoàn toàn trong → []', () => {
    expect(
      segmentOutsideCircleIntervals({ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 0 }, 10),
    ).toEqual([[0, 1]])
    expect(
      segmentOutsideCircleIntervals({ x: 45, y: 0 }, { x: 55, y: 0 }, { x: 50, y: 0 }, 10),
    ).toEqual([])
  })

  it('một đầu trong một đầu ngoài → một khoảng ngoài', () => {
    const intervals = segmentOutsideCircleIntervals(
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 0 },
      10,
    )
    expect(intervals).toHaveLength(1)
    expect(intervals[0][0]).toBeCloseTo(0.2)
    expect(intervals[0][1]).toBe(1)
  })
})

describe('eraserCircleCenters', () => {
  it('phủ liên tục đoạn dài bằng các tâm cách nhau tối đa một bán kính, gồm cả hai đầu', () => {
    const centers = eraserCircleCenters({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(centers[0]).toEqual({ x: 0, y: 0 })
    expect(centers[centers.length - 1]).toEqual({ x: 100, y: 0 })
    for (let i = 1; i < centers.length; i += 1) {
      expect(centers[i].x - centers[i - 1].x).toBeLessThanOrEqual(10)
    }
    expect(eraserCircleCenters({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([{ x: 5, y: 5 }])
  })
})

// ---------------------------------------------------------------------------
// eraseCircleFromStroke — cắt nét thuần (không đụng Surface)
// ---------------------------------------------------------------------------

describe('eraseCircleFromStroke', () => {
  it('xóa GIỮA nét → hai đoạn còn lại, điểm biên nội suy đúng vị trí và thời gian', () => {
    const stroke = horizontalStroke()
    // Tẩy bán kính 10 tại (50,0); bán kính hiệu dụng = 10 + 1.5 = 11.5.
    const runs = eraseCircleFromStroke(stroke, { x: 50, y: 0 }, 10)
    expect(runs).not.toBeNull()
    expect(runs).toHaveLength(2)
    const [left, right] = runs as StrokePoint[][]
    expect(left[left.length - 1].x).toBeCloseTo(38.5)
    expect(left[left.length - 1].time).toBeCloseTo(38.5)
    expect(right[0].x).toBeCloseTo(61.5)
    expect(right[0].time).toBeCloseTo(61.5)
    // Thứ tự thời gian trong mỗi đoạn không giảm (yêu cầu của validation).
    for (const run of [left, right]) {
      for (let i = 1; i < run.length; i += 1) {
        expect(run[i].time).toBeGreaterThanOrEqual(run[i - 1].time)
      }
    }
    // Áp suất nội suy giữ nguyên 0.5 vì hai đầu đều 0.5.
    expect(left[left.length - 1].pressure).toBeCloseTo(0.5)
  })

  it('xóa ĐẦU nét → một đoạn bắt đầu tại biên hình tròn', () => {
    const runs = eraseCircleFromStroke(horizontalStroke(), { x: 0, y: 0 }, 10)
    expect(runs).toHaveLength(1)
    expect((runs as StrokePoint[][])[0][0].x).toBeCloseTo(11.5)
  })

  it('xóa CUỐI nét → một đoạn kết thúc tại biên hình tròn', () => {
    const runs = eraseCircleFromStroke(horizontalStroke(), { x: 100, y: 0 }, 10)
    expect(runs).toHaveLength(1)
    const run = (runs as StrokePoint[][])[0]
    expect(run[run.length - 1].x).toBeCloseTo(88.5)
  })

  it('xóa TOÀN BỘ nét → []; không chạm → null; object gốc (đóng băng sâu) không bị sửa', () => {
    const frozen = deepFreeze(horizontalStroke())
    expect(eraseCircleFromStroke(frozen, { x: 50, y: 0 }, 500)).toEqual([])
    expect(eraseCircleFromStroke(frozen, { x: 50, y: 300 }, 10)).toBeNull()
  })

  it('nét một điểm (chấm): trong vùng tẩy → []; ngoài → null', () => {
    const dot = createPenStroke({
      surfaceId: SURFACE,
      points: [{ x: 10, y: 10, pressure: 0.5, time: 0 }],
    })
    expect(eraseCircleFromStroke(dot, { x: 10, y: 10 }, 5)).toEqual([])
    expect(eraseCircleFromStroke(dot, { x: 100, y: 100 }, 5)).toBeNull()
  })

  it('một nét có thể còn lại NHIỀU hơn hai đoạn khi vùng tẩy chỉ cắt một khoảng giữa hai mẫu xa nhau', () => {
    // Nét thưa: hai điểm (0,0) và (100,0) — đoạn duy nhất bị cắt ở giữa.
    const sparse = createPenStroke({
      surfaceId: SURFACE,
      points: [
        { x: 0, y: 0, pressure: 0.5, time: 0 },
        { x: 100, y: 0, pressure: 0.5, time: 100 },
      ],
      style: { size: 2 },
    })
    const runs = eraseCircleFromStroke(sparse, { x: 50, y: 0 }, 9)
    // Bán kính hiệu dụng 9 + 1 = 10 → còn [0..40] và [60..100].
    expect(runs).toHaveLength(2)
    expect((runs as StrokePoint[][])[0]).toHaveLength(2)
    expect((runs as StrokePoint[][])[1][0].x).toBeCloseTo(60)
  })
})

// ---------------------------------------------------------------------------
// Stroke Eraser
// ---------------------------------------------------------------------------

describe('strokeHitByEraser & StrokeEraserTool', () => {
  it('chạm theo khoảng cách thật: tâm tẩy cách nét 8 với bán kính hiệu dụng 11.5 → trúng; 20 → trượt', () => {
    const stroke = horizontalStroke()
    expect(strokeHitByEraser(stroke, { x: 50, y: 8 }, { x: 50, y: 8 }, 10)).toBe(true)
    expect(strokeHitByEraser(stroke, { x: 50, y: 20 }, { x: 50, y: 20 }, 10)).toBe(false)
    // Bounds của nét giao vùng tẩy nhưng đường tâm ở xa → không trúng (không kết luận bằng bbox).
    expect(strokeHitByEraser(stroke, { x: -20, y: 0 }, { x: -5, y: 0 }, 2)).toBe(false)
  })

  it('down lên nét → xóa toàn bộ nét đó; Shape và Text không bị tác động', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const stroke = horizontalStroke(50)
    const rect = createRectangle({
      surfaceId: SURFACE,
      start: { x: 0, y: 40 },
      end: { x: 100, y: 60 },
    })
    const text = createText({
      surfaceId: SURFACE,
      position: { x: 0, y: 45 },
      text: 'Giữ nguyên',
      width: 90,
      height: 20,
    })
    surface.addObject(stroke)
    surface.addObject(rect)
    surface.addObject(text)
    const tool = new StrokeEraserTool({ surface, size: 20 })
    const outcome = tool.handleEvent(event('down', 50, 50))
    expect(outcome.changedObjectIds).toEqual([stroke.id])
    expect(surface.hasObject(stroke.id)).toBe(false)
    expect(surface.hasObject(rect.id)).toBe(true)
    expect(surface.hasObject(text.id)).toBe(true)
  })

  it('kích thước vùng tẩy quyết định trúng/trượt ở cùng một vị trí chạm', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const stroke = horizontalStroke(0)
    surface.addObject(stroke)
    const small = new StrokeEraserTool({ surface, size: 8 }) // hiệu dụng 4 + 1.5 = 5.5 < 8
    expect(small.handleEvent(event('down', 50, 8)).changedObjectIds).toEqual([])
    expect(surface.hasObject(stroke.id)).toBe(true)
    const big = new StrokeEraserTool({ surface, size: 20 }) // hiệu dụng 11.5 ≥ 8
    expect(big.handleEvent(event('down', 50, 8)).changedObjectIds).toEqual([stroke.id])
    expect(surface.hasObject(stroke.id)).toBe(false)
  })

  it('move quét qua nét → xóa; move khi chưa down → không làm gì', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const stroke = horizontalStroke(30)
    surface.addObject(stroke)
    const tool = new StrokeEraserTool({ surface, size: 10 })
    expect(tool.handleEvent(event('move', 50, 30)).changedObjectIds).toEqual([])
    tool.handleEvent(event('down', 50, 90))
    const outcome = tool.handleEvent(event('move', 50, 30))
    expect(outcome.changedObjectIds).toEqual([stroke.id])
    expect(surface.objectCount).toBe(0)
  })

  it('kích thước tẩy không hợp lệ bị từ chối', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    expect(() => new StrokeEraserTool({ surface, size: 0 })).toThrow(/positive/)
    expect(() => new StrokeEraserTool({ surface, size: Number.NaN })).toThrow(/positive/)
  })
})

// ---------------------------------------------------------------------------
// Segment Eraser (qua Surface, thay thế nguyên tử)
// ---------------------------------------------------------------------------

describe('SegmentEraserTool', () => {
  function seededSurface() {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const stroke = horizontalStroke(0)
    surface.addObject(stroke)
    return { surface, stroke }
  }

  it('xóa giữa nét: Surface còn 2 object MỚI (ID khác hẳn), object gốc biến mất, dữ liệu hợp lệ', () => {
    const { surface, stroke } = seededSurface()
    const tool = new SegmentEraserTool({ surface, size: 20 })
    const outcome = tool.handleEvent(event('down', 50, 0))
    expect(outcome.changedObjectIds).toEqual([stroke.id])
    expect(surface.hasObject(stroke.id)).toBe(false)
    expect(surface.objectCount).toBe(2)
    for (const segment of surface.listObjects()) {
      expect(segment.id).not.toBe(stroke.id)
      expect(validateDrawingObject(segment).valid).toBe(true)
      // Đoạn thay thế kế thừa thời điểm tạo và style của nét gốc.
      expect(segment.createdAt).toBe(stroke.createdAt)
      if (segment.type === 'pen') expect(segment.style).toEqual(stroke.style)
    }
    const boundsList = surface.listObjects().map((o) => o.bounds)
    expect(Math.max(...boundsList.map((b) => b.minX))).toBeGreaterThan(50) // đoạn phải bắt đầu sau vùng tẩy
  })

  it('xóa đầu và cuối nét qua hai lần chạm riêng biệt', () => {
    const { surface, stroke } = seededSurface()
    const tool = new SegmentEraserTool({ surface, size: 20 })
    tool.handleEvent(event('down', 0, 0))
    expect(surface.objectCount).toBe(1)
    const remaining = surface.listObjects()[0]
    expect(remaining.bounds.minX).toBeCloseTo(11.5 - 1.5) // biên cắt 11.5 trừ nửa độ dày nét trong bounds
    tool.handleEvent(event('down', 100, 0))
    expect(surface.objectCount).toBe(1)
    const tail = surface.listObjects()[0]
    expect(tail.id).not.toBe(remaining.id)
    expect(tail.bounds.maxX).toBeCloseTo(88.5 + 1.5)
    expect(stroke.id).not.toBe(tail.id)
  })

  it('xóa toàn bộ nét → Surface trống', () => {
    const { surface } = seededSurface()
    const tool = new SegmentEraserTool({ surface, size: 400 })
    tool.handleEvent(event('down', 50, 0))
    expect(surface.objectCount).toBe(0)
  })

  it('không tác động Shape/Text và không đổi gì khi tẩy ở vùng trống', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const rect = createRectangle({
      surfaceId: SURFACE,
      start: { x: 0, y: -10 },
      end: { x: 100, y: 10 },
    })
    surface.addObject(rect)
    const tool = new SegmentEraserTool({ surface, size: 30 })
    expect(tool.handleEvent(event('down', 50, 0)).changedObjectIds).toEqual([])
    expect(surface.getObject(rect.id)).toBe(rect)

    const { surface: s2, stroke } = seededSurface()
    const tool2 = new SegmentEraserTool({ surface: s2, size: 20 })
    expect(tool2.handleEvent(event('down', 50, 200)).changedObjectIds).toEqual([])
    expect(s2.getObject(stroke.id)).toBe(stroke) // nguyên tham chiếu — không hề bị thay thế
  })

  it('kéo tẩy dọc nét (move) cắt liên tục nhờ các hình tròn chồng lấp', () => {
    const { surface, stroke } = seededSurface()
    const tool = new SegmentEraserTool({ surface, size: 20 })
    tool.handleEvent(event('down', -20, 0))
    const outcome = tool.handleEvent(event('move', 45, 0))
    // Lần thay đổi đầu tiên là trên chính nét gốc; các hình tròn sau
    // tác động lên các đoạn thay thế (ID mới) nên danh sách dài hơn 1.
    expect(outcome.changedObjectIds[0]).toBe(stroke.id)
    expect(outcome.changedObjectIds.length).toBeGreaterThanOrEqual(1)
    // Phần từ đầu tới ~45+bán kính đã bị xóa: còn đúng một đoạn ở phía phải.
    expect(surface.objectCount).toBe(1)
    const remaining = surface.listObjects()[0]
    expect(remaining.bounds.minX).toBeGreaterThan(45)
  })
})
