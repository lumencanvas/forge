/**
 * SILO Foreman
 * Decomposes natural language tasks into executable plans
 * Adapted from orchestrator.js with Ollama integration
 */

import type { FileInfo } from '@/stores/files'

// Task types the orchestrator understands
export const TASK_TYPES = {
  ANALYZE: 'analyze',
  SUMMARIZE: 'summarize',
  EXTRACT: 'extract',
  GENERATE: 'generate',
  TRANSFORM: 'transform',
  SEARCH: 'search',
  ORGANIZE: 'organize',
  COMPARE: 'compare',
  TRANSCRIBE: 'transcribe'
} as const

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES]

export interface PlanStep {
  id: string
  name: string
  description: string
  models?: string[]
  tool?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  prompt?: string
}

export interface PlanPhase {
  name: string
  description: string
  steps: PlanStep[]
}

export interface Intent {
  primary: TaskType
  all: Array<{ type: TaskType; keyword: string; confidence: number }>
  context: {
    wantsOutput: boolean
    mentionsPatterns: boolean
    mentionsComparison: boolean
    wantsBatch: boolean
  }
  raw: string
}

export interface ExecutionPlan {
  id: string
  request: string
  intent: Intent
  phases: PlanPhase[]
  modelsNeeded: string[]
  estimate: {
    seconds: number
    formatted: string
  }
  status: 'pending' | 'running' | 'complete' | 'error'
}

// Model recommendations based on hardware tier (Ollama model names)
const MODEL_RECOMMENDATIONS = {
  EMBER: {
    vision: 'moondream',
    language: 'llama3.2:3b',
    audio: 'whisper-tiny'
  },
  FLAME: {
    vision: 'llava:7b',
    language: 'mistral:7b',
    audio: 'whisper-base'
  },
  BLAZE: {
    vision: 'llama3.2-vision:11b',
    language: 'qwen2.5:14b',
    audio: 'whisper-medium'
  },
  INFERNO: {
    vision: 'llava:34b',
    language: 'deepseek-r1:70b',
    audio: 'whisper-large-v3'
  }
} as const

type TierName = keyof typeof MODEL_RECOMMENDATIONS

/**
 * Extract the primary intent from a natural language request
 */
function extractIntent(request: string): Intent {
  const lower = request.toLowerCase()

  // Keywords mapping to task types
  const intentKeywords: Record<TaskType, string[]> = {
    [TASK_TYPES.ANALYZE]: ['analyze', 'analysis', 'examine', 'inspect', 'look at', 'check', 'review'],
    [TASK_TYPES.SUMMARIZE]: ['summarize', 'summary', 'tldr', 'overview', 'brief', 'condense'],
    [TASK_TYPES.EXTRACT]: ['extract', 'pull out', 'get', 'find', 'identify', 'detect'],
    [TASK_TYPES.GENERATE]: ['generate', 'create', 'make', 'write', 'produce', 'build'],
    [TASK_TYPES.TRANSFORM]: ['convert', 'transform', 'change', 'modify', 'process'],
    [TASK_TYPES.SEARCH]: ['search', 'find', 'look for', 'locate', 'where'],
    [TASK_TYPES.ORGANIZE]: ['organize', 'sort', 'categorize', 'group', 'arrange', 'structure'],
    [TASK_TYPES.COMPARE]: ['compare', 'difference', 'similar', 'contrast', 'match'],
    [TASK_TYPES.TRANSCRIBE]: ['transcribe', 'transcription', 'speech to text', 'audio to text']
  }

  const intents: Array<{ type: TaskType; keyword: string; confidence: number }> = []

  for (const [taskType, keywords] of Object.entries(intentKeywords)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        intents.push({ type: taskType as TaskType, keyword, confidence: 0.8 })
      }
    }
  }

  // Extract additional context
  const context = {
    wantsOutput: lower.includes('save') || lower.includes('export') || lower.includes('create') || lower.includes('generate'),
    mentionsPatterns: lower.includes('pattern') || lower.includes('trend') || lower.includes('common'),
    mentionsComparison: lower.includes('compare') || lower.includes('similar') || lower.includes('different'),
    wantsBatch: lower.includes('all') || lower.includes('each') || lower.includes('every') || lower.includes('folder')
  }

  return {
    primary: intents[0]?.type || TASK_TYPES.ANALYZE,
    all: intents,
    context,
    raw: request
  }
}

/**
 * Select appropriate model based on tier and task
 */
function selectVisionModel(tier: TierName): string {
  return MODEL_RECOMMENDATIONS[tier]?.vision || MODEL_RECOMMENDATIONS.EMBER.vision
}

function selectLanguageModel(tier: TierName): string {
  return MODEL_RECOMMENDATIONS[tier]?.language || MODEL_RECOMMENDATIONS.EMBER.language
}

function selectAudioModel(tier: TierName): string {
  return MODEL_RECOMMENDATIONS[tier]?.audio || MODEL_RECOMMENDATIONS.EMBER.audio
}

/**
 * Build prompt based on intent
 */
function buildVisionPrompt(intent: Intent): string {
  const base = 'Analyze this image and provide a detailed description.'

  switch (intent.primary) {
    case TASK_TYPES.EXTRACT:
      return `${base} Focus on extracting specific information, objects, and text visible in the image.`
    case TASK_TYPES.ORGANIZE:
      return `${base} Identify key attributes that could be used for categorization and organization.`
    case TASK_TYPES.COMPARE:
      return `${base} Note distinctive features, style, composition, and content for comparison purposes.`
    default:
      return base
  }
}

function buildTextPrompt(intent: Intent): string {
  switch (intent.primary) {
    case TASK_TYPES.SUMMARIZE:
      return 'Provide a concise summary of this document, highlighting key points and main arguments.'
    case TASK_TYPES.EXTRACT:
      return 'Extract key information, facts, names, dates, and important details from this document.'
    case TASK_TYPES.ANALYZE:
      return 'Analyze this document, identifying its main themes, arguments, and structure.'
    default:
      return 'Process this document and provide relevant insights.'
  }
}

/**
 * Get category stats from files
 */
function getCategoryStats(files: FileInfo[]): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const file of files) {
    stats[file.category] = (stats[file.category] || 0) + 1
  }
  return stats
}

/**
 * Build processing phase for file prep
 */
function buildProcessingPhase(files: FileInfo[], tier: TierName): PlanPhase {
  const steps: PlanStep[] = []
  const stats = getCategoryStats(files)

  // Audio transcription
  if (stats.audio && stats.audio > 0) {
    steps.push({
      id: 'transcribe',
      name: 'Transcribe Audio',
      description: 'Convert audio files to text using Whisper',
      tool: 'whisper',
      models: [selectAudioModel(tier)],
      status: 'pending'
    })
  }

  return {
    name: 'Document Processing',
    description: 'Prepare files for analysis',
    steps
  }
}

/**
 * Build core analysis phase
 */
function buildCorePhase(intent: Intent, files: FileInfo[], tier: TierName): PlanPhase {
  const steps: PlanStep[] = []
  const stats = getCategoryStats(files)

  // Image analysis
  if (stats.image && stats.image > 0) {
    steps.push({
      id: 'vision_analysis',
      name: 'Analyze Images',
      description: 'Describe and analyze image content',
      models: [selectVisionModel(tier)],
      prompt: buildVisionPrompt(intent),
      status: 'pending'
    })
  }

  // Text analysis
  const hasText = (stats.document || 0) > 0 ||
                 (stats.code || 0) > 0 ||
                 (stats.data || 0) > 0

  if (hasText) {
    steps.push({
      id: 'text_analysis',
      name: 'Analyze Text Content',
      description: 'Process and analyze text documents',
      models: [selectLanguageModel(tier)],
      prompt: buildTextPrompt(intent),
      status: 'pending'
    })
  }

  // Generate embeddings for semantic operations
  if (intent.context.mentionsPatterns || intent.context.mentionsComparison) {
    steps.push({
      id: 'embeddings',
      name: 'Generate Embeddings',
      description: 'Create semantic embeddings for similarity analysis',
      models: ['nomic-embed-text'],
      status: 'pending'
    })
  }

  return {
    name: 'Core Analysis',
    description: `Perform ${intent.primary} on inputs`,
    steps
  }
}

/**
 * Build synthesis phase
 */
function buildSynthesisPhase(intent: Intent, files: FileInfo[], tier: TierName): PlanPhase {
  const steps: PlanStep[] = []

  if (intent.context.mentionsPatterns) {
    steps.push({
      id: 'pattern_detection',
      name: 'Detect Patterns',
      description: 'Find common themes and patterns across documents',
      models: [selectLanguageModel(tier)],
      status: 'pending'
    })
  }

  if (intent.context.mentionsComparison) {
    steps.push({
      id: 'comparison',
      name: 'Compare and Contrast',
      description: 'Identify similarities and differences',
      models: [selectLanguageModel(tier)],
      status: 'pending'
    })
  }

  // Always add a summary synthesis for multiple files
  if (files.length > 1) {
    steps.push({
      id: 'synthesis',
      name: 'Synthesize Findings',
      description: 'Combine individual analyses into cohesive summary',
      models: [selectLanguageModel(tier)],
      status: 'pending'
    })
  }

  return {
    name: 'Synthesis',
    description: 'Combine and synthesize results',
    steps
  }
}

/**
 * Build output phase
 */
function buildOutputPhase(tier: TierName): PlanPhase {
  return {
    name: 'Output Generation',
    description: 'Create final deliverables',
    steps: [
      {
        id: 'format_output',
        name: 'Format Output',
        description: 'Generate final output document',
        models: [selectLanguageModel(tier)],
        status: 'pending'
      }
    ]
  }
}

/**
 * Estimate execution time
 */
function estimateExecution(phases: PlanPhase[], files: FileInfo[], tier: TierName): { seconds: number; formatted: string } {
  const tierMultiplier: Record<TierName, number> = {
    EMBER: 4,
    FLAME: 2,
    BLAZE: 1,
    INFERNO: 0.5
  }
  const multiplier = tierMultiplier[tier] || 2
  const stats = getCategoryStats(files)

  let baseSeconds = 0

  // Estimate per file type
  baseSeconds += (stats.image || 0) * 5
  baseSeconds += (stats.document || 0) * 10
  baseSeconds += (stats.audio || 0) * 30
  baseSeconds += (stats.code || 0) * 3

  // Add overhead for synthesis
  if (phases.length > 2) {
    baseSeconds += 30
  }

  const totalSeconds = Math.round(baseSeconds * multiplier)
  const minutes = Math.ceil(totalSeconds / 60)

  return {
    seconds: totalSeconds,
    formatted: minutes > 1 ? `~${minutes} min` : `~${totalSeconds} sec`
  }
}

/**
 * Create an execution plan from a request and files
 */
export function createPlan(request: string, files: FileInfo[], tierName: string): ExecutionPlan {
  const tier = (tierName as TierName) || 'EMBER'
  const intent = extractIntent(request)
  const phases: PlanPhase[] = []
  const modelsNeeded = new Set<string>()

  // Phase 1: File Processing (if needed)
  const processingPhase = buildProcessingPhase(files, tier)
  if (processingPhase.steps.length > 0) {
    phases.push(processingPhase)
    processingPhase.steps.forEach(s => s.models?.forEach(m => modelsNeeded.add(m)))
  }

  // Phase 2: Analysis/Core Task
  const corePhase = buildCorePhase(intent, files, tier)
  if (corePhase.steps.length > 0) {
    phases.push(corePhase)
    corePhase.steps.forEach(s => s.models?.forEach(m => modelsNeeded.add(m)))
  }

  // Phase 3: Synthesis (if multiple inputs or comparison needed)
  if (files.length > 1 || intent.context.mentionsComparison) {
    const synthesisPhase = buildSynthesisPhase(intent, files, tier)
    if (synthesisPhase.steps.length > 0) {
      phases.push(synthesisPhase)
      synthesisPhase.steps.forEach(s => s.models?.forEach(m => modelsNeeded.add(m)))
    }
  }

  // Phase 4: Output Generation (if requested)
  if (intent.context.wantsOutput) {
    const outputPhase = buildOutputPhase(tier)
    phases.push(outputPhase)
    outputPhase.steps.forEach(s => s.models?.forEach(m => modelsNeeded.add(m)))
  }

  // Calculate estimates
  const estimate = estimateExecution(phases, files, tier)

  return {
    id: `plan_${Date.now()}`,
    request,
    intent,
    phases,
    modelsNeeded: Array.from(modelsNeeded),
    estimate,
    status: 'pending'
  }
}
