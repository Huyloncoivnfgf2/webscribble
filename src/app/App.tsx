import { useState } from 'react'
import { AppShell } from './layouts/AppShell'
import { PwaStatus } from './PwaStatus'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { HomePage } from './features/home/HomePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { WhiteboardPage } from './features/whiteboard/WhiteboardPage'
import { SplitWorkspace } from './features/split/SplitWorkspace'
import type { ModeKey, ViewKey } from './navigation'

const CREATE_NOTICE =
  'Tạo tài liệu mới cần Document Engine và lớp lưu trữ — sẽ có ở TASK-06/07/08. Hiện tại bạn có thể xem trước giao diện các chế độ làm việc ở Trang chủ.'

export default function App() {
  const [view, setView] = useState<ViewKey>('home')
  const [activeMode, setActiveMode] = useState<ModeKey>('document')
  const [docNotice, setDocNotice] = useState<string | null>(null)
  /** Yêu cầu mở thẳng một tài liệu (từ Tài liệu gần đây ở Trang chủ). */
  const [openDocRequest, setOpenDocRequest] = useState<string | null>(null)
  /** Yêu cầu mở Split với một liên kết cho trước (TASK-13). */
  const [splitRequest, setSplitRequest] = useState<{
    documentId?: string
    whiteboardId?: string
  } | null>(null)

  const openSplit = (binding: { documentId?: string; whiteboardId?: string }) => {
    setSplitRequest(binding)
    setActiveMode('split')
    setView('split')
  }

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

  const openRecentDocument = (documentId: string) => {
    setDocNotice(null)
    setOpenDocRequest(documentId)
    setView('documents')
  }

  return (
    <AppShell view={view} onNavigate={go}>
      <PwaStatus />
      {view === 'home' && (
        <HomePage
          activeMode={activeMode}
          onSelectMode={setActiveMode}
          onOpenDocument={openDocuments}
          onCreateDocument={createDocument}
          onOpenWhiteboard={openWhiteboard}
          onOpenRecentDocument={openRecentDocument}
        />
      )}
      {view === 'recent' && <DocumentsPage variant="recent" notice={null} />}
      {view === 'documents' && (
        <DocumentsPage
          variant="all"
          notice={docNotice}
          openDocumentId={openDocRequest}
          onOpenDocumentHandled={() => setOpenDocRequest(null)}
          onOpenSplit={(documentId) => openSplit({ documentId })}
        />
      )}
      {view === 'whiteboard' && (
        <WhiteboardPage onOpenSplit={(whiteboardId) => openSplit({ whiteboardId })} />
      )}
      {view === 'split' && (
        <SplitWorkspace
          initialBinding={splitRequest}
          onInitialBindingHandled={() => setSplitRequest(null)}
        />
      )}
      {view === 'settings' && <SettingsPage />}
    </AppShell>
  )
}
