import { StarterKit } from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import type { Extensions } from '@tiptap/core'

/**
 * Bộ extension Tiptap của Word Editor (TASK-07B) — dùng
 * chung giữa component React và test headless để hai bên
 * không bao giờ lệch schema.
 *
 * StarterKit 3.x đã gồm: Document, Paragraph, Text, Heading,
 * Blockquote, BulletList/OrderedList/ListItem (qua List),
 * CodeBlock, HorizontalRule, HardBreak, Bold, Italic,
 * Strike, Code, **Underline và Link** (từ Tiptap 3 hai
 * extension này nằm trong StarterKit — KHÔNG đăng ký lại),
 * History (undo/redo), Dropcursor, Gapcursor, ListKeymap.
 * Bổ sung ngoài StarterKit: Image và bộ Table — khớp đúng
 * Content Model của TASK-07A.
 *
 * TASK-07C bổ sung cho fidelity: TextStyle + Color +
 * BackgroundColor + FontSize + FontFamily (mark textStyle
 * của Content Model v2), Superscript/Subscript,
 * TextAlign cho heading/paragraph, và các attrs mở rộng:
 * width/height trên Image, background trên ô bảng. Không có
 * các extension này, định dạng nhập vào sẽ bị editor lặng
 * lẽ loại bỏ ngay khi nạp nội dung.
 *
 * Link: tắt openOnClick để bấm vào liên kết khi đang sửa
 * không điều hướng khỏi editor.
 */

const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = Number(element.getAttribute('width'))
          return Number.isFinite(value) && value > 0 ? value : null
        },
        renderHTML: (attributes: { width?: number | null }) =>
          attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = Number(element.getAttribute('height'))
          return Number.isFinite(value) && value > 0 ? value : null
        },
        renderHTML: (attributes: { height?: number | null }) =>
          attributes.height ? { height: attributes.height } : {},
      },
    }
  },
})

function backgroundAttribute() {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
    renderHTML: (attributes: { background?: string | null }) =>
      attributes.background ? { style: `background-color: ${attributes.background}` } : {},
  }
}

const ShadedTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), background: backgroundAttribute() }
  },
})

const ShadedTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), background: backgroundAttribute() }
  },
})

export function createWordEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
    }),
    TextStyle,
    Color,
    BackgroundColor,
    FontSize,
    FontFamily,
    Superscript,
    Subscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    SizedImage,
    Table.configure({ resizable: false }),
    TableRow,
    ShadedTableHeader,
    ShadedTableCell,
  ]
}
