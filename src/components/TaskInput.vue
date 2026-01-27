<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [request: string]
}>()

const input = ref('')

const examples = [
  'Analyze these images and find common themes',
  'Summarize all documents and create a report',
  'Extract key information from these files',
  'Organize these files by content type'
]

function handleSubmit(e: Event) {
  e.preventDefault()
  if (input.value.trim() && !props.disabled) {
    emit('submit', input.value.trim())
    input.value = ''
  }
}
</script>

<template>
  <div class="task-input">
    <form @submit="handleSubmit">
      <div class="input-wrapper">
        <textarea
          v-model="input"
          class="input"
          placeholder="What do you want to do with these files?"
          :disabled="disabled"
          rows="3"
        />
        <button
          type="submit"
          :disabled="!input.trim() || disabled"
          class="btn btn-primary submit-btn"
        >
          Run
        </button>
      </div>
    </form>
    <div class="examples">
      <span class="label">Examples</span>
      <div class="example-chips">
        <button
          v-for="example in examples"
          :key="example"
          class="example-chip"
          @click="input = example"
        >
          {{ example }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-input {
  margin-top: var(--space-4);
}

.input-wrapper {
  position: relative;
}

.input {
  padding-right: 5rem;
  resize: none;
}

.submit-btn {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
}

.examples {
  margin-top: var(--space-4);
}

.examples .label {
  display: block;
  margin-bottom: var(--space-2);
}

.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.example-chip {
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  background: transparent;
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.example-chip:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}
</style>
