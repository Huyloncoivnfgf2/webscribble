import type { ViewerTool } from '../documents/pdfViewerState'
import type { PdfViewerController } from '../documents/PdfViewerController'
import type { DocxAnnotationController } from '../documents/DocxAnnotationController'
import type { WhiteboardController } from '../whiteboard/WhiteboardController'
import {
  clampSplitRatio,
  type SplitPaneId,
  type SplitSessionData,
  type SplitSessionStore,
} from './splitSession'

/**
 * SplitController (TASK-13, DEC-015/DEC-020): điều phối
 * hai pane của Split Mode. Mỗi pane giữ NGUYÊN controller
 * của mode gốc (PDF/DOCX/Bảng trắng) — dữ liệu, autosave
 * và ngăn xếp undo/redo của chúng hoàn toàn độc lập vì
 * là các instance khác nhau trên các surface khác nhau.
 * SplitController chỉ làm ba việc:
 *  1. Giữ vết liên kết phiên (SplitSessionStore).
 *  2. Biết pane nào đang ACTIVE.
 *  3. ROUTE các lệnh của thanh công cụ dùng chung tới
 *     adapter của pane active — không bao giờ chạm vào
 *     adapter của pane còn lại.
 *
 * Adapter là lớp bọc mỏng thống nhất 3 controller khác
 * nhau về một giao diện công cụ. Pane không hỗ trợ màu/
 * cỡ nét (PDF viewer dùng style mặc định của engine từ
 * TASK-06E) khai `capabilities` tương ứng để thanh công
 * cụ khóa đúng phần đó.
 */

export interface PaneToolState {
  tool: ViewerTool
  color: string
  sizeLabel: 'S' | 'M' | 'L'
  canUndo: boolean
  canRedo: boolean
}

export interface DrawingPaneAdapter {
  readonly capabilities: { color: boolean; size: boolean }
  getToolState(): PaneToolState
  setTool(tool: ViewerTool): void
  setColor(color: string): void
  setSizeLabel(sizeLabel: 'S' | 'M' | 'L'): void
  undo(): void
  redo(): void
  subscribe(listener: () => void): () => void
}

const FALLBACK_TOOL_STATE: PaneToolState = {
  tool: 'pen',
  color: '#111827',
  sizeLabel: 'M',
  canUndo: false,
  canRedo: false,
}

export function whiteboardPaneAdapter(controller: WhiteboardController): DrawingPaneAdapter {
  return {
    capabilities: { color: true, size: true },
    getToolState: () => {
      const s = controller.getSnapshot()
      return {
        tool: s.tool,
        color: s.color,
        sizeLabel: s.sizeLabel,
        canUndo: s.canUndo,
        canRedo: s.canRedo,
      }
    },
    setTool: (tool) => controller.setTool(tool),
    setColor: (color) => controller.setColor(color),
    setSizeLabel: (label) => controller.setSizeLabel(label),
    undo: () => controller.undo(),
    redo: () => controller.redo(),
    subscribe: (listener) => controller.subscribe(listener),
  }
}

export function pdfPaneAdapter(controller: PdfViewerController): DrawingPaneAdapter {
  return {
    capabilities: { color: false, size: false },
    getToolState: () => {
      const s = controller.getSnapshot()
      return { ...FALLBACK_TOOL_STATE, tool: s.tool, canUndo: s.canUndo, canRedo: s.canRedo }
    },
    setTool: (tool) => controller.setTool(tool),
    setColor: () => undefined,
    setSizeLabel: () => undefined,
    undo: () => controller.undo(),
    redo: () => controller.redo(),
    subscribe: (listener) => controller.subscribe(listener),
  }
}

/**
 * Adapter cho pane DOCX: controller chú thích được tra
 * lười qua resolver (nó chỉ tồn tại sau khi WordEditor
 * gắn xong). Chọn công cụ vẽ qua thanh công cụ chung sẽ
 * tự chuyển editor sang chế độ Chú thích.
 */
export function docxPaneAdapter(
  resolve: () => DocxAnnotationController | undefined,
): DrawingPaneAdapter {
  return {
    capabilities: { color: true, size: true },
    getToolState: () => {
      const controller = resolve()
      if (controller === undefined) return FALLBACK_TOOL_STATE
      const s = controller.getSnapshot()
      return {
        tool: s.tool,
        color: s.color,
        sizeLabel: s.sizeLabel === 'S' || s.sizeLabel === 'L' ? s.sizeLabel : 'M',
        canUndo: s.canUndo,
        canRedo: s.canRedo,
      }
    },
    setTool: (tool) => {
      const controller = resolve()
      if (controller === undefined) return
      controller.setMode('annotate')
      controller.setTool(tool)
    },
    setColor: (color) => resolve()?.setColor(color),
    setSizeLabel: (label) => resolve()?.setSizeLabel(label),
    undo: () => resolve()?.undo(),
    redo: () => resolve()?.redo(),
    subscribe: (listener) => {
      const controller = resolve()
      return controller !== undefined ? controller.subscribe(listener) : () => undefined
    },
  }
}

export interface SplitSnapshot extends SplitSessionData {
  /** Trạng thái công cụ của pane active (cho thanh công cụ chung). */
  toolState: PaneToolState
  capabilities: { color: boolean; size: boolean }
}

export class SplitController {
  private readonly store: SplitSessionStore
  private session: SplitSessionData
  private readonly adapters: Record<SplitPaneId, DrawingPaneAdapter | null> = {
    left: null,
    right: null,
  }
  private readonly adapterUnsubscribes: Record<SplitPaneId, (() => void) | null> = {
    left: null,
    right: null,
  }
  private readonly listeners = new Set<() => void>()
  private snapshotCache: SplitSnapshot

  constructor(store: SplitSessionStore, initial?: Partial<SplitSessionData>) {
    this.store = store
    this.session = { ...this.store.load(), ...initial }
    if (initial !== undefined) this.store.save(this.session)
    this.snapshotCache = this.buildSnapshot()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): SplitSnapshot => this.snapshotCache

  private buildSnapshot(): SplitSnapshot {
    const adapter = this.adapters[this.session.activePane]
    return {
      ...this.session,
      toolState: adapter?.getToolState() ?? FALLBACK_TOOL_STATE,
      capabilities: adapter?.capabilities ?? { color: false, size: false },
    }
  }

  private emit(): void {
    this.snapshotCache = this.buildSnapshot()
    for (const listener of this.listeners) listener()
  }

  private persist(patch: Partial<SplitSessionData>): void {
    this.session = { ...this.session, ...patch }
    this.store.save(this.session)
    this.emit()
  }

  // ── Liên kết phiên ────────────────────────────────────

  setDocument(documentId: string | null): void {
    this.persist({ documentId })
  }

  setWhiteboard(whiteboardId: string | null): void {
    this.persist({ whiteboardId })
  }

  setRatio(ratio: number): void {
    this.persist({ ratio: clampSplitRatio(ratio) })
  }

  setActivePane(pane: SplitPaneId): void {
    if (this.session.activePane === pane) return
    this.persist({ activePane: pane })
  }

  getSession(): SplitSessionData {
    return { ...this.session }
  }

  // ── Adapter & routing thanh công cụ ───────────────────

  registerAdapter(pane: SplitPaneId, adapter: DrawingPaneAdapter | null): void {
    this.adapterUnsubscribes[pane]?.()
    this.adapterUnsubscribes[pane] = null
    this.adapters[pane] = adapter
    if (adapter !== null) {
      this.adapterUnsubscribes[pane] = adapter.subscribe(() => {
        if (this.session.activePane === pane) this.emit()
      })
    }
    this.emit()
  }

  private activeAdapter(): DrawingPaneAdapter | null {
    return this.adapters[this.session.activePane]
  }

  setTool(tool: ViewerTool): void {
    this.activeAdapter()?.setTool(tool)
  }

  setColor(color: string): void {
    const adapter = this.activeAdapter()
    if (adapter?.capabilities.color) adapter.setColor(color)
  }

  setSizeLabel(sizeLabel: 'S' | 'M' | 'L'): void {
    const adapter = this.activeAdapter()
    if (adapter?.capabilities.size) adapter.setSizeLabel(sizeLabel)
  }

  undo(): void {
    this.activeAdapter()?.undo()
  }

  redo(): void {
    this.activeAdapter()?.redo()
  }

  dispose(): void {
    this.adapterUnsubscribes.left?.()
    this.adapterUnsubscribes.right?.()
  }
}
