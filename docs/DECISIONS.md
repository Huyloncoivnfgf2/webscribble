# DECISIONS — WebScribble

> Quyết định đã được **chủ dự án xác nhận**. AI không tự ý thay đổi; muốn đổi
> phải có xác nhận mới và ghi quyết định thay thế (giữ lại bản cũ, đánh dấu
> SUPERSEDED).

Định dạng: Decision ID · Nội dung · Lý do · Ngày ghi nhận · Trạng thái
(`ACTIVE` / `SUPERSEDED`).

---

## Nhóm quyết định nền tảng — ghi nhận 2026-10-30 (từ định hướng chủ dự án giao kèm TASK-00)

### DEC-001 — Nền tảng web trên trình duyệt
- **Nội dung:** WebScribble là ứng dụng web chạy trực tiếp trên trình duyệt.
- **Lý do:** Không cần cài phần mềm; dùng được ngay trên mọi thiết bị.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-002 — Cài đặt dạng PWA
- **Nội dung:** Ứng dụng cài đặt được dưới dạng PWA.
- **Lý do:** Trải nghiệm như app cài sẵn nhưng vẫn là web.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-003 — Hỗ trợ desktop, tablet, mobile
- **Nội dung:** Giao diện responsive cho cả ba nhóm thiết bị.
- **Lý do:** Người dùng học/làm việc trên nhiều thiết bị khác nhau.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-004 — Định dạng tài liệu: PDF, DOCX trước; mở rộng theo lộ trình
- **Nội dung:** Giai đoạn đầu hỗ trợ PDF và DOCX; định dạng khác bổ sung sau
  theo lộ trình.
- **Lý do:** Tập trung hai định dạng phổ biến nhất trong học tập/văn phòng.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-005 — PDF: xem, viết, chú thích, xuất
- **Nội dung:** Với PDF, các thao tác cốt lõi là xem, viết tay, chú thích và
  xuất file.
- **Lý do:** Đây là nhu cầu chính khi làm việc với PDF.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Lưu ý:** "Sửa nội dung gốc của PDF" không nằm trong quyết định này —
  xem ISSUE-007.

### DEC-006 — Word: vừa sửa nội dung, vừa chú thích
- **Nội dung:** Với DOCX, người dùng vừa chỉnh sửa được nội dung, vừa chú
  thích/viết tay.
- **Lý do:** Khác với PDF (chủ yếu chú thích), tài liệu Word cần sửa nội dung thật.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-007 — Offline đầy đủ sau lần tải đầu tiên
- **Nội dung:** Sau lần tải ứng dụng đầu tiên, mọi chức năng cốt lõi dùng
  được khi không có mạng, trong giới hạn khả năng của trình duyệt.
- **Lý do:** Học tập/làm việc không phụ thuộc kết nối mạng.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-008 — Local-first
- **Nội dung:** Dữ liệu người dùng (tài liệu, chú thích) lưu trên thiết bị
  của người dùng; không phụ thuộc máy chủ.
- **Lý do:** Riêng tư, tốc độ, và là điều kiện để offline thật sự.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-009 — Không bắt buộc tài khoản
- **Nội dung:** Người dùng dùng được toàn bộ chức năng cốt lõi mà không cần
  tạo tài khoản.
- **Lý do:** Giảm rào cản sử dụng; nhất quán với local-first.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-010 — Chức năng cốt lõi miễn phí
- **Nội dung:** Các chức năng cốt lõi của sản phẩm là miễn phí.
- **Lý do:** Định hướng sản phẩm của chủ dự án.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-011 — Ưu tiên trải nghiệm viết tay
- **Nội dung:** Trải nghiệm viết tay (mượt, chính xác, gần với trải nghiệm
  của ứng dụng ghi chú tham khảo Scribble Ink) là ưu tiên hàng đầu khi phải
  đánh đổi với tính năng khác.
- **Lý do:** Viết tay là giá trị cốt lõi phân biệt sản phẩm.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-012 — Không sao chép sản phẩm tham khảo
- **Nội dung:** Không sao chép mã nguồn, tài sản độc quyền hoặc giao diện có
  bản quyền của bất kỳ sản phẩm tham khảo nào; chỉ học hỏi trải nghiệm và tự
  xây dựng thực thi.
- **Lý do:** Tôn trọng bản quyền và tính độc lập của sản phẩm.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

---

## Nhóm quyết định bổ sung — ghi nhận 2026-10-30 (cập nhật bộ nhớ sau TASK-00)

### DEC-013 — WebScribble độc lập với StudyWrite; tái sử dụng module có chọn lọc (Phương án C)
- **Nội dung:** WebScribble là sản phẩm **độc lập** với StudyWrite. Được phép
  tận dụng **có chọn lọc** từng module của StudyWrite khi thỏa đủ 4 điều kiện:
  1. Đã đánh giá chất lượng module trước khi dùng.
  2. Đã kiểm tra quyền sử dụng và nguồn gốc mã nguồn của module.
  3. Đã đánh giá khả năng tách module ra khỏi StudyWrite.
  4. Không mặc định kế thừa toàn bộ kiến trúc/mã nguồn StudyWrite; không để
     WebScribble phụ thuộc bắt buộc vào StudyWrite.
- **Lý do:** Tận dụng kinh nghiệm/module đã kiểm chứng thực tế của StudyWrite
  (xử lý DOCX, bút vẽ) mà không đánh mất tính độc lập của sản phẩm mới.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Giải quyết ISSUE-009 (đánh dấu RESOLVED trong KNOWN_ISSUES.md).
  Việc đánh giá module được đưa vào phạm vi TASK-01.

### DEC-014 — Hệ thống 3 chế độ làm việc
- **Nội dung:** WebScribble có 3 chế độ làm việc chính:
  1. **Document Mode** — làm việc trên toàn bộ không gian một tài liệu
     (PDF, DOCX, PNG, JPG/JPEG và định dạng ảnh phổ biến khác theo lộ trình).
  2. **Split Mode** — một workspace gồm hai khu vực: tài liệu (PDF/Word/ảnh)
     và bảng trắng tự do; hai khu vực độc lập về nội dung, chỉnh được tỷ lệ.
  3. **Whiteboard Mode** — chỉ bảng trắng, không cần mở tài liệu.
  Kèm nguyên tắc: phải phân biệt rõ "chỉnh sửa nội dung gốc" với "chú thích/
  đối tượng phủ lên"; **không tuyên bố mọi định dạng đều hỗ trợ sửa nội dung
  gốc như nhau** (ma trận khả năng theo định dạng ở PRODUCT_SPEC.md mục 3).
- **Lý do:** Ba tình huống sử dụng khác nhau của người dùng: làm việc trên
  tài liệu, vừa đọc tài liệu vừa ghi chép, và ghi chép tự do không tài liệu.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE

### DEC-015 — Một Drawing Engine duy nhất cho cả 3 chế độ
- **Nội dung:** Cả 3 chế độ (Document, Split, Whiteboard) dùng chung **một**
  Drawing Engine. Cấm tạo hệ thống viết tay riêng cho từng chế độ. Sự khác
  nhau giữa các chế độ nằm ở "bề mặt" (surface) mà engine vẽ lên: trang tài
  liệu do Document Engine quản lý, không gian bảng trắng do Whiteboard
  Engine quản lý; Split Mode là lớp phối hợp hai bề mặt trong một workspace.
- **Lý do:** Nhất quán trải nghiệm viết tay (DEC-011), tránh trùng lặp code
  và lệch chất lượng nét bút giữa các chế độ.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Lưu ý:** Đây là định hướng kiến trúc đã được chủ dự án xác nhận ở cấp
  nguyên tắc; chi tiết kỹ thuật (mô hình surface, lưu trạng thái Split Mode)
  vẫn phải khảo sát ở TASK-01 và chốt ở TASK-02 — xem ISSUE-013.

---

## Nhóm quyết định TASK-02 — ghi nhận 2026-10-30 (chủ dự án xác nhận trên cơ sở kết quả TASK-01)

### DEC-016 — Chốt Technology Stack chính thức
- **Nội dung:** Stack chính thức của WebScribble: **React, TypeScript,
  Vite, Tailwind CSS (cài qua npm — cấm bản Play CDN), PDF.js, pdf-lib,
  Tiptap/ProseMirror, Mammoth.js, Zustand, IndexedDB với lớp quản lý
  Dexie, Canvas 2D, perfect-freehand.** Kèm các điều kiện bắt buộc:
  1. PDF.js phải dùng worker **đóng gói cùng ứng dụng** (không CDN).
  2. pdf-lib chỉ dùng để tạo PDF xuất ra có annotation phủ **flatten**.
  3. Tiptap **không** dùng bản Pro hoặc Cloud trả phí.
  4. Mammoth chỉ dùng để nhập/chuyển DOCX → HTML ngữ nghĩa; **phải
     sanitize** HTML đầu ra trước khi đưa vào editor; không cam kết bảo
     toàn định dạng DOCX.
  5. Toàn bộ dependency đóng gói local, không phụ thuộc CDN ở runtime.
  6. Chỉ dùng **Dexie** cho IndexedDB — không dùng đồng thời `idb` và
     Dexie nếu không có lý do kỹ thuật được phê duyệt riêng.
  7. Khi triển khai (TASK-03 trở đi), phải kiểm tra lại giấy phép và khả
     năng offline của **phiên bản dependency thực tế** được cài.
- **Lý do:** Kết quả khảo sát TASK-01 (TECH_SURVEY.md): toàn bộ danh sách
  có khuyến nghị USE / USE WITH CONDITIONS, giấy phép toàn MIT/Apache-2.0/
  BSD/ISC (đã kiểm chứng qua npm registry ngày 2026-10-30), mọi thư viện
  đều đóng gói qua npm được nên đáp ứng DEC-007 (offline) và DEC-010 (lõi
  miễn phí — tránh thành phần trả phí).
- **Phạm vi:** Toàn bộ dự án, từ TASK-03 trở đi.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Đóng ISSUE-001 (RESOLVED). Các điểm UNVERIFIED còn lại
  (giới hạn canvas iOS, bộ nhớ pdf-lib, html-to-docx) không thuộc quyết
  định này — vẫn theo dõi trong TECH_SURVEY mục 7 theo từng task.

### DEC-017 — Phạm vi PDF: xem + chú thích phủ + xuất flatten (cụ thể hóa DEC-005)
- **Nội dung:** PDF có: mở/xem, hiển thị nhiều trang, viết tay/vẽ lên PDF,
  highlight/gạch chân/ghi chú và các annotation phù hợp; **annotation lưu
  riêng** tách khỏi file gốc; **file PDF gốc được bảo vệ, không sửa**;
  xuất ra PDF mới có annotation đã **flatten**.
  **Không cam kết:** sửa trực tiếp text gốc trong PDF; xóa/thay thế nội
  dung text gốc một cách tổng quát; xuất annotation dạng native sửa được
  trong Acrobat.
- **Lý do:** Bằng chứng TASK-01: pdf-lib (và mọi thư viện JS client-side
  phổ biến) không có API sửa/xóa text trên trang ngoài form field — cam
  kết ngược lại sẽ là hứa hẹn không thực hiện được.
- **Phạm vi:** PDF Engine (TASK-06) và Export Engine (TASK-09).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Đóng ISSUE-007 (RESOLVED theo hướng này).

### DEC-018 — Phạm vi Word/DOCX: sửa nội dung, chấp nhận mất định dạng (cụ thể hóa DEC-006)
- **Nội dung:** DOCX có: nhập DOCX; chuyển nội dung sang cấu trúc sửa
  được trong editor; chỉnh sửa nội dung; viết tay/chú thích; xuất DOCX
  mới. Kèm giới hạn bắt buộc:
  1. **Chấp nhận mất một phần định dạng** khi nhập và khi xuất; **không
     cam kết round-trip giữ nguyên định dạng**.
  2. **Luôn giữ file DOCX gốc làm tài sản gốc; không ghi đè file gốc.**
  3. **Hiển thị cảnh báo cho người dùng trước khi xuất DOCX** rằng định
     dạng có thể thay đổi.
  4. Không mua Tiptap Pro, không dùng dịch vụ Cloud trả phí (khớp DEC-016).
  5. Xuất DOCX bằng cách tự map mô hình editor → thư viện `docx` (MIT).
- **Lý do:** Bằng chứng TASK-01 từ tài liệu chính thức: Mammoth chủ động
  bỏ chi tiết định dạng để lấy HTML ngữ nghĩa; Tiptap ép nội dung qua
  schema — mất mát hai chiều là chắc chắn, nên phải chốt kỳ vọng trung
  thực thay vì cam kết round-trip.
- **Phạm vi:** Word Engine (TASK-07) và Export Engine (TASK-09).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Đóng ISSUE-002 và ISSUE-010 ở cấp phạm vi/kỳ vọng (RESOLVED);
  việc đo độ mất mát cụ thể bằng prototype vẫn nằm trong tiêu chí nghiệm
  thu của TASK-07.

### DEC-019 — Whiteboard giai đoạn đầu: trang cố định, chưa làm Infinite Canvas
- **Nội dung:** Giai đoạn đầu Whiteboard dùng **trang trắng kích thước cố
  định**; **chưa triển khai Infinite Canvas**. Kiến trúc dữ liệu phải cho
  phép mở rộng sang Infinite Canvas sau này (tọa độ stroke dạng float theo
  hệ tọa độ bề mặt, mọi stroke có `bbox`, camera/view tách khỏi dữ liệu
  đối tượng, Drawing Engine nhận bề mặt qua giao diện có transform) và
  **không được thiết kế theo cách khiến việc mở rộng phải viết lại toàn
  bộ Drawing Engine**.
- **Lý do:** Khuyến nghị Luồng C của TASK-01: Infinite Canvas kéo theo
  spatial index, viewport culling, minimap, quyết định vùng xuất và quản
  lý cử chỉ camera — chi phí lớn, trong khi giá trị cốt lõi là chất
  lượng nét bút trên tài liệu (DEC-011); trang cố định đã đáp ứng phần
  lớn nhu cầu ghi chú tự do và xuất PDF tự nhiên.
- **Phạm vi:** Whiteboard Engine (TASK-12), mô hình dữ liệu (TASK-02/08).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Đóng ISSUE-012 (RESOLVED — quyết định trì hoãn có điều kiện
  dữ liệu đi kèm; mở lại khi có quyết định triển khai Infinite Canvas).

### DEC-020 — Kiến trúc Split Mode: Workspace / Surface (cụ thể hóa DEC-014/015)
- **Nội dung:** Chốt mô hình: **Workspace** là đối tượng quản lý tổng thể,
  **tham chiếu hai Surface** — Document Surface và Whiteboard Surface.
  Mỗi Surface có dữ liệu và trạng thái (view) riêng; **tự lưu theo từng
  Surface**; **Undo/Redo hoạt động riêng theo từng Surface**; Workspace
  và trạng thái hai vùng phải khôi phục được sau khi mở lại ứng dụng.
  Không tạo hai Drawing Engine độc lập — tiếp tục một Drawing Engine
  dùng chung theo DEC-015.
- **Lý do:** Mô hình đề xuất từ Luồng C của TASK-01: tự lưu theo bề mặt
  giới hạn mất dữ liệu ở nét đang vẽ dở; undo theo bề mặt tránh hoàn tác
  nhầm vào vùng người dùng không đang nhìn; tham chiếu (không nhúng dữ
  liệu) cho phép một bảng trắng dùng cả ở Whiteboard Mode lẫn Split Mode.
- **Phạm vi:** Application Core, Data Layer (TASK-08), Split Mode (TASK-13).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Đóng ISSUE-013 (RESOLVED ở cấp mô hình; cài đặt thuộc TASK-13).

### DEC-021 — Xuất Split Mode: phương án B — xuất riêng từng vùng
- **Nội dung:** Xuất Split Mode theo **phương án B**: Document Surface
  xuất thành file tài liệu tương ứng; Whiteboard Surface xuất thành file
  riêng. Giai đoạn đầu **không bắt buộc ghép hai vùng thành một file** và
  không tạo định dạng xuất phức tạp chỉ để giữ bố cục workspace.
- **Lý do:** Trong 4 phương án nghiên cứu ở Luồng C (TASK-01), phương án
  B đơn giản nhất về kỹ thuật và cho mỗi vùng dùng engine xuất tốt nhất
  của nó (PDF/DOCX cho tài liệu; PDF/PNG cho bảng trắng), tái dùng
  nguyên Export Engine của Document Mode và Whiteboard Mode.
- **Phạm vi:** Export Engine (TASK-09), Split Mode (TASK-13).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Giải quyết phần "xuất Split Mode" của ISSUE-014.

### DEC-022 — iOS Offline và Sao lưu/Khôi phục là yêu cầu sản phẩm bắt buộc
- **Nội dung:** Chốt các yêu cầu sản phẩm:
  1. Có hướng dẫn **Add to Home Screen trên iOS** và hướng dẫn cài đặt
     PWA trên các nền tảng phù hợp.
  2. Có chức năng **sao lưu** và **khôi phục** thư viện: bản sao lưu phải
     gồm **file gốc, annotation, metadata và cấu trúc workspace** cần
     thiết — không chỉ danh sách tên file.
  3. **Không cam kết dữ liệu local được bảo toàn vĩnh viễn trên Safari**
     nếu người dùng không tương tác (chính sách ITP 7 ngày của WebKit);
     có cảnh báo và khuyến khích người dùng **sao lưu định kỳ**.
- **Lý do:** Bằng chứng TASK-01 từ WebKit chính thức: storage bị xóa sau
  7 ngày không tương tác nếu app chưa cài vào Màn hình chính; local-first
  (DEC-008) không có bản sao trên máy chủ nên sao lưu phía người dùng là
  lớp bảo vệ duy nhất.
- **Phạm vi:** PWA/Offline (TASK-10), Local Storage (TASK-08), trải
  nghiệm người dùng trên iOS.
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Bổ sung yêu cầu vào PRODUCT_SPEC mục 4.6/4.8 và tiêu chí
  nghiệm thu; giảm nhẹ nhưng **không đóng** ISSUE-005 (đo quota thực tế
  vẫn cần làm ở TASK-08).

### DEC-023 — HEIC giai đoạn đầu: chưa tích hợp decoder
- **Nội dung:** Giai đoạn đầu **chưa tích hợp WASM decoder cho HEIC**.
  Nếu trình duyệt không hỗ trợ HEIC (mọi trình duyệt ngoài Safari ≥17),
  ứng dụng hiển thị **thông báo định dạng chưa được hỗ trợ** — không lỗi
  im lặng, và không ảnh hưởng khả năng mở các định dạng ảnh khác. Có thể
  xem xét bổ sung HEIC ở giai đoạn sau.
- **Lý do:** Bằng chứng TASK-01 (Luồng C): HEIC chỉ hiển thị native trên
  Safari ≥17; hỗ trợ nơi khác đòi hỏi decoder libheif/WASM dạng
  lazy-load — chi phí và độ phức tạp chưa tương xứng ở giai đoạn đầu so
  với các định dạng hiển thị trực tiếp (PNG/JPG/WebP/GIF/BMP).
- **Phạm vi:** Document Mode cho tài liệu ảnh (TASK-06 phạm vi ảnh).
- **Ngày:** 2026-10-30 · **Trạng thái:** ACTIVE
- **Hệ quả:** Giải quyết phần "HEIC" của ISSUE-014.

---

## Nhóm quyết định bổ sung — ghi nhận 2026-10-31 (chủ dự án phê duyệt các đề xuất từ TASK-05A)

### DEC-024 — Vitest là test runner chính thức (từ PROP-001)
- **Nội dung:** Vitest là test runner chính thức của dự án (bản cài đầu
  tiên: 5.0.5, MIT). Unit test đặt trong thư mục `tests/`, chạy bằng
  `npm run test`; task có logic thuần phải kèm unit test.
- **Lý do:** Tích hợp tự nhiên với Vite/TypeScript/ESM của dự án
  (DEC-016), không cần cấu hình thêm; đã kiểm chứng thực tế ở TASK-05A
  (48 test đạt ngay lần chạy đầu).
- **Phạm vi:** Toàn dự án, từ TASK-05A trở đi.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-025 — Quy ước thời gian của StrokePoint: mili-giây tương đối (từ PROP-002)
- **Nội dung:** Trường `time` của mỗi điểm trong một nét vẽ là số
  mili-giây **tương đối kể từ điểm đầu tiên của nét đó** (điểm đầu = 0)
  và không giảm dần trong cùng một nét. Đây là một phần của định dạng
  dữ liệu nét vẽ — thay đổi quy ước này sau này phải có migration.
- **Lý do:** Đủ để tái hiện tốc độ/áp lực khi render và phát lại nét;
  nhỏ gọn, không phụ thuộc đồng hồ hệ thống, ổn định khi lưu trữ và sao
  lưu (DEC-022).
- **Phạm vi:** Mô hình dữ liệu Drawing Engine (TASK-05) và persistence
  (TASK-08).
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-026 — TextObject tự mang kích thước vùng chứa (từ PROP-003)
- **Nội dung:** Object `text` lưu `width`/`height` của vùng chứa văn
  bản; lớp tạo/sửa text chịu trách nhiệm đo và cập nhật hai giá trị
  này. Tầng dữ liệu của Drawing Engine **không tự đo văn bản**.
- **Lý do:** Nhờ vậy bounds của text luôn tính và kiểm chứng được ngay
  ở tầng dữ liệu (validation đối chiếu bounds), không phụ thuộc
  renderer/canvas — đo text cần ngữ cảnh đồ họa mà tầng dữ liệu không có.
- **Phạm vi:** Mô hình dữ liệu Drawing Engine (TASK-05) và công cụ text
  ở các task sau.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-027 — Định dạng sao lưu thư viện và chính sách khôi phục merge-remap (TASK-08C)
- **Nội dung:**
  1. Định dạng backup là **một file ZIP** tạo/đọc bằng JSZip
     (đóng gói local): `manifest.json` + `data/annotations.json` +
     `data/contents.json` + `files/<documentId>` chứa bytes Blob
     gốc nguyên vẹn. Không base64 hóa Blob vào JSON.
  2. Manifest mang `backupFormatVersion` **độc lập** với phiên
     bản schema Dexie và với schemaVersion của từng loại record;
     kèm thời điểm tạo, thống kê số lượng, và **SHA-256 của từng
     file thành phần** (Web Crypto). Restore kiểm chứng toàn bộ
     (định dạng, version, cấu trúc, quan hệ không-mồ-côi,
     checksum) **trước khi ghi bất cứ thứ gì**.
  3. Chính sách khôi phục duy nhất là **merge an toàn**: không
     ghi đè, không xóa dữ liệu hiện có, không có chế độ thay thế
     toàn bộ. Document trùng ID được nhập thành **bản sao với ID
     mới**; annotation (documentId + surfaceId) và
     documentContents (documentId) được remap nhất quán; toàn bộ
     lần ghi nằm trong **một transaction Dexie** trên cả ba bảng
     — lỗi giữa chừng → hủy toàn bộ, thư viện giữ nguyên.
  4. Nội dung DOCX trong backup giữ nguyên dạng JSON Content
     Model (không chuyển HTML); Blob gốc giữ nguyên từng byte.
- **Lý do:** DEC-022 bắt buộc sao lưu/khôi phục cho iOS; ZIP +
  checksum cho phép kiểm chứng độc lập và mang theo Blob nhị
  phân không phình dữ liệu; merge-remap là chính sách duy nhất
  không thể làm mất dữ liệu hiện có — phù hợp nguyên tắc
  local-first và không có tài khoản/máy chủ để hòa giải xung đột.
- **Phạm vi:** `src/data/backup/` và panel Sao lưu & Khôi phục
  trong thư viện (TASK-08C). Whiteboard/Workspace entities sẽ
  phải tham gia định dạng này khi TASK-12/13 triển khai (tăng
  `backupFormatVersion` nếu cần).
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-028 — Kênh fidelity DOCX và Content Model version 2 (TASK-07C)
- **Nội dung:**
  1. Content Model nâng lên **version 2** (DOCUMENT_CONTENT_
     VERSION = 2), mở rộng TƯƠNG THÍCH NGƯỢC: marks
     `superscript`, `subscript`, `textStyle` (attrs color/
     backgroundColor/fontSize/fontFamily bị chặn mẫu an
     toàn); `textAlign` trên paragraph/heading; `background`,
     `colspan`, `rowspan` trên ô bảng; `width`/`height` trên
     ảnh. Giá trị null do Tiptap phát ra cho attr chưa đặt
     được coi là vắng mặt. Nội dung version 1 là tập con hợp
     lệ; KHÔNG đổi schema Dexie, không cần migration dữ
     liệu — bản ghi cũ mở bình thường và được ghi lại thành
     version 2 khi lưu lần tiếp theo.
  2. Hai kênh fidelity khi nhập DOCX:
     a. **Định dạng ký tự trực tiếp** (cỡ chữ, highlight,
        font): Mammoth đọc được từ rPr nhưng không xuất
        HTML → dùng `transformDocument` hai lượt: lượt 1
        thu thập token, lượt 2 đổi styleName của run thành
        tên tự sinh + STYLE MAP ĐỘNG để run được bọc trong
        span mang class `ws-*`; converter giải mã class
        thành mark textStyle. Định dạng đi cùng run — không
        đối chiếu vị trí.
     b. **Luồng document.xml có guard** (căn lề đoạn, kích
        thước ảnh từ wp:extent, nền ô từ w:shd): đối chiếu
        thứ tự tài liệu giữa XML và HTML; chỉ áp dụng khi
        SỐ LƯỢNG hai phía khớp đúng, lệch → bỏ qua cả luồng
        (thà thiếu định dạng còn hơn gán nhầm).
  3. Chấp nhận mất mát có ghi nhận: **màu chữ** (Mammoth
     không hề đọc `w:color` — bằng chứng trong source của
     thư viện), thụt lề và khoảng cách đoạn, border bảng
     tùy biến — hoãn sang vòng fidelity sau nếu có.
- **Lý do:** Audit TASK-07C đo trên fixture thật cho thấy
  các mất mát lớn nhất đều có kênh truyền an toàn; hai
  kênh trên giữ nguyên nguyên tắc "không bao giờ gán sai"
  và không đụng file gốc hay pipeline PDF/annotation.
- **Phạm vi:** `src/engines/word/` (importer, enrichment,
  htmlToContent, contentModel), extensions/toolbar của
  Word Editor. TASK-07E (xuất DOCX) sẽ map các attrs/marks
  version 2 này ra file xuất.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-029 — Mô hình annotation cho DOCX: một surface, tọa độ nội dung tuyệt đối (TASK-07D)
- **Nội dung:**
  1. DOCX dùng **một surface annotation duy nhất** cho cả
     tài liệu theo quy ước sẵn có `document:<documentId>:0`
     (pageIndex 0), qua chính Annotation Engine và Drawing
     Engine dùng chung (DEC-015) — không có engine/store
     riêng cho DOCX. Lưu trữ, autosave, undo/redo, backup
     dùng lại toàn bộ hạ tầng của PDF.
  2. Hệ tọa độ world của surface là **không gian nội dung
     editor (CSS px, zoom 1)**, gốc tại góc trên-trái của
     thẻ trang; canvas phủ kín thẻ trang và cuộn cùng nội
     dung. Chế độ Sửa văn bản: canvas `pointer-events:
     none` + editor editable; chế độ Chú thích: canvas
     nhận toàn bộ pointer + editor khóa sửa. pageSize
     khai cho surface là khung danh nghĩa lớn theo chiều
     dọc (metadata, không cắt nét).
  3. **Giới hạn chấp nhận và công bố cho người dùng:**
     annotation neo theo tọa độ tuyệt đối — KHÔNG bám
     theo chữ khi sửa nội dung hoặc khi cửa sổ đổi chiều
     ngang làm chữ xuống dòng lại. Nét vẽ vẫn được bảo
     toàn dữ liệu và vị trí tuyệt đối; độ lệch tương đối
     so với chữ là đánh đổi của version 1 (neo theo vị
     trí ký tự đòi hỏi mô hình neo văn bản riêng).
  4. Vòng đời phiên: controller chú thích sống trong
     registry theo documentId qua các lần mount; rời
     editor bằng nút Thư viện phải flush xong cả nội
     dung lẫn chú thích mới được rời.
- **Lý do:** Nhất quán với kiến trúc một-Drawing-Engine
  (DEC-015) và kế hoạch TASK-07-SCOPE đã duyệt; mô hình
  một surface khớp thực tế DOCX không có trang cố định
  trong editor web.
- **Phạm vi:** `DocxAnnotationController` + tích hợp
  trong WordEditor (TASK-07D). Xuất DOCX kèm chú thích
  KHÔNG thuộc phạm vi (TASK-07E chỉ xuất nội dung).
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-030 — Xuất DOCX và bản in kèm chú thích (TASK-07E)
- **Nội dung:**
  1. Xuất nội dung đã sửa bằng thư viện `docx` (MIT,
     đóng gói local): Content Model → document.xml qua
     ánh xạ trực tiếp (không qua HTML). Tên file mặc
     định `<tên gốc>_edited.docx` (làm sạch ký tự cấm,
     người dùng sửa được trong dialog). File gốc trong
     thư viện KHÔNG BAO GIỜ bị ghi đè bởi luồng xuất —
     kết quả chỉ là Blob tải xuống (DEC-005/DEC-018,
     kèm cảnh báo mất định dạng trong dialog).
  2. File DOCX xuất ra chỉ chứa NỘI DUNG VĂN BẢN.
     Chú thích viết tay (DEC-029) không nhúng vào
     DOCX — đúng mô hình lớp phủ độc lập.
  3. Bản phẳng kèm chú thích ở version 1 = **In / Lưu
     PDF qua hộp thoại in của trình duyệt**: lớp in
     chỉ gồm thẻ trang + ảnh chụp canvas chú thích ở
     độ phân giải bitmap thật (CSS × DPR) thay cho
     canvas sống. Sinh file PDF bằng code (pdf-lib)
     vẫn thuộc Export Engine của TASK-09, không gộp
     vào task này.
  4. Ánh xạ highlight khi xuất: hex khớp bảng màu
     Word → `w:highlight` (đọc lại được khi nhập);
     hex khác → shading của run (Word hiển thị đúng,
     importer không đọc lại shading của run — đánh
     đổi đã ghi nhận). Mỗi danh sách số dùng một
     numbering reference riêng để bắt đầu lại từ 1.
  5. Sửa ở importer (phát hiện nhờ round-trip của
     task này): phần tử `<w:tblHeader w:val="off"/>`
     (hàng bị tắt cờ tiêu đề tường minh, do chính
     thư viện `docx` và một số trình sinh file ghi)
     được gỡ trước khi qua Mammoth — Mammoth chỉ nhìn
     sự hiện diện của phần tử nên trước đây mọi hàng
     đều thành hàng tiêu đề khi nhập lại.
- **Lý do:** DEC-016 đã chốt thư viện `docx` cho chiều
  xuất; in qua trình duyệt cho bản PDF phẳng ngay mà
  không thêm dependency raster hóa DOM nặng và kém
  tin cậy, trong khi sinh PDF bằng code đã có nhà là
  TASK-09.
- **Phạm vi:** `exportDocx.ts` (Word Engine),
  dialog Xuất bản + `printExport.ts` + CSS in trong
  WordEditor (TASK-07E).
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-031 — Bảng trắng là một tài liệu thư viện, manifest trong Blob (TASK-12)

- **Bối cảnh:** TASK-12 cần thực thể bảng trắng nhiều trang
  (DEC-019: trang cố định) dùng chung Drawing Engine
  (DEC-015), autosave và tương thích 100% với backup ZIP
  của TASK-08C (DEC-027). Thêm bảng Dexie mới sẽ phá vỡ
  cả ba ràng buộc đó (backup không biết tới bảng mới,
  cascade xóa phải sửa, định dạng backup phải đổi).
- **Quyết định:** (1) Bảng trắng là MỘT tài liệu trong
  bảng `documents` hiện có với mime riêng
  `application/vnd.webscribble.whiteboard`; số trang
  đồng bộ vào `pageCount` để thẻ thư viện hiển thị sẵn.
  (2) Cấu trúc bảng (phiên bản định dạng, kích thước
  trang cố định 1600×1000, nền từng trang) lưu thành
  manifest JSON trong chính Blob của tài liệu — thay
  Blob qua `DocumentRepository.replaceBlob` (chỉ dùng
  cho bảng trắng; Blob PDF/DOCX là file gốc, không bao
  giờ thay). (3) Nét vẽ trang i dùng đúng quy ước
  surface sẵn có `document:<id>:<i>` và Annotation
  Engine — không surface namespace mới. Nhờ vậy backup/
  restore/remap/xóa cascade của TASK-08C áp dụng nguyên
  vẹn, không đổi `backupFormatVersion`. (4) Thao tác
  đổi cấu trúc trang (xóa/đổi thứ tự) remap annotation
  bằng thuật toán hai pha qua surface staging
  `whiteboard-stage:<id>:<token>:<newIndex>` (bản sao
  staging xong mới ghi đè đích; dọn staging ở pha cuối
  và quét lại mỗi lần mở bảng), đồng thời BẮT BUỘC viết
  lại trường `surfaceId` bên trong từng DrawingObject
  cho khớp surface đích — Annotation Engine kiểm chứng
  trường này khi mở surface (lỗi invalid-data đã tái
  hiện và có test regression nếu bỏ sót). (5) Nền trang
  (trơn trắng/tối/kẻ ngang/lưới caro/chấm) là dữ liệu
  manifest + hiển thị bằng CSS — tách biệt hoàn toàn
  khỏi dữ liệu nét vẽ nên đổi nền không bao giờ làm
  lệch hay mất nét. (6) Undo/redo theo từng trang trong
  phiên mở (ngăn xếp của Drawing Engine); nét khôi phục
  từ lưu trữ không nằm trong ngăn xếp undo của phiên
  mới — nhất quán với Document Mode.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-032 — Split Mode: phối hợp bằng adapter + vết liên kết ở localStorage (TASK-13)

- **Bối cảnh:** TASK-13 cần hai bề mặt độc lập tuyệt đối
  (DEC-020: dữ liệu/autosave/undo riêng) trên một khung
  có thanh công cụ chung, đồng thời khôi phục được cặp
  tài liệu + bảng trắng gần nhất (ISSUE-013 đã chốt mô
  hình tham chiếu ở TASK-02).
- **Quyết định:** (1) Mỗi pane giữ nguyên controller
  của mode gốc (PdfViewerController / WordEditor +
  DocxAnnotationController / WhiteboardController) —
  Split không sửa engine hay controller nào. (2) Lớp
  phối hợp là `SplitController` framework-free với
  `DrawingPaneAdapter`: bọc thống nhất ba controller
  về một giao diện công cụ (tool/màu/cỡ nét/undo/redo +
  subscribe); thanh công cụ chung chỉ route tới
  adapter của pane ACTIVE, pane còn lại không nhận
  lệnh nào. Pane PDF khai capabilities màu/cỡ nét =
  false (viewer PDF dùng style mặc định của engine từ
  TASK-06E) nên router chặn hai nhóm lệnh đó ở pane
  này. Với pane DOCX, chọn công cụ vẽ qua thanh chung
  tự chuyển editor sang chế độ Chú thích. (3) Vết
  liên kết phiên (documentId, whiteboardId, tỉ lệ,
  pane active) là trạng thái giao diện của thiết bị —
  lưu ở localStorage (`webscribble:split-session:v1`),
  KHÔNG đưa vào backup thư viện: dữ liệu thật của hai
  bề mặt vẫn ở Dexie và được backup như thường; máy
  khác khôi phục backup sẽ không có vết Split, đúng
  bản chất phiên cục bộ. (4) Bố cục: resizer kéo tay
  (tỉ lệ clamp 0.15–0.85) + mốc nhanh 30/70, 50/50,
  70/30 + thu gọn từng pane; dưới 768px chuyển dạng
  tab một chạm, cả hai pane giữ mounted (ẩn bằng CSS)
  để không mất phiên vẽ. (5) Liên kết sai vai (id bảng
  trắng gắn vào ô tài liệu) được workspace tự chuyển
  sang pane phải.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-033 — Export Engine: flatten PDF bằng pdf-lib qua ánh xạ viewport của PDF.js (TASK-09)

- **Bối cảnh:** DEC-017 chốt PDF chỉ xem + chú thích phủ,
  xuất bản flatten khi chia sẻ. TASK-07E đã xử lý phía
  DOCX (DEC-030); sinh PDF bằng code thuộc TASK-09.
- **Quyết định:** (1) Engine ở `src/engines/pdf/
  exportPdf.ts`, dùng pdf-lib 1.17.1 (MIT), 100%
  client-side; file gốc không bao giờ bị ghi đè — mọi
  thao tác trên bản sao trong RAM, kết quả là Blob mới
  để tải xuống (DEC-005). (2) Ánh xạ tọa độ: world
  (khung trang hiển thị tại scale 1, đơn vị điểm PDF)
  → PDF user space đi qua `convertToPdfPoint` của
  PageViewport qua `createPdfAnnotationMapping` —
  đúng đường overlay hiển thị dùng, nên khớp 1:1 ở
  mọi rotation; điểm theo gốc CropBox được cộng
  offset CropBox khi vẽ bằng pdf-lib (user space gốc
  MediaBox). (3) Hai chế độ: VECTOR — outline
  perfect-freehand (cùng `strokeOutlinePoints` của
  renderer) → `drawSvgPath`, hình khối → primitive
  pdf-lib, chữ → Helvetica chuẩn (ký tự ngoài WinAnsi
  bỏ kèm cảnh báo vì phông chuẩn không nhúng được
  tiếng Việt); RASTER — vẽ lại bằng chính `drawObject`
  của Drawing Engine ở tỉ lệ 3× rồi nhúng PNG phủ
  trang (giữ được mọi loại object kể cả chữ tiếng
  Việt). (4) Phạm vi trang: tất cả, hoặc chỉ trang
  có chú thích (tạo tài liệu mới bằng copyPages).
  (5) UI dùng chung một `PdfExportDialog` cho
  Document Mode và Split Mode, có tiến trình theo
  trang; tùy chọn "PDF gốc (sạch)" tải xuống chính
  Blob gốc.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-034 — PWA: Service Worker tự sinh ở bước build, pre-cache toàn bộ dist (TASK-10)

- **Bối cảnh:** DEC-002/DEC-011 yêu cầu offline đầy đủ
  sau lần tải đầu và cài đặt được lên thiết bị. App
  không có backend; mọi dữ liệu đã ở IndexedDB. Phần
  còn thiếu duy nhất là app shell chạy offline.
- **Quyết định:** (1) Không dùng vite-plugin-pwa: một
  script build riêng (`scripts/generate-sw.mjs`) quét
  toàn bộ `dist/` sau `vite build`, tính phiên bản =
  hash nội dung các file, và sinh `dist/sw.js` với
  danh sách pre-cache đầy đủ (HTML, bundle JS/CSS đã
  hash, PDF.js worker, icons, manifest) — không phụ
  thuộc vào vòng đời hỗ trợ Vite của plugin ngoài.
  (2) Chiến lược: install pre-cache toàn bộ + KHÔNG
  tự skipWaiting (bản mới chờ người dùng bấm "Cập
  nhật" trong app); activate xóa cache khác phiên
  bản + claim; fetch GET cùng origin: điều hướng →
  index.html từ cache (SPA offline), tài nguyên →
  cache-first (thiếu thì mạng + lưu bổ sung). Mọi
  `cache.match` đều dùng `ignoreVary: true` — bài
  học QA thực tế: máy chủ tĩnh trả `Vary: Origin`
  cho assets, không bỏ qua Vary thì bản cache không
  khớp request của trình duyệt và app gãy offline
  dù cache đầy đủ. (3) Manifest tĩnh ở `public/`,
  icons PNG sinh bằng script thuần Node
  (`scripts/generate-icons.mjs`, không thêm
  dependency đồ họa). (4) UI: `PwaStatus` — banner
  cập nhật, nút cài đặt từ `beforeinstallprompt`
  (ẩn khi đã standalone), huy hiệu ngoại tuyến kèm
  khẳng định dữ liệu an toàn trên thiết bị. Đăng ký
  SW chỉ ở bản production.
- **Ngày:** 2026-10-31 · **Trạng thái:** ACTIVE

### DEC-035 — Nền giấy dùng chung: một mô hình, Dexie v3 cộng thêm, khóa ảnh suy dẫn (TASK-14C)

- **Bối cảnh:** TASK-12 chỉ có 5 nền dạng chuỗi trong
  manifest whiteboard. TASK-14C cần 10 loại nền cho cả
  PDF, DOCX và giấy trắng, nền lưu theo tài liệu, ảnh
  nền tải lên, và không được mất dữ liệu/migration
  nguy hiểm cho dữ liệu hiện có.
- **Quyết định:** (1) Mô hình dữ liệu duy nhất
  `PaperBackground {kind, spacingPx?}` sống ở Data
  Layer (`src/data/types.ts`) gồm 10 loại: blank,
  dark (bảng đen), ruled (kẻ dòng — spacing 24/32/40),
  grid (kẻ ô vuông), dot-grid (lưới chấm), dots (chấm
  so le), graph (lưới caro), math (kẻ toán), music
  (kẻ nhạc), image (ảnh tải lên). `normalizePaper-
  Background` nhận cả chuỗi WhiteboardBackground cũ
  (ánh xạ 1-1) lẫn object; giá trị lạ về blank, không
  bao giờ ném lỗi. (2) Whiteboard manifest GIỮ
  version 1: nền trang từ nay ghi dạng object, parser
  chấp nhận cả hai dạng — app cũ đọc manifest mới chỉ
  suy biến nền về trắng chứ không lỗi; tăng version
  sẽ làm app cũ từ chối toàn bộ manifest nên không
  làm vậy. (3) Dexie schema v3 CỘNG THÊM hai bảng:
  `documentBackgrounds` (nền theo tài liệu cho
  PDF/DOCX) và `backgroundImages` (Blob ảnh nền) —
  cùng khuôn migration cộng thêm của v2; xóa tài
  liệu cascade mở rộng sang cả hai bảng. (4) Khóa
  ảnh SUY DẪN `<documentId>:<slot>` (slot `main`
  cho tài liệu, `page-<i>` cho trang whiteboard):
  restore backup đổi ID tài liệu thì khóa ảnh tự đi
  theo, không phải viết lại tham chiếu ở đâu cả;
  WhiteboardStore remap slot ảnh khi xóa/đổi thứ tự
  trang bằng đúng bản đồ trang của annotation. (5)
  Backup GIỮ format version 1, mở rộng tùy chọn:
  `data/backgrounds.json` (checksum như các file dữ
  liệu khác) + file bytes ảnh + counts tùy chọn —
  app mới đọc được backup cũ, backup mới khôi phục
  trọn nền + ảnh; app cũ đọc backup mới bỏ qua phần
  nền một cách an toàn. (6) Ảnh nền: MIME thuộc
  {PNG, JPEG, WebP, GIF} VÀ chữ ký byte đầu phải
  khớp, tối đa 5MB, lưu Blob nguyên vẹn. (7) Trình
  bày dùng chung: `paperBackgroundStyle` + thành
  phần `BackgroundPicker` cho cả ba bề mặt; hiển thị
  theo bản chất từng bề mặt — whiteboard: nền của
  chính trang; DOCX: nền thẻ trang editor (bảng đen
  đồng thời chuyển chữ nội dung sang sáng); PDF: lớp
  DƯỚI trang (trang PDF trong suốt ở vùng không nội
  dung nên giấy hiện xuyên qua vùng trống; nền trắng
  trơn giữ nguyên hiển thị cũ). Xuất PDF/DOCX không
  bị ảnh hưởng bởi nền.
- **Ngày:** 2026-11-01 · **Trạng thái:** ACTIVE

---

## Đề xuất chờ xác nhận — CHƯA PHẢI QUYẾT ĐỊNH

> Các mục dưới đây do trợ lý đề xuất trong quá trình triển khai, **chưa
> được chủ dự án phê duyệt**. Chúng không có hiệu lực như DEC ở trên;
> khi được xác nhận sẽ chuyển thành DEC với số thứ tự tiếp nối.

- PROP-001, PROP-002, PROP-003 (đề xuất tại TASK-05A, 2026-10-31) đã
  được chủ dự án **phê duyệt ngày 2026-10-31** và chuyển thành quyết
  định chính thức **DEC-024, DEC-025, DEC-026** ở trên.
- (Chưa có đề xuất nào khác đang chờ.)
