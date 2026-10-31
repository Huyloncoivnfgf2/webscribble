/**
 * TASK-08A — AnnotationRepository trên fake-indexeddb: record theo
 * surface, upsert không trùng, bảo toàn thứ tự object, độc lập giữa
 * các surface/tài liệu, và bảo vệ record có schemaVersion mới hơn.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPenStroke } from '../../src/engines/drawing/objects'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import { DexieAnnotationRepository } from '../../src/data/repositories/annotationRepository'
import {
  ANNOTATION_SCHEMA_VERSION,
  UnsupportedAnnotationSchemaError,
  documentSurfaceId,
} from '../../src/data/types'

const DOC = 'doc-1'
const DOC2 = 'doc-2'

function stroke(id: string, x: number) {
  return createPenStroke({
    surfaceId: documentSurfaceId(DOC, 0),
    id,
    points: [
      { x, y: 10, pressure: 0.5, time: 0 },
      { x: x + 40, y: 10, pressure: 0.5, time: 16 },
    ],
  })
}

describe('AnnotationRepository (fake-indexeddb)', () => {
  let db: WebScribbleDatabase
  let repo: DexieAnnotationRepository

  beforeEach(() => {
    db = createDatabase(`test-anno-${crypto.randomUUID()}`)
    repo = new DexieAnnotationRepository(db)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('lưu và đọc lại một surface: objects nguyên vẹn, schemaVersion và updatedAt do repository chốt', async () => {
    const objects = [stroke('a', 0), stroke('b', 100)]
    const saved = await repo.saveSurface({
      surfaceId: documentSurfaceId(DOC, 0),
      documentId: DOC,
      pageIndex: 0,
      objects,
    })
    expect(saved.schemaVersion).toBe(ANNOTATION_SCHEMA_VERSION)
    expect(saved.updatedAt).toBeGreaterThan(0)
    const fetched = await repo.getSurface(documentSurfaceId(DOC, 0))
    expect(fetched?.objects).toEqual(objects)
  })

  it('bảo toàn THỨ TỰ objects đúng như đã ghi', async () => {
    const objects = [stroke('z', 0), stroke('m', 50), stroke('a', 100)]
    await repo.saveSurface({
      surfaceId: documentSurfaceId(DOC, 0),
      documentId: DOC,
      pageIndex: 0,
      objects,
    })
    const fetched = await repo.getSurface(documentSurfaceId(DOC, 0))
    expect((fetched?.objects as { id: string }[]).map((o) => o.id)).toEqual(['z', 'm', 'a'])
  })

  it('ghi nhiều lần cùng surface: upsert — vẫn đúng MỘT record, nội dung là bản mới nhất', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    await repo.saveSurface({ surfaceId, documentId: DOC, pageIndex: 0, objects: [stroke('a', 0)] })
    await repo.saveSurface({ surfaceId, documentId: DOC, pageIndex: 0, objects: [stroke('b', 0)] })
    await repo.saveSurface({ surfaceId, documentId: DOC, pageIndex: 0, objects: [] })
    expect(await db.annotations.count()).toBe(1)
    const fetched = await repo.getSurface(surfaceId)
    expect(fetched?.objects).toEqual([])
  })

  it('nhiều surface độc lập: hai trang của một tài liệu và trang của tài liệu khác không lẫn nhau', async () => {
    await repo.saveSurface({ surfaceId: documentSurfaceId(DOC, 0), documentId: DOC, pageIndex: 0, objects: [stroke('p0', 0)] })
    await repo.saveSurface({ surfaceId: documentSurfaceId(DOC, 2), documentId: DOC, pageIndex: 2, objects: [stroke('p2', 0)] })
    await repo.saveSurface({ surfaceId: documentSurfaceId(DOC2, 0), documentId: DOC2, pageIndex: 0, objects: [stroke('other', 0)] })
    const byDoc = await repo.getSurfacesByDocument(DOC)
    expect(byDoc.map((r) => r.pageIndex)).toEqual([0, 2]) // sắp theo pageIndex
    expect(await repo.getSurfacesByDocument(DOC2)).toHaveLength(1)
    expect((await repo.getSurface(documentSurfaceId(DOC, 2)))?.objects).toHaveLength(1)
  })

  it('xóa theo surface và xóa toàn bộ theo document', async () => {
    await repo.saveSurface({ surfaceId: documentSurfaceId(DOC, 0), documentId: DOC, pageIndex: 0, objects: [] })
    await repo.saveSurface({ surfaceId: documentSurfaceId(DOC, 1), documentId: DOC, pageIndex: 1, objects: [] })
    expect(await repo.deleteSurface(documentSurfaceId(DOC, 0))).toBe(true)
    expect(await repo.deleteSurface(documentSurfaceId(DOC, 0))).toBe(false)
    expect(await repo.deleteByDocument(DOC)).toBe(1)
    expect(await db.annotations.count()).toBe(0)
  })

  it('surface không tồn tại: getSurface trả undefined', async () => {
    expect(await repo.getSurface(documentSurfaceId(DOC, 9))).toBeUndefined()
  })

  it('record có schemaVersion MỚI hơn: đọc ném lỗi có kiểu rõ ràng, ghi cũng từ chối, dữ liệu gốc còn nguyên', async () => {
    const surfaceId = documentSurfaceId(DOC, 0)
    const futureRecord = {
      surfaceId,
      documentId: DOC,
      pageIndex: 0,
      objects: [{ id: 'from-the-future' }],
      updatedAt: 123,
      schemaVersion: ANNOTATION_SCHEMA_VERSION + 99,
    }
    await db.annotations.put(futureRecord)

    await expect(repo.getSurface(surfaceId)).rejects.toBeInstanceOf(
      UnsupportedAnnotationSchemaError,
    )
    await expect(
      repo.saveSurface({ surfaceId, documentId: DOC, pageIndex: 0, objects: [] }),
    ).rejects.toBeInstanceOf(UnsupportedAnnotationSchemaError)

    const raw = await db.annotations.get(surfaceId)
    expect(raw).toEqual(futureRecord) // không bị ghi đè, không bị sửa
  })

  it('quy ước surfaceId: documentSurfaceId tất định và parse ngược được', () => {
    expect(documentSurfaceId('abc', 3)).toBe('document:abc:3')
    expect(documentSurfaceId('abc', 3)).toBe(documentSurfaceId('abc', 3))
  })
})
