import {
  UnsupportedContentVersionError,
  type DocumentContentRepository,
} from '../../../data/index'
import {
  validateWordContent,
  type WordDocumentContent,
} from '../../../engines/word/index'

/**
 * WordEditorController (TASK-07B): nạp nội dung DOCX đã lưu
 * và autosave các thay đổi của Tiptap Editor về
 * DocumentContentRepository. Framework-free (cùng khuôn
 * PdfViewerController) — editor chỉ việc: open() lấy nội
 * dung ban đầu, bindEditor() đăng ký hàm đọc JSON hiện tại,
 * markChanged() sau mỗi lần sửa.
 *
 * CHỐNG RACE (bài học TASK-06F-A — dùng GENERATION COUNTER):
 * - Mọi markChanged tăng `changeGeneration`.
 * - saveNow() chụp (snapshot nội dung, generation) tại thời
 *   điểm bắt đầu; ghi xong chỉ nâng `savedGeneration` tới
 *   ĐÚNG generation đã chụp. Thay đổi xảy ra TRONG lúc ghi
 *   có generation lớn hơn → vẫn dirty, được lưu ở vòng sau.
 * - Các lần ghi được NỐI TIẾP tuyệt đối (một `inflight` duy
 *   nhất; snapshot đọc tại lúc bắt đầu ghi) → lần ghi cũ
 *   không bao giờ chạy sau/ghi đè nội dung mới hơn.
 * - flush()/close() lặp cho tới khi hết dirty; ghi lỗi →
 *   state 'error', generation bẩn GIỮ NGUYÊN (không mất
 *   thay đổi), flush ném lỗi để tầng UI không cho rời đi
 *   trong im lặng.
 */

export type WordSaveState = 'saved' | 'dirty' | 'saving' | 'error'

export type WordEditorErrorKind =
  | 'missing-content'
  | 'invalid-content'
  | 'unsupported-version'
  | 'load-failed'

const LOAD_MESSAGES: Record<WordEditorErrorKind, string> = {
  'missing-content':
    'Tài liệu này chưa có nội dung đã chuyển đổi nên chưa mở để sửa được. File gốc vẫn còn nguyên trong thư viện.',
  'invalid-content':
    'Nội dung đã lưu của tài liệu này không hợp lệ nên WebScribble không mở để sửa, nhằm tránh ghi đè dữ liệu cũ.',
  'unsupported-version':
    'Nội dung của tài liệu này được lưu bởi phiên bản WebScribble mới hơn. Hãy cập nhật ứng dụng để mở lại.',
  'load-failed': 'Không đọc được nội dung của tài liệu. Hãy thử lại.',
}

export class WordEditorError extends Error {
  readonly kind: WordEditorErrorKind
  readonly userMessage: string

  constructor(kind: WordEditorErrorKind, options: { cause?: unknown } = {}) {
    super(`Word editor error (${kind}).`)
    this.name = 'WordEditorError'
    this.kind = kind
    this.userMessage = LOAD_MESSAGES[kind]
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export interface WordEditorScheduler {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultScheduler: WordEditorScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface WordEditorControllerDeps {
  contents: DocumentContentRepository
  /** Thời gian chờ yên trước khi tự lưu (mặc định 800 ms). */
  debounceMs?: number
  scheduler?: WordEditorScheduler
}

export class WordEditorController {
  private readonly contents: DocumentContentRepository
  private readonly debounceMs: number
  private readonly scheduler: WordEditorScheduler

  private documentId: string | null = null
  private readContent: (() => WordDocumentContent) | null = null
  private changeGeneration = 0
  private savedGeneration = 0
  private state: WordSaveState = 'saved'
  private lastError: string | null = null
  private timer: unknown = null
  private inflight: Promise<void> | null = null
  private closed = false
  private readonly listeners = new Set<() => void>()

  constructor(deps: WordEditorControllerDeps) {
    this.contents = deps.contents
    this.debounceMs = deps.debounceMs ?? 800
    this.scheduler = deps.scheduler ?? defaultScheduler
  }

  /** Còn thay đổi chưa được ghi xuống IndexedDB hay không. */
  get hasChanges(): boolean {
    return this.changeGeneration > this.savedGeneration
  }

  get saveState(): WordSaveState {
    return this.state
  }

  get saveError(): string | null {
    return this.lastError
  }

  /** Đăng ký nhận thông báo đổi trạng thái lưu (cho React). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Snapshot dạng chuỗi cho useSyncExternalStore. */
  getSnapshot = (): string => `${this.state}|${this.lastError ?? ''}`

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  /**
   * Nạp nội dung ban đầu của một tài liệu. Không có record,
   * record không hợp lệ, hay version mới hơn → WordEditorError
   * rõ ràng; tuyệt đối không tạo nội dung thay thế.
   */
  async open(documentId: string): Promise<WordDocumentContent> {
    this.documentId = documentId
    this.changeGeneration = 0
    this.savedGeneration = 0
    this.state = 'saved'
    this.lastError = null
    this.closed = false
    let record
    try {
      record = await this.contents.getContent(documentId)
    } catch (cause) {
      if (cause instanceof UnsupportedContentVersionError) {
        throw new WordEditorError('unsupported-version', { cause })
      }
      throw new WordEditorError('load-failed', { cause })
    }
    if (record === undefined) throw new WordEditorError('missing-content')
    const validation = validateWordContent(record.content)
    if (!validation.valid) {
      throw new WordEditorError('invalid-content', {
        cause: new Error(validation.errors.join('; ')),
      })
    }
    return record.content as WordDocumentContent
  }

  /** Đăng ký hàm đọc JSON hiện tại từ editor (sau khi editor sẵn sàng). */
  bindEditor(readContent: () => WordDocumentContent): void {
    this.readContent = readContent
  }

  /** Editor báo có thay đổi: tăng generation + hẹn giờ autosave. */
  markChanged(): void {
    if (this.closed || this.documentId === null) return
    this.changeGeneration += 1
    if (this.state !== 'saving') {
      this.state = 'dirty'
      this.notify()
    }
    this.schedule()
  }

  private schedule(): void {
    this.cancelTimer()
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null
      void this.saveNow().catch(() => undefined)
    }, this.debounceMs)
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Lưu ngay nếu đang bẩn. Đang có lần ghi khác chạy → trả về
   * chính promise đó (không ghi song song). Lỗi → state
   * 'error', giữ nguyên dirty, và promise reject.
   */
  saveNow(): Promise<void> {
    if (this.inflight !== null) return this.inflight
    if (!this.hasChanges || this.readContent === null || this.documentId === null) {
      return Promise.resolve()
    }
    const documentId = this.documentId
    const generationAtSnapshot = this.changeGeneration
    const snapshot = this.readContent()
    this.state = 'saving'
    this.notify()
    const run = (async () => {
      try {
        await this.contents.saveContent({ documentId, content: snapshot })
        this.savedGeneration = Math.max(this.savedGeneration, generationAtSnapshot)
        this.lastError = null
        this.state = this.hasChanges ? 'dirty' : 'saved'
        if (this.hasChanges && !this.closed) this.schedule()
      } catch (cause) {
        this.state = 'error'
        this.lastError = 'Không lưu được thay đổi vào bộ nhớ của trình duyệt.'
        throw cause
      } finally {
        if (this.inflight === run) this.inflight = null
        this.notify()
      }
    })()
    this.inflight = run
    return run
  }

  /**
   * Chờ cho tới khi mọi thay đổi đã ghi xong. Ghi lỗi →
   * reject (dirty còn nguyên) để caller quyết định, không
   * bao giờ bỏ thay đổi trong im lặng.
   */
  async flush(): Promise<void> {
    this.cancelTimer()
    while (this.hasChanges || this.inflight !== null) {
      if (this.inflight !== null) {
        await this.inflight
        continue
      }
      await this.saveNow()
    }
  }

  /** Đóng editor: flush toàn bộ thay đổi còn lại trước. */
  async close(): Promise<void> {
    this.closed = true
    await this.flush()
  }
}
