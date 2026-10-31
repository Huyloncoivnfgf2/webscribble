import { arrowBounds, shapeObjectBounds, strokeBounds, textBounds } from './geometry'
import type {
  ArrowObject,
  EllipseObject,
  HighlighterStrokeObject,
  LineObject,
  ObjectId,
  PenStrokeObject,
  Point,
  RectangleObject,
  ShapeStyle,
  StrokePoint,
  StrokeStyle,
  SurfaceId,
  TextObject,
  TextStyle,
} from './types'

/**
 * Sinh ID duy nhất cho object. Ưu tiên `crypto.randomUUID()` (có sẵn
 * trên trình duyệt hiện đại và Node); phương án dự phòng kết hợp thời
 * gian + bộ đếm + số ngẫu nhiên để vẫn duy nhất trong một phiên chạy.
 */
let fallbackCounter = 0

export function createObjectId(): ObjectId {
  const cryptoRef = globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  fallbackCounter += 1
  const random = Math.floor(Math.random() * 0xffffffff).toString(36)
  return `obj-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${random}`
}

export const DEFAULT_PEN_STYLE: StrokeStyle = {
  color: '#111827',
  size: 3,
  opacity: 1,
}

export const DEFAULT_HIGHLIGHTER_STYLE: StrokeStyle = {
  color: '#fde047',
  size: 14,
  opacity: 0.4,
}

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  strokeColor: '#111827',
  strokeWidth: 2,
  fillColor: null,
  opacity: 1,
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  color: '#111827',
  fontSize: 16,
  fontFamily: 'sans-serif',
}

interface BaseInput {
  surfaceId: SurfaceId
  /** Bỏ qua để tự sinh ID. */
  id?: ObjectId
  /** Bỏ qua để dùng thời điểm hiện tại (epoch ms). */
  createdAt?: number
}

function baseFields(input: BaseInput): {
  id: ObjectId
  surfaceId: SurfaceId
  createdAt: number
  updatedAt: number
} {
  const createdAt = input.createdAt ?? Date.now()
  return {
    id: input.id ?? createObjectId(),
    surfaceId: input.surfaceId,
    createdAt,
    updatedAt: createdAt,
  }
}

function requirePoints(points: readonly StrokePoint[], factory: string): void {
  if (points.length === 0) {
    throw new Error(`${factory}: a stroke needs at least one point`)
  }
}

export interface CreateStrokeInput extends BaseInput {
  points: readonly StrokePoint[]
  style?: Partial<StrokeStyle>
}

export function createPenStroke(input: CreateStrokeInput): PenStrokeObject {
  requirePoints(input.points, 'createPenStroke')
  const style: StrokeStyle = { ...DEFAULT_PEN_STYLE, ...input.style }
  return {
    ...baseFields(input),
    type: 'pen',
    points: input.points,
    style,
    bounds: strokeBounds(input.points, style.size),
  }
}

export function createHighlighterStroke(input: CreateStrokeInput): HighlighterStrokeObject {
  requirePoints(input.points, 'createHighlighterStroke')
  const style: StrokeStyle = { ...DEFAULT_HIGHLIGHTER_STYLE, ...input.style }
  return {
    ...baseFields(input),
    type: 'highlighter',
    points: input.points,
    style,
    bounds: strokeBounds(input.points, style.size),
  }
}

export interface CreateShapeInput extends BaseInput {
  start: Point
  end: Point
  style?: Partial<ShapeStyle>
}

function shapeStyle(input: CreateShapeInput): ShapeStyle {
  return { ...DEFAULT_SHAPE_STYLE, ...input.style }
}

export function createLine(input: CreateShapeInput): LineObject {
  const style = shapeStyle(input)
  return {
    ...baseFields(input),
    type: 'line',
    start: input.start,
    end: input.end,
    style,
    bounds: shapeObjectBounds(input.start, input.end, style.strokeWidth),
  }
}

export function createRectangle(input: CreateShapeInput): RectangleObject {
  const style = shapeStyle(input)
  return {
    ...baseFields(input),
    type: 'rectangle',
    start: input.start,
    end: input.end,
    style,
    bounds: shapeObjectBounds(input.start, input.end, style.strokeWidth),
  }
}

export function createEllipse(input: CreateShapeInput): EllipseObject {
  const style = shapeStyle(input)
  return {
    ...baseFields(input),
    type: 'ellipse',
    start: input.start,
    end: input.end,
    style,
    bounds: shapeObjectBounds(input.start, input.end, style.strokeWidth),
  }
}

export function createArrow(input: CreateShapeInput): ArrowObject {
  const style = shapeStyle(input)
  return {
    ...baseFields(input),
    type: 'arrow',
    start: input.start,
    end: input.end,
    style,
    bounds: arrowBounds(input.start, input.end, style.strokeWidth),
  }
}

export interface CreateTextInput extends BaseInput {
  position: Point
  text: string
  width: number
  height: number
  style?: Partial<TextStyle>
}

export function createText(input: CreateTextInput): TextObject {
  if (!(input.width > 0) || !(input.height > 0)) {
    throw new Error(
      `createText: width and height must be positive, got ${input.width}x${input.height}`,
    )
  }
  return {
    ...baseFields(input),
    type: 'text',
    position: input.position,
    text: input.text,
    width: input.width,
    height: input.height,
    style: { ...DEFAULT_TEXT_STYLE, ...input.style },
    bounds: textBounds(input.position, input.width, input.height),
  }
}
