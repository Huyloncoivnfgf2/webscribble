/**
 * Kiểu dữ liệu của Data Layer (TASK-08A).
 *
 * Nguyên tắc ranh giới: Data Layer lưu dữ liệu ĐÃ SERIALIZE và không
 * phụ thuộc vào nghiệp vụ của Drawing Engine. Vì vậy `objects` của
 * bản ghi annotation được giữ ở dạng `unknown[]` tại tầng này — việc
 * kiểm tra từng DrawingObject thuộc về Annotation Engine (TASK-06C)
 * dùng `validateDrawingObject` của Drawing Engine. Repository chỉ
 * bảo toàn nguyên vẹn những gì được đưa vào.
 */

/** Phiên bản định dạng dữ liệu annotation mà app hiện hiểu. */
export const ANNOTATION_SCHEMA_VERSION = 1

/**
 * Phiên bản định dạng MÔ HÌNH NỘI DUNG tài liệu (TASK-07A) mà app
 * hiện hiểu — tách bạch với phiên bản schema Dexie, cùng nguyên
 * tắc với `ANNOTATION_SCHEMA_VERSION`. Word Engine sở hữu cấu
 * trúc nội dung; Data Layer chỉ bảo toàn và chặn ghi đè khi gặp
 * định dạng mới hơn.
 */
export const DOCUMENT_CONTENT_VERSION = 2

/** Tên database IndexedDB duy nhất của WebScribble. */
export const DATABASE_NAME = 'webscribble'

/** Bản ghi tài liệu đầy đủ, gồm cả Blob gốc nguyên vẹn. */
export interface DocumentRecord {
  id: string
  name: string
  mimeType: string
  /** Kích thước Blob theo byte, ghi lại lúc nhập để liệt kê nhanh. */
  size: number
  createdAt: number
  updatedAt: number
  /** Số trang nếu đã xác định (PDF), null nếu chưa biết. */
  pageCount: number | null
  blob: Blob
}

/** Metadata tài liệu — không kèm Blob, dùng cho danh sách thư viện. */
export type DocumentMetadata = Omit<DocumentRecord, 'blob'>

/** Dữ liệu cần để tạo tài liệu mới (id và timestamp do repository sinh). */
export interface CreateDocumentInput {
  name: string
  mimeType: string
  blob: Blob
  pageCount?: number | null
}

/** Các trường metadata được phép cập nhật — Blob gốc không bao giờ đổi. */
export interface DocumentMetadataChanges {
  name?: string
  pageCount?: number | null
}

/**
 * Bản ghi annotation của ĐÚNG MỘT surface (một trang tài liệu).
 * Mỗi lần ghi thay thế toàn bộ record theo `surfaceId` (put), không
 * append. `objects` giữ tọa độ dữ liệu của Drawing Engine (world /
 * page coordinates), không bao giờ là pixel màn hình.
 */
export interface AnnotationSurfaceRecord {
  surfaceId: string
  documentId: string
  /** Chỉ số trang, zero-based (thống nhất với PDF Engine). */
  pageIndex: number
  objects: readonly unknown[]
  updatedAt: number
  /** Phiên bản ĐỊNH DẠNG annotation — khác với phiên bản schema Dexie. */
  schemaVersion: number
}

/** Dữ liệu cần để ghi một surface (updatedAt/schemaVersion do repository chốt). */
export interface SaveSurfaceInput {
  surfaceId: string
  documentId: string
  pageIndex: number
  objects: readonly unknown[]
}

/**
 * Quy ước định danh bề mặt tài liệu (ARCHITECTURE 2.4):
 * `document:<documentId>:<pageIndex>` — tất định, suy ra từ documentId
 * và chỉ số trang, không sinh ngẫu nhiên nên không bao giờ tạo trùng.
 */
export function documentSurfaceId(documentId: string, pageIndex: number): string {
  if (documentId.length === 0) {
    throw new Error('documentSurfaceId: documentId must not be empty')
  }
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error(`documentSurfaceId: pageIndex must be a non-negative integer, got ${pageIndex}`)
  }
  return `document:${documentId}:${pageIndex}`
}

/** Tách một surfaceId của tài liệu thành phần; null nếu không đúng quy ước. */
export function parseDocumentSurfaceId(
  surfaceId: string,
): { documentId: string; pageIndex: number } | null {
  const match = /^document:(.+):(\d+)$/.exec(surfaceId)
  if (match === null) return null
  return { documentId: match[1], pageIndex: Number(match[2]) }
}

/**
 * Lỗi khi dữ liệu annotation thuộc định dạng MỚI hơn app hiểu. Dữ
 * liệu gốc luôn được giữ nguyên — tầng trên quyết định cách báo cho
 * người dùng; repository không nạp, không ghi đè.
 */
export class UnsupportedAnnotationSchemaError extends Error {
  readonly surfaceId: string
  readonly foundVersion: number
  readonly supportedVersion: number

  constructor(surfaceId: string, foundVersion: number, supportedVersion: number) {
    super(
      `Annotation surface "${surfaceId}" uses schema version ${foundVersion}, ` +
        `but this app supports up to ${supportedVersion}. Data was left untouched.`,
    )
    this.name = 'UnsupportedAnnotationSchemaError'
    this.surfaceId = surfaceId
    this.foundVersion = foundVersion
    this.supportedVersion = supportedVersion
  }
}

/**
 * Bản ghi NỘI DUNG ĐÃ CHUYỂN ĐỔI của một tài liệu (TASK-07A) —
 * hiện dùng cho DOCX: nội dung sửa được do Word Engine sở hữu.
 * Cùng nguyên tắc ranh giới với annotation: `content` giữ dạng
 * `unknown` tại Data Layer; việc kiểm tra cấu trúc thuộc về
 * Word Engine. File gốc vẫn nằm ở bảng `documents`, không bao
 * giờ bị thay bởi nội dung này.
 */
export interface DocumentContentRecord {
  documentId: string
  /** Phiên bản định dạng mô hình nội dung (DOCUMENT_CONTENT_VERSION). */
  contentVersion: number
  content: unknown
  updatedAt: number
}

/** Dữ liệu cần để lưu nội dung của một tài liệu. */
export interface SaveDocumentContentInput {
  documentId: string
  content: unknown
  contentVersion?: number
}

/**
 * Lỗi khi nội dung tài liệu thuộc định dạng MỚI hơn app hiểu.
 * Dữ liệu gốc luôn được giữ nguyên — repository không nạp,
 * không ghi đè.
 */
export class UnsupportedContentVersionError extends Error {
  readonly documentId: string
  readonly foundVersion: number
  readonly supportedVersion: number

  constructor(documentId: string, foundVersion: number, supportedVersion: number) {
    super(
      `Document content "${documentId}" uses content version ${foundVersion}, ` +
        `but this app supports up to ${supportedVersion}. Data was left untouched.`,
    )
    this.name = 'UnsupportedContentVersionError'
    this.documentId = documentId
    this.foundVersion = foundVersion
    this.supportedVersion = supportedVersion
  }
}
