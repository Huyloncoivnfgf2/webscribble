import { describe, expect, it } from 'vitest'
import { textBounds } from '../../src/engines/drawing/geometry'
import {
  buildTextObject,
  createCanvasTextMeasurer,
  layoutText,
  layoutTextLines,
  updateTextContent,
  type TextMeasurer,
} from '../../src/engines/drawing/text'
import type { TextStyle } from '../../src/engines/drawing/types'
import { validateDrawingObject } from '../../src/engines/drawing/validation'
import { FakeContext2D } from './fakes'

const SURFACE = 'document:doc-1:1'

/** Bộ đo giả xác định: mỗi ký tự rộng fontSize × 0.5, dòng cao fontSize × 1.25. */
const measurer: TextMeasurer = {
  measureWidth: (line, style) => [...line].length * style.fontSize * 0.5,
  lineHeight: (style) => style.fontSize * 1.25,
}

const STYLE: TextStyle = { color: '#111827', fontSize: 16, fontFamily: 'sans-serif' }

describe('layoutTextLines & layoutText', () => {
  it('chỉ tách theo \\n khi không có maxWidth', () => {
    const measure = (line: string, style: TextStyle) => measurer.measureWidth(line, style)
    expect(layoutTextLines('một\nhai ba\nbốn', STYLE, measure)).toEqual([
      'một',
      'hai ba',
      'bốn',
    ])
  })

  it('gói từ tham lam theo maxWidth', () => {
    const measure = (line: string, style: TextStyle) => measurer.measureWidth(line, style)
    // fontSize 16 → ký tự rộng 8. 'aa bb' = 40 vừa maxWidth 40; thêm ' cc' = 64 vượt.
    expect(layoutTextLines('aa bb cc', STYLE, measure, 40)).toEqual(['aa bb', 'cc'])
  })

  it('từ đơn dài hơn maxWidth được giữ nguyên ở dòng riêng', () => {
    const measure = (line: string, style: TextStyle) => measurer.measureWidth(line, style)
    expect(layoutTextLines('abcdefghij', STYLE, measure, 24)).toEqual(['abcdefghij'])
  })

  it('layoutText tính width theo dòng dài nhất và height theo số dòng', () => {
    const layout = layoutText('ngắn\ndòng này dài hơn', STYLE, measurer)
    expect(layout.lines).toHaveLength(2)
    expect(layout.width).toBe([...'dòng này dài hơn'].length * 8)
    expect(layout.height).toBe(40) // 2 dòng × 20
  })
})

describe('buildTextObject (DEC-026)', () => {
  it('lưu nội dung thật, width/height đo được và bounds suy ra từ chúng', () => {
    const object = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 100, y: 50 },
      text: 'Xin chào',
      measurer,
    })
    expect(object.type).toBe('text')
    expect(object.text).toBe('Xin chào')
    expect(object.width).toBe(8 * 8) // 8 ký tự × 8
    expect(object.height).toBe(20)
    expect(object.bounds).toEqual(textBounds({ x: 100, y: 50 }, 64, 20))
    expect(object.style).toEqual(STYLE)
    expect(validateDrawingObject(object).valid).toBe(true)
  })

  it('giữ nguyên tiếng Việt có dấu và ký tự Unicode (kể cả emoji)', () => {
    const content = 'Tiếng Việt: ă â ê ô ơ ư đ — ghi chú 📝'
    const object = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 0, y: 0 },
      text: content,
      measurer,
    })
    expect(object.text).toBe(content)
    expect(object.width).toBe([...content].length * 8)
    expect(validateDrawingObject(object).valid).toBe(true)
  })

  it('nội dung nhiều dòng: height tăng theo số dòng', () => {
    const object = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 0, y: 0 },
      text: 'Dòng một\nDòng hai\nDòng ba',
      measurer,
    })
    expect(object.height).toBe(60)
    expect(object.width).toBe([...'Dòng hai'].length * 8)
  })

  it('nội dung rỗng hoặc chỉ khoảng trắng bị từ chối', () => {
    expect(() =>
      buildTextObject({ surfaceId: SURFACE, position: { x: 0, y: 0 }, text: '', measurer }),
    ).toThrow(/must not be empty/)
    expect(() =>
      buildTextObject({ surfaceId: SURFACE, position: { x: 0, y: 0 }, text: '   \n ', measurer }),
    ).toThrow(/must not be empty/)
  })

  it('style tùy chỉnh ảnh hưởng phép đo (fontSize lớn → hộp lớn)', () => {
    const object = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 0, y: 0 },
      text: 'Ab',
      style: { fontSize: 32 },
      measurer,
    })
    expect(object.width).toBe(2 * 16)
    expect(object.height).toBe(40)
    expect(object.style.fontSize).toBe(32)
  })
})

describe('updateTextContent', () => {
  it('giữ id/createdAt/vị trí, cập nhật nội dung + kích thước + bounds', () => {
    const original = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 10, y: 10 },
      text: 'Ngắn',
      measurer,
      createdAt: 1234,
    })
    const updated = updateTextContent(original, 'Một nội dung dài hơn nhiều', measurer)
    expect(updated.id).toBe(original.id)
    expect(updated.createdAt).toBe(1234)
    expect(updated.position).toEqual({ x: 10, y: 10 })
    expect(updated.text).toBe('Một nội dung dài hơn nhiều')
    expect(updated.width).toBeGreaterThan(original.width)
    expect(updated.bounds).toEqual(
      textBounds(original.position, updated.width, updated.height),
    )
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt)
    expect(validateDrawingObject(updated).valid).toBe(true)
    // Object gốc không bị sửa.
    expect(original.text).toBe('Ngắn')
  })

  it('nội dung mới rỗng bị từ chối', () => {
    const original = buildTextObject({
      surfaceId: SURFACE,
      position: { x: 0, y: 0 },
      text: 'Có nội dung',
      measurer,
    })
    expect(() => updateTextContent(original, '  ', measurer)).toThrow(/must not be empty/)
  })
})

describe('createCanvasTextMeasurer', () => {
  it('đo bằng measureText của canvas với font theo style; lineHeight = fontSize × 1.25', () => {
    const ctx = new FakeContext2D()
    const canvasMeasurer = createCanvasTextMeasurer(ctx)
    // FakeContext2D đo: mỗi ký tự = fontSize × 0.5 → 'abcd' ở 16px = 32.
    expect(canvasMeasurer.measureWidth('abcd', STYLE)).toBe(32)
    expect(ctx.font).toBe('16px sans-serif')
    expect(canvasMeasurer.lineHeight(STYLE)).toBe(20)
    expect(canvasMeasurer.measureWidth('ab', { ...STYLE, fontSize: 32 })).toBe(32)
    expect(ctx.font).toBe('32px sans-serif')
  })
})
