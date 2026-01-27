/**
 * SILO - Pipelines Store
 * Manages pipeline definitions and execution state
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { builtinPipelines } from '@/lib/flows/builtin'
import type { Pipeline, PipelineStep } from '@/lib/flows/schema'

export type { Pipeline, PipelineInput, PipelineStep, PipelineCondition } from '@/lib/flows/schema'

export interface PipelineExecutionState {
  pipelineId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  currentStepIndex: number
  stepResults: Record<string, string>
  error?: string
  startedAt?: number
  completedAt?: number
}

function generateId(): string {
  return `pipeline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const usePipelinesStore = defineStore('pipelines', () => {
  // Custom pipelines created by user
  const customPipelines = ref<Pipeline[]>([])

  // Current pipeline being edited
  const editingPipeline = ref<Pipeline | null>(null)

  // Pipeline execution state
  const executionState = ref<PipelineExecutionState | null>(null)

  // Loading states
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const allPipelines = computed(() => [...builtinPipelines, ...customPipelines.value])

  const pipelineById = computed(() => {
    const map = new Map<string, Pipeline>()
    for (const pipeline of allPipelines.value) {
      map.set(pipeline.id, pipeline)
    }
    return map
  })

  const pipelinesByCategory = computed(() => {
    const groups: Record<string, Pipeline[]> = {
      builtin: [],
      custom: []
    }
    for (const pipeline of allPipelines.value) {
      const category = pipeline.category || 'custom'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category]!.push(pipeline)
    }
    return groups
  })

  const isExecuting = computed(() =>
    executionState.value?.status === 'running'
  )

  const currentStep = computed((): PipelineStep | null => {
    if (!executionState.value) return null
    const pipeline = pipelineById.value.get(executionState.value.pipelineId)
    if (!pipeline) return null
    return pipeline.steps[executionState.value.currentStepIndex] || null
  })

  // Actions
  function getPipeline(id: string): Pipeline | undefined {
    return pipelineById.value.get(id)
  }

  function createPipeline(pipeline: Omit<Pipeline, 'id'>): Pipeline {
    const newPipeline: Pipeline = {
      ...pipeline,
      id: generateId(),
      category: 'custom'
    }
    customPipelines.value = [...customPipelines.value, newPipeline]
    return newPipeline
  }

  function updatePipeline(id: string, updates: Partial<Pipeline>): void {
    customPipelines.value = customPipelines.value.map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
  }

  function deletePipeline(id: string): void {
    customPipelines.value = customPipelines.value.filter(p => p.id !== id)
  }

  function duplicatePipeline(id: string): Pipeline | null {
    const original = getPipeline(id)
    if (!original) return null

    return createPipeline({
      ...original,
      name: `${original.name} (Copy)`,
      category: 'custom'
    })
  }

  // Editing
  function startEditing(pipeline: Pipeline): void {
    editingPipeline.value = { ...pipeline }
  }

  function updateEditingPipeline(updates: Partial<Pipeline>): void {
    if (editingPipeline.value) {
      editingPipeline.value = { ...editingPipeline.value, ...updates }
    }
  }

  function saveEditingPipeline(): Pipeline | null {
    if (!editingPipeline.value) return null

    const pipeline = editingPipeline.value
    if (pipeline.category === 'builtin') {
      // Can't edit built-in pipelines, create a copy
      const newPipeline = createPipeline({
        ...pipeline,
        name: `${pipeline.name} (Custom)`,
        category: 'custom'
      })
      editingPipeline.value = null
      return newPipeline
    }

    // Check if it exists
    const existing = customPipelines.value.find(p => p.id === pipeline.id)
    if (existing) {
      updatePipeline(pipeline.id, pipeline)
    } else {
      customPipelines.value = [...customPipelines.value, pipeline]
    }

    editingPipeline.value = null
    return pipeline
  }

  function cancelEditing(): void {
    editingPipeline.value = null
  }

  // Execution
  function startExecution(pipelineId: string): void {
    executionState.value = {
      pipelineId,
      status: 'running',
      currentStepIndex: 0,
      stepResults: {},
      startedAt: Date.now()
    }
  }

  function advanceStep(): void {
    if (!executionState.value) return
    executionState.value = {
      ...executionState.value,
      currentStepIndex: executionState.value.currentStepIndex + 1
    }
  }

  function setStepResult(stepName: string, result: string): void {
    if (!executionState.value) return
    executionState.value = {
      ...executionState.value,
      stepResults: {
        ...executionState.value.stepResults,
        [stepName]: result
      }
    }
  }

  function completeExecution(): void {
    if (!executionState.value) return
    executionState.value = {
      ...executionState.value,
      status: 'completed',
      completedAt: Date.now()
    }
  }

  function failExecution(errorMsg: string): void {
    if (!executionState.value) return
    executionState.value = {
      ...executionState.value,
      status: 'error',
      error: errorMsg,
      completedAt: Date.now()
    }
  }

  function cancelExecution(): void {
    executionState.value = null
  }

  function clearExecutionState(): void {
    executionState.value = null
  }

  // Import/Export
  function importPipeline(pipelineJson: string): Pipeline | null {
    try {
      const pipeline = JSON.parse(pipelineJson) as Pipeline
      // Validate required fields
      if (!pipeline.name || !pipeline.steps || !Array.isArray(pipeline.steps)) {
        throw new Error('Invalid pipeline format')
      }
      return createPipeline({
        ...pipeline,
        category: 'custom'
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to import pipeline'
      return null
    }
  }

  function exportPipeline(id: string): string | null {
    const pipeline = getPipeline(id)
    if (!pipeline) return null
    return JSON.stringify(pipeline, null, 2)
  }

  // Persistence (called from App.vue)
  async function loadCustomPipelines(): Promise<void> {
    // In the future, load from file system
    // For now, pipelines are stored in memory
    isLoading.value = false
  }

  async function saveCustomPipelines(): Promise<void> {
    // In the future, save to file system
  }

  // Aliases for backwards compatibility during transition
  const getFlow = getPipeline
  const allFlows = allPipelines
  const flowById = pipelineById
  const flowsByCategory = pipelinesByCategory

  return {
    customPipelines,
    editingPipeline,
    executionState,
    isLoading,
    error,
    allPipelines,
    pipelineById,
    pipelinesByCategory,
    isExecuting,
    currentStep,
    getPipeline,
    createPipeline,
    updatePipeline,
    deletePipeline,
    duplicatePipeline,
    startEditing,
    updateEditingPipeline,
    saveEditingPipeline,
    cancelEditing,
    startExecution,
    advanceStep,
    setStepResult,
    completeExecution,
    failExecution,
    cancelExecution,
    clearExecutionState,
    importPipeline,
    exportPipeline,
    loadCustomPipelines,
    saveCustomPipelines,
    // Aliases for backwards compatibility
    getFlow,
    allFlows,
    flowById,
    flowsByCategory
  }
})

// Backwards compatibility alias
export const useFlowsStore = usePipelinesStore
