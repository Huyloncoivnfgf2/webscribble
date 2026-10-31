/**
 * Data Layer (TASK-08A): nền lưu trữ bền vững của WebScribble trên
 * Dexie/IndexedDB (DEC-016). Điểm vào duy nhất để Application Core
 * và Annotation Engine lấy repository, storage manager và autosave.
 */
export * from './types'
export * from './database'
export * from './backup/index'
export * from './repositories/documentRepository'
export * from './repositories/annotationRepository'
export * from './repositories/documentContentRepository'
export * from './storage/storageManager'
export * from './autosave/autosaveManager'

import { AutosaveManager } from './autosave/autosaveManager'
import { createDatabase, type WebScribbleDatabase } from './database'
import {
  DexieAnnotationRepository,
  type AnnotationRepository,
} from './repositories/annotationRepository'
import {
  DexieDocumentContentRepository,
  type DocumentContentRepository,
} from './repositories/documentContentRepository'
import {
  DexieDocumentRepository,
  type DocumentRepository,
} from './repositories/documentRepository'
import { StorageManager } from './storage/storageManager'

export interface StorageFoundation {
  db: WebScribbleDatabase
  documents: DocumentRepository
  annotations: AnnotationRepository
  /** Nội dung đã chuyển đổi của tài liệu (TASK-07A — DOCX). */
  contents: DocumentContentRepository
  storage: StorageManager
  /** Autosave đã nối sẵn vào AnnotationRepository.saveSurface. */
  autosave: AutosaveManager
}

/** Dựng toàn bộ nền lưu trữ trên một database (tạo mới nếu không truyền). */
export function createStorageFoundation(db: WebScribbleDatabase = createDatabase()): StorageFoundation {
  const documents = new DexieDocumentRepository(db)
  const annotations = new DexieAnnotationRepository(db)
  const contents = new DexieDocumentContentRepository(db)
  const storage = new StorageManager()
  const autosave = new AutosaveManager((input) => annotations.saveSurface(input))
  return { db, documents, annotations, contents, storage, autosave }
}
