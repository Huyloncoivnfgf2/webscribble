/**
 * TASK-08A — StorageManager qua adapter tiêm vào: trình duyệt hỗ
 * trợ đầy đủ, thiếu API, persist bị từ chối, estimate trả số liệu,
 * estimate tự lỗi — mọi trường hợp đều có kết quả rõ ràng, không crash.
 */
import { describe, expect, it } from 'vitest'
import {
  StorageManager,
  type StorageEnvironment,
} from '../../src/data/storage/storageManager'

describe('StorageManager', () => {
  it('browser hỗ trợ đầy đủ: persisted/request/estimate đều hoạt động', async () => {
    const env: StorageEnvironment = {
      persisted: async () => false,
      persist: async () => true,
      estimate: async () => ({
        quota: 1_000_000,
        usage: 250_000,
        usageDetails: { indexedDB: 200_000 },
      } as StorageEstimate),
    }
    const manager = new StorageManager(env)
    expect(await manager.getPersistenceState()).toBe('denied')
    expect(await manager.requestPersistence()).toBe('granted')
    const info = await manager.estimate()
    expect(info.supported).toBe(true)
    expect(info.quota).toBe(1_000_000)
    expect(info.usage).toBe(250_000)
    expect(info.usageDetails).toEqual({ indexedDB: 200_000 })
    expect(info.error).toBeNull()
  })

  it('browser KHÔNG có Storage API: mọi kết quả là unsupported, không ném lỗi', async () => {
    const manager = new StorageManager({})
    expect(await manager.getPersistenceState()).toBe('unsupported')
    expect(await manager.requestPersistence()).toBe('unsupported')
    const info = await manager.estimate()
    expect(info.supported).toBe(false)
    expect(info.quota).toBeNull()
    // Kể cả khi không có navigator (môi trường Node thuần):
    const bare = new StorageManager(undefined)
    expect(await bare.requestPersistence()).toBe('unsupported')
  })

  it('persist() bị từ chối (trả false) → denied; persist() ném lỗi → unsupported, không crash', async () => {
    const denied = new StorageManager({ persist: async () => false })
    expect(await denied.requestPersistence()).toBe('denied')
    const throwing = new StorageManager({
      persist: async () => {
        throw new Error('not allowed')
      },
      persisted: async () => {
        throw new Error('not allowed')
      },
    })
    expect(await throwing.requestPersistence()).toBe('unsupported')
    expect(await throwing.getPersistenceState()).toBe('unsupported')
  })

  it('estimate() tự ném lỗi: kết quả mang thông điệp lỗi, các số liệu null, không crash', async () => {
    const manager = new StorageManager({
      estimate: async () => {
        throw new Error('estimate failed')
      },
    })
    const info = await manager.estimate()
    expect(info.supported).toBe(true)
    expect(info.error).toBe('estimate failed')
    expect(info.quota).toBeNull()
    expect(info.usage).toBeNull()
  })

  it('estimate() thiếu usageDetails: trả null cho trường đó, vẫn có quota/usage', async () => {
    const manager = new StorageManager({
      estimate: async () => ({ quota: 500, usage: 5 }) as StorageEstimate,
    })
    const info = await manager.estimate()
    expect(info.usageDetails).toBeNull()
    expect(info.quota).toBe(500)
  })
})
