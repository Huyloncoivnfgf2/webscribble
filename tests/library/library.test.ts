import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  QUOTA_WARNING_THRESHOLD,
  classifyStorageUsage,
  documentTypeLabel,
  formatBytes,
  sortByRecent,
} from '../../src/app/libraryModel'
import { createDatabase } from '../../src/data/database'
import {
  StorageManager,
  createStorageFoundation,
  type StorageQuotaInfo,
} from '../../src/data/index'
import { createPenStroke } from '../../src/engines/drawing/index'

/**
 * TASK-08B — kiểm thử logic thư viện + dung lượng:
 * - formatBytes / ngưỡng cảnh báo 80% / phân loại quota.
 * - StorageManager với môi trường giả: persist được cấp/từ
 *   chối/không hỗ trợ; estimate lỗi.
 * - Repository: đổi tên bền qua "reload" (đọc lại từ DB),
 *   không mất Blob/annotation; xóa cascade; thứ tự gần đây.
 */

const quotaInfo = (partial: Partial<StorageQuotaInfo>): StorageQuotaInfo => ({
  supported: true,
  quota: 1000,
  usage: 100,
  usageDetails: null,
  error: null,
  ...partial,
})

describe('TASK-08B — formatBytes', () => {
  it('định dạng B/KB/MB/GB/TB dễ đọc', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(5_242_880)).toBe('5 MB')
    expect(formatBytes(1_073_741_824)).toBe('1 GB')
    expect(formatBytes(2_199_023_255_552)).toBe('2 TB')
  })

  it('giá trị không hợp lệ → "—", không bịa số', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('nhãn loại file', () => {
    expect(documentTypeLabel('application/pdf')).toBe('PDF')
    expect(documentTypeLabel('image/png')).toBe('PNG')
    expect(documentTypeLabel('')).toBe('File')
  })
})

describe('TASK-08B — phân loại quota và ngưỡng 80%', () => {
  it('ngưỡng cảnh báo khai báo tập trung là 0.8', () => {
    expect(QUOTA_WARNING_THRESHOLD).toBe(0.8)
  })

  it('dưới ngưỡng → ok; đúng 80% và trên → warning', () => {
    expect(classifyStorageUsage(quotaInfo({ usage: 799 })).kind).toBe('ok')
    expect(classifyStorageUsage(quotaInfo({ usage: 800 })).kind).toBe('warning')
    expect(classifyStorageUsage(quotaInfo({ usage: 950 })).kind).toBe('warning')
    const over = classifyStorageUsage(quotaInfo({ usage: 1200 }))
    expect(over.kind).toBe('warning')
    if (over.kind !== 'unavailable') expect(over.percent).toBe(120)
  })

  it('API không khả dụng / lỗi / thiếu số → unavailable', () => {
    expect(classifyStorageUsage(quotaInfo({ supported: false })).kind).toBe('unavailable')
    expect(classifyStorageUsage(quotaInfo({ error: 'boom' })).kind).toBe('unavailable')
    expect(classifyStorageUsage(quotaInfo({ quota: null })).kind).toBe('unavailable')
    expect(classifyStorageUsage(quotaInfo({ usage: null })).kind).toBe('unavailable')
    expect(classifyStorageUsage(quotaInfo({ quota: 0 })).kind).toBe('unavailable')
  })
})

describe('TASK-08B — StorageManager với môi trường giả', () => {
  it('persistent: được cấp / từ chối / không hỗ trợ', async () => {
    await expect(
      new StorageManager({ persisted: async () => true }).getPersistenceState(),
    ).resolves.toBe('granted')
    await expect(
      new StorageManager({ persisted: async () => false }).getPersistenceState(),
    ).resolves.toBe('denied')
    await expect(new StorageManager({}).getPersistenceState()).resolves.toBe('unsupported')
    await expect(
      new StorageManager({
        persisted: async () => {
          throw new Error('nope')
        },
      }).getPersistenceState(),
    ).resolves.toBe('unsupported')
  })

  it('requestPersistence trả trạng thái sau khi xin', async () => {
    await expect(
      new StorageManager({ persist: async () => true }).requestPersistence(),
    ).resolves.toBe('granted')
    await expect(
      new StorageManager({ persist: async () => false }).requestPersistence(),
    ).resolves.toBe('denied')
    await expect(new StorageManager({}).requestPersistence()).resolves.toBe('unsupported')
  })

  it('estimate lỗi → classify ra unavailable (không crash, không số giả)', async () => {
    const manager = new StorageManager({
      estimate: async () => {
        throw new Error('estimate failed')
      },
    })
    const info = await manager.estimate()
    expect(info.error).not.toBeNull()
    expect(classifyStorageUsage(info).kind).toBe('unavailable')
  })
})

let counter = 0
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

describe('TASK-08B — repository: đổi tên / gần đây / cascade', () => {
  it('đổi tên bền qua reload, không mất Blob và annotation', async () => {
    counter += 1
    const db = createDatabase(`webscribble-08b-${counter}`)
    const foundation = createStorageFoundation(db)
    const blob = new Blob(['%PDF-fake-bytes'], { type: 'application/pdf' })
    const doc = await foundation.documents.create({
      name: 'ten-cu.pdf',
      mimeType: 'application/pdf',
      blob,
    })
    // Gắn một annotation cho tài liệu:
    const surfaceId = `document:${doc.id}:0`
    await foundation.annotations.saveSurface({
      surfaceId,
      documentId: doc.id,
      pageIndex: 0,
      objects: [
        createPenStroke({
          surfaceId,
          points: [
            { x: 1, y: 2, pressure: 0.5, time: 0 },
            { x: 3, y: 4, pressure: 0.5, time: 5 },
          ],
        }),
      ],
    })

    const renamed = await foundation.documents.updateMetadata(doc.id, { name: 'ten-moi.pdf' })
    expect(renamed?.name).toBe('ten-moi.pdf')

    // "Reload": đọc lại qua một foundation mới trên cùng DB:
    const foundation2 = createStorageFoundation(db)
    const after = await foundation2.documents.getById(doc.id)
    expect(after?.name).toBe('ten-moi.pdf')
    const blobAfter = await foundation2.documents.getBlob(doc.id)
    expect(blobAfter?.size).toBe(blob.size)
    expect(await blobAfter?.text()).toBe('%PDF-fake-bytes')
    const surfaces = await foundation2.annotations.getSurfacesByDocument(doc.id)
    expect(surfaces).toHaveLength(1)
    expect(surfaces[0]?.objects).toHaveLength(1)
  })

  it('đổi tên rỗng ở tầng repository vẫn là việc của UI chặn — repository giữ nguyên tên khi không truyền name', async () => {
    counter += 1
    const foundation = createStorageFoundation(createDatabase(`webscribble-08b-${counter}`))
    const doc = await foundation.documents.create({
      name: 'giu-nguyen.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['x']),
    })
    const updated = await foundation.documents.updateMetadata(doc.id, { pageCount: 7 })
    expect(updated?.name).toBe('giu-nguyen.pdf')
    expect(updated?.pageCount).toBe(7)
  })

  it('thứ tự gần đây theo updatedAt: tài liệu vừa cập nhật lên đầu', async () => {
    counter += 1
    const foundation = createStorageFoundation(createDatabase(`webscribble-08b-${counter}`))
    const a = await foundation.documents.create({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['a']),
    })
    await sleep(5)
    const b = await foundation.documents.create({
      name: 'b.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['b']),
    })
    await sleep(5)
    // Đổi tên A → updatedAt của A mới nhất:
    await foundation.documents.updateMetadata(a.id, { name: 'a-doi-ten.pdf' })
    const sorted = sortByRecent(await foundation.documents.list())
    expect(sorted.map((d) => d.id)).toEqual([a.id, b.id])
    expect(sorted[0]?.name).toBe('a-doi-ten.pdf')
  })

  it('xóa tài liệu vẫn cascade sạch annotation', async () => {
    counter += 1
    const db = createDatabase(`webscribble-08b-${counter}`)
    const foundation = createStorageFoundation(db)
    const doc = await foundation.documents.create({
      name: 'xoa.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['x']),
    })
    await foundation.annotations.saveSurface({
      surfaceId: `document:${doc.id}:0`,
      documentId: doc.id,
      pageIndex: 0,
      objects: [],
    })
    await foundation.documents.delete(doc.id)
    expect(await foundation.annotations.getSurfacesByDocument(doc.id)).toEqual([])
    expect(await foundation.documents.getById(doc.id)).toBeUndefined()
  })
})
