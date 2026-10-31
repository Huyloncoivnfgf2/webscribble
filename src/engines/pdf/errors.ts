/**
 * Phân loại lỗi PDF (TASK-06A). Mọi lỗi khi mở tài liệu đều được gói
 * thành PdfLoadError với `kind` rõ ràng — tầng trên không bao giờ
 * phải đoán từ thông điệp thô của PDF.js, và lỗi gốc luôn được giữ
 * trong `cause`.
 */
export type PdfErrorKind =
  /** Bytes không phải PDF (thiếu chữ ký %PDF- ở đầu file). */
  | 'not-a-pdf'
  /** Có chữ ký PDF nhưng cấu trúc hỏng/không đọc được. */
  | 'corrupt'
  /** PDF được bảo vệ bằng mật khẩu (chưa hỗ trợ nhập mật khẩu). */
  | 'password'
  /** PDF.js không hỗ trợ định dạng/phiên bản này. */
  | 'unsupported'
  /** Việc tải bị hủy (AbortSignal hoặc đóng giữa chừng). */
  | 'cancelled'
  /** Worker của PDF.js không khởi động được. */
  | 'worker'
  /** Thao tác trên tài liệu đã đóng. */
  | 'closed'
  /** Lỗi khác chưa phân loại được (xem cause). */
  | 'unknown'

export class PdfLoadError extends Error {
  readonly kind: PdfErrorKind

  constructor(kind: PdfErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfLoadError'
    this.kind = kind
  }
}

/** Index trang ngoài phạm vi [0, pageCount). */
export class PdfPageIndexError extends RangeError {
  readonly index: number
  readonly pageCount: number

  constructor(index: number, pageCount: number) {
    super(`Page index ${index} is out of range: document has ${pageCount} page(s), valid range is 0..${pageCount - 1}`)
    this.name = 'PdfPageIndexError'
    this.index = index
    this.pageCount = pageCount
  }
}

export type PdfRenderErrorKind =
  /** Tham số render không hợp lệ (scale, devicePixelRatio, canvas...). */
  | 'invalid-argument'
  /** Render bị hủy (chủ động hủy, hoặc bị render mới thay thế). */
  | 'cancelled'
  /** PDF.js render thất bại (lỗi gốc nằm trong cause). */
  | 'render-failed'

/** Lỗi của tầng render trang (TASK-06B). */
export class PdfRenderError extends Error {
  readonly kind: PdfRenderErrorKind

  constructor(kind: PdfRenderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfRenderError'
    this.kind = kind
  }
}

/** Nhận diện lỗi hủy render của PDF.js mà không phụ thuộc class của nó. */
export function isRenderingCancelledError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  return name === 'RenderingCancelledException' || name === 'AbortException'
}

interface PdfjsErrorLike {
  name?: string
  message?: string
}

/** Ánh xạ lỗi của PDF.js sang PdfLoadError có phân loại. */
export function classifyPdfError(error: unknown): PdfLoadError {
  if (error instanceof PdfLoadError) return error
  const like = (error ?? {}) as PdfjsErrorLike
  const name = typeof like.name === 'string' ? like.name : ''
  const message = typeof like.message === 'string' ? like.message : String(error)

  switch (name) {
    case 'PasswordException':
      return new PdfLoadError(
        'password',
        'This PDF is password-protected. Entering a password is not supported yet.',
        { cause: error },
      )
    case 'InvalidPDFException':
      return new PdfLoadError('corrupt', `The PDF file is invalid or corrupted: ${message}`, {
        cause: error,
      })
    case 'MissingPDFException':
      return new PdfLoadError('not-a-pdf', `The PDF data is missing or unreadable: ${message}`, {
        cause: error,
      })
    case 'UnexpectedResponseException':
      return new PdfLoadError('unsupported', `The PDF could not be processed: ${message}`, {
        cause: error,
      })
    case 'AbortException':
    case 'RenderingCancelledException':
      return new PdfLoadError('cancelled', 'PDF loading was cancelled.', { cause: error })
    default:
      break
  }
  if (/fake worker|worker.*(fail|load|start)|Setting up fake worker/i.test(message)) {
    return new PdfLoadError('worker', `The PDF worker failed to start: ${message}`, {
      cause: error,
    })
  }
  return new PdfLoadError('unknown', `Unexpected PDF error: ${message}`, { cause: error })
}

/**
 * Kiểm tra chữ ký PDF: theo đặc tả, "%PDF-" xuất hiện trong 1024
 * byte đầu (file thật có thể có dữ liệu rác/binary ở đầu). Không
 * thấy chữ ký thì chắc chắn không phải PDF.
 */
export function hasPdfSignature(data: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
  const limit = Math.min(data.length - signature.length, 1024)
  for (let offset = 0; offset <= limit; offset += 1) {
    let matches = true
    for (let i = 0; i < signature.length; i += 1) {
      if (data[offset + i] !== signature[i]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}
