/**
 * SILO - Pipeline Schema
 * Type definitions for pipeline/workflow definitions
 */

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
  /** Model type required */
  model: ModelType
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
  modelType: ModelType = 'language'
): Pipeline {
  return {
    id: `custom-${Date.now()}`,
    name,
    icon,
    description,
    category: 'custom',
    inputs: [
      {
        name: 'input',
        type: modelType === 'vision' ? 'file' : 'textarea',
        label: inputLabel,
        placeholder: 'Enter your input...',
        required: true,
        accepts: modelType === 'vision' ? ['image/*'] : undefined
      }
    ],
    steps: [
      {
        name: 'process',
        model: modelType,
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
