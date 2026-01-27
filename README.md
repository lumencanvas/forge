# SILO

**Secure Inference, Local Operations**

A privacy-focused local AI workbench for activists, journalists, and creatives. SILO brings the power of modern AI to your desktop while keeping everything completely local. Your data never leaves your machine.

```
┌─────────────────────────────────────────────────────────────┐
│  SILO                                         [STEADY] [⚙️] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  💬     │  │  📄     │  │  🖼️     │  │  📝     │        │
│  │  Chat   │  │ Analyze │  │ Describe│  │ Write   │        │
│  │         │  │ Document│  │ Images  │  │ Content │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💬 Ask anything...                           [Send] │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **100% Local & Private** — All AI processing happens on your device. No cloud, no telemetry, no data collection
- **Hardware-Aware** — Automatically detects your system capabilities and recommends appropriate models
- **Pipeline System** — Build custom AI workflows with a visual builder or JSON schema
- **Multi-Model Support** — Language models, vision models, and audio transcription
- **Built-in Workflows** — Pre-configured pipelines for common tasks (chat, document analysis, image description, content writing, research, summarization)
- **Chat with History** — Persistent conversation history with model switching
- **File Processing** — Analyze documents, images, and audio files locally
- **Beautiful UI** — Brutalist industrial design with a print-first aesthetic

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Ollama** — Install from [ollama.com](https://ollama.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/silo.git
cd silo

# Install dependencies
npm install

# Start development server
npm run dev
```

### First Run

1. SILO will detect your hardware and assign a performance tier
2. Follow the setup wizard to install recommended AI models
3. Start chatting or select a pipeline from the home screen

## Hardware Tiers

SILO automatically categorizes your system into performance tiers:

| Tier | VRAM | RAM | Recommended Models |
|------|------|-----|-------------------|
| **LEAN** | < 6GB | < 16GB | Small models (3B params) |
| **STEADY** | 6-12GB | 16-32GB | Medium models (7B params) |
| **HEAVY** | 12-24GB | 32-64GB | Large models (14B params) |
| **SURPLUS** | 24GB+ | 64GB+ | Very large models (70B+ params) |

## Built-in Pipelines

| Pipeline | Description |
|----------|-------------|
| 💬 **Chat** | Free-form conversation with AI |
| 📄 **Analyze Document** | Extract info and summarize documents |
| 🖼️ **Describe Images** | Generate detailed image descriptions |
| 📝 **Write Content** | Create articles, emails, and more |
| 🔍 **Research** | Deep-dive Q&A on any topic |
| 📊 **Summarize Data** | Condense documents into key points |
| 🎨 **Creative Brief** | Generate creative concepts |
| 🎙️ **Transcribe** | Audio to text (coming soon) |

## Building Custom Pipelines

SILO includes three ways to create custom AI workflows:

### 1. Guided Builder
Step-by-step wizard for simple single-step pipelines.

### 2. Multi-Step Builder
Form-based builder for complex workflows with multiple AI steps and conditions.

### 3. AI-Assisted Builder
Describe what you need in plain language, and SILO generates the pipeline for you.

### 4. JSON Schema (Advanced)
Direct editing of pipeline JSON for power users.

See [docs/PIPELINES.md](docs/PIPELINES.md) for detailed pipeline documentation.

## Project Structure

```
silo/
├── electron/                 # Electron main process
│   ├── main/
│   │   ├── index.ts         # Main entry, IPC handlers
│   │   ├── hardware.ts      # Hardware detection
│   │   ├── ollama.ts        # Ollama service wrapper
│   │   └── settings.ts      # Persistent settings
│   └── preload/
│       ├── index.ts         # Preload script
│       └── index.d.ts       # TypeScript declarations
├── src/                      # Vue renderer process
│   ├── assets/
│   │   └── main.css         # Design system & styles
│   ├── components/
│   │   ├── chat/            # Chat interface components
│   │   ├── flows/           # Pipeline builder components
│   │   ├── home/            # Home screen components
│   │   └── settings/        # Settings panel components
│   ├── composables/         # Vue composables
│   ├── lib/
│   │   └── flows/           # Pipeline schema & execution
│   ├── stores/              # Pinia state stores
│   ├── App.vue              # Root component
│   └── main.ts              # Renderer entry
├── package.json
└── electron.vite.config.ts
```

## Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) + [Vue 3](https://vuejs.org/)
- **Build Tool**: [electron-vite](https://electron-vite.org/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **AI Backend**: [Ollama](https://ollama.com/)
- **Language**: TypeScript

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:mac    # Build macOS app
npm run build:win    # Build Windows app
npm run build:linux  # Build Linux app
npm run typecheck    # Run TypeScript checks
```

## Configuration

Settings are stored in `~/.silo/settings.json`:

```json
{
  "theme": "dark",
  "defaultLanguageModel": "llama3.2:3b",
  "defaultVisionModel": "llava:7b",
  "sendOnEnter": true,
  "showTimestamps": true,
  "maxChatHistory": 100
}
```

## Privacy & Security

SILO is designed with privacy as a core principle:

- **No Network Calls**: Except to your local Ollama instance
- **No Telemetry**: Usage data is never collected
- **No Cloud**: All processing happens on your machine
- **Local Storage**: Data stored in `~/.silo/`
- **Open Source**: Audit the code yourself

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Make your changes
5. Run type checks: `npm run typecheck`
6. Submit a pull request

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.

## Roadmap

- [ ] Streaming responses
- [ ] Audio transcription with Whisper
- [ ] Pipeline marketplace / sharing
- [ ] Plugin system
- [ ] Light theme
- [ ] Keyboard shortcuts
- [ ] Multi-language support

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Ollama](https://ollama.com/) for making local LLMs accessible
- [electron-ollama](https://github.com/nicepkg/electron-ollama) for Electron integration
- The open-source AI community

---

**SILO** — Your data stays with you.
