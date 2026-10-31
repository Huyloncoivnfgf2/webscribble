import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Download,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  Pen,
  PenLine,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  TriangleAlert,
  Type,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import {
  buildDocxExportFileName,
  DocxExportError,
  exportContentToDocx,
  normalizeExportFileName,
  type WordDocumentContent,
} from '../../../engines/word/index'
import { printWithAnnotations } from './printExport'
import { getAppStorage } from '../../storage'
import {
  DocxAnnotationController,
  DOCX_HIGHLIGHT_COLORS,
  DOCX_PEN_COLORS,
  DOCX_TOOL_SIZES,
} from './DocxAnnotationController'
import {
  WordEditorController,
  WordEditorError,
} from './WordEditorController'
import { createWordEditorExtensions } from './wordEditorExtensions'
import type { ViewerTool } from './pdfViewerState'

/**
 * DOCX Editor (TASK-07B): mở nội dung đã chuyển đổi của một
 * tài liệu DOCX trong Tiptap, sửa và tự lưu JSON về
 * documentContents qua WordEditorController. File DOCX gốc
 * không bị đụng. Nút quay lại CHỈ rời editor sau khi flush
 * xong; lưu lỗi → ở lại, báo rõ, cho thử lại hoặc chủ động
 * bỏ thay đổi (không bao giờ bỏ trong im lặng).
 */

export interface WordEditorProps {
  documentId: string
  onBack: () => void
  /** Nhúng trong Split Mode: ẩn nút quay lại thư viện (workspace có khung riêng). */
  embedded?: boolean
}

function SaveStatus({ controller }: { controller: WordEditorController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [state] = snapshot.split('|')
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Đang lưu…
      </span>
    )
  }
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={() => void controller.saveNow().catch(() => undefined)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 underline decoration-red-300 underline-offset-2"
      >
        <TriangleAlert className="h-3.5 w-3.5" /> Lưu thất bại — bấm để thử lại
      </button>
    )
  }
  if (state === 'dirty') {
    return <span className="text-xs text-amber-600">Chưa lưu</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
      <Check className="h-3.5 w-3.5" /> Đã lưu
    </span>
  )
}

interface ToolbarButton {
  key: string
  title: string
  icon: typeof Bold
  run: (editor: Editor) => void
  active?: (editor: Editor) => boolean
  disabled?: (editor: Editor) => boolean
}

const TOOLBAR: ToolbarButton[] = [
  { key: 'bold', title: 'Đậm', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', title: 'Nghiêng', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { key: 'underline', title: 'Gạch chân', icon: Underline, run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline') },
  { key: 'strike', title: 'Gạch ngang', icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
  { key: 'sup', title: 'Chỉ số trên', icon: Superscript, run: (e) => e.chain().focus().toggleSuperscript().run(), active: (e) => e.isActive('superscript') },
  { key: 'sub', title: 'Chỉ số dưới', icon: Subscript, run: (e) => e.chain().focus().toggleSubscript().run(), active: (e) => e.isActive('subscript') },
  { key: 'h1', title: 'Tiêu đề 1', icon: Heading1, run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive('heading', { level: 1 }) },
  { key: 'h2', title: 'Tiêu đề 2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { key: 'h3', title: 'Tiêu đề 3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  { key: 'p', title: 'Đoạn thường', icon: Pilcrow, run: (e) => e.chain().focus().setParagraph().run(), active: (e) => e.isActive('paragraph') },
  { key: 'ul', title: 'Danh sách chấm', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { key: 'ol', title: 'Danh sách số', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  { key: 'quote', title: 'Trích dẫn', icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
  { key: 'align-left', title: 'Căn trái', icon: AlignLeft, run: (e) => e.chain().focus().setTextAlign('left').run(), active: (e) => e.isActive({ textAlign: 'left' }) },
  { key: 'align-center', title: 'Căn giữa', icon: AlignCenter, run: (e) => e.chain().focus().setTextAlign('center').run(), active: (e) => e.isActive({ textAlign: 'center' }) },
  { key: 'align-right', title: 'Căn phải', icon: AlignRight, run: (e) => e.chain().focus().setTextAlign('right').run(), active: (e) => e.isActive({ textAlign: 'right' }) },
  { key: 'align-justify', title: 'Căn đều', icon: AlignJustify, run: (e) => e.chain().focus().setTextAlign('justify').run(), active: (e) => e.isActive({ textAlign: 'justify' }) },
  { key: 'undo', title: 'Hoàn tác', icon: Undo2, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
  { key: 'redo', title: 'Làm lại', icon: Redo2, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() },
]

function DocxAnnotationBar({
  controller,
  documentId,
  editor,
  cardRef,
  canvasRef,
}: {
  controller: DocxAnnotationController
  documentId: string
  editor: Editor | null
  cardRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    void controller.open(documentId, canvas)
    const card = cardRef.current
    const observer =
      card !== null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            controller.handleResize(card.clientWidth, card.clientHeight)
          })
        : null
    if (observer !== null && card !== null) observer.observe(card)
    return () => {
      observer?.disconnect()
      // Unmount (gồm cả lần mount giả của StrictMode): chỉ
      // flush, KHÔNG đóng phiên — controller sống trong
      // registry theo documentId và được dùng lại ở lần
      // mount kế tiếp (engine tự gắn lại lên canvas mới).
      void controller.flush().catch(() => undefined)
    }
  }, [controller, documentId, cardRef, canvasRef])

  // Chế độ annotate: khóa sửa chữ để con trỏ văn bản không
  // chen vào thao tác vẽ (canvas đồng thời nhận pointer).
  useEffect(() => {
    editor?.setEditable(snapshot.mode === 'edit')
  }, [editor, snapshot.mode])

  const anno = snapshot
  const colors = anno.tool === 'highlighter' ? DOCX_HIGHLIGHT_COLORS : DOCX_PEN_COLORS
  const sizes = anno.tool === 'highlighter' ? DOCX_TOOL_SIZES.highlighter : DOCX_TOOL_SIZES.pen
  const toolButtons: { tool: ViewerTool; label: string; Icon: typeof Pen }[] = [
    { tool: 'pen', label: 'Bút', Icon: Pen },
    { tool: 'highlighter', label: 'Highlight', Icon: Highlighter },
    { tool: 'stroke-eraser', label: 'Tẩy', Icon: Eraser },
  ]

  return (
    <>
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Chế độ làm việc">
        <button
          type="button"
          onClick={() => controller.setMode('edit')}
          aria-pressed={anno.mode === 'edit'}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
            anno.mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Type className="h-4 w-4" /> Sửa văn bản
        </button>
        <button
          type="button"
          onClick={() => controller.setMode('annotate')}
          aria-pressed={anno.mode === 'annotate'}
          disabled={anno.status !== 'ready'}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition disabled:opacity-40 ${
            anno.mode === 'annotate' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PenLine className="h-4 w-4" /> Chú thích
        </button>
      </div>

      {anno.status === 'error' && (
        <p className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Không mở được lớp chú thích: {anno.errorMessage}
        </p>
      )}

      {anno.mode === 'annotate' && anno.status === 'ready' && (
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-1" role="group" aria-label="Công cụ vẽ">
            {toolButtons.map(({ tool, label, Icon }) => (
              <button
                key={tool}
                type="button"
                onClick={() => controller.setTool(tool)}
                aria-pressed={anno.tool === tool}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                  anno.tool === tool ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {anno.tool !== 'stroke-eraser' && (
            <>
              <div className="flex items-center gap-1.5" role="group" aria-label="Màu">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Màu ${color}`}
                    aria-pressed={anno.color === color}
                    onClick={() => controller.setColor(color)}
                    className={`h-6 w-6 rounded-full border transition ${
                      anno.color === color ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Cỡ nét">
                {sizes.map(({ label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => controller.setSizeLabel(label)}
                    aria-pressed={anno.sizeLabel === label}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                      anno.sizeLabel === label ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!anno.canUndo}
              onClick={() => controller.undo()}
              aria-label="Hoàn tác nét vẽ"
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!anno.canRedo}
              onClick={() => controller.redo()}
              aria-label="Làm lại nét vẽ"
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <span className={`text-xs ${anno.saveState === 'error' ? 'text-red-600' : 'text-slate-500'}`} role="status">
            {anno.saveState === 'pending' || anno.saveState === 'saving'
              ? 'Đang lưu chú thích…'
              : anno.saveState === 'error'
                ? 'Lỗi lưu chú thích'
                : 'Chú thích đã lưu trên thiết bị'}
            {anno.saveState === 'error' && (
              <button
                type="button"
                onClick={() => void controller.retrySave()}
                className="ml-1.5 font-medium text-blue-600 underline underline-offset-2"
              >
                Thử lưu lại
              </button>
            )}
          </span>
          <p className="w-full text-xs leading-relaxed text-slate-400">
            Nét vẽ neo theo vị trí trên trang và tự lưu theo tài liệu này. Lưu ý: nét vẽ
            không bám theo chữ — nếu sửa nội dung làm chữ dời vị trí, nét vẽ có thể lệch
            so với chữ.
          </p>
        </div>
      )}
    </>
  )
}

/**
 * Registry controller chú thích DOCX theo documentId
 * (TASK-07D): phiên annotation + DrawingEngine sống qua các
 * lần mount của editor (StrictMode, điều hướng qua lại)
 * thay vì bị đóng/mở lại gây đua 'already-open'. Chỉ nút
 * "Thư viện" (đường rời chủ động) mới đóng phiên và gỡ
 * registry qua releaseDocxAnnotationController.
 */
const docxAnnotationControllers = new Map<string, DocxAnnotationController>()

function getDocxAnnotationController(documentId: string): DocxAnnotationController {
  let controller = docxAnnotationControllers.get(documentId)
  if (controller === undefined) {
    controller = new DocxAnnotationController({
      annotationEngine: getAppStorage().annotationEngine,
    })
    docxAnnotationControllers.set(documentId, controller)
  }
  return controller
}

/**
 * Tra cứu controller chú thích DOCX ĐÃ tồn tại (TASK-13:
 * Split Mode route công cụ vẽ tới pane DOCX). Không tạo
 * mới — controller chỉ sinh khi WordEditor của tài liệu
 * đó đã gắn.
 */
export function peekDocxAnnotationController(
  documentId: string,
): DocxAnnotationController | undefined {
  return docxAnnotationControllers.get(documentId)
}

function WordEditorInner({
  controller,
  documentId,
  initialContent,
  onBack,
  embedded = false,
}: {
  controller: WordEditorController
  documentId: string
  initialContent: WordDocumentContent
  onBack: () => void
  embedded?: boolean
}) {
  const [, setToolbarTick] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [leaveFailed, setLeaveFailed] = useState(false)
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const cardRef = useRef<HTMLDivElement | null>(null)
  const annoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const annoController = getDocxAnnotationController(documentId)
  const annoMode = useSyncExternalStore(annoController.subscribe, annoController.getSnapshot).mode

  // ── Xuất bản (TASK-07E) ────────────────────────────────
  const [docName, setDocName] = useState<string>('tai-lieu.docx')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportName, setExportName] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportNotes, setExportNotes] = useState<string[]>([])
  const [exportDone, setExportDone] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getAppStorage()
      .foundation.documents.getById(documentId)
      .then((meta) => {
        if (!cancelled && meta !== null) setDocName(meta.name)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [documentId])

  const openExportDialog = () => {
    setExportName(buildDocxExportFileName(docName))
    setExportError(null)
    setExportNotes([])
    setExportDone(null)
    setExportOpen(true)
  }

  const runDocxExport = async () => {
    if (editor === null) return
    setExportBusy(true)
    setExportError(null)
    setExportNotes([])
    setExportDone(null)
    try {
      const content = editor.getJSON() as unknown as WordDocumentContent
      const result = await exportContentToDocx(content)
      const fileName = normalizeExportFileName(exportName)
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setExportNotes(result.warnings)
      setExportDone(fileName)
    } catch (error) {
      setExportError(
        error instanceof DocxExportError
          ? error.message
          : 'Không xuất được file DOCX. Hãy thử lại.',
      )
    } finally {
      setExportBusy(false)
    }
  }

  const runPrintExport = () => {
    const card = cardRef.current
    const canvas = annoCanvasRef.current
    if (card === null || canvas === null) return
    setExportOpen(false)
    // Hộp thoại in của trình duyệt tự cung cấp "Lưu thành
    // PDF" — bản in gồm văn bản + ảnh chụp lớp chú thích.
    if (!printWithAnnotations(card, canvas)) {
      window.print()
    }
  }

  const editor = useEditor({
    extensions: createWordEditorExtensions(),
    content: initialContent as never,
    onUpdate: () => controller.markChanged(),
  })

  useEffect(() => {
    if (!editor) return
    controller.bindEditor(() => editor.getJSON() as unknown as WordDocumentContent)
    const bump = () => setToolbarTick((t) => t + 1)
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor, controller])

  // Rời editor bằng đường khác (điều hướng sidebar...): cố
  // flush lần cuối — ghi IndexedDB vẫn chạy sau khi unmount.
  // Dùng flush() chứ KHÔNG dùng close(): React StrictMode
  // (dev) mount → cleanup → mount lại cùng controller; nếu
  // cleanup đóng vĩnh viễn controller thì lần mount thật sẽ
  // không bao giờ lưu được nữa. flush() không đổi trạng thái
  // đóng nên an toàn cho cả hai trường hợp.
  useEffect(() => {
    return () => {
      void controller.flush().catch(() => undefined)
    }
  }, [controller])

  const handleBack = async () => {
    setLeaving(true)
    setLeaveFailed(false)
    try {
      await controller.close()
      // Chú thích cũng phải flush xong mới rời — lỗi lưu ở
      // một trong hai lớp đều chặn rời editor (leaveFailed).
      await annoController.close()
      docxAnnotationControllers.delete(documentId)
      onBackRef.current()
    } catch {
      setLeaveFailed(true)
      setLeaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!embedded && (
          <button
            type="button"
            onClick={() => void handleBack()}
            disabled={leaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Thư viện
          </button>
        )}
        <SaveStatus controller={controller} />
        {leaving && <span className="text-xs text-slate-500">Đang lưu trước khi quay lại…</span>}
        <button
          type="button"
          onClick={openExportDialog}
          disabled={editor === null}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Xuất bản
        </button>
      </div>

      <DocxAnnotationBar
        controller={annoController}
        documentId={documentId}
        editor={editor}
        cardRef={cardRef}
        canvasRef={annoCanvasRef}
      />

      {leaveFailed && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>Chưa lưu được thay đổi nên chưa quay lại thư viện.</span>
          <button
            type="button"
            onClick={() => void handleBack()}
            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
          >
            Thử lưu lại
          </button>
          <button
            type="button"
            onClick={() => onBackRef.current()}
            className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
          >
            Bỏ thay đổi và quay lại
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TOOLBAR.map((button) => {
          const Icon = button.icon
          const isActive = editor !== null && button.active?.(editor) === true
          const isDisabled = editor === null || (button.disabled?.(editor) ?? false)
          return (
            <button
              key={button.key}
              type="button"
              title={button.title}
              aria-label={button.title}
              disabled={isDisabled}
              onClick={() => editor && button.run(editor)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-35 ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>

      <div
        ref={cardRef}
        className="word-editor-surface relative mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-10 sm:py-8"
      >
        <EditorContent editor={editor} className="word-editor-content" />
        {/* Lớp chú thích viết tay (TASK-07D): phủ kín thẻ
            trang, cuộn cùng nội dung; chỉ nhận pointer ở
            chế độ Chú thích — chế độ Sửa văn bản thì trong
            suốt với thao tác để con trỏ/gõ phím đi thẳng
            xuống Tiptap. */}
        <canvas
          ref={annoCanvasRef}
          aria-hidden="true"
          className="absolute inset-0 z-10 h-full w-full"
          style={{ touchAction: 'none', pointerEvents: annoMode === 'annotate' ? 'auto' : 'none' }}
        />
      </div>
      {exportOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xuất tài liệu"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-800">Xuất tài liệu</h2>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                aria-label="Đóng"
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              File xuất là bản chuyển đổi từ nội dung đã sửa — một số định dạng phức tạp
              của Word có thể không giữ được nguyên vẹn (DEC-018). File DOCX gốc trong
              thư viện <strong className="font-medium text-slate-700">không bị thay đổi</strong>.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="export-file-name">
              Tên file DOCX
            </label>
            <input
              id="export-file-name"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void runDocxExport()}
              disabled={exportBusy || editor === null}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {exportBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Tải xuống DOCX đã sửa
            </button>
            <button
              type="button"
              onClick={runPrintExport}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              In / Lưu PDF kèm chú thích viết tay
            </button>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              File DOCX chỉ chứa nội dung văn bản. Bản in/PDF qua hộp thoại in của trình
              duyệt gồm cả nét chú thích viết tay ở độ phân giải đầy đủ.
            </p>
            {exportError !== null && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {exportError}
              </p>
            )}
            {exportDone !== null && (
              <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Đã tạo và tải xuống <strong>{exportDone}</strong>.
                {exportNotes.length > 0 && (
                  <span className="mt-1 block text-xs">{exportNotes.join(' ')}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mx-auto max-w-3xl text-xs leading-relaxed text-slate-400">
        Bạn đang sửa nội dung đã chuyển đổi của tài liệu Word. File DOCX gốc vẫn được giữ
        nguyên trong thư viện; thay đổi ở đây được tự động lưu riêng trên thiết bị này.
      </p>
    </div>
  )
}

export function WordEditor({ documentId, onBack, embedded = false }: WordEditorProps) {
  // Controller mới cho mỗi tài liệu — DocumentsPage gắn
  // key={selectedId} nên component remount khi đổi tài liệu.
  const controller = useMemo(
    () => new WordEditorController({ contents: getAppStorage().foundation.contents }),
    [],
  )
  const [initialContent, setInitialContent] = useState<WordDocumentContent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setInitialContent(null)
    setLoadError(null)
    controller
      .open(documentId)
      .then((content) => {
        if (!cancelled) setInitialContent(content)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(
          error instanceof WordEditorError
            ? error.userMessage
            : 'Không mở được tài liệu để chỉnh sửa. Hãy thử lại.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [controller, documentId])

  if (loadError !== null) {
    return (
      <div className="flex flex-col items-start gap-3">
        {!embedded && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Thư viện
          </button>
        )}
        <p className="max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {loadError}
        </p>
      </div>
    )
  }
  if (initialContent === null) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Đang mở tài liệu Word…
      </p>
    )
  }
  return (
    <WordEditorInner
      key={documentId}
      controller={controller}
      documentId={documentId}
      initialContent={initialContent}
      onBack={onBack}
      embedded={embedded}
    />
  )
}
