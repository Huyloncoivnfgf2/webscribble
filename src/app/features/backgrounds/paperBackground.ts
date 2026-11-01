/**
 * Nền giấy dùng chung — tầng UI (TASK-14C, DEC-035).
 *
 * Mô hình dữ liệu (`PaperBackground`) sống ở Data Layer
 * (`src/data/types.ts`); file này sở hữu phần TRÌNH BÀY:
 * nhãn tiếng Việt, CSS pattern cho từng loại nền, kiểm tra
 * ảnh nền tải lên và hook lấy object URL của ảnh đã lưu.
 * Ba bề mặt (whiteboard, PDF, DOCX) dùng chung cả ba thứ —
 * không bề mặt nào tự chế pattern riêng nữa.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  MAIN_BACKGROUND_SLOT,
  RULED_SPACINGS_PX,
  type PaperBackground,
  type PaperBackgroundKind,
} from '../../../data/index'
import { getAppStorage } from '../../storage'

export const PAPER_BACKGROUND_LABELS: Record<PaperBackgroundKind, string> = {
  blank: 'Trắng trơn',
  dark: 'Bảng đen',
  ruled: 'Kẻ dòng',
  grid: 'Kẻ ô vuông',
  'dot-grid': 'Lưới chấm',
  dots: 'Chấm',
  graph: 'Lưới caro',
  math: 'Kẻ toán',
  music: 'Kẻ nhạc',
  image: 'Ảnh nền',
}

export const PAPER_BACKGROUND_KIND_ORDER: readonly PaperBackgroundKind[] = [
  'blank',
  'ruled',
  'grid',
  'dot-grid',
  'dots',
  'graph',
  'math',
  'music',
  'dark',
  'image',
]

export const RULED_SPACING_LABELS: Record<number, string> = {
  24: 'Dòng hẹp',
  32: 'Dòng vừa',
  40: 'Dòng rộng',
}

export const DEFAULT_RULED_SPACING_PX = 32

/** Nền tối (bảng đen) — bề mặt có chữ nên đổi màu chữ theo. */
export function isDarkPaperBackground(background: PaperBackground): boolean {
  return background.kind === 'dark'
}

const LINE = 'rgba(100, 116, 139, 0.35)'
const LINE_STRONG = 'rgba(100, 116, 139, 0.55)'
const LINE_DARK_BG = 'rgba(148, 163, 184, 0.35)'

function px(value: number, scale: number, min = 8): string {
  return `${Math.max(min, value * scale)}px`
}

/**
 * CSS nền cho một PaperBackground ở một mức zoom. `imageUrl`
 * chỉ cần khi kind là 'image' (object URL của Blob đã lưu);
 * thiếu URL thì ảnh nền tạm hiện nền trắng kèm class chờ.
 */
export function paperBackgroundStyle(
  background: PaperBackground,
  scale: number,
  imageUrl?: string | null,
): CSSProperties {
  switch (background.kind) {
    case 'blank':
      return { backgroundColor: '#ffffff' }
    case 'dark':
      return { backgroundColor: '#1e293b' }
    case 'ruled': {
      const spacing =
        background.spacingPx !== undefined &&
        RULED_SPACINGS_PX.includes(background.spacingPx)
          ? background.spacingPx
          : DEFAULT_RULED_SPACING_PX
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 1px), ${LINE} calc(100% - 1px))`,
        backgroundSize: `100% ${px(spacing, scale)}`,
      }
    }
    case 'grid': {
      const size = px(28, scale)
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        backgroundSize: `${size} ${size}`,
      }
    }
    case 'dot-grid': {
      const size = px(28, scale)
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `radial-gradient(circle, ${LINE_DARK_BG} 1.5px, transparent 1.7px)`,
        backgroundSize: `${size} ${size}`,
      }
    }
    case 'dots': {
      // Chấm so le: hai lớp radial lệch nhau nửa ô.
      const size = px(28, scale)
      const half = px(14, scale, 4)
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `radial-gradient(circle, ${LINE_DARK_BG} 1.5px, transparent 1.7px), radial-gradient(circle, ${LINE_DARK_BG} 1.5px, transparent 1.7px)`,
        backgroundSize: `${size} ${size}`,
        backgroundPosition: `0 0, ${half} ${half}`,
      }
    }
    case 'graph': {
      const size = px(28, scale)
      return {
        backgroundColor: '#ffffff',
        backgroundImage:
          'conic-gradient(#f1f5f9 25%, #ffffff 0 50%, #f1f5f9 0 75%, #ffffff 0)',
        backgroundSize: `${size} ${size}`,
      }
    }
    case 'math': {
      const minor = px(14, scale, 4)
      const major = px(70, scale)
      return {
        backgroundColor: '#ffffff',
        backgroundImage: [
          `linear-gradient(to right, ${LINE_STRONG} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${LINE_STRONG} 1px, transparent 1px)`,
          `linear-gradient(to right, ${LINE} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: `${major} ${major}, ${major} ${major}, ${minor} ${minor}, ${minor} ${minor}`,
      }
    }
    case 'music': {
      // Cụm khuông nhạc: 5 dòng cách 8px, khoảng nghỉ 32px
      // giữa hai cụm -> ô pattern cao 64px (ở scale 1).
      const lineGap = 8 * scale
      const tile = 64 * scale
      const stops: string[] = []
      for (let i = 0; i < 5; i += 1) {
        const at = i * lineGap
        stops.push(`${LINE} ${at}px ${at + 1}px`, `transparent ${at + 1}px ${at + lineGap}px`)
      }
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`,
        backgroundSize: `100% ${Math.max(16, tile)}px`,
      }
    }
    case 'image':
      if (imageUrl === undefined || imageUrl === null) {
        return { backgroundColor: '#ffffff' }
      }
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
  }
}

// ── Kiểm tra ảnh nền tải lên ─────────────────────────────

/** Giới hạn dung lượng ảnh nền: 5 MB. */
export const MAX_BACKGROUND_IMAGE_BYTES = 5 * 1024 * 1024

export const BACKGROUND_IMAGE_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]

export type BackgroundImageCheck =
  | { ok: true; mimeType: string; message: null }
  | { ok: false; message: string }

/** Chữ ký byte đầu theo định dạng (magic bytes). */
function matchesSignature(mimeType: string, bytes: Uint8Array): boolean {
  const is = (offset: number, expected: readonly number[]) =>
    expected.every((value, i) => bytes[offset + i] === value)
  switch (mimeType) {
    case 'image/png':
      return bytes.length >= 4 && is(0, [0x89, 0x50, 0x4e, 0x47])
    case 'image/jpeg':
      return bytes.length >= 3 && is(0, [0xff, 0xd8, 0xff])
    case 'image/gif':
      return bytes.length >= 4 && is(0, [0x47, 0x49, 0x46, 0x38]) // 'GIF8'
    case 'image/webp':
      // 'RIFF' .... 'WEBP'
      return (
        bytes.length >= 12 &&
        is(0, [0x52, 0x49, 0x46, 0x46]) &&
        is(8, [0x57, 0x45, 0x42, 0x50])
      )
    default:
      return false
  }
}

/**
 * Kiểm tra một file ảnh nền: MIME thuộc danh sách cho phép,
 * dung lượng ≤ 5MB, và chữ ký byte đầu KHỚP với MIME khai
 * báo (đổi đuôi file không qua được). Chỉ đọc 12 byte đầu.
 */
export async function inspectBackgroundImage(
  file: Blob,
): Promise<BackgroundImageCheck> {
  if (!BACKGROUND_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      message: 'Định dạng ảnh chưa hỗ trợ. Hãy chọn PNG, JPEG, WebP hoặc GIF.',
    }
  }
  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    return { ok: false, message: 'Ảnh nền tối đa 5MB. Hãy chọn ảnh nhỏ hơn.' }
  }
  if (file.size === 0) {
    return { ok: false, message: 'File ảnh rỗng.' }
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!matchesSignature(file.type, head)) {
    return {
      ok: false,
      message: 'Nội dung file không khớp định dạng ảnh đã khai. Hãy chọn file ảnh thật.',
    }
  }
  return { ok: true, mimeType: file.type, message: null }
}

/**
 * Hook: object URL của ảnh nền đã lưu cho một tài liệu tại
 * một slot, khi bề mặt đang chọn nền dạng ảnh. Tự thu hồi
 * URL khi đổi tài liệu/slot/loại nền hoặc unmount.
 */
export function useBackgroundImageUrl(
  documentId: string | null,
  kind: PaperBackgroundKind,
  slot: string = MAIN_BACKGROUND_SLOT,
): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (documentId === null || kind !== 'image') {
      setUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void getAppStorage()
      .foundation.backgroundImages.get(documentId, slot)
      .then((record) => {
        if (cancelled || record === undefined) return
        objectUrl = URL.createObjectURL(record.blob)
        setUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [documentId, kind, slot])
  return url
}
