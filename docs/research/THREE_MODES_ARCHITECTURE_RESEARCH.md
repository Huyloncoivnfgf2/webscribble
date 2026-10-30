# THREE_MODES_ARCHITECTURE_RESEARCH — Nghiên cứu kiến trúc 3 chế độ (Luồng C, TASK-01)

> Ngày nghiên cứu: 2026-10-30. Quy ước nhãn: **[NGUỒN]** = có nguồn kiểm
> chứng (URL ở cuối mỗi phần) · **[SUY LUẬN]** = khuyến nghị kiến trúc của
> nghiên cứu, chưa có thử nghiệm độc lập · **[CHƯA XÁC MINH]** = chưa đủ
> bằng chứng. Không có benchmark nào được tạo ra trong nghiên cứu này.
> Tài liệu này là đầu vào cho TASK-02 chốt kiến trúc — chưa phải quyết định.

## Phần 1 — Ma trận định dạng ảnh trên trình duyệt

| Định dạng | `<img>` trực tiếp | Decode vào canvas | Cần chuyển đổi client? | Phân loại |
|---|---|---|---|---|
| PNG | ✓ mọi trình duyệt | ✓ | Không | **HIỂN THỊ TRỰC TIẾP** |
| JPG/JPEG | ✓ mọi trình duyệt | ✓ | Không | **HIỂN THỊ TRỰC TIẾP** |
| WebP | ✓ Chrome/Edge/Firefox; Safari ≥14 + macOS Big Sur+ | ✓ nơi hiển thị được | Không (trừ Safari rất cũ) | **HIỂN THỊ TRỰC TIẾP** (có điều kiện phiên bản Safari) |
| GIF | ✓ mọi trình duyệt | ✓ (frame tại thời điểm vẽ) | Không | **HIỂN THỊ TRỰC TIẾP** |
| BMP | ✓ mọi trình duyệt | ✓ | Không bắt buộc | **HIỂN THỊ TRỰC TIẾP nhưng KHÔNG ƯU TIÊN lưu trữ** |
| SVG | ✓ mọi trình duyệt (chế độ ảnh tĩnh an toàn) | ✓ có điều kiện | Không | **HIỂN THỊ TRỰC TIẾP có điều kiện an toàn/mô hình** |
| HEIC/HEIF | ✗ Chrome/Edge/Firefox; ✓ chỉ Safari ≥17 (Sonoma/iOS 17+) | ✗ ngoài Safari | **Có** — decoder WASM (libheif) | **CHỈ MỘT SỐ TRÌNH DUYỆT + CẦN CHUYỂN ĐỔI → KHÔNG ƯU TIÊN ở lõi** |

Căn cứ chính:
- PNG, JPEG, GIF, SVG, WebP được MDN liệt kê hỗ trợ ở Chrome, Edge, Firefox,
  Safari; WebP trên Safari cần Safari 14+ và macOS Big Sur (11)+. **[NGUỒN: MDN]**
- BMP hiển thị được ở mọi trình duyệt nhưng MDN xếp vào nhóm "nên tránh dùng
  cho nội dung web" (không nén → file rất lớn). **[NGUỒN: MDN]** Hệ quả
  **[SUY LUẬN]**: nhận BMP để mở, nhưng chuyển sang PNG/WebP khi lưu vào thư
  viện vì quota IndexedDB có hạn (ISSUE-005).
- GIF: 256 màu, có animation. **[SUY LUẬN]** khi GIF là "trang tài liệu" cần
  chốt ngữ nghĩa: animation chạy dưới lớp mực hay frame đầu làm nền tĩnh —
  câu hỏi cho TASK-02.
- HEIC/HEIF: HEIC dùng codec HEVC bị ràng buộc bằng sáng chế; Apple có
  decoder ở cấp hệ điều hành nên Safari 17+ mở được, Chrome/Edge/Firefox
  không tích hợp decoder HEVC cho ảnh web nên `<img>` và `createImageBitmap`
  đều thất bại. Firefox theo dõi ở Bugzilla 1402293 (từ 2017, vẫn mở). Đường
  chuyển đổi phía client duy nhất là libheif biên dịch WASM (~1,2 MB —
  **[CHƯA XÁC MINH]** độc lập, số do bài viết/thư viện nêu) → phải lazy-load.
  **[SUY LUẬN — khuyến nghị cho ISSUE-014]:** không cấm hẳn HEIC (định dạng
  mặc định của ảnh iPhone), nhưng không để lõi phụ thuộc: Safari ≥17 mở trực
  tiếp; trình duyệt khác lazy-load WASM chuyển → JPEG/PNG lúc import và chỉ
  lưu bản đã chuyển; hoặc thông báo rõ "cần chuyển đổi" thay vì lỗi im lặng.
- SVG: khi dùng như ảnh (`<img>`, `drawImage`), trình duyệt tắt JavaScript
  và không tải tài nguyên ngoài → an toàn để hiển thị. **[NGUỒN: MDN]** Khi
  inline SVG vào DOM để sửa, các hạn chế đó mất tác dụng → nguy cơ XSS từ
  file người dùng; nếu sau này "sửa nội dung SVG" thì bắt buộc sanitize
  trước. **[SUY LUẬN]** Bề mặt SVG nên dùng hệ tọa độ theo `viewBox`; SVG
  thiếu `width`/`height` nội tại có thể render không nhất quán giữa trình
  duyệt — **[CHƯA XÁC MINH]**, cần test khi làm TASK-06.

Nguồn Phần 1:
- MDN — Image file type and format guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types
- MDN — SVG as an image: https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image
- HEIF browser support: https://www.testmuai.com/learning-hub/heif-browser-support/
- HEIC client-side conversion (libheif WASM): https://dev.to/zerocloudpdf/client-side-heic-to-pdf-skipping-libheif-wasm-for-canvas-api-jspdf-5a6e ; https://dev.to/forze-dev/why-heic-breaks-websites-and-how-i-built-a-browser-only-converter-to-fix-it-gp0

## Phần 2 — Drawing Engine dùng chung cho mọi bề mặt

### 2.1 Nền tảng nhập liệu (có nguồn)
- Pointer Events là Baseline: Chrome 55+, Edge 12+, Firefox 59+, Safari 13+
  (kể cả iOS). Một mô hình sự kiện cho chuột/bút/cảm ứng, kèm `pressure`
  (0→1), `tiltX/tiltY`. **[NGUỒN: caniuse; MDN]**
- `pressure`: bút thật cho giá trị thực; chuột cho 0,5 khi nhấn / 0 khi
  không; cảm ứng ngón tay thường chỉ 0,5 cố định → engine **không được giả
  định luôn có pressure thật**. **[NGUỒN: đặc tả Pointer Events/MDN]**
- `getCoalescedEvents()` (điểm bị gộp trong pointermove — yếu tố quyết định
  nét mượt khi vẽ nhanh): Chrome 58+, Edge 79+, Firefox 59+ desktop;
  **Safari chỉ từ 18.2+** theo dữ liệu tương thích MDN hiện hành; Firefox
  Android trả mảng rỗng. `getPredictedEvents()` tương tự. **[NGUỒN: MDN
  browser-compat]** Hệ quả **[SUY LUẬN — bắt buộc]**: engine phải
  feature-detect hai API này và vẫn vẽ tốt khi thiếu.
- Bắt buộc: CSS `touch-action: none` trên canvas vẽ (nếu không trình duyệt
  giành cử chỉ cuộn → `pointercancel` hủy nét) và nhân `devicePixelRatio`
  (tối đa ~3) cho backing store để nét sắc trên Retina — cả hai đã có bằng
  chứng thực tế từ sự cố bút của StudyWrite.

### 2.2 Thuật toán tạo hình nét: perfect-freehand
- Nhận điểm `[x, y, pressure]`, trả **mảng điểm outline** để tự render (fill
  polygon/SVG path); thư viện không tự render. Tách được 2 bước:
  `getStrokePoints` → `getStrokeOutlinePoints`. Options: `size`, `thinning`
  (ảnh hưởng pressure), `smoothing`, `streamline`, `simulatePressure: true`
  mặc định (mô phỏng pressure theo tốc độ khi thiết bị không có pressure
  thật — vẽ nhanh nét mảnh, chậm nét đậm). **[NGUỒN: README chính thức]**
- **Giấy phép MIT** cho perfect-freehand. **[NGUỒN: repo/hồ sơ tác giả]**
  ⚠️ MIT này **không** bao phủ tldraw SDK (giấy phép riêng, có điều kiện
  thương mại) — chỉ dùng perfect-freehand thì sạch; nhúng tldraw SDK là
  quyết định pháp lý khác, cần đánh giá riêng.
- Kích thước bundle: **[CHƯA XÁC MINH]** — thư viện đơn chức năng, không
  phụ thuộc runtime đáng kể theo README; cần đo gzip thực tế ở TASK-03.

### 2.3 Khuyến nghị mô hình dữ liệu stroke **[SUY LUẬN — đề xuất TASK-02 chốt]**
Nguyên tắc: **lưu điểm thô + thông số công cụ, KHÔNG lưu outline đã tính**
(outline tính lại lúc render → nét giữ chất lượng vector ở mọi zoom, đổi
thuật toán sau không mất dữ liệu cũ).

```
Stroke {
  id, surfaceId,
  tool: 'pen' | 'highlighter' | ...,
  color, baseSize (đơn vị LOGIC của bề mặt), opacity,
  simulatePressure: boolean,
  points: [{x, y, pressure, t}],     // tọa độ logic; t = timestamp tương đối
  bbox: {minX, minY, maxX, maxY},    // tính sẵn: hit-test, culling, spatial index
  transform?: {dx, dy},              // độ dời khi di chuyển đối tượng
  createdAt, updatedAt
}
```
- Giữ `pressure` + `t`: tái tạo outline trung thực; `t` phục vụ mô phỏng
  pressure theo tốc độ khi mở trên thiết bị khác.
- Lọc điểm theo khoảng cách tối thiểu khi ghi (coalesced events có thể
  >100 điểm/giây → phình IndexedDB); ngưỡng cụ thể **[CHƯA XÁC MINH]**, thử
  nghiệm ở TASK-05.

### 2.4 Hệ tọa độ logic theo bề mặt **[SUY LUẬN]**
Drawing Engine không bao giờ làm việc với pixel màn hình; engine sở hữu bề
mặt cung cấp phép biến đổi logic ↔ screen (pan, zoom, DPR):

| Bề mặt | Đơn vị logic | Gốc | Ghi chú |
|---|---|---|---|
| Trang PDF | Điểm PDF (pt, 1/72") tại zoom 1 | Trên-trái trang | Khớp PDF.js; pdf-lib dùng pt nhưng gốc dưới-trái → Export Engine phải lật trục Y |
| Trang Word đã render | CSS px tại zoom 100% theo mô hình trang (A4 = 794×1123 như StudyWrite) | Trên-trái trang | Neo theo số trang + tọa độ trong trang; sửa nội dung gây reflow có thể lệch neo — rủi ro cho TASK-07, cân nhắc neo theo đoạn văn |
| Ảnh | Pixel tự nhiên của ảnh (SVG: đơn vị viewBox) | Trên-trái ảnh | Nét bám đúng vị trí tương đối ở mọi kích thước hiển thị |
| Bảng trắng cố định | Đơn vị trang (A4-like) | Trên-trái trang | Xem Phần 4 |
| Bảng trắng vô hạn (nếu làm) | Tọa độ thế giới float, không biên | Điểm mốc cố định | Xem Phần 4 |

Render khi zoom: vẽ lại từ dữ liệu vector. **[SUY LUẬN]** mô hình 2 lớp
canvas: lớp tĩnh (stroke đã hoàn tất, raster-cache ở zoom hiện tại) + lớp
trực tiếp (stroke đang vẽ, tính outline mỗi frame với `last: false`).

### 2.5 Undo/Redo, Eraser, Selection **[SUY LUẬN]**
- **Undo/Redo theo từng bề mặt** (phân tích đầy đủ ở Phần 3.2). Trong
  Document Mode, "bề mặt" nên hiểu là *tài liệu* (gộp các trang), không
  phải từng trang — ranh giới này để TASK-02 chốt.
- **Eraser:** hai trường phái — xóa theo stroke (giữ mô hình vector, undo
  tự nhiên; muốn tẩy một phần phải tách stroke tại điểm giao) vs xóa theo
  pixel bằng `destination-out` (tẩy từng phần ngay nhưng **phá mô hình
  vector**: mất khả năng chọn/undo theo đối tượng, mờ khi zoom). Khuyến
  nghị: eraser theo stroke ở giai đoạn đầu; "tẩy cắt đoạn" để giai đoạn sau.
- **Selection:** hit-test 2 bước — lọc bằng `bbox` (+ spatial index khi
  nhiều đối tượng), kiểm tra chính xác bằng point-in-polygon trên outline.
  Di chuyển = cộng `transform.dx/dy` lúc render thay vì viết lại `points`.

Nguồn Phần 2:
- caniuse — Pointer Events: https://caniuse.com/pointer
- MDN PointerEvent (dữ liệu tương thích): https://docs.w3cub.com/dom/pointer_events
- perfect-freehand README: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/README.md
- perfect-freehand hồ sơ/license: https://latent.space/wiki/steve-ruiz-7e011011/
- Socket npm overview: https://socket.dev/npm/package/perfect-freehand/overview/1.0.12

## Phần 3 — Split Mode / Workspace

### 3.1 Mô hình trạng thái workspace **[SUY LUẬN — đề xuất TASK-02]**
Workspace là thực thể lưu trữ độc lập trong IndexedDB, **tham chiếu** tới
hai bề mặt thay vì chứa dữ liệu của chúng:

```
Workspace { id, name, mode: 'split', splitRatio (0..1),
            orientation: 'horizontal' | 'vertical',
            surfaces: [surfaceIdA, surfaceIdB], lastActiveSurfaceId,
            createdAt, updatedAt }
Surface   { id, kind: 'document-page-set' | 'whiteboard', refId,
            strokes: [...], objects: [...],
            view: {scrollX, scrollY, zoom} }
```
Nguyên tắc:
1. Mỗi bề mặt tự chứa dữ liệu + trạng thái view của mình; `splitRatio` và
   `orientation` thuộc workspace, không thuộc bề mặt.
2. **Tự lưu theo bề mặt (dirty-surface autosave):** kết thúc stroke ở vùng
   nào → ghi transaction IndexedDB cho đúng bề mặt đó + cập nhật
   `updatedAt` của workspace. Thêm lưu trạng thái view theo debounce.
3. **Khôi phục:** mở app → đọc workspace gần nhất → nạp 2 bề mặt theo
   `refId` → áp lại tỷ lệ và view. Dữ liệu mất tối đa là stroke *đang vẽ
   dở* khi trình duyệt đóng đột ngột — khớp yêu cầu phi chức năng ở
   PRODUCT_SPEC mục 5.
4. Bảng trắng trong Split Mode **dùng chung kho thực thể bảng trắng** với
   Whiteboard Mode (một bảng trắng mở độc lập hay gắn vào workspace đều
   được) — tránh hai định dạng lưu bảng trắng.

### 3.2 Undo/Redo: tách riêng theo bề mặt (khuyến nghị)
- Stack chung toàn workspace: đơn giản để học, nhưng **rủi ro trải nghiệm
  cao** — người dùng đang nhìn vùng tài liệu, nhấn undo, nét bị hoàn tác
  lại nằm ở vùng bảng trắng → cảm giác "undo không chạy"/mất nét khó hiểu.
- Stack riêng theo bề mặt: khớp tinh thần DEC-014 ("hai khu vực độc lập về
  nội dung"), undo chỉ tác động vùng đang active; phím tắt định tuyến theo
  `lastActiveSurfaceId`; stack chết sạch theo bề mặt khi bề mặt bị xóa.
- **Khuyến nghị [SUY LUẬN]:** stack riêng theo bề mặt + mỗi vùng có chỉ thị
  undo/redo riêng. Chốt ở TASK-02/TASK-13.

### 3.3 Phương án xuất nội dung hai vùng — CHỈ TRÌNH BÀY, KHÔNG CHỐT
| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| A. Gộp 1 file | PDF: tài liệu đã chú thích + trang bảng trắng nối cuối | 1 file, giữ ngữ cảnh | Khác khổ/tỉ lệ phải chuẩn hóa; với DOCX gần như không tự nhiên |
| B. Xuất riêng từng vùng | 2 file đặt tên liên kết | Mỗi vùng dùng engine xuất tốt nhất; đơn giản nhất | Người dùng quản lý 2 file; liên kết chỉ ở tên file |
| C. Tài liệu + trang ghi chú (appendix) | Như A nhưng trang bảng trắng là trang ghi chú có tiêu đề liên kết | Giữ ngữ cảnh, người nhận hiểu ngay | Trang ghi chú là ảnh tĩnh (mất khả năng sửa tiếp trong file xuất) |
| D. Ảnh chụp workspace (snapshot) | 1 ảnh/PDF chụp cả 2 vùng đúng bố cục | Nhanh, giữ bố cục trực quan | Raster, bị cắt theo khung hình, giá trị lưu trữ thấp |

Cả 4 đều khả thi với Export Engine trong ARCHITECTURE.md; quyết định thuộc
chủ dự án (ISSUE-014).

## Phần 4 — Whiteboard: canvas cố định vs Infinite Canvas

### 4.1 So sánh
| Khía cạnh | Cố định (trang A4-like, có thể nhiều trang) | Infinite Canvas |
|---|---|---|
| Tọa độ | Bị chặn trong trang; đối tượng thuộc trang xác định | Tọa độ thế giới float không biên + khái niệm camera {x, y, zoom} tách khỏi dữ liệu |
| Lưu trữ | Đơn giản: trang → danh sách stroke | Phải có `bbox` từng đối tượng + chỉ mục không gian |
| Render | Vẽ lại stroke của trang hiện tại | Bắt buộc viewport culling (chỉ vẽ đối tượng giao vùng nhìn) |
| Xuất file | Ánh xạ 1:1 sang trang PDF — tự nhiên nhất | Phải định nghĩa "vùng xuất" — thêm quyết định sản phẩm |
| Trải nghiệm | Quen như giấy; hợp ghi bài có cấu trúc | Tự do cho brainstorm; dễ "lạc", cần minimap/zoom-to-fit |
| Cử chỉ | Zoom/pan giới hạn trong trang | Pinch-zoom/pan là thao tác hạng nhất, phải tách chặt khỏi nét vẽ |

### 4.2 Hiệu năng khi có hàng nghìn stroke **[SUY LUẬN — nguyên lý chuẩn, không benchmark]**
1. **Lưu vector, không lưu raster làm dữ liệu chính.** Raster chỉ là cache
   hiển thị có thể vứt bỏ, không bao giờ là nguồn sự thật.
2. **Spatial partitioning:** lưới ô (grid hash) hoặc quadtree/R-tree theo
   `bbox` → hit-test và culling có chi phí theo số đối tượng *đang thấy*.
3. **Render theo viewport** + lớp tĩnh raster-cache (Phần 2.4).
4. Các kỹ thuật 2–3 nên có trong Drawing Engine ngay từ đầu (kể cả mô hình
   trang cố định vẫn lợi khi zoom sâu), không chờ Infinite Canvas.

### 4.3 Zoom/pan trên cảm ứng **[SUY LUẬN]**
Camera là trạng thái của *view*, không bao giờ viết ngược vào tọa độ đối
tượng. Cảm ứng: theo dõi 2 pointer cho pinch (khoảng cách → zoom, trung
điểm → pan); chuyển trạng thái phải mượt, không làm đứt nét đang vẽ — yêu
cầu thiết kế cho TASK-12.

### 4.4 Khuyến nghị về Infinite Canvas (cho ISSUE-012)
**KHÔNG làm Infinite Canvas ở giai đoạn đầu.** Làm Whiteboard dạng trang cố
định trước, nhưng thiết kế dữ liệu "sẵn sàng vô hạn" ngay từ TASK-02:
(1) tọa độ stroke dạng float theo hệ của bề mặt, không gắn cứng pixel
trang; (2) mọi stroke có `bbox`; (3) camera/view tách khỏi dữ liệu;
(4) Drawing Engine nhận bề mặt qua giao diện có transform. Thỏa 4 điểm này
thì bỏ giới hạn biên sau này là thay đổi ở Whiteboard Engine, **không phải
migration dữ liệu**.
Lý do: Infinite Canvas kéo theo spatial index, culling, minimap, quyết
định vùng xuất và quản lý cử chỉ camera — chi phí lớn trong khi giá trị
cốt lõi của sản phẩm (DEC-011) là chất lượng nét bút trên tài liệu.
Điều kiện nâng cấp lên giai đoạn đầu (nếu chủ dự án muốn ở TASK-02): xác
định brainstorm/sơ đồ tư duy là tình huống dùng *chính*, chấp nhận phạm vi
TASK-12 tăng thêm, và chốt trước cách xuất file từ không gian vô hạn.

## Tổng kết đầu ra cho TASK-02 (từ Luồng C)
- **Có bằng chứng nguồn:** ma trận ảnh (trừ điểm đã ghi CHƯA XÁC MINH);
  Pointer Events/pressure/coalesced theo trình duyệt; cơ chế + license MIT
  của perfect-freehand; an toàn của SVG-as-image; HEIC chỉ native trên Safari 17+.
- **Suy luận cần TASK-02 chốt:** mô hình dữ liệu stroke (điểm thô + bbox);
  hệ tọa độ logic theo bề mặt; undo/redo theo bề mặt; eraser theo stroke;
  mô hình Workspace/Surface + autosave theo bề mặt; Whiteboard trang cố
  định trước, dữ liệu sẵn sàng vô hạn.
- **Thuộc chủ dự án:** phương án xuất Split Mode (4 phương án, chưa chọn);
  ngữ nghĩa GIF làm nền tài liệu; mức ưu tiên HEIC.
