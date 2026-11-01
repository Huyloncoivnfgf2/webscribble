/**
 * Repository nền giấy (TASK-14C, DEC-035) — Dexie schema v3.
 *
 * Hai bảng tách bạch theo đúng bản chất dữ liệu:
 * - `documentBackgrounds`: nền theo TÀI LIỆU (PDF/DOCX dùng;
 *   whiteboard lưu nền từng trang trong manifest của nó nên
 *   không dùng bảng này).
 * - `backgroundImages`: Blob ảnh nền tải lên, khóa SUY DẪN
 *   `<documentId>:<slot>` — slot `main` cho nền tài liệu,
 *   `page-<i>` cho trang whiteboard i. Mọi bề mặt dùng chung.
 */
import type { WebScribbleDatabase } from '../database'
import {
  backgroundImageKey,
  normalizePaperBackground,
  type BackgroundImageRecord,
  type DocumentBackgroundRecord,
  type PaperBackground,
} from '../types'

export interface DocumentBackgroundRepository {
  /** Nền đã lưu của tài liệu, hoặc undefined nếu chưa từng đặt. */
  get(documentId: string): Promise<PaperBackground | undefined>
  /** Đặt nền cho tài liệu (chuẩn hóa trước khi lưu). */
  set(documentId: string, background: PaperBackground): Promise<void>
  /** Xóa bản ghi nền của tài liệu (không lỗi nếu không có). */
  delete(documentId: string): Promise<void>
}

export class DexieDocumentBackgroundRepository implements DocumentBackgroundRepository {
  private readonly db: WebScribbleDatabase

  constructor(db: WebScribbleDatabase) {
    this.db = db
  }

  async get(documentId: string): Promise<PaperBackground | undefined> {
    const record = await this.db.documentBackgrounds.get(documentId)
    if (record === undefined) return undefined
    return normalizePaperBackground(record.background)
  }

  async set(documentId: string, background: PaperBackground): Promise<void> {
    const record: DocumentBackgroundRecord = {
      documentId,
      background: normalizePaperBackground(background),
      updatedAt: Date.now(),
    }
    await this.db.documentBackgrounds.put(record)
  }

  async delete(documentId: string): Promise<void> {
    await this.db.documentBackgrounds.delete(documentId)
  }
}

export interface BackgroundImageRepository {
  /** Bản ghi ảnh tại đúng một slot, hoặc undefined. */
  get(documentId: string, slot: string): Promise<BackgroundImageRecord | undefined>
  /** Mọi ảnh nền của một tài liệu (mọi slot). */
  listForDocument(documentId: string): Promise<BackgroundImageRecord[]>
  /** Lưu/ghi đè ảnh tại một slot. */
  put(documentId: string, slot: string, blob: Blob): Promise<BackgroundImageRecord>
  /** Xóa ảnh tại một slot (không lỗi nếu không có). */
  delete(documentId: string, slot: string): Promise<void>
  /** Xóa mọi ảnh nền của một tài liệu. */
  deleteAllForDocument(documentId: string): Promise<void>
}

export class DexieBackgroundImageRepository implements BackgroundImageRepository {
  private readonly db: WebScribbleDatabase

  constructor(db: WebScribbleDatabase) {
    this.db = db
  }

  async get(
    documentId: string,
    slot: string,
  ): Promise<BackgroundImageRecord | undefined> {
    return this.db.backgroundImages.get(backgroundImageKey(documentId, slot))
  }

  async listForDocument(documentId: string): Promise<BackgroundImageRecord[]> {
    return this.db.backgroundImages.where('documentId').equals(documentId).toArray()
  }

  async put(
    documentId: string,
    slot: string,
    blob: Blob,
  ): Promise<BackgroundImageRecord> {
    const record: BackgroundImageRecord = {
      id: backgroundImageKey(documentId, slot),
      documentId,
      slot,
      mimeType: blob.type,
      size: blob.size,
      updatedAt: Date.now(),
      blob,
    }
    await this.db.backgroundImages.put(record)
    return record
  }

  async delete(documentId: string, slot: string): Promise<void> {
    await this.db.backgroundImages.delete(backgroundImageKey(documentId, slot))
  }

  async deleteAllForDocument(documentId: string): Promise<void> {
    await this.db.backgroundImages.where('documentId').equals(documentId).delete()
  }
}
