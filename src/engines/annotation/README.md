# Annotation Engine

Quản lý dữ liệu chú thích (nét vẽ, highlight, ghi chú) theo bề mặt
(surface): trang tài liệu hoặc không gian bảng trắng. Annotation lưu
riêng, tách khỏi file gốc (DEC-017, DEC-020).

- Quyết định liên quan: DEC-015, DEC-017, DEC-020
- Task triển khai: TASK-05/TASK-08
- Trạng thái: TASK-06C đã có Annotation Engine — `annotationEngine.ts`
  (`createAnnotationEngine({ annotations, autosave? })`,
  `openDocumentPage(documentId, pageIndex, { pageSize })` →
  AnnotationSurfaceSession: surface/listObjects/getSaveState/
  getSaveError/saveNow/deleteSavedData/close), `notifyingSurface.ts`
  (DrawingSurface bọc phát thông báo sau mỗi thay đổi thành công —
  cơ chế engine biết dữ liệu đổi mà không polling, không sửa
  Drawing Engine), `serialization.ts` (serialize bằng structuredClone;
  nạp validate bằng chính validateDrawingObject của Drawing Engine +
  khớp surfaceId, một object lỗi → cả lần mở thất bại, bản lưu không
  bị đụng), `errors.ts` (AnnotationError: already-open/closed/
  invalid-data/persistence; AnnotationDataError mang objectIndex/
  objectId/problems). Chưa có overlay/mapping tọa độ (TASK-06D).
