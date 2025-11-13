# Chat Session Persistence Implementation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md` located at the repository root.


## Purpose / Big Picture

After this change, users will be able to close the application and return later to continue their previous conversations. When they reopen the app, their last chat session will automatically restore with all messages, tool calls, and conversation context intact. Users can also create multiple chat sessions, switch between them, rename them, and delete old conversations. This transforms the app from a single-use chat tool into a persistent conversation manager where no work is lost across restarts.

To see it working: start the app, have a conversation with the AI, close the app completely, reopen it, and observe that your conversation is still there and you can continue chatting from where you left off.


## Progress

- [ ] Phase 1: Database schema and core storage layer
  - [ ] Define Drizzle ORM schema for 4 tables (chat_sessions, chat_messages, message_parts, tool_call_results)
  - [ ] Generate migration files with drizzle-kit
  - [ ] Implement ChatSessionStore class with CRUD operations
  - [ ] Write unit tests for ChatSessionStore
  - [ ] Verify: Run tests and check database tables are created correctly

- [ ] Phase 2: Backend API integration
  - [ ] Add IPC handler methods for session management (create, list, get, update, delete)
  - [ ] Add IPC handler methods for message operations (add, delete after)
  - [ ] Implement session persistence hooks in streaming flow
  - [ ] Add lastSessionId to settings table
  - [ ] Verify: Test IPC methods from renderer with test data

- [ ] Phase 3: Renderer UI components
  - [ ] Create SessionList component (left sidebar)
  - [ ] Create ChatPanel component (main area)
  - [ ] Create SessionManager context for state management
  - [ ] Integrate session restoration on app startup
  - [ ] Verify: Create session, send message, restart app, session restores

- [ ] Phase 4: Streaming integration and tool calls
  - [ ] Hook user message save (immediate on send)
  - [ ] Hook assistant message save (on streaming completion)
  - [ ] Hook tool call part creation during streaming
  - [ ] Hook tool result updates during execution
  - [ ] Verify: Send message with tool calls, restart app, tool calls display correctly

- [ ] Phase 5: Polish and optimization
  - [ ] Add session search/filter
  - [ ] Add session rename functionality
  - [ ] Implement virtual scrolling for large message lists
  - [ ] Add error handling and retry logic
  - [ ] Verify: E2E test covering full user workflow


## Surprises & Discoveries

(This section will be updated as implementation proceeds)


## Decision Log

- Decision: Use 4-table normalized schema (chat_sessions, chat_messages, message_parts, tool_call_results) instead of single JSON column
  Rationale: Enables efficient SQL queries for tool statistics, error analysis, and future features like summarization. Follows OPENCODE design patterns which have proven successful.
  Date/Author: 2025-11-13 (Initial design)

- Decision: Store timestamps as Unix integer timestamps in database, convert to ISO 8601 strings only in API responses
  Rationale: SQLite integer timestamps are more efficient for sorting and indexing. Conversion at API boundary keeps database layer simple.
  Date/Author: 2025-11-13 (Initial design)

- Decision: Save assistant messages only after streaming completes, not incrementally during streaming
  Rationale: Simplifies persistence logic and avoids partial message states in database. Streaming chunks are temporary UI state only.
  Date/Author: 2025-11-13 (Initial design)

- Decision: Separate tool_call_results table from message_parts
  Rationale: Tool calls and their results arrive at different times during streaming. Separate tables allow INSERT-only operations without UPDATE, maintaining clear temporal separation.
  Date/Author: 2025-11-13 (Initial design)


## Outcomes & Retrospective

(This section will be updated at major milestones and completion)


## Context and Orientation

This application is an Electron-based AI chat tool with streaming support and MCP tool integration. Currently, all chat state lives only in memory within the renderer process. When the app closes, conversations are lost.

The application has three processes: main (src/main), backend (src/backend), and renderer (src/renderer/src). The backend process handles AI streaming via src/backend/ai/stream.ts and communicates with the renderer via IPC events. The database layer uses Drizzle ORM with better-sqlite3, currently storing only application settings in a single settings table (see src/backend/db/schema.ts).

Chat messages flow through the assistant-ui library (@assistant-ui/react) in the renderer, which maintains ThreadMessage objects with ContentPart arrays (text and tool-call types). Streaming events (aiChatChunk, aiToolCall, aiToolResult, aiChatEnd) are published from the backend and consumed by the renderer to build up the UI state incrementally.

The relevant existing files are:
- src/backend/db/schema.ts - Current database schema (only settings table)
- src/backend/db/index.ts - Database connection and initialization
- src/backend/ai/stream.ts - AI streaming orchestration
- src/renderer/src/components/assistant-ui/chat-interface.tsx - Main chat UI component
- src/renderer/src/lib/useAIStream.ts - Streaming hook that listens to backend events

We will add persistence by introducing four new database tables, a ChatSessionStore service class, IPC handler methods, and UI components for session management.


## Plan of Work

We will implement persistence in five phases, each independently testable.

**Phase 1: Database Schema and Store**

Create the database schema following the four-table design: chat_sessions (metadata), chat_messages (role, timestamps, tokens), message_parts (text or tool_call content), and tool_call_results (execution outcomes). Each table uses snake_case column names and integer Unix timestamps.

Edit src/backend/db/schema.ts to add four new table definitions using Drizzle ORM's sqliteTable function. Add appropriate foreign key constraints (CASCADE on delete) and indexes for session_id, created_at, and tool_call_id lookups.

Generate a migration by running `pnpm run drizzle-kit generate` which will create a new SQL file in resources/db/migrations/.

Create a new file src/backend/session/ChatSessionStore.ts that exports a class with methods: createSession, getSession, listSessions, updateSession, deleteSession, addMessage, updateToolCallResult, deleteMessagesAfter. Each method uses Drizzle queries and handles Unix timestamp to ISO 8601 conversion at the API boundary.

Write unit tests in src/backend/session/ChatSessionStore.test.ts that exercise each CRUD operation, verify cascade deletes work, and test transaction rollback on errors.

**Phase 2: Backend API Integration**

Add new IPC handlers in src/main/index.ts (or create src/main/handlers/session.ts if we want separation) that call the ChatSessionStore methods. Each handler wraps the store method and returns Result<T> for error handling.

Extend the settings table to include a lastSessionId key-value pair, or add getLastSessionId/setLastSessionId methods to the ChatSessionStore that use a dedicated column.

Modify src/backend/ai/stream.ts to publish a new event type (e.g., aiMessageComplete) when streaming finishes, so the renderer knows when to persist the full assistant message.

Test the handlers manually by calling them from the renderer console or via a simple test script that invokes the IPC methods.

**Phase 3: Renderer UI Components**

Create src/renderer/src/components/SessionList.tsx which fetches sessions via IPC on mount, displays them in a scrollable sidebar, and handles click to switch sessions. Add a "New Chat" button that calls createChatSession.

Create src/renderer/src/components/ChatPanel.tsx which wraps the existing ChatInterface component and adds a header showing the current session title and metadata.

Create src/renderer/src/contexts/SessionManager.tsx context that holds currentSessionId and messages state, provides methods to switchSession, createSession, deleteSession, and listens to IPC responses.

In src/renderer/src/App.tsx (or wherever the root component mounts), call getLastSessionId on startup. If a session ID is returned, call getChatSession to load it and populate the SessionManager context. If null, create a new session.

Test by starting the app, creating a session, adding some mock messages, closing and reopening the app, and confirming the session loads.

**Phase 4: Streaming Integration**

In src/renderer/src/lib/useAIStream.ts (or wherever streaming logic lives), add logic to immediately call addChatMessage with role 'user' when the user sends a message, before starting the AI stream.

When the streaming completes (aiChatEnd event), collect all accumulated text and tool_call parts from the UI state, then call addChatMessage with role 'assistant' and the full parts array.

When aiToolCall events arrive during streaming, insert a tool_call part into the UI immediately but do not persist yet. When aiToolResult arrives, call updateToolCallResult to persist the result to the tool_call_results table.

Test by sending a message that triggers a tool call, verifying the database contains the user message, assistant message with parts, and tool results after streaming completes. Restart the app and confirm everything displays correctly.

**Phase 5: Polish and Optimization**

Add a search box to SessionList that filters sessions by title (call searchChatSessions IPC method).

Add a rename button to the ChatPanel header that opens a dialog, calls updateChatSession with the new title on confirm.

If message lists are long (>100 messages), integrate react-virtual or a similar library to virtualize the MessageList rendering.

Add error boundaries around session operations, display toast notifications on failures, and implement retry logic for transient database errors.

Conduct end-to-end testing: create multiple sessions, send messages with and without tools, rename sessions, delete sessions, switch between them, restart the app multiple times, and verify all state persists correctly.


## Concrete Steps

All commands assume you are in the project root directory (where package.json lives).

**Phase 1 Steps:**

1. Edit src/backend/db/schema.ts and add the four table definitions with indexes.

2. Run migration generation:

        pnpm run drizzle-kit generate

   Expected output: "Migration generated successfully" and a new file in resources/db/migrations/ with timestamp.

3. Create src/backend/session/ChatSessionStore.ts with the class definition and methods.

4. Create src/backend/session/ChatSessionStore.test.ts and write tests.

5. Run tests:

        pnpm run test:backend

   Expected output: All tests pass. Check that tmp/db/app.db contains the four tables using:

        sqlite3 ./tmp/db/app.db ".tables"

   You should see: chat_sessions, chat_messages, message_parts, tool_call_results

**Phase 2 Steps:**

1. Add IPC handlers in src/main/index.ts (or new file src/main/handlers/session.ts). Register them with ipcMain.handle.

2. Extend the preload script (src/preload/index.ts) to expose the new IPC methods to the renderer.

3. Add lastSessionId to settings table or implement getLastSessionId/setLastSessionId in ChatSessionStore.

4. Test handlers by opening the app, opening DevTools console, and calling:

        window.api.createChatSession({ title: 'Test Session' })

   Should return { success: true, data: '<uuid>' }

**Phase 3 Steps:**

1. Create src/renderer/src/components/SessionList.tsx.

2. Create src/renderer/src/components/ChatPanel.tsx.

3. Create src/renderer/src/contexts/SessionManager.tsx.

4. Modify src/renderer/src/App.tsx to initialize SessionManager and load last session on mount.

5. Run the app:

        pnpm run dev

   Create a session, observe it appears in the sidebar. Close and reopen the app, session should still be there.

**Phase 4 Steps:**

1. In useAIStream.ts or equivalent, add call to addChatMessage when user sends a message.

2. Add call to addChatMessage when aiChatEnd event fires, with accumulated parts.

3. Add call to updateToolCallResult when aiToolResult event fires.

4. Test by sending a message that uses a tool (e.g., ask the AI to read a file). Check database:

        sqlite3 ./tmp/db/app.db "SELECT * FROM message_parts WHERE type='tool_call'"
        sqlite3 ./tmp/db/app.db "SELECT * FROM tool_call_results"

   Should see the tool call and result. Restart app and confirm tool call displays in UI.

**Phase 5 Steps:**

1. Add search input to SessionList.tsx that calls searchChatSessions IPC method.

2. Add rename button to ChatPanel.tsx that calls updateChatSession.

3. If needed, install react-virtual and apply to MessageList component.

4. Add error handling and toast notifications (use existing toast system if present).

5. Run comprehensive E2E tests manually: create 5 sessions, send messages to each, switch between them, rename one, delete one, restart app, verify all operations persist.


## Validation and Acceptance

**Phase 1 Acceptance:**
Run `pnpm run test:backend` and expect all ChatSessionStore tests to pass. Run `sqlite3 ./tmp/db/app.db ".schema chat_sessions"` and confirm the table exists with the correct columns (id, title, created_at, updated_at, provider_config_id, model_id, data_schema_version, message_count).

**Phase 2 Acceptance:**
Open the app, open DevTools console, run `await window.api.createChatSession({ title: 'Test' })` and receive a session ID. Run `await window.api.listChatSessions()` and see the created session in the list.

**Phase 3 Acceptance:**
Start the app, click "New Chat" in the sidebar, see a new session appear. Close the app completely (quit process), reopen it, and see the session still listed. Click on it and observe it becomes the active session (indicated by highlight or header change).

**Phase 4 Acceptance:**
Send a user message to the AI. Immediately after sending, check the database: `sqlite3 ./tmp/db/app.db "SELECT role, content FROM chat_messages JOIN message_parts ON chat_messages.id = message_parts.message_id WHERE role='user' ORDER BY created_at DESC LIMIT 1"` and see your message. Wait for AI response to complete. Check again for assistant message. If the response included a tool call, check `tool_call_results` table for an entry. Restart the app and confirm the full conversation displays including tool call details.

**Phase 5 Acceptance:**
Create 3 sessions with different names. Type a search term in the search box and see the list filter. Rename a session and see the title update in the sidebar immediately. Create a session with 200 messages (you may need to mock this or run a loop) and confirm scrolling is smooth. Trigger a database error (e.g., by making the database file read-only temporarily) and confirm a user-friendly error message appears instead of a crash.

**Final End-to-End Acceptance:**
Start the app fresh. Create session "Project A". Send 3 messages. Create session "Project B". Send 2 messages. Switch back to "Project A". Verify the 3 messages are still there. Close the app. Reopen. Verify "Project A" loads automatically (last used). Switch to "Project B" and verify its 2 messages. Delete "Project B". Verify it no longer appears in the list. Restart the app. Verify "Project B" is gone and "Project A" is still present. Send a new message to "Project A" with a tool call. Restart. Verify the tool call displays with correct status and results.


## Idempotence and Recovery

The migration generated in Phase 1 is idempotent: Drizzle Kit will not re-apply it if it has already run. If you need to reset the database during development, run `pnpm run db:reset` which deletes tmp/db/app.db and allows migrations to run fresh on next app start.

IPC methods can be called multiple times safely. Creating a session with the same title will create a new session with a new UUID each time. Deleting a session that does not exist will return an error but not crash.

If a message save fails mid-transaction (e.g., disk full), the transaction will roll back and the session state will remain consistent. The UI should handle this by showing an error and allowing the user to retry sending the message.

If you encounter a bug during Phase 4 streaming integration, you can disable the persistence hooks temporarily by commenting out the addChatMessage calls, allowing you to continue using the app without persistence while debugging.


## Artifacts and Notes

**Example Migration Output (Phase 1):**

    $ pnpm run drizzle-kit generate
    Generating migrations...
    Migration created: 0001_add_chat_sessions.sql
    Done.

**Example Schema Query (Phase 1):**

    $ sqlite3 ./tmp/db/app.db ".schema chat_sessions"
    CREATE TABLE chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      provider_config_id TEXT,
      model_id TEXT,
      data_schema_version INTEGER NOT NULL DEFAULT 1,
      message_count INTEGER NOT NULL DEFAULT 0
    );

**Example IPC Test (Phase 2):**

    > await window.api.createChatSession({ title: 'My First Session' })
    { success: true, data: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }

    > await window.api.listChatSessions()
    { success: true, data: [
      { id: 'f47ac10b-...', title: 'My First Session', createdAt: '2025-11-13T10:30:00Z', updatedAt: '2025-11-13T10:30:00Z', messageCount: 0 }
    ]}

**Example Database Query After Message Send (Phase 4):**

    $ sqlite3 ./tmp/db/app.db "SELECT role, type, content FROM chat_messages JOIN message_parts ON chat_messages.id = message_parts.message_id ORDER BY chat_messages.created_at"
    user|text|Hello, can you help me?
    assistant|text|Of course! What do you need?

**Example Tool Call Query (Phase 4):**

    $ sqlite3 ./tmp/db/app.db "SELECT tool_name, status FROM tool_call_results ORDER BY created_at DESC LIMIT 1"
    filesystem_read|success


## Interfaces and Dependencies

**Database Schema (src/backend/db/schema.ts):**

Define the following tables using Drizzle's `sqliteTable`:

    export const chatSessions = sqliteTable('chat_sessions', {
      id: text('id').primaryKey(),
      title: text('title').notNull(),
      createdAt: integer('created_at').notNull(),
      updatedAt: integer('updated_at').notNull(),
      providerConfigId: text('provider_config_id'),
      modelId: text('model_id'),
      dataSchemaVersion: integer('data_schema_version').notNull().default(1),
      messageCount: integer('message_count').notNull().default(0)
    })

    export const chatMessages = sqliteTable('chat_messages', {
      id: text('id').primaryKey(),
      sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
      role: text('role').notNull(), // 'user' | 'assistant' | 'system'
      createdAt: integer('created_at').notNull(),
      completedAt: integer('completed_at'),
      inputTokens: integer('input_tokens'),
      outputTokens: integer('output_tokens'),
      error: text('error'), // JSON string
      parentMessageId: text('parent_message_id').references(() => chatMessages.id, { onDelete: 'set null' })
    })

    export const messageParts = sqliteTable('message_parts', {
      id: text('id').primaryKey(),
      messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
      sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
      type: text('type').notNull(), // 'text' | 'tool_call'
      createdAt: integer('created_at').notNull(),
      updatedAt: integer('updated_at').notNull(),
      content: text('content'), // for text type
      toolCallId: text('tool_call_id'),
      toolName: text('tool_name'),
      toolInput: text('tool_input'), // JSON string
      toolInputText: text('tool_input_text'),
      metadata: text('metadata') // JSON string
    })

    export const toolCallResults = sqliteTable('tool_call_results', {
      id: text('id').primaryKey(),
      partId: text('part_id').notNull().unique().references(() => messageParts.id, { onDelete: 'cascade' }),
      messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
      sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
      toolCallId: text('tool_call_id').notNull().unique(),
      toolName: text('tool_name').notNull(),
      output: text('output'), // JSON string
      status: text('status').notNull(), // 'success' | 'error'
      error: text('error'),
      errorCode: text('error_code'),
      startedAt: integer('started_at'),
      completedAt: integer('completed_at'),
      createdAt: integer('created_at').notNull(),
      updatedAt: integer('updated_at').notNull()
    })

Add indexes:

    export const chatMessagesSessionIdIndex = index('idx_chat_messages_session_id').on(chatMessages.sessionId)
    export const chatMessagesCreatedAtIndex = index('idx_chat_messages_created_at').on(chatMessages.createdAt)
    export const messagePartsMessageIdIndex = index('idx_message_parts_message_id').on(messageParts.messageId)
    export const messagePartsSessionIdIndex = index('idx_message_parts_session_id').on(messageParts.sessionId)
    export const messagePartsToolCallIdIndex = index('idx_message_parts_tool_call_id').on(messageParts.toolCallId)
    export const toolCallResultsMessageIdIndex = index('idx_tool_call_results_message_id').on(toolCallResults.messageId)
    export const toolCallResultsToolNameIndex = index('idx_tool_call_results_tool_name').on(toolCallResults.toolName)

**ChatSessionStore Interface (src/backend/session/ChatSessionStore.ts):**

    export interface CreateSessionRequest {
      title?: string
      providerConfigId?: string
      modelId?: string
    }

    export interface AddMessageRequest {
      sessionId: string
      role: 'user' | 'assistant' | 'system'
      parts: AddMessagePartRequest[]
      inputTokens?: number
      outputTokens?: number
      error?: { name: string; message: string; details?: unknown }
    }

    export interface AddMessagePartRequest {
      type: 'text' | 'tool_call'
      content?: string
      toolCallId?: string
      toolName?: string
      input?: unknown
    }

    export interface UpdateToolCallResultRequest {
      toolCallId: string
      output?: unknown
      status: 'success' | 'error'
      error?: string
      errorCode?: string
    }

    export interface ChatSessionWithMessages {
      id: string
      title: string
      createdAt: string // ISO 8601
      updatedAt: string // ISO 8601
      providerConfigId?: string
      modelId?: string
      dataSchemaVersion: number
      messageCount: number
      messages: ChatMessageWithParts[]
    }

    export interface ChatMessageWithParts {
      id: string
      sessionId: string
      role: 'user' | 'assistant' | 'system'
      createdAt: string // ISO 8601
      completedAt?: string // ISO 8601
      inputTokens?: number
      outputTokens?: number
      error?: { name: string; message: string; details?: unknown }
      parts: (TextPart | ToolCallPart)[]
    }

    export interface TextPart {
      type: 'text'
      id: string
      content: string
      createdAt: string // ISO 8601
    }

    export interface ToolCallPart {
      type: 'tool_call'
      id: string
      toolCallId: string
      toolName: string
      input: unknown
      inputText: string
      status: 'pending' | 'success' | 'error'
      result?: {
        output?: unknown
        error?: string
        errorCode?: string
      }
      startedAt?: string // ISO 8601
      completedAt?: string // ISO 8601
    }

    export class ChatSessionStore {
      constructor(private db: Database)

      async createSession(request: CreateSessionRequest): Promise<string> // returns sessionId
      async getSession(sessionId: string): Promise<ChatSessionWithMessages | null>
      async listSessions(options?: { limit?: number; offset?: number; sortBy?: 'updatedAt' | 'createdAt' | 'title' }): Promise<ChatSessionRow[]>
      async updateSession(sessionId: string, updates: Partial<Pick<ChatSessionRow, 'title' | 'providerConfigId' | 'modelId'>>): Promise<void>
      async deleteSession(sessionId: string): Promise<void>
      async searchSessions(query: string): Promise<ChatSessionRow[]>
      async addMessage(request: AddMessageRequest): Promise<string> // returns messageId
      async updateToolCallResult(request: UpdateToolCallResultRequest): Promise<void>
      async deleteMessagesAfter(sessionId: string, messageId: string): Promise<void>
      async getLastSessionId(): Promise<string | null>
      async setLastSessionId(sessionId: string): Promise<void>
    }

**IPC Handler Methods (src/main/index.ts or src/main/handlers/session.ts):**

Register the following with ipcMain.handle:

    ipcMain.handle('createChatSession', async (event, request: CreateSessionRequest) => {
      return wrapResult(() => chatSessionStore.createSession(request))
    })

    ipcMain.handle('listChatSessions', async (event, options) => {
      return wrapResult(() => chatSessionStore.listSessions(options))
    })

    ipcMain.handle('getChatSession', async (event, sessionId: string) => {
      return wrapResult(() => chatSessionStore.getSession(sessionId))
    })

    ipcMain.handle('updateChatSession', async (event, sessionId: string, updates) => {
      return wrapResult(() => chatSessionStore.updateSession(sessionId, updates))
    })

    ipcMain.handle('deleteChatSession', async (event, sessionId: string) => {
      return wrapResult(() => chatSessionStore.deleteSession(sessionId))
    })

    ipcMain.handle('searchChatSessions', async (event, query: string) => {
      return wrapResult(() => chatSessionStore.searchSessions(query))
    })

    ipcMain.handle('addChatMessage', async (event, request: AddMessageRequest) => {
      return wrapResult(() => chatSessionStore.addMessage(request))
    })

    ipcMain.handle('updateToolCallResult', async (event, request: UpdateToolCallResultRequest) => {
      return wrapResult(() => chatSessionStore.updateToolCallResult(request))
    })

    ipcMain.handle('deleteMessagesAfter', async (event, sessionId: string, messageId: string) => {
      return wrapResult(() => chatSessionStore.deleteMessagesAfter(sessionId, messageId))
    })

    ipcMain.handle('getLastSessionId', async () => {
      return wrapResult(() => chatSessionStore.getLastSessionId())
    })

    ipcMain.handle('setLastSessionId', async (event, sessionId: string) => {
      return wrapResult(() => chatSessionStore.setLastSessionId(sessionId))
    })

**Preload API (src/preload/index.ts):**

Add to the api object exposed via contextBridge:

    api: {
      // ... existing methods
      createChatSession: (request: CreateSessionRequest) => ipcRenderer.invoke('createChatSession', request),
      listChatSessions: (options?) => ipcRenderer.invoke('listChatSessions', options),
      getChatSession: (sessionId: string) => ipcRenderer.invoke('getChatSession', sessionId),
      updateChatSession: (sessionId: string, updates) => ipcRenderer.invoke('updateChatSession', sessionId, updates),
      deleteChatSession: (sessionId: string) => ipcRenderer.invoke('deleteChatSession', sessionId),
      searchChatSessions: (query: string) => ipcRenderer.invoke('searchChatSessions', query),
      addChatMessage: (request: AddMessageRequest) => ipcRenderer.invoke('addChatMessage', request),
      updateToolCallResult: (request: UpdateToolCallResultRequest) => ipcRenderer.invoke('updateToolCallResult', request),
      deleteMessagesAfter: (sessionId: string, messageId: string) => ipcRenderer.invoke('deleteMessagesAfter', sessionId, messageId),
      getLastSessionId: () => ipcRenderer.invoke('getLastSessionId'),
      setLastSessionId: (sessionId: string) => ipcRenderer.invoke('setLastSessionId', sessionId)
    }

**React Context (src/renderer/src/contexts/SessionManager.tsx):**

    interface SessionManagerContext {
      currentSessionId: string | null
      sessions: ChatSessionRow[]
      currentSession: ChatSessionWithMessages | null
      isLoading: boolean
      createSession: (title?: string) => Promise<void>
      switchSession: (sessionId: string) => Promise<void>
      deleteSession: (sessionId: string) => Promise<void>
      renameSession: (sessionId: string, title: string) => Promise<void>
      searchSessions: (query: string) => Promise<void>
      refreshSessions: () => Promise<void>
    }

    export const SessionManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      // Implementation that calls window.api methods and manages state
    }

This completes the interface specifications. Follow the Plan of Work section to implement these interfaces in order, testing each phase before moving to the next.
