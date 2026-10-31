import { boundsEqual, computeObjectBounds } from './geometry'
import type { Bounds, DrawingObject, Point, StrokePoint } from './types'

/**
 * Kiểm chứng dữ liệu object — dùng khi nạp dữ liệu từ persistence
 * (TASK-08) hoặc bản sao lưu (DEC-022), nơi dữ liệu không còn được đảm
 * bảo bởi các factory trong `objects.ts`.
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isBounds(value: unknown): value is Bounds {
  return (
    isRecord(value) &&
    isFiniteNumber(value.minX) &&
    isFiniteNumber(value.minY) &&
    isFiniteNumber(value.maxX) &&
    isFiniteNumber(value.maxY) &&
    value.minX <= value.maxX &&
    value.minY <= value.maxY
  )
}

function checkUnitInterval(value: unknown, label: string, errors: string[]): void {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    errors.push(`${label} must be a number in [0, 1]`)
  }
}

function checkStrokePoint(value: unknown, index: number, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`points[${index}] must be an object`)
    return
  }
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    errors.push(`points[${index}] must have finite x and y`)
  }
  if (!isFiniteNumber(value.pressure) || value.pressure < 0 || value.pressure > 1) {
    errors.push(`points[${index}].pressure must be in [0, 1]`)
  }
  if (!isFiniteNumber(value.time) || value.time < 0) {
    errors.push(`points[${index}].time must be a number >= 0`)
  }
}

const OBJECT_TYPES: readonly string[] = [
  'pen',
  'highlighter',
  'line',
  'rectangle',
  'ellipse',
  'arrow',
  'text',
]

export function validateDrawingObject(value: unknown): ValidationResult {
  const errors: string[] = []

  if (!isRecord(value)) {
    return { valid: false, errors: ['object must be a non-null object'] }
  }

  if (!isNonEmptyString(value.id)) errors.push('id must be a non-empty string')
  if (!isNonEmptyString(value.surfaceId)) {
    errors.push('surfaceId must be a non-empty string')
  }
  if (!isFiniteNumber(value.createdAt)) errors.push('createdAt must be a finite number')
  if (!isFiniteNumber(value.updatedAt)) errors.push('updatedAt must be a finite number')
  if (!isBounds(value.bounds)) {
    errors.push('bounds must have finite minX/minY/maxX/maxY with min <= max')
  }
  if (typeof value.type !== 'string' || !OBJECT_TYPES.includes(value.type)) {
    errors.push(`type must be one of: ${OBJECT_TYPES.join(', ')}`)
    return { valid: false, errors }
  }

  if (value.type === 'pen' || value.type === 'highlighter') {
    if (!Array.isArray(value.points) || value.points.length === 0) {
      errors.push('points must be a non-empty array')
    } else {
      value.points.forEach((point: unknown, index: number) =>
        checkStrokePoint(point, index, errors),
      )
    }
    if (!isRecord(value.style)) {
      errors.push('style must be an object')
    } else {
      if (typeof value.style.color !== 'string') errors.push('style.color must be a string')
      if (!isFiniteNumber(value.style.size) || value.style.size <= 0) {
        errors.push('style.size must be a positive number')
      }
      checkUnitInterval(value.style.opacity, 'style.opacity', errors)
    }
  } else if (value.type === 'text') {
    if (!isPoint(value.position)) errors.push('position must have finite x and y')
    if (typeof value.text !== 'string') errors.push('text must be a string')
    if (!isFiniteNumber(value.width) || value.width <= 0) {
      errors.push('width must be a positive number')
    }
    if (!isFiniteNumber(value.height) || value.height <= 0) {
      errors.push('height must be a positive number')
    }
    if (!isRecord(value.style)) {
      errors.push('style must be an object')
    } else {
      if (typeof value.style.color !== 'string') errors.push('style.color must be a string')
      if (!isFiniteNumber(value.style.fontSize) || value.style.fontSize <= 0) {
        errors.push('style.fontSize must be a positive number')
      }
      if (typeof value.style.fontFamily !== 'string') {
        errors.push('style.fontFamily must be a string')
      }
    }
  } else {
    // line | rectangle | ellipse | arrow
    if (!isPoint(value.start)) errors.push('start must have finite x and y')
    if (!isPoint(value.end)) errors.push('end must have finite x and y')
    if (!isRecord(value.style)) {
      errors.push('style must be an object')
    } else {
      if (typeof value.style.strokeColor !== 'string') {
        errors.push('style.strokeColor must be a string')
      }
      if (!isFiniteNumber(value.style.strokeWidth) || value.style.strokeWidth <= 0) {
        errors.push('style.strokeWidth must be a positive number')
      }
      if (value.style.fillColor !== null && typeof value.style.fillColor !== 'string') {
        errors.push('style.fillColor must be a string or null')
      }
      checkUnitInterval(value.style.opacity, 'style.opacity', errors)
    }
  }

  if (errors.length === 0) {
    // Mọi kiểm tra cấu trúc đã đạt — giờ kiểm tra tính nhất quán:
    // bounds đã lưu phải khớp bounds tính lại từ dữ liệu riêng.
    const object = value as unknown as DrawingObject
    if (!boundsEqual(object.bounds, computeObjectBounds(object))) {
      errors.push('bounds do not match the bounds computed from the object data')
    }
    // Kiểm tra bổ sung cho stroke: time không giảm dần.
    if (object.type === 'pen' || object.type === 'highlighter') {
      const points: readonly StrokePoint[] = object.points
      for (let i = 1; i < points.length; i += 1) {
        if (points[i].time < points[i - 1].time) {
          errors.push('points time must be non-decreasing within a stroke')
          break
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/** Type guard tiện dụng dựa trên validateDrawingObject. */
export function isDrawingObject(value: unknown): value is DrawingObject {
  return validateDrawingObject(value).valid
}
