<script setup lang="ts">
import { ref } from 'vue'
import { useFlowsStore } from '@/stores/flows'
import type { Flow } from '@/lib/flows/schema'
import SiloIcon from '@/components/SiloIcon.vue'

const flowsStore = useFlowsStore()

const emit = defineEmits<{
  generated: [flow: Flow]
  edit: [flow: Flow]
  cancel: []
}>()

const description = ref('')
const isGenerating = ref(false)
const generatedFlow = ref<Flow | null>(null)
const error = ref<string | null>(null)

async function generateFlow() {
  if (!description.value.trim()) return

  isGenerating.value = true
  error.value = null
  generatedFlow.value = null

  try {
    // Use the language model to generate a flow schema
    const response = await window.silo.ollama.chat({
      model: 'llama3.2:3b',
      messages: [
        {
          role: 'system',
          content: `You are a workflow designer. Generate a JSON flow definition based on the user's description.

The flow must follow this schema:
{
  "name": "Flow name",
  "icon": "emoji icon",
  "description": "Brief description",
  "inputs": [
    { "name": "variable_name", "type": "textarea|file|text|select", "label": "Display label", "required": true }
  ],
  "steps": [
    { "name": "step_name", "model": "language|vision|audio", "input": "$variable_name", "prompt": "Instructions for AI", "output": "result_variable" }
  ]
}

Only output valid JSON, no explanation.`
        },
        {
          role: 'user',
          content: description.value
        }
      ]
    })

    // Parse the response
    const content = response.message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }

    const flowData = JSON.parse(jsonMatch[0])

    // Create the flow
    const flow: Flow = {
      id: `ai-generated-${Date.now()}`,
      name: flowData.name || 'AI Generated Flow',
      icon: flowData.icon || 'ai',
      description: flowData.description || description.value,
      category: 'custom',
      inputs: flowData.inputs || [],
      steps: flowData.steps || []
    }

    generatedFlow.value = flow
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to generate flow'
  } finally {
    isGenerating.value = false
  }
}

function handleSave() {
  if (!generatedFlow.value) return
  const saved = flowsStore.createFlow(generatedFlow.value)
  emit('generated', saved)
}

function handleEdit() {
  if (!generatedFlow.value) return
  emit('edit', generatedFlow.value)
}

function reset() {
  generatedFlow.value = null
  error.value = null
}
</script>

<template>
  <div class="builder-ai">
    <header class="builder-header drag-region">
      <h2 class="builder-title">AI Flow Builder</h2>
      <button class="btn btn-ghost btn-sm" @click="emit('cancel')">✕</button>
    </header>

    <div class="builder-content">
      <div v-if="!generatedFlow" class="input-section">
        <h3 class="section-title">Describe Your Workflow</h3>
        <p class="section-description text-muted">
          Tell the AI what you need in plain language. Be specific about:
          what input the user provides, what processing should happen, and what output you expect.
        </p>

        <textarea
          v-model="description"
          class="input description-input"
          rows="6"
          placeholder="Example: I need a flow that takes images of handwritten notes, transcribes them using vision, then organizes the content by topic with a summary at the top."
          :disabled="isGenerating"
        />

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button
          class="btn btn-primary"
          :disabled="isGenerating || !description.trim()"
          @click="generateFlow"
        >
          {{ isGenerating ? 'Generating...' : 'Generate Flow →' }}
        </button>
      </div>

      <div v-else class="result-section">
        <h3 class="section-title">Generated Flow</h3>

        <div class="flow-preview">
          <div class="preview-header">
            <SiloIcon :name="generatedFlow.icon" size="lg" class="preview-icon" />
            <span class="preview-name">{{ generatedFlow.name }}</span>
          </div>
          <p class="preview-description">{{ generatedFlow.description }}</p>

          <div class="preview-section">
            <h4 class="subsection-title">Inputs</h4>
            <div v-if="generatedFlow.inputs.length === 0" class="text-muted">
              No inputs defined
            </div>
            <div v-else class="preview-list">
              <div v-for="input in generatedFlow.inputs" :key="input.name" class="preview-item">
                <span class="item-type">{{ input.type }}</span>
                <span class="item-name">{{ input.name }}</span>
                <span class="item-label">{{ input.label }}</span>
                <span v-if="input.required" class="item-required">required</span>
              </div>
            </div>
          </div>

          <div class="preview-section">
            <h4 class="subsection-title">Steps</h4>
            <div v-if="generatedFlow.steps.length === 0" class="text-muted">
              No steps defined
            </div>
            <div v-else class="preview-steps">
              <div v-for="(step, idx) in generatedFlow.steps" :key="step.name" class="preview-step">
                <span class="step-number">{{ idx + 1 }}</span>
                <div class="step-info">
                  <span class="step-name">{{ step.name }}</span>
                  <span class="step-meta">
                    <span class="step-model">[{{ step.model }}]</span>
                    {{ step.input }} → {{ step.output }}
                  </span>
                  <span class="step-prompt">{{ step.prompt }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn btn-ghost" @click="reset">
            ← Try Again
          </button>
          <button class="btn btn-secondary" @click="handleEdit">
            Open in Builder
          </button>
          <button class="btn btn-primary" @click="handleSave">
            Save Flow
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.builder-ai {
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

.builder-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.input-section,
.result-section {
  max-width: 700px;
  margin: 0 auto;
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-2);
  color: var(--color-text-strong);
}

.section-description {
  margin-bottom: var(--space-4);
}

.description-input {
  width: 100%;
  margin-bottom: var(--space-4);
}

.error-message {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border: var(--border-width) solid var(--color-error);
  color: var(--color-error);
  font-size: var(--text-sm);
}

.flow-preview {
  padding: var(--space-4);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-4);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.preview-icon {
  font-size: var(--text-xl);
}

.preview-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.preview-description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.preview-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
}

.subsection-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface-raised);
  font-size: var(--text-xs);
}

.item-type {
  padding: var(--space-1) var(--space-2);
  background: var(--color-accent-glow);
  color: var(--color-accent);
  font-weight: var(--weight-medium);
}

.item-name {
  font-weight: var(--weight-medium);
}

.item-label {
  color: var(--color-text-muted);
  flex: 1;
}

.item-required {
  color: var(--color-warning);
  font-size: 10px;
  text-transform: uppercase;
}

.preview-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview-step {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-raised);
}

.step-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: var(--color-base);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.step-name {
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
}

.step-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.step-model {
  color: var(--color-accent);
}

.step-prompt {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
