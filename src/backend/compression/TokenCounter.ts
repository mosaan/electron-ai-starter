import { get_encoding, type Tiktoken } from 'tiktoken'
import type { ChatMessageWithParts, MessagePart } from '@common/chat-types'
import logger from '@backend/logger'

const log = logger.child('compression:token-counter')

export interface TokenCountResult {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  estimatedResponseTokens: number
}

/**
 * Token counter using tiktoken o200k_base encoding
 * Provides fast, local token counting for conversation messages
 */
export class TokenCounter {
  private encoding: Tiktoken

  constructor() {
    // Use o200k_base encoding (used by GPT-4o and other models)
    // This is a good universal encoding for most modern models
    this.encoding = get_encoding('o200k_base')
    log.debug('TokenCounter initialized with o200k_base encoding')
  }

  /**
   * Count tokens in a single message
   * Includes message overhead (4 tokens per message for role + formatting)
   */
  countMessageTokens(message: ChatMessageWithParts): number {
    let tokens = 0

    // Message overhead: role + formatting
    const MESSAGE_OVERHEAD = 4
    tokens += MESSAGE_OVERHEAD

    // Count role tokens
    tokens += this.countText(message.role)

    // Count tokens in all parts
    for (const part of message.parts) {
      tokens += this.countPartTokens(part)
    }

    return tokens
  }

  /**
   * Count tokens in a conversation (array of messages)
   * Returns categorized token counts
   */
  countConversationTokens(messages: ChatMessageWithParts[]): TokenCountResult {
    let inputTokens = 0
    let outputTokens = 0

    for (const message of messages) {
      const messageTokens = this.countMessageTokens(message)

      if (message.role === 'user' || message.role === 'system') {
        inputTokens += messageTokens
      } else if (message.role === 'assistant') {
        outputTokens += messageTokens
      } else if (message.role === 'tool') {
        // Tool results are counted as input
        inputTokens += messageTokens
      }
    }

    const totalTokens = inputTokens + outputTokens

    // Estimate response tokens (conservative: 10% of context or 2000 tokens, whichever is smaller)
    const estimatedResponseTokens = Math.min(Math.floor(totalTokens * 0.1), 2000)

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      estimatedResponseTokens
    }
  }

  /**
   * Count tokens in raw text
   */
  countText(text: string): number {
    if (!text || text.length === 0) {
      return 0
    }

    try {
      const tokens = this.encoding.encode(text)
      return tokens.length
    } catch (error) {
      log.error('Error encoding text', { error, textLength: text.length })
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4)
    }
  }

  /**
   * Count tokens in a message part
   */
  private countPartTokens(part: MessagePart): number {
    switch (part.kind) {
      case 'text':
        return this.countText(part.content)

      case 'tool_invocation':
        return this.countToolInvocation(part)

      case 'tool_result':
        return this.countToolResult(part)

      case 'attachment':
        return this.countAttachment(part)

      case 'metadata':
        // Metadata is usually not sent to AI, count as 0
        return 0

      default:
        log.warn('Unknown part kind', { part })
        return 0
    }
  }

  /**
   * Count tokens in a tool invocation
   * Serializes the tool call to JSON and counts tokens
   */
  private countToolInvocation(part: Extract<MessagePart, { kind: 'tool_invocation' }>): number {
    let tokens = 0

    // Tool name
    tokens += this.countText(part.toolName)

    // Tool call ID
    tokens += this.countText(part.toolCallId)

    // Input parameters (serialize to JSON)
    if (part.input) {
      const inputJson = JSON.stringify(part.input)
      tokens += this.countText(inputJson)
    }

    // Input text if available
    if (part.inputText) {
      tokens += this.countText(part.inputText)
    }

    // Status
    tokens += this.countText(part.status)

    // Tool invocation overhead (similar to message overhead)
    const TOOL_OVERHEAD = 3
    tokens += TOOL_OVERHEAD

    return tokens
  }

  /**
   * Count tokens in a tool result
   * Serializes the result to JSON and counts tokens
   */
  private countToolResult(part: Extract<MessagePart, { kind: 'tool_result' }>): number {
    let tokens = 0

    // Related tool call ID
    tokens += this.countText(part.relatedToolCallId)

    // Output (serialize to JSON)
    if (part.output) {
      const outputJson = JSON.stringify(part.output)
      tokens += this.countText(outputJson)
    }

    // Output text if available
    if (part.outputText) {
      tokens += this.countText(part.outputText)
    }

    // Error information
    if (part.errorCode) {
      tokens += this.countText(part.errorCode)
    }
    if (part.errorMessage) {
      tokens += this.countText(part.errorMessage)
    }

    // Tool result overhead
    const TOOL_RESULT_OVERHEAD = 3
    tokens += TOOL_RESULT_OVERHEAD

    return tokens
  }

  /**
   * Count tokens in an attachment
   * Only counts metadata (filename, MIME type), not the actual content
   */
  private countAttachment(part: Extract<MessagePart, { kind: 'attachment' }>): number {
    let tokens = 0

    // MIME type
    tokens += this.countText(part.mimeType)

    // Size (convert to text representation)
    if (part.sizeBytes !== undefined) {
      tokens += this.countText(part.sizeBytes.toString())
    }

    // Metadata if present
    if (part.metadata) {
      const metadataJson = JSON.stringify(part.metadata)
      tokens += this.countText(metadataJson)
    }

    // Attachment overhead
    const ATTACHMENT_OVERHEAD = 2
    tokens += ATTACHMENT_OVERHEAD

    return tokens
  }

  /**
   * Clean up encoding resources
   * Should be called when TokenCounter is no longer needed
   */
  dispose(): void {
    try {
      this.encoding.free()
      log.debug('TokenCounter encoding resources freed')
    } catch (error) {
      log.error('Error freeing encoding resources', { error })
    }
  }
}
