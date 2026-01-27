import { ref, onMounted, onUnmounted, readonly } from 'vue'
import type {
  OllamaModel,
  GenerateOptions,
  GenerateResponse,
  ChatOptions,
  ChatResponse,
  PullProgress,
  OllamaStatus,
  OllamaStatusInfo
} from '../../electron/preload/index.d'

export function useOllama() {
  const models = ref<OllamaModel[]>([])
  const isLoading = ref(false)
  const pullProgress = ref<PullProgress | null>(null)
  const error = ref<string | null>(null)
  const status = ref<OllamaStatus>('idle')
  const statusError = ref<string | null>(null)

  let cleanupPullProgress: (() => void) | undefined
  let cleanupStatusChange: (() => void) | undefined

  // Set up listeners when component mounts
  onMounted(async () => {
    if (typeof window !== 'undefined' && window.silo) {
      // Pull progress listener
      cleanupPullProgress = window.silo.ollama.onPullProgress((progress) => {
        pullProgress.value = progress
      })

      // Status change listener
      cleanupStatusChange = window.silo.ollama.onStatusChange((statusInfo) => {
        status.value = statusInfo.status
        statusError.value = statusInfo.error
      })

      // Get initial status
      await checkStatus()
    }
  })

  onUnmounted(() => {
    cleanupPullProgress?.()
    cleanupStatusChange?.()
  })

  async function checkStatus(): Promise<OllamaStatusInfo> {
    try {
      const statusInfo = await window.silo.ollama.getStatus()
      status.value = statusInfo.status
      statusError.value = statusInfo.error
      return statusInfo
    } catch (e) {
      status.value = 'error'
      statusError.value = e instanceof Error ? e.message : 'Failed to get status'
      return { status: 'error', error: statusError.value, isReady: false }
    }
  }

  async function checkConnection(): Promise<OllamaStatusInfo> {
    isLoading.value = true
    try {
      const statusInfo = await window.silo.ollama.checkConnection()
      status.value = statusInfo.status
      statusError.value = statusInfo.error
      return statusInfo
    } catch (e) {
      status.value = 'error'
      statusError.value = e instanceof Error ? e.message : 'Connection check failed'
      return { status: 'error', error: statusError.value, isReady: false }
    } finally {
      isLoading.value = false
    }
  }

  async function listModels(): Promise<OllamaModel[]> {
    isLoading.value = true
    error.value = null

    try {
      const result = await window.silo.ollama.listModels()

      // Update status from result
      if (result.status) {
        status.value = result.status
      }
      if (result.error) {
        statusError.value = result.error
      }

      models.value = result.models
      return result.models
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to list models'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function pullModel(model: string): Promise<boolean> {
    if (status.value !== 'ready') {
      error.value = 'Ollama is not connected. Please set up Ollama first.'
      return false
    }

    isLoading.value = true
    error.value = null
    pullProgress.value = { model, progress: 0 }

    try {
      const result = await window.silo.ollama.pullModel(model)
      if (!result.success) {
        error.value = result.error || 'Failed to pull model'
        return false
      }
      pullProgress.value = null
      // Refresh model list after pull
      await listModels()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to pull model'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function generate(opts: GenerateOptions): Promise<GenerateResponse> {
    if (status.value !== 'ready') {
      throw new Error('Ollama is not connected. Please set up Ollama first.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.ollama.generate(opts)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Generation failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function chat(opts: ChatOptions): Promise<ChatResponse> {
    if (status.value !== 'ready') {
      throw new Error('Ollama is not connected. Please set up Ollama first.')
    }

    isLoading.value = true
    error.value = null

    try {
      return await window.silo.ollama.chat(opts)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Chat failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function hasModel(modelName: string): boolean {
    return models.value.some(m => m.name === modelName || m.name.startsWith(modelName + ':'))
  }

  return {
    models,
    isLoading,
    pullProgress,
    error,
    status: readonly(status),
    statusError: readonly(statusError),
    isReady: () => status.value === 'ready',
    checkStatus,
    checkConnection,
    listModels,
    pullModel,
    generate,
    chat,
    hasModel
  }
}
