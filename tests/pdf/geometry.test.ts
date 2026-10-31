/**
 * TASK-06B — Page Geometry trên PDF.js THẬT (fixtures sinh bằng
 * code): kích thước tại scale 1/2, scale không hợp lệ, trang xoay,
 * và lỗi index/đóng tài liệu truyền từ loader.
 */
import { describe, expect, it } from 'vitest'
import {
  PdfPageIndexError,
  PdfLoadError,
  PdfRenderError,
  getPdfPageGeometry,
  openPdfDocument,
} from '../../src/engines/pdf/index'
import { buildPdf } from './fixtures'

describe('PdfGeometry', () => {
  it('scale 1: pageWidth/pageHeight và viewport đều 612x792 (khớp PDF.js)', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 2 }))
    const geometry = await getPdfPageGeometry(handle, 1, 1)
    expect(geometry.index).toBe(1)
    expect(geometry.pageWidth).toBe(612)
    expect(geometry.pageHeight).toBe(792)
    expect(geometry.viewportWidth).toBe(612)
    expect(geometry.viewportHeight).toBe(792)
    expect(geometry.rotation).toBe(0)
    expect(geometry.viewport.width).toBe(612) // viewport native đi kèm cho TASK-06D
    await handle.close()
  })

  it('scale 2: viewport gấp đôi, kích thước trang gốc không đổi', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    const geometry = await getPdfPageGeometry(handle, 0, 2)
    expect(geometry.viewportWidth).toBe(1224)
    expect(geometry.viewportHeight).toBe(1584)
    expect(geometry.pageWidth).toBe(612)
    expect(geometry.pageHeight).toBe(792)
    expect(geometry.scale).toBe(2)
    await handle.close()
  })

  it('scale mặc định là 1 khi không truyền', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    const geometry = await getPdfPageGeometry(handle, 0)
    expect(geometry.scale).toBe(1)
    expect(geometry.viewportWidth).toBe(612)
    await handle.close()
  })

  it('scale không hợp lệ (0, âm, NaN, Infinity) → PdfRenderError invalid-argument', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const error = await getPdfPageGeometry(handle, 0, bad).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(PdfRenderError)
      expect((error as PdfRenderError).kind).toBe('invalid-argument')
    }
    await handle.close()
  })

  it('trang xoay 90 độ: rotation = 90 và viewport hoán đổi rộng/cao theo PDF.js', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1, rotation: 90 }))
    const geometry = await getPdfPageGeometry(handle, 0, 1)
    expect(geometry.rotation).toBe(90)
    expect(geometry.pageWidth).toBe(792)
    expect(geometry.pageHeight).toBe(612)
    await handle.close()
  })

  it('index ngoài phạm vi → PdfPageIndexError của loader (không bị gói lại)', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    await expect(getPdfPageGeometry(handle, 5)).rejects.toBeInstanceOf(PdfPageIndexError)
    await handle.close()
  })

  it('tài liệu đã đóng → PdfLoadError kind closed của loader', async () => {
    const handle = await openPdfDocument(buildPdf({ pageCount: 1 }))
    await handle.close()
    await expect(getPdfPageGeometry(handle, 0)).rejects.toMatchObject({ kind: 'closed' })
    expect(handle.closed).toBe(true)
    void (0 as unknown as PdfLoadError) // giữ tham chiếu type cho rõ ý đồ test
  })
})
