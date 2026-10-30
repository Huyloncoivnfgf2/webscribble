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
