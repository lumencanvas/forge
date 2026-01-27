<script setup lang="ts">
import { computed } from 'vue'
import type { FlowStep, ModelType } from '@/lib/flows/schema'

const props = defineProps<{
  step: FlowStep
  index: number
  availableInputs: string[]
}>()

const emit = defineEmits<{
  update: [step: FlowStep]
  remove: []
}>()

const modelTypes: Array<{ value: ModelType; label: string }> = [
  { value: 'language', label: 'Language' },
  { value: 'vision', label: 'Vision' },
  { value: 'audio', label: 'Audio' }
]

const inputOptions = computed(() => {
  return props.availableInputs.map(name => ({
    value: `$${name}`,
    label: name
  }))
})

function updateField<K extends keyof FlowStep>(field: K, value: FlowStep[K]) {
  emit('update', { ...props.step, [field]: value })
}
</script>

<template>
  <div class="step-form">
    <div class="step-header">
      <span class="step-number">Step {{ index + 1 }}</span>
      <button class="btn btn-ghost btn-sm" @click="emit('remove')">✕</button>
    </div>

    <div class="step-fields">
      <div class="field-row">
        <div class="field">
          <label class="field-label">Name</label>
          <input
            type="text"
            class="input"
            :value="step.name"
            placeholder="e.g., extract_text"
            @input="updateField('name', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label class="field-label">Model Type</label>
          <select
            class="input"
            :value="step.model"
            @change="updateField('model', ($event.target as HTMLSelectElement).value as ModelType)"
          >
            <option v-for="type in modelTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="field-label">Input</label>
          <select
            class="input"
            :value="step.input"
            @change="updateField('input', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Select input...</option>
            <option v-for="opt in inputOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Save Result As</label>
          <input
            type="text"
            class="input"
            :value="step.output"
            placeholder="e.g., extracted_text"
            @input="updateField('output', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="field">
        <label class="field-label">Prompt / Instructions</label>
        <textarea
          class="input"
          :value="step.prompt"
          rows="4"
          placeholder="Instructions for the AI..."
          @input="updateField('prompt', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <div class="field">
        <label class="field-label">Description (optional)</label>
        <input
          type="text"
          class="input"
          :value="step.description || ''"
          placeholder="What this step does..."
          @input="updateField('description', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-form {
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  padding: var(--space-4);
}

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width) solid var(--color-border);
}

.step-number {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.step-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--color-text-muted);
}

.input {
  width: 100%;
}

textarea.input {
  resize: vertical;
}
</style>
