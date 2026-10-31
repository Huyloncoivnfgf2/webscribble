/**
 * Điểm nối (wiring) tầng UI với Storage Foundation và Annotation
 * Engine: tạo MỘT lần cho toàn ứng dụng (singleton lười), dùng
 * chung một database/repository/autosave/engine như kiến trúc
 * local-first quy định. Đây là wiring phụ thuộc, không phải
 * trạng thái nghiệp vụ toàn cục.
 */
import { createStorageFoundation, type StorageFoundation } from '../data/index'
import { createAnnotationEngine, type AnnotationEngine } from '../engines/annotation/index'

export interface AppStorage {
  foundation: StorageFoundation
  annotationEngine: AnnotationEngine
}

let cached: AppStorage | null = null

export function getAppStorage(): AppStorage {
  if (cached === null) {
    const foundation = createStorageFoundation()
    cached = {
      foundation,
      annotationEngine: createAnnotationEngine({
        annotations: foundation.annotations,
        autosave: foundation.autosave,
      }),
    }
  }
  return cached
}
