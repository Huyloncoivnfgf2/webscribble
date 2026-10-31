/**
 * TASK-08A — DocumentRepository trên fake-indexeddb: nhập/đọc Blob
 * nguyên vẹn, documentId mới cho mỗi lần nhập (QA-B), metadata
 * không kèm Blob, xóa tài liệu xóa sạch annotation trong cùng
 * transaction.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import { DexieAnnotationRepository } from '../../src/data/repositories/annotationRepository'
import { DexieDocumentRepository } from '../../src/data/repositories/documentRepository'
import { documentSurfaceId } from '../../src/data/types'

const PDF_BYTES = '%PDF-1.4 fake fixture content for TASK-08A'

function pdfBlob(): Blob {
  return new Blob([PDF_BYTES], { type: 'application/pdf' })
}

describe('DocumentRepository (fake-indexeddb)', () => {
  let db: WebScribbleDatabase
  let documents: DexieDocumentRepository
  let annotations: DexieAnnotationRepository

  beforeEach(() => {
    db = createDatabase(`test-docs-${crypto.randomUUID()}`)
    documents = new DexieDocumentRepository(db)
    annotations = new DexieAnnotationRepository(db)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('tạo tài liệu: sinh id, ghi metadata đúng, size lấy từ Blob', async () => {
    const created = await documents.create({
      name: 'de-hoa.pdf',
      mimeType: 'application/pdf',
      blob: pdfBlob(),
      pageCount: 12,
    })
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('de-hoa.pdf')
    expect(created.size).toBe(PDF_BYTES.length)
    expect(created.pageCount).toBe(12)
    expect(created.createdAt).toBeGreaterThan(0)
    const fetched = await documents.getById(created.id)
    expect(fetched?.name).toBe('de-hoa.pdf')
  })

  it('đọc lại Blob NGUYÊN VẸN (nội dung và loại không đổi)', async () => {
    const created = await documents.create({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      blob: pdfBlob(),
    })
    const blob = await documents.getBlob(created.id)
    expect(blob).toBeDefined()
    expect(blob?.type).toBe('application/pdf')
    expect(await blob?.text()).toBe(PDF_BYTES)
  })

  it('QA-B: nhập cùng một file hai lần → hai documentId KHÁC nhau, hai bản ghi độc lập', async () => {
    const blob = pdfBlob()
    const first = await documents.create({ name: 'same.pdf', mimeType: 'application/pdf', blob })
    const second = await documents.create({ name: 'same.pdf', mimeType: 'application/pdf', blob })
    expect(first.id).not.toBe(second.id)
    expect(await documents.list()).toHaveLength(2)
  })

  it('list() trả metadata KHÔNG kèm Blob và sắp mới nhất trước', async () => {
    const a = await documents.create({ name: 'a.pdf', mimeType: 'application/pdf', blob: pdfBlob() })
    const b = await documents.create({ name: 'b.pdf', mimeType: 'application/pdf', blob: pdfBlob() })
    const list = await documents.list()
    expect(list.map((d) => d.id)).toEqual([b.id, a.id])
    for (const item of list) {
      expect(item).not.toHaveProperty('blob')
    }
  })

  it('updateMetadata đổi tên/số trang, không đụng Blob và không đụng annotation', async () => {
    const created = await documents.create({
      name: 'old.pdf',
      mimeType: 'application/pdf',
      blob: pdfBlob(),
    })
    await annotations.saveSurface({
      surfaceId: documentSurfaceId(created.id, 0),
      documentId: created.id,
      pageIndex: 0,
      objects: [{ id: 'o1' }],
    })
    const updated = await documents.updateMetadata(created.id, { name: 'new.pdf', pageCount: 3 })
    expect(updated?.name).toBe('new.pdf')
    expect(updated?.pageCount).toBe(3)
    expect(await (await documents.getBlob(created.id))?.text()).toBe(PDF_BYTES)
    expect(await annotations.getSurface(documentSurfaceId(created.id, 0))).toBeDefined()
    expect(await documents.updateMetadata('missing-id', { name: 'x' })).toBeUndefined()
  })

  it('xóa tài liệu: xóa cả annotation liên quan trong cùng transaction; tài liệu khác nguyên vẹn', async () => {
    const keep = await documents.create({ name: 'keep.pdf', mimeType: 'application/pdf', blob: pdfBlob() })
    const drop = await documents.create({ name: 'drop.pdf', mimeType: 'application/pdf', blob: pdfBlob() })
    for (const doc of [keep, drop]) {
      await annotations.saveSurface({
        surfaceId: documentSurfaceId(doc.id, 0),
        documentId: doc.id,
        pageIndex: 0,
        objects: [{ id: `obj-${doc.id}` }],
      })
    }
    expect(await documents.delete(drop.id)).toBe(true)
    expect(await documents.getById(drop.id)).toBeUndefined()
    expect(await annotations.getSurfacesByDocument(drop.id)).toEqual([])
    expect(await annotations.getSurfacesByDocument(keep.id)).toHaveLength(1)
    expect(await documents.delete('missing-id')).toBe(false)
  })

  it('documentId không tồn tại: getById/getBlob trả undefined', async () => {
    expect(await documents.getById('nope')).toBeUndefined()
    expect(await documents.getBlob('nope')).toBeUndefined()
  })
})
