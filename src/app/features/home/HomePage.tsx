import { QuickActions } from '../../components/QuickActions'
import { RecentDocuments } from '../../components/RecentDocuments'
import { WelcomeSection } from '../../components/WelcomeSection'
import { WorkspaceModes } from '../../components/WorkspaceModes'
import type { ModeKey } from '../../navigation'

export interface HomePageProps {
  activeMode: ModeKey
  onSelectMode: (mode: ModeKey) => void
  onOpenDocument: () => void
  onCreateDocument: () => void
  onOpenWhiteboard: () => void
}

export function HomePage({
  activeMode,
  onSelectMode,
  onOpenDocument,
  onCreateDocument,
  onOpenWhiteboard,
}: HomePageProps) {
  return (
    <div className="flex flex-col gap-8">
      <WelcomeSection />
      <QuickActions
        onOpenDocument={onOpenDocument}
        onCreateDocument={onCreateDocument}
        onOpenWhiteboard={onOpenWhiteboard}
      />
      <WorkspaceModes activeMode={activeMode} onSelectMode={onSelectMode} />
      <RecentDocuments />
    </div>
  )
}
