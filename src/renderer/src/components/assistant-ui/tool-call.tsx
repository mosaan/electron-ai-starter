import { FC, useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'

interface ToolCallPartProps {
  part: {
    type: 'tool-call'
    toolCallId: string
    toolName: string
    args: unknown
    argsText: string
    result?: unknown
  }
}

export const ToolCallPart: FC<ToolCallPartProps> = ({ part }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatResult = (result: unknown): string => {
    if (typeof result === 'string') {
      return result
    }
    return JSON.stringify(result, null, 2)
  }

  return (
    <div className="my-2 rounded-lg border border-muted bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Wrench className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{part.toolName}</span>
        {part.result !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
            Completed
          </span>
        )}
        {part.result === undefined && (
          <span className="ml-auto text-xs text-muted-foreground bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
            Running...
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-muted px-3 py-2 space-y-2">
          {/* Tool Arguments */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Arguments:</div>
            <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
              <code>{part.argsText}</code>
            </pre>
          </div>

          {/* Tool Result */}
          {part.result !== undefined && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Result:</div>
              <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                <code>{formatResult(part.result)}</code>
              </pre>
            </div>
          )}

          {/* Tool Call ID (for debugging) */}
          <div className="text-xs text-muted-foreground/70">
            ID: {part.toolCallId}
          </div>
        </div>
      )}
    </div>
  )
}
