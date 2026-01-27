<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { OllamaStatus } from '../../electron/preload/index.d'

const emit = defineEmits<{
  'setup-click': []
}>()

const status = ref<OllamaStatus>('idle')
const error = ref<string | null>(null)

let cleanupListener: (() => void) | undefined

onMounted(async () => {
  if (typeof window !== 'undefined' && window.silo) {
    // Listen for status changes
    cleanupListener = window.silo.ollama.onStatusChange((statusInfo) => {
      status.value = statusInfo.status
      error.value = statusInfo.error
    })

    // Get initial status
    const initialStatus = await window.silo.ollama.getStatus()
    status.value = initialStatus.status
    error.value = initialStatus.error
  }
})

onUnmounted(() => {
  cleanupListener?.()
})

const statusConfig = computed(() => {
  switch (status.value) {
    case 'ready':
      return {
        color: '#10b981',
        label: 'AI Ready',
        icon: 'check',
        showButton: false
      }
    case 'starting':
      return {
        color: '#f59e0b',
        label: 'Connecting',
        icon: 'loading',
        showButton: false
      }
    case 'error':
    case 'idle':
    default:
      return {
        color: '#ef4444',
        label: 'AI Offline',
        icon: 'offline',
        showButton: true
      }
  }
})
</script>

<template>
  <div class="ollama-status" :class="status">
    <div class="status-indicator">
      <span class="status-dot" :style="{ background: statusConfig.color }" />
      <span class="status-label">{{ statusConfig.label }}</span>
    </div>

    <button
      v-if="statusConfig.showButton"
      class="setup-button"
      @click="emit('setup-click')"
    >
      Set Up AI
    </button>
  </div>
</template>

<style scoped>
.ollama-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ollama-status.starting .status-dot {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.status-label {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
}

.setup-button {
  padding: 4px 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.setup-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}
</style>
