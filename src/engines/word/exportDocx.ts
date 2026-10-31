import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  HighlightColor,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx'
import {
  validateWordContent,
  type WordBlockNode,
  type WordDocumentContent,
  type WordInlineNode,
  type WordMark,
} from './contentModel'
import { WORD_HIGHLIGHT_COLORS } from './enrichment'

/**
 * Xuất DOCX (TASK-07E, DEC-018/DEC-030): chuyển Word
 * Content Model (bản đã sửa trong editor) thành một file
 * .docx MỚI bằng thư viện `docx` (MIT, đóng gói local).
 * File gốc không bao giờ bị đụng — kết quả là một Blob để
 * trình duyệt tải xuống.
 *
 * Bảo toàn theo đúng phạm vi fidelity của TASK-07C:
 * heading, textAlign, danh sách (gồm lồng nhau), bảng
 * (header/nền ô/colspan/rowspan), marks bold/italic/
 * underline/strike/code/superscript/subscript/link,
 * textStyle (màu chữ, cỡ chữ, font, highlight), ảnh kèm
 * kích thước. Đánh đổi ghi nhận: highlight chỉ dùng được
 * tên màu trong bảng Word — hex khớp bảng màu thì xuất
 * bằng w:highlight (đọc lại được), hex khác xuất bằng
 * shading (Word hiển thị đúng nhưng importer của app
 * không đọc lại shading của run); thứ tự đánh số của mỗi
 * danh sách số được khởi động lại từ 1.
 */

export type DocxExportErrorKind = 'invalid-content' | 'export-failed'

export class DocxExportError extends Error {
  readonly kind: DocxExportErrorKind
  constructor(kind: DocxExportErrorKind, options: { cause?: unknown } = {}) {
    super(
      kind === 'invalid-content'
        ? 'Nội dung hiện tại không hợp lệ nên không xuất được.'
        : 'Không tạo được file DOCX. Hãy thử lại.',
      options,
    )
    this.name = 'DocxExportError'
    this.kind = kind
  }
}

export interface DocxExportResult {
  blob: Blob
  /** Ghi chú về những gì không xuất được trọn vẹn (không phải lỗi). */
  warnings: string[]
}

/** Tên file mặc định: "<tên gốc>_edited.docx" đã làm sạch. */
export function sanitizeExportBaseName(name: string): string {
  const withoutExtension = name.replace(/\.(docx|doc)$/i, '')
  const withoutControls = [...withoutExtension]
    .map((ch) => (ch.charCodeAt(0) < 0x20 ? ' ' : ch))
    .join('')
  const cleaned = withoutControls
    .normalize('NFC')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return cleaned === '' ? 'tai-lieu' : cleaned
}

export function buildDocxExportFileName(originalName: string): string {
  return `${sanitizeExportBaseName(originalName)}_edited.docx`
}

/** Chuẩn hóa tên file người dùng gõ trong dialog xuất. */
export function normalizeExportFileName(input: string): string {
  const base = sanitizeExportBaseName(input.replace(/\.docx$/i, ''))
  return `${base}.docx`
}

// ── Ánh xạ marks ──────────────────────────────────────────

const HEX_TO_HIGHLIGHT = new Map<string, string>(
  Object.entries(WORD_HIGHLIGHT_COLORS).map(([name, hex]) => [hex.toUpperCase(), name]),
)

interface RunStyle {
  bold?: boolean
  italics?: boolean
  underline?: { type: typeof UnderlineType.SINGLE }
  strike?: boolean
  superScript?: boolean
  subScript?: boolean
  color?: string
  size?: number
  font?: string
  highlight?: (typeof HighlightColor)[keyof typeof HighlightColor]
  shading?: { type: typeof ShadingType.CLEAR; fill: string; color: string }
}

function fontSizeToHalfPoints(fontSize: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(fontSize)
  if (!match) return undefined
  const value = Number(match[1])
  const points = match[2] === 'px' ? value * 0.75 : value
  return Math.max(1, Math.round(points * 2))
}

function styleFromMarks(marks: WordMark[]): RunStyle {
  const style: RunStyle = {}
  let link: string | undefined
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': style.bold = true; break
      case 'italic': style.italics = true; break
      case 'underline': style.underline = { type: UnderlineType.SINGLE }; break
      case 'strike': style.strike = true; break
      case 'superscript': style.superScript = true; break
      case 'subscript': style.subScript = true; break
      case 'code': style.font = 'Consolas'; break
      case 'link': link = mark.attrs?.href; break
      case 'textStyle': {
        const attrs = mark.attrs ?? {}
        if (attrs.color) style.color = attrs.color.replace('#', '')
        if (attrs.fontFamily) style.font = attrs.fontFamily
        if (attrs.fontSize) {
          const size = fontSizeToHalfPoints(attrs.fontSize)
          if (size !== undefined) style.size = size
        }
        if (attrs.backgroundColor) {
          const hex = attrs.backgroundColor.toUpperCase()
          const highlightName = HEX_TO_HIGHLIGHT.get(hex)
          if (highlightName !== undefined) {
            style.highlight = highlightName as (typeof HighlightColor)[keyof typeof HighlightColor]
          } else {
            style.shading = { type: ShadingType.CLEAR, fill: hex.replace('#', ''), color: 'auto' }
          }
        }
        break
      }
    }
  }
  return Object.assign(style, link !== undefined ? { __link: link } : {})
}

type MarkedStyle = RunStyle & { __link?: string }

function inlineToRuns(nodes: WordInlineNode[] | undefined): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }))
      continue
    }
    if (node.type !== 'text') continue
    const style = styleFromMarks(node.marks ?? []) as MarkedStyle
    const { __link, ...runStyle } = style
    if (__link !== undefined) {
      runs.push(
        new ExternalHyperlink({
          link: __link,
          children: [new TextRun({ text: node.text, style: 'Hyperlink', ...runStyle })],
        }),
      )
    } else {
      runs.push(new TextRun({ text: node.text, ...runStyle }))
    }
  }
  return runs
}

// ── Ánh xạ blocks ─────────────────────────────────────────

const ALIGNMENTS: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

interface ExportContext {
  warnings: string[]
  orderedListCount: number
}

type FileChild = Paragraph | Table

function paragraphBlock(
  block: WordBlockNode,
  extra: {
    listProps?: { bulletLevel?: number; numberingRef?: string; numberingLevel?: number }
    styleName?: string
  } = {},
): Paragraph {
  const align = typeof block.attrs?.textAlign === 'string' ? ALIGNMENTS[block.attrs.textAlign] : undefined
  const children = inlineToRuns(block.content as WordInlineNode[] | undefined)
  const heading =
    block.type === 'heading'
      ? HEADING_LEVELS[Math.min(6, Math.max(1, typeof block.attrs?.level === 'number' ? block.attrs.level : 1)) - 1]
      : undefined
  return new Paragraph({
    ...(align !== undefined ? { alignment: align } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...(extra.styleName !== undefined ? { style: extra.styleName } : {}),
    ...(extra.listProps?.bulletLevel !== undefined ? { bullet: { level: extra.listProps.bulletLevel } } : {}),
    ...(extra.listProps?.numberingRef !== undefined
      ? { numbering: { reference: extra.listProps.numberingRef, level: extra.listProps.numberingLevel ?? 0 } }
      : {}),
    ...(heading !== undefined ? { heading } : {}),
  })
}

function listToParagraphs(list: WordBlockNode, level: number, ctx: ExportContext): FileChild[] {
  const out: FileChild[] = []
  const ordered = list.type === 'orderedList'
  let numberingRef: string | undefined
  if (ordered) {
    ctx.orderedListCount += 1
    numberingRef = `ws-ordered-${ctx.orderedListCount}`
  }
  for (const item of list.content ?? []) {
    if (item.type !== 'listItem') continue
    let firstParagraphHandled = false
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph' && !firstParagraphHandled) {
        out.push(
          paragraphBlock(child, {
            listProps: ordered
              ? { numberingRef, numberingLevel: level }
              : { bulletLevel: level },
          }),
        )
        firstParagraphHandled = true
      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
        out.push(...listToParagraphs(child, level + 1, ctx))
      } else {
        out.push(...blockToChildren(child, ctx))
      }
    }
    if (!firstParagraphHandled) {
      out.push(
        new Paragraph(
          ordered
            ? { numbering: { reference: numberingRef as string, level } }
            : { bullet: { level } },
        ),
      )
    }
  }
  return out
}

function dataUriToBytes(src: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Uint8Array } | null {
  const match = /^data:image\/(png|jpeg|jpg|gif|bmp);base64,([A-Za-z0-9+/=]+)$/.exec(src)
  if (!match) return null
  const binary = atob(match[2])
  const data = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) data[i] = binary.charCodeAt(i)
  return { type: match[1] === 'jpeg' ? 'jpg' : (match[1] as 'png' | 'jpg' | 'gif' | 'bmp'), data }
}

/** Đọc kích thước thật từ header PNG (IHDR) khi model không có. */
function pngDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function imageBlock(block: WordBlockNode, ctx: ExportContext): Paragraph | null {
  const src = typeof block.attrs?.src === 'string' ? block.attrs.src : ''
  const parsed = dataUriToBytes(src)
  if (parsed === null) {
    ctx.warnings.push('Một ảnh không xuất được (định dạng ảnh không hỗ trợ xuất DOCX).')
    return null
  }
  const widthAttr = typeof block.attrs?.width === 'number' ? block.attrs.width : undefined
  const heightAttr = typeof block.attrs?.height === 'number' ? block.attrs.height : undefined
  let width = widthAttr ?? 0
  let height = heightAttr ?? 0
  if (!(width > 0) || !(height > 0)) {
    const natural = parsed.type === 'png' ? pngDimensions(parsed.data) : null
    if (natural !== null && natural.width > 0) {
      const scale = Math.min(1, 600 / natural.width)
      width = Math.round(natural.width * scale)
      height = Math.round(natural.height * scale)
    } else {
      width = 480
      height = 320
      ctx.warnings.push('Một ảnh không rõ kích thước gốc — đã xuất ở kích thước mặc định.')
    }
  }
  return new Paragraph({
    children: [
      new ImageRun({
        type: parsed.type,
        data: parsed.data,
        transformation: { width, height },
        ...(typeof block.attrs?.alt === 'string' && block.attrs.alt !== ''
          ? { altText: { title: block.attrs.alt, description: block.attrs.alt, name: 'image' } }
          : {}),
      }),
    ],
  })
}

function tableBlock(block: WordBlockNode, ctx: ExportContext): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'B6C2CF' }
  const rows: TableRow[] = []
  for (const row of block.content ?? []) {
    if (row.type !== 'tableRow') continue
    const cells: TableCell[] = []
    let isHeaderRow = false
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue
      if (cell.type === 'tableHeader') isHeaderRow = true
      const background =
        typeof cell.attrs?.background === 'string' ? cell.attrs.background.replace('#', '') : undefined
      const columnSpan = typeof cell.attrs?.colspan === 'number' ? cell.attrs.colspan : undefined
      const rowSpan = typeof cell.attrs?.rowspan === 'number' ? cell.attrs.rowspan : undefined
      const children = blocksToChildren(cell.content ?? [], ctx)
      cells.push(
        new TableCell({
          children: children.length > 0 ? children : [new Paragraph({})],
          ...(background !== undefined
            ? { shading: { type: ShadingType.CLEAR, fill: background, color: 'auto' } }
            : {}),
          ...(columnSpan !== undefined && columnSpan > 1 ? { columnSpan } : {}),
          ...(rowSpan !== undefined && rowSpan > 1 ? { rowSpan } : {}),
        }),
      )
    }
    rows.push(new TableRow({ children: cells, tableHeader: isHeaderRow }))
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
  })
}

function blockToChildren(block: WordBlockNode, ctx: ExportContext): FileChild[] {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return [paragraphBlock(block)]
    case 'blockquote': {
      // Đoạn trong trích dẫn mang style Quote của Word;
      // các khối khác (danh sách/bảng) giữ nguyên cấu trúc.
      const out: FileChild[] = []
      for (const child of block.content ?? []) {
        if (child.type === 'paragraph' || child.type === 'heading') {
          out.push(paragraphBlock(child, { styleName: 'Quote' }))
        } else {
          out.push(...blockToChildren(child, ctx))
        }
      }
      return out
    }
    case 'codeBlock': {
      const text = (block.content ?? [])
        .map((n) => {
          const node = n as { type: string; text?: string }
          return node.type === 'text' ? (node.text ?? '') : ''
        })
        .join('')
      return text.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: 'Consolas', size: 20 })],
            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
          }),
      )
    }
    case 'bulletList':
    case 'orderedList':
      return listToParagraphs(block, 0, ctx)
    case 'table':
      return [tableBlock(block, ctx)]
    case 'image': {
      const image = imageBlock(block, ctx)
      return image !== null ? [image] : []
    }
    case 'horizontalRule':
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8', space: 1 } },
        }),
      ]
    default:
      ctx.warnings.push(`Một khối nội dung loại "${block.type}" không xuất được.`)
      return []
  }
}

function blocksToChildren(blocks: WordBlockNode[], ctx: ExportContext): FileChild[] {
  const out: FileChild[] = []
  for (const block of blocks) out.push(...blockToChildren(block, ctx))
  return out
}

/** Chuyển Content Model thành Blob DOCX mới. */
export async function exportContentToDocx(content: WordDocumentContent): Promise<DocxExportResult> {
  const validation = validateWordContent(content)
  if (!validation.valid) {
    throw new DocxExportError('invalid-content', { cause: new Error(validation.errors.join('; ')) })
  }
  const ctx: ExportContext = { warnings: [], orderedListCount: 0 }
  try {
    const children = blocksToChildren(content.content, ctx)
    const numberingConfig = Array.from({ length: ctx.orderedListCount }, (_, i) => ({
      reference: `ws-ordered-${i + 1}`,
      levels: Array.from({ length: 9 }, (_, level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
      })),
    }))
    const document = new Document({
      ...(numberingConfig.length > 0 ? { numbering: { config: numberingConfig } } : {}),
      sections: [{ children }],
    })
    const blob = await Packer.toBlob(document)
    return { blob, warnings: ctx.warnings }
  } catch (cause) {
    if (cause instanceof DocxExportError) throw cause
    throw new DocxExportError('export-failed', { cause })
  }
}
