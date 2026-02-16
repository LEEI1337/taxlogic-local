# TaxLogic.local

```
████████╗ █████╗ ██╗  ██╗██╗      ██████╗  ██████╗ ██╗ ██████╗    ██╗      ██████╗  ██████╗ █████╗ ██╗
╚══██╔══╝██╔══██╗╚██╗██╔╝██║     ██╔═══██╗██╔════╝ ██║██╔════╝    ██║     ██╔═══██╗██╔════╝██╔══██╗██║
   ██║   ███████║ ╚███╔╝ ██║     ██║   ██║██║  ███╗██║██║         ██║     ██║   ██║██║     ███████║██║
   ██║   ██╔══██║ ██╔██╗ ██║     ██║   ██║██║   ██║██║██║         ██║     ██║   ██║██║     ██╔══██║██║
   ██║   ██║  ██║██╔╝ ██╗███████╗╚██████╔╝╚██████╔╝██║╚██████╗██╗███████╗╚██████╔╝╚██████╗██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝ ╚═════╝╚═╝╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝
```

> **AI-powered tax filing assistant for Austrian individuals - 100% Local & Private**

---

## Overview

**TaxLogic.local** is a privacy-first desktop application that helps Austrian taxpayers prepare their Arbeitnehmerveranlagung (employee tax return). It runs entirely on your local machine using local LLMs via Ollama - no cloud, no tracking, no API costs.

The app guides you through an AI-powered interview, processes your documents via OCR, calculates deductions, and generates ready-to-submit L1/L1ab/L1k tax forms with a step-by-step FinanzOnline filing guide.

### Current Status (2026-02-16)

- Year-based tax rules implemented for 2024-2026 with runtime stale/missing blocking.
- Tax year is now propagated end-to-end (UI -> main -> backend).
- RAG content is versioned by year with source-year mismatch warnings.
- New tax-rules maintenance CLI and CI gates are active.

Key docs:

- `docs/PROJECT_STATUS.md`
- `docs/AUDIT_REPORT_2026-02-16.md`
- `docs/IMPLEMENTATION_LOG_2026-02-16.md`
- `docs/TAX_RULES_RUNBOOK.md`
- `docs/TOOLCHAIN_SECURITY_UPGRADE_PLAN.md`

---

## Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | >= 22.0.0 | Runtime |
| **npm** | >= 10.0.0 | Package manager |
| **Ollama** | latest | Local LLM inference |
| **Docker** (optional) | latest | Run Ollama in container |

### Required Ollama Models

| Model | Size | Purpose |
|-------|------|---------|
| `llama3.1:8b` | ~4.9 GB | Main conversation & tax analysis |
| `nomic-embed-text` | ~274 MB | RAG embeddings for knowledge base |

> **Important:** The embedding model (`nomic-embed-text`) is **required** for the knowledge base (RAG) to work. Without it, the app will still function but RAG-powered tax law references will be unavailable.

---

## Installation

### 1. Clone & Install

```bash
git clone https://github.com/LEEI1337/taxlogic-local.git
cd taxlogic-local
npm install
```

### 2. Set Up Ollama

#### Option A: Ollama via Docker (Recommended)

```bash
# Start Ollama container
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

# Pull required models
docker exec ollama ollama pull llama3.1:8b
docker exec ollama ollama pull nomic-embed-text

# Verify
docker exec ollama ollama list
```

#### Option B: Ollama Native

```bash
# Download from https://ollama.com/download
# Then pull models:
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# Verify
ollama list
```

### 3. Configure Environment (Optional)

```bash
cp .env.example .env.local
```

Default configuration works out of the box with local Ollama on `localhost:11434`.

### 4. Run

```bash
# Development mode
npm run dev

# Or production build
npm run make
```

The installer will be created at: `out/make/squirrel.windows/x64/TaxLogic-1.0.0-alpha Setup.exe`

---

## Usage

### Onboarding Wizard

On first launch, the onboarding wizard guides you through:

1. **LLM Setup** - Configure Ollama URL, select model, test connection
2. **Profile** - Set your profession and employment status (Angestellt/Selbststaendig)
3. **Privacy Warning** - If using Claude API (BYOK), you'll see a data privacy notice

### Tax Interview

The AI interviewer asks about:
- Personal information (name, tax ID)
- Income sources and amounts
- Commute distance (Pendlerpauschale)
- Home office days
- Professional education expenses (Fortbildung)
- Work equipment (Arbeitsmittel)
- Medical and extraordinary expenses
- Charitable donations (Spenden)
- Childcare (Kinderbetreuung)
- Church tax (Kirchenbeitrag)

### Document Upload

Drag & drop receipts and invoices:
- Automatic OCR via Tesseract.js
- AI-powered expense categorization
- Organized folder structure

### Analysis & Review

- Automatic tax calculation based on Austrian tax law
- Deduction optimization suggestions
- Estimated refund calculation

### Form Generation & Export

- **L1** - Main Arbeitnehmerveranlagung
- **L1ab** - Business income supplement
- **L1k** - Child-related deductions
- **Filing Guide** - Step-by-step FinanzOnline instructions

---

## Architecture

```
TaxLogic.local
├── Renderer (React 18 + TypeScript)
│   ├── Pages: Onboarding, Interview, Documents, Review, Export, Settings
│   ├── State: Zustand with localStorage persistence
│   └── IPC Bridge: Typed preload API
│
├── Main Process (Electron + Node.js)
│   ├── IPC Handlers: 30+ channels for all operations
│   ├── Services:
│   │   ├── llmService     - Unified LLM interface (Ollama/LM Studio/Claude/OpenAI/Gemini)
│   │   ├── dbService      - SQLite via sql.js (pure JS, no native deps)
│   │   ├── ocrService     - Tesseract.js OCR
│   │   ├── formGenerator  - PDFKit L1/L1ab/L1k generation
│   │   └── guideGenerator - Markdown/PDF filing guides
│   ├── Agents:
│   │   ├── interviewerAgent       - 25-question tax interview conductor
│   │   ├── documentInspectorAgent - OCR + classification + analysis
│   │   └── analyzerAgent          - Tax calculations & optimization
│   └── RAG:
│       ├── embeddings    - Ollama nomic-embed-text (768-dim vectors)
│       ├── knowledgeBase - In-memory vector store with Austrian tax law
│       └── retriever     - Semantic search with source citations
│
└── External:
    ├── Ollama (localhost:11434) - Primary LLM + Embeddings
    ├── LM Studio (localhost:1234) - Alternative local LLM
    └── Cloud APIs (optional BYOK) - Claude, OpenAI, Gemini
```

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `sql.js` instead of `better-sqlite3` | Pure JS, no native compilation needed |
| `sql.js` as webpack external | CommonJS `module.exports` breaks in webpack bundle |
| Lazy `getDefaultConfig()` | dotenv loads after webpack hoists ES imports |
| Non-blocking KnowledgeBase init | App works even if embedding model is unavailable |
| EPIPE error handling | Prevents crash loops when Squirrel closes parent process |
| Renderer webpack rule filtering | `@vercel/webpack-asset-relocator-loader` injects `__dirname` into renderer |

---

## LLM Providers

### Local (Free, Private)

| Provider | URL | Models |
|----------|-----|--------|
| **Ollama** | `http://localhost:11434` | llama3.1:8b, mistral, qwen2.5, gemma2 |
| **LM Studio** | `http://localhost:1234` | Any GGUF model |

### Cloud (BYOK - Bring Your Own Key)

| Provider | Privacy Warning |
|----------|----------------|
| **Claude** (Anthropic) | Data sent to Anthropic servers |
| **OpenAI/ChatGPT** | Data sent to OpenAI servers |
| **Google Gemini** | Data sent to Google servers |
| **OpenAI-Compatible** | Depends on endpoint |

> **Privacy Note:** When using cloud providers, your tax data is sent to external servers. Use local providers (Ollama/LM Studio) for maximum privacy.

---

## Development

```bash
# Start dev server (hot reload)
npm run dev

# Run tests (172 tests)
npm test

# Type checking
npm run type-check

# Lint
npm run lint
npm run lint:fix

# Tax rule maintenance
npm run tax-rules:check
npm run tax-rules:verify
npm run tax-rules:doctor

# Build installer
npm run make
```

### Ports

| Port | Service | Configurable in |
|------|---------|-----------------|
| 3456 | Webpack Dev Server | `forge.config.ts` → `port` |
| 9876 | Webpack Logger | `forge.config.ts` → `loggerPort` |
| 11434 | Ollama API | `.env.local` → `OLLAMA_BASE_URL` |

### Environment Variables

```bash
# .env.local

# Ollama (default: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# LM Studio (default: http://localhost:1234)
LM_STUDIO_URL=http://localhost:1234

# Cloud Providers (optional BYOK)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Database (default: ./db/taxlogic.db)
DATABASE_PATH=./db/taxlogic.db
```

### Tax Rule Files

- `config/tax-rules/` - year-based rule packs (2024-2026)
- `config/tax-sources/` - source snapshots and verification assertions
- `config/tax-knowledge/` - year-versioned RAG knowledge files
- `scripts/tax-rules/` - CLI tools (`check`, `verify`, `init-year`, `report`, `sync-rag`, `doctor`)

---

## Project Structure

```
taxlogic-local/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry, EPIPE handling, dotenv
│   │   ├── preload.ts              # Typed IPC bridge (30+ channels)
│   │   ├── ipcHandlers.ts          # All IPC handler implementations
│   │   ├── menu.ts                 # Native application menu
│   │   └── utils/logger.ts         # EPIPE-safe logger
│   │
│   ├── renderer/                   # React UI
│   │   ├── App.tsx                 # Router + onboarding redirect
│   │   ├── pages/
│   │   │   ├── OnboardingPage.tsx  # 4-step setup wizard
│   │   │   ├── InterviewPage.tsx   # AI chat interview
│   │   │   ├── DocumentUploadPage.tsx
│   │   │   ├── ReviewPage.tsx      # Tax analysis display
│   │   │   ├── ExportPage.tsx      # Form generation & download
│   │   │   └── SettingsPage.tsx    # LLM config, profile, theme
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Shell + menu event handlers
│   │   │   ├── Sidebar.tsx         # Navigation
│   │   │   ├── StatusBar.tsx       # LLM status + model display
│   │   │   └── NotificationContainer.tsx
│   │   └── stores/appStore.ts      # Zustand + persist
│   │
│   └── backend/
│       ├── agents/
│       │   ├── interviewerAgent.ts       # 25 tax questions with validation
│       │   ├── documentInspectorAgent.ts # OCR + AI classification
│       │   └── analyzerAgent.ts          # Tax calculation engine
│       ├── services/
│       │   ├── llmService.ts       # 6 provider adapters
│       │   ├── dbService.ts        # sql.js SQLite
│       │   ├── ocrService.ts       # Tesseract.js
│       │   ├── formGenerator.ts    # PDFKit L1/L1ab/L1k
│       │   ├── documentOrganizer.ts
│       │   └── guideGenerator.ts   # Markdown + PDF guides
│       ├── rag/
│       │   ├── embeddings.ts       # nomic-embed-text via Ollama
│       │   ├── knowledgeBase.ts    # 8 Austrian tax law documents
│       │   └── retriever.ts        # Semantic search
│       └── workflows/
│           └── taxWorkflow.ts      # LangGraph state machine
│
├── tests/                          # 172 tests (vitest)
├── forge.config.ts                 # Electron Forge + Squirrel
├── webpack.main.config.ts          # Main process webpack (externals: sql.js)
├── webpack.renderer.config.ts      # Renderer webpack (filtered rules)
├── webpack.rules.ts                # Shared webpack rules
└── package.json
```

---

## Troubleshooting

### Blank page after install
The `@vercel/webpack-asset-relocator-loader` injects `__dirname` into the renderer bundle. Fixed by filtering `node-loader` and `asset-relocator-loader` from `webpack.renderer.config.ts`.

### EPIPE broken pipe crash loop
Happens when Squirrel updater closes the parent process while the app is writing to stdout. Fixed with:
- `doc.on('error', reject)` on all PDFKit streams
- try/catch in logger around console calls
- EPIPE ignored in `uncaughtException` handler

### Port conflicts (EADDRINUSE)
Default ports 3000/9000 may be occupied. Configured in `forge.config.ts`:
- `port: 3456` (dev server)
- `loggerPort: 9876` (webpack logger)

### Knowledge base fails to initialize
The RAG system requires the `nomic-embed-text` model in Ollama. Install it:
```bash
# Docker
docker exec ollama ollama pull nomic-embed-text

# Native
ollama pull nomic-embed-text
```
The app still works without it - RAG features will be unavailable but interviews and form generation work normally.

### Environment variables not loaded
Webpack hoists ES imports before `dotenv.config()` runs. Service configs use lazy `getDefaultConfig()` functions to read env vars at call time, not module init time.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with care in Austria**

[GitHub](https://github.com/LEEI1337/taxlogic-local) | [Issues](https://github.com/LEEI1337/taxlogic-local/issues)

</div>
