import { describe, expect, it } from 'vitest'
import {
  MAX_PEN_PRESETS,
  PEN_PRESETS_KEY,
  PenPresetStore,
  validatePenPreset,
  type KeyValueStorage,
} from '../../src/app/features/pens/penPresets'

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('PenPresetStore', () => {
  it('lần đầu: gieo 3 preset mẫu và ghi lại để lần sau đọc đúng', () => {
    const storage = new MemoryStorage()
    const store = new PenPresetStore(storage)
    const first = store.list()
    expect(first.map((p) => p.name)).toEqual(['Bút thường', 'Bút đỏ mảnh', 'Dạ quang vàng'])
    expect(first[1]).toMatchObject({ kind: 'fine-pen', color: '#DC2626', sizeLabel: 'S' })
    // Đã ghi xuống storage:
    expect(storage.data.has(PEN_PRESETS_KEY)).toBe(true)
    // Xóa hết -> danh sách rỗng được GIỮ (không gieo lại):
    for (const preset of first) store.remove(preset.id)
    expect(store.list()).toEqual([])
  })

  it('thêm/xóa vòng tròn; preset mới đọc lại được từ store khác cùng storage', () => {
    const storage = new MemoryStorage()
    const store = new PenPresetStore(storage)
    const added = store.add({ name: 'Nước biển', kind: 'watercolor', color: '#2563EB', sizeLabel: 'L' })
    expect(added).not.toBeNull()
    const reread = new PenPresetStore(storage).list()
    expect(reread.some((p) => p.name === 'Nước biển' && p.kind === 'watercolor')).toBe(true)
    store.remove(added!.id)
    expect(store.list().some((p) => p.name === 'Nước biển')).toBe(false)
  })

  it('chặn ở giới hạn tối đa + từ chối dữ liệu không hợp lệ', () => {
    const storage = new MemoryStorage()
    const store = new PenPresetStore(storage)
    for (let i = store.list().length; i < MAX_PEN_PRESETS; i += 1) {
      expect(store.add({ name: `P${i}`, kind: 'pen', color: '#111827', sizeLabel: 'M' })).not.toBeNull()
    }
    expect(store.add({ name: 'Thừa', kind: 'pen', color: '#111827', sizeLabel: 'M' })).toBeNull()
    expect(
      store.add({ name: 'Sai màu', kind: 'pen', color: 'red', sizeLabel: 'M' }),
    ).toBeNull()
  })

  it('dữ liệu storage hỏng -> lọc bỏ mục sai, JSON vỡ -> rỗng', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      PEN_PRESETS_KEY,
      JSON.stringify([
        { id: 'a', name: 'Tốt', kind: 'pencil', color: '#111827', sizeLabel: 'S' },
        { id: 'b', name: 'Loại lạ', kind: 'neon', color: '#111827', sizeLabel: 'S' },
        { id: 'c', name: 'Cỡ lạ', kind: 'pen', color: '#111827', sizeLabel: 'XL' },
        'rác',
      ]),
    )
    expect(new PenPresetStore(storage).list().map((p) => p.id)).toEqual(['a'])
    storage.setItem(PEN_PRESETS_KEY, '{vỡ')
    expect(new PenPresetStore(storage).list()).toEqual([])
  })

  it('không có storage (SSR/môi trường lạ) -> rỗng, không ném lỗi', () => {
    const store = new PenPresetStore(null)
    expect(store.list()).toEqual([])
    expect(store.add({ name: 'X', kind: 'pen', color: '#111827', sizeLabel: 'M' })).toBeNull()
  })

  it('validatePenPreset: cắt tên quá dài, chặn trường thiếu', () => {
    const long = validatePenPreset({
      id: 'x',
      name: 'a'.repeat(80),
      kind: 'marker',
      color: '#ABCDEF',
      sizeLabel: 'M',
    })
    expect(long?.name).toHaveLength(40)
    expect(validatePenPreset({ id: 'x', kind: 'pen' })).toBeNull()
  })
})
