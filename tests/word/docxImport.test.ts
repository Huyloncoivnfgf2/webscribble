import { describe, expect, it } from 'vitest'
import {
  WordImportError,
  convertDocxToWordContent,
  sanitizeImportedHtml,
  validateWordContent,
  type WordBlockNode,
  type WordDocumentContent,
} from '../../src/engines/word/index'
import {
  buildCorruptDocx,
  buildDocx,
  buildLegacyDoc,
  buildNotADocument,
  buildZipNotDocx,
} from './fixtures'
import { createTestConvertOptions, testPurifier, toArrayBuffer } from './testEnv'

/**
 * TASK-07A — kiểm thử đường nhập DOCX: chuyển đổi nội dung
 * THẬT (heading/đậm/nghiêng/danh sách/bảng/ảnh), phân loại
 * lỗi, sanitize XSS, validation của mô hình nội dung.
 */

const options = createTestConvertOptions()

function allText(content: WordDocumentContent): string {
  const texts: string[] = []
  const walk = (nodes: readonly unknown[]) => {
    for (const node of nodes) {
      const n = node as { type?: string; text?: string; content?: unknown[] }
      if (n.type === 'text' && typeof n.text === 'string') texts.push(n.text)
      if (Array.isArray(n.content)) walk(n.content)
    }
  }
  walk(content.content)
  return texts.join('|')
}

function findBlocks(content: WordDocumentContent, type: string): WordBlockNode[] {
  return content.content.filter((b) => b.type === type)
}

describe('TASK-07A — chuyển đổi DOCX thành mô hình nội dung', () => {
  it('heading, đoạn với marks đậm/nghiêng, danh sách, bảng, ảnh', async () => {
    const { content, warnings } = await convertDocxToWordContent(toArrayBuffer(buildDocx()), options)
    expect(warnings).toEqual([])
    expect(validateWordContent(content).valid).toBe(true)

    const heading = findBlocks(content, 'heading')[0]
    expect(heading?.attrs?.level).toBe(1)
    expect(allText({ type: 'doc', content: [heading as WordBlockNode] })).toContain('Tiêu đề chính')

    const paragraph = findBlocks(content, 'paragraph')[0]
    const runs = (paragraph?.content ?? []) as Array<{ text?: string; marks?: Array<{ type: string }> }>
    const boldRun = runs.find((r) => r.text === 'chữ đậm')
    const italicRun = runs.find((r) => r.text === 'chữ nghiêng')
    expect(boldRun?.marks).toEqual([{ type: 'bold' }])
    expect(italicRun?.marks).toEqual([{ type: 'italic' }])

    const list = findBlocks(content, 'bulletList')[0]
    expect(list?.content).toHaveLength(2)
    expect(allText({ type: 'doc', content: [list as WordBlockNode] })).toContain('Mục một')
    expect(allText({ type: 'doc', content: [list as WordBlockNode] })).toContain('Mục hai')

    const table = findBlocks(content, 'table')[0]
    expect(table?.content).toHaveLength(2) // 2 hàng
    expect(allText({ type: 'doc', content: [table as WordBlockNode] })).toContain('A1')
    expect(allText({ type: 'doc', content: [table as WordBlockNode] })).toContain('B2')

    const image = findBlocks(content, 'image')[0]
    expect((image?.attrs?.src as string).startsWith('data:image/png;base64,')).toBe(true)
  })

  it('DOCX rỗng (một đoạn trống) → nội dung hợp lệ với một paragraph', async () => {
    const { content } = await convertDocxToWordContent(
      toArrayBuffer(buildDocx({ empty: true })),
      options,
    )
    expect(content.content).toEqual([{ type: 'paragraph' }])
  })
})

describe('TASK-07A — phân loại lỗi nhập', () => {
  it('file không phải DOCX → not-a-docx', async () => {
    await expect(
      convertDocxToWordContent(toArrayBuffer(buildNotADocument()), options),
    ).rejects.toMatchObject({ kind: 'not-a-docx' })
  })

  it('file .doc cũ (OLE) → legacy-doc', async () => {
    await expect(
      convertDocxToWordContent(toArrayBuffer(buildLegacyDoc()), options),
    ).rejects.toMatchObject({ kind: 'legacy-doc' })
  })

  it('DOCX cắt cụt → corrupt', async () => {
    await expect(
      convertDocxToWordContent(toArrayBuffer(buildCorruptDocx()), options),
    ).rejects.toMatchObject({ kind: 'corrupt' })
  })

  it('ZIP nhưng không phải DOCX → not-a-docx', async () => {
    await expect(
      convertDocxToWordContent(toArrayBuffer(buildZipNotDocx()), options),
    ).rejects.toMatchObject({ kind: 'not-a-docx' })
  })

  it('buffer rỗng → corrupt; lỗi mang thông điệp an toàn cho người dùng', async () => {
    const error = await convertDocxToWordContent(new ArrayBuffer(0), options).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(WordImportError)
    expect((error as WordImportError).kind).toBe('corrupt')
    expect((error as WordImportError).userMessage).not.toMatch(/zip|stack/i)
  })
})

describe('TASK-07A — sanitize HTML tại biên nhập', () => {
  it('loại bỏ script, event handler, iframe, form, svg', () => {
    const dirty =
      '<p onclick="alert(1)">an toàn</p><script>alert(2)</script>' +
      '<iframe src="https://evil.example"></iframe><form action="https://evil.example"></form>' +
      '<svg><a xlink:href="javascript:alert(3)"><text>x</text></a></svg>' +
      '<img src="x" onerror="alert(4)">'
    const clean = sanitizeImportedHtml(dirty, testPurifier)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('<form')
    expect(clean).not.toContain('<svg')
    expect(clean).not.toContain('onerror')
    expect(clean).toContain('an toàn')
  })

  it('loại bỏ URL javascript: nhưng giữ liên kết https thường', () => {
    const clean = sanitizeImportedHtml(
      '<p><a href="javascript:alert(1)">xấu</a> <a href="https://example.com/an-toan">tốt</a></p>',
      testPurifier,
    )
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('https://example.com/an-toan')
    expect(clean).toContain('xấu')
  })

  it('giữ ảnh data:image (ảnh nhúng của DOCX) nhưng bỏ thuộc tính style', () => {
    const clean = sanitizeImportedHtml(
      '<p style="color:red">văn bản</p><img src="data:image/png;base64,iVBORw0KGgo=" alt="anh">',
      testPurifier,
    )
    expect(clean).toContain('data:image/png;base64,')
    expect(clean).not.toContain('style=')
  })

  it('hyperlink javascript: TỪ CHÍNH FILE DOCX bị vô hiệu sau toàn bộ đường nhập', async () => {
    const { content } = await convertDocxToWordContent(
      toArrayBuffer(buildDocx({ maliciousLink: true })),
      options,
    )
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('javascript:')
    // Chữ của hyperlink vẫn còn (dạng văn bản thường, không phải link nguy hiểm):
    expect(allText(content)).toContain('Bấm vào đây')
  })

  it('môi trường không có DOMPurify khả dụng → lỗi sanitizer-unavailable', () => {
    expect(() =>
      sanitizeImportedHtml('<p>x</p>', { isSupported: false, sanitize: (h: string) => h }),
    ).toThrowError(expect.objectContaining({ kind: 'sanitizer-unavailable' }))
  })
})

describe('TASK-07A — validation mô hình nội dung', () => {
  it('chấp nhận model hợp lệ; từ chối rác và cấu trúc sai', () => {
    expect(
      validateWordContent({ type: 'doc', content: [{ type: 'paragraph' }] }).valid,
    ).toBe(true)
    expect(validateWordContent(null).valid).toBe(false)
    expect(validateWordContent({ type: 'doc', content: [] }).valid).toBe(false)
    expect(
      validateWordContent({ type: 'doc', content: [{ type: 'portalGun' }] }).valid,
    ).toBe(false)
    expect(
      validateWordContent({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'x' }] }],
      }).valid,
    ).toBe(false)
    expect(
      validateWordContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: {} }] }],
          },
        ],
      }).valid,
    ).toBe(false)
    expect(
      validateWordContent({ type: 'doc', content: [{ type: 'image', attrs: {} }] }).valid,
    ).toBe(false)
  })
})
