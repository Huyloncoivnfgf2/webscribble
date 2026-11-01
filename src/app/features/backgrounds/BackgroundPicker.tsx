import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import {
  RULED_SPACINGS_PX,
  type PaperBackground,
  type PaperBackgroundKind,
} from '../../../data/index'
import {
  PAPER_BACKGROUND_KIND_ORDER,
  PAPER_BACKGROUND_LABELS,
  RULED_SPACING_LABELS,
  DEFAULT_RULED_SPACING_PX,
} from './paperBackground'

/**
 * Bộ chọn nền giấy DÙNG CHUNG (TASK-14C): whiteboard, PDF và
 * DOCX cùng một giao diện — chọn loại nền, khoảng cách dòng
 * khi kẻ dòng, và nút tải ảnh khi chọn Ảnh nền. Việc LƯU trữ
 * thuộc về từng bề mặt (manifest / repository) qua callbacks.
 */
export interface BackgroundPickerProps {
  value: PaperBackground
  onChange: (background: PaperBackground) => void
  /** Người dùng chọn file ảnh (chưa kiểm tra — bề mặt kiểm tra + lưu). */
  onPickImage: (file: File) => void
  disabled?: boolean
  /** Thông báo lỗi ảnh (định dạng/kích thước) do bề mặt đặt. */
  imageError?: string | null
}

export function BackgroundPicker({
  value,
  onChange,
  onPickImage,
  disabled = false,
  imageError = null,
}: BackgroundPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleKind = (kind: PaperBackgroundKind) => {
    if (kind === 'image') {
      // Chuyển sang Ảnh nền chỉ hoàn tất khi có ảnh: mở hộp
      // chọn file ngay; hủy chọn thì giữ nền cũ.
      fileInputRef.current?.click()
      return
    }
    if (kind === 'ruled') {
      onChange({
        kind,
        spacingPx: value.spacingPx ?? DEFAULT_RULED_SPACING_PX,
      })
      return
    }
    onChange({ kind })
  }

  const handleFile = (file: File | undefined) => {
    if (file === undefined) return
    onPickImage(file)
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
        Nền
        <select
          aria-label="Loại nền giấy"
          value={value.kind}
          disabled={disabled}
          onChange={(e) => handleKind(e.target.value as PaperBackgroundKind)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
        >
          {PAPER_BACKGROUND_KIND_ORDER.map((kind) => (
            <option key={kind} value={kind}>
              {PAPER_BACKGROUND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      {value.kind === 'ruled' && (
        <select
          aria-label="Khoảng cách dòng"
          value={value.spacingPx ?? DEFAULT_RULED_SPACING_PX}
          disabled={disabled}
          onChange={(e) =>
            onChange({ kind: 'ruled', spacingPx: Number(e.target.value) })
          }
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
        >
          {RULED_SPACINGS_PX.map((spacing) => (
            <option key={spacing} value={spacing}>
              {RULED_SPACING_LABELS[spacing]} ({spacing}px)
            </option>
          ))}
        </select>
      )}
      {value.kind === 'image' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Đổi ảnh nền
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        aria-label="Chọn ảnh nền"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {imageError !== null && (
        <span role="alert" className="text-xs text-red-600">
          {imageError}
        </span>
      )}
    </span>
  )
}
