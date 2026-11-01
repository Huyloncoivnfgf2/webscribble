import type { AutosaveState } from '../../../data/index'
import type {
  AnnotationEngine,
  AnnotationSurfaceSession,
} from '../../../engines/annotation/index'
import {
  DrawingEngine,
  isStrokeKind,
  STROKE_KINDS,
  STROKE_PROFILES,
  type CanvasLike,
  type PointerTargetLike,
  type StrokeKind,
} from '../../../engines/drawing/index'
import type { ViewerTool } from './pdfViewerState'
import type { PenPreset } from '../pens/penPresets'

/**
 * DocxAnnotationController (TASK-07D) — bộ điều phối KHÔNG phụ
 * thuộc React cho lớp chú thích viết tay trên tài liệu DOCX:
 * nối AnnotationEngine (TASK-06C) và DrawingEngine dùng chung
 * (DEC-015) với bề mặt Tiptap Editor.
 *
 * Mô hình tọa độ (DEC-029): DOCX dùng MỘT surface duy nhất
 * cho cả tài liệu — surfaceId `document:<id>:0` theo đúng quy
 * ước sẵn có. World của surface là KHÔNG GIAN NỘI DUNG của
 * editor tính bằng CSS px tại zoom 1: gốc tọa độ là góc
 * trên-trái của thẻ trang (.word-editor-surface), camera cố
 * định {0, 0, 1}. Canvas chú thích nằm tuyệt đối phủ kín thẻ
 * trang và cuộn CÙNG nội dung theo cuộn trang của ứng dụng —
 * không cần biến đổi tọa độ khi cuộn. Hệ quả đã chấp nhận và
 * ghi rõ cho người dùng: annotation neo theo tọa độ tuyệt
 * đối của trang, KHÔNG bám theo chữ khi nội dung được sửa
 * (chữ chèn thêm ở trên sẽ làm lệch vị trí tương đối) và khi
 * cửa sổ đổi chiều ngang làm chữ xuống dòng lại.
 *
 * pageSize khai cho AnnotationEngine là một khung danh nghĩa
 * rất lớn theo chiều cao vì nội dung DOCX lớn lên theo chiều
 * dọc không giới hạn; kích thước này chỉ là metadata của
 * surface, không cắt/xén nét vẽ nào.
 */

export type DocxAnnotationMode = 'edit' | 'annotate'

export interface DocxAnnotationSnapshot {
  status: 'idle' | 'opening' | 'ready' | 'error'
  mode: DocxAnnotationMode
  tool: ViewerTool
  color: string
  sizeLabel: string
  saveState: AutosaveState
  saveError: string | null
  canUndo: boolean
  canRedo: boolean
  errorMessage: string | null
}

export const DOCX_SURFACE_PAGE_INDEX = 0
const DOCX_SURFACE_SIZE = { width: 10_000, height: 1_000_000 }

export const DOCX_PEN_COLORS: readonly string[] = ['#111827', '#DC2626', '#2563EB', '#16A34A']
export const DOCX_HIGHLIGHT_COLORS: readonly string[] = ['#FDE047', '#86EFAC', '#F9A8D4', '#93C5FD']

export const DOCX_TOOL_SIZES: Record<StrokeKind, readonly { label: string; size: number }[]> =
  Object.fromEntries(
    STROKE_KINDS.map((kind) => [
      kind,
      (['S', 'M', 'L'] as const).map((label) => ({
        label,
        size: STROKE_PROFILES[kind].sizes[label],
      })),
    ]),
  ) as unknown as Record<StrokeKind, readonly { label: string; size: number }[]>

const IDLE_SNAPSHOT: DocxAnnotationSnapshot = {
  status: 'idle',
  mode: 'edit',
  tool: 'pen',
  color: DOCX_PEN_COLORS[0],
  sizeLabel: 'M',
  saveState: 'idle',
  saveError: null,
  canUndo: false,
  canRedo: false,
  errorMessage: null,
}

export interface DocxAnnotationDeps {
  annotationEngine: AnnotationEngine
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (id: number) => void
}

function errorMessageOf(value: unknown): string | null {
  return value instanceof Error ? value.message : null
}

export class DocxAnnotationController {
  private readonly deps: DocxAnnotationDeps
  private readonly listeners = new Set<() => void>()
  private state: DocxAnnotationSnapshot = { ...IDLE_SNAPSHOT }
  private session: AnnotationSurfaceSession | null = null
  private engine: DrawingEngine | null = null
  private boundCanvas: HTMLCanvasElement | null = null
  private unsubscribeSurface: (() => void) | null = null
  private documentId: string | null = null
  private disposed = false
  private saveWatchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(deps: DocxAnnotationDeps) {
    this.deps = deps
  }

  // Arrow properties: React gọi hai hàm này tách khỏi
  // instance qua useSyncExternalStore (mẫu WordEditorController).
  getSnapshot = (): DocxAnnotationSnapshot => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(patch: Partial<DocxAnnotationSnapshot>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  /** Style hiện tại cho tool vẽ nét (pen/highlighter). */
  private currentStrokeStyle(): { color: string; size: number } {
    const tool: StrokeKind = isStrokeKind(this.state.tool) ? this.state.tool : 'pen'
    const entry =
      DOCX_TOOL_SIZES[tool].find((s) => s.label === this.state.sizeLabel) ?? DOCX_TOOL_SIZES[tool][1]
    return { color: this.state.color, size: entry.size }
  }

  private applyToolToEngine(): void {
    if (this.engine === null) return
    if (this.state.tool === 'stroke-eraser') {
      this.engine.setTool('stroke-eraser')
    } else {
      this.engine.setTool(this.state.tool, this.currentStrokeStyle())
    }
  }

  /**
   * Mở phiên chú thích cho tài liệu và gắn DrawingEngine lên
   * canvas phủ. Controller được dùng lại qua các lần mount
   * (registry theo documentId ở tầng UI): nếu phiên đã mở mà
   * canvas là phần tử MỚI (component remount), chỉ gắn lại
   * engine lên canvas mới — dữ liệu phiên giữ nguyên.
   */
  async open(documentId: string, canvas: HTMLCanvasElement): Promise<void> {
    if (this.session !== null && this.documentId === documentId) {
      if (this.boundCanvas !== canvas) {
        this.teardownEngine()
        this.createEngine(canvas)
        this.setState({ mode: 'edit' })
      }
      return
    }
    this.setState({ status: 'opening', errorMessage: null })
    try {
      let session: AnnotationSurfaceSession
      try {
        session = await this.deps.annotationEngine.openDocumentPage(documentId, DOCX_SURFACE_PAGE_INDEX, {
          pageSize: DOCX_SURFACE_SIZE,
        })
      } catch (firstError) {
        // Phiên trước có thể đang đóng dở (điều hướng nhanh):
        // chờ một nhịp rồi thử mở lại đúng một lần.
        if ((firstError as { kind?: string })?.kind !== 'already-open') throw firstError
        await new Promise((resolve) => setTimeout(resolve, 150))
        session = await this.deps.annotationEngine.openDocumentPage(documentId, DOCX_SURFACE_PAGE_INDEX, {
          pageSize: DOCX_SURFACE_SIZE,
        })
      }
      if (this.disposed) {
        void session.close({ flush: false }).catch(() => undefined)
        return
      }
      this.session = session
      this.documentId = documentId
      const surface = session.surface as { subscribe?: unknown }
      if (typeof surface.subscribe === 'function') {
        this.unsubscribeSurface = (
          surface as { subscribe: (l: () => void) => () => void }
        ).subscribe(() => this.onSurfaceChanged())
      }
      this.createEngine(canvas)
      this.setState({
        status: 'ready',
        mode: 'edit',
        saveState: session.getSaveState(),
        saveError: errorMessageOf(session.getSaveError()),
      })
    } catch (error) {
      this.setState({
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Không mở được lớp chú thích cho tài liệu này.',
      })
    }
  }

  private createEngine(canvas: HTMLCanvasElement): void {
    if (this.session === null) return
    const engine = new DrawingEngine({
      surface: this.session.surface,
      element: canvas as unknown as PointerTargetLike & CanvasLike,
      getCamera: () => ({ x: 0, y: 0, zoom: 1 }),
      tool: 'pen',
      ...(this.deps.requestFrame ? { requestFrame: this.deps.requestFrame } : {}),
      ...(this.deps.cancelFrame ? { cancelFrame: this.deps.cancelFrame } : {}),
    })
    this.engine = engine
    this.boundCanvas = canvas
    engine.attach()
    this.applyToolToEngine()
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      engine.resize(canvas.clientWidth, canvas.clientHeight)
    }
    this.setState({ canUndo: engine.canUndo, canRedo: engine.canRedo })
  }

  /** Lưu ngay những nét chưa lưu mà KHÔNG đóng phiên (đường unmount an toàn StrictMode). */
  async flush(): Promise<void> {
    if (this.session === null) return
    await this.session.saveNow()
  }

  /** Số object chú thích hiện có trên surface (hiển thị/gỡ lỗi; 0 khi chưa mở phiên). */
  getObjectCount(): number {
    return this.session?.surface.listObjects().length ?? 0
  }

  /** Canvas phủ đổi kích thước theo thẻ trang (nội dung dài ra, cửa sổ đổi). */
  handleResize(cssWidth: number, cssHeight: number): void {
    if (this.engine === null || !(cssWidth > 0) || !(cssHeight > 0)) return
    this.engine.resize(cssWidth, cssHeight)
  }

  setMode(mode: DocxAnnotationMode): void {
    this.setState({ mode })
  }

  setTool(tool: ViewerTool): void {
    const patch: Partial<DocxAnnotationSnapshot> = { tool }
    // Đổi tool → màu mặc định của tool đó nếu màu hiện tại
    // không thuộc bảng màu của tool mới (tránh highlighter
    // mang màu bút đen đặc khó đọc và ngược lại).
    if (tool === 'highlighter' && !DOCX_HIGHLIGHT_COLORS.includes(this.state.color)) {
      patch.color = DOCX_HIGHLIGHT_COLORS[0]
    } else if (
      tool !== 'stroke-eraser' &&
      tool !== 'highlighter' &&
      !DOCX_PEN_COLORS.includes(this.state.color)
    ) {
      patch.color = DOCX_PEN_COLORS[0]
    }
    this.setState(patch)
    this.applyToolToEngine()
  }

  setColor(color: string): void {
    this.setState({ color })
    this.applyToolToEngine()
  }

  setSizeLabel(sizeLabel: string): void {
    this.setState({ sizeLabel })
    this.applyToolToEngine()
  }

  /** Áp một preset bút (TASK-14D): loại + màu + cỡ cùng lúc. */
  applyPreset(preset: PenPreset): void {
    this.setState({
      tool: preset.kind,
      color: preset.color,
      sizeLabel: preset.sizeLabel,
    })
    this.applyToolToEngine()
  }

  undo(): void {
    this.engine?.undo()
    this.refreshHistoryState()
  }

  redo(): void {
    this.engine?.redo()
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
        saveError: errorMessageOf(this.session.getSaveError()) ?? 'Lưu chú thích thất bại.',
      })
    }
  }

  /**
   * Đóng phiên và CHỜ flush xong — lỗi lưu thì ném ra để
   * caller chặn việc rời editor (không âm thầm bỏ nét vẽ).
   */
  async close(): Promise<void> {
    this.stopSaveWatch()
    const session = this.session
    if (session === null) return
    await session.close()
    this.session = null
    this.documentId = null
    if (this.unsubscribeSurface !== null) {
      this.unsubscribeSurface()
      this.unsubscribeSurface = null
    }
    this.teardownEngine()
    this.setState({ ...IDLE_SNAPSHOT })
  }

  /** Dọn dẹp lần cuối — chỉ dùng khi tầng UI hủy controller khỏi registry. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopSaveWatch()
    if (this.unsubscribeSurface !== null) {
      this.unsubscribeSurface()
      this.unsubscribeSurface = null
    }
    this.teardownEngine()
    const session = this.session
    this.session = null
    if (session !== null) void session.close().catch(() => undefined)
    this.listeners.clear()
  }

  private teardownEngine(): void {
    if (this.engine !== null) {
      this.engine.dispose()
      this.engine = null
    }
    this.boundCanvas = null
  }

  private refreshHistoryState(): void {
    if (this.engine !== null) {
      this.setState({ canUndo: this.engine.canUndo, canRedo: this.engine.canRedo })
    }
  }

  private onSurfaceChanged(): void {
    if (this.session === null) return
    this.setState({
      saveState: this.session.getSaveState(),
      saveError: errorMessageOf(this.session.getSaveError()),
    })
    this.refreshHistoryState()
    // Engine chốt command SAU thông báo surface — đọc lại
    // undo/redo sau một microtask (mẫu PdfViewerController).
    queueMicrotask(() => this.refreshHistoryState())
    this.startSaveWatch()
  }

  /** Theo dõi nhẹ trạng thái autosave tới khi ổn định (mẫu PdfViewerController). */
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
