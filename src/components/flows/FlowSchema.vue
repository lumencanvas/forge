<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFlowsStore } from '@/stores/flows'
import { validateFlow, type Flow } from '@/lib/flows/schema'

const flowsStore = useFlowsStore()

const props = defineProps<{
  initialFlow?: Flow
}>()

const emit = defineEmits<{
  save: [flow: Flow]
  cancel: []
}>()

const schemaText = ref('')
const error = ref<string | null>(null)

// Initialize with existing flow or empty template
watch(() => props.initialFlow, (flow) => {
  if (flow) {
    schemaText.value = JSON.stringify(flow, null, 2)
  } else {
    schemaText.value = JSON.stringify({
      name: '',
      icon: 'tool',
      description: '',
      inputs: [],
      steps: []
    }, null, 2)
  }
}, { immediate: true })

const parsedFlow = computed(() => {
  try {
    return JSON.parse(schemaText.value) as Partial<Flow>
  } catch {
    return null
  }
})

const validation = computed(() => {
  if (!parsedFlow.value) {
    return { valid: false, errors: ['Invalid JSON syntax'] }
  }
  return validateFlow(parsedFlow.value)
})

function formatJson() {
  try {
    const parsed = JSON.parse(schemaText.value)
    schemaText.value = JSON.stringify(parsed, null, 2)
    error.value = null
  } catch (e) {
    error.value = 'Invalid JSON: ' + (e instanceof Error ? e.message : 'Parse error')
  }
}

function validateSchema() {
  error.value = null
  if (!parsedFlow.value) {
    error.value = 'Invalid JSON syntax'
    return
  }

  const result = validateFlow(parsedFlow.value)
  if (!result.valid) {
    error.value = result.errors.join('\n')
  } else {
    error.value = null
    alert('Schema is valid!')
  }
}

function handleSave() {
  if (!validation.value.valid) {
    error.value = validation.value.errors.join('\n')
    return
  }

  const flow: Flow = {
    ...parsedFlow.value as Flow,
    id: props.initialFlow?.id || `custom-${Date.now()}`,
    category: 'custom'
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
  <div class="flow-schema">
    <header class="schema-header drag-region">
      <h2 class="schema-title">Flow Schema (Advanced)</h2>
      <button class="btn btn-ghost btn-sm" @click="emit('cancel')">✕</button>
    </header>

    <div class="schema-toolbar">
      <button class="btn btn-secondary btn-sm" @click="formatJson">
        Format
      </button>
      <button class="btn btn-secondary btn-sm" @click="validateSchema">
        Validate
      </button>
      <div class="spacer" />
      <span :class="['validation-status', validation.valid ? 'valid' : 'invalid']">
        {{ validation.valid ? '✓ Valid' : '✕ Invalid' }}
      </span>
    </div>

    <div class="schema-content">
      <textarea
        v-model="schemaText"
        class="schema-editor"
        spellcheck="false"
        placeholder="Enter flow JSON schema..."
      />

      <div v-if="error" class="error-panel">
        <h4 class="error-title">Validation Errors</h4>
        <pre class="error-content">{{ error }}</pre>
      </div>

      <div class="schema-help">
        <h4 class="help-title">Schema Reference</h4>
        <pre class="help-content">{
  "name": "string (required)",
  "icon": "icon name (e.g., chat, doc, image)",
  "description": "string",
  "inputs": [
    {
      "name": "variable_name",
      "type": "text|textarea|file|select",
      "label": "Display Label",
      "required": true|false,
      "accepts": ["image/*"] // for file type
    }
  ],
  "steps": [
    {
      "name": "step_name",
      "model": "language|vision|audio",
      "input": "$variable_name",
      "prompt": "AI instructions",
      "output": "result_variable"
    }
  ]
}</pre>
      </div>
    </div>

    <footer class="schema-footer">
      <button class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
      <div class="spacer" />
      <button
        class="btn btn-primary"
        :disabled="!validation.valid"
        @click="handleSave"
      >
        Save Flow
      </button>
    </footer>
  </div>
</template>

<style scoped>
.flow-schema {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.schema-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  /* Account for macOS traffic light buttons */
  padding-left: 80px;
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.schema-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.schema-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-surface);
  border-bottom: var(--border-width) solid var(--color-border);
}

.spacer {
  flex: 1;
}

.validation-status {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: var(--space-1) var(--space-2);
}

.validation-status.valid {
  color: var(--color-success);
}

.validation-status.invalid {
  color: var(--color-error);
}

.schema-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--space-4);
  gap: var(--space-4);
}

.schema-editor {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  padding: var(--space-4);
  background: var(--color-void);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text);
  resize: none;
}

.schema-editor:focus {
  outline: none;
  border-color: var(--color-accent);
}

.error-panel {
  padding: var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: var(--border-width) solid var(--color-error);
}

.error-title,
.help-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-2);
}

.error-title {
  color: var(--color-error);
}

.help-title {
  color: var(--color-text-muted);
}

.error-content,
.help-content {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: pre-wrap;
  margin: 0;
}

.error-content {
  color: var(--color-error);
}

.schema-help {
  padding: var(--space-4);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  max-height: 200px;
  overflow-y: auto;
}

.help-content {
  color: var(--color-text-muted);
}

.schema-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
