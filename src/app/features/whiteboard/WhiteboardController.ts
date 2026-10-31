import {
  DrawingEngine,
  type CanvasLike,
  type DrawingSurface,
  type PointerTargetLike,
} from '../../../engines/drawing/index'
import type {
  AnnotationEngine,
  AnnotationSurfaceSession,
} from '../../../engines/annotation/index'
import type { AutosaveState } from '../../../data/index'
import {
  clampPageIndex,
  computeFitScale,
  zoomInScale,
  zoomOutScale,
  type ViewerTool,
} from '../documents/pdfViewerState'
import {
  WhiteboardError,
  type WhiteboardBackground,
  type WhiteboardManifest,
  type WhiteboardStore,
} from './whiteboardStore'

/**
 * WhiteboardController (TASK-12): điều phối một bảng trắng
 * nhiều trang trên Drawing Engine dùng chung (DEC-015).
 * Mỗi trang là một phiên annotation độc lập (surface
 * `document:<id>:<pageIndex>`) — chuyển trang = flush +
 * đóng phiên cũ rồi mở phiên mới, đúng khuôn PdfViewer.
 * Thao tác đổi cấu trúc trang (thêm/xóa/đổi thứ tự) đi
 * qua WhiteboardStore (remap annotation) khi phiên đã
 * đóng; đổi nền không đụng tới phiên vì nền nằm ở
 * manifest, tách biệt hoàn toàn khỏi dữ liệu nét vẽ.
 */

export type WhiteboardStatus = 'idle' | 'opening' | 'ready' | 'error'

export interface WhiteboardSnapshot {
  status: WhiteboardStatus
  pageIndex: number
  pageCount: number
  background: WhiteboardBackground
  tool: ViewerTool
  color: string
  sizeLabel: 'S' | 'M' | 'L'
  scale: number
  canUndo: boolean
  canRedo: boolean
  saveState: AutosaveState
  saveError: string | null
  errorMessage: string | null
}

export const WB_PEN_COLORS = ['#111827', '#F8FAFC', '#DC2626', '#2563EB', '#16A34A']
export const WB_HIGHLIGHT_COLORS = ['#FDE047', '#86EFAC', '#F9A8D4', '#93C5FD']
export const WB_TOOL_SIZES: Record<'pen' | 'highlighter', Record<'S' | 'M' | 'L', number>> = {
  pen: { S: 2, M: 3.5, L: 5 },
  highlighter: { S: 10, M: 16, L: 24 },
}

/** Chuẩn hóa lỗi lưu (unknown từ Annotation Engine) thành thông điệp. */
function saveErrorText(error: unknown): string | null {
  if (error === null || error === undefined) return null
  return error instanceof Error ? error.message : String(error)
}

const IDLE_SNAPSHOT: WhiteboardSnapshot = {
  status: 'idle',
  pageIndex: 0,
  pageCount: 0,
  background: 'blank',
  tool: 'pen',
  color: WB_PEN_COLORS[0],
  sizeLabel: 'M',
  scale: 1,
  canUndo: false,
  canRedo: false,
  saveState: 'saved',
  saveError: null,
  errorMessage: null,
}

export interface WhiteboardControllerDeps {
  store: WhiteboardStore
  annotationEngine: AnnotationEngine
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
}

export class WhiteboardController {
  private readonly store: WhiteboardStore
  private readonly annotationEngine: AnnotationEngine
  private readonly requestFrame?: (callback: () => void) => number
  private readonly cancelFrame?: (handle: number) => void

  private state: WhiteboardSnapshot = IDLE_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private documentId: string | null = null
  private manifest: WhiteboardManifest | null = null
  private session: AnnotationSurfaceSession | null = null
  private engine: DrawingEngine | null = null
  private canvas: HTMLCanvasElement | null = null
  private unsubscribeSurface: (() => void) | null = null
  private viewport = { width: 0, height: 0 }
  private fitMode = true
  private saveWatchTimer: ReturnType<typeof setTimeout> | null = null
  private saveWatchLeft = 0

  constructor(deps: WhiteboardControllerDeps) {
    this.store = deps.store
    this.annotationEngine = deps.annotationEngine
    this.requestFrame = deps.requestFrame
    this.cancelFrame = deps.cancelFrame
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): WhiteboardSnapshot => this.state

  private setState(patch: Partial<WhiteboardSnapshot>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  // ── Vòng đời ──────────────────────────────────────────

  async open(documentId: string, canvas: HTMLCanvasElement): Promise<void> {
    if (this.documentId === documentId && this.session !== null && this.canvas !== canvas) {
      // Remount với canvas mới: giữ phiên, gắn lại engine.
      this.teardownEngine()
      this.canvas = canvas
      this.createEngine(canvas)
      this.setState({ status: 'ready', errorMessage: null })
      return
    }
    if (this.session !== null) await this.close()
    this.documentId = documentId
    this.canvas = canvas
    this.setState({ status: 'opening', errorMessage: null })
    try {
      this.manifest = await this.store.load(documentId)
    } catch (error) {
      this.setState({
        status: 'error',
        errorMessage:
          error instanceof WhiteboardError ? error.message : 'Không mở được bảng trắng.',
      })
      return
    }
    await this.openPageInternal(0)
  }

  private async openPageInternal(index: number): Promise<void> {
    if (this.documentId === null || this.manifest === null || this.canvas === null) return
    const pageIndex = clampPageIndex(index, this.manifest.pages.length)
    try {
      this.session = await this.annotationEngine.openDocumentPage(
        this.documentId,
        pageIndex,
        { pageSize: this.manifest.pageSize },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('already-open')) {
        await new Promise((resolve) => setTimeout(resolve, 150))
        try {
          this.session = await this.annotationEngine.openDocumentPage(
            this.documentId,
            pageIndex,
            { pageSize: this.manifest.pageSize },
          )
        } catch {
          this.setState({ status: 'error', errorMessage: 'Không mở được trang bảng trắng.' })
          return
        }
      } else {
        this.setState({ status: 'error', errorMessage: 'Không mở được trang bảng trắng.' })
        return
      }
    }
    this.createEngine(this.canvas)
    const surface = this.session.surface as { subscribe?: unknown }
    if (typeof surface.subscribe === 'function') {
      this.unsubscribeSurface = (
        surface as { subscribe: (l: () => void) => () => void }
      ).subscribe(() => this.onSurfaceChanged())
    }
    const scale = this.fitMode
      ? computeFitScale(
          this.manifest.pageSize.width,
          this.manifest.pageSize.height,
          this.viewport.width,
          this.viewport.height,
          this.state.scale,
        )
      : this.state.scale
    this.setState({
      status: 'ready',
      pageIndex,
      pageCount: this.manifest.pages.length,
      background: this.manifest.pages[pageIndex].background,
      scale,
      saveState: this.session.getSaveState(),
      saveError: saveErrorText(this.session.getSaveError()),
      errorMessage: null,
    })
    this.resizeEngine()
    this.refreshHistoryState()
  }

  private createEngine(canvas: HTMLCanvasElement): void {
    if (this.session === null) return
    this.engine = new DrawingEngine({
      surface: this.session.surface as DrawingSurface,
      element: canvas as unknown as PointerTargetLike & CanvasLike,
      getCamera: () => ({ x: 0, y: 0, zoom: this.state.scale }),
      tool: 'pen',
      ...(this.requestFrame !== undefined ? { requestFrame: this.requestFrame } : {}),
      ...(this.cancelFrame !== undefined ? { cancelFrame: this.cancelFrame } : {}),
    })
    this.engine.attach()
    this.applyToolToEngine()
    this.resizeEngine()
  }

  private teardownEngine(): void {
    this.engine?.dispose()
    this.engine = null
  }

  private resizeEngine(): void {
    if (this.engine === null || this.manifest === null) return
    this.engine.resize(
      this.manifest.pageSize.width * this.state.scale,
      this.manifest.pageSize.height * this.state.scale,
    )
  }

  /** Kích thước vùng hiển thị (để fit). */
  setViewportSize(width: number, height: number): void {
    this.viewport = { width, height }
    if (this.fitMode && this.manifest !== null && this.session !== null) {
      const scale = computeFitScale(
        this.manifest.pageSize.width,
        this.manifest.pageSize.height,
        width,
        height,
        this.state.scale,
      )
      if (scale !== this.state.scale) {
        this.setState({ scale })
        this.resizeEngine()
      }
    }
  }

  handleCanvasResize(cssWidth: number, cssHeight: number): void {
    if (!(cssWidth > 0) || !(cssHeight > 0)) return
    this.engine?.resize(cssWidth, cssHeight)
  }

  // ── Công cụ ───────────────────────────────────────────

  private applyToolToEngine(): void {
    if (this.engine === null) return
    const { tool, color, sizeLabel } = this.state
    if (tool === 'stroke-eraser') {
      this.engine.setTool('stroke-eraser')
    } else {
      this.engine.setTool(tool, { color, size: WB_TOOL_SIZES[tool][sizeLabel] })
    }
  }

  setTool(tool: ViewerTool): void {
    let color = this.state.color
    if (tool === 'pen' && !WB_PEN_COLORS.includes(color)) color = WB_PEN_COLORS[0]
    if (tool === 'highlighter' && !WB_HIGHLIGHT_COLORS.includes(color)) {
      color = WB_HIGHLIGHT_COLORS[0]
    }
    this.setState({ tool, color })
    this.applyToolToEngine()
  }

  setColor(color: string): void {
    this.setState({ color })
    this.applyToolToEngine()
  }

  setSizeLabel(sizeLabel: 'S' | 'M' | 'L'): void {
    this.setState({ sizeLabel })
    this.applyToolToEngine()
  }

  undo(): void {
    this.engine?.undo()
  }

  redo(): void {
    this.engine?.redo()
  }

  /** Số object hiện có trên trang (hiển thị/gỡ lỗi). */
  getObjectCount(): number {
    return this.session?.surface.listObjects().length ?? 0
  }

  // ── Zoom ──────────────────────────────────────────────

  zoomIn(): void {
    this.fitMode = false
    this.setState({ scale: zoomInScale(this.state.scale) })
    this.resizeEngine()
  }

  zoomOut(): void {
    this.fitMode = false
    this.setState({ scale: zoomOutScale(this.state.scale) })
    this.resizeEngine()
  }

  fitToViewport(): void {
    this.fitMode = true
    if (this.manifest === null) return
    const scale = computeFitScale(
      this.manifest.pageSize.width,
      this.manifest.pageSize.height,
      this.viewport.width,
      this.viewport.height,
      this.state.scale,
    )
    this.setState({ scale })
    this.resizeEngine()
  }

  // ── Điều hướng & cấu trúc trang ───────────────────────

  async goToPage(index: number): Promise<void> {
    if (this.manifest === null) return
    const target = clampPageIndex(index, this.manifest.pages.length)
    if (target === this.state.pageIndex && this.session !== null) return
    if (this.session !== null) {
      const closed = await this.closeSession()
      if (!closed) return
    }
    await this.openPageInternal(target)
  }

  async nextPage(): Promise<void> {
    await this.goToPage(this.state.pageIndex + 1)
  }

  async prevPage(): Promise<void> {
    await this.goToPage(this.state.pageIndex - 1)
  }

  /** Thêm trang ở cuối và chuyển tới trang mới. */
  async addPage(): Promise<void> {
    if (this.documentId === null) return
    const closed = await this.closeSession()
    if (!closed) return
    try {
      this.manifest = await this.store.addPage(this.documentId)
    } catch (error) {
      this.setState({
        status: 'error',
        errorMessage: error instanceof WhiteboardError ? error.message : 'Không thêm được trang.',
      })
      return
    }
    await this.openPageInternal(this.manifest.pages.length - 1)
  }

  /** Xóa trang hiện tại. */
  async deleteCurrentPage(): Promise<void> {
    if (this.documentId === null) return
    const index = this.state.pageIndex
    const closed = await this.closeSession()
    if (!closed) return
    try {
      this.manifest = await this.store.deletePage(this.documentId, index)
    } catch (error) {
      this.setState({
        status: 'error',
        errorMessage:
          error instanceof WhiteboardError ? error.message : 'Không xóa được trang.',
      })
      // Mở lại trang hiện tại để người dùng không kẹt:
      await this.openPageInternal(index)
      return
    }
    await this.openPageInternal(Math.min(index, this.manifest.pages.length - 1))
  }

  /** Đưa trang hiện tại sang trái/phải một vị trí. */
  async moveCurrentPage(delta: -1 | 1): Promise<void> {
    if (this.documentId === null || this.manifest === null) return
    const from = this.state.pageIndex
    const to = from + delta
    if (to < 0 || to >= this.manifest.pages.length) return
    const closed = await this.closeSession()
    if (!closed) return
    try {
      this.manifest = await this.store.movePage(this.documentId, from, to)
    } catch (error) {
      this.setState({
        status: 'error',
        errorMessage:
          error instanceof WhiteboardError ? error.message : 'Không đổi được thứ tự trang.',
      })
      await this.openPageInternal(from)
      return
    }
    await this.openPageInternal(to)
  }

  /** Đổi nền trang hiện tại — không đụng phiên vẽ. */
  async setBackground(background: WhiteboardBackground): Promise<void> {
    if (this.documentId === null) return
    try {
      this.manifest = await this.store.setPageBackground(
        this.documentId,
        this.state.pageIndex,
        background,
      )
      this.setState({ background })
    } catch {
      this.setState({ saveError: 'Không đổi được nền trang.' })
    }
  }

  /** Áp nền cho mọi trang. */
  async applyBackgroundToAll(background: WhiteboardBackground): Promise<void> {
    if (this.documentId === null) return
    try {
      this.manifest = await this.store.setAllBackgrounds(this.documentId, background)
      this.setState({ background })
    } catch {
      this.setState({ saveError: 'Không đổi được nền trang.' })
    }
  }

  // ── Lưu & đóng ────────────────────────────────────────

  private onSurfaceChanged(): void {
    if (this.session === null) return
    this.setState({
      saveState: this.session.getSaveState(),
      saveError: saveErrorText(this.session.getSaveError()),
    })
    this.refreshHistoryState()
    queueMicrotask(() => this.refreshHistoryState())
    this.saveWatchLeft = 20
    this.runSaveWatch()
  }

  private runSaveWatch(): void {
    if (this.saveWatchTimer !== null) clearTimeout(this.saveWatchTimer)
    this.saveWatchTimer = setTimeout(() => {
      this.saveWatchTimer = null
      if (this.session === null) return
      const saveState = this.session.getSaveState()
      this.setState({ saveState, saveError: saveErrorText(this.session.getSaveError()) })
      this.saveWatchLeft -= 1
      if (saveState === 'saving' && this.saveWatchLeft > 0) this.runSaveWatch()
    }, 300)
  }

  private refreshHistoryState(): void {
    if (this.engine === null) return
    const canUndo = this.engine.canUndo
    const canRedo = this.engine.canRedo
    if (canUndo !== this.state.canUndo || canRedo !== this.state.canRedo) {
      this.setState({ canUndo, canRedo })
    }
  }

  /** Đóng phiên trang hiện tại (flush trước). False nếu flush lỗi. */
  private async closeSession(): Promise<boolean> {
    if (this.session === null) return true
    const session = this.session
    this.unsubscribeSurface?.()
    this.unsubscribeSurface = null
    this.teardownEngine()
    this.session = null
    try {
      await session.close()
      return true
    } catch {
      this.setState({
        saveState: 'error',
        saveError: 'Không lưu được chú thích của trang này.',
      })
      return false
    }
  }

  /** Ghi ngay thay đổi của trang hiện tại, KHÔNG đóng phiên. */
  async flush(): Promise<void> {
    await this.session?.saveNow()
    if (this.session !== null) {
      this.setState({
        saveState: this.session.getSaveState(),
        saveError: saveErrorText(this.session.getSaveError()),
      })
    }
  }

  /** Lưu trang đang mở (nút thử lại khi lỗi). */
  async retrySave(): Promise<void> {
    await this.flush()
  }

  /** Đóng toàn bộ bảng trắng (flush trang hiện tại trước). */
  async close(): Promise<void> {
    const closed = await this.closeSession()
    if (!closed) throw new Error('save-failed')
    this.documentId = null
    this.manifest = null
    this.canvas = null
    this.setState(IDLE_SNAPSHOT)
  }

  dispose(): void {
    void this.close().catch(() => undefined)
  }
}
