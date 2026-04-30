import path from 'node:path'
import { fileURLToPath } from 'node:url'

import electronMain from 'electron/main'

import { RuntimeService } from '../application/runtime-service.js'
import { inferWindowDisplayMode, registerIpcHandlers } from './ipc.js'
import { createMainWindow } from './window-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { app } = electronMain

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

let mainWindow: Electron.BrowserWindow | null = null

async function bootstrap() {
  const contentRoot = isDev
    ? path.resolve(__dirname, '../../content')
    : path.join(process.resourcesPath!, 'content')

  const dataRoot = path.join(app.getPath('userData'), 'data')

  const runtimeService = new RuntimeService(contentRoot, dataRoot, app.getVersion())
  await runtimeService.initialize()

  mainWindow = createMainWindow(
    runtimeService.getState().settings,
    runtimeService.getWindowPositionForDisplayMode('desktop'),
  )

  registerIpcHandlers(runtimeService, () => mainWindow)

  mainWindow.on('close', () => {
    if (!mainWindow) {
      return
    }
    const [x, y] = mainWindow.getPosition()
    const { width, height } = mainWindow.getBounds()
    void runtimeService.updateWindowPositionForDisplayMode(
      inferWindowDisplayMode({ width, height }),
      { x, y },
    )
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[main] renderer gone:', details)
    })
    mainWindow.webContents.on('unresponsive', () => {
      console.error('[main] renderer unresponsive')
    })
  } else {
    await mainWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await bootstrap()

  app.on('activate', async () => {
    if (mainWindow === null) {
      await bootstrap()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
