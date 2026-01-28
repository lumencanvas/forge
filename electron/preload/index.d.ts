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
  reservePath: string
  maxChatHistory: number
  telemetryEnabled: boolean
  setupComplete: boolean
  setupVersion: number
  huggingfaceApiKey?: string
  defaultModelsByTask?: Partial<Record<TaskType, string>>
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

export interface ModelsAPI {
  getStatus: () => Promise<AllProvidersStatus>
  list: () => Promise<ModelInfo[]>
  chat: (request: ModelChatRequest) => Promise<ModelChatResponse>
  generate: (options: ModelGenerateOptions) => Promise<ModelGenerateResponse>
  embed: (options: ModelEmbedOptions) => Promise<ModelEmbedResponse>
  vision: (options: VisionOptions) => Promise<VisionResponse>
  audio: (options: AudioOptions) => Promise<AudioResponse>
  imageGen: (options: ImageGenOptions) => Promise<ImageGenResponse>
  pull: (modelId: string) => Promise<{ success: boolean; error?: string }>
  recommend: (task: TaskType, preferredProvider?: ProviderType) => Promise<ModelInfo | null>
  refresh: () => Promise<AllProvidersStatus>
  getModelStatus: (modelId: string) => Promise<ModelStatus>
  deleteModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
  loadModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
  unloadModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
  getLoadedModels: () => Promise<LoadedModel[]>
  getRegistry: () => Promise<ModelRegistryEntry[]>
  getModelsForTask: (task: TaskType) => Promise<ModelInfo[]>
  addCustomModel: (config: CustomModelConfig) => Promise<{ success: boolean; error?: string }>
  onStatusChange: (callback: (status: AllProvidersStatus) => void) => () => void
  onPullProgress: (callback: (progress: ModelPullProgress) => void) => () => void
}

export interface SystemAPI {
  getStats: () => Promise<SystemStats>
  onStatsUpdate: (callback: (stats: SystemStats) => void) => () => void
}

export interface SiloAPI {
  hardware: {
    detect: () => Promise<HardwareInfo>
    onInfo: (callback: (data: HardwareInfo) => void) => () => void
  }
  models: ModelsAPI
  system: SystemAPI
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
