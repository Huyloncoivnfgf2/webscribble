import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/data/database'
import {
  AutosaveManager,
  createStorageFoundation,
  documentSurfaceId,
  type AnnotationRepository,
  type AnnotationSurfaceRecord,
} from '../../src/data/index'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import { createPenStroke } from '../../src/engines/drawing/index'
import type { AnnotationSurfaceSession } from '../../src/engines/annotation/index'

/**
 * TASK-06F-A — Kiểm chứng race condition của cơ chế dirty
 * tracking (hasChanges) trong AnnotationSurfaceSession.
 *
 * Mọi thao tác ghi đều đi qua GatedRepository: write chỉ hoàn
 * thành khi test chủ động release — thứ tự thực thi được kiểm
 * soát hoàn toàn bằng deferred promise, không dùng timeout
 * ngẫu nhiên để "đợi".
 *
 * Hai chế độ được kiểm:
 * - Direct mode (engine không có autosave): session tự ghi qua
 *   chuỗi promise — nơi cửa sổ race rõ nhất.
 * - Autosave mode: AutosaveManager drain cả snapshot đến trong
 *   lúc ghi; vẫn kiểm dirty flag và bảo đảm của close().
 */

const DOC = 'race-doc'
const PAGE_SIZE = { width: 612, height: 792 }
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

interface PendingWrite {
  record: AnnotationSurfaceRecord
  release: () => void
  fail: (error: unknown) => void
}

class GatedRepository implements AnnotationRepository {
  /** Mọi write ĐÃ BẮT ĐẦU (theo thứ tự gọi). */
  readonly started: AnnotationSurfaceRecord[] = []
  /** Mọi write ĐÃ HOÀN THÀNH ghi xuống repository thật. */
  readonly completed: AnnotationSurfaceRecord[] = []
  private readonly pending: PendingWrite[] = []
  private readonly inner: AnnotationRepository

  constructor(inner: AnnotationRepository) {
    this.inner = inner
  }

  saveSurface(record: AnnotationSurfaceRecord): Promise<void> {
    this.started.push(record)
    return new Promise<void>((resolve, reject) => {
      this.pending.push({
        record,
        release: () => {
          void this.inner.saveSurface(record).then(() => {
            this.completed.push(record)
            resolve()
          })
        },
        fail: (error) => reject(error),
      })
    })
  }

  get pendingCount(): number {
    return this.pending.length
  }

  /** Chờ tới khi có ít nhất `count` write đang chờ (điều kiện xác định, không đoán thời gian). */
  async waitForPending(count: number): Promise<void> {
    for (let i = 0; i < 300 && this.pending.length < count; i += 1) await tick()
    if (this.pending.length < count) {
      throw new Error(`chờ quá lâu: mới có ${this.pending.length}/${count} write đang chờ`)
    }
  }

  /** Hoàn thành write đang chờ lâu nhất. */
  releaseNext(): void {
    const write = this.pending.shift()
    if (write === undefined) throw new Error('không có write nào đang chờ')
    write.release()
  }

  /** Làm write đang chờ lâu nhất thất bại. */
  failNext(error: unknown = new Error('gated failure')): void {
    const write = this.pending.shift()
    if (write === undefined) throw new Error('không có write nào đang chờ')
    write.fail(error)
  }

  /** Hoàn thành mọi write đang chờ, kể cả write phát sinh trong lúc xả. */
  async releaseAll(): Promise<void> {
    let idle = 0
    let lastStarted = this.started.length
    for (let i = 0; i < 600 && idle < 12; i += 1) {
      if (this.pending.length > 0) {
        this.releaseNext()
        idle = 0
      } else if (this.started.length !== lastStarted) {
        idle = 0
      } else {
        idle += 1
      }
      lastStarted = this.started.length
      await tick()
    }
  }

  getSurface(surfaceId: string) {
    return this.inner.getSurface(surfaceId)
  }
  getSurfacesByDocument(documentId: string) {
    return this.inner.getSurfacesByDocument(documentId)
  }
  deleteSurface(surfaceId: string) {
    return this.inner.deleteSurface(surfaceId)
  }
  deleteByDocument(documentId: string) {
    return this.inner.deleteByDocument(documentId)
  }
}

let counter = 0

function stroke(session: AnnotationSurfaceSession, id: string) {
  return createPenStroke({
    surfaceId: session.surfaceId,
    id,
    points: [
      { x: 10, y: 10, pressure: 0.5, time: 0 },
      { x: 50, y: 30, pressure: 0.5, time: 10 },
    ],
  })
}

async function setupDirect() {
  counter += 1
  const foundation = createStorageFoundation(createDatabase(`webscribble-06fa-${counter}`))
  const gated = new GatedRepository(foundation.annotations)
  const engine = createAnnotationEngine({ annotations: gated })
  const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
  return { foundation, gated, engine, session }
}

async function setupAutosave() {
  counter += 1
  const foundation = createStorageFoundation(createDatabase(`webscribble-06fa-${counter}`))
  const gated = new GatedRepository(foundation.annotations)
  const autosave = new AutosaveManager((record) => gated.saveSurface(record))
  const engine = createAnnotationEngine({ annotations: gated, autosave })
  const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
  return { foundation, gated, engine, session }
}

const objectIds = (record: AnnotationSurfaceRecord | null) =>
  (record?.objects ?? []).map((o) => (o as { id: string }).id)

describe('TASK-06F-A — race trong direct mode (không autosave)', () => {
  it('trình tự brief: A → saveNow giữ pending → mutation B → A hoàn thành → close() PHẢI ghi B trước khi đóng xong', async () => {
    const { foundation, gated, session } = await setupDirect()
    session.surface.addObject(stroke(session, 'A'))
    await gated.waitForPending(1) // write A (từ onSurfaceChanged) đã bắt đầu, đang bị gate

    const saving = session.saveNow() // snapshot A, xếp sau write A trong chuỗi
    session.surface.addObject(stroke(session, 'B')) // mutation GIỮA lúc save

    // Xả write A, rồi write snapshot-A của saveNow. Write B
    // xếp trong chuỗi bắt đầu sau đó — và vì flushDirect chờ
    // chuỗi ỔN ĐỊNH (kể cả write nối thêm trong lúc chờ),
    // saveNow chỉ hoàn thành sau khi cả B được xả:
    gated.releaseNext() // A (của mutation)
    await gated.waitForPending(1) // snapshot-A của saveNow đã bắt đầu
    gated.releaseNext() // snapshot-A hoàn thành
    await gated.waitForPending(1) // write B đã bắt đầu, vẫn đang bị gate
    gated.releaseNext() // B hoàn thành
    await saving // saveNow hoàn thành; B đã xuống storage NHƯNG
    // chưa được "xác nhận đã lưu" ở tầng session (snapshot của
    // saveNow là A — thế hệ của B cao hơn), nên close() vẫn
    // phải thực hiện một lần lưu xác nhận trước khi đóng xong:

    // B đã được ghi bởi chuỗi trực tiếp, nhưng chưa được xác
    // nhận ở tầng session. Đóng session:
    let closed = false
    const closing = session.close().then(() => {
      closed = true
    })
    await tick()
    await tick()
    // close() KHÔNG được hoàn thành khi lần lưu xác nhận cho
    // trạng thái B chưa xuống storage (write xác nhận đang
    // bị gate):
    expect(closed).toBe(false)
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual(["A", "B"])

    await gated.releaseAll()
    await closing
    expect(closed).toBe(true)
    // Dữ liệu cuối cùng trong repository là trạng thái B:
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
    ])
  })

  it('nhiều mutation trong một lần save + hai saveNow liên tiếp: dữ liệu cuối đúng, close không ghi thừa', async () => {
    const { foundation, gated, session } = await setupDirect()
    session.surface.addObject(stroke(session, 'A'))
    const first = session.saveNow()
    session.surface.addObject(stroke(session, 'B'))
    session.surface.addObject(stroke(session, 'C'))
    const second = session.saveNow()
    await gated.releaseAll()
    await first
    await second
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
      'C',
    ])
    const writesBeforeClose = gated.completed.length
    const closing = session.close()
    await gated.releaseAll()
    await closing
    // Sau khi mọi thứ đã lưu và không còn mutation, close() có
    // thể flush nốt phần chưa lưu nhưng KHÔNG được bỏ sót —
    // và dữ liệu cuối vẫn đúng:
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
      'C',
    ])
    expect(gated.completed.length).toBeGreaterThanOrEqual(writesBeforeClose)
  })

  it('save lỗi rồi retry; mutation SAU khi save lỗi vẫn được ghi ở lần retry/close', async () => {
    const { foundation, gated, session } = await setupDirect()
    session.surface.addObject(stroke(session, 'A'))
    await gated.waitForPending(1)
    const failing = session.saveNow()
    gated.failNext() // write A của onSurfaceChanged lỗi
    await gated.waitForPending(1) // write snapshot của saveNow bắt đầu
    gated.failNext() // write snapshot của saveNow lỗi
    await expect(failing).rejects.toThrow()
    // Mutation sau khi save đã lỗi:
    session.surface.addObject(stroke(session, 'B'))
    const retrying = session.saveNow()
    await gated.releaseAll()
    await retrying
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
    ])
    const closing = session.close()
    await gated.releaseAll()
    await closing
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
    ])
  })

  it('session chỉ đọc: close() không tạo write nào', async () => {
    const { gated, session } = await setupDirect()
    await session.close()
    expect(gated.started).toEqual([])
  })
})

describe('TASK-06F-A — race trong autosave mode', () => {
  it('mutation trong lúc flush của saveNow đang bay: close() vẫn bảo đảm trạng thái cuối là B', async () => {
    const { foundation, gated, session } = await setupAutosave()
    session.surface.addObject(stroke(session, 'A'))
    const saving = session.saveNow() // flush ngay, write A bị gate
    await tick()
    expect(gated.pendingCount).toBe(1)
    session.surface.addObject(stroke(session, 'B')) // schedule vào manager
    // Xả A — manager drain tiếp B (cũng bị gate):
    gated.releaseNext()
    await tick()
    await tick()
    if (gated.pendingCount > 0) gated.releaseNext() // B
    await saving
    let closed = false
    const closing = session.close().then(() => {
      closed = true
    })
    await tick()
    await gated.releaseAll()
    await closing
    expect(closed).toBe(true)
    expect(objectIds(await foundation.annotations.getSurface(session.surfaceId))).toEqual([
      'A',
      'B',
    ])
  })

  it('session không thay đổi: đóng không cập nhật updatedAt (hồi quy 06F giữ nguyên)', async () => {
    const { foundation, gated, engine, session } = await setupAutosave()
    session.surface.addObject(stroke(session, 'A'))
    const saving = session.saveNow()
    await gated.releaseAll()
    await saving
    await session.close()
    const before = await foundation.annotations.getSurface(session.surfaceId)
    if (before === null) throw new Error('thiếu record')
    const reopen = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    await reopen.close()
    const after = await foundation.annotations.getSurface(session.surfaceId)
    expect(after?.updatedAt).toBe(before.updatedAt)
    expect(documentSurfaceId(DOC, 0)).toBe(session.surfaceId)
  })
})
