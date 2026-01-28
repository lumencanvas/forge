/**
 * SILO Model Provider Manager
 * Orchestrates multiple model backends with intelligent routing
 */

import type {
  ModelProvider,
  ProviderType,
  ProviderStatus,
  AllProvidersStatus,
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
  ImageGenOptions,
  ImageGenResponse,
  ModelPullProgress,
  SystemStats,
  LoadedModel,
  CustomModelConfig,
  ModelRegistryEntry
} from './types'
import { TRANSFORMERS_MODELS, HUGGINGFACE_MODELS } from './types'
import { OllamaProvider } from './ollama'
import { TransformersProvider } from './transformers'
import { HuggingFaceProvider } from './huggingface'
import { getResourceManager, ResourceManager } from './resources'

export class ModelProviderManager {
  private providers: Map<ProviderType, ModelProvider> = new Map()
  private preferredOrder: ProviderType[] = ['ollama', 'transformers', 'huggingface']
  private currentTier: HardwareTier = 'STEADY'
  private onPullProgress?: (progress: ModelPullProgress) => void
  private resourceManager: ResourceManager

  constructor() {
    // Initialize all providers
    this.providers.set('ollama', new OllamaProvider())
    this.providers.set('transformers', new TransformersProvider())
    this.providers.set('huggingface', new HuggingFaceProvider())

    // Initialize resource manager
    this.resourceManager = getResourceManager()
  }

  /**
   * Initialize all providers and check their availability
   */
  async initialize(tier?: HardwareTier): Promise<AllProvidersStatus> {
    if (tier) {
      this.currentTier = tier
    }

    console.log('[ProviderManager] Initializing providers...')

    // Check all providers in parallel
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([type, provider]) => {
        try {
          const available = await provider.checkAvailability()
          if (available) {
            await provider.listModels()
          }
          console.log(`[ProviderManager] ${type}: ${available ? 'available' : 'unavailable'}`)
          return { type, available }
        } catch (error) {
          console.error(`[ProviderManager] Error checking ${type}:`, error)
          return { type, available: false }
        }
      })
    )

    return this.getStatus()
  }

  /**
   * Get status of all providers
   */
  getStatus(): AllProvidersStatus {
    const providers: ProviderStatus[] = []
    let hasAvailable = false
    let recommendedProvider: ProviderType | null = null

    for (const type of this.preferredOrder) {
      const provider = this.providers.get(type)
      if (provider) {
        const status = provider.getStatus()
        providers.push(status)

        if (status.status === 'available') {
          hasAvailable = true
          if (!recommendedProvider) {
            recommendedProvider = type
          }
        }
      }
    }

    return {
      providers,
      hasAvailableProvider: hasAvailable,
      recommendedProvider
    }
  }

  /**
   * Get a specific provider
   */
  getProvider(type: ProviderType): ModelProvider | undefined {
    return this.providers.get(type)
  }

  /**
   * Get the Ollama provider (for legacy compatibility)
   */
  getOllamaProvider(): OllamaProvider {
    return this.providers.get('ollama') as OllamaProvider
  }

  /**
   * Get the Transformers provider
   */
  getTransformersProvider(): TransformersProvider {
    return this.providers.get('transformers') as unknown as TransformersProvider
  }

  /**
   * Get the HuggingFace provider
   */
  getHuggingFaceProvider(): HuggingFaceProvider {
    return this.providers.get('huggingface') as HuggingFaceProvider
  }

  /**
   * Find the best available provider for a task
   */
  async getBestProviderForTask(task: TaskType): Promise<ModelProvider | null> {
    for (const type of this.preferredOrder) {
      const provider = this.providers.get(type)
      if (provider && provider.supportsTask(task)) {
        const available = await provider.checkAvailability()
        if (available) {
          return provider
        }
      }
    }
    return null
  }

  /**
   * Get best model for a task across all providers
   */
  getRecommendedModel(task: TaskType, preferredProvider?: ProviderType): ModelInfo | null {
    // If preferred provider specified, try it first
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider)
      if (provider) {
        const model = provider.getRecommendedModel(task, this.currentTier)
        if (model) return model
      }
    }

    // Try providers in preference order
    for (const type of this.preferredOrder) {
      const provider = this.providers.get(type)
      if (provider) {
        const status = provider.getStatus()
        if (status.status === 'available') {
          const model = provider.getRecommendedModel(task, this.currentTier)
          if (model) return model
        }
      }
    }

    return null
  }

  /**
   * List all models from all providers
   */
  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = []

    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels()
        allModels.push(...models)
      } catch (error) {
        console.error(`[ProviderManager] Error listing models from ${provider.type}:`, error)
      }
    }

    return allModels
  }

  /**
   * Get models that support a specific task
   */
  async getModelsForTask(task: TaskType): Promise<ModelInfo[]> {
    const allModels = await this.listAllModels()
    return allModels.filter(m => m.capabilities.includes(task))
  }

  /**
   * Get the model registry (all built-in models)
   */
  getRegistry(): ModelRegistryEntry[] {
    const registry: ModelRegistryEntry[] = []

    // Add Transformers models
    for (const model of TRANSFORMERS_MODELS) {
      registry.push({
        id: model.id,
        name: model.name,
        provider: 'transformers',
        huggingFaceId: model.huggingFaceId,
        tasks: model.capabilities,
        pipelineType: model.pipeline,
        sizeBytes: model.sizeBytes,
        sizeLabel: model.sizeLabel,
        tier: model.tier,
        isBuiltIn: true,
        description: model.description
      })
    }

    // Add HuggingFace models
    registry.push(...HUGGINGFACE_MODELS)

    return registry
  }

  /**
   * Unified chat function - routes to best available provider
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Determine which provider to use
    let provider: ModelProvider | null = null

    if (request.preferredProvider) {
      provider = this.providers.get(request.preferredProvider) || null
      if (provider) {
        const available = await provider.checkAvailability()
        if (!available) provider = null
      }
    }

    // If model is specified, extract provider from model ID
    if (!provider && request.model) {
      const [providerType] = request.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
        const available = await provider.checkAvailability()
        if (!available) provider = null
      }
    }

    // Fall back to best available
    if (!provider) {
      provider = await this.getBestProviderForTask('chat')
    }

    if (!provider) {
      throw new Error('No available provider for chat. Please install Ollama or wait for built-in models to load.')
    }

    return provider.chat(request)
  }

  /**
   * Unified generate function
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    let provider: ModelProvider | null = null

    if (options.preferredProvider) {
      provider = this.providers.get(options.preferredProvider) || null
      if (provider) {
        const available = await provider.checkAvailability()
        if (!available) provider = null
      }
    }

    if (!provider && options.model) {
      const [providerType] = options.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
        const available = await provider.checkAvailability()
        if (!available) provider = null
      }
    }

    if (!provider) {
      provider = await this.getBestProviderForTask('generate')
    }

    if (!provider) {
      throw new Error('No available provider for generation.')
    }

    return provider.generate(options)
  }

  /**
   * Unified embed function
   */
  async embed(options: EmbedOptions): Promise<EmbedResponse> {
    let provider: ModelProvider | null = null

    if (options.preferredProvider) {
      provider = this.providers.get(options.preferredProvider) || null
    }

    if (!provider && options.model) {
      const [providerType] = options.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
      }
    }

    if (!provider) {
      provider = await this.getBestProviderForTask('embed')
    }

    if (!provider || !provider.embed) {
      throw new Error('No available provider for embeddings.')
    }

    return provider.embed(options)
  }

  /**
   * Unified vision function
   */
  async vision(options: VisionOptions): Promise<VisionResponse> {
    let provider: ModelProvider | null = null

    if (options.preferredProvider) {
      provider = this.providers.get(options.preferredProvider) || null
    }

    if (!provider && options.model) {
      const [providerType] = options.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
      }
    }

    if (!provider) {
      provider = await this.getBestProviderForTask(options.task)
    }

    if (!provider || !provider.vision) {
      throw new Error(`No available provider for vision task: ${options.task}`)
    }

    return provider.vision(options)
  }

  /**
   * Unified audio function
   */
  async audio(options: AudioOptions): Promise<AudioResponse> {
    let provider: ModelProvider | null = null

    if (options.preferredProvider) {
      provider = this.providers.get(options.preferredProvider) || null
    }

    if (!provider && options.model) {
      const [providerType] = options.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
      }
    }

    if (!provider) {
      provider = await this.getBestProviderForTask(options.task)
    }

    if (!provider || !provider.audio) {
      throw new Error(`No available provider for audio task: ${options.task}`)
    }

    return provider.audio(options)
  }

  /**
   * Unified image generation function
   */
  async imageGen(options: ImageGenOptions): Promise<ImageGenResponse> {
    let provider: ModelProvider | null = null

    if (options.preferredProvider) {
      provider = this.providers.get(options.preferredProvider) || null
    }

    if (!provider && options.model) {
      const [providerType] = options.model.split(':')
      if (providerType && this.providers.has(providerType as ProviderType)) {
        provider = this.providers.get(providerType as ProviderType)!
      }
    }

    if (!provider) {
      // Only HuggingFace supports image generation currently
      provider = this.providers.get('huggingface') || null
    }

    if (!provider || !provider.imageGen) {
      throw new Error('No available provider for image generation. Please configure HuggingFace API key.')
    }

    return provider.imageGen(options)
  }

  /**
   * Pull a model from any provider
   */
  async pullModel(
    modelId: string,
    onProgress?: (progress: ModelPullProgress) => void
  ): Promise<boolean> {
    // Determine provider from model ID
    const [providerType] = modelId.split(':')
    const provider = this.providers.get(providerType as ProviderType)

    if (!provider || !provider.pullModel) {
      throw new Error(`Cannot pull model: unknown provider ${providerType}`)
    }

    return provider.pullModel(modelId, onProgress || this.onPullProgress)
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId: string): Promise<boolean> {
    const [providerType] = modelId.split(':')
    const provider = this.providers.get(providerType as ProviderType)

    if (!provider || !provider.deleteModel) {
      throw new Error(`Cannot delete model: provider ${providerType} does not support deletion`)
    }

    return provider.deleteModel(modelId)
  }

  /**
   * Load a model into memory
   */
  async loadModel(modelId: string): Promise<boolean> {
    const [providerType] = modelId.split(':')
    const provider = this.providers.get(providerType as ProviderType)

    if (!provider || !provider.loadModel) {
      throw new Error(`Cannot load model: provider ${providerType} does not support loading`)
    }

    return provider.loadModel(modelId)
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(modelId: string): Promise<boolean> {
    const [providerType] = modelId.split(':')
    const provider = this.providers.get(providerType as ProviderType)

    if (!provider || !provider.unloadModel) {
      throw new Error(`Cannot unload model: provider ${providerType} does not support unloading`)
    }

    return provider.unloadModel(modelId)
  }

  /**
   * Get list of loaded models
   */
  getLoadedModels(): LoadedModel[] {
    return this.resourceManager.getLoadedModels()
  }

  /**
   * Get system stats (CPU, GPU, RAM)
   */
  async getSystemStats(): Promise<SystemStats> {
    return this.resourceManager.getSystemStats()
  }

  /**
   * Get model status (installed, loaded, etc.)
   */
  async getModelStatus(modelId: string): Promise<{
    exists: boolean
    isDownloaded: boolean
    isLoaded: boolean
    memoryUsage?: number
  }> {
    const [providerType] = modelId.split(':')
    const provider = this.providers.get(providerType as ProviderType)

    if (!provider) {
      return { exists: false, isDownloaded: false, isLoaded: false }
    }

    const isLoaded = this.resourceManager.isModelLoaded(modelId)
    const memoryUsage = isLoaded ? this.resourceManager.getModelMemoryUsage(modelId) : undefined

    // Check if downloaded (provider-specific)
    let isDownloaded = isLoaded // If loaded, it's downloaded

    if (!isDownloaded && providerType === 'transformers') {
      const transformers = provider as unknown as TransformersProvider
      isDownloaded = await transformers.isModelDownloaded(modelId)
    }

    return {
      exists: true,
      isDownloaded,
      isLoaded,
      memoryUsage
    }
  }

  /**
   * Add a custom model
   */
  addCustomModel(config: CustomModelConfig): void {
    if (config.provider === 'transformers') {
      const transformers = this.getTransformersProvider()
      transformers.addCustomModel(config)
    }
    // HuggingFace models can be used directly via model ID
  }

  /**
   * Set the pull progress callback
   */
  setPullProgressCallback(callback: (progress: ModelPullProgress) => void): void {
    this.onPullProgress = callback
  }

  /**
   * Set the hardware tier for model recommendations
   */
  setTier(tier: HardwareTier): void {
    this.currentTier = tier
  }

  /**
   * Get current hardware tier
   */
  getTier(): HardwareTier {
    return this.currentTier
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop Ollama if we started it
    const ollama = this.getOllamaProvider()
    await ollama.stop()

    // Cleanup transformers pipelines
    const transformers = this.getTransformersProvider()
    transformers.cleanupOldPipelines(0) // Unload all

    // Clear resource manager
    this.resourceManager.clear()
  }
}

// Singleton instance
let managerInstance: ModelProviderManager | null = null

export function getModelProviderManager(): ModelProviderManager {
  if (!managerInstance) {
    managerInstance = new ModelProviderManager()
  }
  return managerInstance
}
