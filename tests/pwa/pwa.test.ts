import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyServiceWorkerUpdate,
  ConnectivityStore,
  InstallPromptStore,
  isStandaloneDisplay,
  registerServiceWorker,
  resetServiceWorkerStateForTests,
  type ServiceWorkerContainerLike,
  type ServiceWorkerLike,
  type ServiceWorkerRegistrationLike,
} from '../../src/pwa/index'

// ------------------------------------------------------------------
// Manifest & icons
// ------------------------------------------------------------------

const root = join(__dirname, '..', '..')

describe('TASK-10 — manifest.webmanifest', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'))

  it('có đủ trường bắt buộc cho PWA cài đặt được', () => {
    expect(manifest.name).toBe('WebScribble')
    expect(manifest.short_name).toBe('WebScribble')
    expect(manifest.description).toContain('Write. Annotate. Edit. Anywhere.')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('icons đủ 192/512/maskable và mọi file đều tồn tại trong public/', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) {
      expect(existsSync(join(root, 'public', icon.src)), icon.src).toBe(true)
    }
  })

  it('các file icon là PNG thật với đúng kích thước trong IHDR', () => {
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const bytes = readFileSync(join(root, 'public', 'icons', file))
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
      expect(bytes.readUInt32BE(16)).toBe(size)
      expect(bytes.readUInt32BE(20)).toBe(size)
    }
  })
})

// ------------------------------------------------------------------
// Service Worker generator
// ------------------------------------------------------------------

interface SwGenerator {
  collectDistFiles(dir: string): string[]
  computeVersion(dir: string, files: string[]): string
  buildServiceWorkerSource(input: { version: string; precacheUrls: string[] }): string
  generateServiceWorker(dir: string): { version: string; precacheCount: number }
}

const generator = (await import('../../scripts/generate-sw.mjs')) as unknown as SwGenerator

function makeDistFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ws-dist-'))
  writeFileSync(join(dir, 'index.html'), '<html>app</html>')
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log(1)')
  writeFileSync(join(dir, 'assets', 'pdf.worker.min-xyz.mjs'), 'worker')
  writeFileSync(join(dir, 'manifest.webmanifest'), '{}')
  return dir
}

describe('TASK-10 — generate-sw', () => {
  it('quét đủ file dist (trừ chính sw.js) và pre-cache có / + index.html + worker', () => {
    const dir = makeDistFixture()
    writeFileSync(join(dir, 'sw.js'), 'old')
    const files = generator.collectDistFiles(dir)
    expect(files).toContain('index.html')
    expect(files).toContain('assets/pdf.worker.min-xyz.mjs')
    expect(files).not.toContain('sw.js')

    const result = generator.generateServiceWorker(dir)
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8')
    expect(result.precacheCount).toBe(files.length + 1)
    expect(sw).toContain('"/index.html"')
    expect(sw).toContain('"/assets/pdf.worker.min-xyz.mjs"')
    expect(sw).toContain(`const VERSION = "${result.version}"`)
    expect(sw).toContain('SKIP_WAITING')
    // Chống gãy offline khi máy chủ tĩnh trả "Vary: Origin":
    expect(sw).toContain('ignoreVary: true')
  })

  it('phiên bản đổi khi nội dung file đổi, giữ nguyên khi không đổi', () => {
    const dir = makeDistFixture()
    const files = generator.collectDistFiles(dir)
    const v1 = generator.computeVersion(dir, files)
    expect(generator.computeVersion(dir, files)).toBe(v1)
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log(2)')
    expect(generator.computeVersion(dir, files)).not.toBe(v1)
  })

  it('báo lỗi rõ ràng khi dist thiếu index.html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-dist-empty-'))
    expect(() => generator.generateServiceWorker(dir)).toThrow(/index\.html/)
  })
})

// ------------------------------------------------------------------
// registerServiceWorker + update flow (fakes)
// ------------------------------------------------------------------

class FakeWorker implements ServiceWorkerLike {
  state = 'installing'
  messages: unknown[] = []
  private listeners: Array<() => void> = []
  postMessage(message: unknown): void {
    this.messages.push(message)
  }
  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.push(listener)
  }
  setState(state: string): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

class FakeRegistration implements ServiceWorkerRegistrationLike {
  waiting: ServiceWorkerLike | null = null
  installing: ServiceWorkerLike | null = null
  private listeners: Array<() => void> = []
  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.listeners.push(listener)
  }
  fireUpdateFound(): void {
    for (const listener of this.listeners) listener()
  }
}

class FakeContainer implements ServiceWorkerContainerLike {
  controller: ServiceWorkerLike | null = null
  registeredURL: string | null = null
  readonly registration = new FakeRegistration()
  private controllerListeners: Array<() => void> = []
  async register(scriptURL: string): Promise<ServiceWorkerRegistrationLike> {
    this.registeredURL = scriptURL
    return this.registration
  }
  addEventListener(_type: 'controllerchange', listener: () => void): void {
    this.controllerListeners.push(listener)
  }
}

describe('TASK-10 — registerServiceWorker', () => {
  it('bỏ qua ở bản dev, báo unsupported khi thiếu container', async () => {
    resetServiceWorkerStateForTests()
    const container = new FakeContainer()
    await expect(
      registerServiceWorker({ container, isProduction: false }),
    ).resolves.toBe('skipped-not-production')
    expect(container.registeredURL).toBeNull()
    await expect(registerServiceWorker({ isProduction: true, container: undefined })).resolves.toBe(
      'unsupported',
    )
  })

  it('đăng ký /sw.js và báo update khi worker mới cài xong lúc app đang chạy', async () => {
    resetServiceWorkerStateForTests()
    const container = new FakeContainer()
    container.controller = new FakeWorker() // bản cũ đang điều khiển
    let updates = 0
    const result = await registerServiceWorker({
      container,
      isProduction: true,
      onUpdateAvailable: () => {
        updates += 1
      },
    })
    expect(result).toBe('registered')
    expect(container.registeredURL).toBe('/sw.js')

    const installing = new FakeWorker()
    container.registration.installing = installing
    container.registration.fireUpdateFound()
    installing.setState('installed')
    expect(updates).toBe(1)

    // Bấm Cập nhật: gửi SKIP_WAITING tới worker đang chờ:
    const waiting = new FakeWorker()
    container.registration.waiting = waiting
    expect(applyServiceWorkerUpdate()).toBe(true)
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
  })
})

// ------------------------------------------------------------------
// InstallPromptStore & ConnectivityStore (fakes)
// ------------------------------------------------------------------

class FakeEventTarget {
  private map = new Map<string, Array<(event: never) => void>>()
  addEventListener(type: string, listener: (event: never) => void): void {
    this.map.set(type, [...(this.map.get(type) ?? []), listener])
  }
  removeEventListener(type: string, listener: (event: never) => void): void {
    this.map.set(type, (this.map.get(type) ?? []).filter((l) => l !== listener))
  }
  dispatch(type: string, event: unknown): void {
    for (const listener of this.map.get(type) ?? []) listener(event as never)
  }
}

describe('TASK-10 — InstallPromptStore', () => {
  it('bắt beforeinstallprompt, prompt theo yêu cầu và tắt sau appinstalled', async () => {
    const target = new FakeEventTarget()
    const store = new InstallPromptStore(target as never)
    expect(store.canInstall).toBe(false)
    await expect(store.promptInstall()).resolves.toBe('unavailable')

    let prompted = 0
    target.dispatch('beforeinstallprompt', {
      preventDefault: () => undefined,
      prompt: async () => {
        prompted += 1
      },
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    expect(store.canInstall).toBe(true)
    await expect(store.promptInstall()).resolves.toBe('accepted')
    expect(prompted).toBe(1)
    expect(store.canInstall).toBe(false)

    target.dispatch('beforeinstallprompt', {
      preventDefault: () => undefined,
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    })
    expect(store.canInstall).toBe(true)
    target.dispatch('appinstalled', {})
    expect(store.canInstall).toBe(false)
    store.dispose()
  })

  it('isStandaloneDisplay nhận diện display-mode và cờ iOS', () => {
    expect(isStandaloneDisplay((q) => ({ matches: q.includes('standalone') }), {})).toBe(true)
    expect(isStandaloneDisplay(() => ({ matches: false }), { standalone: true })).toBe(true)
    expect(isStandaloneDisplay(() => ({ matches: false }), {})).toBe(false)
  })
})

describe('TASK-10 — ConnectivityStore', () => {
  it('phản ánh navigator.onLine và phát tín hiệu khi online/offline đổi', () => {
    const target = new FakeEventTarget()
    const nav = { onLine: true }
    const store = new ConnectivityStore(target as never, nav)
    expect(store.online).toBe(true)
    let emissions = 0
    const unsubscribe = store.subscribe(() => {
      emissions += 1
    })
    nav.onLine = false
    target.dispatch('offline', {})
    expect(store.online).toBe(false)
    expect(emissions).toBe(1)
    nav.onLine = true
    target.dispatch('online', {})
    expect(store.online).toBe(true)
    expect(emissions).toBe(2)
    unsubscribe()
    store.dispose()
  })
})
