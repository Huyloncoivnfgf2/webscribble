import DOMPurify from 'dompurify'
import { WordImportError } from './errors'

/**
 * Lớp sanitize cho HTML sinh ra từ Mammoth (TASK-07A, DEC-016/
 * DEC-018): HTML của Mammoth là KHÔNG ĐÁNG TIN — nó được dựng
 * từ một file tài liệu có thể đến từ bất kỳ nguồn nào. Sanitize
 * diễn ra NGAY tại biên nhập, trước khi HTML được parse thành
 * mô hình nội dung; HTML chưa sanitize không bao giờ đi vào
 * DOM của ứng dụng.
 *
 * Cấu hình (trên nền mặc định vốn đã an toàn của DOMPurify —
 * mặc định đã loại <script>, event handler on*, URL
 * javascript:/vbscript:, và chỉ cho phép data:image/* cho ảnh):
 * - FORBID_TAGS: loại thêm các phần tử không thuộc mô hình nội
 *   dung văn bản và có bề mặt tấn công/khó bảo toàn: iframe,
 *   object, embed, form và các control, svg, math (tránh mXSS),
 *   style/link/meta/title, template.
 * - FORBID_ATTR: `style` (định dạng trực tiếp không thuộc mô
 *   hình v1 và là bề mặt CSS injection), `srcset`, `formaction`.
 * - ALLOW_DATA_ATTR = false: không giữ data-* tùy ý.
 * Phần tử bị loại bỏ tiêu biểu: script, style, iframe, form,
 * svg/math, event handler, URL nguy hiểm. Nội dung văn bản,
 * cấu trúc đoạn/bảng/danh sách, định dạng inline cơ bản và ảnh
 * nhúng data:image được giữ lại cho bước chuyển mô hình.
 */
export const IMPORT_SANITIZE_CONFIG = {
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'link',
    'meta',
    'title',
    'noscript',
    'template',
    'svg',
    'math',
  ],
  FORBID_ATTR: ['style', 'srcset', 'formaction'],
  ALLOW_DATA_ATTR: false,
} as const

/** Phần tối thiểu của DOMPurify mà tầng này cần — tiêm được khi test. */
export interface HtmlPurifier {
  isSupported: boolean
  sanitize(html: string, config?: Record<string, unknown>): string
}

/**
 * Sanitize một chuỗi HTML bằng DOMPurify. `purifier` mặc định
 * là instance gắn với cửa sổ trình duyệt hiện tại; khi môi
 * trường không có DOM (isSupported = false) → ném lỗi
 * 'sanitizer-unavailable' thay vì cho HTML sống đi tiếp.
 */
export function sanitizeImportedHtml(
  html: string,
  purifier: HtmlPurifier = DOMPurify as unknown as HtmlPurifier,
): string {
  if (!purifier.isSupported) {
    throw new WordImportError('sanitizer-unavailable')
  }
  return purifier.sanitize(html, IMPORT_SANITIZE_CONFIG as Record<string, unknown>)
}
