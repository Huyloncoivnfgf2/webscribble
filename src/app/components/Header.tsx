import { Menu, Search, Settings } from 'lucide-react'
import type { ViewKey } from '../navigation'
import { VIEW_TITLES } from '../navigation'

export interface HeaderProps {
  view: ViewKey
  onOpenDrawer: () => void
  onNavigate: (view: ViewKey) => void
}

export function Header({ view, onOpenDrawer, onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Mở menu điều hướng"
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="hidden text-xs text-slate-400 sm:block">
            WebScribble <span className="mx-1">/</span> {VIEW_TITLES[view]}
          </p>
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
            {VIEW_TITLES[view]}
          </h1>
        </div>

        <form
          className="ml-auto hidden max-w-xs flex-1 md:block"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Tìm kiếm tài liệu…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Cài đặt"
            title="Cài đặt"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
