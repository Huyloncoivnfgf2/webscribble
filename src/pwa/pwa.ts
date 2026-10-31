/**
 * PWA helpers (TASK-10, DEC-034): đăng ký Service
 * Worker, lời mời cài đặt và trạng thái kết nối.
 * Mọi helper đều framework-free và nhận dependency
 * qua tham số (mặc định là window/navigator thật) để
 * Vitest kiểm thử bằng fake.
 */

// ------------------------------------------------------------------
// Service Worker
// ------------------------------------------------------------------

export interface ServiceWorkerLike {
  state: string
  postMessage(message: unknown): void
  addEventListener(type: 'statechange', listener: () => void): void
}

export interface ServiceWorkerRegistrationLike {
  waiting: ServiceWorkerLike | null
  installing: ServiceWorkerLike | null
  addEventListener(type: 'updatefound', listener: () => void): void
}

export interface ServiceWorkerContainerLike {
  controller: ServiceWorkerLike | null
  register(scriptURL: string): Promise<ServiceWorkerRegistrationLike>
  addEventListener(type: 'controllerchange', listener: () => void): void
}

export type RegisterServiceWorkerResult =
  | 'registered'
  | 'unsupported'
  | 'skipped-not-production'
  | 'failed'

let waitingRegistration: ServiceWorkerRegistrationLike | null = null

export interface RegisterServiceWorkerDeps {
  container?: ServiceWorkerContainerLike
  isProduction: boolean
  scriptURL?: string
  onUpdateAvailable?: () => void
}

function defaultContainer(): ServiceWorkerContainerLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  const container = (navigator as { serviceWorker?: ServiceWorkerContainerLike }).serviceWorker
  return container
}

/**
 * Đăng ký /sw.js (chỉ ở bản production — SW được sinh
 * ở bước build). Khi có worker mới đang chờ (hoặc vừa
 * cài xong trong lúc app đang chạy bởi bản cũ),
 * onUpdateAvailable được gọi đúng một lần cho mỗi
 * registration.
 */
export async function registerServiceWorker(
  deps: RegisterServiceWorkerDeps,
): Promise<RegisterServiceWorkerResult> {
  if (!deps.isProduction) return 'skipped-not-production'
  const container = deps.container ?? defaultContainer()
  if (container === undefined) return 'unsupported'
  let notified = false
  const notify = () => {
    if (notified) return
    notified = true
    deps.onUpdateAvailable?.()
  }
  try {
    // Đường dẫn SW theo base của bản build (ví dụ
    // '/webscribble/sw.js' trên GitHub Pages, '/sw.js'
    // ở gốc domain) — BASE_URL do Vite cung cấp:
    const scriptURL = deps.scriptURL ?? `${import.meta.env.BASE_URL}sw.js`
    const registration = await container.register(scriptURL)
    waitingRegistration = registration
    if (registration.waiting !== null && container.controller !== null) {
      notify()
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (installing === null) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && container.controller !== null) {
          waitingRegistration = registration
          notify()
        }
      })
    })
    return 'registered'
  } catch {
    return 'failed'
  }
}

/**
 * Kích hoạt worker đang chờ (trang sẽ nhận sự kiện
 * controllerchange — nơi gọi tự reload). Trả về false
 * khi không có bản cập nhật nào đang chờ.
 */
export function applyServiceWorkerUpdate(): boolean {
  const waiting = waitingRegistration?.waiting ?? null
  if (waiting === null) return false
  waiting.postMessage({ type: 'SKIP_WAITING' })
  return true
}

/** Gắn một listener controllerchange (dùng một lần cho nút Cập nhật). */
export function onServiceWorkerControllerChange(
  listener: () => void,
  container?: ServiceWorkerContainerLike,
): void {
  const target = container ?? defaultContainer()
  target?.addEventListener('controllerchange', listener)
}

/** Chỉ dùng cho test: quên registration đang giữ. */
export function resetServiceWorkerStateForTests(): void {
  waitingRegistration = null
}

// ------------------------------------------------------------------
// Install prompt (beforeinstallprompt)
// ------------------------------------------------------------------

export interface BeforeInstallPromptEventLike {
  preventDefault(): void
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface EventTargetLike {
  addEventListener(type: string, listener: (event: never) => void): void
  removeEventListener(type: string, listener: (event: never) => void): void
}

export class InstallPromptStore {
  private deferred: BeforeInstallPromptEventLike | null = null
  private readonly listeners = new Set<() => void>()
  private readonly target: EventTargetLike
  private readonly handlePrompt = (event: BeforeInstallPromptEventLike) => {
    event.preventDefault()
    this.deferred = event
    this.emit()
  }
  private readonly handleInstalled = () => {
    this.deferred = null
    this.emit()
  }

  constructor(target: EventTargetLike = window as unknown as EventTargetLike) {
    this.target = target
    this.target.addEventListener(
      'beforeinstallprompt',
      this.handlePrompt as (event: never) => void,
    )
    this.target.addEventListener('appinstalled', this.handleInstalled as (event: never) => void)
  }

  get canInstall(): boolean {
    return this.deferred !== null
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (this.deferred === null) return 'unavailable'
    const event = this.deferred
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') {
      this.deferred = null
      this.emit()
    }
    return choice.outcome
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.target.removeEventListener(
      'beforeinstallprompt',
      this.handlePrompt as (event: never) => void,
    )
    this.target.removeEventListener('appinstalled', this.handleInstalled as (event: never) => void)
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

/** App đã chạy ở chế độ cài đặt (standalone) hay chưa. */
export function isStandaloneDisplay(
  matchMediaFn?: (query: string) => { matches: boolean },
  navigatorRef?: { standalone?: boolean },
): boolean {
  const matcher =
    matchMediaFn ??
    (typeof window !== 'undefined' ? window.matchMedia.bind(window) : undefined)
  if (matcher !== undefined && matcher('(display-mode: standalone)').matches) return true
  const nav = navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  return (nav as { standalone?: boolean } | undefined)?.standalone === true
}

// ------------------------------------------------------------------
// Connectivity (online/offline)
// ------------------------------------------------------------------

export class ConnectivityStore {
  private readonly listeners = new Set<() => void>()
  private readonly target: EventTargetLike
  private readonly navigatorRef: { onLine: boolean }
  private readonly handleOnline = () => this.emit()
  private readonly handleOffline = () => this.emit()

  constructor(
    target: EventTargetLike = window as unknown as EventTargetLike,
    navigatorRef: { onLine: boolean } = navigator,
  ) {
    this.target = target
    this.navigatorRef = navigatorRef
    this.target.addEventListener('online', this.handleOnline as (event: never) => void)
    this.target.addEventListener('offline', this.handleOffline as (event: never) => void)
  }

  get online(): boolean {
    return this.navigatorRef.onLine
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.target.removeEventListener('online', this.handleOnline as (event: never) => void)
    this.target.removeEventListener('offline', this.handleOffline as (event: never) => void)
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
