/**
 * SILO - Pipeline Executor
 * Executes pipelines step by step with multi-task support
 */

import type { Flow, FlowStep, FlowContext, FlowCondition, TaskType, ProviderType } from './schema'
import { getStepTaskType, isVisionTask, isAudioTask, isTextTask } from './schema'

export interface ExecutionCallbacks {
  onStepStart?: (step: FlowStep, index: number) => void
  onStepComplete?: (step: FlowStep, index: number, result: string) => void
  onStepError?: (step: FlowStep, index: number, error: Error) => void
  onProgress?: (current: number, total: number) => void
  onStreamChunk?: (chunk: string) => void
}

export interface ExecutionOptions {
  /** Preferred provider for all tasks */
  defaultProvider?: ProviderType
  /** Enable fallback to other providers */
  fallbackEnabled?: boolean
  /** Default models by task type (from settings) */
  defaultModels?: Partial<Record<TaskType, string>>
}

export interface ExecutionResult {
  success: boolean
  output: string
  stepResults: Record<string, string>
  error?: string
  duration: number
}

/**
 * Interpolates variables in a string
 * Replaces {{variable}} and $variable with values from context
 */
function interpolate(template: string, context: FlowContext): string {
  let result = template

  // Replace {{variable}} syntax (handlebars-style)
  result = result.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const trimmed = expr.trim()

    // Handle conditionals {{#if var}}...{{/if}}
    if (trimmed.startsWith('#if ')) {
      // Simple conditional - just return empty for now
      // Full implementation would need proper parsing
      return ''
    }
    if (trimmed === '/if') {
      return ''
    }

    // Handle variable reference
    const varName = trimmed.replace(/^\$/, '')
    if (context.inputs[varName] !== undefined) {
      const value = context.inputs[varName]
      return Array.isArray(value) ? value.join(', ') : String(value)
    }
    if (context.stepResults[varName] !== undefined) {
      return context.stepResults[varName]!
    }

    return `{{${trimmed}}}`
  })

  // Replace $variable syntax
  result = result.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, varName) => {
    if (context.inputs[varName] !== undefined) {
      const value = context.inputs[varName]
      return Array.isArray(value) ? value.join(', ') : String(value)
    }
    if (context.stepResults[varName] !== undefined) {
      return context.stepResults[varName]!
    }
    return `$${varName}`
  })

  return result
}

/**
 * Evaluates a condition against the current context
 */
function evaluateCondition(condition: FlowCondition, context: FlowContext): boolean {
  const varName = condition.check.replace(/^\$/, '')
  const value = context.stepResults[varName] ?? context.inputs[varName] ?? ''
  const strValue = Array.isArray(value) ? value.join(' ') : String(value)

  switch (condition.operator) {
    case 'empty':
      return strValue.trim() === ''
    case 'not_empty':
      return strValue.trim() !== ''
    case 'contains':
      return strValue.toLowerCase().includes((condition.value || '').toLowerCase())
    case 'equals':
      return strValue === condition.value
    case 'not_equals':
      return strValue !== condition.value
    default:
      return true
  }
}

/**
 * Resolves the input for a step
 */
function resolveInput(step: FlowStep, context: FlowContext): string {
  if (!step.input) return ''

  // If input starts with $, it's a variable reference
  if (step.input.startsWith('$')) {
    const varName = step.input.substring(1)

    // Check inputs first
    if (context.inputs[varName] !== undefined) {
      const value = context.inputs[varName]
      if (Array.isArray(value)) {
        return value.join('\n')
      }
      return String(value)
    }

    // Then check step results
    if (context.stepResults[varName] !== undefined) {
      return context.stepResults[varName]!
    }

    return ''
  }

  // Otherwise treat as literal text
  return step.input
}

/**
 * Executes a single flow step
 */
async function executeStep(
  step: FlowStep,
  context: FlowContext,
  options?: ExecutionOptions,
  callbacks?: ExecutionCallbacks
): Promise<string> {
  const input = resolveInput(step, context)
  const prompt = interpolate(step.prompt, context)
  const taskType = getStepTaskType(step)

  // Determine model to use
  const modelId = step.modelId || options?.defaultModels?.[taskType]
  const provider = step.provider || options?.defaultProvider

  try {
    // Route to appropriate API based on task type
    if (isVisionTask(taskType)) {
      return await executeVisionTask(taskType, input, prompt, context, modelId, provider)
    } else if (isAudioTask(taskType)) {
      return await executeAudioTask(taskType, input, context, modelId, provider)
    } else if (taskType === 'text-to-image') {
      return await executeImageGenTask(input, prompt, modelId, provider)
    } else if (taskType === 'embed') {
      return await executeEmbedTask(input, modelId, provider)
    } else {
      // Text-based tasks (chat, generate, summarize, etc.)
      return await executeTextTask(taskType, input, prompt, context, modelId, provider)
    }
  } catch (error) {
    throw new Error(`Step "${step.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Execute a text-based task
 */
async function executeTextTask(
  task: TaskType,
  input: string,
  prompt: string,
  context: FlowContext,
  modelId?: string,
  provider?: ProviderType
): Promise<string> {
  // Check if this is a vision model request with files (legacy support)
  const isLegacyVision = context.files && context.files.some(f => f.type.startsWith('image/'))

  if (isLegacyVision && context.files) {
    // Legacy vision model with images via Ollama
    const images = context.files
      .filter(f => f.type.startsWith('image/'))
      .map(f => f.data || f.path)
      .filter(Boolean) as string[]

    const response = await window.silo.ollama.generate({
      model: modelId?.replace(/^ollama:/, '') || 'llava:7b',
      prompt: `${prompt}\n\n${input}`,
      images
    })

    return response.response
  }

  // Use unified models API for text tasks
  const response = await window.silo.models.chat({
    model: modelId,
    preferredProvider: provider,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: input }
    ]
  })

  return response.message.content
}

/**
 * Execute a vision task
 */
async function executeVisionTask(
  task: TaskType,
  input: string,
  prompt: string,
  context: FlowContext,
  modelId?: string,
  provider?: ProviderType
): Promise<string> {
  // Get image from input or context files
  let image = input

  if (!image && context.files) {
    const imageFile = context.files.find(f => f.type.startsWith('image/'))
    if (imageFile) {
      image = imageFile.data || imageFile.path
    }
  }

  if (!image) {
    throw new Error('No image provided for vision task')
  }

  const visionTask = task as 'image-classification' | 'object-detection' | 'image-segmentation' | 'depth-estimation' | 'image-to-text'

  const response = await window.silo.models.vision({
    task: visionTask,
    image,
    model: modelId,
    preferredProvider: provider
  })

  // Format results based on task type
  if (task === 'image-classification') {
    const results = response.results as Array<{ label: string; score: number }>
    return results.map(r => `${r.label}: ${(r.score * 100).toFixed(1)}%`).join('\n')
  } else if (task === 'object-detection') {
    const results = response.results as Array<{ label: string; score: number; box: any }>
    return results.map(r => `${r.label} (${(r.score * 100).toFixed(1)}%)`).join('\n')
  } else if (task === 'image-to-text') {
    return response.results as string
  } else if (task === 'depth-estimation') {
    // Returns a depth map image as base64
    return response.results as string
  }

  return JSON.stringify(response.results)
}

/**
 * Execute an audio task
 */
async function executeAudioTask(
  task: TaskType,
  input: string,
  context: FlowContext,
  modelId?: string,
  provider?: ProviderType
): Promise<string> {
  // Get audio from input or context files
  let audio: string | undefined = input

  if (!audio && context.files) {
    const audioFile = context.files.find(f => f.type.startsWith('audio/'))
    if (audioFile) {
      audio = audioFile.path
    }
  }

  if (!audio) {
    throw new Error('No audio provided for audio task')
  }

  const audioTask = task as 'speech-to-text' | 'audio-classification'

  const response = await window.silo.models.audio({
    task: audioTask,
    audio,
    model: modelId,
    preferredProvider: provider
  })

  if (task === 'speech-to-text') {
    const result = response.result as { text: string }
    return result.text
  }

  return JSON.stringify(response.result)
}

/**
 * Execute an image generation task
 */
async function executeImageGenTask(
  prompt: string,
  systemPrompt: string,
  modelId?: string,
  provider?: ProviderType
): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

  const response = await window.silo.models.imageGen({
    prompt: fullPrompt,
    model: modelId,
    preferredProvider: provider
  })

  return response.image
}

/**
 * Execute an embedding task
 */
async function executeEmbedTask(
  input: string,
  modelId?: string,
  provider?: ProviderType
): Promise<string> {
  const response = await window.silo.models.embed({
    text: input,
    model: modelId,
    preferredProvider: provider
  })

  // Return embeddings as JSON string
  return JSON.stringify(response.embeddings)
}

/**
 * Executes a complete flow
 */
export async function executeFlow(
  flow: Flow,
  inputs: Record<string, string | string[] | boolean>,
  callbacks?: ExecutionCallbacks,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const context: FlowContext = {
    inputs,
    stepResults: {},
    files: []
  }

  // Process file inputs
  for (const [key, value] of Object.entries(inputs)) {
    const input = flow.inputs.find(i => i.name === key)
    if (input?.type === 'file' && typeof value === 'string') {
      // Determine file type from accepts or extension
      let fileType = 'application/octet-stream'
      if (input.accepts) {
        if (input.accepts.some(a => a.includes('image'))) {
          fileType = 'image/unknown'
        } else if (input.accepts.some(a => a.includes('audio'))) {
          fileType = 'audio/unknown'
        }
      }

      context.files?.push({
        name: key,
        path: value,
        type: fileType
      })
    }
  }

  let currentStepIndex = 0
  const totalSteps = flow.steps.length

  try {
    while (currentStepIndex < totalSteps) {
      const step = flow.steps[currentStepIndex]!

      callbacks?.onProgress?.(currentStepIndex + 1, totalSteps)
      callbacks?.onStepStart?.(step, currentStepIndex)

      // Check condition if present
      if (step.condition) {
        const conditionMet = evaluateCondition(step.condition, context)

        if (conditionMet) {
          switch (step.condition.action) {
            case 'stop':
              // Stop execution early
              return {
                success: true,
                output: context.stepResults[flow.steps[currentStepIndex - 1]?.output || ''] || '',
                stepResults: context.stepResults,
                duration: Date.now() - startTime
              }

            case 'skip':
              // Skip to specified step or next
              if (step.condition.skipTo) {
                const skipIndex = flow.steps.findIndex(s => s.name === step.condition!.skipTo)
                if (skipIndex >= 0) {
                  currentStepIndex = skipIndex
                  continue
                }
              }
              currentStepIndex++
              continue

            case 'continue':
            default:
              // Continue normally
              break
          }
        }
      }

      // Execute the step
      try {
        const result = await executeStep(step, context, options, callbacks)
        context.stepResults[step.output] = result
        callbacks?.onStepComplete?.(step, currentStepIndex, result)
      } catch (error) {
        callbacks?.onStepError?.(step, currentStepIndex, error as Error)
        throw error
      }

      currentStepIndex++
    }

    // Get final output (last step's output)
    const lastStep = flow.steps[flow.steps.length - 1]
    const finalOutput = lastStep ? context.stepResults[lastStep.output] || '' : ''

    return {
      success: true,
      output: finalOutput,
      stepResults: context.stepResults,
      duration: Date.now() - startTime
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      stepResults: context.stepResults,
      error: error instanceof Error ? error.message : 'Execution failed',
      duration: Date.now() - startTime
    }
  }
}

/**
 * Validates that required inputs are provided
 */
export function validateInputs(
  flow: Flow,
  inputs: Record<string, string | string[] | boolean>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const input of flow.inputs) {
    if (input.required) {
      const value = inputs[input.name]
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        missing.push(input.label || input.name)
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Gets the task types required by a flow
 */
export function getRequiredTasks(flow: Flow): Set<TaskType> {
  const tasks = new Set<TaskType>()

  for (const step of flow.steps) {
    tasks.add(getStepTaskType(step))
  }

  return tasks
}

/**
 * Gets the models required by a flow (legacy)
 */
export function getRequiredModels(flow: Flow): Set<string> {
  const models = new Set<string>()

  for (const step of flow.steps) {
    if (step.model) {
      models.add(step.model)
    } else if (step.task) {
      models.add(step.task)
    }
  }

  return models
}
