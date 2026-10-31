/**
 * DrawingEngine (TASK-05C Phần D + TASK-05D + TASK-05E): điểm tích
 * hợp DUY NHẤT nối các tầng của Drawing Engine cho một bề mặt:
 *
 *   PointerInputManager → các Builder/Tool theo công cụ → DrawingSurface
 *                                    ↘ CanvasRenderer (đọc Surface +
 *                                       bản xem trước + lớp phủ chọn/tẩy)
 *   Text: tầng gọi yêu cầu vị trí đặt text (callback) rồi gọi
 *   `addTextObject` — TextObject do Text Engine (text.ts) tạo.
 *
 * Công cụ (TASK-05E bổ sung Selection & Eraser):
 * - Tạo object: pen/highlighter (StrokeBuilder), line/rectangle/
 *   ellipse/arrow (ShapeBuilder), text (callback + addTextObject).
 * - Chọn: select-rect / select-lasso (Selection Engine) — kết quả là
 *   danh sách ID do engine giữ; di chuyển bằng `moveSelectionBy`
 *   (nguyên tử qua updateObjects), xóa bằng `deleteSelection`.
 * - Tẩy: stroke-eraser / segment-eraser (Eraser Engine) — tác động
 *   trực tiếp lên Surface ngay trong thao tác; ID bị xóa/tách sẽ bị
 *   loại khỏi danh sách đang chọn.
 *
 * Ranh giới phụ thuộc:
 * - Input Manager không biết Renderer/Builder tồn tại — nó chỉ phát
 *   PointerInputEvent qua callback, và callback đó thuộc về lớp này.
 * - DrawingObject chỉ được tạo ở các Builder/Text Engine/Eraser
 *   (khi tách đoạn), không tạo trong Input Manager.
 * - Một DrawingEngine dùng chung cho Document / Split / Whiteboard
 *   (DEC-015): mỗi bề mặt một instance với Surface riêng; Split Mode
 *   dùng hai instance độc lập (DEC-020). Không có ba hệ thống vẽ riêng.
 *
 * Chính sách giữ dữ liệu: đổi công cụ hoặc detach giữa chừng sẽ HOÀN
 * TẤT object đang tạo dở vào Surface (không mất phần đã vẽ) — hủy chỉ
 * xảy ra khi tầng gọi chủ động dùng abandon() ở mức builder. Vùng chọn
 * đang kéo dở bị bỏ khi đổi công cụ; kết quả chọn đã hoàn tất được giữ.
 */

import {
  CanvasRenderer,
  type CanvasLike,
  type CanvasSurfaceContextLike,
  type FrameCanceller,
  type FrameRequester,
} from './canvasRenderer'
import { worldToScreen, type Camera } from './coordinates'
import { DEFAULT_ERASER_SIZE, SegmentEraserTool, StrokeEraserTool } from './eraser'
import {
  HistoryManager,
  performAddObject,
  performMoveObjects,
  performRemoveObjects,
  SurfaceChangeCommand,
  type IndexedObject,
} from './history'
import { PointerInputManager, type PointerInputEvent, type PointerTargetLike } from './input'
import {
  drawLassoPreview,
  drawSelectedBounds,
  drawSelectionRegion,
  LassoSelectionBuilder,
  RectSelectionBuilder,
  selectObjects,
} from './selection'
import { ShapeBuilder, type ShapeTool } from './shapeBuilder'
import { StrokeBuilder, type StrokeTool } from './strokeBuilder'
import {
  buildTextObject,
  createCanvasTextMeasurer,
  type TextMeasurer,
} from './text'
import type { DrawingSurface } from './surface'
import type { DrawingObject, ObjectId, Point, ShapeStyle, StrokeStyle, TextObject, TextStyle } from './types'

/** Công cụ chọn vùng. */
export type SelectionTool = 'select-rect' | 'select-lasso'
/** Công cụ tẩy. */
export type EraserTool = 'stroke-eraser' | 'segment-eraser'
/** Mọi công cụ của DrawingEngine. */
export type DrawingTool = StrokeTool | ShapeTool | 'text' | SelectionTool | EraserTool

const SHAPE_TOOLS: readonly ShapeTool[] = ['line', 'rectangle', 'ellipse', 'arrow']

/** Phiên làm việc của công cụ hiện tại (builder tạo object, builder chọn, hoặc tool tẩy). */
type ToolSession =
  | StrokeBuilder
  | ShapeBuilder
  | RectSelectionBuilder
  | LassoSelectionBuilder
  | StrokeEraserTool
  | SegmentEraserTool
  | null

export interface DrawingEngineOptions {
  surface: DrawingSurface
  /** Phần tử vừa là đích pointer vừa là canvas (HTMLCanvasElement thỏa mãn cả hai). */
  element: PointerTargetLike & CanvasLike
  getCamera: () => Camera
  tool?: DrawingTool
  /** Style ban đầu cho công cụ nét (pen/highlighter). */
  style?: Partial<StrokeStyle>
  /** Style ban đầu cho công cụ hình (line/rectangle/ellipse/arrow). */
  shapeStyle?: Partial<ShapeStyle>
  /** Đường kính vùng tẩy ban đầu (world units) cho hai công cụ tẩy. */
  eraserSize?: number
  /** Giới hạn số command của History (mặc định DEFAULT_HISTORY_LIMIT = 100). */
  historyLimit?: number
  /**
   * Bộ đo text cho `addTextObject`. Bỏ qua → engine tự tạo bộ đo bằng
   * chính canvas của nó (measureText) khi cần lần đầu.
   */
  textMeasurer?: TextMeasurer
  /**
   * Gọi khi người dùng chạm/chuột xuống với công cụ 'text': tầng view
   * mở trình sửa text tại vị trí world này, rồi gọi `addTextObject`.
   */
  onTextPlacementRequested?: (position: Point) => void
  requestFrame?: FrameRequester
  cancelFrame?: FrameCanceller
  getDevicePixelRatio?: () => number
}

export class DrawingEngine {
  readonly surface: DrawingSurface
  /** Lịch sử undo/redo của riêng Surface này (TASK-05F, DEC-020). */
  readonly history: HistoryManager
  private readonly element: PointerTargetLike & CanvasLike
  private readonly renderer: CanvasRenderer
  private readonly inputManager: PointerInputManager
  private readonly injectedTextMeasurer: TextMeasurer | undefined
  private readonly onTextPlacementRequested: ((position: Point) => void) | undefined
  private canvasTextMeasurer: TextMeasurer | null = null

  private activeSession: ToolSession
  private currentTool: DrawingTool
  private strokeStyle: Partial<StrokeStyle> | undefined
  private shapeStyle: Partial<ShapeStyle> | undefined
  private currentEraserSize: number
  private selectedIds: ObjectId[] = []
  /** Khung trạng thái đầu một lần tẩy liên tục (để gom thành MỘT command). */
  private eraserGestureStart: {
    objects: readonly DrawingObject[]
    label: string
  } | null = null
  private attached = false

  constructor(options: DrawingEngineOptions) {
    this.surface = options.surface
    this.history = new HistoryManager(options.surface, { limit: options.historyLimit })
    this.element = options.element
    this.currentTool = options.tool ?? 'pen'
    this.strokeStyle = options.style
    this.shapeStyle = options.shapeStyle
    this.currentEraserSize = options.eraserSize ?? DEFAULT_ERASER_SIZE
    this.injectedTextMeasurer = options.textMeasurer
    this.onTextPlacementRequested = options.onTextPlacementRequested
    this.activeSession = this.createSession()
    this.renderer = new CanvasRenderer({
      canvas: options.element,
      getObjects: () => this.surface.listObjects(),
      getPreviewObjects: () => {
        const session = this.activeSession
        if (session instanceof StrokeBuilder || session instanceof ShapeBuilder) {
          const preview = session.previewObject()
          return preview === null ? [] : [preview]
        }
        return []
      },
      getOverlay: () => this.buildOverlay(),
      getCamera: options.getCamera,
      requestFrame: options.requestFrame,
      cancelFrame: options.cancelFrame,
      getDevicePixelRatio: options.getDevicePixelRatio,
    })
    this.inputManager = new PointerInputManager({
      target: options.element,
      getCamera: options.getCamera,
      onEvent: (event) => this.handleInputEvent(event),
    })
  }

  get tool(): DrawingTool {
    return this.currentTool
  }

  /** True khi đang có một thao tác tạo/chọn/tẩy đang diễn ra. */
  get isDrawingInProgress(): boolean {
    const session = this.activeSession
    if (session === null) return false
    return session.isActive
  }

  get isAttached(): boolean {
    return this.attached
  }

  /** Đường kính vùng tẩy hiện tại (world units). */
  get eraserSize(): number {
    return this.currentEraserSize
  }

  /** Đổi kích thước vùng tẩy; áp dụng ngay cho phiên tẩy đang mở. */
  setEraserSize(size: number): void {
    this.currentEraserSize = size
    if (
      this.activeSession instanceof StrokeEraserTool ||
      this.activeSession instanceof SegmentEraserTool
    ) {
      this.activeSession.size = size
    }
  }

  /** Bắt đầu tiếp nhận đầu vào (và vẽ khung hình đầu tiên). */
  attach(): void {
    if (this.attached) return
    this.inputManager.attach()
    this.attached = true
    this.renderer.requestRender()
  }

  /** Ngừng tiếp nhận đầu vào; object đang tạo dở được hoàn tất vào Surface trước. */
  detach(): void {
    if (!this.attached) return
    this.commitActiveObject()
    this.finishEraserGesture()
    this.inputManager.detach()
    this.attached = false
  }

  /** Detach + giải phóng renderer (hủy frame đang chờ). */
  dispose(): void {
    this.detach()
    this.renderer.dispose()
  }

  /**
   * Đổi công cụ và/hoặc style. Object đang tạo dở được hoàn tất vào
   * Surface trước khi đổi để không mất dữ liệu; Input Manager cũng
   * được reset để phần còn lại của thao tác vật lý cũ không rò sang
   * công cụ mới. Kết quả chọn (danh sách ID) được giữ nguyên.
   */
  setTool(tool: StrokeTool, style?: Partial<StrokeStyle>): void
  setTool(tool: ShapeTool, style?: Partial<ShapeStyle>): void
  setTool(tool: 'text'): void
  setTool(tool: SelectionTool | EraserTool): void
  setTool(
    tool: DrawingTool,
    style?: Partial<StrokeStyle> | Partial<ShapeStyle>,
  ): void {
    this.commitActiveObject()
    this.finishEraserGesture()
    this.inputManager.reset()
    this.currentTool = tool
    if (tool === 'pen' || tool === 'highlighter') {
      this.strokeStyle = style as Partial<StrokeStyle> | undefined
    } else if ((SHAPE_TOOLS as readonly string[]).includes(tool)) {
      this.shapeStyle = style as Partial<ShapeStyle> | undefined
    }
    this.activeSession = this.createSession()
    this.renderer.requestRender()
  }

  /**
   * Tạo một TextObject tại vị trí world cho trước (thường là vị trí
   * nhận qua `onTextPlacementRequested`), thêm vào Surface và vẽ lại.
   * Nội dung rỗng sẽ bị Text Engine từ chối (ném lỗi).
   */
  addTextObject(input: {
    position: Point
    text: string
    style?: Partial<TextStyle>
    maxWidth?: number
  }): TextObject {
    const object = buildTextObject({
      surfaceId: this.surface.id,
      position: input.position,
      text: input.text,
      style: input.style,
      maxWidth: input.maxWidth,
      measurer: this.resolveTextMeasurer(),
    })
    this.history.execute('Text', (surface) => performAddObject(surface, object))
    this.renderer.requestRender()
    return object
  }

  // -------------------------------------------------------------------------
  // Selection (TASK-05E)
  // -------------------------------------------------------------------------

  /** Danh sách ID đang được chọn (bản sao chỉ đọc). */
  getSelection(): readonly ObjectId[] {
    return [...this.selectedIds]
  }

  /** Bỏ chọn tất cả. */
  clearSelection(): void {
    if (this.selectedIds.length === 0) return
    this.selectedIds = []
    this.renderer.requestRender()
  }

  /**
   * Di chuyển mọi object đang chọn theo cùng một delta — nguyên tử
   * qua `updateObjects` và ghi thành MỘT history command (TASK-05F).
   * ID đã không còn tồn tại trên Surface bị loại khỏi danh sách chọn
   * trước khi di chuyển. Trả về false khi không có thay đổi nào
   * (không còn object để di chuyển, hoặc delta bằng 0).
   */
  moveSelectionBy(delta: Point): boolean {
    this.pruneSelectionToLive()
    if (this.selectedIds.length === 0) return false
    const changed = this.history.execute('Move selection', (surface) =>
      performMoveObjects(surface, this.selectedIds, delta),
    )
    if (changed) this.renderer.requestRender()
    return changed
  }

  /** Xóa mọi object đang chọn khỏi Surface (một history command). Trả về số object đã xóa. */
  deleteSelection(): number {
    let removed = 0
    this.history.execute('Delete selection', (surface) => {
      const change = performRemoveObjects(surface, this.selectedIds)
      removed = change?.before.length ?? 0
      return change
    })
    this.selectedIds = []
    if (removed > 0) this.renderer.requestRender()
    return removed
  }

  // -------------------------------------------------------------------------
  // History (TASK-05F)
  // -------------------------------------------------------------------------

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  /** Hoàn tác thao tác gần nhất trên Surface này và vẽ lại. */
  undo(): boolean {
    const done = this.history.undo()
    if (done) {
      this.pruneSelectionToLive()
      this.renderer.requestRender()
    }
    return done
  }

  /** Tái thực hiện thao tác vừa hoàn tác và vẽ lại. */
  redo(): boolean {
    const done = this.history.redo()
    if (done) {
      this.pruneSelectionToLive()
      this.renderer.requestRender()
    }
    return done
  }

  /** Loại các ID không còn tồn tại khỏi danh sách đang chọn. */
  private pruneSelectionToLive(): void {
    this.selectedIds = this.selectedIds.filter((id) => this.surface.hasObject(id))
  }

  /** Khai báo kích thước hiển thị của canvas (CSS px). */
  resize(cssWidth: number, cssHeight: number): void {
    this.renderer.resize(cssWidth, cssHeight)
  }

  /** Yêu cầu vẽ lại ở khung hình tiếp theo (ví dụ sau khi camera đổi). */
  requestRender(): void {
    this.renderer.requestRender()
  }

  private resolveTextMeasurer(): TextMeasurer {
    if (this.injectedTextMeasurer !== undefined) return this.injectedTextMeasurer
    if (this.canvasTextMeasurer === null) {
      const ctx = this.element.getContext('2d')
      if (ctx === null) {
        throw new Error('DrawingEngine: canvas 2d context is unavailable for text measuring')
      }
      this.canvasTextMeasurer = createCanvasTextMeasurer(ctx)
    }
    return this.canvasTextMeasurer
  }

  private createSession(): ToolSession {
    switch (this.currentTool) {
      case 'text':
        return null
      case 'pen':
      case 'highlighter':
        return new StrokeBuilder({
          surfaceId: this.surface.id,
          tool: this.currentTool,
          style: this.strokeStyle,
        })
      case 'line':
      case 'rectangle':
      case 'ellipse':
      case 'arrow':
        return new ShapeBuilder({
          surfaceId: this.surface.id,
          tool: this.currentTool,
          style: this.shapeStyle,
        })
      case 'select-rect':
        return new RectSelectionBuilder()
      case 'select-lasso':
        return new LassoSelectionBuilder()
      case 'stroke-eraser':
        return new StrokeEraserTool({
          surface: this.surface,
          size: this.currentEraserSize,
        })
      case 'segment-eraser':
        return new SegmentEraserTool({
          surface: this.surface,
          size: this.currentEraserSize,
        })
    }
  }

  private commitActiveObject(): void {
    if (this.activeSession instanceof StrokeBuilder) {
      const finished = this.activeSession.finishStroke()
      if (finished !== null) {
        this.history.execute(this.createLabel(), (surface) =>
          performAddObject(surface, finished),
        )
      }
    } else if (this.activeSession instanceof ShapeBuilder) {
      const finished = this.activeSession.finishShape()
      if (finished !== null) {
        this.history.execute(this.createLabel(), (surface) =>
          performAddObject(surface, finished),
        )
      }
    }
    // Builder chọn và tool tẩy không có object "đang tạo dở" cần chốt:
    // vùng chọn dở bị bỏ, phần đã tẩy đã nằm trên Surface.
  }

  /** Nhãn history cho thao tác tạo object của công cụ hiện tại. */
  private createLabel(): string {
    switch (this.currentTool) {
      case 'pen':
        return 'Pen stroke'
      case 'highlighter':
        return 'Highlighter stroke'
      case 'line':
        return 'Line'
      case 'rectangle':
        return 'Rectangle'
      case 'ellipse':
        return 'Ellipse'
      case 'arrow':
        return 'Arrow'
      default:
        return 'Add object'
    }
  }

  /**
   * Chốt một lần tẩy liên tục thành MỘT history command: phía TRƯỚC
   * là các object đầu lần tẩy đã biến mất (bị xóa hoặc bị thay thế),
   * phía SAU là các object mới xuất hiện trong lần tẩy (các đoạn còn
   * lại). Object không liên quan không bị ghi vào command. Lần tẩy
   * không đổi gì → không ghi.
   */
  private finishEraserGesture(): void {
    const start = this.eraserGestureStart
    if (start === null) return
    this.eraserGestureStart = null
    const startIds = new Set(start.objects.map((object) => object.id))
    const endObjects = this.surface.listObjects()
    const endIds = new Set(endObjects.map((object) => object.id))
    const before: IndexedObject[] = []
    start.objects.forEach((object, index) => {
      if (!endIds.has(object.id)) before.push({ object, index })
    })
    const after: IndexedObject[] = []
    endObjects.forEach((object, index) => {
      if (!startIds.has(object.id)) after.push({ object, index })
    })
    if (before.length === 0 && after.length === 0) return
    this.history.record(new SurfaceChangeCommand(start.label, { before, after }))
  }

  /** Lớp phủ hiện tại: vùng chọn đang kéo, khung các object đã chọn, con trỏ tẩy. */
  private buildOverlay(): ((ctx: CanvasSurfaceContextLike, camera: Camera) => void) | null {
    const session = this.activeSession
    const selectedObjects = this.selectedIds
      .map((id) => this.surface.getObject(id))
      .filter((object) => object !== undefined)
    const hasRegionPreview =
      (session instanceof RectSelectionBuilder && session.previewRegion !== null) ||
      (session instanceof LassoSelectionBuilder && session.previewPoints.length >= 2)
    const eraserCursor =
      session instanceof StrokeEraserTool || session instanceof SegmentEraserTool
        ? session.lastPosition
        : null
    if (!hasRegionPreview && selectedObjects.length === 0 && eraserCursor === null) {
      return null
    }
    return (ctx, camera) => {
      if (session instanceof RectSelectionBuilder && session.previewRegion !== null) {
        drawSelectionRegion(ctx, session.previewRegion, camera)
      }
      if (session instanceof LassoSelectionBuilder) {
        drawLassoPreview(ctx, session.previewPoints, camera)
      }
      if (selectedObjects.length > 0) {
        drawSelectedBounds(ctx, selectedObjects, camera)
      }
      if (
        (session instanceof StrokeEraserTool || session instanceof SegmentEraserTool) &&
        session.lastPosition !== null
      ) {
        const center = worldToScreen(session.lastPosition, camera)
        const radius = session.radius * camera.zoom
        ctx.save()
        try {
          ctx.strokeStyle = '#6b7280'
          ctx.lineWidth = 1
          ctx.globalAlpha = 1
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.ellipse(center.x, center.y, radius, radius, 0, 0, Math.PI * 2)
          ctx.stroke()
        } finally {
          ctx.restore()
        }
      }
    }
  }

  private handleInputEvent(event: PointerInputEvent): void {
    if (this.currentTool === 'text') {
      if (event.type === 'down') {
        this.onTextPlacementRequested?.({ ...event.sample.position })
      }
      return
    }
    const session = this.activeSession
    if (session === null) return
    if (session instanceof StrokeBuilder || session instanceof ShapeBuilder) {
      const result = session.handleEvent(event)
      if (result.type === 'completed') {
        // Một nét/hình hoàn chỉnh = đúng MỘT history command.
        this.history.execute(this.createLabel(), (surface) =>
          performAddObject(surface, result.object),
        )
      }
      if (result.type !== 'ignored') {
        this.renderer.requestRender()
      }
      return
    }
    if (session instanceof RectSelectionBuilder || session instanceof LassoSelectionBuilder) {
      const result = session.handleEvent(event)
      if (result.type === 'completed') {
        this.selectedIds = selectObjects(this.surface.listObjects(), result.region)
      }
      if (result.type !== 'ignored') {
        this.renderer.requestRender()
      }
      return
    }
    // Hai công cụ tẩy: gom toàn bộ một lần kéo tẩy thành MỘT command.
    if (event.type === 'down' && this.eraserGestureStart === null) {
      this.eraserGestureStart = {
        objects: this.surface.listObjects(),
        label: session instanceof StrokeEraserTool ? 'Stroke eraser' : 'Segment eraser',
      }
    }
    const outcome = session.handleEvent(event)
    if (outcome.changedObjectIds.length > 0) {
      const changed = new Set(outcome.changedObjectIds)
      this.selectedIds = this.selectedIds.filter((id) => !changed.has(id))
    }
    if (event.type === 'up' || event.type === 'cancel') {
      this.finishEraserGesture()
    }
    this.renderer.requestRender()
  }
}
