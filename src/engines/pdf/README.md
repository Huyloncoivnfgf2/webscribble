# PdfEngine

Hiển thị PDF bằng PDF.js (worker đóng gói cùng ứng dụng), cung cấp hệ tọa
độ trang cho lớp chú thích. Không sửa text gốc trong PDF (DEC-017).

- Quyết định liên quan: DEC-016, DEC-017
- Task triển khai: TASK-06
- Trạng thái: TASK-06A đã có Document Loader — `pdfjs.ts` (cấu hình +
  worker local qua `?url`, không CDN), `loader.ts`
  (`openPdfDocument(source, { signal })` → PdfDocumentHandle:
  pageCount, metadata, getPage/getNativePage theo index zero-based,
  close; dữ liệu của caller không bị detach), `errors.ts`
  (PdfLoadError phân loại: not-a-pdf, corrupt, password — chỉ phát
  hiện, unsupported, cancelled, worker, closed, unknown;
  PdfPageIndexError; PdfRenderError của tầng render).
  TASK-06B đã thêm: `geometry.ts` (`getPdfPageGeometry` — kích
  thước trang/viewport/rotation từ getViewport của PDF.js) và
  `renderer.ts` (`PdfPageRenderer` — render trang lên canvas, bitmap
  nhân devicePixelRatio còn CSS giữ nguyên, registry theo canvas:
  render mới hủy và chờ render cũ, cancel/cancelAll/dispose; lỗi
  loader truyền nguyên vẹn, lỗi thô của PDF.js được phân loại
  thành cancelled/render-failed). TASK-06D đã thêm:
  `annotationMapping.ts` (`createPdfAnnotationMapping(viewport,
  { devicePixelRatio })` — ánh xạ 5 hệ tọa độ: PDF user space ↔
  world (khung trang đã hiển thị tại scale 1) qua chính
  convertToViewportPoint/convertToPdfPoint của PageViewport;
  world ↔ viewport = scale thuần; viewport ↔ canvas = DPR) và
  `overlay.ts` (`PdfAnnotationOverlay` — render PDF bằng
  PdfPageRenderer lên canvas PDF, render annotation bằng
  CanvasRenderer của Drawing Engine lên canvas overlay trong
  suốt với camera {0, 0, zoom: scale}; tự vẽ lại khi annotation
  đổi qua subscription trên NotifyingSurface; setScale/
  setDevicePixelRatio/refreshAnnotations/cancel/dispose;
  tùy chọn annotationRendering: 'external' để DrawingEngine
  sở hữu việc vẽ khi có tương tác — TASK-06E đã tích hợp
  thành React PDF Viewer thật trong Document Mode).
