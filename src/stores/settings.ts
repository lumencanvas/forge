/**
 * SILO - Settings Store
 * Manages app preferences and configuration
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { AppSettings } from '../../electron/preload/index.d'

export type { AppSettings }

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed getters for common settings
  const theme = computed(() => settings.value?.theme ?? 'dark')
  const defaultLanguageModel = computed(() => settings.value?.defaultLanguageModel ?? '')
  const defaultVisionModel = computed(() => settings.value?.defaultVisionModel ?? '')
  const defaultAudioModel = computed(() => settings.value?.defaultAudioModel ?? '')
  const setupComplete = computed(() => settings.value?.setupComplete ?? false)
  const sendOnEnter = computed(() => settings.value?.sendOnEnter ?? true)
  const showTimestamps = computed(() => settings.value?.showTimestamps ?? true)

  async function load(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      settings.value = await window.silo.settings.getAll()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
      console.error('[Settings]', error.value)
    } finally {
      isLoading.value = false
    }
  }

  async function update<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    try {
      await window.silo.settings.set(key, value)
      if (settings.value) {
        settings.value = { ...settings.value, [key]: value }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update setting'
      console.error('[Settings]', error.value)
    }
  }

  async function updateMany(newSettings: Partial<AppSettings>): Promise<void> {
    try {
      await window.silo.settings.setAll(newSettings)
      if (settings.value) {
        settings.value = { ...settings.value, ...newSettings }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update settings'
      console.error('[Settings]', error.value)
    }
  }

  async function reset(): Promise<void> {
    try {
      await window.silo.settings.reset()
      await load()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reset settings'
      console.error('[Settings]', error.value)
    }
  }

  async function completeSetup(): Promise<void> {
    await update('setupComplete', true)
    await update('setupVersion', 1)
  }

  return {
    settings,
    isLoading,
    error,
    theme,
    defaultLanguageModel,
    defaultVisionModel,
    defaultAudioModel,
    setupComplete,
    sendOnEnter,
    showTimestamps,
    load,
    update,
    updateMany,
    reset,
    completeSetup
  }
})
