# CURRENT_STATE — WebScribble

> Trạng thái hiện tại của dự án. Cập nhật sau mỗi task (xem AI_WORKFLOW.md).

## 1. Giai đoạn hiện tại

**Giai đoạn 1 — Xây dựng nền tảng: ĐANG DIỄN RA.** Giai đoạn 0 (bộ nhớ,
khảo sát, chốt kiến trúc TASK-00 → 02) đã xong. Khung dự án (TASK-03),
UI shell (TASK-04, đã commit `b4aa4ae`) đã hoàn thành. **TASK-05
(Drawing Engine) đang thực hiện: pha 05A (mô hình dữ liệu & Surface
interface), 05B (Input Manager), 05C (Stroke Engine & Renderer), 05D
(Shape & Text Engine), 05E (Selection & Eraser), 05F (History
Manager) và 05G (Integration & Testing) đã xong** — Drawing Engine
nay tạo, hiển thị, chọn, di chuyển, tẩy và hoàn tác/làm lại đủ 7
loại object ở mức logic, đã qua kiểm thử tích hợp toàn diện (321
unit test đạt) và kiểm chứng trên Chromium headless thật (chuột +
cảm ứng mô phỏng, DPR 1/2). Chưa kiểm chứng thiết bị thật/Safari
(ISSUE-006). Chưa có trang thử nghiệm chính thức hay engine tài
liệu nào. Thay đổi của TASK-05A → 05G chưa commit — chờ chủ dự án duyệt.

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
  — cần phần cứng ngoài môi trường hiện tại.

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

- **TASK-05, việc còn lại ngoài môi trường hiện tại** — kiểm chứng
  trên thiết bị thật (bút stylus, iPad/Safari, cảm ứng thật; phần
  còn mở của ISSUE-006) và trang thử nghiệm chính thức thuộc phạm
  vi UI sau này. Phần engine của TASK-05 đã hoàn tất ở mức code +
  kiểm thử tích hợp + Chromium headless (TASK-05G).
- Việc chờ chủ dự án ngoài roadmap: duyệt **commit TASK-05A → 05G** và quyết
  định hosting/remote (phần còn lại của ISSUE-008).

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
  - ISSUE-008: Git local đã có 2 commit (`ce0a68f`, `b4aa4ae`); chỉ còn
    quyết định hosting/remote.
  - ISSUE-011: chiến lược cache tài nguyên lớn cho offline — TASK-10.
  - ISSUE-014 (đã thu hẹp): chỉ còn bố trí Split Mode trên mobile và ngữ
    nghĩa GIF làm nền tài liệu; xuất Split (DEC-021) và HEIC (DEC-023)
    đã quyết.
