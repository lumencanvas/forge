/**
 * SILO - Main Electron Process
 * electron-vite + Vue 3 + Multi-backend AI support
 */

import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { HardwareDetector, HardwareInfo } from './hardware'
import { settingsService, type AppSettings, type Chat } from './settings'
import {
  getModelProviderManager,
  type ModelPullProgress,
  type ChatRequest,
  type GenerateOptions,
  type EmbedOptions,
  type VisionOptions,
  type AudioOptions,
  type ImageGenOptions,
  type HardwareTier,
  type TaskType,
  type ProviderType,
  type CustomModelConfig
} from './providers'

// Keep global references
let mainWindow: BrowserWindow | null = null
let hardwareDetector: HardwareDetector
let hardwareInfo: HardwareInfo

// Get the provider manager singleton
const providerManager = getModelProviderManager()

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

  // Initialize all model providers with detected hardware tier
  const providersStatus = await providerManager.initialize(hardwareInfo.tier.name as HardwareTier)
  console.log(`[SILO] Providers initialized: ${providersStatus.providers.map(p => `${p.name}:${p.status}`).join(', ')}`)

  // Set up pull progress callback
  providerManager.setPullProgressCallback((progress: ModelPullProgress) => {
    mainWindow?.webContents.send('models:pull-progress', progress)
    // Also send to legacy channel for backwards compatibility
    if (progress.provider === 'ollama') {
      mainWindow?.webContents.send('ollama:pull-progress', {
        model: progress.model.replace('ollama:', ''),
        progress: progress.progress
      })
    }
  })
}

function sendInitialState(): void {
  // Send initial hardware info to renderer
  mainWindow?.webContents.send('hardware:info', hardwareInfo)

  // Send initial provider status to renderer
  const providersStatus = providerManager.getStatus()
  mainWindow?.webContents.send('models:status', providersStatus)

  // Send legacy Ollama status for backwards compatibility
  const ollamaProvider = providerManager.getOllamaProvider()
  mainWindow?.webContents.send('ollama:status-change', ollamaProvider.getLegacyStatus())
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  // Hardware
  ipcMain.handle('hardware:detect', async () => {
    return hardwareDetector.detect(true)
  })

  // ============================================
  // NEW: Unified Model Provider API (models.*)
  // ============================================

  // Get status of all providers
  ipcMain.handle('models:status', () => {
    return providerManager.getStatus()
  })

  // List all models from all providers
  ipcMain.handle('models:list', async () => {
    return providerManager.listAllModels()
  })

  // Unified chat
  ipcMain.handle('models:chat', async (_, request: ChatRequest) => {
    return providerManager.chat(request)
  })

  // Unified generate
  ipcMain.handle('models:generate', async (_, options: GenerateOptions) => {
    return providerManager.generate(options)
  })

  // Unified embed
  ipcMain.handle('models:embed', async (_, options: EmbedOptions) => {
    return providerManager.embed(options)
  })

  // Vision tasks (image classification, object detection, etc.)
  ipcMain.handle('models:vision', async (_, options: VisionOptions) => {
    return providerManager.vision(options)
  })

  // Audio tasks (speech-to-text, etc.)
  ipcMain.handle('models:audio', async (_, options: AudioOptions) => {
    return providerManager.audio(options)
  })

  // Image generation
  ipcMain.handle('models:image-gen', async (_, options: ImageGenOptions) => {
    return providerManager.imageGen(options)
  })

  // Pull/download a model
  ipcMain.handle('models:pull', async (_, modelId: string) => {
    try {
      const success = await providerManager.pullModel(modelId)
      return { success }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get recommended model for a task
  ipcMain.handle('models:recommend', (_, task: TaskType, preferredProvider?: ProviderType) => {
    return providerManager.getRecommendedModel(task, preferredProvider)
  })

  // Refresh provider status
  ipcMain.handle('models:refresh', async () => {
    const status = await providerManager.initialize(hardwareInfo.tier.name as HardwareTier)
    mainWindow?.webContents.send('models:status', status)
    return status
  })

  // Get model status (downloaded, loaded, etc.)
  ipcMain.handle('models:get-status', async (_, modelId: string) => {
    return providerManager.getModelStatus(modelId)
  })

  // Delete a model
  ipcMain.handle('models:delete', async (_, modelId: string) => {
    try {
      const success = await providerManager.deleteModel(modelId)
      return { success }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Load a model into memory
  ipcMain.handle('models:load', async (_, modelId: string) => {
    try {
      const success = await providerManager.loadModel(modelId)
      return { success }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Unload a model from memory
  ipcMain.handle('models:unload', async (_, modelId: string) => {
    try {
      const success = await providerManager.unloadModel(modelId)
      return { success }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get loaded models
  ipcMain.handle('models:loaded', () => {
    return providerManager.getLoadedModels()
  })

  // Get model registry
  ipcMain.handle('models:registry', () => {
    return providerManager.getRegistry()
  })

  // Get models for a specific task
  ipcMain.handle('models:for-task', async (_, task: TaskType) => {
    return providerManager.getModelsForTask(task)
  })

  // Add custom model
  ipcMain.handle('models:add-custom', async (_, config: CustomModelConfig) => {
    try {
      providerManager.addCustomModel(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // System Stats API (system.*)
  // ============================================

  ipcMain.handle('system:stats', async () => {
    return providerManager.getSystemStats()
  })

  // ============================================
  // LEGACY: Ollama-specific API (for backwards compatibility)
  // ============================================

  ipcMain.handle('ollama:status', () => {
    return providerManager.getOllamaProvider().getLegacyStatus()
  })

  ipcMain.handle('ollama:check-connection', async () => {
    const ollamaProvider = providerManager.getOllamaProvider()
    await ollamaProvider.start()
    const status = ollamaProvider.getLegacyStatus()
    mainWindow?.webContents.send('ollama:status-change', status)
    // Also update unified status
    mainWindow?.webContents.send('models:status', providerManager.getStatus())
    return status
  })

  ipcMain.handle('ollama:list', async () => {
    const ollamaProvider = providerManager.getOllamaProvider()
    const status = ollamaProvider.getLegacyStatus()

    if (status.status === 'error') {
      return {
        models: [],
        status: status.status,
        error: status.error || 'Ollama is not available'
      }
    }

    const models = await ollamaProvider.listModels()
    return {
      models: models.map(m => ({
        name: m.name,
        size: m.size,
        digest: '',
        modified_at: ''
      })),
      status: 'ready'
    }
  })

  ipcMain.handle('ollama:pull', async (_, model: string) => {
    const modelId = model.includes(':') ? model : `ollama:${model}`
    try {
      const success = await providerManager.pullModel(modelId)
      return { success }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('ollama:generate', async (_, opts: {
    model: string
    prompt: string
    images?: string[]
    stream?: boolean
  }) => {
    const result = await providerManager.generate({
      model: opts.model.includes(':') ? opts.model : `ollama:${opts.model}`,
      prompt: opts.prompt,
      images: opts.images
    })
    // Convert to legacy format
    return {
      model: result.model,
      created_at: new Date().toISOString(),
      response: result.response,
      done: result.done,
      total_duration: result.totalDuration
    }
  })

  ipcMain.handle('ollama:chat', async (_, opts: {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }>
  }) => {
    const result = await providerManager.chat({
      model: opts.model.includes(':') ? opts.model : `ollama:${opts.model}`,
      messages: opts.messages
    })
    // Convert to legacy format
    return {
      model: result.model,
      created_at: new Date().toISOString(),
      message: result.message,
      done: result.done,
      total_duration: result.totalDuration,
      eval_count: result.evalCount
    }
  })

  // ============================================
  // Dialogs
  // ============================================

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

  // Initialize hardware detector
  hardwareDetector = new HardwareDetector()

  // Initialize services FIRST (hardware detection + provider initialization)
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
  await providerManager.cleanup()
})
