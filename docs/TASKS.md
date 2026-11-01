# TASKS — WebScribble

> Trạng thái hợp lệ: `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `TESTING` · `DONE`.
> Chỉ đánh dấu DONE khi có bằng chứng nghiệm thu. Không tự bắt đầu task tiếp
> theo khi chưa được chủ dự án yêu cầu (xem AI_WORKFLOW.md).

---

## TASK-00 — Khởi tạo hệ thống bộ nhớ dự án
- **Trạng thái:** DONE
- **Mục tiêu:** Tạo hệ thống tài liệu/bộ nhớ trong `docs/` để mọi phiên AI sau
  làm việc liên tục mà không phụ thuộc lịch sử hội thoại.
- **Phụ thuộc:** Không.
- **Phạm vi:** Chỉ tài liệu. Không code, không cài dependency, không sửa cấu hình.
- **File thay đổi:** `docs/PROJECT_INDEX.md`, `PROJECT_CONTEXT.md`,
  `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `CURRENT_STATE.md`, `TASKS.md`,
  `DECISIONS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `AI_WORKFLOW.md`.
- **Tiêu chí nghiệm thu:** Đủ 10 file; PROJECT_INDEX < 100 dòng; nội dung nhất
  quán giữa các file; ghi rõ ứng dụng chưa được lập trình.
- **Kết quả:** Hoàn thành 2026-10-30. Kiểm tra: xem CHANGELOG.md mục TASK-00.

## TASK-01 — Khảo sát & kiểm chứng công nghệ
- **Trạng thái:** DONE
- **Mục tiêu:** Ba luồng khảo sát:
  (A) Kiểm chứng stack đề xuất (React, TypeScript, Vite, Tailwind CSS,
  PDF.js, pdf-lib, Tiptap, IndexedDB, Zustand, Service Worker): tương thích
  lẫn nhau, khả năng offline, hành vi trên Safari iOS và Android.
  (B) Đánh giá module của StudyWrite theo DEC-013 để chọn lọc tái sử dụng:
  chất lượng module, quyền sử dụng/nguồn gốc mã nguồn, khả năng tách module
  khỏi file HTML đơn của StudyWrite.
  (C) Khảo sát kiến trúc cho hệ thống 3 chế độ (DEC-014/DEC-015): mô hình
  "bề mặt" (surface) cho dữ liệu viết tay, Whiteboard Engine, cơ chế lưu
  trạng thái hai vùng của Split Mode (ISSUE-013), tính khả thi của Infinite
  Canvas (ISSUE-012), định dạng ảnh bổ sung gồm HEIC (ISSUE-014).
- **Phụ thuộc:** TASK-00; quyết định DEC-013/DEC-014/DEC-015 (đã có).
- **Phạm vi:** Lập tài liệu khảo sát + (nếu được duyệt) bản thử nghiệm nhỏ
  ngoài source chính. Đối với StudyWrite: chỉ đọc và đánh giá, **không sửa
  file StudyWrite**, không mang code sang WebScribble trong task này. Không
  chốt stack trong task này (chốt ở TASK-02).
- **File dự kiến:** `docs/research/TECH_SURVEY.md` (mới — luồng A + C),
  `docs/research/STUDYWRITE_MODULE_AUDIT.md` (mới — luồng B), cập nhật
  `KNOWN_ISSUES.md` (ISSUE-001, 012, 013, 014), `ARCHITECTURE.md` (trạng
  thái công nghệ và mục 6 nếu khảo sát làm rõ thêm).
- **Tiêu chí nghiệm thu:**
  - Mỗi công nghệ ở luồng A có kết luận: dùng được offline hay không, rủi
    ro chính, phương án thay thế; ISSUE-001 được cập nhật bằng chứng.
  - Mỗi module ứng viên của StudyWrite ở luồng B có kết luận đủ 3 mục:
    chất lượng, quyền/nguồn gốc, tách được hay không → khuyến nghị
    DÙNG / KHÔNG DÙNG / DÙNG SAU KHI SỬA.
  - Luồng C có kết luận ban đầu cho ISSUE-012/013/014 để TASK-02 quyết định.
  - Chưa có code ứng dụng nào được tạo trong task này.
- **Kết quả:** Hoàn thành 2026-10-30. Đầu ra: `docs/research/TECH_SURVEY.md`
  (Luồng A), `docs/research/STUDYWRITE_MODULE_AUDIT.md` (Luồng B),
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` (Luồng C);
  ISSUE-001 chuyển INVESTIGATING, ISSUE-002/007/010/012/013/014 được cập
  nhật bằng chứng/kết luận nghiên cứu. Chi tiết: CHANGELOG.md mục TASK-01.
  Các quyết định chốt để lại cho TASK-02 (không tự chốt trong task này).

## TASK-02 — Chốt kiến trúc & quyết định công nghệ
- **Trạng thái:** DONE
- **Mục tiêu:** Dựa trên TASK-01, chốt stack và kiến trúc chi tiết (module,
  giao diện giữa các engine, mô hình dữ liệu chú thích).
- **Phụ thuộc:** TASK-01.
- **Phạm vi:** Tài liệu kiến trúc + quyết định. Chưa code.
- **File dự kiến:** `ARCHITECTURE.md` (bản chốt), `DECISIONS.md` (quyết định
  công nghệ mới), `PRODUCT_SPEC.md` (cập nhật nhãn CHƯA XÁC MINH nếu có).
- **Tiêu chí nghiệm thu:** Mọi công nghệ trong ARCHITECTURE.md có quyết định
  tương ứng trong DECISIONS.md; mô hình dữ liệu chú thích được mô tả rõ.
- **Kết quả:** Hoàn thành 2026-10-30. Chủ dự án xác nhận 8 quyết định, đã
  ghi thành **DEC-016 → DEC-023**: stack chính thức kèm Dexie (DEC-016);
  phạm vi PDF flatten (DEC-017); phạm vi DOCX chấp nhận mất định dạng
  (DEC-018); Whiteboard trang cố định, chưa Infinite Canvas (DEC-019);
  mô hình Workspace/Surface (DEC-020); xuất Split = phương án B (DEC-021);
  iOS offline + sao lưu/khôi phục bắt buộc (DEC-022); HEIC chưa tích hợp
  decoder (DEC-023). ARCHITECTURE.md mục 1 đã chuyển sang bản chốt;
  PRODUCT_SPEC đồng bộ theo các quyết định. ISSUE-001/002/007/010/012/013
  → RESOLVED; ISSUE-014 thu hẹp. Chi tiết: CHANGELOG.md mục TASK-02.

## TASK-03 — Khởi tạo khung dự án (project skeleton)
- **Trạng thái:** DONE
- **Mục tiêu:** Tạo khung code theo stack đã chốt: Vite + React + TypeScript
  + Tailwind (hoặc tương đương theo TASK-02), cấu trúc thư mục như
  ARCHITECTURE.md, lint/build chạy được.
- **Phụ thuộc:** TASK-02.
- **Phạm vi:** Khung rỗng + trang chào. Chưa có tính năng tài liệu/vẽ.
- **File dự kiến:** `package.json`, `vite.config.*`, `src/**` (khung),
  `index.html`.
- **Kết quả:** Hoàn thành 2026-10-30. Khung Vite + React + TypeScript +
  Tailwind CSS v4 (plugin `@tailwindcss/vite`) + ESLint flat config tại
  `~/workspace/webscribble/`; cấu trúc thư mục theo ARCHITECTURE.md mục 3
  (app/core/engines/data/offline + các thư mục dùng chung); 7 thư mục
  engine có README placeholder, chưa có code chức năng; trang khởi đầu
  tối giản (tên + tagline). Đã chạy thật: `npm run build` đạt (gồm
  `tsc -b`), `npm run lint` đạt (exit 0), `npm run dev` khởi động và
  phục vụ đúng trang. Git local đã khởi tạo (nhánh `main`, chưa commit,
  chưa remote). Hai điều chỉnh kỹ thuật đã báo cáo: template Vite mới
  dùng oxlint → thay bằng ESLint theo yêu cầu task; TypeScript chốt
  5.9.3 thay vì 7.0.2 vì typescript-eslint chưa hỗ trợ TS 7 trong peer
  range. Chi tiết: CHANGELOG.md mục TASK-03.
- **Tiêu chí nghiệm thu:** `dev`/`build`/`lint` chạy thành công trên máy phát
  triển; cấu trúc thư mục khớp ARCHITECTURE.md.

## TASK-04 — UI shell & responsive layout
- **Trạng thái:** DONE
- **Mục tiêu:** Khung giao diện: màn hình thư viện tài liệu, màn hình làm việc,
  thanh công cụ; responsive desktop/tablet/mobile.
- **Phụ thuộc:** TASK-03.
- **Phạm vi:** Giao diện tĩnh + điều hướng; dữ liệu giả nếu cần.
- **File dự kiến:** `src/app/**`.
- **Tiêu chí nghiệm thu:** Hiển thị đúng trên 3 kích thước màn hình đại diện;
  nút công cụ đủ lớn cho cảm ứng; không lỗi console.
- **Kết quả:** Hoàn thành 2026-10-30. Application Shell gồm Sidebar (logo +
  5 mục điều hướng, thu gọn 256px → 76px trên desktop, drawer trên mobile),
  Header (breadcrumb + tiêu đề, ô tìm kiếm giao diện, nút cài đặt), Main
  Workspace với 4 khu vực ở Trang chủ: Welcome, Quick Actions, Workspace
  Modes (3 thẻ chế độ chọn được + panel xem trước theo chế độ), Recent
  Documents (empty state — **không dùng dữ liệu giả**). Các trang Tài liệu
  gần đây / Tài liệu của tôi / Bảng trắng / Cài đặt là placeholder trung
  thực: nút chưa có chức năng thật hiển thị thông báo rõ ràng thay vì giả
  vờ thành công. Phong cách Minimalist Premium, bảng màu trắng/xám/xanh
  dương nhạt; icon Lucide qua npm (lucide-react 1.65.0, ISC). Đã kiểm
  chứng bằng trình duyệt headless ngay trên máy: 1440/768/390px không
  tràn ngang, drawer mobile đóng/mở và điều hướng đúng, chọn Split Mode
  đổi xem trước + trạng thái active, thông báo ở trang Tài liệu xuất
  hiện, **không lỗi console**. `lint`/`build` đạt. Chi tiết: CHANGELOG.md
  mục TASK-04. Đã commit ngày 2026-10-30: `b4aa4ae` "feat: build
  WebScribble UI shell and navigation".

## TASK-05 — Drawing Engine
- **Trạng thái:** DONE (05A–05G hoàn thành 2026-10-31;
  đã commit `7aa608e` "feat: complete drawing engine")
- **Tiến độ:** **Pha 05A (Data Model & Surface Interface) — DONE ngày
  2026-10-31.** Đã có trong `src/engines/drawing/`: types (DrawingObject
  union 7 loại), factories + sinh ID, geometry (bounds), coordinates
  (Camera tách khỏi dữ liệu + biến đổi world↔screen), validation,
  DrawingSurface + InMemorySurface; 48 unit test đạt (`tests/drawing/`).
  **Bổ sung 2026-10-31 (chủ dự án yêu cầu):** nhóm phương thức cập nhật
  của DrawingSurface — `updateObject`, `updateObjects` (nguyên tử),
  `replaceObject` (nguyên tử, cho Segment Eraser) — kèm 13 unit test
  mới (tổng 61 test đạt). Cùng ngày, 3 đề xuất của 05A được chủ dự án
  phê duyệt thành **DEC-024** (Vitest), **DEC-025** (StrokePoint.time
  tương đối), **DEC-026** (TextObject tự mang width/height).
  **Pha 05B (Input Manager) — DONE ngày 2026-10-31:** `input.ts` —
  PointerInputManager dùng Pointer Events cho mouse/touch/pen, chuẩn
  hóa tọa độ về world qua Camera, pressure/tilt kèm fallback, pointer
  capture, chỉ một pointer hoạt động tại một thời điểm, mở rộng
  coalesced events khi trình duyệt hỗ trợ; 25 unit test mới (tổng 86
  test đạt). Chi tiết: CHANGELOG.md mục TASK-05B.
  **Pha 05C (Stroke Engine & Renderer) — DONE ngày 2026-10-31:**
  `strokeBuilder.ts` (nét từ PointerInputEvent, cancel giữ nét, time
  tương đối không giảm), `renderer.ts` (outline bằng perfect-freehand
  1.2.3 — cài theo DEC-016), `canvasRenderer.ts` (rAF gộp frame, DPR,
  resize, redraw từ dữ liệu), `engine.ts` (DrawingEngine tích hợp:
  input → builder → surface + renderer); Input Manager bổ sung
  `reset()`. 38 unit test mới (tổng 124 test đạt).
  **Pha 05D (Shape & Text Engine) — DONE ngày 2026-10-31:**
  `shapeBuilder.ts` (4 loại hình, chính sách loại hình suy biến khi
  hoàn tất), `text.ts` (Text Engine: layout + đo qua TextMeasurer
  tiêm vào, DEC-026, từ chối text rỗng), renderer mở rộng `drawShape`/
  `drawText`/`drawObject` vẽ đủ 7 loại, CanvasRenderer bỏ bộ lọc chỉ
  vẽ nét, DrawingEngine thêm công cụ hình + text (callback đặt text +
  `addTextObject`). 42 unit test mới (tổng 166 test đạt).
  **Pha 05E (Selection & Eraser) — DONE ngày 2026-10-31:**
  `selection.ts` (chọn rect/lasso với giao nhau hình học thật hai
  tầng, lasso tự cắt bị từ chối, di chuyển nhiều object nguyên tử qua
  updateObjects), `eraser.ts` (Stroke Eraser theo khoảng cách thật;
  Segment Eraser cắt nét bằng hình học đoạn–tròn, thay thế nguyên tử
  qua replaceObject), sửa bounds ở geometry/factory để bounds = phạm
  vi mực thật (hình gồm nửa độ dày nét; arrow gồm đầu mũi tên —
  đầu mũi tên chuyển sang đơn vị world), CanvasRenderer thêm lớp phủ
  overlay, DrawingEngine thêm công cụ select-rect/select-lasso/
  stroke-eraser/segment-eraser + moveSelectionBy/deleteSelection.
  74 unit test mới (tổng 240 test đạt).
  **Pha 05F (History Manager) — DONE ngày 2026-10-31:** `history.ts`
  (SurfaceChangeCommand tổng quát + performer add/remove/update/
  replace/move + HistoryManager riêng theo Surface, giới hạn mặc
  định 100 command), Surface bổ sung `insertObjectAt` và
  `replaceObject` giữ vị trí, DrawingEngine tích hợp undo/redo cho
  mọi thao tác (một lần kéo tẩy = một command). 33 unit test mới
  (tổng 273 test đạt).
  **Pha 05G (Integration & Testing) — DONE ngày 2026-10-31:** kiểm
  thử tích hợp toàn diện (48 test mới, tổng 321 test đạt): mọi công
  cụ, selection/eraser trên cảnh chồng nhau, chuỗi history hỗn hợp,
  vòng đời pointer, cô lập hai engine (Split), stress render/
  selection/history và kiểm chứng trình duyệt Chromium headless
  (16/16). Phát hiện và sửa 1 bug thật: StrokeBuilder đánh rơi điểm
  nhả bút (xem CHANGELOG). Chưa kiểm chứng thiết bị thật/Safari —
  phần còn mở của ISSUE-006, không chặn các task engine tiếp theo.
  Chưa làm: trang thử nghiệm chính thức — thuộc phạm vi UI sau này,
  chờ chủ dự án giao.
- **Mục tiêu:** Canvas vẽ độc lập: bút, highlight, tẩy, nhiều màu/độ dày,
  hỗ trợ stylus + pressure (nếu trình duyệt hỗ trợ), làm mượt nét, undo/redo.
  Đây là engine vẽ **duy nhất** phục vụ cả 3 chế độ làm việc (DEC-015) —
  thiết kế theo trừu tượng "bề mặt" của ARCHITECTURE.md, không viết riêng
  cho từng chế độ.
- **Phụ thuộc:** TASK-03 (tọa độ trang theo ARCHITECTURE.md mục 5).
- **Phạm vi:** Chỉ engine vẽ + trang thử nghiệm nội bộ; chưa gắn tài liệu thật.
- **File dự kiến:** `src/engines/drawing/**`.
- **Tiêu chí nghiệm thu:** Viết nhanh không giật/thiếu nét trên desktop và
  tablet; nét vẽ lại đúng vị trí sau zoom; engine không import module tài liệu.

## TASK-06 — PDF Engine: xem & chú thích
- **Trạng thái:** DONE ngày 2026-10-31 — cả 6 subtask 06A → 06F
  đã hoàn thành (chi tiết từng subtask bên dưới; TASK-06F là vòng
  kiểm thử tích hợp + hardening cuối). Đã replan ngày 2026-10-31
  theo quyết định Q1 = B: annotation phải bền qua reload và khởi
  động lại app — nền lưu trữ TASK-08A làm trước, xem dưới.
- **Mục tiêu:** Mở/hiển thị PDF (PDF.js), phủ lớp vẽ của Drawing Engine,
  lưu/tải lại chú thích theo trang qua Storage Foundation.
- **Phụ thuộc:** TASK-05 (xong, commit `7aa608e`), TASK-08A (xong).
- **Phạm vi:** Xem + chú thích. Chưa xuất file (TASK-09).
- **File dự kiến:** `src/engines/pdf/**`, `src/engines/annotation/**`.
- **Tiêu chí nghiệm thu:** Mở PDF mẫu nhiều trang; vẽ trên trang bất kỳ;
  đóng/mở lại và reload trang web chú thích còn nguyên đúng vị trí,
  kể cả sau zoom/cuộn.
- **Subtask đã chốt:** 06A PDF.js & Loader → 06B Render & hình học
  trang → 06C Annotation Engine (dùng repository thật của TASK-08A)
  → 06D Overlay Integration → 06E Viewer tối thiểu → 06F Integration
  & Testing. Chi tiết trong báo cáo replan ngày 2026-10-31.
- **TASK-06A — PDF.js & Document Loader: DONE ngày 2026-10-31.**
  Cài pdfjs-dist 6.4.299 (Apache-2.0); worker đóng gói local qua
  Vite `?url` (kiểm chứng cả dev lẫn production build: worker tải
  từ cùng origin, không CDN; bản chính không chạy được trong Node
  nên vitest.config.ts alias sang bản legacy riêng cho test).
  `src/engines/pdf/`: pdfjs.ts (cấu hình một lần), loader.ts
  (openPdfDocument nhận Blob/ArrayBuffer/Uint8Array, sao chép dữ
  liệu caller để không bị PDF.js detach; PdfDocumentHandle:
  pageCount/metadata/getPage/getNativePage index zero-based,
  close = destroy loading task, AbortSignal hủy loading),
  errors.ts (PdfLoadError phân loại not-a-pdf/corrupt/password/
  unsupported/cancelled/worker/closed/unknown + cause;
  PdfPageIndexError). Fixtures sinh bằng code (gồm PDF mã hóa
  Standard R2 tự dựng để test lỗi mật khẩu). 17 test mới, tổng
  365/365; kiểm chứng trình duyệt thật 7/7 ở cả dev và production.
  PDF có mật khẩu hiện chỉ PHÁT HIỆN (kind password), chưa mở khóa.
  Chưa commit.
- **TASK-06B — Page Rendering & Geometry: DONE ngày 2026-10-31.**
  `geometry.ts`: getPdfPageGeometry(handle, index, scale) — mọi số
  đo từ getViewport của PDF.js (pageWidth/Height tại scale 1,
  viewport tại scale yêu cầu, rotation, kèm viewport native cho
  06D); scale không hợp lệ → PdfRenderError invalid-argument.
  `renderer.ts`: PdfPageRenderer (mỗi instance một registry
  WeakMap theo canvas, không global state) — render(handle, index,
  canvas, {scale, devicePixelRatio, background}); bitmap =
  viewport × DPR (làm tròn, tối thiểu 1), style CSS = viewport
  thuần, PDF.js nhận transform nhân DPR (bỏ khi DPR = 1); entry
  đăng ký đồng bộ ngay khi gọi nên cancel ngay lập tức có tác
  dụng; render mới trên cùng canvas hủy + CHỜ render cũ kết thúc
  hẳn mới vẽ; cancel/cancelAll/dispose idempotent; lỗi loader
  (closed/index) truyền nguyên vẹn, lỗi render PDF.js →
  render-failed kèm cause, hủy/transport destroy → cancelled.
  Hai lỗi thật do test bắt được và đã sửa: canvas null từng làm lộ
  TypeError của WeakMap thay vì PdfRenderError (nay validate
  trước khi đăng ký); lỗi thô PDF.js ở bước lấy trang khi đóng
  tài liệu giữa chừng từng thoát ra không định dạng (nay phân
  loại cancelled/render-failed, kiểm chứng lại ở trình duyệt
  thật: rejected:cancelled). 23 test mới (7 geometry trên PDF.js
  thật gồm trang xoay 90°, 16 renderer bằng page/canvas giả có
  kiểm soát), tổng 388/388; Browser QA 16/16 ở DPR 1 và DPR 2
  (điểm ảnh có mực thật, hủy, đóng giữa render nặng 3.000 dòng
  chữ, 0 lỗi console). Chưa commit. Kế tiếp: TASK-06C.
- **TASK-06C — Annotation Engine: DONE ngày 2026-10-31.**
  `src/engines/annotation/`: AnnotationEngine quản lý session theo
  surfaceId (mỗi surface tối đa 1 session, mở trùng →
  already-open); openDocumentPage nạp + validate dữ liệu đã lưu
  bằng chính validateDrawingObject của Drawing Engine + khớp
  surfaceId (một object lỗi → AnnotationDataError mang
  objectIndex/objectId/problems, lần mở thất bại sạch, bản lưu
  không bị đụng; record schema tương lai → lỗi của data layer
  truyền nguyên vẹn). Kết nối Drawing Engine qua NotifyingSurface
  (bọc DrawingSurface, phát thông báo sau mỗi mutation thành
  công — gồm cả undo/redo qua insertObjectAt) nên không polling,
  không sửa Drawing Engine. Lưu qua AutosaveManager dùng chung
  (saveNow = schedule snapshot + flush; không có autosave thì
  lưu trực tiếp có thứ tự). Chính sách đóng: mặc định flush
  trước, flush lỗi thì đóng thất bại và session vẫn mở;
  close({flush:false}) bỏ thay đổi tường minh; đóng không xóa
  dữ liệu; deleteSavedData tường minh theo thứ tự flush →
  cancel → delete. 21 test mới (khôi phục đủ 7 loại object deep
  equal, validation 4 ca, persistence/lifecycle 10 ca với
  repository lỗi có kiểm soát), tổng 409/409; Browser QA
  IndexedDB thật qua reload trang 5/5. Chưa commit. Kế tiếp:
  TASK-06D.
- **TASK-06D — PDF Annotation Overlay Integration: DONE ngày
  2026-10-31.** `src/engines/pdf/annotationMapping.ts` +
  `overlay.ts`. Quy ước tọa độ chốt bằng audit source: world của
  trang = khung trang ĐÃ HIỂN THỊ tại scale 1 (= viewport scale
  1 của PDF.js, gốc trên-trái, y xuống) → world ↔ viewport là
  phép nhân scale thuần ở mọi rotation; PDF user space ↔ world
  đi qua convertToViewportPoint/convertToPdfPoint của chính
  PageViewport (PDF.js lo flip + rotation); canvas physical =
  viewport × DPR, DPR không vào dữ liệu. Overlay: PDF vẽ bằng
  PdfPageRenderer lên canvas PDF, annotation vẽ bằng
  CanvasRenderer của Drawing Engine lên canvas overlay trong
  suốt (camera {0,0,zoom: scale}), đồng bộ qua subscription
  trên NotifyingSurface (không polling), session đóng → overlay
  tự dispose; setScale/setDevicePixelRatio/refreshAnnotations/
  cancel/dispose đầy đủ. 19 test mới (9 mapping trên viewport
  thật đủ 4 rotation với điểm cụ thể + round-trip; 10 overlay
  với session thật), tổng 428/428. Browser QA 50/50 ở DPR 1/2:
  annotation rectangle đặt theo tọa độ world tính từ marker đỏ
  trong nội dung PDF — bbox mực trùng bbox marker trong ±2 CSS
  px ở cả 4 rotation, scale 1 và 2. Một kỳ vọng test rotation
  180 ban đầu do assistant suy luận sai đã được sửa theo hành
  vi thật của PDF.js (transform [-1,0,0,1,612,0]). Chưa commit.
  Kế tiếp: TASK-06E.
- **TASK-06E — Minimal React PDF Viewer Integration: DONE ngày
  2026-10-31.** `src/app/features/documents/`:
  PdfViewerController (điều phối không phụ thuộc React),
  PdfViewer.tsx, pdfViewerState.ts; `src/app/storage.ts` nối
  tầng UI với foundation + AnnotationEngine dùng chung.
  DocumentsPage thành thư viện thật (import PDF có kiểm chữ
  ký, danh sách, xóa, mở viewer). Viewer: mở từ Blob đã lưu,
  một trang tại một thời điểm, điều hướng + nhập số trang
  (clamp), zoom [25%..400%] + Fit mặc định, công cụ Pen/
  Highlighter/Tẩy nét + Undo/Redo qua DrawingEngine, trạng
  thái lưu Đang lưu/Đã lưu/Lỗi + thử lưu lại. An toàn dữ liệu:
  mọi thao tác nối tiếp qua hàng đợi; chuyển trang flush
  session cũ trước — lỗi thì hủy chuyển trang và giữ dữ liệu.
  Overlay có thêm tùy chọn annotationRendering 'external'
  (mặc định 'managed' không đổi) để DrawingEngine là chủ
  render duy nhất của canvas annotation khi tương tác. 17
  test mới, tổng 445/445; Browser QA trên UI thật: dev 26/26,
  production 14/14 (vẽ → lưu → reload khôi phục, tài liệu
  xoay + cách ly annotation, DPR 2, responsive 390/768).
  Chưa commit. Kế tiếp: TASK-06F.
- **TASK-06F — PDF Viewer Integration & Testing: DONE ngày
  2026-10-31.** Vòng kiểm thử tích hợp toàn bộ workflow PDF:
  11 test tích hợp mới (tests/viewer/integration.test.ts) +
  Browser QA 06F trên UI thật (dev đủ bộ, production đủ bộ).
  **Một lỗi thật đã sửa:** AnnotationSurfaceSession.close()
  trước đây luôn ghi snapshot hiện tại kể cả khi phiên không
  có thay đổi nào — mở xem một trang rồi đóng cũng tạo record
  rỗng và (nguy hiểm hơn) có thể ghi đè annotation mới hơn
  từ phiên/tab khác bằng trạng thái tại thời điểm mở. Đã sửa
  tại annotationEngine.ts: session theo dõi hasChanges,
  saveNow xác nhận mới xóa cờ, close chỉ flush khi có thay
  đổi thật; có 2 test hồi quy (đóng phiên chỉ-đọc không tạo
  record; mở lại trang đã có annotation rồi đóng ngay thì
  updatedAt giữ nguyên). Tổng 456/456 test. Đo hiệu năng
  (Chromium headless trên VM): mở tài liệu 50 trang ≈ 700 ms,
  200 trang ≈ 680 ms, chuyển trang ≈ 260 ms, bitmap/trang ở
  fit ≈ 1,0 MB/lớp, heap phẳng sau 5 chu kỳ mở/đóng, 0 canvas
  sót trong DOM. Đa tab: ghi đồng thời vẫn last-writer-wins
  theo từng surface — ghi nhận ISSUE-015 kèm phương án đề
  xuất, không triển khai đồng bộ đa tab theo brief. TASK-06
  hoàn tất. Chưa commit. Kế tiếp: TASK-08B (Library UI).
- **TASK-06F-A — Kiểm chứng race của dirty tracking: DONE
  ngày 2026-10-31.** Theo đúng trình tự nghi vấn của brief,
  test bằng repository ghi bị giữ (deferred) đã TÁI HIỆN
  được race ở chế độ lưu trực tiếp: mutation tới trong lúc
  saveNow đang ghi bị đánh dấu nhầm là đã lưu, close()
  hoàn thành trước khi dữ liệu mới nhất xuống storage. Đã
  sửa bằng generation counter tại Annotation Engine (gồm
  flushDirect chờ chuỗi ổn định và close lặp kiểm tra),
  6 test hồi quy mới, tổng 462/462. Chi tiết: CHANGELOG.

## TASK-07 — Word Engine: xem, sửa nội dung & chú thích DOCX
- **Trạng thái:** DONE ngày 2026-10-31 — toàn bộ 07A–07F hoàn
  thành (kế hoạch TASK-07-SCOPE). Nhập (Mammoth + sanitize +
  Content Model v2), editor Tiptap + autosave, fidelity hai
  kênh, annotation một surface (DEC-029, giới hạn không bám
  chữ ghi tại ISSUE-016), xuất DOCX (DEC-030), tích hợp thư
  viện/kéo-thả và kiểm thử vòng đời + backup/restore tại
  TASK-07F (docs v1.29).
- **Mục tiêu:** Mở DOCX, chỉnh sửa nội dung (Tiptap hoặc tương đương theo
  TASK-02), chú thích phủ lên nội dung; xác định chiến lược xử lý ảnh
  WMF/EMF và công thức OMML.
- **Phụ thuộc:** TASK-05, TASK-08; kết quả xử lý ISSUE-002/003/004.
- **Phạm vi:** Xem + sửa + chú thích. Xuất DOCX: theo kế hoạch
  TASK-07-SCOPE sẽ kéo về TASK-07E (chốt lại khi giao 07E);
  TASK-09 khi đó còn xuất PDF flatten.
- **File dự kiến:** `src/engines/word/**`.
- **Tiêu chí nghiệm thu:** Mở DOCX mẫu (có bảng, ảnh thường, công thức nếu
  có); sửa chữ và lưu lại được; chú thích đúng vị trí sau khi sửa nội dung
  phía trên (hoặc ghi rõ giới hạn đã biết vào KNOWN_ISSUES.md).

### TASK-07A — DOCX Import & Editable Content Model
- **Trạng thái:** DONE (2026-10-31). Chi tiết tại CURRENT_STATE.md
  mục TASK-07A (docs v1.23). Tóm tắt: Mammoth + DOMPurify (sanitize
  tại biên) → mô hình nội dung JSON tương thích Tiptap; Dexie
  schema v2 cộng thêm bảng `documentContents` (contentVersion 1)
  + cascade xóa; thư viện nhập được DOCX (chưa có editor).
  21 test mới trong `tests/word/`. Chưa commit.

### TASK-07B — Tiptap Editor & Content Save/Restore
- **Trạng thái:** DONE (2026-10-31). Chi tiết tại CURRENT_STATE.md
  mục TASK-07B (docs v1.24). Tóm tắt: Tiptap 3.32.2 (MIT;
  StarterKit đã gồm Link + Underline, Table/Image cài riêng);
  WordEditorController với generation counter chống race (khuôn
  06F-A); autosave debounce 800 ms, lưu JSON (không HTML);
  quay lại thư viện phải flush xong, lỗi thì ở lại + cho bỏ
  thay đổi tường minh. 11 test mới. Chưa commit.

### TASK-07C — Định dạng & Fidelity
- **Trạng thái:** DONE ngày 2026-10-31. Audit fidelity bằng
  fixture giàu định dạng + đọc source Mammoth trước khi sửa;
  hỗ trợ: sup/sub, cỡ chữ/highlight/font trực tiếp (kênh
  transformDocument + style map động), căn lề đoạn + kích
  thước ảnh + nền ô (luồng document.xml có guard số lượng),
  colspan/rowspan; Content Model v2 (DEC-028). Chi tiết tại
  CURRENT_STATE.md mục TASK-07C (docs v1.26). Hoãn có lý do:
  màu chữ (Mammoth không đọc w:color), thụt lề/khoảng cách
  đoạn, border tùy biến.

### TASK-07D — Annotation Integration cho DOCX
- **Trạng thái:** DONE ngày 2026-10-31. Một surface duy
  nhất (pageIndex 0), Drawing Engine + Annotation Engine
  dùng chung, hai chế độ Sửa/Chú thích, giới hạn không
  bám theo chữ ghi thành DEC-029 và hiển thị ngay trong
  UI. Chi tiết tại CURRENT_STATE.md mục TASK-07D (docs
  v1.27).

### TASK-07E — DOCX Export
- **Trạng thái:** DONE ngày 2026-10-31. Mapper Content
  Model → thư viện `docx` 9.15.0 (MIT), dialog xuất với
  cảnh báo DEC-018, bản in/PDF kèm chú thích qua hộp
  thoại in của trình duyệt — quyết định ghi thành
  DEC-030. Chi tiết tại CURRENT_STATE.md mục TASK-07E
  (docs v1.28).

### TASK-07F — Tích hợp Document Manager & Kiểm thử tổng thể
- **Trạng thái:** DONE ngày 2026-10-31. Kéo-thả nhập nhiều
  file vào thư viện (dùng chung đường nhập với nút chọn
  file, chặn trình duyệt mở file khi thả trượt); bộ test
  vòng đời trọn vẹn + ranh giới (rỗng/lớn/Unicode/đua
  autosave); ISSUE-016 ghi giới hạn annotation DOCX;
  ISSUE-010 đóng vòng bằng chứng round-trip. Chi tiết
  tại CURRENT_STATE.md mục TASK-07F (docs v1.29).

## TASK-08 — Local Storage & Document Manager
- **Trạng thái:** DONE — cả ba phần 08A/08B/08C đều
  hoàn thành ngày 2026-10-31 (replan đưa nền lưu trữ
  lên trước TASK-06 vì Q1 = B).
- **Mục tiêu:** IndexedDB: lưu file gốc, chú thích, metadata; thư viện tài
  liệu (danh sách, mở lại, đổi tên, xóa); tự lưu; cảnh báo khi gần hết quota.
  Bao gồm thực thể bảng trắng và trạng thái workspace của Split Mode (cả
  hai bề mặt — xem ISSUE-013).
- **Phụ thuộc:** TASK-02 (mô hình dữ liệu), TASK-03.
- **Phạm vi:** Data Layer + màn hình thư viện dùng dữ liệu thật.
- **File dự kiến:** `src/data/**`, `src/app/library/**`.
- **Tiêu chí nghiệm thu:** Tắt/mở lại app (kể cả offline) dữ liệu còn nguyên;
  đo được dung lượng đã dùng; xóa tài liệu xóa sạch cả chú thích.
- **TASK-08A — Storage Foundation: DONE ngày 2026-10-31.** Dexie
  database `webscribble` schema v1 (bảng documents/annotations);
  DocumentRepository (nhập Blob nguyên vẹn, documentId mới mỗi lần
  nhập — QA-B không gộp trùng, xóa tài liệu xóa sạch annotation
  trong cùng transaction); AnnotationRepository (record theo
  surfaceId `document:<documentId>:<pageIndex>`, put nguyên tử,
  bảo vệ schemaVersion mới hơn); StorageManager (persist/estimate
  qua adapter, an toàn khi thiếu API); AutosaveManager (debounce
  400 ms theo surface, flush/cancel, chống write cũ ghi đè). 27 unit
  test fake-indexeddb + kiểm chứng IndexedDB thật trên Chromium
  headless (lưu → reload → đọc lại nguyên vẹn). Chưa commit.
- **TASK-08B — Document Manager & Library UI: DONE ngày
  2026-10-31.** Trên nền DocumentsPage của TASK-06E: danh sách
  hiển thị tên/loại/dung lượng/ngày/số trang, thứ tự "gần đây
  nhất" theo updatedAt (sắp xếp ở tầng UI, không đổi Data
  Layer); đổi tên qua updateMetadata (chặn tên rỗng, bền qua
  reload, không đụng Blob/annotation — surfaceId khóa theo
  documentId); xóa có xác nhận inline, giữ cascade; panel
  dung lượng dùng StorageManager: usage/quota ước tính + tỷ
  lệ, cảnh báo từ ngưỡng 80% (hằng số QUOTA_WARNING_THRESHOLD
  tập trung trong src/app/libraryModel.ts), trạng thái lưu
  trữ bền + nút xin cấp, trạng thái "không khả dụng" trung
  thực khi API thiếu/lỗi; RecentDocuments ở Trang chủ nối dữ
  liệu thật (tối đa 5, nhấn để mở đúng tài liệu trong
  viewer), bỏ nội dung tĩnh cũ. 13 test mới (tổng 475/475);
  Browser QA dev + production đạt toàn bộ (gồm giả lập
  estimate 85% → cảnh báo, API bị vô hiệu → trạng thái không
  khả dụng, xin persistent thành công; 1440/768/390 không
  tràn ngang). ISSUE-005 còn OPEN ở phần đo thiết bị thật.
  Chưa commit. Kế tiếp: TASK-08C hoặc TASK-07 — chờ giao.
- **TASK-08C — Whiteboard/Workspace/Backup: HOÀN TẤT PHẦN
  BACKUP/RESTORE ngày 2026-10-31** (theo brief TASK-08C của
  chủ dự án — phạm vi lần này chỉ gồm sao lưu/khôi phục):
  định dạng ZIP + manifest + SHA-256 (DEC-027), restore
  merge-remap trong một transaction, panel trong thư viện.
  Chi tiết tại CURRENT_STATE.md mục TASK-08C (docs v1.25).
  Phần thực thể bảng trắng thuộc TASK-12, trạng thái
  workspace Split thuộc TASK-13 — chưa bắt đầu.

## TASK-09 — Export Engine
- **Trạng thái:** DONE ngày 2026-10-31 (docs v1.32,
  DEC-033). Export Engine ở `src/engines/pdf/
  exportPdf.ts` (pdf-lib): flatten annotation lên
  bản sao PDF gốc — vector (outline perfect-freehand
  → drawSvgPath, hình khối → primitive, chữ →
  Helvetica) hoặc raster 3× bằng chính drawObject;
  ánh xạ world → PDF user space qua
  convertToPdfPoint của viewport (khớp 1:1, kiểm
  chứng bằng số đo content stream + render lại).
  Phạm vi tất cả trang / chỉ trang có chú thích;
  PdfExportDialog dùng chung cho Document Mode và
  Split Mode. Phía DOCX đã xong ở TASK-07E (DEC-030).
- **Mục tiêu:** Xuất PDF kèm chú thích (pdf-lib); xuất DOCX sau chỉnh sửa;
  kiểm chứng file xuất mở đúng bằng ứng dụng văn phòng phổ biến.
- **Phụ thuộc:** TASK-06, TASK-07.
- **Phạm vi:** Chỉ xuất file; không thêm tính năng sửa mới.
- **File dự kiến:** `src/engines/export/**`.
- **Tiêu chí nghiệm thu:** File xuất từ tài liệu mẫu mở đúng ở ít nhất một
  trình đọc PDF và một ứng dụng Word phổ biến; chú thích hiển thị đúng vị trí.

## TASK-10 — PWA & Offline
- **Trạng thái:** DONE ngày 2026-10-31 (docs v1.33,
  DEC-034). Manifest + bộ icons PNG tự sinh; Service
  Worker tự sinh ở bước build (generate-sw.mjs)
  pre-cache toàn bộ dist gồm PDF.js worker, phiên
  bản theo hash nội dung; cache-first + ignoreVary;
  cập nhật theo chủ động của người dùng (banner +
  SKIP_WAITING); PwaStatus: nút cài đặt
  (beforeinstallprompt), huy hiệu ngoại tuyến.
- **Mục tiêu:** Web App Manifest + Service Worker: cài đặt được, cache app
  shell và thư viện, dùng đầy đủ chức năng cốt lõi khi offline.
- **Phụ thuộc:** TASK-03; hoàn thiện sau TASK-06/07/08.
- **Phạm vi:** Offline Layer + kiểm thử cài đặt trên desktop/Android/iOS.
- **File dự kiến:** `public/manifest*`, `src/offline/**`, cấu hình build PWA.
- **Tiêu chí nghiệm thu:** Cài được lên màn hình chính; tắt mạng vẫn mở app,
  mở tài liệu đã lưu, vẽ và xuất file; có quy trình cập nhật phiên bản an toàn.

## TASK-11 — Testing & nghiệm thu tổng thể
- **Trạng thái:** TESTING — phần tự động và Chromium
  đã đạt ở mức phát hành MVP v1.0.0 (587 test Vitest,
  Browser QA từng task trên bản production, chu trình
  offline + cập nhật PWA). Phần còn lại duy nhất:
  nghiệm thu trên thiết bị/trình duyệt đại diện thật
  (bút stylus, iPad/Safari — ISSUE-006) khi có phần
  cứng; thực hiện như một vòng nghiệm thu sau phát
  hành, không chặn bản MVP.
- **Mục tiêu:** Kiểm thử theo tiêu chí nghiệm thu cấp sản phẩm
  (PRODUCT_SPEC.md mục 6) trên thiết bị/trình duyệt đại diện; xử lý lỗi tồn đọng.
- **Phụ thuộc:** TASK-04 → TASK-10, TASK-12, TASK-13.
- **Phạm vi:** Kiểm thử + sửa lỗi trong phạm vi các task trước; không thêm
  tính năng mới.
- **File dự kiến:** `tests/**`, cập nhật `KNOWN_ISSUES.md`, `CHANGELOG.md`.
- **Tiêu chí nghiệm thu:** Đạt cả 5 tiêu chí ở PRODUCT_SPEC.md mục 6 hoặc
  ghi rõ mục chưa đạt kèm lý do vào KNOWN_ISSUES.md.

## TASK-12 — Whiteboard Engine & Whiteboard Mode
- **Trạng thái:** DONE ngày 2026-10-31 (docs v1.30).
  Bảng trắng là một tài liệu thư viện (DEC-031): manifest
  JSON trong Blob (trang cố định 1600×1000, nền theo
  trang), nét vẽ qua Annotation Engine dùng chung trên
  surface `document:<id>:<trang>`, remap hai pha khi
  xóa/đổi thứ tự trang. WhiteboardPage của shell thành
  danh sách thật + WhiteboardView nhiều trang; thư viện
  chính cũng tạo/mở được bảng trắng. Phạm vi công cụ
  theo brief TASK-12: bút/highlight/tẩy nét/màu/cỡ nét/
  undo-redo theo trang (công cụ hình khối/chữ của
  Drawing Engine chưa gắn vào viewer nào — cùng tình
  trạng ở Document Mode).
- **Mục tiêu:** Không gian bảng trắng độc lập (Whiteboard Engine): viết tay,
  vẽ tự do, tạo văn bản, vẽ hình dạng, tẩy, chọn/di chuyển/chỉnh sửa đối
  tượng, Undo/Redo; bảng trắng lưu và khôi phục như một thực thể trong thư
  viện. Bề mặt bảng trắng dùng chung Drawing Engine (DEC-015).
- **Phụ thuộc:** TASK-05 (Drawing Engine), TASK-08 (Storage). Kết luận về
  Infinite Canvas ở TASK-01/TASK-02 (ISSUE-012) xác định phạm vi tọa độ.
- **Phạm vi:** Whiteboard Engine + màn hình Whiteboard Mode. Infinite Canvas
  chỉ làm khi đã có quyết định riêng sau đánh giá; mặc định bảng trắng có
  kích thước xác định.
- **File dự kiến:** `src/engines/whiteboard/**`, `src/app/whiteboard/**`.
- **Tiêu chí nghiệm thu:** Tạo bảng trắng mới, vẽ/viết/thêm đối tượng, đóng
  và mở lại khôi phục đúng nguyên trạng; không tồn tại engine vẽ riêng cho
  bảng trắng ngoài Drawing Engine chung.

## TASK-13 — Split Mode
- **Trạng thái:** DONE ngày 2026-10-31 (docs v1.31,
  DEC-032). Workspace hai pane: trái PDF (SplitPdfPane
  dùng thẳng PdfViewerController) hoặc DOCX (WordEditor
  nhúng), phải bảng trắng (WhiteboardView nhúng); phối
  hợp qua SplitController + DrawingPaneAdapter — thanh
  công cụ chung route theo pane active, undo/redo cô
  lập tuyệt đối; resizer kéo + mốc 30/70, 50/50, 70/30
  + thu gọn pane; vết liên kết phiên ở localStorage;
  dưới 768px dạng tab. Vào Split từ thanh điều hướng,
  nút Split trên thẻ thư viện/bảng trắng, hoặc bộ chọn
  trong workspace.
- **Mục tiêu:** Workspace hai khu vực trong một màn hình: tài liệu (PDF/
  DOCX/ảnh) + bảng trắng; chỉnh được tỷ lệ diện tích; lưu và khôi phục
  trạng thái cả hai khu vực (ISSUE-013).
- **Phụ thuộc:** TASK-12, TASK-08, và ít nhất một engine tài liệu
  (TASK-06 hoặc TASK-07).
- **Phạm vi:** Lớp phối hợp trong Application Core + giao diện chia vùng.
  Không sửa các engine; nếu engine thiếu giao diện phối hợp thì ghi issue.
- **File dự kiến:** `src/core/workspace/**`, `src/app/split/**`.
- **Tiêu chí nghiệm thu:** Mở một tài liệu ở vùng 1 và viết ở cả hai vùng;
  chỉnh tỷ lệ hoạt động trên desktop và tablet; đóng/mở lại workspace không
  mất dữ liệu ở vùng nào.

## TASK-14 — Nâng cấp viết tay & chú thích (đợt Scrble-level)

- **Mục tiêu:** Bốn pha do chủ dự án giao ngày 2026-11-01: (14A) tự cuộn
  khi viết trên PDF và whiteboard; (14B) gesture hai ngón pan/zoom;
  (14C) nhiều kiểu nền dùng chung cho PDF/DOCX/giấy trắng, lưu theo tài
  liệu trong IndexedDB (migration bảo toàn dữ liệu cũ nếu đổi schema);
  (14D) nhiều kiểu bút (chì/bi/dạ/mảnh/dày/màu nước) + preset bút, tương
  thích ngược dữ liệu nét cũ. Ngoài phạm vi: nhận dạng hình khối tự
  động; OCR chữ viết tay.
- **Phụ thuộc:** Drawing Engine (TASK-05), PDF Viewer (TASK-06),
  Whiteboard (TASK-12). Mốc nền bắt buộc giữ: 588/588 test trước đợt.
- **Trạng thái:** 14A DONE, 14B DONE (2026-11-01) — xem CHANGELOG.
  14C–14D chưa bắt đầu, chờ triển khai theo thứ tự.
