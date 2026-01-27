<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const sendOnEnter = computed({
  get: () => settingsStore.sendOnEnter,
  set: (v) => settingsStore.update('sendOnEnter', v)
})

const showTimestamps = computed({
  get: () => settingsStore.showTimestamps,
  set: (v) => settingsStore.update('showTimestamps', v)
})

const theme = computed({
  get: () => settingsStore.theme,
  set: (v) => settingsStore.update('theme', v)
})
</script>

<template>
  <div class="settings-section">
    <h3 class="section-title">General Settings</h3>

    <div class="setting-group">
      <h4 class="group-title">Appearance</h4>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Theme</label>
          <p class="setting-description">Choose the app color scheme</p>
        </div>
        <select v-model="theme" class="input setting-select">
          <option value="dark">Dark</option>
          <option value="light">Light (Coming Soon)</option>
          <option value="system">System</option>
        </select>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">Chat Behavior</h4>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Send on Enter</label>
          <p class="setting-description">Press Enter to send messages (Shift+Enter for new line)</p>
        </div>
        <label class="toggle">
          <input v-model="sendOnEnter" type="checkbox" class="toggle-input" />
          <span class="toggle-slider" />
        </label>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Show Timestamps</label>
          <p class="setting-description">Display timestamps on chat messages</p>
        </div>
        <label class="toggle">
          <input v-model="showTimestamps" type="checkbox" class="toggle-input" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">Privacy</h4>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Local Processing</label>
          <p class="setting-description">All AI processing happens on your device</p>
        </div>
        <span class="badge badge-success">Enabled</span>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Data Collection</label>
          <p class="setting-description">SILO never sends your data to external servers</p>
        </div>
        <span class="badge badge-success">None</span>
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
  margin-bottom: 0;
  padding-bottom: 0;
}

.group-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-weight: var(--weight-medium);
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.setting-select {
  width: auto;
  min-width: 120px;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--color-surface-raised);
  border: var(--border-width) solid var(--color-border);
  transition: all var(--duration-normal) var(--ease-out);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: var(--color-text-muted);
  transition: all var(--duration-normal) var(--ease-out);
}

.toggle-input:checked + .toggle-slider {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: var(--color-accent);
}

.toggle-input:focus + .toggle-slider {
  outline: var(--border-width-2) solid var(--color-accent);
  outline-offset: 2px;
}
</style>
