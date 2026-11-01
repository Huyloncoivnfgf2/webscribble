# CHANGELOG — WebScribble

> Ghi thay đổi theo từng task: Task ID · Ngày · File tạo/sửa · Nội dung ·
> Kết quả kiểm tra. Chỉ thêm mục mới ở đầu phần "Lịch sử"; không viết lại cũ.

## Lịch sử

### TASK-14A — 2026-11-01 — Tự cuộn khi viết (docs v1.36)

- **File mới:** `src/engines/drawing/autoScroll.ts`
  — hàm thuần `computeAutoScrollVelocity` (chỉ
  mép dưới/phải, vùng đệm 48px, tốc độ tỉ lệ tuyến
  tính tới tối đa 600px/giây), `AutoScrollController`
  (vòng rAF, dt kẹp 0,1s), `attachAutoScroll` (cổng
  công cụ: chỉ pen/highlighter), `dispatchAutoScrollMove`
  (pointermove tổng hợp để nét nối dài khi con trỏ
  đứng yên lúc cuộn). Export qua `drawing/index.ts`.
- **Sửa:** `PdfViewer.tsx` và `WhiteboardView.tsx`
  gắn attachAutoScroll lên canvas vẽ + khung cuộn
  sẵn có; không sửa engine/input/tọa độ (Input
  Manager đọc lại rect mỗi sự kiện nên điểm vẽ tự
  khớp sau cuộn). Pane PDF của Split chưa áp dụng
  (ngoài phạm vi bước này).
- **Kiểm chứng:** 22 test mới (`tests/drawing/
  autoScroll.test.ts`): **610/610 test (57 file)**,
  lint 0 lỗi, build đạt. Browser QA production
  (Chromium headless) **10/10**: giữ bút ở mép dưới
  → scrollTop tăng dần tới giới hạn cuộn, mực nét
  tăng (nét nối dài thật), tẩy ở mép không cuộn,
  PDF cùng hành vi, 0 lỗi console. Cảm giác với
  bút/stylus thật + Safari vẫn thuộc ISSUE-006
  (cần thiết bị thật).

### Triển khai — 2026-10-31 — GitHub Pages (HTTPS)

- WebScribble v1.0.0 chạy chính thức tại
  https://Huyloncoivnfgf2.github.io/webscribble/
  qua GitHub Actions (mỗi push lên main tự build
  và deploy). Chuyển toàn app sang base path
  `/webscribble/` (WS_BASE): Vite base, manifest
  tương đối, Service Worker nhận diện scope của
  chính nó — PWA cài đặt và chạy offline ngay
  trên địa chỉ Pages. ISSUE-008 khép lại.

### MVP v1.0.0 — 2026-10-31 — PHÁT HÀNH BẢN MVP

- **Cột mốc:** toàn bộ roadmap MVP (TASK-00 →
  TASK-13) hoàn thành và đóng gói thành bản phát
  hành **WebScribble v1.0.0**: ứng dụng web
  local-first, offline-first để xem và chú thích
  PDF (vẽ tay, flatten xuất PDF vector/raster),
  nhập/sửa/xuất DOCX (Tiptap + chú thích phủ),
  bảng trắng đa trang, chế độ Split hai bề mặt,
  thư viện tài liệu trên IndexedDB với sao lưu/
  khôi phục ZIP toàn thư viện (SHA-256, remap
  ID), và PWA cài đặt được với Service Worker tự
  sinh pre-cache toàn bộ ứng dụng.
- **Số liệu chốt:** 587/587 Vitest (56 file),
  34 quyết định kiến trúc (DEC-001 → DEC-034),
  Browser QA trên bản production cho từng task.
- **Giới hạn đã biết tại thời điểm phát hành:**
  nghiệm thu thiết bị thật (stylus/iPad/Safari —
  ISSUE-006, TASK-11 ở trạng thái TESTING), đa
  tab cùng sửa một surface là last-writer-wins
  (ISSUE-015), annotation DOCX neo tọa độ trang,
  không bám theo chữ khi sửa nội dung (ISSUE-016),
  chữ tiếng Việt trong PDF xuất vector dùng chế
  độ raster để giữ nguyên (DEC-033).

### TASK-10 — 2026-10-31 — PWA & Offline Support (khép roadmap MVP)

- **Manifest & icons:** `manifest.webmanifest`
  (WebScribble, standalone, theme #2563EB, tagline
  "Write. Annotate. Edit. Anywhere.") + bộ icons
  PNG 192/512/maskable-512/apple-touch sinh bằng
  script thuần Node (PNG encoder + zlib tích hợp,
  không thêm dependency đồ họa).
- **Service Worker tự sinh:** thay vì phụ thuộc
  vite-plugin-pwa, `scripts/generate-sw.mjs` chạy
  cuối bước build: quét toàn bộ dist, tính phiên
  bản từ hash nội dung từng file, ghi `sw.js` với
  pre-cache ĐẦY ĐỦ 13 URL (index, bundle, CSS,
  PDF.js worker, icons, manifest). Chiến lược:
  điều hướng → index.html từ cache; tài nguyên →
  cache-first (thiếu thì mạng + lưu bổ sung);
  activate dọn cache cũ; bản mới KHÔNG tự kích
  hoạt — chờ người dùng bấm "Cập nhật"
  (SKIP_WAITING + controllerchange → reload).
- **Bài học QA đắt giá (đã thành hồi quy test):**
  lần chạy offline đầu tiên app gãy dù cache đủ —
  nguyên nhân là header `Vary: Origin` trên assets
  của máy chủ tĩnh khiến `cache.match` không khớp
  request thật của trình duyệt (request từ mã
  trang thì lại khớp, nên các phép thử ban đầu đều
  "xanh"). Sửa bằng `ignoreVary: true` ở mọi lần
  match; test đơn vị khóa chặt điều này.
- **UI:** `PwaStatus` ở góc dưới-trái — banner
  "Có phiên bản mới / Cập nhật", thẻ "Cài đặt ứng
  dụng" khi có beforeinstallprompt (tự ẩn khi đã
  standalone, có nút để sau), huy hiệu "Đang
  ngoại tuyến — dữ liệu vẫn được lưu an toàn trên
  thiết bị này". Helpers framework-free ở
  `src/pwa/` (đăng ký SW, install prompt,
  connectivity) đều tiêm được fake để test.
- **Kiểm chứng:** 11 test mới — **tổng 587/587
  (56 file)**; Browser QA trên bản production
  **11/11**: SW active + pre-cache đúng 13 URL;
  cắt mạng → huy hiệu ngoại tuyến hiện → reload
  app sống hoàn toàn từ cache → mở PDF từ
  IndexedDB, vẽ thêm nét, XUẤT PDF thành công
  khi offline → có mạng lại huy hiệu tắt; build
  bản mới → banner cập nhật xuất hiện → bấm Cập
  nhật reload sang bản mới nguyên vẹn; 0 lỗi
  console. ISSUE-011 → RESOLVED. Lint sạch.
  **Roadmap MVP (TASK-00 → TASK-13) hoàn thành.**

### TASK-09 — 2026-10-31 — Export Engine (PDF Flattening)

- **Engine:** `src/engines/pdf/exportPdf.ts` +
  pdf-lib 1.17.1 (MIT), 100% client-side. Hai chế
  độ flatten: **vector** (outline của
  perfect-freehand qua đúng hàm của renderer →
  `drawSvgPath` của pdf-lib; line/rectangle/
  ellipse/arrow → các primitive vector; text →
  Helvetica chuẩn) và
  **raster** (vẽ lại bằng chính `drawObject` của
  Drawing Engine ở 3×, nhúng PNG phủ trang).
  Phạm vi: mọi trang hoặc chỉ trang có chú thích
  (copyPages sang tài liệu mới). File gốc không
  bao giờ bị ghi đè — xuất là Blob mới tải xuống
  (DEC-005/DEC-033).
- **Tọa độ:** world → PDF user space qua
  `convertToPdfPoint` của PageViewport (cùng
  đường với overlay hiển thị — khớp ở mọi
  rotation), cộng offset CropBox khi qua pdf-lib.
  Kiểm chứng bằng SỐ ĐO: test giải nén content
  stream của file xuất và khẳng định outline nằm
  đúng vùng world đã vẽ (sai số vài điểm = bán
  kính nét), rectangle khớp ma trận tịnh tiến
  (50, 642) + kích thước 200×100.
- **Giới hạn đã biết:** chữ tiếng Việt (ngoài
  WinAnsi) không nhúng được ở chế độ vector bằng
  phông chuẩn — engine bỏ qua kèm cảnh báo rõ
  trong hộp thoại và hướng người dùng sang chế
  độ raster (giữ nguyên mọi chữ).
- **UI:** `PdfExportDialog` dùng chung cho PDF
  Viewer (Document Mode) và Split Mode: chọn kiểu
  xuất (vector / ảnh nét cao / PDF gốc sạch),
  phạm vi trang, thanh tiến trình theo trang,
  cảnh báo và tóm tắt trang đã flatten.
- **Kiểm chứng:** 7 test mới — **tổng 576/576
  (55 file)**; Browser QA dev + production
  **11/11**: vẽ → xuất vector → đối soát độc lập
  bằng pdf-lib (72 toán tử path ở đúng trang 1)
  → nhập lại file xuất vào app và thấy nét đã
  flatten render trên trang ở đúng vùng đã vẽ →
  tài liệu gốc giữ nguyên annotation sửa được →
  xuất chỉ-trang-có-chú-thích ra đúng 1 trang →
  Split Mode có cùng đường xuất. Lint sạch;
  build đạt.

### TASK-13 — 2026-10-31 — Split Mode (Dual-Surface Workspace)

- **Phối hợp (DEC-032):** mỗi pane giữ nguyên
  controller của mode gốc — Split chỉ thêm lớp phối
  hợp framework-free `SplitController` +
  `DrawingPaneAdapter` thống nhất ba controller (PDF/
  DOCX/Bảng trắng) về một giao diện công cụ. Thanh
  công cụ vẽ chung route CHỈ tới pane active (có
  vòng sáng + nhãn "Đang hoạt động"); undo/redo cô
  lập tuyệt đối vì là hai instance/surface khác nhau
  (kiểm chứng ở cả test lẫn trình duyệt). Pane PDF
  khai không hỗ trợ màu/cỡ nét (style mặc định của
  engine — đúng hành vi Document Mode) nên router
  khóa hai nhóm lệnh đó; pane DOCX tự chuyển sang
  chế độ Chú thích khi chọn công cụ vẽ từ thanh
  chung.
- **Bố cục:** resizer kéo tay (clamp 15–85%), mốc
  nhanh 30/70 · 50/50 · 70/30, thu gọn/hiện từng
  pane; thay đổi kích thước đi qua ResizeObserver
  sẵn có của từng pane nên nét không lệch. Dưới
  768px: tab "Tài liệu | Bảng trắng" một chạm, hai
  pane giữ mounted (ẩn CSS) nên không mất phiên.
- **Liên kết phiên:** documentId + whiteboardId +
  tỉ lệ + pane active lưu ở localStorage
  (`webscribble:split-session:v1`) — trạng thái
  giao diện của thiết bị, không thuộc backup (dữ
  liệu thật vẫn ở Dexie). Vào Split từ: mục "Chế
  độ Split" ở thanh điều hướng, nút Split trên thẻ
  tài liệu/bảng trắng trong thư viện, hoặc bộ chọn
  ngay trong workspace (kèm tạo bảng trắng mới).
  Liên kết sai vai (bảng trắng gắn vào ô tài liệu)
  được tự chuyển sang pane phải.
- **Kiểm chứng:** 6 test mới (session store,
  routing + chặn theo capabilities, khôi phục liên
  kết, và tích hợp hai WhiteboardController thật:
  vẽ cả hai → undo route chỉ đụng pane active) —
  **tổng 569/569 (54 file)**; Browser QA dev +
  production **19/19**: mở Split từ thẻ thư viện,
  gắn bảng trắng, vẽ cả hai pane, undo route đúng
  pane, kéo resizer + preset, thu gọn/hiện pane,
  reload khôi phục đúng cặp + nét, mobile dạng
  tab. Lint sạch; build đạt.

### TASK-12 — 2026-10-31 — Whiteboard Engine & Standalone Mode

- **Thiết kế (DEC-031):** bảng trắng là MỘT tài liệu
  thư viện với mime riêng
  `application/vnd.webscribble.whiteboard` — không
  bảng Dexie mới, không đổi định dạng backup. Cấu
  trúc bảng (trang cố định 1600×1000, nền từng trang)
  là manifest JSON nằm trong chính Blob của tài liệu
  (`DocumentRepository.replaceBlob` mới — chỉ bảng
  trắng dùng; file gốc PDF/DOCX không bao giờ qua
  đường này). Nét vẽ dùng quy ước surface sẵn có
  `document:<id>:<trang>` + Annotation Engine.
- **Quản lý trang:** thêm (nhảy tới trang mới), xóa
  (xác nhận, cấm xóa trang duy nhất), đổi thứ tự
  trái/phải, chuyển trang trước/sau; xóa/đổi thứ tự
  remap annotation bằng thuật toán staging hai pha.
  **Lỗi thật đã bắt và sửa kèm test regression:** mỗi
  DrawingObject mang `surfaceId` của bề mặt gốc và
  Annotation Engine kiểm chứng khi mở — remap bắt
  buộc viết lại trường này cho từng object, nếu
  không trang được chuyển sẽ mở lỗi `invalid-data`.
- **Nền trang:** trơn trắng / tối / kẻ ngang / lưới
  caro / chấm — dữ liệu manifest, hiển thị bằng CSS
  gradients theo đúng tỉ lệ zoom, đổi nền (từng trang
  hoặc áp dụng mọi trang) không đụng dữ liệu nét.
- **UI:** WhiteboardPage của shell thành danh sách
  thật (tạo/mở/xóa); WhiteboardView nhiều trang với
  toolbar dùng chung (bút/highlight/tẩy/màu/cỡ nét/
  undo-redo từng phiên trang), zoom + vừa màn hình;
  trang Thư viện cũng có nút "Tạo bảng trắng", thẻ
  nhận diện riêng và mở đúng WhiteboardView. Thay
  thế hoàn toàn placeholder của TASK-04.
- **Kiểm chứng:** 9 test mới (`tests/whiteboard/`:
  store, remap, controller, regression surfaceId,
  backup/restore + remap) — **tổng 563/563 (53
  file)**; Browser QA dev + production **20/20**
  (vẽ, thêm/chuyển trang, đổi nền giữ nét, đưa trang
  + nền đi theo, zoom, xóa trang, bền dữ liệu qua
  đóng/mở, tạo từ thư viện). Lint sạch; build đạt.

### TASK-07F — 2026-10-31 — Word Integration & Testing (đóng MODULE 07)

- **Tích hợp:** kéo-thả một/nhiều file PDF/DOCX thẳng vào
  thư viện (overlay hướng dẫn khi kéo, dùng chung
  `handleImportFiles` với nút chọn file — input nay cũng
  chọn được nhiều file; listener cửa sổ chặn trình duyệt
  tự mở file khi thả trượt, chỉ gắn khi trang thư viện
  hiển thị). Thẻ tài liệu đã có sẵn nhãn loại DOCX/PDF,
  kích thước, ngày sửa và số trang từ TASK-08B — đối
  chiếu lại, không cần sửa.
- **Kiểm thử tích hợp mới** (`tests/word/wordLifecycle
  .test.ts`, 5 test): vòng đời trọn vẹn trên hạ tầng
  thật (import DOCX giàu định dạng → Blob gốc khớp từng
  byte → sửa + autosave qua WordEditorController → vẽ
  chú thích qua DocxAnnotationController → đóng/mở lại
  bằng controller mới → xuất DOCX → backup ZIP → khôi
  phục vào CƠ SỞ DỮ LIỆU SẠCH đủ 3 lớp dữ liệu → khôi
  phục trùng ID được remap và quan hệ content/annotation
  đi theo ID mới, bản gốc không bị đụng); đua autosave
  (lần ghi bị chặn kết thúc muộn — bản mới nhất thắng,
  bản cũ không ghi đè); ranh giới: DOCX rỗng (body
  trống lẫn một đoạn trống), DOCX 1500 đoạn, Unicode
  (tiếng Việt/emoji/CJK/ký hiệu toán) qua import →
  export → import.
- **Tài liệu:** MODULE 07 đánh dấu DONE; ISSUE-016 mới
  (giới hạn annotation DOCX không bám chữ — đúng tiêu
  chí nghiệm thu của TASK-07); ISSUE-010 bổ sung bằng
  chứng đóng vòng round-trip. Rà soát dọn dẹp: không
  còn console debug/probe trong `src/` (đã kiểm bằng
  grep), các file test tạm của các phiên trước đã xóa.
- **Kiểm chứng:** **554/554 test (52 file)**; Browser
  QA dev + production **12/12** (kéo-thả 2 file cùng
  lúc + overlay, 3 vòng mở/đóng DOCX giữ nét, backup →
  xóa → khôi phục ngay trong trình duyệt đủ nội dung
  và chú thích). Lint sạch; build đạt.

### TASK-07E — 2026-10-31 — DOCX Export

- **Quyết định mới: DEC-030** — xuất bằng thư viện
  `docx` (cài 9.15.0, MIT); DOCX chỉ chứa nội dung;
  bản phẳng kèm chú thích qua hộp thoại in của trình
  duyệt (sinh PDF bằng code để lại cho TASK-09).
- **Triển khai:** `exportDocx.ts` ánh xạ Content
  Model v2 → OOXML trực tiếp; tên file làm sạch +
  dialog xuất (cảnh báo DEC-018, trạng thái bận/lỗi/
  cảnh báo thành phần không xuất được); `printExport
  .ts` + CSS in chụp canvas chú thích thành ảnh
  bitmap đầy đủ thay cho canvas sống khi in.
- **Sửa kèm ở importer:** gỡ `<w:tblHeader
  w:val="off"/>` trước Mammoth (hàng bị tắt cờ tiêu
  đề từng bị nhập thành hàng tiêu đề) — phát hiện
  nhờ kiểm thử round-trip xuất → nhập của task này.
- **Kiểm chứng:** 12 test mới — tổng **549/549 (51
  file)**; Browser QA dev + production **15/15**;
  **LibreOffice chuyển đổi thành công file xuất**
  (đối soát ngoài hệ sinh thái của app). Lint sạch;
  build đạt.

### TASK-07D — 2026-10-31 — DOCX Annotation

- **Quyết định mới: DEC-029** — một surface cho cả tài
  liệu DOCX, tọa độ nội dung tuyệt đối, giới hạn không
  bám theo chữ được công bố trong UI. Không dependency
  mới; không đổi schema/store (tái sử dụng bảng
  annotations và quy ước surfaceId của PDF).
- **Triển khai:** `DocxAnnotationController.ts` nối
  AnnotationEngine + DrawingEngine (DEC-015) với bề
  mặt Tiptap: phiên mở trên `document:<id>:0`, engine
  là chủ render duy nhất của canvas phủ (cùng nguyên
  tắc "một chủ render" của TASK-06E); chuyển chế độ
  bằng pointer-events của canvas + setEditable của
  editor; toolbar Bút/Highlight/Tẩy + màu/cỡ nét qua
  `setTool(tool, style)` sẵn có của engine; registry
  controller theo documentId trong WordEditor để
  phiên sống qua remount (gắn lại engine khi canvas
  thay mới), rời editor chờ flush cả hai lớp dữ
  liệu.
- **Kiểm chứng:** 6 test mới — tổng **537/537 (50
  file)**; Browser QA dev + production **19/19** gồm
  đo độ dời canvas/nội dung khi cuộn (bằng nhau tuyệt
  đối), pixel nét vẽ trước/sau resize và sau khi
  đóng/mở lại tài liệu. Lint sạch; build đạt.

### TASK-07C — 2026-10-31 — DOCX Fidelity & Import Quality

- **Quyết định mới: DEC-028** — Content Model version 2
  (tương thích ngược, không migration dữ liệu, không đổi
  schema Dexie) và hai kênh fidelity khi nhập DOCX.
  Dependency mới (đều MIT, 3.32.2): @tiptap/extension-
  text-style, -superscript, -subscript, -text-align.
- **Audit trước khi sửa** (fixture `buildRichDocx` + đọc
  source Mammoth 1.13): sup/sub có trong HTML nhưng
  converter làm trong suốt; fontSize/highlight/font/
  alignment/indent được Mammoth ĐỌC vào document model
  nhưng document-to-html không xuất; w:color, w:spacing,
  w:shd, wp:extent không được Mammoth xuất/đọc; danh
  sách lồng nhau và thead/th vốn đã đúng; colspan có
  trong HTML nhưng converter bỏ qua. Kênh style map
  động được kiểm chứng bằng probe thực nghiệm trước khi
  áp dụng (span class ws-fs18/ws-hl-yellow xuất hiện
  đúng trong HTML).
- **Triển khai:** `src/engines/word/enrichment.ts`
  (luồng XML có guard số lượng + bảng màu highlight);
  importer hai lượt chuyển đổi (thu thập token → style
  map động → áp styleName); htmlToContent: sup/sub,
  giải mã class ws-*, data-ws-align/bg, colspan/rowspan,
  width/height ảnh; contentModel v2 + validator mở rộng
  (null của Tiptap = vắng mặt); extensions editor mở
  rộng (Image width/height, ô bảng background) + toolbar
  chỉ số/căn lề.
- **Kiểm chứng:** 12 test mới — tổng **531/531 (49
  file)**; gồm round-trip qua editor headless không mất
  định dạng, guard vMerge (nền không gán nhầm), bản ghi
  v1 mở/sửa/lưu thành v2, backup v1 khôi phục được.
  Browser QA dev + production **24/24** với kiểm tra
  style thật trên DOM sau import và sau reload. Lint
  sạch; build đạt. Hoãn có ghi nhận: màu chữ, thụt lề,
  khoảng cách đoạn, border tùy biến.

### TASK-08C — 2026-10-31 — Backup & Restore toàn thư viện

- **Quyết định mới: DEC-027** — định dạng backup ZIP +
  manifest + SHA-256; `backupFormatVersion` độc lập; chính
  sách khôi phục duy nhất là merge-remap an toàn trong một
  transaction. Dependency mới: **jszip 3.10.2** (MIT OR
  GPL-3.0-or-later — dùng theo MIT), cài trực tiếp (trước
  đây chỉ có mặt truyền qua Mammoth).
- **Module** `src/data/backup/backup.ts` (+ barrel, xuất
  qua `src/data/index.ts`): `createBackupArchive` (chỉ
  đọc; Blob vào archive theo từng tài liệu; nén STORE;
  tiến trình preparing/archiving), `inspectBackupArchive`
  (kiểm chứng toàn bộ trước khi ghi: app tag, version,
  cấu trúc manifest/record, checksum SHA-256 từng file,
  kích thước blob, surfaceId nhất quán với documentId/
  pageIndex, chặn version record mới hơn, không mồ côi,
  không trùng ID/surface, counts khớp), `executeRestore`
  (remap tính tại thời điểm ghi; một transaction trên ba
  bảng; QuotaExceededError → lỗi quota riêng; kiểm chứng
  sau ghi: số lượng tăng đúng + không annotation mồ côi).
  Lỗi phân loại `BackupError` 8 loại kèm userMessage.
- **UI** `BackupPanel.tsx` trong trang thư viện: tạo bản
  sao lưu + tải xuống (tên file theo thời gian), khôi
  phục theo luồng kiểm tra → tóm tắt (thời điểm, số
  lượng, dung lượng, số tài liệu trùng ID sẽ thành bản
  sao) → xác nhận → kết quả chi tiết; không có nút xóa/
  thay thế thư viện.
- **Kiểm chứng:** 12 test mới — tổng **519/519 (48
  file)**; gồm sửa-1-byte → checksum-mismatch, annotation
  mồ côi trong backup → invalid-data, rollback thật bằng
  cách ép bulkPut ném lỗi giữa transaction (documents đã
  ghi trước trong cùng transaction cũng bị hủy). Browser
  QA dev + production **17/17**: hai browser context —
  context mới khôi phục đủ (annotation đọc từ DB, DOCX
  mở editor còn marker đã sửa), context gốc khôi phục
  trùng → 4 tài liệu. Lint sạch; build đạt. Giới hạn:
  archive được vật chất hóa toàn bộ trong RAM lúc tạo
  (đặc tính JSZip) — ghi nhận cho thư viện cực lớn.

### TASK-07B — 2026-10-31 — Tiptap Editor & Content Save/Restore

- **Dependency mới (đã kiểm license):** @tiptap/react,
  @tiptap/starter-kit, @tiptap/extension-image,
  @tiptap/extension-table — đều **3.32.2, MIT**. Kiểm chứng
  từ chính package đã cài: StarterKit 3.x gồm Link +
  Underline (không cài/đăng ký trùng); extension-table
  xuất Table/TableRow/TableCell/TableHeader. Không Pro/
  Cloud, không Zustand.
- **Editor:** `wordEditorExtensions.ts` dùng chung UI/test;
  `WordEditorController.ts` — nạp có kiểm chứng (missing/
  invalid/unsupported-version là lỗi tường minh, không bịa
  nội dung), autosave **generation counter** (khuôn 06F-A)
  + debounce 800 ms + ghi nối tiếp, lỗi giữ dirty, flush/
  close chờ hết dirty; `WordEditor.tsx` — toolbar cơ bản,
  trạng thái lưu 4 mức, quay lại phải flush (lỗi → ở lại,
  có nút bỏ thay đổi tường minh), unmount → flush lần
  cuối. Lưu **JSON model**, không HTML; Blob gốc không
  đụng. DocumentsPage mở DOCX bằng WordEditor; CSS nội
  dung trong `src/styles/index.css`.
- **Bug tìm thấy nhờ Browser QA và đã sửa:** cleanup
  unmount gọi `close()` làm React StrictMode đóng vĩnh
  viễn controller ở lần mount giả (dev) → bản mount thật
  mất khả năng lưu mà nhãn vẫn hiện "Đã lưu". Sửa: cleanup
  dùng `flush()`; QA siết điều kiện dirty-phải-xuất-hiện.
  Bài học: nhãn trạng thái ban đầu trùng trạng thái đích
  là bẫy kiểm thử — phải quan sát trạng thái trung gian.
- **Kiểm chứng:** 11 test mới — tổng **507/507 (47
  file)**; editor headless (jsdom) trên chính nội dung
  07A; race bằng deferred promise; tích hợp repository
  thật (khôi phục + Blob nguyên vẹn + JSON-not-HTML).
  Browser QA dev + production **14/14**. Lint sạch
  (0 lỗi/0 cảnh báo — đã sửa 1 cảnh báo exhaustive-deps
  bằng key-remount); build đạt.

### TASK-07A — 2026-10-31 — DOCX Import & Editable Content Model

- **Dependency mới (đã kiểm license từ registry):** mammoth
  1.13.0 (BSD-2-Clause), dompurify 3.4.17 (MPL-2.0 OR
  Apache-2.0 — dùng theo Apache-2.0); jsdom 30.1.3 (MIT)
  **chỉ devDependency cho test**. Chưa cài Tiptap/docx.
- **Data Layer (schema v2):** `WebScribbleDatabase` thêm
  `version(2)` cộng thêm bảng `documentContents`
  (documentId); `DOCUMENT_CONTENT_VERSION = 1` +
  `DocumentContentRecord` + `UnsupportedContentVersionError`
  trong `src/data/types.ts`; repository mới
  `DocumentContentRepository` (saveContent/getContent/
  deleteContent, chặn version mới hơn); nền tảng
  `StorageFoundation.contents`; `DocumentRepository.delete`
  mở rộng transaction cascade sang cả ba bảng. Migration
  có test dựng DB v1 thật: dữ liệu cũ nguyên vẹn, không
  tạo record nội dung giả cho tài liệu cũ.
- **Word Engine mới** `src/engines/word/`: `errors.ts`
  (WordImportError 7 loại + userMessage tiếng Việt),
  `sanitize.ts` (DOMPurify tại biên nhập, cấu hình tường
  minh), `contentModel.ts` (model JSON tương thích
  Tiptap + validation), `htmlToContent.ts` (HTML sạch →
  model; ảnh trong đoạn được nâng thành block riêng),
  `importer.ts` (nhận diện ZIP/OLE, Mammoth, phân loại lỗi
  theo thông điệp thật của Mammoth/JSZip đã kiểm chứng),
  `importToLibrary.ts` (chuyển đổi trước — lưu sau —
  rollback khi lưu nội dung lỗi), `index.ts`.
- **UI:** DocumentsPage nhận cả DOCX (accept + nhánh nhập +
  thông báo 07B trung thực; không mở PDF Viewer cho DOCX);
  `libraryModel.documentTypeLabel` nhận diện DOCX.
  `vitest.config.ts`: alias mammoth → bản browser (lý do
  ghi trong file).
- **Kiểm chứng:** fixture DOCX sinh bằng code tại
  `tests/word/fixtures.ts` (ZIP stored writer + XML parts);
  21 test mới — tổng **496/496 (45 file)**; Browser QA
  dev + production 10/10 gồm đọc trực tiếp IndexedDB của
  trình duyệt để xác nhận record nội dung thật; lint đạt;
  build đạt. Một lỗi type duy nhất trong quá trình (Piece
  không thu hẹp được do WordBlockNode.type là string) đã
  sửa bằng type ImagePiece hẹp — không đổi hành vi.

### TASK-08B — 2026-10-31 — Document Manager & Library UI

- **Thư viện:** DocumentsPage hoàn thiện trên nền TASK-06E —
  mỗi tài liệu hiển thị tên, loại file, dung lượng file,
  ngày cập nhật, số trang; thứ tự hiển thị theo `updatedAt`
  giảm dần (hàm thuần `sortByRecent` — Data Layer giữ
  nguyên thứ tự createdAt của nó); **đổi tên** inline qua
  `DocumentRepository.updateMetadata` (chặn tên rỗng/trùng,
  Enter lưu/Esc hủy) — bền qua reload, không ảnh hưởng
  Blob hay annotation (đã kiểm bằng test tích hợp: đọc lại
  từ database sau đổi tên, Blob nguyên vẹn từng byte,
  annotation còn đủ); **xóa có bước xác nhận inline** nêu
  rõ sẽ xóa cả chú thích, cơ chế cascade giữ nguyên.
- **Dung lượng & cảnh báo quota (phần UI của ISSUE-005):**
  panel mới dùng `StorageManager` sẵn có — hiển thị "Đã
  dùng X / Y (Z%)" với nhãn rõ ràng là số **ước tính của
  trình duyệt**, thanh tỷ lệ, và cảnh báo khi tỷ lệ đạt
  ngưỡng **80%** (hằng số `QUOTA_WARNING_THRESHOLD` khai
  báo tập trung tại `src/app/libraryModel.ts` cùng các hàm
  thuần `formatBytes` (B/KB/MB/GB/TB, dấu thập phân phẩy)
  và `classifyStorageUsage`). Trạng thái lưu trữ bền hiển
  thị trung thực cả ba trường hợp (đã bật/chưa bật/không
  xác định được) kèm nút "Xin lưu trữ bền" khi chưa bật;
  diễn đạt về persistent luôn kèm lưu ý không phải bảo đảm
  vĩnh viễn. API không khả dụng hoặc estimate() lỗi → panel
  hiện trạng thái không-đo-được, không số giả, không crash.
  Không tự xóa dữ liệu để giải phóng dung lượng.
- **Recent Documents:** component ở Trang chủ viết lại —
  đọc thật từ DocumentRepository (cùng wiring
  `getAppStorage()`, không cơ chế dữ liệu riêng), tối đa 5
  tài liệu gần đây nhất, nhấn vào mở đúng tài liệu trong
  PDF Viewer (App truyền yêu cầu mở xuống DocumentsPage);
  empty state mới mô tả đúng cách bắt đầu, bỏ hoàn toàn
  nội dung tĩnh "tính năng sẽ được triển khai" của TASK-04.
- **Kiểm thử:** 13 test mới (tests/library/library.test.ts):
  formatBytes, ngưỡng 80% (79,9% → bình thường; 80% → cảnh
  báo), API không khả dụng/lỗi/thiếu số, StorageManager giả
  lập (persist cấp/từ chối/không hỗ trợ, estimate lỗi), đổi
  tên bền + Blob/annotation nguyên vẹn, thứ tự gần đây theo
  updatedAt, xóa cascade. Tổng **475/475**. Browser QA trên
  UI thật đạt toàn bộ ở dev và production: luồng chính
  (nhập → panel dung lượng → đổi tên → reload còn tên →
  tên rỗng bị chặn → Trang chủ thấy tài liệu thật → nhấn
  mở đúng viewer → xóa có xác nhận), giả lập estimate 85%
  → cảnh báo hiện + persistent đã bật, persistent chưa bật
  → xin → thành đã bật, vô hiệu hóa Storage API → trạng
  thái không khả dụng trung thực; viewport 1440/768/390
  không tràn ngang, 0 lỗi console. Bộ hồi quy 06E core
  chạy lại trên production: đạt.
- **Không đổi:** schema IndexedDB, Data Layer, PDF Viewer,
  Drawing/Annotation Engine. Chưa commit.

### TASK-06F-A — 2026-10-31 — Kiểm chứng race condition của dirty tracking

- **Bối cảnh:** cơ chế `hasChanges` thêm ở TASK-06F bị nghi
  có race: `saveNow()` xóa cờ vô điều kiện sau khi flush,
  nên mutation tới TRONG lúc ghi đang bay có thể bị đánh
  dấu nhầm là đã lưu.
- **Kết quả kiểm chứng (test gated repository, thứ tự kiểm
  soát bằng deferred promise):** race CÓ THẬT ở chế độ lưu
  trực tiếp (không AutosaveManager) — theo đúng trình tự
  của brief (A → saveNow pending → mutation B → A xong →
  close), `close()` hoàn thành trong khi write của B chưa
  xuống storage, vì ba nguyên nhân cộng dồn: (1) `saveNow`
  xóa cờ bẩn vô điều kiện; (2) `flushDirect` chỉ chờ tham
  chiếu chuỗi promise tại thời điểm gọi — write nối thêm
  sau không được chờ; (3) `close` chỉ kiểm tra cờ một lần.
  Ở chế độ AutosaveManager, vòng drain của manager tình cờ
  ghi cả snapshot mới nên dữ liệu không mất, nhưng cờ bẩn
  vẫn sai theo cùng cơ chế (1).
- **Cách sửa (đúng tầng Annotation Engine, không đổi
  schema, không thêm manager):** dirty tracking chuyển
  sang GENERATION COUNTER — `changeGeneration` tăng ở mọi
  thay đổi; `saveNow` chỉ xác nhận `savedGeneration` tới
  đúng thế hệ của snapshot đã ghi; `flushDirect` chờ chuỗi
  ỔN ĐỊNH (write nối thêm trong lúc chờ cũng được chờ);
  `close()` lặp lưu cho tới khi một lần lưu hoàn thành mà
  không còn thay đổi chưa ghi. 6 test hồi quy mới tại
  tests/annotation/saveRace.test.ts (cả hai chế độ lưu:
  trình tự của brief, nhiều mutation + hai saveNow liên
  tiếp, mutation trong lúc close flush, save lỗi → retry,
  mutation sau save lỗi, chỉ-đọc không ghi, không cập nhật
  updatedAt). Tổng 462/462 test; lint/build đạt. Chưa
  commit.

### TASK-06F — 2026-10-31 — PDF Viewer Integration & Testing

- **Phạm vi:** kiểm thử tích hợp toàn bộ workflow PDF sau
  TASK-06E (PDF Engine + Annotation Engine + Drawing Engine
  + Storage Foundation + React Viewer + Document Library) —
  không thêm tính năng mới.
- **Lỗi thật đã sửa (một lỗi, tại tầng Annotation Engine):**
  `AnnotationSurfaceSession.close()` luôn gọi `saveNow()` —
  tức ghi snapshot trạng thái hiện tại xuống IndexedDB kể cả
  khi phiên không hề thay đổi dữ liệu. Tái hiện: mở một trang
  chưa có annotation rồi đóng → xuất hiện record `{objects:
  []}`; và nguy hiểm hơn, một phiên mở từ trước có thể ghi đè
  annotation MỚI hơn (do phiên/tab khác vừa lưu) bằng trạng
  thái cũ tại thời điểm mở khi nó đóng lại. Cách sửa tại
  `annotationEngine.ts`: session theo dõi cờ `hasChanges`
  (bật ở `onSurfaceChanged`, tắt khi `saveNow` thành công),
  `close()` chỉ flush khi cờ bật — phiên chỉ-đọc không ghi
  gì; phiên có thay đổi giữ nguyên chính sách an toàn cũ
  (flush lỗi → close reject, session vẫn mở). Test hồi quy:
  đóng phiên chỉ-đọc không tạo record; mở lại trang đã có
  annotation rồi đóng ngay → `updatedAt` của record giữ
  nguyên; toàn bộ test TASK-06C về close/flush không đổi
  hành vi (32/32 test annotation + tích hợp đạt ngay sau
  sửa).
- **Kiểm thử tích hợp mới (11 test,
  tests/viewer/integration.test.ts):** dispose ngay khi
  openDocument vừa phát động và dispose GIỮA lúc render
  trang (renderer bị chặn bằng gate) — không lỗi, session
  đóng hết, pointer listener về 0; chuyển trang qua lại +
  vẽ tiếp — autosave cũ không ghi đè dữ liệu mới (cả hai
  nét đều còn); đóng tài liệu ngay khi còn pending save —
  flush đủ; annotation đã lưu không hợp lệ — mở trang báo
  lỗi và record gốc không bị ghi đè; lưu thất bại bằng
  repository giả lỗi có kiểm soát — trạng thái error hiện,
  retrySave thành công khi hết lỗi, closeDocument bị từ
  chối trong lúc lưu lỗi và dữ liệu không mất; import
  trùng cùng file — hai document độc lập; xóa document
  cascade sạch annotation mọi trang, 0 record mồ côi
  (truy vấn trực tiếp bảng annotations).
- **Browser QA trên UI thật (Playwright; dev đủ bộ và
  production preview đủ bộ đều đạt):** file rỗng bị từ
  chối kèm thông báo, không tạo record; PDF cắt cụt (chữ
  ký đúng, thân hỏng) — viewer hiện lỗi "bị hỏng" rõ ràng;
  import trùng tạo bản ghi thứ hai độc lập; xóa bản ghi
  hoạt động; bấm chuyển trang dồn dập lẫn lộn — không kẹt,
  trạng thái cuối hợp lệ, vẫn điều hướng được sau đó; spam
  zoom dừng đúng 400%/25%; fit bám theo resize cửa sổ cả
  hai chiều (448 → 394 → 448 CSS px); bấm quay lại giữa
  lúc tài liệu nặng (trang 3.000 dòng chữ) đang mở — về
  thư viện sạch, mở lại render xong bình thường; hai tab
  cùng sửa — không crash, trạng thái cuối là đúng một
  phía (xem ISSUE-015); tab chỉ-xem đóng lại KHÔNG ghi đè
  annotation đã lưu (hồi quy của lỗi đã sửa, kiểm chứng
  bằng pixel); 0 lỗi console/pageerror ở mọi luồng. Bộ
  hồi quy TASK-06E cũng chạy lại: dev 26/26, production
  14/14.
- **Hiệu năng (Chromium headless trên VM của dự án, DPR 1,
  fixture sinh bằng code — chỉ là số tham khảo, không phải
  KPI):** mở tài liệu 50 trang ≈ 700 ms, 200 trang ≈ 680 ms
  (thời gian mở không phụ thuộc số trang vì chỉ render
  trang hiện tại), chuyển trang ≈ 260 ms; bitmap một trang
  ở mức fit 448×580 ≈ 1,0 MB mỗi lớp canvas (hai lớp ≈
  2 MB); sau 5 chu kỳ mở/đóng tài liệu 200 trang: 0 canvas
  còn trong DOM, heap JS phẳng 31,6 MB → 31,6 MB
  (performance.memory của Chromium, GC không ép buộc).
  Trang nặng 3.000 dòng: mở + render ≈ 3,6 giây tính cả
  một lần đóng giữa chừng trước đó.
- **Chưa kiểm tra được (ghi nhận, không tuyên bố đã xác
  minh):** Safari/WebKit (máy chỉ có Chromium headless
  shell; không có binary WebKit), thiết bị thật/cảm ứng/
  bút stylus (ISSUE-006 vẫn mở), quota IndexedDB gần đầy
  trên thiết bị thật (đường lỗi lưu đã kiểm bằng repository
  giả lỗi ở tầng tích hợp).
- **Tổng kết:** 456/456 test (40 file; trước task là
  445), lint đạt, production build đạt, 0 skip/only/todo.
  Không còn lỗi nghiêm trọng gây mất dữ liệu/sai lệch
  annotation/rò rỉ tài nguyên được biết. TASK-06 hoàn tất
  cả 6 subtask. Git: chưa commit — chờ chủ dự án duyệt.

### TASK-06E — 2026-10-31 — Minimal React PDF Viewer Integration

- **Kiến trúc:** logic viewer nằm ở `PdfViewerController`
  (framework-free, kiểm thử độc lập với React) tại
  `src/app/features/documents/`; component `PdfViewer.tsx`
  chỉ hiển thị snapshot + gọi action. `pdfViewerState.ts`
  giữ logic thuần (clamp trang/zoom, bước zoom 1.25, fit đệm
  24px). `src/app/storage.ts` là điểm wiring duy nhất của
  tầng UI (singleton foundation + AnnotationEngine).
  DocumentsPage giữ nguyên props {variant, notice} và hợp
  đồng với App.tsx, chuyển từ placeholder thành thư viện
  thật: import (kiểm chữ ký %PDF- trước khi tạo record),
  danh sách từ DocumentRepository, xóa (cascade annotation),
  mở viewer; mỗi lần import tạo document mới (QA-B).
- **Luồng dữ liệu & an toàn:** controller mở Blob từ
  DocumentRepository bằng openPdfDocument (file gốc không
  đổi), ghi ngược pageCount vào metadata khi còn thiếu. Mọi
  thao tác trang/tài liệu chạy nối tiếp qua một hàng đợi.
  Chuyển trang/đóng tài liệu: đóng session cũ bằng close()
  (flush) TRƯỚC, chỉ khi thành công mới dispose engine/
  overlay — flush lỗi thì hủy thao tác, giữ nguyên trang và
  hiển thị lỗi lưu + nút thử lại (retrySave → saveNow);
  không âm thầm bỏ dữ liệu. Trạng thái lưu hiển thị từ
  session.getSaveState() + vòng theo dõi nhẹ 300 ms tự dừng
  ở trạng thái cuối (chỉ phục vụ nhãn UI). Trạng thái
  undo/redo được đọc lại qua queueMicrotask sau mỗi thông
  báo thay đổi surface vì notification tới giữa thao tác
  của engine, trước khi History chốt command (đọc ngay sẽ
  thấy trạng thái cũ — nút Undo từng bị kẹt disabled trong
  QA đầu tiên và đã sửa theo cơ chế này).
- **Tương tác:** DrawingEngine gắn trực tiếp trên canvas
  annotation của viewer (camera {0, 0, zoom: scale} — cùng
  quy ước 06D; pointer CSS px → world qua screenToWorld của
  engine, tương đương mapping.viewportToWorldPoint, còn
  mapping.canvasToWorldPoint của overlay dành cho điểm
  physical px — không công thức tọa độ tự chế nào được
  thêm). Công cụ: Pen, Highlighter, Stroke Eraser +
  Undo/Redo. touch-action: none đặt ở tầng view.
- **Thay đổi module nền (duy nhất, cộng thêm và opt-in):**
  PdfAnnotationOverlay thêm tùy chọn
  `annotationRendering: 'managed' | 'external'` — mặc định
  'managed' giữ nguyên hành vi TASK-06D (có thêm 1 test cho
  'external'). Lý do: khi có DrawingEngine tương tác, canvas
  annotation cần MỘT chủ render duy nhất; hai CanvasRenderer
  độc lập cùng clear/vẽ toàn cảnh theo hai hàng đợi rAF
  riêng sẽ xóa khung hình preview/con trỏ của nhau và vẽ
  trùng. Ở chế độ external, overlay vẫn render PDF, đặt
  kích thước CSS, tạo mapping và giữ bảo vệ vòng đời theo
  session. (Ghi nhận đính chính: vòng mờ còn lại sau thao
  tác tẩy trong QA ban đầu KHÔNG phải lỗi này — đó là con
  trỏ hover hình tròn của công cụ tẩy do engine vẽ theo vị
  trí chuột, đã kiểm chứng biến mất khi đổi công cụ và dữ
  liệu surface về 0 object.)
- **Kiểm thử:** 17 test mới — pdfViewerState 6 (clamp,
  zoom, fit); PdfViewerController 10 với foundation thật
  trên fake-indexeddb + PDF renderer giả + canvas giả ghi
  listener (mở + fit + ghi pageCount; vẽ → chuyển trang →
  record đã lưu → quay lại khôi phục; hai chuyển trang đồng
  thời được nối tiếp; clamp điều hướng hai đầu; zoom
  clamp; đóng tài liệu đóng session; dispose gỡ hết
  pointer listener; lỗi not-a-pdf và password; đổi công
  cụ/undo an toàn; controller tiêm requestFrame/cancelFrame
  qua deps vì Node không có rAF); overlay external 1.
  Tổng **445/445 test đạt (39 file)**; lint và build đạt.
  **Browser QA trên UI thật (Playwright, Chromium
  headless): dev 26/26, production build + preview 14/14**
  — import và mở đúng 3 trang; vẽ bút có mực thật và trạng
  thái chuyển sang "Đã lưu"; undo/redo; tẩy + undo; chuyển
  trang khứ hồi giữ nguyên nét (376px mực khớp nhau); zoom
  phóng to canvas 448→560px và annotation bám theo; reload
  trình duyệt → mở lại từ thư viện → annotation khôi phục;
  tài liệu thứ hai xoay 90° render đúng và annotation hai
  tài liệu cách ly hai chiều; DPR 2 bitmap = 2× CSS; hai
  viewport 390/768 không tràn ngang; 0 lỗi console ở mọi
  context.
- **Ngoài phạm vi, chưa làm:** hiển thị nhiều trang liên
  tục/virtualization, tìm kiếm, export, DOCX, Split/
  Whiteboard, backup (TASK-08C), công cụ hình/text/select
  trên viewer. Kế tiếp: TASK-06F Integration & Testing.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-06D — 2026-10-31 — PDF Annotation Overlay Integration

- **Audit source trước khi code (bắt buộc theo brief):** đọc
  CanvasRenderer, renderer/coordinates của Drawing Engine,
  PageViewport của PDF.js, session của TASK-06C. Kết luận:
  CanvasRenderer tự xóa trong suốt, tự nhân bitmap theo DPR và
  vẽ mọi object qua camera {x, y, zoom} (world → CSS px =
  (world − camera.xy) × zoom); PageViewport có sẵn
  convertToViewportPoint/convertToPdfPoint; surface của session
  dùng TRỰC TIẾP được (chỉ cần listObjects) — không cần adapter,
  không sửa module nền nào.
- **Quy ước tọa độ (cốt lõi của task):** world của một trang PDF
  = **khung trang đã hiển thị tại scale 1** — chính là viewport
  scale 1 của PDF.js (gốc trên-trái, trục y xuống, đã gồm
  rotation). Hệ quả: world ↔ viewport (CSS px) là phép nhân/
  chia scale thuần nhất ở MỌI rotation; PDF user space ↔ world
  đi qua hàm convert của chính PageViewport (PDF.js tự lo flip
  y + rotation 0/90/180/270 + offset); canvas physical px =
  viewport × DPR và DPR không bao giờ đi vào dữ liệu. Không tự
  viết công thức hình học PDF nào.
- **Mapping (`annotationMapping.ts`):**
  `createPdfAnnotationMapping(viewport, { devicePixelRatio })`
  — dựng từ một viewport bất kỳ của trang (mọi phép đổi chuẩn
  hóa qua scale của nó): worldToViewportPoint,
  viewportToWorldPoint, worldToPdfPoint, pdfToWorldPoint,
  viewportToCanvasPoint, canvasToViewportPoint,
  worldToCanvasPoint, canvasToWorldPoint + scale/rotation/
  pageWidth/pageHeight/viewportWidth/viewportHeight.
- **Overlay (`overlay.ts`):** `PdfAnnotationOverlay` /
  `createPdfAnnotationOverlay({ handle, pageIndex, session,
  pdfCanvas, annotationCanvas, scale?, devicePixelRatio?,
  pdfRenderer?, requestFrame?, cancelFrame? })`. PDF vẽ bằng
  PdfPageRenderer (TASK-06B) lên canvas PDF — overlay không bao
  giờ vẽ lên canvas đó. Annotation vẽ bằng CanvasRenderer của
  Drawing Engine lên canvas overlay với camera {0, 0, zoom:
  scale}; style CSS của canvas overlay đặt bằng viewport,
  bitmap do CanvasRenderer nhân DPR. Đồng bộ: subscribe
  NotifyingSurface của session — thêm/sửa/xóa/undo/redo đều tự
  requestRender, không polling, không listener trùng (một
  subscription duy nhất, hủy khi dispose). Session đã đóng →
  render() ném PdfAnnotationOverlayError kind 'session-closed'
  và tự dispose; thay đổi muộn sau khi session đóng cũng kích
  hoạt tự dispose qua listener. API: render(), setScale(),
  setDevicePixelRatio(), refreshAnnotations(), cancel(),
  dispose() (idempotent), mapping/scale/disposed.
- **Kiểm thử:** 19 test mới — mapping 9 test trên PageViewport
  THẬT của PDF.js với fixture /Rotate 0/90/180/270: điểm cụ thể
  ở bốn góc + tâm cho từng rotation, round-trip hai chiều mọi
  rotation, scale 2/DPR 2 không nhân trùng, bất biến object đầu
  vào. (Một kỳ vọng rotation 180 do người viết test suy luận
  tay đã sai — PDF.js cho transform [-1,0,0,1,612,0], tức pdf
  (0,0) → world (612,0); test đã sửa theo hành vi thật và ghi
  nhận tại đây.) Overlay 10 test với session THẬT trên
  fake-indexeddb + PDF renderer giả + canvas ghi lệnh vẽ: kích
  thước CSS/bitmap theo DPR 1/2, setScale, refresh không đụng
  canvas PDF, đồng bộ thêm/xóa qua frame scheduler, dispose
  dọn subscription, session đóng, cancel, tham số sai.
  **Browser QA (Chromium headless, harness tạm đã xóa): 50/50**
  ở DPR 1 và 2 — với mỗi rotation, PDF chứa marker ĐỎ tại tọa
  độ user space biết trước; annotation rectangle đặt đúng vị
  trí world suy ra từ mapping; bbox mực của annotation trùng
  bbox marker đỏ trên canvas PDF trong ±2 CSS px tại scale 1
  và cả sau setScale(2); góc canvas overlay alpha = 0 (trong
  suốt); hash pixel canvas PDF không đổi sau các lần vẽ lại
  annotation; 0 lỗi console. Tổng **428/428 test đạt**; lint
  và build đạt; không skip/only.
- **Ngoài phạm vi, chưa làm:** React viewer (TASK-06E), pointer
  interaction/toolbar, virtualization. Không sửa TASK-05/06A/
  06B/06C.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-06C — 2026-10-31 — Annotation Engine

- **Kiến trúc (`src/engines/annotation/`):** tầng điều phối
  persistence, không vẽ, không ánh xạ tọa độ. `annotationEngine.ts`
  — `createAnnotationEngine({ annotations, autosave? })` và
  `openDocumentPage(documentId, pageIndex, { pageSize })` trả
  `AnnotationSurfaceSession` (surface, listObjects, getSaveState,
  getSaveError, saveNow, deleteSavedData, close). Mỗi surfaceId
  tối đa một session trong một engine (mở trùng → AnnotationError
  kind 'already-open'); surfaceId theo đúng quy ước TASK-08A
  `document:<documentId>:<pageIndex>`.
- **Kết nối Drawing Engine — NotifyingSurface:** lớp bọc cài
  interface DrawingSurface, ủy quyền toàn bộ cho InMemorySurface
  và phát thông báo SAU mỗi mutation thành công (add/insert/
  update/replace/remove/clear). Vì DrawingEngine, History
  (undo/redo dùng insertObjectAt/removeObject), Selection và
  Eraser đều thao tác qua interface này, MỌI đường thay đổi đều
  kích hoạt lưu — không polling, không sửa một dòng nào của
  Drawing Engine. Lỗi từ listener được chuyển cho onListenerError
  thay vì phá vỡ thao tác vẽ. Nạp dữ liệu vào surface nội bộ
  TRƯỚC khi gắn thông báo nên lần mở không tự kích hoạt lưu.
- **Serialization & validation (`serialization.ts`):** serialize
  bằng structuredClone (bản sao tách rời). Nạp: mọi object phải
  qua `validateDrawingObject` của chính Drawing Engine (trường
  bắt buộc, bounds khớp hình học, points/pressure/time, shape,
  text) VÀ mang đúng surfaceId của surface đang mở. Một object
  lỗi → AnnotationDataError (objectIndex, objectId, problems)
  cho toàn bộ lần mở — không nạp một phần, không loại object
  âm thầm, không ghi đè bản lưu. Record schema mới hơn →
  UnsupportedAnnotationSchemaError của data layer truyền
  nguyên vẹn.
- **Persistence & vòng đời:** thay đổi → AutosaveManager dùng
  chung của Storage Foundation (debounce + serial ordering +
  giữ dữ liệu khi lỗi). saveNow = schedule snapshot hiện tại +
  flush và chỉ resolve sau khi repository xác nhận; lỗi →
  AnnotationError kind 'persistence' kèm cause, trạng thái qua
  getSaveState/getSaveError. Không có AutosaveManager thì engine
  lưu trực tiếp qua repository bằng chuỗi promise có thứ tự
  (không phải hệ autosave thứ hai — không debounce, không hàng
  đợi riêng). Đóng mặc định flush trước; flush lỗi → close
  reject và session VẪN mở; close({ flush: false }) bỏ thay đổi
  tường minh. Đóng không xóa dữ liệu; deleteSavedData() tường
  minh theo thứ tự flush → cancel → delete để save đang bay
  không hồi sinh record. Sau khi đóng: hủy subscription (kiểm
  chứng listenerCount về 0), thay đổi trên surface cũ không còn
  được lưu, saveNow/deleteSavedData ném kind 'closed'.
- **Kiểm thử:** 21 test mới ở `tests/annotation/` trên
  fake-indexeddb với repository/autosave THẬT: mở mới/đã có/
  mở lại/mở trùng; **khôi phục đủ 7 loại DrawingObject deep
  equal toàn bộ trường** (gồm pressure/time từng điểm, text
  tiếng Việt); cập nhật/xóa phản ánh vào bản lưu; validation 4
  ca (thiếu trường, sai surfaceId, pressure ngoài [0,1], schema
  tương lai — bản lưu còn nguyên sau mọi ca); autosave tự lưu,
  thứ tự lưu liên tiếp, không báo saved sớm, đóng flush cả khi
  debounce 60 giây, lỗi lưu → thử lại, đóng-khi-flush-lỗi,
  close bỏ qua tường minh, xóa tường minh không hồi sinh,
  cleanup subscription, chế độ lưu trực tiếp. Tổng **409/409
  đạt**. **Browser QA (Chromium, IndexedDB thật, harness tạm
  đã xóa): 5/5** — thêm nét + text qua engine thật, saveNow,
  reload toàn trang, mở lại: objects khôi phục nguyên vẹn.
  Hai lỗi test tự gây đã sửa trong quá trình (di chuyển object
  phải qua translateObject để bounds nhất quán — Drawing Engine
  từ chối đúng thiết kế; một test autosave đổi sang chờ theo
  điều kiện thay vì ngủ cố định). Lint và build đạt.
- **Ngoài phạm vi, chưa làm:** overlay + mapping tọa độ
  (TASK-06D), viewer (06E). Không sửa Drawing Engine, Storage
  Foundation, PDF Loader/Renderer.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-06B — 2026-10-31 — Page Rendering & Geometry

- **Geometry (`src/engines/pdf/geometry.ts`):**
  `getPdfPageGeometry(handle, index, scale = 1)` — toàn bộ số đo
  lấy từ `getViewport()` của PDF.js (không tự tính hình học PDF):
  kích thước trang tại scale 1, kích thước viewport tại scale yêu
  cầu, rotation hiệu dụng, và chính viewport native (để TASK-06D
  dùng tiếp). Hệ tọa độ làm việc là CSS pixel; devicePixelRatio
  không thuộc hình học. Scale không phải số hữu hạn dương →
  PdfRenderError kind 'invalid-argument'.
- **Renderer (`src/engines/pdf/renderer.ts`):** class
  `PdfPageRenderer` + `createPdfPageRenderer()`. Registry render
  đang chạy theo canvas bằng WeakMap của TỪNG instance (không
  global state). `render(handle, index, canvas, { scale,
  devicePixelRatio, background })`: đăng ký entry đồng bộ ngay khi
  gọi (cancel gọi ngay sau đó vẫn hiệu lực); render mới trên cùng
  canvas **hủy render cũ và chờ nó kết thúc hẳn** rồi mới đặt lại
  kích thước canvas và vẽ (render cũ không ghi đè được render
  mới); bitmap = viewport × DPR làm tròn (tối thiểu 1px), style
  CSS luôn là viewport thuần, PDF.js nhận `transform` nhân DPR
  khi DPR ≠ 1 (đúng công thức khuyến nghị của PDF.js). Kết quả
  trả về gồm cssWidth/cssHeight, pixelWidth/pixelHeight, DPR,
  rotation và viewport. `cancel(canvas)`, `cancelAll()`,
  `dispose()`, `isRendering(canvas)` — tất cả idempotent.
- **Lỗi (`errors.ts` bổ sung):** `PdfRenderError` với kind
  invalid-argument / cancelled / render-failed. Lỗi của loader
  (PdfLoadError 'closed', PdfPageIndexError) truyền NGUYÊN VẸN
  qua renderer; lỗi render của PDF.js → render-failed kèm cause;
  hủy chủ động hoặc PDF.js tự hủy task (kể cả khi document bị
  destroy giữa lúc render) → cancelled.
- **Hai lỗi thật do kiểm thử bắt được, đã sửa trong task:**
  (1) canvas null từng làm lộ TypeError thô của WeakMap vì
  registry dùng canvas làm khóa trước khi validate → nay
  validate canvas trước khi đăng ký, trả PdfRenderError đúng
  định dạng; (2) Browser QA cho thấy khi đóng tài liệu giữa lúc
  đang lấy trang, lỗi thô của PDF.js thoát ra khỏi renderer
  không mang kind → nay bước lấy trang cũng phân loại:
  cancelled khi bị hủy/đóng, render-failed kèm cause cho lỗi
  còn lại; kiểm chứng lại trên trình duyệt thật cho kết quả
  rejected:cancelled như thiết kế.
- **Kiểm thử:** 23 test mới — geometry 7 test trên PDF.js THẬT
  (scale 1/2, mặc định, scale sai, trang xoay 90° hoán đổi
  rộng/cao, index sai, tài liệu đóng) và renderer 16 test bằng
  page/canvas giả có kiểm soát được hành vi task (kích thước
  DPR 1/2, scale×DPR, transform truyền xuống, hủy ngay lập tức,
  hủy giữa chừng, thay thế render, transport destroy, đóng tài
  liệu, hai instance độc lập, cleanup nhiều lần, lỗi đầu vào,
  lỗi PDF.js giữ cause). Tổng **388/388 đạt**.
  **Browser QA (Chromium headless, harness tạm đã xóa): 16/16**
  ở deviceScaleFactor 1 và 2 — render thật có điểm ảnh mực
  (1.890 px ở DPR 1; 25.741 px khi scale 2 × DPR 2), bitmap/style
  đúng công thức, render lại đổi scale, hủy → cancelled, render
  sau đóng → closed, đóng giữa lượt render nặng (trang chứa
  3.000 dòng chữ, scale 3) → cancelled, 0 lỗi console/trang.
  Lint và build đạt; không skip/only.
- **Ngoài phạm vi, chưa làm:** viewer React (06E), virtualization,
  ánh xạ tọa độ annotation (06D). Không sửa Drawing Engine,
  Storage Foundation hay API TASK-06A.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-06A — 2026-10-31 — PDF.js & Document Loader

- **Dependency:** cài **pdfjs-dist 6.4.299** (Apache-2.0 — đúng
  phiên bản đã khảo sát ở TASK-01). Không cài thêm thư viện PDF nào
  khác. Hai thực tế kỹ thuật ghi nhận: (1) bản chính của PDF.js
  KHÔNG chạy trong Node (tự in cảnh báo yêu cầu bản legacy) →
  `vitest.config.ts` mới tạo, alias `pdfjs-dist` sang bản legacy
  CHỈ cho test, code sản phẩm vẫn dùng bản chính; (2) pdfjs-dist
  v6 đã gỡ tùy chọn `isEvalSupported` (không còn đường eval).
- **Worker local (DEC-016):** `src/engines/pdf/pdfjs.ts` đặt
  `GlobalWorkerOptions.workerSrc` từ `pdf.worker.min.mjs?url` —
  kiểm chứng trên Chromium headless cả hai chế độ: dev (worker
  phục vụ từ node_modules qua Vite) và production build (worker
  phát hành thành asset `pdf.worker.min-*.mjs` ~1,26 MB trong
  dist, tải từ cùng origin); **mọi request đều ở origin nội bộ,
  không CDN**, 0 lỗi console.
- **Loader (`src/engines/pdf/loader.ts`):** `openPdfDocument(
  source, { signal })` nhận Blob/ArrayBuffer/Uint8Array. Blob chỉ
  đọc qua arrayBuffer() (bản đọc mới mỗi lần — Blob gốc trong
  DocumentRepository không bị chạm); ArrayBuffer/Uint8Array của
  caller được sao chép trước khi giao PDF.js vì PDF.js có thể
  detach buffer nó nhận (test xác nhận buffer caller nguyên vẹn).
  Kiểm chữ ký %PDF- trong 1024 byte đầu trước khi parse.
  `PdfDocumentHandle`: pageCount; metadata (title/author/subject/
  creator/producer/pdfVersion — thiếu thì null, không bịa);
  getPage/getNativePage theo index **zero-based** (PDF.js 1-based
  ở trong), trang native được cache; close() destroy loading task
  (idempotent), thao tác sau đóng → lỗi kind 'closed';
  AbortSignal hủy loading → kind 'cancelled' và destroy task,
  kể cả hủy ngay khi vừa bắt đầu mở tài liệu 120 trang.
- **Lỗi (`errors.ts`):** `PdfLoadError` phân loại not-a-pdf /
  corrupt / password / unsupported / cancelled / worker / closed /
  unknown, lỗi gốc giữ trong `cause`; `PdfPageIndexError`
  (RangeError) cho index ngoài phạm vi. PDF có mật khẩu hiện chỉ
  PHÁT HIỆN — chưa hỗ trợ nhập mật khẩu (đúng phạm vi brief).
- **Fixtures (`tests/pdf/fixtures.ts`, sinh bằng code, không
  commit nhị phân):** bộ dựng PDF hoàn chỉnh (xref/trailer/Info,
  chuỗi ngoài ASCII mã hóa UTF-16BE như file thật) cho PDF 1
  trang, nhiều trang, 120 trang; bản cắt cụt (hỏng); bytes
  không phải PDF; và **PDF mã hóa Standard R2 (RC4 40-bit) tự
  cài đặt thuật toán** (MD5 qua node:crypto, RC4 tự viết vì
  OpenSSL 3 đã bỏ) với user password — PDF.js nhận diện đúng là
  password-protected.
- **Kiểm thử:** 17 test mới ở `tests/pdf/loader.test.ts` (mở/
  metadata/trang/vòng đời 5 chu kỳ mở–đóng/hai tài liệu độc lập/
  hủy loading/phân loại lỗi), tổng **365/365 đạt**; trình duyệt
  (harness tạm, đã xóa): **7/7 ở dev và 7/7 ở production build**
  (mở, metadata, thông tin trang, đóng–mở lại). Lint và build đạt;
  không skip/only. Chưa render — TASK-06B dùng `getNativePage`.
- **Git:** chưa commit — chờ chủ dự án duyệt (cả thay đổi TASK-08A
  lẫn TASK-06A đang chờ).

### TASK-08A — 2026-10-31 — Storage Foundation (Dexie/IndexedDB)

- **Bối cảnh:** Sau quyết định Q1 = B (annotation phải bền qua
  reload và khởi động lại app), roadmap đổi thứ tự: tách TASK-08
  thành 08A (nền lưu trữ — làm trước TASK-06), 08B (Library UI,
  sau TASK-06), 08C (Whiteboard/Workspace/Backup, trước TASK-12/13).
  TASKS.md đã ghi roadmap mới gồm 6 subtask của TASK-06.
- **Dependency:** cài **dexie 4.4.7** (Apache-2.0, đã kiểm chứng từ
  gói cài thật) và **fake-indexeddb 6.2.7** (Apache-2.0, chỉ
  devDependency phục vụ test). Không dùng localStorage, không idb.
- **Triển khai tại `src/data/`:** `database.ts` (Dexie database
  `webscribble`, schema v1: `documents: id, createdAt, updatedAt`;
  `annotations: surfaceId, documentId`; Blob gốc lưu trong record
  tài liệu); `types.ts` (DocumentRecord/Metadata,
  AnnotationSurfaceRecord, `ANNOTATION_SCHEMA_VERSION = 1` —
  tách bạch với phiên bản schema Dexie, quy ước
  `document:<documentId>:<pageIndex>` zero-based,
  UnsupportedAnnotationSchemaError); `repositories/
  documentRepository.ts` (mỗi lần nhập sinh documentId mới kể cả
  trùng nội dung — QA-B; list không kèm Blob; updateMetadata không
  đụng Blob/annotation; delete xóa tài liệu + annotation trong
  cùng transaction); `repositories/annotationRepository.ts` (put
  nguyên tử theo surfaceId, giữ nguyên thứ tự objects, đọc/ghi đều
  từ chối khi record có schemaVersion mới hơn và giữ nguyên dữ
  liệu; objects giữ dạng `unknown[]` — validate DrawingObject
  thuộc Annotation Engine, Data Layer không phụ thuộc nghiệp vụ
  Drawing Engine); `storage/storageManager.ts` (persist/persisted/
  estimate qua adapter tiêm vào; thiếu API → 'unsupported', lỗi
  estimate → kết quả mang thông điệp, không crash);
  `autosave/autosaveManager.ts` (debounce mặc định 400 ms theo
  surface, chỉ ghi bản mới nhất, flush chờ ghi xong và reject khi
  lỗi, cancel, trạng thái idle/pending/saving/saved/error, số thứ
  tự tăng đơn điệu chống write cũ ghi đè, dữ liệu lỗi được giữ để
  thử lại); `index.ts` (`createStorageFoundation()`).
  `src/data/repositories/.gitkeep` đã xóa.
- **Kiểm thử (đã chạy thật):** **348/348 test đạt** (30 file;
  TASK-08A thêm 27 test fake-indexeddb ở `tests/data/`): tài liệu
  (Blob đọc lại nguyên vẹn từng byte, hai lần nhập cùng file → hai
  id, xóa cascade), annotation (upsert 3 lần vẫn 1 record, thứ tự
  object, độc lập surface/tài liệu, record tương lai
  schemaVersion+99 không bị nạp/ghi đè), autosave (debounce gộp,
  flush không báo saved sớm, write cũ → ghi tiếp bản mới, lỗi →
  giữ dữ liệu + thử lại), storage manager (đủ/thiếu API, từ chối,
  estimate lỗi). **IndexedDB thật trên Chromium headless: 8/8 đạt**
  — tạo database, lưu Blob + annotation qua repository thật và
  autosave, reload toàn trang, đọc lại identical, đúng 1 record
  mỗi loại, 0 lỗi console (harness tạm đã xóa). Đo tại môi trường
  này: quota ≈ 10 GB, usage sau fixture ≈ 73 KB; trạng thái
  persisted mặc định 'denied' khi chưa xin. `npm run lint` đạt;
  `npm run build` đạt; không skip/only.
- **Ngoài phạm vi, chưa làm:** PDF.js, Annotation Engine (TASK-06C),
  UI thư viện (TASK-08B), backup/restore (TASK-08C).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05G — 2026-10-31 — Drawing Engine: Integration & Testing

- **Phạm vi:** kiểm thử tích hợp toàn diện cho TASK-05A → 05F, sửa
  bug phát hiện được, benchmark ghi nhận theo môi trường, kiểm
  chứng trình duyệt thật (headless). Không thêm tính năng, không
  đổi API công khai, không cài thư viện.
- **BUG THẬT đã sửa — StrokeBuilder đánh rơi điểm nhả bút:** sự
  kiện `up`/`cancel` hoàn tất nét mà không bổ sung mẫu cuối, nên
  mọi nét đều cụt tại sự kiện `move` cuối cùng (kéo nhanh hoặc môi
  trường ít sự kiện move thì mất đoạn cuối thấy rõ; bounds của nét
  cũng ngắn hơn thực tế — phát hiện khi kiểm thử tích hợp thấy
  bounds của highlighter ngắn bất thường). ShapeBuilder và các
  Selection builder vốn đã áp vị trí up — StrokeBuilder là nơi duy
  nhất lệch. **Sửa:** `finishFromEvent` bổ sung mẫu cuối trước khi
  hoàn tất, chỉ khi vị trí thực sự khác điểm cuối hiện tại (mẫu
  up/cancel mang pressure 0 nên phép khử trùng theo cả pressure
  không loại được điểm trùng vị trí). 6 test của TASK-05C mã hóa
  hành vi cũ đã được cập nhật cho khớp hành vi đúng (ghi chú
  TASK-05G trong test), kèm 2 test regression chuyên biệt.
- **Test tích hợp mới (48 test, 5 file):** `integrationTools.test.ts`
  (13 — đủ 7 công cụ qua down/move/up/cancel, preview, thao tác
  không hợp lệ không sinh rác, selection/eraser trên cảnh nét giao
  nhau/chồng/sát nhau, không đụng object không liên quan);
  `integrationHistory.test.ts` (4 — chuỗi hỗn hợp 7 thao tác undo/
  redo từng bước, trạng thái cuối bằng đúng tham chiếu ban đầu,
  thứ tự vẽ qua move + segment-erase); `pointerLifecycle.test.ts`
  (12 — đổi công cụ/detach/undo giữa nét, pointer thứ hai và
  non-primary, nút phụ, rời vùng canvas nhờ capture, coalesced
  events, pressure: bút giữ 0 thật, mouse/touch fallback 0.5, chuỗi
  thiết bị hỗn hợp); `splitIsolation.test.ts` (7 — hai engine:
  dữ liệu/selection/camera/công cụ/detach/history độc lập);
  `renderPerf.test.ts` (10 — stress & vòng đời render, xem dưới).
- **Benchmark (môi trường: Node v24.22.1, x86_64, VM hiện tại,
  FakeContext2D ghi lệnh — đo chi phí tính toán phía engine, KHÔNG
  phải thời gian vẽ GPU của trình duyệt):** render toàn cảnh 100
  nét × 50 điểm ≈ 40 ms (lần đầu, còn warm-up), 500 nét ≈ 115 ms,
  1.000 nét ≈ 101 ms; một nét 10.000 điểm ≈ 3,5 ms; 500 nét ở zoom
  3 ≈ 60 ms; `selectObjects` trên 1.000 nét ≈ 3,9 ms; history 200
  add ≈ 6,7 ms, 200 undo ≈ 0,5 ms, 200 redo ≈ 75 ms (redo dùng
  insertObjectAt dựng lại Map — O(n) mỗi lần chèn; chấp nhận được ở
  quy mô này, ghi nhận để theo dõi khi Surface lớn hơn nhiều).
  Không đặt ngưỡng hiệu năng cho thiết bị thật từ các số này.
- **Kiểm chứng trình duyệt (Playwright + chrome-headless-shell):**
  trang harness tạm gắn DrawingEngine lên canvas thật (đã xóa sau
  khi đo). **16/16 kiểm tra đạt:** desktop 1440×900 chuột kéo →
  đúng 1 object, bounds khớp tọa độ kéo (không lệch), 824 pixel
  mực; undo → canvas trắng hoàn toàn, redo → mực trở lại; tablet
  768×1024 cảm ứng qua CDP ở DPR 2: backing store 1600×1200, nét
  đúng tọa độ, trang không cuộn khi vẽ (canvas có
  `touch-action: none`), 4.122 pixel mực; viewport mobile 390×844
  vẽ bình thường; cả ba bối cảnh 0 lỗi console/pageerror. Đây là
  Chromium headless mô phỏng — KHÔNG phải thiết bị thật, không có
  Safari/iPad (xem ISSUE-006).
- **Chất lượng cuối:** 321/321 test đạt (26 file; trước TASK-05G
  là 273), `npm run lint` đạt, `npm run build` đạt; không có
  `skip`/`only`/`todo` trong toàn bộ test; git diff chỉ gồm
  `strokeBuilder.ts` (sửa bug), 5 file test mới, 6 điểm cập nhật
  trong `strokeBuilder.test.ts`, và tài liệu bộ nhớ. Harness QA
  tạm (`drawing-qa.html`, `src/qa-drawing.ts`) đã xóa.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05F — 2026-10-31 — Drawing Engine: History Manager (Undo/Redo)

- **File được tạo:** `src/engines/drawing/history.ts`; test:
  `surfaceInsert.test.ts` (4), `history.test.ts` (15),
  `engineHistory.test.ts` (14). **File được sửa:** `surface.ts`
  (thêm `insertObjectAt`; `replaceObject` giữ vị trí), `engine.ts`
  (tích hợp history toàn diện), `index.ts`, tài liệu bộ nhớ.
  **Không cài thư viện ngoài; không sửa Input Manager.**
- **Phân tích API Surface trước khi làm (theo yêu cầu brief):** API
  05A chưa đủ cho undo/redo CHÍNH XÁC ở ba điểm — (1) `updateObject`/
  `updateObjects` luôn ghi đè `updatedAt` nên không khôi phục nguyên
  bản qua đường update được; (2) không có cách đưa object đã xóa trở
  lại ĐÚNG VỊ TRÍ trong thứ tự vẽ (addObject chỉ nối cuối); (3)
  `replaceObject` xóa rồi nối các object thay thế xuống cuối danh
  sách, làm thứ tự chồng lớp thay đổi ngay trong thao tác tẩy tiến
  về phía trước. Đã bổ sung tối thiểu: **`insertObjectAt(index,
  object)`** — chèn nguyên bản (không đổi trường nào) tại vị trí,
  kiểm tra đầy đủ trước khi ghi; và sửa `replaceObject` để các
  object thay thế đứng tại vị trí của object bị thay. Không thay đổi
  ngữ nghĩa nào khác của Surface.
- **Thiết kế Command Pattern:** một command tổng quát
  `SurfaceChangeCommand` thay cho mười class riêng (brief cho phép):
  mọi thao tác quy về `SurfaceChange` = hai danh sách
  `{object, index}` bị ảnh hưởng ở trạng thái trước/sau. Object bất
  biến nên command chỉ giữ tham chiếu — không sao chép dữ liệu,
  không snapshot toàn Surface, không bitmap; bộ nhớ tỉ lệ với số
  object bị chạm. Các performer `performAddObject`/
  `performRemoveObjects`/`performUpdateObjects`/
  `performReplaceObject`/`performMoveObjects` thực thi bằng API
  Surface thường (giữ ngữ nghĩa gốc, gồm updatedAt làm mới khi
  update tiến) và chụp trạng thái SAU từ chính object Surface đã lưu.
  Undo/redo là hoán đổi trạng thái nguyên bản (removeObject +
  insertObjectAt theo chỉ số tăng dần) — không chạy lại logic, không
  tạo ID mới, redo của Segment Eraser tái tạo đúng các đoạn cùng ID,
  redo của move khôi phục đúng bản đã lưu chứ không làm mới updatedAt
  lần nữa. `mergeChanges` gộp chuỗi thay đổi liên tiếp (object trung
  gian biến mất khỏi cả hai phía). Thao tác không đổi dữ liệu →
  performer trả null → không ghi.
- **HistoryManager:** một instance gắn đúng một Surface (Split dùng
  hai manager độc lập, không có lịch sử toàn cục); API record/
  execute/undo/redo/canUndo/canRedo/undoCount/redoCount/clear; thao
  tác mới xóa nhánh redo; **giới hạn mặc định 100 command** — vượt
  giới hạn loại command cũ nhất khỏi lịch sử (dữ liệu Surface không
  đổi), lý do: đủ sâu cho một phiên làm việc và bộ nhớ bị chặn vì mỗi
  command chỉ giữ object nó chạm vào. Giới hạn không hợp lệ bị từ chối.
- **Tích hợp DrawingEngine:** engine sở hữu `history` của Surface
  mình; nét/hình hoàn tất, text, moveSelectionBy, deleteSelection đi
  qua history (một thao tác = một command; preview đang vẽ dở không
  ghi; camera/requestRender không ghi). Hai chế độ tẩy: engine chụp
  khung tham chiếu object tại pointer-down và tại pointer-up dựng
  MỘT SurfaceChange (trước = các object đầu lần tẩy đã biến mất, sau
  = các object mới xuất hiện) — một lần kéo tẩy qua nhiều move, kể cả
  Segment Eraser thay đi thay lại các đoạn, vẫn là một command.
  `engine.undo()/redo()/canUndo/canRedo` ủy quyền cho history, tự
  loại ID chết khỏi lựa chọn và yêu cầu renderer vẽ lại.
- **Kiểm thử (đã chạy thật):** **273/273 test đạt** (21 file; 05F
  thêm 33) — insertObjectAt (vị trí/ nguyên bản/ từ chối lỗi) và
  replaceObject giữ vị trí; command cho Add/Remove/Update/Replace/
  Move (khôi phục đúng tham chiếu, đúng vị trí, đúng updatedAt);
  command thất bại không đổi Surface lẫn history; mergeChanges hai
  bước thay thế; chuỗi undo/redo LIFO, nhánh redo bị xóa, giới hạn
  3/100, clear; độc lập hai Surface; tích hợp engine: pen (preview
  không ghi), highlighter, 4 loại shape, text, di chuyển/xóa nhóm,
  Stroke Eraser một kéo ba nét, Segment Eraser (kéo dài nhiều move,
  redo cùng ID đoạn), tẩy trượt không ghi, redraw sau undo/redo
  (đếm clearRect), hai engine Split độc lập. Một kỳ vọng test ban
  đầu của chính tôi sai (đoạn còn lại sau khi tẩy giữa nét dài là 2,
  không phải 1) — đã sửa test theo hành vi đúng. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (pha trang thử nghiệm).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05E — 2026-10-31 — Drawing Engine: Selection & Eraser

- **File được tạo:** `src/engines/drawing/selection.ts`,
  `src/engines/drawing/eraser.ts`; test: `hitGeometry.test.ts` (16),
  `selection.test.ts` (29), `eraser.test.ts` (20),
  `engineSelection.test.ts` (9). **File được sửa:** `geometry.ts`
  (hình học khoảng cách/giao nhau + bounds mới), `objects.ts`
  (factory dùng bounds mới), `renderer.ts` (hình học đầu mũi tên
  chuyển về geometry, thêm setLineDash vào context interface),
  `canvasRenderer.ts` (lớp phủ `getOverlay`), `engine.ts` (công cụ
  chọn/tẩy + quản lý lựa chọn), `index.ts`, `tests/drawing/fakes.ts`
  (setLineDash), 4 test cũ cập nhật kỳ vọng bounds (objects,
  surfaceUpdate, shapeBuilder, engine). **Không cài thư viện ngoài;
  không sửa Input Manager.**
- **Sửa bounds (theo yêu cầu kiểm tra của brief):** phát hiện bounds
  cũ của MỌI hình hai điểm chỉ là hộp hai điểm — nét vẽ của hình tràn
  ra ngoài nửa độ dày nét, riêng arrow thì đầu mũi tên nằm hẳn ngoài
  bounds. Đã sửa ở tầng geometry/factory: `shapeObjectBounds` (nới
  nửa độ dày nét) và `arrowBounds` (hợp hộp thân + hộp hai cánh đầu
  mũi tên rồi nới nửa độ dày nét); `arrowHeadPoints`/`arrowHeadLength`
  chuyển từ renderer về geometry để bounds/renderer/selection dùng
  chung một định nghĩa; renderer bỏ mức tối thiểu 10px màn hình của
  đầu mũi tên, chuyển sang đơn vị world (× zoom) để khớp bounds ở
  mọi mức zoom. Bounds của mọi object nay = phạm vi mực vẽ thật.
- **Selection:** hai tầng — lọc ứng viên bằng bounds, kết luận bằng
  hình học thật theo loại (nét/line: polyline với bán kính mực so với
  polygon; rectangle/text: polygon vùng kín; ellipse: polygon xấp xỉ
  48 cạnh; arrow: thân + tam giác đầu mũi tên). Kiểm chứng then chốt:
  vùng chọn giao bounds của nét chéo nhưng không chạm nét → không
  chọn. Rectangle Selection và Lasso dùng CHUNG một hàm kết luận.
  Lasso đóng polygon khi hoàn tất; lasso tự cắt bị TỪ CHỐI tường
  minh ('self-intersecting') — thứ tự kiểm tra đặt tự cắt trước diện
  tích vì hình nơ có diện tích triệt tiêu (lỗi thứ tự này do test bắt
  được trong quá trình làm). Di chuyển: `translateObject` thuần +
  `moveObjects` qua `updateObjects` — nguyên tử (ID lạ/delta NaN →
  ném lỗi, không object nào thay đổi). Rect builder ban đầu quên áp
  vị trí tại sự kiện up vào cạnh cuối vùng chọn — test bắt được, đã sửa.
- **Eraser:** Stroke Eraser kết luận bằng khoảng cách đoạn–đoạn thật
  cộng nửa độ dày nét, xóa toàn bộ nét qua removeObject. Segment
  Eraser: đường tẩy phủ bằng dãy hình tròn chồng lấp (tâm cách ≤ 1
  bán kính); mỗi hình tròn cắt các đoạn nét bằng nghiệm phương trình
  đoạn–tròn, điểm biên nội suy x/y/áp suất/thời gian (giữ thứ tự thời
  gian không giảm — yêu cầu của validation); đoạn còn lại tạo qua
  factory với ID MỚI (kế thừa createdAt + style) và thay nguyên tử
  qua replaceObject; xóa hết → replaceObject với danh sách rỗng. Cả
  hai chế độ chỉ tác động pen/highlighter; không pixel erasing.
- **Engine/UI:** DrawingEngine thêm công cụ select-rect/select-lasso/
  stroke-eraser/segment-eraser; giữ danh sách ID đang chọn
  (getSelection/clearSelection/moveSelectionBy/deleteSelection);
  ID bị tẩy xóa/tách tự rời khỏi lựa chọn; setEraserSize áp dụng
  ngay cho phiên đang mở. CanvasRenderer thêm `getOverlay` — engine
  vẽ vùng chọn đang kéo (nét đứt), khung bounds các object đã chọn
  và vòng tròn con trỏ tẩy qua lớp phủ này.
- **Kiểm thử (đã chạy thật):** **240/240 test đạt** (18 file; 05E
  thêm 74) — hình học khoảng cách/giao nhau/bounds mũi tên; chọn đủ
  7 loại (gồm trường hợp giao bounds nhưng không giao hình học, độ
  dày mực highlighter vs pen, đầu mũi tên); builder rect/lasso (tự
  cắt, lấy mẫu thưa, hủy); di chuyển 1/nhiều object + nguyên tử khi
  lỗi; hai chế độ tẩy (đầu/cuối/giữa/toàn bộ nét, nhiều đoạn, ID mới,
  không sửa object gốc đóng băng sâu, không tác động Shape/Text);
  tích hợp engine gồm camera pan và overlay. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (thuộc pha trang thử nghiệm; ISSUE-006 vẫn mở).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05D — 2026-10-31 — Drawing Engine: Shape & Text Engine

- **File được tạo:** `src/engines/drawing/shapeBuilder.ts`,
  `src/engines/drawing/text.ts`; test: `shapeBuilder.test.ts` (13),
  `text.test.ts` (11), `shapeTextRenderer.test.ts` (14) và 4 test
  engine bổ sung. **File được sửa:** `renderer.ts` (thêm drawShape/
  drawText/drawObject + mở rộng CanvasContextLike), `canvasRenderer.ts`
  (vẽ mọi loại object qua drawObject), `engine.ts` (công cụ hình +
  text), `index.ts`, `tests/drawing/fakes.ts` (context giả có thêm
  stroke/ellipse/clip/fillText/measureText xác định), engine.test.ts
  (đổi tên getter isStrokeInProgress → isDrawingInProgress), tài liệu
  bộ nhớ. **Không cài thư viện ngoài; không sửa Input Manager.**
- **Shape Builder:** vòng đời như StrokeBuilder (down neo + sinh ID,
  move cập nhật, up hoàn tất, cancel giữ hình hợp lệ, down mới chốt
  hình cũ, abandon là đường hủy duy nhất, preview chung ID). Chính
  sách hình suy biến khi hoàn tất: line/arrow dài < minSize hoặc
  rectangle/ellipse một chiều < minSize → sự kiện `discarded`
  (minSize mặc định 2 world units, cấu hình được); preview lúc kéo
  không bị ảnh hưởng. Object qua factory nên bounds/validation chuẩn.
- **Text Engine (DEC-026):** ba lớp tách bạch — nội dung (chuỗi thật,
  Unicode/tiếng Việt nguyên trạng), kích thước layout (width/height
  lưu trong object, đo bằng TextMeasurer tiêm vào: bản Canvas dùng
  measureText + lineHeight = fontSize × 1.25), hiển thị (renderer).
  Chia dòng: '\n' + gói từ tham lam theo maxWidth, từ quá dài giữ
  nguyên dòng riêng. Text rỗng bị từ chối. `updateTextContent` trả
  object mới giữ id/createdAt/vị trí để dùng với updateObject.
- **Renderer:** `drawShape` tôn trọng ShapeStyle (stroke/fill/
  opacity; rect/ellipse mặc định không fill; arrow = thân stroke +
  đầu tam giác đặc từ hàm thuần `arrowHeadPoints`, cánh đối xứng
  30°); `drawText` chia dòng bằng cùng thuật toán layout (gói theo
  width của object), clip trong hộp object, font × zoom, và phép đo
  nằm trong save/restore sau một lỗi rò trạng thái font bị test bắt
  được. `drawObject` là điểm dispatch chung; pen/highlighter giữ
  nguyên hành vi (test hồi quy đạt).
- **DrawingEngine:** điều phối StrokeBuilder/ShapeBuilder theo công
  cụ (`setTool` có overload theo họ style); công cụ 'text': down →
  callback `onTextPlacementRequested(position)` cho tầng view,
  `addTextObject` tạo object qua Text Engine với measurer được tiêm
  hoặc tự tạo từ canvas của engine.
- **Kiểm thử (đã chạy thật):** **166/166 test đạt** (14 file; 05D
  thêm 42) — tạo đủ 4 hình + kéo cập nhật + hoàn tất/hủy + bounds +
  hình học đầu mũi tên + hình suy biến; text: layout/gói dòng/
  Unicode/đa dòng/width-height/cập nhật/từ chối rỗng/bộ đo canvas;
  renderer từng loại + camera pan/zoom + đóng băng dữ liệu nguồn +
  redraw toàn bộ Surface trộn 7 loại; engine: kéo tạo rectangle,
  loại hình suy biến, đặt text + addTextObject. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (vẽ text thật phụ thuộc font hệ thống; thuộc pha trang thử nghiệm).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05C — 2026-10-31 — Drawing Engine: Stroke Engine & Renderer

- **File được tạo:** `src/engines/drawing/strokeBuilder.ts`,
  `renderer.ts`, `canvasRenderer.ts`, `engine.ts`; test:
  `tests/drawing/fakes.ts` (context 2D/canvas/scheduler/element giả
  dùng chung), `strokeBuilder.test.ts` (16), `renderer.test.ts` (9),
  `canvasRenderer.test.ts` (7), `engine.test.ts` (5) và 1 test bổ
  sung cho `reset()` trong `input.test.ts`. **File được sửa:**
  `src/engines/drawing/input.ts` (thêm `PointerInputManager.reset()`),
  `index.ts`, README drawing engine, `package.json`/`package-lock.json`.
- **Dependency mới:** `perfect-freehand@1.2.3` (MIT — đọc từ gói đã
  cài) theo đúng DEC-016; đã kiểm chứng hành vi bằng script trước khi
  dùng (nét 1 điểm vẫn sinh outline 44 điểm; pressure làm outline biến
  thiên đúng kỳ vọng).
- **Stroke Builder (Phần A):** down mở nét (ID + createdAt sinh ngay,
  preview và object cuối dùng chung), move thêm điểm, up hoàn tất.
  Chính sách gián đoạn: `cancel` hoàn tất và GIỮ nét (kết quả mang
  `endedBy`); down mới giữa nét → hoàn tất nét cũ `endedBy:
  'interrupted'` rồi mở nét mới; `abandon()` là đường hủy duy nhất và
  phải do tầng gọi chủ động. Time: tương đối từ điểm đầu, kẹp không
  giảm (mẫu lệch thứ tự/đồng hồ) — object tạo ra luôn qua validation
  của TASK-05A (test đối chiếu trực tiếp). Điểm trùng hoàn toàn bị bỏ
  qua. Bounds qua factory (strokeBounds) và `currentBounds` trong lúc
  vẽ khớp bounds cuối cùng (có test).
- **Renderer (Phần B + C):** outline tính lúc render bằng
  perfect-freehand từ raw points đã qua camera (size × zoom,
  `simulatePressure: false` vì pressure đã chuẩn hóa ở 05B); pen
  thinning 0.5 (dày theo pressure), highlighter thinning 0 + opacity
  từ style. `drawStroke` chỉ đọc object (test đóng băng sâu object
  vẫn vẽ được, dữ liệu không đổi). `CanvasRenderer`: rAF có gộp yêu
  cầu trùng, resize đặt backing store = CSS × DPR và vẽ theo
  transform DPR (test ghi lại đúng dãy setTransform/clearRect), redraw
  toàn bộ từ `getObjects`/`getPreviewObjects` mỗi frame, `dispose()`
  hủy frame đang chờ (có test). Object không phải nét bị bỏ qua an
  toàn.
- **Tích hợp (Phần D):** `DrawingEngine` là điểm nối duy nhất cho một
  bề mặt (input → builder → surface, renderer đọc surface + preview).
  Test tích hợp bắt được một lỗi thật: đổi công cụ giữa nét làm lệch
  trạng thái Input Manager (pointer cũ còn "đang hoạt động") → đã sửa
  bằng `reset()` ở trên và đổi công cụ/detach đều chốt nét vào Surface
  trước. Hai engine trên hai surface độc lập hoàn toàn (Split).
- **Kiểm thử (đã chạy thật):** **124/124 test đạt** (11 file; 05C thêm
  38 test mới); `npm run lint` đạt; `npm run build` đạt. Toàn bộ test
  chạy trên mock canvas có kiểm soát trong môi trường Node — **chưa
  kiểm chứng trên trình duyệt/thiết bị thật** (độ mượt, cảm giác bút,
  Safari/iPad): thuộc pha trang thử nghiệm của TASK-05 và ISSUE-006.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05B — 2026-10-31 — Drawing Engine: Input Manager

- **File được tạo:** `src/engines/drawing/input.ts` (Input Manager) và
  `tests/drawing/input.test.ts` (25 test). **File được sửa:**
  `src/engines/drawing/index.ts` (export input), README của drawing
  engine, tài liệu bộ nhớ (mục này). **Không cài thư viện ngoài** —
  dùng Pointer Events thuần của nền tảng web.
- **API:** `PointerInputManager` (constructor nhận `target` theo
  interface cấu trúc tối thiểu `PointerTargetLike`, `getCamera()` —
  gọi lại cho mỗi sự kiện — và callback `onEvent`; phương thức
  `attach()`/`detach()` idempotent, thuộc tính `activePointerId`,
  `isAttached`). Phát ra `PointerInputEvent {type: down|move|up|cancel,
  sample: PointerSample}`; sample gồm pointerId, pointerType đã chuẩn
  hóa, `position` (world) + `screenPosition`, pressure/tiltX/tiltY đã
  chuẩn hóa, `time` (timeStamp gốc), `buttons`. Các hàm thuần được
  export riêng để kiểm thử: `normalizePointerKind`,
  `normalizePressure`, `normalizeTilt`, `pointerEventToSample`.
- **Luồng pointer:** down (chỉ pointer chính, nút chính, khi chưa có
  thao tác nào) → set pointer capture → phát 'down'; move → chỉ của
  pointer đang hoạt động, mở rộng thành các sample coalesced khi có
  `getCoalescedEvents`; up/cancel → phát sự kiện kết thúc, giải phóng
  capture, reset trạng thái (dọn trạng thái trong `finally` nên cả khi
  dữ liệu sự kiện kết thúc bị hỏng, thao tác vẫn kết thúc sạch).
- **Pressure/tilt & fallback:** pressure kẹp về [0,1]; giá trị 0 lúc
  đang nhấn ở mouse/touch → 0.5 (`FALLBACK_PRESSURE`, khớp quy ước
  StrokePoint ở TASK-05A); với bút, 0 được giữ nguyên vì là dữ liệu
  thật; thiếu dữ liệu (undefined/NaN) → 0.5 khi đang nhấn, 0 khi
  không; tilt thiếu → 0, có thì kẹp [-90, 90].
- **Giới hạn có chủ ý (theo brief):** chỉ một pointer tại một thời
  điểm — pointer thứ hai/non-primary bị bỏ qua, không multi-touch
  gesture; manager không vẽ, không tạo DrawingObject, không quản lý
  history; việc chặn cuộn trang (`touch-action: none`) thuộc tầng
  view, xử lý ở pha Renderer. Cập nhật tiến triển vào ISSUE-006 (vẫn
  OPEN — còn phần kiểm chứng thiết bị thật).
- **Kiểm thử (đã chạy thật):** 25 test mới đạt — mouse (down/move/up,
  move/up khi không có thao tác, nút phụ bị bỏ qua), touch, stylus
  (pressure/tilt giữ nguyên, pressure 0 thật của bút không bị thay),
  chuẩn hóa + fallback, capture (set/release ở up/cancel, lỗi capture
  không làm hỏng luồng), pointer ID không khớp + non-primary, chuyển
  đổi tọa độ qua camera và camera thay đổi giữa thao tác, coalesced
  (mở rộng đúng thứ tự; rỗng/không hỗ trợ thì dùng sự kiện gốc), dữ
  liệu không hợp lệ (NaN vẫn dọn trạng thái sạch), attach/detach.
  Tổng toàn dự án: **86/86 test đạt** (7 file); `npm run lint` đạt;
  `npm run build` đạt.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05A (bổ sung) — 2026-10-31 — Phê duyệt đề xuất + DrawingSurface.updateObject

- **Quyết định:** Chủ dự án phê duyệt cả 3 đề xuất của TASK-05A →
  chuyển thành quyết định chính thức trong DECISIONS.md: **DEC-024**
  (Vitest là test runner chính thức), **DEC-025** (StrokePoint.time là
  ms tương đối từ điểm đầu của nét), **DEC-026** (TextObject tự mang
  width/height). Mục đề xuất ở cuối DECISIONS.md đã dọn sạch, chỉ còn
  dòng ghi nhận việc chuyển đổi. Kiểm tra số: DEC chạy đủ 001 → 026,
  không trùng, không mâu thuẫn (DEC-024 bổ sung cho DEC-016 về kiểm
  thử; DEC-025/026 cụ thể hóa mô hình dữ liệu của DEC-015/019).
- **Code (`src/engines/drawing/surface.ts`):** Bổ sung vào interface
  `DrawingSurface` và `InMemorySurface`:
  - `updateObject(object)` — thay object cùng ID; kiểm tra tồn tại +
    đúng bề mặt + `validateDrawingObject` trước khi ghi; surface tự
    đặt `updatedAt` = thời điểm cập nhật và trả về bản đã lưu; ID và
    surfaceId không thể thay đổi (định danh bằng chính ID của object
    truyền vào; ID lạ → lỗi not found); thất bại → object gốc giữ
    nguyên tham chiếu.
  - `updateObjects(objects)` — batch nguyên tử hai pha (kiểm tra tất
    cả, gồm trùng ID trong batch → mới ghi tất cả), cho thao tác nhiều
    object như di chuyển selection.
  - `replaceObject(id, replacements)` — thay nguyên tử 1 object bằng
    0..N object có ID mới (mảng rỗng = xóa hẳn), phục vụ Segment
    Eraser; replacements dùng lại ID cũ, trùng ID sẵn có, khác bề mặt
    hoặc không hợp lệ đều bị từ chối trước khi đụng vào dữ liệu.
- **Kiểm thử:** Thêm `tests/drawing/surfaceUpdate.test.ts` — 13 test:
  di chuyển object (bounds + updatedAt làm mới), sửa text, đổi style,
  giữ thứ tự danh sách; thất bại không đổi dữ liệu (unknown ID, khác
  surface, bounds bị sửa — đối chiếu bằng tham chiếu gốc); batch
  nguyên tử (một item hỏng → không item nào được ghi; trùng ID trong
  batch); replace thành 2 đoạn, replace bằng mảng rỗng, 5 kiểu thất
  bại của replace; cô lập 2 surface khi update. Tổng toàn dự án:
  **61/61 test đạt** (6 file); `npm run lint` đạt; `npm run build` đạt.
- **Tài liệu đồng bộ:** ARCHITECTURE.md mục 2.6, TASKS.md, CURRENT_STATE.md,
  PROJECT_INDEX.md (docs version 1.7), CHANGELOG.md.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05A — 2026-10-31 — Drawing Engine: Data Model & Surface Interface

- **File được tạo (7, trong `src/engines/drawing/`):** `types.ts`
  (DrawingObject discriminated union 7 loại: pen, highlighter, line,
  rectangle, ellipse, arrow, text; StrokePoint = x/y/pressure/time;
  Bounds; 3 họ style), `objects.ts` (factory từng loại + sinh ID bằng
  crypto.randomUUID có dự phòng + style mặc định), `geometry.ts`
  (bounds: stroke nới nửa độ dày nét, chuẩn hóa hình hai điểm, union/
  expand/intersect/contains, computeObjectBounds), `coordinates.ts`
  (Camera {x, y, zoom} tách khỏi dữ liệu; worldToScreen/screenToWorld;
  pan & zoom giữ điểm neo), `validation.ts` (validateDrawingObject +
  type guard — kiểm tra cấu trúc, pressure ∈ [0,1], time không giảm,
  bounds khớp dữ liệu tính lại), `surface.ts` (interface DrawingSurface
  + InMemorySurface — addObject từ chối object thuộc surface khác và ID
  trùng), `index.ts` (barrel export).
- **File được sửa:** `src/engines/drawing/README.md` (trạng thái 05A),
  `package.json` + `package-lock.json` (thêm vitest + script `test`),
  tài liệu bộ nhớ (mục này). Đã xóa `tests/.gitkeep`.
- **Dependency mới:** `vitest@5.0.5` (devDependency, MIT — đọc từ gói đã
  cài) làm test runner; script `npm run test` = `vitest run`. Chưa cài
  perfect-freehand/Zustand/Dexie — thuộc các pha/task sau. Không dùng
  `any` trong toàn bộ code mới (kiểm chứng bằng grep + lint).
- **Kiểm thử (đã chạy thật):** 5 file test trong `tests/drawing/`
  (objects, geometry, coordinates, validation, surface) — **48/48 test
  đạt**: tạo object từng loại, ID không trùng (2.000 ID), bounds từng
  loại, round-trip world↔screen ở 4 cấu hình camera, pan/zoom giữ điểm
  neo, cô lập 2 surface (mô hình Split DEC-020), validation nhận diện
  dữ liệu hỏng (NaN, pressure ngoài khoảng, time giảm, bounds bị sửa),
  JSON round-trip cho cả 7 loại. `npm run lint` đạt (exit 0);
  `npm run build` đạt (exit 0, gồm `tsc -b`).
- **Thiết kế chính:** tọa độ world của bề mặt; stroke chỉ lưu raw
  points — không outline, không bitmap; camera không chạm vào dữ liệu
  object; object là dữ liệu thuần tuần tự hóa được, sẵn sàng cho
  persistence (TASK-08), undo/redo và selection/eraser ở các pha sau.
- **Đề xuất chờ xác nhận** (ghi ở cuối DECISIONS.md, chưa phải quyết
  định): PROP-001 Vitest là test runner chính thức; PROP-002 quy ước
  `StrokePoint.time` là ms tương đối từ đầu nét; PROP-003 Text object
  lưu width/height do lớp tạo text đo.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-04 — 2026-10-30 — UI shell & điều hướng cơ bản

- **File được tạo (11):** `src/app/navigation.ts` (kiểu ViewKey/ModeKey +
  tiêu đề các khu vực); `src/app/layouts/AppShell.tsx`;
  `src/app/components/Sidebar.tsx` (Sidebar desktop thu gọn được +
  MobileDrawer), `Header.tsx`, `WelcomeSection.tsx`, `QuickActions.tsx`,
  `RecentDocuments.tsx`, `WorkspaceModes.tsx` (3 thẻ chế độ + panel xem
  trước); `src/app/features/home/HomePage.tsx`,
  `features/documents/DocumentsPage.tsx` (2 biến thể: gần đây / tất cả),
  `features/whiteboard/WhiteboardPage.tsx`,
  `features/settings/SettingsPage.tsx`.
- **File được sửa:** `src/app/App.tsx` (giữ mỏng — chỉ giữ state điều
  hướng và ghép shell + trang), `src/app/components/Sidebar.tsx` (sửa
  hiển thị tagline ở brand: bỏ cắt chữ bằng dấu "…" để tagline xuống
  dòng gọn — phát hiện khi xem ảnh chụp kiểm tra), `package.json` +
  `package-lock.json` (thêm lucide-react). Đã xóa 3 `.gitkeep` ở
  components/layouts/features vì thư mục đã có file thật.
- **Dependency mới:** `lucide-react@1.65.0` — giấy phép **ISC** (đọc từ
  gói đã cài), cài qua npm, không CDN. Lưu ý phiên bản này đã đổi tên
  một số icon (Home → House, FilePlus2 → FilePlus/FilePlusCorner) — đã
  đối chiếu tên icon với bản cài trước khi dùng.
- **Thiết kế:** Minimalist Premium; trắng/xám trung tính/xanh dương nhạt,
  xanh dương đậm cho primary/active/focus; bo góc, bóng nhẹ; không dùng
  Aurora Gradient; không sao chép giao diện ứng dụng khác. Responsive:
  sidebar tĩnh từ breakpoint `lg`, dưới `lg` dùng drawer có backdrop;
  lưới thẻ 3 cột → 1 cột; header rút gọn (ẩn ô tìm kiếm dưới `md`).
- **Tương tác đã hoạt động (kiểm chứng thật):** điều hướng 5 khu vực;
  thu gọn sidebar 256px → 76px; drawer mobile mở/đóng và tự đóng sau khi
  chọn mục; chọn 1 trong 3 chế độ (trạng thái active qua `aria-selected`
  + panel xem trước đổi theo chế độ, gồm mock 2 vùng cho Split Mode);
  Quick Actions điều hướng đúng đích. Các nút chưa có chức năng thật
  (Mở tài liệu từ thiết bị, Tạo bảng trắng, Tạo tài liệu mới) hiển thị
  **thông báo trung thực** nêu rõ task sẽ triển khai — không dữ liệu giả,
  không giả vờ thành công. Ô tìm kiếm là UI hiển thị (chưa gắn tìm kiếm
  thật, thuộc các task sau).
- **Kiểm tra đã chạy:** `npm run lint` đạt (exit 0); `npm run build` đạt
  (CSS 24,05 kB, JS 247,30 kB); grep CDN — sạch. Kiểm tra trình duyệt:
  trình duyệt xem trước từ xa **không truy cập được localhost** của máy
  này, nên đã tự kiểm tra bằng Chromium headless (Playwright) chạy ngay
  trên máy — 9 ảnh chụp ở 1440×900, 768×1024, 390×844: không tràn ngang
  ở cả 3 kích thước, đủ các tương tác nêu trên, **0 lỗi console/page**.
  Thư viện Playwright chỉ cài ở `/tmp/qa` phục vụ kiểm tra, **không**
  phải dependency của dự án.
- **Git:** thay đổi TASK-04 đang ở working tree (18 mục), **chưa commit**
  theo yêu cầu — chờ chủ dự án duyệt.

### TASK-03 — 2026-10-30 — Khởi tạo khung dự án

- **File/thư mục được tạo:** khung ứng dụng tại `~/workspace/webscribble/`
  (ngoài `docs/`): `package.json`, `package-lock.json`, `vite.config.ts`,
  `eslint.config.js`, `tsconfig*.json`, `index.html`, `public/`,
  `README.md`, `.gitignore` (bổ sung `.env*`), và `src/` theo cấu trúc:
  `app/` (App.tsx trang khởi đầu + components/layouts/features),
  `core/` (services/stores), `engines/` (pdf, word, document, whiteboard,
  drawing, annotation, export — mỗi thư mục một README placeholder nêu
  vai trò + DEC liên quan + task triển khai), `data/repositories`,
  `offline/`, `types/`, `hooks/`, `utils/`, `config/`, `assets/`,
  `styles/` (index.css với `@import "tailwindcss"`), `main.tsx`,
  `tests/`. Thư mục rỗng giữ chỗ bằng `.gitkeep`.
- **Hai điều chỉnh so với khuôn mẫu mặc định (đã báo cáo chủ dự án):**
  (1) Template `create-vite` hiện tại dùng **oxlint** — đã gỡ và thay
  bằng **ESLint** (flat config + typescript-eslint + react-hooks +
  react-refresh) đúng yêu cầu của task. (2) **TypeScript chốt 5.9.3**
  thay vì 7.0.2 của template, vì `typescript-eslint@8.72.1` khai báo
  peer `typescript <6.1.0` (cài cùng TS 7 báo ERESOLVE); nâng lại khi
  typescript-eslint hỗ trợ TS 7. Không quyết định nào trong DEC-016 →
  023 bị thay đổi (DEC-016 không ghim phiên bản TypeScript).
- **Phiên bản + giấy phép thực tế (đọc từ gói đã cài):** react/react-dom
  19.3.1 MIT; vite 8.3.5 MIT; @vitejs/plugin-react 6.1.2 MIT;
  tailwindcss/@tailwindcss/vite 4.3.3 MIT; typescript 5.9.3 Apache-2.0;
  eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1,
  eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.7,
  globals 17.13.0, @types/node 24.19.2, @types/react 19.3.0,
  @types/react-dom 19.3.0 — tất cả MIT. Không thư viện trả phí, không
  CDN (đã grep kiểm tra src + cấu hình).
- **Kiểm tra đã chạy thật:** `npm install` thành công, có
  `package-lock.json`; `npm run build` đạt (`tsc -b` + vite build, CSS
  Tailwind 7,99 kB); `npm run lint` đạt (exit 0, không lỗi/cảnh báo);
  `npm run dev` khởi động (Vite ready ~439 ms), phục vụ index.html với
  tiêu đề WebScribble và module App.tsx chứa đúng tên + tagline, sau đó
  đã tắt server.
- **Git:** `git init` (nhánh đổi tên `master` → `main`), `.gitignore`
  đã kiểm tra chặn đúng `node_modules`/`dist`/`.env*`; `git status` gồm
  14 mục chưa track; **chưa commit, chưa remote** theo yêu cầu. ISSUE-008
  thu hẹp còn quyết định hosting/remote.
- **Đồng bộ bộ nhớ:** TASKS.md (TASK-03 DONE + kết quả),
  CURRENT_STATE.md, KNOWN_ISSUES.md (ISSUE-008), PROJECT_INDEX.md (docs
  version 1.4), CHANGELOG.md. Không triển khai engine/PWA/IndexedDB nào;
  không sửa StudyWrite.

### TASK-02 — 2026-10-30 — Chốt kiến trúc & quyết định công nghệ

- **File được sửa (7):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/KNOWN_ISSUES.md`, `docs/TASKS.md`,
  `docs/CURRENT_STATE.md`, `docs/PROJECT_INDEX.md` (docs version 1.3).
  Không sửa: PROJECT_CONTEXT.md, AI_WORKFLOW.md, 3 file research.
- **Nội dung:**
  - DECISIONS.md: ghi 8 quyết định do chủ dự án xác nhận thành
    **DEC-016 → DEC-023** — stack chính thức + Dexie + 7 điều kiện
    (DEC-016); phạm vi PDF flatten, bảo vệ file gốc (DEC-017); phạm vi
    DOCX chấp nhận mất định dạng, giữ file gốc, cảnh báo khi xuất, xuất
    bằng thư viện `docx` (DEC-018); Whiteboard trang cố định, chưa
    Infinite Canvas, dữ liệu sẵn sàng mở rộng (DEC-019); mô hình
    Workspace/Surface, tự lưu + undo theo Surface (DEC-020); xuất Split
    Mode = phương án B (DEC-021); iOS offline + sao lưu/khôi phục bắt
    buộc (DEC-022); HEIC chưa tích hợp decoder (DEC-023). DEC-017/018/020
    ghi rõ là cụ thể hóa DEC-005/006/014-015 — không quyết định cũ nào bị
    sửa hoặc xóa.
  - PRODUCT_SPEC.md: thêm stack đã chốt (mục 1); ma trận Document Mode
    cập nhật (PDF sửa gốc = không cam kết theo DEC-017; HEIC theo
    DEC-023); Split Mode thêm mô hình lưu DEC-020 + xuất phương án B;
    Whiteboard chốt trang cố định; module PDF/Word/Annotation/Storage/
    Export/PWA đồng bộ theo DEC-017/018/020/021/022.
  - ARCHITECTURE.md: mục 1 chuyển từ "đề xuất" sang bảng công nghệ đã
    chốt kèm ghi chú bắt buộc (thêm Mammoth, thư viện `docx`, Dexie,
    perfect-freehand); Engine Layer mô tả pipeline Word (Mammoth →
    sanitize → Tiptap) và xuất flatten; Data Layer thêm Dexie, điều
    kiện dữ liệu của DEC-019, sao lưu/khôi phục và `storage.persist()`;
    thêm luồng 4.4 Sao lưu/Khôi phục; mục 6 cập nhật trạng thái đã chốt.
  - KNOWN_ISSUES.md: ISSUE-001/002/007/010/012/013 → **RESOLVED** (mỗi
    mục ghi bằng chứng là quyết định tương ứng); ISSUE-014 thu hẹp còn
    mobile + GIF; ISSUE-005 thêm ghi chú giảm nhẹ bởi DEC-022, giữ OPEN.
  - TASKS.md: TASK-02 → DONE + kết quả; TASK-03 giữ NOT_STARTED.
- **Kết quả kiểm tra:** DEC chạy đủ 001→023 không trùng; 3 task DONE
  (00/01/02), còn lại NOT_STARTED; đối chiếu SPEC ↔ ARCHITECTURE ↔
  DECISIONS ở các điểm đã chốt (PDF flatten, DOCX, Split, Whiteboard,
  HEIC, backup) — nhất quán; không còn nhãn CHƯA XÁC MINH nào mâu thuẫn
  với quyết định mới. Không tạo code/package.json, không cài dependency.

### TASK-01 — 2026-10-30 — Khảo sát & kiểm chứng công nghệ

- **File được tạo (3):** `docs/research/TECH_SURVEY.md` (Luồng A),
  `docs/research/STUDYWRITE_MODULE_AUDIT.md` (Luồng B),
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` (Luồng C).
- **File được sửa:** `docs/TASKS.md` (TASK-01 → DONE + kết quả),
  `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md` (ISSUE-001 →
  INVESTIGATING; bổ sung bằng chứng/kết luận cho ISSUE-002/007/010/012/
  013/014), `docs/ARCHITECTURE.md` (ghi chú trạng thái khảo sát ở mục 1),
  `docs/PROJECT_INDEX.md` (docs version 1.2), `docs/CHANGELOG.md`.
- **Nội dung chính:**
  - Luồng A: toàn bộ stack có khuyến nghị kèm nguồn chính thức — USE cho
    React/TypeScript/Vite/Tailwind/IndexedDB/Zustand/Canvas 2D +
    perfect-freehand; USE WITH CONDITIONS cho PDF.js (virtualization,
    worker cùng origin), pdf-lib (chỉ flatten, **không sửa được text
    gốc PDF** — trích Limitations chính thức), Tiptap (DOCX là nhập/xuất
    mất mát; tránh Pro/Cloud), Mammoth (chỉ trích ngữ nghĩa; phải
    sanitize), Service Worker/PWA (HTTPS; **ITP Safari xóa storage sau
    7 ngày nếu chưa cài vào Màn hình chính**). Giấy phép đã kiểm chứng
    qua npm registry: toàn MIT/Apache-2.0/BSD/ISC.
  - Luồng B (chỉ đọc StudyWrite): 11 cụm module được chấm — USE: xử lý
    ảnh/chip WMF; USE AFTER REFACTOR: tiền xử lý DOCX, OMML→MathML, đường
    nhập DOCX, thước/zoom, xuất DOCX bằng thư viện `docx`; tham chiếu
    thiết kế: hệ bút vẽ; DO NOT USE: xuất PDF raster, `.swp.json`, UI
    shell/nạp CDN. Ghi nhận JSZip dual license MIT/GPLv3 và hai module
    "không tồn tại" (annotation độc lập, chuyển đổi WMF/EMF thật).
  - Luồng C: ma trận ảnh (HEIC chỉ Safari ≥17 + cần WASM ở nơi khác; BMP
    không ưu tiên lưu); mô hình stroke điểm thô + bbox; undo/redo theo bề
    mặt; mô hình Workspace/Surface + tự lưu theo bề mặt cho Split Mode; 4
    phương án xuất Split Mode (chưa chốt); khuyến nghị Whiteboard trang
    cố định trước, dữ liệu sẵn sàng cho Infinite Canvas.
  - Mâu thuẫn nguồn được ghi minh bạch trong TECH_SURVEY: trạng thái hỗ
    trợ `getCoalescedEvents` trên Safari (18.2+ theo dữ liệu MDN mới vs
    chưa hỗ trợ theo bảng MDN khác) — cần kiểm chứng bằng thiết bị ở TASK-05.
- **Kết quả kiểm tra:** Đủ 3 file nghiên cứu; đối chiếu trạng thái task/
  issue giữa TASKS, CURRENT_STATE, KNOWN_ISSUES — nhất quán. Không tạo
  code ứng dụng, không sửa StudyWrite, không chốt quyết định nào thay
  chủ dự án (mọi khuyến nghị để lại cho TASK-02).

### Cập nhật bộ nhớ — 2026-10-30 — Quyết định StudyWrite (phương án C) + hệ thống 3 chế độ

- **Bối cảnh:** Lượt cập nhật theo yêu cầu chủ dự án, không phải task trong
  roadmap; không task nào được đánh dấu DONE trong lượt này.
- **File được sửa (8):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`,
  `docs/KNOWN_ISSUES.md`, `docs/PROJECT_INDEX.md`, `docs/CHANGELOG.md`.
  (Không sửa: `PROJECT_CONTEXT.md`, `AI_WORKFLOW.md` — không có nội dung liên quan.)
- **Nội dung:**
  - DECISIONS.md: thêm DEC-013 (WebScribble độc lập với StudyWrite, tái sử
    dụng module có chọn lọc theo 4 điều kiện), DEC-014 (3 chế độ làm việc:
    Document / Split / Whiteboard + nguyên tắc phân biệt sửa nội dung gốc
    vs chú thích phủ), DEC-015 (một Drawing Engine duy nhất cho cả 3 chế độ).
  - KNOWN_ISSUES.md: ISSUE-009 → RESOLVED (bằng chứng: DEC-013); mở mới
    ISSUE-012 (Infinite Canvas chưa đánh giá), ISSUE-013 (lưu trạng thái
    Split Mode), ISSUE-014 (chi tiết ma trận định dạng).
  - PRODUCT_SPEC.md: thêm mục 3 "Ba chế độ làm việc" kèm ma trận khả năng
    theo định dạng; các mục sau đánh số lại (module → mục 4, phi chức năng
    → mục 5, nghiệm thu → mục 6); bổ sung ghi chú DEC-015 ở module Drawing
    Engine và Annotation Engine.
  - ARCHITECTURE.md: thêm Whiteboard Engine, khái niệm Workspace/Surface ở
    Application Core và Data Layer, thư mục `engines/whiteboard/`, và mục 6
    phân tích ảnh hưởng của 3 chế độ.
  - TASKS.md: mở rộng TASK-01 thành 3 luồng khảo sát (stack / audit module
    StudyWrite / kiến trúc 3 chế độ) kèm file đầu ra; thêm TASK-12
    (Whiteboard Engine & Mode) và TASK-13 (Split Mode); TASK-11 cập nhật
    phụ thuộc và tham chiếu PRODUCT_SPEC mục 6.
  - CURRENT_STATE.md và PROJECT_INDEX.md: cập nhật trạng thái, docs
    version 1.1.
- **Kết quả kiểm tra:** Đối chiếu chéo ID (DEC-001→015, ISSUE-001→014,
  TASK-00→13) giữa các file — nhất quán; ISSUE-009 đúng trạng thái RESOLVED;
  3 chế độ có mặt trong PRODUCT_SPEC và ARCHITECTURE. Không tạo/sửa bất kỳ
  file mã nguồn nào.

### TASK-00 — 2026-10-30 — Khởi tạo hệ thống bộ nhớ dự án

- **File được tạo (10):** `docs/PROJECT_INDEX.md`, `docs/PROJECT_CONTEXT.md`,
  `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`,
  `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`,
  `docs/KNOWN_ISSUES.md`, `docs/AI_WORKFLOW.md`.
- **File được sửa:** Không có (dự án mới).
- **Nội dung:**
  - Kiểm tra trước khi tạo: chưa tồn tại dự án WebScribble; thư mục gốc dự án
    `~/workspace/webscribble/` được tạo mới chỉ để chứa `docs/`; không có
    package.json/framework nào thuộc dự án này; `~/workspace` không phải
    Git repo. Dự án HSA và file StudyWrite sẵn có không bị đụng tới.
  - Ghi nhận 12 quyết định nền tảng của chủ dự án vào DECISIONS.md
    (DEC-001 → DEC-012).
  - Đặc tả sản phẩm theo module vào PRODUCT_SPEC.md, có gắn nhãn
    ĐÃ THỐNG NHẤT / ĐỀ XUẤT / CHƯA XÁC MINH.
  - Kiến trúc đề xuất (5 lớp) + nguyên tắc tách Drawing Engine khỏi
    Document Engine vào ARCHITECTURE.md; stack ghi rõ là đề xuất chưa chốt.
  - Roadmap TASK-00 → TASK-11 vào TASKS.md; CURRENT_STATE.md ghi rõ ứng
    dụng chưa được lập trình.
  - Mở 11 issue ban đầu trong KNOWN_ISSUES.md (ISSUE-001 → ISSUE-011).
- **Kết quả kiểm tra:** Đủ 10 file; PROJECT_INDEX.md dưới 100 dòng; đối chiếu
  chéo ID task/quyết định/issue giữa các file — nhất quán (chi tiết trong báo
  cáo TASK-00). Không chạy kiểm thử code vì chưa có code.
