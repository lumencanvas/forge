<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  disabled?: boolean
  isStreaming?: boolean
  sendOnEnter?: boolean
}>()

const emit = defineEmits<{
  submit: [message: string, images?: string[]]
  stop: []
  attach: []
}>()

const message = ref('')
const attachedImages = ref<string[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSubmit = computed(() =>
  !props.disabled && !props.isStreaming && message.value.trim().length > 0
)

// Auto-resize textarea
watch(message, () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
  }
})

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', message.value.trim(), attachedImages.value.length > 0 ? attachedImages.value : undefined)
  message.value = ''
  attachedImages.value = []
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && props.sendOnEnter !== false) {
    e.preventDefault()
    handleSubmit()
  }
}

function handleStop() {
  emit('stop')
}

async function handleAttach() {
  try {
    const files = await window.silo.files.selectFiles()
    // For now, just store paths. In production, we'd read and convert to base64
    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        attachedImages.value.push(file)
      }
    }
  } catch (e) {
    console.error('Failed to attach files:', e)
  }
}

function removeAttachment(index: number) {
  attachedImages.value = attachedImages.value.filter((_, i) => i !== index)
}

function focus() {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="chat-input">
    <!-- Attachments preview -->
    <div v-if="attachedImages.length > 0" class="attachments-preview">
      <div v-for="(img, idx) in attachedImages" :key="idx" class="attachment-item">
        <span class="attachment-name">{{ img.split('/').pop() }}</span>
        <button class="attachment-remove" @click="removeAttachment(idx)">✕</button>
      </div>
    </div>

    <div class="input-container">
      <button
        class="btn btn-ghost attach-btn"
        title="Attach files"
        @click="handleAttach"
      >
        [+]
      </button>

      <textarea
        ref="textareaRef"
        v-model="message"
        class="input-textarea"
        placeholder="Type your message..."
        rows="1"
        :disabled="disabled"
        @keydown="handleKeydown"
      />

      <button
        v-if="isStreaming"
        class="btn btn-secondary stop-btn"
        @click="handleStop"
      >
        Stop
      </button>
      <button
        v-else
        class="btn btn-primary send-btn"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        Send
      </button>
    </div>

    <div class="input-hint text-subtle">
      {{ sendOnEnter !== false ? 'Enter to send, Shift+Enter for new line' : 'Click Send to submit' }}
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  padding: var(--space-4);
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
}

.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-xs);
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-remove {
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--text-xs);
}

.attachment-remove:hover {
  color: var(--color-error);
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
}

.input-container:focus-within {
  border-color: var(--color-accent);
}

.attach-btn {
  flex-shrink: 0;
  padding: var(--space-2);
}

.input-textarea {
  flex: 1;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  resize: none;
  line-height: var(--leading-normal);
  min-height: 24px;
  max-height: 200px;
}

.input-textarea::placeholder {
  color: var(--color-text-subtle);
}

.input-textarea:focus {
  outline: none;
}

.input-textarea:disabled {
  opacity: 0.5;
}

.send-btn,
.stop-btn {
  flex-shrink: 0;
}

.stop-btn {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.input-hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  text-align: center;
}
</style>
