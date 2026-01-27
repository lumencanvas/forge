<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSetupStore } from '@/stores/setup'
import { useSettingsStore } from '@/stores/settings'
import { useHardwareStore } from '@/stores/hardware'

const setupStore = useSetupStore()
const settingsStore = useSettingsStore()
const hardwareStore = useHardwareStore()

const emit = defineEmits<{
  complete: []
}>()

let cleanupPullProgress: (() => void) | undefined

onMounted(() => {
  cleanupPullProgress = window.silo.ollama.onPullProgress((data) => {
    setupStore.updatePullProgress(data.model, data.progress)
    if (data.progress >= 100) {
      setupStore.completePulling(data.model)
      refreshModels()
    }
  })
})

onUnmounted(() => {
  cleanupPullProgress?.()
})

// Run system checks when entering that step
watch(() => setupStore.currentStep, async (step) => {
  if (step === 'system-check') {
    await runSystemChecks()
  }
})

async function runSystemChecks() {
  // Hardware detection
  setupStore.updateCheck('Hardware Detection', { status: 'checking' })
  try {
    const info = await window.silo.hardware.detect()
    setupStore.setHardwareInfo(info)
    hardwareStore.setHardwareInfo(info)
    setupStore.updateCheck('Hardware Detection', {
      status: 'pass',
      message: `${info.tier.name} tier detected`,
      details: `${info.gpu.name || 'No GPU'} • ${Math.round(info.memory.total / 1024)}GB RAM`
    })
  } catch (e) {
    setupStore.updateCheck('Hardware Detection', {
      status: 'fail',
      message: 'Failed to detect hardware',
      details: e instanceof Error ? e.message : 'Unknown error'
    })
  }

  // Ollama service
  setupStore.updateCheck('Ollama Service', { status: 'checking' })
  try {
    const models = await window.silo.ollama.listModels()
    if (models && models.models) {
      setupStore.updateCheck('Ollama Service', {
        status: 'pass',
        message: 'Ollama is running',
        details: `${models.models.length} model(s) installed`
      })
      setupStore.setInstalledModels(models.models)
    } else {
      setupStore.updateCheck('Ollama Service', {
        status: 'warning',
        message: 'Ollama connected but no models found',
        details: 'You\'ll need to install at least one model'
      })
    }
  } catch (e) {
    setupStore.updateCheck('Ollama Service', {
      status: 'fail',
      message: 'Ollama not available',
      details: 'Make sure Ollama is installed and running'
    })
  }

  // Available models
  setupStore.updateCheck('Available Models', { status: 'checking' })
  await new Promise(r => setTimeout(r, 300))
  if (setupStore.installedModels.length > 0) {
    setupStore.updateCheck('Available Models', {
      status: 'pass',
      message: `${setupStore.installedModels.length} model(s) ready`,
      details: setupStore.installedModels.map(m => m.name).slice(0, 3).join(', ')
    })
  } else {
    setupStore.updateCheck('Available Models', {
      status: 'warning',
      message: 'No models installed',
      details: 'We\'ll help you install recommended models'
    })
  }

  // Storage access
  setupStore.updateCheck('Storage Access', { status: 'checking' })
  try {
    const path = await window.silo.storage.getUserDataPath()
    setupStore.updateCheck('Storage Access', {
      status: 'pass',
      message: 'Storage accessible',
      details: path
    })
  } catch (e) {
    setupStore.updateCheck('Storage Access', {
      status: 'fail',
      message: 'Storage access denied',
      details: 'Check app permissions'
    })
  }
}

async function refreshModels() {
  try {
    const models = await window.silo.ollama.listModels()
    if (models && models.models) {
      setupStore.setInstalledModels(models.models)
    }
  } catch (e) {
    console.error('Failed to refresh models:', e)
  }
}

async function pullModel(modelId: string) {
  setupStore.startPulling(modelId)
  try {
    await window.silo.ollama.pullModel(modelId)
  } catch (e) {
    setupStore.completePulling(modelId)
    console.error('Failed to pull model:', e)
  }
}

function isModelInstalled(modelId: string): boolean {
  return setupStore.installedModels.some(m =>
    m.name === modelId || m.name.startsWith(modelId + ':')
  )
}

async function completeSetup() {
  // Save selected models to settings
  await settingsStore.updateMany({
    defaultLanguageModel: setupStore.selectedModels.language,
    defaultVisionModel: setupStore.selectedModels.vision,
    setupComplete: true,
    setupVersion: 1
  })

  setupStore.hide()
  emit('complete')
}

const statusIcon = computed(() => (status: string) => {
  switch (status) {
    case 'pass': return '✓'
    case 'fail': return '✕'
    case 'warning': return '!'
    case 'checking': return '○'
    default: return '○'
  }
})

const canProceed = computed(() => {
  if (setupStore.currentStep === 'system-check') {
    return setupStore.allChecksPassed
  }
  if (setupStore.currentStep === 'model-select') {
    return setupStore.selectedModels.language !== '' && !setupStore.isPulling
  }
  return true
})

const recommendedLanguageModels = computed(() => {
  return setupStore.hardwareInfo?.recommendations.models.language || []
})

const recommendedVisionModels = computed(() => {
  return setupStore.hardwareInfo?.recommendations.models.vision || []
})
</script>

<template>
  <Teleport to="body">
    <div v-if="setupStore.isVisible" class="modal-overlay">
      <div class="modal setup-modal">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">Welcome to SILO</h2>
          <div class="setup-steps">
            <span
              v-for="(step, index) in ['welcome', 'system-check', 'model-select', 'complete']"
              :key="step"
              :class="['step-dot', { active: setupStore.currentStep === step, done: index < ['welcome', 'system-check', 'model-select', 'complete'].indexOf(setupStore.currentStep) }]"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="modal-content">
          <!-- Welcome -->
          <div v-if="setupStore.currentStep === 'welcome'" class="setup-step">
            <div class="welcome-icon">//</div>
            <h3>Local AI Workbench</h3>
            <p class="text-muted">
              SILO runs powerful AI models entirely on your device.
              Your data never leaves your machine.
            </p>
            <div class="feature-list">
              <div class="feature">
                <span class="feature-icon">[*]</span>
                <span>100% local & private</span>
              </div>
              <div class="feature">
                <span class="feature-icon">[>]</span>
                <span>Chat with AI assistants</span>
              </div>
              <div class="feature">
                <span class="feature-icon">[=]</span>
                <span>Analyze documents & images</span>
              </div>
              <div class="feature">
                <span class="feature-icon">[+]</span>
                <span>Build custom workflows</span>
              </div>
            </div>
          </div>

          <!-- System Check -->
          <div v-if="setupStore.currentStep === 'system-check'" class="setup-step">
            <h3>System Check</h3>
            <p class="text-muted">Checking your system capabilities...</p>

            <div class="check-list">
              <div
                v-for="check in setupStore.checks"
                :key="check.name"
                :class="['check-item', `status-${check.status}`]"
              >
                <span class="check-icon">{{ statusIcon(check.status) }}</span>
                <div class="check-info">
                  <span class="check-name">{{ check.name }}</span>
                  <span class="check-message">{{ check.message }}</span>
                  <span v-if="check.details" class="check-details">{{ check.details }}</span>
                </div>
              </div>
            </div>

            <div v-if="setupStore.hardwareInfo" class="hardware-summary">
              <div class="tier-badge-large" :class="`tier-${setupStore.hardwareInfo.tier.name.toLowerCase()}`">
                {{ setupStore.hardwareInfo.tier.name }}
              </div>
              <p class="text-subtle">
                Your system is ready for {{ setupStore.hardwareInfo.tier.name }} tier models
              </p>
            </div>
          </div>

          <!-- Model Selection -->
          <div v-if="setupStore.currentStep === 'model-select'" class="setup-step">
            <h3>Select Models</h3>
            <p class="text-muted">Choose the AI models to stock your reserve. We've recommended models based on your hardware.</p>

            <div class="model-section">
              <h4>Language Model <span class="label">Required</span></h4>
              <p class="section-hint text-muted">Models marked with [R] are recommended for your hardware tier</p>
              <div class="model-grid">
                <button
                  v-for="model in recommendedLanguageModels"
                  :key="model.id"
                  :class="['model-option', { selected: setupStore.selectedModels.language === model.id, installed: isModelInstalled(model.id), recommended: model.recommended }]"
                  @click="setupStore.selectModel('language', model.id)"
                >
                  <span class="model-header">
                    <span class="model-name">{{ model.id }}</span>
                    <span v-if="model.recommended" class="model-recommended">[R]</span>
                  </span>
                  <span class="model-meta">{{ model.size }} • {{ model.speed }}</span>
                  <span class="model-tier">{{ model.tier }}</span>
                  <span v-if="isModelInstalled(model.id)" class="model-installed">Installed</span>
                  <span v-else-if="setupStore.pullingModels.has(model.id)" class="model-progress">
                    {{ Math.round(setupStore.pullProgress[model.id] || 0) }}%
                  </span>
                </button>
              </div>
              <button
                v-if="setupStore.selectedModels.language && !isModelInstalled(setupStore.selectedModels.language)"
                class="btn btn-secondary btn-sm"
                :disabled="setupStore.pullingModels.has(setupStore.selectedModels.language)"
                @click="pullModel(setupStore.selectedModels.language)"
              >
                {{ setupStore.pullingModels.has(setupStore.selectedModels.language) ? 'Downloading...' : 'Download Selected Model' }}
              </button>
            </div>

            <div class="model-section">
              <h4>Vision Model <span class="label">Optional</span></h4>
              <p class="section-hint text-muted">Models marked with [R] are recommended for your hardware tier</p>
              <div class="model-grid">
                <button
                  v-for="model in recommendedVisionModels"
                  :key="model.id"
                  :class="['model-option', { selected: setupStore.selectedModels.vision === model.id, installed: isModelInstalled(model.id), recommended: model.recommended }]"
                  @click="setupStore.selectModel('vision', model.id)"
                >
                  <span class="model-header">
                    <span class="model-name">{{ model.id }}</span>
                    <span v-if="model.recommended" class="model-recommended">[R]</span>
                  </span>
                  <span class="model-meta">{{ model.size }} • {{ model.speed }}</span>
                  <span class="model-tier">{{ model.tier }}</span>
                  <span v-if="isModelInstalled(model.id)" class="model-installed">Installed</span>
                  <span v-else-if="setupStore.pullingModels.has(model.id)" class="model-progress">
                    {{ Math.round(setupStore.pullProgress[model.id] || 0) }}%
                  </span>
                </button>
              </div>
              <button
                v-if="setupStore.selectedModels.vision && !isModelInstalled(setupStore.selectedModels.vision)"
                class="btn btn-secondary btn-sm"
                :disabled="setupStore.pullingModels.has(setupStore.selectedModels.vision)"
                @click="pullModel(setupStore.selectedModels.vision)"
              >
                {{ setupStore.pullingModels.has(setupStore.selectedModels.vision) ? 'Downloading...' : 'Download Selected Model' }}
              </button>
            </div>
          </div>

          <!-- Complete -->
          <div v-if="setupStore.currentStep === 'complete'" class="setup-step">
            <div class="complete-icon">✓</div>
            <h3>You're All Set!</h3>
            <p class="text-muted">SILO is ready to use. Start chatting, analyzing documents, or build custom workflows.</p>

            <div class="setup-summary">
              <div class="summary-item">
                <span class="label">Hardware Tier</span>
                <span class="value">{{ setupStore.hardwareInfo?.tier.name }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Language Model</span>
                <span class="value">{{ setupStore.selectedModels.language || 'Not selected' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Vision Model</span>
                <span class="value">{{ setupStore.selectedModels.vision || 'Not selected' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            v-if="setupStore.currentStep !== 'welcome'"
            class="btn btn-ghost"
            @click="setupStore.prevStep"
          >
            Back
          </button>
          <div class="spacer" />
          <button
            v-if="setupStore.currentStep !== 'complete'"
            class="btn btn-primary"
            :disabled="!canProceed"
            @click="setupStore.nextStep"
          >
            Continue
          </button>
          <button
            v-else
            class="btn btn-primary"
            @click="completeSetup"
          >
            Start Using SILO
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.modal {
  background: var(--color-surface);
  border: var(--border-width-2) solid var(--color-border);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.setup-modal {
  min-height: 500px;
}

.modal-header {
  padding: var(--space-6);
  border-bottom: var(--border-width) solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.setup-steps {
  display: flex;
  gap: var(--space-2);
}

.step-dot {
  width: 8px;
  height: 8px;
  background: var(--color-border);
  transition: background var(--duration-normal) var(--ease-out);
}

.step-dot.active {
  background: var(--color-accent);
}

.step-dot.done {
  background: var(--color-success);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.setup-step {
  text-align: center;
}

.setup-step h3 {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-2);
}

.welcome-icon,
.complete-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.complete-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--color-success);
  color: var(--color-base);
  font-size: var(--text-2xl);
}

.feature-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-6);
  text-align: left;
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}

.feature-icon {
  font-size: var(--text-lg);
}

.check-list {
  text-align: left;
  margin: var(--space-6) 0;
}

.check-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-2);
}

.check-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

.check-item.status-pass .check-icon {
  color: var(--color-success);
}

.check-item.status-fail .check-icon {
  color: var(--color-error);
}

.check-item.status-warning .check-icon {
  color: var(--color-warning);
}

.check-item.status-checking .check-icon {
  color: var(--color-accent);
  animation: pulse 1s infinite;
}

.check-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.check-name {
  font-weight: var(--weight-medium);
}

.check-message {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.check-details {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.hardware-summary {
  margin-top: var(--space-6);
  padding: var(--space-4);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}

.tier-badge-large {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  margin-bottom: var(--space-2);
}

.model-section {
  text-align: left;
  margin-bottom: var(--space-6);
}

.model-section h4 {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-hint {
  font-size: var(--text-xs);
  margin-bottom: var(--space-3);
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.model-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: left;
}

.model-option:hover {
  border-color: var(--color-border-strong);
}

.model-option.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.model-option.recommended {
  border-color: var(--color-success);
}

.model-option.recommended.selected {
  border-color: var(--color-accent);
}

.model-option.installed {
  opacity: 1;
}

.model-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.model-name {
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
}

.model-recommended {
  font-size: var(--text-xs);
  color: var(--color-success);
  font-weight: var(--weight-bold);
}

.model-tier {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.model-meta {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.model-installed {
  font-size: var(--text-xs);
  color: var(--color-success);
  margin-top: var(--space-1);
}

.model-progress {
  font-size: var(--text-xs);
  color: var(--color-accent);
  margin-top: var(--space-1);
}

.setup-summary {
  text-align: left;
  margin-top: var(--space-6);
  padding: var(--space-4);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: var(--border-width) solid var(--color-border-subtle);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item .value {
  color: var(--color-text-strong);
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.spacer {
  flex: 1;
}
</style>
