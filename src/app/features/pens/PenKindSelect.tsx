import type { StrokeKind } from '../../../engines/drawing/index'
import { PEN_KIND_LABELS, PEN_KIND_ORDER } from './penKinds'

/** Bộ chọn loại bút dùng chung cho whiteboard/DOCX/Split. */
export function PenKindSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: StrokeKind
  onChange: (kind: StrokeKind) => void
  disabled?: boolean
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      Loại bút
      <select
        aria-label="Loại bút"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as StrokeKind)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
      >
        {PEN_KIND_ORDER.map((kind) => (
          <option key={kind} value={kind}>
            {PEN_KIND_LABELS[kind]}
          </option>
        ))}
      </select>
    </label>
  )
}
