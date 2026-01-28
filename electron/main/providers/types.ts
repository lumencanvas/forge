/**
 * SILO Model Provider Types
 * Shared interfaces for multi-backend model support
 */

export type ProviderType = 'ollama' | 'transformers' | 'huggingface'

// Expanded task types to match Transformers.js capabilities
export type TaskType =
  // Text
  | 'chat'
  | 'generate'
  | 'summarize'
  | 'translate'
  | 'question-answering'
  | 'zero-shot-classification'
  | 'text-classification'
  | 'token-classification'
  // Vision
  | 'image-classification'
  | 'object-detection'
  | 'image-segmentation'
  | 'depth-estimation'
  | 'image-to-text'
  // Audio
  | 'speech-to-text'
  | 'text-to-speech'
  | 'audio-classification'
  // Embeddings
  | 'embed'
  // Image generation (HuggingFace)
  | 'text-to-image'
  // Legacy aliases
  | 'classify'

export type HardwareTier = 'LEAN' | 'STEADY' | 'HEAVY' | 'SURPLUS'

// Pipeline types for Transformers.js
export type TransformersPipelineType =
  | 'text-generation'
  | 'text2text-generation'
  | 'feature-extraction'
  | 'summarization'
  | 'translation'
  | 'question-answering'
  | 'zero-shot-classification'
  | 'text-classification'
  | 'token-classification'
  | 'fill-mask'
  | 'image-classification'
  | 'object-detection'
  | 'image-segmentation'
  | 'depth-estimation'
  | 'image-to-text'
  | 'automatic-speech-recognition'
  | 'text-to-audio'
  | 'audio-classification'
  | 'document-question-answering'
  | 'visual-question-answering'

export interface ModelInfo {
  id: string
  name: string
  provider: ProviderType
  size: number          // bytes
  sizeLabel: string     // human-readable, e.g., "285MB"
  capabilities: TaskType[]
  tier: HardwareTier
  isLocal: boolean
  isInstalled: boolean
  description?: string
  huggingFaceId?: string
}

export interface ProviderStatus {
  type: ProviderType
  name: string
  status: 'available' | 'unavailable' | 'checking' | 'downloading'
  error?: string
  models: ModelInfo[]
  downloadProgress?: number  // 0-100 when downloading
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface ChatRequest {
  messages: ChatMessage[]
  model?: string           // If not specified, use best available
  preferredProvider?: ProviderType
}

export interface ChatResponse {
  model: string
  provider: ProviderType
  message: ChatMessage
  done: boolean
  totalDuration?: number
  evalCount?: number
}

export interface GenerateOptions {
  prompt: string
  model?: string
  preferredProvider?: ProviderType
  images?: string[]
  maxTokens?: number
  temperature?: number
}

export interface GenerateResponse {
  model: string
  provider: ProviderType
  response: string
  done: boolean
  totalDuration?: number
}

export interface EmbedOptions {
  text: string | string[]
  model?: string
  preferredProvider?: ProviderType
}

export interface EmbedResponse {
  model: string
  provider: ProviderType
  embeddings: number[][]
}

// Vision task options and responses
export interface VisionOptions {
  image: string  // base64 or URL
  model?: string
  preferredProvider?: ProviderType
  task: 'image-classification' | 'object-detection' | 'image-segmentation' | 'depth-estimation' | 'image-to-text'
}

export interface ImageClassificationResult {
  label: string
  score: number
}

export interface ObjectDetectionResult {
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}

export interface VisionResponse {
  model: string
  provider: ProviderType
  task: string
  results: ImageClassificationResult[] | ObjectDetectionResult[] | string | unknown
}

// Audio task options and responses
export interface AudioOptions {
  audio: ArrayBuffer | string  // audio data or file path
  model?: string
  preferredProvider?: ProviderType
  task: 'speech-to-text' | 'audio-classification'
}

export interface SpeechToTextResult {
  text: string
  chunks?: Array<{ text: string; timestamp: [number, number] }>
}

export interface AudioResponse {
  model: string
  provider: ProviderType
  task: string
  result: SpeechToTextResult | unknown
}

// Image generation options and responses
export interface ImageGenOptions {
  prompt: string
  model?: string
  preferredProvider?: ProviderType
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
}

export interface ImageGenResponse {
  model: string
  provider: ProviderType
  image: string  // base64 encoded image
}

export interface ModelPullProgress {
  model: string
  provider: ProviderType
  progress: number        // 0-100
  status: 'downloading' | 'verifying' | 'complete' | 'error'
  error?: string
}

/**
 * Model Provider Interface
 * All backends must implement this interface
 */
export interface ModelProvider {
  readonly type: ProviderType
  readonly name: string

  /**
   * Check if the provider is available (e.g., Ollama running, transformers loaded)
   */
  checkAvailability(): Promise<boolean>

  /**
   * Get current provider status including available models
   */
  getStatus(): ProviderStatus

  /**
   * List all models available from this provider
   */
  listModels(): Promise<ModelInfo[]>

  /**
   * Check if this provider supports a specific task
   */
  supportsTask(task: TaskType): boolean

  /**
   * Chat with the model
   */
  chat(request: ChatRequest): Promise<ChatResponse>

  /**
   * Generate text from a prompt
   */
  generate(options: GenerateOptions): Promise<GenerateResponse>

  /**
   * Generate embeddings for text
   */
  embed?(options: EmbedOptions): Promise<EmbedResponse>

  /**
   * Run a vision task (image classification, object detection, etc.)
   */
  vision?(options: VisionOptions): Promise<VisionResponse>

  /**
   * Run an audio task (speech-to-text, audio classification)
   */
  audio?(options: AudioOptions): Promise<AudioResponse>

  /**
   * Generate an image from text
   */
  imageGen?(options: ImageGenOptions): Promise<ImageGenResponse>

  /**
   * Pull/download a model (if supported)
   */
  pullModel?(modelId: string, onProgress?: (progress: ModelPullProgress) => void): Promise<boolean>

  /**
   * Delete a downloaded model
   */
  deleteModel?(modelId: string): Promise<boolean>

  /**
   * Load a model into memory
   */
  loadModel?(modelId: string): Promise<boolean>

  /**
   * Unload a model from memory
   */
  unloadModel?(modelId: string): Promise<boolean>

  /**
   * Get recommended model for a task based on hardware tier
   */
  getRecommendedModel(task: TaskType, tier: HardwareTier): ModelInfo | null
}

/**
 * Combined status from all providers
 */
export interface AllProvidersStatus {
  providers: ProviderStatus[]
  hasAvailableProvider: boolean
  recommendedProvider: ProviderType | null
}

/**
 * Model registry entry - extended model information
 */
export interface ModelRegistryEntry {
  id: string                    // e.g., "transformers:Xenova/whisper-tiny.en"
  name: string                  // Display name
  provider: ProviderType
  huggingFaceId?: string        // Original HF model ID
  tasks: TaskType[]             // Supported tasks
  pipelineType?: TransformersPipelineType  // Transformers.js pipeline name
  sizeBytes?: number
  sizeLabel?: string
  tier: HardwareTier
  isBuiltIn: boolean            // Pre-configured vs user-added
  description?: string
}

/**
 * Transformers.js specific model definitions
 */
export interface TransformersModelConfig {
  id: string
  huggingFaceId: string
  name: string
  sizeBytes: number
  sizeLabel: string
  capabilities: TaskType[]
  tier: HardwareTier
  description: string
  pipeline: TransformersPipelineType
}

/**
 * Available Transformers.js models (downloaded on demand)
 * Expanded to include vision, audio, and more text models
 */
export const TRANSFORMERS_MODELS: TransformersModelConfig[] = [
  // === TEXT GENERATION ===
  {
    id: 'transformers:distilgpt2',
    huggingFaceId: 'Xenova/distilgpt2',
    name: 'DistilGPT2',
    sizeBytes: 130_000_000,
    sizeLabel: '124MB',
    capabilities: ['generate', 'chat'],
    tier: 'LEAN',
    description: 'Lightweight text generation, good for simple tasks',
    pipeline: 'text-generation'
  },
  {
    id: 'transformers:flan-t5-small',
    huggingFaceId: 'Xenova/flan-t5-small',
    name: 'Flan-T5 Small',
    sizeBytes: 146_000_000,
    sizeLabel: '139MB',
    capabilities: ['generate', 'chat', 'summarize', 'question-answering'],
    tier: 'LEAN',
    description: 'Instruction-tuned model for Q&A and summarization',
    pipeline: 'text2text-generation'
  },
  {
    id: 'transformers:gpt2',
    huggingFaceId: 'Xenova/gpt2',
    name: 'GPT-2',
    sizeBytes: 548_000_000,
    sizeLabel: '522MB',
    capabilities: ['generate', 'chat'],
    tier: 'STEADY',
    description: 'OpenAI GPT-2 for text generation',
    pipeline: 'text-generation'
  },
  {
    id: 'transformers:LaMini-Flan-T5-248M',
    huggingFaceId: 'Xenova/LaMini-Flan-T5-248M',
    name: 'LaMini Flan-T5',
    sizeBytes: 260_000_000,
    sizeLabel: '248MB',
    capabilities: ['generate', 'chat', 'summarize', 'question-answering'],
    tier: 'LEAN',
    description: 'Instruction-tuned model, good for chat and Q&A',
    pipeline: 'text2text-generation'
  },

  // === EMBEDDINGS ===
  {
    id: 'transformers:all-MiniLM-L6-v2',
    huggingFaceId: 'Xenova/all-MiniLM-L6-v2',
    name: 'MiniLM Embeddings',
    sizeBytes: 23_000_000,
    sizeLabel: '22MB',
    capabilities: ['embed'],
    tier: 'LEAN',
    description: 'Fast sentence embeddings for semantic search',
    pipeline: 'feature-extraction'
  },
  {
    id: 'transformers:bge-small-en-v1.5',
    huggingFaceId: 'Xenova/bge-small-en-v1.5',
    name: 'BGE Small Embeddings',
    sizeBytes: 33_000_000,
    sizeLabel: '31MB',
    capabilities: ['embed'],
    tier: 'LEAN',
    description: 'High-quality embeddings for retrieval tasks',
    pipeline: 'feature-extraction'
  },

  // === SPEECH TO TEXT ===
  {
    id: 'transformers:whisper-tiny.en',
    huggingFaceId: 'Xenova/whisper-tiny.en',
    name: 'Whisper Tiny (English)',
    sizeBytes: 150_000_000,
    sizeLabel: '143MB',
    capabilities: ['speech-to-text'],
    tier: 'LEAN',
    description: 'Fast English speech recognition',
    pipeline: 'automatic-speech-recognition'
  },
  {
    id: 'transformers:whisper-small',
    huggingFaceId: 'Xenova/whisper-small',
    name: 'Whisper Small',
    sizeBytes: 460_000_000,
    sizeLabel: '438MB',
    capabilities: ['speech-to-text'],
    tier: 'STEADY',
    description: 'Accurate multilingual speech recognition',
    pipeline: 'automatic-speech-recognition'
  },

  // === VISION - IMAGE CLASSIFICATION ===
  {
    id: 'transformers:vit-base-patch16-224',
    huggingFaceId: 'Xenova/vit-base-patch16-224',
    name: 'ViT Image Classifier',
    sizeBytes: 350_000_000,
    sizeLabel: '334MB',
    capabilities: ['image-classification'],
    tier: 'LEAN',
    description: 'Vision Transformer for image classification',
    pipeline: 'image-classification'
  },
  {
    id: 'transformers:resnet-50',
    huggingFaceId: 'Xenova/resnet-50',
    name: 'ResNet-50 Classifier',
    sizeBytes: 100_000_000,
    sizeLabel: '95MB',
    capabilities: ['image-classification'],
    tier: 'LEAN',
    description: 'Classic ResNet image classifier',
    pipeline: 'image-classification'
  },

  // === VISION - OBJECT DETECTION ===
  {
    id: 'transformers:detr-resnet-50',
    huggingFaceId: 'Xenova/detr-resnet-50',
    name: 'DETR Object Detection',
    sizeBytes: 160_000_000,
    sizeLabel: '153MB',
    capabilities: ['object-detection'],
    tier: 'STEADY',
    description: 'End-to-end object detection with transformers',
    pipeline: 'object-detection'
  },
  {
    id: 'transformers:yolos-tiny',
    huggingFaceId: 'Xenova/yolos-tiny',
    name: 'YOLOS Tiny Detection',
    sizeBytes: 28_000_000,
    sizeLabel: '27MB',
    capabilities: ['object-detection'],
    tier: 'LEAN',
    description: 'Lightweight object detection',
    pipeline: 'object-detection'
  },

  // === VISION - DEPTH ESTIMATION ===
  {
    id: 'transformers:depth-anything-small',
    huggingFaceId: 'Xenova/depth-anything-small-hf',
    name: 'Depth Anything Small',
    sizeBytes: 100_000_000,
    sizeLabel: '95MB',
    capabilities: ['depth-estimation'],
    tier: 'LEAN',
    description: 'Monocular depth estimation',
    pipeline: 'depth-estimation'
  },
  {
    id: 'transformers:dpt-large',
    huggingFaceId: 'Xenova/dpt-large',
    name: 'DPT Large Depth',
    sizeBytes: 320_000_000,
    sizeLabel: '305MB',
    capabilities: ['depth-estimation'],
    tier: 'STEADY',
    description: 'High-quality depth estimation',
    pipeline: 'depth-estimation'
  },

  // === VISION - IMAGE TO TEXT ===
  {
    id: 'transformers:vit-gpt2-image-captioning',
    huggingFaceId: 'Xenova/vit-gpt2-image-captioning',
    name: 'ViT-GPT2 Image Captioning',
    sizeBytes: 500_000_000,
    sizeLabel: '477MB',
    capabilities: ['image-to-text'],
    tier: 'STEADY',
    description: 'Generate captions for images',
    pipeline: 'image-to-text'
  },

  // === TEXT CLASSIFICATION ===
  {
    id: 'transformers:distilbert-base-uncased-finetuned-sst-2-english',
    huggingFaceId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    name: 'DistilBERT Sentiment',
    sizeBytes: 67_000_000,
    sizeLabel: '64MB',
    capabilities: ['text-classification', 'classify'],
    tier: 'LEAN',
    description: 'Sentiment analysis (positive/negative)',
    pipeline: 'text-classification'
  },

  // === ZERO-SHOT CLASSIFICATION ===
  {
    id: 'transformers:bart-large-mnli',
    huggingFaceId: 'Xenova/bart-large-mnli',
    name: 'BART Zero-Shot',
    sizeBytes: 400_000_000,
    sizeLabel: '381MB',
    capabilities: ['zero-shot-classification'],
    tier: 'STEADY',
    description: 'Classify text into any category without training',
    pipeline: 'zero-shot-classification'
  },

  // === SUMMARIZATION ===
  {
    id: 'transformers:distilbart-cnn-6-6',
    huggingFaceId: 'Xenova/distilbart-cnn-6-6',
    name: 'DistilBART Summarizer',
    sizeBytes: 230_000_000,
    sizeLabel: '219MB',
    capabilities: ['summarize'],
    tier: 'LEAN',
    description: 'Fast text summarization',
    pipeline: 'summarization'
  },

  // === TRANSLATION ===
  {
    id: 'transformers:nllb-200-distilled-600M',
    huggingFaceId: 'Xenova/nllb-200-distilled-600M',
    name: 'NLLB Translation',
    sizeBytes: 600_000_000,
    sizeLabel: '572MB',
    capabilities: ['translate'],
    tier: 'STEADY',
    description: 'Translate between 200+ languages',
    pipeline: 'translation'
  }
]

/**
 * HuggingFace cloud models (require API key)
 */
export const HUGGINGFACE_MODELS: ModelRegistryEntry[] = [
  {
    id: 'huggingface:mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct',
    provider: 'huggingface',
    huggingFaceId: 'mistralai/Mistral-7B-Instruct-v0.3',
    tasks: ['chat', 'generate'],
    tier: 'SURPLUS',
    isBuiltIn: true,
    description: 'Fast, capable instruction-following model'
  },
  {
    id: 'huggingface:deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    name: 'DeepSeek R1 7B',
    provider: 'huggingface',
    huggingFaceId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    tasks: ['chat', 'generate'],
    tier: 'SURPLUS',
    isBuiltIn: true,
    description: 'DeepSeek reasoning model, distilled version'
  },
  {
    id: 'huggingface:meta-llama/Llama-3.2-3B-Instruct',
    name: 'Llama 3.2 3B',
    provider: 'huggingface',
    huggingFaceId: 'meta-llama/Llama-3.2-3B-Instruct',
    tasks: ['chat', 'generate'],
    tier: 'STEADY',
    isBuiltIn: true,
    description: 'Meta Llama 3.2 instruction model'
  },
  {
    id: 'huggingface:black-forest-labs/FLUX.1-dev',
    name: 'FLUX.1 Image Gen',
    provider: 'huggingface',
    huggingFaceId: 'black-forest-labs/FLUX.1-dev',
    tasks: ['text-to-image'],
    tier: 'SURPLUS',
    isBuiltIn: true,
    description: 'High-quality text-to-image generation'
  },
  {
    id: 'huggingface:stabilityai/stable-diffusion-xl-base-1.0',
    name: 'Stable Diffusion XL',
    provider: 'huggingface',
    huggingFaceId: 'stabilityai/stable-diffusion-xl-base-1.0',
    tasks: ['text-to-image'],
    tier: 'SURPLUS',
    isBuiltIn: true,
    description: 'Stability AI image generation'
  }
]

/**
 * System stats interface for resource monitoring
 */
export interface SystemStats {
  cpu: {
    usage: number       // 0-100
    temperature?: number // Celsius
  }
  memory: {
    total: number       // bytes
    used: number        // bytes
    free: number        // bytes
  }
  gpu?: {
    usage: number       // 0-100
    memory: number      // bytes used
    memoryTotal?: number // bytes total
    temperature?: number // Celsius
    name?: string
  }
}

/**
 * Loaded model tracking
 */
export interface LoadedModel {
  id: string
  provider: ProviderType
  loadedAt: number      // timestamp
  lastUsed: number      // timestamp
  memoryUsage: number   // estimated bytes
}

/**
 * Custom model configuration (user-added)
 */
export interface CustomModelConfig {
  huggingFaceId: string
  name: string
  tasks: TaskType[]
  pipelineType?: TransformersPipelineType
  provider: 'transformers' | 'huggingface'
}
