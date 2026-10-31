import { useEffect, useState } from 'react'
import { Check, Download, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { getAppStorage } from '../../storage'
import { deserializeDrawingObjects } from '../../../engines/annotation/index'
import {
  flattenPdfAnnotations,
  PdfExportError,
  type PdfFlattenMode,
  type PdfPageScope,
} from '../../../engines/pdf/index'
import type { DrawingObject } from '../../../engines/drawing/index'

/**
 * PdfExportDialog (TASK-09, DEC-017/DEC-033): xuất PDF
 * từ Document Mode và Split Mode.
 * - "PDF kèm chú thích": làm phẳng annotation lên bản
 *   sao của file gốc bằng Export Engine (vector hoặc
 *   ảnh nét cao), có thanh tiến trình theo trang.
 * - "PDF gốc (sạch)": tải xuống chính Blob gốc.
 * File gốc trong IndexedDB không bao giờ bị ghi đè —
 * mọi bản xuất đều là Blob mới tải xuống máy.
 */

type ExportKind = 'vector' | 'raster' | 'clean'

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function exportBaseName(documentName: string): string {
  const base = documentName.replace(/\.pdf$/i, '').trim()
  return base === '' ? 'tai-lieu' : base
}

export function PdfExportDialog({
  documentId,
  documentName,
  onClose,
}: {
  documentId: string
  documentName: string
  onClose: () => void
}) {
  const [kind, setKind] = useState<ExportKind>('vector')
  const [scope, setScope] = useState<PdfPageScope>('all')
  const [annotatedPageCount, setAnnotatedPageCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { foundation } = getAppStorage()
      const surfaces = await foundation.annotations.getSurfacesByDocument(documentId)
      if (!cancelled) {
        setAnnotatedPageCount(surfaces.filter((s) => s.objects.length > 0).length)
      }
    })().catch(() => {
      if (!cancelled) setAnnotatedPageCount(0)
    })
    return () => {
      cancelled = true
    }
  }, [documentId])

  const handleExport = async () => {
    setBusy(true)
    setError(null)
    setDoneMessage(null)
    setWarnings([])
    setProgress(null)
    try {
      const { foundation } = getAppStorage()
      const blob = await foundation.documents.getBlob(documentId)
      if (blob === undefined) throw new Error('Không tìm thấy file PDF gốc trong thư viện.')

      if (kind === 'clean') {
        downloadBlob(blob, `${exportBaseName(documentName)}.pdf`)
        setDoneMessage('Đã tải xuống bản sao của file PDF gốc (không kèm chú thích).')
        return
      }

      const surfaces = await foundation.annotations.getSurfacesByDocument(documentId)
      const byPage = new Map<number, readonly DrawingObject[]>()
      for (const surface of surfaces) {
        try {
          const objects = deserializeDrawingObjects(surface.objects, surface.surfaceId)
          if (objects.length > 0) byPage.set(surface.pageIndex, objects)
        } catch {
          setWarnings((current) => [
            ...current,
            `Trang ${surface.pageIndex + 1} có dữ liệu chú thích không đọc được nên đã bị bỏ qua.`,
          ])
        }
      }

      const result = await flattenPdfAnnotations({
        pdfData: await blob.arrayBuffer(),
        annotationsByPage: byPage,
        mode: kind as PdfFlattenMode,
        pageScope: scope,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      downloadBlob(result.blob, `${exportBaseName(documentName)}_annotated.pdf`)
      setWarnings((current) => [...current, ...result.warnings])
      setDoneMessage(
        result.flattenedPages.length > 0
          ? `Đã xuất PDF ${result.outputPageCount} trang — chú thích đã làm phẳng ở ${result.flattenedPages.length} trang (${result.flattenedPages.map((p) => p + 1).join(', ')}).`
          : `Đã xuất PDF ${result.outputPageCount} trang. Tài liệu này chưa có chú thích nào để làm phẳng.`,
      )
    } catch (exportError) {
      setError(
        exportError instanceof PdfExportError
          ? exportError.userMessage
          : 'Không xuất được PDF. Hãy thử lại.',
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Xuất PDF" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Xuất PDF</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{documentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng hộp thoại xuất PDF"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-slate-600">Kiểu xuất</legend>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {(
              [
                { value: 'vector', label: 'Kèm chú thích — Vector (khuyên dùng)', hint: 'Nét vẽ thành đồ họa vector sắc nét trong PDF, dung lượng nhỏ.' },
                { value: 'raster', label: 'Kèm chú thích — Ảnh nét cao', hint: 'Chú thích thành ảnh 3× phủ trang, trung thực pixel tuyệt đối.' },
                { value: 'clean', label: 'PDF gốc (không chú thích)', hint: 'Bản sao nguyên trạng của file gốc.' },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 transition ${
                  kind === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="pdf-export-kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind !== 'clean' && (
          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-slate-600">
              Phạm vi trang{' '}
              {annotatedPageCount !== null && (
                <span className="text-slate-400">
                  ({annotatedPageCount} trang có chú thích)
                </span>
              )}
            </legend>
            <div className="mt-1.5 flex gap-1.5">
              {(
                [
                  { value: 'all', label: 'Tất cả các trang' },
                  { value: 'annotated-only', label: 'Chỉ trang có chú thích' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  aria-pressed={scope === option.value}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    scope === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {busy && progress !== null && progress.total > 0 && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Đang làm phẳng trang {progress.done}/{progress.total}…
            </p>
          </div>
        )}

        {error !== null && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {warnings.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {warnings.map((warning, index) => (
              <p key={index} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
              </p>
            ))}
          </div>
        )}
        {doneMessage !== null && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0" /> {doneMessage}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Đang xuất…' : 'Xuất và tải xuống'}
          </button>
        </div>
      </div>
    </div>
  )
}
