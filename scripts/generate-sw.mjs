/**
 * Sinh Service Worker cho WebScribble (TASK-10, DEC-034)
 * ở bước build: quét toàn bộ thư mục dist/, tính phiên
 * bản từ hash nội dung, và ghi dist/sw.js với danh sách
 * PRE-CACHE đầy đủ (HTML, JS/CSS đã hash, PDF.js worker,
 * icons, manifest).
 *
 * Chiến lược của SW được sinh:
 * - install: pre-cache toàn bộ app shell; KHÔNG tự
 *   skipWaiting — bản cập nhật chờ người dùng bấm
 *   "Cập nhật" (trang gửi message SKIP_WAITING).
 * - activate: xóa mọi cache khác phiên bản, claim clients.
 * - fetch (GET, cùng origin): điều hướng → bản cache
 *   của index.html (SPA chạy offline hoàn toàn); tài
 *   nguyên tĩnh → cache-first, thiếu thì mạng + lưu bổ
 *   sung. Cross-origin: không can thiệp.
 *
 * Chạy tự động qua script "build" của package.json.
 * Các hàm được export để Vitest kiểm thử trực tiếp.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function collectDistFiles(distDir) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        const rel = relative(distDir, full).split(sep).join('/')
        if (rel !== 'sw.js') files.push(rel)
      }
    }
  }
  walk(distDir)
  return files.sort()
}

export function computeVersion(distDir, files) {
  const hash = createHash('sha256')
  for (const file of files) {
    const content = readFileSync(join(distDir, file))
    hash.update(file)
    hash.update(createHash('sha256').update(content).digest())
  }
  return hash.digest('hex').slice(0, 12)
}

export function buildServiceWorkerSource({ version, precacheUrls }) {
  return `// WebScribble Service Worker — TỰ SINH bởi scripts/generate-sw.mjs, không sửa tay.
// Phiên bản: ${version}
const VERSION = ${JSON.stringify(version)};
const CACHE = 'webscribble-' + VERSION;
const PRECACHE = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('webscribble-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        // ignoreVary: file tinh co the duoc phuc vu kem
        // header "Vary: Origin" (may chu tinh pho bien) —
        // khong bo qua Vary thi ban cache khong khop voi
        // request cua trinh duyet va offline se gay.
        const cached = await cache.match('/index.html', { ignoreVary: true });
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response('WebScribble dang offline va chua co ban cache.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
`
}

export function generateServiceWorker(distDir) {
  const files = collectDistFiles(distDir)
  if (!files.includes('index.html')) {
    throw new Error(`generate-sw: ${distDir} không có index.html — hãy chạy vite build trước.`)
  }
  const version = computeVersion(distDir, files)
  const precacheUrls = ['/', ...files.map((file) => `/${file}`)]
  const source = buildServiceWorkerSource({ version, precacheUrls })
  writeFileSync(join(distDir, 'sw.js'), source)
  return { version, precacheCount: precacheUrls.length, fileCount: files.length }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const distDir = join(fileURLToPath(import.meta.url), '..', '..', 'dist')
  void statSync(distDir)
  const result = generateServiceWorker(distDir)
  console.log(
    `sw.js: version ${result.version}, pre-cache ${result.precacheCount} URLs (${result.fileCount} files)`,
  )
}
