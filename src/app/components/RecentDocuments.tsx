import { FileText } from 'lucide-react'

export function RecentDocuments() {
  return (
    <section aria-label="Tài liệu gần đây">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Tài liệu gần đây
      </h3>
      <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <FileText className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700">Chưa có tài liệu nào</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Các tài liệu bạn mở sẽ xuất hiện tại đây. Tính năng mở tài liệu sẽ
          được triển khai cùng PDF Engine và Word Engine ở các task tiếp theo.
        </p>
      </div>
    </section>
  )
}
