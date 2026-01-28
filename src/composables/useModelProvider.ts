/**
 * SILO - useModelProvider Composable
 * Unified Vue composable for multi-backend model access
 */

import { ref, computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue'
import type {
  ProviderType,
  TaskType,
  ModelInfo,
  ProviderStatus,
  AllProvidersStatus,
  ModelChatRequest,
  ModelChatResponse,
  ModelGenerateOptions,
  ModelGenerateResponse,
  ModelEmbedOptions,
  ModelEmbedResponse,
  ModelPullProgress,
  VisionOptions,
  VisionResponse,
  AudioOptions,
  AudioResponse,
  ImageGenOptions,
  ImageGenResponse,
  SystemStats,
  LoadedModel,
  ModelRegistryEntry,
  CustomModelConfig,
  ModelStatus
} from '../../electron/preload/index.d'

export function useModelProvider() {
  // State
  const providersStatus = shallowRef<AllProvidersStatus | null>(null)
  const allModels = shallowRef<ModelInfo[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pullProgress = ref<ModelPullProgress | null>(null)
  const systemStats = ref<SystemStats | null>(null)
  const loadedModels = ref<LoadedModel[]>([])
  const registry = shallowRef<ModelRegistryEntry[]>([])

  // Cleanup functions
  let cleanupStatusChange: (() => void) | undefined
  let cleanupPullProgress: (() => void) | undefined
  let cleanupStatsUpdate: (() => void) | undefined

  // Computed
  const providers = computed(() => providersStatus.value?.providers || [])

  const hasAvailableProvider = computed(() =>
    providersStatus.value?.hasAvailableProvider ?? false
  )

  const recommendedProvider = computed(() =>
    providersStatus.value?.recommendedProvider ?? null
  )

  const isReady = computed(() => hasAvailableProvider.value)

  const ollamaStatus = computed(() => {
    const ollama = providers.value.find(p => p.type === 'ollama')
    return ollama?.status ?? 'unavailable'
  })

  const transformersStatus = computed(() => {
    const transformers = providers.value.find(p => p.type === 'transformers')
    return transformers?.status ?? 'unavailable'
  })

  const huggingfaceStatus = computed(() => {
    const hf = providers.value.find(p => p.type === 'huggingface')
    return hf?.status ?? 'unavailable'
  })

  const ollamaModels = computed(() =>
    allModels.value.filter(m => m.provider === 'ollama')
  )

  const transformersModels = computed(() =>
    allModels.value.filter(m => m.provider === 'transformers')
  )

  const huggingfaceModels = computed(() =>
    allModels.value.filter(m => m.provider === 'huggingface')
  )

  const installedModels = computed(() =>
    allModels.value.filter(m => m.isInstalled)
  )

  const availableModels = computed(() =>
    allModels.value.filter(m => {
      const provider = providers.value.find(p => p.type === m.provider)
      return provider?.status === 'available'
    })
  )

  // Group models by provider for UI
  const modelsByProvider = computed(() => {
    const grouped: Record<ProviderType, ModelInfo[]> = {
      ollama: [],
      transformers: [],
      huggingface: []
    }

    for (const model of allModels.value) {
      grouped[model.provider].push(model)
    }

    return grouped
  })

  // Group models by task
  const modelsByTask = computed(() => {
    const grouped: Record<string, ModelInfo[]> = {}

    for (const model of allModels.value) {
      for (const capability of model.capabilities) {
        if (!grouped[capability]) {
          grouped[capability] = []
        }
        grouped[capability].push(model)
      }
    }

    return grouped
  })

  // Memory usage computed
  const totalMemoryUsage = computed(() => {
    return loadedModels.value.reduce((sum, m) => sum + m.memoryUsage, 0)
  })

  const memoryUsagePercent = computed(() => {
    if (!systemStats.value?.memory.total) return 0
    return Math.round((systemStats.value.memory.used / systemStats.value.memory.total) * 100)
  })

  // Actions
  async function refreshStatus(): Promise<AllProvidersStatus | null> {
    isLoading.value = true
    error.value = null

    try {
      const status = await window.silo.models.refresh()
      providersStatus.value = status
      return status
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh status'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function listModels(): Promise<ModelInfo[]> {
    isLoading.value = true
    error.value = null

    try {
      const models = await window.silo.models.list()
      allModels.value = models
      return models
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to list models'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function chat(request: ModelChatRequest): Promise<ModelChatResponse> {
    if (!hasAvailableProvider.value) {
      throw new Error('No model provider available. Please wait for providers to initialize.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.chat(request)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Chat failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function generate(options: ModelGenerateOptions): Promise<ModelGenerateResponse> {
    if (!hasAvailableProvider.value) {
      throw new Error('No model provider available. Please wait for providers to initialize.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.generate(options)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Generation failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function embed(options: ModelEmbedOptions): Promise<ModelEmbedResponse> {
    if (!hasAvailableProvider.value) {
      throw new Error('No model provider available. Please wait for providers to initialize.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.embed(options)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Embedding failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function vision(options: VisionOptions): Promise<VisionResponse> {
    if (!hasAvailableProvider.value) {
      throw new Error('No model provider available. Please wait for providers to initialize.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.vision(options)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Vision task failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function audio(options: AudioOptions): Promise<AudioResponse> {
    if (!hasAvailableProvider.value) {
      throw new Error('No model provider available. Please wait for providers to initialize.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.audio(options)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Audio task failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function imageGen(options: ImageGenOptions): Promise<ImageGenResponse> {
    isLoading.value = true
    error.value = null

    try {
      return await window.silo.models.imageGen(options)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Image generation failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function pullModel(modelId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    pullProgress.value = {
      model: modelId,
      provider: modelId.split(':')[0] as ProviderType,
      progress: 0,
      status: 'downloading'
    }

    try {
      const result = await window.silo.models.pull(modelId)
      if (!result.success) {
        error.value = result.error || 'Failed to download model'
        return false
      }
      // Refresh models after pull
      await listModels()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to download model'
      return false
    } finally {
      isLoading.value = false
      pullProgress.value = null
    }
  }

  async function deleteModel(modelId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const result = await window.silo.models.deleteModel(modelId)
      if (!result.success) {
        error.value = result.error || 'Failed to delete model'
        return false
      }
      // Refresh models after delete
      await listModels()
      await refreshLoadedModels()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete model'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function loadModel(modelId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const result = await window.silo.models.loadModel(modelId)
      if (!result.success) {
        error.value = result.error || 'Failed to load model'
        return false
      }
      await refreshLoadedModels()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load model'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function unloadModel(modelId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const result = await window.silo.models.unloadModel(modelId)
      if (!result.success) {
        error.value = result.error || 'Failed to unload model'
        return false
      }
      await refreshLoadedModels()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to unload model'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function getModelStatus(modelId: string): Promise<ModelStatus | null> {
    try {
      return await window.silo.models.getModelStatus(modelId)
    } catch {
      return null
    }
  }

  async function getRecommendedModel(
    task: TaskType,
    preferredProvider?: ProviderType
  ): Promise<ModelInfo | null> {
    try {
      return await window.silo.models.recommend(task, preferredProvider)
    } catch {
      return null
    }
  }

  async function getModelsForTask(task: TaskType): Promise<ModelInfo[]> {
    try {
      return await window.silo.models.getModelsForTask(task)
    } catch {
      return []
    }
  }

  async function addCustomModel(config: CustomModelConfig): Promise<boolean> {
    try {
      const result = await window.silo.models.addCustomModel(config)
      if (result.success) {
        await listModels()
        await refreshRegistry()
      }
      return result.success
    } catch {
      return false
    }
  }

  async function refreshRegistry(): Promise<void> {
    try {
      registry.value = await window.silo.models.getRegistry()
    } catch {
      // Ignore errors
    }
  }

  async function refreshLoadedModels(): Promise<void> {
    try {
      loadedModels.value = await window.silo.models.getLoadedModels()
    } catch {
      // Ignore errors
    }
  }

  async function refreshSystemStats(): Promise<void> {
    try {
      systemStats.value = await window.silo.system.getStats()
    } catch {
      // Ignore errors
    }
  }

  function getProviderStatus(type: ProviderType): ProviderStatus | null {
    return providers.value.find(p => p.type === type) || null
  }

  function hasModel(modelId: string): boolean {
    return allModels.value.some(m =>
      m.id === modelId || m.name === modelId || m.id.endsWith(`:${modelId}`)
    )
  }

  function isModelInstalled(modelId: string): boolean {
    const model = allModels.value.find(m =>
      m.id === modelId || m.name === modelId || m.id.endsWith(`:${modelId}`)
    )
    return model?.isInstalled ?? false
  }

  function isModelLoaded(modelId: string): boolean {
    return loadedModels.value.some(m => m.id === modelId)
  }

  // Format bytes to human-readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // Lifecycle
  onMounted(async () => {
    if (typeof window !== 'undefined' && window.silo?.models) {
      // Listen for status changes
      cleanupStatusChange = window.silo.models.onStatusChange((status) => {
        providersStatus.value = status
      })

      // Listen for pull progress
      cleanupPullProgress = window.silo.models.onPullProgress((progress) => {
        pullProgress.value = progress
        if (progress.status === 'complete' || progress.status === 'error') {
          // Refresh models when download completes
          listModels()
        }
      })

      // Listen for system stats updates
      cleanupStatsUpdate = window.silo.system.onStatsUpdate((stats) => {
        systemStats.value = stats
      })

      // Get initial status
      const status = await window.silo.models.getStatus()
      providersStatus.value = status

      // Get initial model list
      await listModels()

      // Get registry
      await refreshRegistry()

      // Get loaded models
      await refreshLoadedModels()

      // Get initial system stats
      await refreshSystemStats()
    }
  })

  onUnmounted(() => {
    cleanupStatusChange?.()
    cleanupPullProgress?.()
    cleanupStatsUpdate?.()
  })

  return {
    // State
    providersStatus: readonly(providersStatus),
    allModels: readonly(allModels),
    isLoading: readonly(isLoading),
    error: readonly(error),
    pullProgress: readonly(pullProgress),
    systemStats: readonly(systemStats),
    loadedModels: readonly(loadedModels),
    registry: readonly(registry),

    // Computed
    providers,
    hasAvailableProvider,
    recommendedProvider,
    isReady,
    ollamaStatus,
    transformersStatus,
    huggingfaceStatus,
    ollamaModels,
    transformersModels,
    huggingfaceModels,
    installedModels,
    availableModels,
    modelsByProvider,
    modelsByTask,
    totalMemoryUsage,
    memoryUsagePercent,

    // Actions
    refreshStatus,
    listModels,
    chat,
    generate,
    embed,
    vision,
    audio,
    imageGen,
    pullModel,
    deleteModel,
    loadModel,
    unloadModel,
    getModelStatus,
    getRecommendedModel,
    getModelsForTask,
    addCustomModel,
    refreshRegistry,
    refreshLoadedModels,
    refreshSystemStats,
    getProviderStatus,
    hasModel,
    isModelInstalled,
    isModelLoaded,
    formatBytes
  }
}
