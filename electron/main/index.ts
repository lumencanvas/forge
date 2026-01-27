/**
 * SILO - Main Electron Process
 * electron-vite + Vue 3 + Ollama integration
 */

import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { OllamaService } from './ollama'
import { HardwareDetector, HardwareInfo } from './hardware'
import { settingsService, type AppSettings, type Chat } from './settings'

// Keep global references
let mainWindow: BrowserWindow | null = null
let ollamaService: OllamaService
let hardwareDetector: HardwareDetector
let hardwareInfo: HardwareInfo

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function initializeServices(): Promise<void> {
  // Hardware detection
  hardwareInfo = await hardwareDetector.detect()

  console.log(`SILO initialized - Hardware Tier: ${hardwareInfo.tier.name}`)

  // Start Ollama service (no longer throws - just sets status)
  await ollamaService.start()
  const ollamaStatus = ollamaService.getStatus()
  console.log(`[SILO] Ollama status: ${ollamaStatus.status}${ollamaStatus.error ? ` (${ollamaStatus.error})` : ''}`)
}

function sendInitialState(): void {
  // Send initial hardware info to renderer
  mainWindow?.webContents.send('hardware:info', hardwareInfo)

  // Send initial Ollama status to renderer
  mainWindow?.webContents.send('ollama:status-change', ollamaService.getStatus())
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  // Hardware
  ipcMain.handle('hardware:detect', async () => {
    return hardwareDetector.detect(true)
  })

  // Ollama
  ipcMain.handle('ollama:status', () => {
    return ollamaService.getStatus()
  })

  ipcMain.handle('ollama:check-connection', async () => {
    // Attempt to reconnect
    await ollamaService.start()
    const status = ollamaService.getStatus()
    mainWindow?.webContents.send('ollama:status-change', status)
    return status
  })

  ipcMain.handle('ollama:list', async () => {
    return ollamaService.listModels()
  })

  ipcMain.handle('ollama:pull', async (_, model: string) => {
    return ollamaService.pullModel(model, (progress) => {
      mainWindow?.webContents.send('ollama:pull-progress', { model, progress })
    })
  })

  ipcMain.handle('ollama:generate', async (_, opts: {
    model: string
    prompt: string
    images?: string[]
    stream?: boolean
  }) => {
    return ollamaService.generate(opts.model, opts.prompt, opts.images)
  })

  ipcMain.handle('ollama:chat', async (_, opts: {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }>
  }) => {
    return ollamaService.chat(opts.model, opts.messages)
  })

  // Dialogs
  ipcMain.handle('dialog:openFiles', async () => {
    if (!mainWindow) return []
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }
      ]
    })
    return result.filePaths
  })

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return undefined
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.filePaths[0]
  })

  // Shell
  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    return shell.openPath(filePath)
  })

  ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
    return shell.showItemInFolder(filePath)
  })

  // Settings
  ipcMain.handle('settings:get', async (_, key: keyof AppSettings) => {
    return settingsService.get(key)
  })

  ipcMain.handle('settings:set', async (_, key: keyof AppSettings, value: unknown) => {
    settingsService.set(key, value as AppSettings[typeof key])
  })

  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:setAll', async (_, settings: Partial<AppSettings>) => {
    settingsService.setAll(settings)
  })

  ipcMain.handle('settings:reset', async () => {
    settingsService.reset()
  })

  // Chats
  ipcMain.handle('chats:getAll', async () => {
    return settingsService.getChats()
  })

  ipcMain.handle('chats:get', async (_, id: string) => {
    return settingsService.getChat(id)
  })

  ipcMain.handle('chats:save', async (_, chat: Chat) => {
    settingsService.saveChat(chat)
  })

  ipcMain.handle('chats:delete', async (_, id: string) => {
    settingsService.deleteChat(id)
  })

  ipcMain.handle('chats:clear', async () => {
    settingsService.clearChats()
  })

  // Export/Import
  ipcMain.handle('data:export', async () => {
    return settingsService.exportData()
  })

  ipcMain.handle('data:import', async (_, data: { settings?: Partial<AppSettings>; chats?: Chat[] }) => {
    settingsService.importData(data)
  })

  ipcMain.handle('data:exportToFile', async () => {
    if (!mainWindow) return { success: false }
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'silo-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { success: false }

    const { writeFile } = await import('fs/promises')
    const data = settingsService.exportData()
    await writeFile(result.filePath, JSON.stringify(data, null, 2))
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('data:importFromFile', async () => {
    if (!mainWindow) return { success: false }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }

    const content = await readFile(result.filePaths[0]!, 'utf-8')
    const data = JSON.parse(content)
    settingsService.importData(data)
    return { success: true }
  })

  // Storage info
  ipcMain.handle('storage:getPath', async () => {
    return settingsService.getStoragePath()
  })

  ipcMain.handle('storage:getUserDataPath', async () => {
    // Return the actual storage path in Documents/SILO
    return join(app.getPath('documents'), 'SILO')
  })
}

// App lifecycle
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('build.hack.silo')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize services
  hardwareDetector = new HardwareDetector()
  ollamaService = new OllamaService()

  // Initialize services FIRST (hardware detection + Ollama connection)
  // This ensures services are ready before renderer can call them
  await initializeServices()

  // THEN set up IPC handlers and create window
  setupIpcHandlers()
  createWindow()

  // Send initial state to renderer once window is ready
  mainWindow?.webContents.once('did-finish-load', () => {
    sendInitialState()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('before-quit', async () => {
  await ollamaService?.stop()
})
