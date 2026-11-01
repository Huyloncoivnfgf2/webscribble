/**
 * Logic trạng thái THUẦN của PDF Viewer (TASK-06E): điều hướng
 * trang, zoom và fit — không phụ thuộc React hay engine, kiểm
 * thử độc lập được.
 */

/** Giới hạn zoom: 25% đến 400%. */
export const MIN_SCALE = 0.25
export const MAX_SCALE = 4
/** Mỗi lần zoom in/out nhân với hệ số này. */
export const ZOOM_STEP = 1.25
/** Khoảng đệm (CSS px) quanh trang khi fit. */
export const FIT_PADDING = 24

import type { StrokeKind } from '../../../engines/drawing/index'

/** Công cụ của viewer: mọi loại bút (TASK-14D) hoặc tẩy nét. */
export type ViewerTool = StrokeKind | 'stroke-eraser'

export function clampPageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0
  if (!Number.isFinite(index)) return 0
  return Math.min(Math.max(Math.trunc(index), 0), pageCount - 1)
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)
}

export function zoomInScale(current: number): number {
  return clampScale(current * ZOOM_STEP)
}

export function zoomOutScale(current: number): number {
  return clampScale(current / ZOOM_STEP)
}

/**
 * Scale để trang vừa khít vùng hiển thị (cả rộng và cao đều
 * vừa), chừa FIT_PADDING mỗi phía. Kích thước vùng không hợp lệ
 * → giữ nguyên scale hiện tại.
 */
export function computeFitScale(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  currentScale: number,
): number {
  const availableWidth = containerWidth - FIT_PADDING * 2
  const availableHeight = containerHeight - FIT_PADDING * 2
  if (
    pageWidth <= 0 ||
    pageHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return clampScale(currentScale)
  }
  return clampScale(Math.min(availableWidth / pageWidth, availableHeight / pageHeight))
}
