/**
 * SILO - Setup Store
 * Manages first-run setup wizard state with multi-backend support
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  HardwareInfo,
  OllamaModel,
  ProviderType,
  ModelInfo,
  AllProvidersStatus
} from '../../electron/preload/index.d'

export type SetupStep = 'welcome' | 'system-check' | 'model-select' | 'complete'

export interface SystemCheck {
  name: string
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning'
  message: string
  details?: string
}

export const useSetupStore = defineStore('setup', () => {
  const currentStep = ref<SetupStep>('welcome')
  const isVisible = ref(false)

  // System checks - updated for multi-backend
  const checks = ref<SystemCheck[]>([
    { name: 'Hardware Detection', status: 'pending', message: 'Detecting hardware capabilities...' },
    { name: 'Built-in Models', status: 'pending', message: 'Checking built-in AI models...' },
    { name: 'Ollama Service', status: 'pending', message: 'Checking Ollama installation...' },
    { name: 'Storage Access', status: 'pending', message: 'Verifying storage permissions...' }
  ])

  // Hardware & models
  const hardwareInfo = ref<HardwareInfo | null>(null)
  const installedModels = ref<OllamaModel[]>([])
  const recommendedModels = ref<string[]>([])

  // Provider status
  const providersStatus = ref<AllProvidersStatus | null>(null)
  const allAvailableModels = ref<ModelInfo[]>([])

  // Model selection during setup
  const selectedModels = ref<{
    language: string
    vision: string
    provider: ProviderType
  }>({
    language: '',
    vision: '',
    provider: 'transformers' // Default to built-in models
  })

  // Model pulling state
  const pullingModels = ref<Set<string>>(new Set())
  const pullProgress = ref<Record<string, number>>({})

  // Computed - updated for multi-backend
  const allChecksPassed = computed(() => {
    // Must pass: Hardware Detection, Built-in Models, Storage Access
    // Optional: Ollama Service (warning is OK)
    return checks.value.every(c => {
      if (c.name === 'Ollama Service') {
        // Ollama is optional - warning or pass is fine
        return c.status === 'pass' || c.status === 'warning'
      }
      return c.status === 'pass' || c.status === 'warning'
    })
  })

  const hasAnyProvider = computed(() =>
    providersStatus.value?.hasAvailableProvider ?? false
  )

  const hasOllama = computed(() => {
    const ollama = providersStatus.value?.providers.find(p => p.type === 'ollama')
    return ollama?.status === 'available'
  })

  const hasTransformers = computed(() => {
    const transformers = providersStatus.value?.providers.find(p => p.type === 'transformers')
    return transformers?.status === 'available'
  })

  const hasMinimumModels = computed(() => {
    // Has models from any provider
    return allAvailableModels.value.length > 0 || installedModels.value.length > 0
  })

  const isPulling = computed(() => pullingModels.value.size > 0)

  // Built-in models (Transformers.js) - these are always available
  const builtInModels = computed(() =>
    allAvailableModels.value.filter(m => m.provider === 'transformers')
  )

  // Ollama models
  const ollamaModels = computed(() =>
    allAvailableModels.value.filter(m => m.provider === 'ollama')
  )

  // Actions
  function show(): void {
    isVisible.value = true
    currentStep.value = 'welcome'
  }

  function hide(): void {
    isVisible.value = false
  }

  function nextStep(): void {
    const steps: SetupStep[] = ['welcome', 'system-check', 'model-select', 'complete']
    const currentIndex = steps.indexOf(currentStep.value)
    if (currentIndex < steps.length - 1) {
      currentStep.value = steps[currentIndex + 1]!
    }
  }

  function prevStep(): void {
    const steps: SetupStep[] = ['welcome', 'system-check', 'model-select', 'complete']
    const currentIndex = steps.indexOf(currentStep.value)
    if (currentIndex > 0) {
      currentStep.value = steps[currentIndex - 1]!
    }
  }

  function goToStep(step: SetupStep): void {
    currentStep.value = step
  }

  function updateCheck(name: string, update: Partial<SystemCheck>): void {
    checks.value = checks.value.map(c =>
      c.name === name ? { ...c, ...update } : c
    )
  }

  function setHardwareInfo(info: HardwareInfo): void {
    hardwareInfo.value = info

    // Set recommended models based on tier
    const recs = info.recommendations.models
    recommendedModels.value = [
      ...recs.language.map(m => m.id),
      ...recs.vision.map(m => m.id)
    ]

    // Pre-select first recommended models (prefer built-in initially)
    if (hasTransformers.value && builtInModels.value.length > 0) {
      const builtInLanguage = builtInModels.value.find(m =>
        m.capabilities.includes('chat') || m.capabilities.includes('generate')
      )
      if (builtInLanguage) {
        selectedModels.value.language = builtInLanguage.id
        selectedModels.value.provider = 'transformers'
      }
    } else if (recs.language.length > 0) {
      selectedModels.value.language = recs.language[0]!.id
      selectedModels.value.provider = 'ollama'
    }

    if (recs.vision.length > 0) {
      selectedModels.value.vision = recs.vision[0]!.id
    }
  }

  function setProvidersStatus(status: AllProvidersStatus): void {
    providersStatus.value = status
  }

  function setAllAvailableModels(models: ModelInfo[]): void {
    allAvailableModels.value = models
  }

  function setInstalledModels(models: OllamaModel[]): void {
    installedModels.value = models
  }

  function selectModel(type: 'language' | 'vision', modelId: string): void {
    selectedModels.value = {
      ...selectedModels.value,
      [type]: modelId
    }

    // Update provider based on selected model
    const model = allAvailableModels.value.find(m => m.id === modelId)
    if (model) {
      selectedModels.value.provider = model.provider
    }
  }

  function selectProvider(provider: ProviderType): void {
    selectedModels.value.provider = provider

    // Auto-select best model from this provider
    const providerModels = allAvailableModels.value.filter(m => m.provider === provider)
    const languageModel = providerModels.find(m =>
      m.capabilities.includes('chat') || m.capabilities.includes('generate')
    )
    if (languageModel) {
      selectedModels.value.language = languageModel.id
    }
  }

  function startPulling(model: string): void {
    pullingModels.value = new Set([...pullingModels.value, model])
    pullProgress.value = { ...pullProgress.value, [model]: 0 }
  }

  function updatePullProgress(model: string, progress: number): void {
    pullProgress.value = { ...pullProgress.value, [model]: progress }
  }

  function completePulling(model: string): void {
    pullingModels.value = new Set([...pullingModels.value].filter(m => m !== model))
    const { [model]: _, ...rest } = pullProgress.value
    pullProgress.value = rest
  }

  function reset(): void {
    currentStep.value = 'welcome'
    checks.value = checks.value.map(c => ({ ...c, status: 'pending' }))
    hardwareInfo.value = null
    installedModels.value = []
    providersStatus.value = null
    allAvailableModels.value = []
    selectedModels.value = { language: '', vision: '', provider: 'transformers' }
    pullingModels.value = new Set()
    pullProgress.value = {}
  }

  return {
    currentStep,
    isVisible,
    checks,
    hardwareInfo,
    installedModels,
    recommendedModels,
    providersStatus,
    allAvailableModels,
    selectedModels,
    pullingModels,
    pullProgress,
    allChecksPassed,
    hasAnyProvider,
    hasOllama,
    hasTransformers,
    hasMinimumModels,
    isPulling,
    builtInModels,
    ollamaModels,
    show,
    hide,
    nextStep,
    prevStep,
    goToStep,
    updateCheck,
    setHardwareInfo,
    setProvidersStatus,
    setAllAvailableModels,
    setInstalledModels,
    selectModel,
    selectProvider,
    startPulling,
    updatePullProgress,
    completePulling,
    reset
  }
})
