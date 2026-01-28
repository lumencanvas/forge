<script setup lang="ts">
/**
 * SILO - Model Picker Component
 * Simple mode: Auto-selects best model
 * Advanced mode: Manual provider/task/model selection
 */

import { ref, computed, watch, onMounted } from 'vue'
import { useModelProvider } from '../composables/useModelProvider'
import type { TaskType, ProviderType, ModelInfo } from '../../electron/preload/index.d'

const props = withDefaults(defineProps<{
  /** Pre-selected model ID */
  modelValue?: string
  /** Task to filter models by */
  task?: TaskType
  /** Whether to show advanced mode toggle */
  showAdvanced?: boolean
  /** Compact display mode */
  compact?: boolean
}>(), {
  showAdvanced: true,
  compact: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void
  (e: 'modelChange', model: ModelInfo | null): void
}>()

const {
  allModels,
  providers,
  recommendedProvider,
  systemStats,
  isReady,
  getRecommendedModel,
  getModelsForTask,
  formatBytes
} = useModelProvider()

// State
const isAdvancedMode = ref(false)
const selectedProvider = ref<ProviderType | 'auto'>('auto')
const selectedTask = ref<TaskType>(props.task || 'chat')
const selectedModelId = ref(props.modelValue || '')
const recommendedModel = ref<ModelInfo | null>(null)

// Available tasks
const availableTasks: { value: TaskType; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'generate', label: 'Text Generation' },
  { value: 'summarize', label: 'Summarization' },
  { value: 'embed', label: 'Embeddings' },
  { value: 'image-classification', label: 'Image Classification' },
  { value: 'object-detection', label: 'Object Detection' },
  { value: 'depth-estimation', label: 'Depth Estimation' },
  { value: 'image-to-text', label: 'Image to Text' },
  { value: 'speech-to-text', label: 'Speech to Text' },
  { value: 'text-to-image', label: 'Image Generation' }
]

// Computed
const availableProviders = computed(() => {
  return providers.value.filter(p => p.status === 'available')
})

const filteredModels = computed(() => {
  let models = allModels.value

  // Filter by provider
  if (selectedProvider.value !== 'auto') {
    models = models.filter(m => m.provider === selectedProvider.value)
  }

  // Filter by task
  models = models.filter(m => m.capabilities.includes(selectedTask.value))

  // Only show installed/available models
  models = models.filter(m => {
    if (m.provider === 'huggingface') {
      return providers.value.find(p => p.type === 'huggingface')?.status === 'available'
    }
    return m.isInstalled
  })

  return models
})

const currentModel = computed(() => {
  if (isAdvancedMode.value && selectedModelId.value) {
    return allModels.value.find(m => m.id === selectedModelId.value) || null
  }
  return recommendedModel.value
})

const displayText = computed(() => {
  if (!isReady.value) {
    return 'Loading...'
  }

  if (isAdvancedMode.value && currentModel.value) {
    return currentModel.value.name
  }

  if (recommendedModel.value) {
    return `Auto - ${recommendedModel.value.name}`
  }

  return 'Auto - Best Available'
})

const systemSummary = computed(() => {
  if (!systemStats.value) return ''
  const cpu = systemStats.value.cpu.usage.toFixed(0)
  const memPercent = Math.round((systemStats.value.memory.used / systemStats.value.memory.total) * 100)
  return `CPU ${cpu}% | RAM ${memPercent}%`
})

// Methods
async function updateRecommendation() {
  const provider = selectedProvider.value === 'auto' ? undefined : selectedProvider.value
  recommendedModel.value = await getRecommendedModel(selectedTask.value, provider)

  if (!isAdvancedMode.value) {
    emitChange(recommendedModel.value)
  }
}

function handleModelSelect(modelId: string) {
  selectedModelId.value = modelId
  const model = allModels.value.find(m => m.id === modelId) || null
  emitChange(model as ModelInfo | null)
}

function handleModeToggle() {
  isAdvancedMode.value = !isAdvancedMode.value

  if (!isAdvancedMode.value) {
    // Switching to auto mode
    emitChange(recommendedModel.value)
  } else if (selectedModelId.value) {
    // Switching to advanced mode with existing selection
    const model = allModels.value.find(m => m.id === selectedModelId.value) || null
    emitChange(model as ModelInfo | null)
  }
}

function emitChange(model: ModelInfo | null) {
  emit('update:modelValue', model?.id)
  emit('modelChange', model)
}

// Watchers
watch(() => props.task, (newTask) => {
  if (newTask) {
    selectedTask.value = newTask
    updateRecommendation()
  }
})

watch(selectedTask, () => {
  updateRecommendation()
})

watch(selectedProvider, () => {
  updateRecommendation()
})

// Lifecycle
onMounted(() => {
  updateRecommendation()
})
</script>

<template>
  <div class="model-picker" :class="{ compact }">
    <!-- Simple Mode -->
    <div v-if="!isAdvancedMode" class="simple-mode">
      <div class="model-display">
        <span class="model-label">Model:</span>
        <span class="model-value">{{ displayText }}</span>
        <span v-if="currentModel?.provider" class="provider-badge">
          {{ currentModel.provider }}
        </span>
      </div>

      <div v-if="systemSummary && !compact" class="system-summary">
        {{ systemSummary }}
      </div>
    </div>

    <!-- Advanced Mode -->
    <div v-else class="advanced-mode">
      <div class="form-row">
        <div class="form-group">
          <label>Provider</label>
          <select v-model="selectedProvider">
            <option value="auto">Auto (Best Available)</option>
            <option
              v-for="provider in availableProviders"
              :key="provider.type"
              :value="provider.type"
            >
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Task</label>
          <select v-model="selectedTask" :disabled="!!props.task">
            <option
              v-for="task in availableTasks"
              :key="task.value"
              :value="task.value"
            >
              {{ task.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Model</label>
        <select
          :value="selectedModelId"
          @change="handleModelSelect(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select a model...</option>
          <option
            v-for="model in filteredModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }} ({{ model.sizeLabel }})
          </option>
        </select>
      </div>

      <div v-if="currentModel" class="model-details">
        <span class="detail">{{ currentModel.description || 'No description' }}</span>
        <span class="detail">
          Tasks: {{ currentModel.capabilities.join(', ') }}
        </span>
      </div>
    </div>

    <!-- Mode Toggle -->
    <div v-if="showAdvanced" class="mode-toggle">
      <button
        type="button"
        class="toggle-btn"
        :class="{ active: !isAdvancedMode }"
        @click="handleModeToggle"
      >
        {{ isAdvancedMode ? 'Simple' : 'Advanced' }}
      </button>
    </div>

    <!-- System Stats (Advanced Mode) -->
    <div v-if="isAdvancedMode && systemStats && !compact" class="system-bar">
      <div class="stat">
        <span>CPU</span>
        <div class="bar">
          <div
            class="fill"
            :style="{ width: systemStats.cpu.usage + '%' }"
          />
        </div>
        <span>{{ systemStats.cpu.usage.toFixed(0) }}%</span>
      </div>
      <div v-if="systemStats.gpu" class="stat">
        <span>GPU</span>
        <div class="bar">
          <div
            class="fill gpu"
            :style="{ width: systemStats.gpu.usage + '%' }"
          />
        </div>
        <span>{{ systemStats.gpu.usage.toFixed(0) }}%</span>
      </div>
      <div class="stat">
        <span>RAM</span>
        <div class="bar">
          <div
            class="fill"
            :style="{ width: (systemStats.memory.used / systemStats.memory.total * 100) + '%' }"
          />
        </div>
        <span>{{ formatBytes(systemStats.memory.used) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #1a1a1a);
  border-radius: 8px;
}

.model-picker.compact {
  padding: 0.5rem;
  gap: 0.5rem;
}

/* Simple Mode */
.simple-mode {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.model-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
}

.model-value {
  font-weight: 500;
  color: var(--text-primary, #ffffff);
}

.provider-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  background: var(--accent, #3b82f6);
  color: white;
  border-radius: 4px;
  text-transform: uppercase;
}

.system-summary {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
}

/* Advanced Mode */
.advanced-mode {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
}

.form-group select {
  padding: 0.375rem 0.5rem;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border, #3a3a3a);
  border-radius: 4px;
  color: var(--text-primary, #ffffff);
  font-size: 0.875rem;
}

.form-group select:disabled {
  opacity: 0.5;
}

.model-details {
  padding: 0.5rem;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 4px;
  font-size: 0.75rem;
}

.model-details .detail {
  display: block;
  color: var(--text-secondary, #a0a0a0);
}

.model-details .detail:first-child {
  color: var(--text-primary, #ffffff);
  margin-bottom: 0.25rem;
}

/* Mode Toggle */
.mode-toggle {
  display: flex;
  justify-content: flex-end;
}

.toggle-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--border, #3a3a3a);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  border-color: var(--accent, #3b82f6);
  color: var(--accent, #3b82f6);
}

/* System Stats Bar */
.system-bar {
  display: flex;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border, #3a3a3a);
}

.system-bar .stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  color: var(--text-secondary, #a0a0a0);
}

.system-bar .bar {
  width: 40px;
  height: 4px;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 2px;
  overflow: hidden;
}

.system-bar .bar .fill {
  height: 100%;
  background: var(--accent, #3b82f6);
}

.system-bar .bar .fill.gpu {
  background: #10b981;
}
</style>
