<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useSettingsStore } from '@/stores/settings'
import { useSetupStore } from '@/stores/setup'
import { useFlowsStore } from '@/stores/flows'
import type { Flow } from '@/lib/flows/schema'

import SetupModal from '@/components/SetupModal.vue'
import HomeScreen from '@/components/HomeScreen.vue'
import ChatView from '@/components/ChatView.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import FlowLibrary from '@/components/flows/FlowLibrary.vue'
import FlowBuilderSimple from '@/components/flows/FlowBuilderSimple.vue'
import FlowBuilderMulti from '@/components/flows/FlowBuilderMulti.vue'
import FlowBuilderAI from '@/components/flows/FlowBuilderAI.vue'
import FlowSchema from '@/components/flows/FlowSchema.vue'
import FlowRunner from '@/components/flows/FlowRunner.vue'

// View types
type AppView =
  | 'home'
  | 'chat'
  | 'settings'
  | 'flows'
  | 'flow-builder-simple'
  | 'flow-builder-multi'
  | 'flow-builder-ai'
  | 'flow-schema'
  | 'flow-runner'

const hardwareStore = useHardwareStore()
const settingsStore = useSettingsStore()
const setupStore = useSetupStore()
const flowsStore = useFlowsStore()

// Navigation state
const currentView = ref<AppView>('home')

// Chat state
const chatId = ref<string | undefined>(undefined)
const chatPipelineId = ref<string | undefined>(undefined)
const chatInitialMessage = ref<string | undefined>(undefined)

// Flow state
const editingFlow = ref<Flow | undefined>(undefined)
const runningFlow = ref<Flow | undefined>(undefined)

let cleanupHardwareListener: (() => void) | undefined

onMounted(async () => {
  // Setup hardware listener
  cleanupHardwareListener = hardwareStore.setupListeners()

  // Load settings
  await settingsStore.load()

  // Detect hardware
  await hardwareStore.detect()

  // Show setup modal if first run
  if (!settingsStore.setupComplete) {
    setupStore.show()
  } else {
    // Even if setup is complete, check if Ollama is available
    // If not, show setup modal so user can see the system check
    try {
      const status = await window.silo.ollama.getStatus()
      if (!status.isReady) {
        setupStore.show()
        setupStore.goToStep('system-check')
      }
    } catch (e) {
      // If we can't get status, show setup modal
      setupStore.show()
      setupStore.goToStep('system-check')
    }
  }
})

onUnmounted(() => {
  cleanupHardwareListener?.()
})

// Navigation handlers
function goHome() {
  currentView.value = 'home'
  chatId.value = undefined
  chatPipelineId.value = undefined
  chatInitialMessage.value = undefined
  editingFlow.value = undefined
  runningFlow.value = undefined
}

function openChat(id?: string, pipelineId?: string, initialMessage?: string) {
  chatId.value = id
  chatPipelineId.value = pipelineId
  chatInitialMessage.value = initialMessage
  currentView.value = 'chat'
}

function openSettings() {
  currentView.value = 'settings'
}

function openFlows() {
  currentView.value = 'flows'
}

function openFlowBuilder(type: 'simple' | 'multi' | 'ai' | 'schema' = 'simple', flow?: Flow) {
  editingFlow.value = flow
  switch (type) {
    case 'simple':
      currentView.value = 'flow-builder-simple'
      break
    case 'multi':
      currentView.value = 'flow-builder-multi'
      break
    case 'ai':
      currentView.value = 'flow-builder-ai'
      break
    case 'schema':
      currentView.value = 'flow-schema'
      break
  }
}

function runFlow(flow: Flow) {
  runningFlow.value = flow
  currentView.value = 'flow-runner'
}

function handleSetupComplete() {
  // Refresh settings after setup
  settingsStore.load()
}

function handleFlowSelect(flow: Flow) {
  // Open chat with this flow
  openChat(undefined, flow.id)
}

function handleFlowEdit(flow: Flow) {
  openFlowBuilder('multi', flow)
}

function handleFlowCreate() {
  // Open simple builder for new flows
  openFlowBuilder('simple')
}

function handleFlowSave(flow: Flow) {
  openFlows()
}

function handleFlowCancel() {
  openFlows()
}

function handleFlowGenerated(flow: Flow) {
  openFlows()
}

function handleFlowRunComplete() {
  openFlows()
}
</script>

<template>
  <div class="app">
    <!-- Setup Modal (first run) -->
    <SetupModal @complete="handleSetupComplete" />

    <!-- Home Screen -->
    <HomeScreen
      v-if="currentView === 'home'"
      @open-chat="openChat"
      @open-settings="openSettings"
      @open-flows="openFlows"
    />

    <!-- Chat View -->
    <ChatView
      v-if="currentView === 'chat'"
      :initial-chat-id="chatId"
      :initial-flow-id="chatPipelineId"
      :initial-message="chatInitialMessage"
      @back="goHome"
      @open-settings="openSettings"
    />

    <!-- Settings Panel -->
    <SettingsPanel
      v-if="currentView === 'settings'"
      @close="goHome"
    />

    <!-- Flow Library -->
    <FlowLibrary
      v-if="currentView === 'flows'"
      @select="handleFlowSelect"
      @create="handleFlowCreate"
      @edit="handleFlowEdit"
      @close="goHome"
    />

    <!-- Flow Builders -->
    <FlowBuilderSimple
      v-if="currentView === 'flow-builder-simple'"
      @save="handleFlowSave"
      @cancel="handleFlowCancel"
    />

    <FlowBuilderMulti
      v-if="currentView === 'flow-builder-multi'"
      :initial-flow="editingFlow"
      @save="handleFlowSave"
      @cancel="handleFlowCancel"
    />

    <FlowBuilderAI
      v-if="currentView === 'flow-builder-ai'"
      @generated="handleFlowGenerated"
      @edit="(flow) => openFlowBuilder('multi', flow)"
      @cancel="handleFlowCancel"
    />

    <FlowSchema
      v-if="currentView === 'flow-schema'"
      :initial-flow="editingFlow"
      @save="handleFlowSave"
      @cancel="handleFlowCancel"
    />

    <!-- Flow Runner -->
    <FlowRunner
      v-if="currentView === 'flow-runner' && runningFlow"
      :flow="runningFlow"
      @complete="handleFlowRunComplete"
      @close="openFlows"
    />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
}
</style>
