<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [message: string]
  focus: []
}>()

const message = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const canSubmit = computed(() => !props.disabled && message.value.trim().length > 0)

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', message.value.trim())
  message.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

function handleFocus() {
  emit('focus')
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="quick-input">
    <div class="quick-input-container">
      <span class="quick-icon">[>]</span>
      <textarea
        ref="inputRef"
        v-model="message"
        class="quick-textarea"
        placeholder="Ask anything..."
        rows="1"
        :disabled="disabled"
        @keydown="handleKeydown"
        @focus="handleFocus"
      />
      <button
        class="btn btn-primary quick-submit"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        Send
      </button>
    </div>
    <p class="quick-hint text-subtle">
      Press Enter to send, Shift+Enter for new line
    </p>
  </div>
</template>

<style scoped>
.quick-input {
  margin-top: var(--space-8);
}

.quick-input-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: var(--border-width-2) solid var(--color-border);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.quick-input-container:focus-within {
  border-color: var(--color-accent);
}

.quick-icon {
  flex-shrink: 0;
  font-size: var(--text-lg);
  opacity: 0.5;
}

.quick-textarea {
  flex: 1;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  resize: none;
  line-height: var(--leading-normal);
  min-height: 24px;
  max-height: 120px;
}

.quick-textarea::placeholder {
  color: var(--color-text-subtle);
}

.quick-textarea:focus {
  outline: none;
}

.quick-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-submit {
  flex-shrink: 0;
}

.quick-hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  text-align: center;
}
</style>
