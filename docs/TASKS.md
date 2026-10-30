# TASKS — WebScribble

> Trạng thái hợp lệ: `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `TESTING` · `DONE`.
> Chỉ đánh dấu DONE khi có bằng chứng nghiệm thu. Không tự bắt đầu task tiếp
> theo khi chưa được chủ dự án yêu cầu (xem AI_WORKFLOW.md).

---

## TASK-00 — Khởi tạo hệ thống bộ nhớ dự án
- **Trạng thái:** DONE
- **Mục tiêu:** Tạo hệ thống tài liệu/bộ nhớ trong `docs/` để mọi phiên AI sau
  làm việc liên tục mà không phụ thuộc lịch sử hội thoại.
- **Phụ thuộc:** Không.
- **Phạm vi:** Chỉ tài liệu. Không code, không cài dependency, không sửa cấu hình.
- **File thay đổi:** `docs/PROJECT_INDEX.md`, `PROJECT_CONTEXT.md`,
  `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `CURRENT_STATE.md`, `TASKS.md`,
  `DECISIONS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `AI_WORKFLOW.md`.
- **Tiêu chí nghiệm thu:** Đủ 10 file; PROJECT_INDEX < 100 dòng; nội dung nhất
  quán giữa các file; ghi rõ ứng dụng chưa được lập trình.
- **Kết quả:** Hoàn thành 2026-10-30. Kiểm tra: xem CHANGELOG.md mục TASK-00.

## TASK-01 — Khảo sát & kiểm chứng công nghệ
- **Trạng thái:** DONE
- **Mục tiêu:** Ba luồng khảo sát:
  (A) Kiểm chứng stack đề xuất (React, TypeScript, Vite, Tailwind CSS,
  PDF.js, pdf-lib, Tiptap, IndexedDB, Zustand, Service Worker): tương thích
  lẫn nhau, khả năng offline, hành vi trên Safari iOS và Android.
  (B) Đánh giá module của StudyWrite theo DEC-013 để chọn lọc tái sử dụng:
  chất lượng module, quyền sử dụng/nguồn gốc mã nguồn, khả năng tách module
  khỏi file HTML đơn của StudyWrite.
  (C) Khảo sát kiến trúc cho hệ thống 3 chế độ (DEC-014/DEC-015): mô hình
  "bề mặt" (surface) cho dữ liệu viết tay, Whiteboard Engine, cơ chế lưu
  trạng thái hai vùng của Split Mode (ISSUE-013), tính khả thi của Infinite
  Canvas (ISSUE-012), định dạng ảnh bổ sung gồm HEIC (ISSUE-014).
- **Phụ thuộc:** TASK-00; quyết định DEC-013/DEC-014/DEC-015 (đã có).
- **Phạm vi:** Lập tài liệu khảo sát + (nếu được duyệt) bản thử nghiệm nhỏ
  ngoài source chính. Đối với StudyWrite: chỉ đọc và đánh giá, **không sửa
  file StudyWrite**, không mang code sang WebScribble trong task này. Không
  chốt stack trong task này (chốt ở TASK-02).
- **File dự kiến:** `docs/research/TECH_SURVEY.md` (mới — luồng A + C),
  `docs/research/STUDYWRITE_MODULE_AUDIT.md` (mới — luồng B), cập nhật
  `KNOWN_ISSUES.md` (ISSUE-001, 012, 013, 014), `ARCHITECTURE.md` (trạng
  thái công nghệ và mục 6 nếu khảo sát làm rõ thêm).
- **Tiêu chí nghiệm thu:**
  - Mỗi công nghệ ở luồng A có kết luận: dùng được offline hay không, rủi
    ro chính, phương án thay thế; ISSUE-001 được cập nhật bằng chứng.
  - Mỗi module ứng viên của StudyWrite ở luồng B có kết luận đủ 3 mục:
    chất lượng, quyền/nguồn gốc, tách được hay không → khuyến nghị
    DÙNG / KHÔNG DÙNG / DÙNG SAU KHI SỬA.
  - Luồng C có kết luận ban đầu cho ISSUE-012/013/014 để TASK-02 quyết định.
  - Chưa có code ứng dụng nào được tạo trong task này.
- **Kết quả:** Hoàn thành 2026-10-30. Đầu ra: `docs/research/TECH_SURVEY.md`
  (Luồng A), `docs/research/STUDYWRITE_MODULE_AUDIT.md` (Luồng B),
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` (Luồng C);
  ISSUE-001 chuyển INVESTIGATING, ISSUE-002/007/010/012/013/014 được cập
  nhật bằng chứng/kết luận nghiên cứu. Chi tiết: CHANGELOG.md mục TASK-01.
  Các quyết định chốt để lại cho TASK-02 (không tự chốt trong task này).

## TASK-02 — Chốt kiến trúc & quyết định công nghệ
- **Trạng thái:** DONE
- **Mục tiêu:** Dựa trên TASK-01, chốt stack và kiến trúc chi tiết (module,
  giao diện giữa các engine, mô hình dữ liệu chú thích).
- **Phụ thuộc:** TASK-01.
- **Phạm vi:** Tài liệu kiến trúc + quyết định. Chưa code.
- **File dự kiến:** `ARCHITECTURE.md` (bản chốt), `DECISIONS.md` (quyết định
  công nghệ mới), `PRODUCT_SPEC.md` (cập nhật nhãn CHƯA XÁC MINH nếu có).
- **Tiêu chí nghiệm thu:** Mọi công nghệ trong ARCHITECTURE.md có quyết định
  tương ứng trong DECISIONS.md; mô hình dữ liệu chú thích được mô tả rõ.
- **Kết quả:** Hoàn thành 2026-10-30. Chủ dự án xác nhận 8 quyết định, đã
  ghi thành **DEC-016 → DEC-023**: stack chính thức kèm Dexie (DEC-016);
  phạm vi PDF flatten (DEC-017); phạm vi DOCX chấp nhận mất định dạng
  (DEC-018); Whiteboard trang cố định, chưa Infinite Canvas (DEC-019);
  mô hình Workspace/Surface (DEC-020); xuất Split = phương án B (DEC-021);
  iOS offline + sao lưu/khôi phục bắt buộc (DEC-022); HEIC chưa tích hợp
  decoder (DEC-023). ARCHITECTURE.md mục 1 đã chuyển sang bản chốt;
  PRODUCT_SPEC đồng bộ theo các quyết định. ISSUE-001/002/007/010/012/013
  → RESOLVED; ISSUE-014 thu hẹp. Chi tiết: CHANGELOG.md mục TASK-02.

## TASK-03 — Khởi tạo khung dự án (project skeleton)
- **Trạng thái:** DONE
- **Mục tiêu:** Tạo khung code theo stack đã chốt: Vite + React + TypeScript
  + Tailwind (hoặc tương đương theo TASK-02), cấu trúc thư mục như
  ARCHITECTURE.md, lint/build chạy được.
- **Phụ thuộc:** TASK-02.
- **Phạm vi:** Khung rỗng + trang chào. Chưa có tính năng tài liệu/vẽ.
- **File dự kiến:** `package.json`, `vite.config.*`, `src/**` (khung),
  `index.html`.
- **Kết quả:** Hoàn thành 2026-10-30. Khung Vite + React + TypeScript +
  Tailwind CSS v4 (plugin `@tailwindcss/vite`) + ESLint flat config tại
  `~/workspace/webscribble/`; cấu trúc thư mục theo ARCHITECTURE.md mục 3
  (app/core/engines/data/offline + các thư mục dùng chung); 7 thư mục
  engine có README placeholder, chưa có code chức năng; trang khởi đầu
  tối giản (tên + tagline). Đã chạy thật: `npm run build` đạt (gồm
  `tsc -b`), `npm run lint` đạt (exit 0), `npm run dev` khởi động và
  phục vụ đúng trang. Git local đã khởi tạo (nhánh `main`, chưa commit,
  chưa remote). Hai điều chỉnh kỹ thuật đã báo cáo: template Vite mới
  dùng oxlint → thay bằng ESLint theo yêu cầu task; TypeScript chốt
  5.9.3 thay vì 7.0.2 vì typescript-eslint chưa hỗ trợ TS 7 trong peer
  range. Chi tiết: CHANGELOG.md mục TASK-03.
- **Tiêu chí nghiệm thu:** `dev`/`build`/`lint` chạy thành công trên máy phát
  triển; cấu trúc thư mục khớp ARCHITECTURE.md.

## TASK-04 — UI shell & responsive layout
- **Trạng thái:** DONE
- **Mục tiêu:** Khung giao diện: màn hình thư viện tài liệu, màn hình làm việc,
  thanh công cụ; responsive desktop/tablet/mobile.
- **Phụ thuộc:** TASK-03.
- **Phạm vi:** Giao diện tĩnh + điều hướng; dữ liệu giả nếu cần.
- **File dự kiến:** `src/app/**`.
- **Tiêu chí nghiệm thu:** Hiển thị đúng trên 3 kích thước màn hình đại diện;
  nút công cụ đủ lớn cho cảm ứng; không lỗi console.
- **Kết quả:** Hoàn thành 2026-10-30. Application Shell gồm Sidebar (logo +
  5 mục điều hướng, thu gọn 256px → 76px trên desktop, drawer trên mobile),
  Header (breadcrumb + tiêu đề, ô tìm kiếm giao diện, nút cài đặt), Main
  Workspace với 4 khu vực ở Trang chủ: Welcome, Quick Actions, Workspace
  Modes (3 thẻ chế độ chọn được + panel xem trước theo chế độ), Recent
  Documents (empty state — **không dùng dữ liệu giả**). Các trang Tài liệu
  gần đây / Tài liệu của tôi / Bảng trắng / Cài đặt là placeholder trung
  thực: nút chưa có chức năng thật hiển thị thông báo rõ ràng thay vì giả
  vờ thành công. Phong cách Minimalist Premium, bảng màu trắng/xám/xanh
  dương nhạt; icon Lucide qua npm (lucide-react 1.65.0, ISC). Đã kiểm
  chứng bằng trình duyệt headless ngay trên máy: 1440/768/390px không
  tràn ngang, drawer mobile đóng/mở và điều hướng đúng, chọn Split Mode
  đổi xem trước + trạng thái active, thông báo ở trang Tài liệu xuất
  hiện, **không lỗi console**. `lint`/`build` đạt. Chi tiết: CHANGELOG.md
  mục TASK-04. Thay đổi chưa commit (chờ chủ dự án duyệt).

## TASK-05 — Drawing Engine
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Canvas vẽ độc lập: bút, highlight, tẩy, nhiều màu/độ dày,
  hỗ trợ stylus + pressure (nếu trình duyệt hỗ trợ), làm mượt nét, undo/redo.
  Đây là engine vẽ **duy nhất** phục vụ cả 3 chế độ làm việc (DEC-015) —
  thiết kế theo trừu tượng "bề mặt" của ARCHITECTURE.md, không viết riêng
  cho từng chế độ.
- **Phụ thuộc:** TASK-03 (tọa độ trang theo ARCHITECTURE.md mục 5).
- **Phạm vi:** Chỉ engine vẽ + trang thử nghiệm nội bộ; chưa gắn tài liệu thật.
- **File dự kiến:** `src/engines/drawing/**`.
- **Tiêu chí nghiệm thu:** Viết nhanh không giật/thiếu nét trên desktop và
  tablet; nét vẽ lại đúng vị trí sau zoom; engine không import module tài liệu.

## TASK-06 — PDF Engine: xem & chú thích
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Mở/hiển thị PDF (PDF.js), phủ lớp vẽ của Drawing Engine,
  lưu/tải lại chú thích theo trang.
- **Phụ thuộc:** TASK-05, TASK-08 (storage) — có thể làm song song phần hiển thị.
- **Phạm vi:** Xem + chú thích. Chưa xuất file (TASK-09).
- **File dự kiến:** `src/engines/pdf/**`, `src/engines/annotation/**`.
- **Tiêu chí nghiệm thu:** Mở PDF mẫu nhiều trang; vẽ trên trang bất kỳ;
  đóng/mở lại chú thích còn nguyên đúng vị trí, kể cả sau zoom/cuộn.

## TASK-07 — Word Engine: xem, sửa nội dung & chú thích DOCX
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Mở DOCX, chỉnh sửa nội dung (Tiptap hoặc tương đương theo
  TASK-02), chú thích phủ lên nội dung; xác định chiến lược xử lý ảnh
  WMF/EMF và công thức OMML.
- **Phụ thuộc:** TASK-05, TASK-08; kết quả xử lý ISSUE-002/003/004.
- **Phạm vi:** Xem + sửa + chú thích. Xuất DOCX thuộc TASK-09.
- **File dự kiến:** `src/engines/word/**`.
- **Tiêu chí nghiệm thu:** Mở DOCX mẫu (có bảng, ảnh thường, công thức nếu
  có); sửa chữ và lưu lại được; chú thích đúng vị trí sau khi sửa nội dung
  phía trên (hoặc ghi rõ giới hạn đã biết vào KNOWN_ISSUES.md).

## TASK-08 — Local Storage & Document Manager
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** IndexedDB: lưu file gốc, chú thích, metadata; thư viện tài
  liệu (danh sách, mở lại, đổi tên, xóa); tự lưu; cảnh báo khi gần hết quota.
  Bao gồm thực thể bảng trắng và trạng thái workspace của Split Mode (cả
  hai bề mặt — xem ISSUE-013).
- **Phụ thuộc:** TASK-02 (mô hình dữ liệu), TASK-03.
- **Phạm vi:** Data Layer + màn hình thư viện dùng dữ liệu thật.
- **File dự kiến:** `src/data/**`, `src/app/library/**`.
- **Tiêu chí nghiệm thu:** Tắt/mở lại app (kể cả offline) dữ liệu còn nguyên;
  đo được dung lượng đã dùng; xóa tài liệu xóa sạch cả chú thích.

## TASK-09 — Export Engine
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Xuất PDF kèm chú thích (pdf-lib); xuất DOCX sau chỉnh sửa;
  kiểm chứng file xuất mở đúng bằng ứng dụng văn phòng phổ biến.
- **Phụ thuộc:** TASK-06, TASK-07.
- **Phạm vi:** Chỉ xuất file; không thêm tính năng sửa mới.
- **File dự kiến:** `src/engines/export/**`.
- **Tiêu chí nghiệm thu:** File xuất từ tài liệu mẫu mở đúng ở ít nhất một
  trình đọc PDF và một ứng dụng Word phổ biến; chú thích hiển thị đúng vị trí.

## TASK-10 — PWA & Offline
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Web App Manifest + Service Worker: cài đặt được, cache app
  shell và thư viện, dùng đầy đủ chức năng cốt lõi khi offline.
- **Phụ thuộc:** TASK-03; hoàn thiện sau TASK-06/07/08.
- **Phạm vi:** Offline Layer + kiểm thử cài đặt trên desktop/Android/iOS.
- **File dự kiến:** `public/manifest*`, `src/offline/**`, cấu hình build PWA.
- **Tiêu chí nghiệm thu:** Cài được lên màn hình chính; tắt mạng vẫn mở app,
  mở tài liệu đã lưu, vẽ và xuất file; có quy trình cập nhật phiên bản an toàn.

## TASK-11 — Testing & nghiệm thu tổng thể
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Kiểm thử theo tiêu chí nghiệm thu cấp sản phẩm
  (PRODUCT_SPEC.md mục 6) trên thiết bị/trình duyệt đại diện; xử lý lỗi tồn đọng.
- **Phụ thuộc:** TASK-04 → TASK-10, TASK-12, TASK-13.
- **Phạm vi:** Kiểm thử + sửa lỗi trong phạm vi các task trước; không thêm
  tính năng mới.
- **File dự kiến:** `tests/**`, cập nhật `KNOWN_ISSUES.md`, `CHANGELOG.md`.
- **Tiêu chí nghiệm thu:** Đạt cả 5 tiêu chí ở PRODUCT_SPEC.md mục 6 hoặc
  ghi rõ mục chưa đạt kèm lý do vào KNOWN_ISSUES.md.

## TASK-12 — Whiteboard Engine & Whiteboard Mode
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Không gian bảng trắng độc lập (Whiteboard Engine): viết tay,
  vẽ tự do, tạo văn bản, vẽ hình dạng, tẩy, chọn/di chuyển/chỉnh sửa đối
  tượng, Undo/Redo; bảng trắng lưu và khôi phục như một thực thể trong thư
  viện. Bề mặt bảng trắng dùng chung Drawing Engine (DEC-015).
- **Phụ thuộc:** TASK-05 (Drawing Engine), TASK-08 (Storage). Kết luận về
  Infinite Canvas ở TASK-01/TASK-02 (ISSUE-012) xác định phạm vi tọa độ.
- **Phạm vi:** Whiteboard Engine + màn hình Whiteboard Mode. Infinite Canvas
  chỉ làm khi đã có quyết định riêng sau đánh giá; mặc định bảng trắng có
  kích thước xác định.
- **File dự kiến:** `src/engines/whiteboard/**`, `src/app/whiteboard/**`.
- **Tiêu chí nghiệm thu:** Tạo bảng trắng mới, vẽ/viết/thêm đối tượng, đóng
  và mở lại khôi phục đúng nguyên trạng; không tồn tại engine vẽ riêng cho
  bảng trắng ngoài Drawing Engine chung.

## TASK-13 — Split Mode
- **Trạng thái:** NOT_STARTED
- **Mục tiêu:** Workspace hai khu vực trong một màn hình: tài liệu (PDF/
  DOCX/ảnh) + bảng trắng; chỉnh được tỷ lệ diện tích; lưu và khôi phục
  trạng thái cả hai khu vực (ISSUE-013).
- **Phụ thuộc:** TASK-12, TASK-08, và ít nhất một engine tài liệu
  (TASK-06 hoặc TASK-07).
- **Phạm vi:** Lớp phối hợp trong Application Core + giao diện chia vùng.
  Không sửa các engine; nếu engine thiếu giao diện phối hợp thì ghi issue.
- **File dự kiến:** `src/core/workspace/**`, `src/app/split/**`.
- **Tiêu chí nghiệm thu:** Mở một tài liệu ở vùng 1 và viết ở cả hai vùng;
  chỉnh tỷ lệ hoạt động trên desktop và tablet; đóng/mở lại workspace không
  mất dữ liệu ở vùng nào.
