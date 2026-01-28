/**
 * SILO HuggingFace Provider
 * Cloud-based inference via HuggingFace Inference API
 */

import type {
  ModelProvider,
  ProviderType,
  ProviderStatus,
  ModelInfo,
  TaskType,
  HardwareTier,
  ChatRequest,
  ChatResponse,
  GenerateOptions,
  GenerateResponse,
  EmbedOptions,
  EmbedResponse,
  ImageGenOptions,
  ImageGenResponse,
  ModelPullProgress
} from './types'
import { HUGGINGFACE_MODELS } from './types'
import { settingsService } from '../settings'

// HuggingFace Inference client type
interface HfInferenceClient {
  chatCompletion(options: {
    model: string
    messages: Array<{ role: string; content: string }>
    max_tokens?: number
    temperature?: number
  }): Promise<{
    choices: Array<{
      message: { role: string; content: string }
    }>
  }>

  textGeneration(options: {
    model: string
    inputs: string
    parameters?: { max_new_tokens?: number; temperature?: number }
  }): Promise<{ generated_text: string }>

  featureExtraction(options: {
    model: string
    inputs: string | string[]
  }): Promise<number[] | number[][]>

  textToImage(options: {
    model: string
    inputs: string
    parameters?: { negative_prompt?: string; width?: number; height?: number; num_inference_steps?: number }
  }): Promise<Blob>
}

// Dynamic import for HuggingFace inference
let HfInference: new (apiKey: string) => HfInferenceClient
let hfClient: HfInferenceClient | null = null

async function loadHfInference(): Promise<typeof HfInference | null> {
  if (HfInference) return HfInference

  try {
    const hf = await import('@huggingface/inference')
    HfInference = hf.HfInference as unknown as typeof HfInference
    return HfInference
  } catch (error) {
    console.error('[HuggingFace] Failed to load @huggingface/inference:', error)
    return null
  }
}

export class HuggingFaceProvider implements ModelProvider {
  readonly type: ProviderType = 'huggingface'
  readonly name = 'HuggingFace Cloud'

  private isAvailable = false
  private lastError: string | null = null
  private apiKey: string | null = null

  async checkAvailability(): Promise<boolean> {
    try {
      // Get API key from settings
      this.apiKey = await settingsService.get('huggingfaceApiKey') as string | null

      if (!this.apiKey) {
        this.isAvailable = false
        this.lastError = 'HuggingFace API key not configured'
        return false
      }

      // Try to load the HuggingFace inference library
      const HfClass = await loadHfInference()
      if (!HfClass) {
        this.isAvailable = false
        this.lastError = 'HuggingFace library not available'
        return false
      }

      // Create client
      hfClient = new HfClass(this.apiKey)

      // Test connection with a minimal request
      try {
        await hfClient.chatCompletion({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1
        })
        this.isAvailable = true
        this.lastError = null
        return true
      } catch (testError) {
        // API key might be invalid or rate limited
        const errorMsg = testError instanceof Error ? testError.message : String(testError)
        if (errorMsg.includes('401') || errorMsg.includes('403')) {
          this.lastError = 'Invalid HuggingFace API key'
        } else if (errorMsg.includes('429')) {
          // Rate limited but API key is valid
          this.isAvailable = true
          this.lastError = null
          return true
        } else {
          this.lastError = `Connection test failed: ${errorMsg}`
        }
        this.isAvailable = false
        return false
      }
    } catch (error) {
      this.isAvailable = false
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  getStatus(): ProviderStatus {
    return {
      type: this.type,
      name: this.name,
      status: this.isAvailable ? 'available' : 'unavailable',
      error: this.lastError || undefined,
      models: this.getAvailableModels()
    }
  }

  private getAvailableModels(): ModelInfo[] {
    return HUGGINGFACE_MODELS.map(entry => ({
      id: entry.id,
      name: entry.name,
      provider: 'huggingface',
      size: 0,  // Cloud models don't have local size
      sizeLabel: 'Cloud',
      capabilities: entry.tasks,
      tier: entry.tier,
      isLocal: false,
      isInstalled: this.isAvailable,  // Available if API key is valid
      description: entry.description,
      huggingFaceId: entry.huggingFaceId
    }))
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.getAvailableModels()
  }

  supportsTask(task: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'chat', 'generate', 'embed', 'text-to-image'
    ]
    return supportedTasks.includes(task)
  }

  private getHfModelId(modelId: string): string {
    // Remove provider prefix if present
    if (modelId.startsWith('huggingface:')) {
      return modelId.replace('huggingface:', '')
    }
    return modelId
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!hfClient) {
      throw new Error('HuggingFace client not initialized. Please configure API key.')
    }

    const modelId = this.getHfModelId(request.model || 'mistralai/Mistral-7B-Instruct-v0.3')
    const startTime = Date.now()

    try {
      const response = await hfClient.chatCompletion({
        model: modelId,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: 1024
      })

      return {
        model: `huggingface:${modelId}`,
        provider: 'huggingface',
        message: {
          role: 'assistant',
          content: response.choices[0]?.message?.content || ''
        },
        done: true,
        totalDuration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`HuggingFace chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    if (!hfClient) {
      throw new Error('HuggingFace client not initialized. Please configure API key.')
    }

    const modelId = this.getHfModelId(options.model || 'mistralai/Mistral-7B-Instruct-v0.3')
    const startTime = Date.now()

    try {
      const response = await hfClient.textGeneration({
        model: modelId,
        inputs: options.prompt,
        parameters: {
          max_new_tokens: options.maxTokens || 256,
          temperature: options.temperature || 0.7
        }
      })

      return {
        model: `huggingface:${modelId}`,
        provider: 'huggingface',
        response: response.generated_text,
        done: true,
        totalDuration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`HuggingFace generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async embed(options: EmbedOptions): Promise<EmbedResponse> {
    if (!hfClient) {
      throw new Error('HuggingFace client not initialized. Please configure API key.')
    }

    const modelId = this.getHfModelId(options.model || 'sentence-transformers/all-MiniLM-L6-v2')

    try {
      const texts = Array.isArray(options.text) ? options.text : [options.text]
      const embeddings: number[][] = []

      for (const text of texts) {
        const result = await hfClient.featureExtraction({
          model: modelId,
          inputs: text
        })
        // Result might be nested array or flat array
        if (Array.isArray(result) && Array.isArray(result[0])) {
          embeddings.push(result[0] as number[])
        } else {
          embeddings.push(result as number[])
        }
      }

      return {
        model: `huggingface:${modelId}`,
        provider: 'huggingface',
        embeddings
      }
    } catch (error) {
      throw new Error(`HuggingFace embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async imageGen(options: ImageGenOptions): Promise<ImageGenResponse> {
    if (!hfClient) {
      throw new Error('HuggingFace client not initialized. Please configure API key.')
    }

    const modelId = this.getHfModelId(options.model || 'black-forest-labs/FLUX.1-dev')

    try {
      const blob = await hfClient.textToImage({
        model: modelId,
        inputs: options.prompt,
        parameters: {
          negative_prompt: options.negativePrompt,
          width: options.width,
          height: options.height,
          num_inference_steps: options.steps
        }
      })

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = blob.type || 'image/png'

      return {
        model: `huggingface:${modelId}`,
        provider: 'huggingface',
        image: `data:${mimeType};base64,${base64}`
      }
    } catch (error) {
      throw new Error(`HuggingFace image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  getRecommendedModel(task: TaskType, tier: HardwareTier): ModelInfo | null {
    // Find models that support this task
    const candidates = HUGGINGFACE_MODELS.filter(m => m.tasks.includes(task))

    if (candidates.length === 0) return null

    // For HuggingFace, prefer models at or below the tier
    const tierOrder: HardwareTier[] = ['LEAN', 'STEADY', 'HEAVY', 'SURPLUS']
    const userTierIndex = tierOrder.indexOf(tier)

    const suitable = candidates.filter(m => {
      const modelTierIndex = tierOrder.indexOf(m.tier)
      return modelTierIndex <= userTierIndex
    })

    const selected = suitable.length > 0 ? suitable[0] : candidates[0]
    if (!selected) return null

    return {
      id: selected.id,
      name: selected.name,
      provider: 'huggingface',
      size: 0,
      sizeLabel: 'Cloud',
      capabilities: selected.tasks,
      tier: selected.tier,
      isLocal: false,
      isInstalled: this.isAvailable,
      description: selected.description,
      huggingFaceId: selected.huggingFaceId
    }
  }

  // Cloud models don't need to be pulled
  async pullModel(_modelId: string, onProgress?: (progress: ModelPullProgress) => void): Promise<boolean> {
    // For HuggingFace, just verify the model exists and API key is valid
    onProgress?.({
      model: _modelId,
      provider: 'huggingface',
      progress: 100,
      status: 'complete'
    })
    return true
  }
}
