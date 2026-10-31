import { DOCUMENT_CONTENT_VERSION } from '../../data/index'

/**
 * Mô hình nội dung sửa được của Word Engine (TASK-07A).
 *
 * Cấu trúc JSON tương thích ProseMirror/Tiptap (doc → block →
 * inline + marks) để TASK-07B dùng thẳng làm nội dung cho
 * Tiptap mà không phải chuyển đổi lại. HTML chỉ là định dạng
 * TRUNG GIAN lúc nhập (Mammoth → HTML → sanitize → model này);
 * HTML không bao giờ là dữ liệu chỉnh sửa chính.
 *
 * `contentVersion` của bản ghi lưu trữ (Data Layer) chính là
 * DOCUMENT_CONTENT_VERSION. Version 1 (TASK-07A): cấu trúc cơ
 * bản. Version 2 (TASK-07C) MỞ RỘNG tương thích ngược: marks
 * superscript/subscript/textStyle; attrs textAlign trên
 * paragraph/heading, background/colspan/rowspan trên ô bảng,
 * width/height trên ảnh. Nội dung version 1 vẫn hợp lệ
 * nguyên vẹn dưới validator version 2 (tập con).
 */
export const WORD_MODEL_VERSION = DOCUMENT_CONTENT_VERSION

export type WordMarkType =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link'
  | 'superscript' | 'subscript' | 'textStyle'

export interface WordMark {
  type: WordMarkType
  attrs?: {
    href?: string
    /** textStyle (TASK-07C): định dạng ký tự trực tiếp từ DOCX. */
    color?: string
    backgroundColor?: string
    fontSize?: string
    fontFamily?: string
  }
}

export interface WordTextNode {
  type: 'text'
  text: string
  marks?: WordMark[]
}

export interface WordHardBreakNode {
  type: 'hardBreak'
}

export type WordInlineNode = WordTextNode | WordHardBreakNode

export interface WordBlockNode {
  type: string
  attrs?: Record<string, unknown>
  content?: WordNode[]
}

export type WordNode = WordBlockNode | WordInlineNode

export interface WordDocumentContent {
  type: 'doc'
  content: WordBlockNode[]
}

/** Các loại block mà model version 1 hiểu (khớp phạm vi 07A/07B). */
export const WORD_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'image',
  'horizontalRule',
])

const WORD_MARK_TYPES = new Set<string>([
  'bold', 'italic', 'underline', 'strike', 'code', 'link',
  'superscript', 'subscript', 'textStyle',
])

/** Giá trị textAlign hợp lệ của paragraph/heading (TASK-07C). */
export const WORD_TEXT_ALIGNS = new Set(['left', 'center', 'right', 'justify'])

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
const FONT_SIZE = /^\d{1,3}(\.\d)?(pt|px)$/

const MAX_DEPTH = 24

/** Nội dung rỗng hợp lệ: một đoạn trống. */
export function createEmptyWordContent(): WordDocumentContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateNode(node: unknown, depth: number, errors: string[]): void {
  if (depth > MAX_DEPTH) {
    errors.push('Cấu trúc nội dung lồng nhau quá sâu.')
    return
  }
  if (!isPlainObject(node) || typeof node.type !== 'string') {
    errors.push('Node nội dung không hợp lệ (thiếu type).')
    return
  }
  if (node.type === 'text') {
    if (typeof node.text !== 'string') errors.push('Text node thiếu chuỗi text.')
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks)) {
        errors.push('Marks của text node phải là mảng.')
      } else {
        for (const mark of node.marks) {
          if (!isPlainObject(mark) || typeof mark.type !== 'string' || !WORD_MARK_TYPES.has(mark.type)) {
            errors.push(`Mark không được hỗ trợ: ${String(isPlainObject(mark) ? mark.type : mark)}`)
            continue
          }
          if (mark.type === 'link') {
            const attrs = mark.attrs
            if (!isPlainObject(attrs) || typeof attrs.href !== 'string' || attrs.href === '') {
              errors.push('Mark link phải có attrs.href là chuỗi không rỗng.')
            }
          }
          if (mark.type === 'textStyle') {
            // TASK-07C: attrs của textStyle bị chặn ở đúng
            // các khóa/giá trị an toàn — chúng được Tiptap
            // render thành style nội tuyến. Giá trị null do
            // Tiptap phát ra cho attr chưa đặt = vắng mặt.
            const attrs = isPlainObject(mark.attrs) ? mark.attrs : {}
            for (const key of Object.keys(attrs)) {
              if (!['color', 'backgroundColor', 'fontSize', 'fontFamily'].includes(key)) {
                errors.push(`textStyle không hỗ trợ thuộc tính: ${key}`)
              }
            }
            for (const key of ['color', 'backgroundColor'] as const) {
              const v = attrs[key]
              if (v !== undefined && v !== null && (typeof v !== 'string' || !HEX_COLOR.test(v))) {
                errors.push(`textStyle.${key} phải là màu hex #RRGGBB.`)
              }
            }
            if (attrs.fontSize !== undefined && attrs.fontSize !== null && (typeof attrs.fontSize !== 'string' || !FONT_SIZE.test(attrs.fontSize))) {
              errors.push('textStyle.fontSize phải có dạng như "14pt" hoặc "16px".')
            }
            if (attrs.fontFamily !== undefined && attrs.fontFamily !== null && (typeof attrs.fontFamily !== 'string' || attrs.fontFamily === '' || attrs.fontFamily.length > 100 || /[<>"]/.test(attrs.fontFamily) || [...attrs.fontFamily].some((ch) => ch.charCodeAt(0) < 0x20))) {
              errors.push('textStyle.fontFamily không hợp lệ.')
            }
          }
        }
      }
    }
    return
  }
  if (node.type === 'hardBreak') return
  if (!WORD_BLOCK_TYPES.has(node.type)) {
    errors.push(`Loại block không được hỗ trợ: ${node.type}`)
    return
  }
  if (node.type === 'heading') {
    const level = isPlainObject(node.attrs) ? node.attrs.level : undefined
    if (level !== undefined && (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 6)) {
      errors.push('Heading phải có level nguyên từ 1 đến 6.')
    }
  }
  const nodeAttrs = isPlainObject(node.attrs) ? node.attrs : {}
  if (node.type === 'paragraph' || node.type === 'heading') {
    // textAlign null (mặc định Tiptap phát ra) = chưa đặt.
    const align = nodeAttrs.textAlign
    if (align !== undefined && align !== null && (typeof align !== 'string' || !WORD_TEXT_ALIGNS.has(align))) {
      errors.push('textAlign của đoạn phải thuộc left/center/right/justify.')
    }
  }
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    const bg = nodeAttrs.background
    if (bg !== undefined && bg !== null && (typeof bg !== 'string' || !HEX_COLOR.test(bg))) {
      errors.push('background của ô bảng phải là màu hex #RRGGBB.')
    }
    for (const key of ['colspan', 'rowspan'] as const) {
      const v = nodeAttrs[key]
      if (v !== undefined && v !== null && (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 100)) {
        errors.push(`${key} của ô bảng phải là số nguyên từ 1 đến 100.`)
      }
    }
  }
  if (node.type === 'image') {
    const src = isPlainObject(node.attrs) ? node.attrs.src : undefined
    if (typeof src !== 'string' || src === '') {
      errors.push('Image node phải có attrs.src là chuỗi không rỗng.')
    }
    for (const key of ['width', 'height'] as const) {
      const v = nodeAttrs[key]
      if (v !== undefined && v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 100000)) {
        errors.push(`${key} của ảnh phải là số dương hợp lệ.`)
      }
    }
  }
  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      errors.push(`Node ${node.type} có content không phải mảng.`)
      return
    }
    for (const child of node.content) validateNode(child, depth + 1, errors)
  }
}

/**
 * Kiểm tra cấu trúc một giá trị có phải WordDocumentContent
 * hợp lệ hay không. Không ném lỗi — trả về danh sách lỗi để
 * tầng gọi quyết định (cùng phong cách validateDrawingObject).
 */
export function validateWordContent(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!isPlainObject(value) || value.type !== 'doc' || !Array.isArray(value.content)) {
    return { valid: false, errors: ['Nội dung không phải tài liệu Word hợp lệ (thiếu gốc doc/content).'] }
  }
  if (value.content.length === 0) {
    errors.push('Tài liệu không có block nào.')
  }
  for (const node of value.content) validateNode(node, 0, errors)
  return { valid: errors.length === 0, errors }
}

export function isWordDocumentContent(value: unknown): value is WordDocumentContent {
  return validateWordContent(value).valid
}
