/**
 * DocumentRepository (TASK-08A): lưu file gốc + metadata tài liệu.
 * Mỗi lần nhập tạo một documentId MỚI (crypto.randomUUID) — kể cả
 * khi nội dung file trùng với tài liệu đã có (quyết định QA-B: không
 * băm, không gộp, không tái sử dụng chú thích giữa hai lần nhập).
 * Blob gốc được lưu nguyên vẹn và không bao giờ bị ghi đè.
 */
import type { WebScribbleDatabase } from '../database'
import type {
  CreateDocumentInput,
  DocumentMetadata,
  DocumentMetadataChanges,
  DocumentRecord,
} from '../types'

export interface DocumentRepository {
  /** Nhập một file mới; trả về bản ghi đầy đủ đã lưu. */
  create(input: CreateDocumentInput): Promise<DocumentRecord>
  /** Bản ghi đầy đủ (gồm Blob) hoặc undefined nếu không tồn tại. */
  getById(id: string): Promise<DocumentRecord | undefined>
  /** Chỉ Blob gốc, hoặc undefined nếu không tồn tại. */
  getBlob(id: string): Promise<Blob | undefined>
  /** Metadata của mọi tài liệu (không kèm Blob), mới nhất trước. */
  list(): Promise<DocumentMetadata[]>
  /**
   * Cập nhật metadata (tên/số trang). Không đụng vào Blob và không
   * đụng vào annotation. Trả về metadata mới, hoặc undefined nếu
   * tài liệu không tồn tại.
   */
  updateMetadata(
    id: string,
    changes: DocumentMetadataChanges,
  ): Promise<DocumentMetadata | undefined>
  /**
   * Thay thế Blob của tài liệu (TASK-12: bảng trắng lưu
   * manifest trang trong chính Blob của nó — với tài liệu
   * PDF/DOCX, Blob là file gốc và KHÔNG được gọi hàm này).
   * Cập nhật size + updatedAt; giữ nguyên mọi metadata khác.
   */
  replaceBlob(id: string, blob: Blob): Promise<DocumentMetadata | undefined>
  /**
   * Xóa tài liệu VÀ toàn bộ annotation VÀ nội dung đã chuyển
   * đổi của nó trong CÙNG một transaction (cascade đầy đủ —
   * TASK-07A bổ sung documentContents). Trả về true nếu tài
   * liệu tồn tại và đã xóa.
   */
  delete(id: string): Promise<boolean>
}

function toMetadata(record: DocumentRecord): DocumentMetadata {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    pageCount: record.pageCount,
  }
}

export class DexieDocumentRepository implements DocumentRepository {
  private readonly db: WebScribbleDatabase

  constructor(db: WebScribbleDatabase) {
    this.db = db
  }
  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const now = Date.now()
    const record: DocumentRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      mimeType: input.mimeType,
      size: input.blob.size,
      createdAt: now,
      updatedAt: now,
      pageCount: input.pageCount ?? null,
      blob: input.blob,
    }
    await this.db.documents.add(record)
    return record
  }

  async getById(id: string): Promise<DocumentRecord | undefined> {
    return this.db.documents.get(id)
  }

  async getBlob(id: string): Promise<Blob | undefined> {
    const record = await this.db.documents.get(id)
    return record?.blob
  }

  async list(): Promise<DocumentMetadata[]> {
    const records = await this.db.documents.orderBy('createdAt').reverse().toArray()
    return records.map(toMetadata)
  }

  async updateMetadata(
    id: string,
    changes: DocumentMetadataChanges,
  ): Promise<DocumentMetadata | undefined> {
    const existing = await this.db.documents.get(id)
    if (existing === undefined) return undefined
    const updated: DocumentRecord = {
      ...existing,
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.pageCount !== undefined ? { pageCount: changes.pageCount } : {}),
      updatedAt: Date.now(),
    }
    await this.db.documents.put(updated)
    return toMetadata(updated)
  }

  async replaceBlob(id: string, blob: Blob): Promise<DocumentMetadata | undefined> {
    const existing = await this.db.documents.get(id)
    if (existing === undefined) return undefined
    const updated: DocumentRecord = {
      ...existing,
      blob,
      size: blob.size,
      updatedAt: Date.now(),
    }
    await this.db.documents.put(updated)
    return toMetadata(updated)
  }

  async delete(id: string): Promise<boolean> {
    return this.db.transaction(
      'rw',
      this.db.documents,
      this.db.annotations,
      this.db.documentContents,
      async () => {
        const existing = await this.db.documents.get(id)
        if (existing === undefined) return false
        await this.db.annotations.where('documentId').equals(id).delete()
        await this.db.documentContents.delete(id)
        await this.db.documents.delete(id)
        return true
      },
    )
  }
}
