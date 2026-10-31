/**
 * History Manager (TASK-05F): Undo/Redo cho một DrawingSurface theo
 * Command Pattern, độc lập theo từng Surface (DEC-020: Split Mode
 * dùng hai HistoryManager riêng; không có history toàn cục).
 *
 * Thiết kế command — MỘT command tổng quát thay cho mười class riêng:
 * mọi thao tác của Drawing Engine (thêm nét/hình/text, xóa, cập nhật,
 * thay thế của Segment Eraser, di chuyển nhiều object, một lần tẩy
 * liên tục) đều quy về một `SurfaceChange`: hai danh sách các object
 * BỊ ẢNH HƯỞNG kèm vị trí trong thứ tự vẽ — trạng thái TRƯỚC và SAU.
 * Các object là bất biến nên command chỉ giữ THAM CHIẾU tới đúng các
 * object đã lưu trên Surface (không sao chép dữ liệu, không snapshot
 * toàn Surface, không bitmap); bộ nhớ của một command tỉ lệ với số
 * object nó chạm vào, không phải kích thước Surface.
 *
 * Khôi phục CHÍNH XÁC: undo/redo không chạy lại logic thao tác (không
 * tạo ID mới, không tính lại đoạn cắt, không bị `updateObject` ghi đè
 * `updatedAt`) — chúng hoán đổi trạng thái bằng removeObject +
 * `insertObjectAt` (API bổ sung ở TASK-05F: chèn nguyên bản tại đúng
 * vị trí cũ), nên ID, surfaceId, createdAt, updatedAt, style và thứ
 * tự vẽ đều trở lại nguyên trạng.
 *
 * Thực thi thao tác mới đi qua các hàm `perform*` dưới đây: chúng áp
 * thao tác bằng API Surface thông thường (giữ nguyên ngữ nghĩa —
 * `updateObjects` vẫn làm mới `updatedAt` khi di chuyển…) và chụp lại
 * `SurfaceChange` từ trạng thái thật của Surface. Thao tác không làm
 * thay đổi dữ liệu trả về `null` và không được ghi vào history.
 */

import { translateObject } from './selection'
import type { DrawingSurface } from './surface'
import type { DrawingObject, ObjectId, Point } from './types'

/** Một object cùng vị trí của nó trong thứ tự vẽ của Surface. */
export interface IndexedObject {
  object: DrawingObject
  index: number
}

/** Mô tả đầy đủ một lần thay đổi dữ liệu trên một Surface. */
export interface SurfaceChange {
  /** Các object bị ảnh hưởng ở trạng thái trước thao tác (rỗng nếu là thêm mới). */
  before: readonly IndexedObject[]
  /** Các object bị ảnh hưởng ở trạng thái sau thao tác (rỗng nếu là xóa). */
  after: readonly IndexedObject[]
}

/** Số command tối đa giữ trong một HistoryManager khi không cấu hình khác. */
export const DEFAULT_HISTORY_LIMIT = 100

// ---------------------------------------------------------------------------
// Lõi hoán đổi trạng thái
// ---------------------------------------------------------------------------

/**
 * Đưa Surface về đúng trạng thái `target` đối với các object có mặt
 * trong `target` hoặc `otherSide`: xóa mọi ID thuộc hai phía đang có
 * mặt, rồi chèn các object của `target` theo chỉ số tăng dần. Các
 * object không thuộc hai phía không bị đụng vào và giữ nguyên thứ tự
 * tương đối — chèn tăng dần theo chỉ số gốc vì thế khôi phục đúng thứ
 * tự vẽ ban đầu.
 */
function applyObjectState(
  surface: DrawingSurface,
  target: readonly IndexedObject[],
  otherSide: readonly IndexedObject[],
): void {
  const ids = new Set<ObjectId>()
  for (const entry of target) ids.add(entry.object.id)
  for (const entry of otherSide) ids.add(entry.object.id)
  for (const id of ids) {
    surface.removeObject(id)
  }
  const sorted = [...target].sort((a, b) => a.index - b.index)
  for (const entry of sorted) {
    surface.insertObjectAt(Math.min(entry.index, surface.objectCount), entry.object)
  }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export interface HistoryCommand {
  readonly label: string
  /** SurfaceChange mà command này ghi lại (đã xảy ra trên Surface). */
  readonly change: SurfaceChange
  /** Command có thực sự thay đổi dữ liệu không. */
  readonly isEmpty: boolean
  /** Áp lại trạng thái SAU (== redo; trạng thái hiện tại không đổi nếu đã ở đó). */
  execute(surface: DrawingSurface): void
  undo(surface: DrawingSurface): void
  redo(surface: DrawingSurface): void
}

/**
 * Command tổng quát của Drawing Engine: gói một `SurfaceChange` đã
 * được một hàm `perform*` thực hiện và chụp lại. Undo/redo là hoán
 * đổi trạng thái nguyên bản — xem đầu file.
 */
export class SurfaceChangeCommand implements HistoryCommand {
  readonly label: string
  readonly change: SurfaceChange

  constructor(label: string, change: SurfaceChange) {
    this.label = label
    this.change = change
  }

  get isEmpty(): boolean {
    return this.change.before.length === 0 && this.change.after.length === 0
  }

  execute(surface: DrawingSurface): void {
    this.redo(surface)
  }

  undo(surface: DrawingSurface): void {
    applyObjectState(surface, this.change.before, this.change.after)
  }

  redo(surface: DrawingSurface): void {
    applyObjectState(surface, this.change.after, this.change.before)
  }
}

// ---------------------------------------------------------------------------
// Chụp trạng thái & các thao tác thực thi (performers)
// ---------------------------------------------------------------------------

/** Chụp các object theo ID kèm vị trí hiện tại trong thứ tự vẽ. */
export function snapshotEntries(
  surface: DrawingSurface,
  ids: ReadonlySet<ObjectId>,
): IndexedObject[] {
  const entries: IndexedObject[] = []
  surface.listObjects().forEach((object, index) => {
    if (ids.has(object.id)) {
      entries.push({ object, index })
    }
  })
  return entries
}

/** Thêm một object (nét/hình/text vừa tạo xong). */
export function performAddObject(
  surface: DrawingSurface,
  object: DrawingObject,
): SurfaceChange {
  surface.addObject(object)
  const index = surface.listObjects().findIndex((entry) => entry.id === object.id)
  return { before: [], after: [{ object, index }] }
}

/** Xóa một nhóm object (Stroke Eraser, xóa lựa chọn…). ID không tồn tại bị bỏ qua. */
export function performRemoveObjects(
  surface: DrawingSurface,
  ids: readonly ObjectId[],
): SurfaceChange | null {
  const before = snapshotEntries(
    surface,
    new Set(ids.filter((id) => surface.hasObject(id))),
  )
  if (before.length === 0) return null
  for (const entry of before) {
    surface.removeObject(entry.object.id)
  }
  return { before, after: [] }
}

/**
 * Cập nhật một nhóm object qua `updateObjects` (nguyên tử ở tầng
 * Surface; lỗi → ném ra và không có gì được ghi). Trạng thái SAU được
 * chụp từ chính các object Surface đã lưu (gồm `updatedAt` mới), nên
 * redo khôi phục đúng cả `updatedAt` đó thay vì làm mới thêm lần nữa.
 */
export function performUpdateObjects(
  surface: DrawingSurface,
  updates: readonly DrawingObject[],
): SurfaceChange | null {
  if (updates.length === 0) return null
  const ids = new Set(updates.map((object) => object.id))
  const before = snapshotEntries(surface, ids)
  if (before.length !== updates.length) {
    const missing = updates.find((object) => !surface.hasObject(object.id))
    throw new Error(
      `performUpdateObjects: object ${missing?.id ?? '?'} not found on surface ${surface.id}`,
    )
  }
  surface.updateObjects(updates)
  const after = snapshotEntries(surface, ids)
  return { before, after }
}

/** Thay một object bằng các object mới (Segment Eraser cho một nét). */
export function performReplaceObject(
  surface: DrawingSurface,
  id: ObjectId,
  replacements: readonly DrawingObject[],
): SurfaceChange | null {
  if (!surface.hasObject(id)) return null
  const before = snapshotEntries(surface, new Set([id]))
  surface.replaceObject(id, replacements)
  const after = snapshotEntries(
    surface,
    new Set(replacements.map((replacement) => replacement.id)),
  )
  return { before, after }
}

/** Di chuyển một nhóm object theo cùng delta (một command cho cả nhóm). */
export function performMoveObjects(
  surface: DrawingSurface,
  ids: readonly ObjectId[],
  delta: Point,
): SurfaceChange | null {
  if (ids.length === 0 || (delta.x === 0 && delta.y === 0)) return null
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new Error(`performMoveObjects: delta must be finite, got (${delta.x}, ${delta.y})`)
  }
  const uniqueIds = [...new Set(ids)]
  const originals = uniqueIds.map((id) => {
    const object = surface.getObject(id)
    if (object === undefined) {
      throw new Error(`performMoveObjects: object ${id} not found on surface ${surface.id}`)
    }
    return object
  })
  return performUpdateObjects(
    surface,
    originals.map((object) => translateObject(object, delta)),
  )
}

/**
 * Gộp nhiều `SurfaceChange` liên tiếp (cùng một Surface) thành một
 * thay đổi ròng — dùng khi một thao tác người dùng gồm nhiều bước dữ
 * liệu (ví dụ Segment Eraser thay đi thay lại các đoạn trong một lần
 * kéo). Trạng thái TRƯỚC của mỗi ID lấy ở lần chạm đầu tiên; trạng
 * thái SAU lấy ở lần chạm cuối cùng; các object trung gian (đoạn vừa
 * tạo đã bị thay tiếp) biến mất khỏi cả hai phía. Nếu truyền
 * `surface`, chỉ số của phía SAU được chụp lại từ trạng thái hiện tại
 * của Surface cho chính xác tuyệt đối.
 */
export function mergeChanges(
  changes: readonly (SurfaceChange | null)[],
  surface?: DrawingSurface,
): SurfaceChange | null {
  const beforeById = new Map<ObjectId, IndexedObject>()
  const afterById = new Map<ObjectId, IndexedObject>()
  const createdWithin = new Set<ObjectId>()
  for (const change of changes) {
    if (change === null) continue
    for (const entry of change.before) {
      const id = entry.object.id
      if (createdWithin.has(id)) {
        // Object trung gian: bị thay/xóa tiếp — không còn là "sau" nữa.
        afterById.delete(id)
      } else if (!beforeById.has(id)) {
        beforeById.set(id, entry)
      }
    }
    for (const entry of change.after) {
      afterById.set(entry.object.id, entry)
      createdWithin.add(entry.object.id)
    }
  }
  if (beforeById.size === 0 && afterById.size === 0) return null
  let after = [...afterById.values()]
  if (surface !== undefined && after.length > 0) {
    after = snapshotEntries(
      surface,
      new Set(after.map((entry) => entry.object.id)),
    )
  }
  return { before: [...beforeById.values()], after }
}

// ---------------------------------------------------------------------------
// History Manager — một instance cho mỗi Surface
// ---------------------------------------------------------------------------

export interface HistoryManagerOptions {
  /**
   * Số command tối đa trong ngăn undo. Mặc định
   * `DEFAULT_HISTORY_LIMIT` (100): đủ sâu cho một phiên làm việc,
   * trong khi bộ nhớ vẫn bị chặn vì mỗi command chỉ giữ các object nó
   * chạm vào. Vượt giới hạn → command CŨ NHẤT bị loại khỏi lịch sử
   * (dữ liệu trên Surface không bị ảnh hưởng, chỉ mất khả năng undo
   * về quá khứ xa đó).
   */
  limit?: number
}

export class HistoryManager {
  readonly surface: DrawingSurface
  private readonly limit: number
  private undoStack: SurfaceChangeCommand[] = []
  private redoStack: SurfaceChangeCommand[] = []

  constructor(surface: DrawingSurface, options: HistoryManagerOptions = {}) {
    const limit = options.limit ?? DEFAULT_HISTORY_LIMIT
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`HistoryManager: limit must be a positive integer, got ${limit}`)
    }
    this.surface = surface
    this.limit = limit
  }

  get undoCount(): number {
    return this.undoStack.length
  }

  get redoCount(): number {
    return this.redoStack.length
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get historyLimit(): number {
    return this.limit
  }

  /**
   * Ghi một command đã được thực thi (qua `perform*` hoặc do engine
   * tự chụp). Command rỗng (không thay đổi dữ liệu) bị bỏ qua — trả
   * về false. Mọi thao tác mới đều xóa nhánh redo cũ và việc cắt tỉa
   * theo giới hạn chỉ bỏ command cũ nhất khỏi lịch sử.
   */
  record(command: SurfaceChangeCommand): boolean {
    if (command.isEmpty) return false
    this.undoStack.push(command)
    this.redoStack = []
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift()
    }
    return true
  }

  /**
   * Thực thi một thao tác mới và ghi vào history trong một bước:
   * `perform` áp thao tác lên Surface và trả về `SurfaceChange` đã
   * chụp (hoặc `null` nếu không có thay đổi → không ghi). Nếu
   * `perform` ném lỗi, lỗi truyền ra ngoài và history không đổi.
   */
  execute(
    label: string,
    perform: (surface: DrawingSurface) => SurfaceChange | null,
  ): boolean {
    const change = perform(this.surface)
    if (change === null) return false
    return this.record(new SurfaceChangeCommand(label, change))
  }

  /** Đảo ngược thao tác gần nhất. Trả về false khi không còn gì để undo. */
  undo(): boolean {
    const command = this.undoStack.pop()
    if (command === undefined) return false
    command.undo(this.surface)
    this.redoStack.push(command)
    return true
  }

  /** Tái thực hiện thao tác vừa undo. Trả về false khi không còn gì để redo. */
  redo(): boolean {
    const command = this.redoStack.pop()
    if (command === undefined) return false
    command.redo(this.surface)
    this.undoStack.push(command)
    return true
  }

  /** Xóa toàn bộ lịch sử (không thay đổi dữ liệu Surface). */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
