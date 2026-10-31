// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createStorageFoundation, DOCUMENT_CONTENT_VERSION } from '../../src/data/index'
import { WebScribbleDatabase } from '../../src/data/database'
import {
  convertDocxToWordContent,
  validateWordContent,
  type WordBlockNode,
  type WordDocumentContent,
  type WordMark,
} from '../../src/engines/word/index'
import { createWordEditorExtensions } from '../../src/app/features/documents/wordEditorExtensions'
import { WordEditorController } from '../../src/app/features/documents/WordEditorController'
import { buildRichDocx, buildVMergeDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

interface FlatText { text: string; marks: WordMark[] }
function flatTexts(content: WordDocumentContent): FlatText[] {
  const out: FlatText[] = []
  const walk = (nodes: readonly unknown[] | undefined): void => {
    for (const node of nodes ?? []) {
      const n = node as { type?: string; text?: string; marks?: WordMark[]; content?: unknown[] }
      if (n.type === 'text') out.push({ text: n.text ?? '', marks: n.marks ?? [] })
      else walk(n.content)
    }
  }
  walk(content.content)
  return out
}

function textsWith(content: WordDocumentContent, needle: string): FlatText[] {
  return flatTexts(content).filter((t) => t.text.includes(needle))
}

function findBlocks(content: WordDocumentContent, type: string): WordBlockNode[] {
  const out: WordBlockNode[] = []
  const walk = (nodes: readonly WordBlockNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      if (node.type === type) out.push(node)
      walk(node.content as WordBlockNode[] | undefined)
    }
  }
  walk(content.content)
  return out
}

async function importRich(): Promise<WordDocumentContent> {
  const { content } = await convertDocxToWordContent(toArrayBuffer(buildRichDocx()), createTestConvertOptions())
  return content
}

describe('TASK-07C — fidelity của pipeline nhập DOCX', () => {
  it('model version đã nâng lên 2 và nội dung giàu định dạng qua được validator', async () => {
    expect(DOCUMENT_CONTENT_VERSION).toBe(2)
    const content = await importRich()
    expect(validateWordContent(content)).toEqual({ valid: true, errors: [] })
  })

  it('căn lề đoạn: center và right tới đúng đoạn theo thứ tự tài liệu', async () => {
    const content = await importRich()
    const paragraphs = content.content.filter((b) => b.type === 'paragraph')
    const first = paragraphs[0]
    const second = paragraphs[1]
    expect(JSON.stringify(first?.content)).toContain('Tiêu đề căn giữa')
    expect(first?.attrs?.textAlign).toBe('center')
    expect(JSON.stringify(second?.content)).toContain('Đoạn căn phải')
    expect(second?.attrs?.textAlign).toBe('right')
  })

  it('superscript/subscript thành marks, văn bản không đổi', async () => {
    const content = await importRich()
    const twos = flatTexts(content).filter((t) => t.text === '2')
    expect(twos.some((t) => t.marks.some((m) => m.type === 'superscript'))).toBe(true)
    expect(twos.some((t) => t.marks.some((m) => m.type === 'subscript'))).toBe(true)
    expect(textsWith(content, 'O là nước')).toHaveLength(1)
  })

  it('cỡ chữ và highlight trực tiếp thành textStyle; màu chữ (Mammoth không đọc) chỉ mất định dạng, giữ chữ', async () => {
    const content = await importRich()
    const big = textsWith(content, 'Chữ lớn 18pt')[0]
    expect(big?.marks).toContainEqual({ type: 'textStyle', attrs: { fontSize: '18pt' } })
    const highlighted = textsWith(content, 'đáp án đúng')[0]
    expect(highlighted?.marks).toContainEqual({ type: 'textStyle', attrs: { backgroundColor: '#FFFF00' } })
    const red = textsWith(content, 'chữ đỏ')[0]
    expect(red).toBeTruthy()
    expect(red?.marks.some((m) => m.type === 'textStyle')).toBe(false)
    const cambria = textsWith(content, 'Font Cambria riêng')[0]
    expect(cambria?.marks).toContainEqual({ type: 'textStyle', attrs: { fontFamily: 'Cambria' } })
  })

  it('danh sách lồng nhau giữ cấu trúc cấp 2 trong listItem', async () => {
    const content = await importRich()
    const lists = findBlocks(content, 'bulletList')
    expect(lists.length).toBeGreaterThanOrEqual(2) // list ngoài + list lồng
    const outerItems = lists[0]?.content ?? []
    expect(outerItems).toHaveLength(2)
    const nested = (outerItems[0]?.content ?? []).find((b) => b.type === 'bulletList')
    expect(nested?.content).toHaveLength(2)
  })

  it('bảng: hàng tiêu đề là tableHeader có nền; ô gộp giữ colspan; ô thường có nền riêng', async () => {
    const content = await importRich()
    const headers = findBlocks(content, 'tableHeader')
    expect(headers).toHaveLength(2)
    expect(headers.every((h) => h.attrs?.background === '#D9D9D9')).toBe(true)
    const cells = findBlocks(content, 'tableCell')
    const merged = cells.find((c) => JSON.stringify(c.content).includes('Ô gộp hai cột'))
    expect(merged?.attrs?.colspan).toBe(2)
    const shaded = cells.find((c) => JSON.stringify(c.content).includes('Ô tô nền'))
    expect(shaded?.attrs?.background).toBe('#FFF2CC')
  })

  it('ảnh giữ kích thước hiển thị từ extent gốc (200x100 px)', async () => {
    const content = await importRich()
    const images = findBlocks(content, 'image')
    expect(images).toHaveLength(1)
    expect(images[0]?.attrs?.width).toBe(200)
    expect(images[0]?.attrs?.height).toBe(100)
  })

  it('hyperlink https hợp lệ được giữ nguyên', async () => {
    const content = await importRich()
    const link = textsWith(content, 'Tài liệu tham khảo')[0]
    expect(link?.marks).toContainEqual({ type: 'link', attrs: { href: 'https://example.com/tai-lieu' } })
  })

  it('luồng ô lệch số lượng (vMerge): import vẫn thành công, rowspan được giữ, nền KHÔNG bị gán nhầm', async () => {
    const { content } = await convertDocxToWordContent(toArrayBuffer(buildVMergeDocx()), createTestConvertOptions())
    expect(validateWordContent(content).valid).toBe(true)
    const cells = findBlocks(content, 'tableCell')
    const merged = cells.find((c) => JSON.stringify(c.content).includes('Ô dọc gộp'))
    expect(merged?.attrs?.rowspan).toBe(2)
    // Guard đã chặn cả luồng nền: không ô nào có background
    // (thà thiếu còn hơn gán màu đỏ sang sai ô).
    expect(cells.every((c) => c.attrs?.background === undefined)).toBe(true)
  })

  it('editor nạp và trả lại nguyên vẹn các định dạng mới (round-trip không mất)', async () => {
    const content = await importRich()
    const editor = new Editor({ extensions: createWordEditorExtensions(), content: content as never })
    try {
      const roundTripped = editor.getJSON() as unknown as WordDocumentContent
      expect(validateWordContent(roundTripped).valid).toBe(true)
      const paragraphs = roundTripped.content.filter((b) => b.type === 'paragraph')
      expect(paragraphs[0]?.attrs?.textAlign).toBe('center')
      const big = textsWith(roundTripped, 'Chữ lớn 18pt')[0]
      expect(big?.marks.some((m) => m.type === 'textStyle' && m.attrs?.fontSize === '18pt')).toBe(true)
      const sup = flatTexts(roundTripped).filter((t) => t.text === '2')
      expect(sup.some((t) => t.marks.some((m) => m.type === 'superscript'))).toBe(true)
      const headers = findBlocks(roundTripped, 'tableHeader')
      expect(headers[0]?.attrs?.background).toBe('#D9D9D9')
      const images = findBlocks(roundTripped, 'image')
      expect(images[0]?.attrs?.width).toBe(200)
    } finally {
      editor.destroy()
    }
  })

  it('tương thích ngược: bản ghi contentVersion 1 (định dạng 07A) mở và lưu lại thành version 2', async () => {
    const db = new WebScribbleDatabase(`webscribble-07c-compat-${crypto.randomUUID()}`)
    const foundation = createStorageFoundation(db)
    const doc = await foundation.documents.create({
      name: 'cu.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob: new Blob(['docx-goc'], { type: 'application/octet-stream' }),
    })
    // Nội dung đúng hình dạng version 1 (chỉ paragraph + bold):
    const v1Content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Nội dung cũ', marks: [{ type: 'bold' }] }] },
      ],
    } as unknown as WordDocumentContent
    await foundation.contents.saveContent({ documentId: doc.id, contentVersion: 1, content: v1Content, updatedAt: 1 })

    const controller = new WordEditorController({ contents: foundation.contents })
    const opened = await controller.open(doc.id)
    expect(JSON.stringify(opened)).toContain('Nội dung cũ')
    // Sửa thêm một đoạn rồi đóng (close chờ flush): bản ghi
    // được ghi lại theo định dạng hiện tại (version 2),
    // nội dung cũ giữ nguyên.
    const edited = {
      type: 'doc',
      content: [...opened.content, { type: 'paragraph', content: [{ type: 'text', text: 'Đoạn mới' }] }],
    } as unknown as WordDocumentContent
    controller.bindEditor(() => edited)
    controller.markChanged()
    await controller.close()
    const record = await foundation.contents.getContent(doc.id)
    expect(record?.contentVersion).toBe(2) // lưu lại theo định dạng hiện tại
    expect(JSON.stringify(record?.content)).toContain('Nội dung cũ')
    expect(JSON.stringify(record?.content)).toContain('Đoạn mới')
    db.close()
  }, 30000)
})
