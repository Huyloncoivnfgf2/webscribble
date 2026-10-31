import JSZip from 'jszip'

/**
 * Bổ sung fidelity cho DOCX từ chính `word/document.xml`
 * (TASK-07C) — phần Mammoth ĐỌC được một phần nhưng không
 * xuất ra HTML (căn lề đoạn), hoặc không đọc hề (tô nền ô,
 * kích thước ảnh).
 *
 * Nguyên tắc an toàn: ba LUỒNG theo thứ tự tài liệu —
 * (1) các đoạn `w:p`, (2) các ảnh `a:blip`, (3) các ô `w:tc`
 * — chỉ được áp dụng khi số phần tử của luồng khớp ĐÚNG với
 * số phần tử tương ứng trong HTML đã chuyển đổi. Lệch số
 * lượng (hộp văn bản, ô gộp dọc, ảnh VML...) → bỏ qua cả
 * luồng đó, không bao giờ gán nhầm. Fidelity là best-effort:
 * trích xuất lỗi → enrichment rỗng, không làm hỏng import.
 */
export interface DocxEnrichment {
  /** textAlign theo từng w:p trong thứ tự tài liệu. */
  paragraphAlignments: (string | null)[]
  /** Kích thước hiển thị (px) theo từng ảnh drawing. */
  imageSizes: ({ width: number; height: number } | null)[]
  /** Màu nền '#RRGGBB' theo từng w:tc. */
  cellBackgrounds: (string | null)[]
  /** Registry font family: class `ws-ff-<i>` ↔ fonts[i]. */
  fontFamilies: string[]
}

export const EMPTY_ENRICHMENT: DocxEnrichment = {
  paragraphAlignments: [],
  imageSizes: [],
  cellBackgrounds: [],
  fontFamilies: [],
}

/** Bảng màu highlight đặt tên của Word → hex (cho textStyle). */
export const WORD_HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#FFFF00',
  green: '#00FF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  blue: '#0000FF',
  red: '#FF0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGray: '#808080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  lightGray: '#C0C0C0',
  black: '#000000',
}

const JC_TO_ALIGN: Record<string, string> = {
  center: 'center',
  right: 'right',
  both: 'justify',
  distribute: 'justify',
  left: 'left',
}

function elementChildren(node: Element): Element[] {
  return Array.from(node.children ?? [])
}

function directChild(node: Element, tagName: string): Element | null {
  return elementChildren(node).find((child) => child.tagName === tagName) ?? null
}

function attr(el: Element | null, name: string): string | null {
  return el?.getAttribute(name) ?? null
}

/** 914400 EMU = 1 inch = 96 px → 9525 EMU/px. */
function emuToPx(emu: number): number {
  return Math.max(1, Math.round(emu / 9525))
}

interface Streams {
  alignments: (string | null)[]
  images: ({ width: number; height: number } | null)[]
  cells: (string | null)[]
}

function collectStreams(root: Element): Streams {
  const streams: Streams = { alignments: [], images: [], cells: [] }
  let lastExtent: { cx: number; cy: number } | null = null
  const walk = (el: Element): void => {
    if (el.tagName === 'wp:extent') {
      const cx = Number(attr(el, 'cx'))
      const cy = Number(attr(el, 'cy'))
      lastExtent = Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cy > 0 ? { cx, cy } : null
    }
    if (el.tagName === 'w:p') {
      const pPr = directChild(el, 'w:pPr')
      const jc = pPr ? attr(directChild(pPr, 'w:jc'), 'w:val') : null
      streams.alignments.push(jc ? (JC_TO_ALIGN[jc] ?? null) : null)
    }
    if (el.tagName === 'a:blip') {
      streams.images.push(lastExtent ? { width: emuToPx(lastExtent.cx), height: emuToPx(lastExtent.cy) } : null)
    }
    if (el.tagName === 'w:tc') {
      const tcPr = directChild(el, 'w:tcPr')
      const shd = tcPr ? directChild(tcPr, 'w:shd') : null
      const fill = attr(shd, 'w:fill')
      streams.cells.push(fill && /^[0-9A-Fa-f]{6}$/.test(fill) ? `#${fill.toUpperCase()}` : null)
    }
    for (const child of elementChildren(el)) walk(child)
  }
  walk(root)
  return streams
}

/**
 * Trích xuất enrichment từ gói DOCX. KHÔNG bao giờ ném lỗi:
 * mọi thất bại (không phải zip, thiếu document.xml, XML
 * hỏng) → trả EMPTY để luồng nhập chính vẫn tiếp tục.
 */
export async function extractDocxEnrichment(
  data: ArrayBuffer,
  parseXml: (xml: string) => Document | null,
): Promise<Omit<DocxEnrichment, 'fontFamilies'>> {
  try {
    const zip = await JSZip.loadAsync(data.slice(0))
    const file = zip.file('word/document.xml')
    if (!file) return { paragraphAlignments: [], imageSizes: [], cellBackgrounds: [] }
    const xml = await file.async('string')
    const doc = parseXml(xml)
    if (!doc?.documentElement) return { paragraphAlignments: [], imageSizes: [], cellBackgrounds: [] }
    const streams = collectStreams(doc.documentElement)
    return {
      paragraphAlignments: streams.alignments,
      imageSizes: streams.images,
      cellBackgrounds: streams.cells,
    }
  } catch {
    return { paragraphAlignments: [], imageSizes: [], cellBackgrounds: [] }
  }
}

/**
 * Áp enrichment lên DOM HTML ĐÃ sanitize, ngay trước khi
 * chuyển sang Content Model: ghi thuộc tính data-ws-* và
 * width/height. Mỗi luồng có guard số lượng riêng.
 */
export function applyEnrichmentToHtmlDom(doc: Document, enrichment: DocxEnrichment): void {
  const body = doc.body
  if (!body) return
  const paragraphs = Array.from(body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
  if (paragraphs.length === enrichment.paragraphAlignments.length) {
    paragraphs.forEach((el, i) => {
      const align = enrichment.paragraphAlignments[i]
      if (align) el.setAttribute('data-ws-align', align)
    })
  }
  const images = Array.from(body.querySelectorAll('img'))
  if (images.length === enrichment.imageSizes.length) {
    images.forEach((el, i) => {
      const size = enrichment.imageSizes[i]
      if (size) {
        el.setAttribute('width', String(size.width))
        el.setAttribute('height', String(size.height))
      }
    })
  }
  const cells = Array.from(body.querySelectorAll('td, th'))
  if (cells.length === enrichment.cellBackgrounds.length) {
    cells.forEach((el, i) => {
      const bg = enrichment.cellBackgrounds[i]
      if (bg) el.setAttribute('data-ws-bg', bg)
    })
  }
}
