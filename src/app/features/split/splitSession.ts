/**
 * Split Session (TASK-13, DEC-020/DEC-032): vết liên kết
 * của phiên Split gần nhất — tài liệu nào đi với bảng
 * trắng nào, tỉ lệ chia, pane đang hoạt động. Đây là
 * trạng thái GIAO DIỆN của thiết bị, không phải dữ liệu
 * thư viện: tài liệu và nét vẽ vẫn nằm ở Dexie như cũ,
 * nên vết liên kết lưu ở localStorage là đủ và không
 * thuộc phạm vi backup. Mọi dữ liệu đọc lên đều được
 * kiểm chứng; hỏng thì coi như chưa có phiên nào.
 */

export type SplitPaneId = 'left' | 'right'

export interface SplitSessionData {
  documentId: string | null
  whiteboardId: string | null
  /** Tỉ lệ chiều rộng pane trái, 0..1 (mặc định 0.5). */
  ratio: number
  activePane: SplitPaneId
}

export const DEFAULT_SPLIT_SESSION: SplitSessionData = {
  documentId: null,
  whiteboardId: null,
  ratio: 0.5,
  activePane: 'left',
}

export const SPLIT_RATIO_MIN = 0.15
export const SPLIT_RATIO_MAX = 0.85

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio))
}

export interface KeyValueStorage {
  read(key: string): string | null
  write(key: string, value: string): void
}

export const SPLIT_SESSION_KEY = 'webscribble:split-session:v1'

export function createLocalStorageKeyValue(): KeyValueStorage {
  return {
    read: (key) => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    write: (key, value) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // localStorage đầy/bị chặn: phiên Split chỉ mất
        // vết liên kết, dữ liệu tài liệu không ảnh hưởng.
      }
    },
  }
}

export class SplitSessionStore {
  private readonly storage: KeyValueStorage
  private readonly key: string

  constructor(storage: KeyValueStorage, key: string = SPLIT_SESSION_KEY) {
    this.storage = storage
    this.key = key
  }

  load(): SplitSessionData {
    const raw = this.storage.read(this.key)
    if (raw === null) return { ...DEFAULT_SPLIT_SESSION }
    try {
      const parsed = JSON.parse(raw) as Partial<SplitSessionData>
      return {
        documentId: typeof parsed.documentId === 'string' ? parsed.documentId : null,
        whiteboardId: typeof parsed.whiteboardId === 'string' ? parsed.whiteboardId : null,
        ratio: clampSplitRatio(typeof parsed.ratio === 'number' ? parsed.ratio : 0.5),
        activePane: parsed.activePane === 'right' ? 'right' : 'left',
      }
    } catch {
      return { ...DEFAULT_SPLIT_SESSION }
    }
  }

  save(data: SplitSessionData): void {
    this.storage.write(this.key, JSON.stringify(data))
  }
}
