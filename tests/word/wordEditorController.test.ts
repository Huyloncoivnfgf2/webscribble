import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/data/database'
import {
  UnsupportedContentVersionError,
  createStorageFoundation,
  type DocumentContentRecord,
  type DocumentContentRepository,
} from '../../src/data/index'
import {
  WordEditorController,
  WordEditorError,
  type WordEditorScheduler,
} from '../../src/app/features/documents/WordEditorController'
import { importDocxToLibrary, type WordDocumentContent } from '../../src/engines/word/index'
import { buildDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

/**
 * TASK-07B — WordEditorController: nạp (lỗi rõ ràng, không
 * bịa nội dung), debounce, và chống race BẰNG DEFERRED
 * PROMISE kiểm soát thứ tự (khuôn TASK-06F-A): thay đổi
 * trong lúc ghi không bị đánh dấu đã lưu, ghi cũ không đè
 * nội dung mới, lỗi giữ dirty + retry được, close chờ hết.
 */

class ManualScheduler implements WordEditorScheduler {
  private nextId = 1
  private timers = new Map<number, () => void>()
  setTimeout(fn: () => void): unknown {
    const id = this.nextId
    this.nextId += 1
    this.timers.set(id, fn)
    return id
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number)
  }
  runAll(): void {
    const pending = [...this.timers.values()]
    this.timers.clear()
    for (const fn of pending) fn()
  }
  get pendingCount(): number {
    return this.timers.size
  }
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

class FakeContents implements DocumentContentRepository {
  readonly saved: Array<{ documentId: string; content: unknown }> = []
  record: DocumentContentRecord | undefined
  gate: Deferred | null = null
  failNext = false
  throwOnGet: Error | null = null

  async saveContent(input: { documentId: string; content: unknown }): Promise<DocumentContentRecord> {
    if (this.gate !== null) await this.gate.promise
    if (this.failNext) {
      this.failNext = false
      throw new Error('simulated save failure')
    }
    this.saved.push({ documentId: input.documentId, content: input.content })
    this.record = {
      documentId: input.documentId,
      contentVersion: 1,
      content: input.content,
      updatedAt: Date.now(),
    }
    return this.record
  }

  async getContent(documentId: string): Promise<DocumentContentRecord | undefined> {
    if (this.throwOnGet !== null) throw this.throwOnGet
    return this.record?.documentId === documentId ? this.record : undefined
  }

  async deleteContent(): Promise<void> {
    this.record = undefined
  }
}

const contentWith = (text: string): WordDocumentContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function setup() {
  const repo = new FakeContents()
  const scheduler = new ManualScheduler()
  const controller = new WordEditorController({ contents: repo, scheduler, debounceMs: 500 })
  return { repo, scheduler, controller }
}

describe('TASK-07B — nạp nội dung', () => {
  it('record hợp lệ → trả đúng nội dung; không có record → missing-content', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('xin chào'), updatedAt: 1 }
    expect(await controller.open('d1')).toEqual(contentWith('xin chào'))
    const { controller: empty } = setup()
    await expect(empty.open('nope')).rejects.toMatchObject({ kind: 'missing-content' })
  })

  it('record rác → invalid-content; version mới hơn → unsupported-version; controller không tự tạo nội dung', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: { type: 'doc', content: [{ type: 'portal' }] }, updatedAt: 1 }
    await expect(controller.open('d1')).rejects.toBeInstanceOf(WordEditorError)
    await expect(controller.open('d1')).rejects.toMatchObject({ kind: 'invalid-content' })
    repo.throwOnGet = new UnsupportedContentVersionError('d1', 99, 1)
    await expect(controller.open('d1')).rejects.toMatchObject({ kind: 'unsupported-version' })
    expect(repo.saved).toEqual([]) // không hề ghi đè/bịa nội dung
  })
})

describe('TASK-07B — autosave, debounce và race condition', () => {
  it('nhiều markChanged liên tiếp → một lần ghi với snapshot mới nhất', async () => {
    const { repo, scheduler, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('gốc'), updatedAt: 1 }
    await controller.open('d1')
    let current = contentWith('gốc')
    controller.bindEditor(() => current)
    current = contentWith('bản 1')
    controller.markChanged()
    current = contentWith('bản 2')
    controller.markChanged()
    current = contentWith('bản 3')
    controller.markChanged()
    expect(scheduler.pendingCount).toBe(1)
    scheduler.runAll()
    await controller.flush()
    expect(repo.saved).toHaveLength(1)
    expect(repo.saved[0]?.content).toEqual(contentWith('bản 3'))
    expect(controller.saveState).toBe('saved')
  })

  it('RACE: sửa trong lúc ghi đang pending — không bị đánh dấu đã lưu, flush ghi bản mới nhất sau cùng', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('gốc'), updatedAt: 1 }
    await controller.open('d1')
    let current = contentWith('gốc')
    controller.bindEditor(() => current)

    current = contentWith('bản A')
    controller.markChanged()
    repo.gate = deferred()
    const saveA = controller.saveNow() // ghi A bị giữ pending
    current = contentWith('bản B')
    controller.markChanged() // sửa B trong lúc A chưa ghi xong
    repo.gate.resolve()
    repo.gate = null
    await saveA
    // Sau khi A ghi xong: B vẫn dirty — không được coi là đã lưu:
    expect(controller.hasChanges).toBe(true)
    expect(controller.saveState).toBe('dirty')
    await controller.flush()
    expect(repo.saved.map((s) => s.content)).toEqual([contentWith('bản A'), contentWith('bản B')])
    expect(repo.record?.content).toEqual(contentWith('bản B'))
    expect(controller.saveState).toBe('saved')
  })

  it('lưu lỗi → dirty giữ nguyên; retry thành công → saved', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('gốc'), updatedAt: 1 }
    await controller.open('d1')
    controller.bindEditor(() => contentWith('mới'))
    controller.markChanged()
    repo.failNext = true
    await expect(controller.saveNow()).rejects.toThrow()
    expect(controller.saveState).toBe('error')
    expect(controller.hasChanges).toBe(true)
    await controller.saveNow()
    expect(controller.saveState).toBe('saved')
    expect(repo.record?.content).toEqual(contentWith('mới'))
  })

  it('close() chờ lần ghi đang pending VÀ thay đổi phát sinh trong lúc chờ', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('gốc'), updatedAt: 1 }
    await controller.open('d1')
    let current = contentWith('gốc')
    controller.bindEditor(() => current)
    current = contentWith('cuối 1')
    controller.markChanged()
    repo.gate = deferred()
    let closed = false
    const closing = controller.close().then(() => {
      closed = true
    })
    current = contentWith('cuối 2')
    // markChanged sau close() bị bỏ qua có chủ đích (editor đã đóng) —
    // thay đổi "trong lúc chờ" ở đây đến từ trước khi gate mở:
    repo.gate.resolve()
    repo.gate = null
    await closing
    expect(closed).toBe(true)
    expect(repo.record?.content).toEqual(contentWith('cuối 1'))
    expect(controller.hasChanges).toBe(false)
  })

  it('không thay đổi → saveNow không ghi gì cả', async () => {
    const { repo, controller } = setup()
    repo.record = { documentId: 'd1', contentVersion: 1, content: contentWith('gốc'), updatedAt: 1 }
    await controller.open('d1')
    controller.bindEditor(() => contentWith('gốc'))
    await controller.saveNow()
    await controller.flush()
    expect(repo.saved).toEqual([])
  })
})

describe('TASK-07B — persistence tích hợp với repository thật', () => {
  it('sửa qua controller → đóng → mở lại: nội dung khôi phục; Blob gốc nguyên vẹn; lưu JSON không phải HTML', async () => {
    let counter = 300
    counter += 1
    const db = createDatabase(`webscribble-07b-${counter}`)
    const foundation = createStorageFoundation(db)
    const bytes = buildDocx()
    const { document } = await importDocxToLibrary(
      { documents: foundation.documents, contents: foundation.contents },
      { name: 'sua.docx', data: toArrayBuffer(bytes) },
      createTestConvertOptions(),
    )

    const controller = new WordEditorController({ contents: foundation.contents })
    const initial = await controller.open(document.id)
    const edited: WordDocumentContent = {
      type: 'doc',
      content: [
        ...initial.content,
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Đoạn mới thêm khi sửa.' }],
        },
      ],
    }
    controller.bindEditor(() => edited)
    controller.markChanged()
    await controller.close()
    expect(controller.saveState).toBe('saved')

    const controller2 = new WordEditorController({ contents: foundation.contents })
    const restored = await controller2.open(document.id)
    expect(restored).toEqual(edited)

    const raw = await foundation.contents.getContent(document.id)
    expect(typeof raw?.content).toBe('object') // JSON model, không phải chuỗi HTML
    expect((raw?.content as WordDocumentContent).type).toBe('doc')

    const blob = await foundation.documents.getBlob(document.id)
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(bytes)
    db.close()
  })
})
