import { SessionManagerProvider } from '@renderer/contexts/SessionManager'
import { SessionList } from '@renderer/components/SessionList'
import { ChatPanel } from '@renderer/components/ChatPanel'

interface ChatPageWithSessionsProps {
  onSettings: () => void
  onMastra?: () => void
}

export function ChatPageWithSessions({ onSettings, onMastra }: ChatPageWithSessionsProps): React.JSX.Element {
  return (
    <SessionManagerProvider>
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r flex-shrink-0">
          <SessionList />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 min-w-0">
          <ChatPanel onSettings={onSettings} onMastra={onMastra} />
        </div>
      </div>
    </SessionManagerProvider>
  )
}
