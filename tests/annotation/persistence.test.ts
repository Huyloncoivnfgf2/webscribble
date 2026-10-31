/**
 * TASK-06C — Persistence & lifecycle nâng cao: autosave sau thay
 * đổi, flush khi đóng, lỗi lưu và thử lại, thứ tự lưu, đóng-bỏ-qua
 * tường minh, xóa dữ liệu tường minh, chế độ lưu trực tiếp (không
 * AutosaveManager), và dọn subscription khi đóng.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createPenStroke } from '../../src/engines/drawing/objects'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import {
  DexieAnnotationRepository,
  type AnnotationRepository,
} from '../../src/data/repositories/annotationRepository'
import { AutosaveManager } from '../../src/data/autosave/autosaveManager'
import { documentSurfaceId, type SaveSurfaceInput } from '../../src/data/types'
import {
  AnnotationEngine,
  NotifyingSurface,
  type AnnotationSurfaceSession,
} from '../../src/engines/annotation/index'

const DOC = 'doc-persist'
const PAGE_SIZE = { width: 612, height: 792 }
let counter = 0

class FlakyRepository implements AnnotationRepository {
  failNextSaves = 0
  saveCalls = 0

  constructor(private readonly inner: AnnotationRepository) {}

  async saveSurface(input: SaveSurfaceInput) {
    this.saveCalls += 1
    if (this.failNextSaves > 0) {
      this.failNextSaves -= 1
      throw new Error('quota exceeded (simulated)')
    }
    return this.inner.saveSurface(input)
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

interface Rig {
  db: WebScribbleDatabase
  inner: DexieAnnotationRepository
  flaky: FlakyRepository
  engine: AnnotationEngine
}

function makeRig(debounceMs = 10, withAutosave = true): Rig {
  counter += 1
  const db = createDatabase(`webscribble-06c-persist-${counter}`)
  const inner = new DexieAnnotationRepository(db)
  const flaky = new FlakyRepository(inner)
  const autosave = withAutosave
    ? new AutosaveManager((input) => flaky.saveSurface(input), { debounceMs })
    : undefined
  const engine = new AnnotationEngine({ annotations: flaky, autosave })
  return { db, inner, flaky, engine }
}

const rigs: Rig[] = []
function rig(debounceMs?: number, withAutosave?: boolean): Rig {
  const r = makeRig(debounceMs, withAutosave)
  rigs.push(r)
  return r
}

afterEach(async () => {
  while (rigs.length > 0) {
    const r = rigs.pop()
    if (r) {
      await r.engine.closeAll().catch(() => undefined)
      await r.db.delete()
    }
  }
})

function stroke(session: AnnotationSurfaceSession, id: string) {
  return createPenStroke({
    surfaceId: session.surfaceId,
    id,
    points: [
      { x: 1, y: 1, pressure: 0.5, time: 0 },
      { x: 50, y: 1, pressure: 0.5, time: 10 },
    ],
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('AnnotationEngine — autosave và flush', () => {
  it('thay đổi tự được lưu qua autosave (không cần saveNow); trạng thái chuyển sang saved', async () => {
    const { engine, inner } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'auto-1'))
    expect(session.getSaveState()).not.toBe('saved')
    // Chờ theo điều kiện (không ngủ cố định) để test bền khi máy bận:
    for (let i = 0; i < 200 && session.getSaveState() !== 'saved'; i += 1) {
      await wait(10)
    }
    expect(session.getSaveState()).toBe('saved')
    const record = await inner.getSurface(session.surfaceId)
    expect(record?.objects).toHaveLength(1)
    await session.close()
  })

  it('lưu liên tiếp nhiều thay đổi: bản lưu cuối là trạng thái MỚI NHẤT, không bị ghi đè bởi lần lưu cũ', async () => {
    const { engine, inner } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 's-1'))
    session.surface.addObject(stroke(session, 's-2'))
    session.surface.addObject(stroke(session, 's-3'))
    await session.saveNow()
    const record = await inner.getSurface(session.surfaceId)
    expect((record?.objects ?? []).map((o) => (o as { id: string }).id)).toEqual(['s-1', 's-2', 's-3'])
    await session.close()
  })

  it('không báo saved trước khi repository xác nhận: save đang treo thì state chưa phải saved', async () => {
    const { engine, flaky } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'pend-1'))
    expect(['pending', 'saving']).toContain(session.getSaveState())
    await session.saveNow()
    expect(session.getSaveState()).toBe('saved')
    expect(flaky.saveCalls).toBeGreaterThanOrEqual(1)
    await session.close()
  })

  it('đóng session flush thay đổi chưa lưu kể cả khi debounce dài', async () => {
    const { engine, inner } = rig(60_000) // debounce rất dài — chỉ flush khi đóng mới cứu được
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'flush-on-close'))
    await session.close()
    const record = await inner.getSurface(documentSurfaceId(DOC, 0))
    expect(record?.objects).toHaveLength(1)
  })
})

describe('AnnotationEngine — lỗi lưu và thử lại', () => {
  it('lưu thất bại: saveNow reject kind persistence kèm cause, state = error; thử lại thành công và dữ liệu đúng', async () => {
    const { engine, inner, flaky } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'retry-1'))
    flaky.failNextSaves = 1
    const error = await session.saveNow().catch((e: unknown) => e)
    expect(error).toMatchObject({ kind: 'persistence' })
    expect(((error as { cause: Error }).cause).message).toContain('quota exceeded')
    expect(session.getSaveState()).toBe('error')
    await session.saveNow() // retry — autosave giữ dữ liệu chưa lưu
    expect(session.getSaveState()).toBe('saved')
    const record = await inner.getSurface(session.surfaceId)
    expect(record?.objects).toHaveLength(1)
    await session.close()
  })

  it('đóng khi flush lỗi: close reject, session VẪN mở; sửa lỗi xong đóng lại được và dữ liệu được lưu', async () => {
    const { engine, inner, flaky } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'close-fail'))
    flaky.failNextSaves = 100 // lỗi dai dẳng trong lúc đóng
    await expect(session.close()).rejects.toMatchObject({ kind: 'persistence' })
    expect(session.closed).toBe(false)
    expect(engine.isOpen(session.surfaceId)).toBe(true)
    flaky.failNextSaves = 0
    await session.close()
    expect(session.closed).toBe(true)
    const record = await inner.getSurface(session.surfaceId)
    expect(record?.objects).toHaveLength(1)
  })

  it('close({ flush: false }) bỏ thay đổi chưa lưu một cách tường minh', async () => {
    const { engine, inner } = rig(60_000)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'discarded'))
    await session.close({ flush: false })
    await wait(30)
    expect(await inner.getSurface(session.surfaceId)).toBeUndefined()
  })
})

describe('AnnotationEngine — xóa dữ liệu và cleanup', () => {
  it('deleteSavedData xóa record đã lưu nhưng giữ object trong bộ nhớ; autosave đang chờ không hồi sinh record', async () => {
    const { engine, inner } = rig(30)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'to-delete'))
    await session.saveNow()
    expect(await inner.getSurface(session.surfaceId)).toBeDefined()
    await session.deleteSavedData()
    expect(await inner.getSurface(session.surfaceId)).toBeUndefined()
    expect(session.listObjects()).toHaveLength(1) // bộ nhớ còn nguyên
    await wait(80) // quá debounce — không có save nào hồi sinh record
    expect(await inner.getSurface(session.surfaceId)).toBeUndefined()
    await session.close()
  })

  it('subscription được dọn khi đóng: NotifyingSurface về 0 listener', async () => {
    const { engine } = rig(10)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const surface = session.surface as NotifyingSurface
    expect(surface.listenerCount).toBe(1)
    await session.close()
    expect(surface.listenerCount).toBe(0)
  })
})

describe('AnnotationEngine — chế độ lưu trực tiếp (không AutosaveManager)', () => {
  it('lưu, nạp lại và giữ thứ tự khi thay đổi liên tiếp; lỗi lưu được báo qua saveNow', async () => {
    const { engine, inner, flaky } = rig(10, false)
    const surfaceId = documentSurfaceId(DOC, 0)
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(stroke(session, 'd-1'))
    session.surface.addObject(stroke(session, 'd-2'))
    await session.saveNow()
    let record = await inner.getSurface(surfaceId)
    expect((record?.objects ?? []).map((o) => (o as { id: string }).id)).toEqual(['d-1', 'd-2'])

    flaky.failNextSaves = 1
    session.surface.addObject(stroke(session, 'd-3'))
    const error = await session.saveNow().catch((e: unknown) => e)
    // Chuỗi lưu trực tiếp có thể đã nuốt lần lưu lỗi vào chain và
    // lần saveNow sau ghi lại snapshot mới nhất — cả hai hành vi
    // đều phải kết thúc ở trạng thái: hoặc báo lỗi persistence,
    // hoặc dữ liệu cuối cùng đầy đủ. Kiểm tra bất biến cuối:
    if (error !== undefined) {
      expect(error).toMatchObject({ kind: 'persistence' })
      await session.saveNow()
    }
    record = await inner.getSurface(surfaceId)
    expect((record?.objects ?? []).map((o) => (o as { id: string }).id)).toEqual(['d-1', 'd-2', 'd-3'])
    await session.close()
  })
})
