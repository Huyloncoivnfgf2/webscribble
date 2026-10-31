/**
 * TASK-08A — AutosaveManager: debounce theo surface, chỉ ghi trạng
 * thái mới nhất, flush chờ ghi xong, lỗi không bị nuốt, write cũ
 * không ghi đè write mới, các surface độc lập.
 */
import { describe, expect, it, vi } from 'vitest'
import { AutosaveManager } from '../../src/data/autosave/autosaveManager'
import { documentSurfaceId, type SaveSurfaceInput } from '../../src/data/types'

const S1 = documentSurfaceId('doc-1', 0)
const S2 = documentSurfaceId('doc-1', 1)

function input(surfaceId: string, tag: string): SaveSurfaceInput {
  return {
    surfaceId,
    documentId: 'doc-1',
    pageIndex: 0,
    objects: [{ id: tag }],
  }
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('AutosaveManager', () => {
  it('debounce: nhiều thay đổi liên tiếp của cùng surface chỉ ghi MỘT lần với dữ liệu mới nhất', async () => {
    const save = vi.fn(async () => {})
    const manager = new AutosaveManager(save, { debounceMs: 20 })
    manager.schedule(input(S1, 'v1'))
    manager.schedule(input(S1, 'v2'))
    manager.schedule(input(S1, 'v3'))
    expect(save).not.toHaveBeenCalled()
    await sleep(50)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].objects).toEqual([{ id: 'v3' }])
    expect(manager.getState(S1)).toBe('saved')
  })

  it('flush ghi ngay và chỉ resolve SAU khi write thành công (không báo saved sớm)', async () => {
    const gate = deferred()
    const save = vi.fn(() => gate.promise)
    const manager = new AutosaveManager(save, { debounceMs: 10_000 })
    manager.schedule(input(S1, 'v1'))
    expect(manager.getState(S1)).toBe('pending')
    let flushed = false
    const flushing = manager.flush(S1).then(() => {
      flushed = true
    })
    await sleep(10)
    expect(manager.getState(S1)).toBe('saving')
    expect(flushed).toBe(false) // write chưa xong — flush vẫn chờ
    gate.resolve()
    await flushing
    expect(flushed).toBe(true)
    expect(manager.getState(S1)).toBe('saved')
    expect(manager.hasPending(S1)).toBe(false)
  })

  it('write cũ đang chạy + dữ liệu mới đến: sau khi write cũ xong, manager ghi tiếp bản mới — saved chỉ sau bản mới nhất', async () => {
    const gates: ReturnType<typeof deferred>[] = []
    const savedTags: string[] = []
    const save = vi.fn((inp: SaveSurfaceInput) => {
      const gate = deferred()
      gates.push(gate)
      return gate.promise.then(() => {
        savedTags.push((inp.objects[0] as { id: string }).id)
      })
    })
    const manager = new AutosaveManager(save, { debounceMs: 5 })
    manager.schedule(input(S1, 'old'))
    await sleep(20) // debounce qua, write 'old' đang chạy (gates[0] chưa resolve)
    expect(save).toHaveBeenCalledTimes(1)
    manager.schedule(input(S1, 'new'))
    gates[0].resolve()
    await sleep(20) // drain ghi tiếp 'new'
    expect(save).toHaveBeenCalledTimes(2)
    expect(manager.getState(S1)).toBe('saving')
    gates[1].resolve()
    await sleep(20)
    expect(savedTags).toEqual(['old', 'new']) // thứ tự ghi đúng, bản cuối là mới nhất
    expect(manager.getState(S1)).toBe('saved')
  })

  it('lỗi ghi: trạng thái error, onError được gọi, flush reject, dữ liệu giữ lại để flush sau thử lại thành công', async () => {
    let shouldFail = true
    const save = vi.fn(async () => {
      if (shouldFail) throw new Error('QuotaExceededError (gia lap)')
    })
    const errors: unknown[] = []
    const manager = new AutosaveManager(save, {
      debounceMs: 5,
      onError: (_surfaceId, error) => errors.push(error),
    })
    manager.schedule(input(S1, 'v1'))
    await expect(manager.flush(S1)).rejects.toThrow('QuotaExceededError')
    expect(manager.getState(S1)).toBe('error')
    expect(errors).toHaveLength(1)
    expect(manager.hasPending(S1)).toBe(true) // dữ liệu chưa mất

    shouldFail = false
    await manager.flush(S1) // thử lại bằng chính dữ liệu đã giữ
    expect(manager.getState(S1)).toBe('saved')
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('hai surface độc lập: lịch ghi và trạng thái không ảnh hưởng nhau', async () => {
    const save = vi.fn(async () => {})
    const manager = new AutosaveManager(save, { debounceMs: 10 })
    manager.schedule(input(S1, 'a'))
    manager.schedule(input(S2, 'b'))
    await manager.flush()
    expect(save).toHaveBeenCalledTimes(2)
    const bySurface = new Map(save.mock.calls.map((c) => [c[0].surfaceId, c[0].objects]))
    expect(bySurface.get(S1)).toEqual([{ id: 'a' }])
    expect(bySurface.get(S2)).toEqual([{ id: 'b' }])
    expect(manager.getState(S1)).toBe('saved')
    expect(manager.getState(S2)).toBe('saved')
  })

  it('cancel hủy ghi đang chờ: quá debounce vẫn không ghi; trạng thái về idle', async () => {
    const save = vi.fn(async () => {})
    const manager = new AutosaveManager(save, { debounceMs: 15 })
    manager.schedule(input(S1, 'v1'))
    manager.cancel(S1)
    await sleep(40)
    expect(save).not.toHaveBeenCalled()
    expect(manager.getState(S1)).toBe('idle')
    expect(manager.hasPending(S1)).toBe(false)
  })

  it('debounceMs không hợp lệ bị từ chối ngay khi khởi tạo', () => {
    expect(() => new AutosaveManager(async () => {}, { debounceMs: -1 })).toThrow()
    expect(() => new AutosaveManager(async () => {}, { debounceMs: Number.NaN })).toThrow()
  })
})
