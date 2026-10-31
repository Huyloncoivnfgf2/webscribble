# KNOWN_ISSUES — WebScribble

> Vấn đề chưa xác minh, rủi ro kỹ thuật, quyết định còn thiếu, lỗi đã phát hiện.
> **Không tự xóa issue** khi chưa có bằng chứng giải quyết; khi đã xử lý, đổi
> trạng thái thành `RESOLVED` kèm bằng chứng và ngày.

Trạng thái: `OPEN` (đang mở) · `INVESTIGATING` (đang khảo sát) · `RESOLVED`.

---

## ISSUE-001 — Stack công nghệ đề xuất chưa được kiểm chứng
- **Loại:** Chưa xác minh / rủi ro tương thích.
- **Mô tả:** React, TypeScript, Vite, Tailwind CSS, PDF.js, pdf-lib, Tiptap,
  IndexedDB, Zustand, Service Worker mới là đề xuất. Chưa kiểm tra: tương
  thích lẫn nhau, tổng dung lượng cần cache cho offline, hành vi Service
  Worker/IndexedDB trên Safari iOS.
- **Ảnh hưởng:** Chặn TASK-02 (chốt kiến trúc) và TASK-03.
- **Hướng xử lý:** TASK-01 khảo sát và kiểm chứng từng mục.
- **Kết quả khảo sát (TASK-01, 2026-10-30):** Đã kiểm chứng ở cấp tài
  liệu/nguồn chính thức + npm registry — xem `docs/research/TECH_SURVEY.md`.
  Toàn bộ stack đứng vững: 6 mục USE, 6 mục USE WITH CONDITIONS, không mục
  nào phải loại; giấy phép toàn MIT/Apache-2.0/BSD/ISC. Mọi thư viện đều
  đóng gói qua npm được (không phụ thuộc CDN). Phát hiện lớn nhất không
  nằm ở thư viện mà ở chính sách storage Safari iOS (ITP 7 ngày — chi
  tiết ở TECH_SURVEY mục 5.3). Còn UNVERIFIED cần prototype ở các task
  sau: giới hạn canvas/bộ nhớ iOS, bộ nhớ pdf-lib với file lớn, chất
  lượng html-to-docx, giấy phép công cụ sinh Service Worker.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — Stack đã được chủ
  dự án chốt chính thức tại **DEC-016** trên cơ sở khảo sát này. Các điểm
  UNVERIFIED còn lại (giới hạn canvas/bộ nhớ iOS, bộ nhớ pdf-lib với file
  lớn, html-to-docx, giấy phép công cụ sinh SW) không phải nội dung của
  issue này nữa — chúng đã có task kiểm chứng riêng trong TECH_SURVEY
  mục 7 (TASK-05/06/09/10) và điều kiện kiểm tra lại giấy phép phiên bản
  thực tế đã nằm trong DEC-016.

## ISSUE-002 — Độ trung thực DOCX khi sửa bằng editor nền HTML
- **Loại:** Rủi ro kỹ thuật.
- **Mô tả:** Tiptap (và các editor HTML tương tự) làm việc trên mô hình HTML,
  còn DOCX có mô hình định dạng riêng (styles, section, numbering...). Việc
  mở DOCX → sửa → lưu lại DOCX có nguy cơ mất/thay đổi định dạng gốc.
- **Ảnh hưởng:** Word Engine (TASK-07) và Export (TASK-09).
- **Hướng xử lý:** Khảo sát ở TASK-01; có thể cần chấp nhận phạm vi định dạng
  hỗ trợ giới hạn và ghi rõ cho người dùng.
- **Bằng chứng bổ sung (TASK-01, 2026-10-30):** Đã xác nhận bằng tài liệu
  chính thức — Mammoth tự tuyên bố bỏ qua chi tiết định dạng để lấy HTML
  ngữ nghĩa sạch; Tiptap ép nội dung qua schema JSON nên thành phần ngoài
  schema bị loại. Mất mát hai chiều là **chắc chắn**, không phải rủi ro
  mơ hồ. Đối sách kiến trúc (giữ file gốc trong IndexedDB, coi bản editor
  là bản làm việc, cảnh báo khi xuất) trình bày ở TECH_SURVEY mục 4 —
  chờ TASK-02 chốt.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — **DEC-018** đã chốt
  ở cấp phạm vi/kỳ vọng: chấp nhận mất định dạng, giữ file gốc làm tài sản
  gốc, không ghi đè, cảnh báo người dùng trước khi xuất. Phần còn lại
  (đo độ mất mát cụ thể trên tài liệu mẫu) là việc kiểm chứng đã lên lịch
  trong tiêu chí nghiệm thu của TASK-07, không còn là vấn đề chưa rõ.

## ISSUE-003 — Ảnh WMF/EMF trong DOCX không hiển thị trên trình duyệt
- **Loại:** Không tương thích đã có bằng chứng thực tế.
- **Mô tả:** Nhiều tài liệu Word (đặc biệt đề thi/tài liệu cũ) nhúng ảnh dạng
  WMF/EMF. Trình duyệt web không hiển thị được hai định dạng này. Bằng chứng
  từ dự án StudyWrite (2026-10-15): thư viện chuyển đổi DOCX cảnh báo
  "Image of type image/x-wmf is unlikely to display in web browsers" và ảnh
  bị hỏng trong bản hiển thị.
- **Ảnh hưởng:** Word Engine — tài liệu có ảnh WMF/EMF sẽ thiếu hình.
- **Hướng xử lý:** Cần chiến lược chuyển đổi WMF/EMF → PNG/SVG phía client
  (thư viện/WASM) hoặc hiển thị placeholder có thông báo rõ; khảo sát ở TASK-01/07.
- **Trạng thái:** OPEN (2026-10-30)

## ISSUE-004 — Công thức toán OMML trong DOCX
- **Loại:** Không tương thích đã có bằng chứng thực tế.
- **Mô tả:** Công thức Word gốc dùng OMML; các thư viện chuyển DOCX→HTML phổ
  biến (ví dụ Mammoth) không hỗ trợ OMML. Bằng chứng từ StudyWrite: phải tự
  tiền xử lý chuyển OMML → MathML thì công thức mới hiển thị được, và ảnh
  dạng VML (`w:pict`) bị tách khỏi dòng văn bản làm vỡ bố cục nếu không xử lý riêng.
- **Ảnh hưởng:** Word Engine với tài liệu học tập có công thức.
- **Hướng xử lý:** Đưa bộ chuyển OMML → MathML và xử lý VML vào phạm vi khảo
  sát của TASK-01/TASK-07.
- **Cập nhật TASK-07A (2026-10-31):** đường nhập DOCX đã tồn tại
  (Mammoth → sanitize → mô hình nội dung); OMML **vẫn bị Mammoth
  bỏ qua khi nhập** — tài liệu có công thức sẽ thiếu công thức
  trong nội dung đã chuyển đổi (file gốc còn nguyên trong thư
  viện). Chuyển OMML → MathML tiền xử lý vẫn là việc nghiên
  cứu riêng (ứng viên tái sử dụng từ StudyWrite theo DEC-013).
- **Trạng thái:** OPEN (2026-10-30)

## ISSUE-005 — Giới hạn dung lượng lưu trữ cục bộ của trình duyệt
- **Loại:** Giới hạn nền tảng / chưa đo.
- **Mô tả:** Local-first nghĩa là tài liệu + chú thích nằm trong IndexedDB;
  quota khác nhau theo trình duyệt/thiết bị và có thể bị hệ điều hành thu hồi
  khi máy thiếu dung lượng. Chưa đo được con số thực tế cho nhu cầu của sản phẩm.
- **Ảnh hưởng:** Local Storage (TASK-08) và trải nghiệm offline dài hạn.
- **Hướng xử lý:** Đo quota thực tế ở TASK-01/08; thiết kế cảnh báo dung lượng.
- **Cập nhật TASK-02 (2026-10-30):** **DEC-022** đã chốt sao lưu/khôi phục
  toàn thư viện + cảnh báo sao lưu định kỳ + xin `storage.persist()` —
  giảm rủi ro *mất dữ liệu* khi bị eviction, nhưng **không** thay thế
  việc đo quota thực tế và cảnh báo gần đầy ở TASK-08. Issue giữ OPEN.
- **Cập nhật TASK-08A (2026-10-31):** StorageManager đã triển khai
  `navigator.storage.persist()`/`persisted()`/`estimate()` (có
  adapter, an toàn khi thiếu API) và nền Dexie/IndexedDB đã chạy
  thật. Đo tại Chromium headless trên VM: quota ≈ 10 GB, trạng thái
  persisted mặc định chưa được cấp. Vẫn OPEN: quota/thu hồi dữ liệu
  trên thiết bị thật (đặc biệt iOS/Safari) chưa đo được, và UI cảnh
  báo gần đầy thuộc TASK-08B.
- **Cập nhật TASK-08B (2026-10-31):** UI đã hoàn thành — thư viện
  hiển thị dung lượng đã dùng/quota ước tính + tỷ lệ, cảnh báo từ
  ngưỡng 80%, trạng thái lưu trữ bền kèm nút xin cấp, và trạng
  thái "không đo được" trung thực khi API không khả dụng (kiểm
  chứng bằng giả lập trình duyệt ở cả ba trạng thái). Phần còn
  lại của issue chỉ là đo quota/thu hồi trên THIẾT BỊ THẬT (đặc
  biệt iOS/Safari) — chưa có phần cứng để kiểm chứng.
- **Trạng thái:** OPEN (2026-10-30)

## ISSUE-006 — Hỗ trợ bút cảm ứng/pressure không đồng đều giữa các trình duyệt
- **Loại:** Rủi ro kỹ thuật.
- **Mô tả:** Pointer Events, `pressure`, sự kiện gộp (coalesced events) và
  hành vi cuộn trang khi vẽ bằng cảm ứng khác nhau giữa Chrome/Edge/Safari/
  Firefox và giữa Windows/Android/iOS. Kinh nghiệm từ StudyWrite: phải xử lý
  riêng `touch-action` và độ phân giải canvas (DPR) thì nét bút mới không bị
  trình duyệt "cướp" cử chỉ và đủ sắc.
- **Ảnh hưởng:** Drawing Engine (TASK-05) — module quan trọng nhất của sản phẩm.
- **Hướng xử lý:** Kiểm thử sớm trên thiết bị thật ở TASK-05; ghi ma trận
  trình duyệt hỗ trợ vào tài liệu khảo sát.
- **Tiến triển:** TASK-05B (2026-10-31) đã triển khai ở tầng code các
  cơ chế giảm rủi ro: feature-detect `getCoalescedEvents` (không có thì
  dùng sự kiện gốc), chuẩn hóa pressure/tilt kèm fallback theo loại
  thiết bị. TASK-05C (2026-10-31): CanvasRenderer xử lý DPR tập trung
  (backing store = CSS × DPR + transform) nên phần "độ sắc nét/DPR"
  của issue đã có lời giải ở tầng engine. TASK-05G (2026-10-31) đã
  kiểm chứng bằng trình duyệt Chromium headless THẬT (không phải
  thiết bị thật): chuột và chạm (CDP touch) vẽ đúng tọa độ ở DPR 1
  và DPR 2, trang không cuộn khi vẽ với `touch-action: none` ở tầng
  view, undo/redo vẽ lại đúng (16/16 kiểm tra đạt; harness tạm đã
  xóa sau khi đo). Phần còn lại — bút stylus thật, Safari/iPadOS và
  thiết bị cảm ứng thật — vẫn chưa kiểm chứng được trong môi trường
  hiện tại.
- **Trạng thái:** OPEN (2026-10-30; cập nhật tiến triển 2026-10-31)

## ISSUE-007 — Phạm vi "sửa nội dung PDF gốc" chưa xác định
- **Loại:** Quyết định còn thiếu.
- **Mô tả:** DEC-005 chốt PDF gồm xem/viết/chú thích/xuất. Việc sửa trực tiếp
  nội dung chữ/ảnh gốc trong PDF là bài toán khác hẳn (PDF không có mô hình
  đoạn văn như Word) và chưa có quyết định có làm hay không, làm tới mức nào.
- **Ảnh hưởng:** Phạm vi PDF Engine và kỳ vọng người dùng.
- **Hướng xử lý:** Chủ dự án quyết định trước TASK-06; trước đó không cam kết
  tính năng này trong PRODUCT_SPEC.md.
- **Bằng chứng (TASK-01, 2026-10-30):** Tài liệu chính thức của pdf-lib
  (mục Limitations) xác nhận không có API sửa/xóa text trên trang ngoài
  form field; không thư viện JS client-side phổ biến nào làm được việc
  này một cách tổng quát. Đề xuất đóng issue theo hướng: PDF = xem + chú
  thích phủ + xuất flatten; "sửa chữ" nếu có chỉ là overlay che-và-viết-
  lại. Chờ chủ dự án xác nhận ở TASK-02.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — Chủ dự án đã xác
  nhận tại **DEC-017**: PDF = xem + viết/chú thích phủ + lưu annotation
  riêng + bảo vệ file gốc + xuất flatten; không cam kết sửa/xóa/thay thế
  text gốc và không xuất annotation native của Acrobat.

## ISSUE-008 — Hạ tầng dự án chưa có: Git, hosting, quy trình phát hành
- **Loại:** Quyết định còn thiếu / thiết lập còn thiếu.
- **Mô tả:** Thư mục `~/workspace/webscribble/` mới được tạo trong TASK-00 chỉ
  để chứa `docs/`. Chưa khởi tạo Git repo, chưa chọn nơi lưu code từ xa, chưa
  có hosting cho bản web. Việc kiểm tra trước TASK-00 xác nhận `~/workspace`
  không phải Git repo và không có package.json nào thuộc WebScribble.
- **Ảnh hưởng:** TASK-03 cần các quyết định này trước khi khởi tạo khung code.
- **Hướng xử lý:** Chủ dự án quyết định (repo ở đâu, hosting nào) ở TASK-02/03.
  Chỉ đề xuất nội dung commit; không tự commit khi chưa được yêu cầu.
- **Cập nhật TASK-03 (2026-10-30):** Phần Git local **đã thực hiện**:
  `git init` tại thư mục dự án, nhánh khởi tạo đổi tên thành `main`,
  `.gitignore` chuẩn Vite/Node + bổ sung `.env*`; đã kiểm tra
  `node_modules`/`dist` bị ignore đúng, **chưa có commit và chưa có
  remote** (chờ chủ dự án duyệt commit đầu tiên). **Còn lại của issue:**
  quyết định hosting (GitHub/GitLab/khác) và thời điểm kết nối remote —
  chưa quyết.
- **Trạng thái:** OPEN (2026-10-30) — đã thu hẹp còn phần hosting/remote.

## ISSUE-009 — Quan hệ giữa WebScribble và StudyWrite hiện có chưa chốt
- **Loại:** Quyết định còn thiếu.
- **Mô tả:** Chủ dự án đang có StudyWrite — ứng dụng một file HTML mở/chỉnh
  sửa DOCX kèm bút vẽ (Milestone 4), đã xử lý được một số vấn đề DOCX
  (OMML → MathML, ảnh VML, chip cảnh báo WMF). Chưa rõ WebScribble là sản
  phẩm thay thế/kế thừa StudyWrite, hay một sản phẩm độc lập; phần kinh
  nghiệm/code nào của StudyWrite được phép mang sang cũng chưa có quyết định.
- **Ảnh hưởng:** Phạm vi TASK-01 (có khảo sát lại từ đầu hay kế thừa kết quả
  StudyWrite) và lộ trình Word Engine.
- **Hướng xử lý:** Chủ dự án xác nhận trước hoặc trong TASK-01.
- **Trạng thái:** RESOLVED (2026-10-30) — Chủ dự án đã chọn **Phương án C**
  và ghi thành DEC-013: WebScribble độc lập về sản phẩm, được tận dụng có
  chọn lọc module của StudyWrite sau khi đánh giá chất lượng, kiểm tra
  quyền/nguồn gốc mã nguồn và khả năng tách module; không kế thừa mặc định
  toàn bộ, không phụ thuộc bắt buộc. Việc đánh giá module thuộc phạm vi TASK-01.

## ISSUE-010 — Xuất DOCX (export round-trip) chưa có giải pháp xác minh
- **Loại:** Chưa xác minh.
- **Mô tả:** Chưa xác định thư viện/chiến lược tạo file DOCX từ nội dung đã
  sửa (và chú thích phủ lên) sao cho mở đúng trong Word; khác với hướng đọc
  DOCX ở ISSUE-002. Chú thích dạng nét vẽ tay khi xuất sang DOCX sẽ ở dạng
  gì (ảnh phủ? shape?) cũng chưa chốt.
- **Ảnh hưởng:** Export Engine (TASK-09).
- **Hướng xử lý:** Khảo sát ở TASK-01; chốt chiến lược ở TASK-02/TASK-07.
- **Bằng chứng bổ sung (TASK-01, 2026-10-30):** Đã xác định được đường
  xuất chính: tự map Tiptap JSON → thư viện `docx` (MIT) — cùng thư viện
  StudyWrite đã dùng ở mức cơ bản (Luồng B, mục B9). Đường chính thức của
  Tiptap là extension Pro trả phí (mâu thuẫn DEC-010 nếu dùng cho lõi).
  Độ phủ định dạng của đường tự map cần prototype đo ở TASK-07 trước khi
  cam kết.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — **DEC-018** đã chốt
  chiến lược xuất DOCX: tự map mô hình editor → thư viện `docx` (MIT),
  không mua Tiptap Pro/Cloud. Độ phủ định dạng của bộ map sẽ đo bằng
  prototype trong TASK-07 (việc đã lên lịch, không còn là khoảng trống
  chiến lược).
- **Cập nhật đóng vòng (TASK-07E/07F, 2026-10-31):** bộ map đã xây
  xong và ĐO ĐƯỢC độ phủ: kiểm thử round-trip xuất → nhập lại giữ
  heading/căn lề/danh sách lồng/bảng/highlight/cỡ chữ/ảnh; LibreOffice
  mở và chuyển đổi thành công file xuất (DEC-030). Phần chú thích khi
  xuất đã chốt: không nhúng vào DOCX — bản phẳng kèm chú thích qua
  đường in/PDF của trình duyệt; sinh PDF bằng code thuộc TASK-09.

## ISSUE-011 — Cache tài nguyên lớn cho offline lần đầu
- **Loại:** Rủi ro kỹ thuật.
- **Mô tả:** Offline đầy đủ sau lần tải đầu đòi hỏi Service Worker cache toàn
  bộ app + thư viện nặng (PDF.js worker, thư viện xử lý DOCX/WASM nếu có).
  Lần tải đầu có thể chậm/nặng trên mạng yếu; cập nhật phiên bản mới phải
  tránh làm hỏng cache đang dùng.
- **Ảnh hưởng:** PWA/Offline (TASK-10) và ấn tượng lần đầu của người dùng.
- **Hướng xử lý:** Đo dung lượng gói ở TASK-01; thiết kế chiến lược cache và
  cập nhật ở TASK-10.
- **Trạng thái:** RESOLVED (2026-10-31, TASK-10) — Service Worker tự sinh ở bước build pre-cache toàn bộ dist gồm PDF.js worker (DEC-034); đã kiểm chứng offline trọn vẹn trên bản production (mở app, xem/vẽ PDF, xuất file khi mất mạng).

## ISSUE-012 — Infinite Canvas cho Whiteboard Mode chưa được đánh giá
- **Loại:** Chưa xác minh / quyết định còn thiếu.
- **Mô tả:** Whiteboard Mode (DEC-014) có hướng nghiên cứu bảng trắng vô hạn
  (Infinite Canvas). Chủ dự án đã lưu ý: **chưa được biến thành yêu cầu bắt
  buộc** khi chưa đánh giá kỹ thuật (ảnh hưởng tới mô hình tọa độ, lưu trữ,
  hiệu năng vẽ, xuất file).
- **Ảnh hưởng:** Whiteboard Engine (TASK-12) và mô hình dữ liệu bề mặt.
- **Hướng xử lý:** Đánh giá trong TASK-01; quyết định làm hay không ở TASK-02.
  Trước khi có quyết định, đặc tả chỉ ghi ở mức "hướng nghiên cứu".
- **Kết quả nghiên cứu (TASK-01, Luồng C, 2026-10-30):** Khuyến nghị
  **không làm Infinite Canvas ở giai đoạn đầu** — Whiteboard dạng trang cố
  định trước, nhưng thiết kế dữ liệu "sẵn sàng vô hạn" ngay từ TASK-02
  (tọa độ float theo bề mặt, mọi stroke có bbox, camera tách khỏi dữ
  liệu, Drawing Engine nhận transform). Khi đó nâng cấp sau này không
  phải migration dữ liệu. Điều kiện để đảo ngược khuyến nghị đã ghi rõ
  trong `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` mục 4.4.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — **DEC-019** đã
  quyết: giai đoạn đầu Whiteboard dùng trang cố định, chưa làm Infinite
  Canvas; 4 điều kiện dữ liệu "sẵn sàng vô hạn" (tọa độ float theo bề
  mặt, bbox cho mọi stroke, camera tách khỏi dữ liệu, Drawing Engine
  nhận transform) đã thành yêu cầu kiến trúc bắt buộc trong
  ARCHITECTURE.md mục 2.4. Issue mở lại nếu có quyết định triển khai
  Infinite Canvas.

## ISSUE-013 — Split Mode: cơ chế lưu trạng thái hai khu vực chưa thiết kế
- **Loại:** Chưa xác minh / rủi ro mất dữ liệu.
- **Mô tả:** Split Mode (DEC-014) gồm vùng tài liệu và vùng bảng trắng trong
  cùng một workspace. Chưa rõ: trạng thái hai vùng được lưu chung hay riêng,
  nhịp tự lưu khi người dùng viết ở cả hai vùng, và cách khôi phục workspace
  sau khi đóng app sao cho không mất dữ liệu ở bất kỳ vùng nào.
- **Ảnh hưởng:** TASK-13 (Split Mode), TASK-08 (Storage), mô hình dữ liệu.
- **Hướng xử lý:** Khảo sát mô hình dữ liệu "surface" ở TASK-01, chốt ở TASK-02.
- **Kết quả nghiên cứu (TASK-01, Luồng C, 2026-10-30):** Đã có mô hình đề
  xuất: Workspace là thực thể IndexedDB độc lập **tham chiếu** hai bề
  mặt; mỗi bề mặt tự chứa dữ liệu + trạng thái view của mình; tỷ lệ chia
  thuộc workspace; **tự lưu theo bề mặt** khi stroke kết thúc (dữ liệu
  mất tối đa là nét đang vẽ dở khi đóng đột ngột); **undo/redo tách riêng
  theo bề mặt** (tránh hoàn tác nhầm vùng không nhìn thấy); bảng trắng
  trong Split dùng chung kho thực thể với Whiteboard Mode. Chi tiết ở
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` Phần 3.
- **Cập nhật triển khai (TASK-13, 2026-10-31):** mô hình đã thành
  hiện thực đúng như thiết kế — workspace tham chiếu hai bề mặt,
  tự lưu và undo/redo tách riêng theo bề mặt, tỉ lệ chia thuộc
  workspace (DEC-032). Vết liên kết phiên lưu ở localStorage
  của thiết bị.
- **Trạng thái:** RESOLVED (2026-10-30, tại TASK-02) — Mô hình đã được
  chốt tại **DEC-020** (Workspace tham chiếu hai Surface; tự lưu theo
  Surface; Undo/Redo riêng theo Surface; khôi phục cả workspace) và phản
  ánh trong ARCHITECTURE.md mục 2.2/2.4/6. Cài đặt và kiểm chứng thực tế
  thuộc TASK-08/TASK-13.

## ISSUE-014 — Ma trận khả năng theo định dạng cần chốt chi tiết
- **Loại:** Quyết định còn thiếu.
- **Mô tả:** DEC-014 yêu cầu phân biệt "sửa nội dung gốc" và "chú thích phủ"
  theo từng định dạng (ma trận ban đầu ở PRODUCT_SPEC.md mục 3). Còn chưa rõ:
  danh sách chính xác của "định dạng ảnh phổ biến khác" (ví dụ WebP, HEIC —
  HEIC không hiển thị được trên nhiều trình duyệt); Split Mode trên mobile
  hẹp sẽ bố trí hai vùng thế nào; xuất file từ Split Mode có gộp hai vùng
  thành một file hay xuất riêng.
- **Ảnh hưởng:** PRODUCT_SPEC (mục 3), TASK-06/07/09/13.
- **Hướng xử lý:** Chủ dự án chốt dần; phần kỹ thuật (HEIC) khảo sát ở TASK-01.
- **Kết quả nghiên cứu (TASK-01, Luồng C, 2026-10-30) — phần định dạng
  ảnh đã rõ:** PNG/JPG/WebP/GIF hiển thị trực tiếp (WebP cần Safari ≥14 +
  macOS Big Sur+); BMP hiển thị trực tiếp nhưng **không ưu tiên lưu trữ**
  (không nén, tốn quota — chuyển PNG/WebP khi lưu); SVG hiển thị trực
  tiếp ở chế độ ảnh an toàn (tắt script), chỉ khi inline sửa mới cần
  sanitize; HEIC/HEIF **chỉ Safari ≥17 mở native**, trình duyệt khác cần
  decoder WASM lazy-load (~1,2 MB, chưa xác minh độc lập) hoặc thông báo
  cần chuyển đổi. Chi tiết: file Luồng C Phần 1.
- **Còn mở sau nghiên cứu:** (1) phương án xuất file của Split Mode — đã
  có 4 phương án A/B/C/D kèm ưu/nhược ở file Luồng C mục 3.3, chờ chủ dự
  án chọn; (2) bố trí Split Mode trên mobile hẹp (orientation dọc đã có
  trong mô hình workspace đề xuất nhưng chưa được chốt); (3) ngữ nghĩa
  GIF làm nền tài liệu (animation chạy hay frame tĩnh).
- **Cập nhật TASK-02 (2026-10-30):** Hai trong ba điểm còn mở đã được
  quyết: xuất Split Mode = **phương án B** (DEC-021); HEIC = chưa tích
  hợp decoder ở giai đoạn đầu, hiển thị thông báo chưa hỗ trợ (DEC-023).
  **Phạm vi issue thu hẹp còn:** bố trí Split Mode trên mobile hẹp và
  ngữ nghĩa GIF làm nền tài liệu — hai quyết định sản phẩm nhỏ, chốt
  khi làm TASK-13/TASK-06.
- **Trạng thái:** OPEN (2026-10-30) — phần kỹ thuật và 2/3 quyết định đã
  có kết luận; còn 2 quyết định sản phẩm nhỏ nêu trên.

## ISSUE-015 — Hai tab cùng sửa một tài liệu: ghi sau thắng (last-writer-wins)

- **Phát hiện:** TASK-06F (2026-10-31), kiểm thử hai tab trên cùng
  một browser context (cùng IndexedDB).
- **Hiện tượng:** mỗi surface (một trang của một tài liệu) được lưu
  bằng cách ghi đè toàn bộ record. Nếu hai tab cùng mở một tài liệu
  và cùng vẽ trên cùng một trang, bản lưu của tab ghi sau sẽ thay
  toàn bộ bản của tab ghi trước — nét vẽ của tab trước mất, không
  có hợp nhất (merge) và không có cảnh báo xung đột. Dữ liệu không
  hỏng cấu trúc: trạng thái cuối luôn là một bản nhất quán của
  đúng một tab (đã kiểm chứng bằng pixel: mực sau cùng khớp đúng
  một nét).
- **Đã giảm nhẹ trong TASK-06F:** trường hợp tab chỉ MỞ XEM rồi
  đóng cũng ghi đè đã được sửa tại gốc (session.close() chỉ ghi
  khi có thay đổi thật — xem CHANGELOG TASK-06F), nên rủi ro chỉ
  còn khi hai tab cùng THỰC SỰ chỉnh sửa đồng thời.
- **Đánh giá:** chấp nhận được cho sản phẩm local-first một người
  dùng ở giai đoạn này; người dùng thường chỉ mở một tab. Không tự
  triển khai đồng bộ đa tab trong TASK-06F theo brief.
- **Phương án đề xuất khi cần xử lý:** (1) tối thiểu — cảnh báo
  "tài liệu đang mở ở tab khác" bằng BroadcastChannel/heartbeat
  trong IndexedDB; (2) đầy đủ — khóa ghi theo surface kèm kiểm tra
  updatedAt lạc quan (optimistic concurrency): saveSurface từ chối
  khi record đã mới hơn thời điểm session mở, UI báo xung đột để
  người dùng chọn. Cả hai đều ngoài phạm vi hiện tại.
- **Trạng thái:** OPEN (2026-10-31) — rủi ro đã biết, có phương án.

## ISSUE-016 — Chú thích trên DOCX không bám theo chữ khi sửa nội dung

- **Phát hiện:** thiết kế tại TASK-07-SCOPE, chốt tại TASK-07D
  (2026-10-31) — **DEC-029**.
- **Hiện tượng:** nét chú thích trên tài liệu DOCX neo theo tọa độ
  tuyệt đối trong không gian nội dung của editor. Nếu người dùng
  chèn/xóa chữ ở phía trên, hoặc cửa sổ đổi chiều ngang làm chữ
  xuống dòng lại, chữ dời đi nhưng nét vẽ giữ nguyên vị trí tuyệt
  đối → nét có thể lệch so với đoạn chữ nó từng trỏ vào. Dữ liệu
  nét không mất và không hỏng.
- **Đánh giá:** giới hạn đã CHẤP NHẬN cho version 1 và được công
  bố ngay trong thanh công cụ chú thích của editor. Neo theo vị
  trí ký tự (character anchoring) đòi hỏi mô hình neo văn bản
  riêng gắn với ProseMirror — ngoài phạm vi MODULE 07.
- **Trạng thái:** OPEN — giới hạn đã biết, đã công bố cho người
  dùng; xử lý khi có nhu cầu neo theo chữ thực tế.
