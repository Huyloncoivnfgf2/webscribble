import JSZip from 'jszip'
import type { WebScribbleDatabase } from '../database'
import {
  ANNOTATION_SCHEMA_VERSION,
  backgroundImageKey,
  DOCUMENT_CONTENT_VERSION,
  documentSurfaceId,
  parseDocumentSurfaceId,
  type AnnotationSurfaceRecord,
  type BackgroundImageRecord,
  type DocumentBackgroundRecord,
  type DocumentContentRecord,
  type DocumentRecord,
} from '../types'

/**
 * Backup & Restore toàn bộ thư viện (TASK-08C, DEC-027).
 *
 * Định dạng: một file ZIP (JSZip, đóng gói local — không
 * CDN) gồm:
 *   manifest.json          — mô tả + thống kê + checksum
 *   data/annotations.json  — mọi AnnotationSurfaceRecord
 *   data/contents.json     — mọi DocumentContentRecord
 *   files/<documentId>     — bytes Blob gốc, nguyên vẹn
 *   data/backgrounds.json  — nền theo tài liệu + mô tả ảnh nền
 *                            (TASK-14C; file TÙY CHỌN — backup
 *                            cũ không có vẫn khôi phục được)
 *   background-images/<documentId>/<slot> — bytes ảnh nền
 *
 * `backupFormatVersion` ĐỘC LẬP với phiên bản schema Dexie
 * và với schemaVersion của từng loại record. Toàn vẹn bằng
 * SHA-256 (Web Crypto) cho TỪNG file thành phần: restore
 * kiểm tra toàn bộ TRƯỚC khi ghi bất cứ thứ gì.
 *
 * Chính sách restore: MERGE AN TOÀN — không bao giờ ghi đè
 * và không xóa dữ liệu hiện có. Document trùng ID được nhập
 * thành bản sao với ID mới, và MỌI tham chiếu (annotation
 * documentId + surfaceId, documentContents documentId)
 * được remap nhất quán trong cùng một transaction nguyên
 * tử: transaction lỗi → thư viện giữ nguyên trạng thái cũ.
 */

export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_APP_TAG = 'webscribble'

const MANIFEST_PATH = 'manifest.json'
const ANNOTATIONS_PATH = 'data/annotations.json'
const CONTENTS_PATH = 'data/contents.json'
const BACKGROUNDS_PATH = 'data/backgrounds.json'
const blobPathFor = (documentId: string) => `files/${documentId}`
const backgroundImagePathFor = (documentId: string, slot: string) =>
  `background-images/${documentId}/${slot}`

/** Một ảnh nền trong backup: mô tả ở backgrounds.json, bytes ở file riêng. */
export interface BackupBackgroundImageEntry {
  id: string
  documentId: string
  slot: string
  mimeType: string
  size: number
  path: string
  sha256: string
}

/** Nội dung data/backgrounds.json. */
export interface BackupBackgroundsFile {
  settings: DocumentBackgroundRecord[]
  images: BackupBackgroundImageEntry[]
}

export type BackupErrorKind =
  | 'not-a-backup'
  | 'incompatible-version'
  | 'corrupt'
  | 'checksum-mismatch'
  | 'invalid-data'
  | 'quota'
  | 'write-failed'
  | 'create-failed'

const USER_MESSAGES: Record<BackupErrorKind, string> = {
  'not-a-backup': 'File đã chọn không phải là bản sao lưu của WebScribble.',
  'incompatible-version':
    'Bản sao lưu này thuộc định dạng mới hơn phiên bản WebScribble hiện tại. Hãy cập nhật ứng dụng rồi thử lại.',
  corrupt: 'File sao lưu bị hỏng hoặc thiếu dữ liệu.',
  'checksum-mismatch':
    'File sao lưu không còn nguyên vẹn (kiểm tra toàn vẹn không khớp). WebScribble từ chối khôi phục để bảo vệ thư viện hiện tại.',
  'invalid-data': 'Dữ liệu trong bản sao lưu không nhất quán nên không thể khôi phục.',
  quota:
    'Không đủ dung lượng lưu trữ trên thiết bị để khôi phục. Hãy giải phóng bộ nhớ rồi thử lại.',
  'write-failed': 'Khôi phục thất bại giữa chừng. Thư viện hiện tại vẫn nguyên vẹn.',
  'create-failed': 'Không tạo được bản sao lưu. Hãy thử lại.',
}

export class BackupError extends Error {
  readonly kind: BackupErrorKind
  readonly userMessage: string

  constructor(kind: BackupErrorKind, options: { cause?: unknown } = {}) {
    super(`Backup error (${kind}).`)
    this.name = 'BackupError'
    this.kind = kind
    this.userMessage = USER_MESSAGES[kind]
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface BackupDocumentEntry {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: number
  updatedAt: number
  pageCount: number | null
  blobPath: string
  blobSha256: string
}

export interface BackupManifest {
  app: typeof BACKUP_APP_TAG
  backupFormatVersion: number
  createdAt: string
  /** Phiên bản schema Dexie tại thời điểm sao lưu (chỉ để tham khảo). */
  databaseSchemaVersion: number
  counts: {
    documents: number
    annotations: number
    documentContents: number
    /** TASK-14C: tùy chọn — backup cũ không có hai trường này. */
    backgrounds?: number
    backgroundImages?: number
  }
  documents: BackupDocumentEntry[]
  annotationsFile: { path: string; sha256: string }
  contentsFile: { path: string; sha256: string }
  /** TASK-14C: tùy chọn — vắng mặt ở backup trước TASK-14C. */
  backgroundsFile?: { path: string; sha256: string }
}

export interface BackupSummary {
  createdAt: string
  counts: {
    documents: number
    annotations: number
    documentContents: number
    backgrounds?: number
    backgroundImages?: number
  }
  totalBlobBytes: number
}

/** Toàn bộ dữ liệu đã kiểm chứng của một bản sao lưu, sẵn sàng để ghi. */
export interface PreparedRestore {
  manifest: BackupManifest
  summary: BackupSummary
  documents: Array<{ entry: BackupDocumentEntry; blobBytes: Uint8Array }>
  annotations: AnnotationSurfaceRecord[]
  contents: DocumentContentRecord[]
  /** TASK-14C: rỗng với backup cũ. */
  backgrounds: DocumentBackgroundRecord[]
  backgroundImages: Array<{ entry: BackupBackgroundImageEntry; bytes: Uint8Array }>
}

export interface RestoreReport {
  importedDocuments: number
  importedAnnotations: number
  importedContents: number
  importedBackgrounds: number
  importedBackgroundImages: number
  /** Số document phải đổi ID mới vì trùng với thư viện hiện tại. */
  remappedDocuments: number
}

export type BackupProgressStage = 'preparing' | 'archiving'

function backupFileName(createdAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${createdAt.getFullYear()}${pad(createdAt.getMonth() + 1)}${pad(createdAt.getDate())}`
  const time = `${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}`
  return `webscribble-backup-${date}-${time}.zip`
}

export interface CreateBackupResult {
  blob: Blob
  fileName: string
  manifest: BackupManifest
}

/**
 * Tạo archive sao lưu từ database hiện tại. Chỉ ĐỌC dữ
 * liệu — không sửa/xóa bất cứ thứ gì. Blob được đưa vào
 * archive theo từng tài liệu (không nối chuỗi trong bộ
 * nhớ); JSZip vật chất hóa toàn bộ archive một lần khi
 * generate — giới hạn đã ghi nhận cho thư viện rất lớn.
 */
export async function createBackupArchive(
  db: WebScribbleDatabase,
  options: {
    now?: Date
    onProgress?: (stage: BackupProgressStage, percent?: number) => void
  } = {},
): Promise<CreateBackupResult> {
  try {
    options.onProgress?.('preparing')
    const documents = await db.documents.toArray()
    const annotations = await db.annotations.toArray()
    const contents = await db.documentContents.toArray()
    const backgroundSettings = await db.documentBackgrounds.toArray()
    const backgroundImageRecords = await db.backgroundImages.toArray()

    const encoder = new TextEncoder()
    const annotationsBytes = encoder.encode(JSON.stringify(annotations))
    const contentsBytes = encoder.encode(JSON.stringify(contents))

    const zip = new JSZip()
    const bgImageEntries: BackupBackgroundImageEntry[] = []
    for (const record of backgroundImageRecords) {
      const bytes = new Uint8Array(await record.blob.arrayBuffer())
      const path = backgroundImagePathFor(record.documentId, record.slot)
      zip.file(path, bytes)
      bgImageEntries.push({
        id: record.id,
        documentId: record.documentId,
        slot: record.slot,
        mimeType: record.mimeType,
        size: record.size,
        path,
        sha256: await sha256Hex(bytes),
      })
    }
    const backgroundsFileData: BackupBackgroundsFile = {
      settings: backgroundSettings,
      images: bgImageEntries,
    }
    const backgroundsBytes = encoder.encode(JSON.stringify(backgroundsFileData))
    zip.file(BACKGROUNDS_PATH, backgroundsBytes)
    const entries: BackupDocumentEntry[] = []
    for (const doc of documents) {
      const bytes = new Uint8Array(await doc.blob.arrayBuffer())
      const path = blobPathFor(doc.id)
      zip.file(path, bytes)
      entries.push({
        id: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        size: doc.size,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        pageCount: doc.pageCount,
        blobPath: path,
        blobSha256: await sha256Hex(bytes),
      })
    }
    zip.file(ANNOTATIONS_PATH, annotationsBytes)
    zip.file(CONTENTS_PATH, contentsBytes)

    const createdAtDate = options.now ?? new Date()
    const manifest: BackupManifest = {
      app: BACKUP_APP_TAG,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      createdAt: createdAtDate.toISOString(),
      databaseSchemaVersion: db.verno,
      counts: {
        documents: documents.length,
        annotations: annotations.length,
        documentContents: contents.length,
        backgrounds: backgroundSettings.length,
        backgroundImages: backgroundImageRecords.length,
      },
      documents: entries,
      annotationsFile: { path: ANNOTATIONS_PATH, sha256: await sha256Hex(annotationsBytes) },
      contentsFile: { path: CONTENTS_PATH, sha256: await sha256Hex(contentsBytes) },
      backgroundsFile: { path: BACKGROUNDS_PATH, sha256: await sha256Hex(backgroundsBytes) },
    }
    zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

    options.onProgress?.('archiving', 0)
    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'STORE' },
      (meta) => options.onProgress?.('archiving', Math.round(meta.percent)),
    )
    return { blob, fileName: backupFileName(createdAtDate), manifest }
  } catch (cause) {
    if (cause instanceof BackupError) throw cause
    throw new BackupError('create-failed', { cause })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(message: string): BackupError {
  return new BackupError('invalid-data', { cause: new Error(message) })
}

/**
 * GIAI ĐOẠN A của restore: mở archive và kiểm chứng TOÀN
 * BỘ (định dạng, manifest, version, cấu trúc, quan hệ,
 * checksum từng file) mà KHÔNG ghi gì vào database. Đạt
 * mới trả PreparedRestore cho giai đoạn ghi.
 */
export async function inspectBackupArchive(data: ArrayBuffer): Promise<PreparedRestore> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch (cause) {
    throw new BackupError('not-a-backup', { cause })
  }
  const manifestFile = zip.file(MANIFEST_PATH)
  if (manifestFile === null) throw new BackupError('not-a-backup')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as BackupManifest
  } catch (cause) {
    throw new BackupError('corrupt', { cause })
  }
  if (!isRecord(manifest) || manifest.app !== BACKUP_APP_TAG) {
    throw new BackupError('not-a-backup')
  }
  if (manifest.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupError('incompatible-version')
  }
  if (
    typeof manifest.createdAt !== 'string' ||
    !isRecord(manifest.counts) ||
    !Array.isArray(manifest.documents) ||
    !isRecord(manifest.annotationsFile) ||
    !isRecord(manifest.contentsFile)
  ) {
    throw invalid('Manifest thiếu trường bắt buộc.')
  }

  // Đọc + kiểm checksum hai file JSON dữ liệu:
  const readCheckedJson = async (
    spec: { path: string; sha256: string },
    label: string,
  ): Promise<unknown> => {
    const file = zip.file(spec.path)
    if (file === null) throw new BackupError('corrupt')
    const bytes = await file.async('uint8array')
    if ((await sha256Hex(bytes)) !== spec.sha256) {
      throw new BackupError('checksum-mismatch', { cause: new Error(label) })
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch (cause) {
      throw new BackupError('corrupt', { cause })
    }
  }
  const annotationsRaw = await readCheckedJson(manifest.annotationsFile, 'annotations')
  const contentsRaw = await readCheckedJson(manifest.contentsFile, 'contents')
  if (!Array.isArray(annotationsRaw) || !Array.isArray(contentsRaw)) {
    throw invalid('annotations/contents phải là mảng.')
  }

  // Tài liệu: cấu trúc + ID duy nhất + blob tồn tại, đúng
  // kích thước và checksum:
  const documentIds = new Set<string>()
  const documents: PreparedRestore['documents'] = []
  let totalBlobBytes = 0
  for (const entry of manifest.documents) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.mimeType !== 'string' ||
      typeof entry.size !== 'number' ||
      typeof entry.createdAt !== 'number' ||
      typeof entry.updatedAt !== 'number' ||
      typeof entry.blobPath !== 'string' ||
      typeof entry.blobSha256 !== 'string'
    ) {
      throw invalid('Một document trong manifest thiếu trường bắt buộc.')
    }
    if (documentIds.has(entry.id)) throw invalid(`Trùng document id trong backup: ${entry.id}`)
    documentIds.add(entry.id)
    const blobFile = zip.file(entry.blobPath)
    if (blobFile === null) throw new BackupError('corrupt')
    const blobBytes = await blobFile.async('uint8array')
    if (blobBytes.length !== entry.size) throw new BackupError('corrupt')
    if ((await sha256Hex(blobBytes)) !== entry.blobSha256) {
      throw new BackupError('checksum-mismatch', { cause: new Error(entry.id) })
    }
    totalBlobBytes += blobBytes.length
    documents.push({ entry: entry as BackupDocumentEntry, blobBytes })
  }

  // Annotation: cấu trúc + version + surface nhất quán +
  // không mồ côi + không trùng surface:
  const surfaceIds = new Set<string>()
  const annotations: AnnotationSurfaceRecord[] = []
  for (const raw of annotationsRaw) {
    if (
      !isRecord(raw) ||
      typeof raw.surfaceId !== 'string' ||
      typeof raw.documentId !== 'string' ||
      typeof raw.pageIndex !== 'number' ||
      !Array.isArray(raw.objects) ||
      typeof raw.schemaVersion !== 'number' ||
      typeof raw.updatedAt !== 'number'
    ) {
      throw invalid('Một annotation trong backup thiếu trường bắt buộc.')
    }
    if (raw.schemaVersion > ANNOTATION_SCHEMA_VERSION) {
      throw new BackupError('incompatible-version')
    }
    const parsed = parseDocumentSurfaceId(raw.surfaceId)
    if (
      parsed === null ||
      parsed.documentId !== raw.documentId ||
      parsed.pageIndex !== raw.pageIndex
    ) {
      throw invalid(`surfaceId không nhất quán: ${raw.surfaceId}`)
    }
    if (!documentIds.has(raw.documentId)) {
      throw invalid(`Annotation mồ côi trong backup (document ${raw.documentId} không tồn tại).`)
    }
    if (surfaceIds.has(raw.surfaceId)) throw invalid(`Trùng surfaceId trong backup: ${raw.surfaceId}`)
    surfaceIds.add(raw.surfaceId)
    annotations.push(raw as unknown as AnnotationSurfaceRecord)
  }

  // Contents: cấu trúc + version + gắn đúng document:
  const contents: DocumentContentRecord[] = []
  const contentDocIds = new Set<string>()
  for (const raw of contentsRaw) {
    if (
      !isRecord(raw) ||
      typeof raw.documentId !== 'string' ||
      typeof raw.contentVersion !== 'number' ||
      !('content' in raw) ||
      typeof raw.updatedAt !== 'number'
    ) {
      throw invalid('Một documentContent trong backup thiếu trường bắt buộc.')
    }
    if (raw.contentVersion > DOCUMENT_CONTENT_VERSION) {
      throw new BackupError('incompatible-version')
    }
    if (!documentIds.has(raw.documentId)) {
      throw invalid(`documentContent mồ côi trong backup (document ${raw.documentId}).`)
    }
    if (contentDocIds.has(raw.documentId)) {
      throw invalid(`Trùng documentContent trong backup: ${raw.documentId}`)
    }
    contentDocIds.add(raw.documentId)
    contents.push(raw as unknown as DocumentContentRecord)
  }

  // Nền + ảnh nền (TASK-14C): phần TÙY CHỌN — backup cũ
  // không có backgroundsFile thì coi như không có nền nào.
  const backgrounds: DocumentBackgroundRecord[] = []
  const backgroundImages: PreparedRestore['backgroundImages'] = []
  if (manifest.backgroundsFile !== undefined) {
    if (!isRecord(manifest.backgroundsFile)) {
      throw invalid('backgroundsFile trong manifest không hợp lệ.')
    }
    const backgroundsRaw = await readCheckedJson(manifest.backgroundsFile, 'backgrounds')
    if (
      !isRecord(backgroundsRaw) ||
      !Array.isArray(backgroundsRaw.settings) ||
      !Array.isArray(backgroundsRaw.images)
    ) {
      throw invalid('backgrounds.json phải gồm settings + images dạng mảng.')
    }
    for (const raw of backgroundsRaw.settings) {
      if (
        !isRecord(raw) ||
        typeof raw.documentId !== 'string' ||
        !isRecord(raw.background) ||
        typeof raw.updatedAt !== 'number'
      ) {
        throw invalid('Một bản ghi nền trong backup thiếu trường bắt buộc.')
      }
      if (!documentIds.has(raw.documentId)) {
        throw invalid(`Nền mồ côi trong backup (document ${raw.documentId}).`)
      }
      backgrounds.push(raw as unknown as DocumentBackgroundRecord)
    }
    const imageIds = new Set<string>()
    for (const raw of backgroundsRaw.images) {
      if (
        !isRecord(raw) ||
        typeof raw.id !== 'string' ||
        typeof raw.documentId !== 'string' ||
        typeof raw.slot !== 'string' ||
        typeof raw.mimeType !== 'string' ||
        typeof raw.size !== 'number' ||
        typeof raw.path !== 'string' ||
        typeof raw.sha256 !== 'string'
      ) {
        throw invalid('Một mô tả ảnh nền trong backup thiếu trường bắt buộc.')
      }
      if (!documentIds.has(raw.documentId)) {
        throw invalid(`Ảnh nền mồ côi trong backup (document ${raw.documentId}).`)
      }
      // Khóa suy dẫn phải khớp documentId + slot (DEC-035):
      if (raw.id !== backgroundImageKey(raw.documentId, raw.slot)) {
        throw invalid(`Khóa ảnh nền không nhất quán: ${raw.id}`)
      }
      if (imageIds.has(raw.id)) throw invalid(`Trùng ảnh nền trong backup: ${raw.id}`)
      imageIds.add(raw.id)
      const file = zip.file(raw.path)
      if (file === null) throw new BackupError('corrupt')
      const bytes = await file.async('uint8array')
      if (bytes.length !== raw.size) throw new BackupError('corrupt')
      if ((await sha256Hex(bytes)) !== raw.sha256) {
        throw new BackupError('checksum-mismatch', { cause: new Error(raw.id) })
      }
      backgroundImages.push({ entry: raw as unknown as BackupBackgroundImageEntry, bytes })
    }
  }

  // Thống kê trong manifest phải khớp dữ liệu thật:
  if (
    manifest.counts.documents !== documents.length ||
    manifest.counts.annotations !== annotations.length ||
    manifest.counts.documentContents !== contents.length ||
    (manifest.counts.backgrounds !== undefined &&
      manifest.counts.backgrounds !== backgrounds.length) ||
    (manifest.counts.backgroundImages !== undefined &&
      manifest.counts.backgroundImages !== backgroundImages.length)
  ) {
    throw invalid('Số lượng trong manifest không khớp dữ liệu thực tế.')
  }

  return {
    manifest,
    summary: {
      createdAt: manifest.createdAt,
      counts: { ...manifest.counts },
      totalBlobBytes,
    },
    documents,
    annotations,
    contents,
    backgrounds,
    backgroundImages,
  }
}

/**
 * GIAI ĐOẠN B + C của restore: tính remap ID tại thời điểm
 * ghi (thư viện có thể đã đổi từ lúc kiểm tra), rồi ghi
 * TẤT CẢ trong MỘT transaction. Lỗi giữa chừng → Dexie
 * hủy transaction, dữ liệu hiện tại nguyên vẹn.
 */
export async function executeRestore(
  db: WebScribbleDatabase,
  prepared: PreparedRestore,
): Promise<RestoreReport> {
  const existingIds = new Set(
    (await db.documents.toCollection().primaryKeys()).map((key) => String(key)),
  )
  const remap = new Map<string, string>()
  for (const { entry } of prepared.documents) {
    if (existingIds.has(entry.id)) remap.set(entry.id, crypto.randomUUID())
  }
  const finalId = (id: string) => remap.get(id) ?? id

  const documentRecords: DocumentRecord[] = prepared.documents.map(({ entry, blobBytes }) => ({
    id: finalId(entry.id),
    name: entry.name,
    mimeType: entry.mimeType,
    size: entry.size,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    pageCount: entry.pageCount ?? null,
    blob: new Blob([blobBytes as BlobPart], { type: entry.mimeType }),
  }))
  const annotationRecords: AnnotationSurfaceRecord[] = prepared.annotations.map((record) => {
    const newDocumentId = finalId(record.documentId)
    return newDocumentId === record.documentId
      ? record
      : {
          ...record,
          documentId: newDocumentId,
          surfaceId: documentSurfaceId(newDocumentId, record.pageIndex),
        }
  })
  const contentRecords: DocumentContentRecord[] = prepared.contents.map((record) => {
    const newDocumentId = finalId(record.documentId)
    return newDocumentId === record.documentId
      ? record
      : { ...record, documentId: newDocumentId }
  })
  // Nền + ảnh nền (TASK-14C): documentId qua cùng bản đồ
  // remap; khóa ảnh SUY DẪN từ documentId mới nên tự khớp.
  const backgroundRecords: DocumentBackgroundRecord[] = prepared.backgrounds.map(
    (record) => ({ ...record, documentId: finalId(record.documentId) }),
  )
  const backgroundImageRecords: BackgroundImageRecord[] = prepared.backgroundImages.map(
    ({ entry, bytes }) => {
      const newDocumentId = finalId(entry.documentId)
      return {
        id: backgroundImageKey(newDocumentId, entry.slot),
        documentId: newDocumentId,
        slot: entry.slot,
        mimeType: entry.mimeType,
        size: entry.size,
        updatedAt: Date.now(),
        blob: new Blob([bytes as BlobPart], { type: entry.mimeType }),
      }
    },
  )

  const before = await db.documents.count()
  try {
    await db.transaction(
      'rw',
      db.documents,
      db.annotations,
      db.documentContents,
      db.documentBackgrounds,
      db.backgroundImages,
      async () => {
        if (documentRecords.length > 0) await db.documents.bulkPut(documentRecords)
        if (annotationRecords.length > 0) await db.annotations.bulkPut(annotationRecords)
        if (contentRecords.length > 0) await db.documentContents.bulkPut(contentRecords)
        if (backgroundRecords.length > 0) {
          await db.documentBackgrounds.bulkPut(backgroundRecords)
        }
        if (backgroundImageRecords.length > 0) {
          await db.backgroundImages.bulkPut(backgroundImageRecords)
        }
      },
    )
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : ''
    const message = cause instanceof Error ? cause.message : String(cause)
    if (name === 'QuotaExceededError' || /quota/i.test(message)) {
      throw new BackupError('quota', { cause })
    }
    throw new BackupError('write-failed', { cause })
  }

  // Kiểm chứng sau ghi: số tài liệu tăng đúng bằng số đã
  // nhập và mọi annotation đã nhập gắn vào document tồn tại:
  const after = await db.documents.count()
  if (after !== before + documentRecords.length) {
    throw new BackupError('write-failed', { cause: new Error('Post-restore count mismatch.') })
  }
  for (const record of annotationRecords) {
    const owner = await db.documents.get(record.documentId)
    if (owner === undefined) {
      throw new BackupError('write-failed', {
        cause: new Error(`Orphan annotation after restore: ${record.surfaceId}`),
      })
    }
  }

  return {
    importedDocuments: documentRecords.length,
    importedAnnotations: annotationRecords.length,
    importedContents: contentRecords.length,
    importedBackgrounds: backgroundRecords.length,
    importedBackgroundImages: backgroundImageRecords.length,
    remappedDocuments: remap.size,
  }
}
