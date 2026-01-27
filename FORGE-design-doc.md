# FORGE
## **F**ile **O**riented **R**easoning and **G**enerative **E**ngine

*A local-first AI workbench for people who give a shit about their data*

---

## The Pitch

FORGE is an Electron-based AI workbench that runs entirely on your machine. No cloud. No telemetry. No "we've updated our privacy policy" emails. Point it at your files, describe what you need, and it figures out which local models to spin up to get the job done.

Think of it as having a local AI crew on standby: a vision specialist, a writer, a pattern analyst, an archivist - and a coordinator who knows when to call in who.

---

## Core Philosophy

1. **Your machine, your data** - Everything runs locally. Period.
2. **Capability-aware** - Detects your hardware and adapts. Potato laptop? Still works. Beefy workstation with a 4090? Let's fucking go.
3. **Task-driven model loading** - Don't preload everything. Load what's needed when it's needed.
4. **Agentic but transparent** - Shows its reasoning. You see what models it's using and why.
5. **Batch-native** - Built for "analyze this whole folder" not just "look at this one thing"

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FORGE UI (Electron)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Workbench  │  │  Flow       │  │  Terminal   │              │
│  │  (Chat+Drop)│  │  Builder    │  │  (Power     │              │
│  │             │  │  (Visual)   │  │   Users)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATOR LAYER                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Task Parser → Capability Check → Model Router → Executor   ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                       MODEL RUNTIME LAYER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ llama.cpp│ │Transform-│ │  ONNX    │ │ Whisper  │           │
│  │ (LLMs)   │ │ ers.js   │ │ Runtime  │ │ .cpp     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                      HARDWARE ABSTRACTION                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  GPU Detection │ VRAM Check │ RAM Check │ CPU Profiling     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Hardware Detection & Capability Tiers

### Auto-Detection Module

```javascript
// Pseudocode for capability detection
const detectCapabilities = async () => {
  const gpu = await detectGPU(); // nvidia-smi, rocm-smi, Metal
  const ram = os.totalmem();
  const cpuCores = os.cpus().length;
  
  return {
    tier: calculateTier({ gpu, ram, cpuCores }),
    gpu: {
      vendor: gpu.vendor, // nvidia, amd, apple, intel, none
      vram: gpu.vram,
      compute: gpu.computeCapability
    },
    ram: ram,
    recommendedModels: getModelRecommendations(tier)
  };
};
```

### Capability Tiers

| Tier | Specs | What You Get |
|------|-------|--------------|
| **EMBER** | 8GB RAM, no GPU | Tiny models only - phi-2, moondream, small embeddings. Slower but functional. |
| **FLAME** | 16GB RAM, or 6GB+ VRAM | Mid-size models - Phi-3, LLaVA 7B, Whisper base. Good for most tasks. |
| **BLAZE** | 32GB+ RAM, or 12GB+ VRAM | Full power - Mistral/Llama 7-13B, LLaVA 13B, Whisper large. Fast batch processing. |
| **INFERNO** | 64GB+ RAM, or 24GB+ VRAM | Big models, parallel processing, multiple models loaded simultaneously. |

The UI shows your tier prominently. No mystery about what your machine can handle.

---

## Model Zoo (Local)

### Core Models (Downloaded on Demand)

**Vision**
- `moondream2` - Tiny but capable vision model (1.6B params, runs on anything)
- `llava-1.6-mistral-7b` - Solid multimodal for mid-tier+
- `llava-1.6-34b` - Heavy hitter for INFERNO tier
- `clip-vit` - Fast embeddings for image similarity/search

**Language**
- `phi-3-mini` - Small, fast, surprisingly capable
- `mistral-7b-instruct` - Workhorse for most text tasks
- `mixtral-8x7b` - When you need more reasoning power
- `codellama` - Code analysis and generation

**Specialized**
- `whisper.cpp` - Audio transcription (tiny/base/small/medium/large)
- `tesseract.js` - OCR fallback for documents
- `all-MiniLM-L6-v2` - Fast embeddings for semantic search

**Document Processing**
- `nougat` - Academic PDF to markdown
- `donut` - Document understanding
- `layoutlm` - Form/structured document parsing

---

## The Orchestrator: Task Understanding

When you type "analyze all the photos in this folder for patterns" or "summarize these PDFs and find contradictions", the orchestrator:

1. **Parses intent** - What are you actually trying to do?
2. **Inventories inputs** - What files/folders? What types?
3. **Plans execution** - Which models in what order?
4. **Checks resources** - Can we do this with available hardware?
5. **Proposes plan** - Shows you the plan before executing (optional auto-run for trusted flows)

### Example Task Decomposition

```
User: "Go through my research folder. OCR any scanned docs, summarize each paper, 
       find common themes, and create a synthesis document."

Orchestrator Plan:
┌────────────────────────────────────────────────────────────────┐
│ TASK: Research Synthesis                                        │
│ INPUT: /home/user/research/ (47 files detected)                │
├────────────────────────────────────────────────────────────────┤
│ PHASE 1: Document Processing                                    │
│   ├─ 12 scanned PDFs → OCR (tesseract) → text                  │
│   ├─ 23 digital PDFs → nougat → markdown                       │
│   └─ 12 images → moondream → descriptions                      │
│                                                                 │
│ PHASE 2: Individual Analysis                                    │
│   └─ Each document → phi-3 → structured summary                │
│                                                                 │
│ PHASE 3: Cross-Document Analysis                                │
│   ├─ All summaries → embeddings → cluster by theme             │
│   └─ Clusters → mistral-7b → theme extraction                  │
│                                                                 │
│ PHASE 4: Synthesis                                              │
│   └─ Themes + summaries → mistral-7b → synthesis document      │
├────────────────────────────────────────────────────────────────┤
│ ESTIMATED: ~15 min on your hardware (FLAME tier)               │
│ MODELS NEEDED: tesseract, nougat, moondream, phi-3, mistral-7b │
│ [RUN] [MODIFY] [CANCEL]                                         │
└────────────────────────────────────────────────────────────────┘
```

---

## UI Modes

### 1. Workbench Mode (Default)
The "just talk to it" interface. Drop files, type what you want, get results.

```
┌─────────────────────────────────────────────────────────────────┐
│ FORGE Workbench                              [FLAME] 🔥         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     Drop files here or point me at a folder            │   │
│  │                                                         │   │
│  │         📁 /Users/moheeb/project-assets               │   │
│  │            47 images, 3 videos, 12 docs                │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "find all images with people, extract faces, group by  │   │
│  │  similarity, flag any that might be duplicates"        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Analyze] [Watch Folder] [Save as Flow]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Flow Builder Mode
Visual node-based workflow creation. Build once, run many times.

```
┌─────────────────────────────────────────────────────────────────┐
│ Flow: "Asset Tagger"                          [Save] [Run]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │  Folder  │───▶│  Filter  │───▶│  Vision  │───▶│  Write   │ │
│  │  Watch   │    │  Images  │    │  Analyze │    │  Sidecar │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│       │                               │                         │
│       │                               ▼                         │
│       │                         ┌──────────┐    ┌──────────┐   │
│       │                         │ Embedding│───▶│  Vector  │   │
│       │                         │ Generate │    │  Store   │   │
│       └─────────────────────────└──────────┘    └──────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Terminal Mode
For power users. Direct model access, scripting, batch jobs.

```bash
forge run llava --input ./images/*.jpg --prompt "describe the mood" --output ./moods.json
forge watch ./inbox --on-new "ocr → summarize → tag" --output ./processed/
forge pipeline ./my-flow.forge --input ./data/
```

---

## Key Features

### 🔍 Semantic File Search
Build a local vector index of your files. Search by meaning, not just filename.

```
"find all my notes about hardware hacking from 2023"
"images that look similar to this one"
"documents that mention both 'ESP32' and 'MQTT'"
```

### 📁 Folder Watching
Point FORGE at a folder. Define rules. It processes new files automatically.

```yaml
# watch-config.yaml
watch: ~/Dropbox/scanner-inbox
rules:
  - match: "*.pdf"
    action: 
      - ocr_if_needed
      - summarize
      - extract_dates
      - move_to: ~/Documents/processed/
      
  - match: "*.jpg"
    action:
      - describe
      - auto_tag
      - write_sidecar_json
```

### 🎨 Creative Analysis Tools
Built for artists and creators:

- **Color palette extraction** from images
- **Style analysis** - "what makes these images feel similar?"
- **Composition breakdown** - rule of thirds, focal points, etc.
- **Reference organization** - cluster and tag inspiration folders

### 📊 Pattern Detection
Find patterns across large file sets:

- **Anomaly detection** - "which of these don't belong?"
- **Trend analysis** - "how has the style evolved across these dated files?"
- **Correlation finding** - "what do documents mentioning X have in common?"

### 🛡️ Activist Toolkit
- **Redaction assistance** - Identify and blur faces, license plates, identifiable info
- **Metadata stripping** - Clean EXIF and other embedded data
- **Document analysis** - Pattern matching across leaked/whistleblower docs
- **Source protection** - Never phones home, ever

### ✍️ Writer's Workshop
- **Research synthesis** - Consolidate multiple sources
- **Character/world bible generation** from scattered notes
- **Consistency checking** across large documents
- **Style analysis** - "how does this draft compare to my published voice?"

---

## Data Storage

### Local Vector Store
FORGE maintains a local SQLite + vector store for semantic search:

```
~/.forge/
├── config.yaml           # User settings
├── models/               # Downloaded model files
│   ├── phi-3-mini/
│   ├── moondream/
│   └── ...
├── vectors/              # Embeddings database
│   └── forge.db          # SQLite with vector extension
├── flows/                # Saved workflows
│   ├── asset-tagger.forge
│   └── research-synth.forge
└── cache/                # Temporary processing files
```

### Privacy Guarantees
- No network calls except model downloads (user-initiated)
- No telemetry, analytics, or crash reporting
- All processing happens in-process
- Vector store is local SQLite, not cloud
- Optional: encrypted storage for sensitive workspaces

---

## Technical Stack

### Core
- **Electron** - Cross-platform shell
- **Node.js 20+** - Runtime
- **better-sqlite3** - Local database
- **sqlite-vec** - Vector similarity search

### Model Runtimes
- **node-llama-cpp** - LLaMA/Mistral/Phi inference
- **transformers.js** - Vision models, embeddings
- **onnxruntime-node** - ONNX model execution
- **whisper.cpp bindings** - Audio transcription

### File Processing
- **sharp** - Image manipulation
- **pdf-parse** + **pdfjs** - PDF text extraction
- **mammoth** - Word doc processing
- **chokidar** - File system watching

### UI
- **React** - UI framework
- **Zustand** - State management
- **reactflow** - Visual flow builder
- **xterm.js** - Embedded terminal

---

## Example Workflows

### 1. "Organize My Shit"
```
Input: Messy folder of 500+ images
Task: "organize these by content type, suggest folder structure, rename with descriptive names"

Output:
├── people/
│   ├── portraits/
│   └── groups/
├── places/
│   ├── urban/
│   └── nature/
├── objects/
│   ├── electronics/
│   └── art-supplies/
└── screenshots/
    ├── code/
    └── ui-reference/
```

### 2. "Research Deep Dive"
```
Input: 50 academic PDFs
Task: "read all of these, identify the key arguments, find contradictions between papers, 
       generate a literature review outline with citations"

Output: literature-review.md with structured analysis and embedded citations
```

### 3. "Content Audit"
```
Input: Website export folder (HTML, images, docs)
Task: "audit for accessibility issues, find images missing alt text, 
       suggest improvements, generate report"

Output: accessibility-audit.html with findings and recommendations
```

### 4. "Zine Asset Prep"
```
Input: Folder of photos from an event
Task: "process for black and white zine printing - high contrast, 
       identify best compositions, create contact sheet, 
       flag any with recognizable faces for review"

Output: 
├── processed/           # Print-ready images
├── contact-sheet.pdf    # Overview
└── face-review/         # Images needing manual check
```

---

## Extensibility

### Plugin System
FORGE supports plugins for:
- **Custom models** - Bring your own GGUF/ONNX
- **New file types** - Custom parsers
- **Workflow nodes** - Add capabilities to flow builder
- **Export formats** - Custom output generators

```javascript
// Example plugin: Bluesky post formatter
module.exports = {
  name: 'bluesky-formatter',
  type: 'export',
  
  async format(content, options) {
    // Split into thread-appropriate chunks
    // Add alt text for images
    // Return formatted posts
  }
};
```

### CLASP Integration
*For the hack.build ecosystem:*

FORGE can expose its capabilities via CLASP protocol, allowing other tools in your stack to request AI processing:

```javascript
// LATCH node requesting FORGE analysis
claspClient.send('forge.analyze', {
  type: 'image',
  data: imageBuffer,
  prompt: 'extract dominant colors'
});
```

---

## Development Roadmap

### Phase 1: Foundation
- [ ] Electron shell with React UI
- [ ] Hardware detection module
- [ ] Basic model loading (phi-3, moondream)
- [ ] Simple chat interface with file drops
- [ ] Local vector store setup

### Phase 2: Core Features
- [ ] Orchestrator with task decomposition
- [ ] Batch processing pipeline
- [ ] Folder watching
- [ ] Basic flow builder

### Phase 3: Power Features
- [ ] Full model zoo support
- [ ] Plugin system
- [ ] Terminal mode
- [ ] CLASP integration

### Phase 4: Polish
- [ ] Model fine-tuning support (LoRA)
- [ ] Collaborative flows (share .forge files)
- [ ] Mobile companion app (view results, queue tasks)

---

## Why "FORGE"?

Because you're not just using AI - you're *forging* something with it. Shaping raw data into useful artifacts. And like a real forge, the heat levels matter (your hardware tiers). Plus it sounds appropriately industrial/maker for the aesthetic.

---

## The Vibe

This isn't a polished corporate product. It's a workshop tool. The UI should feel like a well-organized workbench - functional, maybe a little rough around the edges, but everything has a purpose and nothing's hidden behind three menus.

Think: exposed brick, visible screws, honest materials. The digital equivalent of a CNC machine or a good oscilloscope. A tool that respects that you know what you're doing.

---

*"Your data. Your machine. Your rules."*
