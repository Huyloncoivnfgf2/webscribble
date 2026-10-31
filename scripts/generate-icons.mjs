/**
 * Sinh bộ icon PWA của WebScribble (TASK-10) bằng PNG
 * encoder thuần Node (zlib tích hợp) — không cần thêm
 * dependency đồ họa. Chạy: node scripts/generate-icons.mjs
 * Kết quả vào public/icons/ và được commit như asset tĩnh.
 *
 * Thiết kế: nền xanh #2563EB (màu nhấn của UI), một nét
 * bút trắng cong (dấu tay viết) kèm chấm bút — gợi đúng
 * tinh thần "viết tay lên tài liệu".
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [37, 99, 235] // #2563EB
const BG_DARK = [30, 64, 175] // #1E40AF (viền dưới tạo chiều sâu)
const WHITE = [255, 255, 255]

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = maskable ? 0 : size * 0.22
  const setPx = (x, y, [r, g, b], alpha = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = alpha
  }
  // Nền: bo góc (trừ maskable = full-bleed), dải tối ở đáy:
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (radius > 0) {
        const cx = Math.max(radius - x, 0, x - (size - radius - 1))
        const cy = Math.max(radius - y, 0, y - (size - radius - 1))
        if (Math.hypot(cx, cy) > radius) continue // trong suốt ở góc
      }
      setPx(x, y, y > size * 0.78 ? BG_DARK : BG)
    }
  }
  // Nét bút: đường cong Bezier bậc 2 từ trái-trên xuống
  // giữa rồi vọt lên phải — đóng dấu hình tròn dày:
  const p0 = { x: 0.24, y: 0.34 }
  const p1 = { x: 0.44, y: 0.78 }
  const p2 = { x: 0.76, y: 0.30 }
  const brush = size * 0.045
  for (let t = 0; t <= 1.0001; t += 0.004) {
    const mt = 1 - t
    const x = (mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x) * size
    const y = (mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y) * size
    for (let dy = -brush; dy <= brush; dy += 1) {
      for (let dx = -brush; dx <= brush; dx += 1) {
        if (Math.hypot(dx, dy) <= brush) setPx(Math.round(x + dx), Math.round(y + dy), WHITE)
      }
    }
  }
  // Gạch chân nét bút (swoosh):
  const underlineY = 0.74 * size
  for (let x = 0.22 * size; x <= 0.78 * size; x += 1) {
    const wave = Math.sin(((x / size) - 0.22) / 0.56 * Math.PI) * size * 0.012
    for (let dy = -size * 0.016; dy <= size * 0.016; dy += 1) {
      setPx(Math.round(x), Math.round(underlineY + wave + dy), WHITE)
    }
  }
  // Chấm bút ở đầu nét:
  const dotR = size * 0.035
  for (let dy = -dotR; dy <= dotR; dy += 1) {
    for (let dx = -dotR; dx <= dotR; dx += 1) {
      if (Math.hypot(dx, dy) <= dotR) {
        setPx(Math.round(p2.x * size + dx), Math.round(p2.y * size - size * 0.07 + dy), WHITE)
      }
    }
  }
  return encodePng(size, size, rgba)
}

const outDir = dirname(fileURLToPath(import.meta.url)) + '/../public/icons'
mkdirSync(outDir, { recursive: true })
const files = [
  ['icon-192.png', drawIcon(192)],
  ['icon-512.png', drawIcon(512)],
  ['icon-maskable-512.png', drawIcon(512, { maskable: true })],
  ['apple-touch-icon.png', drawIcon(180)],
  ['favicon-64.png', drawIcon(64)],
]
for (const [name, png] of files) {
  writeFileSync(`${outDir}/${name}`, png)
  console.log('wrote', name, png.length, 'bytes')
}
