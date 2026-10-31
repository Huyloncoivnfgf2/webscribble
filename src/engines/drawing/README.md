# Drawing Engine

Engine vẽ duy nhất cho cả 3 chế độ làm việc (DEC-015): Canvas 2D +
perfect-freehand, mô hình 2 lớp canvas, lưu stroke dạng điểm thô + bbox.
Hoàn toàn không biết tài liệu bên dưới là PDF, Word hay bảng trắng.

- Quyết định liên quan: DEC-015, DEC-016, DEC-019
- Task triển khai: TASK-05
- Trạng thái: **đã có nền dữ liệu (TASK-05A)** — `types.ts` (DrawingObject
  union: pen, highlighter, line, rectangle, ellipse, arrow, text),
  `objects.ts` (factories + ID), `geometry.ts` (bounds), `coordinates.ts`
  (Camera + biến đổi world/screen), `validation.ts`, `surface.ts`
  (DrawingSurface + InMemorySurface, gồm nhóm phương thức update).
  **Đã có Input Manager (TASK-05B)** — `input.ts`. **Đã có Stroke
  Engine & Renderer (TASK-05C)** — `strokeBuilder.ts` (PointerInputEvent
  → StrokeObject), `renderer.ts` (outline perfect-freehand + fill
  Canvas 2D), `canvasRenderer.ts` (rAF, DPR, resize, redraw toàn bộ),
  `engine.ts` (DrawingEngine tích hợp cho một bề mặt). **Đã có Shape
  & Text Engine (TASK-05D)** — `shapeBuilder.ts`, `text.ts`, renderer
  vẽ đủ 7 loại object qua `drawObject`. **Đã có Selection & Eraser
  (TASK-05E)** — `selection.ts` (chọn rect/lasso bằng hình học thật,
  di chuyển nguyên tử), `eraser.ts` (Stroke/Segment Eraser); bounds
  của hình/arrow đã bao phủ mực vẽ thật. **Đã có History Manager
  (TASK-05F)** — `history.ts` (Undo/Redo theo Command Pattern, riêng
  theo Surface). Chưa có trang thử nghiệm — thuộc pha sau của TASK-05.
