import { isStrokeKind, type StrokeKind } from '../../../engines/drawing/index'

/**
 * Preset bút (TASK-14D, DEC-036): tổ hợp loại bút + màu +
 * cỡ lưu sẵn để đổi nhanh. Preset là SỞ THÍCH THIẾT BỊ —
 * sống ở localStorage (cùng khuôn vết phiên Split), KHÔNG
 * thuộc dữ liệu thư viện và không vào backup.
 */
export interface PenPreset {
  id: string
  name: string
  kind: StrokeKind
  /** Màu #RRGGBB. */
  color: string
  sizeLabel: 'S' | 'M' | 'L'
}

export const PEN_PRESETS_KEY = 'webscribble:pen-presets:v1'
export const MAX_PEN_PRESETS = 12

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

const DEFAULT_PRESET_SEEDS: ReadonlyArray<Omit<PenPreset, 'id'>> = [
  { name: 'Bút thường', kind: 'pen', color: '#111827', sizeLabel: 'M' },
  { name: 'Bút đỏ mảnh', kind: 'fine-pen', color: '#DC2626', sizeLabel: 'S' },
  { name: 'Dạ quang vàng', kind: 'highlighter', color: '#FDE047', sizeLabel: 'M' },
]

function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `preset-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

/** Kiểm chứng một preset thô (dữ liệu localStorage có thể bị sửa tay). */
export function validatePenPreset(raw: unknown): PenPreset | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Partial<PenPreset>
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (typeof value.name !== 'string' || value.name.trim().length === 0) return null
  if (typeof value.kind !== 'string' || !isStrokeKind(value.kind)) return null
  if (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color)) return null
  if (value.sizeLabel !== 'S' && value.sizeLabel !== 'M' && value.sizeLabel !== 'L') {
    return null
  }
  return {
    id: value.id,
    name: value.name.slice(0, 40),
    kind: value.kind,
    color: value.color,
    sizeLabel: value.sizeLabel,
  }
}

export class PenPresetStore {
  private readonly storage: KeyValueStorage | null

  constructor(storage?: KeyValueStorage | null) {
    this.storage = storage === undefined ? defaultStorage() : storage
  }

  /**
   * Danh sách preset. Chưa từng lưu -> gieo 3 preset mẫu
   * (và ghi lại, để lần sau đọc đúng thứ người dùng đã
   * sửa/xóa — kể cả xóa hết thì danh sách rỗng được giữ).
   */
  list(): PenPreset[] {
    if (this.storage === null) return []
    const raw = this.storage.getItem(PEN_PRESETS_KEY)
    if (raw === null) {
      const seeded = DEFAULT_PRESET_SEEDS.map((seed) => ({ ...seed, id: newId() }))
      this.save(seeded)
      return seeded
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => validatePenPreset(item))
      .filter((item): item is PenPreset => item !== null)
      .slice(0, MAX_PEN_PRESETS)
  }

  /** Thêm preset; trả null khi đã đạt giới hạn, dữ liệu không hợp lệ, hoặc không có nơi lưu. */
  add(input: Omit<PenPreset, 'id'>): PenPreset | null {
    if (this.storage === null) return null
    const candidate = validatePenPreset({ ...input, id: newId() })
    if (candidate === null) return null
    const current = this.list()
    if (current.length >= MAX_PEN_PRESETS) return null
    const next = [...current, candidate]
    this.save(next)
    return candidate
  }

  remove(id: string): PenPreset[] {
    const next = this.list().filter((preset) => preset.id !== id)
    this.save(next)
    return next
  }

  private save(presets: PenPreset[]): void {
    if (this.storage === null) return
    try {
      this.storage.setItem(PEN_PRESETS_KEY, JSON.stringify(presets))
    } catch {
      // Hết quota localStorage: preset chỉ là tiện ích —
      // bỏ qua thay vì làm hỏng thao tác vẽ.
    }
  }
}
