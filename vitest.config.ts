import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Vitest dùng cùng cấu hình Vite của app, cộng một alias dành riêng
 * cho môi trường Node: pdfjs-dist bản chính không chạy được trong
 * Node (thiếu API trình duyệt mới), nên test dùng bản `legacy` —
 * chính PDF.js cũng in cảnh báo yêu cầu điều này. Code sản phẩm vẫn
 * import 'pdfjs-dist' bản chính và worker đóng gói cho trình duyệt;
 * alias chỉ áp dụng khi chạy test.
 */
export default defineConfig({
  ...viteConfig,
  resolve: {
    alias: [
      {
        find: /^pdfjs-dist$/,
        replacement: fileURLToPath(
          new URL('./node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url),
        ),
      },
      {
        // Mammoth bản Node chỉ nhận path/buffer; bản trình duyệt
        // (mà app thật dùng qua trường "browser" của package)
        // nhận arrayBuffer — test phải chạy đúng bản app dùng
        // (TASK-07A).
        find: /^mammoth$/,
        replacement: fileURLToPath(
          new URL('./node_modules/mammoth/mammoth.browser.js', import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
