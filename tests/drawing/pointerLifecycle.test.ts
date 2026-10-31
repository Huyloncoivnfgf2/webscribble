/**
 * TASK-05G (A4) — Vòng đời Pointer Events ở mức DrawingEngine:
 * chuyển công cụ/detach giữa nét, pointer thứ hai, pointer không
 * primary, pointer rời vùng canvas (capture), coalesced events và
 * quy tắc pressure của pen/mouse/touch. Mục tiêu: không nét treo,
 * không trạng thái pointer cũ rò sang thao tác sau.
 */
import { describe, expect, it } from 'vitest'
import { createCamera } from '../../src/engines/drawing/coordinates'
import { DrawingEngine } from '../../src/engines/drawing/engine'
import { InMemorySurface } from '../../src/engines/drawing/surface'
import type { StrokeObject } from '../../src/engines/drawing/types'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from './fakes'

const PAGE_ID = 'page-1'

function setup() {
  const element = new FakeCanvasElement()
  const scheduler = new FakeFrameScheduler()
  const surface = new InMemorySurface(PAGE_ID, 'document-page', { width: 794, height: 1123 })
  const engine = new DrawingEngine({
    surface,
    element,
    getCamera: () => createCamera(),
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
    getDevicePixelRatio: () => 1,
  })
  engine.attach()
  return { element, scheduler, surface, engine }
}

type Ev = ReturnType<typeof pointerEvent>
const ev = (partial: Partial<Ev>): Ev => pointerEvent(partial)

function onlyStroke(surface: InMemorySurface): StrokeObject {
  const object = surface.listObjects()[0]
  if (object?.type !== 'pen' && object?.type !== 'highlighter') {
    throw new Error('expected a stroke')
  }
  return object
}

describe('A4 — gián đoạn giữa thao tác', () => {
  it('đổi công cụ GIỮA nét: phần đã vẽ được chốt thành 1 command, công cụ mới hoạt động sạch', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ clientX: 50, clientY: 10, timeStamp: 10 }))
    engine.setTool('rectangle') // đổi giữa chừng
    expect(engine.isDrawingInProgress).toBe(false)
    expect(surface.objectCount).toBe(1)
    expect(surface.listObjects()[0].type).toBe('pen')
    expect(engine.history.undoCount).toBe(1)
    // Kéo hình bằng công cụ mới.
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 40, timeStamp: 100 }))
    element.dispatch('pointermove', ev({ clientX: 60, clientY: 80, timeStamp: 110 }))
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 80, timeStamp: 120, buttons: 0 }))
    expect(surface.objectCount).toBe(2)
    expect(surface.listObjects()[1].type).toBe('rectangle')
  })

  it('detach GIỮA nét: nét được chốt, sự kiện sau detach bị bỏ qua, attach lại vẽ bình thường', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ clientX: 50, clientY: 10, timeStamp: 10 }))
    engine.detach()
    expect(surface.objectCount).toBe(1) // phần đã vẽ không mất
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 50, timeStamp: 100 }))
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 50, timeStamp: 110, buttons: 0 }))
    expect(surface.objectCount).toBe(1) // detached: không nhận sự kiện
    engine.attach()
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 50, timeStamp: 200 }))
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 50, timeStamp: 210, buttons: 0 }))
    expect(surface.objectCount).toBe(2)
  })

  it('undo GIỮA lúc đang vẽ dở: không đụng preview, nét hoàn tất sau đó vẫn ghi đúng 1 command', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 10, timeStamp: 10, buttons: 0 }))
    expect(engine.history.undoCount).toBe(1)
    element.dispatch('pointerdown', ev({ clientX: 10, clientY: 40, timeStamp: 100 }))
    element.dispatch('pointermove', ev({ clientX: 40, clientY: 40, timeStamp: 110 }))
    expect(engine.undo()).toBe(true) // undo nét đầu trong lúc nét hai đang dở
    expect(surface.objectCount).toBe(0)
    expect(engine.isDrawingInProgress).toBe(true) // preview không bị phá
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 40, timeStamp: 120, buttons: 0 }))
    expect(surface.objectCount).toBe(1)
    expect(engine.canRedo).toBe(false) // thao tác mới đã xóa nhánh redo
    expect(onlyStroke(surface).bounds.minY).toBeCloseTo(38.5)
  })
})

describe('A4 — nhiều pointer & capture', () => {
  it('pointer THỨ HAI trong lúc đang vẽ bị bỏ qua hoàn toàn; nhả pointer chính xong pointer hai mới vẽ được', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ pointerId: 1, clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointerdown', ev({ pointerId: 2, clientX: 200, clientY: 200, timeStamp: 5 }))
    element.dispatch('pointermove', ev({ pointerId: 2, clientX: 240, clientY: 200, timeStamp: 8 }))
    element.dispatch('pointermove', ev({ pointerId: 1, clientX: 60, clientY: 10, timeStamp: 10 }))
    element.dispatch('pointerup', ev({ pointerId: 2, clientX: 240, clientY: 200, timeStamp: 12, buttons: 0 }))
    element.dispatch('pointerup', ev({ pointerId: 1, clientX: 60, clientY: 10, timeStamp: 15, buttons: 0 }))
    expect(surface.objectCount).toBe(1)
    const stroke = onlyStroke(surface)
    expect(stroke.bounds.maxX).toBeLessThan(100) // không lẫn tọa độ của pointer 2
    element.dispatch('pointerdown', ev({ pointerId: 2, clientX: 200, clientY: 200, timeStamp: 100 }))
    element.dispatch('pointerup', ev({ pointerId: 2, clientX: 260, clientY: 200, timeStamp: 110, buttons: 0 }))
    expect(surface.objectCount).toBe(2)
  })

  it('pointer KHÔNG primary bị bỏ qua ngay từ down', () => {
    const { element, surface, engine } = setup()
    element.dispatch(
      'pointerdown',
      ev({ pointerId: 7, isPrimary: false, clientX: 10, clientY: 10, timeStamp: 0 }),
    )
    element.dispatch(
      'pointermove',
      ev({ pointerId: 7, isPrimary: false, clientX: 60, clientY: 10, timeStamp: 10 }),
    )
    expect(engine.isDrawingInProgress).toBe(false)
    expect(surface.objectCount).toBe(0)
  })

  it('nút chuột PHỤ (right button) không bắt đầu nét', () => {
    const { element, surface, engine } = setup()
    element.dispatch('pointerdown', ev({ button: 2, buttons: 2, clientX: 10, clientY: 10, timeStamp: 0 }))
    expect(engine.isDrawingInProgress).toBe(false)
    expect(surface.objectCount).toBe(0)
  })

  it('pointer rời khỏi vùng canvas giữa nét (tọa độ âm/vượt khổ): nhờ capture, nét vẫn tiếp tục và hoàn tất ở điểm nhả', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ clientX: 50, clientY: 50, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ clientX: -30, clientY: 50, timeStamp: 10 }))
    element.dispatch('pointermove', ev({ clientX: 900, clientY: 50, timeStamp: 20 }))
    element.dispatch('pointerup', ev({ clientX: 900, clientY: 50, timeStamp: 30, buttons: 0 }))
    const stroke = onlyStroke(surface)
    expect(stroke.points.map((p) => p.x)).toEqual([50, -30, 900])
  })
})

describe('A4 — coalesced events & pressure theo thiết bị', () => {
  it('coalesced events của một move được mở rộng thành điểm nét (không mất điểm giữa)', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ clientX: 0, clientY: 0, timeStamp: 0 }))
    const coalesced = [
      ev({ clientX: 20, clientY: 0, timeStamp: 4 }),
      ev({ clientX: 40, clientY: 0, timeStamp: 8 }),
    ]
    element.dispatch(
      'pointermove',
      ev({ clientX: 60, clientY: 0, timeStamp: 12, getCoalescedEvents: () => coalesced }),
    )
    element.dispatch('pointerup', ev({ clientX: 60, clientY: 0, timeStamp: 16, buttons: 0 }))
    expect(onlyStroke(surface).points.map((p) => p.x)).toEqual([0, 20, 40, 60])
  })

  it('bút báo pressure 0: giá trị 0 được GIỮ NGUYÊN trong điểm nét (không bị thay bằng fallback)', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ pointerType: 'pen', pressure: 0, clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ pointerType: 'pen', pressure: 0, clientX: 40, clientY: 10, timeStamp: 10 }))
    element.dispatch('pointerup', ev({ pointerType: 'pen', pressure: 0, clientX: 40, clientY: 10, timeStamp: 20, buttons: 0 }))
    expect(onlyStroke(surface).points.map((p) => p.pressure)).toEqual([0, 0])
  })

  it('mouse không báo pressure: fallback 0.5 khi đang nhấn', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ pointerType: 'mouse', clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ pointerType: 'mouse', clientX: 40, clientY: 10, timeStamp: 10 }))
    element.dispatch('pointerup', ev({ pointerType: 'mouse', clientX: 40, clientY: 10, timeStamp: 20, buttons: 0 }))
    expect(onlyStroke(surface).points.map((p) => p.pressure)).toEqual([0.5, 0.5])
  })

  it('touch không báo pressure: fallback 0.5 khi đang chạm', () => {
    const { element, surface } = setup()
    element.dispatch('pointerdown', ev({ pointerType: 'touch', clientX: 10, clientY: 10, timeStamp: 0 }))
    element.dispatch('pointermove', ev({ pointerType: 'touch', clientX: 40, clientY: 10, timeStamp: 10 }))
    element.dispatch('pointerup', ev({ pointerType: 'touch', clientX: 40, clientY: 10, timeStamp: 20, buttons: 0 }))
    expect(onlyStroke(surface).points.map((p) => p.pressure)).toEqual([0.5, 0.5])
  })

  it('chuỗi thiết bị hỗn hợp pen → mouse → touch: ba nét độc lập, mỗi nét đúng quy tắc pressure của thiết bị đó', () => {
    const { element, surface } = setup()
    const drawWith = (pointerType: string, y: number, pressure?: number) => {
      element.dispatch('pointerdown', ev({ pointerType, pressure, clientX: 10, clientY: y, timeStamp: y }))
      element.dispatch('pointermove', ev({ pointerType, pressure, clientX: 40, clientY: y, timeStamp: y + 5 }))
      element.dispatch('pointerup', ev({ pointerType, clientX: 40, clientY: y, timeStamp: y + 9, buttons: 0 }))
    }
    drawWith('pen', 10, 0.8)
    drawWith('mouse', 40)
    drawWith('touch', 70)
    const strokes = surface.listObjects()
    expect(strokes).toHaveLength(3)
    const pressures = strokes.map((o) => (o.type === 'pen' ? o.points[0].pressure : -1))
    expect(pressures).toEqual([0.8, 0.5, 0.5])
  })
})
