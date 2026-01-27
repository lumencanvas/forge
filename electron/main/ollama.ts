/**
 * SILO Ollama Service
 * Manages Ollama lifecycle and provides API access
 */

import { app } from 'electron'

// Model recommendations based on hardware tier
export const MODEL_RECOMMENDATIONS = {
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
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

export type OllamaStatus = 'idle' | 'starting' | 'ready' | 'error'

export interface OllamaStatusInfo {
  status: OllamaStatus
  error: string | null
  isReady: boolean
}

export class OllamaService {
  private baseUrl = 'http://localhost:11434'
  private electronOllama: any = null
  private isStarted = false
  private initPromise: Promise<void> | null = null
  private status: OllamaStatus = 'idle'
  private lastError: string | null = null

  constructor() {
    // Try to import electron-ollama dynamically
    this.initPromise = this.initElectronOllama()
  }

  getStatus(): OllamaStatusInfo {
    return {
      status: this.status,
      error: this.lastError,
      isReady: this.status === 'ready'
    }
  }

  /**
   * Wait for Ollama to be ready with retry logic and exponential backoff
   */
  async waitForReady(timeoutMs = 30000): Promise<boolean> {
    if (this.status === 'ready') return true
    if (this.status === 'error') return false

    const startTime = Date.now()
    let delay = 500 // Start with 500ms delay
    const maxDelay = 4000 // Max 4 second delay between retries

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isRunning()) {
        this.status = 'ready'
        this.lastError = null
        return true
      }

      // Wait before next retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 1.5, maxDelay)
    }

    return false
  }

  private async initElectronOllama(): Promise<void> {
    try {
      // electron-ollama bundles Ollama with the app
      const { ElectronOllama } = await import('electron-ollama')
      this.electronOllama = new ElectronOllama({
        basePath: app.getPath('userData'),
        directory: 'ollama'
      })
    } catch (error) {
      console.log('[Ollama] electron-ollama not available, using system Ollama')
    }
  }

  async start(): Promise<void> {
    // Wait for initialization to complete
    if (this.initPromise) {
      await this.initPromise
      this.initPromise = null
    }

    if (this.isStarted && this.status === 'ready') return

    this.status = 'starting'
    this.lastError = null

    // First check if Ollama is already running (system install)
    if (await this.isRunning()) {
      console.log('[Ollama] Using existing Ollama instance')
      this.isStarted = true
      this.status = 'ready'
      return
    }

    // Try to start bundled Ollama via electron-ollama
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

    // Ollama not available - set error status but don't throw
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

  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      return response.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<{ models: OllamaModel[]; status: OllamaStatus; error?: string }> {
    // Wait for Ollama to be ready (with shorter timeout for list)
    const ready = await this.waitForReady(10000)
    if (!ready) {
      return {
        models: [],
        status: this.status,
        error: this.lastError || 'Ollama is not available'
      }
    }

    // Retry logic for connection failures
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000)
        })
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }
        const data = await response.json()
        return { ...data, status: 'ready' }
      } catch (error) {
        lastError = error as Error
        console.error(`[Ollama] Error listing models (attempt ${attempt + 1}/${maxRetries}):`, error)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // All retries failed
    this.status = 'error'
    this.lastError = lastError?.message || 'Failed to connect to Ollama'
    return {
      models: [],
      status: this.status,
      error: this.lastError
    }
  }

  async pullModel(
    model: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
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
                onProgress?.(progress)
              }
            }
            if (data.status === 'success') {
              onProgress?.(100)
            }
          } catch {
            // Ignore parse errors for partial lines
          }
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[Ollama] Error pulling model:', error)
      return { success: false, error: String(error) }
    }
  }

  async generate(
    model: string,
    prompt: string,
    images?: string[]
  ): Promise<GenerateResponse> {
    try {
      const body: Record<string, unknown> = {
        model,
        prompt,
        stream: false
      }

      if (images && images.length > 0) {
        body.images = images
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('[Ollama] Error generating:', error)
      throw error
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[]
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('[Ollama] Error in chat:', error)
      throw error
    }
  }

  async embeddings(
    model: string,
    prompt: string
  ): Promise<{ embedding: number[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt })
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('[Ollama] Error generating embeddings:', error)
      throw error
    }
  }

  getRecommendedModels(tier: string): { vision: string; language: string } {
    return MODEL_RECOMMENDATIONS[tier as keyof typeof MODEL_RECOMMENDATIONS] || MODEL_RECOMMENDATIONS.LEAN
  }
}
