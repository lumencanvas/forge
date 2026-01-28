<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFlowsStore } from '@/stores/flows'
import { createSimpleFlow, type ModelType, type Flow } from '@/lib/flows/schema'
import SiloIcon from '@/components/SiloIcon.vue'

const flowsStore = useFlowsStore()

const emit = defineEmits<{
  save: [flow: Flow]
  cancel: []
  test: [flow: Flow]
}>()

// Wizard state
const currentStep = ref(1)
const totalSteps = 3

// Form data
const flowName = ref('')
const flowDescription = ref('')
const flowIcon = ref('tool')
const inputLabel = ref('')
const inputType = ref<'textarea' | 'file'>('textarea')
const modelType = ref<ModelType>('language')
const systemPrompt = ref('')

// Test state
const testInput = ref('')
const testResult = ref('')
const isTesting = ref(false)

const icons = ['tool', 'write', 'list', 'check', 'data', 'target', 'idea', 'search', 'doc', 'image', 'chat', 'creative']

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return flowName.value.trim() !== '' && flowDescription.value.trim() !== ''
    case 2:
      return inputLabel.value.trim() !== '' && systemPrompt.value.trim() !== ''
    case 3:
      return true
    default:
      return false
  }
})

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function buildFlow(): Flow {
  return createSimpleFlow(
    flowName.value,
    flowIcon.value,
    flowDescription.value,
    inputLabel.value,
    systemPrompt.value,
    modelType.value
  )
}

async function handleTest() {
  if (!testInput.value.trim()) return

  isTesting.value = true
  testResult.value = ''

  try {
    const flow = buildFlow()
    // For simple testing, just run the model directly
    const response = await window.silo.ollama.chat({
      model: modelType.value === 'language' ? 'llama3.2:3b' : 'llava:7b',
      messages: [
        { role: 'system', content: systemPrompt.value },
        { role: 'user', content: testInput.value }
      ]
    })
    testResult.value = response.message.content
  } catch (e) {
    testResult.value = `Error: ${e instanceof Error ? e.message : 'Test failed'}`
  } finally {
    isTesting.value = false
  }
}

function handleSave() {
  const flow = buildFlow()
  const savedFlow = flowsStore.createFlow(flow)
  emit('save', savedFlow)
}
</script>

<template>
  <div class="builder-simple">
    <header class="builder-header drag-region">
      <h2 class="builder-title">Create New Flow</h2>
      <div class="step-indicator">
        Step {{ currentStep }} of {{ totalSteps }}
      </div>
    </header>

    <div class="builder-content">
      <!-- Step 1: Basics -->
      <div v-if="currentStep === 1" class="wizard-step">
        <h3 class="step-title">Step 1: Basics</h3>

        <div class="form-field">
          <label class="field-label">Name your flow</label>
          <input
            v-model="flowName"
            type="text"
            class="input"
            placeholder="e.g., Meeting Action Items"
          />
        </div>

        <div class="form-field">
          <label class="field-label">What does it do? (short description)</label>
          <input
            v-model="flowDescription"
            type="text"
            class="input"
            placeholder="e.g., Extract action items from meeting notes"
          />
        </div>

        <div class="form-field">
          <label class="field-label">Pick an icon</label>
          <div class="icon-picker">
            <button
              v-for="icon in icons"
              :key="icon"
              :class="['icon-btn', { selected: flowIcon === icon }]"
              @click="flowIcon = icon"
            >
              <SiloIcon :name="icon" size="md" />
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Configure -->
      <div v-if="currentStep === 2" class="wizard-step">
        <h3 class="step-title">Step 2: Configure</h3>

        <div class="form-field">
          <label class="field-label">What does the user provide?</label>
          <div class="input-type-options">
            <label class="option-label">
              <input
                v-model="inputType"
                type="radio"
                value="textarea"
              />
              <span>Text input</span>
            </label>
            <label class="option-label">
              <input
                v-model="inputType"
                type="radio"
                value="file"
              />
              <span>File upload</span>
            </label>
          </div>
          <input
            v-model="inputLabel"
            type="text"
            class="input"
            placeholder="Label for the input field"
          />
        </div>

        <div class="form-field">
          <label class="field-label">What model type?</label>
          <div class="model-options">
            <label class="option-label">
              <input
                v-model="modelType"
                type="radio"
                value="language"
              />
              <span>Language model (text, analysis, writing)</span>
            </label>
            <label class="option-label">
              <input
                v-model="modelType"
                type="radio"
                value="vision"
              />
              <span>Vision model (images, screenshots, diagrams)</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label class="field-label">System prompt (how the AI behaves)</label>
          <textarea
            v-model="systemPrompt"
            class="input"
            rows="6"
            placeholder="Describe how the AI should process the input and what output format to use..."
          />
        </div>
      </div>

      <!-- Step 3: Test & Save -->
      <div v-if="currentStep === 3" class="wizard-step">
        <h3 class="step-title">Step 3: Test & Save</h3>

        <div class="flow-preview">
          <div class="preview-header">
            <SiloIcon :name="flowIcon" size="lg" class="preview-icon" />
            <span class="preview-name">{{ flowName }}</span>
          </div>
          <p class="preview-description">{{ flowDescription }}</p>
        </div>

        <div class="form-field">
          <label class="field-label">Test your flow</label>
          <textarea
            v-model="testInput"
            class="input"
            rows="4"
            :placeholder="`Enter sample ${inputLabel.toLowerCase() || 'input'}...`"
          />
          <button
            class="btn btn-secondary"
            :disabled="isTesting || !testInput.trim()"
            @click="handleTest"
          >
            {{ isTesting ? 'Testing...' : 'Run Test' }}
          </button>
        </div>

        <div v-if="testResult" class="test-result">
          <label class="field-label">Results</label>
          <div class="result-content">
            {{ testResult }}
          </div>
        </div>
      </div>
    </div>

    <footer class="builder-footer">
      <button v-if="currentStep > 1" class="btn btn-ghost" @click="prevStep">
        ← Back
      </button>
      <button class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
      <div class="spacer" />
      <button
        v-if="currentStep < totalSteps"
        class="btn btn-primary"
        :disabled="!canProceed"
        @click="nextStep"
      >
        Next →
      </button>
      <button
        v-else
        class="btn btn-primary"
        @click="handleSave"
      >
        Save Flow
      </button>
    </footer>
  </div>
</template>

<style scoped>
.builder-simple {
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
  /* Account for macOS traffic light buttons */
  padding-left: 80px;
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.builder-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.step-indicator {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.builder-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.wizard-step {
  max-width: 600px;
  margin: 0 auto;
}

.step-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-6);
  color: var(--color-text-strong);
}

.form-field {
  margin-bottom: var(--space-5);
}

.field-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-lg);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.icon-btn:hover {
  border-color: var(--color-border-strong);
}

.icon-btn.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.input-type-options,
.model-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.option-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-sm);
}

.option-label input {
  accent-color: var(--color-accent);
}

.flow-preview {
  padding: var(--space-4);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-6);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.preview-icon {
  font-size: var(--text-lg);
}

.preview-name {
  font-weight: var(--weight-semibold);
}

.preview-description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.test-result {
  margin-top: var(--space-4);
}

.result-content {
  padding: var(--space-4);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
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
