import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  createBackupArchive,
  createStorageFoundation,
  documentSurfaceId,
  executeRestore,
  inspectBackupArchive,
} from '../../src/data/index'
import { WebScribbleDatabase } from '../../src/data/database'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import {
  parseManifest,
  WhiteboardError,
  WhiteboardStore,
  WHITEBOARD_MIME_TYPE,
} from '../../src/app/features/whiteboard/whiteboardStore'
import { WhiteboardController } from '../../src/app/features/whiteboard/WhiteboardController'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from '../drawing/fakes'

function makeWorld() {
  const db = new WebScribbleDatabase(`webscribble-12-${crypto.randomUUID()}`)
  const foundation = createStorageFoundation(db)
  const store = new WhiteboardStore({
    documents: foundation.documents,
    annotations: foundation.annotations,
  })
  const annotationEngine = createAnnotationEngine({
    annotations: foundation.annotations,
    autosave: foundation.autosave,
  })
  return { db, foundation, store, annotationEngine }
}

function drawStroke(element: FakeCanvasElement, y: number): void {
  element.dispatch('pointerdown', pointerEvent({ clientX: 40, clientY: y, timeStamp: 1000 }))
  element.dispatch('pointermove', pointerEvent({ clientX: 120, clientY: y + 14, timeStamp: 1016 }))
  element.dispatch('pointerup', pointerEvent({ clientX: 200, clientY: y + 8, timeStamp: 1032, buttons: 0 }))
}

async function objectsOnPage(
  world: ReturnType<typeof makeWorld>,
  documentId: string,
  pageIndex: number,
): Promise<readonly unknown[]> {
  const record = await world.foundation.annotations.getSurface(documentSurfaceId(documentId, pageIndex))
  return record?.objects ?? []
}

describe('TASK-12 — WhiteboardStore', () => {
  it('tạo bảng trắng: document mang mime riêng, manifest 1 trang, pageCount đồng bộ', async () => {
    const world = makeWorld()
    const { id, manifest } = await world.store.create('Bảng kiểm tra')
    expect(manifest.pages).toEqual([{ background: 'blank' }])
    const record = await world.foundation.documents.getById(id)
    expect(record?.mimeType).toBe(WHITEBOARD_MIME_TYPE)
    expect(record?.pageCount).toBe(1)
    const loaded = await world.store.load(id)
    expect(loaded.pageSize).toEqual({ width: 1600, height: 1000 })
    world.db.close()
  })

  it('manifest hỏng bị từ chối tường minh', () => {
    expect(() => parseManifest('khong phai json')).toThrow(WhiteboardError)
    expect(() => parseManifest('{"kind":"khac","version":1,"pages":[{}]}')).toThrow(WhiteboardError)
    expect(() =>
      parseManifest('{"kind":"webscribble-whiteboard","version":1,"pageSize":{"width":10,"height":10},"pages":[]}'),
    ).toThrow(WhiteboardError)
  })

  it('thêm/xóa trang: xóa trang giữa remap nét của các trang sau về đúng chỉ số mới', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Remap')
    await world.store.addPage(id)
    await world.store.addPage(id)
    // Vẽ dữ liệu giả lập trực tiếp qua repository cho 3 trang:
    for (let page = 0; page < 3; page += 1) {
      await world.foundation.annotations.saveSurface({
        surfaceId: documentSurfaceId(id, page),
        documentId: id,
        pageIndex: page,
        objects: [{ marker: `trang-${page}` }],
      })
    }
    const afterDelete = await world.store.deletePage(id, 0)
    expect(afterDelete.pages).toHaveLength(2)
    expect(await objectsOnPage(world, id, 0)).toEqual([{ marker: 'trang-1' }])
    expect(await objectsOnPage(world, id, 1)).toEqual([{ marker: 'trang-2' }])
    expect(await objectsOnPage(world, id, 2)).toEqual([])
    // Không còn record staging nào sót lại:
    const all = await world.foundation.annotations.getSurfacesByDocument(id)
    expect(all.every((r) => !r.surfaceId.startsWith('whiteboard-stage:'))).toBe(true)
    world.db.close()
  })

  it('đổi thứ tự trang: nét vẽ đi theo trang; xóa trang cuối cùng bị từ chối', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Thu tu')
    await world.store.addPage(id)
    await world.store.addPage(id)
    for (let page = 0; page < 3; page += 1) {
      await world.foundation.annotations.saveSurface({
        surfaceId: documentSurfaceId(id, page),
        documentId: id,
        pageIndex: page,
        objects: [{ marker: `p${page}` }],
      })
    }
    // Chuyển trang 0 xuống cuối: [p1, p2, p0]
    await world.store.movePage(id, 0, 2)
    expect(await objectsOnPage(world, id, 0)).toEqual([{ marker: 'p1' }])
    expect(await objectsOnPage(world, id, 1)).toEqual([{ marker: 'p2' }])
    expect(await objectsOnPage(world, id, 2)).toEqual([{ marker: 'p0' }])
    // Nền cũng đi theo trang:
    await world.store.setPageBackground(id, 2, 'grid')
    await world.store.movePage(id, 2, 0)
    const manifest = await world.store.load(id)
    expect(manifest.pages[0].background).toBe('grid')

    const single = await world.store.create('Mot trang')
    await expect(world.store.deletePage(single.id, 0)).rejects.toMatchObject({ kind: 'last-page' })
    world.db.close()
  })

  it('nền trang lưu/khôi phục qua manifest; đổi nền không đụng annotation', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Nen')
    await world.store.addPage(id)
    await world.foundation.annotations.saveSurface({
      surfaceId: documentSurfaceId(id, 0),
      documentId: id,
      pageIndex: 0,
      objects: [{ marker: 'giu-nguyen' }],
    })
    await world.store.setPageBackground(id, 1, 'dots')
    await world.store.setAllBackgrounds(id, 'ruled')
    const manifest = await world.store.load(id)
    expect(manifest.pages.map((p) => p.background)).toEqual(['ruled', 'ruled'])
    expect(await objectsOnPage(world, id, 0)).toEqual([{ marker: 'giu-nguyen' }])
    world.db.close()
  })
})

describe('TASK-12 — WhiteboardController', () => {
  it('vẽ trên trang 1, thêm trang và vẽ tiếp, chuyển trang qua lại: mỗi trang giữ nét riêng; mở lại bằng controller mới khôi phục đủ', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Controller')
    const scheduler = new FakeFrameScheduler()
    const controller = new WhiteboardController({
      store: world.store,
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
    })
    const canvas = new FakeCanvasElement()
    controller.setViewportSize(1200, 700)
    await controller.open(id, canvas as unknown as HTMLCanvasElement)
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', pageIndex: 0, pageCount: 1 })
    drawStroke(canvas, 100)
    expect(controller.getObjectCount()).toBe(1)

    await controller.addPage()
    expect(controller.getSnapshot()).toMatchObject({ pageIndex: 1, pageCount: 2 })
    expect(controller.getObjectCount()).toBe(0)
    drawStroke(canvas, 300)
    drawStroke(canvas, 420)
    expect(controller.getObjectCount()).toBe(2)

    await controller.prevPage()
    expect(controller.getSnapshot().pageIndex).toBe(0)
    expect(controller.getObjectCount()).toBe(1)
    await controller.close()

    const scheduler2 = new FakeFrameScheduler()
    const controller2 = new WhiteboardController({
      store: world.store,
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler2.request,
      cancelFrame: scheduler2.cancel,
    })
    const canvas2 = new FakeCanvasElement()
    await controller2.open(id, canvas2 as unknown as HTMLCanvasElement)
    expect(controller2.getObjectCount()).toBe(1)
    await controller2.nextPage()
    expect(controller2.getObjectCount()).toBe(2)
    // Undo chỉ tác động các nét vẽ TRONG phiên hiện tại (đúng
    // hành vi của Drawing Engine ở mọi mode — nét khôi phục
    // từ lưu trữ không nằm trong ngăn xếp undo của phiên mới):
    drawStroke(canvas2, 500)
    expect(controller2.getObjectCount()).toBe(3)
    controller2.undo()
    await Promise.resolve()
    expect(controller2.getObjectCount()).toBe(2)
    // Và undo ở trang 2 không đụng trang 1:
    await controller2.prevPage()
    expect(controller2.getObjectCount()).toBe(1)
    await controller2.close()
    world.db.close()
  }, 30000)

  it('REGRESSION: đổi thứ tự + xóa trang qua controller với nét vẽ THẬT — object được viết lại surfaceId nên mở lại không lỗi invalid-data', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Regression')
    const scheduler = new FakeFrameScheduler()
    const controller = new WhiteboardController({
      store: world.store,
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
    })
    const canvas = new FakeCanvasElement()
    controller.setViewportSize(1200, 700)
    await controller.open(id, canvas as unknown as HTMLCanvasElement)
    drawStroke(canvas, 100)
    await new Promise((r) => setTimeout(r, 700)) // autosave thật
    await controller.addPage()
    drawStroke(canvas, 300)
    drawStroke(canvas, 420)
    await new Promise((r) => setTimeout(r, 700))

    // Đưa trang 2 (2 nét) lên đầu:
    await controller.moveCurrentPage(-1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', pageIndex: 0 })
    expect(controller.getObjectCount()).toBe(2)
    await controller.nextPage()
    expect(controller.getObjectCount()).toBe(1)

    // Xóa trang 2 (trang 1 nét ban đầu) → trang còn lại giữ 2 nét:
    await controller.deleteCurrentPage()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', pageCount: 1, pageIndex: 0 })
    expect(controller.getObjectCount()).toBe(2)
    await controller.close()

    // Mở lại từ đầu: dữ liệu hợp lệ, không invalid-data:
    const scheduler2 = new FakeFrameScheduler()
    const controller2 = new WhiteboardController({
      store: world.store,
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler2.request,
      cancelFrame: scheduler2.cancel,
    })
    await controller2.open(id, new FakeCanvasElement() as unknown as HTMLCanvasElement)
    expect(controller2.getSnapshot().status).toBe('ready')
    expect(controller2.getObjectCount()).toBe(2)
    await controller2.close()
    world.db.close()
  }, 30000)

  it('đổi nền qua controller được lưu vào manifest', async () => {    const world = makeWorld()
    const { id } = await world.store.create('Nen controller')
    const scheduler = new FakeFrameScheduler()
    const controller = new WhiteboardController({
      store: world.store,
      annotationEngine: world.annotationEngine,
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
    })
    await controller.open(id, new FakeCanvasElement() as unknown as HTMLCanvasElement)
    await controller.setBackground('grid')
    expect(controller.getSnapshot().background).toBe('grid')
    const manifest = await world.store.load(id)
    expect(manifest.pages[0].background).toBe('grid')
    await controller.close()
    world.db.close()
  }, 30000)
})

describe('TASK-12 — Backup/Restore bảng trắng', () => {
  it('backup mang đủ manifest + nét vẽ; restore vào DB sạch và remap khi trùng', async () => {
    const world = makeWorld()
    const { id } = await world.store.create('Backup WB')
    await world.store.addPage(id)
    await world.store.setPageBackground(id, 1, 'dots')
    await world.foundation.annotations.saveSurface({
      surfaceId: documentSurfaceId(id, 0),
      documentId: id,
      pageIndex: 0,
      objects: [{ marker: 'wb-net-1' }],
    })
    await world.foundation.annotations.saveSurface({
      surfaceId: documentSurfaceId(id, 1),
      documentId: id,
      pageIndex: 1,
      objects: [{ marker: 'wb-net-2' }],
    })

    const { blob } = await createBackupArchive(world.db)
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())
    expect(prepared.summary.counts).toMatchObject({ documents: 1, annotations: 2 })

    const targetDb = new WebScribbleDatabase(`webscribble-12-dst-${crypto.randomUUID()}`)
    const report = await executeRestore(targetDb, prepared)
    expect(report).toMatchObject({ importedDocuments: 1, importedAnnotations: 2, remappedDocuments: 0 })
    const targetFoundation = createStorageFoundation(targetDb)
    const restored = (await targetFoundation.documents.list())[0]
    expect(restored.mimeType).toBe(WHITEBOARD_MIME_TYPE)
    const targetStore = new WhiteboardStore({
      documents: targetFoundation.documents,
      annotations: targetFoundation.annotations,
    })
    const manifest = await targetStore.load(restored.id)
    expect(manifest.pages.map((p) => p.background)).toEqual(['blank', 'dots'])
    expect(
      (await targetFoundation.annotations.getSurface(documentSurfaceId(restored.id, 1)))?.objects,
    ).toEqual([{ marker: 'wb-net-2' }])
    targetDb.close()

    const prepared2 = await inspectBackupArchive(await blob.arrayBuffer())
    const report2 = await executeRestore(world.db, prepared2)
    expect(report2.remappedDocuments).toBe(1)
    world.db.close()
  }, 30000)
})
