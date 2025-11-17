import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { AIConfig } from '@common/types'
import { createModel } from '@backend/ai/factory'
import logger from '@backend/logger'
import type { ChatMessageWithParts } from '@common/chat-types'

const log = logger.child('compression:summarization')

export interface SummarizationOptions {
  messages: ChatMessageWithParts[]
  provider: string
  model?: string // Optional: override default summarization model
  apiKey: string
  baseURL?: string
  sessionId: string
  promptTemplate?: string
}

/**
 * Service for generating AI-powered summaries of conversation history
 * Uses cheaper/faster models optimized for summarization tasks
 */
export class SummarizationService {
  /**
   * Generate a summary of conversation messages
   * Returns a concise summary preserving key information
   */
  async summarize(options: SummarizationOptions): Promise<string> {
    const { messages, provider, apiKey, baseURL, sessionId, promptTemplate } = options

    // Select appropriate summarization model
    const modelName = options.model || this.selectSummarizationModel(provider)

    log.info('Starting summarization', {
      sessionId,
      provider,
      model: modelName,
      messageCount: messages.length
    })

    try {
      // Convert messages to text format
      const conversationText = this.messagesToText(messages)

      // Get summarization prompt
      const prompt = promptTemplate || this.getSummarizationPrompt(conversationText)

      // Create AI model
      const aiConfig: AIConfig = {
        provider: provider as any,
        model: modelName,
        apiKey,
        baseURL
      }

      const model: LanguageModel = await createModel(aiConfig)

      // Generate summary
      const startTime = Date.now()
      const { text: summary } = await generateText({
        model,
        prompt,
        temperature: 0.3 // Lower temperature for more focused summaries
      })

      const duration = Date.now() - startTime

      log.info('Summarization completed', {
        sessionId,
        durationMs: duration,
        summaryLength: summary.length,
        compressionRatio: (summary.length / conversationText.length).toFixed(2)
      })

      return summary
    } catch (error) {
      log.error('Summarization failed', {
        sessionId,
        provider,
        model: modelName,
        error
      })
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Select the most appropriate model for summarization
   * Prefers cheaper, faster models suitable for summarization tasks
   */
  private selectSummarizationModel(provider: string): string {
    const summarizationModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-haiku-20241022',
      google: 'gemini-2.5-flash',
      azure: 'gpt-4o-mini'
    }

    const model = summarizationModels[provider]
    if (!model) {
      log.warn(`No summarization model configured for provider: ${provider}, using default`)
      return 'gpt-4o-mini' // Fallback
    }

    return model
  }

  /**
   * Generate the summarization prompt
   * Instructs AI to create a concise summary preserving key information
   */
  private getSummarizationPrompt(conversationText: string): string {
    return `You are an expert at summarizing conversations while preserving important information.

Your task is to create a concise summary of the following conversation that:

1. **Preserves key facts and decisions**: Include all important information, data, and conclusions
2. **Maintains chronological order**: Keep the flow of the conversation clear
3. **Retains technical details**: Include code snippets, API names, configuration values, and technical terminology
4. **Includes tool invocations**: Mention when tools were used and what they accomplished
5. **Uses concise language**: Compress verbose explanations while keeping essential meaning
6. **Focuses on actionable content**: Prioritize information that affects understanding or future decisions

Format the summary as:
- Start with "## Summary" heading
- Use bullet points for key facts and decisions
- Use sub-sections for different topics if needed
- Keep code examples inline with triple backticks
- Aim for 50-70% compression while retaining all essential information

Conversation to summarize:

${conversationText}

Generate the summary now:`
  }

  /**
   * Convert messages to plain text format for summarization
   * Includes message roles, content, and tool information
   */
  private messagesToText(messages: ChatMessageWithParts[]): string {
    const lines: string[] = []

    for (const message of messages) {
      // Add message header with role
      lines.push(`\n[${message.role.toUpperCase()}]`)

      // Process each part
      for (const part of message.parts) {
        switch (part.kind) {
          case 'text':
            lines.push(part.content)
            break

          case 'tool_invocation':
            lines.push(
              `<tool_invocation name="${part.toolName}" id="${part.toolCallId}">` +
                `\nInput: ${JSON.stringify(part.input, null, 2)}` +
                `\nStatus: ${part.status}` +
                `\n</tool_invocation>`
            )
            break

          case 'tool_result':
            lines.push(
              `<tool_result for="${part.relatedToolCallId}">` +
                (part.output ? `\nOutput: ${JSON.stringify(part.output, null, 2)}` : '') +
                (part.outputText ? `\n${part.outputText}` : '') +
                (part.errorMessage ? `\nError: ${part.errorMessage}` : '') +
                `\n</tool_result>`
            )
            break

          case 'attachment':
            lines.push(
              `<attachment type="${part.mimeType}"` +
                (part.sizeBytes ? ` size="${part.sizeBytes}"` : '') +
                ` />`
            )
            break

          case 'metadata':
            // Skip metadata in summarization
            break
        }
      }
    }

    return lines.join('\n')
  }
}
