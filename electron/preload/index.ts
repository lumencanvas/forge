/**
 * SILO Preload Script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Types for IPC
export interface GenerateOptions {
  model: string
  prompt: string
  images?: string[]
  stream?: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface ChatOptions {
  model: string
  messages: ChatMessage[]
}

export interface Progress {
  phase: string
  current: number
  total: number
  file?: string
}

export interface PullProgress {
  model: string
  progress: number
}

export interface OllamaStatusInfo {
  status: 'idle' | 'starting' | 'ready' | 'error'
  error: string | null
  isReady: boolean
}

// Settings types
export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  defaultLanguageModel: string
  defaultVisionModel: string
  defaultAudioModel: string
  sendOnEnter: boolean
  showTimestamps: boolean
  chatHistoryPath: string
  pipelinesPath: string
  maxChatHistory: number
  telemetryEnabled: boolean
  setupComplete: boolean
  setupVersion: number
}

export interface StoredChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
  timestamp: number
  model?: string
}

export interface StoredChat {
  id: string
  title: string
  messages: StoredChatMessage[]
  model: string
  pipelineId?: string
  createdAt: number
  updatedAt: number
}

// API exposed to renderer
const siloAPI = {
  // Hardware
  hardware: {
    detect: () => ipcRenderer.invoke('hardware:detect'),
    onInfo: (callback: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(data)
      ipcRenderer.on('hardware:info', handler)
      return () => ipcRenderer.removeListener('hardware:info', handler)
    }
  },

  // Ollama
  ollama: {
    getStatus: (): Promise<OllamaStatusInfo> => ipcRenderer.invoke('ollama:status'),
    checkConnection: (): Promise<OllamaStatusInfo> => ipcRenderer.invoke('ollama:check-connection'),
    listModels: () => ipcRenderer.invoke('ollama:list'),
    pullModel: (model: string) => ipcRenderer.invoke('ollama:pull', model),
    generate: (opts: GenerateOptions) => ipcRenderer.invoke('ollama:generate', opts),
    chat: (opts: ChatOptions) => ipcRenderer.invoke('ollama:chat', opts),
    onPullProgress: (callback: (data: PullProgress) => void) => {
      const handler = (_: unknown, data: PullProgress) => callback(data)
      ipcRenderer.on('ollama:pull-progress', handler)
      return () => ipcRenderer.removeListener('ollama:pull-progress', handler)
    },
    onStatusChange: (callback: (data: OllamaStatusInfo) => void) => {
      const handler = (_: unknown, data: OllamaStatusInfo) => callback(data)
      ipcRenderer.on('ollama:status-change', handler)
      return () => ipcRenderer.removeListener('ollama:status-change', handler)
    }
  },

  // File dialogs
  files: {
    selectFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    selectFolder: () => ipcRenderer.invoke('dialog:openFolder')
  },

  // Shell operations
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
  },

  // Settings
  settings: {
    get: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> =>
      ipcRenderer.invoke('settings:get', key),
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    getAll: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getAll'),
    setAll: (settings: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke('settings:setAll', settings),
    reset: (): Promise<void> => ipcRenderer.invoke('settings:reset')
  },

  // Chats
  chats: {
    getAll: (): Promise<StoredChat[]> => ipcRenderer.invoke('chats:getAll'),
    get: (id: string): Promise<StoredChat | undefined> => ipcRenderer.invoke('chats:get', id),
    save: (chat: StoredChat): Promise<void> => ipcRenderer.invoke('chats:save', chat),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('chats:delete', id),
    clear: (): Promise<void> => ipcRenderer.invoke('chats:clear')
  },

  // Data export/import
  data: {
    export: (): Promise<{ settings: AppSettings; chats: StoredChat[] }> =>
      ipcRenderer.invoke('data:export'),
    import: (data: { settings?: Partial<AppSettings>; chats?: StoredChat[] }): Promise<void> =>
      ipcRenderer.invoke('data:import', data),
    exportToFile: (): Promise<{ success: boolean; path?: string }> =>
      ipcRenderer.invoke('data:exportToFile'),
    importFromFile: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('data:importFromFile')
  },

  // Storage
  storage: {
    getPath: (): Promise<string> => ipcRenderer.invoke('storage:getPath'),
    getUserDataPath: (): Promise<string> => ipcRenderer.invoke('storage:getUserDataPath')
  },

  // Progress events
  onProgress: (callback: (data: Progress) => void) => {
    const handler = (_: unknown, data: Progress) => callback(data)
    ipcRenderer.on('progress', handler)
    return () => ipcRenderer.removeListener('progress', handler)
  },

  // Cleanup helper
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('silo', siloAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.silo = siloAPI
}
