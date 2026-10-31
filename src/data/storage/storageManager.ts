/**
 * StorageManager (TASK-08A): bọc `navigator.storage` — yêu cầu lưu
 * trữ bền (persist) và đo quota (estimate) — qua một adapter tiêm
 * vào được, để unit test kiểm soát hoàn toàn và để trình duyệt
 * thiếu API không làm sập ứng dụng: mọi kết quả đều có trạng thái
 * rõ ràng ('granted' | 'denied' | 'unsupported'), không đoán mò.
 * Không có UI cảnh báo quota trong TASK-08A.
 */

/** Phần tối thiểu của Storage API mà manager cần — tiêm được khi test. */
export interface StorageEnvironment {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
  estimate?: () => Promise<StorageEstimate>
}

export type PersistenceState = 'granted' | 'denied' | 'unsupported'

export interface StorageQuotaInfo {
  /** false khi trình duyệt không có estimate() — các trường còn lại null. */
  supported: boolean
  quota: number | null
  usage: number | null
  usageDetails: Record<string, number> | null
  /** Thông điệp khi estimate() tự nó ném lỗi; null khi đo thành công. */
  error: string | null
}

function defaultEnvironment(): StorageEnvironment | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.storage as StorageEnvironment | undefined
}

export class StorageManager {
  private readonly env: StorageEnvironment | undefined

  constructor(env: StorageEnvironment | undefined = defaultEnvironment()) {
    this.env = env
  }

  /** Trạng thái bền hiện tại mà không xin quyền mới. */
  async getPersistenceState(): Promise<PersistenceState> {
    if (this.env?.persisted === undefined) return 'unsupported'
    try {
      return (await this.env.persisted()) ? 'granted' : 'denied'
    } catch {
      return 'unsupported'
    }
  }

  /**
   * Xin lưu trữ bền (nên gọi khi người dùng nhập tài liệu quan
   * trọng — DEC-022). Trả về trạng thái SAU khi xin.
   */
  async requestPersistence(): Promise<PersistenceState> {
    if (this.env?.persist === undefined) return 'unsupported'
    try {
      return (await this.env.persist()) ? 'granted' : 'denied'
    } catch {
      return 'unsupported'
    }
  }

  /** Đo quota/usage hiện tại; không ném lỗi ra ngoài. */
  async estimate(): Promise<StorageQuotaInfo> {
    if (this.env?.estimate === undefined) {
      return { supported: false, quota: null, usage: null, usageDetails: null, error: null }
    }
    try {
      const result = await this.env.estimate()
      return {
        supported: true,
        quota: result.quota ?? null,
        usage: result.usage ?? null,
        usageDetails:
          (result as { usageDetails?: Record<string, number> }).usageDetails ?? null,
        error: null,
      }
    } catch (error) {
      return {
        supported: true,
        quota: null,
        usage: null,
        usageDetails: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
