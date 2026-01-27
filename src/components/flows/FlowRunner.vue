<script setup lang="ts">
import { ref, computed } from 'vue'
import { executeFlow, validateInputs, type ExecutionResult } from '@/lib/flows/executor'
import type { Flow, FlowInput } from '@/lib/flows/schema'

const props = defineProps<{
  flow: Flow
}>()

const emit = defineEmits<{
  complete: [result: ExecutionResult]
  close: []
}>()

// Input values
const inputValues = ref<Record<string, string | boolean>>({})

// Execution state
const isRunning = ref(false)
const currentStep = ref(0)
const result = ref<ExecutionResult | null>(null)
const error = ref<string | null>(null)

// Initialize default values
for (const input of props.flow.inputs) {
  if (input.defaultValue !== undefined) {
    inputValues.value[input.name] = input.defaultValue
  } else {
    inputValues.value[input.name] = ''
  }
}

const inputValidation = computed(() => {
  return validateInputs(props.flow, inputValues.value)
})

const canRun = computed(() => {
  return inputValidation.value.valid && !isRunning.value
})

async function handleRun() {
  if (!canRun.value) return

  isRunning.value = true
  currentStep.value = 0
  result.value = null
  error.value = null

  try {
    const executionResult = await executeFlow(
      props.flow,
      inputValues.value,
      {
        onStepStart: (step, index) => {
          currentStep.value = index
        },
        onStepComplete: (step, index) => {
          currentStep.value = index + 1
        },
        onStepError: (step, index, err) => {
          error.value = `Step "${step.name}" failed: ${err.message}`
        }
      }
    )

    result.value = executionResult
    if (executionResult.success) {
      emit('complete', executionResult)
    } else {
      error.value = executionResult.error || 'Execution failed'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Execution failed'
  } finally {
    isRunning.value = false
  }
}

function handleClose() {
  emit('close')
}

function getInputComponent(input: FlowInput) {
  switch (input.type) {
    case 'toggle':
      return 'checkbox'
    case 'select':
      return 'select'
    case 'textarea':
      return 'textarea'
    default:
      return 'input'
  }
}

async function handleFileSelect(inputName: string) {
  try {
    const files = await window.silo.files.selectFiles()
    if (files.length > 0) {
      inputValues.value[inputName] = files[0]!
    }
  } catch (e) {
    console.error('File select failed:', e)
  }
}
</script>

<template>
  <div class="flow-runner">
    <header class="runner-header drag-region">
      <div class="header-info">
        <span class="flow-icon">{{ flow.icon }}</span>
        <h2 class="flow-name">{{ flow.name }}</h2>
      </div>
      <button class="btn btn-ghost btn-sm" @click="handleClose">✕</button>
    </header>

    <div class="runner-content">
      <!-- Inputs Form -->
      <div v-if="!result" class="inputs-section">
        <p class="flow-description text-muted">{{ flow.description }}</p>

        <div class="inputs-form">
          <div v-for="input in flow.inputs" :key="input.name" class="input-field">
            <label class="field-label">
              {{ input.label }}
              <span v-if="input.required" class="required">*</span>
            </label>

            <!-- Text/Textarea -->
            <textarea
              v-if="input.type === 'textarea'"
              v-model="inputValues[input.name]"
              class="input"
              rows="4"
              :placeholder="input.placeholder || ''"
              :disabled="isRunning"
            />

            <input
              v-else-if="input.type === 'text'"
              v-model="inputValues[input.name]"
              type="text"
              class="input"
              :placeholder="input.placeholder || ''"
              :disabled="isRunning"
            />

            <!-- File -->
            <div v-else-if="input.type === 'file'" class="file-input">
              <input
                type="text"
                class="input"
                :value="inputValues[input.name] || ''"
                readonly
                :placeholder="input.placeholder || 'Select a file...'"
              />
              <button
                class="btn btn-secondary"
                :disabled="isRunning"
                @click="handleFileSelect(input.name)"
              >
                Browse
              </button>
            </div>

            <!-- Select -->
            <select
              v-else-if="input.type === 'select'"
              v-model="inputValues[input.name]"
              class="input"
              :disabled="isRunning"
            >
              <option v-for="opt in input.options" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </select>

            <!-- Toggle -->
            <label v-else-if="input.type === 'toggle'" class="toggle">
              <input
                v-model="inputValues[input.name]"
                type="checkbox"
                class="toggle-input"
                :disabled="isRunning"
              />
              <span class="toggle-slider" />
            </label>
          </div>
        </div>

        <!-- Validation errors -->
        <div v-if="!inputValidation.valid" class="validation-message">
          Missing required fields: {{ inputValidation.missing.join(', ') }}
        </div>

        <!-- Progress -->
        <div v-if="isRunning" class="progress-section">
          <div class="progress">
            <div
              class="progress-bar"
              :style="{ width: `${((currentStep + 1) / flow.steps.length) * 100}%` }"
            />
          </div>
          <p class="progress-text text-muted">
            Running step {{ currentStep + 1 }} of {{ flow.steps.length }}:
            {{ flow.steps[currentStep]?.name }}
          </p>
        </div>

        <!-- Error -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>

      <!-- Results -->
      <div v-else class="results-section">
        <div class="result-header">
          <span class="result-status" :class="result.success ? 'success' : 'error'">
            {{ result.success ? '✓ Complete' : '✕ Failed' }}
          </span>
          <span class="result-duration text-subtle">
            {{ (result.duration / 1000).toFixed(1) }}s
          </span>
        </div>

        <div class="result-output">
          <h4 class="output-title">Output</h4>
          <pre class="output-content">{{ result.output }}</pre>
        </div>

        <div v-if="Object.keys(result.stepResults).length > 1" class="step-results">
          <h4 class="output-title">Step Results</h4>
          <div v-for="(value, key) in result.stepResults" :key="key" class="step-result">
            <span class="step-key">{{ key }}</span>
            <pre class="step-value">{{ value }}</pre>
          </div>
        </div>
      </div>
    </div>

    <footer class="runner-footer">
      <button v-if="result" class="btn btn-secondary" @click="result = null">
        Run Again
      </button>
      <div class="spacer" />
      <button
        v-if="!result"
        class="btn btn-primary"
        :disabled="!canRun"
        @click="handleRun"
      >
        {{ isRunning ? 'Running...' : 'Run Flow' }}
      </button>
      <button v-else class="btn btn-primary" @click="handleClose">
        Done
      </button>
    </footer>
  </div>
</template>

<style scoped>
.flow-runner {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.runner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.flow-icon {
  font-size: var(--text-xl);
}

.flow-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.runner-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.flow-description {
  margin-bottom: var(--space-6);
}

.inputs-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.required {
  color: var(--color-error);
}

.file-input {
  display: flex;
  gap: var(--space-2);
}

.file-input .input {
  flex: 1;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  transition: all var(--duration-normal) var(--ease-out);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: var(--color-text-muted);
  transition: all var(--duration-normal) var(--ease-out);
}

.toggle-input:checked + .toggle-slider {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: var(--color-accent);
}

.validation-message {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: rgba(234, 179, 8, 0.1);
  border: var(--border-width) solid var(--color-warning);
  color: var(--color-warning);
  font-size: var(--text-sm);
}

.progress-section {
  margin-top: var(--space-6);
}

.progress-text {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
}

.error-message {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border: var(--border-width) solid var(--color-error);
  color: var(--color-error);
  font-size: var(--text-sm);
}

.results-section {
  max-width: 700px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.result-status {
  font-weight: var(--weight-semibold);
}

.result-status.success {
  color: var(--color-success);
}

.result-status.error {
  color: var(--color-error);
}

.result-output,
.step-results {
  margin-bottom: var(--space-4);
}

.output-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.output-content {
  padding: var(--space-4);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.step-result {
  margin-bottom: var(--space-3);
}

.step-key {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-accent);
  margin-bottom: var(--space-1);
}

.step-value {
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-xs);
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
}

.runner-footer {
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
