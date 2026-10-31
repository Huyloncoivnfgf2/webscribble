/**
 * Fixture DOCX sinh bằng code cho TASK-07A: một writer ZIP
 * dạng stored (không nén) tối thiểu + các part XML của DOCX.
 * Kiểm soát hoàn toàn để test kiểm được NỘI DUNG thật sau
 * chuyển đổi, không chỉ số lượng record.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Đóng gói ZIP stored (method 0) hợp lệ. */
export function zipStored(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const u16 = (arr: number[], v: number) => arr.push(v & 0xff, (v >>> 8) & 0xff)
  const u32 = (arr: number[], v: number) => arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const local: number[] = []
    u32(local, 0x04034b50)
    u16(local, 20)
    u16(local, 0x0800) // UTF-8 filename flag
    u16(local, 0) // stored
    u16(local, 0)
    u16(local, 0x21) // DOS date 1980-01-01
    u32(local, crc)
    u32(local, entry.data.length)
    u32(local, entry.data.length)
    u16(local, nameBytes.length)
    u16(local, 0)
    const localBytes = new Uint8Array(local)
    chunks.push(localBytes, nameBytes, entry.data)

    const cd: number[] = []
    u32(cd, 0x02014b50)
    u16(cd, 20)
    u16(cd, 20)
    u16(cd, 0x0800)
    u16(cd, 0)
    u16(cd, 0)
    u16(cd, 0x21)
    u32(cd, crc)
    u32(cd, entry.data.length)
    u32(cd, entry.data.length)
    u16(cd, nameBytes.length)
    u16(cd, 0)
    u16(cd, 0)
    u16(cd, 0)
    u16(cd, 0)
    u32(cd, 0)
    u32(cd, offset)
    const cdBytes = new Uint8Array(cd)
    central.push(cdBytes, nameBytes)
    offset += localBytes.length + nameBytes.length + entry.data.length
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0)
  const end: number[] = []
  u32(end, 0x06054b50)
  u16(end, 0)
  u16(end, 0)
  u16(end, entries.length)
  u16(end, entries.length)
  u32(end, centralSize)
  u32(end, offset)
  u16(end, 0)

  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const chunk of [...chunks, ...central, new Uint8Array(end)]) {
    out.set(chunk, pos)
    pos += chunk.length
  }
  return out
}

const enc = (s: string) => new TextEncoder().encode(s)

/** PNG 1x1 trong suốt (bytes chuẩn). */
export const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

export interface BuildDocxOptions {
  /** Chèn hyperlink javascript: vào cuối tài liệu (kiểm sanitize). */
  maliciousLink?: boolean
  /** Chỉ một đoạn trống. */
  empty?: boolean
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
</w:styles>`

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlPicBulletId w:val="0"/></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`

function documentXml(options: BuildDocxOptions): string {
  if (options.empty === true) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p/></w:body>
</w:document>`
  }
  const malicious =
    options.maliciousLink === true
      ? `<w:p><w:hyperlink r:id="rId7" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>Bấm vào đây</w:t></w:r></w:hyperlink></w:p>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Tiêu đề chính</w:t></w:r></w:p>
<w:p><w:r><w:t>Đoạn thường có </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>chữ đậm</w:t></w:r><w:r><w:t> và </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>chữ nghiêng</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Mục một</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Mục hai</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>A2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Picture 1"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
${malicious}
</w:body>
</w:document>`
}

function documentRels(options: BuildDocxOptions): string {
  const malicious =
    options.maliciousLink === true
      ? `<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${malicious}
</Relationships>`
}

/** DOCX đầy đủ: heading, đoạn đậm/nghiêng, danh sách, bảng, ảnh PNG. */
export function buildDocx(options: BuildDocxOptions = {}): Uint8Array {
  return zipStored([
    { name: '[Content_Types].xml', data: enc(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc(ROOT_RELS) },
    { name: 'word/document.xml', data: enc(documentXml(options)) },
    { name: 'word/styles.xml', data: enc(STYLES) },
    { name: 'word/numbering.xml', data: enc(NUMBERING) },
    { name: 'word/_rels/document.xml.rels', data: enc(documentRels(options)) },
    { name: 'word/media/image1.png', data: TINY_PNG },
  ])
}

/** File .doc cũ: chữ ký OLE2 + dữ liệu giả. */
export function buildLegacyDoc(): Uint8Array {
  const bytes = new Uint8Array(512)
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0)
  return bytes
}

/** DOCX bị cắt cụt (chữ ký ZIP đúng, thân hỏng). */
export function buildCorruptDocx(): Uint8Array {
  return buildDocx().slice(0, 120)
}

/** ZIP hợp lệ nhưng không phải DOCX (không có word/document.xml). */
export function buildZipNotDocx(): Uint8Array {
  return zipStored([{ name: 'hello.txt', data: enc('xin chào') }])
}

/** Không phải file tài liệu nào cả. */
export function buildNotADocument(): Uint8Array {
  return enc('đây là file text thuần, không phải DOCX')
}

const NUMBERING_2LVL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/><w:pPr><w:ind w:left="720"/></w:pPr></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`

const RICH_DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Tiêu đề căn giữa</w:t></w:r></w:p>
<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Đoạn căn phải</w:t></w:r></w:p>
<w:p><w:r><w:t>E = mc</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r><w:r><w:t> và H</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>2</w:t></w:r><w:r><w:t>O là nước.</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="36"/></w:rPr><w:t>Chữ lớn 18pt</w:t></w:r><w:r><w:t> cùng đoạn </w:t></w:r><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>đáp án đúng</w:t></w:r><w:r><w:t> và </w:t></w:r><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>chữ đỏ</w:t></w:r><w:r><w:t> hết.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Cấp một A</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Cấp hai A1</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Cấp hai A2</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Cấp một B</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="D9D9D9"/></w:tcPr><w:p><w:r><w:t>Cột 1</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:fill="D9D9D9"/></w:tcPr><w:p><w:r><w:t>Cột 2</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Ô gộp hai cột</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>Thường</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:fill="FFF2CC"/></w:tcPr><w:p><w:r><w:t>Ô tô nền</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1905000" cy="952500"/><wp:docPr id="1" name="Picture 1"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria"/></w:rPr><w:t>Font Cambria riêng</w:t></w:r></w:p>
<w:p><w:hyperlink r:id="rId9"><w:r><w:t>Tài liệu tham khảo</w:t></w:r></w:hyperlink></w:p>
</w:body>
</w:document>`

const RICH_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/tai-lieu" TargetMode="External"/>
</Relationships>`

/**
 * DOCX giàu định dạng cho TASK-07C: căn lề, sup/sub, font
 * size, highlight, màu chữ, danh sách 2 cấp, bảng có hàng
 * tiêu đề + tô nền + ô gộp, ảnh có kích thước, hyperlink.
 */
export function buildRichDocx(): Uint8Array {
  return zipStored([
    { name: '[Content_Types].xml', data: enc(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc(ROOT_RELS) },
    { name: 'word/document.xml', data: enc(RICH_DOCUMENT) },
    { name: 'word/styles.xml', data: enc(STYLES) },
    { name: 'word/numbering.xml', data: enc(NUMBERING_2LVL) },
    { name: 'word/_rels/document.xml.rels', data: enc(RICH_RELS) },
    { name: 'word/media/image1.png', data: TINY_PNG },
  ])
}

const VMERGE_DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:tbl>
<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="FF0000"/><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>Ô dọc gộp</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc><w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
</w:body>
</w:document>`

/** DOCX có ô gộp dọc (vMerge) — luồng ô XML lệch HTML. */
export function buildVMergeDocx(): Uint8Array {
  return zipStored([
    { name: '[Content_Types].xml', data: enc(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc(ROOT_RELS) },
    { name: 'word/document.xml', data: enc(VMERGE_DOCUMENT) },
    { name: 'word/styles.xml', data: enc(STYLES) },
    { name: 'word/_rels/document.xml.rels', data: enc(documentRels({})) },
  ])
}
