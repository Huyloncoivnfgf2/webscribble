import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Clock, Columns2, FileText, FileUp, FolderOpen, Info, PenLine, Pencil, Trash, X } from 'lucide-react'
import type { DocumentMetadata } from '../../../data/index'
import { hasPdfSignature } from '../../../engines/pdf/index'
import { DOCX_MIME_TYPE, WordImportError, importDocxToLibrary } from '../../../engines/word/index'
import { WhiteboardStore, WHITEBOARD_MIME_TYPE } from '../whiteboard/whiteboardStore'
import { WhiteboardView } from '../whiteboard/WhiteboardView'
import { documentTypeLabel, formatBytes, sortByRecent } from '../../libraryModel'
import { getAppStorage } from '../../storage'
import { PdfViewer } from './PdfViewer'
import { BackupPanel } from './BackupPanel'
import { StorageUsagePanel } from './StorageUsagePanel'
import { WordEditor } from './WordEditor'

export interface DocumentsPageProps {
  variant: 'recent' | 'all'
  /** Thông báo được truyền vào khi người dùng đến từ thao tác "Tạo tài liệu mới". */
  notice: string | null
  /** Yêu cầu mở thẳng một tài liệu (từ Tài liệu gần đây ở Trang chủ). */
  openDocumentId?: string | null
  /** Báo cho cha biết yêu cầu mở đã được xử lý. */
  onOpenDocumentHandled?: () => void
  /** Mở tài liệu này trong Split Mode (TASK-13). */
  onOpenSplit?: (documentId: string) => void
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function DocumentsPage({
  variant,
  notice,
  openDocumentId = null,
  onOpenDocumentHandled,
  onOpenSplit,
}: DocumentsPageProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  /** Tài liệu đang sửa tên + bản nháp tên (TASK-08B). */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  /** Tài liệu đang chờ xác nhận xóa (TASK-08B). */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  /** Tăng mỗi khi dữ liệu thư viện thay đổi để panel dung lượng đo lại. */
  const [storageTick, setStorageTick] = useState(0)
  /** Đang kéo file lơ lửng trên thư viện (TASK-07F). */
  const [dragActive, setDragActive] = useState(false)
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const shownNotice = localNotice ?? notice
  const isRecent = variant === 'recent'
  const Icon = isRecent ? Clock : FolderOpen

  const refresh = useCallback(async () => {
    const { foundation } = getAppStorage()
    const list = sortByRecent(await foundation.documents.list())
    setDocuments(isRecent ? list.slice(0, 5) : list)
  }, [isRecent])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Mở thẳng tài liệu khi có yêu cầu từ bên ngoài (Trang chủ):
  useEffect(() => {
    if (openDocumentId !== null) {
      setLocalNotice(null)
      setSelectedId(openDocumentId)
      onOpenDocumentHandled?.()
    }
  }, [openDocumentId, onOpenDocumentHandled])

  const handleImport = async (file: File): Promise<string | null> => {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
    const { foundation } = getAppStorage()
    if (hasPdfSignature(head)) {
      const record = await foundation.documents.create({
        name: file.name,
        mimeType: file.type !== '' ? file.type : 'application/pdf',
        blob: file,
      })
      return record.id
    }
    // Không phải PDF → thử đường DOCX (Word Engine, TASK-07A):
    // chuyển đổi trước, lưu sau; lỗi thì không tạo bản ghi nào.
    const data = await file.arrayBuffer()
    const { document } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: file.name, data },
    )
    return document.id
  }

  /** Nhập một hoặc nhiều file (nút chọn file và kéo-thả dùng chung). */
  const handleImportFiles = async (files: File[]) => {
    if (files.length === 0) return
    setImporting(true)
    setError(null)
    let lastImportedId: string | null = null
    let firstError: string | null = null
    for (const file of files) {
      try {
        lastImportedId = await handleImport(file)
      } catch (error) {
        if (firstError === null) {
          firstError =
            error instanceof WordImportError
              ? error.userMessage
              : 'Không nhập được tài liệu. Bộ nhớ của trình duyệt có thể đã đầy.'
        }
      }
    }
    await refresh()
    setStorageTick((t) => t + 1)
    setImporting(false)
    if (firstError !== null) setError(firstError)
    if (lastImportedId !== null) setSelectedId(lastImportedId)
  }

  // Chặn trình duyệt tự mở file khi thả trượt ra ngoài vùng
  // thư viện trong lúc trang này đang hiển thị (TASK-07F).
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  /** Tạo bảng trắng mới ngay trong thư viện (TASK-12). */
  const handleCreateWhiteboard = async () => {
    const { foundation } = getAppStorage()
    const store = new WhiteboardStore({
      documents: foundation.documents,
      annotations: foundation.annotations,
    })
    const existing = (await foundation.documents.list()).filter(
      (d) => d.mimeType === WHITEBOARD_MIME_TYPE,
    ).length
    const { id } = await store.create(
      existing === 0 ? 'Bảng trắng mới' : `Bảng trắng ${existing + 1}`,
    )
    await refresh()
    setStorageTick((t) => t + 1)
    setSelectedId(id)
  }

  const handleDelete = async (id: string) => {
    const { foundation } = getAppStorage()
    await foundation.documents.delete(id)
    setConfirmingDeleteId(null)
    if (selectedId === id) setSelectedId(null)
    await refresh()
    setStorageTick((t) => t + 1)
  }

  const startRename = (doc: DocumentMetadata) => {
    setConfirmingDeleteId(null)
    setRenamingId(doc.id)
    setRenameDraft(doc.name)
    setRenameError(null)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameError(null)
  }

  const saveRename = async (doc: DocumentMetadata) => {
    const name = renameDraft.trim()
    if (name === '') {
      setRenameError('Tên tài liệu không được để trống.')
      return
    }
    if (name === doc.name) {
      cancelRename()
      return
    }
    try {
      const { foundation } = getAppStorage()
      await foundation.documents.updateMetadata(doc.id, { name })
      cancelRename()
      await refresh()
    } catch {
      setRenameError('Không đổi tên được. Hãy thử lại.')
    }
  }

  /** Loại trình mở cho tài liệu đang chọn (TASK-07B/12). */
  const [selectedKind, setSelectedKind] = useState<'pdf' | 'docx' | 'whiteboard' | null>(null)

  useEffect(() => {
    if (selectedId === null) {
      setSelectedKind(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { foundation } = getAppStorage()
      const record = await foundation.documents.getById(selectedId)
      if (!cancelled) {
        setSelectedKind(
          record?.mimeType === DOCX_MIME_TYPE
            ? 'docx'
            : record?.mimeType === WHITEBOARD_MIME_TYPE
              ? 'whiteboard'
              : 'pdf',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  if (selectedId !== null) {
    if (selectedKind === 'whiteboard') {
      return (
        <WhiteboardView
          key={selectedId}
          documentId={selectedId}
          onBack={() => {
            setSelectedId(null)
            void refresh()
          }}
        />
      )
    }
    if (selectedKind === 'docx') {
      return (
        <WordEditor
          key={selectedId}
          documentId={selectedId}
          onBack={() => {
            setSelectedId(null)
            void refresh()
          }}
        />
      )
    }
    if (selectedKind === 'pdf') {
      return (
        <PdfViewer
          documentId={selectedId}
          onBack={() => {
            setSelectedId(null)
            void refresh()
          }}
        />
      )
    }
    return <p className="text-sm text-slate-500">Đang mở tài liệu…</p>
  }

  return (
    <div
      className={`relative flex flex-col gap-4 ${dragActive ? 'rounded-2xl outline-2 outline-dashed outline-blue-400 outline-offset-4' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepthRef.current += 1
        setDragActive(true)
      }}
      onDragLeave={() => {
        dragDepthRef.current -= 1
        if (dragDepthRef.current <= 0) {
          dragDepthRef.current = 0
          setDragActive(false)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepthRef.current = 0
        setDragActive(false)
        const files = e.dataTransfer !== null ? Array.from(e.dataTransfer.files) : []
        if (files.length > 0) void handleImportFiles(files)
      }}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-blue-50/85">
          <p className="text-sm font-semibold text-blue-700">
            Thả file PDF/DOCX để nhập vào thư viện
          </p>
        </div>
      )}
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        {isRecent
          ? 'Những tài liệu bạn mở gần đây nhất.'
          : 'Toàn bộ tài liệu được lưu trên thiết bị này. Dữ liệu nằm trong trình duyệt của bạn (local-first), không gửi lên máy chủ. Bạn cũng có thể kéo và thả file PDF/DOCX thẳng vào trang này để nhập.'}
      </p>

      {shownNotice && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{shownNotice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files !== null ? Array.from(e.target.files) : []
            e.target.value = ''
            if (files.length > 0) void handleImportFiles(files)
          }}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <FileUp className="h-4 w-4" />
          {importing ? 'Đang nhập…' : 'Mở tài liệu PDF/DOCX từ thiết bị'}
        </button>
        {!isRecent && (
          <button
            type="button"
            onClick={() => void handleCreateWhiteboard()}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <PenLine className="h-4 w-4" />
            Tạo bảng trắng
          </button>
        )}
      </div>

      {!isRecent && <StorageUsagePanel refreshKey={storageTick} />}

      {!isRecent && (
        <BackupPanel
          onLibraryChanged={() => {
            void refresh()
            setStorageTick((t) => t + 1)
          }}
        />
      )}

      {documents === null ? (
        <p className="text-sm text-slate-500">Đang tải thư viện…</p>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {isRecent ? 'Chưa có tài liệu nào được mở gần đây' : 'Thư viện tài liệu đang trống'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Nhập một tài liệu PDF hoặc DOCX từ thiết bị để bắt đầu đọc và chú thích.
            Mỗi lần nhập tạo một tài liệu riêng trong thư viện.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  doc.mimeType === WHITEBOARD_MIME_TYPE
                    ? 'bg-violet-50 text-violet-600'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {doc.mimeType === WHITEBOARD_MIME_TYPE ? (
                  <PenLine className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </span>
              {renamingId === doc.id ? (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Tên tài liệu mới"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRename(doc)
                        if (e.key === 'Escape') cancelRename()
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-blue-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => void saveRename(doc)}
                      aria-label="Lưu tên mới"
                      className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      aria-label="Hủy đổi tên"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {renameError !== null && (
                    <p role="alert" className="mt-1 text-xs text-red-600">
                      {renameError}
                    </p>
                  )}
                </div>
              ) : confirmingDeleteId === doc.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    Xóa “{doc.name}” cùng toàn bộ chú thích?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(doc.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                  >
                    Xóa tài liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalNotice(null)
                      setSelectedId(doc.id)
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {doc.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {documentTypeLabel(doc.mimeType)} · {formatBytes(doc.size)} ·{' '}
                      {formatDate(doc.updatedAt)}
                      {doc.pageCount !== null ? ` · ${doc.pageCount} trang` : ''}
                    </span>
                  </button>
                  {onOpenSplit && (
                    <button
                      type="button"
                      onClick={() => onOpenSplit(doc.id)}
                      aria-label={`Mở ${doc.name} trong Split`}
                      title="Mở trong Split Mode"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Columns2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startRename(doc)}
                    aria-label={`Đổi tên ${doc.name}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(null)
                      setConfirmingDeleteId(doc.id)
                    }}
                    aria-label={`Xóa ${doc.name}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
