/**
 * Renderer (TASK-05C Phần B + TASK-05D): vẽ DrawingObject lên Canvas 2D.
 *
 * Nguyên tắc:
 * - Outline của nét viết tay được TÍNH LÚC RENDER bằng perfect-freehand
 *   (DEC-016) từ raw points — outline không bao giờ là dữ liệu lưu trữ
 *   (TASK-05A). Hình vector vẽ trực tiếp từ start/end + style; text vẽ
 *   bằng fillText theo layout của Text Engine (text.ts) — không loại
 *   object nào bị rasterize thành dữ liệu.
 * - Renderer chỉ ĐỌC object: không sửa raw points, không sửa style,
 *   không sửa bounds. Zoom/pan chỉ đổi phép biến đổi lúc vẽ, dữ liệu
 *   nguồn không đổi.
 * - Khác biệt pen / highlighter: pen có độ dày biến thiên theo pressure
 *   (thinning > 0); highlighter có độ dày đều (thinning = 0) và độ mờ
 *   lấy từ `style.opacity` của nó (mặc định 0.4) — cả hai đều tôn trọng
 *   màu/kích thước/opacity trong StrokeStyle của object.
 * - Pressure thật được dùng nguyên trạng (`simulatePressure: false`) vì
 *   Input Manager đã chuẩn hóa pressure kèm fallback (TASK-05B).
 * - Điểm vào chung cho mọi loại object là `drawObject`.
 */

import { getStroke } from 'perfect-freehand'
import { worldToScreen, type Camera } from './coordinates'
import { arrowHeadLength, arrowHeadPoints } from './geometry'
import { layoutTextLines, TEXT_LINE_HEIGHT_FACTOR } from './text'
import type { DrawingObject, Point, ShapeObject, StrokeObject, TextObject } from './types'
import { isStrokeKind, strokeProfile } from './strokeProfiles'

// Giữ tương thích ngược cho nơi đã import từ renderer (TASK-05D); hình
// học đầu mũi tên nay thuộc geometry.ts để bounds/selection dùng chung.
export { arrowHeadPoints, ARROW_HEAD_HALF_ANGLE, ARROW_HEAD_WIDTH_FACTOR } from './geometry'

export interface StrokeRenderOptions {
  /**
   * True khi nét đã hoàn tất (perfect-freehand xử lý đầu/cuối nét ở
   * trạng thái cuối); false cho nét đang vẽ dở (xem trước trực tiếp).
   */
  complete?: boolean
}

/**
 * Phần tối thiểu của CanvasRenderingContext2D mà renderer cần — đủ
 * hẹp để unit test thay bằng bản ghi lệnh giả.
 */
export interface CanvasContextLike {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  globalAlpha: number
  font: string
  textBaseline: string
  save(): void
  restore(): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
  stroke(): void
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void
  clip(): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  setLineDash(segments: readonly number[]): void
}

/** Tham số perfect-freehand theo hồ sơ của loại bút (TASK-14D). */
function outlineOptions(object: StrokeObject, camera: Camera, complete: boolean) {
  const profile = strokeProfile(object.type)
  return {
    // Kích thước hiệu dụng (world) → nhân zoom ra kích thước màn hình.
    size: object.style.size * profile.sizeScale * camera.zoom,
    thinning: profile.thinning,
    smoothing: profile.smoothing,
    streamline: profile.streamline,
    simulatePressure: profile.simulatePressure,
    last: complete,
  }
}

/**
 * Tính outline (đa giác bao nét) trong tọa độ MÀN HÌNH (CSS px) từ raw
 * points của object và camera hiện tại. Hàm thuần: cùng đầu vào cho
 * cùng đầu ra, không chạm vào object.
 */
export function strokeOutlinePoints(
  object: StrokeObject,
  camera: Camera,
  options: StrokeRenderOptions = {},
): Point[] {
  const complete = options.complete ?? true
  const screenPoints = object.points.map((point) => {
    const screen = worldToScreen(point, camera)
    return { x: screen.x, y: screen.y, pressure: point.pressure }
  })
  const outline = getStroke(screenPoints, outlineOptions(object, camera, complete))
  return outline.map(([x, y]) => ({ x, y }))
}

/**
 * Vẽ một nét lên context. Trả về false (và không vẽ gì) khi outline
 * không đủ điểm để thành một đa giác. Trạng thái context (alpha,
 * fillStyle…) được khôi phục nguyên vẹn sau khi vẽ nhờ save/restore.
 */
export function drawStroke(
  ctx: CanvasContextLike,
  object: StrokeObject,
  camera: Camera,
  options: StrokeRenderOptions = {},
): boolean {
  const outline = strokeOutlinePoints(object, camera, options)
  if (outline.length < 3) return false
  const profile = strokeProfile(object.type)
  ctx.save()
  try {
    ctx.globalAlpha = object.style.opacity * profile.opacityScale
    ctx.fillStyle = object.style.color
    ctx.beginPath()
    ctx.moveTo(outline[0].x, outline[0].y)
    for (let i = 1; i < outline.length; i += 1) {
      ctx.lineTo(outline[i].x, outline[i].y)
    }
    ctx.closePath()
    // Hồ sơ nhiều lớp (màu nước): tô chồng để vùng giao
    // nhau đậm dần; một lớp thì đúng một lần fill như cũ.
    for (let pass = 0; pass < profile.passes; pass += 1) {
      ctx.fill()
    }
  } finally {
    ctx.restore()
  }
  return true
}

/** Object có phải nét vẽ tự do (phạm vi render của TASK-05C) hay không. */
export function isStrokeObject(object: { type: string }): object is StrokeObject {
  return isStrokeKind(object.type)
}

// ---------------------------------------------------------------------------
// Shape & Text rendering (TASK-05D; hình học đầu mũi tên chuyển về
// geometry.ts ở TASK-05E để bounds của arrow bao phủ đúng đầu mũi tên)
// ---------------------------------------------------------------------------

/**
 * Vẽ một hình vector (line/rectangle/ellipse/arrow) qua camera. Tôn
 * trọng strokeColor/strokeWidth/fillColor/opacity của ShapeStyle;
 * rectangle và ellipse mặc định không fill trừ khi style có fillColor.
 * Trả về false (không vẽ) với hình suy biến (kích thước 0) — dữ liệu
 * như vậy lẽ ra đã bị ShapeBuilder loại, đây là lớp phòng thủ.
 */
export function drawShape(
  ctx: CanvasContextLike,
  object: ShapeObject,
  camera: Camera,
): boolean {
  const start = worldToScreen(object.start, camera)
  const end = worldToScreen(object.end, camera)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  const lineWidth = object.style.strokeWidth * camera.zoom

  if (object.type === 'line' || object.type === 'arrow') {
    if (width === 0 && height === 0) return false
  } else if (width === 0 || height === 0) {
    return false
  }

  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)

  ctx.save()
  try {
    ctx.globalAlpha = object.style.opacity
    ctx.strokeStyle = object.style.strokeColor
    ctx.lineWidth = lineWidth

    if (object.type === 'line') {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    } else if (object.type === 'rectangle') {
      ctx.beginPath()
      ctx.moveTo(minX, minY)
      ctx.lineTo(minX + width, minY)
      ctx.lineTo(minX + width, minY + height)
      ctx.lineTo(minX, minY + height)
      ctx.closePath()
      if (object.style.fillColor !== null) {
        ctx.fillStyle = object.style.fillColor
        ctx.fill()
      }
      ctx.stroke()
    } else if (object.type === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(
        minX + width / 2,
        minY + height / 2,
        width / 2,
        height / 2,
        0,
        0,
        Math.PI * 2,
      )
      if (object.style.fillColor !== null) {
        ctx.fillStyle = object.style.fillColor
        ctx.fill()
      }
      ctx.stroke()
    } else {
      // arrow: thân là đường thẳng, đầu là tam giác đặc. Chiều dài đầu
      // tính theo đơn vị world (arrowHeadLength ở geometry) rồi nhân
      // zoom — khớp với bounds đã lưu của object ở mọi mức zoom.
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      const headLength = arrowHeadLength(object.style.strokeWidth) * camera.zoom
      const { wingA, wingB } = arrowHeadPoints(end, start, headLength)
      ctx.beginPath()
      ctx.moveTo(end.x, end.y)
      ctx.lineTo(wingA.x, wingA.y)
      ctx.lineTo(wingB.x, wingB.y)
      ctx.closePath()
      ctx.fillStyle = object.style.strokeColor
      ctx.fill()
    }
  } finally {
    ctx.restore()
  }
  return true
}

/**
 * Vẽ TextObject: chia dòng bằng cùng thuật toán layout của Text
 * Engine (text.ts) với bề rộng gói = width của object, vẽ từng dòng
 * bằng fillText và CLIP trong đúng hộp width × height của object
 * (DEC-026). Font được phóng theo zoom; nội dung Unicode truyền
 * nguyên trạng cho canvas.
 */
export function drawText(
  ctx: CanvasContextLike,
  object: TextObject,
  camera: Camera,
): boolean {
  const origin = worldToScreen(object.position, camera)
  const zoom = camera.zoom
  const fontSize = object.style.fontSize * zoom
  const boxWidth = object.width * zoom
  const boxHeight = object.height * zoom

  ctx.save()
  try {
    // Đo/chia dòng nằm TRONG save/restore vì phép đo cũng gán ctx.font.
    const measureWidth = (line: string): number => {
      ctx.font = `${fontSize}px ${object.style.fontFamily}`
      return ctx.measureText(line).width
    }
    const lines = layoutTextLines(object.text, object.style, measureWidth, boxWidth)
    const lineStep = object.style.fontSize * TEXT_LINE_HEIGHT_FACTOR * zoom

    // Clip trong hộp của object để nội dung tràn không lem ra ngoài.
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.lineTo(origin.x + boxWidth, origin.y)
    ctx.lineTo(origin.x + boxWidth, origin.y + boxHeight)
    ctx.lineTo(origin.x, origin.y + boxHeight)
    ctx.closePath()
    ctx.clip()

    ctx.font = `${fontSize}px ${object.style.fontFamily}`
    ctx.fillStyle = object.style.color
    ctx.globalAlpha = 1
    ctx.textBaseline = 'top'
    lines.forEach((line, index) => {
      ctx.fillText(line, origin.x, origin.y + index * lineStep)
    })
  } finally {
    ctx.restore()
  }
  return true
}

/**
 * Điểm vào render chung cho MỌI DrawingObject (CanvasRenderer dùng):
 * phân dispatch theo loại object. `options.complete` chỉ ảnh hưởng
 * nét viết tay (trạng thái xem trước khi đang vẽ).
 */
export function drawObject(
  ctx: CanvasContextLike,
  object: DrawingObject,
  camera: Camera,
  options: StrokeRenderOptions = {},
): boolean {
  if (isStrokeObject(object)) return drawStroke(ctx, object, camera, options)
  switch (object.type) {
    case 'line':
    case 'rectangle':
    case 'ellipse':
    case 'arrow':
      return drawShape(ctx, object, camera)
    case 'text':
      return drawText(ctx, object, camera)
  }
}
