import { app, ipcMain } from 'electron'
import log from 'electron-log/main'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

function getLogFolder(): string {
  if (isDev) {
    if (!import.meta.env.MAIN_VITE_USER_DATA_PATH) {
      throw new Error('MAIN_VITE_USER_DATA_PATH environment variable is required in development')
    }
    return path.join(import.meta.env.MAIN_VITE_USER_DATA_PATH, 'logs')
  }
  return path.join(app.getPath('userData'), 'logs')
}

export function initializeLogging(): void {
  const logFolder = getLogFolder()

  // Initialize for renderer IPC
  log.initialize()

  // Configure unified log file with process type in format
  log.transports.file.resolvePathFn = () => {
    return path.join(logFolder, 'app.log') // Unified log file
  }

  // Enhanced format with process type and timestamp
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}'

  // Set log levels and file transport options
  log.transports.console.level = isDev ? 'debug' : 'error'
  log.transports.console.format = '[{level}] [{scope}] {text}'
  log.transports.file.level = isDev ? 'debug' : 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB

  // Setup IPC handler to receive logs from backend process
  setupBackendLogHandler()

  // Error and event handling
  log.errorHandler.startCatching({
    showDialog: isDev,
    onError: ({ error, processType }) => {
      log.error('Process error:', { processType, error })
    }
  })

  log.eventLogger.startLogging({ level: 'warn' })
}

/**
 * Setup IPC handler to receive logs from backend process
 * Backend process will send logs via IPC, and we'll write them to the unified log
 */
function setupBackendLogHandler(): void {
  ipcMain.on('log:backend', (_event, logEntry) => {
    const { level, scope, message, data } = logEntry

    // Create a scoped logger for backend
    const backendLogger = log.scope(scope || 'backend')

    // Log with appropriate level
    if (data && Object.keys(data).length > 0) {
      backendLogger[level](message, data)
    } else {
      backendLogger[level](message)
    }
  })
}

const logger = log.scope('main')
export default logger
