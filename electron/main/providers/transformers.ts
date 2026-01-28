/**
 * SILO Transformers.js Provider
 * Runs small models locally without external dependencies
 * Supports text, vision, audio, and embedding tasks
 */

import { app } from 'electron'
import { join } from 'path'
import { readFile, rm, readdir } from 'fs/promises'
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
  VisionOptions,
  VisionResponse,
  AudioOptions,
  AudioResponse,
  ModelPullProgress,
  TransformersModelConfig,
  CustomModelConfig
} from './types'
import { TRANSFORMERS_MODELS } from './types'
import { getResourceManager } from './resources'

// Dynamic import for transformers
let pipeline: any = null
let env: any = null
let RawImage: any = null

async function loadTransformers() {
  if (pipeline) return { pipeline, env, RawImage }

  try {
    const transformers = await import('@xenova/transformers')
    pipeline = transformers.pipeline
    env = transformers.env
    RawImage = transformers.RawImage

    // Configure cache directory
    const cachePath = join(app.getPath('userData'), 'transformers-cache')
    env.cacheDir = cachePath
    env.localModelPath = cachePath

    // Disable remote model loading warning
    env.allowRemoteModels = true

    console.log('[Transformers] Loaded, cache dir:', cachePath)
    return { pipeline, env, RawImage }
  } catch (error) {
    console.error('[Transformers] Failed to load:', error)
    throw error
  }
}

interface PipelineInstance {
  model: string
  pipeline: any
  pipelineType: string
  lastUsed: number
}

export class TransformersProvider implements ModelProvider {
  readonly type: ProviderType = 'transformers'
  readonly name = 'Built-in Models'

  private pipelines: Map<string, PipelineInstance> = new Map()
  private isAvailable = false
  private lastError: string | null = null
  private downloadingModels: Set<string> = new Set()
  private downloadProgress: Map<string, number> = new Map()
  private customModels: TransformersModelConfig[] = []

  async checkAvailability(): Promise<boolean> {
    try {
      await loadTransformers()
      this.isAvailable = true
      this.lastError = null
      return true
    } catch (error) {
      this.isAvailable = false
      this.lastError = error instanceof Error ? error.message : 'Failed to load transformers'
      return false
    }
  }

  getStatus(): ProviderStatus {
    // Build model list with download status
    const models = this.getAvailableModels()

    return {
      type: this.type,
      name: this.name,
      status: this.isAvailable ? 'available' : 'unavailable',
      error: this.lastError || undefined,
      models
    }
  }

  private getAllModels(): TransformersModelConfig[] {
    return [...TRANSFORMERS_MODELS, ...this.customModels]
  }

  private getAvailableModels(): ModelInfo[] {
    return this.getAllModels().map(config => ({
      id: config.id,
      name: config.name,
      provider: 'transformers',
      size: config.sizeBytes,
      sizeLabel: config.sizeLabel,
      capabilities: config.capabilities,
      tier: config.tier,
      isLocal: true,
      isInstalled: this.pipelines.has(config.id),
      description: config.description,
      huggingFaceId: config.huggingFaceId
    }))
  }

  async listModels(): Promise<ModelInfo[]> {
    await this.checkAvailability()
    return this.getAvailableModels()
  }

  supportsTask(task: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'chat', 'generate', 'embed', 'summarize', 'classify',
      'image-classification', 'object-detection', 'depth-estimation', 'image-to-text',
      'speech-to-text', 'text-classification', 'zero-shot-classification',
      'translate', 'question-answering'
    ]
    return supportedTasks.includes(task)
  }

  private getModelConfig(modelId: string): TransformersModelConfig | undefined {
    const id = modelId.startsWith('transformers:') ? modelId : `transformers:${modelId}`
    const config = this.getAllModels().find(m => m.id === id)

    if (!config) {
      // Try to find by huggingFaceId as fallback
      const byHfId = this.getAllModels().find(m => m.huggingFaceId === modelId)
      if (byHfId) return byHfId
    }

    return config
  }

  /**
   * Get the default model for chat tasks
   */
  getDefaultChatModel(): TransformersModelConfig | undefined {
    // Prefer instruction-tuned models for chat
    const chatModels = this.getAllModels().filter(m =>
      m.capabilities.includes('chat') || m.capabilities.includes('generate')
    )
    // Prefer smaller models that are more likely to work
    return chatModels.find(m => m.tier === 'LEAN') || chatModels[0]
  }

  private async getPipeline(
    modelId: string,
    onProgress?: (progress: ModelPullProgress) => void
  ): Promise<any> {
    const config = this.getModelConfig(modelId)
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    // Check if already loaded
    const cached = this.pipelines.get(config.id)
    if (cached) {
      cached.lastUsed = Date.now()
      // Track usage in resource manager
      const resourceManager = getResourceManager()
      resourceManager.trackModelUsed(config.id)
      return cached.pipeline
    }

    // Load transformers
    const { pipeline: pipelineFactory } = await loadTransformers()

    // Report download start
    this.downloadingModels.add(config.id)
    onProgress?.({
      model: config.id,
      provider: 'transformers',
      progress: 0,
      status: 'downloading'
    })

    try {
      // Create pipeline (this downloads the model if needed)
      const pipelineInstance = await pipelineFactory(config.pipeline, config.huggingFaceId, {
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.total) {
            const pct = Math.round((progress.loaded / progress.total) * 100)
            this.downloadProgress.set(config.id, pct)
            onProgress?.({
              model: config.id,
              provider: 'transformers',
              progress: pct,
              status: 'downloading'
            })
          }
        }
      })

      // Cache the pipeline
      this.pipelines.set(config.id, {
        model: config.id,
        pipeline: pipelineInstance,
        pipelineType: config.pipeline,
        lastUsed: Date.now()
      })

      // Track in resource manager
      const resourceManager = getResourceManager()
      resourceManager.trackModelLoaded(config.id, 'transformers', config.sizeBytes)

      // Report complete
      this.downloadingModels.delete(config.id)
      this.downloadProgress.delete(config.id)
      onProgress?.({
        model: config.id,
        provider: 'transformers',
        progress: 100,
        status: 'complete'
      })

      return pipelineInstance
    } catch (error) {
      this.downloadingModels.delete(config.id)
      onProgress?.({
        model: config.id,
        provider: 'transformers',
        progress: 0,
        status: 'error',
        error: String(error)
      })
      throw error
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert chat to generate with formatted prompt
    const modelId = request.model || 'transformers:flan-t5-small'
    let config = this.getModelConfig(modelId)

    if (!config) {
      // Try to fall back to default chat model
      config = this.getDefaultChatModel()
      if (!config) {
        const availableModels = this.getAllModels().map(m => m.name).join(', ')
        throw new Error(`Model "${modelId}" not found. Available models: ${availableModels}`)
      }
      console.log(`[Transformers] Model "${modelId}" not found, falling back to ${config.name}`)
    }

    // Format messages into a prompt
    let prompt = ''
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n`
      } else if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`
      }
    }
    prompt += 'Assistant:'

    const pipe = await this.getPipeline(modelId)
    const startTime = Date.now()

    let result: string

    if (config.pipeline === 'text2text-generation') {
      // For T5-style models, use the last user message as input
      const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user')
      const input = lastUserMsg?.content || prompt
      const output = await pipe(input, {
        max_new_tokens: 256,
        temperature: 0.7
      })
      result = output[0]?.generated_text || output[0]?.text || ''
    } else {
      // For GPT-style models
      const output = await pipe(prompt, {
        max_new_tokens: 256,
        temperature: 0.7,
        do_sample: true
      })
      result = output[0]?.generated_text || ''
      // Remove the prompt from the output
      if (result.startsWith(prompt)) {
        result = result.slice(prompt.length).trim()
      }
    }

    return {
      model: config.id,
      provider: 'transformers',
      message: {
        role: 'assistant',
        content: result
      },
      done: true,
      totalDuration: Date.now() - startTime
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const modelId = options.model || 'transformers:flan-t5-small'
    const config = this.getModelConfig(modelId)

    if (!config) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    const pipe = await this.getPipeline(modelId)
    const startTime = Date.now()

    let result: string

    if (config.pipeline === 'text2text-generation') {
      const output = await pipe(options.prompt, {
        max_new_tokens: options.maxTokens || 256,
        temperature: options.temperature || 0.7
      })
      result = output[0]?.generated_text || output[0]?.text || ''
    } else if (config.pipeline === 'summarization') {
      const output = await pipe(options.prompt, {
        max_length: options.maxTokens || 150,
        min_length: 30
      })
      result = output[0]?.summary_text || ''
    } else {
      const output = await pipe(options.prompt, {
        max_new_tokens: options.maxTokens || 256,
        temperature: options.temperature || 0.7,
        do_sample: true
      })
      result = output[0]?.generated_text || ''
      // Remove prompt from output for GPT-style models
      if (result.startsWith(options.prompt)) {
        result = result.slice(options.prompt.length).trim()
      }
    }

    return {
      model: config.id,
      provider: 'transformers',
      response: result,
      done: true,
      totalDuration: Date.now() - startTime
    }
  }

  async embed(options: EmbedOptions): Promise<EmbedResponse> {
    const modelId = options.model || 'transformers:all-MiniLM-L6-v2'
    const config = this.getModelConfig(modelId)

    if (!config || !config.capabilities.includes('embed')) {
      throw new Error(`Model ${modelId} does not support embeddings`)
    }

    const pipe = await this.getPipeline(modelId)
    const texts = Array.isArray(options.text) ? options.text : [options.text]

    const embeddings: number[][] = []

    for (const text of texts) {
      const output = await pipe(text, { pooling: 'mean', normalize: true })
      // Convert to regular array
      embeddings.push(Array.from(output.data))
    }

    return {
      model: config.id,
      provider: 'transformers',
      embeddings
    }
  }

  /**
   * Run a vision task
   */
  async vision(options: VisionOptions): Promise<VisionResponse> {
    // Select appropriate model based on task if not specified
    let modelId = options.model
    if (!modelId) {
      const taskModelMap: Record<string, string> = {
        'image-classification': 'transformers:vit-base-patch16-224',
        'object-detection': 'transformers:yolos-tiny',
        'depth-estimation': 'transformers:depth-anything-small',
        'image-to-text': 'transformers:vit-gpt2-image-captioning'
      }
      modelId = taskModelMap[options.task] || 'transformers:vit-base-patch16-224'
    }

    const config = this.getModelConfig(modelId)
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    const pipe = await this.getPipeline(modelId)

    // Process image input
    let imageInput = options.image

    // If it's a file path, read it
    if (!imageInput.startsWith('data:') && !imageInput.startsWith('http')) {
      try {
        const imageBuffer = await readFile(imageInput)
        const base64 = imageBuffer.toString('base64')
        const ext = imageInput.split('.').pop()?.toLowerCase() || 'png'
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        }
        imageInput = `data:${mimeMap[ext] || 'image/png'};base64,${base64}`
      } catch {
        // Assume it's already usable
      }
    }

    let results: any

    switch (options.task) {
      case 'image-classification': {
        const output = await pipe(imageInput)
        results = output.map((r: any) => ({
          label: r.label,
          score: Math.round(r.score * 1000) / 1000
        }))
        break
      }

      case 'object-detection': {
        const output = await pipe(imageInput)
        results = output.map((r: any) => ({
          label: r.label,
          score: Math.round(r.score * 1000) / 1000,
          box: r.box
        }))
        break
      }

      case 'depth-estimation': {
        const output = await pipe(imageInput)
        // Returns a depth map - convert to base64 image
        if (output.depth) {
          const depthImage = output.depth.toCanvas()
          results = depthImage.toDataURL('image/png')
        } else {
          results = output
        }
        break
      }

      case 'image-to-text': {
        const output = await pipe(imageInput)
        results = output[0]?.generated_text || ''
        break
      }

      default:
        throw new Error(`Unsupported vision task: ${options.task}`)
    }

    return {
      model: config.id,
      provider: 'transformers',
      task: options.task,
      results
    }
  }

  /**
   * Run an audio task
   */
  async audio(options: AudioOptions): Promise<AudioResponse> {
    // Select appropriate model based on task if not specified
    let modelId = options.model
    if (!modelId) {
      const taskModelMap: Record<string, string> = {
        'speech-to-text': 'transformers:whisper-tiny.en',
        'audio-classification': 'transformers:whisper-tiny.en'
      }
      modelId = taskModelMap[options.task] || 'transformers:whisper-tiny.en'
    }

    const config = this.getModelConfig(modelId)
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    const pipe = await this.getPipeline(modelId)

    // Process audio input
    let audioInput: ArrayBuffer | Float32Array

    if (typeof options.audio === 'string') {
      // It's a file path
      const audioBuffer = await readFile(options.audio)
      audioInput = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      )
    } else {
      audioInput = options.audio
    }

    let result: any

    switch (options.task) {
      case 'speech-to-text': {
        const output = await pipe(audioInput, {
          return_timestamps: true
        })
        result = {
          text: output.text,
          chunks: output.chunks?.map((c: any) => ({
            text: c.text,
            timestamp: c.timestamp
          }))
        }
        break
      }

      case 'audio-classification': {
        const output = await pipe(audioInput)
        result = output
        break
      }

      default:
        throw new Error(`Unsupported audio task: ${options.task}`)
    }

    return {
      model: config.id,
      provider: 'transformers',
      task: options.task,
      result
    }
  }

  async pullModel(
    modelId: string,
    onProgress?: (progress: ModelPullProgress) => void
  ): Promise<boolean> {
    try {
      // getPipeline handles the download
      await this.getPipeline(modelId, onProgress)
      return true
    } catch (error) {
      console.error('[Transformers] Error pulling model:', error)
      return false
    }
  }

  /**
   * Delete a downloaded model from disk
   */
  async deleteModel(modelId: string): Promise<boolean> {
    const config = this.getModelConfig(modelId)
    if (!config) {
      return false
    }

    try {
      // Unload first if loaded
      await this.unloadModel(modelId)

      // Get the cache directory
      const { env } = await loadTransformers()
      const cacheDir = env.cacheDir

      // Try to find and delete the model files
      // Models are usually stored as: cacheDir/models--{org}--{model}
      const modelPath = config.huggingFaceId.replace('/', '--')
      const fullPath = join(cacheDir, `models--${modelPath}`)

      try {
        await rm(fullPath, { recursive: true, force: true })
        console.log(`[Transformers] Deleted model: ${modelId}`)
        return true
      } catch {
        // Directory might not exist or be named differently
        console.warn(`[Transformers] Could not find model directory: ${fullPath}`)
        return false
      }
    } catch (error) {
      console.error('[Transformers] Error deleting model:', error)
      return false
    }
  }

  /**
   * Load a model into memory
   */
  async loadModel(modelId: string): Promise<boolean> {
    try {
      await this.getPipeline(modelId)
      return true
    } catch {
      return false
    }
  }

  getRecommendedModel(task: TaskType, tier: HardwareTier): ModelInfo | null {
    // Find best model for task and tier
    const candidates = this.getAllModels().filter(m => {
      // Must support the task
      if (!m.capabilities.includes(task)) return false

      // Must be at or below the tier
      const tierOrder: HardwareTier[] = ['LEAN', 'STEADY', 'HEAVY', 'SURPLUS']
      const modelTierIndex = tierOrder.indexOf(m.tier)
      const userTierIndex = tierOrder.indexOf(tier)
      return modelTierIndex <= userTierIndex
    })

    if (candidates.length === 0) return null

    // Prefer higher tier models (better quality) within user's capability
    const tierOrder: HardwareTier[] = ['LEAN', 'STEADY', 'HEAVY', 'SURPLUS']
    candidates.sort((a, b) => {
      return tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier)
    })

    const config = candidates[0]!
    return {
      id: config.id,
      name: config.name,
      provider: 'transformers',
      size: config.sizeBytes,
      sizeLabel: config.sizeLabel,
      capabilities: config.capabilities,
      tier: config.tier,
      isLocal: true,
      isInstalled: this.pipelines.has(config.id),
      description: config.description,
      huggingFaceId: config.huggingFaceId
    }
  }

  /**
   * Unload a pipeline to free memory
   */
  async unloadModel(modelId: string): Promise<boolean> {
    const id = modelId.startsWith('transformers:') ? modelId : `transformers:${modelId}`
    const existed = this.pipelines.delete(id)

    if (existed) {
      // Track in resource manager
      const resourceManager = getResourceManager()
      resourceManager.trackModelUnloaded(id)
    }

    return existed
  }

  /**
   * Unload least recently used pipelines to free memory
   */
  cleanupOldPipelines(maxAge = 5 * 60 * 1000): void {
    const now = Date.now()
    for (const [id, instance] of this.pipelines) {
      if (now - instance.lastUsed > maxAge) {
        console.log('[Transformers] Unloading idle model:', id)
        this.pipelines.delete(id)

        // Track in resource manager
        const resourceManager = getResourceManager()
        resourceManager.trackModelUnloaded(id)
      }
    }
  }

  /**
   * Add a custom model to the registry
   */
  addCustomModel(config: CustomModelConfig): TransformersModelConfig {
    const modelConfig: TransformersModelConfig = {
      id: `transformers:${config.huggingFaceId}`,
      huggingFaceId: config.huggingFaceId,
      name: config.name,
      sizeBytes: 0, // Unknown until downloaded
      sizeLabel: 'Unknown',
      capabilities: config.tasks,
      tier: 'STEADY', // Default tier
      description: `Custom model: ${config.huggingFaceId}`,
      pipeline: config.pipelineType || 'text-generation'
    }

    this.customModels.push(modelConfig)
    return modelConfig
  }

  /**
   * Get list of loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.pipelines.keys())
  }

  /**
   * Check if model is downloaded (has cached files)
   */
  async isModelDownloaded(modelId: string): Promise<boolean> {
    const config = this.getModelConfig(modelId)
    if (!config) return false

    try {
      const { env } = await loadTransformers()
      const cacheDir = env.cacheDir
      const modelPath = config.huggingFaceId.replace('/', '--')
      const fullPath = join(cacheDir, `models--${modelPath}`)

      const files = await readdir(fullPath)
      return files.length > 0
    } catch {
      return false
    }
  }
}
