import {
  createEmptyWordContent,
  type WordBlockNode,
  type WordDocumentContent,
  type WordInlineNode,
  type WordMark,
} from './contentModel'
import { WORD_HIGHLIGHT_COLORS } from './enrichment'

/**
 * Chuyển HTML ĐÃ SANITIZE thành mô hình nội dung Word
 * (TASK-07A). Chỉ chạy trên HTML đã qua `sanitizeImportedHtml`
 * — hàm này không tự sanitize.
 *
 * Ánh xạ: p → paragraph; h1–h6 → heading; ul/ol/li → lists;
 * blockquote; pre → codeBlock; table/tr/td/th; img → image
 * (ảnh nằm trong đoạn được nâng thành block riêng, đoạn bị
 * tách tại vị trí ảnh — đúng mô hình block của ProseMirror);
 * b/strong, i/em, u, s, code, a[href] → marks; br → hardBreak.
 * TASK-07C bổ sung: sup/sub → marks superscript/subscript;
 * span class ws-* → mark textStyle; data-ws-align →
 * textAlign; data-ws-bg → background ô; colspan/rowspan và
 * width/height của ảnh được giữ lại. Phần tử không quen
 * thuộc khác được "mở trong suốt" (giữ nội dung con) thay vì
 * loại bỏ — Mammoth chỉ sinh HTML ngữ nghĩa nên bề mặt hẹp.
 */

export interface DomParserLike {
  parseFromString(serialized: string, type: string): Document
}

const ELEMENT_NODE = 1
const TEXT_NODE = 3

/**
 * Mảnh ảnh đứng riêng lẻ trong dòng inline — khai báo hẹp với
 * `type: 'image'` literal để TypeScript phân biệt được với các
 * mảnh inline khi tách (WordBlockNode.type là string nên không
 * tự thu hẹp được).
 */
type ImagePiece = {
  type: 'image'
  attrs: { src: string; alt?: string; width?: number; height?: number }
}

type Piece = WordInlineNode | ImagePiece

function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE
}

function imageBlock(img: Element): ImagePiece {
  const src = img.getAttribute('src') ?? ''
  const alt = img.getAttribute('alt')
  const attrs: ImagePiece['attrs'] = alt !== null && alt !== '' ? { src, alt } : { src }
  // TASK-07C: kích thước hiển thị do enrichment ghi lên
  // thuộc tính width/height của <img> (từ wp:extent gốc).
  for (const key of ['width', 'height'] as const) {
    const raw = img.getAttribute(key)
    const value = raw !== null ? Number(raw) : NaN
    if (Number.isFinite(value) && value > 0) attrs[key] = value
  }
  return { type: 'image', attrs }
}

/**
 * Registry font của lần chuyển đổi hiện tại (TASK-07C):
 * class `ws-ff-<i>` trên span tham chiếu fonts[i]. Gán
 * trong htmlToWordContent và dọn ngay sau — chuyển đổi là
 * đồng bộ nên không có nguy cơ đan xen.
 */
let activeFontFamilies: string[] = []

/** Giải mã các class ws-* (style map động của importer) thành attrs textStyle. */
function decodeWsSpanClasses(el: Element): WordMark['attrs'] | null {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  const attrs: NonNullable<WordMark['attrs']> = {}
  for (const cls of classes) {
    const fs = /^ws-fs(\d+(?:p\d+)?)$/.exec(cls)
    if (fs) {
      attrs.fontSize = `${fs[1].replace('p', '.')}pt`
      continue
    }
    const hl = /^ws-hl-([A-Za-z]+)$/.exec(cls)
    if (hl) {
      const hex = WORD_HIGHLIGHT_COLORS[hl[1]]
      if (hex) attrs.backgroundColor = hex
      continue
    }
    const ff = /^ws-ff(\d+)$/.exec(cls)
    if (ff) {
      const family = activeFontFamilies[Number(ff[1])]
      if (family) attrs.fontFamily = family
    }
  }
  return Object.keys(attrs).length > 0 ? attrs : null
}

/** Gán textAlign (từ data-ws-align của enrichment) lên một block đoạn/heading. */
function applyAlign(block: WordBlockNode, el: Element): void {
  const align = el.getAttribute('data-ws-align')
  if (align) block.attrs = { ...(block.attrs ?? {}), textAlign: align }
}

/** Chuyển một danh sách node con thành các mảnh inline (+ image block lẻ). */
function convertInlineNodes(nodes: ArrayLike<Node>, marks: WordMark[]): Piece[] {
  const pieces: Piece[] = []
  const pushText = (text: string) => {
    if (text === '') return
    const node: WordInlineNode =
      marks.length > 0
        ? { type: 'text', text, marks: marks.map((m) => ({ ...m })) }
        : { type: 'text', text }
    pieces.push(node)
  }
  for (const node of Array.from(nodes)) {
    if (node.nodeType === TEXT_NODE) {
      pushText(node.textContent ?? '')
      continue
    }
    if (!isElement(node)) continue
    switch (node.tagName) {
      case 'BR':
        pieces.push({ type: 'hardBreak' })
        break
      case 'B':
      case 'STRONG':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'bold' }]))
        break
      case 'I':
      case 'EM':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'italic' }]))
        break
      case 'U':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'underline' }]))
        break
      case 'S':
      case 'STRIKE':
      case 'DEL':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'strike' }]))
        break
      case 'CODE':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'code' }]))
        break
      case 'SUP':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'superscript' }]))
        break
      case 'SUB':
        pieces.push(...convertInlineNodes(node.childNodes, [...marks, { type: 'subscript' }]))
        break
      case 'SPAN': {
        // TASK-07C: span mang class ws-* = định dạng ký tự
        // trực tiếp (cỡ chữ/highlight/font) do importer
        // truyền qua style map động. Span thường: trong suốt.
        const styleAttrs = decodeWsSpanClasses(node)
        const nextMarks = styleAttrs ? [...marks, { type: 'textStyle' as const, attrs: styleAttrs }] : marks
        pieces.push(...convertInlineNodes(node.childNodes, nextMarks))
        break
      }
      case 'A': {
        const href = node.getAttribute('href')
        const nextMarks =
          href !== null && href !== '' ? [...marks, { type: 'link' as const, attrs: { href } }] : marks
        pieces.push(...convertInlineNodes(node.childNodes, nextMarks))
        break
      }
      case 'IMG':
        pieces.push(imageBlock(node))
        break
      default:
        // SPAN/FONT/SUB/SUP và mọi phần tử inline lạ: trong suốt.
        pieces.push(...convertInlineNodes(node.childNodes, marks))
        break
    }
  }
  return pieces
}

/** Tách các mảnh của một container inline thành block: đoạn văn + ảnh đứng riêng. */
function inlineContainerToBlocks(el: Element, makeBlock: (content: WordInlineNode[]) => WordBlockNode): WordBlockNode[] {
  const pieces = convertInlineNodes(el.childNodes, [])
  const blocks: WordBlockNode[] = []
  let run: WordInlineNode[] = []
  const flush = () => {
    if (run.length > 0) {
      blocks.push(makeBlock(run))
      run = []
    }
  }
  for (const piece of pieces) {
    if (piece.type === 'image') {
      flush()
      blocks.push(piece)
    } else {
      run.push(piece)
    }
  }
  flush()
  return blocks
}

function convertTable(table: Element): WordBlockNode {
  const rows: WordBlockNode[] = []
  const collectRows = (container: Element) => {
    for (const child of Array.from(container.children)) {
      if (child.tagName === 'TR') {
        const cells: WordBlockNode[] = []
        for (const cell of Array.from(child.children)) {
          if (cell.tagName !== 'TD' && cell.tagName !== 'TH') continue
          const cellBlocks = convertBlocks(cell)
          // TASK-07C: nền ô (data-ws-bg của enrichment) và
          // ô gộp (colspan/rowspan Mammoth đã xuất sẵn).
          const cellAttrs: Record<string, unknown> = {}
          const bg = cell.getAttribute('data-ws-bg')
          if (bg && /^#[0-9A-Fa-f]{6}$/.test(bg)) cellAttrs.background = bg
          for (const key of ['colspan', 'rowspan'] as const) {
            const raw = cell.getAttribute(key)
            const value = raw !== null ? Number.parseInt(raw, 10) : NaN
            if (Number.isInteger(value) && value > 1 && value <= 100) cellAttrs[key] = value
          }
          cells.push({
            type: cell.tagName === 'TH' ? 'tableHeader' : 'tableCell',
            ...(Object.keys(cellAttrs).length > 0 ? { attrs: cellAttrs } : {}),
            content: cellBlocks.length > 0 ? cellBlocks : [{ type: 'paragraph' }],
          })
        }
        rows.push({ type: 'tableRow', content: cells })
      } else if (child.tagName === 'THEAD' || child.tagName === 'TBODY' || child.tagName === 'TFOOT') {
        collectRows(child)
      }
    }
  }
  collectRows(table)
  return { type: 'table', content: rows }
}

function convertBlocks(container: Element): WordBlockNode[] {
  const blocks: WordBlockNode[] = []
  let inlineBuffer: Piece[] = []
  const flushInline = () => {
    const pieces = inlineBuffer
    inlineBuffer = []
    // Bỏ buffer chỉ chứa khoảng trắng:
    const meaningful = pieces.filter(
      (p) => p.type !== 'text' || (p as { text?: string }).text?.trim() !== '',
    )
    if (meaningful.length === 0) return
    let run: WordInlineNode[] = []
    const flushRun = () => {
      if (run.length > 0) blocks.push({ type: 'paragraph', content: run })
      run = []
    }
    for (const piece of meaningful) {
      if (piece.type === 'image') {
        flushRun()
        blocks.push(piece)
      } else {
        run.push(piece)
      }
    }
    flushRun()
  }

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      inlineBuffer.push(...convertInlineNodes([child], []))
      continue
    }
    if (!isElement(child)) continue
    const tag = child.tagName
    const headingMatch = /^H([1-6])$/.exec(tag)
    if (tag === 'P') {
      flushInline()
      const produced = inlineContainerToBlocks(child, (content) => ({ type: 'paragraph', content }))
      const finalBlocks = produced.length > 0 ? produced : [{ type: 'paragraph' } as WordBlockNode]
      for (const block of finalBlocks) if (block.type === 'paragraph') applyAlign(block, child)
      blocks.push(...finalBlocks)
    } else if (headingMatch !== null) {
      flushInline()
      const level = Number(headingMatch[1])
      const produced = inlineContainerToBlocks(child, (content) => ({
        type: 'heading',
        attrs: { level },
        content,
      }))
      for (const block of produced) if (block.type === 'heading') applyAlign(block, child)
      blocks.push(...produced)
    } else if (tag === 'UL' || tag === 'OL') {
      flushInline()
      const items: WordBlockNode[] = []
      for (const li of Array.from(child.children)) {
        if (li.tagName !== 'LI') continue
        const itemBlocks = convertBlocks(li)
        // Căn lề của mục danh sách nằm trên đoạn đầu tiên
        // của chính mục đó (data-ws-align đặt trên <li>).
        const firstParagraph = itemBlocks.find((b) => b.type === 'paragraph')
        if (firstParagraph) applyAlign(firstParagraph, li)
        items.push({
          type: 'listItem',
          content: itemBlocks.length > 0 ? itemBlocks : [{ type: 'paragraph' }],
        })
      }
      blocks.push({ type: tag === 'UL' ? 'bulletList' : 'orderedList', content: items })
    } else if (tag === 'BLOCKQUOTE') {
      flushInline()
      blocks.push({ type: 'blockquote', content: convertBlocks(child) })
    } else if (tag === 'PRE') {
      flushInline()
      const text = child.textContent ?? ''
      blocks.push({
        type: 'codeBlock',
        content: text !== '' ? [{ type: 'text', text }] : [],
      })
    } else if (tag === 'TABLE') {
      flushInline()
      blocks.push(convertTable(child))
    } else if (tag === 'IMG') {
      flushInline()
      blocks.push(imageBlock(child))
    } else if (tag === 'HR') {
      flushInline()
      blocks.push({ type: 'horizontalRule' })
    } else if (
      tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN' ||
      tag === 'FIGURE' || tag === 'LI'
    ) {
      flushInline()
      blocks.push(...convertBlocks(child))
    } else {
      // Phần tử inline lạc ở cấp block: gom vào buffer đoạn.
      inlineBuffer.push(...convertInlineNodes([child], []))
    }
  }
  flushInline()
  return blocks
}

export interface HtmlToContentOptions {
  /** Hook chạy trên DOM đã parse trước khi chuyển đổi (enrichment TASK-07C). */
  enrich?: (doc: Document) => void
  /** Registry font family cho class ws-ff-<i>. */
  fontFamilies?: string[]
}

/** Chuyển HTML đã sanitize thành WordDocumentContent. */
export function htmlToWordContent(
  html: string,
  parser?: DomParserLike,
  options: HtmlToContentOptions = {},
): WordDocumentContent {
  const domParser = parser ?? new DOMParser()
  const parsed = domParser.parseFromString(html, 'text/html')
  options.enrich?.(parsed)
  activeFontFamilies = options.fontFamilies ?? []
  try {
    const blocks = convertBlocks(parsed.body)
    return {
      type: 'doc',
      content: blocks.length > 0 ? blocks : createEmptyWordContent().content,
    }
  } finally {
    activeFontFamilies = []
  }
}
