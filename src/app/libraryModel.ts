import type { DocumentMetadata, StorageQuotaInfo } from '../data/index'

/**
 * Logic thuần cho TASK-08B (Document Manager & Library UI):
 * định dạng dung lượng, thứ tự "gần đây", phân loại trạng thái
 * quota. Không phụ thuộc React/DOM — kiểm thử trực tiếp bằng
 * unit test; tầng UI chỉ trình bày kết quả.
 */

/** Ngưỡng cảnh báo dung lượng: dùng từ 80% quota ước tính trở lên. */
export const QUOTA_WARNING_THRESHOLD = 0.8

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Định dạng số byte thành chuỗi dễ đọc (hệ 1024):
 * 0 → "0 B", 512 → "512 B", 1536 → "1,5 KB", 5_242_880 → "5 MB".
 * Giá trị không hợp lệ (âm, NaN, vô cực) → "—" (không bịa số).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',')
  return `${text} ${BYTE_UNITS[unitIndex]}`
}

/** Nhãn loại file ngắn từ MIME type (PDF → "PDF"; lạ → subtype viết hoa). */
export function documentTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('wordprocessingml')) return 'DOCX'
  if (mimeType.includes('whiteboard')) return 'Bảng trắng'
  const subtype = mimeType.split('/')[1]
  return subtype !== undefined && subtype !== '' ? subtype.toUpperCase() : 'File'
}

/**
 * Sắp xếp "gần đây nhất trước" theo `updatedAt` (metadata phản
 * ánh lần tạo/sửa gần nhất — gồm cả lần mở đầu ghi pageCount và
 * lần đổi tên). KHÔNG sửa mảng đầu vào. Repository hiện sắp
 * theo createdAt; thứ tự hiển thị gần đây là quyết định của
 * tầng thư viện nên sắp lại tại đây, không đổi Data Layer.
 */
export function sortByRecent(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
  return [...documents].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
}

export type StorageUsageView =
  | { kind: 'unavailable' }
  | {
      kind: 'ok' | 'warning'
      usage: number
      quota: number
      /** Tỷ lệ 0..1 (có thể > 1 nếu trình duyệt báo usage vượt quota). */
      ratio: number
      /** Phần trăm làm tròn để hiển thị. */
      percent: number
    }

/**
 * Phân loại kết quả estimate() của StorageManager:
 * - Không hỗ trợ API, estimate() lỗi, hoặc thiếu quota/usage
 *   → 'unavailable' (UI hiển thị trạng thái trung thực, không
 *   bịa số).
 * - ratio ≥ QUOTA_WARNING_THRESHOLD → 'warning' (gần đầy).
 * - Còn lại → 'ok'.
 * Lưu ý: số liệu là ƯỚC TÍNH của trình duyệt (DEC/ISSUE-005),
 * không phải cam kết chính xác.
 */
export function classifyStorageUsage(info: StorageQuotaInfo): StorageUsageView {
  if (!info.supported || info.error !== null) return { kind: 'unavailable' }
  if (info.quota === null || info.usage === null || info.quota <= 0) {
    return { kind: 'unavailable' }
  }
  const ratio = info.usage / info.quota
  return {
    kind: ratio >= QUOTA_WARNING_THRESHOLD ? 'warning' : 'ok',
    usage: info.usage,
    quota: info.quota,
    ratio,
    percent: Math.round(ratio * 100),
  }
}
