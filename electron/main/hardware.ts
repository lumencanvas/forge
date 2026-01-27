/**
 * SILO Hardware Detection Module
 * Detects system capabilities and assigns a tier
 */

import si from 'systeminformation'
import os from 'os'
import { execSync } from 'child_process'

export interface Tier {
  name: 'LEAN' | 'STEADY' | 'HEAVY' | 'SURPLUS'
  level: number
  minRam: number
  minVram: number
}

export const TIERS: Record<string, Tier> = {
  LEAN: { name: 'LEAN', level: 1, minRam: 0, minVram: 0 },
  STEADY: { name: 'STEADY', level: 2, minRam: 16, minVram: 6 },
  HEAVY: { name: 'HEAVY', level: 3, minRam: 32, minVram: 12 },
  SURPLUS: { name: 'SURPLUS', level: 4, minRam: 64, minVram: 24 }
}

export interface GPUInfo {
  vendor: string
  name: string
  vram: number
  compute: string | null
}

export interface HardwareInfo {
  tier: Tier
  cpu: {
    brand: string
    manufacturer: string
    cores: number
    physicalCores: number
    speed: number
    speedMax: number
  }
  memory: {
    total: number
    free: number
    available: number
  }
  gpu: GPUInfo
  platform: {
    os: string
    arch: string
    release: string
  }
  recommendations: {
    models: {
      vision: ModelRecommendation[]
      language: ModelRecommendation[]
      embeddings: ModelRecommendation[]
      audio: ModelRecommendation[]
    }
    parallelCapable: boolean
    gpuAccelerated: boolean
    backend: string
  }
}

export interface ModelRecommendation {
  id: string
  size: string
  speed: string
  tier: Tier['name']
  recommended: boolean
}

export class HardwareDetector {
  private cache: HardwareInfo | null = null
  private cacheTime: number | null = null
  private cacheDuration = 60000 // 1 minute cache

  async detect(forceRefresh = false): Promise<HardwareInfo> {
    if (this.cache && !forceRefresh &&
        this.cacheTime && (Date.now() - this.cacheTime) < this.cacheDuration) {
      return this.cache
    }

    const [cpu, mem, graphics] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics()
    ])

    const gpuInfo = this.parseGPU(graphics)
    const ramGB = Math.round(mem.total / (1024 * 1024 * 1024))
    const tier = this.calculateTier(ramGB, gpuInfo.vram)

    this.cache = {
      tier,
      cpu: {
        brand: cpu.brand,
        manufacturer: cpu.manufacturer,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        speedMax: cpu.speedMax
      },
      memory: {
        total: ramGB,
        free: Math.round(mem.free / (1024 * 1024 * 1024)),
        available: Math.round(mem.available / (1024 * 1024 * 1024))
      },
      gpu: gpuInfo,
      platform: {
        os: os.platform(),
        arch: os.arch(),
        release: os.release()
      },
      recommendations: this.getRecommendations(tier, gpuInfo)
    }

    this.cacheTime = Date.now()
    return this.cache
  }

  private parseGPU(graphics: si.Systeminformation.GraphicsData): GPUInfo {
    if (!graphics.controllers || graphics.controllers.length === 0) {
      return { vendor: 'none', name: 'No GPU detected', vram: 0, compute: null }
    }

    // Find the best discrete GPU, or fall back to integrated
    const discrete = graphics.controllers.find(g =>
      !g.model?.toLowerCase().includes('intel') &&
      !g.model?.toLowerCase().includes('integrated')
    )

    const gpu = discrete || graphics.controllers[0]

    let vendor = 'unknown'
    const model = (gpu.model || gpu.name || '').toLowerCase()

    if (model.includes('nvidia') || gpu.vendor?.toLowerCase().includes('nvidia')) {
      vendor = 'nvidia'
    } else if (model.includes('amd') || model.includes('radeon') || gpu.vendor?.toLowerCase().includes('amd')) {
      vendor = 'amd'
    } else if (model.includes('apple') || model.includes('m1') || model.includes('m2') || model.includes('m3') || model.includes('m4')) {
      vendor = 'apple'
    } else if (model.includes('intel')) {
      vendor = 'intel'
    }

    // Try to get accurate VRAM
    let vram = gpu.vram || 0

    // On macOS with Apple Silicon, use unified memory
    if (vendor === 'apple' && vram === 0) {
      const totalMem = os.totalmem() / (1024 * 1024 * 1024)
      // Apple Silicon can use most of unified memory for GPU
      vram = Math.round(totalMem * 0.7)
    }

    // Try nvidia-smi for accurate NVIDIA VRAM
    if (vendor === 'nvidia') {
      try {
        const nvidiaSmi = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
          encoding: 'utf8',
          timeout: 5000
        })
        const nvVram = parseInt(nvidiaSmi.trim()) / 1024 // Convert MB to GB
        if (nvVram > 0) vram = Math.round(nvVram)
      } catch {
        // nvidia-smi not available, use reported value
      }
    }

    return {
      vendor,
      name: gpu.model || gpu.name || 'Unknown GPU',
      vram: Math.round(vram),
      compute: this.getComputeCapability(vendor, model)
    }
  }

  private getComputeCapability(vendor: string, model: string): string | null {
    // Rough compute capability detection
    if (vendor === 'nvidia') {
      if (model.includes('4090') || model.includes('4080')) return 'ada'
      if (model.includes('3090') || model.includes('3080') || model.includes('3070')) return 'ampere'
      if (model.includes('2080') || model.includes('2070')) return 'turing'
      return 'cuda'
    }
    if (vendor === 'amd') return 'rocm'
    if (vendor === 'apple') return 'metal'
    return null
  }

  private calculateTier(ramGB: number, vramGB: number): Tier {
    // Check VRAM first (dedicated GPU memory is more valuable for inference)
    if (vramGB >= 24) return TIERS.SURPLUS!
    if (vramGB >= 12) return TIERS.HEAVY!
    if (vramGB >= 6) return TIERS.STEADY!

    // Fall back to RAM for CPU inference
    if (ramGB >= 64) return TIERS.SURPLUS!
    if (ramGB >= 32) return TIERS.HEAVY!
    if (ramGB >= 16) return TIERS.STEADY!

    return TIERS.LEAN!
  }

  private getRecommendations(tier: Tier, gpuInfo: GPUInfo) {
    // Define models for each tier with proper typing
    type ModelType = 'vision' | 'language' | 'embeddings' | 'audio'
    const modelsByTier: Record<Tier['name'], Record<ModelType, Array<{ id: string; size: string; speed: string }>>> = {
      SURPLUS: {
        vision: [
          { id: 'llava:34b', size: '20GB', speed: 'medium' },
          { id: 'llama3.2-vision:11b', size: '8GB', speed: 'fast' }
        ],
        language: [
          { id: 'deepseek-r1:70b', size: '40GB', speed: 'medium' },
          { id: 'qwen2.5:32b', size: '20GB', speed: 'fast' }
        ],
        embeddings: [],
        audio: [{ id: 'whisper-large-v3', size: '3GB', speed: 'medium' }]
      },
      HEAVY: {
        vision: [
          { id: 'llama3.2-vision:11b', size: '8GB', speed: 'fast' },
          { id: 'llava:13b', size: '8GB', speed: 'medium' }
        ],
        language: [
          { id: 'qwen2.5:14b', size: '9GB', speed: 'fast' },
          { id: 'deepseek-r1:14b', size: '9GB', speed: 'fast' }
        ],
        embeddings: [],
        audio: [{ id: 'whisper-medium', size: '1.5GB', speed: 'fast' }]
      },
      STEADY: {
        vision: [
          { id: 'llava:7b', size: '4.5GB', speed: 'fast' },
          { id: 'moondream', size: '1.7GB', speed: 'very-fast' }
        ],
        language: [
          { id: 'mistral:7b', size: '4GB', speed: 'fast' },
          { id: 'phi4', size: '9GB', speed: 'medium' }
        ],
        embeddings: [],
        audio: [{ id: 'whisper-base', size: '150MB', speed: 'fast' }]
      },
      LEAN: {
        vision: [
          { id: 'moondream', size: '1.7GB', speed: 'medium' }
        ],
        language: [
          { id: 'llama3.2:3b', size: '2GB', speed: 'fast' },
          { id: 'phi3:mini', size: '2.3GB', speed: 'medium' }
        ],
        embeddings: [],
        audio: [{ id: 'whisper-tiny', size: '75MB', speed: 'fast' }]
      }
    }

    const models: {
      vision: ModelRecommendation[]
      language: ModelRecommendation[]
      embeddings: ModelRecommendation[]
      audio: ModelRecommendation[]
    } = {
      vision: [],
      language: [],
      embeddings: [],
      audio: []
    }

    // Base models for all tiers (using Ollama model names)
    models.embeddings.push({ id: 'nomic-embed-text', size: '274MB', speed: 'fast', tier: 'LEAN', recommended: true })

    // Tier order from highest to lowest
    const tierOrder: Tier['name'][] = ['SURPLUS', 'HEAVY', 'STEADY', 'LEAN']
    const userTierIndex = tierOrder.indexOf(tier.name)

    // Add models from user's tier and all lower tiers
    // Models from user's tier are marked as recommended
    const modelTypes: ModelType[] = ['vision', 'language', 'audio']

    for (const modelType of modelTypes) {
      const seenIds = new Set<string>()

      // Start from user's tier and go down
      for (let i = userTierIndex; i < tierOrder.length; i++) {
        const currentTier = tierOrder[i]!
        const tierModels = modelsByTier[currentTier]![modelType]

        for (const model of tierModels) {
          // Skip duplicates (same model can appear in multiple tiers)
          if (seenIds.has(model.id)) continue
          seenIds.add(model.id)

          models[modelType].push({
            ...model,
            tier: currentTier,
            recommended: currentTier === tier.name
          })
        }
      }
    }

    return {
      models,
      parallelCapable: tier.name === 'SURPLUS' || tier.name === 'HEAVY',
      gpuAccelerated: gpuInfo.vendor !== 'none' && gpuInfo.vendor !== 'intel',
      backend: this.recommendBackend(gpuInfo)
    }
  }

  private recommendBackend(gpuInfo: GPUInfo): string {
    switch (gpuInfo.vendor) {
      case 'nvidia': return 'cuda'
      case 'amd': return 'rocm'
      case 'apple': return 'metal'
      default: return 'cpu'
    }
  }
}
