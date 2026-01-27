<script setup lang="ts">
import { useFilesStore } from '@/stores/files'

const filesStore = useFilesStore()
</script>

<template>
  <div v-if="filesStore.hasFiles" class="file-list card">
    <div class="file-list-header">
      <span class="label">{{ filesStore.fileCount }} item(s) selected</span>
      <button class="btn btn-ghost btn-sm" @click="filesStore.clearFiles">
        Clear
      </button>
    </div>
    <div class="file-list-items">
      <div
        v-for="(file, idx) in filesStore.files"
        :key="file.path"
        class="file-item"
      >
        <span class="file-icon">{{ filesStore.getIcon(file) }}</span>
        <span class="file-name">{{ file.name }}</span>
        <button class="file-remove btn btn-ghost btn-sm" @click="filesStore.removeFile(idx)">
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-list {
  margin-top: var(--space-4);
  padding: var(--space-4);
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.file-list-items {
  max-height: 10rem;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
}

.file-item:hover {
  background: var(--color-surface-raised);
}

.file-icon {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text-muted);
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-remove {
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.file-item:hover .file-remove {
  opacity: 1;
}
</style>
