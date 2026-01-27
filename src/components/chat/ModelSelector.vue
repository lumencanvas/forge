<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { OllamaModel } from '../../../electron/preload/index.d'

const props = defineProps<{
  modelValue: string
  models: OllamaModel[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)

const selectedModel = computed(() => {
  return props.models.find(m => m.name === props.modelValue)
})

const displayName = computed(() => {
  if (!selectedModel.value) return props.modelValue || 'Select model'
  return selectedModel.value.name
})

function selectModel(model: OllamaModel) {
  emit('update:modelValue', model.name)
  isOpen.value = false
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
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

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="model-selector">
    <button class="selector-button" @click="toggleDropdown">
      <span class="selector-label">{{ displayName }}</span>
      <span class="selector-arrow">▼</span>
    </button>

    <div v-if="isOpen" class="selector-dropdown">
      <div class="dropdown-header">
        <span class="label">Available Models</span>
      </div>
      <div class="dropdown-list">
        <button
          v-for="model in models"
          :key="model.name"
          :class="['dropdown-item', { selected: model.name === modelValue }]"
          @click="selectModel(model)"
        >
          <span class="item-name">{{ model.name }}</span>
          <span class="item-meta">
            <span v-if="model.details?.parameter_size" class="item-params">
              {{ model.details.parameter_size }}
            </span>
            <span class="item-size">{{ formatSize(model.size) }}</span>
          </span>
        </button>
      </div>
      <div v-if="models.length === 0" class="dropdown-empty">
        <p class="text-muted">No models installed</p>
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
}

.selector-button:hover {
  border-color: var(--color-border-strong);
}

.selector-label {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-arrow {
  font-size: 8px;
  opacity: 0.5;
}

.selector-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  min-width: 220px;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  z-index: var(--z-dropdown);
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width) solid var(--color-border);
}

.dropdown-list {
  overflow-y: auto;
  flex: 1;
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

.item-name {
  font-weight: var(--weight-medium);
}

.item-meta {
  display: flex;
  gap: var(--space-2);
  color: var(--color-text-subtle);
}

.dropdown-empty {
  padding: var(--space-4);
  text-align: center;
}
</style>
