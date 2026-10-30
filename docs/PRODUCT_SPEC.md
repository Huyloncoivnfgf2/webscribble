# PRODUCT_SPEC — WebScribble

> Đặc tả sản phẩm. Mỗi mục được gắn nhãn:
> **[ĐÃ THỐNG NHẤT]** = chủ dự án đã xác nhận · **[ĐỀ XUẤT]** = chờ duyệt ·
> **[CHƯA XÁC MINH]** = cần kiểm chứng kỹ thuật trước khi cam kết.

## 1. Mục tiêu sản phẩm

- Cho phép xem, viết tay, chú thích và chỉnh sửa tài liệu PDF/DOCX ngay trên
  trình duyệt, trên desktop/tablet/mobile. **[ĐÃ THỐNG NHẤT]**
- Trải nghiệm viết tay mượt, chính xác, gần với ứng dụng ghi chú chuyên dụng. **[ĐÃ THỐNG NHẤT]**
- Hoạt động offline đầy đủ sau lần tải đầu; dữ liệu local-first; không bắt
  buộc tài khoản; chức năng cốt lõi miễn phí. **[ĐÃ THỐNG NHẤT]**
- Ba chế độ làm việc: Document Mode, Split Mode, Whiteboard Mode — chi tiết
  ở mục 3. **[ĐÃ THỐNG NHẤT — DEC-014]**
- Stack công nghệ đã chốt: React, TypeScript, Vite, Tailwind CSS, PDF.js,
  pdf-lib, Tiptap/ProseMirror, Mammoth.js, Zustand, IndexedDB (Dexie),
  Canvas 2D, perfect-freehand — kèm điều kiện ở quyết định.
  **[ĐÃ THỐNG NHẤT — DEC-016]**

## 2. Người dùng mục tiêu

Học sinh/sinh viên, giáo viên/người làm học liệu, người dùng phổ thông cần
ghi chú nhanh lên tài liệu. (Chi tiết: PROJECT_CONTEXT.md mục 2.)

## 3. Ba chế độ làm việc

WebScribble có 3 chế độ làm việc chính **[ĐÃ THỐNG NHẤT — DEC-014]**. Cả ba
chế độ dùng chung **một** Drawing Engine **[ĐÃ THỐNG NHẤT — DEC-015]**; điểm
khác nhau là "bề mặt" làm việc: trang tài liệu, hoặc bảng trắng, hoặc cả hai.

### 3.1 MODE 1 — Document Mode

- Làm việc trên toàn bộ không gian của một tài liệu. **[ĐÃ THỐNG NHẤT]**
- Định dạng dự kiến: PDF, DOCX, PNG, JPG/JPEG và các định dạng ảnh phổ biến
  khác. **[ĐÃ THỐNG NHẤT về định hướng]** — thứ tự hỗ trợ theo lộ trình
  (DEC-004). Đã chốt thêm: BMP hiển thị được nhưng chuyển đổi khi lưu trữ;
  SVG hiển thị ở chế độ ảnh an toàn; **HEIC giai đoạn đầu chưa hỗ trợ
  decoder — trình duyệt không mở được thì hiển thị thông báo chưa hỗ trợ
  [ĐÃ THỐNG NHẤT — DEC-023]**. Còn mở: ISSUE-014 (phần mobile/GIF).
- Xem tài liệu; viết tay và vẽ trực tiếp trên tài liệu; thêm chú thích, hình
  dạng, textbox và các đối tượng khác. **[ĐÃ THỐNG NHẤT]**
- Công cụ định dạng văn bản (bôi đen/chọn chữ, in đậm, gạch chân, highlight)
  áp dụng ở nơi có văn bản sửa được hoặc trong textbox. **[ĐÃ THỐNG NHẤT]**
- **Phân biệt bắt buộc** hai loại thao tác **[ĐÃ THỐNG NHẤT — DEC-014]**:
  (a) *chỉnh sửa nội dung văn bản gốc* của tài liệu; (b) *tạo chú thích/đối
  tượng phủ lên* tài liệu. Ma trận khả năng theo định dạng:

  | Định dạng | Xem | Viết/chú thích phủ lên | Sửa nội dung gốc |
  |---|---|---|---|
  | PDF | ✓ | ✓ | **Không cam kết — đã chốt không làm (DEC-017)** |
  | DOCX | ✓ | ✓ | ✓ (DEC-006, giới hạn ở DEC-018) |
  | Ảnh (PNG, JPG/JPEG, ...) | ✓ | ✓ | Không áp dụng — ảnh không có lớp văn bản gốc |

  Không được tuyên bố rằng mọi định dạng đều hỗ trợ chỉnh sửa nội dung gốc
  như nhau.

### 3.2 MODE 2 — Split Mode

- Một workspace gồm hai khu vực: khu vực 1 hiển thị tài liệu (PDF, Word
  hoặc hình ảnh); khu vực 2 là bảng trắng để viết, vẽ, ghi chú tự do.
  **[ĐÃ THỐNG NHẤT]**
- Hai khu vực độc lập về nội dung nhưng thuộc cùng một workspace; điều
  chỉnh được tỷ lệ diện tích giữa hai khu vực. **[ĐÃ THỐNG NHẤT]**
- Cả hai khu vực đều viết tay, vẽ, thêm văn bản và dùng các công cụ chú
  thích/định dạng phù hợp (bôi đen, in đậm, gạch chân, highlight ở nơi có
  văn bản). **[ĐÃ THỐNG NHẤT]**
- Lưu trạng thái của **cả hai** khu vực để không mất dữ liệu theo mô hình
  Workspace/Surface: mỗi Surface tự lưu, Undo/Redo riêng theo Surface,
  khôi phục được cả workspace sau khi mở lại. **[ĐÃ THỐNG NHẤT — DEC-020]**
- Xuất file: xuất **riêng từng vùng** (vùng tài liệu → file tài liệu; vùng
  bảng trắng → file riêng), không ghép một file ở giai đoạn đầu.
  **[ĐÃ THỐNG NHẤT — DEC-021]**
- Bố trí hai khu vực trên màn hình mobile hẹp **[CHƯA XÁC MINH]** — ISSUE-014.

### 3.3 MODE 3 — Whiteboard Mode

- Chỉ hiển thị bảng trắng; không cần mở tài liệu. **[ĐÃ THỐNG NHẤT]**
- Chức năng: viết tay, vẽ tự do, tạo văn bản, vẽ hình dạng, tẩy, chọn/di
  chuyển/chỉnh sửa đối tượng, Undo/Redo, lưu và khôi phục bảng trắng.
  **[ĐÃ THỐNG NHẤT]**
- Infinite Canvas (bảng trắng vô hạn): **đã chốt chưa làm ở giai đoạn
  đầu** — Whiteboard dùng trang kích thước cố định; kiến trúc dữ liệu
  phải sẵn sàng mở rộng sang Infinite Canvas sau này mà không viết lại
  Drawing Engine. **[ĐÃ THỐNG NHẤT — DEC-019]**

## 4. Các module chức năng

### 4.1 PDF Engine
- Mở và hiển thị PDF nhiều trang, cuộn/phóng thu mượt. **[ĐÃ THỐNG NHẤT]**
- Phủ lớp chú thích (bút, highlight, ghi chú) lên trang PDF; annotation
  **lưu riêng**, file PDF gốc được bảo vệ không sửa. **[ĐÃ THỐNG NHẤT — DEC-017]**
- Xuất PDF mới có annotation đã **flatten**. **[ĐÃ THỐNG NHẤT — DEC-017]**
- **Không cam kết:** sửa trực tiếp text gốc trong PDF; xóa/thay thế nội
  dung text gốc một cách tổng quát; xuất annotation dạng native sửa được
  trong Acrobat. **[ĐÃ THỐNG NHẤT — DEC-017]**

### 4.2 Word Engine
- Mở DOCX, hiển thị đúng bố cục ở mức thực dụng cho học tập/làm việc. **[ĐÃ THỐNG NHẤT]**
- Chỉnh sửa nội dung văn bản trong tài liệu. **[ĐÃ THỐNG NHẤT]**
- Chú thích/viết tay phủ lên nội dung. **[ĐÃ THỐNG NHẤT]**
- Chấp nhận **mất một phần định dạng** khi nhập và xuất; không cam kết
  round-trip giữ nguyên định dạng; luôn giữ file DOCX gốc làm tài sản
  gốc, không ghi đè file gốc; **cảnh báo người dùng trước khi xuất DOCX**
  rằng định dạng có thể thay đổi. **[ĐÃ THỐNG NHẤT — DEC-018]**
- Ảnh WMF/EMF và công thức OMML trong DOCX gốc: trình duyệt không hiển thị
  trực tiếp; cần chiến lược chuyển đổi/dự phòng **[CHƯA XÁC MINH]** —
  xem ISSUE-003, ISSUE-004 (riêng OMML: có module tái sử dụng từ
  StudyWrite theo kết quả Luồng B của TASK-01).

### 4.3 Drawing Engine
- Bút viết, bút highlight, tẩy; nhiều màu; độ dày nét. **[ĐÃ THỐNG NHẤT]**
- Hỗ trợ bút cảm ứng (stylus) và chuột/cảm ứng thường. **[ĐÃ THỐNG NHẤT]**
- Lực nhấn (pressure) và làm mượt nét **[ĐỀ XUẤT]** — phụ thuộc Pointer Events
  của từng trình duyệt, xem ISSUE-006.
- Undo/redo cho nét vẽ. **[ĐỀ XUẤT]**
- Là engine vẽ **duy nhất** dùng chung cho cả 3 chế độ (Document, Split,
  Whiteboard). **[ĐÃ THỐNG NHẤT — DEC-015]**

### 4.4 Annotation Engine
- Chú thích dạng nét vẽ tự do + ghi chú chữ tại vị trí trên trang. **[ĐÃ THỐNG NHẤT]**
- Chú thích gắn với tài liệu và vị trí/trang, mở lại đúng chỗ. **[ĐÃ THỐNG NHẤT]**
- Ẩn/hiện lớp chú thích. **[ĐỀ XUẤT]**
- Dữ liệu chú thích/viết tay được tổ chức theo "bề mặt" (surface): trang tài
  liệu hoặc không gian bảng trắng — cùng một cấu trúc cho cả 3 chế độ.
  **[ĐÃ THỐNG NHẤT — DEC-015]**; mô hình Workspace/Surface chi tiết đã
  chốt. **[ĐÃ THỐNG NHẤT — DEC-020]**

### 4.5 Document Manager
- Danh sách tài liệu đã mở/lưu trên thiết bị, mở lại nhanh. **[ĐÃ THỐNG NHẤT]**
- Đổi tên, xóa tài liệu khỏi bộ nhớ thiết bị. **[ĐỀ XUẤT]**

### 4.6 Local Storage
- Toàn bộ tài liệu, chú thích, trạng thái lưu trên thiết bị (local-first). **[ĐÃ THỐNG NHẤT]**
- Tự lưu khi đang làm việc (không cần thao tác lưu thủ công); với Split
  Mode: tự lưu theo từng Surface. **[ĐÃ THỐNG NHẤT — DEC-020]**
- Giới hạn dung lượng theo trình duyệt phải được đo và thông báo rõ cho
  người dùng khi gần đầy. **[CHƯA XÁC MINH]** — xem ISSUE-005.
- **Sao lưu và khôi phục thư viện:** bản sao lưu gồm file gốc, annotation,
  metadata và cấu trúc workspace; có chức năng khôi phục từ bản sao lưu;
  cảnh báo và khuyến khích người dùng sao lưu định kỳ; không cam kết dữ
  liệu local còn vĩnh viễn trên Safari nếu người dùng không tương tác.
  **[ĐÃ THỐNG NHẤT — DEC-022]**

### 4.7 Export Engine
- Xuất PDF đã chú thích thành file PDF mới, annotation **flatten**.
  **[ĐÃ THỐNG NHẤT — DEC-017]**
- Xuất DOCX sau chỉnh sửa/chú thích thành file mới (không ghi đè gốc),
  có cảnh báo mất định dạng trước khi xuất. **[ĐÃ THỐNG NHẤT — DEC-018]**
- Xuất Split Mode: **riêng từng vùng** (tài liệu → file tài liệu; bảng
  trắng → file riêng). **[ĐÃ THỐNG NHẤT — DEC-021]**

### 4.8 PWA và Offline
- Cài đặt được lên màn hình chính (desktop + mobile). **[ĐÃ THỐNG NHẤT]**
- Mở và dùng đầy đủ khi không có mạng sau lần tải đầu. **[ĐÃ THỐNG NHẤT]**
- Phạm vi "đầy đủ" bị giới hạn bởi khả năng cache tài nguyên của trình
  duyệt. **[ĐÃ THỐNG NHẤT trong giới hạn đã biết]**
- Trên iOS: có hướng dẫn **Add to Home Screen**; cảnh báo rõ quy tắc
  Safari có thể xóa dữ liệu sau thời gian không tương tác nếu chưa cài
  app (xem thêm sao lưu ở mục 4.6). **[ĐÃ THỐNG NHẤT — DEC-022]**

### 4.9 Responsive UI
- Dùng tốt trên desktop, tablet, mobile; công cụ vẽ dễ chạm (kích thước
  nút đủ lớn trên cảm ứng). **[ĐÃ THỐNG NHẤT]**
- Bố cục thanh công cụ thay đổi theo chiều màn hình. **[ĐỀ XUẤT]**

## 5. Yêu cầu phi chức năng

- **Hiệu năng vẽ:** nét bút bám theo đầu bút, không giật khi viết nhanh.
- **Khởi động:** mở app và mở lại tài liệu gần nhất nhanh, kể cả offline.
- **Riêng tư:** không gửi tài liệu/chú thích của người dùng đi đâu.
- **Tương thích:** trình duyệt hiện đại trên Windows, macOS, Android, iOS.
- **Độ tin cậy:** mất mạng/đóng tab đột ngột không làm mất phần việc đã tự lưu.

## 6. Tiêu chí nghiệm thu ở cấp sản phẩm

1. Người dùng mới mở app lần đầu (có mạng), cài PWA, tắt mạng, vẫn mở lại
   app và dùng các chức năng cốt lõi.
2. Mở một PDF và một DOCX mẫu, viết/chú thích, đóng app, mở lại: chú thích
   còn nguyên, đúng vị trí.
3. Xuất được file PDF/DOCX từ tài liệu đã chú thích và mở được file xuất
   bằng ứng dụng văn phòng phổ biến.
4. Trải nghiệm viết tay không có độ trễ/giật thấy rõ trên tablet phổ thông.
5. Không có bước nào bắt buộc tạo tài khoản.
