import { describe, expect, it } from 'vitest'
import { CanvasRenderer } from '../../src/engines/drawing/canvasRenderer'
import { createCamera } from '../../src/engines/drawing/coordinates'
import {
  createArrow,
  createEllipse,
  createLine,
  createPenStroke,
  createRectangle,
  createText,
} from '../../src/engines/drawing/objects'
import {
  arrowHeadPoints,
  drawObject,
  drawShape,
  drawText,
} from '../../src/engines/drawing/renderer'
import type { DrawingObject } from '../../src/engines/drawing/types'
import { FakeCanvas, FakeContext2D, FakeFrameScheduler } from './fakes'

const SURFACE = 'document:doc-1:1'
const CAM = createCamera()

function rect(style?: { fillColor?: string | null }) {
  return createRectangle({
    surfaceId: SURFACE,
    start: { x: 10, y: 20 },
    end: { x: 110, y: 70 },
    style,
  })
}

function textObject(text = 'Xin chào\nViệt Nam', width = 200, height = 40) {
  return createText({
    surfaceId: SURFACE,
    position: { x: 10, y: 20 },
    text,
    width,
    height,
  })
}

describe('drawShape — line & rectangle', () => {
  it('line: stroke với màu/độ dày theo style và camera (zoom nhân lineWidth)', () => {
    const ctx = new FakeContext2D()
    const line = createLine({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 50, y: 30 },
      style: { strokeColor: '#2563eb', strokeWidth: 3 },
    })
    expect(drawShape(ctx, line, createCamera({ zoom: 2 }))).toBe(true)
    expect(ctx.countCalls('moveTo')).toBe(1)
    expect(ctx.calls.find((c) => c.name === 'moveTo')?.args).toEqual([0, 0])
    expect(ctx.calls.find((c) => c.name === 'lineTo')?.args).toEqual([100, 60])
    expect(ctx.strokes).toEqual([{ strokeStyle: '#2563eb', lineWidth: 6, globalAlpha: 1 }])
    expect(ctx.countCalls('save')).toBe(1)
    expect(ctx.countCalls('restore')).toBe(1)
  })

  it('rectangle mặc định không fill — chỉ stroke; có fillColor thì fill trước stroke', () => {
    const noFill = new FakeContext2D()
    drawShape(noFill, rect(), CAM)
    expect(noFill.fills).toEqual([])
    expect(noFill.countCalls('stroke')).toBe(1)

    const filled = new FakeContext2D()
    drawShape(filled, rect({ fillColor: '#dbeafe' }), CAM)
    expect(filled.fills).toEqual([{ fillStyle: '#dbeafe', globalAlpha: 1 }])
    expect(filled.countCalls('stroke')).toBe(1)
  })

  it('pan camera dịch tọa độ vẽ của rectangle', () => {
    const ctx = new FakeContext2D()
    drawShape(ctx, rect(), createCamera({ x: 10, y: 20 }))
    expect(ctx.calls.find((c) => c.name === 'moveTo')?.args).toEqual([0, 0])
  })
})

describe('drawShape — ellipse & arrow', () => {
  it('ellipse: gọi ellipse() với tâm và bán kính đúng, tôn trọng fill', () => {
    const ctx = new FakeContext2D()
    const ellipse = createEllipse({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 60 },
    })
    expect(drawShape(ctx, ellipse, CAM)).toBe(true)
    const call = ctx.calls.find((c) => c.name === 'ellipse')
    expect(call?.args.slice(0, 4)).toEqual([50, 30, 50, 30])
    expect(ctx.countCalls('stroke')).toBe(1)
  })

  it('arrowHeadPoints: hai cánh đối xứng sau đầu nhọn theo hướng mũi tên', () => {
    const { wingA, wingB } = arrowHeadPoints({ x: 100, y: 0 }, { x: 0, y: 0 }, 10)
    // Hướng sang phải: cánh nằm sau tip (x < 100), đối xứng qua trục x.
    expect(wingA.x).toBeCloseTo(100 - 10 * Math.cos(Math.PI / 6), 9)
    expect(wingB.x).toBeCloseTo(wingA.x, 9)
    expect(wingA.y).toBeCloseTo(5, 9)
    expect(wingB.y).toBeCloseTo(-5, 9)
    // Mũi tên hướng lên: cánh nằm phía dưới tip.
    const up = arrowHeadPoints({ x: 0, y: 0 }, { x: 0, y: 100 }, 10)
    expect(up.wingA.y).toBeGreaterThan(0)
    expect(up.wingB.y).toBeGreaterThan(0)
  })

  it('arrow: thân được stroke, đầu mũi tên được fill bằng tam giác', () => {
    const ctx = new FakeContext2D()
    const arrow = createArrow({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
    })
    expect(drawShape(ctx, arrow, CAM)).toBe(true)
    expect(ctx.countCalls('stroke')).toBe(1)
    expect(ctx.fills).toHaveLength(1)
    expect(ctx.fills[0].fillStyle).toBe('#111827')
    // Đường vẽ: thân (moveTo+lineTo) + tam giác đầu (moveTo + 2 lineTo + closePath).
    expect(ctx.countCalls('moveTo')).toBe(2)
    expect(ctx.countCalls('lineTo')).toBe(3)
    expect(ctx.countCalls('closePath')).toBe(1)
  })

  it('hình suy biến không vẽ gì và trả false', () => {
    const ctx = new FakeContext2D()
    const flatEllipse = createEllipse({
      surfaceId: SURFACE,
      start: { x: 0, y: 10 },
      end: { x: 100, y: 10 },
    })
    expect(drawShape(ctx, flatEllipse, CAM)).toBe(false)
    const pointLine = createLine({
      surfaceId: SURFACE,
      start: { x: 5, y: 5 },
      end: { x: 5, y: 5 },
    })
    expect(drawShape(ctx, pointLine, CAM)).toBe(false)
    expect(ctx.calls).toEqual([])
  })
})

describe('drawText', () => {
  it('vẽ từng dòng bằng fillText, font theo style × zoom, có clip trong hộp object', () => {
    const ctx = new FakeContext2D()
    expect(drawText(ctx, textObject(), CAM)).toBe(true)
    expect(ctx.texts.map((t) => t.text)).toEqual(['Xin chào', 'Việt Nam'])
    expect(ctx.texts[0]).toMatchObject({ x: 10, y: 20, font: '16px sans-serif' })
    expect(ctx.texts[1].y).toBeCloseTo(20 + 16 * 1.25, 9)
    const names = ctx.calls.map((c) => c.name)
    expect(names.indexOf('clip')).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('clip')).toBeLessThan(names.indexOf('fillText'))
    expect(names[0]).toBe('save')
    expect(names[names.length - 1]).toBe('restore')
  })

  it('zoom 2: font và bước dòng đều nhân đôi', () => {
    const ctx = new FakeContext2D()
    drawText(ctx, textObject(), createCamera({ zoom: 2 }))
    expect(ctx.texts[0].font).toBe('32px sans-serif')
    expect(ctx.texts[0].x).toBe(20)
    expect(ctx.texts[1].y).toBeCloseTo(40 + 32 * 1.25, 9)
  })

  it('gói dòng theo width của object khi dòng quá dài', () => {
    const ctx = new FakeContext2D()
    // FakeContext2D đo: ký tự = 8px ở fontSize 16. 'aa bb cc' = 64 > width 40 → gói.
    drawText(ctx, textObject('aa bb cc', 40, 40), CAM)
    expect(ctx.texts.map((t) => t.text)).toEqual(['aa bb', 'cc'])
  })

  it('không sửa dữ liệu gốc khi render mọi loại object (đóng băng sâu)', () => {
    const objects: DrawingObject[] = [
      rect({ fillColor: '#fee2e2' }),
      textObject(),
      createPenStroke({
        surfaceId: SURFACE,
        points: [
          { x: 0, y: 0, pressure: 0.5, time: 0 },
          { x: 30, y: 10, pressure: 0.6, time: 10 },
        ],
      }),
    ]
    for (const object of objects) {
      const snapshot = JSON.stringify(object)
      Object.freeze(object)
      Object.freeze(object.style)
      Object.freeze(object.bounds)
      if (object.type === 'pen') {
        Object.freeze(object.points)
        object.points.forEach((p) => Object.freeze(p))
      }
      const ctx = new FakeContext2D()
      expect(drawObject(ctx, object, createCamera({ x: 3, y: 4, zoom: 2 }))).toBe(true)
      expect(JSON.stringify(object)).toBe(snapshot)
    }
  })
})

describe('drawObject & CanvasRenderer — redraw toàn bộ từ Surface', () => {
  it('drawObject dispatch đúng theo loại và không phá pen/highlighter', () => {
    const penCtx = new FakeContext2D()
    const pen = createPenStroke({
      surfaceId: SURFACE,
      points: [
        { x: 0, y: 0, pressure: 0.5, time: 0 },
        { x: 40, y: 0, pressure: 0.5, time: 10 },
      ],
    })
    expect(drawObject(penCtx, pen, CAM)).toBe(true)
    expect(penCtx.countCalls('fill')).toBe(1)

    const lineCtx = new FakeContext2D()
    expect(drawObject(lineCtx, createLine({
      surfaceId: SURFACE,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    }), CAM)).toBe(true)
    expect(lineCtx.countCalls('stroke')).toBe(1)
  })

  it('CanvasRenderer vẽ lại được cả nét, hình và text từ dữ liệu nguồn', () => {
    const canvas = new FakeCanvas()
    const scheduler = new FakeFrameScheduler()
    const objects: DrawingObject[] = [
      createPenStroke({
        surfaceId: SURFACE,
        points: [
          { x: 0, y: 0, pressure: 0.5, time: 0 },
          { x: 40, y: 0, pressure: 0.5, time: 10 },
        ],
      }),
      rect({ fillColor: '#dbeafe' }),
      textObject('Ghi chú', 200, 20),
    ]
    const renderer = new CanvasRenderer({
      canvas,
      getObjects: () => objects,
      getCamera: () => CAM,
      requestFrame: scheduler.request,
      cancelFrame: scheduler.cancel,
      getDevicePixelRatio: () => 1,
    })
    renderer.resize(400, 300)
    scheduler.runAll()
    expect(canvas.ctx.countCalls('fill')).toBeGreaterThanOrEqual(2) // pen + rect fill
    expect(canvas.ctx.countCalls('stroke')).toBe(1) // rectangle
    expect(canvas.ctx.texts.map((t) => t.text)).toEqual(['Ghi chú'])
  })
})
