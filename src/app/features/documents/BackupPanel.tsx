import { useRef, useState } from 'react'
import {
  Archive,
  Check,
  Download,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  BackupError,
  createBackupArchive,
  executeRestore,
  inspectBackupArchive,
  type PreparedRestore,
} from '../../../data/index'
import { formatBytes } from '../../libraryModel'
import { getAppStorage } from '../../storage'

/**
 * Panel Sao lưu & Khôi phục (TASK-08C, DEC-027): tạo file
 * backup ZIP của toàn bộ thư viện để tải xuống; khôi phục
 * theo merge an toàn — kiểm chứng toàn bộ file TRƯỚC, hiển
 * thị tóm tắt + cảnh báo để người dùng xác nhận, trùng ID
 * được nhập thành bản sao mới chứ không ghi đè. Không có
 * chế độ thay thế toàn bộ thư viện.
 */

type PanelState =
  | { kind: 'idle' }
  | { kind: 'creating'; percent: number | null }
  | { kind: 'inspecting' }
  | { kind: 'confirming'; prepared: PreparedRestore; collisions: number }
  | { kind: 'restoring' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function BackupPanel({ onLibraryChanged }: { onLibraryChanged: () => void }) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const busy = state.kind === 'creating' || state.kind === 'inspecting' || state.kind === 'restoring'

  const handleCreate = async () => {
    setState({ kind: 'creating', percent: null })
    try {
      const { db } = getAppStorage().foundation
      const { blob, fileName, manifest } = await createBackupArchive(db, {
        onProgress: (stage, percent) => {
          if (stage === 'archiving') setState({ kind: 'creating', percent: percent ?? null })
        },
      })
      downloadBlob(blob, fileName)
      setState({
        kind: 'done',
        message: `Đã tạo bản sao lưu (${manifest.counts.documents} tài liệu, ${manifest.counts.annotations} bề mặt chú thích, ${manifest.counts.documentContents} nội dung Word). Hãy giữ file này ở nơi an toàn.`,
      })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof BackupError ? error.userMessage : 'Không tạo được bản sao lưu. Hãy thử lại.',
      })
    }
  }

  const handleInspect = async (file: File) => {
    setState({ kind: 'inspecting' })
    try {
      const prepared = await inspectBackupArchive(await file.arrayBuffer())
      const { foundation } = getAppStorage()
      const existingIds = new Set((await foundation.documents.list()).map((d) => d.id))
      const collisions = prepared.documents.filter(({ entry }) => existingIds.has(entry.id)).length
      setState({ kind: 'confirming', prepared, collisions })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof BackupError ? error.userMessage : 'Không đọc được file sao lưu. Hãy thử lại.',
      })
    }
  }

  const handleRestore = async (prepared: PreparedRestore) => {
    setState({ kind: 'restoring' })
    try {
      const { db } = getAppStorage().foundation
      const report = await executeRestore(db, prepared)
      onLibraryChanged()
      setState({
        kind: 'done',
        message:
          `Đã khôi phục xong: thêm ${report.importedDocuments} tài liệu, ` +
          `${report.importedAnnotations} bề mặt chú thích, ${report.importedContents} nội dung Word` +
          (report.remappedDocuments > 0
            ? ` (${report.remappedDocuments} tài liệu trùng ID đã được nhập thành bản sao mới, bản gốc không bị ghi đè).`
            : '.'),
      })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof BackupError ? error.userMessage : 'Khôi phục thất bại. Thư viện hiện tại vẫn nguyên vẹn.',
      })
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Archive className="h-4 w-4 text-slate-500" /> Sao lưu & khôi phục thư viện
      </h3>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
        Sao lưu toàn bộ thư viện (file gốc, chú thích, nội dung Word) thành một file để tải
        xuống. Vì dữ liệu chỉ nằm trên thiết bị này, bản sao lưu là cách bảo vệ khi đổi
        thiết bị hoặc trình duyệt xóa dữ liệu. Khôi phục luôn ở chế độ thêm an toàn — không
        bao giờ ghi đè hay xóa dữ liệu hiện có.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
        >
          {state.kind === 'creating' ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {state.kind === 'creating'
            ? `Đang tạo bản sao lưu${state.percent !== null ? ` (${state.percent}%)` : ''}…`
            : 'Tạo bản sao lưu'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => restoreInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {state.kind === 'inspecting' ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {state.kind === 'inspecting' ? 'Đang kiểm tra file…' : 'Khôi phục từ bản sao lưu'}
        </button>
        <input
          ref={restoreInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file !== undefined) void handleInspect(file)
          }}
        />
      </div>

      {state.kind === 'confirming' && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
          <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Bản sao lưu hợp lệ — sẵn sàng khôi phục
          </p>
          <ul className="mt-1.5 list-inside list-disc text-xs leading-relaxed">
            <li>
              Tạo lúc: {new Date(state.prepared.summary.createdAt).toLocaleString('vi-VN')}
            </li>
            <li>
              Gồm {state.prepared.summary.counts.documents} tài liệu,{' '}
              {state.prepared.summary.counts.annotations} bề mặt chú thích,{' '}
              {state.prepared.summary.counts.documentContents} nội dung Word — tổng dung lượng
              file gốc {formatBytes(state.prepared.summary.totalBlobBytes)}.
            </li>
            {state.collisions > 0 ? (
              <li>
                {state.collisions} tài liệu đã có trong thư viện hiện tại — chúng sẽ được nhập
                thành <strong>bản sao mới</strong>, bản gốc không bị ghi đè.
              </li>
            ) : (
              <li>Không có tài liệu nào trùng với thư viện hiện tại.</li>
            )}
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRestore(state.prepared)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Khôi phục vào thư viện
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              <X className="h-3.5 w-3.5" /> Hủy
            </button>
          </div>
        </div>
      )}

      {state.kind === 'restoring' && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Đang khôi phục… đừng đóng trang.
        </p>
      )}

      {state.kind === 'done' && (
        <p className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {state.message}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {state.message}
        </p>
      )}
    </section>
  )
}
