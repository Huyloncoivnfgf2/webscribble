import type {
  DocumentContentRepository,
  DocumentRecord,
  DocumentRepository,
} from '../../data/index'
import { WordImportError } from './errors'
import {
  DOCX_MIME_TYPE,
  convertDocxToWordContent,
  type ConvertDocxOptions,
  type DocxConversionResult,
} from './importer'

/**
 * Nhập một file DOCX vào thư viện (TASK-07A): chuyển đổi
 * TRƯỚC, lưu SAU — chuyển đổi lỗi thì không tạo bất kỳ bản
 * ghi nào. Thứ tự lưu: DocumentRepository.create (Blob gốc)
 * rồi DocumentContentRepository.saveContent (mô hình nội
 * dung); nếu lưu nội dung lỗi, XÓA tài liệu vừa tạo (cascade)
 * để thư viện không bao giờ chứa một tài liệu DOCX không có
 * nội dung dùng được, và ném WordImportError 'persistence'.
 */

export interface ImportDocxToLibraryDeps {
  documents: DocumentRepository
  contents: DocumentContentRepository
}

export interface ImportDocxToLibraryInput {
  name: string
  data: ArrayBuffer
}

export async function importDocxToLibrary(
  deps: ImportDocxToLibraryDeps,
  input: ImportDocxToLibraryInput,
  options: ConvertDocxOptions = {},
): Promise<{ document: DocumentRecord; result: DocxConversionResult }> {
  const result = await convertDocxToWordContent(input.data, options)
  const blob = new Blob([input.data.slice(0)], { type: DOCX_MIME_TYPE })
  const document = await deps.documents.create({
    name: input.name,
    mimeType: DOCX_MIME_TYPE,
    blob,
  })
  try {
    await deps.contents.saveContent({ documentId: document.id, content: result.content })
  } catch (cause) {
    // Rollback: xóa tài liệu vừa tạo (cascade dọn cả nếu có).
    await deps.documents.delete(document.id).catch(() => undefined)
    throw new WordImportError('persistence', { cause })
  }
  return { document, result }
}
