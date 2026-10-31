import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  Columns2,
  Download,
  Eraser,
  Highlighter,
  Pen,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react'
import { getAppStorage } from '../../storage'
import { DOCX_MIME_TYPE } from '../../../engines/word/index'
import { WordEditor, peekDocxAnnotationController } from '../documents/WordEditor'
import type { DocumentMetadata } from '../../../data/index'
import { WhiteboardStore, WHITEBOARD_MIME_TYPE } from '../whiteboard/whiteboardStore'
import { WhiteboardView, getWhiteboardController } from '../whiteboard/WhiteboardView'
import { SplitPdfPane } from './SplitPdfPane'
import { PdfExportDialog } from '../documents/PdfExportDialog'
import {
  SplitController,
  docxPaneAdapter,
  whiteboardPaneAdapter,
} from './SplitController'
import {
  SplitSessionStore,
  createLocalStorageKeyValue,
  type SplitPaneId,
} from './splitSession'

/**
 * SplitWorkspace (TASK-13, DEC-014/DEC-020): hai bề mặt
 * độc lập trên một khung — trái là tài liệu (PDF viewer
 * hoặc DOCX editor của Document Mode), phải là bảng
 * trắng. Mỗi pane giữ nguyên controller của mode gốc
 * (dữ liệu/autosave/undo riêng tuyệt đối); workspace chỉ
 * sở hữu: khung chia + resizer, khái niệm ACTIVE PANE,
 * thanh công cụ vẽ chung ROUTE tới pane active qua
 * SplitController, và vết liên kết phiên (localStorage)
 * để mở lại đúng cặp tài liệu + bảng trắng gần nhất.
 * Dưới 768px: chuyển sang dạng tab, một pane một lúc.
 */

const SPLIT_PEN_COLORS = ['#111827', '#F8FAFC', '#DC2626', '#2563EB', '#16A34A']
const SPLIT_HIGHLIGHT_COLORS = ['#FDE047', '#86EFAC', '#F9A8D4', '#93C5FD']

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return mobile
}

function PaneHeader({
  title,
  kindLabel,
  active,
}: {
  title: string
  kindLabel: string
  active: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{title}</span>
      <span className="text-xs text-slate-400">{kindLabel}</span>
      {active && (
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">
          Đang hoạt động
        </span>
      )}
    </div>
  )
}

export function SplitWorkspace({
  initialBinding,
  onInitialBindingHandled,
}: {
  initialBinding?: { documentId?: string; whiteboardId?: string } | null
  onInitialBindingHandled?: () => void
}) {
  const split = useMemo(
    () =>
      new SplitController(new SplitSessionStore(createLocalStorageKeyValue()), {
        ...(initialBinding?.documentId ? { documentId: initialBinding.documentId } : {}),
        ...(initialBinding?.whiteboardId ? { whiteboardId: initialBinding.whiteboardId } : {}),
      }),
    // Chỉ áp dụng binding khởi tạo ở lần mount đầu:
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const snapshot = useSyncExternalStore(split.subscribe, split.getSnapshot)
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [boards, setBoards] = useState<DocumentMetadata[]>([])
  const [collapsed, setCollapsed] = useState<SplitPaneId | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (initialBinding) onInitialBindingHandled?.()
    // Chỉ chạy khi có binding mới từ bên ngoài:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBinding])

  useEffect(() => {
    if (initialBinding?.documentId) split.setDocument(initialBinding.documentId)
    if (initialBinding?.whiteboardId) split.setWhiteboard(initialBinding.whiteboardId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBinding])

  const refreshLists = useMemo(
    () => async () => {
      const list = await getAppStorage().foundation.documents.list()
      setDocuments(list.filter((d) => d.mimeType !== WHITEBOARD_MIME_TYPE))
      setBoards(list.filter((d) => d.mimeType === WHITEBOARD_MIME_TYPE))
    },
    [],
  )

  useEffect(() => {
    void refreshLists()
  }, [refreshLists])

  useEffect(() => () => split.dispose(), [split])

  // Adapter pane phải (bảng trắng): controller lấy từ
  // registry dùng chung với WhiteboardView.
  const whiteboardId = snapshot.whiteboardId
  useEffect(() => {
    if (whiteboardId === null) {
      split.registerAdapter('right', null)
      return
    }
    split.registerAdapter('right', whiteboardPaneAdapter(getWhiteboardController(whiteboardId)))
  }, [split, whiteboardId])

  // Adapter pane trái cho DOCX (PDF tự đăng ký qua SplitPdfPane):
  const documentId = snapshot.documentId
  const documentMeta = documents.find((d) => d.id === documentId)
  const leftKind =
    documentId === null
      ? null
      : documentMeta?.mimeType === DOCX_MIME_TYPE
        ? 'docx'
        : 'pdf'
  useEffect(() => {
    if (leftKind === 'docx' && documentId !== null) {
      split.registerAdapter(
        'left',
        docxPaneAdapter(() => peekDocxAnnotationController(documentId)),
      )
    }
    if (leftKind === null) split.registerAdapter('left', null)
  }, [split, leftKind, documentId])

  // Bảo vệ liên kết: một bảng trắng bị gắn nhầm vào ô tài
  // liệu (ví dụ từ nút Split trên thẻ bảng trắng ở thư
  // viện) sẽ được chuyển sang pane phải cho đúng vai.
  useEffect(() => {
    if (documentId !== null && boards.some((b) => b.id === documentId)) {
      split.setDocument(null)
      if (whiteboardId === null) split.setWhiteboard(documentId)
    }
  }, [split, documentId, whiteboardId, boards])

  const handleCreateWhiteboard = async () => {
    const { foundation } = getAppStorage()
    const store = new WhiteboardStore({
      documents: foundation.documents,
      annotations: foundation.annotations,
    })
    const { id } = await store.create(
      boards.length === 0 ? 'Bảng trắng mới' : `Bảng trắng ${boards.length + 1}`,
    )
    await refreshLists()
    split.setWhiteboard(id)
  }

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault()
    const container = containerRef.current
    if (container === null) return
    const rect = container.getBoundingClientRect()
    const onMove = (moveEvent: PointerEvent) => {
      split.setRatio((moveEvent.clientX - rect.left) / rect.width)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const { toolState, capabilities } = snapshot
  const colors = toolState.tool === 'highlighter' ? SPLIT_HIGHLIGHT_COLORS : SPLIT_PEN_COLORS
  const leftTitle = documentMeta?.name ?? 'Tài liệu'
  const rightTitle = boards.find((b) => b.id === whiteboardId)?.name ?? 'Bảng trắng'

  const leftPane = (
    <div
      className={`flex min-w-0 flex-col ${snapshot.activePane === 'left' ? '' : ''}`}
      onPointerDownCapture={() => {
        if (leftKind === 'docx' && documentId !== null) {
          // Đăng ký lại adapter DOCX (editor có thể vừa gắn xong):
          split.registerAdapter(
            'left',
            docxPaneAdapter(() => peekDocxAnnotationController(documentId)),
          )
        }
        split.setActivePane('left')
      }}
    >
      <PaneHeader
        title={leftTitle}
        kindLabel={leftKind === 'docx' ? 'DOCX' : leftKind === 'pdf' ? 'PDF' : 'Chưa chọn'}
        active={snapshot.activePane === 'left'}
      />
      <div
        className={`min-h-0 flex-1 rounded-2xl p-1 ${
          snapshot.activePane === 'left' ? 'ring-2 ring-blue-500' : 'ring-1 ring-slate-200'
        }`}
      >
        {documentId === null ? (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500">
            Chọn một tài liệu PDF hoặc DOCX ở thanh phía trên để mở ở pane này.
          </div>
        ) : leftKind === 'docx' ? (
          <WordEditor key={documentId} documentId={documentId} embedded onBack={() => undefined} />
        ) : (
          <SplitPdfPane
            key={documentId}
            documentId={documentId}
            onAdapter={(adapter) => split.registerAdapter('left', adapter)}
          />
        )}
      </div>
    </div>
  )

  const rightPane = (
    <div
      className="flex min-w-0 flex-col"
      onPointerDownCapture={() => split.setActivePane('right')}
    >
      <PaneHeader title={rightTitle} kindLabel="Bảng trắng" active={snapshot.activePane === 'right'} />
      <div
        className={`min-h-0 flex-1 rounded-2xl p-1 ${
          snapshot.activePane === 'right' ? 'ring-2 ring-blue-500' : 'ring-1 ring-slate-200'
        }`}
      >
        {whiteboardId === null ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500">
            <span>Chọn một bảng trắng ở thanh phía trên, hoặc tạo mới.</span>
            <button
              type="button"
              onClick={() => void handleCreateWhiteboard()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Tạo bảng trắng
            </button>
          </div>
        ) : (
          <WhiteboardView
            key={whiteboardId}
            documentId={whiteboardId}
            embedded
            onBack={() => undefined}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Chọn liên kết + tỉ lệ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Columns2 className="h-4 w-4 text-blue-600" />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Tài liệu
          <select
            aria-label="Chọn tài liệu cho Split"
            value={documentId ?? ''}
            onChange={(e) => split.setDocument(e.target.value === '' ? null : e.target.value)}
            className="max-w-48 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">— Chưa chọn —</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Bảng trắng
          <select
            aria-label="Chọn bảng trắng cho Split"
            value={whiteboardId ?? ''}
            onChange={(e) => split.setWhiteboard(e.target.value === '' ? null : e.target.value)}
            className="max-w-48 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">— Chưa chọn —</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleCreateWhiteboard()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" /> Bảng trắng mới
        </button>
        {leftKind === 'pdf' && documentId !== null && (
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Xuất PDF
          </button>
        )}
        {!isMobile && (
          <span className="ml-auto flex items-center gap-1" role="group" aria-label="Tỉ lệ chia màn hình">
            {[
              { label: '30/70', ratio: 0.3 },
              { label: '50/50', ratio: 0.5 },
              { label: '70/30', ratio: 0.7 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setCollapsed(null)
                  split.setRatio(preset.ratio)
                }}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCollapsed(collapsed === 'right' ? null : 'right')}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              {collapsed === 'right' ? 'Hiện bảng trắng' : 'Thu gọn bảng trắng'}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(collapsed === 'left' ? null : 'left')}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              {collapsed === 'left' ? 'Hiện tài liệu' : 'Thu gọn tài liệu'}
            </button>
          </span>
        )}
      </div>

      {/* Thanh công cụ vẽ chung — route theo pane active */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
        <span className="px-1 text-xs font-medium text-slate-500">
          Công cụ cho: {snapshot.activePane === 'left' ? leftTitle : rightTitle}
        </span>
        {(
          [
            { tool: 'pen', label: 'Bút', Icon: Pen },
            { tool: 'highlighter', label: 'Highlight', Icon: Highlighter },
            { tool: 'stroke-eraser', label: 'Tẩy nét', Icon: Eraser },
          ] as const
        ).map(({ tool, label, Icon }) => (
          <button
            key={tool}
            type="button"
            aria-label={label}
            aria-pressed={toolState.tool === tool}
            onClick={() => split.setTool(tool)}
            className={`rounded-lg p-2 transition ${
              toolState.tool === tool
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        {capabilities.color && toolState.tool !== 'stroke-eraser' && (
          <span className="flex items-center gap-1">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Màu ${color}`}
                onClick={() => split.setColor(color)}
                className={`h-5 w-5 rounded-full border transition ${
                  toolState.color === color ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-300'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
        )}
        {capabilities.size && toolState.tool !== 'stroke-eraser' && (
          <span className="flex items-center gap-1" role="group" aria-label="Cỡ nét">
            {(['S', 'M', 'L'] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => split.setSizeLabel(label)}
                aria-pressed={toolState.sizeLabel === label}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  toolState.sizeLabel === label
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </span>
        )}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          type="button"
          aria-label="Hoàn tác (pane đang hoạt động)"
          disabled={!toolState.canUndo}
          onClick={() => split.undo()}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-35"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Làm lại (pane đang hoạt động)"
          disabled={!toolState.canRedo}
          onClick={() => split.redo()}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-35"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Khung hai pane */}
      {isMobile ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Chuyển bề mặt">
            {(
              [
                { pane: 'left', label: 'Tài liệu' },
                { pane: 'right', label: 'Bảng trắng' },
              ] as const
            ).map(({ pane, label }) => (
              <button
                key={pane}
                type="button"
                role="tab"
                aria-selected={snapshot.activePane === pane}
                onClick={() => split.setActivePane(pane)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  snapshot.activePane === pane ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={snapshot.activePane === 'left' ? '' : 'hidden'}>{leftPane}</div>
          <div className={snapshot.activePane === 'right' ? '' : 'hidden'}>{rightPane}</div>
        </div>
      ) : (
        <div ref={containerRef} className="flex items-stretch gap-0" style={{ minHeight: 480 }}>
          {collapsed !== 'left' && (
            <div
              className="flex min-w-0 flex-col"
              style={collapsed === 'right' ? { flex: 1 } : { width: `${snapshot.ratio * 100}%` }}
            >
              {leftPane}
            </div>
          )}
          {collapsed === null && (
            <div
              role="separator"
              aria-label="Thanh chia màn hình — kéo để đổi tỉ lệ"
              aria-orientation="vertical"
              onPointerDown={startDrag}
              className="group relative z-10 mx-1 w-2 shrink-0 cursor-col-resize touch-none self-stretch"
            >
              <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded bg-slate-300 transition group-hover:bg-blue-400" />
            </div>
          )}
          {collapsed !== 'right' && (
            <div className="flex min-w-0 flex-1 flex-col">{rightPane}</div>
          )}
        </div>
      )}
      {exportOpen && documentId !== null && (
        <PdfExportDialog
          documentId={documentId}
          documentName={documentMeta?.name ?? 'tai-lieu.pdf'}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
