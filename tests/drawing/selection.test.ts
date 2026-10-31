/**
 * Kiểm thử Selection Engine (TASK-05E): chọn bằng vùng chữ nhật và
 * lasso với kết luận giao nhau HÌNH HỌC THẬT (không chỉ bounding
 * box), đủ 7 loại object, các builder thao tác kéo, và di chuyển
 * nhiều object nguyên tử qua updateObjects.
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import type { PointerInputEvent, PointerSample } from '../../src/engines/drawing/input'
import {
  createArrow,
  createEllipse,
  createHighlighterStroke,
  createLine,
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import {
  drawSelectedBounds,
  drawSelectionRegion,
  LassoSelectionBuilder,
  moveObjects,
  objectIntersectsRegion,
  RectSelectionBuilder,
  selectObjects,
  translateObject,
  type SelectionRegion,
} from '../../src/engines/drawing/selection'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import type { StrokePoint } from '../../src/engines/drawing/types'
import { FakeContext2D } from './fakes'

const SURFACE = 'page-1'

function strokePoints(points: [number, number][]): StrokePoint[] {
  return points.map(([x, y], index) => ({ x, y, pressure: 0.5, time: index * 10 }))
}

function rectRegion(minX: number, minY: number, maxX: number, maxY: number): SelectionRegion {
  return { kind: 'rect', rect: { minX, minY, maxX, maxY } }
}

// ---------------------------------------------------------------------------
// Rectangle Selection — giao nhau hình học thật
// ---------------------------------------------------------------------------

describe('Rectangle Selection', () => {
  const diagonal = () =>
    createPenStroke({
      surfaceId: SURFACE,
      points: strokePoints([
        [0, 0],
        [50, 50],
        [100, 100],
      ]),
      style: { size: 2 },
    })

  it('object nằm hoàn toàn trong vùng chọn → được chọn', () => {
    const stroke = diagonal()
    expect(objectIntersectsRegion(stroke, rectRegion(-10, -10, 110, 110))).toBe(true)
    expect(selectObjects([stroke], rectRegion(-10, -10, 110, 110))).toEqual([stroke.id])
  })

  it('object chỉ giao một phần với vùng chọn → vẫn được chọn', () => {
    const stroke = diagonal()
    expect(objectIntersectsRegion(stroke, rectRegion(80, 80, 200, 200))).toBe(true)
  })

  it('vùng chọn giao BOUNDS nhưng không chạm mực thật → KHÔNG chọn (không kết luận bằng bbox)', () => {
    const stroke = diagonal()
    // Bounds của nét chéo bao phủ gần như toàn bộ hình 100×100, và
    // vùng này giao bounds — nhưng nét (đường y = x, bán kính mực 1)
    // cách xa vùng (góc trên-trái, y ≤ 10 trong khi nét ở đó có y ≥ 40).
    expect(objectIntersectsRegion(stroke, rectRegion(40, 0, 60, 10))).toBe(false)
  })

  it('vùng chọn ở xa hoàn toàn → không chọn', () => {
    const stroke = diagonal()
    expect(objectIntersectsRegion(stroke, rectRegion(300, 300, 400, 400))).toBe(false)
  })

  it('độ dày mực quyết định: highlighter (bán kính 7) chạm được, pen (bán kính 1.5) thì không', () => {
    const points = strokePoints([
      [0, 0],
      [100, 0],
    ])
    const pen = createPenStroke({ surfaceId: SURFACE, points, style: { size: 3 } })
    const highlighter = createHighlighterStroke({
      surfaceId: SURFACE,
      points,
      style: { size: 14 },
    })
    // Vùng chọn cách đường tâm 5 đơn vị: ngoài mực pen, trong mực highlighter.
    const region = rectRegion(40, 5, 60, 20)
    expect(objectIntersectsRegion(pen, region)).toBe(false)
    expect(objectIntersectsRegion(highlighter, region)).toBe(true)
  })
})

describe('Rectangle Selection — đủ 7 loại object', () => {
  it('line: giao đoạn thẳng thì chọn; chỉ giao góc bounds thì không', () => {
    const line = createLine({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 20 },
    })
    expect(objectIntersectsRegion(line, rectRegion(40, 5, 60, 15))).toBe(true)
    // Bounds của line bao cả vùng này nhưng đoạn thẳng ở x 90..100 có y 18..20.
    expect(objectIntersectsRegion(line, rectRegion(90, 0, 100, 5))).toBe(false)
  })

  it('rectangle: vùng chọn phủ phần diện tích bên trong (không cần chạm biên) → chọn', () => {
    const rectangle = createRectangle({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 80 },
    })
    expect(objectIntersectsRegion(rectangle, rectRegion(40, 30, 60, 50))).toBe(true)
    expect(objectIntersectsRegion(rectangle, rectRegion(150, 30, 200, 50))).toBe(false)
  })

  it('ellipse: vùng ở tâm → chọn; vùng ở góc bounds nhưng ngoài đường cong → không', () => {
    const ellipse = createEllipse({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 60 },
    })
    expect(objectIntersectsRegion(ellipse, rectRegion(45, 25, 55, 35))).toBe(true)
    expect(objectIntersectsRegion(ellipse, rectRegion(0, 0, 8, 8))).toBe(false)
  })

  it('arrow: vùng chỉ chứa một cánh đầu mũi tên → chọn (nhờ hình học đầu mũi tên, không chỉ thân)', () => {
    const arrow = createArrow({
      surfaceId: SURFACE,
      start: { x: 0, y: 50 },
      end: { x: 100, y: 50 },
    })
    // Cánh trên của đầu mũi tên ở khoảng (93, 54); thân ở y = 50, vùng này không chạm thân.
    expect(objectIntersectsRegion(arrow, rectRegion(90, 52, 96, 58))).toBe(true)
    // Vùng trên-dưới lệch hẳn, không chạm thân lẫn đầu.
    expect(objectIntersectsRegion(arrow, rectRegion(85, 40, 92, 45))).toBe(false)
  })

  it('text: vùng giao hộp text → chọn; không giao → không chọn', () => {
    const text = createText({
      surfaceId: SURFACE,
      position: { x: 10, y: 10 },
      text: 'Ghi chú',
      width: 80,
      height: 20,
    })
    expect(objectIntersectsRegion(text, rectRegion(50, 15, 200, 25))).toBe(true)
    expect(objectIntersectsRegion(text, rectRegion(200, 200, 300, 300))).toBe(false)
  })

  it('multi-select: một vùng chọn lấy đúng các object giao nhau trong cảnh nhiều object', () => {
    const near = createPenStroke({
      surfaceId: SURFACE,
      points: strokePoints([
        [10, 10],
        [50, 10],
      ]),
    })
    const inside = createRectangle({
      surfaceId: SURFACE,
      start: { x: 20, y: 20 },
      end: { x: 40, y: 40 },
    })
    const far = createText({
      surfaceId: SURFACE,
      position: { x: 300, y: 300 },
      text: 'Xa',
      width: 30,
      height: 20,
    })
    const ids = selectObjects([near, inside, far], rectRegion(0, 0, 100, 100))
    expect(ids).toEqual([near.id, inside.id])
  })
})

// ---------------------------------------------------------------------------
// Lasso Selection
// ---------------------------------------------------------------------------

describe('Lasso Selection', () => {
  const stroke = () =>
    createPenStroke({
      surfaceId: SURFACE,
      points: strokePoints([
        [0, 50],
        [100, 50],
      ]),
      style: { size: 2 },
    })

  it('lasso bao quanh nét → chọn; lasso chỉ ôm phần đầu nét → vẫn chọn (giao một phần)', () => {
    const s = stroke()
    const around: SelectionRegion = {
      kind: 'polygon',
      points: [
        { x: -10, y: 30 },
        { x: 110, y: 30 },
        { x: 110, y: 70 },
        { x: -10, y: 70 },
      ],
    }
    expect(objectIntersectsRegion(s, around)).toBe(true)
    const headOnly: SelectionRegion = {
      kind: 'polygon',
      points: [
        { x: -5, y: 40 },
        { x: 20, y: 40 },
        { x: 20, y: 60 },
        { x: -5, y: 60 },
      ],
    }
    expect(objectIntersectsRegion(s, headOnly)).toBe(true)
  })

  it('lasso tam giác cắt qua nét → chọn theo giao nhau thật; lasso ở vùng trống → không', () => {
    const s = stroke()
    const triangle: SelectionRegion = {
      kind: 'polygon',
      points: [
        { x: 40, y: 20 },
        { x: 60, y: 20 },
        { x: 50, y: 80 },
      ],
    }
    expect(objectIntersectsRegion(s, triangle)).toBe(true)
    const empty: SelectionRegion = {
      kind: 'polygon',
      points: [
        { x: 200, y: 200 },
        { x: 260, y: 200 },
        { x: 230, y: 260 },
      ],
    }
    expect(objectIntersectsRegion(s, empty)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Gesture builders
// ---------------------------------------------------------------------------

function sample(x: number, y: number, time = 0): PointerSample {
  return {
    pointerId: 1,
    pointerType: 'mouse',
    position: { x, y },
    screenPosition: { x, y },
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    time,
    buttons: 1,
  }
}

function event(type: PointerInputEvent['type'], x: number, y: number): PointerInputEvent {
  return { type, sample: sample(x, y) }
}

describe('RectSelectionBuilder', () => {
  it('kéo ngược chiều vẫn cho vùng chuẩn hóa; preview theo kịp trong lúc kéo', () => {
    const b = new RectSelectionBuilder()
    expect(b.handleEvent(event('down', 60, 40))).toEqual({ type: 'started' })
    expect(b.handleEvent(event('move', 30, 20))).toEqual({ type: 'updated' })
    expect(b.previewRegion).toEqual({
      kind: 'rect',
      rect: { minX: 30, minY: 20, maxX: 60, maxY: 40 },
    })
    const result = b.handleEvent(event('up', 10, 10))
    expect(result).toEqual({
      type: 'completed',
      region: { kind: 'rect', rect: { minX: 10, minY: 10, maxX: 60, maxY: 40 } },
    })
    expect(b.isActive).toBe(false)
    expect(b.previewRegion).toBeNull()
  })

  it('chạm không kéo → discarded too-small; cancel → discarded cancelled', () => {
    const click = new RectSelectionBuilder()
    click.handleEvent(event('down', 5, 5))
    expect(click.handleEvent(event('up', 5, 5))).toEqual({
      type: 'discarded',
      reason: 'too-small',
    })
    const cancelled = new RectSelectionBuilder()
    cancelled.handleEvent(event('down', 5, 5))
    cancelled.handleEvent(event('move', 20, 20))
    expect(cancelled.handleEvent(event('cancel', 20, 20))).toEqual({
      type: 'discarded',
      reason: 'cancelled',
    })
  })

  it('không sửa dữ liệu object nào trong lúc xác định vùng chọn (chỉ đọc hình học)', () => {
    const s = createPenStroke({ surfaceId: SURFACE, points: strokePoints([[0, 0], [10, 10]]) })
    const frozen = JSON.stringify(s)
    const b = new RectSelectionBuilder()
    b.handleEvent(event('down', -5, -5))
    b.handleEvent(event('move', 20, 20))
    const result = b.handleEvent(event('up', 20, 20))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(selectObjects([s], result.region)).toEqual([s.id])
    expect(JSON.stringify(s)).toBe(frozen)
  })
})

describe('LassoSelectionBuilder', () => {
  it('đường vẽ được đóng thành polygon khi hoàn tất', () => {
    const b = new LassoSelectionBuilder()
    b.handleEvent(event('down', 0, 0))
    b.handleEvent(event('move', 40, 0))
    b.handleEvent(event('move', 40, 30))
    b.handleEvent(event('move', 0, 30))
    const result = b.handleEvent(event('up', 0, 30))
    if (result.type !== 'completed') throw new Error('expected completion')
    expect(result.region.kind).toBe('polygon')
    if (result.region.kind === 'polygon') {
      expect(result.region.points.length).toBeGreaterThanOrEqual(4)
      expect(result.region.points[0]).toEqual({ x: 0, y: 0 })
    }
  })

  it('lấy mẫu thưa: hai move cách nhau dưới khoảng tối thiểu chỉ giữ một điểm', () => {
    const b = new LassoSelectionBuilder(5)
    b.handleEvent(event('down', 0, 0))
    b.handleEvent(event('move', 2, 0)) // cách 2 < 5 → bỏ
    b.handleEvent(event('move', 6, 0)) // cách 6 ≥ 5 → giữ
    expect(b.previewPoints).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ])
  })

  it('lasso TỰ CẮT (hình nơ) bị từ chối tường minh', () => {
    const b = new LassoSelectionBuilder()
    b.handleEvent(event('down', 0, 0))
    b.handleEvent(event('move', 40, 40))
    b.handleEvent(event('move', 40, 0))
    b.handleEvent(event('move', 0, 40))
    const result = b.handleEvent(event('up', 0, 40))
    expect(result).toEqual({ type: 'discarded', reason: 'self-intersecting' })
    expect(b.isActive).toBe(false)
  })

  it('lasso chưa đủ 3 điểm → discarded too-small', () => {
    const b = new LassoSelectionBuilder()
    b.handleEvent(event('down', 0, 0))
    const result = b.handleEvent(event('up', 30, 0))
    expect(result).toEqual({ type: 'discarded', reason: 'too-small' })
  })
})

// ---------------------------------------------------------------------------
// Vẽ overlay chọn (phục vụ camera pan/zoom)
// ---------------------------------------------------------------------------

describe('Vẽ vùng chọn & khung đã chọn', () => {
  it('drawSelectionRegion biến đổi tọa độ world qua camera pan/zoom', () => {
    const ctx = new FakeContext2D()
    const camera = createCamera({ x: 5, y: 5, zoom: 2 })
    drawSelectionRegion(ctx, rectRegion(10, 10, 20, 20), camera)
    // world (10,10) → screen ((10-5)*2, (10-5)*2) = (10,10); (20,20) → (30,30).
    expect(ctx.calls.find((call) => call.name === 'moveTo')?.args).toEqual([10, 10])
    expect(ctx.calls.filter((call) => call.name === 'lineTo').map((call) => call.args)).toEqual([
      [30, 10],
      [30, 30],
      [10, 30],
    ])
    expect(ctx.countCalls('setLineDash')).toBe(1)
    expect(ctx.countCalls('closePath')).toBe(1)
  })

  it('drawSelectedBounds vẽ khung đúng bounds của object ở camera đơn vị', () => {
    const ctx = new FakeContext2D()
    const pen = createPenStroke({
      surfaceId: SURFACE,
      points: strokePoints([
        [10, 10],
        [30, 10],
      ]),
      style: { size: 2 },
    })
    drawSelectedBounds(ctx, [pen], createCamera())
    // Bounds của nét: x 9..31, y 9..11 (gồm nửa độ dày 1).
    expect(ctx.calls.find((call) => call.name === 'moveTo')?.args).toEqual([9, 9])
    expect(ctx.countCalls('stroke')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Di chuyển (Move)
// ---------------------------------------------------------------------------

describe('translateObject & moveObjects', () => {
  it('translateObject: tịnh tiến mọi điểm, giữ nguyên áp suất/thời gian; object gốc không đổi', () => {
    const pen = createPenStroke({
      surfaceId: SURFACE,
      points: strokePoints([
        [0, 0],
        [10, 5],
      ]),
    })
    const frozen = JSON.stringify(pen)
    const moved = translateObject(pen, { x: 100, y: 50 })
    expect(JSON.stringify(pen)).toBe(frozen)
    if (moved.type !== 'pen') throw new Error('expected pen')
    expect(moved.points.map((p) => [p.x, p.y])).toEqual([
      [100, 50],
      [110, 55],
    ])
    expect(moved.points.map((p) => p.time)).toEqual([0, 10])
    expect(moved.id).toBe(pen.id)
    expect(moved.bounds).toEqual({
      minX: 100 - 1.5,
      minY: 50 - 1.5,
      maxX: 110 + 1.5,
      maxY: 55 + 1.5,
    })
    expect(validateDrawingObject(moved).valid).toBe(true)
  })

  it('di chuyển NHIỀU object cùng lúc: cả hai cùng dịch, bounds cập nhật, định danh giữ nguyên', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const pen = createPenStroke({ surfaceId: SURFACE, points: strokePoints([[0, 0], [10, 0]]) })
    const rect = createRectangle({
      surfaceId: SURFACE,
      start: { x: 20, y: 20 },
      end: { x: 40, y: 40 },
    })
    surface.addObject(pen)
    surface.addObject(rect)
    const stored = moveObjects(surface, [pen.id, rect.id], { x: 5, y: -5 })
    expect(stored).toHaveLength(2)
    const movedPen = surface.getObject(pen.id)
    const movedRect = surface.getObject(rect.id)
    if (movedPen?.type !== 'pen' || movedRect?.type !== 'rectangle') {
      throw new Error('unexpected types')
    }
    expect(movedPen.points[0]).toMatchObject({ x: 5, y: -5 })
    expect(movedRect.start).toEqual({ x: 25, y: 15 })
    expect(movedRect.bounds).toEqual({ minX: 24, minY: 14, maxX: 46, maxY: 36 })
    expect(movedPen.createdAt).toBe(pen.createdAt)
    expect(movedPen.updatedAt).toBeGreaterThanOrEqual(pen.updatedAt)
    expect(movedRect.surfaceId).toBe(SURFACE)
  })

  it('nguyên tử: một ID không tồn tại → ném lỗi và KHÔNG object nào bị di chuyển', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const pen = createPenStroke({ surfaceId: SURFACE, points: strokePoints([[0, 0], [10, 0]]) })
    surface.addObject(pen)
    expect(() => moveObjects(surface, [pen.id, 'missing-id'], { x: 10, y: 10 })).toThrow(
      /not found/,
    )
    expect(surface.getObject(pen.id)).toBe(pen)
  })

  it('nguyên tử: delta NaN → ném lỗi trước khi chạm vào Surface', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const pen = createPenStroke({ surfaceId: SURFACE, points: strokePoints([[0, 0], [10, 0]]) })
    surface.addObject(pen)
    expect(() => moveObjects(surface, [pen.id], { x: Number.NaN, y: 0 })).toThrow(/finite/)
    expect(surface.getObject(pen.id)).toBe(pen)
  })

  it('no-op: danh sách rỗng hoặc delta (0,0) không đổi updatedAt', () => {
    const surface = new InMemorySurface(SURFACE, 'document-page', { width: 794, height: 1123 })
    const pen = createPenStroke({ surfaceId: SURFACE, points: strokePoints([[0, 0], [10, 0]]) })
    surface.addObject(pen)
    expect(moveObjects(surface, [], { x: 5, y: 5 })).toEqual([])
    expect(moveObjects(surface, [pen.id], { x: 0, y: 0 })).toEqual([])
    expect(surface.getObject(pen.id)).toBe(pen)
  })

  it('di chuyển text: vị trí dịch chuyển, kích thước và nội dung giữ nguyên', () => {
    const text = createText({
      surfaceId: SURFACE,
      position: { x: 10, y: 10 },
      text: 'Di chuyển tôi',
      width: 90,
      height: 20,
    })
    const moved = translateObject(text, { x: -10, y: 30 })
    if (moved.type !== 'text') throw new Error('expected text')
    expect(moved.position).toEqual({ x: 0, y: 40 })
    expect(moved.width).toBe(90)
    expect(moved.bounds).toEqual({ minX: 0, minY: 40, maxX: 90, maxY: 60 })
  })

  it('di chuyển arrow: bounds sau dịch vẫn bao phủ đầu mũi tên', () => {
    const arrow = createArrow({
      surfaceId: SURFACE,
      start: { x: 0, y: 50 },
      end: { x: 100, y: 50 },
    })
    const moved = translateObject(arrow, { x: 0, y: 100 })
    expect(moved.bounds.minY).toBeCloseTo(150 - 5)
    expect(moved.bounds.maxY).toBeCloseTo(150 + 5)
    expect(validateDrawingObject(moved).valid).toBe(true)
  })
})
