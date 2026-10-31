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

---

## Đề xuất chờ xác nhận — CHƯA PHẢI QUYẾT ĐỊNH

> Các mục dưới đây do trợ lý đề xuất trong quá trình triển khai, **chưa
> được chủ dự án phê duyệt**. Chúng không có hiệu lực như DEC ở trên;
> khi được xác nhận sẽ chuyển thành DEC với số thứ tự tiếp nối.

- PROP-001, PROP-002, PROP-003 (đề xuất tại TASK-05A, 2026-10-31) đã
  được chủ dự án **phê duyệt ngày 2026-10-31** và chuyển thành quyết
  định chính thức **DEC-024, DEC-025, DEC-026** ở trên.
- (Chưa có đề xuất nào khác đang chờ.)
