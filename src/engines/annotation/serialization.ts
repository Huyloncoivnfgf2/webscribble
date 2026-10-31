/**
 * Serialization & validation của annotation (TASK-06C).
 *
 * - Serialize: tạo bản sao tách rời (structuredClone) của các
 *   DrawingObject để repository lưu — bản sao bảo đảm thay đổi
 *   sau đó trong bộ nhớ không làm sai lệch dữ liệu đang chờ lưu.
 * - Deserialize: MỌI object đều phải qua `validateDrawingObject`
 *   của chính Drawing Engine (cấu trúc, trường bắt buộc, bounds
 *   khớp hình học, points/pressure/time của nét, dữ liệu shape và
 *   text) và phải mang đúng surfaceId của surface đang mở. Một
 *   object lỗi → ném AnnotationDataError cho TOÀN BỘ lần nạp:
 *   không nạp một phần, không âm thầm loại object, không đụng
 *   vào bản lưu trong repository.
 */
import { validateDrawingObject } from '../drawing/validation'
import type { DrawingObject } from '../drawing/types'
import { AnnotationDataError } from './errors'

export function serializeDrawingObjects(objects: readonly DrawingObject[]): unknown[] {
  return structuredClone(objects) as unknown[]
}

function extractObjectId(value: unknown): string | null {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export function deserializeDrawingObjects(
  raw: readonly unknown[],
  surfaceId: string,
): DrawingObject[] {
  if (!Array.isArray(raw)) {
    throw new AnnotationDataError({
      surfaceId,
      objectIndex: null,
      objectId: null,
      problems: ['stored annotation objects are not an array'],
    })
  }
  return raw.map((item, index) => {
    const result = validateDrawingObject(item)
    if (!result.valid) {
      throw new AnnotationDataError({
        surfaceId,
        objectIndex: index,
        objectId: extractObjectId(item),
        problems: result.errors,
      })
    }
    const object = item as DrawingObject
    if (object.surfaceId !== surfaceId) {
      throw new AnnotationDataError({
        surfaceId,
        objectIndex: index,
        objectId: object.id,
        problems: [
          `object surfaceId "${object.surfaceId}" does not match the surface being opened "${surfaceId}"`,
        ],
      })
    }
    // Bản sao tách rời: surface làm việc trên dữ liệu của riêng nó,
    // không giữ tham chiếu tới object lấy từ repository.
    return structuredClone(object)
  })
}
