/**
 * DrawingSurface bọc một surface khác và PHÁT THÔNG BÁO sau mỗi
 * thay đổi thành công (TASK-06C). Đây là cơ chế Annotation Engine
 * dùng để biết dữ liệu đã đổi mà KHÔNG polling và KHÔNG sửa
 * Drawing Engine: DrawingEngine, History (undo/redo qua
 * insertObjectAt/removeObject), Selection và Eraser đều thao tác
 * qua interface DrawingSurface, nên mọi đường thay đổi đều đi qua
 * lớp bọc này.
 *
 * Thông báo chỉ phát SAU khi thao tác thành công — thao tác bị
 * surface gốc từ chối (ném lỗi) không tạo thông báo. Lỗi do
 * listener gây ra không được phá vỡ thao tác vẽ: chúng được
 * chuyển cho `onListenerError` nếu có.
 */
import type { DrawingObject, ObjectId } from '../drawing/types'
import type { DrawingSurface, SurfaceKind, SurfaceSize } from '../drawing/surface'

export type SurfaceChangeType =
  | 'add'
  | 'insert'
  | 'update'
  | 'replace'
  | 'remove'
  | 'clear'

export interface SurfaceChange {
  surfaceId: string
  type: SurfaceChangeType
}

export type SurfaceChangeListener = (change: SurfaceChange) => void

export class NotifyingSurface implements DrawingSurface {
  private readonly listeners = new Set<SurfaceChangeListener>()
  private readonly inner: DrawingSurface
  private readonly onListenerError: ((error: unknown) => void) | undefined

  constructor(inner: DrawingSurface, onListenerError?: (error: unknown) => void) {
    this.inner = inner
    this.onListenerError = onListenerError
  }

  get id(): string {
    return this.inner.id
  }

  get kind(): SurfaceKind {
    return this.inner.kind
  }

  get size(): SurfaceSize {
    return this.inner.size
  }

  get objectCount(): number {
    return this.inner.objectCount
  }

  listObjects(): readonly DrawingObject[] {
    return this.inner.listObjects()
  }

  getObject(id: ObjectId): DrawingObject | undefined {
    return this.inner.getObject(id)
  }

  hasObject(id: ObjectId): boolean {
    return this.inner.hasObject(id)
  }

  addObject(object: DrawingObject): void {
    this.inner.addObject(object)
    this.notify('add')
  }

  insertObjectAt(index: number, object: DrawingObject): void {
    this.inner.insertObjectAt(index, object)
    this.notify('insert')
  }

  updateObject(object: DrawingObject): DrawingObject {
    const saved = this.inner.updateObject(object)
    this.notify('update')
    return saved
  }

  updateObjects(objects: readonly DrawingObject[]): readonly DrawingObject[] {
    const saved = this.inner.updateObjects(objects)
    this.notify('update')
    return saved
  }

  replaceObject(id: ObjectId, replacements: readonly DrawingObject[]): void {
    this.inner.replaceObject(id, replacements)
    this.notify('replace')
  }

  removeObject(id: ObjectId): boolean {
    const removed = this.inner.removeObject(id)
    if (removed) this.notify('remove')
    return removed
  }

  clear(): void {
    const hadObjects = this.inner.objectCount > 0
    this.inner.clear()
    if (hadObjects) this.notify('clear')
  }

  /** Đăng ký nghe thay đổi; trả hàm hủy đăng ký. */
  subscribe(listener: SurfaceChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Số listener hiện tại — phục vụ kiểm tra cleanup. */
  get listenerCount(): number {
    return this.listeners.size
  }

  private notify(type: SurfaceChangeType): void {
    const change: SurfaceChange = { surfaceId: this.inner.id, type }
    for (const listener of [...this.listeners]) {
      try {
        listener(change)
      } catch (error) {
        this.onListenerError?.(error)
      }
    }
  }
}
