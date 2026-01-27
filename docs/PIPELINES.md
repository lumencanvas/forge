# SILO Pipeline System

Pipelines are reusable AI workflows that can combine multiple models and processing steps.

## Overview

A pipeline defines:
- **Inputs**: What the user provides (text, files, options)
- **Steps**: AI operations to perform
- **Outputs**: How results are presented

## Pipeline Schema

```typescript
interface Pipeline {
  id: string                    // Unique identifier
  name: string                  // Display name
  icon: string                  // Icon identifier
  description: string           // Brief description
  category: 'builtin' | 'custom'
  inputs: PipelineInput[]       // User input fields
  steps: PipelineStep[]         // Processing steps
  outputFormat?: 'chat' | 'markdown' | 'json'
  systemPrompt?: string         // Global system prompt
  tags?: string[]               // For categorization
}
```

## Input Types

```typescript
interface PipelineInput {
  name: string                  // Variable name (used as $name)
  type: 'text' | 'textarea' | 'file' | 'select' | 'toggle'
  label: string                 // Display label
  placeholder?: string
  required: boolean
  accepts?: string[]            // For files: ['image/*', '.pdf']
  options?: string[]            // For select dropdowns
  defaultValue?: string | boolean
}
```

### Examples

**Text Input:**
```json
{
  "name": "topic",
  "type": "text",
  "label": "Topic",
  "placeholder": "Enter a topic...",
  "required": true
}
```

**File Input:**
```json
{
  "name": "image",
  "type": "file",
  "label": "Upload image",
  "accepts": ["image/*"],
  "required": true
}
```

**Select Input:**
```json
{
  "name": "style",
  "type": "select",
  "label": "Writing style",
  "options": ["Formal", "Casual", "Technical"],
  "defaultValue": "Formal"
}
```

## Step Configuration

```typescript
interface PipelineStep {
  name: string                  // Step identifier
  description?: string          // Human-readable description
  model: 'language' | 'vision' | 'audio'
  input: string                 // Variable reference: "$varname"
  prompt: string                // Instructions for the AI
  output: string                // Variable to store result
  condition?: PipelineCondition // Optional conditional logic
}
```

### Model Types

| Type | Use Case | Example Models |
|------|----------|----------------|
| `language` | Text generation, analysis | llama3.2, mistral, qwen2.5 |
| `vision` | Image understanding | llava, llama3.2-vision |
| `audio` | Speech transcription | whisper |

### Variable References

Use `$variableName` to reference:
- Input values: `$topic`, `$image`
- Previous step outputs: `$extracted_text`, `$summary`

### Prompt Templates

Prompts support Handlebars-style templating:

```
Summarize the following in {{style}} style:

{{$content}}

Focus on: {{focus}}
```

## Conditions

Add conditional logic between steps:

```typescript
interface PipelineCondition {
  check: string                 // Variable to check: "$extracted_text"
  operator: 'contains' | 'empty' | 'not_empty' | 'equals' | 'not_equals'
  value?: string                // For equals/contains
  action: 'continue' | 'skip' | 'stop'
  skipTo?: string               // Step name for 'skip' action
}
```

### Example: Skip if empty

```json
{
  "condition": {
    "check": "$extracted_text",
    "operator": "empty",
    "action": "stop"
  }
}
```

## Complete Examples

### Simple Chat Pipeline

```json
{
  "id": "simple-chat",
  "name": "Simple Chat",
  "icon": "chat",
  "description": "Basic conversation",
  "category": "custom",
  "inputs": [
    {
      "name": "message",
      "type": "textarea",
      "label": "Your message",
      "required": true
    }
  ],
  "steps": [
    {
      "name": "respond",
      "model": "language",
      "input": "$message",
      "prompt": "You are a helpful assistant. Respond thoughtfully.",
      "output": "response"
    }
  ]
}
```

### Multi-Step Document Analysis

```json
{
  "id": "doc-analyzer",
  "name": "Document Analyzer",
  "icon": "doc",
  "description": "Extract and organize document content",
  "category": "custom",
  "inputs": [
    {
      "name": "document",
      "type": "file",
      "label": "Upload document",
      "accepts": ["image/*", ".pdf"],
      "required": true
    },
    {
      "name": "focus",
      "type": "text",
      "label": "What to focus on",
      "placeholder": "e.g., dates, names, action items",
      "required": false
    }
  ],
  "steps": [
    {
      "name": "extract",
      "description": "Extract text from document",
      "model": "vision",
      "input": "$document",
      "prompt": "Extract all text from this document. Preserve structure.",
      "output": "extracted_text"
    },
    {
      "name": "analyze",
      "description": "Analyze the content",
      "model": "language",
      "input": "$extracted_text",
      "prompt": "Analyze this document content. {{#if focus}}Focus on: {{focus}}{{/if}}\n\nProvide:\n1. Summary\n2. Key points\n3. Action items",
      "output": "analysis"
    }
  ]
}
```

### Conditional Pipeline

```json
{
  "id": "smart-summarizer",
  "name": "Smart Summarizer",
  "icon": "summary",
  "description": "Summarizes only if content is long enough",
  "category": "custom",
  "inputs": [
    {
      "name": "content",
      "type": "textarea",
      "label": "Content to summarize",
      "required": true
    }
  ],
  "steps": [
    {
      "name": "check_length",
      "model": "language",
      "input": "$content",
      "prompt": "If this text is less than 100 words, respond with just 'SHORT'. Otherwise respond with 'LONG'.",
      "output": "length_check"
    },
    {
      "name": "summarize",
      "model": "language",
      "input": "$content",
      "prompt": "Provide a concise summary of this content.",
      "output": "summary",
      "condition": {
        "check": "$length_check",
        "operator": "contains",
        "value": "LONG",
        "action": "continue"
      }
    }
  ]
}
```

## Creating Pipelines

### 1. Guided Builder

Best for: Simple, single-step pipelines

1. Go to Pipeline Library > Create New
2. Follow the step-by-step wizard
3. Test your pipeline
4. Save

### 2. Multi-Step Builder

Best for: Complex workflows with multiple steps

1. Define inputs
2. Add steps with the visual editor
3. Configure conditions between steps
4. Test and save

### 3. AI-Assisted Builder

Best for: When you're not sure how to structure it

1. Describe your workflow in plain language
2. SILO generates a pipeline schema
3. Review and edit if needed
4. Save

### 4. JSON Editor

Best for: Power users and importing/exporting

1. Write or paste pipeline JSON
2. Validate the schema
3. Save

## Import/Export

Pipelines can be exported as `.silo` files (JSON):

```bash
# Export
Settings > Data > Export Pipeline

# Import
Pipeline Library > Import > Select .silo file
```

## Execution

When a pipeline runs:

1. User fills in inputs
2. Executor validates required fields
3. Each step runs sequentially:
   - Variables are resolved
   - Prompt is interpolated
   - Model is called via Ollama
   - Result is stored
4. Final output is displayed

## Best Practices

1. **Clear Prompts**: Be specific about what you want
2. **Variable Names**: Use descriptive names (`extracted_text` not `txt`)
3. **Error Handling**: Consider what happens if a step fails
4. **Testing**: Test with various inputs before saving
5. **Documentation**: Add descriptions to steps

## API Reference

### validatePipeline(pipeline)

Validates a pipeline definition:

```typescript
const { valid, errors } = validatePipeline(pipeline)
if (!valid) {
  console.error(errors)
}
```

### executeFlow(pipeline, inputs, callbacks)

Executes a pipeline:

```typescript
const result = await executeFlow(pipeline, {
  topic: "AI safety",
  style: "Technical"
}, {
  onStepStart: (step, index) => console.log(`Starting ${step.name}`),
  onStepComplete: (step, index, result) => console.log(`Done: ${result}`),
  onProgress: (current, total) => console.log(`${current}/${total}`)
})
```

### createSimplePipeline(...)

Creates a basic single-step pipeline:

```typescript
const pipeline = createSimplePipeline(
  "My Pipeline",           // name
  "tool",                  // icon
  "Does something cool",   // description
  "Enter text",            // input label
  "You are a helpful AI",  // system prompt
  "language"               // model type
)
```
