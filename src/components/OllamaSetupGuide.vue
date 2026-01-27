<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOllama } from '@/composables/useOllama'

const emit = defineEmits<{
  close: []
  connected: []
}>()

const { status, statusError, checkConnection, isLoading } = useOllama()

const isChecking = ref(false)
const checkResult = ref<'success' | 'failed' | null>(null)

// Detect platform
const platform = computed(() => {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
})

const platformInstructions = computed(() => {
  switch (platform.value) {
    case 'macos':
      return {
        title: 'Install on macOS',
        steps: [
          'Download Ollama from ollama.com',
          'Open the downloaded file and drag to Applications',
          'Launch Ollama from Applications',
          'Ollama will run in your menu bar'
        ],
        brewCommand: 'brew install ollama'
      }
    case 'windows':
      return {
        title: 'Install on Windows',
        steps: [
          'Download Ollama from ollama.com',
          'Run the installer (OllamaSetup.exe)',
          'Follow the installation wizard',
          'Ollama will start automatically'
        ],
        brewCommand: null
      }
    case 'linux':
      return {
        title: 'Install on Linux',
        steps: [
          'Open a terminal',
          'Run: curl -fsSL https://ollama.com/install.sh | sh',
          'Start the service: ollama serve',
          'Ollama will run on localhost:11434'
        ],
        brewCommand: null
      }
    default:
      return {
        title: 'Install Ollama',
        steps: [
          'Visit ollama.com',
          'Download for your platform',
          'Follow the installation instructions',
          'Start Ollama'
        ],
        brewCommand: null
      }
  }
})

async function handleCheckConnection() {
  isChecking.value = true
  checkResult.value = null

  const result = await checkConnection()

  if (result.isReady) {
    checkResult.value = 'success'
    setTimeout(() => {
      emit('connected')
      emit('close')
    }, 1500)
  } else {
    checkResult.value = 'failed'
  }

  isChecking.value = false
}

function openOllamaWebsite() {
  window.silo?.shell.openPath('https://ollama.com')
}
</script>

<template>
  <div class="setup-guide">
    <div class="setup-guide-backdrop" @click="emit('close')" />

    <div class="setup-guide-modal">
      <button class="close-button" @click="emit('close')" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div class="setup-guide-header">
        <div class="icon-container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2>Set Up AI Features</h2>
        <p class="subtitle">SILO uses Ollama to run AI models locally on your device</p>
      </div>

      <div class="setup-guide-content">
        <div class="benefits">
          <div class="benefit">
            <span class="benefit-icon">🔒</span>
            <div>
              <strong>Private</strong>
              <span>All processing happens on your device</span>
            </div>
          </div>
          <div class="benefit">
            <span class="benefit-icon">⚡</span>
            <div>
              <strong>Fast</strong>
              <span>No internet required after setup</span>
            </div>
          </div>
          <div class="benefit">
            <span class="benefit-icon">🆓</span>
            <div>
              <strong>Free</strong>
              <span>No API keys or subscriptions needed</span>
            </div>
          </div>
        </div>

        <div class="instructions">
          <h3>{{ platformInstructions.title }}</h3>

          <ol class="steps">
            <li v-for="(step, index) in platformInstructions.steps" :key="index">
              {{ step }}
            </li>
          </ol>

          <div v-if="platformInstructions.brewCommand" class="brew-alternative">
            <span class="or-divider">or using Homebrew</span>
            <code>{{ platformInstructions.brewCommand }}</code>
          </div>
        </div>

        <div class="actions">
          <button class="download-button" @click="openOllamaWebsite">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Ollama
          </button>

          <button
            class="check-button"
            :class="{ success: checkResult === 'success', failed: checkResult === 'failed' }"
            :disabled="isChecking"
            @click="handleCheckConnection"
          >
            <template v-if="isChecking">
              <span class="spinner" />
              Checking...
            </template>
            <template v-else-if="checkResult === 'success'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Connected!
            </template>
            <template v-else-if="checkResult === 'failed'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Not Found - Try Again
            </template>
            <template v-else>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Check Connection
            </template>
          </button>
        </div>

        <p v-if="checkResult === 'failed'" class="error-hint">
          Make sure Ollama is running. Look for the Ollama icon in your
          {{ platform === 'macos' ? 'menu bar' : platform === 'windows' ? 'system tray' : 'system' }}.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup-guide {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setup-guide-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.setup-guide-modal {
  position: relative;
  width: 90%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 32px;
}

.close-button {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-button:hover {
  background: #333;
  color: #fff;
}

.setup-guide-header {
  text-align: center;
  margin-bottom: 24px;
}

.icon-container {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.setup-guide-header h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.subtitle {
  margin: 0;
  color: #888;
  font-size: 14px;
}

.benefits {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.benefit {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #222;
  border-radius: 10px;
}

.benefit-icon {
  font-size: 20px;
  line-height: 1;
}

.benefit strong {
  display: block;
  color: #fff;
  font-size: 13px;
  margin-bottom: 2px;
}

.benefit span {
  color: #888;
  font-size: 11px;
  line-height: 1.3;
}

.instructions {
  background: #222;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.instructions h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.steps {
  margin: 0;
  padding-left: 20px;
  color: #ccc;
  font-size: 14px;
  line-height: 1.8;
}

.steps li::marker {
  color: #3b82f6;
}

.brew-alternative {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #333;
  text-align: center;
}

.or-divider {
  display: block;
  color: #666;
  font-size: 12px;
  margin-bottom: 8px;
}

.brew-alternative code {
  display: inline-block;
  padding: 8px 16px;
  background: #111;
  border-radius: 6px;
  color: #3b82f6;
  font-family: monospace;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 12px;
}

.download-button,
.check-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.download-button {
  background: #333;
  color: #fff;
}

.download-button:hover {
  background: #444;
}

.check-button {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.check-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.check-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.check-button.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.check-button.failed {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-hint {
  margin: 16px 0 0;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  text-align: center;
}
</style>
