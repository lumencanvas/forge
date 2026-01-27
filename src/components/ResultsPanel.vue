<script setup lang="ts">
import type { TaskResult } from '@/stores/task'

defineProps<{
  results: Record<string, TaskResult>
}>()
</script>

<template>
  <div v-if="Object.keys(results).length > 0" class="results-panel card">
    <h3 class="results-header">
      <span class="results-check">[OK]</span>
      Analysis Complete
    </h3>
    <div class="results-list">
      <div v-for="(stepResult, stepId) in results" :key="stepId" class="result-item">
        <h4 class="result-label">{{ stepId }}</h4>
        <div class="result-content">
          <pre class="result-pre">{{ JSON.stringify(stepResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-panel {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border-color: var(--color-success);
}

.results-header {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text);
}

.results-check {
  color: var(--color-success);
  font-weight: var(--weight-bold);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.result-item {
  border-left: var(--border-width-2) solid var(--color-border);
  padding-left: var(--space-3);
}

.result-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.result-content {
  background: var(--color-void);
  border: var(--border-width) solid var(--color-border-subtle);
  padding: var(--space-3);
  max-height: 15rem;
  overflow-y: auto;
}

.result-pre {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* Scrollbar styling */
.result-content::-webkit-scrollbar {
  width: 4px;
}

.result-content::-webkit-scrollbar-track {
  background: var(--color-void);
}

.result-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
}

.result-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-subtle);
}
</style>
