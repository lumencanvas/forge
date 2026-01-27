<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChatsStore } from '@/stores/chats'
import { useSettingsStore } from '@/stores/settings'
import { useFlowsStore } from '@/stores/flows'
import { useHardwareStore } from '@/stores/hardware'
import type { OllamaModel } from '../../electron/preload/index.d'

import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import ChatMessageComponent from '@/components/chat/ChatMessage.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ModelSelector from '@/components/chat/ModelSelector.vue'
import SiloIcon from '@/components/SiloIcon.vue'

const props = defineProps<{
  initialChatId?: string
  initialFlowId?: string
  initialMessage?: string
}>()

const emit = defineEmits<{
  back: []
  openSettings: []
}>()

const chatsStore = useChatsStore()
const settingsStore = useSettingsStore()
const flowsStore = useFlowsStore()
const hardwareStore = useHardwareStore()

const models = ref<OllamaModel[]>([])
const selectedModel = ref('')
const sidebarCollapsed = ref(false)
const messagesRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<InstanceType<typeof ChatInput> | null>(null)
const isStreaming = ref(false)
const streamingMessageId = ref<string | null>(null)

// Pipeline-specific state
const currentPipeline = computed(() => {
  if (chatsStore.currentPipelineId) {
    return flowsStore.getFlow(chatsStore.currentPipelineId)
  }
  return null
})

const chatTitle = computed(() => {
  if (currentPipeline.value) {
    return currentPipeline.value.name
  }
  return 'New Chat'
})

const chatIcon = computed(() => {
  if (currentPipeline.value) {
    return currentPipeline.value.icon
  }
  return 'chat'
})

// Load models
onMounted(async () => {
  try {
    const result = await window.silo.ollama.listModels()
    models.value = result?.models || []

    // Set default model
    if (settingsStore.defaultLanguageModel) {
      selectedModel.value = settingsStore.defaultLanguageModel
    } else if (models.value.length > 0) {
      selectedModel.value = models.value[0]!.name
    }
  } catch (e) {
    console.error('Failed to load models:', e)
  }

  // Load chats
  await chatsStore.loadChats()

  // Handle initial state
  if (props.initialChatId) {
    await chatsStore.loadChat(props.initialChatId)
    if (chatsStore.currentModel) {
      selectedModel.value = chatsStore.currentModel
    }
  } else {
    // Start new chat
    const flowId = props.initialFlowId || 'builtin-chat'
    chatsStore.startNewChat(selectedModel.value, flowId)

    // Handle initial message
    if (props.initialMessage) {
      await nextTick()
      await sendMessage(props.initialMessage)
    }
  }
})

// Scroll to bottom when messages change
watch(() => chatsStore.currentMessages, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}, { deep: true })

// Update chat model when selector changes
watch(selectedModel, (newModel) => {
  chatsStore.setModel(newModel)
})

async function sendMessage(content: string, images?: string[]) {
  if (!selectedModel.value || isStreaming.value) return

  // Add user message
  const userMessage = chatsStore.addMessage({
    role: 'user',
    content,
    images
  })

  // Add placeholder assistant message for streaming
  const assistantMessage = chatsStore.addMessage({
    role: 'assistant',
    content: '',
    model: selectedModel.value,
    isStreaming: true
  })

  streamingMessageId.value = assistantMessage.id
  isStreaming.value = true

  try {
    // Build messages for the API
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }> = []

    // Add system prompt from pipeline if applicable
    if (currentPipeline.value?.steps[0]?.prompt) {
      messages.push({
        role: 'system',
        content: currentPipeline.value.steps[0].prompt
      })
    }

    // Add conversation history
    for (const msg of chatsStore.currentMessages) {
      if (msg.id === assistantMessage.id) continue // Skip the placeholder
      if (msg.role === 'system') continue // Skip system messages already added
      messages.push({
        role: msg.role,
        content: msg.content,
        images: msg.images
      })
    }

    // Call the API
    const response = await window.silo.ollama.chat({
      model: selectedModel.value,
      messages
    })

    // Update the assistant message
    chatsStore.completeMessage(assistantMessage.id, response.message.content)

    // Save chat
    await chatsStore.saveCurrentChat()
  } catch (e) {
    console.error('Chat error:', e)
    chatsStore.completeMessage(
      assistantMessage.id,
      `Error: ${e instanceof Error ? e.message : 'Failed to get response'}`
    )
  } finally {
    isStreaming.value = false
    streamingMessageId.value = null
  }
}

function handleStop() {
  // In a real implementation, we'd abort the request
  isStreaming.value = false
  if (streamingMessageId.value) {
    const msg = chatsStore.currentMessages.find(m => m.id === streamingMessageId.value)
    if (msg) {
      chatsStore.completeMessage(streamingMessageId.value, msg.content + ' [stopped]')
    }
  }
}

function handleNewChat() {
  chatsStore.startNewChat(selectedModel.value, 'builtin-chat')
  inputRef.value?.focus()
}

async function handleSelectChat(chat: typeof chatsStore.chats[0]) {
  await chatsStore.loadChat(chat.id)
  if (chatsStore.currentModel) {
    selectedModel.value = chatsStore.currentModel
  }
}

async function handleDeleteChat(chatId: string) {
  await chatsStore.deleteChat(chatId)
  if (!chatsStore.currentChatId) {
    handleNewChat()
  }
}

async function handleRegenerateMessage() {
  // Remove last assistant message and resend
  const messages = chatsStore.currentMessages
  if (messages.length < 2) return

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMessage) {
    // Remove messages after user message
    const userIdx = messages.indexOf(lastUserMessage)
    const messagesToRemove = messages.slice(userIdx + 1)
    for (const msg of messagesToRemove) {
      chatsStore.currentMessages = chatsStore.currentMessages.filter(m => m.id !== msg.id)
    }

    // Resend
    await sendMessage(lastUserMessage.content, lastUserMessage.images)
  }
}

function handleBack() {
  emit('back')
}

function getTierClass(tierName: string): string {
  return `tier-${tierName.toLowerCase()}`
}
</script>

<template>
  <div class="chat-view">
    <!-- Sidebar -->
    <ChatSidebar
      :chats="chatsStore.chats"
      :current-chat-id="chatsStore.currentChatId"
      :collapsed="sidebarCollapsed"
      @select="handleSelectChat"
      @new="handleNewChat"
      @delete="handleDeleteChat"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- Main chat area -->
    <div class="chat-main">
      <!-- Header -->
      <header class="chat-header drag-region">
        <div class="header-left">
          <button class="btn btn-ghost btn-sm" @click="handleBack">
            [&lt;]
          </button>
          <SiloIcon :name="chatIcon" size="sm" />
          <h2 class="chat-title">{{ chatTitle }}</h2>
        </div>
        <div class="header-right">
          <ModelSelector
            v-model="selectedModel"
            :models="models"
          />
          <span
            v-if="hardwareStore.hardwareInfo"
            :class="['badge badge-sm', getTierClass(hardwareStore.tierName)]"
          >
            {{ hardwareStore.tierName }}
          </span>
          <button class="btn btn-ghost btn-sm icon-btn" @click="emit('openSettings')" aria-label="Settings">
            [:]
          </button>
        </div>
      </header>

      <!-- Messages -->
      <div ref="messagesRef" class="chat-messages">
        <div v-if="chatsStore.currentMessages.length === 0" class="chat-empty">
          <div v-if="currentPipeline" class="pipeline-intro">
            <SiloIcon :name="currentPipeline.icon" size="xl" class="pipeline-icon" />
            <h3>{{ currentPipeline.name }}</h3>
            <p class="text-muted">{{ currentPipeline.description }}</p>
          </div>
          <div v-else class="chat-intro">
            <h3>New Conversation</h3>
            <p class="text-muted">Start typing to begin a conversation with the AI.</p>
          </div>
        </div>

        <ChatMessageComponent
          v-for="message in chatsStore.currentMessages"
          :key="message.id"
          :message="message"
          :show-timestamp="settingsStore.showTimestamps"
          @regenerate="handleRegenerateMessage"
        />
      </div>

      <!-- Input -->
      <ChatInput
        ref="inputRef"
        :disabled="!selectedModel"
        :is-streaming="isStreaming"
        :send-on-enter="settingsStore.sendOnEnter"
        @submit="sendMessage"
        @stop="handleStop"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  height: 100%;
  background: var(--color-base);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: var(--border-width) solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.chat-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.badge-sm {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.pipeline-intro,
.chat-intro {
  max-width: 400px;
}

.pipeline-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: var(--space-4);
}

.pipeline-intro h3,
.chat-intro h3 {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-2);
}
</style>
