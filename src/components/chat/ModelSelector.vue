<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ModelInfo } from '../../../electron/preload/index.d'

const props = defineProps<{
  modelValue: string
  models: ModelInfo[]
  isDownloading?: boolean
  downloadProgress?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)

const selectedModel = computed(() => {
  return props.models.find(m => m.id === props.modelValue)
})

const displayName = computed(() => {
  if (props.isDownloading) {
    return `Downloading... ${props.downloadProgress || 0}%`
  }
  if (!selectedModel.value) return props.modelValue || 'Select model'
  return selectedModel.value.name
})

// Group models by provider
const groupedModels = computed(() => {
  const groups: Record<string, ModelInfo[]> = {}
  for (const model of props.models) {
    if (!groups[model.provider]) {
      groups[model.provider] = []
    }
    groups[model.provider]!.push(model)
  }
  return groups
})

const providerLabels: Record<string, string> = {
  ollama: 'Ollama (Local)',
  transformers: 'Built-in (Transformers.js)',
  huggingface: 'HuggingFace (Cloud)'
}

function selectModel(model: ModelInfo) {
  emit('update:modelValue', model.id)
  isOpen.value = false
}

function toggleDropdown() {
  if (!props.isDownloading) {
    isOpen.value = !isOpen.value
  }
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)}GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)}MB`
}

function getStatusIcon(model: ModelInfo): string {
  if (model.isInstalled) return '[*]'
  if (model.isLocal) return '[D]' // Needs download
  return '[C]' // Cloud
}

function getStatusClass(model: ModelInfo): string {
  if (model.isInstalled) return 'status-ready'
  if (model.isLocal) return 'status-download'
  return 'status-cloud'
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="model-selector">
    <button
      class="selector-button"
      :class="{ downloading: isDownloading }"
      @click="toggleDropdown"
      :disabled="isDownloading"
    >
      <span class="selector-label">{{ displayName }}</span>
      <span v-if="isDownloading" class="progress-bar">
        <span class="progress-fill" :style="{ width: (downloadProgress || 0) + '%' }"></span>
      </span>
      <span v-else class="selector-arrow">▼</span>
    </button>

    <div v-if="isOpen && !isDownloading" class="selector-dropdown">
      <template v-for="(providerModels, provider) in groupedModels" :key="provider">
        <div class="dropdown-header">
          <span class="label">{{ providerLabels[provider] || provider }}</span>
        </div>
        <div class="dropdown-list">
          <button
            v-for="model in providerModels"
            :key="model.id"
            :class="['dropdown-item', { selected: model.id === modelValue }]"
            @click="selectModel(model)"
          >
            <span class="item-main">
              <span :class="['item-status', getStatusClass(model)]">{{ getStatusIcon(model) }}</span>
              <span class="item-name">{{ model.name }}</span>
            </span>
            <span class="item-meta">
              <span v-if="model.tier" class="item-tier">{{ model.tier }}</span>
              <span class="item-size">{{ model.sizeLabel || formatSize(model.size) }}</span>
            </span>
          </button>
        </div>
      </template>
      <div v-if="models.length === 0" class="dropdown-empty">
        <p class="text-muted">No models available</p>
        <p class="text-muted text-sm">Install Ollama or wait for built-in models</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-selector {
  position: relative;
}

.selector-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  min-width: 180px;
}

.selector-button:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

.selector-button:disabled {
  cursor: wait;
}

.selector-button.downloading {
  border-color: var(--color-accent);
}

.selector-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.selector-arrow {
  font-size: 8px;
  opacity: 0.5;
}

.progress-bar {
  width: 40px;
  height: 4px;
  background: var(--color-surface);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.selector-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  min-width: 280px;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  z-index: var(--z-dropdown);
  max-height: 400px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.dropdown-header {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border-bottom: var(--border-width) solid var(--color-border);
  position: sticky;
  top: 0;
}

.dropdown-header .label {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--color-surface-raised);
}

.dropdown-item.selected {
  background: var(--color-accent-glow);
}

.item-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.item-status {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.item-status.status-ready {
  color: var(--color-success, #22c55e);
}

.item-status.status-download {
  color: var(--color-warning, #f59e0b);
}

.item-status.status-cloud {
  color: var(--color-info, #3b82f6);
}

.item-name {
  font-weight: var(--weight-medium);
}

.item-meta {
  display: flex;
  gap: var(--space-2);
  color: var(--color-text-subtle);
}

.item-tier {
  font-size: 0.65rem;
  padding: 1px 4px;
  background: var(--color-surface-raised);
  border-radius: 2px;
}

.dropdown-empty {
  padding: var(--space-4);
  text-align: center;
}

.text-sm {
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}
</style>
