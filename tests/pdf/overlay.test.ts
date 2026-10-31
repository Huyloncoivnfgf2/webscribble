/**
 * TASK-06D — PdfAnnotationOverlay bằng renderer PDF giả + canvas
 * giả ghi nhận lệnh vẽ, nhưng session annotation THẬT (engine +
 * NotifyingSurface + fake-indexeddb) để kiểm chứng đường đồng bộ
 * thay đổi. Vị trí pixel thật được kiểm ở Browser QA.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createPenStroke, createRectangle } from '../../src/engines/drawing/objects'
import { createDatabase, type WebScribbleDatabase } from '../../src/data/database'
import { createStorageFoundation } from '../../src/data/index'
import { createAnnotationEngine, type AnnotationSurfaceSession } from '../../src/engines/annotation/index'
import {
  PdfAnnotationOverlay,
  PdfPageRenderer,
  type PdfDocumentHandle,
} from '../../src/engines/pdf/index'

const DOC = 'doc-overlay'
const PAGE_SIZE = { width: 612, height: 792 }
let counter = 0
const dbs: WebScribbleDatabase[] = []

class RecordingContext {
  fillStyle = ''
  strokeStyle = ''
  lineWidth = 1
  globalAlpha = 1
  font = ''
  textBaseline = ''
  readonly calls = new Map<string, number>()

  private record(name: string) {
    this.calls.set(name, (this.calls.get(name) ?? 0) + 1)
  }

  setTransform(): void { this.record('setTransform') }
  clearRect(): void { this.record('clearRect') }
  save(): void { this.record('save') }
  restore(): void { this.record('restore') }
  beginPath(): void { this.record('beginPath') }
  moveTo(): void { this.record('moveTo') }
  lineTo(): void { this.record('lineTo') }
  closePath(): void { this.record('closePath') }
  fill(): void { this.record('fill') }
  stroke(): void { this.record('stroke') }
  ellipse(): void { this.record('ellipse') }
  clip(): void { this.record('clip') }
  fillText(): void { this.record('fillText') }
  measureText(text: string): { width: number } { return { width: text.length * 8 } }
  setLineDash(): void { this.record('setLineDash') }

  totalCalls(): number {
    return [...this.calls.values()].reduce((a, b) => a + b, 0)
  }
}

function fakeCanvas() {
  const ctx = new RecordingContext()
  const canvas = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    getContext: () => ctx,
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx, raw: canvas }
}

function fakeViewport(scale: number) {
  return {
    width: 612 * scale,
    height: 792 * scale,
    scale,
    rotation: 0,
    convertToViewportPoint: (x: number, y: number) => [x * scale, (792 - y) * scale],
    convertToPdfPoint: (x: number, y: number) => [x / scale, 792 - y / scale],
  }
}

class StubPdfRenderer {
  readonly renderCalls: { scale?: number; devicePixelRatio?: number }[] = []
  cancelCalls = 0

  async render(_h: unknown, _i: number, canvas: HTMLCanvasElement, opts: { scale?: number; devicePixelRatio?: number }) {
    this.renderCalls.push(opts)
    const scale = opts.scale ?? 1
    const dpr = opts.devicePixelRatio ?? 1
    const viewport = fakeViewport(scale)
    canvas.width = Math.round(viewport.width * dpr)
    canvas.height = Math.round(viewport.height * dpr)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    return {
      index: 0, scale, rotation: 0,
      cssWidth: viewport.width, cssHeight: viewport.height,
      pixelWidth: canvas.width, pixelHeight: canvas.height,
      devicePixelRatio: dpr, viewport,
    }
  }

  cancel(): void {
    this.cancelCalls += 1
  }
}

interface Rig {
  db: WebScribbleDatabase
  session: AnnotationSurfaceSession
  overlay: PdfAnnotationOverlay
  stub: StubPdfRenderer
  pdf: ReturnType<typeof fakeCanvas>
  anno: ReturnType<typeof fakeCanvas>
  pump: () => void
  pendingFrames: () => number
}

async function makeRig(options: { scale?: number; devicePixelRatio?: number } = {}): Promise<Rig> {
  counter += 1
  const db = createDatabase(`webscribble-06d-${counter}`)
  dbs.push(db)
  const foundation = createStorageFoundation(db)
  const engine = createAnnotationEngine({
    annotations: foundation.annotations,
    autosave: foundation.autosave,
  })
  const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
  const pdf = fakeCanvas()
  const anno = fakeCanvas()
  const stub = new StubPdfRenderer()
  const frames = new Map<number, () => void>()
  let nextHandle = 1
  const overlay = new PdfAnnotationOverlay({
    handle: {} as unknown as PdfDocumentHandle,
    pageIndex: 0,
    session,
    pdfCanvas: pdf.canvas,
    annotationCanvas: anno.canvas,
    scale: options.scale,
    devicePixelRatio: options.devicePixelRatio,
    pdfRenderer: stub as unknown as PdfPageRenderer,
    requestFrame: (cb) => {
      const handle = nextHandle
      nextHandle += 1
      frames.set(handle, cb)
      return handle
    },
    cancelFrame: (handle) => {
      frames.delete(handle)
    },
  })
  return {
    db, session, overlay, stub, pdf, anno,
    pump: () => {
      const callbacks = [...frames.values()]
      frames.clear()
      for (const cb of callbacks) cb()
    },
    pendingFrames: () => frames.size,
  }
}

const rigs: Rig[] = []
async function rig(options?: { scale?: number; devicePixelRatio?: number }): Promise<Rig> {
  const r = await makeRig(options)
  rigs.push(r)
  return r
}

afterEach(async () => {
  while (rigs.length > 0) {
    const r = rigs.pop()
    if (r) {
      r.overlay.dispose()
      await r.session.close().catch(() => undefined)
    }
  }
  while (dbs.length > 0) {
    await dbs.pop()?.delete()
  }
})

function pen(session: AnnotationSurfaceSession, id: string) {
  return createPenStroke({
    surfaceId: session.surfaceId,
    id,
    points: [
      { x: 10, y: 10, pressure: 0.5, time: 0 },
      { x: 100, y: 10, pressure: 0.5, time: 16 },
    ],
  })
}

describe('PdfAnnotationOverlay — render và kích thước', () => {
  it('render lần đầu: PDF renderer được gọi, canvas annotation khớp viewport (style CSS + bitmap theo DPR 1), có lệnh vẽ + clearRect trong suốt', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    r.session.surface.addObject(pen(r.session, 'p-1'))
    const result = await r.overlay.render()
    expect(r.stub.renderCalls).toHaveLength(1)
    expect(result.cssWidth).toBe(612)
    expect(r.anno.raw.style.width).toBe('612px')
    expect(r.anno.raw.style.height).toBe('792px')
    expect(r.anno.raw.width).toBe(612)
    expect(r.anno.ctx.calls.get('clearRect')).toBeGreaterThanOrEqual(1)
    expect(r.anno.ctx.totalCalls()).toBeGreaterThan(5) // nét bút đã được vẽ thật qua drawObject
    expect(r.overlay.mapping?.scale).toBe(1)
    expect(r.overlay.mapping?.pageWidth).toBe(612)
  })

  it('DPR 2: bitmap gấp đôi, style CSS giữ nguyên', async () => {
    const r = await rig({ devicePixelRatio: 2 })
    await r.overlay.render()
    expect(r.anno.raw.width).toBe(1224)
    expect(r.anno.raw.height).toBe(1584)
    expect(r.anno.raw.style.width).toBe('612px')
  })

  it('setScale(2): PDF render lại ở scale 2, canvas annotation theo viewport mới', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    await r.overlay.render()
    await r.overlay.setScale(2)
    expect(r.stub.renderCalls.map((c) => c.scale)).toEqual([1, 2])
    expect(r.anno.raw.style.width).toBe('1224px')
    expect(r.anno.raw.width).toBe(1224)
    expect(r.overlay.scale).toBe(2)
    expect(r.overlay.mapping?.scale).toBe(2)
  })

  it('refreshAnnotations không render lại PDF và không đổi kích thước canvas PDF', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    await r.overlay.render()
    const pdfWidth = r.pdf.raw.width
    r.overlay.refreshAnnotations()
    expect(r.stub.renderCalls).toHaveLength(1)
    expect(r.pdf.raw.width).toBe(pdfWidth)
  })

  it('render đủ loại object: rectangle được vẽ qua cùng đường (ellipse/fill/stroke xuất hiện)', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    r.session.surface.addObject(
      createRectangle({
        surfaceId: r.session.surfaceId, id: 'rect-1',
        start: { x: 50, y: 50 }, end: { x: 150, y: 120 },
      }),
    )
    await r.overlay.render()
    expect(r.anno.ctx.calls.get('stroke')).toBeGreaterThanOrEqual(1)
  })
})

describe('PdfAnnotationOverlay — đồng bộ thay đổi và vòng đời', () => {
  it('thêm/xóa object → tự lên lịch vẽ lại (không polling); bơm frame thì vẽ lại thật', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    await r.overlay.render()
    const before = r.anno.ctx.totalCalls()
    const stroke = pen(r.session, 'sync-1')
    r.session.surface.addObject(stroke)
    expect(r.pendingFrames()).toBe(1) // đã lên lịch, chưa vẽ
    r.pump()
    expect(r.anno.ctx.totalCalls()).toBeGreaterThan(before)
    const afterAdd = r.anno.ctx.totalCalls()
    r.session.surface.removeObject(stroke.id)
    expect(r.pendingFrames()).toBe(1)
    r.pump()
    expect(r.anno.ctx.totalCalls()).toBeGreaterThan(afterAdd)
  })

  it('dispose: hủy subscription — thay đổi sau dispose không lên lịch frame nào; dispose hai lần an toàn; render sau dispose bị từ chối', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    await r.overlay.render()
    r.overlay.dispose()
    expect(r.overlay.disposed).toBe(true)
    r.session.surface.addObject(pen(r.session, 'after-dispose'))
    expect(r.pendingFrames()).toBe(0)
    expect(() => r.overlay.dispose()).not.toThrow()
    await expect(r.overlay.render()).rejects.toMatchObject({ kind: 'disposed' })
  })

  it('session đóng → lần thay đổi kế tiếp tự dispose overlay; render trên session đã đóng bị từ chối session-closed', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    await r.overlay.render()
    await r.session.close()
    await expect(r.overlay.render()).rejects.toMatchObject({ kind: 'session-closed' })
    expect(r.overlay.disposed).toBe(true)
  })

  it('cancel chuyển xuống PDF renderer', async () => {
    const r = await rig({ devicePixelRatio: 1 })
    r.overlay.cancel()
    expect(r.stub.cancelCalls).toBeGreaterThanOrEqual(1)
  })

  it("chế độ 'external' (TASK-06E): overlay chỉ render PDF + sizing + mapping, KHÔNG vẽ lên canvas annotation và không lên lịch frame", async () => {
    counter += 1
    const db = createDatabase(`webscribble-06d-ext-${counter}`)
    dbs.push(db)
    const foundation = createStorageFoundation(db)
    const engine = createAnnotationEngine({ annotations: foundation.annotations, autosave: foundation.autosave })
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    session.surface.addObject(
      createRectangle({
        surfaceId: session.surfaceId,
        id: 'ext-rect',
        start: { x: 50, y: 100 },
        end: { x: 150, y: 150 },
      }),
    )
    const pdf = fakeCanvas()
    const anno = fakeCanvas()
    const stub = new StubPdfRenderer()
    let scheduled = 0
    const overlay = new PdfAnnotationOverlay({
      handle: {} as unknown as PdfDocumentHandle,
      pageIndex: 0,
      session,
      pdfCanvas: pdf.canvas,
      annotationCanvas: anno.canvas,
      devicePixelRatio: 1,
      pdfRenderer: stub as unknown as PdfPageRenderer,
      annotationRendering: 'external',
      requestFrame: () => {
        scheduled += 1
        return scheduled
      },
      cancelFrame: () => undefined,
    })
    const result = await overlay.render()
    expect(stub.renderCalls).toHaveLength(1)
    expect(result.cssWidth).toBe(612)
    // Kích thước CSS của canvas annotation vẫn được đặt…
    expect(anno.raw.style.width).toBe('612px')
    // …nhưng overlay không hề vẽ/resize bitmap của nó:
    expect(anno.ctx.totalCalls()).toBe(0)
    expect(anno.raw.width).toBe(0)
    // Mapping vẫn đầy đủ cho tầng tương tác bên ngoài:
    expect(overlay.mapping?.worldToViewportPoint({ x: 50, y: 100 })).toEqual({ x: 50, y: 100 })
    // Thay đổi dữ liệu không khiến overlay lên lịch vẽ:
    session.surface.addObject(
      createRectangle({
        surfaceId: session.surfaceId,
        id: 'ext-rect-2',
        start: { x: 10, y: 10 },
        end: { x: 30, y: 30 },
      }),
    )
    expect(scheduled).toBe(0)
    overlay.refreshAnnotations()
    expect(anno.ctx.totalCalls()).toBe(0)
    overlay.dispose()
    overlay.dispose()
    await session.close()
  })

  it('tham số không hợp lệ: canvas null → invalid-argument; scale 0 → lỗi', async () => {    counter += 1
    const db = createDatabase(`webscribble-06d-bad-${counter}`)
    dbs.push(db)
    const foundation = createStorageFoundation(db)
    const engine = createAnnotationEngine({ annotations: foundation.annotations, autosave: foundation.autosave })
    const session = await engine.openDocumentPage(DOC, 0, { pageSize: PAGE_SIZE })
    const pdf = fakeCanvas()
    expect(
      () =>
        new PdfAnnotationOverlay({
          handle: {} as unknown as PdfDocumentHandle,
          pageIndex: 0,
          session,
          pdfCanvas: pdf.canvas,
          annotationCanvas: null as unknown as HTMLCanvasElement,
        }),
    ).toThrowError(expect.objectContaining({ kind: 'invalid-argument' }))
    await session.close()
  })
})
