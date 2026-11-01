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

- **Vừa hoàn thành:** TASK-08B — Document Manager & Library
  UI (13 test mới, tổng 475 đạt; đổi tên bền, panel dung
  lượng + cảnh báo quota 80%, Recent Documents dữ liệu
  thật). Trước đó: TASK-06F-A — kiểm chứng + sửa race
  condition của dirty tracking (generation counter; 6 test
  hồi quy mới, tổng 462 đạt). Trước đó: TASK-06F — PDF
  Integration & Testing
  (TASK-06 hoàn tất cả 6 subtask; 11 test tích hợp mới, tổng
  456 đạt; sửa 1 lỗi ghi đè khi đóng phiên chỉ-đọc; ISSUE-015
  đa tab). Trước đó: TASK-06E — Minimal React PDF Viewer (17
  test mới, tổng 445 đạt; Browser QA dev 26/26 + production
  14/14 trên UI thật). Trước đó: TASK-06D — PDF Annotation
  Overlay (19 test
  mới, tổng 428 đạt; Browser QA 50/50 cả 4 rotation). Trước đó:
  TASK-06C — Annotation Engine (21 test mới,
  tổng 409 đạt; Browser QA qua reload trang 5/5). Trước đó:
  TASK-06B — Page Rendering & Geometry (23
  test mới, tổng 388 đạt; Browser QA 16/16 ở DPR 1 và 2). Trước
  đó: TASK-06A — PDF.js & Document Loader (17 unit
  test mới, tổng 365 đạt; worker local kiểm chứng dev + production
  7/7). Trước đó: TASK-08A — Storage Foundation (27 unit test
  mới, tổng 348 đạt; IndexedDB thật qua reload 8/8). Trước đó:
  TASK-05G (Integration & Testing) và toàn bộ TASK-05 — đã commit
  `7aa608e`, TASK-05F (History Manager), TASK-05E (Selection &
  Eraser),
  TASK-05D (Shape & Text Engine), TASK-05C (Stroke Engine &
  Renderer), TASK-05B (Input Manager), TASK-05A (Data Model &
  Surface Interface), TASK-04 (UI shell, commit `b4aa4ae`), TASK-03,
  TASK-02, TASK-01, TASK-00.
- **Đang thực hiện:** Không có task đang chạy. TASK-08A,
  TASK-08B và TASK-06 (06A → 06F-A) đã xong (chưa commit —
  chờ duyệt).
- **Kế tiếp dự kiến:** TASK-08C — Whiteboard/Workspace/
  Backup (theo replan); hoặc TASK-07 — Word Engine (theo
  roadmap gốc). Chờ chủ dự án giao.
- Chi tiết trạng thái: `CURRENT_STATE.md`. Không tự ý bắt đầu task mới.

## 5. Phiên bản tài liệu

- **Docs version:** 1.39
- **Phiên bản sản phẩm:** **v1.0.0 — MVP Complete** (phát hành 2026-10-31)
- **Ngày cập nhật:** 2026-11-01
- **Task tạo:** TASK-00
