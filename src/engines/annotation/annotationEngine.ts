/**
 * Annotation Engine (TASK-06C): tầng điều phối giữa Drawing
 * Engine và Storage Foundation cho annotation của từng trang tài
 * liệu. Engine KHÔNG vẽ — nó sở hữu vòng đời của các annotation
 * surface: mở/nạp từ AnnotationRepository, theo dõi thay đổi qua
 * NotifyingSurface, lưu bền qua AutosaveManager, đóng/xóa có kỷ
 * luật.
 *
 * Chính sách dữ liệu (theo brief TASK-06C):
 * - Nạp: validate toàn bộ bằng validateDrawingObject của Drawing
 *   Engine + khớp surfaceId; một object lỗi → toàn bộ lần mở thất
 *   bại, bản lưu trong repository KHÔNG bị đụng vào.
 * - Lưu: chỉ báo "saved" sau khi repository xác nhận (qua
 *   AutosaveManager hoặc lưu trực tiếp có thứ tự); lỗi lưu được
 *   giữ để thử lại, không nuốt.
 * - Đóng: mặc định flush mọi thay đổi chưa lưu trước; flush lỗi
 *   thì lần đóng thất bại và session VẪN mở để caller quyết định.
 *   close({ flush: false }) là cách hủy thay đổi tường minh.
 * - Đóng KHÔNG xóa dữ liệu; xóa chỉ qua deleteSavedData() tường
 *   minh (flush hết hàng đợi → cancel → delete, để save đang bay
 *   không hồi sinh record sau khi xóa).
 * - Mỗi surfaceId chỉ có tối đa MỘT session trong một engine.
 */
import { InMemorySurface } from '../drawing/surface'
import type { DrawingSurface, SurfaceSize } from '../drawing/surface'
import type { DrawingObject } from '../drawing/types'
import {
  UnsupportedAnnotationSchemaError,
  documentSurfaceId,
} from '../../data/types'
import type { AnnotationRepository } from '../../data/repositories/annotationRepository'
import type { AutosaveManager, AutosaveState } from '../../data/autosave/autosaveManager'
import type { SaveSurfaceInput } from '../../data/types'
import { AnnotationError } from './errors'
import { NotifyingSurface } from './notifyingSurface'
import { deserializeDrawingObjects, serializeDrawingObjects } from './serialization'

export interface AnnotationEngineDeps {
  annotations: AnnotationRepository
  /**
   * AutosaveManager dùng chung (từ createStorageFoundation). Nếu
   * không có, engine lưu trực tiếp qua repository với chuỗi save
   * có thứ tự (không debounce).
   */
  autosave?: AutosaveManager
}

export interface OpenDocumentPageOptions {
  /** Kích thước trang tại scale 1 (điểm PDF) — kích thước surface. */
  pageSize: SurfaceSize
}

export interface AnnotationSurfaceSession {
  readonly surfaceId: string
  readonly documentId: string
  readonly pageIndex: number
  /**
   * DrawingSurface đã gắn thông báo thay đổi — đưa surface này
   * cho DrawingEngine (TASK-06D). Sau khi session đóng, surface
   * vẫn đọc được nhưng thay đổi KHÔNG còn được lưu.
   */
  readonly surface: DrawingSurface
  readonly closed: boolean
  listObjects(): readonly DrawingObject[]
  /** Trạng thái lưu hiện tại của surface này. */
  getSaveState(): AutosaveState
  /** Lỗi lưu gần nhất (null nếu không có). */
  getSaveError(): unknown
  /**
   * Đẩy snapshot hiện tại xuống repository và chờ xác nhận. Sau
   * khi resolve, repository chứa đúng objects hiện tại. Reject
   * bằng AnnotationError kind 'persistence' nếu lưu thất bại.
   */
  saveNow(): Promise<void>
  /**
   * Xóa record annotation đã lưu của surface (tường minh). Object
   * trong bộ nhớ KHÔNG bị xóa. Không tự gọi khi đóng.
   */
  deleteSavedData(): Promise<void>
  /**
   * Đóng session. Mặc định flush thay đổi chưa lưu trước khi
   * đóng; flush lỗi → close reject và session vẫn mở.
   * `close({ flush: false })` bỏ phần chưa lưu (tường minh).
   * Gọi lại sau khi đã đóng là no-op.
   */
  close(options?: { flush?: boolean }): Promise<void>
}

class SessionImpl implements AnnotationSurfaceSession {
  readonly surfaceId: string
  readonly documentId: string
  readonly pageIndex: number
  private readonly notifyingSurface: NotifyingSurface
  private readonly deps: AnnotationEngineDeps
  private readonly onClosed: (surfaceId: string) => void
  private unsubscribe: (() => void) | null = null
  private closedFlag = false
  /** Dirty tracking bằng GENERATION COUNTER (TASK-06F +
   *  06F-A): `changeGeneration` tăng ở MỌI thay đổi của
   *  surface; `savedGeneration` là thế hệ cao nhất đã được
   *  xác nhận ghi xong. Session "bẩn" khi hai số lệch nhau.
   *  Chỉ xác nhận đã lưu tới đúng thế hệ của snapshot đã ghi
   *  — không bao giờ tới thế hệ hiện tại — nên thay đổi tới
   *  TRONG lúc một lần ghi đang bay không bị đánh dấu nhầm
   *  là đã lưu (race đã tái hiện bằng test ở TASK-06F-A).
   *  close() dựa vào đây để không ghi đè khi phiên chỉ đọc
   *  (TASK-06F). */
  private changeGeneration = 0
  private savedGeneration = 0

  // Chế độ lưu trực tiếp (không có AutosaveManager): chuỗi promise
  // bảo đảm thứ tự; lỗi được giữ cho saveNow/flush báo lại.
  private directChain: Promise<void> = Promise.resolve()
  private directSeq = 0
  private directError: unknown = null
  private directState: AutosaveState = 'idle'
  private discardDirect = false

  constructor(
    deps: AnnotationEngineDeps,
    documentId: string,
    pageIndex: number,
    surface: NotifyingSurface,
    onClosed: (surfaceId: string) => void,
  ) {
    this.deps = deps
    this.documentId = documentId
    this.pageIndex = pageIndex
    this.surfaceId = surface.id
    this.notifyingSurface = surface
    this.onClosed = onClosed
  }

  get surface(): DrawingSurface {
    return this.notifyingSurface
  }

  get closed(): boolean {
    return this.closedFlag
  }

  /** Còn thay đổi chưa được xác nhận ghi xong hay không. */
  private get hasChanges(): boolean {
    return this.changeGeneration > this.savedGeneration
  }

  /** Bắt đầu nghe thay đổi (gọi một lần ngay sau khi tạo). */
  attach(): void {
    this.unsubscribe = this.notifyingSurface.subscribe(() => this.onSurfaceChanged())
  }

  listObjects(): readonly DrawingObject[] {
    return this.notifyingSurface.listObjects()
  }

  getSaveState(): AutosaveState {
    if (this.deps.autosave) return this.deps.autosave.getState(this.surfaceId)
    return this.directState
  }

  getSaveError(): unknown {
    if (this.deps.autosave) return this.deps.autosave.getError(this.surfaceId)
    return this.directError
  }

  async saveNow(): Promise<void> {
    this.assertOpen()
    const input = this.snapshotInput()
    // Thế hệ tại thời điểm chụp snapshot: snapshot chứa mọi
    // thay đổi tính đến đây. Sau khi ghi xong CHỈ xác nhận
    // đã lưu tới thế hệ này — thay đổi tới trong lúc ghi
    // thuộc thế hệ cao hơn và vẫn tính là chưa lưu, kể cả
    // khi tầng ghi tình cờ đã ghi cả chúng (bảo thủ: thừa
    // một lần ghi còn hơn mất dữ liệu).
    const generationAtSnapshot = this.changeGeneration
    if (this.deps.autosave) {
      this.deps.autosave.schedule(input)
      try {
        await this.deps.autosave.flush(this.surfaceId)
      } catch (error) {
        throw new AnnotationError('persistence', `Failed to save annotations for ${this.surfaceId}.`, {
          surfaceId: this.surfaceId,
          cause: error,
        })
      }
    } else {
      this.scheduleDirect(input)
      await this.flushDirect()
    }
    if (generationAtSnapshot > this.savedGeneration) {
      this.savedGeneration = generationAtSnapshot
    }
  }

  async deleteSavedData(): Promise<void> {
    this.assertOpen()
    try {
      if (this.deps.autosave) {
        // Xả hết hàng đợi trước (kể cả save đang bay) để không còn
        // write nào hồi sinh record sau khi xóa; cancel sau đó chỉ
        // là dọn trạng thái chờ (nếu có phát sinh trong lúc xả).
        await this.deps.autosave.flush(this.surfaceId)
        this.deps.autosave.cancel(this.surfaceId)
      } else {
        await this.flushDirect()
      }
      await this.deps.annotations.deleteSurface(this.surfaceId)
    } catch (error) {
      if (error instanceof AnnotationError) throw error
      throw new AnnotationError('persistence', `Failed to delete saved annotations for ${this.surfaceId}.`, {
        surfaceId: this.surfaceId,
        cause: error,
      })
    }
  }

  async close(options: { flush?: boolean } = {}): Promise<void> {
    if (this.closedFlag) return
    const flush = options.flush ?? true
    if (flush) {
      // Chỉ ghi khi session THỰC SỰ có thay đổi chưa được xác
      // nhận lưu (TASK-06F): trước đây close() luôn saveNow()
      // nên chỉ mở xem một trang rồi đóng cũng ghi đè một bản
      // snapshot — vừa tạo record rỗng cho trang chưa chú
      // thích, vừa có thể ghi đè dữ liệu mới hơn từ phiên khác
      // (đa tab) bằng trạng thái cũ tại thời điểm mở. saveNow
      // ném lỗi → close bị hủy, session vẫn mở (chính sách đã
      // nêu): caller sửa lỗi rồi đóng lại, hoặc đóng bỏ qua
      // bằng { flush: false }. Vòng lặp thay cho một lần
      // kiểm duy nhất (TASK-06F-A): mutation có thể tới
      // TRONG lúc saveNow đang flush — thế hệ thay đổi tăng
      // khiến hasChanges bật lại — phải lưu tiếp cho tới khi
      // một lần lưu hoàn thành mà không còn thay đổi nào
      // chưa được ghi, nếu không close() có thể hoàn thành
      // trước khi dữ liệu mới nhất xuống storage.
      while (this.hasChanges) {
        await this.saveNow()
      }
    } else if (this.deps.autosave) {
      this.deps.autosave.cancel(this.surfaceId)
    } else {
      this.discardDirect = true
      await this.directChain.catch(() => undefined)
    }
    this.closedFlag = true
    this.unsubscribe?.()
    this.unsubscribe = null
    this.onClosed(this.surfaceId)
  }

  private onSurfaceChanged(): void {
    if (this.closedFlag) return
    this.changeGeneration += 1
    const input = this.snapshotInput()
    if (this.deps.autosave) {
      this.deps.autosave.schedule(input)
    } else {
      this.scheduleDirect(input)
    }
  }

  private snapshotInput(): SaveSurfaceInput {
    return {
      surfaceId: this.surfaceId,
      documentId: this.documentId,
      pageIndex: this.pageIndex,
      objects: serializeDrawingObjects(this.notifyingSurface.listObjects()),
    }
  }

  private scheduleDirect(input: SaveSurfaceInput): void {
    const seq = (this.directSeq += 1)
    this.directState = 'saving'
    this.directChain = this.directChain.then(async () => {
      if (this.discardDirect) return
      try {
        await this.deps.annotations.saveSurface(input)
        if (seq === this.directSeq) {
          this.directError = null
          this.directState = 'saved'
        }
      } catch (error) {
        if (seq === this.directSeq) {
          this.directError = error
          this.directState = 'error'
        }
      }
    })
  }

  private async flushDirect(): Promise<void> {
    // Chờ chuỗi ỔN ĐỊNH: write nối thêm trong lúc chờ
    // (mutation mới tới) kéo dài chuỗi — phải chờ cả phần
    // mới chứ không chỉ tham chiếu chuỗi tại thời điểm bắt
    // đầu chờ (TASK-06F-A).
    let chain: Promise<void>
    do {
      chain = this.directChain
      await chain
    } while (chain !== this.directChain)
    if (this.directError !== null) {
      const cause = this.directError
      throw new AnnotationError('persistence', `Failed to save annotations for ${this.surfaceId}.`, {
        surfaceId: this.surfaceId,
        cause,
      })
    }
  }

  private assertOpen(): void {
    if (this.closedFlag) {
      throw new AnnotationError('closed', `Annotation session for ${this.surfaceId} is already closed.`, {
        surfaceId: this.surfaceId,
      })
    }
  }
}

export class AnnotationEngine {
  private readonly deps: AnnotationEngineDeps
  private readonly sessions = new Map<string, SessionImpl>()

  constructor(deps: AnnotationEngineDeps) {
    this.deps = deps
  }

  /**
   * Mở (hoặc tạo mới) session annotation cho một trang PDF.
   * Nạp và validate dữ liệu đã lưu nếu có; chưa có record thì
   * surface rỗng. Mở trùng surface đang hoạt động →
   * AnnotationError kind 'already-open'.
   */
  async openDocumentPage(
    documentId: string,
    pageIndex: number,
    options: OpenDocumentPageOptions,
  ): Promise<AnnotationSurfaceSession> {
    const surfaceId = documentSurfaceId(documentId, pageIndex)
    if (this.sessions.has(surfaceId)) {
      throw new AnnotationError('already-open', `Annotation surface ${surfaceId} is already open in this engine.`, {
        surfaceId,
      })
    }
    if (!(options.pageSize.width > 0) || !(options.pageSize.height > 0)) {
      throw new AnnotationError('invalid-data', `Invalid page size ${options.pageSize.width}x${options.pageSize.height} for ${surfaceId}.`, {
        surfaceId,
      })
    }

    let storedObjects: DrawingObject[] = []
    let record: Awaited<ReturnType<AnnotationRepository['getSurface']>>
    try {
      record = await this.deps.annotations.getSurface(surfaceId)
    } catch (error) {
      // Record thuộc schema tương lai: truyền NGUYÊN VẸN lỗi của
      // data layer (dữ liệu không bị đụng vào).
      if (error instanceof UnsupportedAnnotationSchemaError) throw error
      throw new AnnotationError('persistence', `Failed to load annotations for ${surfaceId}.`, {
        surfaceId,
        cause: error,
      })
    }
    if (record !== undefined) {
      // Ném AnnotationDataError nếu bất kỳ object nào không hợp
      // lệ — bản lưu còn nguyên, lần mở thất bại sạch.
      storedObjects = deserializeDrawingObjects(record.objects, surfaceId)
    }

    const inner = new InMemorySurface(surfaceId, 'document-page', options.pageSize)
    for (const object of storedObjects) {
      inner.addObject(object)
    }
    const surface = new NotifyingSurface(inner)
    const session = new SessionImpl(this.deps, documentId, pageIndex, surface, (id) => {
      this.sessions.delete(id)
    })
    session.attach()
    this.sessions.set(surfaceId, session)
    return session
  }

  isOpen(surfaceId: string): boolean {
    return this.sessions.has(surfaceId)
  }

  getSession(surfaceId: string): AnnotationSurfaceSession | undefined {
    return this.sessions.get(surfaceId)
  }

  openSurfaceIds(): readonly string[] {
    return [...this.sessions.keys()]
  }

  /** Đóng mọi session (mỗi session flush theo chính sách của nó). */
  async closeAll(): Promise<void> {
    const sessions = [...this.sessions.values()]
    const results = await Promise.allSettled(sessions.map((s) => s.close()))
    const failure = results.find((r) => r.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  }
}

/** Tạo Annotation Engine trên Storage Foundation đã có. */
export function createAnnotationEngine(deps: AnnotationEngineDeps): AnnotationEngine {
  return new AnnotationEngine(deps)
}
