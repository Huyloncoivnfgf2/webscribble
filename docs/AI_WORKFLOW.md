# AI_WORKFLOW — WebScribble

> Quy trình làm việc **bắt buộc** cho mọi phiên AI tham gia dự án. Mục tiêu:
> làm việc liên tục qua nhiều phiên mà không phụ thuộc lịch sử hội thoại và
> không tốn token đọc lại những gì không cần.

## 1. Giao thức bắt đầu phiên (Session Start Protocol)

Mỗi phiên mới, theo đúng thứ tự:

1. Đọc `docs/PROJECT_INDEX.md`.
2. Đọc `docs/PROJECT_CONTEXT.md`.
3. Đọc `docs/CURRENT_STATE.md` → xác định task hiện tại và việc tiếp theo.
4. Đọc đúng phần task đang thực hiện trong `docs/TASKS.md`.
5. Chỉ đọc các phần liên quan trong `docs/PRODUCT_SPEC.md` và
   `docs/ARCHITECTURE.md`.
6. Đọc `docs/DECISIONS.md` / `docs/KNOWN_ISSUES.md` nếu task chạm tới.
7. Tóm tắt ngắn gọn trạng thái hiện tại cho chủ dự án.
8. Chờ yêu cầu, hoặc thực hiện đúng yêu cầu đã được giao.

**Không** tự ý tiếp tục một task chưa được chủ dự án yêu cầu.

## 2. Quy tắc tối ưu token (Token Optimization Rules)

1. Mỗi phiên mới chỉ đọc PROJECT_INDEX.md trước, rồi theo thứ tự ở mục 1.
2. Không đọc toàn bộ CHANGELOG.md nếu không cần — chỉ đọc mục gần nhất.
3. Không đọc lại toàn bộ lịch sử hội thoại.
4. Không lặp lại nội dung giữa nhiều file: mỗi thông tin có một nơi chủ quản
   (phạm vi → PROJECT_CONTEXT/PRODUCT_SPEC; quyết định → DECISIONS;
   trạng thái → CURRENT_STATE; nhật ký → CHANGELOG; vấn đề → KNOWN_ISSUES).
5. Không viết lại toàn bộ tài liệu sau mỗi task — chỉ cập nhật phần thay đổi.
6. Không tạo thêm tài liệu trùng chức năng với 10 file hiện có.
7. Khi trích dẫn task/quyết định/issue, dùng ID (TASK-xx, DEC-xxx,
   ISSUE-xxx) thay vì chép lại nội dung.

## 3. Giao thức hoàn thành task (Task Completion Protocol)

Sau mỗi task, theo thứ tự:

1. Kiểm tra thay đổi thực tế (file đã tạo/sửa đúng như khai báo chưa).
2. Chạy các kiểm thử phù hợp với phạm vi task.
3. Cập nhật trạng thái task trong `TASKS.md`.
4. Cập nhật `CURRENT_STATE.md`.
5. Ghi mục mới vào `CHANGELOG.md` (Task ID, ngày, file, nội dung, kết quả kiểm tra).
6. Cập nhật `DECISIONS.md` nếu có quyết định mới được xác nhận.
7. Cập nhật `KNOWN_ISSUES.md` nếu phát hiện vấn đề mới hoặc có bằng chứng
   giải quyết vấn đề cũ.
8. **Không** đánh dấu DONE khi chưa có bằng chứng nghiệm thu.
9. **Không** tự chuyển sang task tiếp theo.

## 4. Quy tắc an toàn (Safety Rules)

- Không xóa file hiện có; không ghi đè nội dung có giá trị khi chưa được duyệt.
- Không cài dependency, không sửa package.json/cấu hình khi task không cho phép.
- Không thay đổi quyết định trong DECISIONS.md; quyết định mới phải có xác
  nhận của chủ dự án.
- Không tự tạo tài khoản/dịch vụ bên ngoài.
- Không tự commit Git; chỉ đề xuất nội dung commit khi được yêu cầu.
- Không tuyên bố đã kiểm thử nếu chưa thực sự chạy kiểm thử.
- Không sao chép mã nguồn/tài sản/giao diện có bản quyền của sản phẩm tham
  khảo (DEC-012).
