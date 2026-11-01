import { useMemo, useState } from 'react'
import { BookmarkPlus, X } from 'lucide-react'
import type { StrokeKind } from '../../../engines/drawing/index'
import { PEN_KIND_LABELS } from './penKinds'
import {
  MAX_PEN_PRESETS,
  PenPresetStore,
  type PenPreset,
} from './penPresets'

/**
 * Thanh preset bút dùng chung (TASK-14D): chip = một
 * preset (chấm màu + tên), bấm để áp ngay; nút × trên
 * chip để xóa; nút lưu ghi lại tổ hợp bút hiện tại.
 * Trạng thái hiện tại do bề mặt sở hữu truyền vào.
 */
export interface PenPresetBarProps {
  /** Tổ hợp bút đang dùng (null = chưa sẵn sàng để lưu). */
  current: { kind: StrokeKind; color: string; sizeLabel: 'S' | 'M' | 'L' } | null
  onApply: (preset: PenPreset) => void
  disabled?: boolean
}

export function PenPresetBar({ current, onApply, disabled = false }: PenPresetBarProps) {
  const store = useMemo(() => new PenPresetStore(), [])
  const [presets, setPresets] = useState<PenPreset[]>(() => store.list())
  const [note, setNote] = useState<string | null>(null)

  const handleAdd = () => {
    if (current === null) return
    const baseName = `${PEN_KIND_LABELS[current.kind]} ${current.sizeLabel}`
    const taken = new Set(presets.map((p) => p.name))
    let name = baseName
    let suffix = 2
    while (taken.has(name)) {
      name = `${baseName} ${suffix}`
      suffix += 1
    }
    const added = store.add({ name, ...current })
    if (added === null) {
      setNote(`Đã đạt tối đa ${MAX_PEN_PRESETS} preset.`)
      return
    }
    setNote(null)
    setPresets(store.list())
  }

  const handleRemove = (id: string) => {
    setPresets(store.remove(id))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500">Preset</span>
      {presets.map((preset) => (
        <span
          key={preset.id}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white py-0.5 pl-2 pr-1 text-xs text-slate-700"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApply(preset)}
            className="inline-flex items-center gap-1.5 disabled:opacity-50"
            title={`Áp preset ${preset.name}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-slate-300"
              style={{ backgroundColor: preset.color }}
            />
            {preset.name}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleRemove(preset.id)}
            aria-label={`Xóa preset ${preset.name}`}
            className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={disabled || current === null}
        onClick={handleAdd}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <BookmarkPlus className="h-3.5 w-3.5" /> Lưu preset
      </button>
      {note !== null && (
        <span role="alert" className="text-xs text-red-600">
          {note}
        </span>
      )}
    </div>
  )
}
