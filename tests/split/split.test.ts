import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createStorageFoundation } from '../../src/data/index'
import { WebScribbleDatabase } from '../../src/data/database'
import { createAnnotationEngine } from '../../src/engines/annotation/index'
import { WhiteboardStore } from '../../src/app/features/whiteboard/whiteboardStore'
import { WhiteboardController } from '../../src/app/features/whiteboard/WhiteboardController'
import {
  SplitController,
  whiteboardPaneAdapter,
  type DrawingPaneAdapter,
  type PaneToolState,
} from '../../src/app/features/split/SplitController'
import {
  SplitSessionStore,
  clampSplitRatio,
  type KeyValueStorage,
} from '../../src/app/features/split/splitSession'
import { FakeCanvasElement, FakeFrameScheduler, pointerEvent } from '../drawing/fakes'

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    read: (key) => map.get(key) ?? null,
    write: (key, value) => {
      map.set(key, value)
    },
  }
}

function fakeAdapter(capabilities = { color: true, size: true }) {
  const calls: string[] = []
  const state: PaneToolState = {
    tool: 'pen',
    color: '#111827',
    sizeLabel: 'M',
    canUndo: true,
    canRedo: false,
  }
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const adapter: DrawingPaneAdapter = {
    capabilities,
    getToolState: () => ({ ...state }),
    setTool: (tool) => {
      calls.push(`setTool:${tool}`)
      state.tool = tool
      notify()
    },
    setColor: (color) => {
      calls.push(`setColor:${color}`)
      state.color = color
      notify()
    },
    setSizeLabel: (label) => {
      calls.push(`setSize:${label}`)
      state.sizeLabel = label
      notify()
    },
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return { adapter, calls, state }
}

describe('TASK-13 — SplitSessionStore', () => {
  it('lưu/nạp lại nguyên vẹn; dữ liệu hỏng hoặc thiếu thì về mặc định an toàn', () => {
    const storage = memoryStorage()
    const store = new SplitSessionStore(storage)
    expect(store.load()).toEqual({
      documentId: null,
      whiteboardId: null,
      ratio: 0.5,
      activePane: 'left',
    })
    store.save({ documentId: 'doc-1', whiteboardId: 'wb-1', ratio: 0.3, activePane: 'right' })
    expect(store.load()).toEqual({
      documentId: 'doc-1',
      whiteboardId: 'wb-1',
      ratio: 0.3,
      activePane: 'right',
    })
    storage.map.set('webscribble:split-session:v1', '{hong')
    expect(store.load().documentId).toBeNull()
    storage.map.set('webscribble:split-session:v1', '{"documentId":42,"ratio":99}')
    const loaded = store.load()
    expect(loaded.documentId).toBeNull()
    expect(loaded.ratio).toBe(0.85) // clamp về giới hạn tối đa
  })

  it('clampSplitRatio giữ tỉ lệ trong [0.15, 0.85]', () => {
    expect(clampSplitRatio(0.5)).toBe(0.5)
    expect(clampSplitRatio(0)).toBe(0.15)
    expect(clampSplitRatio(1)).toBe(0.85)
    expect(clampSplitRatio(Number.NaN)).toBe(0.5)
  })
})

describe('TASK-13 — SplitController routing', () => {
  it('lệnh công cụ CHỈ tới pane active; đổi active thì đổi đích; màu bị chặn khi pane không hỗ trợ', () => {
    const storage = memoryStorage()
    const split = new SplitController(new SplitSessionStore(storage))
    const left = fakeAdapter()
    const right = fakeAdapter()
    split.registerAdapter('left', left.adapter)
    split.registerAdapter('right', right.adapter)

    split.setTool('highlighter')
    split.setColor('#DC2626')
    split.undo()
    expect(left.calls).toEqual(['setTool:highlighter', 'setColor:#DC2626', 'undo'])
    expect(right.calls).toEqual([])

    split.setActivePane('right')
    split.setTool('pen')
    split.redo()
    expect(right.calls).toEqual(['setTool:pen', 'redo'])
    expect(left.calls).toHaveLength(3)

    // Pane trái không hỗ trợ màu → setColor bị chặn ở router:
    const noColor = fakeAdapter({ color: false, size: false })
    split.registerAdapter('left', noColor.adapter)
    split.setActivePane('left')
    split.setColor('#2563EB')
    split.setSizeLabel('L')
    expect(noColor.calls).toEqual([])
    split.dispose()
  })

  it('liên kết phiên được lưu và khôi phục qua instance SplitController mới', () => {
    const storage = memoryStorage()
    const first = new SplitController(new SplitSessionStore(storage))
    first.setDocument('doc-9')
    first.setWhiteboard('wb-9')
    first.setRatio(0.7)
    first.setActivePane('right')
    first.dispose()

    const second = new SplitController(new SplitSessionStore(storage))
    expect(second.getSession()).toEqual({
      documentId: 'doc-9',
      whiteboardId: 'wb-9',
      ratio: 0.7,
      activePane: 'right',
    })
    second.dispose()
  })

  it('snapshot phản ánh toolState của pane active và cập nhật khi adapter đổi trạng thái', () => {
    const split = new SplitController(new SplitSessionStore(memoryStorage()))
    const left = fakeAdapter()
    split.registerAdapter('left', left.adapter)
    expect(split.getSnapshot().toolState.tool).toBe('pen')
    split.setTool('stroke-eraser')
    expect(split.getSnapshot().toolState.tool).toBe('stroke-eraser')
    expect(split.getSnapshot().capabilities).toEqual({ color: true, size: true })
    split.dispose()
  })
})

function drawStroke(element: FakeCanvasElement, y: number): void {
  element.dispatch('pointerdown', pointerEvent({ clientX: 40, clientY: y, timeStamp: 1000 }))
  element.dispatch('pointermove', pointerEvent({ clientX: 120, clientY: y + 14, timeStamp: 1016 }))
  element.dispatch('pointerup', pointerEvent({ clientX: 200, clientY: y + 8, timeStamp: 1032, buttons: 0 }))
}

describe('TASK-13 — Hai controller thật: cô lập undo/redo tuyệt đối', () => {
  it('hai bảng trắng qua SplitController: vẽ cả hai, undo route theo pane active chỉ đụng đúng pane đó', async () => {
    const db = new WebScribbleDatabase(`webscribble-13-${crypto.randomUUID()}`)
    const foundation = createStorageFoundation(db)
    const store = new WhiteboardStore({
      documents: foundation.documents,
      annotations: foundation.annotations,
    })
    const annotationEngine = createAnnotationEngine({
      annotations: foundation.annotations,
      autosave: foundation.autosave,
    })
    const boardA = await store.create('Bang A')
    const boardB = await store.create('Bang B')

    const schedulerA = new FakeFrameScheduler()
    const controllerA = new WhiteboardController({
      store,
      annotationEngine,
      requestFrame: schedulerA.request,
      cancelFrame: schedulerA.cancel,
    })
    const schedulerB = new FakeFrameScheduler()
    const controllerB = new WhiteboardController({
      store,
      annotationEngine,
      requestFrame: schedulerB.request,
      cancelFrame: schedulerB.cancel,
    })
    const canvasA = new FakeCanvasElement()
    const canvasB = new FakeCanvasElement()
    await controllerA.open(boardA.id, canvasA as unknown as HTMLCanvasElement)
    await controllerB.open(boardB.id, canvasB as unknown as HTMLCanvasElement)

    drawStroke(canvasA, 100)
    drawStroke(canvasB, 100)
    drawStroke(canvasB, 300)
    expect(controllerA.getObjectCount()).toBe(1)
    expect(controllerB.getObjectCount()).toBe(2)

    const split = new SplitController(new SplitSessionStore(memoryStorage()))
    split.registerAdapter('left', whiteboardPaneAdapter(controllerA))
    split.registerAdapter('right', whiteboardPaneAdapter(controllerB))

    // Active = phải (B): đổi công cụ + undo chỉ đụng B:
    split.setActivePane('right')
    split.setTool('highlighter')
    expect(controllerB.getSnapshot().tool).toBe('highlighter')
    expect(controllerA.getSnapshot().tool).toBe('pen')
    split.undo()
    await Promise.resolve()
    expect(controllerB.getObjectCount()).toBe(1)
    expect(controllerA.getObjectCount()).toBe(1)

    // Active = trái (A): undo chỉ đụng A:
    split.setActivePane('left')
    split.undo()
    await Promise.resolve()
    expect(controllerA.getObjectCount()).toBe(0)
    expect(controllerB.getObjectCount()).toBe(1)

    split.dispose()
    await controllerA.close()
    await controllerB.close()
    db.close()
  }, 30000)
})
