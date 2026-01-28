/**
 * SILO Resource Manager
 * Tracks loaded models, monitors system resources, manages memory
 */

import * as si from 'systeminformation'
import type { ProviderType, SystemStats, LoadedModel } from './types'

export class ResourceManager {
  private loadedModels: Map<string, LoadedModel> = new Map()
  private maxMemoryUsage: number = 0  // Auto-detected based on system
  private systemStatsCache: SystemStats | null = null
  private lastStatsUpdate: number = 0
  private statsUpdateInterval: number = 5000  // Cache stats for 5 seconds

  constructor() {
    this.detectMemoryLimit()
  }

  /**
   * Detect system memory and set model memory budget
   */
  private async detectMemoryLimit(): Promise<void> {
    try {
      const mem = await si.mem()
      // Use 50% of available RAM as model budget
      this.maxMemoryUsage = Math.floor(mem.available * 0.5)
      console.log(`[ResourceManager] Memory limit set to ${this.formatBytes(this.maxMemoryUsage)}`)
    } catch (error) {
      // Default to 4GB if detection fails
      this.maxMemoryUsage = 4 * 1024 * 1024 * 1024
      console.warn('[ResourceManager] Memory detection failed, using default 4GB limit')
    }
  }

  /**
   * Get current system stats (CPU, GPU, RAM)
   */
  async getSystemStats(): Promise<SystemStats> {
    const now = Date.now()

    // Return cached stats if recent
    if (this.systemStatsCache && now - this.lastStatsUpdate < this.statsUpdateInterval) {
      return this.systemStatsCache
    }

    try {
      const [cpu, mem, graphics] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.graphics()
      ])

      const gpuController = graphics.controllers?.[0]

      const stats: SystemStats = {
        cpu: {
          usage: Math.round(cpu.currentLoad * 10) / 10
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free
        }
      }

      // Add GPU info if available
      if (gpuController) {
        stats.gpu = {
          usage: gpuController.utilizationGpu || 0,
          memory: gpuController.memoryUsed ? gpuController.memoryUsed * 1024 * 1024 : 0,
          memoryTotal: gpuController.memoryTotal ? gpuController.memoryTotal * 1024 * 1024 : undefined,
          temperature: gpuController.temperatureGpu || undefined,
          name: gpuController.model
        }
      }

      // Try to get CPU temperature
      try {
        const cpuTemp = await si.cpuTemperature()
        if (cpuTemp.main) {
          stats.cpu.temperature = cpuTemp.main
        }
      } catch {
        // Temperature not available on all systems
      }

      this.systemStatsCache = stats
      this.lastStatsUpdate = now

      return stats
    } catch (error) {
      console.error('[ResourceManager] Error getting system stats:', error)
      // Return default stats on error
      return {
        cpu: { usage: 0 },
        memory: { total: 0, used: 0, free: 0 }
      }
    }
  }

  /**
   * Get all currently loaded models
   */
  getLoadedModels(): LoadedModel[] {
    return Array.from(this.loadedModels.values())
  }

  /**
   * Track that a model has been loaded into memory
   */
  trackModelLoaded(id: string, provider: ProviderType, memoryUsage: number): void {
    const now = Date.now()
    this.loadedModels.set(id, {
      id,
      provider,
      loadedAt: now,
      lastUsed: now,
      memoryUsage
    })
    console.log(`[ResourceManager] Model loaded: ${id} (${this.formatBytes(memoryUsage)})`)
  }

  /**
   * Update last used timestamp for a model
   */
  trackModelUsed(id: string): void {
    const model = this.loadedModels.get(id)
    if (model) {
      model.lastUsed = Date.now()
    }
  }

  /**
   * Track that a model has been unloaded from memory
   */
  trackModelUnloaded(id: string): void {
    const model = this.loadedModels.get(id)
    if (model) {
      console.log(`[ResourceManager] Model unloaded: ${id} (${this.formatBytes(model.memoryUsage)})`)
      this.loadedModels.delete(id)
    }
  }

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(id: string): boolean {
    return this.loadedModels.has(id)
  }

  /**
   * Get the memory usage of a loaded model
   */
  getModelMemoryUsage(id: string): number {
    return this.loadedModels.get(id)?.memoryUsage || 0
  }

  /**
   * Get total memory usage by all loaded models
   */
  getTotalMemoryUsage(): number {
    let total = 0
    for (const model of this.loadedModels.values()) {
      total += model.memoryUsage
    }
    return total
  }

  /**
   * Get the maximum allowed memory usage for models
   */
  getMaxMemoryUsage(): number {
    return this.maxMemoryUsage
  }

  /**
   * Set the maximum memory budget for models
   */
  setMaxMemoryUsage(bytes: number): void {
    this.maxMemoryUsage = bytes
  }

  /**
   * Check if we can load a model of the given size
   */
  canLoadModel(sizeBytes: number): boolean {
    const currentUsage = this.getTotalMemoryUsage()
    return currentUsage + sizeBytes <= this.maxMemoryUsage
  }

  /**
   * Get models that should be unloaded to free memory for a new model
   * Returns model IDs sorted by least recently used
   */
  getModelsToUnload(requiredMemory: number): string[] {
    const currentUsage = this.getTotalMemoryUsage()

    // If we have enough memory, no need to unload
    if (currentUsage + requiredMemory <= this.maxMemoryUsage) {
      return []
    }

    // Sort models by last used (oldest first)
    const sorted = [...this.loadedModels.values()]
      .sort((a, b) => a.lastUsed - b.lastUsed)

    const toUnload: string[] = []
    let freedMemory = 0

    for (const model of sorted) {
      // Stop once we've freed enough
      if (currentUsage - freedMemory + requiredMemory <= this.maxMemoryUsage) {
        break
      }
      toUnload.push(model.id)
      freedMemory += model.memoryUsage
    }

    return toUnload
  }

  /**
   * Get idle models that haven't been used for a while
   * @param maxIdleTime Maximum idle time in milliseconds
   */
  getIdleModels(maxIdleTime: number = 5 * 60 * 1000): string[] {
    const now = Date.now()
    const idle: string[] = []

    for (const model of this.loadedModels.values()) {
      if (now - model.lastUsed > maxIdleTime) {
        idle.push(model.id)
      }
    }

    return idle
  }

  /**
   * Get memory usage summary
   */
  getMemorySummary(): {
    used: number
    max: number
    percent: number
    modelCount: number
  } {
    const used = this.getTotalMemoryUsage()
    return {
      used,
      max: this.maxMemoryUsage,
      percent: this.maxMemoryUsage > 0 ? Math.round((used / this.maxMemoryUsage) * 100) : 0,
      modelCount: this.loadedModels.size
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  /**
   * Clear all tracked models (for cleanup)
   */
  clear(): void {
    this.loadedModels.clear()
    this.systemStatsCache = null
  }
}

// Singleton instance
let resourceManagerInstance: ResourceManager | null = null

export function getResourceManager(): ResourceManager {
  if (!resourceManagerInstance) {
    resourceManagerInstance = new ResourceManager()
  }
  return resourceManagerInstance
}
