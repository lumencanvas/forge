<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage } from '@/stores/chats'

const props = defineProps<{
  message: ChatMessage
  showTimestamp?: boolean
}>()

const emit = defineEmits<{
  copy: [content: string]
  regenerate: []
}>()

const showActions = ref(false)
const copied = ref(false)

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isSystem = computed(() => props.message.role === 'system')

const formattedTime = computed(() => {
  if (!props.showTimestamp) return ''
  const date = new Date(props.message.timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
    emit('copy', props.message.content)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

function regenerate() {
  emit('regenerate')
}
</script>

<template>
  <div
    :class="['chat-message', {
      'message-user': isUser,
      'message-assistant': isAssistant,
      'message-system': isSystem,
      'message-streaming': message.isStreaming
    }]"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <div class="message-header">
      <span class="message-role">
        {{ isUser ? 'You' : isAssistant ? 'Assistant' : 'System' }}
      </span>
      <span v-if="message.model && isAssistant" class="message-model">
        {{ message.model }}
      </span>
      <span v-if="formattedTime" class="message-time">
        {{ formattedTime }}
      </span>
    </div>

    <div class="message-content">
      <p v-if="message.content" class="message-text">{{ message.content }}</p>
      <span v-if="message.isStreaming" class="streaming-cursor">▌</span>

      <!-- Images -->
      <div v-if="message.images && message.images.length > 0" class="message-images">
        <div v-for="(img, idx) in message.images" :key="idx" class="message-image">
          <img :src="img" :alt="`Attached image ${idx + 1}`" />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="showActions && isAssistant && !message.isStreaming" class="message-actions">
      <button class="action-btn" title="Copy" @click="copyContent">
        {{ copied ? '[v]' : '[c]' }}
      </button>
      <button class="action-btn" title="Regenerate" @click="regenerate">
        [r]
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  position: relative;
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.message-user {
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  margin-left: var(--space-8);
}

.message-assistant {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-left: var(--border-width-4) solid var(--color-accent);
  margin-right: var(--space-8);
}

.message-system {
  background: var(--color-void);
  border: var(--border-width) solid var(--color-border-subtle);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0 var(--space-8);
}

.message-streaming {
  border-color: var(--color-accent);
}

.message-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
}

.message-role {
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--color-text-muted);
}

.message-user .message-role {
  color: var(--color-text);
}

.message-assistant .message-role {
  color: var(--color-accent);
}

.message-model {
  color: var(--color-text-subtle);
}

.message-time {
  color: var(--color-text-subtle);
  margin-left: auto;
}

.message-content {
  line-height: var(--leading-relaxed);
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  color: var(--color-accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.message-image {
  max-width: 200px;
  border: var(--border-width) solid var(--color-border);
  overflow: hidden;
}

.message-image img {
  width: 100%;
  height: auto;
  display: block;
}

.message-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
}

.action-btn {
  padding: var(--space-1);
  background: var(--color-surface-overlay);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  line-height: 1;
}

.action-btn:hover {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
}
</style>
