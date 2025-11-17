import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TokenCounter } from '../TokenCounter'
import type { ChatMessageWithParts } from '@common/chat-types'

describe('TokenCounter', () => {
  let counter: TokenCounter

  beforeEach(() => {
    counter = new TokenCounter()
  })

  afterEach(() => {
    counter.dispose()
  })

  describe('countText', () => {
    it('should count tokens in simple text', () => {
      const text = 'Hello, world!'
      const count = counter.countText(text)

      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(10) // Simple greeting should be < 10 tokens
    })

    it('should return 0 for empty string', () => {
      expect(counter.countText('')).toBe(0)
    })

    it('should count tokens in longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens than a simple greeting.'
      const count = counter.countText(text)

      expect(count).toBeGreaterThan(10)
    })

    it('should be consistent across multiple calls', () => {
      const text = 'Consistent token counting is important.'
      const count1 = counter.countText(text)
      const count2 = counter.countText(text)

      expect(count1).toBe(count2)
    })
  })

  describe('countMessageTokens', () => {
    it('should count tokens in a simple user message', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        state: 'completed',
        sequence: 1,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'text',
            id: 'part-1',
            content: 'Hello, how are you?',
            createdAt: new Date().toISOString()
          }
        ]
      }

      const count = counter.countMessageTokens(message)

      // Should include message overhead + role + content
      expect(count).toBeGreaterThan(4) // At least message overhead
      expect(count).toBeLessThan(20) // Simple message should be < 20 tokens
    })

    it('should count tokens in an assistant message', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        state: 'completed',
        sequence: 2,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'text',
            id: 'part-2',
            content: 'I am doing well, thank you for asking!',
            createdAt: new Date().toISOString()
          }
        ]
      }

      const count = counter.countMessageTokens(message)
      expect(count).toBeGreaterThan(4)
    })

    it('should count tokens in a message with tool invocation', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-3',
        sessionId: 'session-1',
        role: 'assistant',
        state: 'completed',
        sequence: 3,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'text',
            id: 'part-3',
            content: 'Let me search for that information.',
            createdAt: new Date().toISOString()
          },
          {
            kind: 'tool_invocation',
            id: 'part-4',
            toolCallId: 'call-123',
            toolName: 'web_search',
            input: { query: 'token counting' },
            status: 'success',
            metadata: undefined
          }
        ]
      }

      const count = counter.countMessageTokens(message)

      // Should count both text and tool invocation
      expect(count).toBeGreaterThan(10)
    })

    it('should count tokens in a message with tool result', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-4',
        sessionId: 'session-1',
        role: 'tool',
        state: 'completed',
        sequence: 4,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'tool_result',
            id: 'part-5',
            relatedToolCallId: 'call-123',
            output: { results: ['Result 1', 'Result 2'] },
            metadata: undefined
          }
        ]
      }

      const count = counter.countMessageTokens(message)
      expect(count).toBeGreaterThan(4)
    })

    it('should count tokens in a message with attachment', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-5',
        sessionId: 'session-1',
        role: 'user',
        state: 'completed',
        sequence: 5,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'attachment',
            id: 'part-6',
            mimeType: 'image/png',
            sizeBytes: 12345,
            metadata: undefined
          }
        ]
      }

      const count = counter.countMessageTokens(message)

      // Should only count metadata, not content
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(20) // Metadata should be minimal
    })

    it('should not count metadata parts', () => {
      const message: ChatMessageWithParts = {
        id: 'msg-6',
        sessionId: 'session-1',
        role: 'user',
        state: 'completed',
        sequence: 6,
        createdAt: new Date().toISOString(),
        parts: [
          {
            kind: 'metadata',
            id: 'part-7',
            content: { internalData: 'should not be counted' },
            metadata: undefined
          }
        ]
      }

      const count = counter.countMessageTokens(message)

      // Should only include message overhead + role, not metadata content
      expect(count).toBeLessThan(10)
    })
  })

  describe('countConversationTokens', () => {
    it('should count tokens in a simple conversation', () => {
      const messages: ChatMessageWithParts[] = [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'user',
          state: 'completed',
          sequence: 1,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-1',
              content: 'Hello!',
              createdAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'assistant',
          state: 'completed',
          sequence: 2,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-2',
              content: 'Hi there! How can I help you?',
              createdAt: new Date().toISOString()
            }
          ]
        }
      ]

      const result = counter.countConversationTokens(messages)

      expect(result.totalTokens).toBeGreaterThan(0)
      expect(result.inputTokens).toBeGreaterThan(0) // User message
      expect(result.outputTokens).toBeGreaterThan(0) // Assistant message
      expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens)
      expect(result.estimatedResponseTokens).toBeGreaterThan(0)
    })

    it('should categorize tokens by role', () => {
      const messages: ChatMessageWithParts[] = [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'system',
          state: 'completed',
          sequence: 1,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-1',
              content: 'You are a helpful assistant.',
              createdAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'user',
          state: 'completed',
          sequence: 2,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-2',
              content: 'What is 2 + 2?',
              createdAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 'msg-3',
          sessionId: 'session-1',
          role: 'assistant',
          state: 'completed',
          sequence: 3,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-3',
              content: '2 + 2 equals 4.',
              createdAt: new Date().toISOString()
            }
          ]
        }
      ]

      const result = counter.countConversationTokens(messages)

      // System and user messages should be counted as input
      expect(result.inputTokens).toBeGreaterThan(0)
      // Assistant message should be counted as output
      expect(result.outputTokens).toBeGreaterThan(0)
      expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens)
    })

    it('should handle empty conversation', () => {
      const result = counter.countConversationTokens([])

      expect(result.totalTokens).toBe(0)
      expect(result.inputTokens).toBe(0)
      expect(result.outputTokens).toBe(0)
      expect(result.estimatedResponseTokens).toBe(0)
    })

    it('should handle conversation with tool messages', () => {
      const messages: ChatMessageWithParts[] = [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'user',
          state: 'completed',
          sequence: 1,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'text',
              id: 'part-1',
              content: 'Search for information',
              createdAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'assistant',
          state: 'completed',
          sequence: 2,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'tool_invocation',
              id: 'part-2',
              toolCallId: 'call-1',
              toolName: 'search',
              input: { query: 'test' },
              status: 'success',
              metadata: undefined
            }
          ]
        },
        {
          id: 'msg-3',
          sessionId: 'session-1',
          role: 'tool',
          state: 'completed',
          sequence: 3,
          createdAt: new Date().toISOString(),
          parts: [
            {
              kind: 'tool_result',
              id: 'part-3',
              relatedToolCallId: 'call-1',
              output: { result: 'Found information' },
              metadata: undefined
            }
          ]
        }
      ]

      const result = counter.countConversationTokens(messages)

      expect(result.totalTokens).toBeGreaterThan(0)
      // Tool results should be counted as input
      expect(result.inputTokens).toBeGreaterThan(0)
      // Assistant tool invocation should be counted as output
      expect(result.outputTokens).toBeGreaterThan(0)
    })
  })

  describe('dispose', () => {
    it('should dispose without errors', () => {
      const testCounter = new TokenCounter()
      expect(() => testCounter.dispose()).not.toThrow()
    })

    it('should allow multiple dispose calls', () => {
      const testCounter = new TokenCounter()
      testCounter.dispose()
      expect(() => testCounter.dispose()).not.toThrow()
    })
  })

  describe('performance', () => {
    it('should count 10K tokens in reasonable time', () => {
      // Generate a large text (approximately 10K tokens)
      const largeText = 'word '.repeat(10000)

      const startTime = Date.now()
      const count = counter.countText(largeText)
      const duration = Date.now() - startTime

      expect(count).toBeGreaterThan(1000)
      expect(duration).toBeLessThan(500) // Should complete in < 500ms
    })
  })
})
