<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSetupStore } from '@/stores/setup'
import { useSettingsStore } from '@/stores/settings'
import { useHardwareStore } from '@/stores/hardware'
import type { ModelPullProgress } from '../../electron/preload/index.d'

const setupStore = useSetupStore()
const settingsStore = useSettingsStore()
const hardwareStore = useHardwareStore()

const emit = defineEmits<{
  complete: []
}>()

let cleanupPullProgress: (() => void) | undefined
let cleanupStatusChange: (() => void) | undefined

onMounted(() => {
  // Listen for model pull progress (unified API)
  cleanupPullProgress = window.silo.models.onPullProgress((data: ModelPullProgress) => {
    setupStore.updatePullProgress(data.model, data.progress)
    if (data.status === 'complete') {
      setupStore.completePulling(data.model)
      refreshModels()
    }
  })

  // Listen for provider status changes
  cleanupStatusChange = window.silo.models.onStatusChange((status) => {
    setupStore.setProvidersStatus(status)
  })
})

onUnmounted(() => {
  cleanupPullProgress?.()
  cleanupStatusChange?.()
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
      details: `${info.gpu.name || 'No GPU'} • ${Math.round(info.memory.total)}GB RAM`
    })
  } catch (e) {
    setupStore.updateCheck('Hardware Detection', {
      status: 'fail',
      message: 'Failed to detect hardware',
      details: e instanceof Error ? e.message : 'Unknown error'
    })
  }

  // Built-in Models (Transformers.js) - check first, this should always work
  setupStore.updateCheck('Built-in Models', { status: 'checking' })
  try {
    const status = await window.silo.models.getStatus()
    setupStore.setProvidersStatus(status)

    const transformers = status.providers.find(p => p.type === 'transformers')
    if (transformers?.status === 'available') {
      const modelCount = transformers.models.length
      setupStore.updateCheck('Built-in Models', {
        status: 'pass',
        message: 'Built-in AI ready',
        details: `${modelCount} models available (~285MB total)`
      })
    } else {
      setupStore.updateCheck('Built-in Models', {
        status: 'warning',
        message: 'Built-in models loading',
        details: 'Models will download on first use'
      })
    }
  } catch (e) {
    setupStore.updateCheck('Built-in Models', {
      status: 'warning',
      message: 'Built-in models will load on demand',
      details: 'First use may require download'
    })
  }

  // Ollama service - optional, not blocking
  setupStore.updateCheck('Ollama Service', { status: 'checking' })
  try {
    const result = await window.silo.ollama.listModels()

    if (result.status === 'error' || result.error) {
      setupStore.updateCheck('Ollama Service', {
        status: 'warning',
        message: 'Ollama not installed',
        details: 'Optional: Install for larger models'
      })
    } else if (result.models && result.models.length > 0) {
      setupStore.updateCheck('Ollama Service', {
        status: 'pass',
        message: 'Ollama connected',
        details: `${result.models.length} model(s) installed`
      })
      setupStore.setInstalledModels(result.models)
    } else {
      setupStore.updateCheck('Ollama Service', {
        status: 'pass',
        message: 'Ollama connected',
        details: 'No models installed yet'
      })
    }
  } catch (e) {
    setupStore.updateCheck('Ollama Service', {
      status: 'warning',
      message: 'Ollama not available',
      details: 'Optional: Install from ollama.com'
    })
  }

  // Fetch all available models
  try {
    const models = await window.silo.models.list()
    setupStore.setAllAvailableModels(models)
  } catch (e) {
    console.error('Failed to list models:', e)
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
    const models = await window.silo.models.list()
    setupStore.setAllAvailableModels(models)

    // Also refresh Ollama models for backwards compatibility
    const result = await window.silo.ollama.listModels()
    if (result.status !== 'error' && result.models) {
      setupStore.setInstalledModels(result.models)
    }
  } catch (e) {
    console.error('Failed to refresh models:', e)
  }
}

async function pullModel(modelId: string) {
  setupStore.startPulling(modelId)
  try {
    await window.silo.models.pull(modelId)
  } catch (e) {
    setupStore.completePulling(modelId)
    console.error('Failed to pull model:', e)
  }
}

function isModelInstalled(modelId: string): boolean {
  // Check in unified model list
  const model = setupStore.allAvailableModels.find(m =>
    m.id === modelId || m.name === modelId
  )
  if (model?.isInstalled) return true

  // Check in Ollama models (legacy)
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
    setupVersion: 2 // Bump version for multi-backend
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
    // Can proceed if any model is selected and not currently pulling
    return setupStore.selectedModels.language !== '' && !setupStore.isPulling
  }
  return true
})

// Group models by provider for the selection UI
const builtInLanguageModels = computed(() =>
  setupStore.builtInModels.filter(m =>
    m.capabilities.includes('chat') || m.capabilities.includes('generate')
  )
)

const ollamaLanguageModels = computed(() => {
  // Combine installed Ollama models with recommended ones
  const installed = setupStore.installedModels.map(m => ({
    id: `ollama:${m.name}`,
    name: m.name,
    size: formatSize(m.size),
    speed: 'varies',
    tier: getTierFromSize(m.size),
    installed: true
  }))

  // Add recommended models from hardware info
  const recommended = setupStore.hardwareInfo?.recommendations.models.language || []

  // Merge, avoiding duplicates
  const all = [...installed]
  for (const rec of recommended) {
    if (!all.find(m => m.name === rec.id || m.id === `ollama:${rec.id}`)) {
      all.push({
        id: `ollama:${rec.id}`,
        name: rec.id,
        size: rec.size,
        speed: rec.speed,
        tier: rec.tier,
        installed: false
      })
    }
  }

  return all
})

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)}GB`
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)}MB`
}

function getTierFromSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb > 20) return 'SURPLUS'
  if (gb > 8) return 'HEAVY'
  if (gb > 3) return 'STEADY'
  return 'LEAN'
}

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

            <!-- Provider Summary -->
            <div v-if="setupStore.hasAnyProvider" class="provider-summary">
              <div class="provider-item" :class="{ available: setupStore.hasTransformers }">
                <span class="provider-icon">{{ setupStore.hasTransformers ? '✓' : '○' }}</span>
                <span class="provider-name">Built-in Models</span>
                <span class="provider-status">{{ setupStore.hasTransformers ? 'Ready' : 'Loading' }}</span>
              </div>
              <div class="provider-item" :class="{ available: setupStore.hasOllama, optional: !setupStore.hasOllama }">
                <span class="provider-icon">{{ setupStore.hasOllama ? '✓' : '!' }}</span>
                <span class="provider-name">Ollama</span>
                <span class="provider-status">{{ setupStore.hasOllama ? 'Connected' : 'Optional' }}</span>
              </div>
            </div>
          </div>

          <!-- Model Selection -->
          <div v-if="setupStore.currentStep === 'model-select'" class="setup-step">
            <h3>Select Your AI Setup</h3>
            <p class="text-muted">Choose how you want to use AI. You can always change this later.</p>

            <!-- Built-in Models Section -->
            <div class="model-section">
              <div class="section-header">
                <h4>Built-in Models <span class="label label-success">Works Now</span></h4>
                <p class="section-hint text-muted">Fast, lightweight models that run without additional setup</p>
              </div>
              <div class="model-grid">
                <button
                  v-for="model in builtInLanguageModels"
                  :key="model.id"
                  :class="['model-option', { selected: setupStore.selectedModels.language === model.id }]"
                  @click="setupStore.selectModel('language', model.id)"
                >
                  <span class="model-header">
                    <span class="model-name">{{ model.name }}</span>
                  </span>
                  <span class="model-meta">{{ model.sizeLabel }} • Fast</span>
                  <span class="model-description">{{ model.description }}</span>
                </button>
              </div>
            </div>

            <!-- Ollama Models Section -->
            <div v-if="setupStore.hasOllama || ollamaLanguageModels.length > 0" class="model-section">
              <div class="section-header">
                <h4>
                  Ollama Models
                  <span v-if="setupStore.hasOllama" class="label label-info">Connected</span>
                  <span v-else class="label label-warning">Requires Install</span>
                </h4>
                <p class="section-hint text-muted">Larger, more capable models. [R] = Recommended for your hardware</p>
              </div>
              <div class="model-grid">
                <button
                  v-for="model in ollamaLanguageModels"
                  :key="model.id"
                  :class="['model-option', {
                    selected: setupStore.selectedModels.language === model.id,
                    installed: model.installed,
                    disabled: !setupStore.hasOllama && !model.installed
                  }]"
                  :disabled="!setupStore.hasOllama && !model.installed"
                  @click="setupStore.selectModel('language', model.id)"
                >
                  <span class="model-header">
                    <span class="model-name">{{ model.name }}</span>
                    <span v-if="setupStore.hardwareInfo?.recommendations.models.language.find(r => r.id === model.name)?.recommended" class="model-recommended">[R]</span>
                  </span>
                  <span class="model-meta">{{ model.size }} • {{ model.speed }}</span>
                  <span class="model-tier">{{ model.tier }}</span>
                  <span v-if="model.installed" class="model-installed">Installed</span>
                  <span v-else-if="setupStore.pullingModels.has(model.id)" class="model-progress">
                    {{ Math.round(setupStore.pullProgress[model.id] || 0) }}%
                  </span>
                </button>
              </div>

              <!-- Download button for Ollama models -->
              <button
                v-if="setupStore.selectedModels.language.startsWith('ollama:') && !isModelInstalled(setupStore.selectedModels.language)"
                class="btn btn-secondary btn-sm"
                :disabled="setupStore.pullingModels.has(setupStore.selectedModels.language) || !setupStore.hasOllama"
                @click="pullModel(setupStore.selectedModels.language)"
              >
                {{ setupStore.pullingModels.has(setupStore.selectedModels.language) ? 'Downloading...' : 'Download Selected Model' }}
              </button>

              <!-- Install Ollama hint -->
              <div v-if="!setupStore.hasOllama" class="ollama-hint">
                <p class="text-subtle">
                  Want more powerful models?
                  <a href="https://ollama.com" target="_blank" rel="noopener">Install Ollama</a>
                  to access 7B+ parameter models.
                </p>
              </div>
            </div>

            <!-- Vision Models (Optional) -->
            <div v-if="recommendedVisionModels.length > 0 && setupStore.hasOllama" class="model-section">
              <h4>Vision Model <span class="label">Optional</span></h4>
              <p class="section-hint text-muted">For image understanding capabilities</p>
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
                @click="pullModel(`ollama:${setupStore.selectedModels.vision}`)"
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
                <span class="label">AI Backend</span>
                <span class="value">{{ setupStore.selectedModels.provider === 'transformers' ? 'Built-in' : 'Ollama' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Language Model</span>
                <span class="value">{{ setupStore.selectedModels.language || 'Not selected' }}</span>
              </div>
              <div v-if="setupStore.selectedModels.vision" class="summary-item">
                <span class="label">Vision Model</span>
                <span class="value">{{ setupStore.selectedModels.vision }}</span>
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
            {{ setupStore.currentStep === 'system-check' && setupStore.hasAnyProvider ? 'Continue' : 'Continue' }}
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
  max-width: 600px;
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
  margin-top: var(--space-4);
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

.provider-summary {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  justify-content: center;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-sm);
}

.provider-item.available {
  border-color: var(--color-success);
}

.provider-item.optional {
  border-color: var(--color-warning);
  opacity: 0.8;
}

.provider-icon {
  font-weight: var(--weight-bold);
}

.provider-item.available .provider-icon {
  color: var(--color-success);
}

.provider-item.optional .provider-icon {
  color: var(--color-warning);
}

.provider-status {
  color: var(--color-text-subtle);
  font-size: var(--text-xs);
}

.model-section {
  text-align: left;
  margin-bottom: var(--space-6);
}

.section-header {
  margin-bottom: var(--space-3);
}

.model-section h4 {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  margin-bottom: var(--space-1);
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

.model-option:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

.model-option.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.model-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.model-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
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

.ollama-hint {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-sm);
}

.ollama-hint a {
  color: var(--color-accent);
  text-decoration: underline;
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

.label {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width) solid var(--color-border);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.label-success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.label-info {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.label-warning {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
