/**
 * PdfEngine (TASK-06A): mở tài liệu PDF bằng PDF.js với worker đóng
 * gói local, đọc metadata/trang, quản lý vòng đời và phân loại lỗi.
 * Render trang thuộc TASK-06B.
 */
export * from './errors'
export * from './geometry'
export * from './loader'
export * from './renderer'
export * from './annotationMapping'
export * from './overlay'
export * from './exportPdf'
export { ensurePdfjsConfigured } from './pdfjs'
