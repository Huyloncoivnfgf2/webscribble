import { useState } from 'react'
import { Info, PenLine } from 'lucide-react'

const CREATE_NOTICE =
  'Whiteboard Engine sẽ được triển khai ở TASK-12. Hiện tại đây mới là khung giao diện để xem trước bố cục bảng trắng.'

export function WhiteboardPage() {
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        Bảng trắng là không gian viết, vẽ và ghi chú tự do — dùng độc lập hoặc
        cạnh tài liệu trong Split Mode. Ở giai đoạn đầu, bảng trắng có kích
        thước trang cố định (DEC-019).
      </p>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <PenLine className="h-4 w-4 text-blue-600" />
            Bảng trắng mới
          </span>
          <button
            type="button"
            onClick={() => setNotice(CREATE_NOTICE)}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            Tạo bảng trắng
          </button>
        </div>
        <div className="bg-slate-100 p-4 sm:p-6">
          <div className="mx-auto flex h-64 w-full max-w-2xl items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm [background-image:radial-gradient(circle,_#cbd5e1_1px,_transparent_1px)] [background-size:16px_16px]">
            <p className="px-6 text-center text-sm text-slate-400">
              Xem trước bề mặt bảng trắng — công cụ vẽ sẽ có ở TASK-05 và
              TASK-12.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
