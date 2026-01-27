/**
 * SILO - Pipeline Executor
 * Executes pipelines step by step
 */

import type { Flow, FlowStep, FlowContext, FlowCondition } from './schema'

export interface ExecutionCallbacks {
  onStepStart?: (step: FlowStep, index: number) => void
  onStepComplete?: (step: FlowStep, index: number, result: string) => void
  onStepError?: (step: FlowStep, index: number, error: Error) => void
  onProgress?: (current: number, total: number) => void
  onStreamChunk?: (chunk: string) => void
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
  callbacks?: ExecutionCallbacks
): Promise<string> {
  const input = resolveInput(step, context)
  const prompt = interpolate(step.prompt, context)

  // Determine which model to use based on step.model type
  // In a real implementation, this would use the settings store
  // to get the appropriate model for the type
  const modelMap: Record<string, string> = {
    language: context.currentModel || 'llama3.2:3b',
    vision: 'llava:7b',
    audio: 'whisper'
  }

  const model = modelMap[step.model] || modelMap.language!

  // Check if this is a vision model request with files
  const isVisionStep = step.model === 'vision'
  const hasImages = context.files && context.files.some(f => f.type.startsWith('image/'))

  try {
    if (isVisionStep && hasImages && context.files) {
      // Vision model with images
      const images = context.files
        .filter(f => f.type.startsWith('image/'))
        .map(f => f.data || f.path)
        .filter(Boolean) as string[]

      const response = await window.silo.ollama.generate({
        model,
        prompt: `${prompt}\n\n${input}`,
        images
      })

      return response.response
    } else {
      // Regular language model
      const response = await window.silo.ollama.chat({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: input }
        ]
      })

      return response.message.content
    }
  } catch (error) {
    throw new Error(`Step "${step.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Executes a complete flow
 */
export async function executeFlow(
  flow: Flow,
  inputs: Record<string, string | string[] | boolean>,
  callbacks?: ExecutionCallbacks
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
      // In a real implementation, we'd read the file and get its data
      context.files?.push({
        name: key,
        path: value,
        type: input.accepts?.[0]?.includes('image') ? 'image/unknown' : 'application/octet-stream'
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
        const result = await executeStep(step, context, callbacks)
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
 * Gets the models required by a flow
 */
export function getRequiredModels(flow: Flow): Set<string> {
  const models = new Set<string>()

  for (const step of flow.steps) {
    models.add(step.model)
  }

  return models
}
