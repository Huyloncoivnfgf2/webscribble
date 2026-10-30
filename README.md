# WebScribble

Write. Annotate. Edit. Anywhere.

Ứng dụng web chú thích, viết tay và chỉnh sửa tài liệu (PDF, DOCX, ảnh) —
PWA, local-first, chạy offline sau lần tải đầu.

## Trạng thái

Khung dự án (TASK-03) đã khởi tạo theo stack chốt tại DEC-016. Chưa có
chức năng sản phẩm. Tài liệu dự án (đặc tả, kiến trúc, quyết định) nằm ở
thư mục `docs/` — điểm vào: `docs/PROJECT_INDEX.md`.

## Công nghệ

- React + TypeScript + Vite
- Tailwind CSS (qua npm, plugin `@tailwindcss/vite`)
- ESLint (flat config)

Các thư viện theo tính năng (PDF.js, pdf-lib, Tiptap, Mammoth, Dexie,
Zustand, perfect-freehand) sẽ được cài ở các task triển khai tương ứng,
không cài trước.

## Lệnh cơ bản

```bash
npm install     # cài dependency
npm run dev     # chạy môi trường phát triển
npm run build   # kiểm tra type + build production vào dist/
npm run lint    # chạy ESLint
```
