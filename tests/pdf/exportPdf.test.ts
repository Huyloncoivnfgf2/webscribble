import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFRawStream, PDFArray, decodePDFRawStream, type PDFPage } from 'pdf-lib'
import {
  flattenPdfAnnotations,
  PdfExportError,
} from '../../src/engines/pdf/index'
import type { DrawingObject, PenStrokeObject } from '../../src/engines/drawing/index'
import { buildPdf } from './fixtures'
import { FakeContext2D } from '../drawing/fakes'

const PAGE_W = 612
const PAGE_H = 792

function makeStroke(overrides: Partial<PenStrokeObject> = {}): PenStrokeObject {
  return {
    id: 'stroke-1',
    surfaceId: 'document:doc:0',
    type: 'pen',
    points: [
      { x: 100, y: 100, pressure: 0.5, time: 0 },
      { x: 200, y: 100, pressure: 0.5, time: 16 },
      { x: 300, y: 100, pressure: 0.5, time: 32 },
    ],
    style: { color: '#FF0000', size: 4, opacity: 1 },
    bounds: { minX: 100, minY: 100, maxX: 300, maxY: 100 },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

/** Giải nén content stream của một trang pdf-lib thành chuỗi. */
function pageContentText(page: PDFPage): string {
  const contents = page.node.Contents()
  const streams: PDFRawStream[] = []
  if (contents instanceof PDFRawStream) streams.push(contents)
  else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const entry = page.doc.context.lookup(contents.get(i))
      if (entry instanceof PDFRawStream) streams.push(entry)
    }
  }
  const decoder = new TextDecoder('latin1')
  return streams.map((s) => decoder.decode(decodePDFRawStream(s).decode())).join('\n')
}

/** Mọi cặp (x, y) đứng trước toán tử path m/l trong content stream. */
function pathPoints(content: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  const regex = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+[ml]\b/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) })
  }
  return points
}

describe('TASK-09 — flattenPdfAnnotations (vector)', () => {
  it('nhúng nét bút thành path vector trong PDF mới; file gốc không đổi', async () => {
    const original = buildPdf({ pageCount: 3 })
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map([[0, [makeStroke()]]]),
      mode: 'vector',
      pageScope: 'all',
    })
    expect(result.outputPageCount).toBe(3)
    expect(result.flattenedPages).toEqual([0])
    const out = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()))
    expect(out.getPageCount()).toBe(3)
    const content = pageContentText(out.getPage(0))
    expect(content).toContain('1 0 0 rg') // màu đỏ của nét
    const points = pathPoints(content)
    expect(points.length).toBeGreaterThan(4)
    // Trang gốc không có path nào ở trang 2:
    expect(pathPoints(pageContentText(out.getPage(1)))).toHaveLength(0)
    // File gốc vẫn nguyên vẹn (3 trang, không có màu đỏ):
    const originalDoc = await PDFDocument.load(original)
    expect(pageContentText(originalDoc.getPage(0))).not.toContain('1 0 0 rg')
  })

  it('TOẠ ĐỘ: outline trên file xuất nằm đúng vùng world (100..300, ~100) của trang 612×792', async () => {
    const original = buildPdf({ pageCount: 1 })
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map([[0, [makeStroke()]]]),
      mode: 'vector',
      pageScope: 'all',
    })
    const out = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()))
    const points = pathPoints(pageContentText(out.getPage(0)))
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    // path space của drawSvgPath: x = pdf.x (100..300),
    // y = cropHeight − pdf.y; pdf.y của world y=100 là
    // 792−100=692 → path y ≈ 100 (± bán kính nét ~2-4):
    expect(Math.min(...xs)).toBeGreaterThan(94)
    expect(Math.max(...xs)).toBeLessThan(306)
    expect(Math.min(...ys)).toBeGreaterThan(92)
    expect(Math.max(...ys)).toBeLessThan(108)
    void PAGE_W
    void PAGE_H
  })

  it('phạm vi annotated-only: chỉ xuất các trang có chú thích', async () => {
    const original = buildPdf({ pageCount: 3 })
    const progress: Array<[number, number]> = []
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map([[1, [makeStroke()]]]),
      mode: 'vector',
      pageScope: 'annotated-only',
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(result.outputPageCount).toBe(1)
    expect(result.flattenedPages).toEqual([1])
    expect(progress).toEqual([[1, 1]])
    const out = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()))
    expect(pathPoints(pageContentText(out.getPage(0))).length).toBeGreaterThan(4)
  })

  it('không có chú thích nào: vẫn xuất được bản sao hợp lệ, không trang nào bị flatten', async () => {
    const original = buildPdf({ pageCount: 2 })
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map(),
      mode: 'vector',
      pageScope: 'all',
    })
    expect(result.outputPageCount).toBe(2)
    expect(result.flattenedPages).toEqual([])
    expect(result.blob.size).toBeGreaterThan(200)
  })

  it('dữ liệu hỏng bị từ chối bằng PdfExportError', async () => {
    await expect(
      flattenPdfAnnotations({
        pdfData: new TextEncoder().encode('khong phai pdf').buffer as ArrayBuffer,
        annotationsByPage: new Map(),
        mode: 'vector',
        pageScope: 'all',
      }),
    ).rejects.toMatchObject({ kind: 'not-a-pdf' })
    await expect(
      flattenPdfAnnotations({
        pdfData: new TextEncoder().encode('%PDF-1.4 noi dung rac').buffer as ArrayBuffer,
        annotationsByPage: new Map(),
        mode: 'vector',
        pageScope: 'all',
      }),
    ).rejects.toBeInstanceOf(PdfExportError)
  })
})

describe('TASK-09 — flattenPdfAnnotations (raster)', () => {
  it('nhúng ảnh PNG phủ trang chứa nét vẽ (vẽ bằng drawObject của Drawing Engine)', async () => {
    const original = buildPdf({ pageCount: 2 })
    const tinyPng = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    )
    let capturedSize = { width: 0, height: 0 }
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map([[0, [makeStroke()]]]),
      mode: 'raster',
      pageScope: 'all',
      rasterScale: 2,
      createCanvas: (width, height) => {
        capturedSize = { width, height }
        return {
          width,
          height,
          getContext: () => new FakeContext2D() as never,
          toBlob: (callback: (blob: Blob | null) => void) => {
            callback(new Blob([tinyPng.buffer as ArrayBuffer], { type: 'image/png' }))
          },
        }
      },
    })
    expect(result.flattenedPages).toEqual([0])
    // Canvas raster đúng tỉ lệ trang × scale:
    expect(capturedSize).toEqual({ width: PAGE_W * 2, height: PAGE_H * 2 })
    const out = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()))
    const content = pageContentText(out.getPage(0))
    expect(content).toContain(' Do') // toán tử vẽ ảnh XObject
    expect(out.getPageCount()).toBe(2)
  })
})

describe('TASK-09 — hình khối và chữ (vector)', () => {
  it('rectangle + line được nhúng; chữ ngoài WinAnsi bị bỏ kèm cảnh báo', async () => {
    const original = buildPdf({ pageCount: 1 })
    const rectangle: DrawingObject = {
      id: 'rect-1',
      surfaceId: 'document:doc:0',
      type: 'rectangle',
      start: { x: 50, y: 50 },
      end: { x: 250, y: 150 },
      style: { strokeColor: '#2563EB', strokeWidth: 3, fillColor: null, opacity: 1 },
      bounds: { minX: 50, minY: 50, maxX: 250, maxY: 150 },
      createdAt: 1,
      updatedAt: 1,
    }
    const vietnameseText: DrawingObject = {
      id: 'text-1',
      surfaceId: 'document:doc:0',
      type: 'text',
      position: { x: 60, y: 200 },
      text: 'Ghi chú tiếng Việt',
      width: 200,
      height: 24,
      style: { color: '#111827', fontSize: 16, fontFamily: 'sans-serif' },
      bounds: { minX: 60, minY: 200, maxX: 260, maxY: 224 },
      createdAt: 1,
      updatedAt: 1,
    }
    const result = await flattenPdfAnnotations({
      pdfData: original.slice().buffer as ArrayBuffer,
      annotationsByPage: new Map([[0, [rectangle, vietnameseText]]]),
      mode: 'vector',
      pageScope: 'all',
    })
    expect(result.flattenedPages).toEqual([0])
    expect(result.warnings.some((w) => w.includes('ký tự'))).toBe(true)
    const out = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()))
    const content = pageContentText(out.getPage(0))
    // pdf-lib mã hóa rectangle bằng ma trận tịnh tiến tới
    // góc dưới-trái (50, 792−150=642) + path 200×100:
    expect(content).toContain('1 0 0 1 50 642 cm')
    expect(content).toContain('200 100 l')
  })
})
