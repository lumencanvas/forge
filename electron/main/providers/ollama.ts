/**
 * SILO Ollama Provider
 * Wraps OllamaService to implement ModelProvider interface
 */

import { app } from 'electron'
import type {
  ModelProvider,
  ProviderType,
  ProviderStatus,
  ModelInfo,
  TaskType,
  HardwareTier,
  ChatRequest,
  ChatResponse,
  GenerateOptions,
  GenerateResponse,
  EmbedOptions,
  EmbedResponse,
  ModelPullProgress
} from './types'

// Model recommendations based on hardware tier
export const OLLAMA_MODEL_RECOMMENDATIONS = {
  LEAN: {
    vision: 'moondream',
    language: 'llama3.2:3b'
  },
  STEADY: {
    vision: 'llava:7b',
    language: 'mistral:7b'
  },
  HEAVY: {
    vision: 'llama3.2-vision:11b',
    language: 'qwen2.5:14b'
  },
  SURPLUS: {
    vision: 'llava:34b',
    language: 'deepseek-r1:70b'
  }
} as const

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

export type OllamaStatus = 'idle' | 'starting' | 'ready' | 'error'

export interface OllamaStatusInfo {
  status: OllamaStatus
  error: string | null
  isReady: boolean
}

export class OllamaProvider implements ModelProvider {
  readonly type: ProviderType = 'ollama'
  readonly name = 'Ollama'

  private baseUrl = 'http://localhost:11434'
  private electronOllama: any = null
  private isStarted = false
  private initPromise: Promise<void> | null = null
  private status: OllamaStatus = 'idle'
  private lastError: string | null = null
  private cachedModels: ModelInfo[] = []

  constructor() {
    this.initPromise = this.initElectronOllama()
  }

  private async initElectronOllama(): Promise<void> {
    try {
      const { ElectronOllama } = await import('electron-ollama')
      this.electronOllama = new ElectronOllama({
        basePath: app.getPath('userData'),
        directory: 'ollama'
      })
    } catch (error) {
      console.log('[Ollama] electron-ollama not available, using system Ollama')
    }
  }

  async checkAvailability(): Promise<boolean> {
    if (this.initPromise) {
      await this.initPromise
      this.initPromise = null
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      const isAvailable = response.ok
      this.status = isAvailable ? 'ready' : 'error'
      if (!isAvailable) {
        this.lastError = 'Ollama is not running'
      } else {
        this.lastError = null
      }
      return isAvailable
    } catch {
      this.status = 'error'
      this.lastError = 'Cannot connect to Ollama'
      return false
    }
  }

  getStatus(): ProviderStatus {
    return {
      type: this.type,
      name: this.name,
      status: this.status === 'ready' ? 'available' : 'unavailable',
      error: this.lastError || undefined,
      models: this.cachedModels
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const isAvailable = await this.checkAvailability()
    if (!isAvailable) {
      this.cachedModels = []
      return []
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      const ollamaModels: OllamaModel[] = data.models || []

      this.cachedModels = ollamaModels.map(m => this.convertToModelInfo(m))
      return this.cachedModels
    } catch (error) {
      console.error('[Ollama] Error listing models:', error)
      this.cachedModels = []
      return []
    }
  }

  private convertToModelInfo(model: OllamaModel): ModelInfo {
    const isVision = model.name.includes('llava') ||
                     model.name.includes('vision') ||
                     model.name.includes('moondream')

    const capabilities: TaskType[] = isVision
      ? ['chat', 'generate']
      : ['chat', 'generate', 'embed']

    // Determine tier based on model size
    let tier: HardwareTier = 'LEAN'
    const sizeGB = model.size / (1024 * 1024 * 1024)
    if (sizeGB > 20) tier = 'SURPLUS'
    else if (sizeGB > 8) tier = 'HEAVY'
    else if (sizeGB > 3) tier = 'STEADY'

    return {
      id: `ollama:${model.name}`,
      name: model.name,
      provider: 'ollama',
      size: model.size,
      sizeLabel: this.formatSize(model.size),
      capabilities,
      tier,
      isLocal: true,
      isInstalled: true,
      description: model.details?.family
        ? `${model.details.family} - ${model.details.parameter_size}`
        : undefined
    }
  }

  private formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)}GB`
    const mb = bytes / (1024 * 1024)
    return `${Math.round(mb)}MB`
  }

  supportsTask(task: TaskType): boolean {
    return ['chat', 'generate', 'embed'].includes(task)
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model?.replace('ollama:', '') || 'mistral:7b'

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      model: `ollama:${data.model}`,
      provider: 'ollama',
      message: data.message,
      done: data.done,
      totalDuration: data.total_duration,
      evalCount: data.eval_count
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const model = options.model?.replace('ollama:', '') || 'mistral:7b'

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      stream: false
    }

    if (options.images && options.images.length > 0) {
      body.images = options.images
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      model: `ollama:${data.model}`,
      provider: 'ollama',
      response: data.response,
      done: data.done,
      totalDuration: data.total_duration
    }
  }

  async embed(options: EmbedOptions): Promise<EmbedResponse> {
    const model = options.model?.replace('ollama:', '') || 'nomic-embed-text'
    const texts = Array.isArray(options.text) ? options.text : [options.text]

    const embeddings: number[][] = []

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text })
      })

      if (!response.ok) {
        throw new Error(`Ollama embeddings failed: ${response.status}`)
      }

      const data = await response.json()
      embeddings.push(data.embedding)
    }

    return {
      model: `ollama:${model}`,
      provider: 'ollama',
      embeddings
    }
  }

  async pullModel(
    modelId: string,
    onProgress?: (progress: ModelPullProgress) => void
  ): Promise<boolean> {
    const model = modelId.replace('ollama:', '')

    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true })
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let lastProgress = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.total && data.completed) {
              const progress = Math.round((data.completed / data.total) * 100)
              if (progress !== lastProgress) {
                lastProgress = progress
                onProgress?.({
                  model: modelId,
                  provider: 'ollama',
                  progress,
                  status: 'downloading'
                })
              }
            }
            if (data.status === 'success') {
              onProgress?.({
                model: modelId,
                provider: 'ollama',
                progress: 100,
                status: 'complete'
              })
            }
          } catch {
            // Ignore parse errors for partial lines
          }
        }
      }

      // Refresh models after pull
      await this.listModels()
      return true
    } catch (error) {
      console.error('[Ollama] Error pulling model:', error)
      onProgress?.({
        model: modelId,
        provider: 'ollama',
        progress: 0,
        status: 'error',
        error: String(error)
      })
      return false
    }
  }

  getRecommendedModel(task: TaskType, tier: HardwareTier): ModelInfo | null {
    const recs = OLLAMA_MODEL_RECOMMENDATIONS[tier]
    const modelName = task === 'embed'
      ? 'nomic-embed-text'
      : recs.language

    // Check if we have it installed
    const installed = this.cachedModels.find(m =>
      m.name === modelName || m.name.startsWith(modelName + ':')
    )

    if (installed) return installed

    // Return as not-installed model info
    return {
      id: `ollama:${modelName}`,
      name: modelName,
      provider: 'ollama',
      size: 0,
      sizeLabel: 'Unknown',
      capabilities: task === 'embed' ? ['embed'] : ['chat', 'generate'],
      tier,
      isLocal: true,
      isInstalled: false
    }
  }

  // Legacy compatibility methods

  async start(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
      this.initPromise = null
    }

    if (this.isStarted && this.status === 'ready') return

    this.status = 'starting'
    this.lastError = null

    if (await this.checkAvailability()) {
      console.log('[Ollama] Using existing Ollama instance')
      this.isStarted = true
      return
    }

    if (this.electronOllama) {
      try {
        const metadata = await this.electronOllama.getMetadata('latest')
        await this.electronOllama.serve(metadata.version, {
          serverLog: (msg: string) => console.log('[Ollama]', msg),
          downloadLog: (pct: number, msg: string) => console.log(`[Ollama Download] ${pct}%`, msg)
        })
        this.isStarted = true
        this.status = 'ready'
        console.log('[Ollama] Bundled Ollama started')
        return
      } catch (error) {
        console.error('[Ollama] Failed to start bundled Ollama:', error)
      }
    }

    this.status = 'error'
    this.lastError = 'Ollama is not available. Please install Ollama from https://ollama.com'
    console.log('[Ollama] Not available:', this.lastError)
  }

  async stop(): Promise<void> {
    if (this.electronOllama && this.isStarted) {
      try {
        await this.electronOllama.stop()
      } catch (error) {
        console.error('[Ollama] Error stopping:', error)
      }
    }
    this.isStarted = false
  }

  getLegacyStatus(): OllamaStatusInfo {
    return {
      status: this.status,
      error: this.lastError,
      isReady: this.status === 'ready'
    }
  }

  async waitForReady(timeoutMs = 30000): Promise<boolean> {
    if (this.status === 'ready') return true

    const startTime = Date.now()
    let delay = 500
    const maxDelay = 4000

    while (Date.now() - startTime < timeoutMs) {
      if (await this.checkAvailability()) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 1.5, maxDelay)
    }

    return false
  }
}
