# TaxLogic.local

```
████████╗ █████╗ ██╗  ██╗██╗      ██████╗  ██████╗ ██╗ ██████╗    ██╗      ██████╗  ██████╗ █████╗ ██╗
╚══██╔══╝██╔══██╗╚██╗██╔╝██║     ██╔═══██╗██╔════╝ ██║██╔════╝    ██║     ██╔═══██╗██╔════╝██╔══██╗██║
   ██║   ███████║ ╚███╔╝ ██║     ██║   ██║██║  ███╗██║██║         ██║     ██║   ██║██║     ███████║██║
   ██║   ██╔══██║ ██╔██╗ ██║     ██║   ██║██║   ██║██║██║         ██║     ██║   ██║██║     ██╔══██║██║
   ██║   ██║  ██║██╔╝ ██╗███████╗╚██████╔╝╚██████╔╝██║╚██████╗██╗███████╗╚██████╔╝╚██████╗██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝ ╚═════╝╚═╝╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝

    🇦🇹 Your Personal AI Tax Advisor for Austria - 100% Local & Private 🔒
```

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28+-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-FF6B35)](https://langchain-ai.github.io/langgraph/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-000000)](https://ollama.ai/)

**AI-powered tax filing assistant for Austrian individuals**

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation)

</div>

---

## 🎯 Overview

**TaxLogic.local** is an enterprise-grade, privacy-first AI tax filing assistant designed specifically for Austrian individuals. It runs **100% locally** on your computer - no cloud, no tracking, no API costs (unless you choose BYOK).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   👤 User Interview    →    📄 Document OCR    →    📊 Tax Analysis          │
│                                                                              │
│   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│   │  Multi-Agent    │  →   │   Tesseract +   │  →   │   Austrian Tax  │     │
│   │  AI Interview   │      │   Vision LLM    │      │   Law Engine    │     │
│   └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                                                              │
│   📋 Form Generation   →    📖 Step-by-Step Guide   →    ✅ FinanzOnline    │
│                                                                              │
│   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│   │   L1 / L1ab /   │  →   │   Personalized  │  →   │   Ready for     │     │
│   │   L1k Forms     │      │   Filing Guide  │      │   Submission    │     │
│   └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🔒 Privacy-First Architecture
- **100% Local Execution** - All data stays on your computer
- **No Cloud Dependencies** - Works completely offline
- **No Tracking** - Zero telemetry, zero analytics
- **BYOK Optional** - Bring Your Own Key for Claude API if desired

### 🤖 Multi-Agent AI System
- **LangGraph Workflow** - Stateful, graph-based conversation flow
- **CrewAI Agents** - Specialized agents for different tasks:
  - 💬 **Interviewer Agent** - Intelligent tax questions
  - 📄 **Document Inspector** - OCR + classification
  - 📊 **Analyzer Agent** - Tax calculations & optimization
  - 📝 **Report Writer** - Guide generation

### 📄 Document Processing
- **Automatic OCR** - Tesseract + Vision LLM support
- **Smart Classification** - AI-powered expense categorization
- **Receipt Management** - Organized folder structure

### 🇦🇹 Austrian Tax Compliance
- **Tax Years 2024-2026** - Full support for current tax laws
- **Form Generation** - L1, L1ab, L1k official forms
- **Step-by-Step Guides** - Personalized filing instructions
- **Audit Preparation** - Documentation for Finanzamt requests

### 💻 Modern Tech Stack
- **Electron 28+** - Cross-platform desktop app
- **React 18** - Modern, reactive UI
- **TypeScript** - Full type safety
- **SQLite** - Local database (no external dependencies)
- **TailwindCSS** - Beautiful, responsive design

---

## 📦 Installation

### Prerequisites

```bash
# Required
Node.js >= 22.0.0
npm >= 10.0.0

# Recommended (for local LLM)
Ollama - https://ollama.ai
# or
LM Studio - https://lmstudio.ai
```

### Quick Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/taxlogic-local.git
cd taxlogic-local

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local

# Start the application
npm run dev
```

### Ollama Setup (Recommended)

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai/download

# Pull required models
ollama pull mistral:latest          # Main conversation model
ollama pull nomic-embed-text:latest # Embedding model (for RAG)

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

---

## 🚀 Quick Start

### 1. Start the Application

```bash
npm run dev
```

### 2. Complete Onboarding

The app will guide you through:
- LLM connection verification
- Basic profile setup
- First interview configuration

### 3. Conduct Tax Interview

Answer the AI-powered questions about:
- Your profession and income
- Commute distances (Pendlerkilometer)
- Home office usage
- Professional education expenses
- Medical expenses
- Charitable donations

### 4. Upload Documents

Drag & drop your receipts and invoices:
- Automatic OCR processing
- AI-powered categorization
- Organized file structure

### 5. Generate Forms

Export ready-to-submit tax forms:
- L1 (Main return)
- L1ab (Business income supplement)
- L1k (Special expenses)

### 6. Follow the Guide

Get a personalized step-by-step guide for:
- FinanzOnline submission
- Document preparation
- Audit readiness

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON APP (Desktop)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                      RENDERER PROCESS (React)                       │    │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ │    │
│   │   │  Interview   │ │  Documents   │ │   Review     │ │  Export   │ │    │
│   │   │    Page      │ │    Page      │ │    Page      │ │   Page    │ │    │
│   │   └──────────────┘ └──────────────┘ └──────────────┘ └───────────┘ │    │
│   │                              │                                      │    │
│   │                    ┌─────────┴─────────┐                           │    │
│   │                    │   Zustand Store   │                           │    │
│   │                    └─────────┬─────────┘                           │    │
│   └──────────────────────────────┼──────────────────────────────────────┘    │
│                                  │ IPC Bridge                                │
│   ┌──────────────────────────────┼──────────────────────────────────────┐    │
│   │                      MAIN PROCESS (Node.js)                         │    │
│   │                              │                                      │    │
│   │   ┌──────────────────────────┴──────────────────────────┐          │    │
│   │   │              LangGraph Workflow Engine               │          │    │
│   │   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │          │    │
│   │   │   │Interview│→│Document │→│Analysis │→│ Forms   │  │          │    │
│   │   │   │  Node   │ │  Node   │ │  Node   │ │  Node   │  │          │    │
│   │   │   └─────────┘ └─────────┘ └─────────┘ └─────────┘  │          │    │
│   │   └─────────────────────────────────────────────────────┘          │    │
│   │                              │                                      │    │
│   │   ┌──────────────────────────┴──────────────────────────┐          │    │
│   │   │                    Services Layer                    │          │    │
│   │   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │          │    │
│   │   │  │   LLM    │  │ Database │  │   OCR    │           │          │    │
│   │   │  │ Service  │  │ Service  │  │ Service  │           │          │    │
│   │   │  └──────────┘  └──────────┘  └──────────┘           │          │    │
│   │   └─────────────────────────────────────────────────────┘          │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
├──────────────────────────────────┼───────────────────────────────────────────┤
│                         EXTERNAL SERVICES                                    │
│                                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│   │   Ollama     │   │  LM Studio   │   │  Claude API  │                    │
│   │  (Primary)   │   │ (Secondary)  │   │   (BYOK)     │                    │
│   │ localhost:   │   │ localhost:   │   │   Cloud      │                    │
│   │   11434      │   │   1234       │   │  (Optional)  │                    │
│   └──────────────┘   └──────────────┘   └──────────────┘                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
taxlogic-local/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── preload.ts           # IPC bridge
│   │   ├── ipcHandlers.ts       # IPC channel handlers
│   │   ├── menu.ts              # Application menu
│   │   └── utils/
│   │       └── logger.ts        # Logging utility
│   │
│   ├── renderer/                # React UI
│   │   ├── App.tsx              # Root component
│   │   ├── index.tsx            # Entry point
│   │   ├── pages/               # Page components
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── InterviewPage.tsx
│   │   │   ├── DocumentUploadPage.tsx
│   │   │   ├── ReviewPage.tsx
│   │   │   ├── ExportPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/          # UI components
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── NotificationContainer.tsx
│   │   ├── stores/              # Zustand stores
│   │   │   └── appStore.ts
│   │   └── styles/
│   │       └── globals.css      # TailwindCSS
│   │
│   └── backend/                 # Backend services
│       ├── agents/              # CrewAI agents
│       │   ├── interviewerAgent.ts
│       │   ├── documentInspectorAgent.ts
│       │   ├── analyzerAgent.ts
│       │   └── reportWriterAgent.ts
│       ├── workflows/           # LangGraph workflows
│       │   └── taxWorkflow.ts
│       ├── services/            # Core services
│       │   ├── llmService.ts
│       │   ├── dbService.ts
│       │   ├── ocrService.ts
│       │   └── formGenerator.ts
│       └── rag/                 # RAG system
│           └── knowledgeBase.ts
│
├── data/                        # User data (gitignored)
│   ├── documents/               # Uploaded files
│   ├── output/                  # Generated forms
│   ├── models/                  # Cached LLM models
│   ├── cache/                   # Processing cache
│   └── knowledge/               # Tax law documents
│
├── db/                          # SQLite database
│   └── taxlogic.db
│
├── tests/                       # Test suites
│   ├── unit/
│   └── e2e/
│
├── config/                      # Configuration
├── docs/                        # Documentation
│
├── package.json
├── tsconfig.json
├── forge.config.ts              # Electron Forge config
├── tailwind.config.js
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

```bash
# .env.local

# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest
LM_STUDIO_URL=http://localhost:1234
ANTHROPIC_API_KEY=sk-ant-...  # Optional BYOK

# Database
DATABASE_PATH=./db/taxlogic.db

# RAG (Optional)
QDRANT_URL=http://localhost:6333

# Features
FEATURE_OCR_ENABLED=true
FEATURE_RAG_ENABLED=true
```

---

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Setup Guide](docs/SETUP.md)
- [User Manual](docs/USER_GUIDE.md)
- [API Reference](docs/API.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## 🛣️ Roadmap

### Phase 1 - MVP ✅
- [x] Electron + React foundation
- [x] Interview flow with LLM
- [x] Basic OCR
- [x] L1 form generation

### Phase 2 - In Progress 🚧
- [ ] Advanced RAG system
- [ ] Full form support (L1ab, L1k)
- [ ] Document auto-classification
- [ ] Step-by-step guide generation

### Phase 3 - Planned 📋
- [ ] FinanzOnline API integration
- [ ] Multi-language support
- [ ] Cloud backup (optional)
- [ ] Mobile companion app

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Fork the repository
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Electron](https://electronjs.org/) - Cross-platform desktop apps
- [LangChain](https://langchain.com/) - LLM orchestration
- [Ollama](https://ollama.ai/) - Local LLM runtime
- [Anthropic](https://anthropic.com/) - Claude API
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS

---

<div align="center">

**Made with ❤️ in Austria 🇦🇹**

[Website](https://taxlogic.local) • [GitHub](https://github.com/YOUR_USERNAME/taxlogic-local) • [Issues](https://github.com/YOUR_USERNAME/taxlogic-local/issues)

</div>
