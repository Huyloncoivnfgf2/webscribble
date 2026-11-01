/**
 * Database IndexedDB duy nhất của WebScribble (TASK-08A), quản lý
 * bằng Dexie theo DEC-016. Hai lớp version tách bạch:
 * - Phiên bản schema Dexie (`db.version(n)`) — cấu trúc bảng/chỉ mục.
 * - `schemaVersion` trong từng bản ghi annotation — định dạng dữ
 *   liệu chú thích (xem types.ts).
 *
 * Lịch sử schema:
 * - v1 (TASK-08A): documents + annotations.
 * - v2 (TASK-07A): thêm documentContents (nội dung đã chuyển đổi
 *   của DOCX). Cộng thêm thuần túy — hai bảng v1 không đổi cấu
 *   trúc, dữ liệu v1 mở lên v2 nguyên vẹn.
 * - v3 (TASK-14C): thêm documentBackgrounds (nền theo tài liệu)
 *   và backgroundImages (Blob ảnh nền theo khóa suy dẫn). Cộng
 *   thêm thuần túy như v2 — dữ liệu cũ nguyên vẹn.
 */
import Dexie, { type EntityTable } from 'dexie'
import {
  DATABASE_NAME,
  type AnnotationSurfaceRecord,
  type BackgroundImageRecord,
  type DocumentBackgroundRecord,
  type DocumentContentRecord,
  type DocumentRecord,
} from './types'

export class WebScribbleDatabase extends Dexie {
  documents!: EntityTable<DocumentRecord, 'id'>
  annotations!: EntityTable<AnnotationSurfaceRecord, 'surfaceId'>
  documentContents!: EntityTable<DocumentContentRecord, 'documentId'>
  documentBackgrounds!: EntityTable<DocumentBackgroundRecord, 'documentId'>
  backgroundImages!: EntityTable<BackgroundImageRecord, 'id'>

  constructor(name: string = DATABASE_NAME) {
    super(name)
    // Schema v1:
    // - documents: khóa chính id; chỉ mục theo thời gian cho thư viện.
    // - annotations: khóa chính surfaceId; chỉ mục documentId để nạp
    //   và xóa toàn bộ chú thích của một tài liệu trong một truy vấn.
    this.version(1).stores({
      documents: 'id, createdAt, updatedAt',
      annotations: 'surfaceId, documentId',
    })
    // Schema v2 (TASK-07A):
    // - documentContents: khóa chính documentId (mỗi tài liệu một
    //   bản ghi nội dung); không cần chỉ mục phụ.
    // Lặp lại stores của v1 theo quy ước Dexie để nâng cấp cộng
    // thêm — không bảng nào bị xóa hay tái cấu trúc.
    this.version(2).stores({
      documents: 'id, createdAt, updatedAt',
      annotations: 'surfaceId, documentId',
      documentContents: 'documentId',
    })
    // Schema v3 (TASK-14C):
    // - documentBackgrounds: nền theo tài liệu, khóa documentId.
    // - backgroundImages: khóa suy dẫn <documentId>:<slot>; chỉ
    //   mục documentId để liệt kê/xóa cascade theo tài liệu.
    this.version(3).stores({
      documents: 'id, createdAt, updatedAt',
      annotations: 'surfaceId, documentId',
      documentContents: 'documentId',
      documentBackgrounds: 'documentId',
      backgroundImages: 'id, documentId',
    })
  }
}

/** Tạo một instance database (mặc định dùng DATABASE_NAME). */
export function createDatabase(name?: string): WebScribbleDatabase {
  return new WebScribbleDatabase(name)
}
