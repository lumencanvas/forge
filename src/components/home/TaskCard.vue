<script setup lang="ts">
import type { Flow } from '@/lib/flows/schema'
import SiloIcon from '@/components/SiloIcon.vue'

const props = defineProps<{
  flow: Flow
}>()

const emit = defineEmits<{
  click: [flow: Flow]
}>()

function handleClick() {
  emit('click', props.flow)
}
</script>

<template>
  <button class="task-card" @click="handleClick">
    <SiloIcon :name="flow.icon" size="lg" class="task-icon" />
    <span class="task-name">{{ flow.name }}</span>
    <span class="task-description">{{ flow.description }}</span>
  </button>
</template>

<style scoped>
.task-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: center;
  min-height: 120px;
}

.task-card:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.task-card:focus {
  outline: var(--border-width-2) solid var(--color-accent);
  outline-offset: 2px;
}

.task-icon {
  font-size: 1.75rem;
  margin-bottom: var(--space-2);
}

.task-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
  margin-bottom: var(--space-1);
}

.task-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-tight);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
