<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useHardwareStore } from '@/stores/hardware'
import type { ModelInfo, ModelPullProgress } from '../../../electron/preload/index.d'

const settingsStore = useSettingsStore()
const hardwareStore = useHardwareStore()

// State
const allModels = ref<ModelInfo[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const pullingModels = ref<Set<string>>(new Set())
const pullProgress = ref<Record<string, number>>({})

let cleanupPullProgress: (() => void) | undefined

// Load models on mount
onMounted(async () => {
  await loadModels()

  // Listen for pull progress
  cleanupPullProgress = window.silo.models.onPullProgress((progress: ModelPullProgress) => {
    pullProgress.value = { ...pullProgress.value, [progress.model]: progress.progress }

    if (progress.status === 'complete') {
      pullingModels.value = new Set([...pullingModels.value].filter(m => m !== progress.model))
      loadModels() // Refresh model list
    } else if (progress.status === 'error') {
      pullingModels.value = new Set([...pullingModels.value].filter(m => m !== progress.model))
      error.value = progress.error || 'Download failed'
    }
  })
})

onUnmounted(() => {
  cleanupPullProgress?.()
})

// Load all models from unified API
async function loadModels() {
  isLoading.value = true
  error.value = null
  try {
    allModels.value = await window.silo.models.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load models'
  } finally {
    isLoading.value = false
  }
}

// Pull/download a model
async function pullModel(modelId: string) {
  pullingModels.value = new Set([...pullingModels.value, modelId])
  pullProgress.value = { ...pullProgress.value, [modelId]: 0 }
  error.value = null

  try {
    const result = await window.silo.models.pull(modelId)
    if (!result.success) {
      error.value = result.error || 'Failed to download model'
      pullingModels.value = new Set([...pullingModels.value].filter(m => m !== modelId))
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to download model'
    pullingModels.value = new Set([...pullingModels.value].filter(m => m !== modelId))
  }
}

// Computed: Filter models by capability
const languageModels = computed(() =>
  allModels.value.filter(m =>
    m.capabilities.includes('chat') || m.capabilities.includes('generate')
  )
)

const visionModels = computed(() =>
  allModels.value.filter(m =>
    m.capabilities.includes('image-classification') ||
    m.capabilities.includes('object-detection') ||
    m.capabilities.includes('image-to-text')
  )
)

const audioModels = computed(() =>
  allModels.value.filter(m =>
    m.capabilities.includes('speech-to-text')
  )
)

const embeddingModels = computed(() =>
  allModels.value.filter(m => m.capabilities.includes('embed'))
)

// Computed: Installed models
const installedModels = computed(() =>
  allModels.value.filter(m => m.isInstalled)
)

// Computed: Models grouped by provider
const modelsByProvider = computed(() => {
  const groups: Record<string, ModelInfo[]> = {
    transformers: [],
    ollama: [],
    huggingface: []
  }
  for (const model of allModels.value) {
    groups[model.provider]?.push(model)
  }
  return groups
})

// Settings bindings
const defaultLanguageModel = computed({
  get: () => settingsStore.defaultLanguageModel,
  set: (v) => settingsStore.update('defaultLanguageModel', v)
})

const defaultVisionModel = computed({
  get: () => settingsStore.defaultVisionModel,
  set: (v) => settingsStore.update('defaultVisionModel', v)
})

const defaultAudioModel = computed({
  get: () => settingsStore.defaultAudioModel,
  set: (v) => settingsStore.update('defaultAudioModel', v)
})

// Provider labels
const providerLabels: Record<string, string> = {
  transformers: 'Built-in (Transformers.js)',
  ollama: 'Ollama (Local)',
  huggingface: 'HuggingFace (Cloud)'
}

function getStatusBadge(model: ModelInfo): { text: string; class: string } {
  if (pullingModels.value.has(model.id)) {
    return { text: `${Math.round(pullProgress.value[model.id] || 0)}%`, class: 'badge-accent' }
  }
  if (model.isInstalled) {
    return { text: 'Ready', class: 'badge-success' }
  }
  if (model.isLocal) {
    return { text: 'Download', class: 'badge-warning' }
  }
  return { text: 'Cloud', class: 'badge-info' }
}

function canDownload(model: ModelInfo): boolean {
  return model.isLocal && !model.isInstalled && !pullingModels.value.has(model.id)
}
</script>

<template>
  <div class="settings-section">
    <h3 class="section-title">Model Settings</h3>

    <!-- Error Banner -->
    <div v-if="error" class="error-banner">
      <span>{{ error }}</span>
      <button @click="error = null">[x]</button>
    </div>

    <!-- Default Models -->
    <div class="setting-group">
      <h4 class="group-title">Default Models</h4>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Language Model</label>
          <p class="setting-description">Used for chat and text generation</p>
        </div>
        <select v-model="defaultLanguageModel" class="input setting-select">
          <option value="">Auto (Best Available)</option>
          <option
            v-for="model in languageModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }} ({{ model.provider }})
          </option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Vision Model</label>
          <p class="setting-description">Used for image analysis</p>
        </div>
        <select v-model="defaultVisionModel" class="input setting-select">
          <option value="">Auto (Best Available)</option>
          <option
            v-for="model in visionModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }} ({{ model.provider }})
          </option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Audio Model</label>
          <p class="setting-description">Used for speech recognition</p>
        </div>
        <select v-model="defaultAudioModel" class="input setting-select">
          <option value="">Auto (Best Available)</option>
          <option
            v-for="model in audioModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }} ({{ model.provider }})
          </option>
        </select>
      </div>
    </div>

    <!-- Installed/Ready Models -->
    <div class="setting-group">
      <h4 class="group-title">Installed Models</h4>

      <div v-if="isLoading" class="loading">
        <span class="animate-pulse">Loading models...</span>
      </div>

      <div v-else-if="installedModels.length === 0" class="empty-state">
        <p class="text-muted">No models installed yet.</p>
        <p class="text-muted text-sm">Select a model below to download it.</p>
      </div>

      <div v-else class="model-list">
        <div
          v-for="model in installedModels"
          :key="model.id"
          class="model-item"
        >
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-meta">
              <span class="provider-tag">{{ model.provider }}</span>
              <span>{{ model.sizeLabel }}</span>
              <span>{{ model.capabilities.join(', ') }}</span>
            </span>
          </div>
          <div class="model-actions">
            <span :class="['badge', getStatusBadge(model).class]">
              {{ getStatusBadge(model).text }}
            </span>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary btn-sm" @click="loadModels" :disabled="isLoading">
        Refresh
      </button>
    </div>

    <!-- Available Models by Provider -->
    <div class="setting-group">
      <h4 class="group-title">Available Models</h4>
      <p class="group-description text-muted">
        Download models to use them offline. Cloud models require an API key.
      </p>

      <template v-for="(models, provider) in modelsByProvider" :key="provider">
        <div v-if="models.length > 0" class="provider-section">
          <h5 class="subsection-title">{{ providerLabels[provider] || provider }}</h5>

          <div class="model-grid">
            <div
              v-for="model in models"
              :key="model.id"
              class="available-model"
            >
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
                <span class="model-meta">
                  <span>{{ model.sizeLabel }}</span>
                  <span class="tier-tag">{{ model.tier }}</span>
                </span>
                <span class="model-desc">{{ model.description }}</span>
              </div>
              <div class="model-actions">
                <span :class="['badge', getStatusBadge(model).class]">
                  {{ getStatusBadge(model).text }}
                </span>
                <button
                  v-if="canDownload(model)"
                  class="btn btn-primary btn-sm"
                  @click="pullModel(model.id)"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Hardware Info -->
    <div class="setting-group">
      <h4 class="group-title">System Info</h4>
      <div class="system-info">
        <div class="info-item">
          <span class="info-label">Hardware Tier:</span>
          <span class="info-value">{{ hardwareStore.tierName }}</span>
        </div>
        <div v-if="hardwareStore.hardwareInfo?.memory" class="info-item">
          <span class="info-label">Available RAM:</span>
          <span class="info-value">
            {{ Math.round(hardwareStore.hardwareInfo.memory.available / 1024 / 1024 / 1024) }} GB
          </span>
        </div>
        <div v-if="hardwareStore.hardwareInfo?.gpu" class="info-item">
          <span class="info-label">GPU:</span>
          <span class="info-value">{{ hardwareStore.hardwareInfo.gpu.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  padding: var(--space-6);
  max-width: 800px;
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-6);
  color: var(--color-text-strong);
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.error-banner button {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.setting-group {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--color-border);
}

.group-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.group-description {
  font-size: var(--text-xs);
  margin-bottom: var(--space-4);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  gap: var(--space-4);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-weight: var(--weight-medium);
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.setting-select {
  width: auto;
  min-width: 220px;
}

.loading,
.empty-state {
  padding: var(--space-4);
  text-align: center;
}

.text-sm {
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}

.model-list {
  margin-bottom: var(--space-4);
}

.model-item,
.available-model {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-2);
  background: var(--color-surface-raised);
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.model-name {
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
}

.model-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.model-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  max-width: 400px;
}

.model-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.provider-tag {
  background: var(--color-surface);
  padding: 1px 6px;
  border-radius: 3px;
}

.tier-tag {
  background: var(--color-accent-glow);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.65rem;
}

.provider-section {
  margin-bottom: var(--space-4);
}

.subsection-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-border-subtle);
}

.model-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.badge {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: 3px;
}

.badge-success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.badge-info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.badge-accent {
  background: var(--color-accent-glow);
  color: var(--color-accent);
}

.system-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-item {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.info-label {
  color: var(--color-text-muted);
}

.info-value {
  color: var(--color-text);
  font-weight: var(--weight-medium);
}
</style>
