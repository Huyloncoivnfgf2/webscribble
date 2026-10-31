/**
 * Lỗi nhập DOCX của Word Engine (TASK-07A): phân loại rõ để UI
 * hiển thị thông điệp thân thiện, không lộ chi tiết kỹ thuật
 * thô. `cause` giữ lỗi gốc cho việc chẩn đoán.
 */

export type WordImportErrorKind =
  | 'not-a-docx'
  | 'legacy-doc'
  | 'corrupt'
  | 'conversion-failed'
  | 'invalid-content'
  | 'sanitizer-unavailable'
  | 'persistence'

const USER_MESSAGES: Record<WordImportErrorKind, string> = {
  'not-a-docx': 'File đã chọn không phải là tài liệu DOCX hợp lệ.',
  'legacy-doc':
    'Định dạng Word cũ (.doc) chưa được hỗ trợ. Hãy lưu lại tài liệu dưới dạng .docx rồi thử lại.',
  corrupt: 'File DOCX bị hỏng hoặc không đọc được.',
  'conversion-failed': 'Không chuyển đổi được nội dung của tài liệu DOCX này.',
  'invalid-content': 'Nội dung sau khi chuyển đổi không hợp lệ nên đã bị từ chối.',
  'sanitizer-unavailable':
    'Trình duyệt hiện tại không hỗ trợ lớp kiểm tra an toàn nội dung, nên WebScribble không nhập tài liệu này.',
  persistence: 'Đã chuyển đổi được tài liệu nhưng không lưu được vào thư viện.',
}

export class WordImportError extends Error {
  readonly kind: WordImportErrorKind
  /** Thông điệp an toàn để hiển thị cho người dùng. */
  readonly userMessage: string

  constructor(kind: WordImportErrorKind, options: { cause?: unknown } = {}) {
    super(`Word import failed (${kind}).`)
    this.name = 'WordImportError'
    this.kind = kind
    this.userMessage = USER_MESSAGES[kind]
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}
