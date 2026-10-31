/**
 * TASK-06B — PdfPageRenderer kiểm bằng page/canvas GIẢ có kiểm
 * soát (PDF.js render thật cần canvas 2D thật — phần đó thuộc
 * Browser QA). Ở đây xác minh logic của renderer: toán kích thước
 * theo DPR, tham số truyền cho PDF.js, hủy/thay thế render, và
 * truyền lỗi nguyên vẹn.
 */
import { describe, expect, it } from 'vitest'
import {
  PdfLoadError,
  PdfRenderError,
  createPdfPageRenderer,
} from '../../src/engines/pdf/index'
import type { PdfDocumentHandle } from '../../src/engines/pdf/index'

type RenderBehavior = 'immediate' | 'hang' | 'error' | 'transport-destroyed'

interface FakeRenderTask {
  promise: Promise<void>
  cancelCalls: number
  cancel: () => void
}

class FakePage {
  readonly renderParams: unknown[] = []
  lastTask: FakeRenderTask | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly behavior: RenderBehavior = 'immediate',
    private readonly rotation = 0,
  ) {}

  getViewport({ scale }: { scale: number }) {
    const swapped = this.rotation === 90 || this.rotation === 270
    const w = (swapped ? this.height : this.width) * scale
    const h = (swapped ? this.width : this.height) * scale
    return { width: w, height: h, rotation: this.rotation, scale }
  }

  render(params: unknown): FakeRenderTask {
    this.renderParams.push(params)
    let rejectFn: (error: unknown) => void = () => undefined
    let resolveFn: () => void = () => undefined
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
    const task: FakeRenderTask = {
      promise,
      cancelCalls: 0,
      cancel: () => {
        task.cancelCalls += 1
        rejectFn(Object.assign(new Error('render cancelled'), { name: 'RenderingCancelledException' }))
      },
    }
    this.lastTask = task
    if (this.behavior === 'immediate') queueMicrotask(() => resolveFn())
    if (this.behavior === 'error') {
      queueMicrotask(() => rejectFn(new Error('boom from pdfjs')))
    }
    if (this.behavior === 'transport-destroyed') {
      // Mô phỏng PDF.js khi document bị destroy giữa lúc render:
      // render task tự reject RenderingCancelledException.
      queueMicrotask(() =>
        rejectFn(Object.assign(new Error('transport destroyed'), { name: 'RenderingCancelledException' })),
      )
    }
    return task
  }
}

function fakeCanvas(): HTMLCanvasElement {
  return { width: 0, height: 0, style: { width: '', height: '' } } as unknown as HTMLCanvasElement
}

function fakeHandle(pages: FakePage[], closed = false): PdfDocumentHandle {
  return {
    pageCount: pages.length,
    closed,
    metadata: {
      title: null, author: null, subject: null, creator: null, producer: null,
      pdfVersion: '1.4', pageCount: pages.length,
    },
    getNativePage: async (index: number) => {
      if (closed) throw new PdfLoadError('closed', 'This PDF document has been closed.')
      const page = pages[index]
      if (page === undefined) throw new RangeError(`no page ${index}`)
      return page as never
    },
    getPage: async (index: number) => ({
      index, width: 612, height: 792, rotation: 0,
    }),
    close: async () => undefined,
  } as unknown as PdfDocumentHandle
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('PdfPageRenderer — kích thước và DPR', () => {
  it('DPR 1: bitmap bằng viewport, style CSS bằng viewport, không transform', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792)
    const canvas = fakeCanvas()
    const result = await renderer.render(fakeHandle([page]), 0, canvas, { devicePixelRatio: 1 })
    expect(canvas.width).toBe(612)
    expect(canvas.height).toBe(792)
    expect(canvas.style.width).toBe('612px')
    expect(canvas.style.height).toBe('792px')
    expect(result).toMatchObject({ cssWidth: 612, cssHeight: 792, pixelWidth: 612, pixelHeight: 792, devicePixelRatio: 1 })
    const params = page.renderParams[0] as { transform?: number[]; canvas: unknown }
    expect(params.transform).toBeUndefined()
    expect(params.canvas).toBe(canvas)
  })

  it('DPR 2: bitmap gấp đôi, CSS giữ nguyên, transform nhân 2 truyền cho PDF.js', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792)
    const canvas = fakeCanvas()
    const result = await renderer.render(fakeHandle([page]), 0, canvas, { devicePixelRatio: 2 })
    expect(canvas.width).toBe(1224)
    expect(canvas.height).toBe(1584)
    expect(canvas.style.width).toBe('612px') // CSS không nhân DPR
    expect(canvas.style.height).toBe('792px')
    expect(result.pixelWidth).toBe(1224)
    const params = page.renderParams[0] as { transform?: number[] }
    expect(params.transform).toEqual([2, 0, 0, 2, 0, 0])
  })

  it('scale 2 + DPR 2: bitmap = viewport(scale 2) x 2, CSS = viewport scale 2', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792)
    const canvas = fakeCanvas()
    const result = await renderer.render(fakeHandle([page]), 0, canvas, { scale: 2, devicePixelRatio: 2 })
    expect(result.cssWidth).toBe(1224)
    expect(canvas.width).toBe(2448)
    expect(canvas.height).toBe(3168)
    expect(canvas.style.width).toBe('1224px')
    const params = page.renderParams[0] as { viewport: { scale: number } }
    expect(params.viewport.scale).toBe(2)
  })

  it('render nhiều trang khác nhau và render lại cùng trang với scale khác: canvas cập nhật đúng', async () => {
    const renderer = createPdfPageRenderer()
    const handle = fakeHandle([new FakePage(612, 792), new FakePage(300, 400)])
    const canvas = fakeCanvas()
    await renderer.render(handle, 1, canvas, { devicePixelRatio: 1 })
    expect([canvas.width, canvas.height]).toEqual([300, 400])
    await renderer.render(handle, 0, canvas, { scale: 0.5, devicePixelRatio: 1 })
    expect([canvas.width, canvas.height]).toEqual([306, 396])
    expect(canvas.style.width).toBe('306px')
  })
})

describe('PdfPageRenderer — vòng đời và hủy', () => {
  it('hủy render đang chạy: promise reject kind cancelled và task.cancel được gọi', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792, 'hang')
    const canvas = fakeCanvas()
    const pending = renderer.render(fakeHandle([page]), 0, canvas, { devicePixelRatio: 1 })
    await tick() // để render chạm tới render task
    expect(renderer.isRendering(canvas)).toBe(true)
    renderer.cancel(canvas)
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    expect(page.lastTask?.cancelCalls).toBeGreaterThanOrEqual(1)
    expect(renderer.isRendering(canvas)).toBe(false)
  })

  it('hủy NGAY sau khi gọi render (chưa kịp tạo task): vẫn cancelled, không render nào chạy ngầm', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792, 'hang')
    const canvas = fakeCanvas()
    const pending = renderer.render(fakeHandle([page]), 0, canvas, { devicePixelRatio: 1 })
    renderer.cancel(canvas) // đồng bộ, trước mọi await
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    expect(page.renderParams).toHaveLength(0) // chưa hề bắt đầu vẽ
  })

  it('render mới trên cùng canvas thay thế render cũ: cũ bị hủy, mới hoàn thành, canvas mang kích thước mới', async () => {
    const renderer = createPdfPageRenderer()
    const handle = fakeHandle([new FakePage(612, 792, 'hang'), new FakePage(300, 400)])
    const canvas = fakeCanvas()
    const first = renderer.render(handle, 0, canvas, { devicePixelRatio: 1 })
    await tick()
    const second = renderer.render(handle, 1, canvas, { devicePixelRatio: 1 })
    await expect(first).rejects.toMatchObject({ kind: 'cancelled' })
    await expect(second).resolves.toMatchObject({ index: 1, cssWidth: 300 })
    expect([canvas.width, canvas.height]).toEqual([300, 400])
  })

  it('document bị destroy giữa lúc render (PDF.js tự hủy task) → bề mặt thành cancelled', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792, 'transport-destroyed')
    const canvas = fakeCanvas()
    await expect(renderer.render(fakeHandle([page]), 0, canvas)).rejects.toMatchObject({
      kind: 'cancelled',
    })
  })

  it('render trên tài liệu đã đóng: PdfLoadError kind closed truyền NGUYÊN VẸN từ loader', async () => {
    const renderer = createPdfPageRenderer()
    const canvas = fakeCanvas()
    const error = await renderer
      .render(fakeHandle([new FakePage(612, 792)], true), 0, canvas)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfLoadError)
    expect((error as PdfLoadError).kind).toBe('closed')
  })

  it('cleanup: cancel trên canvas trống, cancelAll và dispose gọi nhiều lần đều an toàn', async () => {
    const renderer = createPdfPageRenderer()
    const canvas = fakeCanvas()
    expect(() => renderer.cancel(canvas)).not.toThrow()
    expect(() => renderer.cancelAll()).not.toThrow()
    expect(() => renderer.dispose()).not.toThrow()
    expect(() => renderer.dispose()).not.toThrow()
    const page = new FakePage(612, 792, 'hang')
    const pending = renderer.render(fakeHandle([page]), 0, canvas)
    await tick()
    renderer.dispose()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    renderer.dispose() // lần nữa vẫn an toàn
  })

  it('hai renderer độc lập: hủy ở renderer này không động tới render của renderer kia', async () => {
    const a = createPdfPageRenderer()
    const b = createPdfPageRenderer()
    const pageA = new FakePage(612, 792, 'hang')
    const pageB = new FakePage(300, 400, 'hang')
    const canvasA = fakeCanvas()
    const canvasB = fakeCanvas()
    const pendingA = a.render(fakeHandle([pageA]), 0, canvasA)
    const pendingB = b.render(fakeHandle([pageB]), 0, canvasB)
    await tick()
    a.cancelAll()
    await expect(pendingA).rejects.toMatchObject({ kind: 'cancelled' })
    expect(b.isRendering(canvasB)).toBe(true) // B vẫn đang chạy
    b.cancelAll()
    await expect(pendingB).rejects.toMatchObject({ kind: 'cancelled' })
  })
})

describe('PdfPageRenderer — lỗi đầu vào và lỗi PDF.js', () => {
  it('canvas không hợp lệ (null) → invalid-argument', async () => {
    const renderer = createPdfPageRenderer()
    await expect(
      renderer.render(fakeHandle([new FakePage(612, 792)]), 0, null as unknown as HTMLCanvasElement),
    ).rejects.toMatchObject({ kind: 'invalid-argument' })
  })

  it('scale không hợp lệ và DPR không hợp lệ → invalid-argument', async () => {
    const renderer = createPdfPageRenderer()
    const handle = fakeHandle([new FakePage(612, 792)])
    await expect(renderer.render(handle, 0, fakeCanvas(), { scale: 0 })).rejects.toMatchObject({ kind: 'invalid-argument' })
    await expect(renderer.render(handle, 0, fakeCanvas(), { devicePixelRatio: 0 })).rejects.toMatchObject({ kind: 'invalid-argument' })
    await expect(renderer.render(handle, 0, fakeCanvas(), { devicePixelRatio: Number.NaN })).rejects.toMatchObject({ kind: 'invalid-argument' })
  })

  it('lỗi PDF.js khi render → PdfRenderError render-failed, giữ cause, không bị nuốt', async () => {
    const renderer = createPdfPageRenderer()
    const page = new FakePage(612, 792, 'error')
    const error = await renderer.render(fakeHandle([page]), 0, fakeCanvas()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfRenderError)
    expect((error as PdfRenderError).kind).toBe('render-failed')
    expect(((error as PdfRenderError).cause as Error).message).toBe('boom from pdfjs')
  })

  it('lỗi thô của PDF.js ngay ở bước lấy trang (không phải lỗi loader) → render-failed có cause, không thoát lỗi trần', async () => {
    const renderer = createPdfPageRenderer()
    const handle = fakeHandle([new FakePage(612, 792)])
    ;(handle as { getNativePage: unknown }).getNativePage = async () => {
      throw new Error('worker exploded while fetching page')
    }
    const error = await renderer.render(handle, 0, fakeCanvas()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfRenderError)
    expect((error as PdfRenderError).kind).toBe('render-failed')
  })

  it('tài liệu đóng trong lúc đang lấy trang (lỗi thô + handle.closed) → cancelled', async () => {
    const renderer = createPdfPageRenderer()
    const mutable = { closed: false }
    const handle = {
      pageCount: 1,
      metadata: {
        title: null, author: null, subject: null, creator: null, producer: null,
        pdfVersion: '1.4', pageCount: 1,
      },
      get closed() {
        return mutable.closed
      },
      getNativePage: async () => {
        mutable.closed = true // đóng xảy ra giữa lúc lấy trang
        throw Object.assign(new Error('AbortException'), { name: 'AbortException' })
      },
      getPage: async () => ({ index: 0, width: 612, height: 792, rotation: 0 }),
      close: async () => undefined,
    } as unknown as PdfDocumentHandle
    await expect(renderer.render(handle, 0, fakeCanvas())).rejects.toMatchObject({ kind: 'cancelled' })
  })
})
