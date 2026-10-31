import type { ComponentType } from 'react'
import {
  Clock,
  Columns2,
  FolderOpen,
  House,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  X,
} from 'lucide-react'
import type { ViewKey } from '../navigation'
import { VIEW_TITLES } from '../navigation'

interface NavItem {
  key: ViewKey
  icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', icon: House },
  { key: 'recent', icon: Clock },
  { key: 'documents', icon: FolderOpen },
  { key: 'whiteboard', icon: PenLine },
  { key: 'split', icon: Columns2 },
  { key: 'settings', icon: Settings },
]

interface SidebarNavProps {
  view: ViewKey
  collapsed: boolean
  onNavigate: (view: ViewKey) => void
}

function SidebarNav({ view, collapsed, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Điều hướng chính">
      {NAV_ITEMS.map(({ key, icon: Icon }) => {
        const active = view === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? VIEW_TITLES[key] : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              collapsed ? 'justify-center' : ''
            } ${
              active
                ? 'bg-blue-50 font-medium text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{VIEW_TITLES[key]}</span>}
          </button>
        )
      })}
    </nav>
  )
}

interface BrandProps {
  collapsed: boolean
}

function Brand({ collapsed }: BrandProps) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-slate-200 px-5 py-4 ${
        collapsed ? 'justify-center px-3' : ''
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
        <NotebookPen className="h-5 w-5" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold tracking-tight text-slate-900">
            WebScribble
          </span>
          <span className="block text-xs leading-snug text-slate-500">
            Write. Annotate. Edit. Anywhere.
          </span>
        </span>
      )}
    </div>
  )
}

export interface SidebarProps {
  view: ViewKey
  collapsed: boolean
  onNavigate: (view: ViewKey) => void
  onToggleCollapse: () => void
}

export function Sidebar({ view, collapsed, onNavigate, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <Brand collapsed={collapsed} />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav view={view} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 shrink-0" />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

export interface MobileDrawerProps {
  view: ViewKey
  onNavigate: (view: ViewKey) => void
  onClose: () => void
}

export function MobileDrawer({ view, onNavigate, onClose }: MobileDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Đóng menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-900/40"
      />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Brand collapsed={false} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="m-3 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            view={view}
            collapsed={false}
            onNavigate={(next) => {
              onNavigate(next)
              onClose()
            }}
          />
        </div>
      </aside>
    </div>
  )
}
