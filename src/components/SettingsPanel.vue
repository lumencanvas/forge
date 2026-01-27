<script setup lang="ts">
import { ref } from 'vue'

import SettingsGeneral from '@/components/settings/SettingsGeneral.vue'
import SettingsModels from '@/components/settings/SettingsModels.vue'
import SettingsStorage from '@/components/settings/SettingsStorage.vue'
import SettingsData from '@/components/settings/SettingsData.vue'

type SettingsTab = 'general' | 'models' | 'storage' | 'data'

const emit = defineEmits<{
  close: []
}>()

const activeTab = ref<SettingsTab>('general')

const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: '[:]' },
  { id: 'models', label: 'Models', icon: '[M]' },
  { id: 'storage', label: 'Storage', icon: '[D]' },
  { id: 'data', label: 'Data', icon: '[#]' }
]
</script>

<template>
  <div class="settings-panel">
    <!-- Header -->
    <header class="settings-header drag-region">
      <h2 class="settings-title">Settings</h2>
      <button class="btn btn-ghost btn-sm close-btn" @click="emit('close')">
        ✕
      </button>
    </header>

    <div class="settings-layout">
      <!-- Sidebar tabs -->
      <nav class="settings-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['nav-item', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Content area -->
      <main class="settings-content">
        <SettingsGeneral v-if="activeTab === 'general'" />
        <SettingsModels v-if="activeTab === 'models'" />
        <SettingsStorage v-if="activeTab === 'storage'" />
        <SettingsData v-if="activeTab === 'data'" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.settings-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.close-btn {
  font-size: var(--text-lg);
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 200px;
  min-width: 200px;
  background: var(--color-surface);
  border-right: var(--border-width) solid var(--color-border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  border: var(--border-width) solid transparent;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.nav-item:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.nav-item.active {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
  color: var(--color-text-strong);
}

.nav-icon {
  font-size: var(--text-base);
}

.nav-label {
  font-weight: var(--weight-medium);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
}
</style>
