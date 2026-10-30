# STUDYWRITE_MODULE_AUDIT — Đánh giá module StudyWrite (Luồng B, TASK-01)

> Ngày kiểm tra: 2026-10-30. Phương pháp: **chỉ đọc** trực tiếp file
> `~/workspace/user/files/StudyWrite___Milestone_4__fix__nh_DOCX.html`
> (1.739 dòng, 81.855 byte). Không sửa, không đổi tên, không di chuyển,
> không sao chép mã nguồn vào tài liệu này.
> Nhãn độ tin cậy: **VERIFIED** (có bằng chứng trực tiếp) · **PARTIALLY
> VERIFIED** (có bằng chứng một phần) · **UNVERIFIED** (chưa đủ thông tin) ·
> **BLOCKED** (không thể thực hiện).
> Phân loại tái sử dụng (theo DEC-013): USE / USE AFTER REFACTOR /
> DO NOT USE / UNVERIFIED.

## 1. Sự thật về file (VERIFIED — kiểm tra trực tiếp)

- Một file HTML duy nhất; toàn bộ mã ứng dụng nằm trong **một khối
  `<script>` inline** (dòng 309–1737, ~1.428 dòng). Không có package.json,
  lockfile, LICENSE hay NOTICE đi kèm; không có header bản quyền cho mã
  ứng dụng trong file.
- Thư viện ngoài **không nhúng trong file** — nạp qua CDN cdnjs:

  | Thư viện | Phiên bản | Cách nạp | Giấy phép |
  |---|---|---|---|
  | Mammoth | 1.6.0 | Nạp ngay (defer) | BSD-2-Clause (npm registry, kiểm tra 2026-10-30) |
  | JSZip | 3.10.1 | Nạp ngay (defer) | **Dual MIT / GPLv3** — khi dùng phải chọn nhánh MIT và ghi rõ (tài liệu chính thức JSZip) |
  | jsPDF | 2.5.1 | Nạp lười khi xuất file | MIT (npm registry) |
  | html2canvas | 1.4.1 | Nạp lười khi xuất file | MIT (npm registry) |
  | docx | 8.5.0 | Nạp lười khi xuất file | MIT (npm registry) |

- Hệ quả cho WebScribble: mô hình nạp CDN của StudyWrite **trái với yêu cầu
  offline/PWA** (DEC-007) — mọi thư viện được tái sử dụng phải chuyển sang
  đóng gói npm/bundler. Đây là nhận định VERIFIED từ cấu trúc file.

## 2. Nguồn gốc mã ứng dụng (PARTIALLY VERIFIED)

- Người dùng xác nhận (2026-10-30): *"StudyWrite chủ yếu do người dùng tự
  phát triển, có sử dụng thư viện hoặc một số mã từ bên ngoài, chưa có danh
  sách chi tiết."*
- Bằng chứng trong file nhất quán với tuyên bố trên: comment tiếng Việt
  xuyên suốt, thẻ mốc tự đặt (`[B5]`, `[B6]`, `[PEN-FIX]`, `[DOCX-PRE]`),
  định dạng dự án tự định nghĩa `.swp.json`; phần mã ngoài xác định được
  đúng là 5 thư viện CDN ở mục 1 — không tìm thấy khối mã thư viện nào bị
  sao chép vào trong file.
- Giới hạn: file không có lịch sử Git, nên **không thể xác minh độc lập
  từng dòng mã**; nếu tồn tại đoạn mã bên ngoài chưa khai báo ngoài 5 thư
  viện trên thì thuộc diện UNVERIFIED. Kết luận quyền sử dụng cho mã ứng
  dụng: **dựa trên tuyên bố của chủ dự án + bằng chứng gián tiếp nhất
  quán**, đủ cơ sở để tái sử dụng theo DEC-013 nhưng phải giữ lưu ý này.

## 3. Bảng tổng hợp module

| # | Module | Vị trí (dòng) | Dependency | Chất lượng | Quyền/nguồn gốc | Khả năng tách | Kết luận |
|---|---|---|---|---|---|---|---|
| B1 | Tiền xử lý DOCX `preprocessDocumentXml` | 1066–1186 | JSZip | Khá | User (mục 2) | Cao | **USE AFTER REFACTOR** |
| B2 | Chuyển OMML → MathML | 924–1022 | Không (DOM thuần) | Khá | User (mục 2) | Rất cao | **USE AFTER REFACTOR** |
| B3 | Xử lý ảnh: `isWebImage`, chip WMF, `pictureHtml`, `sniffType` | 1038–1065 + trong 1187+ | Không | Tốt (nhỏ, phòng thủ) | User (mục 2) | Rất cao | **USE** |
| B4 | Đường nhập DOCX `openDocx` + `convertImage` | 1187–~1330 | Mammoth, JSZip | Khá | User (mục 2) | Trung bình | **USE AFTER REFACTOR** |
| B5 | Hệ bút vẽ canvas (2 lớp, commit stroke, tẩy theo stroke, undo/redo) | 696–915 | Không | Khá (thiếu coalesced events) | User (mục 2) | Thấp (gắn chặt state/slot) | **USE AFTER REFACTOR (lớn) — dùng làm bản tham chiếu thiết kế** |
| B6 | Phân trang ảo + render theo slot | 435–630 | Không | Khá trong mô hình của nó | User (mục 2) | Thấp | **DO NOT USE** (chỉ tham khảo khái niệm) |
| B7 | Zoom + thước đo canvas | 631–694 | Không | Tốt (nhỏ) | User (mục 2) | Trung bình | **USE AFTER REFACTOR (nhỏ)** |
| B8 | Xuất PDF (html2canvas + jsPDF) | 1345–1403 | jsPDF, html2canvas | Trung bình (raster) | User (mục 2) | Trung bình | **DO NOT USE** cho lõi WebScribble |
| B9 | Xuất DOCX (bộ serialize HTML → docx) | 1413–1523 | docx (lib) | Khá, giới hạn tự ghi rõ | User (mục 2) | Trung bình | **USE AFTER REFACTOR** |
| B10 | Lưu/nạp dự án `.swp.json` | ~1330–1344 | Không | Trung bình | User (mục 2) | — | **DO NOT USE** (thay bằng mô hình IndexedDB) |
| B11 | UI shell + tiện ích (toast, dialog, `loadSrc` nạp CDN động) | 348–433, phần DOM còn lại | Không | Trung bình | User (mục 2) | Thấp | **DO NOT USE** |
| — | Module "Annotation" độc lập (ghi chú dạng đối tượng riêng) | **Không tồn tại** | — | — | — | — | Không đánh giá (chú thích trong StudyWrite chính là nét vẽ + sửa chữ trong trang) |
| — | Module chuyển đổi WMF/EMF → ảnh hiển thị | **Không tồn tại** | — | — | — | — | Chỉ có chip cảnh báo (B3); chuyển đổi thật vẫn là khoảng trống (ISSUE-003) |

## 4. Chi tiết theo module (bằng chứng và lý do)

### B1 — `preprocessDocumentXml` → USE AFTER REFACTOR
- Làm gì: mở DOCX bằng JSZip, đọc `word/document.xml` + `word/_rels/
  document.xml.rels`; thay mỗi `m:oMath`/`m:oMathPara` bằng token
  `[[MATHxxxx]]` kèm MathML đã chuyển (B2); gom ảnh VML (`v:imagedata`
  trong `w:r`) thành token `[[IMGxxxx]]`; sau khi Mammoth chạy xong thì
  chèn MathML/ảnh trở lại đúng vị trí trong dòng.
- Chất lượng: đã kiểm chứng end-to-end ở phiên 2026-10-15 bằng DOCX tổng
  hợp chạy qua jsdom + JSZip + Mammoth thật: MathML inline/block đúng chỗ,
  PNG hiện thật, chip WMF nằm inline, không sót token → **PARTIALLY
  VERIFIED** (chưa thử trên kho tài liệu thật đa dạng).
- Tách module: hàm async tự chứa, đầu vào ArrayBuffer → đầu ra
  `{buf, mathMLs, pictures}`; phụ thuộc duy nhất JSZip + DOMParser. Khi
  chuyển sang: viết lại TypeScript, giữ nguyên thiết kế token, bổ sung
  test bằng DOCX thật.

### B2 — OMML → MathML → USE AFTER REFACTOR
- Phạm vi (~100 dòng, hàm đệ quy thuần trên XML DOM): phân số `f`, mũ
  `sSup`, chỉ số dưới `sSub`, `sSubSup`, `sPre` (qua `mmultiscripts`), hàm
  `func`, căn `rad`, ngoặc `d`, toán tử lớn `nary`, thanh `bar`,
  `limLow`/`limUpp`.
- Chất lượng: đã test logic bằng mẫu DOM giả (phân số/mũ/căn đạt) ở phiên
  2026-10-15 → **PARTIALLY VERIFIED**. Chưa bao phủ toàn bộ OMML (ví dụ ma
  trận `m`, `eqArr`, `borderBox` chưa thấy xử lý) — cần lập ma trận bao
  phủ khi chuyển sang.
- Tách module: cao nhất trong file — hàm thuần, không chạm UI/state. Đây
  là ứng viên tái sử dụng có giá trị nhất vì thư viện DOCX→HTML phổ biến
  không hỗ trợ OMML (ISSUE-004).

### B3 — Xử lý ảnh → USE
- `isWebImage` (danh sách content-type hiển thị được), `sniffType` (đoán
  loại ảnh theo magic bytes base64 khi thiếu contentType), `wmfChipAttrs`/
  `wmfChipHtml` (chip SVG cảnh báo cho WMF/EMF), `pictureHtml` (chèn ảnh
  thật hoặc chip). Nhỏ, thuần, phòng thủ tốt. Chuyển sang gần như nguyên
  vẹn (đổi cú pháp sang TypeScript).

### B4 — `openDocx` + `convertImage` → USE AFTER REFACTOR
- Dùng đúng API chính thức của Mammoth (`mammoth.images.imgElement` +
  `image.readAsBase64String()`) — đã đối chiếu với mã nguồn Mammoth 1.6.0
  ở phiên 2026-10-15 (VERIFIED cho điểm này). Có styleMap Heading 1–4, chờ
  Mammoth nạp xong, bao try/catch quanh tiền xử lý (hỏng tiền xử lý vẫn mở
  được file ở chế độ thường).
- Gắn với UI (overlay loading, toast) và state toàn cục → tách phần lõi
  chuyển đổi, bỏ phần UI khi chuyển sang.

### B5 — Hệ bút vẽ → USE AFTER REFACTOR (lớn) / bản tham chiếu cho TASK-05
- Thiết kế: mỗi trang một cặp canvas — lớp nền (nét đã commit) + lớp trực
  tiếp (nét đang vẽ); nhân DPR tối đa 3 cho backing store; CSS
  `touch-action` + sửa `pointer-events` (thẻ `[PEN-FIX]`) để bút không bị
  trình duyệt cướp cử chỉ; đọc `pressure` thật, thiếu thì dùng 0,5 (dòng
  704); khi nhấc bút, vẽ lại toàn chất lượng lên lớp nền (`commitStroke`);
  tẩy theo khoảng cách điểm–đoạn thẳng (`ptSegDist2`) → xóa cả stroke
  (đúng mô hình eraser-theo-stroke mà Luồng C khuyến nghị); undo/redo theo
  danh sách stroke của từng trang.
- Thiếu sót so với thực hành tốt nhất (đối chiếu Luồng C): **không dùng
  `getCoalescedEvents()`** (grep toàn file: 0 lần) → vẽ nhanh có thể thưa
  điểm trên một số thiết bị; làm mượt bằng vẽ lại khi commit thay vì thuật
  toán outline (perfect-freehand).
- Gắn chặt vào state toàn cục `S` và mô hình slot trang cố định (PW/PH)
  → **không bê nguyên code**; giá trị tái sử dụng nằm ở thiết kế và các
  bài học đã kiểm chứng thực tế (DPR, touch-action, 2 lớp canvas, tẩy
  theo stroke, lưu stroke dạng điểm vector theo trang — khớp khuyến nghị
  mô hình dữ liệu của Luồng C).

### B6 — Phân trang ảo → DO NOT USE (khái niệm tham khảo)
- Render theo "slot" trang A4 trên nội dung HTML contenteditable, chỉ
  render trang gần vùng nhìn. Mô hình này phục vụ riêng cách StudyWrite
  hiển thị DOCX dạng trang; WebScribble dùng PDF.js (trang PDF) và editor
  riêng cho Word nên không dùng lại code. Khái niệm ảo hóa (chỉ render
  phần đang nhìn) vẫn áp dụng ở PDF Engine.

### B7 — Thước đo + zoom → USE AFTER REFACTOR (nhỏ)
- Canvas thước cm 0–21 vẽ lại theo zoom (`drawRuler`/`syncRuler`), logic
  nhỏ và độc lập tương đối; phần gắn với phần tử cuộn của StudyWrite phải
  viết lại.

### B8 — Xuất PDF raster → DO NOT USE cho lõi
- Chụp từng trang bằng html2canvas rồi ghép bằng jsPDF: file xuất là ảnh
  raster (phóng to sẽ mờ, không có lớp chữ, dung lượng lớn). Trái định
  hướng Export Engine của WebScribble (gắn chú thích vector vào PDF gốc
  bằng pdf-lib — xem TECH_SURVEY). Chỉ giữ vai trò tham khảo cho phương
  án dự phòng "xuất ảnh chụp trang".

### B9 — Xuất DOCX bằng thư viện `docx` → USE AFTER REFACTOR
- Serialize HTML đã sửa thành tài liệu `docx` (Paragraph/TextRun/ImageRun/
  Table...), nhúng nét vẽ dưới dạng ảnh PNG vẽ từ canvas. Comment trong
  code tự ghi giới hạn: *"bảng phức tạp, style Word gốc không được giữ
  hoàn toàn"*.
- Điểm có giá trị: chứng minh hướng **tạo DOCX bằng thư viện `docx` (MIT,
  đang được duy trì)** là khả thi từ trình duyệt — khớp phương án xuất
  DOCX ở Luồng A. Bộ serialize gắn với mô hình trang HTML của StudyWrite
  nên sẽ viết lại theo mô hình dữ liệu editor của WebScribble ở TASK-09;
  logic ánh xạ định dạng cơ bản (bold/italic/underline/bảng/ảnh) là tài
  liệu tham khảo tốt.

### B10 — `.swp.json` → DO NOT USE
- Định dạng lưu dự án riêng (HTML từng trang + mảng stroke) tải xuống/nạp
  lên thủ công. WebScribble lưu bằng IndexedDB theo mô hình bề mặt
  (Luồng C) nên không dùng. Bài học giữ lại: stroke lưu dạng vector theo
  trang — nhất quán với mô hình dữ liệu đề xuất.

### B11 — UI shell/tiện ích → DO NOT USE
- Giao diện, toolbar, dialog gắn riêng StudyWrite. Đặc biệt `loadSrc` (nạp
  thư viện từ CDN lúc chạy) **không được mang sang**: xung đột trực tiếp
  với yêu cầu offline (DEC-007).

## 5. Rủi ro và khoảng trống sau audit

1. **JSZip dual license (MIT/GPLv3):** khi WebScribble dùng JSZip phải
   khai báo chọn MIT trong tài liệu giấy phép của dự án. (VERIFIED)
2. **Không có test tự động nào trong StudyWrite** — mọi đánh giá chất lượng
   ở trên là PARTIALLY VERIFIED qua đọc mã + kiểm chứng thủ công trước đây;
   module được chọn tái sử dụng phải có test mới khi chuyển sang.
3. **WMF/EMF vẫn chưa có lời giải hiển thị** — StudyWrite chỉ có chip cảnh
   báo; ISSUE-003 giữ nguyên, cần hướng chuyển đổi (WASM) ở TASK-01/07.
4. **Phạm vi OMML chưa đầy đủ** — cần ma trận bao phủ trước khi cam kết hỗ
   trợ công thức (liên quan ISSUE-004).
5. **Quyền sử dụng mã ứng dụng** dựa trên tuyên bố chủ dự án (mục 2) —
   PARTIALLY VERIFIED, không phải xác minh độc lập từng dòng.

## 6. Kết luận Luồng B

- **USE ngay (sau chuyển ngữ TypeScript tối thiểu):** B3 (xử lý ảnh/chip WMF).
- **USE AFTER REFACTOR:** B1 (tiền xử lý DOCX), B2 (OMML→MathML), B4 (đường
  nhập DOCX), B7 (thước/zoom), B9 (xuất DOCX bằng thư viện `docx`).
- **Tham chiếu thiết kế, không bê code:** B5 (hệ bút vẽ → đầu vào cho
  TASK-05), B6 (ảo hóa trang).
- **DO NOT USE:** B8 (xuất PDF raster cho lõi), B10 (định dạng .swp.json),
  B11 (UI shell + nạp CDN động).
- **Không tồn tại trong StudyWrite:** module annotation độc lập; bộ chuyển
  đổi WMF/EMF thật.
- Không có mục nào của Luồng B ở trạng thái BLOCKED.
