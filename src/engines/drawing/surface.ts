import { validateDrawingObject } from './validation'
import type { DrawingObject, ObjectId, SurfaceId } from './types'

/**
 * Surface — bề mặt làm việc mà Drawing Engine vẽ lên.
 *
 * Đây là hợp đồng giúp Drawing Engine KHÔNG phụ thuộc trực tiếp vào
 * PDF, DOCX hay Whiteboard (DEC-015): Document Engine tạo surface cho
 * từng trang tài liệu, Whiteboard Engine tạo surface cho bảng trắng,
 * còn Drawing Engine chỉ làm việc với interface này.
 *
 * Mô hình khớp DEC-020: mỗi Surface có dữ liệu riêng; Workspace của
 * Split Mode tham chiếu hai Surface độc lập.
 */
export type SurfaceKind = 'document-page' | 'whiteboard'

/** Kích thước logic của bề mặt theo đơn vị world (ví dụ: điểm PDF, px trang A4). */
export interface SurfaceSize {
  width: number
  height: number
}

export interface DrawingSurface {
  readonly id: SurfaceId
  readonly kind: SurfaceKind
  readonly size: SurfaceSize
  readonly objectCount: number

  /** Toàn bộ object trên bề mặt, theo thứ tự được thêm vào. */
  listObjects(): readonly DrawingObject[]
  getObject(id: ObjectId): DrawingObject | undefined
  hasObject(id: ObjectId): boolean

  /**
   * Thêm object vào bề mặt.
   * Ném lỗi nếu `object.surfaceId` khác ID của bề mặt (cô lập dữ liệu
   * giữa các bề mặt) hoặc nếu ID đã tồn tại trên bề mặt.
   */
  addObject(object: DrawingObject): void

  /**
   * Chèn object NGUYÊN BẢN (không đổi bất kỳ trường nào, kể cả
   * `updatedAt`) tại một vị trí trong thứ tự vẽ — API phục vụ khôi
   * phục trạng thái chính xác của History (TASK-05F): undo của thao
   * tác xóa/thay thế phải đưa object trở lại đúng vị trí cũ, không
   * nhảy xuống cuối danh sách. Kiểm tra như `addObject` cộng thêm
   * validate dữ liệu và `index` nguyên trong [0, objectCount]; mọi
   * kiểm tra đều chạy trước khi ghi.
   */
  insertObjectAt(index: number, object: DrawingObject): void

  /**
   * Thay object đã có (định danh bằng `object.id`) bằng phiên bản mới:
   * di chuyển, sửa nội dung text, đổi style… ID và surfaceId không thể
   * thay đổi — object thay thế phải mang cùng ID và thuộc đúng bề mặt này.
   *
   * Dữ liệu thay thế được validate trước khi ghi; bề mặt tự đặt
   * `updatedAt` = thời điểm cập nhật (giá trị updatedAt truyền vào bị bỏ
   * qua) và trả về object đã lưu. Nếu bất kỳ kiểm tra nào thất bại, hàm
   * ném lỗi và object gốc còn nguyên.
   */
  updateObject(object: DrawingObject): DrawingObject

  /**
   * Cập nhật nhiều object theo kiểu nguyên tử (atomic): mọi object đều
   * được kiểm tra trước; chỉ khi tất cả hợp lệ mới ghi. Một lỗi ở bất kỳ
   * object nào khiến toàn bộ lần cập nhật bị hủy — dùng cho các thao tác
   * nhiều object (ví dụ di chuyển cả selection) để dữ liệu không bao
   * giờ nằm ở trạng thái nửa vời. Trả về các object đã lưu.
   */
  updateObjects(objects: readonly DrawingObject[]): readonly DrawingObject[]

  /**
   * Thay nguyên tử một object bằng không hoặc nhiều object mới — phục
   * vụ Segment Eraser (một nét bị cắt thành các đoạn còn lại; mảng rỗng
   * nghĩa là nét bị xóa hẳn). Các object thay thế phải có ID mới (không
   * trùng ID của object bị thay, của nhau, hay của object khác đang có)
   * và thuộc đúng bề mặt này. Thất bại ở bất kỳ kiểm tra nào → object
   * gốc còn nguyên. Các object thay thế đứng TẠI VỊ TRÍ của object bị
   * thay trong thứ tự vẽ (từ TASK-05F; trước đó chúng bị đẩy xuống
   * cuối danh sách làm thay đổi thứ tự chồng lớp khi tẩy).
   */
  replaceObject(id: ObjectId, replacements: readonly DrawingObject[]): void

  /** Xóa object theo ID; trả về true nếu có object bị xóa. */
  removeObject(id: ObjectId): boolean

  /** Xóa toàn bộ object trên bề mặt. */
  clear(): void
}

/**
 * Bản cài đặt trong bộ nhớ của DrawingSurface — dùng làm working set
 * khi ứng dụng chạy và dùng trong kiểm thử. Persistence (TASK-08) sẽ
 * nạp/lưu dữ liệu qua cùng interface này, không thay đổi Drawing Engine.
 */
export class InMemorySurface implements DrawingSurface {
  readonly id: SurfaceId
  readonly kind: SurfaceKind
  readonly size: SurfaceSize
  private readonly objects = new Map<ObjectId, DrawingObject>()

  constructor(id: SurfaceId, kind: SurfaceKind, size: SurfaceSize) {
    if (!(size.width > 0) || !(size.height > 0)) {
      throw new Error(
        `InMemorySurface: size must be positive, got ${size.width}x${size.height}`,
      )
    }
    this.id = id
    this.kind = kind
    this.size = size
  }

  get objectCount(): number {
    return this.objects.size
  }

  listObjects(): readonly DrawingObject[] {
    return [...this.objects.values()]
  }

  getObject(id: ObjectId): DrawingObject | undefined {
    return this.objects.get(id)
  }

  hasObject(id: ObjectId): boolean {
    return this.objects.has(id)
  }

  addObject(object: DrawingObject): void {
    if (object.surfaceId !== this.id) {
      throw new Error(
        `InMemorySurface(${this.id}): cannot add object ${object.id} ` +
          `belonging to surface ${object.surfaceId}`,
      )
    }
    if (this.objects.has(object.id)) {
      throw new Error(`InMemorySurface(${this.id}): duplicate object id ${object.id}`)
    }
    this.objects.set(object.id, object)
  }

  insertObjectAt(index: number, object: DrawingObject): void {
    if (!Number.isInteger(index) || index < 0 || index > this.objects.size) {
      throw new Error(
        `InMemorySurface(${this.id}): insert index ${index} out of range ` +
          `[0, ${this.objects.size}]`,
      )
    }
    if (object.surfaceId !== this.id) {
      throw new Error(
        `InMemorySurface(${this.id}): cannot insert object ${object.id} ` +
          `belonging to surface ${object.surfaceId}`,
      )
    }
    if (this.objects.has(object.id)) {
      throw new Error(`InMemorySurface(${this.id}): duplicate object id ${object.id}`)
    }
    const result = validateDrawingObject(object)
    if (!result.valid) {
      throw new Error(
        `InMemorySurface(${this.id}): invalid object ${object.id}: ` +
          result.errors.join('; '),
      )
    }
    // Map không chèn giữa được: dựng lại thứ tự bằng mảng trung gian.
    const entries = [...this.objects.entries()]
    entries.splice(index, 0, [object.id, object])
    this.objects.clear()
    for (const [id, entry] of entries) {
      this.objects.set(id, entry)
    }
  }

  /** Kiểm tra chung cho update: tồn tại, đúng bề mặt, dữ liệu hợp lệ. */
  private assertUpdatable(object: DrawingObject): void {
    if (!this.objects.has(object.id)) {
      throw new Error(`InMemorySurface(${this.id}): object ${object.id} not found`)
    }
    if (object.surfaceId !== this.id) {
      throw new Error(
        `InMemorySurface(${this.id}): cannot update object ${object.id} ` +
          `belonging to surface ${object.surfaceId}`,
      )
    }
    const result = validateDrawingObject(object)
    if (!result.valid) {
      throw new Error(
        `InMemorySurface(${this.id}): invalid object ${object.id}: ` +
          result.errors.join('; '),
      )
    }
  }

  updateObject(object: DrawingObject): DrawingObject {
    this.assertUpdatable(object)
    const stored: DrawingObject = { ...object, updatedAt: Date.now() }
    this.objects.set(object.id, stored)
    return stored
  }

  updateObjects(objects: readonly DrawingObject[]): readonly DrawingObject[] {
    // Pha 1 — kiểm tra tất cả, chưa ghi gì (đảm bảo tính nguyên tử).
    const seen = new Set<ObjectId>()
    for (const object of objects) {
      if (seen.has(object.id)) {
        throw new Error(
          `InMemorySurface(${this.id}): duplicate id ${object.id} in update batch`,
        )
      }
      seen.add(object.id)
      this.assertUpdatable(object)
    }
    // Pha 2 — ghi tất cả.
    const now = Date.now()
    const stored = objects.map((object): DrawingObject => ({ ...object, updatedAt: now }))
    for (const object of stored) {
      this.objects.set(object.id, object)
    }
    return stored
  }

  replaceObject(id: ObjectId, replacements: readonly DrawingObject[]): void {
    if (!this.objects.has(id)) {
      throw new Error(`InMemorySurface(${this.id}): object ${id} not found`)
    }
    // Kiểm tra toàn bộ replacements trước khi thay đổi dữ liệu.
    const seen = new Set<ObjectId>()
    for (const replacement of replacements) {
      if (replacement.id === id) {
        throw new Error(
          `InMemorySurface(${this.id}): replacement must not reuse the replaced id ${id}`,
        )
      }
      if (seen.has(replacement.id) || this.objects.has(replacement.id)) {
        throw new Error(
          `InMemorySurface(${this.id}): duplicate object id ${replacement.id}`,
        )
      }
      seen.add(replacement.id)
      if (replacement.surfaceId !== this.id) {
        throw new Error(
          `InMemorySurface(${this.id}): cannot add object ${replacement.id} ` +
            `belonging to surface ${replacement.surfaceId}`,
        )
      }
      const result = validateDrawingObject(replacement)
      if (!result.valid) {
        throw new Error(
          `InMemorySurface(${this.id}): invalid replacement ${replacement.id}: ` +
            result.errors.join('; '),
        )
      }
    }
    // Thay TẠI VỊ TRÍ của object bị thay để giữ thứ tự vẽ (TASK-05F).
    const entries = [...this.objects.entries()]
    const position = entries.findIndex(([entryId]) => entryId === id)
    entries.splice(
      position,
      1,
      ...replacements.map((replacement): [ObjectId, DrawingObject] => [
        replacement.id,
        replacement,
      ]),
    )
    this.objects.clear()
    for (const [entryId, entry] of entries) {
      this.objects.set(entryId, entry)
    }
  }

  removeObject(id: ObjectId): boolean {
    return this.objects.delete(id)
  }

  clear(): void {
    this.objects.clear()
  }
}
