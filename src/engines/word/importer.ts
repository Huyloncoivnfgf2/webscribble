import * as mammoth from 'mammoth'
import JSZip from 'jszip'
import { validateWordContent, type WordDocumentContent } from './contentModel'
import {
  applyEnrichmentToHtmlDom,
  extractDocxEnrichment,
  type DocxEnrichment,
} from './enrichment'
import { WordImportError } from './errors'
import { htmlToWordContent, type DomParserLike } from './htmlToContent'
import { sanitizeImportedHtml, type HtmlPurifier } from './sanitize'

/**
 * Đường nhập DOCX của Word Engine (TASK-07A, DEC-018):
 *
 *   bytes → nhận diện (ZIP/OLE) → Mammoth convertToHtml
 *   → sanitize (bắt buộc, tại biên) → HTML → mô hình nội dung
 *   → validation → WordDocumentContent
 *
 * File gốc không bị đụng ở đây — việc lưu Blob thuộc tầng gọi
 * (importToLibrary). Mọi lỗi đều là WordImportError đã phân
 * loại kèm thông điệp an toàn cho người dùng.
 */

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // "PK\x03\x04"
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0] // định dạng .doc cũ / OLE2

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte)
}

/** DOCX là một gói ZIP — kiểm tra chữ ký đầu file. */
export function hasZipSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, ZIP_SIGNATURE)
}

/** Chữ ký OLE2 của định dạng Word cũ (.doc). */
export function hasOleSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, OLE_SIGNATURE)
}

export interface ConvertDocxOptions {
  /** Instance DOMPurify thay thế (test tiêm bản gắn với jsdom). */
  purifier?: HtmlPurifier
  /** DOMParser thay thế (test tiêm bản của jsdom). */
  domParser?: DomParserLike
}

export interface DocxConversionResult {
  content: WordDocumentContent
  /** Cảnh báo từ Mammoth (định dạng bị bỏ qua, v.v.) — không phải lỗi. */
  warnings: string[]
}

interface MammothRunLike {
  type?: string
  children?: MammothRunLike[]
  fontSize?: number | null
  highlight?: string | null
  font?: string | null
  styleName?: string | null
}

function walkRuns(node: MammothRunLike, visit: (run: MammothRunLike) => void): void {
  if (node.type === 'run') visit(node)
  for (const child of node.children ?? []) walkRuns(child, visit)
}

/**
 * Mã hóa định dạng ký tự trực tiếp của một run thành token
 * style. Mammoth ĐỌC được fontSize/highlight/font nhưng
 * không xuất ra HTML; kênh truyền an toàn là đổi styleName
 * của run thành tên tự sinh và dùng STYLE MAP ĐỘNG để
 * Mammoth bọc run trong <span class="ws-..."> — định dạng đi
 * CÙNG run qua chuyển đổi, không cần đối chiếu vị trí.
 * (TASK-07C; đã kiểm chứng thực nghiệm trước khi triển khai.)
 */
function runStyleToken(run: MammothRunLike, fontFamilies: string[]): string | null {
  const parts: string[] = []
  if (run.fontSize) parts.push(`fs${String(run.fontSize).replace('.', 'p')}`)
  if (run.highlight) parts.push(`hl-${run.highlight}`)
  if (run.font) {
    let index = fontFamilies.indexOf(run.font)
    if (index < 0) {
      fontFamilies.push(run.font)
      index = fontFamilies.length - 1
    }
    parts.push(`ff${index}`)
  }
  return parts.length > 0 ? parts.join('_') : null
}

/**
 * Một số trình sinh DOCX (gồm thư viện `docx` dùng để xuất
 * của chính WebScribble) ghi rõ `<w:tblHeader w:val="off"/>`
 * cho hàng KHÔNG phải tiêu đề. Mammoth chỉ nhìn SỰ HIỆN
 * DIỆN của phần tử này nên mọi hàng thành tiêu đề — sửa
 * bằng cách gỡ các phần tử tblHeader mang giá trị tắt
 * trước khi đưa cho Mammoth. Không có phần tử dạng đó →
 * trả nguyên buffer; mọi lỗi → trả nguyên buffer.
 */
async function stripDisabledTableHeaders(data: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(data.slice(0))
    const documentFile = zip.file('word/document.xml')
    if (documentFile === null) return data
    const xml = await documentFile.async('string')
    const OFF_VALUE = /w:val="(?:off|false|0)"/
    if (!xml.includes('tblHeader') || !OFF_VALUE.test(xml)) return data
    const stripped = xml.replace(/<w:tblHeader\b[^>]*\/>/g, (element) =>
      OFF_VALUE.test(element) ? '' : element,
    )
    if (stripped === xml) return data
    zip.file('word/document.xml', stripped)
    return await zip.generateAsync({ type: 'arraybuffer' })
  } catch {
    return data
  }
}

export async function convertDocxToWordContent(
  data: ArrayBuffer,
  options: ConvertDocxOptions = {},
): Promise<DocxConversionResult> {
  const bytes = new Uint8Array(data)
  if (bytes.length === 0) throw new WordImportError('corrupt')
  if (hasOleSignature(bytes)) throw new WordImportError('legacy-doc')
  if (!hasZipSignature(bytes)) throw new WordImportError('not-a-docx')

  const parser: DomParserLike = options.domParser ?? new DOMParser()
  const enrichment: DocxEnrichment = {
    ...(await extractDocxEnrichment(data, (xml) => parser.parseFromString(xml, 'text/xml'))),
    fontFamilies: [],
  }
  const mammothInput = await stripDisabledTableHeaders(data)

  let mammothResult: { value: string; messages: Array<{ type: string; message: string }> }
  try {
    // Lượt 1: chỉ THU THẬP các token định dạng ký tự trực
    // tiếp hiện có trong tài liệu (và registry font).
    const fonts: string[] = enrichment.fontFamilies
    const tokens = new Set<string>()
    await mammoth.convertToHtml(
      { arrayBuffer: mammothInput.slice(0) },
      {
        transformDocument: ((doc: MammothRunLike) => {
          walkRuns(doc, (run) => {
            const token = runStyleToken(run, fonts)
            if (token) tokens.add(token)
          })
          return doc
        }) as (element: never) => never,
      },
    )
    const styleMap = [...tokens].map((token) => {
      const classes = token.split('_').map((part) => `ws-${part}`).join('.')
      return `r[style-name='__ws_${token}'] => span.${classes}:fresh`
    })
    // Lượt 2: áp styleName tự sinh + style map động. Sao
    // chép buffer mỗi lượt (không để thư viện detach dữ
    // liệu của caller — Blob gốc còn cần nguyên vẹn để lưu).
    mammothResult = await mammoth.convertToHtml(
      { arrayBuffer: mammothInput.slice(0) },
      {
        transformDocument: ((doc: MammothRunLike) => {
          walkRuns(doc, (run) => {
            const token = runStyleToken(run, fonts)
            if (token) run.styleName = `__ws_${token}`
          })
          return doc
        }) as (element: never) => never,
        styleMap,
      },
    )
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    if (/zip|central directory|corrupt|invalid format/i.test(message)) {
      throw new WordImportError('corrupt', { cause })
    }
    if (/document part|content types|not a docx|word\/document/i.test(message)) {
      throw new WordImportError('not-a-docx', { cause })
    }
    throw new WordImportError('conversion-failed', { cause })
  }

  const warnings = mammothResult.messages.map((m) => m.message)
  const hasMammothError = mammothResult.messages.some((m) => m.type === 'error')
  if (mammothResult.value.trim() === '' && hasMammothError) {
    throw new WordImportError('conversion-failed')
  }

  const safeHtml = sanitizeImportedHtml(mammothResult.value, options.purifier)
  const content = htmlToWordContent(safeHtml, options.domParser, {
    enrich: (doc) => applyEnrichmentToHtmlDom(doc, enrichment),
    fontFamilies: enrichment.fontFamilies,
  })
  const validation = validateWordContent(content)
  if (!validation.valid) {
    throw new WordImportError('invalid-content', { cause: new Error(validation.errors.join('; ')) })
  }
  return { content, warnings }
}
