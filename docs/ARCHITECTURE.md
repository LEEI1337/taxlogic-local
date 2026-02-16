# TaxLogic.local - Architektur

## Update Addendum (2026-02-16)

This document contains baseline architecture plus the following implemented updates:

1. New tax-rules module in backend:
   - `src/backend/taxRules/types.ts`
   - `src/backend/taxRules/schema.ts`
   - `src/backend/taxRules/loader.ts`
   - `src/backend/taxRules/status.ts`
2. Rule packs and source snapshots moved to configuration:
   - `config/tax-rules/<year>.json`
   - `config/tax-sources/<year>/summary.json`
3. RAG knowledge is now year-versioned:
   - `config/tax-knowledge/<year>/*.md`
4. Main process now enforces rule status gates for tax-critical operations.
5. Preload API now exposes dedicated tax-rules endpoints.

Use this document together with:

- `docs/API.md`
- `docs/PROJECT_STATUS.md`
- `docs/TAX_RULES_RUNBOOK.md`

---

## Uebersicht

TaxLogic.local ist eine Electron-basierte Desktop-Anwendung fuer die KI-gestuetzte Steuererklaerung in Oesterreich. Die Architektur folgt dem Prinzip "Privacy First" - alle Daten bleiben lokal.

```
TaxLogic.local
├── Renderer (React 18 + TypeScript + TailwindCSS)
│   ├── Pages: Onboarding, Interview, Documents, Review, Export, Settings
│   ├── State: Zustand mit localStorage-Persistenz
│   └── IPC Bridge: Typisierte Preload-API (30+ Kanaele)
│
├── Main Process (Electron + Node.js)
│   ├── IPC Handlers: Alle Backend-Operationen
│   ├── Services:
│   │   ├── llmService     - 6 Provider-Adapter (Ollama/LM Studio/Claude/OpenAI/Gemini/OpenAI-Compatible)
│   │   ├── dbService      - SQLite via sql.js (reines JS, keine nativen Abhaengigkeiten)
│   │   ├── ocrService     - Tesseract.js OCR
│   │   ├── formGenerator  - PDFKit L1/L1ab/L1k Generierung
│   │   └── guideGenerator - Markdown/PDF Filing-Guides
│   ├── Agents:
│   │   ├── interviewerAgent       - 25-Fragen Steuer-Interview
│   │   ├── documentInspectorAgent - OCR + Klassifizierung + Analyse
│   │   └── analyzerAgent          - Steuerberechnungen & Optimierung
│   └── RAG:
│       ├── embeddings    - Ollama nomic-embed-text (768-dim Vektoren)
│       ├── knowledgeBase - In-Memory Vektorspeicher mit oesterreichischem Steuerrecht
│       └── retriever     - Semantische Suche mit Quellenangaben
│
└── Extern:
    ├── Ollama (localhost:11434) - Primaeres LLM + Embeddings
    ├── LM Studio (localhost:1234) - Alternatives lokales LLM
    └── Cloud APIs (optionales BYOK) - Claude, OpenAI, Gemini
```

---

## Schichten

### 1. Renderer Process (Frontend)

**Technologie:** React 18 + TypeScript + TailwindCSS

| Komponente | Beschreibung |
|------------|--------------|
| **Pages** | 6 Hauptseiten (Onboarding, Interview, Documents, Review, Export, Settings) |
| **Components** | Layout, Sidebar, StatusBar, NotificationContainer |
| **Stores** | Zustand mit `persist` Middleware (localStorage) |
| **Router** | React Router mit Onboarding-Redirect |

#### State Management (Zustand)

- `isOnboarded` - Onboarding abgeschlossen?
- `userProfile` - Beruf, Beschaeftigungsstatus
- `llmStatus` - Verbindungsstatus aller Provider
- `settings` - LLM-URL, Modell, Theme, Sprache
- `currentStep` - Aktueller Workflow-Schritt

---

### 2. IPC Bridge

**Technologie:** Electron IPC mit typisiertem Preload-Script

30+ IPC-Kanaele fuer:
- Window Management (minimize, maximize, close)
- LLM Operations (checkStatus, getModels, query)
- Interview (start, continue, getProfile, save, load)
- Documents (upload, process, organize, getManifest)
- Analysis (calculate, getResults, optimize)
- Forms (generate, preview, export)
- Guide (generate, export)
- File System (selectDirectory, selectFiles, openPath)

#### Wichtige technische Entscheidungen

| Entscheidung | Grund |
|--------------|-------|
| `sql.js` als webpack external | CommonJS `module.exports` bricht im Webpack-Bundle |
| Lazy `getDefaultConfig()` | dotenv laedt nach Webpack-Import-Hoisting |
| Non-blocking KnowledgeBase Init | App funktioniert auch ohne Embedding-Modell |
| EPIPE Error Handling | Verhindert Crash-Loops bei Squirrel-Update |
| Renderer Webpack-Rule-Filterung | `@vercel/webpack-asset-relocator-loader` injiziert `__dirname` in Renderer |
| Interview Response als Objekt | IPC gibt `{message, question, isComplete}` zurueck, Renderer extrahiert String |

---

### 3. Services Layer

| Service | Datei | Beschreibung |
|---------|-------|--------------|
| **LLM Service** | `llmService.ts` | 6 Provider: Ollama, LM Studio, Claude, OpenAI, Gemini, OpenAI-Compatible |
| **Database Service** | `dbService.ts` | SQLite mit sql.js (WASM, keine nativen Deps) |
| **OCR Service** | `ocrService.ts` | Tesseract.js fuer Texterkennung aus Bildern |
| **Document Organizer** | `documentOrganizer.ts` | KI-gestuetzte Ausgaben-Kategorisierung |
| **Form Generator** | `formGenerator.ts` | PDF-Generierung fuer L1, L1ab, L1k mit PDFKit |
| **Guide Generator** | `guideGenerator.ts` | Markdown + PDF Schritt-fuer-Schritt Anleitungen |

---

### 4. Multi-Agent System

| Agent | Datei | Aufgabe |
|-------|-------|---------|
| **Interviewer** | `interviewerAgent.ts` | 25 Fragen mit Validierung, Uebergangsnachrichten |
| **Document Inspector** | `documentInspectorAgent.ts` | OCR + Klassifizierung + Betragserkennung |
| **Analyzer** | `analyzerAgent.ts` | Oesterreichische Steuerberechnung, progressive Steuersaetze |

---

### 5. RAG System

```
Dokument-Einspeisung:
  8 Steuerrecht-Dokumente → Chunking → nomic-embed-text → 768-dim Vektoren → In-Memory Store

Abfrage:
  User-Frage → Embedding → Cosine Similarity → Top-K Chunks → LLM mit Kontext
```

**Wissensbasis-Dokumente:**
- Werbungskosten - Grundlagen
- Pendlerpauschale - Berechnung
- Home Office Pauschale
- Sonderausgaben
- Familienbonus Plus
- Aussergewoehnliche Belastungen - Krankheitskosten
- FinanzOnline - Arbeitnehmerveranlagung
- Formulare L1, L1ab, L1k

---

### 6. LangGraph Workflow

6-Node Graph fuer den Steuererklaerungsprozess:

```
[START] → Interview → Documents → Review → Analysis → Forms → Guide → [END]
```

---

## Datenbank Schema

**Technologie:** SQLite (sql.js WASM)

Tabellen: `users`, `interviews`, `documents`, `forms`, `calculations`

---

## Build-System

| Konfiguration | Datei | Besonderheiten |
|---------------|-------|----------------|
| Main Webpack | `webpack.main.config.ts` | Externals: sql.js, better-sqlite3, sharp |
| Renderer Webpack | `webpack.renderer.config.ts` | Filtert node-loader und asset-relocator-loader |
| Shared Rules | `webpack.rules.ts` | TypeScript, node-loader, asset-relocator |
| Forge Config | `forge.config.ts` | Squirrel mit Shortcuts, Ports 3456/9876 |

### Installer (Squirrel Windows)

- Automatische Desktop- und Startmenue-Verknuepfungen
- Erfolgsmeldung nach Installation
- Automatische Shortcut-Entfernung bei Deinstallation
- Installationsort: `%LOCALAPPDATA%\TaxLogic`

---

## Sicherheit

- **Context Isolation:** Aktiviert
- **Node Integration:** Deaktiviert im Renderer
- **Preload Script:** Sichere API-Exposition ueber contextBridge
- **CSP:** Content Security Policy konfiguriert
- **Keine Telemetrie:** Kein Tracking, keine Analytics

---

## Deployment

### Ports

| Port | Service |
|------|---------|
| 3456 | Webpack Dev Server |
| 9876 | Webpack Logger |
| 11434 | Ollama API |

### Unterstuetzte Plattformen

- **Windows:** Squirrel Installer (.exe) mit Desktop-Shortcuts
- **macOS:** DMG Image (.dmg)
- **Linux:** DEB, RPM

---

*Letzte Aktualisierung: 2026-02-11*
