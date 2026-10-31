/**
 * Lỗi của Annotation Engine (TASK-06C) — phân loại rõ ràng, luôn
 * mang surfaceId liên quan và giữ lỗi gốc trong `cause` khi có.
 */
export type AnnotationErrorKind =
  /** Mở một surface đang được một session khác của engine quản lý. */
  | 'already-open'
  /** Thao tác trên session đã đóng. */
  | 'closed'
  /** Dữ liệu annotation đã lưu không hợp lệ (xem AnnotationDataError). */
  | 'invalid-data'
  /** Repository/IndexedDB thất bại khi nạp hoặc lưu. */
  | 'persistence'

export class AnnotationError extends Error {
  readonly kind: AnnotationErrorKind
  readonly surfaceId: string | null

  constructor(
    kind: AnnotationErrorKind,
    message: string,
    options: { surfaceId?: string; cause?: unknown } = {},
  ) {
    super(message, options)
    this.name = 'AnnotationError'
    this.kind = kind
    this.surfaceId = options.surfaceId ?? null
  }
}

/**
 * Dữ liệu annotation không qua được validation của Drawing Engine
 * hoặc không khớp surface. Engine KHÔNG nạp một phần và KHÔNG ghi
 * đè bản lưu — lỗi này được ném ra để tầng trên quyết định, dữ liệu
 * gốc trong repository còn nguyên.
 */
export class AnnotationDataError extends AnnotationError {
  /** Vị trí của object lỗi trong mảng đã lưu (null nếu lỗi ở cấp record). */
  readonly objectIndex: number | null
  /** ID của object lỗi nếu đọc được. */
  readonly objectId: string | null
  /** Danh sách vấn đề do bộ validate của Drawing Engine báo. */
  readonly problems: readonly string[]

  constructor(options: {
    surfaceId: string
    objectIndex: number | null
    objectId: string | null
    problems: readonly string[]
    cause?: unknown
  }) {
    const where =
      options.objectIndex === null
        ? 'the surface record'
        : `object #${options.objectIndex}${options.objectId ? ` (${options.objectId})` : ''}`
    super(
      'invalid-data',
      `Invalid annotation data in ${where} of surface ${options.surfaceId}: ${options.problems.join('; ')}`,
      { surfaceId: options.surfaceId, cause: options.cause },
    )
    this.name = 'AnnotationDataError'
    this.objectIndex = options.objectIndex
    this.objectId = options.objectId
    this.problems = options.problems
  }
}
