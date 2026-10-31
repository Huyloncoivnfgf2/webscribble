/**
 * Sinh PDF fixtures bằng code cho test TASK-06A (không commit file
 * nhị phân): PDF hợp lệ 1 trang / nhiều trang / 100+ trang với
 * metadata, bản sao mã hóa Standard R2 (RC4 40-bit, user password)
 * để kiểm tra phân loại lỗi mật khẩu, và các biến thể hỏng.
 * MD5 lấy từ node:crypto (chỉ chạy ở môi trường test Node); RC4
 * tự cài đặt vì OpenSSL 3 không còn cung cấp qua crypto.
 */
import { createHash } from 'node:crypto'

const textEncoder = new TextEncoder()

function md5(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('md5').update(data).digest())
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) s[i] = i
  let j = 0
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 0xff
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = new Uint8Array(data.length)
  let a = 0
  let b = 0
  for (let n = 0; n < data.length; n += 1) {
    a = (a + 1) & 0xff
    b = (b + s[a]) & 0xff
    ;[s[a], s[b]] = [s[b], s[a]]
    out[n] = data[n] ^ s[(s[a] + s[b]) & 0xff]
  }
  return out
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/**
 * Mã hóa một chuỗi metadata theo đặc tả PDF: ASCII thuần dùng
 * literal string; có ký tự ngoài ASCII thì dùng UTF-16BE với BOM
 * dạng hex string (cách các file PDF thật lưu tiêu đề tiếng Việt).
 */
function encodePdfStringBytes(value: string): Uint8Array {
  if ([...value].every((ch) => (ch.codePointAt(0) ?? 0) < 128)) {
    return textEncoder.encode(value)
  }
  const bytes = new Uint8Array(2 + value.length * 2)
  bytes[0] = 0xfe
  bytes[1] = 0xff
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    bytes[2 + i * 2] = code >> 8
    bytes[3 + i * 2] = code & 0xff
  }
  return bytes
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface PdfFixtureInfo {
  title?: string
  author?: string
  subject?: string
  creator?: string
  producer?: string
}

export interface BuildPdfOptions {
  pageCount: number
  info?: PdfFixtureInfo
  /** Góc xoay /Rotate của mọi trang (độ, mặc định 0). */
  rotation?: number
  /** Mật khẩu người dùng (user password) — có thì file sẽ mã hóa R2. */
  userPassword?: string
  ownerPassword?: string
}

const PASSWORD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

function padPassword(password: string): Uint8Array {
  const raw = textEncoder.encode(password)
  const out = new Uint8Array(32)
  out.set(raw.subarray(0, 32))
  if (raw.length < 32) out.set(PASSWORD_PADDING.subarray(0, 32 - raw.length), raw.length)
  return out
}

interface EncryptionKeys {
  fileKey: Uint8Array
  oValue: Uint8Array
  uValue: Uint8Array
  permissions: number
}

function computeEncryption(options: Required<Pick<BuildPdfOptions, 'userPassword' | 'ownerPassword'>>, documentId: Uint8Array): EncryptionKeys {
  const permissions = -3904
  const ownerDigest = md5(padPassword(options.ownerPassword)).subarray(0, 5)
  const oValue = rc4(new Uint8Array(ownerDigest), padPassword(options.userPassword))
  const pBytes = new Uint8Array(4)
  new DataView(pBytes.buffer).setUint32(0, permissions >>> 0, true)
  const fileKey = new Uint8Array(
    md5(concatBytes([padPassword(options.userPassword), oValue, pBytes, documentId])).subarray(0, 5),
  )
  const uValue = rc4(fileKey, PASSWORD_PADDING)
  return { fileKey, oValue, uValue, permissions }
}

function objectEncryptionKey(fileKey: Uint8Array, objectNumber: number): Uint8Array {
  const suffix = new Uint8Array(5)
  suffix[0] = objectNumber & 0xff
  suffix[1] = (objectNumber >> 8) & 0xff
  suffix[2] = (objectNumber >> 16) & 0xff
  suffix[3] = 0
  suffix[4] = 0
  return md5(concatBytes([fileKey, suffix])).subarray(0, Math.min(fileKey.length + 5, 16))
}

/**
 * Dựng một file PDF hoàn chỉnh (header, objects, xref, trailer) với
 * số trang và metadata cho trước. Trang có MediaBox 612x792.
 */
export function buildPdf(options: BuildPdfOptions): Uint8Array {
  const { pageCount, info } = options
  const encrypted = options.userPassword !== undefined
  const documentId = md5(textEncoder.encode(`webscribble-fixture-${pageCount}`))
  const keys = encrypted
    ? computeEncryption(
        { userPassword: options.userPassword ?? '', ownerPassword: options.ownerPassword ?? 'owner-pass' },
        documentId,
      )
    : null

  // Đánh số object: 1 Catalog, 2 Pages, 3 Font, 4 Info, 5 Encrypt (nếu có),
  // sau đó mỗi trang 2 object (page + content).
  const FONT_OBJ = 3
  const INFO_OBJ = 4
  const ENCRYPT_OBJ = 5
  const firstPageObj = encrypted ? 6 : 5
  const pageObj = (i: number) => firstPageObj + i * 2
  const contentObj = (i: number) => firstPageObj + i * 2 + 1
  const totalObjects = contentObj(pageCount - 1)

  const objects = new Map<number, Uint8Array>()
  const plain = (text: string) => textEncoder.encode(text)
  const maybeEncryptString = (objectNumber: number, value: string): string => {
    const rawBytes = encodePdfStringBytes(value)
    if (keys !== null) {
      const encryptedBytes = rc4(objectEncryptionKey(keys.fileKey, objectNumber), rawBytes)
      return `<${hex(encryptedBytes)}>`
    }
    if ([...value].every((ch) => (ch.codePointAt(0) ?? 0) < 128)) {
      return `(${value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`
    }
    return `<${hex(rawBytes)}>`
  }

  objects.set(1, plain('<< /Type /Catalog /Pages 2 0 R >>'))
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObj(i)} 0 R`).join(' ')
  objects.set(2, plain(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`))
  objects.set(FONT_OBJ, plain('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'))

  const infoParts: string[] = []
  if (info?.title !== undefined) infoParts.push(`/Title ${maybeEncryptString(INFO_OBJ, info.title)}`)
  if (info?.author !== undefined) infoParts.push(`/Author ${maybeEncryptString(INFO_OBJ, info.author)}`)
  if (info?.subject !== undefined) infoParts.push(`/Subject ${maybeEncryptString(INFO_OBJ, info.subject)}`)
  if (info?.creator !== undefined) infoParts.push(`/Creator ${maybeEncryptString(INFO_OBJ, info.creator)}`)
  if (info?.producer !== undefined) infoParts.push(`/Producer ${maybeEncryptString(INFO_OBJ, info.producer)}`)
  objects.set(INFO_OBJ, plain(`<< ${infoParts.join(' ')} >>`))

  if (keys !== null) {
    objects.set(
      ENCRYPT_OBJ,
      plain(
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${hex(keys.oValue)}> /U <${hex(keys.uValue)}> /P ${keys.permissions} >>`,
      ),
    )
  }

  for (let i = 0; i < pageCount; i += 1) {
    objects.set(
      pageObj(i),
      plain(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObj(i)} 0 R ` +
          (options.rotation !== undefined && options.rotation !== 0 ? `/Rotate ${options.rotation} ` : '') +
          `/Resources << /Font << /F1 ${FONT_OBJ} 0 R >> >> >>`,
      ),
    )
    const contentText = `BT /F1 24 Tf 72 720 Td (Page ${i + 1} of ${pageCount}) Tj ET`
    let contentBytes = textEncoder.encode(contentText)
    if (keys !== null) {
      contentBytes = rc4(objectEncryptionKey(keys.fileKey, contentObj(i)), contentBytes)
    }
    objects.set(
      contentObj(i),
      concatBytes([
        plain(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        plain('\nendstream'),
      ]),
    )
  }

  // Ghép file và tính xref.
  const chunks: Uint8Array[] = [plain('%PDF-1.4\n')]
  const offsets = new Map<number, number>()
  let position = chunks[0].length
  for (let n = 1; n <= totalObjects; n += 1) {
    const body = objects.get(n)
    if (body === undefined) throw new Error(`fixture builder: missing object ${n}`)
    const header = plain(`${n} 0 obj\n`)
    const footer = plain('\nendobj\n')
    offsets.set(n, position)
    chunks.push(header, body, footer)
    position += header.length + body.length + footer.length
  }
  const xrefPosition = position
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= totalObjects; n += 1) {
    xref += `${String(offsets.get(n)).padStart(10, '0')} 00000 n \n`
  }
  const trailer =
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${INFO_OBJ} 0 R ` +
    (keys !== null ? `/Encrypt ${ENCRYPT_OBJ} 0 R ` : '') +
    `/ID [<${hex(documentId)}><${hex(documentId)}>] >>\nstartxref\n${xrefPosition}\n%%EOF`
  chunks.push(plain(xref + trailer))
  return concatBytes(chunks)
}

/** PDF hợp lệ nhưng bị cắt cụt giữa chừng — parser phải báo hỏng. */
export function buildCorruptPdf(): Uint8Array {
  const valid = buildPdf({ pageCount: 2 })
  return valid.subarray(0, Math.floor(valid.length / 2))
}

/** Bytes hoàn toàn không phải PDF. */
export function buildNotAPdf(): Uint8Array {
  return textEncoder.encode('This is plain text pretending to be a document, not a PDF at all.')
}
