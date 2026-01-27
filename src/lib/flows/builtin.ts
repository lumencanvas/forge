/**
 * SILO - Built-in Pipelines
 * Pre-configured workflow definitions
 */

import type { Pipeline } from './schema'

export const builtinPipelines: Pipeline[] = [
  // Chat - Free-form conversation
  {
    id: 'builtin-chat',
    name: 'Chat',
    icon: 'chat',
    description: 'Free-form conversation with AI assistant',
    category: 'builtin',
    inputs: [
      {
        name: 'message',
        type: 'textarea',
        label: 'Your message',
        placeholder: 'Type your message...',
        required: true
      }
    ],
    steps: [
      {
        name: 'respond',
        model: 'language',
        input: '$message',
        prompt: 'You are a helpful AI assistant. Respond thoughtfully and accurately to the user\'s message.',
        output: 'response'
      }
    ],
    outputFormat: 'chat',
    tags: ['conversation', 'general']
  },

  // Analyze Document
  {
    id: 'builtin-analyze-document',
    name: 'Analyze Document',
    icon: 'doc',
    description: 'Extract information and summarize documents',
    category: 'builtin',
    inputs: [
      {
        name: 'document',
        type: 'file',
        label: 'Upload document',
        placeholder: 'Drop a file or click to browse',
        required: true,
        accepts: ['image/*', '.pdf', '.doc', '.docx', '.txt', '.md']
      },
      {
        name: 'focus',
        type: 'text',
        label: 'What to focus on (optional)',
        placeholder: 'e.g., key dates, action items, main arguments',
        required: false
      }
    ],
    steps: [
      {
        name: 'analyze',
        model: 'vision',
        input: '$document',
        prompt: `Analyze this document thoroughly. {{#if focus}}Focus especially on: {{focus}}{{/if}}

Extract and organize:
1. Main topic and purpose
2. Key points and arguments
3. Important dates, names, or figures
4. Any action items or conclusions

Present your analysis in a clear, structured format.`,
        output: 'analysis'
      }
    ],
    outputFormat: 'markdown',
    tags: ['document', 'analysis', 'summary']
  },

  // Describe Images
  {
    id: 'builtin-describe-images',
    name: 'Describe Images',
    icon: 'image',
    description: 'Generate detailed descriptions of images',
    category: 'builtin',
    inputs: [
      {
        name: 'image',
        type: 'file',
        label: 'Upload image',
        placeholder: 'Drop an image or click to browse',
        required: true,
        accepts: ['image/*']
      },
      {
        name: 'style',
        type: 'select',
        label: 'Description style',
        required: false,
        options: ['Detailed', 'Concise', 'Alt Text', 'Technical', 'Creative'],
        defaultValue: 'Detailed'
      }
    ],
    steps: [
      {
        name: 'describe',
        model: 'vision',
        input: '$image',
        prompt: `Describe this image in {{style}} style.

{{#if style == "Detailed"}}
Provide a comprehensive description covering:
- Main subject and composition
- Colors, lighting, and mood
- Background elements and context
- Any text or symbols visible
- Overall impression and meaning
{{/if}}

{{#if style == "Concise"}}
Provide a brief but accurate description in 2-3 sentences.
{{/if}}

{{#if style == "Alt Text"}}
Write accessibility-focused alt text (under 125 characters) that conveys the essential information for screen reader users.
{{/if}}

{{#if style == "Technical"}}
Analyze technical aspects:
- Image composition and framing
- Estimated camera settings or style
- Color palette and contrast
- Technical quality assessment
{{/if}}

{{#if style == "Creative"}}
Describe the image creatively, as if writing for a story or artistic analysis. Explore mood, symbolism, and emotional resonance.
{{/if}}`,
        output: 'description'
      }
    ],
    outputFormat: 'markdown',
    tags: ['image', 'vision', 'accessibility']
  },

  // Write Content
  {
    id: 'builtin-write-content',
    name: 'Write Content',
    icon: 'write',
    description: 'Generate articles, emails, and other written content',
    category: 'builtin',
    inputs: [
      {
        name: 'contentType',
        type: 'select',
        label: 'Content type',
        required: true,
        options: ['Email', 'Article', 'Blog Post', 'Social Media', 'Press Release', 'Report', 'Letter']
      },
      {
        name: 'topic',
        type: 'textarea',
        label: 'Topic and key points',
        placeholder: 'Describe what you want to write about...',
        required: true
      },
      {
        name: 'tone',
        type: 'select',
        label: 'Tone',
        required: false,
        options: ['Professional', 'Casual', 'Formal', 'Friendly', 'Persuasive', 'Informative'],
        defaultValue: 'Professional'
      },
      {
        name: 'length',
        type: 'select',
        label: 'Length',
        required: false,
        options: ['Short', 'Medium', 'Long'],
        defaultValue: 'Medium'
      }
    ],
    steps: [
      {
        name: 'write',
        model: 'language',
        input: '$topic',
        prompt: `Write a {{contentType}} about the following topic:

{{topic}}

Guidelines:
- Tone: {{tone}}
- Length: {{length}} (Short: ~100 words, Medium: ~300 words, Long: ~600 words)
- Make it engaging and well-structured
- Include a clear opening and conclusion
- Use appropriate formatting for the content type`,
        output: 'content'
      }
    ],
    outputFormat: 'markdown',
    tags: ['writing', 'content', 'generation']
  },

  // Research Assistant
  {
    id: 'builtin-research',
    name: 'Research',
    icon: 'search',
    description: 'Deep-dive Q&A and research on any topic',
    category: 'builtin',
    inputs: [
      {
        name: 'question',
        type: 'textarea',
        label: 'Research question',
        placeholder: 'What would you like to research?',
        required: true
      },
      {
        name: 'depth',
        type: 'select',
        label: 'Research depth',
        required: false,
        options: ['Quick Overview', 'Moderate Detail', 'Comprehensive'],
        defaultValue: 'Moderate Detail'
      },
      {
        name: 'context',
        type: 'textarea',
        label: 'Additional context (optional)',
        placeholder: 'Any background information or specific angle...',
        required: false
      }
    ],
    steps: [
      {
        name: 'research',
        model: 'language',
        input: '$question',
        prompt: `Research the following question thoroughly:

{{question}}

{{#if context}}Additional context: {{context}}{{/if}}

Depth level: {{depth}}

{{#if depth == "Quick Overview"}}
Provide a concise overview covering:
- Key facts and definitions
- Main points to understand
- Brief conclusion
{{/if}}

{{#if depth == "Moderate Detail"}}
Provide a balanced analysis including:
- Background and context
- Key concepts and definitions
- Main arguments or perspectives
- Current understanding
- Practical implications
{{/if}}

{{#if depth == "Comprehensive"}}
Provide an in-depth analysis covering:
- Historical background and context
- Detailed explanation of key concepts
- Multiple perspectives and debates
- Evidence and examples
- Current state of knowledge
- Implications and future directions
- Recommended further reading topics
{{/if}}

Structure your response with clear headings and organized information.`,
        output: 'research'
      }
    ],
    outputFormat: 'markdown',
    tags: ['research', 'learning', 'analysis']
  },

  // Summarize Data
  {
    id: 'builtin-summarize',
    name: 'Summarize Data',
    icon: 'data',
    description: 'Condense documents and data into key points',
    category: 'builtin',
    inputs: [
      {
        name: 'content',
        type: 'textarea',
        label: 'Content to summarize',
        placeholder: 'Paste text, data, or notes here...',
        required: true
      },
      {
        name: 'format',
        type: 'select',
        label: 'Summary format',
        required: false,
        options: ['Bullet Points', 'Paragraph', 'Executive Summary', 'Key Takeaways'],
        defaultValue: 'Bullet Points'
      },
      {
        name: 'maxLength',
        type: 'select',
        label: 'Maximum length',
        required: false,
        options: ['Very Brief (1-3 points)', 'Brief (5-7 points)', 'Standard (10+ points)'],
        defaultValue: 'Brief (5-7 points)'
      }
    ],
    steps: [
      {
        name: 'summarize',
        model: 'language',
        input: '$content',
        prompt: `Summarize the following content:

{{content}}

Format: {{format}}
Length: {{maxLength}}

{{#if format == "Bullet Points"}}
Present as clear, actionable bullet points.
{{/if}}

{{#if format == "Paragraph"}}
Write a cohesive summary paragraph.
{{/if}}

{{#if format == "Executive Summary"}}
Write an executive summary suitable for stakeholders, highlighting:
- Key findings
- Main conclusions
- Recommended actions
{{/if}}

{{#if format == "Key Takeaways"}}
List the most important takeaways someone should remember.
{{/if}}

Focus on the most important and actionable information.`,
        output: 'summary'
      }
    ],
    outputFormat: 'markdown',
    tags: ['summary', 'data', 'condensing']
  },

  // Creative Brief
  {
    id: 'builtin-creative-brief',
    name: 'Creative Brief',
    icon: 'creative',
    description: 'Generate creative concepts and campaign ideas',
    category: 'builtin',
    inputs: [
      {
        name: 'project',
        type: 'textarea',
        label: 'Project description',
        placeholder: 'Describe your creative project or campaign...',
        required: true
      },
      {
        name: 'audience',
        type: 'text',
        label: 'Target audience',
        placeholder: 'Who is this for?',
        required: true
      },
      {
        name: 'goals',
        type: 'textarea',
        label: 'Goals and objectives',
        placeholder: 'What do you want to achieve?',
        required: true
      },
      {
        name: 'constraints',
        type: 'textarea',
        label: 'Constraints or requirements (optional)',
        placeholder: 'Budget, timeline, brand guidelines...',
        required: false
      }
    ],
    steps: [
      {
        name: 'brief',
        model: 'language',
        input: '$project',
        prompt: `Create a creative brief for the following project:

**Project:** {{project}}
**Target Audience:** {{audience}}
**Goals:** {{goals}}
{{#if constraints}}**Constraints:** {{constraints}}{{/if}}

Generate a comprehensive creative brief including:

1. **Project Overview**
   - Clear problem statement
   - Project scope

2. **Audience Insights**
   - Audience demographics and psychographics
   - Key motivations and pain points

3. **Creative Strategy**
   - Key message
   - Tone and personality
   - Unique value proposition

4. **Concept Ideas** (provide 3 distinct concepts)
   - Concept name and tagline
   - Visual direction
   - Key executions

5. **Success Metrics**
   - How to measure effectiveness

Make it inspiring and actionable for a creative team.`,
        output: 'brief'
      }
    ],
    outputFormat: 'markdown',
    tags: ['creative', 'marketing', 'campaign']
  },

  // Transcribe (placeholder for audio support)
  {
    id: 'builtin-transcribe',
    name: 'Transcribe',
    icon: 'audio',
    description: 'Convert audio to text (coming soon)',
    category: 'builtin',
    inputs: [
      {
        name: 'audio',
        type: 'file',
        label: 'Upload audio',
        placeholder: 'Drop an audio file or click to browse',
        required: true,
        accepts: ['audio/*', '.mp3', '.wav', '.m4a', '.ogg', '.flac']
      },
      {
        name: 'language',
        type: 'select',
        label: 'Language',
        required: false,
        options: ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Other'],
        defaultValue: 'Auto-detect'
      }
    ],
    steps: [
      {
        name: 'transcribe',
        model: 'audio',
        input: '$audio',
        prompt: 'Transcribe the audio accurately, preserving speaker distinctions if multiple speakers are present. Include timestamps for longer recordings.',
        output: 'transcript'
      }
    ],
    outputFormat: 'markdown',
    tags: ['audio', 'transcription', 'speech']
  }
]

/**
 * Get a built-in pipeline by ID
 */
export function getBuiltinPipeline(id: string): Pipeline | undefined {
  return builtinPipelines.find(p => p.id === id)
}

/**
 * Get built-in pipelines by tag
 */
export function getBuiltinPipelinesByTag(tag: string): Pipeline[] {
  return builtinPipelines.filter(p => p.tags?.includes(tag))
}

/**
 * Get task cards for home screen (subset of pipelines)
 */
export function getTaskCardPipelines(): Pipeline[] {
  const taskCardIds = [
    'builtin-chat',
    'builtin-analyze-document',
    'builtin-describe-images',
    'builtin-write-content',
    'builtin-research',
    'builtin-summarize',
    'builtin-creative-brief'
  ]
  return builtinPipelines.filter(p => taskCardIds.includes(p.id))
}

// Backwards compatibility aliases
export const builtinFlows = builtinPipelines
export const getBuiltinFlow = getBuiltinPipeline
export const getBuiltinFlowsByTag = getBuiltinPipelinesByTag
export const getTaskCardFlows = getTaskCardPipelines
