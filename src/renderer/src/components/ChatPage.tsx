import { useState, useEffect } from 'react'
import { MessageCircle, Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Thread } from '@renderer/components/assistant-ui/thread'
import { AIRuntimeProvider } from '@renderer/components/AIRuntimeProvider'
import { ModelSelector } from '@renderer/components/ModelSelector'
import type { AIModelSelection } from '@common/types'

interface ChatPageProps {
  onSettings: () => void
}

const LAST_MODEL_SELECTION_KEY = 'ai-last-model-selection'

export function ChatPage({ onSettings }: ChatPageProps): React.JSX.Element {
  const [selectedModel, setSelectedModel] = useState<AIModelSelection | null>(() => {
    // Load last-used model selection from localStorage
    const stored = localStorage.getItem(LAST_MODEL_SELECTION_KEY)
    if (stored) {
      try {
        return JSON.parse(stored) as AIModelSelection
      } catch {
        return null
      }
    }
    return null
  })

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(LAST_MODEL_SELECTION_KEY, JSON.stringify(selectedModel))
    }
  }, [selectedModel])

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">AI Assistant</h1>
          </div>

          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettings}
              className="h-9 w-9"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <AIRuntimeProvider modelSelection={selectedModel}>
          <Thread />
        </AIRuntimeProvider>
      </main>
    </div>
  )
}
