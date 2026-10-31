import { describe, expect, it } from 'vitest'
import {
  clampPageIndex,
  clampScale,
  computeFitScale,
  MAX_SCALE,
  MIN_SCALE,
  zoomInScale,
  zoomOutScale,
} from '../../src/app/features/documents/pdfViewerState'

describe('pdfViewerState — điều hướng trang', () => {
  it('clampPageIndex giữ trong [0, pageCount-1]', () => {
    expect(clampPageIndex(0, 5)).toBe(0)
    expect(clampPageIndex(4, 5)).toBe(4)
    expect(clampPageIndex(5, 5)).toBe(4)
    expect(clampPageIndex(99, 5)).toBe(4)
    expect(clampPageIndex(-3, 5)).toBe(0)
    expect(clampPageIndex(2.9, 5)).toBe(2)
    expect(clampPageIndex(3, 0)).toBe(0)
  })
})

describe('pdfViewerState — zoom', () => {
  it('clampScale giữ trong [MIN, MAX] và xử lý giá trị hỏng', () => {
    expect(clampScale(1)).toBe(1)
    expect(clampScale(100)).toBe(MAX_SCALE)
    expect(clampScale(0.01)).toBe(MIN_SCALE)
    expect(clampScale(0)).toBe(1)
    expect(clampScale(Number.NaN)).toBe(1)
  })

  it('zoomIn/zoomOut nhân-chia theo bước và dừng ở biên', () => {
    expect(zoomInScale(1)).toBeCloseTo(1.25)
    expect(zoomOutScale(1)).toBeCloseTo(0.8)
    expect(zoomInScale(MAX_SCALE)).toBe(MAX_SCALE)
    expect(zoomOutScale(MIN_SCALE)).toBe(MIN_SCALE)
    expect(zoomOutScale(zoomInScale(1.6))).toBeCloseTo(1.6)
  })

  it('computeFitScale vừa cả rộng và cao (trang dọc trong khung ngang)', () => {
    // Trang 612x792, khung 800x600, đệm 24 mỗi phía:
    // min(752/612, 552/792) = 552/792 ≈ 0.697
    expect(computeFitScale(612, 792, 800, 600, 1)).toBeCloseTo(552 / 792, 6)
  })

  it('computeFitScale với trang ngang và khung nhỏ bị clamp ở MIN', () => {
    expect(computeFitScale(792, 612, 200, 160, 1)).toBe(MIN_SCALE)
  })

  it('computeFitScale giữ nguyên khi kích thước không hợp lệ', () => {
    expect(computeFitScale(612, 792, 10, 10, 1.5)).toBe(1.5)
    expect(computeFitScale(0, 792, 800, 600, 2)).toBe(2)
  })
})
