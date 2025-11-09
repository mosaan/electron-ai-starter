import { config } from 'dotenv'

// Load environment variables for test environment
// This ensures MAIN_VITE_USER_DATA_PATH is available during tests
config()

// Set default user data path for tests if not already set
if (!process.env.MAIN_VITE_USER_DATA_PATH) {
  process.env.MAIN_VITE_USER_DATA_PATH = './tmp'
}