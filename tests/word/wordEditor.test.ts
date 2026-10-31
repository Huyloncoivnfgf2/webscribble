// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createWordEditorExtensions } from '../../src/app/features/documents/wordEditorExtensions'
import {
  convertDocxToWordContent,
  validateWordContent,
  type WordDocumentContent,
} from '../../src/engines/word/index'
import { buildDocx } from './fixtures'
import { createTestConvertOptions, toArrayBuffer } from './testEnv'

/**
 * TASK-07B — Editor Tiptap headless (môi trường jsdom):
 * khởi tạo từ chính nội dung TASK-07A chuyển đổi, sửa,
 * undo/redo, và JSON xuất ra vẫn đúng Content Model.
 */

async function fixtureContent(): Promise<WordDocumentContent> {
  const { content } = await convertDocxToWordContent(
    toArrayBuffer(buildDocx()),
    createTestConvertOptions(),
  )
  return content
}

function makeEditor(content: unknown): Editor {
  return new Editor({
    extensions: createWordEditorExtensions(),
    content: content as never,
  })
}

describe('TASK-07B — khởi tạo editor từ Content Model của TASK-07A', () => {
  it('nạp heading/đoạn/marks/danh sách/bảng/ảnh và getJSON vẫn hợp lệ theo model', async () => {
    const content = await fixtureContent()
    const editor = makeEditor(content)
    const json = editor.getJSON() as unknown as WordDocumentContent
    const validation = validateWordContent(json)
    expect(validation.errors).toEqual([])
    expect(validation.valid).toBe(true)
    const text = JSON.stringify(json)
    expect(text).toContain('Tiêu đề chính')
    expect(text).toContain('chữ đậm')
    expect(json.content.some((b) => b.type === 'heading')).toBe(true)
    expect(json.content.some((b) => b.type === 'bulletList')).toBe(true)
    expect(json.content.some((b) => b.type === 'table')).toBe(true)
    expect(json.content.some((b) => b.type === 'image')).toBe(true)
    editor.destroy()
  })
})

describe('TASK-07B — chỉnh sửa bằng editor', () => {
  it('toggleBold trên vùng chọn, chèn văn bản, undo/redo', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }],
    })
    editor.chain().setTextSelection({ from: 1, to: 6 }).toggleBold().run()
    let json = editor.getJSON() as unknown as WordDocumentContent
    const firstRun = (json.content[0]?.content ?? [])[0] as
      | { text?: string; marks?: Array<{ type: string }> }
      | undefined
    expect(firstRun?.text).toBe('hello')
    expect(firstRun?.marks).toEqual([{ type: 'bold' }])

    editor.chain().setTextSelection({ from: 12, to: 12 }).insertContent(' thêm').run()
    expect(JSON.stringify(editor.getJSON())).toContain('thêm')

    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON())).not.toContain('thêm')
    editor.commands.redo()
    expect(JSON.stringify(editor.getJSON())).toContain('thêm')
    json = editor.getJSON() as unknown as WordDocumentContent
    expect(validateWordContent(json).valid).toBe(true)
    editor.destroy()
  })

  it('đổi đoạn thành heading và tạo danh sách', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'một dòng' }] }],
    })
    editor.chain().setTextSelection({ from: 1, to: 1 }).toggleHeading({ level: 2 }).run()
    let json = editor.getJSON() as unknown as WordDocumentContent
    expect(json.content[0]?.type).toBe('heading')
    expect(json.content[0]?.attrs?.level).toBe(2)
    editor.chain().setTextSelection({ from: 1, to: 1 }).setParagraph().toggleBulletList().run()
    json = editor.getJSON() as unknown as WordDocumentContent
    expect(json.content[0]?.type).toBe('bulletList')
    expect(validateWordContent(json).valid).toBe(true)
    editor.destroy()
  })
})
