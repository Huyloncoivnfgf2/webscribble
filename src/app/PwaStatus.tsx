import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import {
  applyServiceWorkerUpdate,
  ConnectivityStore,
  InstallPromptStore,
  isStandaloneDisplay,
  onServiceWorkerControllerChange,
  registerServiceWorker,
} from '../pwa/index'

/**
 * PwaStatus (TASK-10): ba tín hiệu PWA không chen ngang
 * công việc của người dùng, xếp ở góc dưới-trái:
 * - Banner "Có phiên bản mới" + nút Cập nhật khi
 *   Service Worker mới đang chờ (người dùng chủ động
 *   bấm — app không tự reload giữa chừng).
 * - Nút "Cài đặt ứng dụng" khi trình duyệt phát sự
 *   kiện beforeinstallprompt và app chưa được cài.
 * - Huy hiệu "Đang ngoại tuyến" khi mất mạng, kèm
 *   khẳng định dữ liệu vẫn lưu trên thiết bị
 *   (local-first: mọi thao tác vẫn chạy bình thường).
 */
export function PwaStatus() {
  const stores = useMemo(
    () => ({
      connectivity: new ConnectivityStore(),
      install: new InstallPromptStore(),
    }),
    [],
  )
  const [online, setOnline] = useState(stores.connectivity.online)
  const [canInstall, setCanInstall] = useState(stores.install.canInstall)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const standalone = useMemo(() => isStandaloneDisplay(), [])

  useEffect(() => {
    const unsubscribeOnline = stores.connectivity.subscribe(() =>
      setOnline(stores.connectivity.online),
    )
    const unsubscribeInstall = stores.install.subscribe(() =>
      setCanInstall(stores.install.canInstall),
    )
    return () => {
      unsubscribeOnline()
      unsubscribeInstall()
    }
  }, [stores])

  useEffect(() => {
    void registerServiceWorker({
      isProduction: import.meta.env.PROD,
      onUpdateAvailable: () => setUpdateReady(true),
    })
  }, [])

  const handleUpdate = () => {
    setUpdating(true)
    onServiceWorkerControllerChange(() => window.location.reload())
    if (!applyServiceWorkerUpdate()) {
      setUpdating(false)
      setUpdateReady(false)
    }
  }

  const showInstall = canInstall && !standalone && !installDismissed && !updateReady

  if (online && !showInstall && !updateReady) return null

  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      {updateReady && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg">
          <RefreshCw className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm text-blue-900">
            Có phiên bản mới của WebScribble.
          </p>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? 'Đang cập nhật…' : 'Cập nhật'}
          </button>
        </div>
      )}
      {showInstall && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <Download className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm text-slate-700">
            Cài đặt WebScribble để mở nhanh và dùng ngoại tuyến.
          </p>
          <button
            type="button"
            onClick={() => void stores.install.promptInstall()}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Cài đặt
          </button>
          <button
            type="button"
            onClick={() => setInstallDismissed(true)}
            aria-label="Để sau"
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {!online && (
        <div
          role="status"
          className="flex items-center gap-2 self-start rounded-full bg-slate-800 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Đang ngoại tuyến — tài liệu vẫn được lưu an toàn trên thiết bị này
        </div>
      )}
    </div>
  )
}
