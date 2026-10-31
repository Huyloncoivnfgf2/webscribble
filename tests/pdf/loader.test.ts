/**
 * TASK-06A — PDF Document Loader trên PDF.js thật (bản legacy trong
 * Node qua alias của vitest.config.ts) với fixtures sinh bằng code:
 * mở/metadata/trang, vòng đời đóng–mở, hủy loading, và phân loại
 * lỗi (không phải PDF, hỏng, mật khẩu).
 */
import { describe, expect, it } from 'vitest'
import {
  PdfLoadError,
  PdfPageIndexError,
  openPdfDocument,
} from '../../src/engines/pdf/index'
import { buildCorruptPdf, buildNotAPdf, buildPdf } from './fixtures'

const FULL_INFO = {
  title: 'Đề thi Hóa học',
  author: 'Nguyen Van A',
  subject: 'HSA Chemistry',
  creator: 'WebScribble Fixture Studio',
  producer: 'WebScribble Tests',
}

describe('PdfLoader — mở và metadata', () => {
  it('PDF 1 trang: pageCount và kích thước trang đúng (612x792, rotation 0)', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    expect(handle.pageCount).toBe(1)
    expect(handle.closed).toBe(false)
    const page = await handle.getPage(0)
    expect(page).toEqual({ index: 0, width: 612, height: 792, rotation: 0 })
    await handle.close()
  })

  it('PDF nhiều trang kèm metadata đầy đủ: đọc đúng từng trường + phiên bản PDF', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 3, info: FULL_INFO }))
    expect(handle.metadata.pageCount).toBe(3)
    expect(handle.metadata.title).toBe(FULL_INFO.title)
    expect(handle.metadata.author).toBe(FULL_INFO.author)
    expect(handle.metadata.subject).toBe(FULL_INFO.subject)
    expect(handle.metadata.creator).toBe(FULL_INFO.creator)
    expect(handle.metadata.producer).toBe(FULL_INFO.producer)
    expect(handle.metadata.pdfVersion).toBe('1.4')
    await handle.close()
  })

  it('PDF không có metadata: các trường là null (không bịa giá trị)', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 2 }))
    expect(handle.metadata.title).toBeNull()
    expect(handle.metadata.author).toBeNull()
    expect(handle.metadata.subject).toBeNull()
    expect(handle.metadata.creator).toBeNull()
    expect(handle.metadata.producer).toBeNull()
    await handle.close()
  })

  it('PDF 120 trang: đọc đúng số trang và lấy được trang cuối', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 120 }))
    expect(handle.pageCount).toBe(120)
    const last = await handle.getPage(119)
    expect(last.index).toBe(119)
    await handle.close()
  })

  it('mở từ Blob: hoạt động và Blob gốc vẫn đọc lại được sau đó', async () => {
    const bytes = buildPdf({ pageCount: 2 })
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const handle = await openPdfDocument(blob)
    expect(handle.pageCount).toBe(2)
    await handle.close()
    expect(await blob.text()).toBe(new TextDecoder().decode(bytes))
  })

  it('mở từ ArrayBuffer/Uint8Array của caller: buffer của caller KHÔNG bị detach sau khi mở', async () => {
    const bytes = buildPdf({ pageCount: 2 })
    const view = new Uint8Array(bytes)
    const handle = await openPdfDocument(view)
    expect(handle.pageCount).toBe(2)
    await handle.close()
    expect(view.byteLength).toBe(bytes.length) // còn nguyên — loader đã sao chép trước khi giao PDF.js
    expect(view[0]).toBe(0x25) // '%'
  })
})

describe('PdfLoader — getPage và index', () => {
  it('index ngoài phạm vi: -1 và pageCount đều ném PdfPageIndexError', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 3 }))
    await expect(handle.getPage(-1)).rejects.toBeInstanceOf(PdfPageIndexError)
    await expect(handle.getPage(3)).rejects.toBeInstanceOf(PdfPageIndexError)
    await expect(handle.getPage(1.5)).rejects.toBeInstanceOf(PdfPageIndexError)
    await handle.close()
  })

  it('getNativePage trả cùng một trang đã cache cho cùng index', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 2 }))
    const first = await handle.getNativePage(0)
    const second = await handle.getNativePage(0)
    expect(first).toBe(second)
    await handle.close()
  })
})

describe('PdfLoader — vòng đời', () => {
  it('đóng tài liệu: closed = true; thao tác sau đóng ném PdfLoadError kind closed; đóng lại lần nữa an toàn', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    await handle.close()
    expect(handle.closed).toBe(true)
    await expect(handle.getPage(0)).rejects.toMatchObject({ kind: 'closed' })
    await expect(handle.close()).resolves.toBeUndefined()
  })

  it('mở–đóng liên tục 5 lần với cùng dữ liệu: mọi lần đều thành công (không rò rỉ làm hỏng lần sau)', async () => {
    const bytes = buildPdf({ pageCount: 4 })
    for (let i = 0; i < 5; i += 1) {
      const handle = await openPdfDocument(new Uint8Array(bytes))
      expect(handle.pageCount).toBe(4)
      await handle.close()
    }
  })

  it('mở đồng thời hai tài liệu khác nhau: độc lập, đóng một cái không ảnh hưởng cái còn lại', async () => {
    const a = await openPdfDocument(buildPdf({ pageCount: 1 }))
    const b = await openPdfDocument(buildPdf({ pageCount: 7 }))
    await a.close()
    expect(b.closed).toBe(false)
    expect((await b.getPage(6)).index).toBe(6)
    await b.close()
  })
})

describe('PdfLoader — hủy loading', () => {
  it('AbortSignal đã hủy từ trước: ném kind cancelled ngay, không mở tài liệu', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      openPdfDocument(buildPdf({ pageCount: 120 }), { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'cancelled' })
  })

  it('hủy NGAY trong lúc đang mở tài liệu 120 trang: kết quả là cancelled (không phải handle sống sót)', async () => {
    const controller = new AbortController()
    const pending = openPdfDocument(buildPdf({ pageCount: 120 }), { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
  })
})

describe('PdfLoader — phân loại lỗi', () => {
  it('file không phải PDF → kind not-a-pdf', async () => {
    await expect(openPdfDocument(buildNotAPdf())).rejects.toMatchObject({ kind: 'not-a-pdf' })
    await expect(openPdfDocument(new Uint8Array(0))).rejects.toMatchObject({ kind: 'not-a-pdf' })
  })

  it('PDF bị cắt cụt (hỏng cấu trúc) → kind corrupt', async () => {
    const error = await openPdfDocument(buildCorruptPdf()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfLoadError)
    expect((error as PdfLoadError).kind).toBe('corrupt')
  })

  it('PDF có mật khẩu người dùng → kind password (chỉ phát hiện, chưa mở khóa)', async () => {
    const encrypted = buildPdf({ pageCount: 2, userPassword: 'secret', info: { title: 'Locked' } })
    const error = await openPdfDocument(encrypted).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfLoadError)
    expect((error as PdfLoadError).kind).toBe('password')
  })

  it('mọi lỗi đều là PdfLoadError và giữ cause gốc', async () => {
    const error = await openPdfDocument(buildCorruptPdf()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfLoadError)
    expect((error as PdfLoadError).cause).toBeDefined()
  })
})
