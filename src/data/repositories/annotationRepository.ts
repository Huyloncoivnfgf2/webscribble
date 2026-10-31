/**
 * AnnotationRepository (TASK-08A): lưu annotation theo từng surface.
 * Mỗi surface là MỘT record độc lập, ghi bằng put (upsert theo
 * surfaceId) nên ghi nhiều lần không bao giờ tạo record trùng; thứ
 * tự objects được bảo toàn nguyên vẹn.
 *
 * Bảo vệ định dạng tương lai: nếu record đã lưu có schemaVersion
 * MỚI hơn app hiểu, cả đọc lẫn ghi đều từ chối bằng
 * UnsupportedAnnotationSchemaError và giữ nguyên dữ liệu gốc.
 */
import type { WebScribbleDatabase } from '../database'
import {
  ANNOTATION_SCHEMA_VERSION,
  UnsupportedAnnotationSchemaError,
  parseDocumentSurfaceId,
  type AnnotationSurfaceRecord,
  type SaveSurfaceInput,
} from '../types'

export interface AnnotationRepository {
  /**
   * Ghi toàn bộ annotation của một surface (thay thế record cũ).
   * updatedAt và schemaVersion do repository chốt. Ném
   * UnsupportedAnnotationSchemaError nếu record hiện có thuộc định
   * dạng mới hơn — dữ liệu gốc không bị ghi đè.
   */
  saveSurface(input: SaveSurfaceInput): Promise<AnnotationSurfaceRecord>
  /**
   * Đọc một surface; undefined nếu chưa có. Ném
   * UnsupportedAnnotationSchemaError nếu record thuộc định dạng mới
   * hơn app hiểu (dữ liệu giữ nguyên, không nạp).
   */
  getSurface(surfaceId: string): Promise<AnnotationSurfaceRecord | undefined>
  /** Mọi surface của một tài liệu, sắp theo pageIndex tăng dần. */
  getSurfacesByDocument(documentId: string): Promise<AnnotationSurfaceRecord[]>
  /** Xóa một surface; true nếu đã có record và đã xóa. */
  deleteSurface(surfaceId: string): Promise<boolean>
  /** Xóa toàn bộ annotation của một tài liệu; trả về số record đã xóa. */
  deleteByDocument(documentId: string): Promise<number>
}

function pageIndexOf(record: AnnotationSurfaceRecord): number {
  const parsed = parseDocumentSurfaceId(record.surfaceId)
  return parsed?.pageIndex ?? record.pageIndex
}

export class DexieAnnotationRepository implements AnnotationRepository {
  private readonly db: WebScribbleDatabase
  private readonly supportedVersion: number

  constructor(db: WebScribbleDatabase, supportedVersion: number = ANNOTATION_SCHEMA_VERSION) {
    this.db = db
    this.supportedVersion = supportedVersion
  }

  async saveSurface(input: SaveSurfaceInput): Promise<AnnotationSurfaceRecord> {
    const existing = await this.db.annotations.get(input.surfaceId)
    if (existing !== undefined && existing.schemaVersion > this.supportedVersion) {
      throw new UnsupportedAnnotationSchemaError(
        input.surfaceId,
        existing.schemaVersion,
        this.supportedVersion,
      )
    }
    const record: AnnotationSurfaceRecord = {
      surfaceId: input.surfaceId,
      documentId: input.documentId,
      pageIndex: input.pageIndex,
      objects: [...input.objects],
      updatedAt: Date.now(),
      schemaVersion: this.supportedVersion,
    }
    await this.db.annotations.put(record)
    return record
  }

  async getSurface(surfaceId: string): Promise<AnnotationSurfaceRecord | undefined> {
    const record = await this.db.annotations.get(surfaceId)
    if (record === undefined) return undefined
    if (record.schemaVersion > this.supportedVersion) {
      throw new UnsupportedAnnotationSchemaError(
        surfaceId,
        record.schemaVersion,
        this.supportedVersion,
      )
    }
    return record
  }

  async getSurfacesByDocument(documentId: string): Promise<AnnotationSurfaceRecord[]> {
    const records = await this.db.annotations.where('documentId').equals(documentId).toArray()
    for (const record of records) {
      if (record.schemaVersion > this.supportedVersion) {
        throw new UnsupportedAnnotationSchemaError(
          record.surfaceId,
          record.schemaVersion,
          this.supportedVersion,
        )
      }
    }
    return records.sort((a, b) => pageIndexOf(a) - pageIndexOf(b))
  }

  async deleteSurface(surfaceId: string): Promise<boolean> {
    const existing = await this.db.annotations.get(surfaceId)
    if (existing === undefined) return false
    await this.db.annotations.delete(surfaceId)
    return true
  }

  async deleteByDocument(documentId: string): Promise<number> {
    return this.db.annotations.where('documentId').equals(documentId).delete()
  }
}
