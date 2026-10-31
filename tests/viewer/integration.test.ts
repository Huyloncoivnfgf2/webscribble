import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { PdfViewerController } from '../../src/app/features/documents/PdfViewerController'
import { createDatabase } from '../../src/data/database'
import {
  AutosaveManager,
  createStorageFoundation,
  documentSurfaceId,
  type AnnotationRepository,
  type AnnotationSurfaceRecord,
  type StorageFoundation,
} from '../../src/data/index'
import {
  createAnnotationEngine,
  type AnnotationEngine,
} from '../../src/engines/annotation/index'
import { createPenStroke } from '../../src/engines/drawing/index'
import type { PdfPageRenderResult, PdfPageRenderer } from '../../src/engines/pdf/index'
import { buildPdf } from '../pdf/fixtures'

/**
 * TASK-06F — Kiểm thử tích hợp tầng viewer: các đường biên
 * vòng đời (unmount giữa chừng, chuyển trang qua lại nhanh,
 * dữ liệu lưu hỏng, lưu thất bại + retry, đóng khi pending),
 * tính toàn vẹn storage (trùng import, xóa cascade, surfaceId).
 */

class RecordingContext {
  setTransform(): void {}
  clearRect(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  fill(): void {}
  stroke(): void {}
  ellipse(): void {}
  clip(): void {}
  fillText(): void {}
  measureText(): { width: number } {
    return { width: 10 }
  }
  setLineDash(): void {}
}

class FakeCanvas {
  width = 0
  height = 0
  style: { width: string; height: string } = { width: '', height: '' }
  private readonly ctx = new RecordingContext()
  private readonly listeners = new Map<string, Set<unknown>>()
  getContext(): RecordingContext {
    return this.ctx
  }
  addEventListener(type: string, fn: unknown): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(fn)
  }
  removeEventListener(type: string, fn: unknown): void {
    this.listeners.get(type)?.delete(fn)
  }
  listenerCount(): number {
    let n = 0
    for (const set of this.listeners.values()) n += set.size
    return n
  }
}

function fakeViewport(scale: number) {
  return {
    scale,
    rotation: 0,
    width: 612 * scale,
    height: 792 * scale,
    transform: [scale, 0, 0, -scale, 0, 792 * scale] as const,
    convertToViewportPoint: (x: number, y: number) => [x * scale, (792 - y) * scale] as const,
    convertToPdfPoint: (x: number, y: number) => [x / scale, 792 - y / scale] as const,
  }
}

class StubPdfRenderer {
  gate: Promise<void> | null = null
  async render(
    _handle: unknown,
    index: number,
    canvas: FakeCanvas,
    options?: { scale?: number },
  ): Promise<PdfPageRenderResult> {
    if (this.gate !== null) await this.gate
    const scale = options?.scale ?? 1
    canvas.width = Math.round(612 * scale)
    canvas.height = Math.round(792 * scale)
    canvas.style.width = `${612 * scale}px`
    canvas.style.height = `${792 * scale}px`
    const viewport = fakeViewport(scale)
    return {
      index,
      scale,
      rotation: 0,
      cssWidth: viewport.width,
      cssHeight: viewport.height,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      devicePixelRatio: 1,
      viewport: viewport as unknown as PdfPageRenderResult['viewport'],
    }
  }
  cancel(): void {}
  cancelAll(): void {}
  dispose(): void {}
  isRendering(): boolean {
    return false
  }
}

/** Repository bọc ngoài: saveSurface thất bại khi failuresLeft > 0. */
class FlakyAnnotations implements AnnotationRepository {
  failuresLeft = 0
  private readonly inner: AnnotationRepository
  constructor(inner: AnnotationRepository) {
    this.inner = inner
  }
  async saveSurface(record: AnnotationSurfaceRecord): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1
      throw new Error('simulated storage failure')
    }
    return this.inner.saveSurface(record)
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

let dbCounter = 100

interface Harness {
  foundation: StorageFoundation
  annotationEngine: AnnotationEngine
  controller: PdfViewerController
  annoCanvas: FakeCanvas
  stub: StubPdfRenderer
  docId: string
  flaky: FlakyAnnotations | null
}

async function setup(options: { useFlaky?: boolean } = {}): Promise<Harness> {
  dbCounter += 1
  const foundation = createStorageFoundation(createDatabase(`webscribble-06f-${dbCounter}`))
  const flaky = options.useFlaky ? new FlakyAnnotations(foundation.annotations) : null
  const annotations = flaky ?? foundation.annotations
  const autosave = new AutosaveManager((record) => annotations.saveSurface(record))
  const annotationEngine = createAnnotationEngine({ annotations, autosave })
  const stub = new StubPdfRenderer()
  const annoCanvas = new FakeCanvas()
  const controller = new PdfViewerController({
    documents: foundation.documents,
    annotationEngine,
    pdfRenderer: stub as unknown as PdfPageRenderer,
    requestFrame: (cb) => setTimeout(cb, 0) as unknown as number,
    cancelFrame: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  })
  controller.bindElements({
    pdfCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
    annotationCanvas: annoCanvas as unknown as HTMLCanvasElement,
    container: { clientWidth: 800, clientHeight: 600 },
  })
  const doc = await foundation.documents.create({
    name: 'integration.pdf',
    mimeType: 'application/pdf',
    blob: new Blob([buildPdf({ pageCount: 3 }) as BlobPart], { type: 'application/pdf' }),
  })
  return { foundation, annotationEngine, controller, annoCanvas, stub, docId: doc.id, flaky }
}

function stroke(surfaceId: string, id: string) {
  return createPenStroke({
    surfaceId,
    id,
    points: [
      { x: 10, y: 10, pressure: 0.5, time: 0 },
      { x: 60, y: 40, pressure: 0.5, time: 16 },
    ],
  })
}

function sessionOf(h: Harness, pageIndex: number) {
  const session = h.annotationEngine.getSession(documentSurfaceId(h.docId, pageIndex))
  if (session == null) throw new Error(`thiếu session trang ${pageIndex}`)
  return session
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('TASK-06F — vòng đời viewer ở các đường biên', () => {
  it('dispose NGAY khi openDocument vừa phát động: thao tác bị bỏ qua an toàn, không session nào mở', async () => {
    const h = await setup()
    const opening = h.controller.openDocument(h.docId)
    h.controller.dispose()
    await expect(opening).resolves.toBeUndefined()
    await sleep(50)
    expect(h.annotationEngine.openSurfaceIds()).toEqual([])
    expect(h.annoCanvas.listenerCount()).toBe(0)
  })

  it('dispose GIỮA lúc render trang: không ném lỗi, session được đóng, listener về 0', async () => {
    const h = await setup()
    let release!: () => void
    h.stub.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const opening = h.controller.openDocument(h.docId)
    // Chờ tới khi render đang bị chặn ở gate (session đã được tạo).
    for (let i = 0; i < 50 && h.annotationEngine.openSurfaceIds().length === 0; i += 1) {
      await sleep(10)
    }
    expect(h.annotationEngine.openSurfaceIds()).toHaveLength(1)
    h.controller.dispose()
    release()
    await expect(opening).resolves.toBeUndefined()
    await sleep(50)
    expect(h.annotationEngine.openSurfaceIds()).toEqual([])
    expect(h.annoCanvas.listenerCount()).toBe(0)
  })

  it('chuyển trang qua lại + vẽ tiếp: autosave cũ không ghi đè dữ liệu mới (cả hai nét đều còn)', async () => {
    const h = await setup()
    await h.controller.openDocument(h.docId)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'A'))
    await h.controller.goToPage(1)
    await h.controller.goToPage(0)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'B'))
    await h.controller.closeDocument()
    const saved = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    expect(saved?.objects.map((o) => (o as { id: string }).id)).toEqual(['A', 'B'])
  })

  it('đóng tài liệu NGAY khi còn pending save (chưa hết debounce): dữ liệu vẫn được flush đủ', async () => {
    const h = await setup()
    await h.controller.openDocument(h.docId)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'pending-1'))
    await h.controller.closeDocument()
    const saved = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    expect(saved?.objects).toHaveLength(1)
  })
})

describe('TASK-06F — dữ liệu hỏng và lưu thất bại', () => {
  it('annotation đã lưu KHÔNG hợp lệ: mở trang báo lỗi và bản ghi gốc không bị ghi đè', async () => {
    const h = await setup()
    const surfaceId = documentSurfaceId(h.docId, 0)
    const bogus: AnnotationSurfaceRecord = {
      surfaceId,
      documentId: h.docId,
      pageIndex: 0,
      objects: [{ totally: 'bogus' }],
      updatedAt: Date.now(),
      schemaVersion: 1,
    }
    await h.foundation.db.annotations.put(bogus)
    await h.controller.openDocument(h.docId)
    const snap = h.controller.getSnapshot()
    expect(snap.status).toBe('error')
    const after = await h.foundation.db.annotations.get(surfaceId)
    expect(after?.objects).toEqual([{ totally: 'bogus' }])
    h.controller.dispose()
  })

  it('lưu thất bại: trạng thái error hiện rõ; retrySave thành công sau khi hết lỗi; dữ liệu được ghi', async () => {
    const h = await setup({ useFlaky: true })
    const flaky = h.flaky
    if (flaky === null) throw new Error('thiếu flaky repository')
    await h.controller.openDocument(h.docId)
    flaky.failuresLeft = 2
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'retry-1'))
    await sleep(700) // autosave thử lần 1 → lỗi
    expect(h.controller.getSnapshot().saveState).toBe('error')
    await h.controller.retrySave() // lần 2 → vẫn lỗi, không ném ra ngoài
    expect(h.controller.getSnapshot().saveState).toBe('error')
    await h.controller.retrySave() // lần 3 → thành công
    expect(h.controller.getSnapshot().saveState).toBe('saved')
    const saved = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    expect(saved?.objects).toHaveLength(1)
    await h.controller.closeDocument()
  })

  it('đóng tài liệu khi lưu vẫn lỗi: closeDocument TỪ CHỐI và viewer giữ nguyên; hết lỗi thì đóng được', async () => {
    const h = await setup({ useFlaky: true })
    const flaky = h.flaky
    if (flaky === null) throw new Error('thiếu flaky repository')
    await h.controller.openDocument(h.docId)
    flaky.failuresLeft = Number.MAX_SAFE_INTEGER
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'stuck-1'))
    await sleep(700)
    expect(h.controller.getSnapshot().saveState).toBe('error')
    await expect(h.controller.closeDocument()).rejects.toThrow()
    // Viewer vẫn mở, session vẫn còn — dữ liệu chưa bị bỏ:
    expect(h.controller.getSnapshot().status).toBe('ready')
    expect(h.annotationEngine.isOpen(documentSurfaceId(h.docId, 0))).toBe(true)
    flaky.failuresLeft = 0
    await h.controller.closeDocument()
    expect(h.controller.getSnapshot().status).toBe('idle')
    const saved = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    expect(saved?.objects).toHaveLength(1)
  })
})

describe('TASK-06F — hồi quy: close() của session chỉ ghi khi có thay đổi', () => {
  it('mở xem rồi đóng (không vẽ): không tạo record nào cho trang', async () => {
    const h = await setup()
    await h.controller.openDocument(h.docId)
    await h.controller.goToPage(1)
    await h.controller.closeDocument()
    expect(await h.foundation.annotations.getSurfacesByDocument(h.docId)).toEqual([])
  })

  it('mở lại trang đã có annotation rồi đóng ngay: record giữ nguyên updatedAt (không ghi đè)', async () => {
    const h = await setup()
    await h.controller.openDocument(h.docId)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'keep-1'))
    await h.controller.closeDocument()
    const before = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    if (before === null) throw new Error('thiếu record sau lần đóng đầu')
    await sleep(30) // bảo đảm nếu bị ghi đè thì updatedAt phải khác
    await h.controller.openDocument(h.docId)
    await h.controller.closeDocument()
    const after = await h.foundation.annotations.getSurface(documentSurfaceId(h.docId, 0))
    expect(after?.updatedAt).toBe(before.updatedAt)
    expect(after?.objects).toHaveLength(1)
  })
})

describe('TASK-06F — toàn vẹn storage', () => {
  it('import trùng cùng một file: hai document độc lập, annotation không lẫn nhau', async () => {
    const h = await setup()
    const bytes = buildPdf({ pageCount: 3 })
    const second = await h.foundation.documents.create({
      name: 'integration-copy.pdf',
      mimeType: 'application/pdf',
      blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    })
    expect(second.id).not.toBe(h.docId)
    await h.controller.openDocument(h.docId)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'only-doc-1'))
    await h.controller.closeDocument()
    await h.controller.openDocument(second.id)
    const session2 = h.annotationEngine.getSession(documentSurfaceId(second.id, 0))
    expect(session2?.listObjects()).toEqual([])
    await h.controller.closeDocument()
    expect(await h.foundation.annotations.getSurfacesByDocument(second.id)).toEqual([])
    expect(await h.foundation.annotations.getSurfacesByDocument(h.docId)).toHaveLength(1)
  })

  it('xóa document cascade sạch annotation ở mọi trang, đúng quy ước surfaceId', async () => {
    const h = await setup()
    await h.controller.openDocument(h.docId)
    sessionOf(h, 0).surface.addObject(stroke(documentSurfaceId(h.docId, 0), 'p0'))
    await h.controller.goToPage(2)
    sessionOf(h, 2).surface.addObject(stroke(documentSurfaceId(h.docId, 2), 'p2'))
    await h.controller.closeDocument()
    const before = await h.foundation.annotations.getSurfacesByDocument(h.docId)
    expect(before.map((r) => r.surfaceId)).toEqual([
      documentSurfaceId(h.docId, 0),
      documentSurfaceId(h.docId, 2),
    ])
    expect(before.map((r) => r.pageIndex)).toEqual([0, 2])
    await h.foundation.documents.delete(h.docId)
    expect(await h.foundation.annotations.getSurfacesByDocument(h.docId)).toEqual([])
    const orphans = await h.foundation.db.annotations
      .where('documentId')
      .equals(h.docId)
      .count()
    expect(orphans).toBe(0)
  })
})
