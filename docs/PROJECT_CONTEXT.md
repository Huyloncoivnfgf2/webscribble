# PROJECT_CONTEXT — WebScribble

> Thông tin cốt lõi của sản phẩm. Chỉ chủ dự án mới thay đổi được các nguyên tắc
> trong file này. Không đưa nhật ký thay đổi vào đây (nhật ký ở CHANGELOG.md).

## 1. Tầm nhìn sản phẩm

WebScribble là ứng dụng web cho phép người dùng **xem, viết tay, chú thích và
chỉnh sửa tài liệu** ngay trên trình duyệt — mượt và chính xác gần với trải
nghiệm bút của các ứng dụng ghi chú chuyên dụng — mà không cần cài phần mềm
nặng, không cần tài khoản, và dữ liệu luôn nằm trên thiết bị của người dùng.

## 2. Đối tượng mục tiêu

- Học sinh, sinh viên: đọc tài liệu học tập, ghi chú, viết tay lên PDF/DOCX.
- Giáo viên, người làm nội dung học liệu: chú thích, sửa, đánh dấu tài liệu.
- Người dùng phổ thông cần ký/ghi chú nhanh lên tài liệu trên mọi thiết bị.

## 3. Giá trị cốt lõi

1. **Viết tay là trung tâm:** nét bút mượt, chính xác, độ trễ thấp là ưu tiên số 1.
2. **Mở file là dùng ngay:** chạy trên trình duyệt, cài được dạng PWA.
3. **Local-first:** tài liệu và chú thích lưu trên thiết bị; không bắt buộc tài khoản.
4. **Offline đầy đủ** sau lần tải đầu tiên, trong giới hạn của trình duyệt.
5. **Miễn phí ở lõi:** các chức năng cốt lõi miễn phí.

## 4. Phạm vi đã thống nhất (chủ dự án xác nhận, 2026-10-30)

- Nền tảng: web app trên trình duyệt; PWA cài đặt được.
- Thiết bị: desktop, tablet, mobile (responsive).
- Định dạng: PDF và DOCX ở giai đoạn đầu; định dạng khác theo lộ trình.
- PDF: xem, viết, chú thích, xuất file.
- Word (DOCX): vừa chỉnh sửa nội dung, vừa chú thích.
- Lưu trữ: local-first trên thiết bị người dùng.
- Tài khoản: không bắt buộc.
- Mô hình: chức năng cốt lõi miễn phí.

## 5. Nguyên tắc KHÔNG được tự ý thay đổi

1. Không biến sản phẩm thành dịch vụ bắt buộc đăng nhập/đồng bộ đám mây.
2. Không đưa dữ liệu tài liệu của người dùng lên máy chủ khi chưa có quyết định riêng.
3. Không hy sinh độ mượt của bút vẽ để lấy thêm tính năng phụ.
4. Drawing Engine phải độc lập với Document Engine (xem ARCHITECTURE.md).
5. Không sao chép mã nguồn, tài sản độc quyền hoặc giao diện có bản quyền
   của bất kỳ sản phẩm tham khảo nào (kể cả sản phẩm được lấy cảm hứng về
   trải nghiệm viết tay). Chỉ học hỏi *trải nghiệm*, tự xây dựng *thực thi*.
6. Mọi thay đổi phạm vi phải qua quyết định của chủ dự án và ghi vào DECISIONS.md.

## 6. Giới hạn quan trọng đã biết

- Trình duyệt giới hạn dung lượng lưu trữ cục bộ (IndexedDB) theo thiết bị/trình duyệt.
- Một số định dạng con trong DOCX (ảnh WMF/EMF, công thức OMML gốc) trình duyệt
  không hiển thị trực tiếp được — chi tiết ở KNOWN_ISSUES.md.
- Chỉnh sửa nội dung PDF gốc (không phải chú thích phủ lên) là bài toán khó,
  phạm vi cụ thể chưa được xác minh — xem PRODUCT_SPEC.md và KNOWN_ISSUES.md.
