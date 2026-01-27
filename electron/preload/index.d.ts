import { ElectronAPI } from '@electron-toolkit/preload'

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

export type OllamaStatus = 'idle' | 'starting' | 'ready' | 'error'

export interface OllamaStatusInfo {
  status: OllamaStatus
  error: string | null
  isReady: boolean
}

export interface OllamaListResult {
  models: OllamaModel[]
  status: OllamaStatus
  error?: string
}

export interface HardwareInfo {
  tier: {
    name: string
    level: number
    minRam: number
    minVram: number
  }
  cpu: {
    brand: string
    manufacturer: string
    cores: number
    physicalCores: number
    speed: number
    speedMax: number
  }
  memory: {
    total: number
    free: number
    available: number
  }
  gpu: {
    vendor: string
    name: string
    vram: number
    compute: string | null
  }
  platform: {
    os: string
    arch: string
    release: string
  }
  recommendations: {
    models: {
      vision: Array<{ id: string; size: string; speed: string; tier: string; recommended: boolean }>
      language: Array<{ id: string; size: string; speed: string; tier: string; recommended: boolean }>
      embeddings: Array<{ id: string; size: string; speed: string; tier: string; recommended: boolean }>
      audio: Array<{ id: string; size: string; speed: string; tier: string; recommended: boolean }>
    }
    parallelCapable: boolean
    gpuAccelerated: boolean
    backend: string
  }
}

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
  details?: {
    parameter_size: string
    quantization_level: string
    family: string
  }
}

export interface GenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}

export interface ChatResponse {
  model: string
  created_at: string
  message: ChatMessage
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}

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

export interface SiloAPI {
  hardware: {
    detect: () => Promise<HardwareInfo>
    onInfo: (callback: (data: HardwareInfo) => void) => () => void
  }
  ollama: {
    getStatus: () => Promise<OllamaStatusInfo>
    checkConnection: () => Promise<OllamaStatusInfo>
    listModels: () => Promise<OllamaListResult>
    pullModel: (model: string) => Promise<{ success: boolean; error?: string }>
    generate: (opts: GenerateOptions) => Promise<GenerateResponse>
    chat: (opts: ChatOptions) => Promise<ChatResponse>
    onPullProgress: (callback: (data: PullProgress) => void) => () => void
    onStatusChange: (callback: (data: OllamaStatusInfo) => void) => () => void
  }
  files: {
    selectFiles: () => Promise<string[]>
    selectFolder: () => Promise<string | undefined>
  }
  shell: {
    openPath: (path: string) => Promise<string>
    showItemInFolder: (path: string) => void
  }
  settings: {
    get: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
    getAll: () => Promise<AppSettings>
    setAll: (settings: Partial<AppSettings>) => Promise<void>
    reset: () => Promise<void>
  }
  chats: {
    getAll: () => Promise<StoredChat[]>
    get: (id: string) => Promise<StoredChat | undefined>
    save: (chat: StoredChat) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: () => Promise<void>
  }
  data: {
    export: () => Promise<{ settings: AppSettings; chats: StoredChat[] }>
    import: (data: { settings?: Partial<AppSettings>; chats?: StoredChat[] }) => Promise<void>
    exportToFile: () => Promise<{ success: boolean; path?: string }>
    importFromFile: () => Promise<{ success: boolean }>
  }
  storage: {
    getPath: () => Promise<string>
    getUserDataPath: () => Promise<string>
  }
  onProgress: (callback: (data: Progress) => void) => () => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    silo: SiloAPI
  }
}
