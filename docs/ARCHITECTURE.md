# ARCHITECTURE — WebScribble

> Kiến trúc hệ thống. Phần công nghệ (mục 1) và các nguyên tắc/mô hình đánh
> dấu "đã chốt" đã là **quyết định chính thức** (DEC-016 → DEC-023, chốt ở
> TASK-02 ngày 2026-10-30). Chi tiết cài đặt trong từng engine vẫn được
> tinh chỉnh ở các task triển khai tương ứng.

## 1. Công nghệ đã chốt (DEC-016)

| Vai trò | Công nghệ | Ghi chú bắt buộc |
|---|---|---|
| Ngôn ngữ/framework | React + TypeScript | — |
| Build tool | Vite | Mọi dependency đóng gói local, không CDN ở runtime |
| CSS | Tailwind CSS | Cài qua npm; **cấm** bản Play CDN |
| Hiển thị PDF | PDF.js | Worker đóng gói cùng ứng dụng; tự làm virtualization trang |
| Xuất PDF | pdf-lib | Chỉ vẽ phủ + **flatten**; không sửa text gốc (DEC-017) |
| Nhập DOCX | Mammoth.js | Chỉ lấy HTML ngữ nghĩa; **phải sanitize** đầu ra |
| Soạn thảo nội dung (Word) | Tiptap / ProseMirror | **Không** dùng bản Pro/Cloud trả phí |
| Xuất DOCX | Thư viện `docx` (tự map từ mô hình editor) | Có cảnh báo mất định dạng trước khi xuất (DEC-018) |
| Lưu trữ cục bộ | IndexedDB qua **Dexie** | Không dùng đồng thời `idb` và Dexie |
| Quản lý state | Zustand | Chỉ state phiên; dữ liệu lớn qua Data Layer |
| Vẽ | Canvas 2D + **perfect-freehand** | Mô hình 2 lớp canvas; lưu stroke dạng điểm thô |
| Offline/PWA | Service Worker (+ Web App Manifest) | HTTPS; chiến lược cache versioned |

Cơ sở: khảo sát TASK-01 (`docs/research/TECH_SURVEY.md`) — toàn bộ danh
sách đạt khuyến nghị USE / USE WITH CONDITIONS, giấy phép MIT/Apache-2.0/
BSD/ISC đã kiểm chứng qua npm registry ngày 2026-10-30. Khi cài đặt ở
TASK-03, phải kiểm tra lại giấy phép + khả năng offline của phiên bản
thực tế (điều kiện trong DEC-016).

Ba ràng buộc kiến trúc rút ra từ khảo sát, đã thành quyết định:
(1) pdf-lib **không sửa được text gốc trong PDF** — xuất PDF là vẽ phủ
flatten (DEC-017, đóng ISSUE-007); (2) DOCX qua Mammoth/Tiptap **mất
định dạng hai chiều** — giữ file gốc làm tài sản gốc (DEC-018);
(3) Safari iOS xóa storage sau 7 ngày nếu app chưa cài vào Màn hình
chính (ITP của WebKit) — onboarding cài đặt + sao lưu thư viện là yêu
cầu bắt buộc (DEC-022).

## 2. Các lớp kiến trúc

### 2.1 Presentation Layer
- Giao diện: màn hình thư viện tài liệu, màn hình xem/chỉnh sửa, thanh công
  cụ vẽ, bảng chọn màu/nét, hộp thoại xuất file.
- Chỉ hiển thị và nhận thao tác; không chứa logic xử lý tài liệu.

### 2.2 Application Core
- Điều phối phiên làm việc: mở tài liệu → chọn engine phù hợp → bật lớp vẽ →
  tự lưu → xuất file.
- Quản lý state phiên (tài liệu đang mở, trang hiện tại, công cụ đang chọn).
- Khái niệm **Workspace**: một phiên làm việc gồm một hoặc hai **bề mặt**
  (surface) — bề mặt tài liệu và/hoặc bề mặt bảng trắng. Document Mode =
  một bề mặt tài liệu; Whiteboard Mode = một bề mặt bảng trắng; Split Mode
  = cả hai bề mặt trong cùng workspace, Application Core điều phối tỷ lệ
  hiển thị và việc lưu trạng thái của từng bề mặt.

### 2.3 Engine Layer
- **Document Engines:** PdfEngine (PDF.js: hiển thị PDF), WordEngine
  (nhập DOCX bằng Mammoth → sanitize → mô hình Tiptap để sửa; tiền xử lý
  OMML/VML tái sử dụng có chọn lọc từ StudyWrite theo Luồng B). Mỗi engine
  chịu trách nhiệm render nội dung gốc và cung cấp hệ tọa độ trang cho
  lớp chú thích.
- **Drawing Engine:** Canvas 2D + perfect-freehand; canvas vẽ phủ trên
  nội dung; quản lý nét bút, highlight, tẩy, undo/redo. **Hoàn toàn không
  biết** tài liệu bên dưới là PDF hay Word. Là engine vẽ duy nhất cho cả
  3 chế độ (DEC-015).
- **Annotation Engine:** quản lý dữ liệu chú thích (nét vẽ + ghi chú) theo
  bề mặt; gắn kết Drawing Engine với Document Engine qua tọa độ bề mặt.
- **Whiteboard Engine:** quản lý không gian bảng trắng (nét vẽ, văn bản,
  hình dạng, đối tượng chọn/di chuyển) cho Whiteboard Mode và cho vùng
  bảng trắng của Split Mode. Giai đoạn đầu bảng trắng là **trang kích
  thước cố định** (DEC-019). Cung cấp hệ tọa độ bề mặt cho Drawing Engine
  giống như Document Engine làm với trang tài liệu; hoàn toàn không phụ
  thuộc tài liệu.
- **Export Engine:** hợp nhất nội dung gốc + chú thích thành file xuất:
  PDF bằng pdf-lib (vẽ phủ, flatten — DEC-017); DOCX bằng thư viện `docx`
  từ mô hình editor (DEC-018); Split Mode xuất **riêng từng vùng**
  (DEC-021).

### 2.4 Data Layer
- IndexedDB qua **Dexie** (DEC-016): tài liệu gốc (blob), dữ liệu chú
  thích, metadata thư viện, thực thể bảng trắng và workspace.
- Mô hình dữ liệu theo **bề mặt**: mọi nét vẽ/đối tượng thuộc về đúng một bề
  mặt — `document:<tài liệu>:<trang>` hoặc `whiteboard:<bảng trắng>`. Bảng
  trắng là một thực thể hạng nhất trong thư viện (lưu, khôi phục, xóa như
  tài liệu); workspace của Split Mode lưu tham chiếu tới cả hai bề mặt của nó.
- Stroke lưu **điểm thô + thông số công cụ + `bbox`** (không lưu outline
  đã tính) và tọa độ dạng float theo hệ tọa độ bề mặt — điều kiện để mở
  rộng Infinite Canvas sau này không phải migration dữ liệu (DEC-019).
- **Sao lưu/Khôi phục (DEC-022):** xuất toàn bộ thư viện (file gốc,
  annotation, metadata, cấu trúc workspace) thành một gói sao lưu phía
  người dùng và nhập lại được; đây là lớp bảo vệ dữ liệu duy nhất vì
  không có bản sao trên máy chủ.
- Xin `navigator.storage.persist()` khi người dùng lưu tài liệu quan
  trọng; theo dõi quota bằng `navigator.storage.estimate()` (ISSUE-005).
- Không có backend ở phạm vi hiện tại (local-first, không bắt buộc tài khoản).

### 2.5 Offline Layer
- Service Worker: cache app shell + toàn bộ thư viện (gồm PDF.js worker)
  ngay lần tải đầu, bằng chiến lược cache **versioned**; mọi tài nguyên
  cùng origin (không CDN ở runtime — DEC-016).
- Chiến lược: mở app offline phải dùng được mọi chức năng cốt lõi;
  tài liệu người dùng không phụ thuộc mạng vì đã ở IndexedDB.
- Riêng iOS: hướng dẫn Add to Home Screen trong onboarding để tránh quy
  tắc ITP xóa storage sau 7 ngày (DEC-022).

### 2.6 Drawing Engine — mô hình dữ liệu (đã triển khai ở TASK-05A)

Nền dữ liệu của Drawing Engine nằm ở `src/engines/drawing/`, độc lập
hoàn toàn với renderer và input (chưa triển khai):

- **`types.ts`** — `DrawingObject` là discriminated union theo trường
  `type`: `pen`/`highlighter` (nét tự do: `points` là raw StrokePoint
  gồm x, y, pressure, time + StrokeStyle), `line`/`rectangle`/`ellipse`/
  `arrow` (start/end + ShapeStyle), `text` (position, nội dung, width/
  height + TextStyle). Mọi object có `id`, `surfaceId`, `bounds`,
  `createdAt`, `updatedAt`. Tọa độ là **world coordinates** của bề mặt.
  Không lưu outline, không lưu bitmap.
- **`objects.ts`** — factory cho từng loại (tự tính bounds, tự sinh ID
  bằng `crypto.randomUUID()` có dự phòng), style mặc định cho từng công cụ.
- **`geometry.ts`** — tính bounds (nét vẽ nới bằng nửa độ dày), union/
  expand/intersect/contains, `computeObjectBounds` để kiểm chứng.
- **`coordinates.ts`** — `Camera {x, y, zoom}` là trạng thái hiển thị
  tách khỏi dữ liệu; `worldToScreen`/`screenToWorld` và pan/zoom giữ
  điểm neo — điều kiện của DEC-019 để sau này mở Infinite Canvas không
  phải đổi dữ liệu.
- **`validation.ts`** — `validateDrawingObject` kiểm tra cấu trúc + tính
  nhất quán (bounds khớp dữ liệu, pressure trong [0,1], time không giảm
  — quy ước time tương đối đã chốt ở DEC-025) cho dữ liệu nạp từ
  persistence/sao lưu.
- **`surface.ts`** — interface `DrawingSurface` (id, kind
  `document-page`/`whiteboard`, size, list/get/add/**update**/remove/
  clear) là hợp đồng duy nhất giữa Drawing Engine và engine sở hữu bề
  mặt; addObject từ chối object thuộc bề mặt khác (cô lập theo DEC-020).
  Nhóm phương thức cập nhật (bổ sung 2026-10-31 theo yêu cầu chủ dự án):
  `updateObject` — thay một object cùng ID (không đổi được ID/surfaceId,
  dữ liệu được validate trước khi ghi, surface tự cập nhật `updatedAt`,
  thất bại thì object gốc còn nguyên); `updateObjects` — cập nhật nhiều
  object **nguyên tử** (kiểm tra tất cả rồi mới ghi); `replaceObject` —
  thay nguyên tử một object bằng 0..N object mới có ID mới, phục vụ
  Segment Eraser. `InMemorySurface` là bản cài đặt working set.
- Mọi object là dữ liệu thuần tuần tự hóa được (đã kiểm chứng bằng test
  JSON round-trip) → sẵn sàng cho persistence (TASK-08), undo/redo
  (snapshot theo surface) và selection/eraser (dựa trên bounds + id).
  Object `text` tự mang width/height theo DEC-026; test chạy bằng
  Vitest theo DEC-024.
- **`input.ts`** — Input Manager (TASK-05B): tầng DUY NHẤT tiếp nhận
  Pointer Events cho cả 3 chế độ. Chuẩn hóa sự kiện thô (qua interface
  cấu trúc tối thiểu `PointerEventLike`/`PointerTargetLike`, không phụ
  thuộc DOM hay engine tài liệu) thành `PointerSample` gồm vị trí
  **world** (client → trừ góc phần tử → `screenToWorld` bằng Camera
  hiện tại, lấy qua callback `getCamera` cho mỗi sự kiện), pressure và
  tiltX/tiltY đã chuẩn hóa kèm fallback theo thiết bị (không dữ liệu
  lực khi đang nhấn → 0.5; riêng bút giữ giá trị thật kể cả 0). Chỉ
  theo dõi MỘT pointer chính tại một thời điểm (bỏ qua pointer thứ
  hai/non-primary/nút phụ — không có multi-touch gesture), set pointer
  capture khi down và giải phóng khi up/cancel (lỗi capture không làm
  hỏng luồng), mở rộng `pointermove` thành các sample coalesced khi
  trình duyệt hỗ trợ. Manager không vẽ, không tạo DrawingObject,
  không quản lý history — chỉ phát `PointerInputEvent` (down/move/up/
  cancel) qua callback cho tầng xây nét. Có thêm `reset()` để tầng
  trên đổi ngữ cảnh giữa thao tác (bổ sung ở TASK-05C).
- **`strokeBuilder.ts`** — Stroke Builder (TASK-05C): biến chuỗi
  PointerInputEvent thành StrokeObject hoàn chỉnh qua factory của
  TASK-05A. Quy tắc: `down` mở nét (sinh ID ngay để preview và object
  cuối cùng chung ID), `up` hoàn tất; `cancel` hoàn tất và GIỮ nét
  (kèm `endedBy` trong kết quả); `down` mới giữa nét thì hoàn tất nét
  cũ với `endedBy: 'interrupted'`; time chuẩn hóa tương đối và không
  giảm dần (DEC-025 + điều kiện validation); điểm trùng hoàn toàn bị
  bỏ qua. Có `previewObject()` cho render trực tiếp và `abandon()` là
  đường hủy nét tường minh duy nhất.
- **`renderer.ts`** — Stroke Renderer (TASK-05C): tính outline lúc
  render bằng perfect-freehand (DEC-016) từ raw points đã biến đổi
  qua camera (size nhân zoom) rồi fill lên Canvas 2D; pen biến thiên
  độ dày theo pressure (thinning 0.5), highlighter dày đều (thinning
  0) + opacity từ style; chỉ đọc object, không sửa dữ liệu nguồn.
- **`canvasRenderer.ts`** — Canvas Renderer (TASK-05C): vẽ lại toàn
  cảnh từ dữ liệu (`getObjects` + `getPreviewObjects`) theo lịch
  requestAnimationFrame có gộp yêu cầu; quản lý resize + DPR (backing
  store = CSS × DPR, vẽ theo transform DPR nên tọa độ không lệch);
  `dispose()` hủy frame đang chờ. Một instance cho một canvas — mô
  hình 2 lớp canvas của mục 2.3 dùng hai instance (nét đã chốt / nét
  đang vẽ) khi tầng view cần tối ưu.
- **`engine.ts`** — DrawingEngine (TASK-05C): điểm tích hợp duy nhất
  Input Manager → Stroke Builder → Surface + CanvasRenderer cho một
  bề mặt; đổi công cụ/detach giữa nét thì chốt nét vào Surface và
  reset Input Manager. Mỗi bề mặt một instance (Split = 2 instance).
- **`shapeBuilder.ts`** — Shape Builder (TASK-05D): biến chuỗi
  PointerInputEvent thành ShapeObject (line/rectangle/ellipse/arrow)
  qua factory; vòng đời và chính sách gián đoạn cùng họ StrokeBuilder
  (cancel giữ hình, down mới chốt hình cũ). Chính sách hình suy biến
  khi hoàn tất: line/arrow có độ dài < minSize (mặc định 2 world
  units) hoặc rectangle/ellipse có một chiều < minSize → bị loại
  (`discarded`); preview trong lúc kéo không bị ảnh hưởng.
- **`text.ts`** — Text Engine (TASK-05D): tạo/cập nhật TextObject
  theo DEC-026 — nội dung thật + width/height do một `TextMeasurer`
  được tiêm vào đo tại thời điểm tạo/sửa (bản Canvas dùng
  measureText; bản kiểm thử là hàm đo xác định). Chia dòng: ngắt '\n'
  + gói từ tham lam theo maxWidth; một từ dài hơn maxWidth giữ
  nguyên. Nội dung rỗng bị từ chối. Cập nhật nội dung trả về object
  mới (giữ id/createdAt/vị trí) để dùng với `surface.updateObject`.
- **Renderer từ TASK-05D** vẽ mọi loại object qua `drawObject`:
  hình vector vẽ từ start/end + ShapeStyle (arrow có đầu tam giác
  đặc tính bằng hàm hình học thuần `arrowHeadPoints`), text vẽ bằng
  fillText theo cùng thuật toán chia dòng của Text Engine, clip
  trong hộp width × height của object, font phóng theo zoom.
  CanvasRenderer vì thế redraw được toàn bộ Surface gồm cả 7 loại
  object. DrawingEngine (05D) điều phối cả StrokeBuilder và
  ShapeBuilder theo công cụ hiện tại; công cụ 'text' phát callback
  yêu cầu vị trí đặt text cho tầng view, và `addTextObject` tạo
  TextObject qua Text Engine (measurer tiêm vào hoặc tự tạo từ
  canvas của engine).
- **`selection.ts`** — Selection Engine (TASK-05E): chọn object bằng
  vùng chữ nhật (`RectSelectionBuilder`) hoặc lasso tự do
  (`LassoSelectionBuilder`); kết luận giao nhau bằng HÌNH HỌC THẬT
  hai tầng (lọc ứng viên bằng bounds → kiểm tra theo loại: polyline
  có bán kính mực / polygon vùng kín / ellipse xấp xỉ polygon / tam
  giác đầu mũi tên), không kết luận chỉ từ bounding box. Lasso tự
  cắt bị từ chối tường minh. Di chuyển: `translateObject` (thuần) +
  `moveObjects` ghi nguyên tử qua `updateObjects`.
- **`eraser.ts`** — Eraser Engine (TASK-05E): Stroke Eraser xóa toàn
  bộ nét khi đường tẩy chạm nét (khoảng cách đoạn–đoạn thật + nửa độ
  dày nét); Segment Eraser cắt phần nét trong hình tròn tẩy bằng
  hình học đoạn–tròn (điểm biên nội suy vị trí/áp suất/thời gian),
  đoạn còn lại tạo object mới và thay thế nguyên tử qua
  `replaceObject`. Cả hai chỉ tác động pen/highlighter.
- **Sửa bounds (TASK-05E):** bounds của hình hai điểm nay gồm nửa độ
  dày nét (`shapeObjectBounds`), bounds của arrow gồm cả đầu mũi tên
  (`arrowBounds`, hình học `arrowHeadPoints`/`arrowHeadLength` chuyển
  về geometry.ts; renderer vẽ đầu mũi tên theo đơn vị world để khớp
  bounds ở mọi zoom). Bounds của mọi object = phạm vi mực vẽ thật —
  tiền đề để selection/eraser lọc ứng viên an toàn. CanvasRenderer có
  thêm lớp phủ `getOverlay` (vùng chọn, khung object đã chọn, con trỏ
  tẩy) vẽ sau mọi object.
- **`history.ts`** — History Manager (TASK-05F): Undo/Redo theo
  Command Pattern với MỘT command tổng quát `SurfaceChangeCommand` —
  mọi thao tác quy về một `SurfaceChange` (danh sách object bị ảnh
  hưởng kèm vị trí, ở trạng thái trước và sau). Các hàm `perform*`
  (add/remove/update/replace/move) thực thi thao tác bằng API Surface
  thường và chụp lại thay đổi từ trạng thái thật. Undo/redo là hoán
  đổi trạng thái NGUYÊN BẢN bằng removeObject + `insertObjectAt`
  (không chạy lại logic, không tạo ID mới, không làm mới updatedAt).
  `HistoryManager` gắn đúng một Surface (Split = hai manager độc
  lập), giới hạn mặc định 100 command, vượt giới hạn loại command cũ
  nhất. DrawingEngine ghi mọi thao tác qua history; một lần kéo tẩy
  liên tục được engine gom thành một command từ khung trạng thái đầu
  lần tẩy. Surface bổ sung `insertObjectAt` (chèn nguyên bản tại vị
  trí) và `replaceObject` giữ vị trí của object bị thay — hai điều
  kiện cần để khôi phục đúng thứ tự vẽ.

## 3. Cấu trúc thư mục dự kiến (khi bắt đầu code — TASK-03)

```
webscribble/
  docs/                 # hệ thống bộ nhớ dự án (đã có)
  public/               # manifest PWA, icon, service worker assets
  src/
    app/                # Presentation Layer: screens, components, toolbar
    core/               # Application Core: session, state (Zustand stores)
    engines/
      pdf/              # PdfEngine
      word/             # WordEngine
      whiteboard/       # Whiteboard Engine
      drawing/          # Drawing Engine (độc lập hoàn toàn)
      annotation/       # Annotation Engine
      export/           # Export Engine
    data/               # Data Layer: IndexedDB repositories
    offline/            # Offline Layer: service worker registration
  tests/
```

## 4. Các luồng xử lý chính

### 4.1 Luồng mở tài liệu
Người dùng chọn file → Document Manager lưu blob gốc vào IndexedDB (nếu là
tài liệu mới) → Application Core chọn PdfEngine/WordEngine theo định dạng →
Engine render trang → Annotation Engine nạp chú thích cũ của tài liệu →
Drawing Engine sẵn sàng trên lớp phủ.

### 4.2 Luồng lưu chú thích
Người dùng vẽ/ghi chú → Drawing Engine sinh dữ liệu nét → Annotation Engine
gán tọa độ theo trang hiện tại → Data Layer ghi vào IndexedDB (tự lưu, theo
nhịp debounce) → không cần thao tác "Lưu" thủ công.

### 4.3 Luồng xuất file
Người dùng chọn Xuất → Export Engine lấy nội dung gốc + toàn bộ chú thích →
với PDF: dùng pdf-lib vẽ chú thích vào trang và flatten (DEC-017); với
DOCX: tạo file mới từ mô hình editor bằng thư viện `docx`, **sau khi đã
hiển thị cảnh báo mất định dạng** (DEC-018); với Split Mode: xuất riêng
file cho từng Surface (DEC-021) → tải file về thiết bị. File gốc trong
IndexedDB không bao giờ bị ghi đè bởi thao tác xuất.

### 4.4 Luồng sao lưu / khôi phục (DEC-022)
Người dùng chọn Sao lưu → Data Layer đóng gói toàn bộ thư viện (blob file
gốc, dữ liệu chú thích theo bề mặt, metadata, thực thể bảng trắng và
workspace) thành một gói sao lưu → tải về thiết bị của người dùng. Khôi
phục: đọc gói sao lưu → kiểm tra phiên bản định dạng gói → ghi lại vào
IndexedDB (có xác nhận của người dùng nếu sẽ ghi đè dữ liệu hiện có).

## 5. Nguyên tắc tách Drawing Engine khỏi Document Engine

1. Drawing Engine chỉ làm việc với: kích thước trang (đơn vị logic), tọa độ
   điểm, sự kiện pointer/pressure. Không import bất kỳ module PDF/Word nào.
2. Giao tiếp duy nhất giữa hai phía là **hệ tọa độ trang** do Document Engine
   cung cấp và **dữ liệu chú thích** do Annotation Engine sở hữu.
3. Nhờ vậy: thay engine tài liệu (hoặc thêm định dạng mới) không phải viết
   lại phần vẽ; và cải tiến nét bút áp dụng đồng thời cho mọi định dạng.
4. Zoom/cuộn trang do Document Engine điều khiển; Drawing Engine phải vẽ lại
   nét theo cùng phép biến đổi, không tự lưu tọa độ theo pixel màn hình.

## 6. Ảnh hưởng của hệ thống 3 chế độ (DEC-014, DEC-015, DEC-019 → DEC-021)

Các điểm dưới đây đã được **chốt ở TASK-02** (trước đây là phân tích định
hướng sau khảo sát TASK-01):

1. **Một Drawing Engine cho mọi bề mặt:** engine vẽ chỉ nhận "bề mặt + hệ
   tọa độ" từ engine sở hữu bề mặt (Document Engine cho trang tài liệu,
   Whiteboard Engine cho bảng trắng). Ba chế độ vì thế không tạo ra ba hệ
   thống viết tay riêng (DEC-015).
2. **Document Engine** chịu trách nhiệm hiển thị và xử lý tài liệu (PDF,
   DOCX, ảnh) và cung cấp tọa độ trang; không quản lý bảng trắng.
3. **Whiteboard Engine** quản lý không gian bảng trắng và các đối tượng trên
   đó; dùng lại cho cả Whiteboard Mode và vùng bảng trắng của Split Mode —
   không viết hai lần. Giai đoạn đầu là trang cố định (DEC-019).
4. **Split Mode là lớp phối hợp, không phải engine mới:** Application Core
   giữ **Workspace** tham chiếu hai Surface, điều phối tỷ lệ hiển thị và
   đảm bảo **tự lưu độc lập cho từng Surface** nhưng khôi phục cùng nhau;
   Undo/Redo riêng theo Surface (DEC-020).
5. **Dữ liệu viết tay/chú thích có một cấu trúc chung:** nét vẽ/đối tượng
   luôn thuộc về một bề mặt (mục 2.4), nên cùng một định dạng lưu trữ phục
   vụ cả 3 chế độ và Export Engine xử lý thống nhất; xuất Split Mode là
   xuất riêng từng Surface (DEC-021).
6. **Câu hỏi còn mở duy nhất của nhóm này thuộc ISSUE-014:** bố trí Split
   Mode trên màn hình mobile hẹp và ngữ nghĩa GIF làm nền tài liệu —
   phần xuất file và Infinite Canvas đã có quyết định (DEC-021, DEC-019).
