<script setup lang="ts">
import { computed } from 'vue'
import type { TaskProgress } from '@/stores/task'

const props = defineProps<{
  progress: TaskProgress | null
}>()

const percentage = computed(() => {
  if (!props.progress) return 0
  return Math.round((props.progress.current / props.progress.total) * 100)
})
</script>

<template>
  <div v-if="progress" class="progress-card card">
    <div class="progress-header">
      <div class="progress-spinner"></div>
      <div class="progress-info">
        <span class="progress-phase">{{ progress.phase }}</span>
        <span v-if="progress.step" class="progress-step text-subtle">{{ progress.step }}</span>
      </div>
      <span class="progress-count text-muted">{{ progress.current }}/{{ progress.total }}</span>
    </div>
    <div class="progress">
      <div class="progress-bar" :style="{ width: `${percentage}%` }"></div>
    </div>
    <div v-if="progress.file" class="progress-file text-subtle">
      {{ progress.file }}
    </div>
  </div>
</template>

<style scoped>
.progress-card {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.progress-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.progress-spinner {
  width: 0.75rem;
  height: 0.75rem;
  background: var(--color-accent);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.progress-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.progress-phase {
  font-weight: var(--weight-medium);
}

.progress-step {
  font-size: var(--text-xs);
}

.progress-count {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.progress-file {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
