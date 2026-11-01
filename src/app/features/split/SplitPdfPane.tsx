import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { getAppStorage } from '../../storage'
import {
  paperBackgroundStyle,
  useBackgroundImageUrl,
} from '../backgrounds/paperBackground'
import { BackgroundPicker } from '../backgrounds/BackgroundPicker'
import { PdfViewerController, type PdfViewerSnapshot } from '../documents/PdfViewerController'
import { pdfPaneAdapter, type DrawingPaneAdapter } from './SplitController'

/**
 * SplitPdfPane (TASK-13): pane PDF trong Split Mode —
 * dùng thẳng PdfViewerController của Document Mode
 * (cùng engine, cùng autosave, cùng phiên annotation),
 * chỉ khác lớp vỏ: chrome rút gọn (điều hướng trang +
 * zoom ở chân pane) vì công cụ vẽ do thanh công cụ
 * chung của workspace điều khiển qua adapter.
 */
export function SplitPdfPane({
  documentId,
  onAdapter,
}: {
  documentId: string
  onAdapter: (adapter: DrawingPaneAdapter | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const annoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<PdfViewerController | null>(null)
  const [snapshot, setSnapshot] = useState<PdfViewerSnapshot | null>(null)
  const onAdapterRef = useRef(onAdapter)
  onAdapterRef.current = onAdapter

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
    if (container !== null && pdfCanvas !== null && annoCanvas !== null) {
      controller.bindElements({ pdfCanvas, annotationCanvas: annoCanvas, container })
      void controller.openDocument(documentId)
    }
    onAdapterRef.current(pdfPaneAdapter(controller))
    const observer =
      container !== null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => controller.handleResize())
        : null
    if (observer !== null && container !== null) observer.observe(container)
    return () => {
      observer?.disconnect()
      unsubscribe()
      onAdapterRef.current(null)
      controller.dispose()
      controllerRef.current = null
    }
  }, [documentId])

  const controller = controllerRef.current
  const ready = snapshot?.status === 'ready'
  const [backgroundImageError, setBackgroundImageError] = useState<string | null>(null)
  const backgroundImageUrl = useBackgroundImageUrl(
    snapshot?.documentId ?? null,
    snapshot?.background.kind ?? 'blank',
  )

  return (
    <div className="flex h-full flex-col gap-2">
      <div
        ref={containerRef}
        className="relative min-h-[300px] flex-1 overflow-auto rounded-xl border border-slate-200 bg-slate-100"
      >
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
              aria-label="Bề mặt chú thích PDF (Split)"
              className="absolute left-0 top-0"
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
        {snapshot?.status === 'error' && (
          <p role="alert" className="absolute inset-x-4 top-4 z-20 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {snapshot.errorMessage ?? 'Không mở được tài liệu PDF này.'}
          </p>
        )}
        {snapshot?.status === 'loading' && (
          <p className="absolute inset-x-4 top-4 z-20 text-sm text-slate-500">Đang mở tài liệu…</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 text-slate-600">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={!ready || (snapshot?.pageIndex ?? 0) <= 0}
          onClick={() => void controller?.prevPage()}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 text-center text-xs">
          Trang {(snapshot?.pageIndex ?? 0) + 1} / {snapshot?.pageCount ?? 0}
        </span>
        <button
          type="button"
          aria-label="Trang tiếp theo"
          disabled={!ready || (snapshot?.pageIndex ?? 0) >= (snapshot?.pageCount ?? 1) - 1}
          onClick={() => void controller?.nextPage()}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button
          type="button"
          aria-label="Thu nhỏ"
          disabled={!ready}
          onClick={() => void controller?.zoomOut()}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-10 text-center text-xs">{Math.round((snapshot?.scale ?? 1) * 100)}%</span>
        <button
          type="button"
          aria-label="Phóng to"
          disabled={!ready}
          onClick={() => void controller?.zoomIn()}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Vừa khung"
          disabled={!ready}
          onClick={() => void controller?.fit()}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-200" />
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
    </div>
  )
}
