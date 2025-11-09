import { config } from 'dotenv'
import { vi } from 'vitest'

// Set environment variables BEFORE loading any modules
// This ensures paths are resolved correctly

// Set default user data path for tests if not already set
if (!process.env.MAIN_VITE_USER_DATA_PATH) {
  process.env.MAIN_VITE_USER_DATA_PATH = './tmp'
}

// Load environment variables for test environment
config()

// Mock process.send for backend logger
// The backend logger uses IPC to send logs to main process,
// but this is not available in test environment
if (!process.send) {
  process.send = vi.fn()
}