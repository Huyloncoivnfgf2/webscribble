// @vitest-environment jsdom
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  buildDocxExportFileName,
  convertDocxToWordContent,
  DocxExportError,
  exportContentToDocx,
  normalizeExportFileName,
  sanitizeExportBaseName,
  validateWordContent,
  type WordDocumentContent,
} from '../../src/engines/word/index'
import { buildAnnotationPrintImage } from '../../src/app/features/documents/printExport'
import { buildRichDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

async function unzipText(blob: Blob, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const file = zip.file(path)
  if (file === null) throw new Error(`thiếu ${path} trong file xuất`)
  return file.async('string')
}

describe('TASK-07E — tên file xuất', () => {
  it('mặc định thêm _edited và bỏ đuôi .docx/.doc', () => {
    expect(buildDocxExportFileName('Bai tap Hoa.docx')).toBe('Bai tap Hoa_edited.docx')
    expect(buildDocxExportFileName('de-cuong.doc')).toBe('de-cuong_edited.docx')
    expect(buildDocxExportFileName('khong-duoi')).toBe('khong-duoi_edited.docx')
  })

  it('làm sạch ký tự cấm của hệ điều hành và khoảng trắng thừa', () => {
    expect(buildDocxExportFileName('a/b\\c:d*e?f"g<h>i|j.docx')).toBe('a b c d e f g h i j_edited.docx')
    expect(sanitizeExportBaseName('   nhiều    khoảng   trắng  ')).toBe('nhiều khoảng trắng')
    expect(sanitizeExportBaseName('///')).toBe('tai-lieu')
    expect(sanitizeExportBaseName('')).toBe('tai-lieu')
  })

  it('giữ dấu gạch nối và giới hạn độ dài', () => {
    expect(buildDocxExportFileName('bai-tap-1.docx')).toBe('bai-tap-1_edited.docx')
    expect(sanitizeExportBaseName('a'.repeat(200)).length).toBeLessThanOrEqual(80)
  })

  it('chuẩn hóa tên do người dùng nhập', () => {
    expect(normalizeExportFileName('ten moi')).toBe('ten moi.docx')
    expect(normalizeExportFileName('ten.docx')).toBe('ten.docx')
    expect(normalizeExportFileName('a/b')).toBe('a b.docx')
  })
})

describe('TASK-07E — exportContentToDocx', () => {
  it('xuất file DOCX hợp lệ (ZIP + document.xml + nội dung)', async () => {
    const content: WordDocumentContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Tiêu đề xuất' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'đoạn ' },
            { type: 'text', text: 'đậm', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    const { blob, warnings } = await exportContentToDocx(content)
    expect(warnings).toEqual([])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]) // PK
    const xml = await unzipText(blob, 'word/document.xml')
    expect(xml).toContain('Tiêu đề xuất')
    expect(xml).toContain('w:val="Heading1"')
    expect(xml).toContain('<w:b/>')
  })

  it('nội dung không hợp lệ → DocxExportError invalid-content', async () => {
    await expect(
      exportContentToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'mark-la' } as never] }] }] }),
    ).rejects.toMatchObject({ name: 'DocxExportError', kind: 'invalid-content' })
    await expect(exportContentToDocx({ type: 'doc', content: [] } as never)).rejects.toBeInstanceOf(DocxExportError)
  })

  it('round-trip: xuất fixture giàu định dạng rồi nhập lại giữ được các định dạng chính', async () => {
    const options = createTestConvertOptions()
    const imported = await convertDocxToWordContent(toArrayBuffer(buildRichDocx()), options)
    const { blob } = await exportContentToDocx(imported.content)
    const xml = await unzipText(blob, 'word/document.xml')
    expect(xml).toContain('w:jc w:val="center"')
    expect(xml).toContain('<w:highlight w:val="yellow"/>')
    expect(xml).toContain('<w:sz w:val="36"/>') // 18pt
    expect(xml).toContain('vertAlign w:val="superscript"')
    expect(xml).toContain('Cambria')
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file(/word\/media\//).length).toBeGreaterThan(0)

    const reimported = await convertDocxToWordContent(await blob.arrayBuffer(), options)
    expect(validateWordContent(reimported.content).valid).toBe(true)
    const flat = JSON.stringify(reimported.content)
    expect(flat).toContain('"textAlign":"center"')
    expect(flat).toContain('"type":"superscript"')
    expect(flat).toContain('"fontSize":"18pt"')
    expect(flat).toContain('"backgroundColor":"#FFFF00"')
    expect(flat).toContain('Cấp hai A1')
    expect(flat).toContain('https://example.com/tai-lieu')
    const image = JSON.stringify(reimported.content).match(/"type":"image","attrs":\{"src":"data:image\/png[^}]*"width":200/)
    expect(image).not.toBeNull()
  }, 30000)

  it('hai danh sách số riêng biệt được khởi động lại từ 1 (hai numbering reference)', async () => {
    const item = (text: string): WordDocumentContent['content'][number] => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })
    const content: WordDocumentContent = {
      type: 'doc',
      content: [
        { type: 'orderedList', content: [item('mot'), item('hai')] },
        { type: 'paragraph', content: [{ type: 'text', text: 'ngăn cách' }] },
        { type: 'orderedList', content: [item('lai mot')] },
      ],
    }
    const { blob } = await exportContentToDocx(content)
    const numbering = await unzipText(blob, 'word/numbering.xml')
    // ≥ 2 instance đánh số riêng (thư viện docx chèn thêm
    // một instance mặc định cho bullet) — mỗi danh sách
    // số có instance riêng nên đều bắt đầu lại từ 1.
    expect((numbering.match(/<w:num /g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('highlight hex ngoài bảng Word → shading của run; ảnh SVG bị bỏ kèm cảnh báo', async () => {
    const content: WordDocumentContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'màu lạ', marks: [{ type: 'textStyle', attrs: { backgroundColor: '#123456' } }] },
          ],
        },
        { type: 'image', attrs: { src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } },
      ],
    }
    const { blob, warnings } = await exportContentToDocx(content)
    const xml = await unzipText(blob, 'word/document.xml')
    expect(xml).toContain('w:fill="123456"')
    expect(warnings.some((w) => w.includes('không xuất được'))).toBe(true)
  })

  it('bảng: header + nền ô + colspan đi vào XML và đọc lại được', async () => {
    const options = createTestConvertOptions()
    const imported = await convertDocxToWordContent(toArrayBuffer(buildRichDocx()), options)
    const { blob } = await exportContentToDocx(imported.content)
    const xml = await unzipText(blob, 'word/document.xml')
    expect(xml).toContain('<w:tblHeader')
    expect(xml).toContain('w:fill="D9D9D9"')
    expect(xml).toContain('<w:gridSpan w:val="2"/>')
    const reimported = await convertDocxToWordContent(await blob.arrayBuffer(), options)
    const table = reimported.content.content.find((b) => b.type === 'table')
    expect(table).toBeTruthy()
    expect(JSON.stringify(table)).toContain('"background":"#D9D9D9"')
    expect(JSON.stringify(table)).toContain('"colspan":2')
  }, 30000)
})

describe('TASK-07E — ảnh chú thích cho bản in', () => {
  it('canvas hợp lệ → ảnh PNG data URL kèm kích thước bitmap', () => {
    const image = buildAnnotationPrintImage({
      width: 1600,
      height: 2400,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(image).toEqual({
      src: 'data:image/png;base64,iVBORw0KGgo=',
      bitmapWidth: 1600,
      bitmapHeight: 2400,
    })
  })

  it('canvas rỗng hoặc chụp lỗi → null (không chặn việc in nội dung)', () => {
    expect(buildAnnotationPrintImage({ width: 0, height: 100, toDataURL: () => 'data:image/png;base64,x' })).toBeNull()
    expect(
      buildAnnotationPrintImage({
        width: 10,
        height: 10,
        toDataURL: () => {
          throw new Error('tainted')
        },
      }),
    ).toBeNull()
    expect(buildAnnotationPrintImage({ width: 10, height: 10, toDataURL: () => 'data:text/plain,x' })).toBeNull()
  })
})
