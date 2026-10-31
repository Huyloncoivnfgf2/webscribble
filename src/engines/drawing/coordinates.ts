import type { Point } from './types'

/**
 * Camera của một bề mặt: quyết định phần nào của thế giới (world) đang
 * được nhìn thấy và ở mức zoom nào.
 *
 * Camera là trạng thái HIỂN THỊ, hoàn toàn tách khỏi dữ liệu object
 * (DEC-019: dữ liệu phải "sẵn sàng vô hạn" — di chuyển camera không bao
 * giờ làm thay đổi tọa độ đã lưu của object).
 *
 * Quy ước: `x`, `y` là tọa độ world của điểm world đang nằm ở góc
 * trên-trái của viewport trước khi áp dụng zoom.
 *   screen = (world - camera.xy) * zoom
 *   world  = screen / zoom + camera.xy
 */
export interface Camera {
  x: number
  y: number
  /** Hệ số phóng; 1 = kích thước thật. Phải > 0. */
  zoom: number
}

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 }

export function createCamera(partial: Partial<Camera> = {}): Camera {
  const camera = { ...DEFAULT_CAMERA, ...partial }
  if (!(camera.zoom > 0) || !Number.isFinite(camera.zoom)) {
    throw new Error(`createCamera: zoom must be a positive finite number, got ${camera.zoom}`)
  }
  return camera
}

/** World coordinates → tọa độ màn hình (CSS pixels trong viewport). */
export function worldToScreen(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom,
  }
}

/** Tọa độ màn hình → world coordinates (nghịch đảo của worldToScreen). */
export function screenToWorld(point: Point, camera: Camera): Point {
  return {
    x: point.x / camera.zoom + camera.x,
    y: point.y / camera.zoom + camera.y,
  }
}

/**
 * Camera mới sau khi pan theo một độ dời trên màn hình (kéo thả):
 * nội dung "đi theo" con trỏ nên camera di chuyển ngược hướng kéo.
 */
export function panCameraByScreenDelta(camera: Camera, delta: Point): Camera {
  return {
    ...camera,
    x: camera.x - delta.x / camera.zoom,
    y: camera.y - delta.y / camera.zoom,
  }
}

/**
 * Camera mới khi zoom vào một điểm neo trên màn hình (vị trí con trỏ /
 * điểm giữa hai ngón tay): điểm world dưới điểm neo giữ nguyên vị trí
 * trên màn hình sau khi zoom.
 */
export function zoomCameraAtScreenPoint(
  camera: Camera,
  screenPoint: Point,
  nextZoom: number,
): Camera {
  if (!(nextZoom > 0) || !Number.isFinite(nextZoom)) {
    throw new Error(`zoomCameraAtScreenPoint: zoom must be positive, got ${nextZoom}`)
  }
  const anchorWorld = screenToWorld(screenPoint, camera)
  return {
    x: anchorWorld.x - screenPoint.x / nextZoom,
    y: anchorWorld.y - screenPoint.y / nextZoom,
    zoom: nextZoom,
  }
}
