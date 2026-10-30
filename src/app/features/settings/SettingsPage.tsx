const INFO_ROWS: Array<{ label: string; value: string }> = [
  { label: 'Tên ứng dụng', value: 'WebScribble' },
  { label: 'Phiên bản khung giao diện', value: '0.1.0 (TASK-04)' },
  { label: 'Mô hình dữ liệu', value: 'Local-first — dữ liệu lưu trên thiết bị của bạn' },
  { label: 'Tài khoản', value: 'Không yêu cầu đăng nhập' },
]

export function SettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Trang cài đặt hiện hiển thị thông tin cơ bản của ứng dụng. Các tùy
        chọn cài đặt (giao diện, sao lưu dữ liệu theo DEC-022…) sẽ được bổ
        sung ở các task sau.
      </p>
      <dl className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {INFO_ROWS.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className="text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
