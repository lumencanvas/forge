/**
 * SILO - Setup Store
 * Manages first-run setup wizard state
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { HardwareInfo, OllamaModel } from '../../electron/preload/index.d'

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

  // System checks
  const checks = ref<SystemCheck[]>([
    { name: 'Hardware Detection', status: 'pending', message: 'Detecting hardware capabilities...' },
    { name: 'Ollama Service', status: 'pending', message: 'Checking Ollama installation...' },
    { name: 'Available Models', status: 'pending', message: 'Scanning for installed models...' },
    { name: 'Storage Access', status: 'pending', message: 'Verifying storage permissions...' }
  ])

  // Hardware & models
  const hardwareInfo = ref<HardwareInfo | null>(null)
  const installedModels = ref<OllamaModel[]>([])
  const recommendedModels = ref<string[]>([])

  // Model selection during setup
  const selectedModels = ref<{
    language: string
    vision: string
  }>({
    language: '',
    vision: ''
  })

  // Model pulling state
  const pullingModels = ref<Set<string>>(new Set())
  const pullProgress = ref<Record<string, number>>({})

  // Computed
  const allChecksPassed = computed(() =>
    checks.value.every(c => c.status === 'pass' || c.status === 'warning')
  )

  const hasMinimumModels = computed(() => {
    const models = installedModels.value.map(m => m.name)
    return models.some(m =>
      m.includes('llama') ||
      m.includes('mistral') ||
      m.includes('phi') ||
      m.includes('qwen')
    )
  })

  const isPulling = computed(() => pullingModels.value.size > 0)

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

    // Pre-select first recommended models
    if (recs.language.length > 0) {
      selectedModels.value.language = recs.language[0]!.id
    }
    if (recs.vision.length > 0) {
      selectedModels.value.vision = recs.vision[0]!.id
    }
  }

  function setInstalledModels(models: OllamaModel[]): void {
    installedModels.value = models
  }

  function selectModel(type: 'language' | 'vision', modelId: string): void {
    selectedModels.value = {
      ...selectedModels.value,
      [type]: modelId
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
    selectedModels.value = { language: '', vision: '' }
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
    selectedModels,
    pullingModels,
    pullProgress,
    allChecksPassed,
    hasMinimumModels,
    isPulling,
    show,
    hide,
    nextStep,
    prevStep,
    goToStep,
    updateCheck,
    setHardwareInfo,
    setInstalledModels,
    selectModel,
    startPulling,
    updatePullProgress,
    completePulling,
    reset
  }
})
