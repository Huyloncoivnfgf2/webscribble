import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import type { DocumentMetadata } from '../../data/index'
import { documentTypeLabel, formatBytes, sortByRecent } from '../libraryModel'
import { getAppStorage } from '../storage'

/**
 * Tài liệu gần đây trên Trang chủ (TASK-08B): đọc THẬT từ
 * DocumentRepository qua cùng wiring `getAppStorage()` của
 * tầng UI (không cơ chế dữ liệu riêng), tối đa 5 tài liệu
 * theo thứ tự gần đây nhất (updatedAt). Nhấn vào một tài
 * liệu → mở đúng tài liệu đó trong PDF Viewer (qua App).
 */

export interface RecentDocumentsProps {
  onOpenDocument: (documentId: string) => void
}

export function RecentDocuments({ onOpenDocument }: RecentDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { foundation } = getAppStorage()
        const list = sortByRecent(await foundation.documents.list()).slice(0, 5)
        if (!cancelled) setDocuments(list)
      } catch {
        if (!cancelled) setDocuments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-label="Tài liệu gần đây">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Tài liệu gần đây
      </h3>
      {documents === null ? (
        <p className="mt-3 text-sm text-slate-500">Đang tải thư viện…</p>
      ) : documents.length === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-700">Chưa có tài liệu nào</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Nhập một tài liệu PDF từ mục Tài liệu của tôi — tài liệu sẽ xuất hiện tại
            đây để mở lại nhanh.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onOpenDocument(doc.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {doc.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {documentTypeLabel(doc.mimeType)} · {formatBytes(doc.size)} ·{' '}
                    {new Date(doc.updatedAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                    {doc.pageCount !== null ? ` · ${doc.pageCount} trang` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
