<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFlowsStore } from '@/stores/flows'
import { validateFlow, type Flow, type FlowInput, type FlowStep } from '@/lib/flows/schema'
import FlowStepForm from './FlowStepForm.vue'
import SiloIcon from '@/components/SiloIcon.vue'

const flowsStore = useFlowsStore()

const props = defineProps<{
  initialFlow?: Flow
}>()

const emit = defineEmits<{
  save: [flow: Flow]
  cancel: []
}>()

// Flow data
const flowName = ref(props.initialFlow?.name || '')
const flowDescription = ref(props.initialFlow?.description || '')
const flowIcon = ref(props.initialFlow?.icon || 'tool')
const inputs = ref<FlowInput[]>(props.initialFlow?.inputs || [])
const steps = ref<FlowStep[]>(props.initialFlow?.steps || [])

const icons = ['tool', 'write', 'list', 'check', 'data', 'target', 'idea', 'search', 'doc', 'image', 'chat', 'creative']

const availableInputs = computed(() => {
  const inputNames = inputs.value.map(i => i.name)
  const stepOutputs = steps.value.map(s => s.output).filter(Boolean)
  return [...inputNames, ...stepOutputs]
})

const validation = computed(() => {
  return validateFlow({
    name: flowName.value,
    inputs: inputs.value,
    steps: steps.value
  })
})

function addInput() {
  inputs.value = [...inputs.value, {
    name: `input_${inputs.value.length + 1}`,
    type: 'textarea',
    label: '',
    required: true
  }]
}

function updateInput(index: number, input: FlowInput) {
  inputs.value = inputs.value.map((i, idx) => idx === index ? input : i)
}

function removeInput(index: number) {
  inputs.value = inputs.value.filter((_, idx) => idx !== index)
}

function addStep() {
  steps.value = [...steps.value, {
    name: `step_${steps.value.length + 1}`,
    model: 'language',
    input: '',
    prompt: '',
    output: `output_${steps.value.length + 1}`
  }]
}

function updateStep(index: number, step: FlowStep) {
  steps.value = steps.value.map((s, idx) => idx === index ? step : s)
}

function removeStep(index: number) {
  steps.value = steps.value.filter((_, idx) => idx !== index)
}

function handleSave() {
  if (!validation.value.valid) {
    alert('Please fix validation errors:\n' + validation.value.errors.join('\n'))
    return
  }

  const flow: Flow = {
    id: props.initialFlow?.id || `custom-${Date.now()}`,
    name: flowName.value,
    description: flowDescription.value,
    icon: flowIcon.value,
    category: 'custom',
    inputs: inputs.value,
    steps: steps.value
  }

  if (props.initialFlow) {
    flowsStore.updateFlow(flow.id, flow)
  } else {
    flowsStore.createFlow(flow)
  }

  emit('save', flow)
}
</script>

<template>
  <div class="builder-multi">
    <header class="builder-header drag-region">
      <h2 class="builder-title">
        {{ initialFlow ? 'Edit Flow' : 'Multi-Step Flow Builder' }}
      </h2>
      <button class="btn btn-ghost btn-sm" @click="emit('cancel')">✕</button>
    </header>

    <div class="builder-content">
      <!-- Basic Info -->
      <section class="builder-section">
        <h3 class="section-title">Flow Details</h3>

        <div class="form-row">
          <div class="form-field">
            <label class="field-label">Name</label>
            <input
              v-model="flowName"
              type="text"
              class="input"
              placeholder="Flow name"
            />
          </div>
          <div class="form-field icon-field">
            <label class="field-label">Icon</label>
            <div class="icon-picker">
              <button
                v-for="icon in icons"
                :key="icon"
                :class="['icon-btn', { selected: flowIcon === icon }]"
                @click="flowIcon = icon"
              >
                <SiloIcon :name="icon" size="sm" />
              </button>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="field-label">Description</label>
          <input
            v-model="flowDescription"
            type="text"
            class="input"
            placeholder="What does this flow do?"
          />
        </div>
      </section>

      <!-- Inputs -->
      <section class="builder-section">
        <div class="section-header">
          <h3 class="section-title">Inputs (what user provides)</h3>
          <button class="btn btn-secondary btn-sm" @click="addInput">
            + Add Input
          </button>
        </div>

        <div v-if="inputs.length === 0" class="empty-state">
          <p class="text-muted">No inputs defined. Click "Add Input" to start.</p>
        </div>

        <div v-else class="input-list">
          <div v-for="(input, idx) in inputs" :key="idx" class="input-item">
            <div class="input-fields">
              <input
                :value="input.name"
                type="text"
                class="input input-sm"
                placeholder="Variable name"
                @input="updateInput(idx, { ...input, name: ($event.target as HTMLInputElement).value })"
              />
              <select
                :value="input.type"
                class="input input-sm"
                @change="updateInput(idx, { ...input, type: ($event.target as HTMLSelectElement).value as FlowInput['type'] })"
              >
                <option value="text">Text</option>
                <option value="textarea">Text Area</option>
                <option value="file">File</option>
                <option value="select">Dropdown</option>
              </select>
              <input
                :value="input.label"
                type="text"
                class="input input-sm"
                placeholder="Label"
                @input="updateInput(idx, { ...input, label: ($event.target as HTMLInputElement).value })"
              />
              <label class="toggle-sm">
                <input
                  :checked="input.required"
                  type="checkbox"
                  @change="updateInput(idx, { ...input, required: ($event.target as HTMLInputElement).checked })"
                />
                <span>Required</span>
              </label>
            </div>
            <button class="btn btn-ghost btn-sm" @click="removeInput(idx)">✕</button>
          </div>
        </div>
      </section>

      <!-- Steps -->
      <section class="builder-section">
        <div class="section-header">
          <h3 class="section-title">Steps</h3>
          <button class="btn btn-secondary btn-sm" @click="addStep">
            + Add Step
          </button>
        </div>

        <div v-if="steps.length === 0" class="empty-state">
          <p class="text-muted">No steps defined. Click "Add Step" to start.</p>
        </div>

        <div v-else class="steps-list">
          <div v-for="(step, idx) in steps" :key="idx" class="step-wrapper">
            <FlowStepForm
              :step="step"
              :index="idx"
              :available-inputs="availableInputs"
              @update="updateStep(idx, $event)"
              @remove="removeStep(idx)"
            />
            <div v-if="idx < steps.length - 1" class="step-connector">
              <span class="connector-line" />
              <span class="connector-arrow">↓</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Validation errors -->
      <div v-if="!validation.valid" class="validation-errors">
        <h4 class="error-title">Validation Issues</h4>
        <ul class="error-list">
          <li v-for="error in validation.errors" :key="error">{{ error }}</li>
        </ul>
      </div>
    </div>

    <footer class="builder-footer">
      <button class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
      <div class="spacer" />
      <button
        class="btn btn-primary"
        :disabled="!validation.valid"
        @click="handleSave"
      >
        {{ initialFlow ? 'Save Changes' : 'Create Flow' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.builder-multi {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.builder-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.builder-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.builder-section {
  margin-bottom: var(--space-8);
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--color-border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
}

.form-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.form-field {
  flex: 1;
}

.icon-field {
  flex: 0 0 auto;
}

.field-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
}

.icon-btn.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.empty-state {
  padding: var(--space-4);
  text-align: center;
  background: var(--color-surface);
  border: var(--border-width) dashed var(--color-border);
}

.input-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}

.input-fields {
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: center;
}

.input-sm {
  padding: var(--space-2);
  font-size: var(--text-xs);
}

.toggle-sm {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.steps-list {
  display: flex;
  flex-direction: column;
}

.step-wrapper {
  display: flex;
  flex-direction: column;
}

.step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2) 0;
  color: var(--color-text-subtle);
}

.connector-line {
  width: 1px;
  height: 16px;
  background: var(--color-border);
}

.connector-arrow {
  font-size: var(--text-xs);
}

.validation-errors {
  padding: var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: var(--border-width) solid var(--color-error);
}

.error-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-error);
  margin-bottom: var(--space-2);
}

.error-list {
  font-size: var(--text-xs);
  color: var(--color-error);
  margin: 0;
  padding-left: var(--space-4);
}

.builder-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
}

.spacer {
  flex: 1;
}
</style>
