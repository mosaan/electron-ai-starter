import { config } from 'dotenv'
import * as path from 'path'

// Load environment variables for test environment
// This ensures MAIN_VITE_USER_DATA_PATH is available during tests
config()

// Set user data path for tests if not already set
// This prevents errors when importing modules that use db/index.ts
if (!process.env.MAIN_VITE_USER_DATA_PATH) {
  process.env.MAIN_VITE_USER_DATA_PATH = path.join(__dirname, '..', 'tmp')
}