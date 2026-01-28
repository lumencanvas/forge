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

// Model Provider Types
export type ProviderType = 'ollama' | 'transformers' | 'huggingface'

export type TaskType =
  | 'chat'
  | 'generate'
  | 'summarize'
  | 'translate'
  | 'question-answering'
  | 'zero-shot-classification'
  | 'text-classification'
  | 'token-classification'
  | 'image-classification'
  | 'object-detection'
  | 'image-segmentation'
  | 'depth-estimation'
  | 'image-to-text'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'audio-classification'
  | 'embed'
  | 'text-to-image'
  | 'classify'

export type HardwareTier = 'LEAN' | 'STEADY' | 'HEAVY' | 'SURPLUS'

export interface ModelInfo {
  id: string
  name: string
  provider: ProviderType
  size: number
  sizeLabel: string
  capabilities: TaskType[]
  tier: HardwareTier
  isLocal: boolean
  isInstalled: boolean
  description?: string
  huggingFaceId?: string
}

export interface ProviderStatus {
  type: ProviderType
  name: string
  status: 'available' | 'unavailable' | 'checking' | 'downloading'
  error?: string
  models: ModelInfo[]
  downloadProgress?: number
}

export interface AllProvidersStatus {
  providers: ProviderStatus[]
  hasAvailableProvider: boolean
  recommendedProvider: ProviderType | null
}

export interface ModelChatRequest {
  messages: ChatMessage[]
  model?: string
  preferredProvider?: ProviderType
}

export interface ModelChatResponse {
  model: string
  provider: ProviderType
  message: ChatMessage
  done: boolean
  totalDuration?: number
  evalCount?: number
}

export interface ModelGenerateOptions {
  prompt: string
  model?: string
  preferredProvider?: ProviderType
  images?: string[]
  maxTokens?: number
  temperature?: number
}

export interface ModelGenerateResponse {
  model: string
  provider: ProviderType
  response: string
  done: boolean
  totalDuration?: number
}

export interface ModelEmbedOptions {
  text: string | string[]
  model?: string
  preferredProvider?: ProviderType
}

export interface ModelEmbedResponse {
  model: string
  provider: ProviderType
  embeddings: number[][]
}

// Vision types
export interface VisionOptions {
  image: string
  model?: string
  preferredProvider?: ProviderType
  task: 'image-classification' | 'object-detection' | 'image-segmentation' | 'depth-estimation' | 'image-to-text'
}

export interface ImageClassificationResult {
  label: string
  score: number
}

export interface ObjectDetectionResult {
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}

export interface VisionResponse {
  model: string
  provider: ProviderType
  task: string
  results: ImageClassificationResult[] | ObjectDetectionResult[] | string | unknown
}

// Audio types
export interface AudioOptions {
  audio: ArrayBuffer | string
  model?: string
  preferredProvider?: ProviderType
  task: 'speech-to-text' | 'audio-classification'
}

export interface SpeechToTextResult {
  text: string
  chunks?: Array<{ text: string; timestamp: [number, number] }>
}

export interface AudioResponse {
  model: string
  provider: ProviderType
  task: string
  result: SpeechToTextResult | unknown
}

// Image generation types
export interface ImageGenOptions {
  prompt: string
  model?: string
  preferredProvider?: ProviderType
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
}

export interface ImageGenResponse {
  model: string
  provider: ProviderType
  image: string
}

export interface ModelPullProgress {
  model: string
  provider: ProviderType
  progress: number
  status: 'downloading' | 'verifying' | 'complete' | 'error'
  error?: string
}

// System stats types
export interface SystemStats {
  cpu: {
    usage: number
    temperature?: number
  }
  memory: {
    total: number
    used: number
    free: number
  }
  gpu?: {
    usage: number
    memory: number
    memoryTotal?: number
    temperature?: number
    name?: string
  }
}

export interface LoadedModel {
  id: string
  provider: ProviderType
  loadedAt: number
  lastUsed: number
  memoryUsage: number
}

export interface ModelRegistryEntry {
  id: string
  name: string
  provider: ProviderType
  huggingFaceId?: string
  tasks: TaskType[]
  pipelineType?: string
  sizeBytes?: number
  sizeLabel?: string
  tier: HardwareTier
  isBuiltIn: boolean
  description?: string
}

export interface CustomModelConfig {
  huggingFaceId: string
  name: string
  tasks: TaskType[]
  pipelineType?: string
  provider: 'transformers' | 'huggingface'
}

export interface ModelStatus {
  exists: boolean
  isDownloaded: boolean
  isLoaded: boolean
  memoryUsage?: number
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
  huggingfaceApiKey?: string
  defaultModelsByTask?: Record<TaskType, string>
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

  // ============================================
  // Unified Model Provider API
  // ============================================
  models: {
    // Get status of all providers
    getStatus: (): Promise<AllProvidersStatus> => ipcRenderer.invoke('models:status'),

    // List all models from all providers
    list: (): Promise<ModelInfo[]> => ipcRenderer.invoke('models:list'),

    // Unified chat
    chat: (request: ModelChatRequest): Promise<ModelChatResponse> =>
      ipcRenderer.invoke('models:chat', request),

    // Unified generate
    generate: (options: ModelGenerateOptions): Promise<ModelGenerateResponse> =>
      ipcRenderer.invoke('models:generate', options),

    // Unified embeddings
    embed: (options: ModelEmbedOptions): Promise<ModelEmbedResponse> =>
      ipcRenderer.invoke('models:embed', options),

    // Vision tasks (image classification, object detection, etc.)
    vision: (options: VisionOptions): Promise<VisionResponse> =>
      ipcRenderer.invoke('models:vision', options),

    // Audio tasks (speech-to-text, etc.)
    audio: (options: AudioOptions): Promise<AudioResponse> =>
      ipcRenderer.invoke('models:audio', options),

    // Image generation
    imageGen: (options: ImageGenOptions): Promise<ImageGenResponse> =>
      ipcRenderer.invoke('models:image-gen', options),

    // Pull/download a model
    pull: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:pull', modelId),

    // Get recommended model for a task
    recommend: (task: TaskType, preferredProvider?: ProviderType): Promise<ModelInfo | null> =>
      ipcRenderer.invoke('models:recommend', task, preferredProvider),

    // Refresh provider status
    refresh: (): Promise<AllProvidersStatus> => ipcRenderer.invoke('models:refresh'),

    // Get model status (downloaded, loaded, etc.)
    getModelStatus: (modelId: string): Promise<ModelStatus> =>
      ipcRenderer.invoke('models:get-status', modelId),

    // Delete a model
    deleteModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:delete', modelId),

    // Load a model into memory
    loadModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:load', modelId),

    // Unload a model from memory
    unloadModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:unload', modelId),

    // Get loaded models
    getLoadedModels: (): Promise<LoadedModel[]> =>
      ipcRenderer.invoke('models:loaded'),

    // Get model registry
    getRegistry: (): Promise<ModelRegistryEntry[]> =>
      ipcRenderer.invoke('models:registry'),

    // Get models for a specific task
    getModelsForTask: (task: TaskType): Promise<ModelInfo[]> =>
      ipcRenderer.invoke('models:for-task', task),

    // Add custom model
    addCustomModel: (config: CustomModelConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:add-custom', config),

    // Listen for provider status changes
    onStatusChange: (callback: (status: AllProvidersStatus) => void) => {
      const handler = (_: unknown, data: AllProvidersStatus) => callback(data)
      ipcRenderer.on('models:status', handler)
      return () => ipcRenderer.removeListener('models:status', handler)
    },

    // Listen for pull progress
    onPullProgress: (callback: (progress: ModelPullProgress) => void) => {
      const handler = (_: unknown, data: ModelPullProgress) => callback(data)
      ipcRenderer.on('models:pull-progress', handler)
      return () => ipcRenderer.removeListener('models:pull-progress', handler)
    }
  },

  // ============================================
  // System Stats API
  // ============================================
  system: {
    // Get current system stats (CPU, GPU, RAM)
    getStats: (): Promise<SystemStats> => ipcRenderer.invoke('system:stats'),

    // Listen for system stats updates (if implemented)
    onStatsUpdate: (callback: (stats: SystemStats) => void) => {
      const handler = (_: unknown, data: SystemStats) => callback(data)
      ipcRenderer.on('system:stats-update', handler)
      return () => ipcRenderer.removeListener('system:stats-update', handler)
    }
  },

  // ============================================
  // LEGACY: Ollama API (for backwards compatibility)
  // ============================================
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
