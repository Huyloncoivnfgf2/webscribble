import type { StrokeKind, StrokeStyle } from './types'

/**
 * Hồ sơ bút (TASK-14D, DEC-036): bảng DUY NHẤT ánh xạ mỗi
 * loại nét tự do tới tham số perfect-freehand và cách tô.
 * Renderer, StrokeBuilder, xuất bản đều đọc từ đây — dữ
 * liệu đã lưu chỉ mang `type` + points + style, cảm giác
 * bút suy ra lúc vẽ nên:
 *
 * - pen/highlighter giữ NGUYÊN tham số từ TASK-05
 *   (pen: thinning 0.5; highlighter: thinning 0; cả hai
 *   smoothing/streamline 0.5, simulatePressure false,
 *   hệ số 1, một lớp) — nét cũ hiển thị y hệt như trước,
 *   có test khóa outline theo điểm.
 * - Sáu loại mới cộng thêm thuần túy.
 */
export interface StrokeProfile {
  /** Độ biến thiên bề dày theo áp lực của perfect-freehand (0 = đều tuyệt đối). */
  thinning: number
  smoothing: number
  streamline: number
  simulatePressure: boolean
  /** Nhân vào style.size khi tính outline. */
  sizeScale: number
  /** Nhân vào style.opacity cho MỖI lớp tô. */
  opacityScale: number
  /** Số lớp tô chồng (màu nước > 1: vùng chồng nhau đậm dần). */
  passes: number
  /** Style mặc định khi công cụ chưa được tùy biến. */
  defaultStyle: StrokeStyle
  /** Bảng cỡ S/M/L (world units, TRƯỚC hệ số cỡ) dùng chung mọi controller. */
  sizes: Record<'S' | 'M' | 'L', number>
}

export const STROKE_KINDS: readonly StrokeKind[] = [
  'pen',
  'highlighter',
  'pencil',
  'ballpoint',
  'marker',
  'fine-pen',
  'thick-pen',
  'watercolor',
]

export function isStrokeKind(value: string): value is StrokeKind {
  return (STROKE_KINDS as readonly string[]).includes(value)
}

const INK = '#111827'

export const STROKE_PROFILES: Record<StrokeKind, StrokeProfile> = {
  pen: {
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 1,
    opacityScale: 1,
    passes: 1,
    defaultStyle: { color: INK, size: 3, opacity: 1 },
    sizes: { S: 2, M: 3.5, L: 5 },
  },
  highlighter: {
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 1,
    opacityScale: 1,
    passes: 1,
    defaultStyle: { color: '#fde047', size: 14, opacity: 0.4 },
    sizes: { S: 10, M: 16, L: 24 },
  },
  pencil: {
    // Chì: mỏng, biến thiên mạnh theo áp lực, hơi ráp
    // (streamline thấp), mờ nhẹ như than chì.
    thinning: 0.65,
    smoothing: 0.5,
    streamline: 0.35,
    simulatePressure: false,
    sizeScale: 0.8,
    opacityScale: 0.8,
    passes: 1,
    defaultStyle: { color: INK, size: 2.5, opacity: 0.9 },
    sizes: { S: 1.5, M: 2.5, L: 4 },
  },
  ballpoint: {
    // Bi: thinning gần 0 — bề dày gần như không đổi
    // theo áp lực, đúng cảm giác bút bi.
    thinning: 0.08,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 0.9,
    opacityScale: 1,
    passes: 1,
    defaultStyle: { color: INK, size: 2.5, opacity: 1 },
    sizes: { S: 1.5, M: 2.5, L: 3.5 },
  },
  marker: {
    // Dạ: đầu đều (thinning 0), mực trong mờ.
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 1.1,
    opacityScale: 0.55,
    passes: 1,
    defaultStyle: { color: INK, size: 6, opacity: 0.6 },
    sizes: { S: 4, M: 6, L: 9 },
  },
  'fine-pen': {
    // Nét mảnh: hồ sơ như pen nhưng hệ số cỡ nhỏ.
    thinning: 0.3,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 0.45,
    opacityScale: 1,
    passes: 1,
    defaultStyle: { color: INK, size: 3, opacity: 1 },
    sizes: { S: 2.5, M: 3.5, L: 5 },
  },
  'thick-pen': {
    // Nét dày: hồ sơ như pen nhưng hệ số cỡ lớn.
    thinning: 0.45,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    sizeScale: 2.1,
    opacityScale: 1,
    passes: 1,
    defaultStyle: { color: INK, size: 3, opacity: 1 },
    sizes: { S: 2, M: 3, L: 4.5 },
  },
  watercolor: {
    // Màu nước: nét to mềm, tô chồng 3 lớp alpha thấp —
    // vùng một lớp thì nhạt, vùng chồng thì đậm dần.
    thinning: 0.7,
    smoothing: 0.5,
    streamline: 0.65,
    simulatePressure: false,
    sizeScale: 1.9,
    opacityScale: 0.16,
    passes: 3,
    defaultStyle: { color: '#2563eb', size: 5, opacity: 0.5 },
    sizes: { S: 3.5, M: 5, L: 7 },
  },
}

export function strokeProfile(kind: StrokeKind): StrokeProfile {
  return STROKE_PROFILES[kind]
}
