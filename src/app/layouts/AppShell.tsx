import { useState } from 'react'
import type { ReactNode } from 'react'
import { Header } from '../components/Header'
import { MobileDrawer, Sidebar } from '../components/Sidebar'
import type { ViewKey } from '../navigation'

export interface AppShellProps {
  view: ViewKey
  onNavigate: (view: ViewKey) => void
  children: ReactNode
}

export function AppShell({ view, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 antialiased">
      <Sidebar
        view={view}
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />
      {drawerOpen && (
        <MobileDrawer
          view={view}
          onNavigate={onNavigate}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          view={view}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={onNavigate}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
