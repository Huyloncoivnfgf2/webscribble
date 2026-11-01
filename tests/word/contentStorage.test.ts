import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/data/database'
import {
  DOCUMENT_CONTENT_VERSION,
  UnsupportedContentVersionError,
  createStorageFoundation,
} from '../../src/data/index'
import { createEmptyWordContent } from '../../src/engines/word/index'

/**
 * TASK-07A — Data Layer: migration Dexie v1 → v2, repository
 * nội dung (CRUD + bảo vệ phiên bản), cascade xóa đầy đủ.
 */

let counter = 100

describe('TASK-07A — migration v1 → v2 bảo toàn dữ liệu', () => {
  it('database v1 có tài liệu + annotation mở lên v2 nguyên vẹn, bảng mới dùng được', async () => {
    counter += 1
    const name = `webscribble-07a-mig-${counter}`
    // Dựng một database ĐÚNG schema v1 như app cũ:
    const v1 = new Dexie(name)
    v1.version(1).stores({
      documents: 'id, createdAt, updatedAt',
      annotations: 'surfaceId, documentId',
    })
    await v1.open()
    await v1.table('documents').add({
      id: 'doc-old',
      name: 'cu.pdf',
      mimeType: 'application/pdf',
      size: 3,
      createdAt: 1,
      updatedAt: 1,
      pageCount: 2,
      blob: new Blob(['abc']),
    })
    await v1.table('annotations').add({
      surfaceId: 'document:doc-old:0',
      documentId: 'doc-old',
      pageIndex: 0,
      objects: [{ id: 'obj-1' }],
      updatedAt: 1,
      schemaVersion: 1,
    })
    v1.close()

    // Mở bằng database hiện tại (v2):
    const db = createDatabase(name)
    const foundation = createStorageFoundation(db)
    // Chuỗi migration hiện kết thúc ở v3 (TASK-14C cộng thêm
    // hai bảng nền) — dữ liệu v1 vẫn phải nguyên vẹn:
    expect(db.verno).toBe(3)
    const doc = await foundation.documents.getById('doc-old')
    expect(doc?.name).toBe('cu.pdf')
    expect(await doc?.blob.text()).toBe('abc')
    const surfaces = await foundation.annotations.getSurfacesByDocument('doc-old')
    expect(surfaces).toHaveLength(1)
    // Bảng mới hoạt động, và tài liệu cũ KHÔNG bị tạo record nội dung giả:
    expect(await foundation.contents.getContent('doc-old')).toBeUndefined()
    await foundation.contents.saveContent({
      documentId: 'doc-old',
      content: createEmptyWordContent(),
    })
    expect((await foundation.contents.getContent('doc-old'))?.contentVersion).toBe(DOCUMENT_CONTENT_VERSION)
    db.close()
  })
})

describe('TASK-07A — DocumentContentRepository', () => {
  it('lưu → đọc lại qua foundation mới; cập nhật thay thế nguyên tử', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-content-${counter}`)
    const foundation = createStorageFoundation(db)
    const doc = await foundation.documents.create({
      name: 'a.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['x']),
    })
    const v1Content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bản một' }] }],
    }
    await foundation.contents.saveContent({ documentId: doc.id, content: v1Content })

    const foundation2 = createStorageFoundation(db)
    const read = await foundation2.contents.getContent(doc.id)
    expect(read?.content).toEqual(v1Content)
    expect(read?.contentVersion).toBe(DOCUMENT_CONTENT_VERSION)

    const v2Content = { type: 'doc', content: [{ type: 'paragraph' }] }
    await foundation2.contents.saveContent({ documentId: doc.id, content: v2Content })
    expect((await foundation.contents.getContent(doc.id))?.content).toEqual(v2Content)
    db.close()
  })

  it('bản ghi có contentVersion mới hơn → từ chối đọc/ghi, dữ liệu giữ nguyên', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-content-${counter}`)
    const foundation = createStorageFoundation(db)
    await db.documentContents.put({
      documentId: 'doc-future',
      contentVersion: 99,
      content: { type: 'doc', content: [] },
      updatedAt: 1,
    })
    await expect(foundation.contents.getContent('doc-future')).rejects.toBeInstanceOf(
      UnsupportedContentVersionError,
    )
    await expect(
      foundation.contents.saveContent({ documentId: 'doc-future', content: {} }),
    ).rejects.toBeInstanceOf(UnsupportedContentVersionError)
    const raw = await db.documentContents.get('doc-future')
    expect(raw?.contentVersion).toBe(99)
    db.close()
  })

  it('xóa tài liệu cascade cả documentContents lẫn annotations', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-content-${counter}`)
    const foundation = createStorageFoundation(db)
    const doc = await foundation.documents.create({
      name: 'xoa.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['x']),
    })
    await foundation.contents.saveContent({
      documentId: doc.id,
      content: createEmptyWordContent(),
    })
    await foundation.annotations.saveSurface({
      surfaceId: `document:${doc.id}:0`,
      documentId: doc.id,
      pageIndex: 0,
      objects: [],
    })
    await foundation.documents.delete(doc.id)
    expect(await foundation.documents.getById(doc.id)).toBeUndefined()
    expect(await foundation.contents.getContent(doc.id)).toBeUndefined()
    expect(await foundation.annotations.getSurfacesByDocument(doc.id)).toEqual([])
    expect(await db.documentContents.count()).toBe(0)
    expect(await db.annotations.count()).toBe(0)
    db.close()
  })
})
