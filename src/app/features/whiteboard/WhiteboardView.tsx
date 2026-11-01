import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  LoaderCircle,
  Maximize,
  MoveLeft,
  MoveRight,
  Plus,
  Trash,
  TriangleAlert,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { getAppStorage } from '../../storage'
import { whiteboardPageBackgroundSlot } from '../../../data/index'
import {
  paperBackgroundStyle,
  useBackgroundImageUrl,
} from '../backgrounds/paperBackground'
import { BackgroundPicker } from '../backgrounds/BackgroundPicker'
import { PenKindSelect } from '../pens/PenKindSelect'
import { PenPresetBar } from '../pens/PenPresetBar'
import {
  attachAutoScroll,
  dispatchAutoScrollMove,
  shouldAutoScrollForTool,
} from '../../../engines/drawing/autoScroll'
import {
  WB_HIGHLIGHT_COLORS,
  WB_PEN_COLORS,
  WhiteboardController,
} from './WhiteboardController'
import {
  WHITEBOARD_PAGE_SIZE,
  WhiteboardStore,
} from './whiteboardStore'

/**
 * WhiteboardView (TASK-12): bề mặt bảng trắng nhiều trang.
 * Trang là một khung cố định (DEC-019) gồm lớp nền mẫu
 * (CSS) + canvas của Drawing Engine dùng chung (DEC-015)
 * phủ đúng kích thước hiển thị. Controller framework-free
 * giữ phiên/engine; registry theo whiteboardId giúp phiên
 * sống qua remount (StrictMode) như các mode khác.
 */

const whiteboardControllers = new Map<string, WhiteboardController>()

/** Controller của một bảng trắng theo id (dùng chung giữa WhiteboardView và Split Mode). */
export function getWhiteboardController(documentId: string): WhiteboardController {
  const existing = whiteboardControllers.get(documentId)
  if (existing !== undefined) return existing
  const { foundation, annotationEngine } = getAppStorage()
  const controller = new WhiteboardController({
    store: new WhiteboardStore({
      documents: foundation.documents,
      annotations: foundation.annotations,
      backgroundImages: foundation.backgroundImages,
    }),
    annotationEngine,
    backgroundImages: foundation.backgroundImages,
  })
  whiteboardControllers.set(documentId, controller)
  return controller
}

export function releaseWhiteboardController(documentId: string): void {
  whiteboardControllers.delete(documentId)
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`rounded-lg p-2 transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

export function WhiteboardView({
  documentId,
  onBack,
  embedded = false,
}: {
  documentId: string
  onBack: () => void
  /** Nhúng trong Split Mode: ẩn hàng tiêu đề/quay lại (workspace đã có khung riêng). */
  embedded?: boolean
}) {
  const controller = useMemo(() => getWhiteboardController(documentId), [documentId])
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [title, setTitle] = useState('Bảng trắng')
  const [leaving, setLeaving] = useState(false)
  const [leaveFailed, setLeaveFailed] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [backgroundImageError, setBackgroundImageError] = useState<string | null>(null)
  const backgroundImageUrl = useBackgroundImageUrl(
    documentId,
    snapshot.background.kind,
    whiteboardPageBackgroundSlot(snapshot.pageIndex),
  )

  useEffect(() => {
    let cancelled = false
    void getAppStorage()
      .foundation.documents.getById(documentId)
      .then((record) => {
        if (!cancelled && record !== undefined) setTitle(record.name)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [documentId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    void controller.open(documentId, canvas)
    const scroll = scrollRef.current
    // TASK-14B: pinch hai ngón cần khung cuộn để pan/neo zoom.
    controller.bindScrollContainer(scroll)
    // TASK-14A: tự cuộn khi vẽ gần mép dưới/phải của khung bảng.
    const detachAutoScroll =
      scroll !== null
        ? attachAutoScroll({
            target: canvas,
            container: scroll,
            isEnabled: () =>
              shouldAutoScrollForTool(controller.getSnapshot().tool),
            onScrolled: (info) => {
              dispatchAutoScrollMove(canvas, info)
            },
          })
        : null
    const observer =
      scroll !== null
        ? new ResizeObserver(() => {
            controller.setViewportSize(scroll.clientWidth, scroll.clientHeight)
          })
        : null
    if (scroll !== null && observer !== null) {
      observer.observe(scroll)
      controller.setViewportSize(scroll.clientWidth, scroll.clientHeight)
    }
    const frame = frameRef.current
    const frameObserver =
      frame !== null
        ? new ResizeObserver(() => {
            controller.handleCanvasResize(frame.clientWidth, frame.clientHeight)
          })
        : null
    if (frame !== null && frameObserver !== null) frameObserver.observe(frame)
    return () => {
      controller.bindScrollContainer(null)
      detachAutoScroll?.()
      observer?.disconnect()
      frameObserver?.disconnect()
      void controller.flush().catch(() => undefined)
    }
  }, [controller, documentId])

  const handleBack = async () => {
    setLeaving(true)
    setLeaveFailed(false)
    try {
      await controller.close()
      releaseWhiteboardController(documentId)
      onBack()
    } catch {
      setLeaving(false)
      setLeaveFailed(true)
    }
  }

  const colors = snapshot.tool === 'highlighter' ? WB_HIGHLIGHT_COLORS : WB_PEN_COLORS
  const ready = snapshot.status === 'ready'
  const pageWidth = WHITEBOARD_PAGE_SIZE.width * snapshot.scale
  const pageHeight = WHITEBOARD_PAGE_SIZE.height * snapshot.scale

  return (
    <div className="flex flex-col gap-3">
      {!embedded && (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleBack()}
          disabled={leaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-800">{title}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" role="status">
          {(snapshot.saveState === 'saving' || snapshot.saveState === 'pending') && (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Đang lưu…
            </>
          )}
          {snapshot.saveState === 'saved' && ready && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Đã lưu
            </>
          )}
          {snapshot.saveState === 'error' && (
            <>
              <TriangleAlert className="h-3.5 w-3.5 text-red-500" />
              {snapshot.saveError ?? 'Lỗi lưu'}
              <button
                type="button"
                onClick={() => void controller.retrySave()}
                className="font-medium text-blue-600 hover:underline"
              >
                Thử lưu lại
              </button>
            </>
          )}
        </span>
      </div>
      )}

      {leaveFailed && !embedded && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="h-4 w-4" />
          <span className="flex-1">Chưa lưu được thay đổi nên chưa thể rời bảng trắng.</span>
          <button
            type="button"
            onClick={() => {
              releaseWhiteboardController(documentId)
              onBack()
            }}
            className="font-medium text-red-700 underline"
          >
            Bỏ thay đổi và quay lại
          </button>
        </div>
      )}

      {snapshot.status === 'error' ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {snapshot.errorMessage ?? 'Không mở được bảng trắng.'}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
            <PenKindSelect
              value={snapshot.tool === 'stroke-eraser' ? 'pen' : snapshot.tool}
              onChange={(kind) => controller.setTool(kind)}
            />
            <ToolButton label="Tẩy nét" active={snapshot.tool === 'stroke-eraser'} onClick={() => controller.setTool('stroke-eraser')}>
              <Eraser className="h-4 w-4" />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {snapshot.tool !== 'stroke-eraser' && (
              <>
                <span className="flex items-center gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Màu ${color}`}
                      onClick={() => controller.setColor(color)}
                      className={`h-5 w-5 rounded-full border transition ${
                        snapshot.color === color
                          ? 'ring-2 ring-blue-500 ring-offset-1'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="flex items-center gap-1" role="group" aria-label="Cỡ nét">
                  {(['S', 'M', 'L'] as const).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => controller.setSizeLabel(label)}
                      aria-pressed={snapshot.sizeLabel === label}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                        snapshot.sizeLabel === label
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <span className="mx-1 h-5 w-px bg-slate-200" />
              </>
            )}
            <PenPresetBar
              current={
                snapshot.tool === 'stroke-eraser'
                  ? null
                  : { kind: snapshot.tool, color: snapshot.color, sizeLabel: snapshot.sizeLabel }
              }
              onApply={(preset) => controller.applyPreset(preset)}
            />
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <ToolButton label="Hoàn tác" onClick={() => controller.undo()}>
              <Undo2 className={`h-4 w-4 ${snapshot.canUndo ? '' : 'opacity-35'}`} />
            </ToolButton>
            <ToolButton label="Làm lại" onClick={() => controller.redo()}>
              <Redo2 className={`h-4 w-4 ${snapshot.canRedo ? '' : 'opacity-35'}`} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <ToolButton label="Thu nhỏ" onClick={() => controller.zoomOut()}>
              <ZoomOut className="h-4 w-4" />
            </ToolButton>
            <span className="min-w-11 text-center text-xs text-slate-500">
              {Math.round(snapshot.scale * 100)}%
            </span>
            <ToolButton label="Phóng to" onClick={() => controller.zoomIn()}>
              <ZoomIn className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Vừa màn hình" onClick={() => controller.fitToViewport()}>
              <Maximize className="h-4 w-4" />
            </ToolButton>
          </div>

          <div
            ref={scrollRef}
            className={`${embedded ? 'h-[46vh] min-h-[260px]' : 'h-[62vh] min-h-[320px]'} overflow-auto rounded-2xl border border-slate-200 bg-slate-100`}
          >
            <div className="flex min-h-full min-w-max items-start justify-center p-4">
              <div
                ref={frameRef}
                className="relative shrink-0 overflow-hidden rounded-lg shadow-md"
                style={{ width: pageWidth, height: pageHeight, ...paperBackgroundStyle(snapshot.background, snapshot.scale, backgroundImageUrl) }}
              >
                <canvas
                  ref={canvasRef}
                  aria-label="Bề mặt vẽ của bảng trắng"
                  className="absolute inset-0 h-full w-full"
                  style={{ touchAction: 'none' }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
            <ToolButton label="Trang trước" onClick={() => void controller.prevPage()}>
              <ChevronLeft className="h-4 w-4" />
            </ToolButton>
            <span className="min-w-20 text-center text-xs text-slate-600">
              Trang {snapshot.pageCount === 0 ? 0 : snapshot.pageIndex + 1} / {snapshot.pageCount}
            </span>
            <ToolButton label="Trang sau" onClick={() => void controller.nextPage()}>
              <ChevronRight className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Thêm trang" onClick={() => void controller.addPage()}>
              <Plus className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Đưa trang sang trái" onClick={() => void controller.moveCurrentPage(-1)}>
              <MoveLeft className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Đưa trang sang phải" onClick={() => void controller.moveCurrentPage(1)}>
              <MoveRight className="h-4 w-4" />
            </ToolButton>
            {confirmingDelete ? (
              <>
                <span className="text-xs text-red-600">Xóa trang này và nét vẽ trên đó?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false)
                    void controller.deleteCurrentPage()
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
                >
                  Xóa trang
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                >
                  Hủy
                </button>
              </>
            ) : (
              <ToolButton label="Xóa trang" onClick={() => setConfirmingDelete(true)}>
                <Trash className="h-4 w-4" />
              </ToolButton>
            )}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <BackgroundPicker
              value={snapshot.background}
              imageError={backgroundImageError}
              onChange={(background) => {
                setBackgroundImageError(null)
                void controller.setBackground(background)
              }}
              onPickImage={(file) => {
                void controller.setBackgroundImage(file).then((result) => {
                  setBackgroundImageError(result.message)
                })
              }}
            />
            <button
              type="button"
              onClick={() => void controller.applyBackgroundToAll(snapshot.background)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Áp dụng nền cho mọi trang
            </button>
          </div>
        </>
      )}
    </div>
  )
}
