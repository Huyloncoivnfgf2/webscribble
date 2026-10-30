# CURRENT_STATE — WebScribble

> Trạng thái hiện tại của dự án. Cập nhật sau mỗi task (xem AI_WORKFLOW.md).

## 1. Giai đoạn hiện tại

**Giai đoạn 1 — Xây dựng nền tảng: ĐANG BẮT ĐẦU.** Giai đoạn 0 (bộ nhớ,
khảo sát, chốt kiến trúc TASK-00 → 02) đã xong. **Khung dự án đã được
khởi tạo tại TASK-03**: Vite + React + TypeScript + Tailwind CSS v4 +
ESLint, cấu trúc thư mục theo kiến trúc đã chốt, `dev`/`build`/`lint`
chạy được, Git local đã khởi tạo (chưa commit). **Chưa có chức năng sản
phẩm nào** — các engine mới là thư mục + README placeholder. Bước tiếp
theo là TASK-04 (UI shell & điều hướng cơ bản).

## 2. Task đang thực hiện

- (Không có — TASK-03 vừa hoàn thành, chờ chủ dự án giao task tiếp theo.)

## 3. Task đã hoàn thành

| Task | Tên | Ngày | Bằng chứng |
|---|---|---|---|
| TASK-00 | Khởi tạo hệ thống bộ nhớ dự án | 2026-10-30 | 10 file trong `docs/`, đã kiểm tra nhất quán — xem CHANGELOG.md |
| TASK-01 | Khảo sát & kiểm chứng công nghệ | 2026-10-30 | 3 file trong `docs/research/` (TECH_SURVEY, STUDYWRITE_MODULE_AUDIT, THREE_MODES_ARCHITECTURE_RESEARCH) — xem CHANGELOG.md |
| TASK-02 | Chốt kiến trúc & quyết định công nghệ | 2026-10-30 | DEC-016 → DEC-023 trong DECISIONS.md; ARCHITECTURE.md mục 1 bản chốt; PRODUCT_SPEC đồng bộ — xem CHANGELOG.md |
| TASK-03 | Khởi tạo khung dự án (project skeleton) | 2026-10-30 | `package.json` + `package-lock.json`, `src/**` theo ARCHITECTURE.md mục 3; build/lint/dev đã chạy thật đạt — xem CHANGELOG.md |

Ngoài roadmap: ngày 2026-10-30 đã có một lượt **cập nhật bộ nhớ** theo yêu
cầu chủ dự án (không phải task roadmap, không đánh dấu DONE cho task nào):
ghi nhận DEC-013 (StudyWrite — phương án C), DEC-014 (3 chế độ làm việc),
DEC-015 (một Drawing Engine dùng chung); ISSUE-009 → RESOLVED; bổ sung
TASK-12 (Whiteboard) và TASK-13 (Split Mode) vào roadmap. Chi tiết ở
CHANGELOG.md.

## 4. Task tiếp theo (chưa bắt đầu — chờ yêu cầu)

- **TASK-04** — UI shell & điều hướng cơ bản: layout chính (thư viện tài
  liệu, màn hình làm việc trống), điều hướng giữa các màn hình, thanh
  công cụ khung. Chưa có chức năng mở/vẽ tài liệu thật.
- Sau TASK-04: TASK-05 (Drawing Engine — lõi viết tay) theo roadmap.
- Việc chờ chủ dự án ngoài roadmap: duyệt **commit đầu tiên** cho Git
  local và quyết định hosting/remote (phần còn lại của ISSUE-008).

## 5. Công nghệ đã xác minh

- **Đã chốt tại DEC-016 (TASK-02)** và **đã cài đặt thực tế tại TASK-03**
  (phiên bản + giấy phép đọc từ chính các gói đã cài): react/react-dom
  19.3.1 (MIT), vite 8.3.5 (MIT), @vitejs/plugin-react 6.1.2 (MIT),
  tailwindcss + @tailwindcss/vite 4.3.3 (MIT), eslint 10.14.0 +
  typescript-eslint 8.72.1 (MIT), **typescript 5.9.3** (Apache-2.0) —
  chốt 5.9.x thay vì 7.0.2 vì typescript-eslint chưa hỗ trợ TS 7 trong
  peer range (đã báo cáo ở TASK-03). Chưa cài các thư viện theo tính
  năng (PDF.js, pdf-lib, Tiptap, Mammoth, Dexie, Zustand,
  perfect-freehand, thư viện `docx`) — cài ở task triển khai tương ứng.

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
  - ISSUE-008: Git local đã khởi tạo ở TASK-03 (chưa commit, chưa
    remote); chỉ còn quyết định hosting/remote.
  - ISSUE-011: chiến lược cache tài nguyên lớn cho offline — TASK-10.
  - ISSUE-014 (đã thu hẹp): chỉ còn bố trí Split Mode trên mobile và ngữ
    nghĩa GIF làm nền tài liệu; xuất Split (DEC-021) và HEIC (DEC-023)
    đã quyết.
