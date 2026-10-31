import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  PdfViewerController,
} from '../../src/app/features/documents/PdfViewerController'
import { createDatabase, createStorageFoundation, documentSurfaceId } from '../../src/data/index'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import { createPenStroke } from '../../src/engines/drawing/index'
import type {
  PdfPageRenderResult,
  PdfPageRenderer,
} from '../../src/engines/pdf/index'
import { buildPdf } from '../pdf/fixtures'

/**
 * Kiểm thử PdfViewerController (TASK-06E) bằng foundation THẬT
 * trên fake-indexeddb + PDF renderer giả (trang 612x792) + canvas
 * giả ghi listener: mở tài liệu, chuyển trang/nối tiếp thao tác,
 * zoom/fit, lỗi mở, đóng và dọn dẹp listener.
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
  readonly renderCalls: { scale: number }[] = []
  async render(
    _handle: unknown,
    index: number,
    canvas: FakeCanvas,
    options?: { scale?: number },
  ): Promise<PdfPageRenderResult> {
    const scale = options?.scale ?? 1
    this.renderCalls.push({ scale })
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

let dbCounter = 0

async function setup() {
  dbCounter += 1
  const foundation = createStorageFoundation(createDatabase(`webscribble-06e-${dbCounter}`))
  const annotationEngine = createAnnotationEngine({
    annotations: foundation.annotations,
    autosave: foundation.autosave,
  })
  const pdfCanvas = new FakeCanvas()
  const annoCanvas = new FakeCanvas()
  const controller = new PdfViewerController({
    documents: foundation.documents,
    annotationEngine,
    pdfRenderer: new StubPdfRenderer() as unknown as PdfPageRenderer,
    // Node không có requestAnimationFrame: tiêm bộ lập lịch
    // setTimeout cho cả overlay và DrawingEngine.
    requestFrame: (cb) => setTimeout(cb, 0) as unknown as number,
    cancelFrame: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  })
  controller.bindElements({
    pdfCanvas: pdfCanvas as unknown as HTMLCanvasElement,
    annotationCanvas: annoCanvas as unknown as HTMLCanvasElement,
    container: { clientWidth: 800, clientHeight: 600 },
  })
  const doc = await foundation.documents.create({
    name: 'three-pages.pdf',
    mimeType: 'application/pdf',
    blob: new Blob([buildPdf({ pageCount: 3 }) as BlobPart], { type: 'application/pdf' }),
  })
  return { foundation, annotationEngine, controller, annoCanvas, docId: doc.id }
}

describe('PdfViewerController', () => {
  it('mở tài liệu: ready, trang 0, fit theo khung 800x600, ghi pageCount về metadata', async () => {
    const { foundation, controller, docId } = await setup()
    await controller.openDocument(docId)
    const snap = controller.getSnapshot()
    expect(snap.status).toBe('ready')
    expect(snap.pageCount).toBe(3)
    expect(snap.pageIndex).toBe(0)
    expect(snap.fileName).toBe('three-pages.pdf')
    expect(snap.scale).toBeCloseTo(552 / 792, 6) // fit: min(752/612, 552/792)
    expect(snap.pageCssWidth).toBeCloseTo(612 * (552 / 792), 4)
    const meta = await foundation.documents.getById(docId)
    expect(meta?.pageCount).toBe(3)
    await controller.closeDocument()
  })

  it('annotation vẽ trên trang 0 được flush khi chuyển trang và khôi phục khi quay lại', async () => {
    const { foundation, annotationEngine, controller, docId } = await setup()
    await controller.openDocument(docId)
    const session0 = annotationEngine.getSession(documentSurfaceId(docId, 0))
    if (session0 == null) throw new Error('thiếu session trang 0')
    session0.surface.addObject(
      createPenStroke({
        surfaceId: session0.surfaceId,
        id: 's1',
        points: [
          { x: 10, y: 10, pressure: 0.5, time: 0 },
          { x: 60, y: 40, pressure: 0.5, time: 16 },
        ],
      }),
    )
    await controller.goToPage(1)
    expect(controller.getSnapshot().pageIndex).toBe(1)
    const saved = await foundation.annotations.getSurface(documentSurfaceId(docId, 0))
    expect(saved?.objects).toHaveLength(1)
    await controller.goToPage(0)
    const back = annotationEngine.getSession(documentSurfaceId(docId, 0))
    expect(back?.listObjects().map((o) => o.id)).toEqual(['s1'])
    await controller.closeDocument()
  })

  it('hai lần chuyển trang phát động đồng thời được nối tiếp an toàn', async () => {
    const { annotationEngine, controller, docId } = await setup()
    await controller.openDocument(docId)
    await Promise.all([controller.goToPage(2), controller.goToPage(1)])
    expect(controller.getSnapshot().pageIndex).toBe(1)
    expect(controller.getSnapshot().status).toBe('ready')
    expect(annotationEngine.openSurfaceIds()).toEqual([documentSurfaceId(docId, 1)])
    await controller.closeDocument()
  })

  it('điều hướng bị clamp ở hai đầu tài liệu', async () => {
    const { controller, docId } = await setup()
    await controller.openDocument(docId)
    await controller.goToPage(99)
    expect(controller.getSnapshot().pageIndex).toBe(2)
    await controller.nextPage()
    expect(controller.getSnapshot().pageIndex).toBe(2)
    await controller.goToPage(-5)
    expect(controller.getSnapshot().pageIndex).toBe(0)
    await controller.prevPage()
    expect(controller.getSnapshot().pageIndex).toBe(0)
    await controller.closeDocument()
  })

  it('zoom bị clamp trong [0.25, 4]; zoomIn/zoomOut theo bước', async () => {
    const { controller, docId } = await setup()
    await controller.openDocument(docId)
    await controller.setScale(100)
    expect(controller.getSnapshot().scale).toBe(4)
    await controller.setScale(0.001)
    expect(controller.getSnapshot().scale).toBe(0.25)
    await controller.setScale(1)
    await controller.zoomIn()
    expect(controller.getSnapshot().scale).toBeCloseTo(1.25)
    await controller.zoomOut()
    expect(controller.getSnapshot().scale).toBeCloseTo(1)
    expect(controller.getSnapshot().zoomMode).toBe('manual')
    await controller.closeDocument()
  })

  it('đóng tài liệu: session đóng, trạng thái về idle', async () => {
    const { annotationEngine, controller, docId } = await setup()
    await controller.openDocument(docId)
    await controller.closeDocument()
    expect(controller.getSnapshot().status).toBe('idle')
    expect(annotationEngine.isOpen(documentSurfaceId(docId, 0))).toBe(false)
  })

  it('dispose (unmount): pointer listeners bị gỡ hết khỏi canvas', async () => {
    const { controller, annoCanvas, docId } = await setup()
    await controller.openDocument(docId)
    expect(annoCanvas.listenerCount()).toBeGreaterThan(0)
    controller.dispose()
    expect(annoCanvas.listenerCount()).toBe(0)
  })

  it('lỗi mở PDF không phải PDF → status error, kind not-a-pdf', async () => {
    const { foundation, controller } = await setup()
    const bad = await foundation.documents.create({
      name: 'bad.pdf',
      mimeType: 'application/pdf',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' }),
    })
    await controller.openDocument(bad.id)
    const snap = controller.getSnapshot()
    expect(snap.status).toBe('error')
    expect(snap.errorKind).toBe('not-a-pdf')
    controller.dispose()
  })

  it('lỗi mở PDF có mật khẩu → kind password, thông điệp tiếng Việt', async () => {
    const { foundation, controller } = await setup()
    const locked = await foundation.documents.create({
      name: 'locked.pdf',
      mimeType: 'application/pdf',
      blob: new Blob([buildPdf({ pageCount: 1, userPassword: 'secret' }) as BlobPart], { type: 'application/pdf' }),
    })
    await controller.openDocument(locked.id)
    const snap = controller.getSnapshot()
    expect(snap.status).toBe('error')
    expect(snap.errorKind).toBe('password')
    expect(snap.errorMessage).toContain('mật khẩu')
    controller.dispose()
  })

  it('đổi công cụ và undo/redo an toàn khi chưa có thao tác', async () => {
    const { controller, docId } = await setup()
    await controller.openDocument(docId)
    controller.setTool('highlighter')
    expect(controller.getSnapshot().tool).toBe('highlighter')
    controller.setTool('stroke-eraser')
    expect(controller.getSnapshot().tool).toBe('stroke-eraser')
    expect(controller.getSnapshot().canUndo).toBe(false)
    controller.undo()
    controller.redo()
    expect(controller.getSnapshot().status).toBe('ready')
    await controller.closeDocument()
  })
})
