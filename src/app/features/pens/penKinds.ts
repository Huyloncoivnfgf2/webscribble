import type { StrokeKind } from '../../../engines/drawing/index'

/** Nhãn tiếng Việt + thứ tự hiển thị của 8 loại bút (TASK-14D). */
export const PEN_KIND_LABELS: Record<StrokeKind, string> = {
  pen: 'Bút mực',
  highlighter: 'Dạ quang',
  pencil: 'Bút chì',
  ballpoint: 'Bút bi',
  marker: 'Bút dạ',
  'fine-pen': 'Bút nét mảnh',
  'thick-pen': 'Bút nét dày',
  watercolor: 'Màu nước',
}

export const PEN_KIND_ORDER: readonly StrokeKind[] = [
  'pen',
  'pencil',
  'ballpoint',
  'marker',
  'fine-pen',
  'thick-pen',
  'watercolor',
  'highlighter',
]
