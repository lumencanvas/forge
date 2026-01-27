<script setup lang="ts">
import { ref } from 'vue'
import { useFilesStore } from '@/stores/files'

const filesStore = useFilesStore()
const isDragging = ref(false)

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const paths = Array.from(files).map((f: any) => f.path).filter(Boolean)
    if (paths.length > 0) {
      filesStore.addFiles(paths)
    }
  }
}
</script>

<template>
  <div
    :class="['dropzone', { 'dropzone-active': isDragging }]"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="dropzone-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 15v6h18v-6" />
        <path d="M12 3v12" />
        <path d="M7 8l5-5 5 5" />
      </svg>
    </div>
    <p class="dropzone-text">Drop files or folders here</p>
    <div class="dropzone-actions">
      <button class="btn btn-secondary btn-sm" @click="filesStore.browseFiles">
        Browse Files
      </button>
      <button class="btn btn-secondary btn-sm" @click="filesStore.browseFolder">
        Choose Folder
      </button>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  text-align: center;
  cursor: pointer;
}

.dropzone-icon {
  color: var(--color-text-subtle);
  margin-bottom: var(--space-4);
  transition: color var(--duration-fast), transform var(--duration-fast);
}

.dropzone:hover .dropzone-icon,
.dropzone-active .dropzone-icon {
  color: var(--color-accent);
}

.dropzone-active .dropzone-icon {
  transform: translateY(-2px);
}

.dropzone-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.dropzone-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}
</style>
