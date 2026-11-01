import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eraser,
  Highlighter,
  LoaderCircle,
  Maximize,
  Pen,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { getAppStorage } from '../../storage'
import {
  paperBackgroundStyle,
  useBackgroundImageUrl,
} from '../backgrounds/paperBackground'
import { BackgroundPicker } from '../backgrounds/BackgroundPicker'
import {
  attachAutoScroll,
  dispatchAutoScrollMove,
  shouldAutoScrollForTool,
} from '../../../engines/drawing/autoScroll'
import { PdfViewerController, type PdfViewerSnapshot } from './PdfViewerController'
import { PdfExportDialog } from './PdfExportDialog'
import type { ViewerTool } from './pdfViewerState'

export interface PdfViewerProps {
  documentId: string
  onBack: () => void
}

const TOOL_BUTTONS: { tool: ViewerTool; label: string; Icon: typeof Pen }[] = [
  { tool: 'pen', label: 'Bút', Icon: Pen },
  { tool: 'highlighter', label: 'Highlight', Icon: Highlighter },
  { tool: 'stroke-eraser', label: 'Tẩy', Icon: Eraser },
]

function saveLabel(snapshot: PdfViewerSnapshot): string {
  switch (snapshot.saveState) {
    case 'pending':
    case 'saving':
      return 'Đang lưu…'
    case 'saved':
      return 'Đã lưu trên thiết bị'
    case 'error':
      return 'Lỗi lưu annotation'
    default:
      return 'Sẵn sàng'
  }
}

export function PdfViewer({ documentId, onBack }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const annoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<PdfViewerController | null>(null)
  const [snapshot, setSnapshot] = useState<PdfViewerSnapshot | null>(null)
  const [pageInput, setPageInput] = useState('1')
  const [exportOpen, setExportOpen] = useState(false)
  const [backgroundImageError, setBackgroundImageError] = useState<string | null>(null)
  const backgroundImageUrl = useBackgroundImageUrl(
    snapshot?.documentId ?? null,
    snapshot?.background.kind ?? 'blank',
  )

  useEffect(() => {
    const { foundation, annotationEngine } = getAppStorage()
    const controller = new PdfViewerController({
      documents: foundation.documents,
      annotationEngine,
      backgrounds: foundation.backgrounds,
      backgroundImages: foundation.backgroundImages,
    })
    controllerRef.current = controller
    setSnapshot(controller.getSnapshot())
    const unsubscribe = controller.subscribe(() => setSnapshot(controller.getSnapshot()))
    const container = containerRef.current
    const pdfCanvas = pdfCanvasRef.current
    const annoCanvas = annoCanvasRef.current
    let detachAutoScroll: (() => void) | null = null
    if (container !== null && pdfCanvas !== null && annoCanvas !== null) {
      controller.bindElements({ pdfCanvas, annotationCanvas: annoCanvas, container })
      void controller.openDocument(documentId)
      // TASK-14A: tự cuộn khi vẽ gần mép dưới/phải của khung trang.
      detachAutoScroll = attachAutoScroll({
        target: annoCanvas,
        container,
        isEnabled: () => shouldAutoScrollForTool(controller.getSnapshot().tool),
        onScrolled: (info) => {
          dispatchAutoScrollMove(annoCanvas, info)
        },
      })
    }
    const observer =
      container !== null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => controller.handleResize())
        : null
    if (observer !== null && container !== null) observer.observe(container)
    return () => {
      detachAutoScroll?.()
      observer?.disconnect()
      unsubscribe()
      controller.dispose()
      controllerRef.current = null
    }
  }, [documentId])

  const pageIndex = snapshot?.pageIndex
  const viewerStatus = snapshot?.status
  useEffect(() => {
    if (viewerStatus === 'ready' && pageIndex !== undefined) {
      setPageInput(String(pageIndex + 1))
    }
  }, [pageIndex, viewerStatus])

  const controller = controllerRef.current
  const ready = snapshot?.status === 'ready'

  const commitPageInput = () => {
    if (controller === null || snapshot === null) return
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isFinite(parsed)) {
      void controller.goToPage(parsed - 1)
    } else {
      setPageInput(String(snapshot.pageIndex + 1))
    }
  }

  const handleBack = async () => {
    if (controller === null) {
      onBack()
      return
    }
    try {
      await controller.closeDocument()
      onBack()
    } catch {
      // closeDocument đã ghi lỗi lưu vào snapshot — ở lại viewer
      // để người dùng thử lưu lại, không âm thầm bỏ dữ liệu.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Thanh trên: quay lại, tên tài liệu, trạng thái lưu */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleBack()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Thư viện
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
          {snapshot?.fileName ?? 'Đang mở tài liệu…'}
        </p>
        <div
          role="status"
          className={`inline-flex items-center gap-1.5 text-xs ${
            snapshot?.saveState === 'error' ? 'text-red-600' : 'text-slate-500'
          }`}
        >
          {(snapshot?.saveState === 'pending' || snapshot?.saveState === 'saving') && (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          )}
          {snapshot !== null ? saveLabel(snapshot) : 'Đang tải…'}
          {snapshot?.saveState === 'error' && controller !== null && (
            <button
              type="button"
              onClick={() => void controller.retrySave()}
              className="font-medium text-blue-600 underline underline-offset-2"
            >
              Thử lưu lại
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={snapshot?.status !== 'ready'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Xuất PDF
        </button>
      </div>
      {exportOpen && (
        <PdfExportDialog
          documentId={documentId}
          documentName={snapshot?.fileName ?? 'tai-lieu.pdf'}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Thanh công cụ: viết + undo/redo + điều hướng + zoom */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="Công cụ viết">
          {TOOL_BUTTONS.map(({ tool, label, Icon }) => (
            <button
              key={tool}
              type="button"
              disabled={!ready}
              onClick={() => controller?.setTool(tool)}
              aria-pressed={snapshot?.tool === tool}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition disabled:opacity-40 ${
                snapshot?.tool === tool
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            disabled={!ready || !(snapshot?.canUndo ?? false)}
            onClick={() => controller?.undo()}
            aria-label="Hoàn tác"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!ready || !(snapshot?.canRedo ?? false)}
            onClick={() => controller?.redo()}
            aria-label="Làm lại"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Điều hướng trang">
          <button
            type="button"
            disabled={!ready || (snapshot?.pageIndex ?? 0) <= 0}
            onClick={() => void controller?.prevPage()}
            aria-label="Trang trước"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="inline-flex items-center gap-1 text-sm text-slate-600">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPageInput()
              }}
              inputMode="numeric"
              aria-label="Số trang"
              className="w-12 rounded-md border border-slate-300 px-1.5 py-1 text-center text-sm"
            />
            / {snapshot?.pageCount ?? 0}
          </span>
          <button
            type="button"
            disabled={
              !ready || (snapshot?.pageIndex ?? 0) >= (snapshot?.pageCount ?? 1) - 1
            }
            onClick={() => void controller?.nextPage()}
            aria-label="Trang tiếp theo"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Thu phóng">
          <button
            type="button"
            disabled={!ready}
            onClick={() => void controller?.zoomOut()}
            aria-label="Thu nhỏ"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-slate-600">
            {snapshot !== null ? `${Math.round(snapshot.scale * 100)}%` : '—'}
          </span>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void controller?.zoomIn()}
            aria-label="Phóng to"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void controller?.fit()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <Maximize className="h-4 w-4" />
            <span className="hidden sm:inline">Vừa khung</span>
          </button>
        </div>

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <BackgroundPicker
          value={snapshot?.background ?? { kind: 'blank' }}
          disabled={!ready}
          imageError={backgroundImageError}
          onChange={(background) => {
            setBackgroundImageError(null)
            void controller?.setBackground(background)
          }}
          onPickImage={(file) => {
            void controller?.setBackgroundImage(file).then((result) => {
              if (result !== undefined) {
                setBackgroundImageError(result.message)
              }
            })
          }}
        />
      </div>

      {snapshot?.saveError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Không lưu được annotation: {snapshot.saveError}. Dữ liệu vẫn được giữ
            để thử lại — đừng đóng tab trước khi lưu thành công.
          </span>
        </div>
      )}

      {/* Vùng hiển thị trang: chiều cao xác định (70vh) để fit
          ổn định và cuộn nội bộ; w-max + mx-auto giúp trang rộng
          hơn khung vẫn cuộn tới được mép trái khi zoom lớn. */}
      <div
        ref={containerRef}
        className="relative h-[70vh] min-h-[320px] overflow-auto rounded-2xl border border-slate-200 bg-slate-100"
      >
        {snapshot?.status === 'loading' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Đang mở tài liệu…
          </div>
        )}
        {snapshot?.status === 'error' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-400" />
            <p className="max-w-md text-sm text-slate-600">{snapshot.errorMessage}</p>
          </div>
        )}
        <div className="mx-auto w-max p-4">
          <div
            className="relative"
            style={{
              width: snapshot?.pageCssWidth ? `${snapshot.pageCssWidth}px` : undefined,
              height: snapshot?.pageCssHeight ? `${snapshot.pageCssHeight}px` : undefined,
              ...(snapshot !== null
                ? paperBackgroundStyle(snapshot.background, snapshot.scale, backgroundImageUrl)
                : {}),
            }}
          >
            <canvas
              ref={pdfCanvasRef}
              className={`absolute left-0 top-0 shadow ${
                (snapshot?.background.kind ?? 'blank') === 'blank' ? 'bg-white' : ''
              }`}
            />
            <canvas
              ref={annoCanvasRef}
              className="absolute left-0 top-0"
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
