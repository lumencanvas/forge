<script setup lang="ts">
/**
 * SILO - Advanced Model Management Settings
 * System stats, loaded models, model browser, custom model addition
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useModelProvider } from '../../composables/useModelProvider'
import type { TaskType, ProviderType, CustomModelConfig } from '../../../electron/preload/index.d'

const {
  systemStats,
  loadedModels,
  allModels,
  registry,
  pullProgress,
  isLoading,
  error,
  refreshSystemStats,
  refreshLoadedModels,
  pullModel,
  deleteModel,
  unloadModel,
  addCustomModel,
  formatBytes
} = useModelProvider()

// Filters
const filterProvider = ref<ProviderType | ''>('')
const filterTask = ref<TaskType | ''>('')

// Custom model form
const customModelId = ref('')
const customModelName = ref('')
const customModelTask = ref<TaskType>('chat')
const customModelProvider = ref<'transformers' | 'huggingface'>('transformers')
const showCustomModelForm = ref(false)

// Download state
const downloadingModelId = ref<string | null>(null)

// System stats refresh interval
let statsInterval: ReturnType<typeof setInterval> | null = null

// Computed
const memoryPercent = computed(() => {
  if (!systemStats.value?.memory.total) return 0
  return Math.round((systemStats.value.memory.used / systemStats.value.memory.total) * 100)
})

const filteredModels = computed(() => {
  return registry.value.filter(model => {
    if (filterProvider.value && model.provider !== filterProvider.value) return false
    if (filterTask.value && !model.tasks.includes(filterTask.value)) return false
    return true
  })
})

const downloadedModels = computed(() => {
  return allModels.value.filter(m => m.isInstalled && m.isLocal)
})

const availableTasks: TaskType[] = [
  'chat', 'generate', 'summarize', 'embed',
  'image-classification', 'object-detection', 'depth-estimation', 'image-to-text',
  'speech-to-text', 'text-to-image'
]

// Actions
async function handleDownload(modelId: string) {
  downloadingModelId.value = modelId
  await pullModel(modelId)
  downloadingModelId.value = null
}

async function handleDelete(modelId: string) {
  if (confirm(`Delete model "${modelId}"? This will remove the downloaded files.`)) {
    await deleteModel(modelId)
  }
}

async function handleUnload(modelId: string) {
  await unloadModel(modelId)
}

async function handleAddCustomModel() {
  if (!customModelId.value.trim()) return

  const config: CustomModelConfig = {
    huggingFaceId: customModelId.value.trim(),
    name: customModelName.value.trim() || customModelId.value.trim(),
    tasks: [customModelTask.value],
    provider: customModelProvider.value
  }

  const success = await addCustomModel(config)
  if (success) {
    customModelId.value = ''
    customModelName.value = ''
    showCustomModelForm.value = false
  }
}

function getProgressForModel(modelId: string): number {
  if (pullProgress.value?.model === modelId) {
    return pullProgress.value.progress
  }
  return 0
}

// Lifecycle
onMounted(() => {
  refreshSystemStats()
  refreshLoadedModels()

  // Refresh stats every 5 seconds
  statsInterval = setInterval(() => {
    refreshSystemStats()
  }, 5000)
})

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
})
</script>

<template>
  <div class="model-manager">
    <!-- System Stats Bar -->
    <section class="system-stats">
      <h3>System Resources</h3>
      <div class="stats-grid">
        <div class="stat">
          <span class="label">CPU</span>
          <div class="bar">
            <div
              class="fill"
              :style="{ width: (systemStats?.cpu.usage || 0) + '%' }"
            />
          </div>
          <span class="value">{{ (systemStats?.cpu.usage || 0).toFixed(0) }}%</span>
        </div>

        <div v-if="systemStats?.gpu" class="stat">
          <span class="label">GPU</span>
          <div class="bar">
            <div
              class="fill gpu"
              :style="{ width: systemStats.gpu.usage + '%' }"
            />
          </div>
          <span class="value">{{ systemStats.gpu.usage.toFixed(0) }}%</span>
        </div>

        <div class="stat">
          <span class="label">RAM</span>
          <div class="bar">
            <div
              class="fill"
              :style="{ width: memoryPercent + '%' }"
            />
          </div>
          <span class="value">
            {{ formatBytes(systemStats?.memory.used || 0) }} /
            {{ formatBytes(systemStats?.memory.total || 0) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Loaded Models -->
    <section class="loaded-models">
      <h3>
        Loaded Models
        <span class="badge">{{ loadedModels.length }}</span>
      </h3>

      <div v-if="loadedModels.length === 0" class="empty-state">
        No models currently loaded in memory.
      </div>

      <div v-else class="model-list">
        <div
          v-for="model in loadedModels"
          :key="model.id"
          class="model-card loaded"
        >
          <div class="model-info">
            <span class="model-name">{{ model.id }}</span>
            <span class="model-memory">{{ formatBytes(model.memoryUsage) }}</span>
          </div>
          <button
            class="btn-secondary btn-sm"
            @click="handleUnload(model.id)"
          >
            Unload
          </button>
        </div>
      </div>
    </section>

    <!-- Downloaded Models -->
    <section class="downloaded-models">
      <h3>Downloaded Models</h3>

      <div v-if="downloadedModels.length === 0" class="empty-state">
        No models downloaded yet. Browse available models below.
      </div>

      <div v-else class="model-list">
        <div
          v-for="model in downloadedModels"
          :key="model.id"
          class="model-card"
        >
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-size">{{ model.sizeLabel }}</span>
            <span class="model-provider">{{ model.provider }}</span>
          </div>
          <button
            class="btn-danger btn-sm"
            @click="handleDelete(model.id)"
          >
            Delete
          </button>
        </div>
      </div>
    </section>

    <!-- Available Models Browser -->
    <section class="available-models">
      <h3>Available Models</h3>

      <div class="filters">
        <select v-model="filterProvider">
          <option value="">All Providers</option>
          <option value="transformers">Built-in (Transformers.js)</option>
          <option value="ollama">Ollama</option>
          <option value="huggingface">HuggingFace Cloud</option>
        </select>

        <select v-model="filterTask">
          <option value="">All Tasks</option>
          <option v-for="task in availableTasks" :key="task" :value="task">
            {{ task }}
          </option>
        </select>
      </div>

      <div class="model-list">
        <div
          v-for="model in filteredModels"
          :key="model.id"
          class="model-card"
        >
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-tasks">{{ model.tasks.join(', ') }}</span>
            <span v-if="model.sizeLabel" class="model-size">{{ model.sizeLabel }}</span>
            <span class="model-provider">{{ model.provider }}</span>
          </div>

          <div class="model-actions">
            <template v-if="downloadingModelId === model.id || (pullProgress?.model === model.id && pullProgress.status === 'downloading')">
              <div class="download-progress">
                <div
                  class="progress-bar"
                  :style="{ width: getProgressForModel(model.id) + '%' }"
                />
                <span>{{ getProgressForModel(model.id) }}%</span>
              </div>
            </template>
            <template v-else>
              <button
                class="btn-primary btn-sm"
                @click="handleDownload(model.id)"
                :disabled="isLoading"
              >
                Download
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Add Custom Model -->
    <section class="custom-model">
      <h3>Add Custom Model</h3>

      <button
        v-if="!showCustomModelForm"
        class="btn-secondary"
        @click="showCustomModelForm = true"
      >
        + Add Custom Model
      </button>

      <div v-else class="custom-model-form">
        <div class="form-group">
          <label>HuggingFace Model ID</label>
          <input
            v-model="customModelId"
            type="text"
            placeholder="e.g., Xenova/whisper-large"
          />
        </div>

        <div class="form-group">
          <label>Display Name (optional)</label>
          <input
            v-model="customModelName"
            type="text"
            placeholder="Custom name for the model"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Task</label>
            <select v-model="customModelTask">
              <option v-for="task in availableTasks" :key="task" :value="task">
                {{ task }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Provider</label>
            <select v-model="customModelProvider">
              <option value="transformers">Transformers.js (Local)</option>
              <option value="huggingface">HuggingFace API (Cloud)</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button
            class="btn-secondary"
            @click="showCustomModelForm = false"
          >
            Cancel
          </button>
          <button
            class="btn-primary"
            @click="handleAddCustomModel"
            :disabled="!customModelId.trim()"
          >
            Add Model
          </button>
        </div>
      </div>
    </section>

    <!-- Error display -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.model-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
}

section {
  background: var(--bg-secondary, #1a1a1a);
  border-radius: 8px;
  padding: 1rem;
}

h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  background: var(--accent, #3b82f6);
  color: white;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

/* System Stats */
.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat {
  display: grid;
  grid-template-columns: 3rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.stat .label {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
}

.stat .bar {
  height: 8px;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 4px;
  overflow: hidden;
}

.stat .bar .fill {
  height: 100%;
  background: var(--accent, #3b82f6);
  transition: width 0.3s ease;
}

.stat .bar .fill.gpu {
  background: #10b981;
}

.stat .value {
  font-size: 0.75rem;
  color: var(--text-primary, #ffffff);
  min-width: 80px;
  text-align: right;
}

/* Model Lists */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 6px;
}

.model-card.loaded {
  border-left: 3px solid var(--accent, #3b82f6);
}

.model-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.model-name {
  font-weight: 500;
  color: var(--text-primary, #ffffff);
}

.model-size,
.model-memory,
.model-tasks,
.model-provider {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
}

.model-provider {
  background: var(--bg-secondary, #1a1a1a);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.model-tasks {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Download Progress */
.download-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--accent, #3b82f6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.download-progress span {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
  min-width: 35px;
}

/* Filters */
.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.filters select {
  padding: 0.375rem 0.75rem;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border, #3a3a3a);
  border-radius: 4px;
  color: var(--text-primary, #ffffff);
  font-size: 0.875rem;
}

/* Custom Model Form */
.custom-model-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

.form-group input,
.form-group select {
  padding: 0.5rem;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border, #3a3a3a);
  border-radius: 4px;
  color: var(--text-primary, #ffffff);
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: var(--accent, #3b82f6);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #2563eb);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border, #3a3a3a);
  color: var(--text-primary, #ffffff);
}

.btn-secondary:hover {
  background: var(--bg-tertiary, #2a2a2a);
}

.btn-danger {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary, #a0a0a0);
  font-size: 0.875rem;
}

/* Error */
.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.875rem;
}
</style>
