# SILO Architecture

This document describes the technical architecture of SILO, a local AI workbench built with Electron and Vue 3.

## Overview

SILO follows the standard Electron architecture with a main process and renderer process, communicating via IPC (Inter-Process Communication).

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SILO Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────────┐  │
│  │    Main Process     │   IPC   │      Renderer Process       │  │
│  │    (Node.js)        │◄───────►│      (Vue 3 + Pinia)        │  │
│  ├─────────────────────┤         ├─────────────────────────────┤  │
│  │ • Hardware Detection│         │ • HomeScreen                │  │
│  │ • Ollama Service    │         │ • ChatView                  │  │
│  │ • Settings Storage  │         │ • Pipeline Builder          │  │
│  │ • File Dialogs      │         │ • Settings Panel            │  │
│  │ • Shell Operations  │         │ • Setup Modal               │  │
│  └─────────────────────┘         └─────────────────────────────┘  │
│           │                                   │                    │
│           ▼                                   ▼                    │
│  ┌─────────────────────┐         ┌─────────────────────────────┐  │
│  │   Ollama (Local)    │         │      Pinia Stores           │  │
│  │   localhost:11434   │         │ • settings • chats          │  │
│  └─────────────────────┘         │ • hardware • pipelines      │  │
│                                  │ • setup    • files          │  │
│                                  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Main Process (`electron/main/`)

The main process handles system-level operations and communicates with the Ollama API.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | Entry point, window creation, IPC handler registration |
| `hardware.ts` | System hardware detection and tier classification |
| `ollama.ts` | Ollama API wrapper (list, pull, generate, chat) |
| `settings.ts` | Persistent settings and chat storage (JSON files) |

### Hardware Detection (`hardware.ts`)

Detects system capabilities using the `systeminformation` library:

```typescript
interface HardwareInfo {
  tier: Tier                    // LEAN | STEADY | HEAVY | SURPLUS
  cpu: { brand, cores, speed }
  memory: { total, free, available }
  gpu: { vendor, name, vram, compute }
  platform: { os, arch, release }
  recommendations: {
    models: { vision, language, embeddings, audio }
    parallelCapable: boolean
    gpuAccelerated: boolean
    backend: 'cuda' | 'rocm' | 'metal' | 'cpu'
  }
}
```

**Tier Classification Logic:**

```
VRAM >= 24GB  OR  RAM >= 64GB  →  SURPLUS
VRAM >= 12GB  OR  RAM >= 32GB  →  HEAVY
VRAM >= 6GB   OR  RAM >= 16GB  →  STEADY
Otherwise                       →  LEAN
```

### Ollama Service (`ollama.ts`)

Wraps the Ollama HTTP API with methods for:

- `listModels()` — Get installed models
- `pullModel(name, onProgress)` — Download a model with progress
- `generate(model, prompt, images?)` — Single completion
- `chat(model, messages)` — Multi-turn conversation
- `embeddings(model, prompt)` — Generate embeddings

The service first checks for a running system Ollama instance, then falls back to bundled Ollama via `electron-ollama`.

### Settings Service (`settings.ts`)

Manages persistent storage using native file system:

```
~/.silo/
├── settings.json    # App configuration
├── chats.json       # Chat history
├── chats/           # Individual chat files (future)
├── pipelines/       # Custom pipeline definitions (future)
└── reserve/         # Model storage info (future)
```

## Preload Script (`electron/preload/`)

Exposes a safe API to the renderer via `contextBridge`:

```typescript
interface SiloAPI {
  ollama: {
    listModels(): Promise<{ models: OllamaModel[] }>
    pullModel(model: string): Promise<{ success: boolean }>
    generate(opts: GenerateOptions): Promise<GenerateResponse>
    chat(opts: ChatOptions): Promise<ChatResponse>
    onPullProgress(callback): () => void
  }
  hardware: {
    detect(): Promise<HardwareInfo>
    onInfo(callback): () => void
  }
  settings: {
    get(key): Promise<any>
    set(key, value): Promise<void>
    getAll(): Promise<AppSettings>
    setAll(settings): Promise<void>
    reset(): Promise<void>
  }
  chats: {
    getAll(): Promise<Chat[]>
    get(id): Promise<Chat>
    save(chat): Promise<void>
    delete(id): Promise<void>
    clear(): Promise<void>
  }
  files: {
    selectFiles(): Promise<string[]>
    selectFolder(): Promise<string | undefined>
  }
  shell: {
    openPath(path): Promise<void>
    showItemInFolder(path): void
  }
  storage: {
    getPath(): Promise<string>
    getUserDataPath(): Promise<string>
  }
  data: {
    export(): Promise<ExportData>
    import(data): Promise<void>
    exportToFile(): Promise<{ success: boolean; path?: string }>
    importFromFile(): Promise<{ success: boolean }>
  }
}
```

## Renderer Process (`src/`)

The Vue 3 application with Pinia state management.

### Entry Point (`main.ts`)

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'

createApp(App)
  .use(createPinia())
  .mount('#app')
```

### State Management (Pinia Stores)

| Store | Purpose |
|-------|---------|
| `settings` | App preferences, theme, default models |
| `chats` | Current chat state, message history |
| `hardware` | Hardware info, tier, recommendations |
| `pipelines` | Pipeline definitions, execution state |
| `setup` | First-run wizard state |
| `files` | Attached file management |

#### Settings Store (`stores/settings.ts`)

```typescript
interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  defaultLanguageModel: string
  defaultVisionModel: string
  defaultAudioModel: string
  sendOnEnter: boolean
  showTimestamps: boolean
  chatHistoryPath: string
  pipelinesPath: string
  reservePath: string
  maxChatHistory: number
  telemetryEnabled: boolean
  setupComplete: boolean
  setupVersion: number
}
```

#### Chats Store (`stores/chats.ts`)

```typescript
interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
  timestamp: number
  model?: string
  isStreaming?: boolean
}

interface StoredChat {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  pipelineId?: string
  createdAt: number
  updatedAt: number
}
```

#### Pipelines Store (`stores/flows.ts`)

```typescript
interface PipelineExecutionState {
  pipelineId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  currentStepIndex: number
  stepResults: Record<string, string>
  error?: string
  startedAt?: number
  completedAt?: number
}
```

### Component Architecture

```
App.vue
├── SetupModal.vue              # First-run wizard
├── HomeScreen.vue              # Main dashboard
│   ├── TaskCard.vue            # Pipeline quick-launch cards
│   ├── RecentChats.vue         # Chat history list
│   └── QuickInput.vue          # Quick chat input
├── ChatView.vue                # Chat interface
│   ├── ChatSidebar.vue         # Chat history sidebar
│   ├── ChatMessage.vue         # Message bubble
│   ├── ChatInput.vue           # Message input with attachments
│   └── ModelSelector.vue       # Model dropdown
├── SettingsPanel.vue           # Settings interface
│   ├── SettingsGeneral.vue     # Theme, behavior
│   ├── SettingsModels.vue      # Model management
│   ├── SettingsStorage.vue     # Storage paths, usage
│   └── SettingsData.vue        # Export/import, danger zone
└── flows/                      # Pipeline system
    ├── FlowLibrary.vue         # Browse/manage pipelines
    ├── FlowBuilderSimple.vue   # Guided wizard
    ├── FlowBuilderMulti.vue    # Multi-step builder
    ├── FlowBuilderAI.vue       # AI-assisted builder
    ├── FlowSchema.vue          # JSON editor
    ├── FlowStepForm.vue        # Step editor component
    └── FlowRunner.vue          # Pipeline executor UI
```

### View Routing

SILO uses a simple state-based routing in `App.vue`:

```typescript
type AppView =
  | 'home'
  | 'chat'
  | 'settings'
  | 'flows'
  | 'flow-builder-simple'
  | 'flow-builder-multi'
  | 'flow-builder-ai'
  | 'flow-schema'
  | 'flow-runner'
```

## Pipeline System (`src/lib/flows/`)

The pipeline system enables multi-step AI workflows.

### Schema (`schema.ts`)

```typescript
interface Pipeline {
  id: string
  name: string
  icon: string
  description: string
  category: 'builtin' | 'custom'
  inputs: PipelineInput[]
  steps: PipelineStep[]
  outputFormat?: 'chat' | 'markdown' | 'json'
  systemPrompt?: string
  tags?: string[]
}

interface PipelineStep {
  name: string
  description?: string
  model: 'language' | 'vision' | 'audio'
  input: string              // Variable reference: "$varname"
  prompt: string             // System/instruction prompt
  output: string             // Output variable name
  condition?: PipelineCondition
}
```

### Execution (`executor.ts`)

The executor runs pipelines step by step:

1. Validate required inputs
2. For each step:
   - Resolve input variable references
   - Interpolate template variables in prompt
   - Check conditions (skip/stop if needed)
   - Call appropriate Ollama API (chat or generate with images)
   - Store result in context
3. Return final output and all step results

### Built-in Pipelines (`builtin.ts`)

Pre-configured pipelines for common tasks:

- `builtin-chat` — Free-form conversation
- `builtin-analyze-document` — Document analysis
- `builtin-describe-images` — Image description
- `builtin-write-content` — Content generation
- `builtin-research` — Research assistant
- `builtin-summarize` — Data summarization
- `builtin-creative-brief` — Creative concepts
- `builtin-transcribe` — Audio transcription (placeholder)

## Design System (`src/assets/main.css`)

SILO uses a brutalist industrial design language:

### Color Palette

```css
/* Backgrounds */
--color-void: #050505
--color-base: #0a0a0a
--color-surface: #111111
--color-surface-raised: #1a1a1a

/* Text */
--color-text: #e5e5e5
--color-text-strong: #ffffff
--color-text-muted: #737373

/* Accent */
--color-accent: #ff5c00         /* SILO Orange */
--color-accent-dim: #cc4a00
--color-accent-bright: #ff7a2e
```

### Typography

- **Primary**: JetBrains Mono (monospace)
- **Secondary**: Inter (sans-serif)
- **Scale**: 1.25 ratio (10px to 39px)

### Spacing

- **Base unit**: 4px
- **Scale**: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32

## IPC Communication Flow

```
Renderer                    Main Process                 Ollama
   │                             │                          │
   │  ipcRenderer.invoke()       │                          │
   │ ────────────────────────►   │                          │
   │     'ollama:chat'           │                          │
   │                             │   fetch() to localhost   │
   │                             │ ────────────────────────► │
   │                             │                          │
   │                             │   ◄──── JSON response    │
   │                             │                          │
   │   ◄──── Promise resolves    │                          │
   │                             │                          │
```

## Security Considerations

1. **Context Isolation**: Enabled, renderer cannot access Node.js directly
2. **Node Integration**: Disabled in renderer
3. **Sandbox**: Disabled (required for Ollama IPC)
4. **No Remote Code**: All code is bundled locally
5. **No External Requests**: Only localhost Ollama communication

## Build System

Uses `electron-vite` for building:

```
electron-vite build
├── out/main/          # Compiled main process
├── out/preload/       # Compiled preload script
└── out/renderer/      # Compiled Vue app
```

### Build Targets

- **macOS**: DMG, ZIP
- **Windows**: NSIS installer, portable
- **Linux**: AppImage, DEB

## Performance Considerations

1. **Hardware Caching**: Hardware info cached for 60 seconds
2. **Lazy Model Loading**: Models loaded on-demand by Ollama
3. **Message Pagination**: Chat history limited (configurable)
4. **File Streaming**: Large files processed in chunks

## Future Architecture Plans

1. **Streaming Responses**: SSE or WebSocket for real-time generation
2. **Worker Threads**: Heavy processing off main thread
3. **Plugin System**: Dynamic pipeline/tool loading
4. **IndexedDB**: Browser-based storage for larger datasets
