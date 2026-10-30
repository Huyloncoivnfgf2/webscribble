import { useState } from 'react'
import { AppShell } from './layouts/AppShell'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { HomePage } from './features/home/HomePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { WhiteboardPage } from './features/whiteboard/WhiteboardPage'
import type { ModeKey, ViewKey } from './navigation'

const CREATE_NOTICE =
  'Tạo tài liệu mới cần Document Engine và lớp lưu trữ — sẽ có ở TASK-06/07/08. Hiện tại bạn có thể xem trước giao diện các chế độ làm việc ở Trang chủ.'

export default function App() {
  const [view, setView] = useState<ViewKey>('home')
  const [activeMode, setActiveMode] = useState<ModeKey>('document')
  const [docNotice, setDocNotice] = useState<string | null>(null)

  const go = (next: ViewKey) => {
    setView(next)
    if (next !== 'documents') setDocNotice(null)
    if (next === 'whiteboard') setActiveMode('whiteboard')
  }

  const openDocuments = () => {
    setDocNotice(null)
    setView('documents')
  }

  const createDocument = () => {
    setDocNotice(CREATE_NOTICE)
    setView('documents')
  }

  const openWhiteboard = () => {
    setActiveMode('whiteboard')
    setView('whiteboard')
  }

  return (
    <AppShell view={view} onNavigate={go}>
      {view === 'home' && (
        <HomePage
          activeMode={activeMode}
          onSelectMode={setActiveMode}
          onOpenDocument={openDocuments}
          onCreateDocument={createDocument}
          onOpenWhiteboard={openWhiteboard}
        />
      )}
      {view === 'recent' && <DocumentsPage variant="recent" notice={null} />}
      {view === 'documents' && <DocumentsPage variant="all" notice={docNotice} />}
      {view === 'whiteboard' && <WhiteboardPage />}
      {view === 'settings' && <SettingsPage />}
    </AppShell>
  )
}
