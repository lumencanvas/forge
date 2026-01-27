import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ExecutionPlan } from '@/lib/orchestrator'

// Re-export for convenience
export type { ExecutionPlan, PlanStep, PlanPhase, Intent } from '@/lib/orchestrator'

export interface TaskProgress {
  phase: string
  step: string
  current: number
  total: number
  file?: string
}

export interface TaskResult {
  stepId: string
  results: Array<{
    file: string
    result: string
  }>
}

export const useTaskStore = defineStore('task', () => {
  const currentPlan = ref<ExecutionPlan | null>(null)
  const progress = ref<TaskProgress | null>(null)
  const results = ref<Record<string, TaskResult>>({})
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  const hasResults = computed(() => Object.keys(results.value).length > 0)
  const hasPlan = computed(() => currentPlan.value !== null)

  function setPlan(plan: ExecutionPlan | null) {
    currentPlan.value = plan
    results.value = {}
    error.value = null
  }

  function setProgress(p: TaskProgress | null) {
    progress.value = p
  }

  function setResults(r: Record<string, TaskResult>) {
    results.value = r
  }

  function addResult(stepId: string, result: TaskResult) {
    results.value = { ...results.value, [stepId]: result }
  }

  function setProcessing(processing: boolean) {
    isProcessing.value = processing
    if (!processing) {
      progress.value = null
    }
  }

  function setError(e: string | null) {
    error.value = e
  }

  function clearTask() {
    currentPlan.value = null
    progress.value = null
    results.value = {}
    isProcessing.value = false
    error.value = null
  }

  return {
    currentPlan,
    progress,
    results,
    isProcessing,
    error,
    hasResults,
    hasPlan,
    setPlan,
    setProgress,
    setResults,
    addResult,
    setProcessing,
    setError,
    clearTask
  }
})
