/**
 * SILO Model Providers
 * Multi-backend model support for local AI inference
 */

// Types
export type {
  ProviderType,
  TaskType,
  HardwareTier,
  ModelInfo,
  ProviderStatus,
  AllProvidersStatus,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  GenerateOptions,
  GenerateResponse,
  EmbedOptions,
  EmbedResponse,
  VisionOptions,
  VisionResponse,
  AudioOptions,
  AudioResponse,
  ImageGenOptions,
  ImageGenResponse,
  ModelPullProgress,
  ModelProvider,
  TransformersModelConfig,
  TransformersPipelineType,
  ModelRegistryEntry,
  SystemStats,
  LoadedModel,
  CustomModelConfig,
  ImageClassificationResult,
  ObjectDetectionResult,
  SpeechToTextResult
} from './types'

export { TRANSFORMERS_MODELS, HUGGINGFACE_MODELS } from './types'

// Providers
export { OllamaProvider, OLLAMA_MODEL_RECOMMENDATIONS } from './ollama'
export type { OllamaModel, OllamaStatus, OllamaStatusInfo } from './ollama'

export { TransformersProvider } from './transformers'
export { HuggingFaceProvider } from './huggingface'

// Resource Manager
export { ResourceManager, getResourceManager } from './resources'

// Manager
export { ModelProviderManager, getModelProviderManager } from './manager'
