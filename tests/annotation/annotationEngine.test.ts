/**
 * TASK-06C — Annotation Engine trên fake-indexeddb với repository
 * và autosave THẬT của Storage Foundation: mở/nạp/lưu surface,
 * khôi phục đủ 7 loại DrawingObject nguyên vẹn, validation dữ
 * liệu lưu, vòng đời session và cô lập giữa các surface.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createArrow,
  createEllipse,
  createHighlighterStroke,
  createLine,
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import type { DrawingObject } from '../../src/engines/drawing/types'
import { translateObject } from '../../src/engines/drawing/selection'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import { createStorageFoundation, type StorageFoundation } from '../../src/data/index'
import { documentSurfaceId } from '../../src/data/types'
import {
  AnnotationDataError,
  AnnotationError,
  createAnnotationEngine,
  type AnnotationEngine,
} from '../../src/engines/annotation/index'

const DOC = 'doc-annotate'
const PAGE_SIZE = { width: 612, height: 792 }

let db: WebScribbleDatabase
let foundation: StorageFoundation
let engine: AnnotationEngine
let dbCounter = 0

beforeEach(() => {
  dbCounter += 1
  db = createDatabase(`webscribble-06c-${dbCounter}`)
  foundation = createStorageFoundation(db)
  engine = createAnnotationEngine({
    annotations: foundation.annotations,
    autosave: foundation.autosave,
  })
})

afterEach(async () => {
  await engine.closeAll().catch(() => undefined)
  await db.delete()
})

function sevenObjects(surfaceId: string): DrawingObject[] {
  return [
    createPenStroke({
      surfaceId, id: 'obj-pen', createdAt: 1000,
      points: [
        { x: 10, y: 20, pressure: 0.25, time: 0 },
        { x: 60, y: 45, pressure: 0.75, time: 33 },
        { x: 110, y: 20, pressure: 0.5, time: 66 },
      ],
    }),
    createHighlighterStroke({
      surfaceId, id: 'obj-hl', createdAt: 1001,
      points: [
        { x: 30, y: 100, pressure: 0.5, time: 0 },
        { x: 200, y: 100, pressure: 0.5, time: 20 },
      ],
    }),
    createLine({ surfaceId, id: 'obj-line', createdAt: 1002, start: { x: 5, y: 5 }, end: { x: 90, y: 90 } }),
    createRectangle({ surfaceId, id: 'obj-rect', createdAt: 1003, start: { x: 150, y: 150 }, end: { x: 260, y: 230 } }),
    createEllipse({ surfaceId, id: 'obj-ellipse', createdAt: 1004, start: { x: 300, y: 300 }, end: { x: 420, y: 380 } }),
    createArrow({ surfaceId, id: 'obj-arrow', createdAt: 1005, start: { x: 50, y: 500 }, end: { x: 180, y: 560 } }),
    createText({
      surfaceId, id: 'obj-text', createdAt: 1006,
      position: { x: 220, y: 640 }, text: 'Ghi chú tiếng Việt', width: 240, height: 25,
    }),
  ]
}

describe('AnnotationEngine — mở và vòng đời surface', () => {
  it('mở surface chưa có dữ liệu: session rỗng, surfaceId đúng quy ước, kind document-page', async () => {
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    expect(session.surfaceId).toBe(documentSurfaceId(DOC, 0))
    expect(session.surface.id).toBe('document:doc-annotate:0')
    expect(session.surface.kind).toBe('document-page')
    expect(session.listObjects()).toEqual([])
    expect(session.closed).toBe(false)
    expect(engine.isOpen(session.surfaceId)).toBe(true)
    await session.close()
  })

  it('mở trùng surface đang hoạt động → AnnotationError already-open; sau khi đóng thì mở lại được', async () => {
    const first = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const error = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AnnotationError)
    expect((error as AnnotationError).kind).toBe('already-open')
    await first.close()
    const reopened = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    expect(reopened.closed).toBe(false)
    await reopened.close()
  })

  it('đóng surface KHÔNG xóa dữ liệu đã lưu; mở lại thấy nguyên vẹn', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(sevenObjects(surfaceId)[0])
    await session.close() // close flush mặc định
    const record = await foundation.annotations.getSurface(surfaceId)
    expect(record?.objects).toHaveLength(1)
    const reopened = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    expect(reopened.listObjects()).toHaveLength(1)
    await reopened.close()
  })

  it('hai surface khác nhau độc lập: đóng một cái không ảnh hưởng cái kia, dữ liệu không trộn', async () => {
    const a = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const b = await engine.openDocumentPage(DOC, 1, { pageSize: PAGE_SIZE })
    a.surface.addObject(sevenObjects(a.surfaceId)[0])
    b.surface.addObject(sevenObjects(b.surfaceId)[2])
    await a.close()
    expect(b.closed).toBe(false)
    expect(b.listObjects()).toHaveLength(1)
    await b.saveNow()
    const recordB = await foundation.annotations.getSurface(b.surfaceId)
    expect(recordB?.objects).toHaveLength(1)
    expect((recordB?.objects[0] as DrawingObject).id).toBe('obj-line')
    await b.close()
  })

  it('sau khi đóng: saveNow/deleteSavedData ném kind closed; thay đổi trên surface cũ KHÔNG còn được lưu', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const stroke = sevenObjects(surfaceId)[0]
    session.surface.addObject(stroke)
    await session.close()
    await expect(session.saveNow()).rejects.toMatchObject({ kind: 'closed' })
    await expect(session.deleteSavedData()).rejects.toMatchObject({ kind: 'closed' })
    // Surface cũ vẫn bị ai đó giữ tham chiếu và sửa — engine đã hủy
    // subscription nên không có gì được ghi xuống nữa.
    session.surface.removeObject(stroke.id)
    await new Promise((resolve) => setTimeout(resolve, 500)) // quá thời gian debounce của autosave
    const record = await foundation.annotations.getSurface(surfaceId)
    expect(record?.objects).toHaveLength(1) // vẫn là bản đã lưu lúc đóng
  })
})

describe('AnnotationEngine — khôi phục DrawingObject nguyên vẹn', () => {
  it('đủ 7 loại object: lưu → đóng → mở lại → dữ liệu GIỐNG HỆT (id, surfaceId, bounds, points, pressure, time, text)', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const originals = sevenObjects(surfaceId)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    for (const object of originals) session.surface.addObject(object)
    await session.saveNow()
    await session.close()

    const reopened = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const restored = reopened.listObjects()
    expect(restored.map((o) => o.id)).toEqual(originals.map((o) => o.id)) // đúng thứ tự
    expect(restored).toEqual(originals) // deep equal toàn bộ trường
    const pen = restored[0]
    if (pen.type === 'pen') {
      expect(pen.points[1]).toEqual({ x: 60, y: 45, pressure: 0.75, time: 33 })
    } else {
      throw new Error('expected pen stroke')
    }
    await reopened.close()
  })

  it('cập nhật và xóa object phản ánh đúng vào bản lưu (qua đường surface thông thường)', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const [pen, line] = sevenObjects(surfaceId)
    session.surface.addObject(pen)
    session.surface.addObject(line)
    await session.saveNow()
    session.surface.removeObject(line.id)
    // Di chuyển bằng helper translateObject của chính Drawing
    // Engine (cập nhật cả points lẫn bounds một cách nhất quán).
    session.surface.updateObject(translateObject(pen, { x: 5, y: 0 }))
    await session.saveNow()
    const record = await foundation.annotations.getSurface(surfaceId)
    expect(record?.objects).toHaveLength(1)
    const savedPen = record?.objects[0] as DrawingObject
    expect(savedPen.id).toBe('obj-pen')
    await session.close()
  })
})

describe('AnnotationEngine — validation dữ liệu đã lưu', () => {
  async function seedRawRecord(surfaceId: string, objects: unknown[]) {
    await foundation.annotations.saveSurface({
      surfaceId, documentId: DOC, pageIndex: 0, objects,
    })
  }

  it('object thiếu trường bắt buộc → AnnotationDataError, mang objectIndex và problems; bản lưu còn nguyên', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const good = sevenObjects(surfaceId)[0]
    const broken = { id: 'broken-1', type: 'pen' } // thiếu gần như mọi trường
    await seedRawRecord(surfaceId, [good, broken])
    const error = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AnnotationDataError)
    expect((error as AnnotationDataError).objectIndex).toBe(1)
    expect((error as AnnotationDataError).objectId).toBe('broken-1')
    expect((error as AnnotationDataError).problems.length).toBeGreaterThan(0)
    expect(engine.isOpen(surfaceId)).toBe(false) // lần mở thất bại sạch
    const record = await foundation.annotations.getSurface(surfaceId)
    expect(record?.objects).toHaveLength(2) // dữ liệu gốc không bị đụng
  })

  it('object sai surfaceId → AnnotationDataError (không trộn dữ liệu giữa các surface)', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const foreign = sevenObjects(documentSurfaceId(DOC, 9))[0]
    await seedRawRecord(surfaceId, [foreign])
    const error = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AnnotationDataError)
    expect((error as AnnotationDataError).problems[0]).toContain('does not match')
  })

  it('points không hợp lệ (pressure ngoài [0,1]) → AnnotationDataError', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const bad = {
      ...sevenObjects(surfaceId)[0],
      points: [{ x: 1, y: 1, pressure: 7, time: 0 }],
    }
    await seedRawRecord(surfaceId, [bad])
    const error = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AnnotationDataError)
  })

  it('record thuộc schema version tương lai → UnsupportedAnnotationSchemaError nguyên vẹn từ data layer, dữ liệu không mất', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    await seedRawRecord(surfaceId, sevenObjects(surfaceId))
    // Ghi trực tiếp một record "tương lai" qua Dexie để mô phỏng.
    await db.annotations.put({
      surfaceId, documentId: DOC, pageIndex: 0,
      objects: [], updatedAt: Date.now(), schemaVersion: 99,
    })
    const error = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE }).catch((e: unknown) => e)
    expect((error as Error).name).toBe('UnsupportedAnnotationSchemaError')
    const raw = await db.annotations.get(surfaceId)
    expect(raw?.schemaVersion).toBe(99) // còn nguyên
  })
})
