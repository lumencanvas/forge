<script setup lang="ts">
import { ref, onMounted } from 'vue'

const userDataPath = ref('')
const settingsPath = ref('')
const chatCount = ref(0)

onMounted(async () => {
  try {
    userDataPath.value = await window.silo.storage.getUserDataPath()
    settingsPath.value = await window.silo.storage.getPath()
    const chats = await window.silo.chats.getAll()
    chatCount.value = chats.length
  } catch (e) {
    console.error('Failed to load storage info:', e)
  }
})

function openFolder(path: string) {
  window.silo.shell.showItemInFolder(path)
}
</script>

<template>
  <div class="settings-section">
    <h3 class="section-title">Storage</h3>

    <div class="setting-group">
      <h4 class="group-title">Data Locations</h4>

      <div class="storage-item">
        <div class="storage-info">
          <span class="storage-label">User Data</span>
          <span class="storage-path">{{ userDataPath }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="openFolder(userDataPath)">
          Open
        </button>
      </div>

      <div class="storage-item">
        <div class="storage-info">
          <span class="storage-label">Settings</span>
          <span class="storage-path">{{ settingsPath }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="openFolder(settingsPath)">
          Open
        </button>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">Storage Usage</h4>

      <div class="storage-stats">
        <div class="stat-item">
          <span class="stat-value">{{ chatCount }}</span>
          <span class="stat-label">Saved Chats</span>
        </div>
      </div>

      <div class="storage-note">
        <p class="text-muted">
          <strong>Note:</strong> AI models are stored separately by Ollama.
          To manage model storage, use the Models tab or run
          <code>ollama list</code> in your terminal.
        </p>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">Ollama Storage</h4>
      <p class="group-description text-muted">
        Model files are managed by Ollama and typically stored in:
      </p>

      <div class="storage-locations">
        <div class="location-item">
          <span class="location-label">macOS</span>
          <code class="location-path">~/.ollama/models</code>
        </div>
        <div class="location-item">
          <span class="location-label">Windows</span>
          <code class="location-path">C:\Users\&lt;user&gt;\.ollama\models</code>
        </div>
        <div class="location-item">
          <span class="location-label">Linux</span>
          <code class="location-path">~/.ollama/models</code>
        </div>
      </div>

      <p class="text-subtle" style="margin-top: var(--space-4);">
        To clear model cache, run: <code>ollama rm &lt;model-name&gt;</code>
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  padding: var(--space-6);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-6);
  color: var(--color-text-strong);
}

.setting-group {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--color-border);
}

.setting-group:last-child {
  border-bottom: none;
}

.group-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.group-description {
  font-size: var(--text-xs);
  margin-bottom: var(--space-4);
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  margin-bottom: var(--space-2);
}

.storage-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.storage-label {
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
}

.storage-path {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  word-break: break-all;
}

.storage-stats {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  min-width: 100px;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--color-accent);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.storage-note {
  padding: var(--space-3);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border-subtle);
}

.storage-note code {
  background: var(--color-surface-raised);
  padding: var(--space-1) var(--space-2);
}

.storage-locations {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.location-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--color-surface-raised);
}

.location-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  width: 60px;
  color: var(--color-text-muted);
}

.location-path {
  font-size: var(--text-xs);
  color: var(--color-text);
}
</style>
