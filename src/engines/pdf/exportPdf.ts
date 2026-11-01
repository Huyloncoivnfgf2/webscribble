import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { PDFPageProxy } from 'pdfjs-dist'
import {
  arrowHeadLength,
  arrowHeadPoints,
  drawObject,
  isStrokeObject,
  strokeOutlinePoints,
  strokeProfile,
  type CanvasContextLike,
  type DrawingObject,
  type Point,
  type ShapeObject,
  type StrokeObject,
  type TextObject,
} from '../drawing/index'
import { createPdfAnnotationMapping } from './annotationMapping'
import { openPdfDocument } from './loader'
import { PdfLoadError } from './errors'

/**
 * PDF Export Engine (TASK-09, DEC-017/DEC-033): làm phẳng
 * (flatten) annotation của Drawing Engine lên file PDF
 * gốc bằng pdf-lib — hoàn toàn client-side, file gốc
 * không bao giờ bị ghi đè (mọi thứ diễn ra trên bản sao
 * trong RAM, kết quả là một Blob mới để tải xuống).
 *
 * ÁNH XẠ TỌA ĐỘ (điểm mấu chốt): DrawingObject của một
 * trang PDF sống trong hệ WORLD = khung trang đã hiển
 * thị tại scale 1 (gốc trên-trái, đơn vị = điểm PDF).
 * Mọi chuyển đổi world → PDF user space (gốc dưới-trái,
 * y hướng lên) đi qua `convertToPdfPoint` của chính
 * PageViewport (PDF.js) thông qua
 * createPdfAnnotationMapping — cùng một đường mà
 * overlay hiển thị dùng, nên vị trí trên file xuất
 * khớp 1:1 với vị trí trên màn hình ở mọi rotation.
 * Điểm PDF.js trả về tính theo gốc của CropBox; khi
 * vẽ bằng pdf-lib (user space gốc MediaBox) phải
 * cộng thêm offset CropBox.
 *
 * Hai chế độ:
 * - 'vector': nét bút/highlight → đa giác outline của
 *   perfect-freehand (cùng hàm strokeOutlinePoints mà
 *   CanvasRenderer dùng) vẽ bằng drawSvgPath; hình
 *   khối → primitive vector của pdf-lib; chữ → drawText
 *   (Helvetica chuẩn — ký tự ngoài WinAnsi bị bỏ kèm
 *   cảnh báo).
 * - 'raster': annotation của trang được vẽ bằng chính
 *   các hàm drawObject của Drawing Engine lên canvas
 *   ở tỉ lệ lớn (mặc định 3×) rồi nhúng thành ảnh PNG
 *   phủ trang — dự phòng khi cần độ trung thực pixel.
 */

export type PdfFlattenMode = 'vector' | 'raster'
export type PdfPageScope = 'all' | 'annotated-only'

export interface PdfExportCanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): CanvasContextLike | null
  toBlob(callback: (blob: Blob | null) => void, type: string): void
}

export interface FlattenPdfInput {
  /** Bytes của file PDF gốc (không bị sửa). */
  pdfData: ArrayBuffer | Uint8Array
  /** Annotation theo chỉ số trang zero-based. */
  annotationsByPage: ReadonlyMap<number, readonly DrawingObject[]>
  mode: PdfFlattenMode
  pageScope: PdfPageScope
  /** Hệ số phóng cho chế độ raster (mặc định 3). */
  rasterScale?: number
  /** Tạo canvas (mặc định document.createElement) — tiêm cho test. */
  createCanvas?: (width: number, height: number) => PdfExportCanvasLike
  onProgress?: (donePages: number, totalPages: number) => void
}

export interface FlattenPdfResult {
  blob: Blob
  /** Chỉ số trang (của file GỐC) đã được làm phẳng. */
  flattenedPages: number[]
  /** Tổng số trang của file xuất. */
  outputPageCount: number
  warnings: string[]
}

export class PdfExportError extends Error {
  readonly kind: 'not-a-pdf' | 'corrupt' | 'export-failed'
  readonly userMessage: string
  constructor(kind: 'not-a-pdf' | 'corrupt' | 'export-failed', cause?: unknown) {
    const userMessage =
      kind === 'not-a-pdf'
        ? 'File nguồn không phải là tài liệu PDF hợp lệ.'
        : kind === 'corrupt'
          ? 'File PDF bị hỏng hoặc không đọc được nên không xuất được.'
          : 'Không xuất được PDF. Hãy thử lại.'
    super(userMessage, cause !== undefined ? { cause } : undefined)
    this.name = 'PdfExportError'
    this.kind = kind
    this.userMessage = userMessage
  }
}

function hexToRgb(hex: string): RGB {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (match === null) return rgb(0, 0, 0)
  const value = parseInt(match[1], 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

function svgPathFromPoints(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const parts = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]
  for (let i = 1; i < points.length; i += 1) {
    parts.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

/** Ngữ cảnh chuyển đổi tọa độ cho một trang. */
interface PageTransform {
  worldToPdf(point: Point): Point
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
}

function buildTransform(nativePage: PDFPageProxy, libPage: PDFPage): PageTransform {
  const viewport = nativePage.getViewport({ scale: 1 })
  const mapping = createPdfAnnotationMapping(viewport)
  const crop = libPage.getCropBox()
  return {
    worldToPdf: (point) => mapping.worldToPdfPoint(point),
    cropX: crop.x,
    cropY: crop.y,
    cropWidth: crop.width,
    cropHeight: crop.height,
  }
}

/** Điểm user-space của pdf-lib từ điểm world. */
function toUserPoint(t: PageTransform, world: Point): Point {
  const pdf = t.worldToPdf(world)
  return { x: t.cropX + pdf.x, y: t.cropY + pdf.y }
}

function drawStrokeVector(page: PDFPage, t: PageTransform, object: StrokeObject): boolean {
  const outline = strokeOutlinePoints(object, { x: 0, y: 0, zoom: 1 })
  if (outline.length < 3) return false
  // drawSvgPath của pdf-lib: gốc tại (x, y) trong user
  // space, trục y của path hướng XUỐNG. Chuyển từng
  // đỉnh: pathX = pdf.x; pathY = cropHeight − pdf.y;
  // neo tại (cropX, cropY + cropHeight).
  const pathPoints = outline.map((world) => {
    const pdf = t.worldToPdf(world)
    return { x: pdf.x, y: t.cropHeight - pdf.y }
  })
  page.drawSvgPath(svgPathFromPoints(pathPoints), {
    x: t.cropX,
    y: t.cropY + t.cropHeight,
    color: hexToRgb(object.style.color),
    // Khớp độ mờ hiệu dụng của renderer (TASK-14D): vector
    // chỉ vẽ MỘT lớp nên nhân hệ số hồ sơ vào opacity; riêng
    // màu nước (nhiều lớp) bản vector là xấp xỉ một lớp.
    opacity: object.style.opacity * strokeProfile(object.type).opacityScale,
  })
  return true
}

function drawShapeVector(page: PDFPage, t: PageTransform, object: ShapeObject): boolean {
  const start = toUserPoint(t, object.start)
  const end = toUserPoint(t, object.end)
  const lineOptions = {
    color: hexToRgb(object.style.strokeColor),
    thickness: object.style.strokeWidth,
    opacity: object.style.opacity,
  }
  if (object.type === 'line') {
    page.drawLine({ start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, ...lineOptions })
    return true
  }
  if (object.type === 'arrow') {
    page.drawLine({ start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, ...lineOptions })
    const { wingA, wingB } = arrowHeadPoints(
      object.end,
      object.start,
      arrowHeadLength(object.style.strokeWidth),
    )
    const a = toUserPoint(t, wingA)
    const b = toUserPoint(t, wingB)
    page.drawLine({ start: { x: end.x, y: end.y }, end: { x: a.x, y: a.y }, ...lineOptions })
    page.drawLine({ start: { x: end.x, y: end.y }, end: { x: b.x, y: b.y }, ...lineOptions })
    return true
  }
  const x = Math.min(start.x, end.x)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  if (width === 0 || height === 0) return false
  const y = Math.min(start.y, end.y)
  const fill =
    object.style.fillColor !== null ? { color: hexToRgb(object.style.fillColor) } : {}
  if (object.type === 'rectangle') {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: lineOptions.color,
      borderWidth: object.style.strokeWidth,
      opacity: object.style.opacity,
      ...fill,
    })
    return true
  }
  page.drawEllipse({
    x: x + width / 2,
    y: y + height / 2,
    xScale: width / 2,
    yScale: height / 2,
    borderColor: lineOptions.color,
    borderWidth: object.style.strokeWidth,
    opacity: object.style.opacity,
    ...fill,
  })
  return true
}

const NON_WIN_ANSI = /[^\x20-\x7E\u00A0-\u00FF]/

function drawTextVector(
  page: PDFPage,
  t: PageTransform,
  object: TextObject,
  font: PDFFont,
  warnings: string[],
): boolean {
  if (NON_WIN_ANSI.test(object.text)) {
    warnings.push(
      'Một ghi chú chữ chứa ký tự ngoài bảng mã của phông chuẩn PDF nên không được nhúng vào bản vector — hãy dùng chế độ ảnh nét cao nếu cần giữ ghi chú này.',
    )
    return false
  }
  const topLeft = toUserPoint(t, object.position)
  const lines = object.text.split('\n')
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: topLeft.x,
      // position là góc TRÊN-trái của hộp chữ (như trên
      // canvas); drawText tính theo baseline nên lùi
      // xuống một cỡ chữ cho mỗi dòng:
      y: topLeft.y - object.style.fontSize * (index + 1) - index * object.style.fontSize * 0.25,
      size: object.style.fontSize,
      font,
      color: hexToRgb(object.style.color),
    })
  })
  return true
}

async function renderPageRaster(
  t: PageTransform,
  objects: readonly DrawingObject[],
  scale: number,
  createCanvas: (width: number, height: number) => PdfExportCanvasLike,
): Promise<Blob | null> {
  const width = Math.max(1, Math.round(t.cropWidth * scale))
  const height = Math.max(1, Math.round(t.cropHeight * scale))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  // Vẽ bằng chính các hàm của Drawing Engine với camera
  // zoom = scale: world (điểm PDF) → pixel ảnh.
  for (const object of objects) {
    drawObject(ctx, object, { x: 0, y: 0, zoom: scale })
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function defaultCreateCanvas(width: number, height: number): PdfExportCanvasLike {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas as unknown as PdfExportCanvasLike
}

/**
 * Làm phẳng annotation lên một bản sao của PDF gốc.
 * File gốc không bị đụng tới; kết quả là Blob PDF mới.
 */
export async function flattenPdfAnnotations(input: FlattenPdfInput): Promise<FlattenPdfResult> {
  const rasterScale = input.rasterScale ?? 3
  const createCanvas = input.createCanvas ?? defaultCreateCanvas
  const warnings: string[] = []

  let handle
  try {
    handle = await openPdfDocument(input.pdfData)
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new PdfExportError(error.kind === 'not-a-pdf' ? 'not-a-pdf' : 'corrupt', error)
    }
    throw new PdfExportError('export-failed', error)
  }

  try {
    const bytes =
      input.pdfData instanceof Uint8Array
        ? input.pdfData.slice()
        : new Uint8Array(input.pdfData.slice(0))
    let sourceDoc
    try {
      sourceDoc = await PDFDocument.load(bytes)
    } catch (error) {
      throw new PdfExportError('corrupt', error)
    }

    const annotatedIndices = [...input.annotationsByPage.entries()]
      .filter(([, objects]) => objects.length > 0)
      .map(([index]) => index)
      .filter((index) => index >= 0 && index < handle.pageCount)
      .sort((a, b) => a - b)

    const onlyAnnotated = input.pageScope === 'annotated-only' && annotatedIndices.length > 0
    const includeIndices = onlyAnnotated ? annotatedIndices : sourceDoc.getPageIndices()

    let outDoc: PDFDocument
    if (onlyAnnotated) {
      outDoc = await PDFDocument.create()
      const copied = await outDoc.copyPages(sourceDoc, includeIndices)
      copied.forEach((page) => outDoc.addPage(page))
    } else {
      outDoc = sourceDoc
    }

    const font = input.mode === 'vector' ? await outDoc.embedFont(StandardFonts.Helvetica) : null
    const flattenedPages: number[] = []
    const total = includeIndices.length

    for (let position = 0; position < includeIndices.length; position += 1) {
      const sourceIndex = includeIndices[position]
      const objects = input.annotationsByPage.get(sourceIndex) ?? []
      if (objects.length > 0) {
        const nativePage = await handle.getNativePage(sourceIndex)
        const libPage = outDoc.getPage(position)
        const transform = buildTransform(nativePage, libPage)
        if (input.mode === 'raster') {
          const pngBlob = await renderPageRaster(transform, objects, rasterScale, createCanvas)
          if (pngBlob !== null) {
            const png = await outDoc.embedPng(new Uint8Array(await pngBlob.arrayBuffer()))
            libPage.drawImage(png, {
              x: transform.cropX,
              y: transform.cropY,
              width: transform.cropWidth,
              height: transform.cropHeight,
            })
            flattenedPages.push(sourceIndex)
          } else {
            warnings.push(`Không tạo được ảnh chú thích cho trang ${sourceIndex + 1}.`)
          }
        } else {
          let drawnAny = false
          for (const object of objects) {
            if (isStrokeObject(object)) {
              drawnAny = drawStrokeVector(libPage, transform, object) || drawnAny
            } else if (object.type === 'text') {
              if (font !== null) {
                drawnAny = drawTextVector(libPage, transform, object, font, warnings) || drawnAny
              }
            } else {
              drawnAny = drawShapeVector(libPage, transform, object) || drawnAny
            }
          }
          if (drawnAny) flattenedPages.push(sourceIndex)
        }
      }
      input.onProgress?.(position + 1, total)
    }

    const outBytes = await outDoc.save()
    const outBuffer = new ArrayBuffer(outBytes.byteLength)
    new Uint8Array(outBuffer).set(outBytes)
    return {
      blob: new Blob([outBuffer], { type: 'application/pdf' }),
      flattenedPages,
      outputPageCount: outDoc.getPageCount(),
      warnings,
    }
  } finally {
    await handle.close()
  }
}
