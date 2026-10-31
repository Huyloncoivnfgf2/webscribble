import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import {
  BackupError,
  createBackupArchive,
  createStorageFoundation,
  executeRestore,
  inspectBackupArchive,

} from '../../src/data/index'
import { importDocxToLibrary, type WordDocumentContent } from '../../src/engines/word/index'
import { buildPdf } from '../pdf/fixtures'
import { buildDocx } from '../word/fixtures'
import { createTestConvertOptions, toArrayBuffer } from '../word/testEnv'

/**
 * TASK-08C — Backup/Restore: toàn vẹn byte-for-byte, JSON
 * content giữ nguyên, restore vào DB rỗng, collision remap
 * nhất quán (không mồ côi), từ chối file lỗi TRƯỚC khi ghi,
 * rollback khi transaction lỗi, quota.
 */

let counter = 400

const strokeObject = {
  id: 'stroke-1',
  type: 'pen',
  points: [
    { x: 10, y: 10, pressure: 0.5, time: 0 },
    { x: 40, y: 30, pressure: 0.6, time: 16 },
  ],
  color: '#111111',
  width: 2,
}

async function buildLibrary(db: WebScribbleDatabase) {
  const foundation = createStorageFoundation(db)
  const pdfBytes = buildPdf({ pageCount: 2 })
  const pdf = await foundation.documents.create({
    name: 'de.pdf',
    mimeType: 'application/pdf',
    blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
    pageCount: 2,
  })
  await foundation.annotations.saveSurface({
    surfaceId: `document:${pdf.id}:0`,
    documentId: pdf.id,
    pageIndex: 0,
    objects: [strokeObject],
  })
  await foundation.annotations.saveSurface({
    surfaceId: `document:${pdf.id}:1`,
    documentId: pdf.id,
    pageIndex: 1,
    objects: [],
  })
  const docxBytes = buildDocx()
  const { document: docx } = await importDocxToLibrary(
    { documents: foundation.documents, contents: foundation.contents },
    { name: 'bai.docx', data: toArrayBuffer(docxBytes) },
    createTestConvertOptions(),
  )
  return { foundation, pdf, docx, pdfBytes, docxBytes }
}

async function mutateBackup(
  blob: Blob,
  fn: (zip: JSZip) => Promise<void>,
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  await fn(zip)
  return (await zip.generateAsync({ type: 'uint8array' })).slice().buffer as ArrayBuffer
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('TASK-08C — tạo backup', () => {
  it('thư viện rỗng → backup hợp lệ với counts 0', async () => {
    counter += 1
    const db = createDatabase(`webscribble-08c-${counter}`)
    const { blob, manifest } = await createBackupArchive(db)
    expect(manifest.counts).toEqual({ documents: 0, annotations: 0, documentContents: 0 })
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())
    expect(prepared.documents).toEqual([])
    db.close()
  })

  it('backup đầy đủ: manifest, checksum, blob trong archive nguyên vẹn', async () => {
    counter += 1
    const db = createDatabase(`webscribble-08c-${counter}`)
    const { pdf, docx, pdfBytes } = await buildLibrary(db)
    const { blob, manifest, fileName } = await createBackupArchive(db)
    expect(fileName).toMatch(/^webscribble-backup-\d{8}-\d{4}\.zip$/)
    expect(manifest.backupFormatVersion).toBe(1)
    expect(manifest.counts).toEqual({ documents: 2, annotations: 2, documentContents: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const pdfInZip = await zip.file(`files/${pdf.id}`)?.async('uint8array')
    expect(pdfInZip).toEqual(pdfBytes)
    expect(zip.file(`files/${docx.id}`)).not.toBeNull()
    db.close()
  })
})

describe('TASK-08C — restore', () => {
  it('restore vào database rỗng: blob byte-for-byte, annotation và DOCX content nguyên vẹn', async () => {
    counter += 1
    const sourceDb = createDatabase(`webscribble-08c-${counter}`)
    const { pdf, docx, pdfBytes, docxBytes } = await buildLibrary(sourceDb)
    const { blob } = await createBackupArchive(sourceDb)
    sourceDb.close()

    counter += 1
    const targetDb = createDatabase(`webscribble-08c-${counter}`)
    const target = createStorageFoundation(targetDb)
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())
    const report = await executeRestore(targetDb, prepared)
    expect(report).toEqual({
      importedDocuments: 2,
      importedAnnotations: 2,
      importedContents: 1,
      remappedDocuments: 0,
    })

    const restoredPdfBlob = await target.documents.getBlob(pdf.id)
    expect(new Uint8Array(await (restoredPdfBlob as Blob).arrayBuffer())).toEqual(pdfBytes)
    const restoredDocxBlob = await target.documents.getBlob(docx.id)
    expect(new Uint8Array(await (restoredDocxBlob as Blob).arrayBuffer())).toEqual(docxBytes)

    const surfaces = await target.annotations.getSurfacesByDocument(pdf.id)
    expect(surfaces).toHaveLength(2)
    expect(surfaces.find((s) => s.pageIndex === 0)?.objects).toEqual([strokeObject])

    const content = await target.contents.getContent(docx.id)
    expect((content?.content as WordDocumentContent).type).toBe('doc')
    expect(JSON.stringify(content?.content)).toContain('Tiêu đề chính')
    targetDb.close()
  })

  it('restore trùng ID → remap nhất quán: bản sao có ID mới, quan hệ đúng, gốc không đụng, không mồ côi', async () => {
    counter += 1
    const db = createDatabase(`webscribble-08c-${counter}`)
    const { foundation, pdf, docx } = await buildLibrary(db)
    const { blob } = await createBackupArchive(db)
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())
    const report = await executeRestore(db, prepared)
    expect(report.remappedDocuments).toBe(2)
    expect(report.importedDocuments).toBe(2)

    const all = await foundation.documents.list()
    expect(all).toHaveLength(4)
    const copies = all.filter((d) => d.id !== pdf.id && d.id !== docx.id)
    expect(copies).toHaveLength(2)
    const docxCopy = copies.find((d) => d.name === 'bai.docx')
    const pdfCopy = copies.find((d) => d.name === 'de.pdf')
    expect(docxCopy).toBeDefined()
    expect(pdfCopy).toBeDefined()

    // Nội dung DOCX đi theo ID mới:
    const copiedContent = await foundation.contents.getContent((docxCopy as { id: string }).id)
    expect(copiedContent).toBeDefined()
    expect(JSON.stringify(copiedContent?.content)).toContain('chữ đậm')
    // Annotation của PDF copy mang surfaceId/documentId mới:
    const copiedSurfaces = await foundation.annotations.getSurfacesByDocument(
      (pdfCopy as { id: string }).id,
    )
    expect(copiedSurfaces).toHaveLength(2)
    for (const s of copiedSurfaces) {
      expect(s.surfaceId).toBe(`document:${(pdfCopy as { id: string }).id}:${s.pageIndex}`)
    }
    // Gốc nguyên vẹn và không có annotation mồ côi nào trong toàn DB:
    expect(await foundation.documents.getById(pdf.id)).toBeDefined()
    const docIds = new Set(all.map((d) => d.id))
    const everyAnnotation = await db.annotations.toArray()
    expect(everyAnnotation).toHaveLength(4)
    for (const a of everyAnnotation) expect(docIds.has(a.documentId)).toBe(true)
    db.close()
  })
})

describe('TASK-08C — từ chối file lỗi TRƯỚC khi ghi', () => {
  async function seededTarget() {
    counter += 1
    const db = createDatabase(`webscribble-08c-${counter}`)
    const foundation = createStorageFoundation(db)
    await foundation.documents.create({
      name: 'hien-co.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['%PDF-1.4 giu nguyen']),
    })
    return { db, foundation }
  }

  async function validBackupBlob(): Promise<Blob> {
    counter += 1
    const db = createDatabase(`webscribble-08c-${counter}`)
    await buildLibrary(db)
    const { blob } = await createBackupArchive(db)
    db.close()
    return blob
  }

  it('bytes rác → not-a-backup; ZIP không manifest → not-a-backup; DB đích không đổi', async () => {
    const { db, foundation } = await seededTarget()
    await expect(
      inspectBackupArchive(toArrayBuffer(new TextEncoder().encode('khong phai zip'))),
    ).rejects.toMatchObject({ kind: 'not-a-backup' })
    const bareZip = new JSZip()
    bareZip.file('hello.txt', 'xin chao')
    const bareBytes = await bareZip.generateAsync({ type: 'uint8array' })
    await expect(inspectBackupArchive(bareBytes.slice().buffer as ArrayBuffer)).rejects.toMatchObject({
      kind: 'not-a-backup',
    })
    expect(await foundation.documents.list()).toHaveLength(1)
    db.close()
  })

  it('backupFormatVersion 99 → incompatible-version', async () => {
    const blob = await validBackupBlob()
    const data = await mutateBackup(blob, async (zip) => {
      const manifest = JSON.parse(await (zip.file('manifest.json') as JSZip.JSZipObject).async('string')) as Record<string, unknown>
      manifest.backupFormatVersion = 99
      zip.file('manifest.json', JSON.stringify(manifest))
    })
    await expect(inspectBackupArchive(data)).rejects.toMatchObject({ kind: 'incompatible-version' })
  })

  it('blob bị sửa 1 byte sau khi backup → checksum-mismatch', async () => {
    const blob = await validBackupBlob()
    const data = await mutateBackup(blob, async (zip) => {
      const names = Object.keys(zip.files).filter((n) => n.startsWith('files/') && !n.endsWith('/'))
      const first = names[0] as string
      const bytes = await (zip.file(first) as JSZip.JSZipObject).async('uint8array')
      bytes[10] = (bytes[10] as number) ^ 0xff
      zip.file(first, bytes)
    })
    await expect(inspectBackupArchive(data)).rejects.toMatchObject({ kind: 'checksum-mismatch' })
  })

  it('manifest khai sai số lượng → invalid-data', async () => {
    const blob = await validBackupBlob()
    const data = await mutateBackup(blob, async (zip) => {
      const manifest = JSON.parse(await (zip.file('manifest.json') as JSZip.JSZipObject).async('string')) as { counts: { documents: number } }
      manifest.counts.documents = 99
      zip.file('manifest.json', JSON.stringify(manifest))
    })
    await expect(inspectBackupArchive(data)).rejects.toMatchObject({ kind: 'invalid-data' })
  })

  it('annotation trỏ tới document không có trong backup → invalid-data (không mồ côi)', async () => {
    const blob = await validBackupBlob()
    const data = await mutateBackup(blob, async (zip) => {
      const manifest = JSON.parse(await (zip.file('manifest.json') as JSZip.JSZipObject).async('string')) as {
        annotationsFile: { path: string; sha256: string }
      }
      const annotations = JSON.parse(
        await (zip.file('data/annotations.json') as JSZip.JSZipObject).async('string'),
      ) as Array<Record<string, unknown>>
      annotations[0] = {
        ...annotations[0],
        documentId: 'khong-ton-tai',
        surfaceId: 'document:khong-ton-tai:0',
      }
      const bytes = new TextEncoder().encode(JSON.stringify(annotations))
      zip.file('data/annotations.json', bytes)
      manifest.annotationsFile.sha256 = await sha256Hex(bytes)
      zip.file('manifest.json', JSON.stringify(manifest))
    })
    await expect(inspectBackupArchive(data)).rejects.toMatchObject({ kind: 'invalid-data' })
  })

  it('contentVersion 99 trong contents → incompatible-version', async () => {
    const blob = await validBackupBlob()
    const data = await mutateBackup(blob, async (zip) => {
      const manifest = JSON.parse(await (zip.file('manifest.json') as JSZip.JSZipObject).async('string')) as {
        contentsFile: { path: string; sha256: string }
      }
      const contents = JSON.parse(
        await (zip.file('data/contents.json') as JSZip.JSZipObject).async('string'),
      ) as Array<Record<string, unknown>>
      contents[0] = { ...contents[0], contentVersion: 99 }
      const bytes = new TextEncoder().encode(JSON.stringify(contents))
      zip.file('data/contents.json', bytes)
      manifest.contentsFile.sha256 = await sha256Hex(bytes)
      zip.file('manifest.json', JSON.stringify(manifest))
    })
    await expect(inspectBackupArchive(data)).rejects.toMatchObject({ kind: 'incompatible-version' })
  })
})

describe('TASK-08C — transaction rollback và quota', () => {
  it('ghi lỗi giữa transaction → write-failed và thư viện đích giữ nguyên', async () => {
    counter += 1
    const sourceDb = createDatabase(`webscribble-08c-${counter}`)
    await buildLibrary(sourceDb)
    const { blob } = await createBackupArchive(sourceDb)
    sourceDb.close()
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())

    counter += 1
    const targetDb = createDatabase(`webscribble-08c-${counter}`)
    const target = createStorageFoundation(targetDb)
    const keeper = await target.documents.create({
      name: 'giu-nguyen.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['%PDF-1.4 keeper']),
    })
    const originalBulkPut = targetDb.documents.bulkPut.bind(targetDb.documents)
    targetDb.documents.bulkPut = (async () => {
      throw new Error('simulated mid-restore failure')
    }) as typeof targetDb.documents.bulkPut
    await expect(executeRestore(targetDb, prepared)).rejects.toMatchObject({
      kind: 'write-failed',
    })
    targetDb.documents.bulkPut = originalBulkPut
    expect(await target.documents.list()).toHaveLength(1)
    expect((await target.documents.list())[0]?.id).toBe(keeper.id)
    expect(await targetDb.annotations.count()).toBe(0)
    expect(await targetDb.documentContents.count()).toBe(0)
    targetDb.close()
  })

  it('QuotaExceededError → kind quota và dữ liệu không đổi', async () => {
    counter += 1
    const sourceDb = createDatabase(`webscribble-08c-${counter}`)
    await buildLibrary(sourceDb)
    const { blob } = await createBackupArchive(sourceDb)
    sourceDb.close()
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())

    counter += 1
    const targetDb = createDatabase(`webscribble-08c-${counter}`)
    const target = createStorageFoundation(targetDb)
    targetDb.annotations.bulkPut = (async () => {
      const error = new Error('quota exceeded')
      error.name = 'QuotaExceededError'
      throw error
    }) as typeof targetDb.annotations.bulkPut
    const error = await executeRestore(targetDb, prepared).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BackupError)
    expect((error as BackupError).kind).toBe('quota')
    // Documents bulkPut chạy TRƯỚC annotations trong cùng transaction
    // nhưng transaction đã hủy → không còn gì:
    expect(await target.documents.list()).toEqual([])
    targetDb.close()
  })

  it('TASK-07C: backup chứa nội dung version 1 (định dạng cũ) vẫn qua kiểm chứng khôi phục', async () => {
    const db = createDatabase(`webscribble-08c-v1-${Date.now()}`)
    const foundation = createStorageFoundation(db)
    const doc = await foundation.documents.create({
      name: 'cu.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx-goc'], { type: 'application/octet-stream' }),
    })
    await foundation.contents.saveContent({
      documentId: doc.id,
      contentVersion: 1,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'V1' }] }],
      } as unknown as WordDocumentContent,
      updatedAt: 1,
    })
    const archive = await createBackupArchive(db)
    const prepared = await inspectBackupArchive(await archive.blob.arrayBuffer())
    expect(prepared.summary.counts.documentContents).toBe(1)
    db.close()
  })
})
