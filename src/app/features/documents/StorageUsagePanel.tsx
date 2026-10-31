import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, HardDrive, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { PersistenceState } from '../../../data/index'
import { classifyStorageUsage, formatBytes } from '../../libraryModel'
import { getAppStorage } from '../../storage'

/**
 * Panel dung lượng lưu trữ (TASK-08B): đọc StorageManager của
 * Storage Foundation — hiển thị usage/quota ƯỚC TÍNH của
 * trình duyệt, cảnh báo từ ngưỡng 80%, và trạng thái lưu trữ
 * bền (persistent). Mọi trạng thái đều trung thực: API không
 * khả dụng → nói rõ không đo được, không hiển thị số giả;
 * được cấp persistent KHÔNG được diễn đạt thành "bảo vệ
 * vĩnh viễn" (DEC-022/ISSUE-005).
 */

interface PanelState {
  view: ReturnType<typeof classifyStorageUsage>
  persistence: PersistenceState
}

export function StorageUsagePanel({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<PanelState | null>(null)
  const [requesting, setRequesting] = useState(false)

  const load = useCallback(async () => {
    const { storage } = getAppStorage().foundation
    const [info, persistence] = await Promise.all([
      storage.estimate(),
      storage.getPersistenceState(),
    ])
    setState({ view: classifyStorageUsage(info), persistence })
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const handleRequestPersistence = async () => {
    setRequesting(true)
    try {
      const { storage } = getAppStorage().foundation
      const persistence = await storage.requestPersistence()
      const info = await storage.estimate()
      setState({ view: classifyStorageUsage(info), persistence })
    } finally {
      setRequesting(false)
    }
  }

  return (
    <section
      aria-label="Dung lượng lưu trữ"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-800">Dung lượng lưu trữ trên thiết bị</h3>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Đo lại dung lượng"
          className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {state === null ? (
        <p className="mt-2 text-sm text-slate-500">Đang đo dung lượng…</p>
      ) : state.view.kind === 'unavailable' ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Trình duyệt này không cung cấp số liệu dung lượng lưu trữ, nên WebScribble
            không hiển thị con số ước tính. Tài liệu vẫn được lưu trên thiết bị như bình
            thường.
          </span>
        </p>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-slate-600">
            Đã dùng <strong>{formatBytes(state.view.usage)}</strong> /{' '}
            {formatBytes(state.view.quota)} ({state.view.percent}%)
            <span className="text-slate-400"> — số liệu ước tính của trình duyệt</span>
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={state.view.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tỷ lệ dung lượng đã dùng"
          >
            <div
              className={
                state.view.kind === 'warning' ? 'h-full bg-amber-500' : 'h-full bg-blue-500'
              }
              style={{ width: `${Math.min(100, Math.max(1, state.view.percent))}%` }}
            />
          </div>
          {state.view.kind === 'warning' && (
            <p
              role="alert"
              className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Dung lượng lưu trữ sắp đầy (từ 80% trở lên). Trình duyệt có thể từ chối
                lưu thêm tài liệu hoặc chú thích mới. Hãy xóa bớt tài liệu không cần
                thiết; WebScribble không tự xóa dữ liệu của bạn.
              </span>
            </p>
          )}
        </div>
      )}

      {state !== null && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
          {state.persistence === 'granted' ? (
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Lưu trữ bền: <strong>đã bật</strong> — trình duyệt sẽ hạn chế tự động xóa
                dữ liệu của WebScribble khi máy thiếu dung lượng. Đây không phải bảo đảm
                vĩnh viễn; hãy sao lưu tài liệu quan trọng.
              </span>
            </p>
          ) : state.persistence === 'denied' ? (
            <p className="flex flex-wrap items-center gap-2">
              <span>
                Lưu trữ bền: <strong>chưa bật</strong> — dữ liệu có thể bị trình duyệt xóa
                khi thiết bị thiếu dung lượng.
              </span>
              <button
                type="button"
                disabled={requesting}
                onClick={() => void handleRequestPersistence()}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {requesting ? 'Đang yêu cầu…' : 'Xin lưu trữ bền'}
              </button>
            </p>
          ) : (
            <p>
              Lưu trữ bền: trình duyệt này không cung cấp thông tin — WebScribble không
              xác định được dữ liệu có được bảo vệ khỏi việc tự động dọn dẹp hay không.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
