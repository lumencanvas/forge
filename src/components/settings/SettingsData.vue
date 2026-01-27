<script setup lang="ts">
import { ref } from 'vue'
import { useChatsStore } from '@/stores/chats'
import { useSettingsStore } from '@/stores/settings'

const chatsStore = useChatsStore()
const settingsStore = useSettingsStore()

const exportStatus = ref<string | null>(null)
const importStatus = ref<string | null>(null)
const isExporting = ref(false)
const isImporting = ref(false)

async function handleExport() {
  isExporting.value = true
  exportStatus.value = null

  try {
    const result = await window.silo.data.exportToFile()
    if (result.success) {
      exportStatus.value = `Exported to ${result.path}`
    } else {
      exportStatus.value = 'Export cancelled'
    }
  } catch (e) {
    exportStatus.value = `Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`
  } finally {
    isExporting.value = false
  }
}

async function handleImport() {
  isImporting.value = true
  importStatus.value = null

  try {
    const result = await window.silo.data.importFromFile()
    if (result.success) {
      importStatus.value = 'Import successful. Reloading data...'
      // Reload stores
      await settingsStore.load()
      await chatsStore.loadChats()
      importStatus.value = 'Import complete!'
    } else {
      importStatus.value = 'Import cancelled'
    }
  } catch (e) {
    importStatus.value = `Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`
  } finally {
    isImporting.value = false
  }
}

async function handleClearChats() {
  if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
    return
  }

  try {
    await chatsStore.clearAllChats()
    importStatus.value = 'All chats cleared'
  } catch (e) {
    importStatus.value = `Failed to clear chats: ${e instanceof Error ? e.message : 'Unknown error'}`
  }
}

async function handleResetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    return
  }

  try {
    await settingsStore.reset()
    importStatus.value = 'Settings reset to defaults'
  } catch (e) {
    importStatus.value = `Failed to reset: ${e instanceof Error ? e.message : 'Unknown error'}`
  }
}
</script>

<template>
  <div class="settings-section">
    <h3 class="section-title">Data Management</h3>

    <div class="setting-group">
      <h4 class="group-title">Export & Backup</h4>
      <p class="group-description text-muted">
        Export your settings and chat history to a JSON file for backup or transfer.
      </p>

      <div class="action-row">
        <button
          class="btn btn-secondary"
          :disabled="isExporting"
          @click="handleExport"
        >
          {{ isExporting ? 'Exporting...' : 'Export Data' }}
        </button>
      </div>

      <div v-if="exportStatus" class="status-message">
        {{ exportStatus }}
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">Import & Restore</h4>
      <p class="group-description text-muted">
        Import settings and chat history from a previously exported backup file.
      </p>

      <div class="action-row">
        <button
          class="btn btn-secondary"
          :disabled="isImporting"
          @click="handleImport"
        >
          {{ isImporting ? 'Importing...' : 'Import Data' }}
        </button>
      </div>

      <div v-if="importStatus" class="status-message">
        {{ importStatus }}
      </div>
    </div>

    <div class="setting-group danger-zone">
      <h4 class="group-title">Danger Zone</h4>
      <p class="group-description text-muted">
        These actions are irreversible. Please be certain before proceeding.
      </p>

      <div class="danger-actions">
        <div class="danger-item">
          <div class="danger-info">
            <span class="danger-label">Clear Chat History</span>
            <span class="danger-description">Delete all saved conversations</span>
          </div>
          <button class="btn btn-danger btn-sm" @click="handleClearChats">
            Clear All Chats
          </button>
        </div>

        <div class="danger-item">
          <div class="danger-info">
            <span class="danger-label">Reset Settings</span>
            <span class="danger-description">Restore all settings to defaults</span>
          </div>
          <button class="btn btn-danger btn-sm" @click="handleResetSettings">
            Reset Settings
          </button>
        </div>
      </div>
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
  margin-bottom: var(--space-2);
}

.group-description {
  font-size: var(--text-xs);
  margin-bottom: var(--space-4);
}

.action-row {
  display: flex;
  gap: var(--space-3);
}

.status-message {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--text-sm);
}

.danger-zone .group-title {
  color: var(--color-error);
}

.danger-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: rgba(239, 68, 68, 0.05);
  border: var(--border-width) solid rgba(239, 68, 68, 0.2);
}

.danger-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.danger-label {
  font-weight: var(--weight-medium);
}

.danger-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.btn-danger {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}
</style>
