import type { ComponentType } from 'react'
import { FilePlus, FolderOpen, PenLine } from 'lucide-react'

export interface QuickActionsProps {
  onOpenDocument: () => void
  onCreateDocument: () => void
  onOpenWhiteboard: () => void
}

interface Action {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  handler: 'open' | 'create' | 'whiteboard'
}

const ACTIONS: Action[] = [
  {
    title: 'Mở tài liệu',
    description: 'Xem thư viện tài liệu trên thiết bị này.',
    icon: FolderOpen,
    handler: 'open',
  },
  {
    title: 'Tạo tài liệu mới',
    description: 'Bắt đầu một tài liệu trắng để viết và ghi chú.',
    icon: FilePlus,
    handler: 'create',
  },
  {
    title: 'Mở bảng trắng',
    description: 'Viết, vẽ và ghi chú tự do trên bảng trắng.',
    icon: PenLine,
    handler: 'whiteboard',
  },
]

export function QuickActions({ onOpenDocument, onCreateDocument, onOpenWhiteboard }: QuickActionsProps) {
  const handlers = {
    open: onOpenDocument,
    create: onCreateDocument,
    whiteboard: onOpenWhiteboard,
  }

  return (
    <section aria-label="Thao tác nhanh">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Thao tác nhanh
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {ACTIONS.map(({ title, description, icon: Icon, handler }) => (
          <button
            key={handler}
            type="button"
            onClick={handlers[handler]}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow sm:p-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-500">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
