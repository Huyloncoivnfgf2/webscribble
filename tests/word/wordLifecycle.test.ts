import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  createStorageFoundation,
  documentSurfaceId,
  DOCUMENT_CONTENT_VERSION,
  type StorageFoundation,
} from '../../src/data/index'
import { WebScribbleDatabase } from '../../src/data/database'
import {
  createBackupArchive,
  executeRestore,
  inspectBackupArchive,
} from '../../src/data/index'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import {
  convertDocxToWordContent,
  exportContentToDocx,
  importDocxToLibrary,
  validateWordContent,
  type WordDocumentContent,
} from '../../src/engines/word/index'
import { WordEditorController } from '../../src/app/features/documents/WordEditorController'
import { DocxAnnotationController } from '../../src/app/features/documents/DocxAnnotationController'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from '../drawing/fakes'
import { buildDocx, buildRichDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

function makeFoundation(tag: string) {
  const db = new WebScribbleDatabase(`webscribble-07f-${tag}-${crypto.randomUUID()}`)
  return { db, foundation: createStorageFoundation(db) }
}

/** Đọc bytes của Blob kể cả khi môi trường test trả về Blob không có arrayBuffer(). */
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer())
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(blob)
  })
  return new Uint8Array(buffer)
}

async function docxWithBody(bodyInner: string): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buildDocx({}))
  const xml = await zip.file('word/document.xml')!.async('string')
  const sect = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? ''
  const start = xml.indexOf('<w:body>') + '<w:body>'.length
  const end = xml.indexOf('</w:body>')
  zip.file('word/document.xml', xml.slice(0, start) + bodyInner + sect + xml.slice(end))
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new Uint8Array(buffer)
}

function drawStroke(element: FakeCanvasElement, y: number): void {
  element.dispatch('pointerdown', pointerEvent({ clientX: 30, clientY: y, timeStamp: 1000 }))
  element.dispatch('pointermove', pointerEvent({ clientX: 90, clientY: y + 12, timeStamp: 1016 }))
  element.dispatch('pointerup', pointerEvent({ clientX: 150, clientY: y + 6, timeStamp: 1032, buttons: 0 }))
}

describe('TASK-07F — vòng đời trọn vẹn của tài liệu Word', () => {
  it('import → sửa → chú thích → đóng/mở lại → xuất → backup → restore (môi trường sạch + remap khi trùng)', async () => {
    const options = createTestConvertOptions()
    const source = makeFoundation('src')
    const { foundation } = source

    // 1. Import:
    const richBytes = buildRichDocx()
    const { document } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: 'vong-doi.docx', data: toArrayBuffer(richBytes) },
      options,
    )
    const blobRecord = await foundation.documents.getById(document.id)
    const originalBytes = await blobBytes(blobRecord!.blob as Blob)
    expect(originalBytes).toEqual(richBytes) // Blob gốc nguyên vẹn từng byte

    // 2. Mở editor, sửa nội dung, autosave:
    const editor = new WordEditorController({ contents: foundation.contents, debounceMs: 5 })
    const opened = await editor.open(document.id)
    const current: WordDocumentContent = {
      type: 'doc',
      content: [
        ...opened.content,
        { type: 'paragraph', content: [{ type: 'text', text: 'Đoạn thêm ở TASK-07F' }] },
      ],
    }
    editor.bindEditor(() => current)
    editor.markChanged()
    await editor.flush()
    const savedContent = await foundation.contents.getContent(document.id)
    expect(JSON.stringify(savedContent?.content)).toContain('Đoạn thêm ở TASK-07F')
    expect(savedContent?.contentVersion).toBe(DOCUMENT_CONTENT_VERSION)
    await editor.close()

    // 3. Chú thích một nét rồi đóng phiên:
    const annotationEngine = createAnnotationEngine({
      annotations: foundation.annotations,
      autosave: foundation.autosave,
    })
    const scheduler = new FakeFrameScheduler()
    const anno = new DocxAnnotationController({
      annotationEngine,
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
    })
    const canvas = new FakeCanvasElement()
    await anno.open(document.id, canvas as unknown as HTMLCanvasElement)
    anno.handleResize(800, 2000)
    scheduler.runAll()
    drawStroke(canvas, 120)
    expect(anno.getObjectCount()).toBe(1)
    await anno.close()

    // 4. Mở lại bằng controller mới: cả hai lớp đều nguyên vẹn:
    const editor2 = new WordEditorController({ contents: foundation.contents, debounceMs: 5 })
    const reopened = await editor2.open(document.id)
    expect(JSON.stringify(reopened)).toContain('Đoạn thêm ở TASK-07F')
    await editor2.close()
    const annoRecord = await foundation.annotations.getSurface(documentSurfaceId(document.id, 0))
    expect(annoRecord?.objects).toHaveLength(1)

    // 5. Xuất DOCX từ nội dung đã sửa và nhập lại kiểm chứng:
    const { blob: exportedBlob } = await exportContentToDocx(reopened)
    const reimported = await convertDocxToWordContent(await exportedBlob.arrayBuffer(), options)
    expect(JSON.stringify(reimported.content)).toContain('Đoạn thêm ở TASK-07F')
    expect(JSON.stringify(reimported.content)).toContain('"textAlign":"center"')

    // 6. Backup → restore vào môi trường SẠCH:
    const { blob: backupBlob } = await createBackupArchive(source.db)
    const prepared = await inspectBackupArchive(await backupBlob.arrayBuffer())
    expect(prepared.summary.counts).toMatchObject({ documents: 1, annotations: 1, documentContents: 1 })
    const target = makeFoundation('dst')
    const report = await executeRestore(target.db, prepared)
    expect(report).toMatchObject({ importedDocuments: 1, importedAnnotations: 1, importedContents: 1, remappedDocuments: 0 })
    const restoredDocs = await target.foundation.documents.list()
    expect(restoredDocs).toHaveLength(1)
    const restoredId = restoredDocs[0].id
    const restoredBlob = await target.foundation.documents.getById(restoredId)
    expect(await blobBytes(restoredBlob!.blob as Blob)).toEqual(richBytes)
    const restoredContent = await target.foundation.contents.getContent(restoredId)
    expect(JSON.stringify(restoredContent?.content)).toContain('Đoạn thêm ở TASK-07F')
    const restoredAnno = await target.foundation.annotations.getSurface(documentSurfaceId(restoredId, 0))
    expect(restoredAnno?.objects).toEqual(annoRecord?.objects)
    target.db.close()

    // 7. Restore LẦN NỮA vào chính thư viện nguồn (trùng ID → remap):
    const prepared2 = await inspectBackupArchive(await backupBlob.arrayBuffer())
    const report2 = await executeRestore(source.db, prepared2)
    expect(report2.remappedDocuments).toBe(1)
    const allDocs = await foundation.documents.list()
    expect(allDocs).toHaveLength(2)
    const copy = allDocs.find((d) => d.id !== document.id)
    expect(copy).toBeTruthy()
    const copyContent = await foundation.contents.getContent(copy!.id)
    expect(JSON.stringify(copyContent?.content)).toContain('Đoạn thêm ở TASK-07F')
    const copyAnno = await foundation.annotations.getSurface(documentSurfaceId(copy!.id, 0))
    expect(copyAnno?.objects).toHaveLength(1)
    // Bản gốc không bị đụng:
    const originalAnno = await foundation.annotations.getSurface(documentSurfaceId(document.id, 0))
    expect(originalAnno?.objects).toHaveLength(1)
    source.db.close()
  }, 60000)

  it('đua autosave: bản sửa mới hơn thắng kể cả khi lần ghi trước kết thúc muộn', async () => {
    const { db, foundation } = makeFoundation('race')
    const { document } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: 'dua.docx', data: toArrayBuffer(buildDocx({})) },
      createTestConvertOptions(),
    )
    const realContents = foundation.contents
    const realSave = realContents.saveContent.bind(realContents)
    let releaseFirst: (() => void) | null = null
    let calls = 0
    // Ủy quyền tường minh (không spread instance — class
    // repository giữ methods trên prototype):
    const gatedContents = {
      getContent: (id: string) => realContents.getContent(id),
      saveContent: async (record: Parameters<typeof realSave>[0]) => {
        calls += 1
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
        }
        return realSave(record)
      },
      deleteContent: (id: string) => realContents.deleteContent(id),
    } as typeof foundation.contents

    const controller = new WordEditorController({
      contents: gatedContents,
      debounceMs: 5,
    })
    const base = await controller.open(document.id)
    let current: WordDocumentContent = {
      type: 'doc',
      content: [...base.content, { type: 'paragraph', content: [{ type: 'text', text: 'BAN DAU' }] }],
    }
    controller.bindEditor(() => current)
    controller.markChanged()
    const firstSave = controller.saveNow() // lần ghi 1 bị chặn ở cổng
    current = {
      type: 'doc',
      content: [...base.content, { type: 'paragraph', content: [{ type: 'text', text: 'BAN MOI NHAT' }] }],
    }
    controller.markChanged()
    const secondSave = controller.saveNow()
    await new Promise((r) => setTimeout(r, 30))
    releaseFirst?.()
    await Promise.all([firstSave, secondSave])
    await controller.flush()
    const stored = await foundation.contents.getContent(document.id)
    expect(JSON.stringify(stored?.content)).toContain('BAN MOI NHAT')
    expect(JSON.stringify(stored?.content)).not.toContain('BAN DAU')
    expect(controller.hasChanges).toBe(false)
    await controller.close()
    db.close()
  }, 60000)
})

describe('TASK-07F — kiểm tra ranh giới', () => {
  it('DOCX rỗng (body trống / một đoạn trống) nhập và xuất bình thường', async () => {
    const options = createTestConvertOptions()
    for (const body of ['', '<w:p/>']) {
      const result = await convertDocxToWordContent(
        toArrayBuffer(await docxWithBody(body)),
        options,
      )
      expect(validateWordContent(result.content).valid).toBe(true)
      expect(result.content.content).toEqual([{ type: 'paragraph' }])
      const { blob } = await exportContentToDocx(result.content)
      expect(blob.size).toBeGreaterThan(1000)
    }
  }, 30000)

  it('DOCX lớn (1500 đoạn) nhập → xuất → nhập lại đủ số đoạn', async () => {
    const options = createTestConvertOptions()
    const paragraphs = Array.from(
      { length: 1500 },
      (_, i) => `<w:p><w:r><w:t>Đoạn số ${i + 1} — nội dung kiểm tra dung lượng.</w:t></w:r></w:p>`,
    ).join('')
    const bytes = await docxWithBody(paragraphs)
    const imported = await convertDocxToWordContent(toArrayBuffer(bytes), options)
    expect(imported.content.content).toHaveLength(1500)
    const { blob } = await exportContentToDocx(imported.content)
    const reimported = await convertDocxToWordContent(await blob.arrayBuffer(), options)
    expect(reimported.content.content).toHaveLength(1500)
    expect(JSON.stringify(reimported.content)).toContain('Đoạn số 1500')
  }, 60000)

  it('Unicode đặc biệt (tiếng Việt, emoji, CJK, ký hiệu) sống sót qua import → export → import', async () => {
    const options = createTestConvertOptions()
    const text = 'Tiếng Việt đầy đủ dấu: ăâđêôơưáàảãạ — Emoji 😀🎉 — CJK 汉字日本語 — Ký hiệu ∑∫√π ≠ ≤'
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const bytes = await docxWithBody(
      `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`,
    )
    const imported = await convertDocxToWordContent(toArrayBuffer(bytes), options)
    expect(JSON.stringify(imported.content)).toContain('Tiếng Việt đầy đủ dấu')
    const { blob } = await exportContentToDocx(imported.content)
    const reimported = await convertDocxToWordContent(await blob.arrayBuffer(), options)
    const flat = JSON.stringify(reimported.content)
    expect(flat).toContain('ăâđêôơưáàảãạ')
    expect(flat).toContain('😀🎉')
    expect(flat).toContain('汉字日本語')
    expect(flat).toContain('∑∫√π')
  }, 30000)
})

// Type-only: đảm bảo StorageFoundation được dùng đúng hình dạng.
export type { StorageFoundation }
