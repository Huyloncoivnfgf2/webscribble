# CURRENT_STATE — WebScribble

> Trạng thái hiện tại của dự án. Cập nhật sau mỗi task (xem AI_WORKFLOW.md).

## 1. Giai đoạn hiện tại

**Giai đoạn 1 — Xây dựng nền tảng: ĐANG DIỄN RA.** Giai đoạn 0 (bộ nhớ,
khảo sát, chốt kiến trúc TASK-00 → 02) đã xong. Khung dự án (TASK-03),
UI shell (TASK-04) đã hoàn thành. **TASK-05 (Drawing Engine) ĐÃ XONG
và đã commit `7aa608e` "feat: complete drawing engine"** — đủ 7 loại
object, kiểm thử tích hợp toàn diện (321 unit test) và kiểm chứng
Chromium headless (chuột + cảm ứng mô phỏng, DPR 1/2); chưa kiểm
chứng thiết bị thật/Safari (ISSUE-006). **TASK-08A (Storage
Foundation) ĐÃ XONG ngày 2026-10-31, chưa commit** — Dexie/IndexedDB
lưu file gốc + annotation theo surface, autosave, đo quota; tổng
348 unit test đạt và kiểm chứng IndexedDB thật qua reload trang.
Thứ tự roadmap đã đổi theo Q1 = B: 08A trước, rồi TASK-06 (PDF).

## 2. Task đang thực hiện

- **TASK-05** — Drawing Engine (IN_PROGRESS): đã xong pha 05A (Data
  Model & Surface Interface, 2026-10-31) gồm cả bổ sung nhóm phương
  thức update của DrawingSurface theo yêu cầu chủ dự án (61 unit test
  đạt). Ba đề xuất của 05A đã được phê duyệt thành DEC-024/025/026.
  **Pha 05B (Input Manager) cũng đã xong ngày 2026-10-31** —
  `src/engines/drawing/input.ts`, tổng 86 unit test đạt. **Pha 05C
  (Stroke Engine & Renderer) đã xong cùng ngày** — strokeBuilder +
  renderer (perfect-freehand) + canvasRenderer + DrawingEngine tích
  hợp, tổng 124 unit test đạt. **Pha 05D (Shape & Text Engine) đã
  xong cùng ngày** — shapeBuilder + text + renderer đủ 7 loại object,
  tổng 166 unit test đạt. **Pha 05E (Selection & Eraser) đã xong
  cùng ngày** — selection + eraser + sửa bounds bao phủ đầu mũi tên,
  tổng 240 unit test đạt. **Pha 05F (History Manager) đã xong cùng
  ngày** — history (Command Pattern) + insertObjectAt, tổng 273
  unit test đạt. **Pha 05G (Integration & Testing) đã xong cùng
  ngày** — 48 test tích hợp mới (tổng 321 đạt), sửa 1 bug thật
  (StrokeBuilder đánh rơi điểm nhả bút), benchmark ghi nhận theo
  môi trường, kiểm chứng Chromium headless 16/16. Phần duy nhất
  còn thiếu để khép TASK-05 là kiểm chứng thiết bị thật (ISSUE-006)
  — cần phần cứng ngoài môi trường hiện tại. **TASK-05 đã commit
  `7aa608e` ngày 2026-10-31 theo lệnh của chủ dự án.**
- **TASK-08A — Storage Foundation (DONE, 2026-10-31):** Data Layer
  tại `src/data/` — Dexie 4.4.7 (Apache-2.0), database `webscribble`
  schema v1; DocumentRepository, AnnotationRepository,
  StorageManager, AutosaveManager; 27 unit test mới (tổng 348 đạt)
  + kiểm chứng IndexedDB thật 8/8. Chưa commit.

## 3. Task đã hoàn thành

| Task | Tên | Ngày | Bằng chứng |
|---|---|---|---|
| TASK-00 | Khởi tạo hệ thống bộ nhớ dự án | 2026-10-30 | 10 file trong `docs/`, đã kiểm tra nhất quán — xem CHANGELOG.md |
| TASK-01 | Khảo sát & kiểm chứng công nghệ | 2026-10-30 | 3 file trong `docs/research/` (TECH_SURVEY, STUDYWRITE_MODULE_AUDIT, THREE_MODES_ARCHITECTURE_RESEARCH) — xem CHANGELOG.md |
| TASK-02 | Chốt kiến trúc & quyết định công nghệ | 2026-10-30 | DEC-016 → DEC-023 trong DECISIONS.md; ARCHITECTURE.md mục 1 bản chốt; PRODUCT_SPEC đồng bộ — xem CHANGELOG.md |
| TASK-03 | Khởi tạo khung dự án (project skeleton) | 2026-10-30 | `package.json` + `package-lock.json`, `src/**` theo ARCHITECTURE.md mục 3; build/lint/dev đã chạy thật đạt — xem CHANGELOG.md |
| TASK-04 | UI shell & responsive layout | 2026-10-30 | `src/app/**` (shell, 5 trang/khu vực, 3 chế độ ở mức UI); kiểm chứng headless browser 3 kích thước + tương tác, 0 lỗi console — xem CHANGELOG.md. Chưa commit |

Ngoài roadmap: ngày 2026-10-30 đã có một lượt **cập nhật bộ nhớ** theo yêu
cầu chủ dự án (không phải task roadmap, không đánh dấu DONE cho task nào):
ghi nhận DEC-013 (StudyWrite — phương án C), DEC-014 (3 chế độ làm việc),
DEC-015 (một Drawing Engine dùng chung); ISSUE-009 → RESOLVED; bổ sung
TASK-12 (Whiteboard) và TASK-13 (Split Mode) vào roadmap. Chi tiết ở
CHANGELOG.md.

## 4. Task tiếp theo (chưa bắt đầu — chờ yêu cầu)

- **TASK-06 — PDF Engine: HOÀN TẤT ngày 2026-10-31** (cả 6
  subtask 06A → 06F) —
  pdfjs-dist 6.4.299, worker local kiểm chứng cả dev lẫn
  production, loader đủ vòng đời + metadata + phân loại lỗi,
  geometry từ getViewport, renderer có DPR + hủy/thay thế render
  an toàn, Annotation Engine nối Drawing Engine với IndexedDB
  (khôi phục đủ 7 loại object, validation chặt, autosave),
  overlay ánh xạ tọa độ qua chính PageViewport và bám đúng nội
  dung PDF ở cả 4 rotation (Browser QA 50/50), PDF Viewer
  thật trong Document Mode (mở từ thư viện, điều hướng, zoom/
  fit, vẽ Pen/Highlight/Tẩy + undo/redo, lưu và khôi phục
  annotation qua reload), và vòng kiểm thử tích hợp 06F:
  một lỗi ghi đè khi đóng phiên chỉ-đọc đã sửa tại Annotation
  Engine, 456/456 test, Browser QA dev + production đều đạt,
  số đo hiệu năng tham khảo đã ghi (mở 200 trang ≈ 680 ms,
  chuyển trang ≈ 260 ms trên VM). Hậu kiểm TASK-06F-A cùng
  ngày: race condition của cơ chế dirty tracking (mutation
  tới trong lúc save đang bay bị đánh dấu nhầm là đã lưu ở
  chế độ lưu trực tiếp) đã tái hiện bằng test có kiểm soát
  và sửa bằng generation counter tại Annotation Engine —
  tổng 462/462 test. Rủi ro còn mở: hai tab
  cùng sửa một trang vẫn last-writer-wins (ISSUE-015).
  Theo roadmap gốc, kế tiếp là TASK-07 Word Engine; theo
  roadmap đã replan cho phần thư viện là TASK-08B (Library
  UI) → 08C — chờ chủ dự án giao task kế tiếp.
- **TASK-08B — Document Manager & Library UI: DONE ngày
  2026-10-31** — thư viện hoàn chỉnh trên nền 06E: hiển thị
  dung lượng file, đổi tên bền qua updateMetadata (không
  đụng Blob/annotation), xóa có xác nhận (cascade giữ
  nguyên), thứ tự gần đây theo updatedAt ở tầng UI; panel
  dung lượng + cảnh báo quota 80% + trạng thái lưu trữ bền
  từ StorageManager (phần UI của ISSUE-005 đã xong; issue
  vẫn OPEN ở phần đo thiết bị thật); RecentDocuments ở
  Trang chủ nối dữ liệu thật, nhấn để mở đúng tài liệu.
  475/475 test, Browser QA dev + production đạt toàn bộ.
  Chưa commit. Kế tiếp: TASK-08C (Whiteboard/Workspace/
  Backup) hoặc TASK-07 — chờ chủ dự án giao.
- **TASK-07-SCOPE — Word Engine Roadmap: DONE ngày 2026-10-31**
  (chỉ nghiên cứu + lập kế hoạch, không code): TASK-07 chia
  thành 07A–07F; hai quyết định được chủ dự án duyệt kèm
  brief 07A: Dexie schema v2 + bảng `documentContents`, và
  DOMPurify làm lớp sanitize.
- **TASK-07A — DOCX Import & Editable Content Model: DONE
  ngày 2026-10-31** — Word Engine tại `src/engines/word/`:
  đường nhập DOCX → Mammoth 1.13.0 (BSD-2-Clause) →
  **DOMPurify 3.4.17** (MPL-2.0 OR Apache-2.0) sanitize ngay
  tại biên (cấu hình ghi rõ trong `sanitize.ts`: cấm thêm
  iframe/form/svg/math/style-attr...) → HTML đã sạch →
  `htmlToContent` chuyển thành **mô hình nội dung JSON tương
  thích Tiptap** (`contentModel.ts`: doc/block/inline/marks,
  validation không ném lỗi; HTML chỉ là trung gian, không
  lưu làm dữ liệu sửa). Lỗi nhập phân loại (not-a-docx/
  legacy-doc/corrupt/conversion-failed/invalid-content/
  sanitizer-unavailable/persistence) kèm thông điệp thân
  thiện. **Dexie schema v2**: cộng thêm `documentContents`
  (khóa documentId; `contentVersion` = 1 tách bạch với
  schema Dexie; repository chặn đọc/ghi khi gặp version mới
  hơn — UnsupportedContentVersionError); migration v1→v2
  bảo toàn tài liệu/annotation/Blob (có test dựng DB v1);
  **xóa tài liệu cascade cả ba bảng** trong một transaction.
  Tích hợp thư viện: nhập DOCX = chuyển đổi TRƯỚC, lưu SAU
  (lỗi → không bản ghi nào; lưu nội dung lỗi → rollback xóa
  tài liệu); DocumentsPage nhận .docx, hiển thị nhãn DOCX,
  bấm vào DOCX hiện thông báo trung thực TASK-07B (chưa có
  editor, KHÔNG mở PDF Viewer cho DOCX). jsdom 30.1.3 (MIT,
  **chỉ dev/test**) để DOMPurify/DOMParser chạy trong Vitest;
  vitest alias `mammoth` → bản browser giống pdfjs trước đây
  (bản Node của Mammoth không nhận arrayBuffer). 21 test mới
  trong `tests/word/` (fixture DOCX sinh bằng ZIP writer tự
  viết: heading/đoạn đậm-nghiêng/danh sách/bảng/ảnh PNG;
  sanitize XSS gồm hyperlink javascript: TỪ CHÍNH FILE DOCX;
  migration; rollback). **Tổng 496/496 test (45 file)**,
  Browser QA dev + production 10/10 (kiểm cả record thật
  trong IndexedDB qua trình duyệt). Chưa commit. Kế tiếp:
  TASK-07B — chờ giao. Giới hạn DOCX còn nguyên: chưa
  editor/sửa/xuất; OMML bị Mammoth bỏ (ISSUE-004), ảnh
  WMF/EMF không chuyển được (ISSUE-003); fidelity nâng cao
  thuộc 07C.
- **TASK-07B — Tiptap Editor & Content Save/Restore: DONE
  ngày 2026-10-31** — cài @tiptap/react + starter-kit +
  extension-image + extension-table **3.32.2 (tất cả MIT)**;
  kiểm chứng StarterKit 3.x đã gồm sẵn Link + Underline (không
  đăng ký trùng) và extension-table xuất đủ Table/Row/Cell/
  Header từ một package. Ba file mới tại features/documents:
  `wordEditorExtensions.ts` (bộ extension DÙNG CHUNG giữa UI
  và test headless), `WordEditorController.ts` (framework-free:
  open() nạp + validate nội dung — thiếu record/rác/version
  mới hơn → WordEditorError rõ ràng, **không bịa nội dung thay
  thế**; autosave debounce 800 ms; **generation counter** theo
  đúng bài học 06F-A: snapshot chụp kèm generation, ghi xong
  chỉ nâng savedGeneration tới generation đã chụp, các lần ghi
  nối tiếp tuyệt đối nên ghi cũ không đè nội dung mới; lỗi giữ
  dirty + retry; flush/close lặp tới hết dirty và ném lỗi khi
  ghi hỏng), `WordEditor.tsx` (toolbar Đậm/Nghiêng/Gạch chân/
  Gạch ngang/H1–H3/Đoạn/List/Quote/Undo/Redo; nhãn Đang lưu/
  Chưa lưu/Đã lưu/Lưu thất bại-bấm-thử-lại qua
  useSyncExternalStore; nút Thư viện **chờ flush xong mới rời**,
  lỗi → ở lại + nút "Bỏ thay đổi và quay lại" tường minh;
  unmount bất ngờ → flush lần cuối). DocumentsPage: bấm DOCX
  mở WordEditor (key theo selectedId), nhập DOCX xong tự mở
  editor như PDF. CSS typography cho nội dung tại
  `src/styles/index.css` (.word-editor-content).
  **Bug thật đã tìm + sửa trong lúc QA:** cleanup unmount ban
  đầu gọi controller.close() — React StrictMode (dev)
  mount→cleanup→mount khiến controller bị đóng vĩnh viễn
  ngay lần mount giả, bản mount thật không bao giờ lưu được;
  sửa thành flush() trong cleanup (không đổi cờ đóng). QA
  được siết chặt tương ứng: bắt buộc THẤY trạng thái Chưa
  lưu xuất hiện trước khi chấp nhận Đã lưu.
  11 test mới (editor headless jsdom: nạp model 07A →
  getJSON vẫn qua validateWordContent; controller: race
  bằng deferred promise, debounce gộp 1 lần ghi, lỗi+retry,
  close chờ ghi; tích hợp repository thật: Blob gốc nguyên
  vẹn, lưu JSON không phải HTML). **Tổng 507/507 test
  (47 file)**; Browser QA dev + production **14/14** (mở/
  sửa/toolbar/autosave/reload khôi phục/đọc DB xác nhận
  JSON/đổi tên PDF hồi quy/mobile 390 không tràn). Chưa
  commit. Kế tiếp theo kế hoạch TASK-07-SCOPE: TASK-08C
  (Backup/Restore) — chờ giao.
- **TASK-08C — Backup & Restore toàn thư viện: DONE ngày
  2026-10-31** — quyết định định dạng ghi thành **DEC-027**.
  Module `src/data/backup/backup.ts`: archive ZIP qua
  **JSZip 3.10.2 (MIT OR GPL-3.0 — dùng theo MIT; cài trực
  tiếp thay vì dựa vào dependency truyền qua Mammoth)** gồm
  manifest.json (backupFormatVersion 1 độc lập, thời điểm,
  counts, **SHA-256 từng file thành phần** qua Web Crypto),
  data/annotations.json, data/contents.json (giữ JSON
  model, không HTML), files/<documentId> chứa Blob gốc
  nguyên byte; nén STORE. Restore hai giai đoạn:
  `inspectBackupArchive` kiểm chứng toàn bộ (định dạng/
  version/cấu trúc/surface nhất quán/không mồ côi/checksum/
  counts khớp) — sai bất cứ điểm nào là từ chối TRƯỚC khi
  ghi; `executeRestore` tính remap tại thời điểm ghi và
  ghi cả ba bảng trong **MỘT transaction** (lỗi/quota →
  hủy toàn bộ, thư viện nguyên vẹn) + kiểm chứng sau ghi.
  Chính sách duy nhất: **merge an toàn** — trùng ID → bản
  sao ID mới, remap nhất quán annotation (documentId +
  surfaceId) và contents; KHÔNG có chế độ thay thế/xóa.
  UI: `BackupPanel.tsx` trong thư viện (tạo + tải xuống;
  khôi phục qua các bước kiểm tra → tóm tắt gồm số trùng
  ID → xác nhận → kết quả; lỗi hiển thị userMessage phân
  loại). 12 test mới (`tests/backup/`): byte-for-byte,
  restore DB rỗng, collision remap không mồ côi, 6 tình
  huống từ chối (rác/không manifest/version 99/sửa 1 byte
  blob/counts sai/annotation mồ côi/contentVersion 99),
  rollback bằng stub bulkPut, quota. **Tổng 519/519 test
  (48 file)**; Browser QA dev + production **17/17** (vẽ
  annotation thật → backup tải file thật → context MỚI
  khôi phục đủ PDF/annotation/DOCX-đã-sửa → context gốc
  khôi phục trùng thành 4 tài liệu → file rác bị từ
  chối). Giới hạn ghi nhận: JSZip vật chất hóa toàn bộ
  archive trong bộ nhớ khi tạo — thư viện cực lớn (nhiều
  GB) có rủi ro RAM, chấp nhận cho phạm vi hiện tại;
  Safari/iOS thật vẫn chưa kiểm chứng. Chưa commit. Kế
  tiếp theo kế hoạch: TASK-07C (Word fidelity) — chờ giao.
- **TASK-07C — DOCX Fidelity & Import Quality: DONE
  ngày 2026-10-31** — quyết định ghi thành **DEC-028**.
  Audit TRƯỚC khi sửa bằng fixture DOCX giàu định dạng
  (`buildRichDocx`) + đọc source Mammoth: đo được sup/
  sub bị converter làm trong suốt; căn lề/cỡ chữ/
  highlight/font bị Mammoth đọc nhưng không xuất HTML;
  màu chữ Mammoth KHÔNG đọc (w:color vắng mặt trong
  body-reader); colspan bị converter bỏ qua; danh sách
  lồng + hàng tiêu đề bảng vốn đã ĐÚNG. Đã hỗ trợ:
  (1) marks **superscript/subscript**; (2) **textStyle**
  (fontSize/highlight→backgroundColor/fontFamily) qua
  kênh transformDocument hai lượt + style map động —
  định dạng đi cùng run, không đối chiếu vị trí; đánh
  đổi ghi nhận: run vừa có character style vừa có cỡ
  chữ/highlight/font trực tiếp thì mapping của character
  style đó nhường cho định dạng trực tiếp; (3) **căn lề
  đoạn** (jc), **kích thước ảnh** (wp:extent → px),
  **nền ô bảng** (w:shd) qua luồng document.xml có
  guard số lượng từng luồng — lệch là bỏ qua cả luồng
  (đã kiểm chứng với bảng vMerge: rowspan 2 được giữ,
  nền không bị gán nhầm); (4) **colspan/rowspan** từ
  HTML của Mammoth. Content Model lên **version 2**
  tương thích ngược (validator coi null của Tiptap là
  vắng mặt); KHÔNG đổi schema Dexie; bản ghi version 1
  mở bình thường, lưu lại thành version 2; backup chứa
  nội dung v1 vẫn khôi phục được. Editor: thêm
  TextStyle/Color/BackgroundColor/FontSize/FontFamily,
  Superscript, Subscript, TextAlign (4 extension MIT
  3.32.2: text-style, superscript, subscript, text-align),
  Image có width/height, ô bảng có background, toolbar
  thêm nút chỉ số trên/dưới + 4 nút căn lề — không có
  các extension này định dạng sẽ bị editor loại bỏ khi
  nạp. Hoãn có lý do: màu chữ, thụt lề, khoảng cách
  đoạn/dòng, border tùy biến. 12 test mới (11 fidelity
  + 1 backup tương thích) — **tổng 531/531 (49 file)**;
  hai assertion version-1 cứng trong test 07A được đổi
  sang hằng số DOCUMENT_CONTENT_VERSION (đúng ngữ nghĩa
  "mặc định = version hiện tại"). Browser QA dev +
  production **24/24**: mọi định dạng hiển thị thật
  trong editor (style text-align/font-size/background
  trên DOM), sửa + reload giữ nguyên, PDF không hồi
  quy, mobile 390 không tràn. Chưa commit. Kế tiếp
  theo kế hoạch: TASK-07D (annotation cho DOCX) —
  chờ giao.
- **TASK-07D — DOCX Annotation: DONE ngày 2026-10-31**
  — mô hình ghi thành **DEC-029**. `DocxAnnotation
  Controller.ts` (framework-free): mở phiên Annotation
  Engine trên surface `document:<id>:0`, gắn Drawing
  Engine dùng chung (DEC-015) lên canvas phủ kín thẻ
  trang editor; world = không gian nội dung CSS px,
  camera cố định {0,0,1}, pageSize danh nghĩa
  10000×1000000 (metadata, không cắt nét). Hai chế độ:
  Sửa văn bản (canvas pointer-events none, editor
  editable) ↔ Chú thích (canvas nhận pointer, editor
  khóa sửa qua setEditable(false)); công cụ Bút/
  Highlight/Tẩy nét + bảng màu riêng từng tool + cỡ
  nét S/M/L + undo/redo + trạng thái lưu chú thích
  (mẫu save-watch của PdfViewerController). Vòng đời:
  controller sống trong registry theo documentId ở
  WordEditor (qua được StrictMode/remount — engine
  gắn lại lên canvas mới, phiên không đóng/mở lại);
  unmount chỉ flush; nút Thư viện chờ đóng CẢ nội
  dung lẫn chú thích mới cho rời (dùng chung banner
  leaveFailed). Giới hạn DEC-029 hiển thị ngay trong
  thanh chú thích: nét neo tọa độ tuyệt đối, không
  bám theo chữ khi sửa nội dung/xuống dòng lại.
  6 test mới (vẽ qua pointer events giả lên FakeCanvas
  Element: record đúng surfaceId + tọa độ world khôi
  phục qua controller mới, tool/màu/cỡ phản ánh vào
  style của nét, undo/redo + flush về rỗng, tách biệt
  hai tài liệu, remount gắn canvas mới). **Tổng
  537/537 (50 file)**; Browser QA dev + production
  **19/19**: cuộn trang canvas và nội dung dời đúng
  bằng nhau (Δ=300px), resize vẽ lại đúng tọa độ,
  undo/redo trên canvas thật, đóng/mở lại khôi phục
  nét tại đúng vị trí, PDF không hồi quy, mobile 390
  không tràn. Chưa commit. Kế tiếp theo kế hoạch:
  TASK-07E (xuất DOCX) — chờ giao.
- **TASK-07E — DOCX Export: DONE ngày 2026-10-31** —
  quyết định ghi thành **DEC-030**. Cài **docx 9.15.0**
  (MIT). `src/engines/word/exportDocx.ts`: Content
  Model → DOCX qua ánh xạ trực tiếp (không HTML) —
  heading/căn lề, danh sách lồng nhau (mỗi danh sách
  số một numbering reference riêng, bắt đầu lại từ
  1), bảng (header/nền ô/colspan/rowspan), marks đầy
  đủ của v2, textStyle (cỡ chữ pt/px → half-points,
  font, màu chữ; highlight khớp bảng Word →
  w:highlight, lệch bảng → shading của run), ảnh
  data URI (kích thước từ attrs, thiếu thì đọc header
  PNG), quote/code/hardBreak/link. Tên file
  `<gốc>_edited.docx` làm sạch ký tự cấm + sửa được
  trong dialog. Dialog "Xuất bản" trong WordEditor:
  cảnh báo DEC-018 + khẳng định file gốc không đổi,
  tải DOCX (chỉ nội dung) hoặc **In / Lưu PDF kèm chú
  thích** qua hộp thoại in của trình duyệt
  (`printExport.ts` + CSS `@media print`: chỉ thẻ
  trang được in, canvas sống thay bằng ảnh chụp
  bitmap đầy đủ độ phân giải); sinh PDF bằng code vẫn
  thuộc TASK-09. Round-trip phát hiện và đã sửa một
  lỗi importer: `<w:tblHeader w:val="off"/>` bị
  Mammoth hiểu thành hàng tiêu đề — importer gỡ các
  phần tử bị tắt trước khi chuyển đổi. 12 test mới,
  **tổng 549/549 (51 file)**; Browser QA dev +
  production **15/15** (tải file thật 10,9 KB, mở lại
  file xuất trong chính app giữ căn giữa + bảng,
  trạng thái chuẩn bị in + PDF in 31 KB chứa ảnh chú
  thích 766×775 theo pdfimages). Đối soát độc lập:
  **LibreOffice mở file xuất thành công**, chuyển
  PDF đọc được đủ nội dung + danh sách lồng đúng ký
  hiệu cấp. Chưa commit. Kế tiếp theo kế hoạch:
  TASK-07F (tích hợp Document Manager & kiểm thử
  tổng thể) — chờ giao.
- Việc chờ chủ dự án ngoài roadmap: duyệt **commit TASK-08A** và quyết
  định hosting/remote (phần còn lại của ISSUE-008); kiểm chứng thiết
  bị thật cho ISSUE-006 khi có phần cứng.

## 5. Công nghệ đã xác minh

- **Đã chốt tại DEC-016 (TASK-02)** và **đã cài đặt thực tế tại TASK-03**
  (phiên bản + giấy phép đọc từ chính các gói đã cài): react/react-dom
  19.3.1 (MIT), vite 8.3.5 (MIT), @vitejs/plugin-react 6.1.2 (MIT),
  tailwindcss + @tailwindcss/vite 4.3.3 (MIT), eslint 10.14.0 +
  typescript-eslint 8.72.1 (MIT), **typescript 5.9.3** (Apache-2.0) —
  chốt 5.9.x thay vì 7.0.2 vì typescript-eslint chưa hỗ trợ TS 7 trong
  peer range (đã báo cáo ở TASK-03). **perfect-freehand 1.2.3 (MIT)
  đã cài tại TASK-05C** theo DEC-016 (đọc giấy phép từ gói đã cài).
  Chưa cài các thư viện theo tính năng còn lại (PDF.js, pdf-lib,
  Tiptap, Mammoth, Dexie, Zustand, thư viện `docx`) — cài ở task
  triển khai tương ứng.

## 6. Vấn đề đang tồn tại

Xem KNOWN_ISSUES.md. Tóm tắt sau TASK-02:

- **Đã RESOLVED:** ISSUE-001 (stack — DEC-016), ISSUE-002 (mất định dạng
  DOCX — DEC-018), ISSUE-007 (phạm vi PDF — DEC-017), ISSUE-009 (StudyWrite
  — DEC-013), ISSUE-010 (xuất DOCX — DEC-018), ISSUE-012 (Infinite Canvas
  trì hoãn có điều kiện — DEC-019), ISSUE-013 (mô hình Split — DEC-020).
- **Còn OPEN:**
  - ISSUE-003/004: WMF/EMF chưa có lời giải hiển thị; OMML bao phủ một
    phần (có module tái sử dụng từ StudyWrite — Luồng B).
  - ISSUE-005: đo quota IndexedDB thực tế (TASK-08); DEC-022 đã giảm rủi
    ro mất dữ liệu bằng sao lưu bắt buộc.
  - ISSUE-006: hành vi stylus/pressure lệch nhau giữa trình duyệt; trạng
    thái `getCoalescedEvents` trên Safari còn mâu thuẫn nguồn — kiểm
    chứng bằng thiết bị thật ở TASK-05.
  - ISSUE-008: Git local đã có 3 commit (`ce0a68f`, `b4aa4ae`,
    `7aa608e` — TASK-05); chỉ còn quyết định hosting/remote.
  - ISSUE-011: chiến lược cache tài nguyên lớn cho offline — TASK-10.
  - ISSUE-014 (đã thu hẹp): chỉ còn bố trí Split Mode trên mobile và ngữ
    nghĩa GIF làm nền tài liệu; xuất Split (DEC-021) và HEIC (DEC-023)
    đã quyết.
- **TASK-07F — Word Integration & Testing: DONE ngày
  2026-10-31 — MODULE 07 (Word Engine) HOÀN THÀNH.**
  Bổ sung cuối: kéo-thả nhập một/nhiều file PDF/DOCX
  thẳng vào trang thư viện (overlay "Thả file để nhập"
  khi kéo lơ lửng, đếm độ sâu dragenter/dragleave để
  không nhấp nháy, listener cấp cửa sổ chặn trình duyệt
  tự mở file khi thả trượt — chỉ gắn lúc trang thư viện
  hiển thị; nút chọn file nay cũng chọn được nhiều
  file; cả hai đường dùng chung một hàm nhập, file lỗi
  không chặn các file còn lại). Thẻ thư viện đối chiếu
  lại: nhãn DOCX/PDF + kích thước + ngày sửa + số trang
  đã đủ từ TASK-08B. Bộ test tích hợp mới
  `tests/word/wordLifecycle.test.ts` (5 test): vòng đời
  trọn vẹn trên hạ tầng thật — import (Blob gốc khớp
  từng byte) → sửa + autosave → chú thích → đóng/mở
  lại bằng controller mới → xuất → backup → khôi phục
  vào database sạch (đủ 3 lớp: Blob/model v2/nét vẽ,
  counts khớp) → khôi phục trùng ID được remap đúng
  quan hệ; đua autosave với lần ghi bị chặn (bản mới
  nhất thắng); ranh giới DOCX rỗng/1500 đoạn/Unicode
  đầy đủ. **Tổng 554/554 (52 file)**; Browser QA dev +
  production **12/12**: kéo-thả 2 file cùng lúc (DOCX +
  PDF, mở file cuối), 3 vòng mở/đóng DOCX giữ nguyên
  nét vẽ (không rò phiên), backup → xóa → khôi phục
  ngay trong trình duyệt rồi mở lại đủ nội dung + nét.
  Tài liệu: **ISSUE-016** ghi giới hạn annotation DOCX
  không bám chữ (đúng tiêu chí nghiệm thu TASK-07);
  ISSUE-010 bổ sung bằng chứng đóng vòng. Rà dọn:
  không còn console debug/probe trong src. Chưa
  commit. Việc tiếp theo theo roadmap: TASK-12
  (Whiteboard) hoặc TASK-09 (Export Engine — PDF
  flatten) tùy user giao; TASK-10 (PWA) vẫn xếp sau.
- **TASK-12 — Whiteboard Engine & Standalone Mode:
  DONE ngày 2026-10-31 (DEC-031).** Bảng trắng là một
  tài liệu thư viện (mime
  `application/vnd.webscribble.whiteboard`) — manifest
  JSON trong Blob của chính tài liệu (trang cố định
  1600×1000 theo DEC-019, nền từng trang: trơn trắng/
  tối/kẻ ngang/lưới caro/chấm), `pageCount` đồng bộ
  để thẻ thư viện hiện số trang. Nét vẽ đi qua
  Annotation Engine dùng chung (DEC-015) trên surface
  `document:<id>:<trang>` — backup/restore/remap/xóa
  cascade của TASK-08C áp dụng nguyên vẹn, không đổi
  định dạng backup. WhiteboardStore lo manifest +
  thao tác trang: thêm/xóa (cấm xóa trang cuối)/đổi
  thứ tự bằng remap staging hai pha kèm viết lại
  `surfaceId` trong từng DrawingObject (lỗi
  invalid-data đã tái hiện qua test trước khi sửa —
  có test regression ở mức controller với nét vẽ
  thật). WhiteboardController (framework-free, khuôn
  PdfViewer): phiên vẽ riêng từng trang, chuyển trang
  flush trước, zoom/vừa màn hình, undo/redo theo
  phiên trang. WhiteboardPage của shell thay
  placeholder TASK-04: danh sách/tạo/mở/xóa;
  WhiteboardView có toolbar vẽ + thanh trang + chọn
  nền (từng trang hoặc áp mọi trang); trang Thư viện
  cũng tạo và mở được bảng trắng (nhãn "Bảng trắng",
  icon riêng). **563/563 test (53 file)**; Browser
  QA dev + production **20/20**. Chưa commit. Việc
  còn trên roadmap: TASK-13 (Split Mode), TASK-09
  (Export Engine), TASK-10 (PWA) — chờ user giao.
- **TASK-13 — Split Mode: DONE ngày 2026-10-31
  (DEC-032).** Workspace "Chế độ Split" (mục mới ở
  thanh điều hướng): pane trái tài liệu — PDF qua
  `SplitPdfPane` dùng thẳng PdfViewerController,
  DOCX qua WordEditor nhúng (prop `embedded` mới,
  ẩn nút quay lại); pane phải bảng trắng qua
  WhiteboardView nhúng. Phối hợp bằng
  `SplitController` + `DrawingPaneAdapter` (mới,
  framework-free): thanh công cụ vẽ chung route
  tool/màu/cỡ nét/undo/redo CHỈ tới pane active
  (vòng sáng + nhãn "Đang hoạt động"); mỗi pane giữ
  nguyên controller gốc nên dữ liệu/autosave/undo
  độc lập tuyệt đối (DEC-015/020). Khả năng theo
  pane: PDF không có màu/cỡ nét (style mặc định —
  router khóa), DOCX tự bật chế độ Chú thích khi
  chọn công cụ từ thanh chung. Resizer kéo tay
  (0.15–0.85) + mốc 30/70, 50/50, 70/30 + thu gọn
  từng pane; <768px dạng tab, hai pane giữ mounted.
  Vết liên kết phiên (cặp tài liệu–bảng trắng, tỉ
  lệ, pane active) ở localStorage
  `webscribble:split-session:v1` — mở lại app khôi
  phục đúng phiên; không thuộc backup vì là trạng
  thái thiết bị. Điểm vào: thanh điều hướng, nút
  Split trên thẻ thư viện và thẻ bảng trắng, bộ
  chọn trong workspace; liên kết sai vai được tự
  sửa. **569/569 test (54 file)**; Browser QA dev +
  production **19/19**. Chưa commit. Roadmap còn:
  TASK-09 (Export Engine) và TASK-10 (PWA) — chờ
  user giao.
- **TASK-09 — Export Engine (PDF Flattening):
  DONE ngày 2026-10-31 (DEC-033).** Engine
  `src/engines/pdf/exportPdf.ts` dùng pdf-lib
  1.17.1: làm phẳng annotation lên bản sao trong
  RAM của PDF gốc (file gốc không bao giờ bị ghi
  đè, DEC-005). Chế độ vector: outline
  perfect-freehand (cùng `strokeOutlinePoints`
  của renderer) → drawSvgPath; hình khối →
  primitive; chữ → Helvetica (ký tự ngoài WinAnsi
  bị bỏ kèm cảnh báo — dùng raster để giữ chữ
  tiếng Việt). Chế độ raster: `drawObject` của
  Drawing Engine ở 3× → PNG phủ trang. Ánh xạ
  world → PDF user space qua convertToPdfPoint
  của viewport + offset CropBox — kiểm chứng
  bằng số đo content stream (outline đúng vùng
  world ± bán kính nét; rectangle khớp tịnh
  tiến/kích thước) và bằng render lại file xuất
  trong chính app ở Browser QA. Phạm vi: tất cả
  trang / chỉ trang có chú thích. UI:
  PdfExportDialog (tiến trình theo trang) gắn ở
  PdfViewer và Split Mode, kèm tùy chọn tải bản
  gốc sạch. **576/576 test (55 file)**; Browser
  QA dev + production **11/11**. Chưa commit.
  Roadmap chính chỉ còn TASK-10 (PWA/Offline) —
  chờ user giao.
- **TASK-10 — PWA & Offline: DONE ngày
  2026-10-31 (DEC-034) — ROADMAP MVP HOÀN
  THÀNH.** Manifest tĩnh + icons PNG tự sinh
  (script Node thuần). Service Worker tự sinh
  ở bước build (`scripts/generate-sw.mjs`):
  quét toàn bộ dist, version = hash nội dung,
  pre-cache 13 URL gồm PDF.js worker; điều
  hướng → index.html từ cache, assets
  cache-first, mọi match dùng ignoreVary
  (bài học `Vary: Origin`); bản cập nhật chờ
  người dùng bấm (banner + SKIP_WAITING).
  `PwaStatus`: cài đặt qua beforeinstallprompt,
  huy hiệu ngoại tuyến. `src/pwa/` helpers
  framework-free có test fake đầy đủ.
  **587/587 test (56 file)**; Browser QA
  production **11/11** gồm chu trình offline
  trọn vẹn và chu trình cập nhật trọn vẹn.
  ISSUE-011 RESOLVED. Chưa commit — toàn bộ
  cây làm việc từ TASK-08A tới TASK-10 (85
  mục) đang chờ quyết định commit của user,
  cùng quyết định hosting/remote (phần còn
  lại của ISSUE-008) và kiểm chứng thiết bị
  thật (ISSUE-006) khi có phần cứng.

## PHÁT HÀNH MVP v1.0.0 — 2026-10-31
- Toàn bộ roadmap TASK-00 → TASK-13 đã hoàn
  thành và đóng gói. Phiên bản sản phẩm trong
  `package.json` = 1.0.0; tài liệu đồng bộ ở
  docs v1.34.
- Việc còn mở sau phát hành (không chặn MVP):
  vòng nghiệm thu thiết bị thật cho TASK-11
  (ISSUE-006), quyết định hosting/remote
  (phần hosting của ISSUE-008; remote GitHub
  `Huyloncoivnfgf2/webscribble` đã đẩy xong
  2026-10-31), và các issue đã biết 003/004/
  005/014/015/016 theo KNOWN_ISSUES.md.

- **Triển khai GitHub Pages: 2026-10-31.** Bản web
  chạy tại https://Huyloncoivnfgf2.github.io/
  webscribble/ qua workflow Actions
  `.github/workflows/deploy-pages.yml` (push main →
  npm ci → build → deploy). App chuyển sang base
  `/webscribble/` (biến WS_BASE, mặc định trỏ Pages;
  đặt `/` khi chạy gốc domain): vite base, manifest
  dùng start_url/scope/icon tương đối, SW lấy
  index theo scope của chính nó, đăng ký SW theo
  BASE_URL. ISSUE-008 RESOLVED.

- **TASK-14A — Tự cuộn khi viết: DONE ngày 2026-11-01** (đợt nâng cấp
  TASK-14 do chủ dự án giao). `src/engines/drawing/autoScroll.ts` mới:
  hàm thuần tính vận tốc cuộn (mép dưới/phải, vùng đệm 48px, tối đa
  600px/giây) + controller vòng rAF + attach có cổng công cụ (chỉ
  pen/highlighter) + pointermove tổng hợp nối dài nét khi con trỏ đứng
  yên. Gắn vào PdfViewer và WhiteboardView (gồm bản nhúng Split);
  không sửa engine/input/tọa độ. **610/610 test (57 file)**, lint 0
  lỗi, build đạt; Browser QA production 10/10 trên Chromium headless
  (scrollTop tăng dần khi giữ bút ở mép, nét nối dài thật, tẩy không
  cuộn). Chưa kiểm chứng: bút/stylus thật và Safari (ISSUE-006).
  Kế tiếp: TASK-14B (gesture hai ngón) theo brief.

- **TASK-14B — Gesture hai ngón pan/zoom: DONE ngày 2026-11-01.**
  Input Manager theo dõi pointer thứ hai (chỉ kích hoạt khi cả hai
  là touch — chốt an toàn lòng bàn tay cho stylus), phát sự kiện
  pinch start/update/end; DrawingEngine hủy thao tác đang tạo dở
  ngay khi gesture bắt đầu (`abandonInProgress`) và chuyển tiếp
  qua `onPinchGesture`; `pinchCamera` thuần ở coordinates.
  Whiteboard pinch trực tiếp (scale + neo scroll); PDF pan trực
  tiếp + zoom chốt khi nhấc tay tại điểm neo. **621/621 test
  (58 file)**, lint 0 lỗi, build đạt; Browser QA CDP touch 9/9.
  Chưa kiểm chứng thiết bị thật/Safari (ISSUE-006). Kế tiếp:
  TASK-14C (nền dùng chung) theo brief.

- **TASK-14C — Nền giấy dùng chung: DONE ngày 2026-11-01.**
  DEC-035: một mô hình `PaperBackground` 10 loại (trắng, bảng
  đen, kẻ dòng 3 khoảng cách, ô vuông, lưới chấm, chấm, caro,
  kẻ toán, kẻ nhạc, ảnh tải lên) dùng chung qua
  `paperBackgroundStyle` + `BackgroundPicker`; Dexie v3 cộng
  thêm bảng nền theo tài liệu + ảnh nền khóa suy dẫn; manifest
  whiteboard giữ v1 tương thích hai chiều; backup format v1
  mở rộng tùy chọn mang theo nền/ảnh. **639/639 test (59
  file)**, lint 0 lỗi, build đạt; Browser QA production 18/18
  (gồm ảnh giả bị từ chối, reload giữ nền, PDF nền dưới
  trang, DOCX bảng đen). Chưa kiểm chứng thiết bị thật/Safari
  (ISSUE-006). Kế tiếp: TASK-14D (kiểu bút + preset).

- **TASK-14D — Nhiều kiểu bút + preset: DONE ngày 2026-11-01 —
  ĐỢT TASK-14 HOÀN THÀNH (14A-14D).** DEC-036: hồ sơ bút
  `STROKE_PROFILES` trong Drawing Engine, 8 loại nét (pen,
  highlighter, chì, bi, dạ, nét mảnh, nét dày, màu nước),
  cảm giác suy ra lúc vẽ từ `type` — dữ liệu nét cũ không
  đổi, outline pen/highlighter khóa bằng test so điểm với
  tham số gốc; màu nước tô chồng 3 lớp; preset bút (loại +
  màu + cỡ, tối đa 12) là sở thích thiết bị ở localStorage,
  không vào backup. **660/660 test (61 file)**, lint 0 lỗi,
  build đạt; Browser QA production 12/12. Cả bốn commit
  TASK-14A-D đang ở local, CHƯA push (web Pages trực tuyến
  chưa có TASK-14). Chưa kiểm chứng: cảm giác bút/stylus
  thật và Safari (ISSUE-006).
