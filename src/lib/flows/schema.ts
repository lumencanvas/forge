/**
 * SILO - Pipeline Schema
 * Type definitions for pipeline/workflow definitions
 */

// Import task and provider types
export type ProviderType = 'ollama' | 'transformers' | 'huggingface'

export type TaskType =
  | 'chat'
  | 'generate'
  | 'summarize'
  | 'translate'
  | 'question-answering'
  | 'zero-shot-classification'
  | 'text-classification'
  | 'token-classification'
  | 'image-classification'
  | 'object-detection'
  | 'image-segmentation'
  | 'depth-estimation'
  | 'image-to-text'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'audio-classification'
  | 'embed'
  | 'text-to-image'
  | 'classify'

// Legacy model type (for backwards compatibility)
export type ModelType = 'language' | 'vision' | 'audio'

export type PipelineCategory = 'builtin' | 'custom'
export type InputType = 'text' | 'textarea' | 'file' | 'select' | 'toggle'
export type OutputFormat = 'chat' | 'markdown' | 'json'
export type ConditionOperator = 'contains' | 'empty' | 'not_empty' | 'equals' | 'not_equals'
export type ConditionAction = 'continue' | 'skip' | 'stop'

/**
 * Pipeline input field definition
 */
export interface PipelineInput {
  /** Variable name (used in prompts as $name) */
  name: string
  /** Input field type */
  type: InputType
  /** Display label */
  label: string
  /** Placeholder text */
  placeholder?: string
  /** Whether input is required */
  required: boolean
  /** For file inputs: accepted file types */
  accepts?: string[]
  /** For select inputs: available options */
  options?: string[]
  /** Default value */
  defaultValue?: string | boolean
}

/**
 * Conditional logic for pipeline steps
 */
export interface PipelineCondition {
  /** Variable to check (e.g., "$extracted_text") */
  check: string
  /** Comparison operator */
  operator: ConditionOperator
  /** Value to compare against (for equals/contains) */
  value?: string
  /** Action to take if condition is true */
  action: ConditionAction
  /** Step name to skip to (for 'skip' action) */
  skipTo?: string
}

/**
 * Single step in a pipeline
 */
export interface PipelineStep {
  /** Unique step identifier */
  name: string
  /** Human-readable description */
  description?: string

  /**
   * Task to perform (NEW - preferred)
   * If specified, this takes precedence over 'model' field
   */
  task?: TaskType

  /**
   * Model type (LEGACY - for backwards compatibility)
   * Use 'task' field instead for new pipelines
   */
  model?: ModelType

  /**
   * Specific model ID (optional)
   * e.g., "transformers:whisper-tiny.en" or "ollama:llama3.2:3b"
   * If not specified, uses system default for the task
   */
  modelId?: string

  /**
   * Preferred provider (optional)
   * If not specified, uses best available
   */
  provider?: ProviderType

  /** Input variable reference (e.g., "$image" or "$previous_output") */
  input: string
  /** System/instruction prompt */
  prompt: string
  /** Variable name to store result */
  output: string
  /** Optional conditional logic */
  condition?: PipelineCondition
}

/**
 * Complete pipeline definition
 */
export interface Pipeline {
  /** Unique pipeline identifier */
  id: string
  /** Display name */
  name: string
  /** Icon (emoji or icon name) */
  icon: string
  /** Brief description */
  description: string
  /** Category: builtin or custom */
  category: PipelineCategory
  /** User input fields */
  inputs: PipelineInput[]
  /** Processing steps */
  steps: PipelineStep[]
  /** Optional output format */
  outputFormat?: OutputFormat
  /** Optional system prompt applied to all steps */
  systemPrompt?: string
  /** Tags for categorization */
  tags?: string[]
}

/**
 * Runtime context for pipeline execution
 */
export interface PipelineContext {
  /** Input values provided by user */
  inputs: Record<string, string | string[] | boolean>
  /** Results from completed steps */
  stepResults: Record<string, string>
  /** Current model being used */
  currentModel?: string
  /** Attached files (base64 or paths) */
  files?: Array<{
    name: string
    path: string
    type: string
    data?: string
  }>
}

/**
 * Maps legacy ModelType to modern TaskType
 */
export function modelTypeToTaskType(modelType: ModelType): TaskType {
  switch (modelType) {
    case 'language':
      return 'chat'
    case 'vision':
      return 'image-to-text'
    case 'audio':
      return 'speech-to-text'
    default:
      return 'chat'
  }
}

/**
 * Gets the effective task type from a step
 */
export function getStepTaskType(step: PipelineStep): TaskType {
  if (step.task) {
    return step.task
  }
  if (step.model) {
    return modelTypeToTaskType(step.model)
  }
  return 'chat'
}

/**
 * Checks if a task is a vision task
 */
export function isVisionTask(task: TaskType): boolean {
  return [
    'image-classification',
    'object-detection',
    'image-segmentation',
    'depth-estimation',
    'image-to-text'
  ].includes(task)
}

/**
 * Checks if a task is an audio task
 */
export function isAudioTask(task: TaskType): boolean {
  return [
    'speech-to-text',
    'text-to-speech',
    'audio-classification'
  ].includes(task)
}

/**
 * Checks if a task is a text generation task
 */
export function isTextTask(task: TaskType): boolean {
  return [
    'chat',
    'generate',
    'summarize',
    'translate',
    'question-answering',
    'text-classification',
    'zero-shot-classification',
    'token-classification'
  ].includes(task)
}

/**
 * Validates a pipeline definition
 */
export function validatePipeline(pipeline: Partial<Pipeline>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!pipeline.name?.trim()) {
    errors.push('Pipeline name is required')
  }

  if (!pipeline.steps || pipeline.steps.length === 0) {
    errors.push('Pipeline must have at least one step')
  }

  if (pipeline.steps) {
    const outputNames = new Set<string>()
    const inputNames = new Set(pipeline.inputs?.map(i => i.name) || [])

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i]!

      if (!step.name?.trim()) {
        errors.push(`Step ${i + 1}: name is required`)
      }

      if (!step.prompt?.trim()) {
        errors.push(`Step ${i + 1}: prompt is required`)
      }

      if (!step.output?.trim()) {
        errors.push(`Step ${i + 1}: output variable name is required`)
      }

      // Validate task or model is specified
      if (!step.task && !step.model) {
        errors.push(`Step ${i + 1}: either 'task' or 'model' must be specified`)
      }

      // Check input reference
      if (step.input) {
        const inputRef = step.input.replace(/^\$/, '')
        if (!inputNames.has(inputRef) && !outputNames.has(inputRef)) {
          // Allow direct text input
          if (step.input.startsWith('$')) {
            errors.push(`Step ${i + 1}: input "$${inputRef}" not found`)
          }
        }
      }

      if (step.output) {
        outputNames.add(step.output)
      }
    }
  }

  if (pipeline.inputs) {
    const inputNames = new Set<string>()
    for (let i = 0; i < pipeline.inputs.length; i++) {
      const input = pipeline.inputs[i]!

      if (!input.name?.trim()) {
        errors.push(`Input ${i + 1}: name is required`)
      }

      if (inputNames.has(input.name)) {
        errors.push(`Input ${i + 1}: duplicate name "${input.name}"`)
      }
      inputNames.add(input.name)

      if (!input.label?.trim()) {
        errors.push(`Input ${i + 1}: label is required`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Creates a blank pipeline template
 */
export function createBlankPipeline(): Partial<Pipeline> {
  return {
    name: '',
    icon: 'tool',
    description: '',
    category: 'custom',
    inputs: [],
    steps: [],
    outputFormat: 'chat'
  }
}

/**
 * Creates a simple single-step pipeline
 */
export function createSimplePipeline(
  name: string,
  icon: string,
  description: string,
  inputLabel: string,
  systemPrompt: string,
  taskType: TaskType = 'chat'
): Pipeline {
  const isVision = isVisionTask(taskType)
  const isAudio = isAudioTask(taskType)

  return {
    id: `custom-${Date.now()}`,
    name,
    icon,
    description,
    category: 'custom',
    inputs: [
      {
        name: 'input',
        type: isVision ? 'file' : isAudio ? 'file' : 'textarea',
        label: inputLabel,
        placeholder: isVision ? 'Select an image...' : isAudio ? 'Select an audio file...' : 'Enter your input...',
        required: true,
        accepts: isVision ? ['image/*'] : isAudio ? ['audio/*'] : undefined
      }
    ],
    steps: [
      {
        name: 'process',
        task: taskType,
        input: '$input',
        prompt: systemPrompt,
        output: 'result'
      }
    ],
    outputFormat: 'chat'
  }
}

// Backwards compatibility aliases
export type FlowCategory = PipelineCategory
export type FlowInput = PipelineInput
export type FlowCondition = PipelineCondition
export type FlowStep = PipelineStep
export type Flow = Pipeline
export type FlowContext = PipelineContext

export const validateFlow = validatePipeline
export const createBlankFlow = createBlankPipeline
export const createSimpleFlow = createSimplePipeline
