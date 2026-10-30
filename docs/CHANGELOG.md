# CHANGELOG — WebScribble

> Ghi thay đổi theo từng task: Task ID · Ngày · File tạo/sửa · Nội dung ·
> Kết quả kiểm tra. Chỉ thêm mục mới ở đầu phần "Lịch sử"; không viết lại cũ.

## Lịch sử

### TASK-03 — 2026-10-30 — Khởi tạo khung dự án

- **File/thư mục được tạo:** khung ứng dụng tại `~/workspace/webscribble/`
  (ngoài `docs/`): `package.json`, `package-lock.json`, `vite.config.ts`,
  `eslint.config.js`, `tsconfig*.json`, `index.html`, `public/`,
  `README.md`, `.gitignore` (bổ sung `.env*`), và `src/` theo cấu trúc:
  `app/` (App.tsx trang khởi đầu + components/layouts/features),
  `core/` (services/stores), `engines/` (pdf, word, document, whiteboard,
  drawing, annotation, export — mỗi thư mục một README placeholder nêu
  vai trò + DEC liên quan + task triển khai), `data/repositories`,
  `offline/`, `types/`, `hooks/`, `utils/`, `config/`, `assets/`,
  `styles/` (index.css với `@import "tailwindcss"`), `main.tsx`,
  `tests/`. Thư mục rỗng giữ chỗ bằng `.gitkeep`.
- **Hai điều chỉnh so với khuôn mẫu mặc định (đã báo cáo chủ dự án):**
  (1) Template `create-vite` hiện tại dùng **oxlint** — đã gỡ và thay
  bằng **ESLint** (flat config + typescript-eslint + react-hooks +
  react-refresh) đúng yêu cầu của task. (2) **TypeScript chốt 5.9.3**
  thay vì 7.0.2 của template, vì `typescript-eslint@8.72.1` khai báo
  peer `typescript <6.1.0` (cài cùng TS 7 báo ERESOLVE); nâng lại khi
  typescript-eslint hỗ trợ TS 7. Không quyết định nào trong DEC-016 →
  023 bị thay đổi (DEC-016 không ghim phiên bản TypeScript).
- **Phiên bản + giấy phép thực tế (đọc từ gói đã cài):** react/react-dom
  19.3.1 MIT; vite 8.3.5 MIT; @vitejs/plugin-react 6.1.2 MIT;
  tailwindcss/@tailwindcss/vite 4.3.3 MIT; typescript 5.9.3 Apache-2.0;
  eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1,
  eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.7,
  globals 17.13.0, @types/node 24.19.2, @types/react 19.3.0,
  @types/react-dom 19.3.0 — tất cả MIT. Không thư viện trả phí, không
  CDN (đã grep kiểm tra src + cấu hình).
- **Kiểm tra đã chạy thật:** `npm install` thành công, có
  `package-lock.json`; `npm run build` đạt (`tsc -b` + vite build, CSS
  Tailwind 7,99 kB); `npm run lint` đạt (exit 0, không lỗi/cảnh báo);
  `npm run dev` khởi động (Vite ready ~439 ms), phục vụ index.html với
  tiêu đề WebScribble và module App.tsx chứa đúng tên + tagline, sau đó
  đã tắt server.
- **Git:** `git init` (nhánh đổi tên `master` → `main`), `.gitignore`
  đã kiểm tra chặn đúng `node_modules`/`dist`/`.env*`; `git status` gồm
  14 mục chưa track; **chưa commit, chưa remote** theo yêu cầu. ISSUE-008
  thu hẹp còn quyết định hosting/remote.
- **Đồng bộ bộ nhớ:** TASKS.md (TASK-03 DONE + kết quả),
  CURRENT_STATE.md, KNOWN_ISSUES.md (ISSUE-008), PROJECT_INDEX.md (docs
  version 1.4), CHANGELOG.md. Không triển khai engine/PWA/IndexedDB nào;
  không sửa StudyWrite.

### TASK-02 — 2026-10-30 — Chốt kiến trúc & quyết định công nghệ

- **File được sửa (7):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/KNOWN_ISSUES.md`, `docs/TASKS.md`,
  `docs/CURRENT_STATE.md`, `docs/PROJECT_INDEX.md` (docs version 1.3).
  Không sửa: PROJECT_CONTEXT.md, AI_WORKFLOW.md, 3 file research.
- **Nội dung:**
  - DECISIONS.md: ghi 8 quyết định do chủ dự án xác nhận thành
    **DEC-016 → DEC-023** — stack chính thức + Dexie + 7 điều kiện
    (DEC-016); phạm vi PDF flatten, bảo vệ file gốc (DEC-017); phạm vi
    DOCX chấp nhận mất định dạng, giữ file gốc, cảnh báo khi xuất, xuất
    bằng thư viện `docx` (DEC-018); Whiteboard trang cố định, chưa
    Infinite Canvas, dữ liệu sẵn sàng mở rộng (DEC-019); mô hình
    Workspace/Surface, tự lưu + undo theo Surface (DEC-020); xuất Split
    Mode = phương án B (DEC-021); iOS offline + sao lưu/khôi phục bắt
    buộc (DEC-022); HEIC chưa tích hợp decoder (DEC-023). DEC-017/018/020
    ghi rõ là cụ thể hóa DEC-005/006/014-015 — không quyết định cũ nào bị
    sửa hoặc xóa.
  - PRODUCT_SPEC.md: thêm stack đã chốt (mục 1); ma trận Document Mode
    cập nhật (PDF sửa gốc = không cam kết theo DEC-017; HEIC theo
    DEC-023); Split Mode thêm mô hình lưu DEC-020 + xuất phương án B;
    Whiteboard chốt trang cố định; module PDF/Word/Annotation/Storage/
    Export/PWA đồng bộ theo DEC-017/018/020/021/022.
  - ARCHITECTURE.md: mục 1 chuyển từ "đề xuất" sang bảng công nghệ đã
    chốt kèm ghi chú bắt buộc (thêm Mammoth, thư viện `docx`, Dexie,
    perfect-freehand); Engine Layer mô tả pipeline Word (Mammoth →
    sanitize → Tiptap) và xuất flatten; Data Layer thêm Dexie, điều
    kiện dữ liệu của DEC-019, sao lưu/khôi phục và `storage.persist()`;
    thêm luồng 4.4 Sao lưu/Khôi phục; mục 6 cập nhật trạng thái đã chốt.
  - KNOWN_ISSUES.md: ISSUE-001/002/007/010/012/013 → **RESOLVED** (mỗi
    mục ghi bằng chứng là quyết định tương ứng); ISSUE-014 thu hẹp còn
    mobile + GIF; ISSUE-005 thêm ghi chú giảm nhẹ bởi DEC-022, giữ OPEN.
  - TASKS.md: TASK-02 → DONE + kết quả; TASK-03 giữ NOT_STARTED.
- **Kết quả kiểm tra:** DEC chạy đủ 001→023 không trùng; 3 task DONE
  (00/01/02), còn lại NOT_STARTED; đối chiếu SPEC ↔ ARCHITECTURE ↔
  DECISIONS ở các điểm đã chốt (PDF flatten, DOCX, Split, Whiteboard,
  HEIC, backup) — nhất quán; không còn nhãn CHƯA XÁC MINH nào mâu thuẫn
  với quyết định mới. Không tạo code/package.json, không cài dependency.

### TASK-01 — 2026-10-30 — Khảo sát & kiểm chứng công nghệ

- **File được tạo (3):** `docs/research/TECH_SURVEY.md` (Luồng A),
  `docs/research/STUDYWRITE_MODULE_AUDIT.md` (Luồng B),
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` (Luồng C).
- **File được sửa:** `docs/TASKS.md` (TASK-01 → DONE + kết quả),
  `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md` (ISSUE-001 →
  INVESTIGATING; bổ sung bằng chứng/kết luận cho ISSUE-002/007/010/012/
  013/014), `docs/ARCHITECTURE.md` (ghi chú trạng thái khảo sát ở mục 1),
  `docs/PROJECT_INDEX.md` (docs version 1.2), `docs/CHANGELOG.md`.
- **Nội dung chính:**
  - Luồng A: toàn bộ stack có khuyến nghị kèm nguồn chính thức — USE cho
    React/TypeScript/Vite/Tailwind/IndexedDB/Zustand/Canvas 2D +
    perfect-freehand; USE WITH CONDITIONS cho PDF.js (virtualization,
    worker cùng origin), pdf-lib (chỉ flatten, **không sửa được text
    gốc PDF** — trích Limitations chính thức), Tiptap (DOCX là nhập/xuất
    mất mát; tránh Pro/Cloud), Mammoth (chỉ trích ngữ nghĩa; phải
    sanitize), Service Worker/PWA (HTTPS; **ITP Safari xóa storage sau
    7 ngày nếu chưa cài vào Màn hình chính**). Giấy phép đã kiểm chứng
    qua npm registry: toàn MIT/Apache-2.0/BSD/ISC.
  - Luồng B (chỉ đọc StudyWrite): 11 cụm module được chấm — USE: xử lý
    ảnh/chip WMF; USE AFTER REFACTOR: tiền xử lý DOCX, OMML→MathML, đường
    nhập DOCX, thước/zoom, xuất DOCX bằng thư viện `docx`; tham chiếu
    thiết kế: hệ bút vẽ; DO NOT USE: xuất PDF raster, `.swp.json`, UI
    shell/nạp CDN. Ghi nhận JSZip dual license MIT/GPLv3 và hai module
    "không tồn tại" (annotation độc lập, chuyển đổi WMF/EMF thật).
  - Luồng C: ma trận ảnh (HEIC chỉ Safari ≥17 + cần WASM ở nơi khác; BMP
    không ưu tiên lưu); mô hình stroke điểm thô + bbox; undo/redo theo bề
    mặt; mô hình Workspace/Surface + tự lưu theo bề mặt cho Split Mode; 4
    phương án xuất Split Mode (chưa chốt); khuyến nghị Whiteboard trang
    cố định trước, dữ liệu sẵn sàng cho Infinite Canvas.
  - Mâu thuẫn nguồn được ghi minh bạch trong TECH_SURVEY: trạng thái hỗ
    trợ `getCoalescedEvents` trên Safari (18.2+ theo dữ liệu MDN mới vs
    chưa hỗ trợ theo bảng MDN khác) — cần kiểm chứng bằng thiết bị ở TASK-05.
- **Kết quả kiểm tra:** Đủ 3 file nghiên cứu; đối chiếu trạng thái task/
  issue giữa TASKS, CURRENT_STATE, KNOWN_ISSUES — nhất quán. Không tạo
  code ứng dụng, không sửa StudyWrite, không chốt quyết định nào thay
  chủ dự án (mọi khuyến nghị để lại cho TASK-02).

### Cập nhật bộ nhớ — 2026-10-30 — Quyết định StudyWrite (phương án C) + hệ thống 3 chế độ

- **Bối cảnh:** Lượt cập nhật theo yêu cầu chủ dự án, không phải task trong
  roadmap; không task nào được đánh dấu DONE trong lượt này.
- **File được sửa (8):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`,
  `docs/KNOWN_ISSUES.md`, `docs/PROJECT_INDEX.md`, `docs/CHANGELOG.md`.
  (Không sửa: `PROJECT_CONTEXT.md`, `AI_WORKFLOW.md` — không có nội dung liên quan.)
- **Nội dung:**
  - DECISIONS.md: thêm DEC-013 (WebScribble độc lập với StudyWrite, tái sử
    dụng module có chọn lọc theo 4 điều kiện), DEC-014 (3 chế độ làm việc:
    Document / Split / Whiteboard + nguyên tắc phân biệt sửa nội dung gốc
    vs chú thích phủ), DEC-015 (một Drawing Engine duy nhất cho cả 3 chế độ).
  - KNOWN_ISSUES.md: ISSUE-009 → RESOLVED (bằng chứng: DEC-013); mở mới
    ISSUE-012 (Infinite Canvas chưa đánh giá), ISSUE-013 (lưu trạng thái
    Split Mode), ISSUE-014 (chi tiết ma trận định dạng).
  - PRODUCT_SPEC.md: thêm mục 3 "Ba chế độ làm việc" kèm ma trận khả năng
    theo định dạng; các mục sau đánh số lại (module → mục 4, phi chức năng
    → mục 5, nghiệm thu → mục 6); bổ sung ghi chú DEC-015 ở module Drawing
    Engine và Annotation Engine.
  - ARCHITECTURE.md: thêm Whiteboard Engine, khái niệm Workspace/Surface ở
    Application Core và Data Layer, thư mục `engines/whiteboard/`, và mục 6
    phân tích ảnh hưởng của 3 chế độ.
  - TASKS.md: mở rộng TASK-01 thành 3 luồng khảo sát (stack / audit module
    StudyWrite / kiến trúc 3 chế độ) kèm file đầu ra; thêm TASK-12
    (Whiteboard Engine & Mode) và TASK-13 (Split Mode); TASK-11 cập nhật
    phụ thuộc và tham chiếu PRODUCT_SPEC mục 6.
  - CURRENT_STATE.md và PROJECT_INDEX.md: cập nhật trạng thái, docs
    version 1.1.
- **Kết quả kiểm tra:** Đối chiếu chéo ID (DEC-001→015, ISSUE-001→014,
  TASK-00→13) giữa các file — nhất quán; ISSUE-009 đúng trạng thái RESOLVED;
  3 chế độ có mặt trong PRODUCT_SPEC và ARCHITECTURE. Không tạo/sửa bất kỳ
  file mã nguồn nào.

### TASK-00 — 2026-10-30 — Khởi tạo hệ thống bộ nhớ dự án

- **File được tạo (10):** `docs/PROJECT_INDEX.md`, `docs/PROJECT_CONTEXT.md`,
  `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`,
  `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`,
  `docs/KNOWN_ISSUES.md`, `docs/AI_WORKFLOW.md`.
- **File được sửa:** Không có (dự án mới).
- **Nội dung:**
  - Kiểm tra trước khi tạo: chưa tồn tại dự án WebScribble; thư mục gốc dự án
    `~/workspace/webscribble/` được tạo mới chỉ để chứa `docs/`; không có
    package.json/framework nào thuộc dự án này; `~/workspace` không phải
    Git repo. Dự án HSA và file StudyWrite sẵn có không bị đụng tới.
  - Ghi nhận 12 quyết định nền tảng của chủ dự án vào DECISIONS.md
    (DEC-001 → DEC-012).
  - Đặc tả sản phẩm theo module vào PRODUCT_SPEC.md, có gắn nhãn
    ĐÃ THỐNG NHẤT / ĐỀ XUẤT / CHƯA XÁC MINH.
  - Kiến trúc đề xuất (5 lớp) + nguyên tắc tách Drawing Engine khỏi
    Document Engine vào ARCHITECTURE.md; stack ghi rõ là đề xuất chưa chốt.
  - Roadmap TASK-00 → TASK-11 vào TASKS.md; CURRENT_STATE.md ghi rõ ứng
    dụng chưa được lập trình.
  - Mở 11 issue ban đầu trong KNOWN_ISSUES.md (ISSUE-001 → ISSUE-011).
- **Kết quả kiểm tra:** Đủ 10 file; PROJECT_INDEX.md dưới 100 dòng; đối chiếu
  chéo ID task/quyết định/issue giữa các file — nhất quán (chi tiết trong báo
  cáo TASK-00). Không chạy kiểm thử code vì chưa có code.
