# TECH_SURVEY — Khảo sát & kiểm chứng Technology Stack (Luồng A, TASK-01)

> Ngày kiểm tra: 2026-10-30. Nguồn: tài liệu/repo chính thức của từng thư
> viện, MDN, web.dev, WebKit, và npm registry (phiên bản + giấy phép truy
> vấn trực tiếp ngày 2026-10-30).
> Nhãn: **VERIFIED** = sự thật có nguồn chính thức · **PARTIALLY VERIFIED**
> = có bằng chứng một phần/suy luận từ nguồn · **UNVERIFIED** = chưa kiểm
> chứng được · **BLOCKED** = không thực hiện được.
> Tài liệu này là đầu vào cho TASK-02 — khuyến nghị chưa phải quyết định.

## 1. Bảng tổng hợp khuyến nghị

| Công nghệ | Phiên bản (npm, 2026-10-30) | Giấy phép | Khuyến nghị |
|---|---|---|---|
| React | 19.3.1 | MIT | **USE** |
| TypeScript | 7.0.2 | Apache-2.0 | **USE** |
| Vite | 8.3.5 | MIT | **USE** |
| Tailwind CSS | 4.3.3 | MIT | **USE** (bản build qua npm — tuyệt đối không dùng Play CDN) |
| PDF.js (pdfjs-dist) | 6.4.299 | Apache-2.0 | **USE WITH CONDITIONS** |
| pdf-lib | 1.17.1 | MIT | **USE WITH CONDITIONS** |
| Tiptap (+ ProseMirror) | 3.32.2 | MIT | **USE WITH CONDITIONS** |
| Mammoth.js | 1.13.0 | BSD-2-Clause | **USE WITH CONDITIONS** |
| IndexedDB (+ `idb` / Dexie) | idb 8.0.4 | API chuẩn / ISC / Apache-2.0 | **USE** |
| Zustand | 5.0.16 | MIT | **USE** |
| Service Worker / PWA | — | API chuẩn | **USE WITH CONDITIONS** |
| Canvas 2D + perfect-freehand | pf 1.2.3 | API chuẩn / MIT | **USE** |

Không có công nghệ nào bị DO NOT USE. Không có rào cản giấy phép nào trong
danh sách (toàn MIT/Apache-2.0/BSD/ISC). **(VERIFIED — npm registry + repo
chính thức)**

## 2. Nhóm nền tảng: React, TypeScript, Vite, Tailwind, Zustand

- Cả 5 đều là thư viện/công cụ npm thuần: bundle cùng app, Service Worker
  cache như asset tĩnh, **offline hoàn toàn**; TypeScript chỉ tồn tại lúc
  build. **(VERIFIED)**
- React: nút thắt hiệu năng của WebScribble không nằm ở React mà ở canvas/
  PDF. Kỷ luật bắt buộc: không đưa stroke đang vẽ vào React state (pointer
  move tần suất cao) — giữ nét ngoài React, chỉ commit khi kết thúc nét.
  **(PARTIALLY VERIFIED — suy luận kiến trúc)**
- Vite: phải cấu hình để asset đặc biệt (PDF.js worker `.mjs`, font) được
  emit cùng origin thay vì trỏ CDN — điều kiện để cache offline.
- Tailwind v4 đổi cách cấu hình (CSS-first) so với v3 → chốt phiên bản ở
  TASK-03. **(PARTIALLY VERIFIED)**
- Zustand: chỉ quản lý state phiên (tài liệu đang mở, công cụ, tỷ lệ
  Split); dữ liệu lớn đi qua Data Layer riêng, không nhồi vào store.

## 3. PDF — PDF.js + pdf-lib

### 3.1 PDF.js (hiển thị) — VERIFIED từ tài liệu chính thức
- Mô hình render **từng trang theo yêu cầu**: `getDocument()` →
  `getPage(n)` → `getViewport({scale})` → `page.render()` lên `<canvas>`;
  phải nhân `devicePixelRatio` (outputScale) cho màn HiDPI. Parse nặng nằm
  ở worker riêng (`pdf.worker.js`). Text layer (chọn chữ/highlight/tìm
  kiếm) là lớp DOM trong suốt tự dựng từ `getTextContent()` khi nhúng tùy
  chỉnh.
- Offline hoàn toàn qua npm (`pdfjs-dist`); CDN chỉ là lựa chọn thêm.
- Tài liệu vài trăm trang: PDF.js không render sẵn — bắt buộc **tự làm
  virtualization** (chỉ render trang đang xem + kề cận, hủy RenderTask và
  giải phóng canvas ngoài viewport), nếu không sẽ cạn bộ nhớ, nhất là iOS
  Safari vốn giới hạn bộ nhớ canvas rất chặt. **(PARTIALLY VERIFIED — suy
  luận từ mô hình render từng trang; cần kiểm thử iPad ở TASK-06)**
- Điều kiện dùng: bundle worker cùng origin (lỗi tích hợp phổ biến nhất),
  virtualization trang, kiểm thử sớm với file vài trăm trang trên iPad.

### 3.2 pdf-lib (xuất PDF) — VERIFIED từ tài liệu chính thức
- API là **vẽ trực tiếp vào trang**: `drawText`, `drawImage`, `drawLine`,
  `drawRectangle`, `drawSvgPath` (tái tạo nét bút từ dữ liệu điểm). Nét vẽ
  khi xuất trở thành hình vẽ **cố định trong trang (flatten)** — mọi trình
  đọc đều hiển thị đúng, nhưng **không phải annotation object** sửa/chọn
  được trong Acrobat; pdf-lib không có API cấp cao tạo annotation object.
- **Sửa nội dung PDF gốc: KHÔNG làm được.** Tài liệu chính thức (mục
  Limitations) ghi nguyên văn pdf-lib *"does not provide APIs for removing
  or editing text on a page outside of a form field"* và không trích được
  plain text ngoài form field; cũng không hỗ trợ PDF mã hóa
  (`EncryptedPDFError`). Không thư viện JS client-side phổ biến nào sửa
  được text gốc trong content stream một cách tổng quát.
  → Hệ quả cho ISSUE-007: "sửa chữ PDF" tối đa chỉ là overlay (che chữ cũ,
  vẽ chữ mới lên) — đề xuất TASK-02 chốt PDF = xem + chú thích phủ + xuất
  flatten và ghi rõ giới hạn trong sản phẩm.
- Giới hạn khác: file rất lớn → nạp toàn bộ vào RAM khi `save()`; cần kiểm
  thử bộ nhớ với PDF hàng chục MB trên mobile. **(UNVERIFIED — cần
  prototype ở TASK-09)**

## 4. Word — Mammoth + Tiptap + xuất DOCX

Phải tách bạch 5 khả năng (không đánh đồng):

| Khả năng | Giải pháp | Đánh giá |
|---|---|---|
| Import DOCX | Mammoth → HTML ngữ nghĩa | Tốt ở mức nội dung/ngữ nghĩa |
| Hiển thị | Tiptap (từ bản đã chuyển đổi) | Đúng nội dung, **không** đúng layout Word |
| Sửa nội dung | Tiptap/ProseMirror | Tốt trong mô hình đoạn văn của editor |
| Xuất DOCX | Tự map JSON → thư viện `docx` (MIT) | Khả thi; độ phủ định dạng cần prototype đo |
| Bảo toàn định dạng | — | **Không đạt ở cả hai chiều** (xem dưới) |

### 4.1 Mammoth — VERIFIED từ README chính thức
- Mục tiêu tự tuyên bố: *"aims to produce simple and clean HTML by using
  semantic information in the document, and ignoring other details"* —
  chuyển Heading 1 → `h1` thay vì sao chép styling; và *"the conversion is
  unlikely to be perfect for more complicated documents"*.
- Hỗ trợ: headings, lists, tables (**định dạng bảng như border bị bỏ
  qua**), footnotes/endnotes, images, bold/italic/underline/strike, sup/
  sub, links, line breaks, text boxes (**nội dung bị tách thành đoạn riêng
  sau đoạn chứa nó — mất vị trí nổi**), style map tùy biến. Không hỗ trợ:
  định dạng trực tiếp (font/cỡ/màu/căn lề), header/footer, section break,
  layout trang, **OMML**, đối tượng nổi/SmartArt/chart.
- **Cảnh báo bảo mật chính thức:** *"Mammoth performs no sanitisation"* —
  HTML đầu ra bắt buộc tự sanitize trước khi đưa vào DOM.
- Điều kiện dùng: chỉ dùng để trích nội dung ngữ nghĩa để sửa; trích ảnh
  thành Blob lưu IndexedDB thay vì để base64 khổng lồ trong HTML.

### 4.2 Tiptap/ProseMirror — VERIFIED từ docs chính thức
- Tiptap là lớp bọc headless trên ProseMirror (cả hai MIT); tài liệu nội
  bộ là **cây JSON theo schema**, xuất/nhập qua `getJSON()`/`getHTML()`.
  Nội dung đưa vào bị **ép qua schema** — thẻ/thuộc tính ngoài schema bị
  loại. Không có khái niệm trang, header/footer theo section, vị trí tuyệt
  đối → những thành phần này của DOCX không có chỗ chứa trong schema mặc định.
- Xuất DOCX: extension chính thức là **Tiptap Pro (trả phí, private
  registry)** — chạy client-side (offline được) nhưng phụ thuộc giấy phép
  thương mại, mâu thuẫn DEC-010 (lõi miễn phí). Đường mở: tự duyệt Tiptap
  JSON → thư viện **`docx`** (dolanmiu/docx, MIT — chính là thư viện mà
  StudyWrite đã dùng thành công ở mức cơ bản, xem Luồng B mục B9).
  `html-to-docx`: chất lượng thấp hơn, **UNVERIFIED** trong nghiên cứu này.
  Extension import/export DOCX đời cũ của Tiptap đã deprecated và phụ thuộc
  cloud — loại.
- Điều kiện dùng: coi Tiptap JSON là định dạng làm việc nội bộ; DOCX là
  định dạng nhập/xuất **có mất mát** và phải thông báo rõ cho người dùng;
  giữ **file DOCX gốc** trong IndexedDB làm tài sản gốc; không dùng
  Pro/Cloud nếu chưa có quyết định ngân sách riêng.

## 5. Offline / PWA / Lưu trữ — phần rủi ro nền tảng lớn nhất

### 5.1 Tính khả thi — VERIFIED
Toàn bộ stack đóng gói qua npm/bundler được; **không thư viện nào bắt
buộc CDN**. Offline đầy đủ sau lần tải đầu là khả thi về công nghệ.

### 5.2 IndexedDB & quota — VERIFIED từ web.dev/MDN
- Mọi storage của một origin (IndexedDB + Cache + SW) dùng **chung một
  quota**; hết dung lượng → xóa theo **LRU theo origin** (best-effort).
  Chrome: origin tối đa ~60% tổng dung lượng đĩa; Firefox best-effort
  ~10% đĩa hoặc tối đa 10 GiB/site.
- `navigator.storage.persist()`: xin miễn xóa — Chrome tự quyết theo
  heuristic (không hiện hộp thoại), Firefox hiện popup hỏi người dùng.
  `navigator.storage.estimate()`: theo dõi usage/quota để cảnh báo gần đầy.
- Kỷ luật dữ liệu: lưu **Blob trực tiếp** (không base64 text); gom ghi
  stroke theo trang/surface theo lô (debounce), tránh một transaction cho
  từng stroke.
- Vì local-first không có bản sao: **xuất/nhập bản sao lưu thư viện là yêu
  cầu bắt buộc**, và xin `persist()` ngay khi người dùng lưu tài liệu quan
  trọng. Chọn `idb` (ISC, nhẹ, sát API gốc) hay Dexie (Apache-2.0, query
  phong phú) — quyết định ở TASK-02. OPFS đáng khảo sát bổ sung ở TASK-08
  cho file rất lớn.

### 5.3 Safari iOS — VERIFIED từ WebKit chính thức (điểm phải quản trị)
- **Quy tắc ITP 7 ngày:** WebKit xóa *"all other script-writeable storage
  after 7 days of no user interaction with the website"* — gồm IndexedDB,
  LocalStorage, Service Worker registrations và cache.
- **Ngoại lệ:** tên miền của **home screen web app được miễn** quy tắc này
  ("The first-party domain of home screen web applications is exempt").
- Nhưng iOS **không có** `beforeinstallprompt`/lời nhắc cài đặt — người
  dùng phải tự Share → "Add to Home Screen".
- Hệ quả sản phẩm (bắt buộc, không phải tùy chọn): onboarding iOS phải
  hướng dẫn cài vào Màn hình chính ngay từ đầu; có sao lưu thư viện; không
  quảng cáo "dữ liệu an toàn tuyệt đối" trên iOS khi chưa cài app.
- Điều kiện cứng khác: Service Worker chỉ chạy trong **secure context
  (HTTPS)** — localhost là ngoại lệ cho phát triển (MDN). Chiến lược cache
  phải versioned để tránh kẹt phiên bản cũ. Giấy phép của công cụ sinh SW
  (Workbox/vite-plugin-pwa) **UNVERIFIED** chi tiết — kiểm tra khi chốt ở
  TASK-10 (dự kiến Apache-2.0/MIT).

## 6. Canvas 2D + perfect-freehand

- Canvas 2D là API chuẩn; perfect-freehand (MIT) biến mảng điểm + pressure
  thành polygon outline để fill — đúng bài toán nét bút có pressure, và
  khớp mô hình 2 lớp canvas + lưu stroke dạng vector của Luồng C.
  **(VERIFIED — repo chính thức; chi tiết mô hình ở file Luồng C)**
- `PointerEvent.pressure`: 0→1; chuột cho 0/0,5 → độ dày theo lực chỉ thật
  với stylus. **(VERIFIED — MDN)**
- `getCoalescedEvents()`: **có mâu thuẫn nguồn** — Luồng C (dữ liệu tương
  thích MDN mới) ghi Safari 18.2+ đã hỗ trợ; Luồng A (bảng tương thích
  MDN) ghi Safari chưa hỗ trợ/trả mảng rỗng. → **PARTIALLY VERIFIED**: kết
  luận an toàn là engine **phải feature-detect** và vẽ tốt khi thiếu API
  này; trạng thái thật trên iPad/Safari sẽ kiểm chứng bằng thiết bị ở
  TASK-05. **(Điểm này hai luồng chưa thống nhất — ghi nhận minh bạch)**
- Giới hạn kích thước canvas tối đa khác nhau theo trình duyệt (Safari
  thấp hơn) — zoom lớn + DPR cao trên trang A4 có thể vượt giới hạn →
  **UNVERIFIED**, cần kiểm chứng thực nghiệm ở TASK-05; có thể cần tile/
  giới hạn scale.
- Bắt buộc: `touch-action: none` trên canvas vẽ (bằng chứng thực tế từ
  StudyWrite) và nhân DPR cho backing store (mẫu chính thức PDF.js cũng
  làm vậy).

## 7. Điểm NEED MORE TESTING (không kết luận trên giấy)

| Điểm | Cách kiểm chứng | Task |
|---|---|---|
| Chất lượng `html-to-docx` nếu định dùng | Prototype chuyển đổi 2 chiều | TASK-07 |
| Giới hạn kích thước canvas + bộ nhớ canvas trên iPad | Test thiết bị thật với trang A4 DPR cao | TASK-05 |
| Bộ nhớ pdf-lib khi xuất PDF hàng chục MB trên mobile | Prototype xuất file lớn | TASK-09 |
| `getCoalescedEvents` trên Safari/iPad hiện hành | Test thiết bị thật | TASK-05 |
| Virtualization PDF.js với file vài trăm trang trên tablet yếu | Prototype | TASK-06 |
| Giấy phép Workbox/vite-plugin-pwa | Đọc LICENSE khi chốt công cụ | TASK-10 |

## 8. Kết luận Luồng A cho TASK-02

1. **Stack đề xuất đứng vững ở cấp tài liệu/nguồn chính thức** — không
   công nghệ nào phải loại bỏ; 6 mục USE, 6 mục USE WITH CONDITIONS. Việc
   của TASK-02 là biến các "điều kiện" thành quyết định chính thức.
2. **PDF:** xem (PDF.js) + chú thích phủ + xuất flatten (pdf-lib) là đường
   khả thi và trung thực; sửa text gốc PDF là **không thể** ở client-side
   — cần chủ dự án xác nhận đóng ISSUE-007 theo hướng này.
3. **Word:** mắt xích yếu nhất. Import/sửa/xuất đều làm được ở mức nội
   dung, **bảo toàn định dạng thì không** — phải hạ kỳ vọng bằng văn bản
   trong sản phẩm (giữ file gốc, cảnh báo mất định dạng khi xuất).
4. **Offline:** khả thi; rủi ro lớn nhất không nằm ở thư viện mà ở
   **chính sách storage của Safari iOS (ITP 7 ngày)** — biến onboarding
   cài đặt + sao lưu thành yêu cầu sản phẩm bắt buộc.
5. Không mục nào của Luồng A ở trạng thái BLOCKED.
