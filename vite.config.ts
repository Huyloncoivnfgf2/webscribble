import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Base path: bản phát hành chạy trên GitHub Pages ở
// https://Huyloncoivnfgf2.github.io/webscribble/ nên mặc
// định là '/webscribble/'. Đặt WS_BASE=/ khi cần chạy ở
// gốc domain (cả vite build lẫn scripts/generate-sw.mjs
// đều đọc cùng biến này).
const base = process.env.WS_BASE ?? '/webscribble/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
