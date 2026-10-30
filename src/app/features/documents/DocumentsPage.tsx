import { useState } from 'react'
import { Clock, FolderOpen, Info } from 'lucide-react'

export interface DocumentsPageProps {
  variant: 'recent' | 'all'
  /** Thông báo được truyền vào khi người dùng đến từ thao tác "Tạo tài liệu mới". */
  notice: string | null
}

const OPEN_NOTICE =
  'Tính năng mở tài liệu từ thiết bị sẽ được triển khai ở TASK-06 (PDF Engine) và TASK-08 (lưu trữ). Hiện tại chưa có tài liệu nào được lưu.'

export function DocumentsPage({ variant, notice }: DocumentsPageProps) {
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const shownNotice = localNotice ?? notice
  const isRecent = variant === 'recent'
  const Icon = isRecent ? Clock : FolderOpen

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        {isRecent
          ? 'Những tài liệu bạn mở gần đây nhất sẽ được liệt kê tại đây.'
          : 'Toàn bộ tài liệu được lưu trên thiết bị này. Dữ liệu nằm trong trình duyệt của bạn (local-first), không gửi lên máy chủ.'}
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

      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700">
          {isRecent ? 'Chưa có tài liệu nào được mở gần đây' : 'Thư viện tài liệu đang trống'}
        </p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Khi tính năng mở tài liệu hoàn thành, tài liệu của bạn sẽ được lưu
          trên thiết bị và hiển thị tại đây.
        </p>
        <button
          type="button"
          onClick={() => setLocalNotice(OPEN_NOTICE)}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Mở tài liệu từ thiết bị
        </button>
      </div>
    </div>
  )
}
