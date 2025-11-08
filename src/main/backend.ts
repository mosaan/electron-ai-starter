import { utilityProcess, MessageChannelMain, UtilityProcess, WebContents } from 'electron'
import logger from './logger'
import { getBasePath } from './paths'
import backendPath from '../backend/index?modulePath'
import log from 'electron-log/main'

export class Backend {
  private _process: UtilityProcess
  private _messageChannels: Map<number, MessageChannelMain> = new Map()

  constructor() {
    const userDataPath = getBasePath()
    this._process = utilityProcess.fork(backendPath, ['--user-data-path', userDataPath])

    // Setup listener for logs from backend process
    this._setupLogHandler()
  }

  /**
   * Setup handler to receive logs from backend process
   */
  private _setupLogHandler(): void {
    this._process.on('message', (message) => {
      // Handle log messages from backend
      if (message.type === 'log') {
        const { level, scope, message: logMessage, data } = message.payload

        // Create a scoped logger
        const backendLogger = log.scope(scope || 'backend')

        // Log with appropriate level
        if (data && Object.keys(data).length > 0) {
          backendLogger[level](logMessage, data)
        } else {
          backendLogger[level](logMessage)
        }
      }
    })
  }

  connectRenderer(renderer: WebContents): void {
    const messageChannel = new MessageChannelMain()
    this._messageChannels.set(renderer.id, messageChannel)
    const backendPort = messageChannel.port1
    const rendererPort = messageChannel.port2
    backendPort.start()
    rendererPort.start()

    // send one port to backend tell it it is a connection for renderer
    const message = `renderer/${renderer.id}`
    this._process.postMessage({ channel: 'connectRenderer', message }, [backendPort])

    this._afterRendererConnected(message, () => {
      // send the other port to renderer and inform backend is connected
      renderer.postMessage('backendConnected', null, [rendererPort])
    })
  }

  private _afterRendererConnected(rendererId: string, callback: () => void): void {
    const responseListener = (e) => {
      if (e.data.channel !== 'rendererConnected') return
      if (e.data.message !== rendererId) return

      // Remove listener immediately to prevent accumulation
      this._process.removeListener('message', responseListener)
      callback()
    }

    this._process.on('message', responseListener)
  }

  async stop(): Promise<void> {
    if (!this._process) return
    logger.info('Stopping backend process...')

    return new Promise<void>((resolve) => {
      this._process.once('exit', () => {
        logger.info('Backend process stopped')
        resolve()
      })

      this._process.kill()
    })
  }
}
