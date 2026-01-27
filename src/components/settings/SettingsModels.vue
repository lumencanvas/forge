<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useHardwareStore } from '@/stores/hardware'
import type { OllamaModel } from '../../../electron/preload/index.d'

const settingsStore = useSettingsStore()
const hardwareStore = useHardwareStore()

const models = ref<OllamaModel[]>([])
const isLoading = ref(false)
const pullingModels = ref<Set<string>>(new Set())
const pullProgress = ref<Record<string, number>>({})

let cleanupPullProgress: (() => void) | undefined

onMounted(async () => {
  await loadModels()

  cleanupPullProgress = window.silo.ollama.onPullProgress((data) => {
    pullProgress.value = { ...pullProgress.value, [data.model]: data.progress }
    if (data.progress >= 100) {
      pullingModels.value = new Set([...pullingModels.value].filter(m => m !== data.model))
      loadModels()
    }
  })
})

onUnmounted(() => {
  cleanupPullProgress?.()
})

async function loadModels() {
  isLoading.value = true
  try {
    const result = await window.silo.ollama.listModels()
    models.value = result?.models || []
  } catch (e) {
    console.error('Failed to load models:', e)
  } finally {
    isLoading.value = false
  }
}

async function pullModel(modelId: string) {
  pullingModels.value = new Set([...pullingModels.value, modelId])
  pullProgress.value = { ...pullProgress.value, [modelId]: 0 }
  try {
    await window.silo.ollama.pullModel(modelId)
  } catch (e) {
    console.error('Failed to pull model:', e)
    pullingModels.value = new Set([...pullingModels.value].filter(m => m !== modelId))
  }
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

function isModelInstalled(modelId: string): boolean {
  return models.value.some(m => m.name === modelId || m.name.startsWith(modelId + ':'))
}

const defaultLanguageModel = computed({
  get: () => settingsStore.defaultLanguageModel,
  set: (v) => settingsStore.update('defaultLanguageModel', v)
})

const defaultVisionModel = computed({
  get: () => settingsStore.defaultVisionModel,
  set: (v) => settingsStore.update('defaultVisionModel', v)
})

const recommendedLanguageModels = computed(() =>
  hardwareStore.recommendations?.models.language || []
)

const recommendedVisionModels = computed(() =>
  hardwareStore.recommendations?.models.vision || []
)
</script>

<template>
  <div class="settings-section">
    <h3 class="section-title">Model Settings</h3>

    <!-- Default Models -->
    <div class="setting-group">
      <h4 class="group-title">Default Models</h4>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Language Model</label>
          <p class="setting-description">Used for chat and text generation</p>
        </div>
        <select v-model="defaultLanguageModel" class="input setting-select">
          <option value="">Select model...</option>
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.name }}
          </option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Vision Model</label>
          <p class="setting-description">Used for image analysis</p>
        </div>
        <select v-model="defaultVisionModel" class="input setting-select">
          <option value="">Select model...</option>
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Installed Models -->
    <div class="setting-group">
      <h4 class="group-title">Installed Models</h4>

      <div v-if="isLoading" class="loading">
        <span class="animate-pulse">Loading models...</span>
      </div>

      <div v-else-if="models.length === 0" class="empty-state">
        <p class="text-muted">No models installed yet.</p>
      </div>

      <div v-else class="model-list">
        <div v-for="model in models" :key="model.name" class="model-item">
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-meta">
              <span v-if="model.details?.parameter_size">{{ model.details.parameter_size }}</span>
              <span>{{ formatSize(model.size) }}</span>
            </span>
          </div>
          <div class="model-actions">
            <span v-if="model.name === defaultLanguageModel" class="badge badge-accent">
              Default
            </span>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary btn-sm" @click="loadModels">
        Refresh
      </button>
    </div>

    <!-- Recommended Models -->
    <div class="setting-group">
      <h4 class="group-title">Recommended for Your Hardware</h4>
      <p class="group-description text-muted">
        Based on your {{ hardwareStore.tierName }} tier system
      </p>

      <div class="recommended-section">
        <h5 class="subsection-title">Language Models</h5>
        <div class="model-grid">
          <div
            v-for="model in recommendedLanguageModels"
            :key="model.id"
            class="recommended-model"
          >
            <div class="model-info">
              <span class="model-name">{{ model.id }}</span>
              <span class="model-meta">{{ model.size }} - {{ model.speed }}</span>
            </div>
            <div class="model-actions">
              <span v-if="isModelInstalled(model.id)" class="badge badge-success">
                Installed
              </span>
              <span v-else-if="pullingModels.has(model.id)" class="badge badge-accent">
                {{ Math.round(pullProgress[model.id] || 0) }}%
              </span>
              <button
                v-else
                class="btn btn-secondary btn-sm"
                @click="pullModel(model.id)"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="recommended-section">
        <h5 class="subsection-title">Vision Models</h5>
        <div class="model-grid">
          <div
            v-for="model in recommendedVisionModels"
            :key="model.id"
            class="recommended-model"
          >
            <div class="model-info">
              <span class="model-name">{{ model.id }}</span>
              <span class="model-meta">{{ model.size }} - {{ model.speed }}</span>
            </div>
            <div class="model-actions">
              <span v-if="isModelInstalled(model.id)" class="badge badge-success">
                Installed
              </span>
              <span v-else-if="pullingModels.has(model.id)" class="badge badge-accent">
                {{ Math.round(pullProgress[model.id] || 0) }}%
              </span>
              <button
                v-else
                class="btn btn-secondary btn-sm"
                @click="pullModel(model.id)"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  padding: var(--space-6);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-6);
  color: var(--color-text-strong);
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
  min-width: 180px;
}

.loading,
.empty-state {
  padding: var(--space-4);
  text-align: center;
}

.model-list {
  margin-bottom: var(--space-4);
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-2);
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.model-name {
  font-weight: var(--weight-medium);
}

.model-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.recommended-section {
  margin-top: var(--space-4);
}

.subsection-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.model-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recommended-model {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}
</style>
