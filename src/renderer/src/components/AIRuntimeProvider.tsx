import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react'
import { ReactNode } from 'react'
import { logger } from '@renderer/lib/logger'
import { streamText } from '@renderer/lib/ai'
import type { AIModelSelection } from '@common/types'

interface AIRuntimeProviderProps {
  children: ReactNode
  modelSelection: AIModelSelection | null
}

export function AIRuntimeProvider({ children, modelSelection }: AIRuntimeProviderProps): React.JSX.Element {
  // Create adapter with modelSelection closure
  const createAIModelAdapter = (currentSelection: AIModelSelection | null): ChatModelAdapter => ({
    async *run({ messages, abortSignal }) {
      // Convert Assistant-ui messages to AIMessage format
      const formattedMessages = messages.map((message: ThreadMessage) => ({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('')
      }))

      const selectionInfo = currentSelection
        ? `${currentSelection.providerConfigId}:${currentSelection.modelId}`
        : 'default'
      logger.info(`Starting AI stream with ${formattedMessages.length} messages, selection: ${selectionInfo}`)
      const stream = await streamText(formattedMessages, abortSignal, currentSelection)

      const contentChunks: string[] = []
      for await (const chunk of stream) {
        if (abortSignal?.aborted) return
        contentChunks.push(chunk)
        yield { content: [{ type: 'text', text: contentChunks.join('') }] }
      }

      logger.info('AI stream completed')
    }
  })

  const runtime = useLocalRuntime(createAIModelAdapter(modelSelection))

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
