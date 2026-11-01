import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  backgroundImageKey,
  createBackupArchive,
  createDatabase,
  createStorageFoundation,
  executeRestore,
  inspectBackupArchive,
  normalizePaperBackground,
  whiteboardPageBackgroundSlot,
  type PaperBackground,
} from '../../src/data/index'
import {
  inspectBackgroundImage,
  paperBackgroundStyle,
  MAX_BACKGROUND_IMAGE_BYTES,
} from '../../src/app/features/backgrounds/paperBackground'
import {
  parseManifest,
  WhiteboardStore,
} from '../../src/app/features/whiteboard/whiteboardStore'

/**
 * TASK-14C — Nền giấy dùng chung (DEC-035): chuẩn hóa dữ
 * liệu cũ, CSS pattern từng loại, kiểm tra ảnh, repository
 * + migration v2→v3, manifest whiteboard cũ, remap slot
 * ảnh theo trang, backup mang theo nền + tương thích
 * backup cũ.
 */

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9])
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 7,
])

function blobOf(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as BlobPart], { type })
}

describe('TASK-14C — chuẩn hóa nền (dữ liệu cũ)', () => {
  it('chuỗi whiteboard cũ ánh xạ 1-1 sang object', () => {
    for (const kind of ['blank', 'dark', 'ruled', 'grid', 'dots'] as const) {
      expect(normalizePaperBackground(kind)).toEqual({ kind })
    }
  })

  it('object hợp lệ giữ nguyên; spacing chỉ giữ khi thuộc ruled + thuộc danh sách', () => {
    expect(normalizePaperBackground({ kind: 'ruled', spacingPx: 24 })).toEqual({
      kind: 'ruled',
      spacingPx: 24,
    })
    expect(normalizePaperBackground({ kind: 'ruled', spacingPx: 99 })).toEqual({
      kind: 'ruled',
    })
    expect(normalizePaperBackground({ kind: 'grid', spacingPx: 24 })).toEqual({
      kind: 'grid',
    })
  })

  it('giá trị lạ/rác về giấy trắng, không ném lỗi', () => {
    expect(normalizePaperBackground('weird')).toEqual({ kind: 'blank' })
    expect(normalizePaperBackground({ kind: 'neon' })).toEqual({ kind: 'blank' })
    expect(normalizePaperBackground(null)).toEqual({ kind: 'blank' })
    expect(normalizePaperBackground(42)).toEqual({ kind: 'blank' })
    expect(normalizePaperBackground(undefined)).toEqual({ kind: 'blank' })
  })
})

describe('TASK-14C — CSS pattern từng loại nền', () => {
  it('trắng và bảng đen là màu đặc', () => {
    expect(paperBackgroundStyle({ kind: 'blank' }, 1).backgroundColor).toBe('#ffffff')
    expect(paperBackgroundStyle({ kind: 'dark' }, 1).backgroundColor).toBe('#1e293b')
  })

  it('kẻ dòng: chu kỳ theo spacing (mặc định 32), scale nhân đúng', () => {
    expect(paperBackgroundStyle({ kind: 'ruled' }, 1).backgroundSize).toBe('100% 32px')
    expect(paperBackgroundStyle({ kind: 'ruled', spacingPx: 24 }, 1).backgroundSize).toBe(
      '100% 24px',
    )
    expect(paperBackgroundStyle({ kind: 'ruled', spacingPx: 40 }, 2).backgroundSize).toBe(
      '100% 80px',
    )
    expect(paperBackgroundStyle({ kind: 'ruled', spacingPx: 99 }, 1).backgroundSize).toBe(
      '100% 32px',
    )
  })

  it('kẻ ô vuông và lưới chấm dùng ô 28px; chấm so le có vị trí lệch', () => {
    expect(paperBackgroundStyle({ kind: 'grid' }, 1).backgroundSize).toBe('28px 28px')
    const dotGrid = paperBackgroundStyle({ kind: 'dot-grid' }, 1)
    expect(dotGrid.backgroundImage).toContain('radial-gradient')
    expect(dotGrid.backgroundPosition).toBeUndefined()
    const dots = paperBackgroundStyle({ kind: 'dots' }, 1)
    expect(dots.backgroundPosition).toBe('0 0, 14px 14px')
  })

  it('lưới caro là conic hai tông; kẻ toán có lưới mịn + đường chính', () => {
    const graph = paperBackgroundStyle({ kind: 'graph' }, 1)
    expect(graph.backgroundImage).toContain('conic-gradient')
    const math = paperBackgroundStyle({ kind: 'math' }, 1)
    expect(math.backgroundSize).toContain('70px 70px')
    expect(math.backgroundSize).toContain('14px 14px')
  })

  it('kẻ nhạc: 5 dòng trong một ô pattern 64px', () => {
    const music = paperBackgroundStyle({ kind: 'music' }, 1)
    expect(music.backgroundSize).toBe('100% 64px')
    expect(music.backgroundImage?.match(/rgba\(100, 116, 139/g)).toHaveLength(5)
  })

  it('ảnh nền: có URL thì cover, chưa có thì nền trắng chờ', () => {
    const withUrl = paperBackgroundStyle({ kind: 'image' }, 1, 'blob:fake-url')
    expect(withUrl.backgroundImage).toContain('blob:fake-url')
    expect(withUrl.backgroundSize).toBe('cover')
    expect(paperBackgroundStyle({ kind: 'image' }, 1).backgroundImage).toBeUndefined()
  })
})

describe('TASK-14C — kiểm tra ảnh nền tải lên', () => {
  it('PNG/JPEG/WebP thật đạt', async () => {
    expect((await inspectBackgroundImage(blobOf(PNG_BYTES, 'image/png'))).ok).toBe(true)
    expect((await inspectBackgroundImage(blobOf(JPEG_BYTES, 'image/jpeg'))).ok).toBe(true)
    expect((await inspectBackgroundImage(blobOf(WEBP_BYTES, 'image/webp'))).ok).toBe(true)
  })

  it('MIME ngoài danh sách bị từ chối; đổi đuôi (MIME không khớp chữ ký) bị từ chối', async () => {
    const bmp = await inspectBackgroundImage(blobOf(PNG_BYTES, 'image/bmp'))
    expect(bmp.ok).toBe(false)
    const fake = await inspectBackgroundImage(blobOf(JPEG_BYTES, 'image/png'))
    expect(fake.ok).toBe(false)
    if (!fake.ok) expect(fake.message).toContain('không khớp')
  })

  it('quá 5MB bị từ chối; file rỗng bị từ chối', async () => {
    const big = new Blob([new Uint8Array(MAX_BACKGROUND_IMAGE_BYTES + 1)], {
      type: 'image/png',
    })
    expect((await inspectBackgroundImage(big)).ok).toBe(false)
    expect((await inspectBackgroundImage(new Blob([], { type: 'image/png' }))).ok).toBe(false)
  })
})

describe('TASK-14C — repository nền + migration v2 → v3', () => {
  it('DB đúng schema v2 mở lên v3: dữ liệu cũ nguyên vẹn, hai bảng nền dùng được, xóa tài liệu cascade cả nền + ảnh', async () => {
    const name = `webscribble-14c-mig-${crypto.randomUUID()}`
    const v2 = new Dexie(name)
    v2.version(2).stores({
      documents: 'id, createdAt, updatedAt',
      annotations: 'surfaceId, documentId',
      documentContents: 'documentId',
    })
    await v2.open()
    await v2.table('documents').add({
      id: 'doc-v2',
      name: 'cu.pdf',
      mimeType: 'application/pdf',
      size: 3,
      createdAt: 1,
      updatedAt: 1,
      pageCount: 2,
      blob: new Blob(['abc']),
    })
    await v2.table('annotations').add({
      surfaceId: 'document:doc-v2:0',
      documentId: 'doc-v2',
      pageIndex: 0,
      objects: [{ id: 'obj-1' }],
      updatedAt: 1,
      schemaVersion: 1,
    })
    v2.close()

    const db = createDatabase(name)
    const foundation = createStorageFoundation(db)
    expect(db.verno).toBe(3)
    expect((await foundation.documents.getById('doc-v2'))?.name).toBe('cu.pdf')
    expect(await foundation.annotations.getSurfacesByDocument('doc-v2')).toHaveLength(1)

    // Bảng nền mới: chưa đặt -> undefined; đặt/đọc lại đúng:
    expect(await foundation.backgrounds.get('doc-v2')).toBeUndefined()
    await foundation.backgrounds.set('doc-v2', { kind: 'ruled', spacingPx: 40 })
    expect(await foundation.backgrounds.get('doc-v2')).toEqual({
      kind: 'ruled',
      spacingPx: 40,
    })

    // Ảnh nền: khóa suy dẫn + lưu/đọc theo slot:
    await foundation.backgroundImages.put('doc-v2', 'main', blobOf(PNG_BYTES, 'image/png'))
    const image = await foundation.backgroundImages.get('doc-v2', 'main')
    expect(image?.id).toBe(backgroundImageKey('doc-v2', 'main'))
    expect(new Uint8Array(await (image as { blob: Blob }).blob.arrayBuffer())).toEqual(PNG_BYTES)
    expect(await foundation.backgroundImages.listForDocument('doc-v2')).toHaveLength(1)

    // Xóa tài liệu cascade cả nền + ảnh:
    await foundation.documents.delete('doc-v2')
    expect(await foundation.backgrounds.get('doc-v2')).toBeUndefined()
    expect(await foundation.backgroundImages.listForDocument('doc-v2')).toHaveLength(0)
    db.close()
  })
})

describe('TASK-14C — whiteboard: manifest cũ + slot ảnh theo trang', () => {
  function makeStore() {
    const db = createDatabase(`webscribble-14c-wb-${crypto.randomUUID()}`)
    const foundation = createStorageFoundation(db)
    const store = new WhiteboardStore({
      documents: foundation.documents,
      annotations: foundation.annotations,
      backgroundImages: foundation.backgroundImages,
    })
    return { db, foundation, store }
  }

  it('parseManifest đọc nền dạng chuỗi cũ (kể cả giá trị lạ -> trắng)', () => {
    const legacy = JSON.stringify({
      kind: 'webscribble-whiteboard',
      version: 1,
      pageSize: { width: 1600, height: 1000 },
      pages: [{ background: 'grid' }, { background: 'weird' }, { background: 'dots' }],
    })
    const manifest = parseManifest(legacy)
    expect(manifest.pages.map((p) => p.background)).toEqual([
      { kind: 'grid' },
      { kind: 'blank' },
      { kind: 'dots' },
    ])
  })

  it('xóa trang: slot ảnh remap theo trang còn sống; đổi sang nền không-ảnh thì slot bị dọn', async () => {
    const { db, foundation, store } = makeStore()
    const { id } = await store.create('Bang anh')
    await store.addPage(id)
    await store.addPage(id)
    const imgA = blobOf(PNG_BYTES, 'image/png')
    const imgC = blobOf(JPEG_BYTES, 'image/jpeg')
    await foundation.backgroundImages.put(id, whiteboardPageBackgroundSlot(0), imgA)
    await foundation.backgroundImages.put(id, whiteboardPageBackgroundSlot(2), imgC)
    await store.setPageBackground(id, 0, { kind: 'image' })
    await store.setPageBackground(id, 2, { kind: 'image' })

    // Xóa trang 0: ảnh C (trang 2) phải về slot trang 1,
    // ảnh A biến mất cùng trang của nó:
    await store.deletePage(id, 0)
    expect(
      await foundation.backgroundImages.get(id, whiteboardPageBackgroundSlot(0)),
    ).toBeUndefined()
    const moved = await foundation.backgroundImages.get(
      id,
      whiteboardPageBackgroundSlot(1),
    )
    expect(new Uint8Array(await (moved as { blob: Blob }).blob.arrayBuffer())).toEqual(
      JPEG_BYTES,
    )
    expect(
      await foundation.backgroundImages.get(id, whiteboardPageBackgroundSlot(2)),
    ).toBeUndefined()

    // Đổi nền trang 1 sang kẻ dòng -> slot ảnh của nó bị dọn:
    await store.setPageBackground(id, 1, { kind: 'ruled', spacingPx: 24 })
    expect(await foundation.backgroundImages.listForDocument(id)).toHaveLength(0)
    const manifest = await store.load(id)
    expect(manifest.pages[1].background).toEqual({ kind: 'ruled', spacingPx: 24 })
    db.close()
  })

  it('đổi thứ tự trang: hai slot ảnh hoán đổi theo trang', async () => {
    const { db, foundation, store } = makeStore()
    const { id } = await store.create('Bang doi cho')
    await store.addPage(id)
    await foundation.backgroundImages.put(
      id,
      whiteboardPageBackgroundSlot(0),
      blobOf(PNG_BYTES, 'image/png'),
    )
    await foundation.backgroundImages.put(
      id,
      whiteboardPageBackgroundSlot(1),
      blobOf(JPEG_BYTES, 'image/jpeg'),
    )
    await store.movePage(id, 0, 1)
    const at0 = await foundation.backgroundImages.get(id, whiteboardPageBackgroundSlot(0))
    const at1 = await foundation.backgroundImages.get(id, whiteboardPageBackgroundSlot(1))
    expect(new Uint8Array(await (at0 as { blob: Blob }).blob.arrayBuffer())).toEqual(JPEG_BYTES)
    expect(new Uint8Array(await (at1 as { blob: Blob }).blob.arrayBuffer())).toEqual(PNG_BYTES)
    db.close()
  })
})

describe('TASK-14C — backup mang theo nền + tương thích ngược', () => {
  it('backup -> restore: nền tài liệu + ảnh nền nguyên vẹn; restore lần hai (trùng ID) nền đi theo ID mới', async () => {
    const sourceDb = createDatabase(`webscribble-14c-bk-${crypto.randomUUID()}`)
    const source = createStorageFoundation(sourceDb)
    const doc = await source.documents.create({
      name: 'de.pdf',
      mimeType: 'application/pdf',
      blob: blobOf(new Uint8Array([1, 2, 3]), 'application/pdf'),
      pageCount: 1,
    })
    const background: PaperBackground = { kind: 'ruled', spacingPx: 24 }
    await source.backgrounds.set(doc.id, background)
    await source.backgroundImages.put(doc.id, 'main', blobOf(PNG_BYTES, 'image/png'))

    const { blob, manifest } = await createBackupArchive(sourceDb)
    expect(manifest.counts.backgrounds).toBe(1)
    expect(manifest.counts.backgroundImages).toBe(1)

    const targetDb = createDatabase(`webscribble-14c-bk2-${crypto.randomUUID()}`)
    const prepared = await inspectBackupArchive(await blob.arrayBuffer())
    const report = await executeRestore(targetDb, prepared)
    expect(report.importedBackgrounds).toBe(1)
    expect(report.importedBackgroundImages).toBe(1)
    const target = createStorageFoundation(targetDb)
    expect(await target.backgrounds.get(doc.id)).toEqual(background)
    const restoredImage = await target.backgroundImages.get(doc.id, 'main')
    expect(new Uint8Array(await (restoredImage as { blob: Blob }).blob.arrayBuffer())).toEqual(
      PNG_BYTES,
    )

    // Restore lại vào CHÍNH db nguồn (trùng ID -> remap):
    const prepared2 = await inspectBackupArchive(await blob.arrayBuffer())
    const report2 = await executeRestore(sourceDb, prepared2)
    expect(report2.remappedDocuments).toBe(1)
    const copies = (await source.documents.list()).filter((d) => d.id !== doc.id)
    expect(copies).toHaveLength(1)
    expect(await source.backgrounds.get(copies[0].id)).toEqual(background)
    const copyImage = await source.backgroundImages.get(copies[0].id, 'main')
    expect(copyImage?.id).toBe(backgroundImageKey(copies[0].id, 'main'))
    sourceDb.close()
    targetDb.close()
  })

  it('backup CŨ (không có backgrounds.json) vẫn kiểm chứng + khôi phục được, nền coi như chưa đặt', async () => {
    const sourceDb = createDatabase(`webscribble-14c-old-${crypto.randomUUID()}`)
    const source = createStorageFoundation(sourceDb)
    const doc = await source.documents.create({
      name: 'x.pdf',
      mimeType: 'application/pdf',
      blob: blobOf(new Uint8Array([9]), 'application/pdf'),
      pageCount: 1,
    })
    await source.backgrounds.set(doc.id, { kind: 'grid' })
    const { blob } = await createBackupArchive(sourceDb)

    // Giả lập archive của app cũ: bỏ file nền + các trường
    // nền khỏi manifest:
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    zip.remove('data/backgrounds.json')
    const manifestRaw = JSON.parse(
      await (zip.file('manifest.json') as JSZip.JSZipObject).async('string'),
    ) as Record<string, unknown>
    delete manifestRaw.backgroundsFile
    const counts = manifestRaw.counts as Record<string, unknown>
    delete counts.backgrounds
    delete counts.backgroundImages
    zip.file('manifest.json', JSON.stringify(manifestRaw))
    const oldBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })

    const prepared = await inspectBackupArchive(await oldBlob.arrayBuffer())
    expect(prepared.backgrounds).toEqual([])
    expect(prepared.backgroundImages).toEqual([])
    const targetDb = createDatabase(`webscribble-14c-old2-${crypto.randomUUID()}`)
    const report = await executeRestore(targetDb, prepared)
    expect(report.importedDocuments).toBe(1)
    expect(report.importedBackgrounds).toBe(0)
    sourceDb.close()
    targetDb.close()
  })
})
