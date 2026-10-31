/**
 * Text Engine (TASK-05D): tạo và cập nhật TextObject theo DEC-026.
 *
 * Phân tách ba lớp rõ ràng:
 * 1. **Dữ liệu text** — chuỗi nội dung thật (hỗ trợ Unicode/tiếng Việt
 *    nguyên trạng, xuống dòng bằng '\n'), lưu trong TextObject.
 * 2. **Kích thước layout** — `width`/`height` lưu TRỰC TIẾP trong
 *    object (DEC-026). Tầng dữ liệu không tự đo văn bản: việc đo do
 *    một `TextMeasurer` được tiêm vào thực hiện tại thời điểm tạo/sửa
 *    (trình duyệt dùng bản đo bằng Canvas measureText; kiểm thử dùng
 *    bản đo giả xác định).
 * 3. **Hiển thị** — Renderer (renderer.ts) dùng cùng thuật toán chia
 *    dòng ở đây để vẽ; text không bao giờ biến thành bitmap hay nét vẽ.
 *
 * Xuống dòng gồm hai cơ chế: ngắt dòng tường minh '\n' và (khi có
 * `maxWidth`) gói từ tham lam theo bề rộng đo được. Một từ đơn dài hơn
 * maxWidth được giữ nguyên ở dòng riêng (không cắt giữa từ).
 */

import { textBounds } from './geometry'
import { createText, DEFAULT_TEXT_STYLE } from './objects'
import type { ObjectId, Point, SurfaceId, TextObject, TextStyle } from './types'

/** Hệ số chiều cao dòng theo fontSize (dùng chung cho đo và render). */
export const TEXT_LINE_HEIGHT_FACTOR = 1.25

/**
 * Bộ đo văn bản do tầng tạo/sửa text cung cấp. Mọi phép đo tính theo
 * world units tại fontSize của style.
 */
export interface TextMeasurer {
  /** Bề rộng của một dòng văn bản đơn (không chứa '\n'). */
  measureWidth(line: string, style: TextStyle): number
  /** Chiều cao của một dòng theo style. */
  lineHeight(style: TextStyle): number
}

/**
 * Chia nội dung thành các dòng hiển thị: tách theo '\n', rồi gói từ
 * theo `maxWidth` nếu được cung cấp. Hàm thuần, không đo bằng canvas
 * trực tiếp — bề rộng lấy qua `measureWidth` được truyền vào.
 */
export function layoutTextLines(
  text: string,
  style: TextStyle,
  measureWidth: (line: string, style: TextStyle) => number,
  maxWidth?: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (maxWidth === undefined || measureWidth(paragraph, style) <= maxWidth) {
      lines.push(paragraph)
      continue
    }
    // Gói từ tham lam: thêm từng từ cho tới khi vượt maxWidth.
    const words = paragraph.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`
      if (current !== '' && measureWidth(candidate, style) > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    lines.push(current)
  }
  return lines
}

export interface TextLayout {
  lines: string[]
  /** Bề rộng của dòng dài nhất (world units). */
  width: number
  /** Tổng chiều cao các dòng (world units). */
  height: number
}

/** Tính layout đầy đủ của một nội dung text theo measurer. */
export function layoutText(
  text: string,
  style: TextStyle,
  measurer: TextMeasurer,
  maxWidth?: number,
): TextLayout {
  const lines = layoutTextLines(text, style, measurer.measureWidth, maxWidth)
  let width = 0
  for (const line of lines) {
    width = Math.max(width, measurer.measureWidth(line, style))
  }
  return { lines, width, height: lines.length * measurer.lineHeight(style) }
}

export interface BuildTextObjectInput {
  surfaceId: SurfaceId
  position: Point
  text: string
  style?: Partial<TextStyle>
  measurer: TextMeasurer
  /** Bề rộng tối đa để gói dòng; bỏ qua = chỉ ngắt theo '\n'. */
  maxWidth?: number
  id?: ObjectId
  createdAt?: number
}

function requireContent(text: string): void {
  if (text.trim() === '') {
    throw new Error('TextEngine: text content must not be empty')
  }
}

/**
 * Tạo TextObject hoàn chỉnh: nội dung + vị trí + style + width/height
 * đo được (DEC-026), bounds do factory tính từ chính width/height đó.
 * Ném lỗi khi nội dung rỗng (hộp text rỗng phải bị loại ở tầng gọi,
 * giống cách ứng dụng ghi chú vẫn làm).
 */
export function buildTextObject(input: BuildTextObjectInput): TextObject {
  requireContent(input.text)
  const style: TextStyle = { ...DEFAULT_TEXT_STYLE, ...input.style }
  const layout = layoutText(input.text, style, input.measurer, input.maxWidth)
  if (!(layout.width > 0) || !(layout.height > 0)) {
    throw new Error('TextEngine: measurer returned a non-positive size')
  }
  return createText({
    surfaceId: input.surfaceId,
    id: input.id,
    createdAt: input.createdAt,
    position: input.position,
    text: input.text,
    width: layout.width,
    height: layout.height,
    style,
  })
}

/**
 * Trả về một TextObject MỚI với nội dung (và kích thước) cập nhật —
 * giữ nguyên id, surfaceId, position, style và createdAt. Dùng kèm
 * `DrawingSurface.updateObject` để ghi vào surface. Ném lỗi khi nội
 * dung mới rỗng.
 */
export function updateTextContent(
  object: TextObject,
  text: string,
  measurer: TextMeasurer,
  maxWidth?: number,
): TextObject {
  requireContent(text)
  const layout = layoutText(text, object.style, measurer, maxWidth)
  if (!(layout.width > 0) || !(layout.height > 0)) {
    throw new Error('TextEngine: measurer returned a non-positive size')
  }
  return {
    ...object,
    text,
    width: layout.width,
    height: layout.height,
    bounds: textBounds(object.position, layout.width, layout.height),
    updatedAt: Date.now(),
  }
}

/** Phần tối thiểu của CanvasRenderingContext2D cần cho việc đo text. */
export interface CanvasMeasureContextLike {
  font: string
  measureText(text: string): { width: number }
}

/**
 * TextMeasurer dùng Canvas thật: bề rộng từ `measureText` với font
 * theo style; chiều cao dòng = fontSize × TEXT_LINE_HEIGHT_FACTOR.
 */
export function createCanvasTextMeasurer(ctx: CanvasMeasureContextLike): TextMeasurer {
  return {
    measureWidth(line: string, style: TextStyle): number {
      ctx.font = `${style.fontSize}px ${style.fontFamily}`
      return ctx.measureText(line).width
    },
    lineHeight(style: TextStyle): number {
      return style.fontSize * TEXT_LINE_HEIGHT_FACTOR
    },
  }
}
