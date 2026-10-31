// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createStorageFoundation, documentSurfaceId } from '../../src/data/index'
import { WebScribbleDatabase } from '../../src/data/database'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import { validateDrawingObject } from '../../src/engines/drawing/index'
import {
  DocxAnnotationController,
  DOCX_SURFACE_PAGE_INDEX,
} from '../../src/app/features/documents/DocxAnnotationController'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from '../drawing/fakes'

function makeWorld() {
  const db = new WebScribbleDatabase(`webscribble-07d-${crypto.randomUUID()}`)
  const foundation = createStorageFoundation(db)
  const annotationEngine = createAnnotationEngine({
    annotations: foundation.annotations,
    autosave: foundation.autosave,
  })
  const scheduler = new FakeFrameScheduler()
  const controller = new DocxAnnotationController({
    annotationEngine,
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  })
  const canvas = new FakeCanvasElement()
  return { db, foundation, annotationEngine, scheduler, controller, canvas }
}

function drawStroke(
  element: FakeCanvasElement,
  points: Array<{ x: number; y: number; time: number }>,
): void {
  const first = points[0]
  element.dispatch('pointerdown', pointerEvent({ clientX: first.x, clientY: first.y, timeStamp: first.time }))
  for (const point of points.slice(1)) {
    element.dispatch('pointermove', pointerEvent({ clientX: point.x, clientY: point.y, timeStamp: point.time }))
  }
  const last = points[points.length - 1]
  element.dispatch('pointerup', pointerEvent({ clientX: last.x, clientY: last.y, timeStamp: last.time + 5, buttons: 0 }))
}

async function openReady(world: ReturnType<typeof makeWorld>, documentId: string) {
  await world.controller.open(documentId, world.canvas as unknown as HTMLCanvasElement)
  world.controller.handleResize(800, 2000)
  world.scheduler.runAll()
  expect(world.controller.getSnapshot().status).toBe('ready')
}

describe('TASK-07D — DocxAnnotationController', () => {
  it('vẽ nét → flush → record nằm trong annotations theo đúng surfaceId quy ước của tài liệu', async () => {
    const world = makeWorld()
    const doc = await world.foundation.documents.create({
      name: 'a.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx'], { type: 'application/octet-stream' }),
    })
    await openReady(world, doc.id)
    drawStroke(world.canvas, [
      { x: 40, y: 120, time: 1000 },
      { x: 90, y: 140, time: 1016 },
      { x: 140, y: 130, time: 1032 },
    ])
    expect(world.controller.getObjectCount()).toBe(1)
    await world.controller.flush()

    const record = await world.foundation.annotations.getSurface(
      documentSurfaceId(doc.id, DOCX_SURFACE_PAGE_INDEX),
    )
    expect(record).toBeTruthy()
    expect(record?.documentId).toBe(doc.id)
    expect(record?.objects).toHaveLength(1)
    const object = record?.objects[0] as { type: string; points: { x: number; y: number }[] }
    expect(object.type).toBe('pen')
    expect(object.points.map((p) => [p.x, p.y])).toEqual([
      [40, 120],
      [90, 140],
      [140, 130],
    ])
    expect(validateDrawingObject(record?.objects[0] as never).valid).toBe(true)
    await world.controller.close()
    world.db.close()
  }, 30000)

  it('đóng và mở lại bằng controller MỚI: nét vẽ được khôi phục nguyên vẹn từ IndexedDB', async () => {
    const world = makeWorld()
    const doc = await world.foundation.documents.create({
      name: 'b.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx'], { type: 'application/octet-stream' }),
    })
    await openReady(world, doc.id)
    drawStroke(world.canvas, [
      { x: 10, y: 10, time: 0 },
      { x: 60, y: 30, time: 16 },
    ])
    drawStroke(world.canvas, [
      { x: 200, y: 400, time: 100 },
      { x: 260, y: 420, time: 116 },
    ])
    await world.controller.close()

    const scheduler2 = new FakeFrameScheduler()
    const controller2 = new DocxAnnotationController({
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler2.request,
      cancelFrame: scheduler2.cancel,
    })
    const canvas2 = new FakeCanvasElement()
    await controller2.open(doc.id, canvas2 as unknown as HTMLCanvasElement)
    controller2.handleResize(800, 2000)
    scheduler2.runAll()
    expect(controller2.getSnapshot().status).toBe('ready')
    expect(controller2.getObjectCount()).toBe(2)
    await controller2.close()
    world.db.close()
  }, 30000)

  it('chuyển chế độ edit ↔ annotate và đổi tool/màu/cỡ nét được phản ánh vào nét vẽ', async () => {
    const world = makeWorld()
    const doc = await world.foundation.documents.create({
      name: 'c.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx'], { type: 'application/octet-stream' }),
    })
    await openReady(world, doc.id)
    expect(world.controller.getSnapshot().mode).toBe('edit')
    world.controller.setMode('annotate')
    expect(world.controller.getSnapshot().mode).toBe('annotate')

    // Highlighter: màu tự chuyển sang bảng highlight, nét mang màu + cỡ đã chọn.
    world.controller.setTool('highlighter')
    expect(world.controller.getSnapshot().color).toBe('#FDE047')
    world.controller.setColor('#86EFAC')
    world.controller.setSizeLabel('L')
    drawStroke(world.canvas, [
      { x: 20, y: 50, time: 0 },
      { x: 120, y: 50, time: 16 },
    ])
    await world.controller.flush()
    const record = await world.foundation.annotations.getSurface(documentSurfaceId(doc.id, 0))
    const object = record?.objects[0] as { type: string; style: { color: string; size: number } }
    expect(object.type).toBe('highlighter')
    expect(object.style.color).toBe('#86EFAC')
    expect(object.style.size).toBe(24)

    world.controller.setMode('edit')
    expect(world.controller.getSnapshot().mode).toBe('edit')
    await world.controller.close()
    world.db.close()
  }, 30000)

  it('undo/redo trên surface DOCX giữ toàn vẹn lịch sử và trạng thái snapshot', async () => {
    const world = makeWorld()
    const doc = await world.foundation.documents.create({
      name: 'd.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx'], { type: 'application/octet-stream' }),
    })
    await openReady(world, doc.id)
    drawStroke(world.canvas, [
      { x: 5, y: 5, time: 0 },
      { x: 30, y: 9, time: 16 },
    ])
    drawStroke(world.canvas, [
      { x: 50, y: 60, time: 100 },
      { x: 90, y: 66, time: 116 },
    ])
    await Promise.resolve()
    expect(world.controller.getObjectCount()).toBe(2)
    expect(world.controller.getSnapshot().canUndo).toBe(true)

    world.controller.undo()
    await Promise.resolve()
    expect(world.controller.getObjectCount()).toBe(1)
    expect(world.controller.getSnapshot().canRedo).toBe(true)

    world.controller.redo()
    await Promise.resolve()
    expect(world.controller.getObjectCount()).toBe(2)

    // Undo hết rồi lưu: record phản ánh trạng thái rỗng.
    world.controller.undo()
    world.controller.undo()
    await Promise.resolve()
    expect(world.controller.getObjectCount()).toBe(0)
    await world.controller.flush()
    const record = await world.foundation.annotations.getSurface(documentSurfaceId(doc.id, 0))
    expect(record?.objects ?? []).toHaveLength(0)
    await world.controller.close()
    world.db.close()
  }, 30000)

  it('chú thích của hai tài liệu DOCX khác nhau hoàn toàn tách biệt', async () => {
    const world = makeWorld()
    const make = (name: string) =>
      world.foundation.documents.create({
        name,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        blob: new Blob(['docx'], { type: 'application/octet-stream' }),
      })
    const docA = await make('a.docx')
    const docB = await make('b.docx')
    await openReady(world, docA.id)
    drawStroke(world.canvas, [
      { x: 1, y: 1, time: 0 },
      { x: 20, y: 8, time: 16 },
    ])
    await world.controller.close()

    const scheduler2 = new FakeFrameScheduler()
    const controller2 = new DocxAnnotationController({
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler2.request,
      cancelFrame: scheduler2.cancel,
    })
    await controller2.open(docB.id, new FakeCanvasElement() as unknown as HTMLCanvasElement)
    expect(controller2.getObjectCount()).toBe(0)
    await controller2.close()
    world.db.close()
  }, 30000)

  it('gắn lại engine lên canvas MỚI cho cùng phiên (remount) không mất nét và không lỗi already-open', async () => {
    const world = makeWorld()
    const doc = await world.foundation.documents.create({
      name: 'e.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx'], { type: 'application/octet-stream' }),
    })
    await openReady(world, doc.id)
    drawStroke(world.canvas, [
      { x: 15, y: 25, time: 0 },
      { x: 70, y: 40, time: 16 },
    ])
    const freshCanvas = new FakeCanvasElement()
    await world.controller.open(doc.id, freshCanvas as unknown as HTMLCanvasElement)
    world.controller.handleResize(800, 2000)
    world.scheduler.runAll()
    expect(world.controller.getSnapshot().status).toBe('ready')
    expect(world.controller.getObjectCount()).toBe(1)
    // Vẽ tiếp trên canvas mới hoạt động bình thường:
    drawStroke(freshCanvas, [
      { x: 100, y: 200, time: 200 },
      { x: 160, y: 210, time: 216 },
    ])
    expect(world.controller.getObjectCount()).toBe(2)
    await world.controller.close()
    world.db.close()
  }, 30000)
})
