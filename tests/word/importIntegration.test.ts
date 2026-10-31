import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/data/database'
import {
  createStorageFoundation,
  type DocumentContentRepository,
} from '../../src/data/index'
import {
  WordImportError,
  importDocxToLibrary,
  type WordDocumentContent,
} from '../../src/engines/word/index'
import { buildCorruptDocx, buildDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

/**
 * TASK-07A — tích hợp nhập DOCX vào thư viện: Blob gốc +
 * mô hình nội dung cùng tồn tại, đọc lại sau "reload", lỗi
 * không để dữ liệu mồ côi, PDF không bị ảnh hưởng.
 */

let counter = 200
const options = createTestConvertOptions()

describe('TASK-07A — importDocxToLibrary', () => {
  it('nhập DOCX: Blob gốc nguyên vẹn + nội dung đọc lại được từ foundation mới', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-int-${counter}`)
    const foundation = createStorageFoundation(db)
    const bytes = buildDocx()
    const { document, result } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: 'tailieu.docx', data: toArrayBuffer(bytes) },
      options,
    )
    expect(document.name).toBe('tailieu.docx')
    expect(document.mimeType).toContain('wordprocessingml')

    const blob = await foundation.documents.getBlob(document.id)
    expect(blob?.size).toBe(bytes.length)
    const blobBytes = new Uint8Array(await (blob as Blob).arrayBuffer())
    expect(blobBytes).toEqual(bytes)

    const foundation2 = createStorageFoundation(db)
    const saved = await foundation2.contents.getContent(document.id)
    expect(saved?.content).toEqual(result.content)
    const text = JSON.stringify(saved?.content)
    expect(text).toContain('Tiêu đề chính')
    expect(text).toContain('chữ đậm')
    db.close()
  })

  it('DOCX hỏng → ném lỗi và KHÔNG để lại document hay content nào', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-int-${counter}`)
    const foundation = createStorageFoundation(db)
    await expect(
      importDocxToLibrary(
        { documents: foundation.documents, contents: foundation.contents },
        { name: 'hong.docx', data: toArrayBuffer(buildCorruptDocx()) },
        options,
      ),
    ).rejects.toMatchObject({ kind: 'corrupt' })
    expect(await foundation.documents.list()).toEqual([])
    expect(await db.documentContents.count()).toBe(0)
    db.close()
  })

  it('lưu nội dung thất bại → rollback xóa tài liệu vừa tạo (không mồ côi)', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-int-${counter}`)
    const foundation = createStorageFoundation(db)
    const failingContents: DocumentContentRepository = {
      saveContent: async () => {
        throw new Error('simulated content save failure')
      },
      getContent: async () => undefined,
      deleteContent: async () => undefined,
    }
    const error = await importDocxToLibrary(
      { documents: foundation.documents, contents: failingContents },
      { name: 'rollback.docx', data: toArrayBuffer(buildDocx()) },
      options,
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(WordImportError)
    expect((error as WordImportError).kind).toBe('persistence')
    expect(await foundation.documents.list()).toEqual([])
    expect(await db.documents.count()).toBe(0)
    db.close()
  })

  it('tài liệu PDF tạo theo đường cũ vẫn hoạt động cạnh nội dung DOCX', async () => {
    counter += 1
    const db = createDatabase(`webscribble-07a-int-${counter}`)
    const foundation = createStorageFoundation(db)
    const pdf = await foundation.documents.create({
      name: 'de.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['%PDF-1.4 fake']),
      pageCount: 3,
    })
    const { document: docx } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: 'bai.docx', data: toArrayBuffer(buildDocx()) },
      options,
    )
    const list = await foundation.documents.list()
    expect(list.map((d) => d.id).sort()).toEqual([pdf.id, docx.id].sort())
    // PDF không có (và không cần) record nội dung:
    expect(await foundation.contents.getContent(pdf.id)).toBeUndefined()
    const content = (await foundation.contents.getContent(docx.id))?.content as WordDocumentContent
    expect(content.type).toBe('doc')
    db.close()
  })
})
