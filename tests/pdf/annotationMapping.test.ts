/**
 * TASK-06D — Coordinate mapping trên PageViewport THẬT của PDF.js
 * với fixture có /Rotate 0/90/180/270: kiểm các điểm cụ thể (góc
 * trang, tâm trang, điểm tùy ý), round-trip hai chiều, scale, DPR
 * và bất biến dữ liệu gốc. PDF.js là nguồn sự thật cho các phép
 * chuyển đổi PDF user space.
 */
import { describe, expect, it } from 'vitest'
import {
  createPdfAnnotationMapping,
  openPdfDocument,
  type PdfAnnotationMapping,
} from '../../src/engines/pdf/index'
import { buildPdf } from './fixtures'

const W = 612
const H = 792

async function mappingFor(rotation: number, scale = 1, dpr = 1): Promise<PdfAnnotationMapping> {
  const handle = await openPdfDocument(buildPdf({ pageCount: 1, rotation }))
  const page = await handle.getNativePage(0)
  const mapping = createPdfAnnotationMapping(page.getViewport({ scale }), { devicePixelRatio: dpr })
  await handle.close()
  return mapping
}

function closeTo(actual: { x: number; y: number }, x: number, y: number) {
  expect(actual.x).toBeCloseTo(x, 6)
  expect(actual.y).toBeCloseTo(y, 6)
}

describe('PdfAnnotationMapping — world ↔ viewport ↔ canvas', () => {
  it('scale 1, DPR 1: world = viewport = canvas cho mọi điểm', async () => {
    const m = await mappingFor(0, 1, 1)
    closeTo(m.worldToViewportPoint({ x: 100, y: 50 }), 100, 50)
    closeTo(m.worldToCanvasPoint({ x: 100, y: 50 }), 100, 50)
    closeTo(m.viewportToWorldPoint({ x: 100, y: 50 }), 100, 50)
  })

  it('scale 2: viewport gấp đôi world; canvas gấp đôi viewport khi DPR 2 (tổng x4, không nhân trùng)', async () => {
    const m = await mappingFor(0, 2, 2)
    closeTo(m.worldToViewportPoint({ x: 100, y: 50 }), 200, 100)
    closeTo(m.viewportToCanvasPoint({ x: 200, y: 100 }), 400, 200)
    closeTo(m.worldToCanvasPoint({ x: 100, y: 50 }), 400, 200)
    closeTo(m.canvasToWorldPoint({ x: 400, y: 200 }), 100, 50)
    expect(m.pageWidth).toBe(W)
    expect(m.viewportWidth).toBe(W * 2)
  })

  it('round-trip world → viewport → world và world → canvas → world chính xác ở scale 1.5, DPR 2', async () => {
    const m = await mappingFor(0, 1.5, 2)
    for (const p of [{ x: 0, y: 0 }, { x: 306, y: 396 }, { x: 612, y: 792 }, { x: 123.4, y: 567.8 }]) {
      closeTo(m.viewportToWorldPoint(m.worldToViewportPoint(p)), p.x, p.y)
      closeTo(m.canvasToWorldPoint(m.worldToCanvasPoint(p)), p.x, p.y)
    }
  })

  it('không thay đổi object điểm đầu vào', async () => {
    const m = await mappingFor(90, 2, 2)
    const p = { x: 10, y: 20 }
    m.worldToPdfPoint(p)
    m.pdfToWorldPoint(p)
    m.worldToCanvasPoint(p)
    expect(p).toEqual({ x: 10, y: 20 })
  })
})

describe('PdfAnnotationMapping — PDF user space ↔ world theo rotation (điểm cụ thể)', () => {
  it('rotation 0: pdf (0,0) dưới-trái → world (0,H); pdf (0,H) trên-trái → world (0,0); tâm trùng tâm', async () => {
    const m = await mappingFor(0)
    expect(m.rotation).toBe(0)
    closeTo(m.pdfToWorldPoint({ x: 0, y: 0 }), 0, H)
    closeTo(m.pdfToWorldPoint({ x: 0, y: H }), 0, 0)
    closeTo(m.pdfToWorldPoint({ x: W, y: 0 }), W, H)
    closeTo(m.pdfToWorldPoint({ x: W / 2, y: H / 2 }), W / 2, H / 2)
    closeTo(m.worldToPdfPoint({ x: 0, y: 0 }), 0, H)
  })

  it('rotation 90: khung hiển thị 792x612; pdf (0,0) → world (0,0); pdf (0,H) → world (792,0); tâm pdf → tâm world', async () => {
    const m = await mappingFor(90)
    expect(m.rotation).toBe(90)
    expect(m.pageWidth).toBe(H)
    expect(m.pageHeight).toBe(W)
    closeTo(m.pdfToWorldPoint({ x: 0, y: 0 }), 0, 0)
    closeTo(m.pdfToWorldPoint({ x: 0, y: H }), H, 0)
    closeTo(m.pdfToWorldPoint({ x: W, y: 0 }), 0, W)
    closeTo(m.pdfToWorldPoint({ x: W, y: H }), H, W)
    closeTo(m.pdfToWorldPoint({ x: W / 2, y: H / 2 }), H / 2, W / 2)
  })

  it('rotation 180: pdf (0,0) dưới-trái → world (W,0) trên-phải; pdf (W,H) → world (0,H); tâm không đổi', async () => {
    const m = await mappingFor(180)
    expect(m.pageWidth).toBe(W)
    closeTo(m.pdfToWorldPoint({ x: 0, y: 0 }), W, 0)
    closeTo(m.pdfToWorldPoint({ x: W, y: H }), 0, H)
    closeTo(m.pdfToWorldPoint({ x: W / 2, y: H / 2 }), W / 2, H / 2)
  })

  it('rotation 270: khung hiển thị 792x612; pdf (0,0) → world (792,612); pdf (W,H) → world (0,0)', async () => {
    const m = await mappingFor(270)
    expect(m.pageWidth).toBe(H)
    closeTo(m.pdfToWorldPoint({ x: 0, y: 0 }), H, W)
    closeTo(m.pdfToWorldPoint({ x: W, y: H }), 0, 0)
    closeTo(m.pdfToWorldPoint({ x: W / 2, y: H / 2 }), H / 2, W / 2)
  })

  it('mọi rotation: bốn góc pdf ánh xạ thành đúng bốn góc world (tập hợp) và round-trip pdf ↔ world chính xác', async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const m = await mappingFor(rotation, 2, 1)
      const pdfCorners = [
        { x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: H }, { x: W, y: H },
      ]
      const worldCorners = pdfCorners.map((p) => m.pdfToWorldPoint(p))
      const expected = [
        { x: 0, y: 0 }, { x: m.pageWidth, y: 0 },
        { x: 0, y: m.pageHeight }, { x: m.pageWidth, y: m.pageHeight },
      ]
      for (const corner of expected) {
        expect(
          worldCorners.some((c) => Math.abs(c.x - corner.x) < 1e-6 && Math.abs(c.y - corner.y) < 1e-6),
        ).toBe(true)
      }
      for (const p of [...pdfCorners, { x: 100, y: 200 }, { x: 555, y: 111 }]) {
        closeTo(m.worldToPdfPoint(m.pdfToWorldPoint(p)), p.x, p.y)
        closeTo(m.pdfToWorldPoint(m.worldToPdfPoint(p)), p.x, p.y)
      }
    }
  })
})
