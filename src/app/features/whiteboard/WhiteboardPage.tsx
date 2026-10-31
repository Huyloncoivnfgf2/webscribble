import { useCallback, useEffect, useState } from 'react'
import { Columns2, PenLine, Plus, Trash } from 'lucide-react'
import { sortByRecent } from '../../libraryModel'
import { getAppStorage } from '../../storage'
import { WhiteboardStore, WHITEBOARD_MIME_TYPE } from './whiteboardStore'
import { WhiteboardView } from './WhiteboardView'
import type { DocumentMetadata } from '../../../data/index'

/**
 * WhiteboardPage (TASK-12): trang Bảng trắng của shell —
 * danh sách các bảng trắng trong thư viện (chúng là tài
 * liệu như mọi tài liệu khác), tạo mới, mở vào
 * WhiteboardView, xóa (cascade kèm nét vẽ). Đổi tên làm
 * tại trang Thư viện để dùng chung một cơ chế.
 */

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function WhiteboardPage({
  onOpenSplit,
}: {
  /** Mở bảng trắng này trong Split Mode (TASK-13). */
  onOpenSplit?: (whiteboardId: string) => void
} = {}) {
  const [boards, setBoards] = useState<DocumentMetadata[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    const { foundation } = getAppStorage()
    const list = await foundation.documents.list()
    setBoards(sortByRecent(list.filter((d) => d.mimeType === WHITEBOARD_MIME_TYPE)))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const { foundation } = getAppStorage()
      const store = new WhiteboardStore({
        documents: foundation.documents,
        annotations: foundation.annotations,
      })
      const count = boards?.length ?? 0
      const { id } = await store.create(count === 0 ? 'Bảng trắng mới' : `Bảng trắng ${count + 1}`)
      await refresh()
      setSelectedId(id)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { foundation } = getAppStorage()
    await foundation.documents.delete(id)
    setConfirmingDeleteId(null)
    if (selectedId === id) setSelectedId(null)
    await refresh()
  }

  if (selectedId !== null) {
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

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        Bảng trắng là không gian viết, vẽ và ghi chú tự do — mỗi bảng gồm nhiều
        trang cố định (DEC-019), nét vẽ tự động lưu trên thiết bị này và đi
        cùng bản sao lưu thư viện.
      </p>

      <div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Đang tạo…' : 'Tạo bảng trắng'}
        </button>
      </div>

      {boards === null ? (
        <p className="text-sm text-slate-500">Đang tải danh sách bảng trắng…</p>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <PenLine className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-700">Chưa có bảng trắng nào</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Tạo bảng trắng đầu tiên để viết và vẽ tự do trên các trang trắng,
            kẻ ngang, lưới caro hoặc chấm.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {boards.map((board) => (
            <li
              key={board.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <PenLine className="h-5 w-5" />
              </span>
              {confirmingDeleteId === board.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    Xóa “{board.name}” cùng toàn bộ nét vẽ?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(board.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                  >
                    Xóa bảng trắng
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
                    onClick={() => setSelectedId(board.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {board.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Bảng trắng · {board.pageCount ?? 1} trang · {formatDate(board.updatedAt)}
                    </span>
                  </button>
                  {onOpenSplit && (
                    <button
                      type="button"
                      onClick={() => onOpenSplit(board.id)}
                      aria-label={`Mở ${board.name} trong Split`}
                      title="Mở trong Split Mode"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Columns2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(board.id)}
                    aria-label={`Xóa ${board.name}`}
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
