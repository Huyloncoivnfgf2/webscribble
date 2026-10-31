import {
  documentSurfaceId,
  parseDocumentSurfaceId,
  type AnnotationRepository,
  type DocumentRepository,
} from '../../../data/index'

/**
 * Whiteboard Store (TASK-12, DEC-014/DEC-019): bảng trắng
 * là MỘT TÀI LIỆU trong thư viện hiện có — không bảng
 * Dexie mới, không định dạng backup mới:
 *
 * - Hàng `documents` mang mime WHITEBOARD_MIME_TYPE; số
 *   trang đồng bộ vào `pageCount` (thẻ thư viện hiện sẵn).
 * - Blob của tài liệu chính là manifest JSON của bảng
 *   (phiên bản, kích thước trang cố định, nền từng trang)
 *   — backup mang theo nguyên vẹn như mọi file gốc.
 * - Nét vẽ của trang i nằm ở surface quy ước sẵn có
 *   `document:<id>:<i>` qua Annotation Engine dùng chung
 *   (DEC-015) — backup/restore/xóa cascade đều tự chạy.
 *
 * Thao tác đổi cấu trúc trang (xóa/đổi thứ tự) làm chỉ số
 * trang lệch đi: annotation phải được REMAP theo. Thuật
 * toán remap an toàn hai pha: (1) chép dữ liệu của mọi
 * trang còn sống sang surface staging ngoài không gian
 * tên trang, (2) ghi đè các surface trang đích từ bản
 * staging (gốc chỉ bị ghi đè SAU khi đã có bản staging),
 * (3) dọn staging + các surface trang thừa ngoài danh
 * sách đích. Không thời điểm nào dữ liệu chỉ tồn tại ở
 * một nơi sắp bị xóa trước khi nơi đích đã có bản sao.
 */

export const WHITEBOARD_MIME_TYPE = 'application/vnd.webscribble.whiteboard'

export type WhiteboardBackground = 'blank' | 'dark' | 'ruled' | 'grid' | 'dots'

export const WHITEBOARD_BACKGROUNDS: readonly WhiteboardBackground[] = [
  'blank',
  'dark',
  'ruled',
  'grid',
  'dots',
]

export interface WhiteboardPage {
  background: WhiteboardBackground
}

export interface WhiteboardManifest {
  kind: 'webscribble-whiteboard'
  version: 1
  pageSize: { width: number; height: number }
  pages: WhiteboardPage[]
}

/** Trang cố định (DEC-019): 1600×1000 world units. */
export const WHITEBOARD_PAGE_SIZE = { width: 1600, height: 1000 } as const

export type WhiteboardErrorKind = 'not-found' | 'invalid-manifest' | 'last-page' | 'storage'

export class WhiteboardError extends Error {
  readonly kind: WhiteboardErrorKind
  constructor(kind: WhiteboardErrorKind, options: { cause?: unknown } = {}) {
    super(
      kind === 'not-found'
        ? 'Không tìm thấy bảng trắng.'
        : kind === 'invalid-manifest'
          ? 'Dữ liệu bảng trắng không hợp lệ.'
          : kind === 'last-page'
            ? 'Không thể xóa trang duy nhất của bảng trắng.'
            : 'Không lưu được bảng trắng. Hãy thử lại.',
      options,
    )
    this.name = 'WhiteboardError'
    this.kind = kind
  }
}

export function createManifest(): WhiteboardManifest {
  return {
    kind: 'webscribble-whiteboard',
    version: 1,
    pageSize: { ...WHITEBOARD_PAGE_SIZE },
    pages: [{ background: 'blank' }],
  }
}

export function serializeManifest(manifest: WhiteboardManifest): Blob {
  return new Blob([JSON.stringify(manifest)], { type: WHITEBOARD_MIME_TYPE })
}

export function parseManifest(text: string): WhiteboardManifest {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (cause) {
    throw new WhiteboardError('invalid-manifest', { cause })
  }
  const m = raw as Partial<WhiteboardManifest> | null
  if (
    m === null ||
    typeof m !== 'object' ||
    m.kind !== 'webscribble-whiteboard' ||
    m.version !== 1 ||
    typeof m.pageSize?.width !== 'number' ||
    typeof m.pageSize?.height !== 'number' ||
    !Array.isArray(m.pages) ||
    m.pages.length === 0
  ) {
    throw new WhiteboardError('invalid-manifest')
  }
  const pages: WhiteboardPage[] = m.pages.map((page) => {
    const bg = (page as WhiteboardPage | null)?.background
    return {
      background: WHITEBOARD_BACKGROUNDS.includes(bg as WhiteboardBackground)
        ? (bg as WhiteboardBackground)
        : 'blank',
    }
  })
  return {
    kind: 'webscribble-whiteboard',
    version: 1,
    pageSize: { width: m.pageSize.width, height: m.pageSize.height },
    pages,
  }
}

export interface WhiteboardStoreDeps {
  documents: DocumentRepository
  annotations: AnnotationRepository
}

function stagingSurfaceId(documentId: string, token: string, newIndex: number): string {
  return `whiteboard-stage:${documentId}:${token}:${newIndex}`
}

/**
 * Mỗi DrawingObject mang theo `surfaceId` của bề mặt nó
 * được tạo trên, và Annotation Engine kiểm chứng trường
 * này khi mở surface. Remap sang surface mới bắt buộc
 * viết lại trường đó cho khớp — object không có trường
 * surfaceId dạng chuỗi thì giữ nguyên.
 */
function retargetObjects(
  objects: readonly unknown[],
  surfaceId: string,
): readonly unknown[] {
  return objects.map((object) => {
    if (
      object !== null &&
      typeof object === 'object' &&
      typeof (object as { surfaceId?: unknown }).surfaceId === 'string'
    ) {
      return { ...(object as Record<string, unknown>), surfaceId }
    }
    return object
  })
}

export class WhiteboardStore {
  private readonly documents: DocumentRepository
  private readonly annotations: AnnotationRepository

  constructor(deps: WhiteboardStoreDeps) {
    this.documents = deps.documents
    this.annotations = deps.annotations
  }

  /** Tạo bảng trắng mới (1 trang trống) trong thư viện. */
  async create(name: string): Promise<{ id: string; manifest: WhiteboardManifest }> {
    const manifest = createManifest()
    const record = await this.documents.create({
      name,
      mimeType: WHITEBOARD_MIME_TYPE,
      blob: serializeManifest(manifest),
      pageCount: manifest.pages.length,
    })
    return { id: record.id, manifest }
  }

  /** Đọc manifest; đồng thời dọn staging remap còn sót (nếu có). */
  async load(documentId: string): Promise<WhiteboardManifest> {
    const record = await this.documents.getById(documentId)
    if (record === undefined || record.mimeType !== WHITEBOARD_MIME_TYPE) {
      throw new WhiteboardError('not-found')
    }
    await this.sweepStaging(documentId)
    const text = await record.blob.text()
    return parseManifest(text)
  }

  private async save(documentId: string, manifest: WhiteboardManifest): Promise<void> {
    try {
      await this.documents.replaceBlob(documentId, serializeManifest(manifest))
      await this.documents.updateMetadata(documentId, { pageCount: manifest.pages.length })
    } catch (cause) {
      throw new WhiteboardError('storage', { cause })
    }
  }

  /** Xóa mọi record staging remap còn sót của tài liệu này. */
  private async sweepStaging(documentId: string): Promise<void> {
    const records = await this.annotations.getSurfacesByDocument(documentId)
    for (const record of records) {
      if (record.surfaceId.startsWith('whiteboard-stage:')) {
        await this.annotations.deleteSurface(record.surfaceId)
      }
    }
  }

  /**
   * Remap annotation theo ánh xạ trang: mapping[oldIndex]
   * = newIndex, hoặc null nếu trang bị xóa. Chỉ các trang
   * có record mới tốn thao tác; trang chưa từng vẽ không
   * có record nên không cần làm gì.
   */
  private async remapAnnotations(
    documentId: string,
    mapping: Array<number | null>,
  ): Promise<void> {
    const records = await this.annotations.getSurfacesByDocument(documentId)
    const pageRecords = records.filter((r) => parseDocumentSurfaceId(r.surfaceId) !== null)
    if (pageRecords.length === 0) return
    const token = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
    const staged = new Map<number, readonly unknown[]>()
    // Pha 1 — staging:
    for (const record of pageRecords) {
      const parsed = parseDocumentSurfaceId(record.surfaceId)
      if (parsed === null) continue
      const target = mapping[parsed.pageIndex]
      if (target === undefined || target === null) continue
      staged.set(target, record.objects)
      await this.annotations.saveSurface({
        surfaceId: stagingSurfaceId(documentId, token, target),
        documentId,
        pageIndex: target,
        objects: record.objects,
      })
    }
    // Pha 2 — ghi finals từ staging (viết lại surfaceId
    // trong từng object cho khớp surface đích):
    const finalIds = new Set<string>()
    for (const [newIndex, objects] of staged) {
      const surfaceId = documentSurfaceId(documentId, newIndex)
      finalIds.add(surfaceId)
      await this.annotations.saveSurface({
        surfaceId,
        documentId,
        pageIndex: newIndex,
        objects: retargetObjects(objects, surfaceId),
      })
    }
    // Pha 3 — dọn: staging + mọi surface trang không nằm
    // trong danh sách đích (trang bị xóa / chỉ số cũ thừa):
    for (const record of pageRecords) {
      if (!finalIds.has(record.surfaceId)) {
        await this.annotations.deleteSurface(record.surfaceId)
      }
    }
    for (const newIndex of staged.keys()) {
      await this.annotations.deleteSurface(stagingSurfaceId(documentId, token, newIndex))
    }
  }

  /** Thêm trang ở cuối. Trả manifest mới. */
  async addPage(
    documentId: string,
    background: WhiteboardBackground = 'blank',
  ): Promise<WhiteboardManifest> {
    const manifest = await this.load(documentId)
    manifest.pages.push({ background })
    await this.save(documentId, manifest)
    return manifest
  }

  /** Xóa một trang + remap annotation các trang sau. */
  async deletePage(documentId: string, index: number): Promise<WhiteboardManifest> {
    const manifest = await this.load(documentId)
    if (manifest.pages.length <= 1) throw new WhiteboardError('last-page')
    if (index < 0 || index >= manifest.pages.length) throw new WhiteboardError('invalid-manifest')
    const mapping = manifest.pages.map((_, i) =>
      i === index ? null : i < index ? i : i - 1,
    )
    await this.remapAnnotations(documentId, mapping)
    manifest.pages.splice(index, 1)
    await this.save(documentId, manifest)
    return manifest
  }

  /** Đổi thứ tự: chuyển trang từ vị trí from tới vị trí to. */
  async movePage(documentId: string, from: number, to: number): Promise<WhiteboardManifest> {
    const manifest = await this.load(documentId)
    const count = manifest.pages.length
    if (from < 0 || from >= count || to < 0 || to >= count) {
      throw new WhiteboardError('invalid-manifest')
    }
    if (from === to) return manifest
    const order = manifest.pages.map((_, i) => i)
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved)
    // order[newIndex] = oldIndex → mapping[oldIndex] = newIndex:
    const mapping: Array<number | null> = new Array(count).fill(null)
    order.forEach((oldIndex, newIndex) => {
      mapping[oldIndex] = newIndex
    })
    await this.remapAnnotations(documentId, mapping)
    manifest.pages = order.map((oldIndex) => manifest.pages[oldIndex])
    await this.save(documentId, manifest)
    return manifest
  }

  /** Đổi nền một trang (không đụng annotation). */
  async setPageBackground(
    documentId: string,
    index: number,
    background: WhiteboardBackground,
  ): Promise<WhiteboardManifest> {
    const manifest = await this.load(documentId)
    if (index < 0 || index >= manifest.pages.length) throw new WhiteboardError('invalid-manifest')
    manifest.pages[index] = { background }
    await this.save(documentId, manifest)
    return manifest
  }

  /** Áp một nền cho mọi trang. */
  async setAllBackgrounds(
    documentId: string,
    background: WhiteboardBackground,
  ): Promise<WhiteboardManifest> {
    const manifest = await this.load(documentId)
    manifest.pages = manifest.pages.map(() => ({ background }))
    await this.save(documentId, manifest)
    return manifest
  }
}
