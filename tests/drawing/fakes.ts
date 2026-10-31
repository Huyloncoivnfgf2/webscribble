/**
 * Đối tượng giả dùng chung cho các test của Drawing Engine: context 2D
 * ghi lại lệnh vẽ, bộ lập lịch frame thủ công (thay requestAnimationFrame)
 * và phần tử canvas kiêm đích pointer cho test tích hợp.
 */
import type { PointerEventLike, PointerTargetLike } from '../../src/engines/drawing/input'
import type {
  CanvasLike,
  CanvasSurfaceContextLike,
} from '../../src/engines/drawing/canvasRenderer'

export interface RecordedCall {
  name: string
  args: readonly unknown[]
}

/** Context 2D giả: ghi lại mọi lệnh; chụp fillStyle/globalAlpha tại lúc fill(). */
export class FakeContext2D implements CanvasSurfaceContextLike {
  fillStyle = ''
  strokeStyle = ''
  lineWidth = 1
  globalAlpha = 1
  font = ''
  textBaseline = ''
  readonly calls: RecordedCall[] = []
  readonly fills: { fillStyle: string; globalAlpha: number }[] = []
  readonly strokes: { strokeStyle: string; lineWidth: number; globalAlpha: number }[] = []
  readonly texts: { text: string; x: number; y: number; font: string; fillStyle: string }[] = []

  save(): void {
    this.calls.push({ name: 'save', args: [] })
  }

  restore(): void {
    this.calls.push({ name: 'restore', args: [] })
  }

  beginPath(): void {
    this.calls.push({ name: 'beginPath', args: [] })
  }

  moveTo(x: number, y: number): void {
    this.calls.push({ name: 'moveTo', args: [x, y] })
  }

  lineTo(x: number, y: number): void {
    this.calls.push({ name: 'lineTo', args: [x, y] })
  }

  closePath(): void {
    this.calls.push({ name: 'closePath', args: [] })
  }

  fill(): void {
    this.calls.push({ name: 'fill', args: [] })
    this.fills.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha })
  }

  stroke(): void {
    this.calls.push({ name: 'stroke', args: [] })
    this.strokes.push({
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
    })
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.calls.push({ name: 'ellipse', args: [x, y, radiusX, radiusY, rotation, startAngle, endAngle] })
  }

  clip(): void {
    this.calls.push({ name: 'clip', args: [] })
  }

  fillText(text: string, x: number, y: number): void {
    this.calls.push({ name: 'fillText', args: [text, x, y] })
    this.texts.push({ text, x, y, font: this.font, fillStyle: this.fillStyle })
  }

  /** Đo text xác định: mỗi ký tự (code point) rộng bằng nửa fontSize hiện tại. */
  measureText(text: string): { width: number } {
    this.calls.push({ name: 'measureText', args: [text] })
    const match = /([0-9]+(?:\.[0-9]+)?)px/.exec(this.font)
    const fontSize = match === null ? 16 : Number(match[1])
    return { width: [...text].length * fontSize * 0.5 }
  }

  /** Mẫu nét đứt hiện tại (dùng để kiểm chứng overlay chọn/tẩy). */
  dashSegments: number[] = []

  setLineDash(segments: readonly number[]): void {
    this.calls.push({ name: 'setLineDash', args: [[...segments]] })
    this.dashSegments = [...segments]
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.calls.push({ name: 'setTransform', args: [a, b, c, d, e, f] })
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({ name: 'clearRect', args: [x, y, width, height] })
  }

  countCalls(name: string): number {
    return this.calls.filter((call) => call.name === name).length
  }
}

/** Canvas giả tối thiểu cho CanvasRenderer. */
export class FakeCanvas implements CanvasLike {
  width = 0
  height = 0
  readonly ctx = new FakeContext2D()

  getContext(): CanvasSurfaceContextLike {
    return this.ctx
  }
}

/** Bộ lập lịch frame thủ công: test chủ động chạy frame khi muốn. */
export class FakeFrameScheduler {
  private nextId = 1
  private readonly pending = new Map<number, () => void>()
  readonly cancelled: number[] = []

  readonly request = (callback: () => void): number => {
    const id = this.nextId
    this.nextId += 1
    this.pending.set(id, callback)
    return id
  }

  readonly cancel = (id: number): void => {
    if (this.pending.delete(id)) {
      this.cancelled.push(id)
    }
  }

  get pendingCount(): number {
    return this.pending.size
  }

  /** Chạy tất cả frame đang chờ (mỗi frame một lần). */
  runAll(): void {
    const callbacks = [...this.pending.values()]
    this.pending.clear()
    for (const callback of callbacks) {
      callback()
    }
  }
}

/** Phần tử canvas giả: vừa là CanvasLike vừa là PointerTargetLike (cho DrawingEngine). */
export class FakeCanvasElement implements CanvasLike, PointerTargetLike {
  width = 0
  height = 0
  readonly ctx = new FakeContext2D()
  rect = { left: 0, top: 0 }
  readonly captured = new Set<number>()
  private readonly listeners = new Map<string, Set<(event: PointerEventLike) => void>>()

  getContext(): CanvasSurfaceContextLike {
    return this.ctx
  }

  getBoundingClientRect(): { left: number; top: number } {
    return this.rect
  }

  addEventListener(type: string, listener: (event: PointerEventLike) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: (event: PointerEventLike) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  dispatch(type: string, event: PointerEventLike): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

/** Sự kiện pointer giả cho test tích hợp (mặc định: chuột, nút chính, hợp lệ). */
export function pointerEvent(partial: Partial<PointerEventLike> = {}): PointerEventLike {
  return {
    pointerId: partial.pointerId ?? 1,
    pointerType: partial.pointerType ?? 'pen',
    clientX: partial.clientX ?? 0,
    clientY: partial.clientY ?? 0,
    pressure: partial.pressure,
    tiltX: partial.tiltX,
    tiltY: partial.tiltY,
    button: partial.button ?? 0,
    buttons: partial.buttons ?? 1,
    isPrimary: partial.isPrimary ?? true,
    timeStamp: partial.timeStamp ?? 1000,
    getCoalescedEvents: partial.getCoalescedEvents,
  }
}
