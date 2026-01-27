<script setup lang="ts">
import type { ExecutionPlan } from '@/lib/orchestrator'

defineProps<{
  plan: ExecutionPlan
}>()

const emit = defineEmits<{
  execute: [plan: ExecutionPlan]
  cancel: []
}>()
</script>

<template>
  <div class="plan card">
    <div class="plan-header">
      <div>
        <span class="label">Execution Plan</span>
        <p class="plan-request">{{ plan.request }}</p>
      </div>
      <span class="plan-estimate">{{ plan.estimate.formatted }}</span>
    </div>

    <div class="plan-phases">
      <div v-for="(phase, idx) in plan.phases" :key="idx" class="phase">
        <div class="phase-header">
          <span class="phase-number">{{ idx + 1 }}</span>
          <div>
            <h4 class="phase-name">{{ phase.name }}</h4>
            <p class="phase-desc text-subtle">{{ phase.description }}</p>
          </div>
        </div>
        <div class="phase-steps">
          <div v-for="(step, stepIdx) in phase.steps" :key="stepIdx" class="step">
            <span class="step-marker"></span>
            <span class="step-name">{{ step.name }}</span>
            <span v-if="step.models?.length" class="step-models text-subtle">
              {{ step.models.join(', ') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="plan-footer">
      <div class="plan-models">
        <span class="label">Models</span>
        <span>{{ plan.modelsNeeded.join(', ') }}</span>
      </div>
      <div class="plan-actions">
        <button class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
        <button class="btn btn-primary" @click="emit('execute', plan)">Execute</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan {
  margin-top: var(--space-4);
  padding: var(--space-4);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
}

.plan-request {
  margin-top: var(--space-2);
  color: var(--color-text);
}

.plan-estimate {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.plan-phases {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.phase {
  padding-left: var(--space-4);
  border-left: var(--border-width-2) solid var(--color-border);
}

.phase-header {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.phase-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-accent);
  background: var(--color-accent-glow);
  border: var(--border-width) solid var(--color-accent);
}

.phase-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.phase-desc {
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}

.phase-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-left: var(--space-6);
}

.step {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.step-marker {
  width: 4px;
  height: 4px;
  background: var(--color-text-subtle);
}

.step-name {
  color: var(--color-text-muted);
}

.step-models {
  font-size: var(--text-xs);
}

.plan-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
}

.plan-models {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-xs);
}

.plan-models .label {
  margin-bottom: 0;
}

.plan-actions {
  display: flex;
  gap: var(--space-3);
}
</style>
