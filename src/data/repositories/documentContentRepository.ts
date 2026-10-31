/**
 * DocumentContentRepository (TASK-07A): lưu MÔ HÌNH NỘI DUNG đã
 * chuyển đổi của tài liệu (hiện cho DOCX) — tách khỏi Blob gốc ở
 * DocumentRepository. Mỗi tài liệu tối đa một bản ghi nội dung,
 * khóa chính documentId. Ghi là put nguyên tử theo documentId.
 *
 * Bảo vệ phiên bản: nếu bản ghi hiện có (hoặc bản ghi sắp ghi)
 * mang contentVersion MỚI hơn app hiểu, repository từ chối đọc/
 * ghi bằng UnsupportedContentVersionError và giữ nguyên dữ
 * liệu — cùng chính sách với AnnotationRepository.
 */
import type { WebScribbleDatabase } from '../database'
import {
  DOCUMENT_CONTENT_VERSION,
  UnsupportedContentVersionError,
  type DocumentContentRecord,
  type SaveDocumentContentInput,
} from '../types'

export interface DocumentContentRepository {
  /** Lưu (tạo mới hoặc thay thế) nội dung của một tài liệu. */
  saveContent(input: SaveDocumentContentInput): Promise<DocumentContentRecord>
  /** Nội dung đã lưu, hoặc undefined nếu tài liệu chưa có nội dung. */
  getContent(documentId: string): Promise<DocumentContentRecord | undefined>
  /** Xóa nội dung của một tài liệu (xóa tài liệu đi qua cascade ở DocumentRepository). */
  deleteContent(documentId: string): Promise<void>
}

export class DexieDocumentContentRepository implements DocumentContentRepository {
  private readonly db: WebScribbleDatabase
  private readonly supportedVersion: number

  constructor(db: WebScribbleDatabase, supportedVersion: number = DOCUMENT_CONTENT_VERSION) {
    this.db = db
    this.supportedVersion = supportedVersion
  }

  async saveContent(input: SaveDocumentContentInput): Promise<DocumentContentRecord> {
    const version = input.contentVersion ?? this.supportedVersion
    if (version > this.supportedVersion) {
      throw new UnsupportedContentVersionError(input.documentId, version, this.supportedVersion)
    }
    const existing = await this.db.documentContents.get(input.documentId)
    if (existing !== undefined && existing.contentVersion > this.supportedVersion) {
      throw new UnsupportedContentVersionError(
        input.documentId,
        existing.contentVersion,
        this.supportedVersion,
      )
    }
    const record: DocumentContentRecord = {
      documentId: input.documentId,
      contentVersion: version,
      content: input.content,
      updatedAt: Date.now(),
    }
    await this.db.documentContents.put(record)
    return record
  }

  async getContent(documentId: string): Promise<DocumentContentRecord | undefined> {
    const record = await this.db.documentContents.get(documentId)
    if (record !== undefined && record.contentVersion > this.supportedVersion) {
      throw new UnsupportedContentVersionError(
        documentId,
        record.contentVersion,
        this.supportedVersion,
      )
    }
    return record
  }

  async deleteContent(documentId: string): Promise<void> {
    await this.db.documentContents.delete(documentId)
  }
}
