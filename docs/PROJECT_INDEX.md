# PROJECT_INDEX — WebScribble

> File AI phải đọc ĐẦU TIÊN trong mọi phiên làm việc. Giữ ngắn gọn (< 100 dòng).

## 1. Dự án

- **Tên:** WebScribble
- **Mô tả:** Ứng dụng web chú thích, viết tay và chỉnh sửa tài liệu (PDF, DOCX, ...)
  chạy trên trình duyệt, cài được dưới dạng PWA, local-first, offline đầy đủ
  sau lần tải đầu tiên, không bắt buộc tài khoản, chức năng cốt lõi miễn phí.
  Ba chế độ làm việc: Document Mode, Split Mode, Whiteboard Mode (DEC-014).
- **Thư mục gốc dự án:** `~/workspace/webscribble/`
- **Trạng thái:** Đã xong TASK-00 → TASK-04 (bộ nhớ, khảo sát, chốt kiến
  trúc DEC-016 → 023, khung dự án, UI shell). TASK-05 (Drawing Engine)
  đang thực hiện — **pha 05A (mô hình dữ liệu), 05B (Input Manager),
  05C (Stroke Engine & Renderer), 05D (Shape & Text Engine) và 05E
  (Selection & Eraser), 05F (History Manager) và 05G (Integration
  & Testing) đã xong**; chưa có trang thử nghiệm chính thức và
  chưa có engine tài liệu.

## 2. Bản đồ tài liệu (thư mục `docs/`)

| File | Vai trò | Khi nào đọc |
|---|---|---|
| `PROJECT_INDEX.md` | Cửa ngõ phiên làm việc (file này) | Luôn đọc đầu tiên |
| `PROJECT_CONTEXT.md` | Tầm nhìn, phạm vi, nguyên tắc bất biến | Mỗi phiên, sau INDEX |
| `CURRENT_STATE.md` | Giai đoạn hiện tại, task đang làm, việc tiếp theo | Mỗi phiên, sau CONTEXT |
| `TASKS.md` | Danh sách task + trạng thái + tiêu chí nghiệm thu | Chỉ đọc phần task đang làm |
| `PRODUCT_SPEC.md` | Đặc tả sản phẩm theo module | Chỉ đọc phần liên quan đến task |
| `ARCHITECTURE.md` | Kiến trúc kỹ thuật đề xuất | Chỉ đọc phần liên quan đến task |
| `DECISIONS.md` | Quyết định đã được chủ dự án xác nhận | Khi task chạm tới phạm vi quyết định |
| `CHANGELOG.md` | Nhật ký thay đổi theo task | Chỉ đọc đoạn gần nhất khi cần |
| `KNOWN_ISSUES.md` | Vấn đề chưa xác minh / rủi ro / quyết định còn thiếu | Khi task liên quan hoặc phát sinh vấn đề |
| `AI_WORKFLOW.md` | Quy trình bắt buộc cho phiên AI | Đọc khi bắt đầu tham gia dự án |
| `research/TECH_SURVEY.md` | Kết quả khảo sát stack (TASK-01, Luồng A) | Khi cần căn cứ cho DEC-016 → 018 |
| `research/STUDYWRITE_MODULE_AUDIT.md` | Audit module StudyWrite (TASK-01, Luồng B) | Khi xét tái sử dụng module (DEC-013) |
| `research/THREE_MODES_ARCHITECTURE_RESEARCH.md` | Nghiên cứu kiến trúc 3 chế độ (TASK-01, Luồng C) | Khi cần căn cứ cho DEC-019 → 021 |

## 3. Thứ tự đọc bắt buộc mỗi phiên

1. `PROJECT_INDEX.md` (file này).
2. `PROJECT_CONTEXT.md`.
3. `CURRENT_STATE.md` → xác định task hiện tại.
4. Đúng phần task đó trong `TASKS.md`.
5. Chỉ các phần liên quan trong `PRODUCT_SPEC.md` / `ARCHITECTURE.md`.
6. `DECISIONS.md` / `KNOWN_ISSUES.md` nếu task chạm tới.

Chi tiết: xem `AI_WORKFLOW.md`. Không đọc toàn bộ CHANGELOG, không đọc lại
toàn bộ lịch sử hội thoại.

## 4. Task hiện tại

- **Vừa hoàn thành:** TASK-05G — Integration & Testing của
  Drawing Engine (48 test mới, tổng 321 đạt; sửa bug StrokeBuilder
  đánh rơi điểm nhả bút; Chromium headless 16/16). Trước đó:
  TASK-05F (History Manager), TASK-05E (Selection & Eraser),
  TASK-05D (Shape & Text Engine), TASK-05C (Stroke Engine &
  Renderer), TASK-05B (Input Manager), TASK-05A (Data Model &
  Surface Interface), TASK-04 (UI shell, commit `b4aa4ae`), TASK-03,
  TASK-02, TASK-01, TASK-00.
- **Đang thực hiện:** TASK-05 — Drawing Engine (phần engine đã
  xong gồm kiểm thử tích hợp; còn kiểm chứng thiết bị thật — chờ
  phần cứng).
- **Kế tiếp dự kiến:** TASK-06 — PDF Engine (chờ giao).
- Chi tiết trạng thái: `CURRENT_STATE.md`. Không tự ý bắt đầu task mới.

## 5. Phiên bản tài liệu

- **Docs version:** 1.13
- **Ngày cập nhật:** 2026-10-30
- **Task tạo:** TASK-00
