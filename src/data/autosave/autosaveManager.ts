/**
 * AutosaveManager (TASK-08A): primitive tự lưu dùng chung cho
 * Annotation Engine (TASK-06C). Thuần logic điều phối — không biết
 * Drawing Engine là gì; hàm ghi thật được tiêm vào.
 *
 * Bảo đảm:
 * - Debounce theo từng surfaceId (mặc định 400 ms, cấu hình được);
 *   nhiều thay đổi liên tiếp của cùng surface chỉ ghi trạng thái
 *   MỚI NHẤT.
 * - Các surface khác nhau độc lập hoàn toàn.
 * - Một write cũ không bao giờ hoàn tất sau rồi ghi đè trạng thái
 *   mới hơn: mỗi surface có số thứ tự tăng đơn điệu; khi write xong
 *   mà đã có dữ liệu mới hơn đang chờ, manager ghi tiếp dữ liệu mới
 *   nhất thay vì báo 'saved'.
 * - Trạng thái 'saved' chỉ được báo SAU khi hàm ghi resolve.
 * - Lỗi ghi không bị nuốt: qua callback onError, qua getError(), và
 *   flush() reject. Dữ liệu lỗi được giữ lại ở trạng thái chờ để lần
 *   flush sau thử lại.
 * - flush() chờ đến khi không còn dữ liệu chờ của surface (hoặc mọi
 *   surface) và mọi write đang chạy đã kết thúc.
 */
import type { SaveSurfaceInput } from '../types'

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
export type SaveSurfaceFn = (input: SaveSurfaceInput) => Promise<unknown>

export interface AutosaveManagerOptions {
  debounceMs?: number
  onStateChange?: (surfaceId: string, state: AutosaveState) => void
  onError?: (surfaceId: string, error: unknown) => void
}

interface SurfaceEntry {
  timer: ReturnType<typeof setTimeout> | null
  /** Dữ liệu mới nhất chưa được ghi thành công. */
  pending: SaveSurfaceInput | null
  /** Số thứ tự của dữ liệu pending (0 = chưa từng có). */
  pendingSeq: number
  /** Số thứ tự của write đang chạy (0 = không có). */
  inFlightSeq: number
  state: AutosaveState
  error: unknown
}

const DEFAULT_DEBOUNCE_MS = 400

export class AutosaveManager {
  private readonly saveFn: SaveSurfaceFn
  private readonly debounceMs: number
  private readonly onStateChange?: (surfaceId: string, state: AutosaveState) => void
  private readonly onError?: (surfaceId: string, error: unknown) => void
  private readonly entries = new Map<string, SurfaceEntry>()
  private seqCounter = 0

  constructor(saveFn: SaveSurfaceFn, options: AutosaveManagerOptions = {}) {
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    if (!Number.isFinite(debounceMs) || debounceMs < 0) {
      throw new Error(`AutosaveManager: debounceMs must be a non-negative finite number, got ${debounceMs}`)
    }
    this.saveFn = saveFn
    this.debounceMs = debounceMs
    this.onStateChange = options.onStateChange
    this.onError = options.onError
  }

  /** Báo một thay đổi: ghi sau debounceMs nếu không có thay đổi mới hơn. */
  schedule(input: SaveSurfaceInput): void {
    const entry = this.entryFor(input.surfaceId)
    entry.pending = input
    entry.pendingSeq = ++this.seqCounter
    entry.error = null
    this.setState(input.surfaceId, entry, 'pending')
    this.armTimer(input.surfaceId, entry)
  }

  /**
   * Xả ngay: một surface (nếu có surfaceId) hoặc mọi surface. Chờ
   * đến khi dữ liệu chờ đã ghi xong; reject nếu lần ghi cuối lỗi.
   */
  async flush(surfaceId?: string): Promise<void> {
    if (surfaceId !== undefined) {
      await this.flushSurface(surfaceId)
      return
    }
    const ids = [...this.entries.keys()]
    await Promise.all(ids.map((id) => this.flushSurface(id)))
  }

  /** Hủy ghi đang chờ của một surface (hoặc mọi surface). Write đang chạy không bị hủy. */
  cancel(surfaceId?: string): void {
    const ids = surfaceId !== undefined ? [surfaceId] : [...this.entries.keys()]
    for (const id of ids) {
      const entry = this.entries.get(id)
      if (entry === undefined) continue
      if (entry.timer !== null) clearTimeout(entry.timer)
      entry.timer = null
      entry.pending = null
      if (entry.inFlightSeq === 0) {
        this.setState(id, entry, 'idle')
      }
    }
  }

  getState(surfaceId: string): AutosaveState {
    return this.entries.get(surfaceId)?.state ?? 'idle'
  }

  getError(surfaceId: string): unknown {
    return this.entries.get(surfaceId)?.error ?? null
  }

  /** Có dữ liệu chưa ghi thành công (đang chờ hoặc đang ghi) hay không. */
  hasPending(surfaceId: string): boolean {
    const entry = this.entries.get(surfaceId)
    return entry !== undefined && (entry.pending !== null || entry.inFlightSeq > 0)
  }

  private entryFor(surfaceId: string): SurfaceEntry {
    let entry = this.entries.get(surfaceId)
    if (entry === undefined) {
      entry = {
        timer: null,
        pending: null,
        pendingSeq: 0,
        inFlightSeq: 0,
        state: 'idle',
        error: null,
      }
      this.entries.set(surfaceId, entry)
    }
    return entry
  }

  private setState(surfaceId: string, entry: SurfaceEntry, state: AutosaveState): void {
    if (entry.state === state) return
    entry.state = state
    this.onStateChange?.(surfaceId, state)
  }

  private armTimer(surfaceId: string, entry: SurfaceEntry): void {
    if (entry.timer !== null) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = null
      void this.drain(surfaceId, entry).catch(() => {
        // Lỗi đã được ghi vào entry + onError trong drain; tránh
        // unhandled rejection từ đường timer.
      })
    }, this.debounceMs)
  }

  private async flushSurface(surfaceId: string): Promise<void> {
    const entry = this.entries.get(surfaceId)
    if (entry === undefined) return
    if (entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    await this.drain(surfaceId, entry)
    if (entry.state === 'error') {
      throw entry.error instanceof Error ? entry.error : new Error(String(entry.error))
    }
  }

  /**
   * Ghi cho đến khi hết dữ liệu chờ. Nếu trong lúc ghi có dữ liệu
   * mới hơn đến, vòng lặp ghi tiếp dữ liệu đó — trạng thái cuối chỉ
   * là 'saved' khi dữ liệu MỚI NHẤT đã xuống storage.
   */
  private async drain(surfaceId: string, entry: SurfaceEntry): Promise<void> {
    if (entry.inFlightSeq > 0) {
      // Đang có write chạy: chờ nó xong rồi drain tiếp phần còn lại.
      await this.waitForInFlight(entry)
    }
    while (entry.pending !== null) {
      const input = entry.pending
      const seq = entry.pendingSeq
      entry.pending = null
      entry.inFlightSeq = seq
      this.setState(surfaceId, entry, 'saving')
      try {
        await this.saveFn(input)
      } catch (error) {
        entry.inFlightSeq = 0
        // Giữ lại dữ liệu chưa ghi được (nếu chưa có dữ liệu mới hơn
        // thay thế) để flush sau thử lại; không nuốt lỗi.
        if (entry.pending === null) entry.pending = input
        entry.error = error
        this.setState(surfaceId, entry, 'error')
        this.onError?.(surfaceId, error)
        return
      }
      entry.inFlightSeq = 0
      if (entry.pending === null) {
        entry.error = null
        this.setState(surfaceId, entry, 'saved')
      }
      // Nếu pending khác null: có dữ liệu mới hơn — vòng lặp ghi tiếp.
    }
  }

  private waitForInFlight(entry: SurfaceEntry): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (entry.inFlightSeq === 0) resolve()
        else setTimeout(check, 1)
      }
      check()
    })
  }
}
