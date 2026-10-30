import type { ComponentType } from 'react'
import { Columns2, Eraser, FileText, Highlighter, MousePointer2, PenLine, Presentation, Type } from 'lucide-react'
import type { ModeKey } from '../navigation'

interface ModeInfo {
  key: ModeKey
  name: string
  description: string
  previewNote: string
  icon: ComponentType<{ className?: string }>
}

const MODES: ModeInfo[] = [
  {
    key: 'document',
    name: 'Document Mode',
    description: 'Làm việc trên toàn bộ tài liệu: xem, viết tay và chú thích trực tiếp trên trang.',
    previewNote:
      'Mở và chú thích trên PDF, DOCX và hình ảnh. Engine tài liệu được triển khai ở TASK-06 (PDF) và TASK-07 (Word).',
    icon: FileText,
  },
  {
    key: 'split',
    name: 'Split Mode',
    description: 'Tài liệu một bên, bảng trắng một bên — trong cùng một workspace.',
    previewNote:
      'Hai vùng dùng chung một Drawing Engine và tự lưu độc lập theo từng vùng (DEC-020). Chế độ này được triển khai ở TASK-13.',
    icon: Columns2,
  },
  {
    key: 'whiteboard',
    name: 'Whiteboard Mode',
    description: 'Chỉ có bảng trắng: viết, vẽ, tạo văn bản và hình dạng tự do.',
    previewNote:
      'Bảng trắng dạng trang cố định ở giai đoạn đầu (DEC-019). Whiteboard Engine được triển khai ở TASK-12.',
    icon: Presentation,
  },
]

function FakePageLines() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      <div className="h-2.5 w-2/3 rounded bg-slate-300" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-5/6 rounded bg-slate-200" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-3/4 rounded bg-slate-200" />
    </div>
  )
}

function PreviewToolbar() {
  const tools = [MousePointer2, PenLine, Highlighter, Type, Eraser]
  return (
    <div
      className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2"
      aria-hidden="true"
    >
      {tools.map((Icon, index) => (
        <span
          key={index}
          className={`flex h-7 w-7 items-center justify-center rounded-md ${
            index === 1 ? 'bg-blue-50 text-blue-600' : 'text-slate-400'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      ))}
      <span className="ml-1 text-xs text-slate-400">Xem trước giao diện — chưa phải công cụ thật</span>
    </div>
  )
}

function ModePreview({ mode }: { mode: ModeInfo }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <PreviewToolbar />
      {mode.key === 'document' && (
        <div className="flex justify-center bg-slate-100 px-4 py-6">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <FakePageLines />
          </div>
        </div>
      )}
      {mode.key === 'split' && (
        <div className="flex flex-col gap-3 bg-slate-100 px-4 py-6 sm:flex-row">
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Tài liệu
            </p>
            <FakePageLines />
          </div>
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm [background-image:radial-gradient(circle,_#cbd5e1_1px,_transparent_1px)] [background-size:16px_16px]">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Bảng trắng
            </p>
            <div className="h-20" />
          </div>
        </div>
      )}
      {mode.key === 'whiteboard' && (
        <div className="bg-slate-100 px-4 py-6">
          <div className="mx-auto h-44 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-sm [background-image:radial-gradient(circle,_#cbd5e1_1px,_transparent_1px)] [background-size:16px_16px]" />
        </div>
      )}
      <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        {mode.previewNote}
      </p>
    </div>
  )
}

export interface WorkspaceModesProps {
  activeMode: ModeKey
  onSelectMode: (mode: ModeKey) => void
}

export function WorkspaceModes({ activeMode, onSelectMode }: WorkspaceModesProps) {
  const active = MODES.find((mode) => mode.key === activeMode) ?? MODES[0]

  return (
    <section aria-label="Các chế độ làm việc">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Chế độ làm việc
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" role="listbox" aria-label="Chọn chế độ làm việc">
        {MODES.map(({ key, name, description, icon: Icon }) => {
          const selected = key === activeMode
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelectMode(key)}
              className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition sm:p-5 ${
                selected
                  ? 'border-blue-500 ring-2 ring-blue-100'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  selected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-sm font-medium text-slate-900">{name}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-500">
                {description}
              </span>
              {selected && (
                <span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Đang chọn
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-4">
        <ModePreview mode={active} />
      </div>
    </section>
  )
}
