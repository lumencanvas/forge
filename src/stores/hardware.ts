import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { HardwareInfo } from '../../electron/preload/index.d'

export const useHardwareStore = defineStore('hardware', () => {
  const hardwareInfo = ref<HardwareInfo | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const tier = computed(() => hardwareInfo.value?.tier)
  const tierName = computed(() => tier.value?.name || 'Unknown')
  const tierLevel = computed(() => tier.value?.level || 0)

  const gpu = computed(() => hardwareInfo.value?.gpu)
  const memory = computed(() => hardwareInfo.value?.memory)
  const recommendations = computed(() => hardwareInfo.value?.recommendations)

  const tierColors: Record<string, string> = {
    LEAN: 'bg-neutral-600 text-neutral-200',
    STEADY: 'bg-blue-600 text-white',
    HEAVY: 'bg-purple-600 text-white',
    SURPLUS: 'bg-green-600 text-white'
  }

  const tierColor = computed(() => tierColors[tierName.value] || 'bg-neutral-700 text-neutral-200')

  async function detect(forceRefresh = false) {
    isLoading.value = true
    error.value = null

    try {
      const info = await window.silo.hardware.detect()
      hardwareInfo.value = info
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to detect hardware'
      console.error('[Hardware]', error.value)
    } finally {
      isLoading.value = false
    }
  }

  function setHardwareInfo(info: HardwareInfo) {
    hardwareInfo.value = info
  }

  function setupListeners() {
    return window.silo.hardware.onInfo((info) => {
      hardwareInfo.value = info as HardwareInfo
    })
  }

  return {
    hardwareInfo,
    isLoading,
    error,
    tier,
    tierName,
    tierLevel,
    tierColor,
    gpu,
    memory,
    recommendations,
    detect,
    setHardwareInfo,
    setupListeners
  }
})
