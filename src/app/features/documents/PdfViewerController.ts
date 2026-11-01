/**
 * PdfViewerController (TASK-06E) — bộ điều phối KHÔNG phụ thuộc
 * React cho PDF Viewer: nối DocumentRepository, PdfDocumentHandle
 * (TASK-06A), PdfAnnotationOverlay (TASK-06D), AnnotationEngine
 * (TASK-06C) và DrawingEngine (TASK-05) cho MỘT tài liệu tại một
 * thời điểm. Component React chỉ hiển thị snapshot và gọi action.
 *
 * An toàn dữ liệu: mọi thao tác trang/tài liệu chạy NỐI TIẾP qua
 * một hàng đợi; chuyển trang đóng session cũ bằng close() mặc
 * định (flush trước) — flush lỗi thì HỦY chuyển trang và giữ
 * nguyên trang cũ kèm trạng thái lỗi lưu, không âm thầm bỏ dữ
 * liệu.
 */
import {
  DEFAULT_PAPER_BACKGROUND,
  MAIN_BACKGROUND_SLOT,
  type AutosaveState,
  type BackgroundImageRepository,
  type DocumentBackgroundRepository,
  type DocumentRepository,
  type PaperBackground,
} from '../../../data/index'
import { inspectBackgroundImage } from '../backgrounds/paperBackground'
import type {
  AnnotationEngine,
  AnnotationSurfaceSession,
} from '../../../engines/annotation/index'
import { DrawingEngine } from '../../../engines/drawing/index'
import type { CanvasLike, PinchGestureEvent, PointerTargetLike } from '../../../engines/drawing/index'
import {
  getPdfPageGeometry,
  openPdfDocument,
  PdfLoadError,
  type PdfDocumentHandle,
  type PdfPageRenderer,
} from '../../../engines/pdf/index'
import { PdfAnnotationOverlay } from '../../../engines/pdf/index'
import {
  clampPageIndex,
  clampScale,
  computeFitScale,
  zoomInScale,
  zoomOutScale,
  type ViewerTool,
} from './pdfViewerState'

export interface PdfViewerDeps {
  documents: DocumentRepository
  annotationEngine: AnnotationEngine
  /** Nền theo tài liệu + ảnh nền (TASK-14C) — tùy chọn cho test. */
  backgrounds?: DocumentBackgroundRepository
  backgroundImages?: BackgroundImageRepository
  /** Renderer PDF dùng chung (tùy chọn; overlay tự tạo nếu thiếu). */
  pdfRenderer?: PdfPageRenderer
  /**
   * Bộ lập lịch khung hình tiêm vào cho overlay và DrawingEngine
   * (mặc định dùng requestAnimationFrame của trình duyệt; test
   * tiêm bản giả).
   */
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (id: number) => void
}

export interface PdfViewerElements {
  pdfCanvas: HTMLCanvasElement
  annotationCanvas: HTMLCanvasElement
  /**
   * Vùng hiển thị: tính fit theo kích thước client; pinch
   * (TASK-14B) cần thêm scroll + rect để pan và neo zoom.
   */
  container: {
    clientWidth: number
    clientHeight: number
    scrollLeft: number
    scrollTop: number
    getBoundingClientRect(): { left: number; top: number }
  }
}

export type PdfViewerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PdfViewerSnapshot {
  status: PdfViewerStatus
  documentId: string | null
  fileName: string | null
  pageIndex: number
  pageCount: number
  scale: number
  zoomMode: 'fit' | 'manual'
  tool: ViewerTool
  /** Nền giấy của tài liệu (TASK-14C) — áp dưới trang PDF. */
  background: PaperBackground
  saveState: AutosaveState
  saveError: string | null
  canUndo: boolean
  canRedo: boolean
  pageCssWidth: number
  pageCssHeight: number
  errorKind: string | null
  errorMessage: string | null
}

const IDLE_SNAPSHOT: PdfViewerSnapshot = {
  status: 'idle',
  documentId: null,
  fileName: null,
  pageIndex: 0,
  pageCount: 0,
  scale: 1,
  zoomMode: 'fit',
  tool: 'pen',
  background: { ...DEFAULT_PAPER_BACKGROUND },
  saveState: 'idle',
  saveError: null,
  canUndo: false,
  canRedo: false,
  pageCssWidth: 0,
  pageCssHeight: 0,
  errorKind: null,
  errorMessage: null,
}

function errorMessageOf(value: unknown): string | null {
  return value instanceof Error ? value.message : null
}

function loadErrorMessage(error: unknown): { kind: string | null; message: string } {
  if (error instanceof PdfLoadError) {
    switch (error.kind) {
      case 'password':
        return { kind: error.kind, message: 'Tài liệu này được bảo vệ bằng mật khẩu. WebScribble chưa hỗ trợ mở PDF có mật khẩu.' }
      case 'corrupt':
        return { kind: error.kind, message: 'File PDF bị hỏng hoặc không đầy đủ nên không mở được.' }
      case 'not-a-pdf':
        return { kind: error.kind, message: 'File đã chọn không phải là tài liệu PDF hợp lệ.' }
      case 'cancelled':
        return { kind: error.kind, message: 'Thao tác mở tài liệu đã bị hủy.' }
      default:
        return { kind: error.kind, message: 'Không mở được tài liệu PDF này.' }
    }
  }
  return { kind: null, message: 'Đã xảy ra lỗi không mong muốn khi mở tài liệu.' }
}

export class PdfViewerController {
  private readonly deps: PdfViewerDeps
  private elements: PdfViewerElements | null = null
  /** Trạng thái gesture pinch đang chạy (TASK-14B); null khi không có gesture. */
  private pinch: {
    startScale: number
    startDistance: number
    /** Điểm world (tọa độ trang chưa scale) nằm dưới trung điểm lúc bắt đầu. */
    anchorWorld: { x: number; y: number }
    lastFactor: number
  } | null = null
  private readonly listeners = new Set<() => void>()
  private state: PdfViewerSnapshot = { ...IDLE_SNAPSHOT }
  private queue: Promise<unknown> = Promise.resolve()
  private disposed = false

  private handle: PdfDocumentHandle | null = null
  private session: AnnotationSurfaceSession | null = null
  private overlay: PdfAnnotationOverlay | null = null
  private drawingEngine: DrawingEngine | null = null
  private unsubscribeSurface: (() => void) | null = null
  /** Kích thước world của trang hiện tại (tại scale 1) để tính fit. */
  private pageWorldSize: { width: number; height: number } | null = null
  private saveWatchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(deps: PdfViewerDeps) {
    this.deps = deps
  }

  bindElements(elements: PdfViewerElements): void {
    this.elements = elements
  }

  getSnapshot(): PdfViewerSnapshot {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(patch: Partial<PdfViewerSnapshot>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => (this.disposed ? undefined : task()))
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run as Promise<T>
  }

  // ── Mở / đóng tài liệu ────────────────────────────────────

  async openDocument(documentId: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.elements === null) {
        this.setState({ status: 'error', errorKind: null, errorMessage: 'Viewer chưa sẵn sàng (thiếu canvas).' })
        return
      }
      this.setState({ ...IDLE_SNAPSHOT, status: 'loading', documentId })
      try {
        await this.closeCurrentPage()
      } catch (error) {
        this.setState({
          status: 'error',
          saveState: 'error',
          saveError: error instanceof Error ? error.message : 'Không lưu được annotation của tài liệu trước.',
          errorMessage: 'Không đóng được tài liệu trước vì lưu annotation thất bại.',
        })
        return
      }
      if (this.handle !== null) {
        await this.handle.close()
        this.handle = null
      }
      const meta = await this.deps.documents.getById(documentId)
      const blob = await this.deps.documents.getBlob(documentId)
      if (blob === null) {
        this.setState({ status: 'error', errorKind: null, errorMessage: 'Không tìm thấy tài liệu trong bộ nhớ của thiết bị.' })
        return
      }
      let handle: PdfDocumentHandle
      try {
        handle = await openPdfDocument(blob)
      } catch (error) {
        const { kind, message } = loadErrorMessage(error)
        this.setState({ status: 'error', errorKind: kind, errorMessage: message })
        return
      }
      this.handle = handle
      if (meta !== null && meta.pageCount === null) {
        await this.deps.documents.updateMetadata(documentId, { pageCount: handle.pageCount })
      }
      this.setState({
        fileName: meta?.name ?? 'Tài liệu PDF',
        pageCount: handle.pageCount,
        zoomMode: 'fit',
      })
      // Nền đã lưu của tài liệu (TASK-14C) — lỗi đọc nền
      // không được chặn mở tài liệu, chỉ về mặc định:
      const savedBackground =
        (await this.deps.backgrounds?.get(documentId).catch(() => undefined)) ??
        DEFAULT_PAPER_BACKGROUND
      this.setState({ background: savedBackground })
      const opened = await this.openPageInternal(0)
      if (opened) this.setState({ status: 'ready' })
    })
  }

  /** Đóng tài liệu hiện tại; flush lỗi → ném lỗi và GIỮ viewer mở. */
  async closeDocument(): Promise<void> {
    return this.enqueue(async () => {
      await this.closeCurrentPage()
      if (this.handle !== null) {
        await this.handle.close()
        this.handle = null
      }
      this.setState({ ...IDLE_SNAPSHOT })
    })
  }

  /** Dọn dẹp đồng bộ khi component unmount — best effort, không chặn. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopSaveWatch()
    this.teardownPageLayers()
    const session = this.session
    this.session = null
    if (session !== null) void session.close().catch(() => undefined)
    if (this.handle !== null) void this.handle.close().catch(() => undefined)
    this.handle = null
    this.listeners.clear()
  }

  // ── Trang ─────────────────────────────────────────────────

  async goToPage(index: number): Promise<void> {
    return this.enqueue(async () => {
      if (this.handle === null || this.state.status !== 'ready') return
      const target = clampPageIndex(index, this.state.pageCount)
      if (target === this.state.pageIndex && this.session !== null) return
      const opened = await this.openPageInternal(target)
      if (opened) this.setState({ status: 'ready' })
    })
  }

  nextPage(): Promise<void> {
    return this.goToPage(this.state.pageIndex + 1)
  }

  prevPage(): Promise<void> {
    return this.goToPage(this.state.pageIndex - 1)
  }

  /**
   * Đóng session trang hiện tại. Thứ tự an toàn: flush/close
   * session TRƯỚC (lỗi → hủy thao tác, lớp hiển thị còn nguyên),
   * chỉ khi đóng thành công mới dispose engine/overlay.
   */
  private async closeCurrentPage(): Promise<void> {
    this.stopSaveWatch()
    if (this.session !== null) {
      await this.session.close()
      this.session = null
    }
    this.teardownPageLayers()
    this.pageWorldSize = null
  }

  private teardownPageLayers(): void {
    if (this.unsubscribeSurface !== null) {
      this.unsubscribeSurface()
      this.unsubscribeSurface = null
    }
    if (this.drawingEngine !== null) {
      this.drawingEngine.dispose()
      this.drawingEngine = null
    }
    if (this.overlay !== null) {
      this.overlay.dispose()
      this.overlay = null
    }
  }

  /** Mở một trang: session → overlay → drawing engine → render. */
  private async openPageInternal(index: number): Promise<boolean> {
    const handle = this.handle
    const elements = this.elements
    const documentId = this.state.documentId
    if (handle === null || elements === null || documentId === null) return false
    try {
      await this.closeCurrentPage()
    } catch (error) {
      this.setState({
        saveState: 'error',
        saveError: error instanceof Error ? error.message : 'Không lưu được annotation của trang hiện tại.',
      })
      return false
    }
    try {
      const geometry = await getPdfPageGeometry(handle, index, 1)
      this.pageWorldSize = { width: geometry.pageWidth, height: geometry.pageHeight }
      const scale =
        this.state.zoomMode === 'fit'
          ? computeFitScale(
              geometry.pageWidth,
              geometry.pageHeight,
              elements.container.clientWidth,
              elements.container.clientHeight,
              this.state.scale,
            )
          : this.state.scale
      const session = await this.deps.annotationEngine.openDocumentPage(documentId, index, {
        pageSize: { width: geometry.pageWidth, height: geometry.pageHeight },
      })
      this.session = session
      // Cập nhật scale VÀO STATE trước khi tạo engine/render:
      // camera của DrawingEngine đọc state.scale mỗi khung hình,
      // nên giá trị phải đúng ngay từ lần vẽ đầu tiên của trang.
      this.setState({ scale })
      const overlay = new PdfAnnotationOverlay({
        handle,
        pageIndex: index,
        session,
        pdfCanvas: elements.pdfCanvas,
        annotationCanvas: elements.annotationCanvas,
        scale,
        // DrawingEngine của viewer sở hữu việc vẽ lớp annotation
        // (tương tác + preview + con trỏ công cụ); overlay chỉ
        // render PDF + mapping để tránh hai renderer tranh nhau
        // cùng một canvas (xem ghi chú trong overlay.ts).
        annotationRendering: 'external',
        ...(this.deps.pdfRenderer ? { pdfRenderer: this.deps.pdfRenderer } : {}),
        ...(this.deps.requestFrame ? { requestFrame: this.deps.requestFrame } : {}),
        ...(this.deps.cancelFrame ? { cancelFrame: this.deps.cancelFrame } : {}),
      })
      this.overlay = overlay
      const engine = new DrawingEngine({
        surface: session.surface,
        element: elements.annotationCanvas as unknown as PointerTargetLike & CanvasLike,
        getCamera: () => ({ x: 0, y: 0, zoom: this.state.scale }),
        tool: this.state.tool,
        onPinchGesture: (event) => this.handlePinchGesture(event),
        ...(this.deps.requestFrame ? { requestFrame: this.deps.requestFrame } : {}),
        ...(this.deps.cancelFrame ? { cancelFrame: this.deps.cancelFrame } : {}),
      })
      this.drawingEngine = engine
      engine.attach()
      const surface = session.surface as { subscribe?: unknown }
      if (typeof surface.subscribe === 'function') {
        this.unsubscribeSurface = (
          surface as { subscribe: (l: () => void) => () => void }
        ).subscribe(() => this.onSurfaceChanged())
      }
      const result = await overlay.render()
      engine.resize(result.cssWidth, result.cssHeight)
      this.setState({
        pageIndex: index,
        scale,
        pageCssWidth: result.cssWidth,
        pageCssHeight: result.cssHeight,
        saveState: session.getSaveState(),
        saveError: errorMessageOf(session.getSaveError()),
        canUndo: engine.canUndo,
        canRedo: engine.canRedo,
      })
      return true
    } catch (error) {
      this.teardownPageLayers()
      if (this.session !== null) {
        const orphan = this.session
        this.session = null
        void orphan.close({ flush: false }).catch(() => undefined)
      }
      const { kind, message } = loadErrorMessage(error)
      this.setState({ status: 'error', errorKind: kind, errorMessage: `Không hiển thị được trang: ${message}` })
      return false
    }
  }

  // ── Zoom ──────────────────────────────────────────────────

  async setScale(scale: number, mode: 'fit' | 'manual' = 'manual'): Promise<void> {
    return this.enqueue(async () => {
      if (this.overlay === null || this.drawingEngine === null) return
      const next = clampScale(scale)
      this.setState({ scale: next, zoomMode: mode })
      const result = await this.overlay.setScale(next)
      this.drawingEngine.resize(result.cssWidth, result.cssHeight)
      this.setState({ pageCssWidth: result.cssWidth, pageCssHeight: result.cssHeight })
    })
  }

  // ── Pinch hai ngón (TASK-14B) ─────────────────────────────
  // Pan áp trực tiếp theo từng 'update' (chỉ là scroll DOM).
  // Zoom CHỐT ở 'end': trang PDF dựng lại một lần tại scale mới
  // rồi neo điểm world dưới trung điểm cuối — dựng lại theo
  // từng update tốn ~260ms/trang (đo ở TASK-06) nên không khả
  // thi; đây là đánh đổi đã ghi trong kế hoạch TASK-14B.

  private handlePinchGesture(event: PinchGestureEvent): void {
    const elements = this.elements
    if (elements === null) return
    if (event.phase === 'start') {
      const scale = this.state.scale
      this.pinch = {
        startScale: scale,
        startDistance: event.distance,
        anchorWorld: {
          x: event.midpoint.x / scale,
          y: event.midpoint.y / scale,
        },
        lastFactor: 1,
      }
      return
    }
    if (event.phase === 'update') {
      if (this.pinch === null) return
      // Pan: nội dung đi theo ngón tay — dùng hiệu tọa độ
      // CLIENT (không bị nhiễu bởi chính scroll vừa áp).
      const dx = event.midpointClient.x - event.previousMidpointClient.x
      const dy = event.midpointClient.y - event.previousMidpointClient.y
      if (dx !== 0) elements.container.scrollLeft -= dx
      if (dy !== 0) elements.container.scrollTop -= dy
      if (event.distance > 0 && this.pinch.startDistance > 0) {
        this.pinch.lastFactor = event.distance / this.pinch.startDistance
      }
      return
    }
    // phase === 'end'
    const pinch = this.pinch
    this.pinch = null
    if (pinch === null) return
    const factor = pinch.lastFactor
    if (!(factor > 0) || factor === 1) return
    const nextScale = clampScale(pinch.startScale * factor)
    if (nextScale === this.state.scale) return
    const endClient = event.midpointClient
    void this.setScale(nextScale).then(() => {
      this.scrollWorldPointToClient(pinch.anchorWorld, endClient)
    })
  }

  /**
   * Đặt scroll sao cho điểm world (tọa độ trang chưa scale)
   * nằm đúng dưới một điểm client cho trước, tại scale hiện
   * tại. Đọc rect SAU khi layout đã đổi (hàm được gọi sau khi
   * setScale hoàn tất) nên số đo luôn theo bố cục mới.
   */
  private scrollWorldPointToClient(
    world: { x: number; y: number },
    clientPoint: { x: number; y: number },
  ): void {
    const elements = this.elements
    if (elements === null) return
    const container = elements.container
    const containerRect = container.getBoundingClientRect()
    const canvasRect = elements.annotationCanvas.getBoundingClientRect()
    const originX = canvasRect.left - containerRect.left + container.scrollLeft
    const originY = canvasRect.top - containerRect.top + container.scrollTop
    const scale = this.state.scale
    container.scrollLeft = originX + world.x * scale - (clientPoint.x - containerRect.left)
    container.scrollTop = originY + world.y * scale - (clientPoint.y - containerRect.top)
  }

  zoomIn(): Promise<void> {
    return this.setScale(zoomInScale(this.state.scale))
  }

  zoomOut(): Promise<void> {
    return this.setScale(zoomOutScale(this.state.scale))
  }

  fit(): Promise<void> {
    const size = this.pageWorldSize
    const elements = this.elements
    if (size === null || elements === null) return Promise.resolve()
    return this.setScale(
      computeFitScale(
        size.width,
        size.height,
        elements.container.clientWidth,
        elements.container.clientHeight,
        this.state.scale,
      ),
      'fit',
    )
  }

  /** Component gọi khi vùng hiển thị đổi kích thước: chỉ tự fit lại khi đang ở chế độ fit. */
  handleResize(): void {
    if (this.state.status === 'ready' && this.state.zoomMode === 'fit') {
      void this.fit()
    }
  }

  // ── Công cụ, undo/redo, lưu ───────────────────────────────

  setTool(tool: ViewerTool): void {
    this.setState({ tool })
    const engine = this.drawingEngine
    if (engine === null) return
    if (tool === 'pen' || tool === 'highlighter') engine.setTool(tool)
    else engine.setTool(tool)
  }

  // ── Nền giấy (TASK-14C) ───────────────────────────────────

  /** Đổi nền của tài liệu hiện tại và lưu lại (theo tài liệu). */
  async setBackground(background: PaperBackground): Promise<void> {
    const documentId = this.state.documentId
    this.setState({ background })
    if (documentId === null || this.deps.backgrounds === undefined) return
    try {
      await this.deps.backgrounds.set(documentId, background)
    } catch {
      this.setState({ saveError: 'Không lưu được nền của tài liệu.' })
    }
  }

  /**
   * Đặt ảnh nền cho tài liệu: kiểm tra định dạng + dung
   * lượng, lưu Blob vào slot chính, rồi chuyển nền sang
   * dạng ảnh. Ảnh sai → trả thông báo, nền giữ nguyên.
   */
  async setBackgroundImage(
    file: Blob,
  ): Promise<{ ok: true; message: null } | { ok: false; message: string }> {
    const documentId = this.state.documentId
    if (documentId === null || this.deps.backgroundImages === undefined) {
      return { ok: false, message: 'Chưa mở tài liệu.' }
    }
    const check = await inspectBackgroundImage(file)
    if (!check.ok) return check
    try {
      await this.deps.backgroundImages.put(documentId, MAIN_BACKGROUND_SLOT, file)
    } catch {
      return { ok: false, message: 'Không lưu được ảnh nền. Hãy thử lại.' }
    }
    await this.setBackground({ kind: 'image' })
    return { ok: true, message: null }
  }

  undo(): void {
    this.drawingEngine?.undo()
    this.refreshHistoryState()
  }

  redo(): void {
    this.drawingEngine?.redo()
    this.refreshHistoryState()
  }

  async retrySave(): Promise<void> {
    if (this.session === null) return
    try {
      await this.session.saveNow()
      this.setState({ saveState: this.session.getSaveState(), saveError: null })
    } catch {
      this.setState({
        saveState: 'error',
        saveError: errorMessageOf(this.session.getSaveError()) ?? 'Lưu annotation thất bại.',
      })
    }
  }

  private refreshHistoryState(): void {
    if (this.drawingEngine !== null) {
      this.setState({ canUndo: this.drawingEngine.canUndo, canRedo: this.drawingEngine.canRedo })
    }
  }

  private onSurfaceChanged(): void {
    if (this.session === null) return
    this.setState({
      saveState: this.session.getSaveState(),
      saveError: errorMessageOf(this.session.getSaveError()),
    })
    this.refreshHistoryState()
    // Thông báo thay đổi surface tới GIỮA thao tác của engine
    // (surface được sửa trước khi History chốt command), nên
    // trạng thái undo/redo phải đọc lại sau khi thao tác hiện
    // tại kết thúc — một microtask là đủ và không tốn kém.
    queueMicrotask(() => this.refreshHistoryState())
    this.startSaveWatch()
  }

  /**
   * Trạng thái autosave chuyển pending → saved bất đồng bộ (sau
   * debounce) mà không có sự kiện nào tới viewer; vòng theo dõi
   * NHẸ này chỉ đọc trạng thái hiển thị, tự dừng ở trạng thái
   * cuối hoặc sau ~6 giây. Không dùng để đồng bộ dữ liệu.
   */
  private startSaveWatch(): void {
    if (this.saveWatchTimer !== null) return
    let attempts = 0
    const tick = () => {
      this.saveWatchTimer = null
      if (this.disposed || this.session === null) return
      const current = this.session.getSaveState()
      this.setState({
        saveState: current,
        saveError: errorMessageOf(this.session.getSaveError()),
      })
      attempts += 1
      if ((current === 'pending' || current === 'saving') && attempts < 20) {
        this.saveWatchTimer = setTimeout(tick, 300)
      }
    }
    this.saveWatchTimer = setTimeout(tick, 300)
  }

  private stopSaveWatch(): void {
    if (this.saveWatchTimer !== null) {
      clearTimeout(this.saveWatchTimer)
      this.saveWatchTimer = null
    }
  }
}
