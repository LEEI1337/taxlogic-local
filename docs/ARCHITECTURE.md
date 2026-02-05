# TaxLogic.local - Architektur

## Übersicht

TaxLogic.local ist eine Electron-basierte Desktop-Anwendung für die KI-gestützte Steuererklärung in Österreich. Die Architektur folgt dem Prinzip "Privacy First" - alle Daten bleiben lokal.

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

## Schichten

### 1. Renderer Process (Frontend)

**Technologie:** React 18 + TypeScript + TailwindCSS

| Komponente | Beschreibung |
|------------|--------------|
| **Pages** | 6 Hauptseiten (Onboarding, Interview, Documents, Review, Export, Settings) |
| **Components** | Wiederverwendbare UI-Komponenten (Layout, Sidebar, StatusBar) |
| **Stores** | Zustand für globales State Management |
| **Styles** | TailwindCSS für Styling |

#### State Management (Zustand)

```typescript
interface AppStore {
  // Navigation
  currentPage: string;
  setCurrentPage: (page: string) => void;
  
  // LLM Status
  llmStatus: 'connected' | 'disconnected' | 'checking';
  setLlmStatus: (status: 'connected' | 'disconnected' | 'checking') => void;
  
  // User
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  
  // Interview
  interviewState: InterviewState;
  setInterviewState: (state: InterviewState) => void;
  
  // Documents
  documents: Document[];
  addDocument: (doc: Document) => void;
}
```

---

### 2. IPC Bridge

**Technologie:** Electron IPC (Inter-Process Communication)

Der IPC Bridge ermöglicht sichere Kommunikation zwischen Renderer und Main Process.

#### Preload Script (`src/main/preload.ts`)

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // LLM
  llm: {
    checkConnection: () => ipcRenderer.invoke('llm:check-connection'),
    chat: (messages: Message[]) => ipcRenderer.invoke('llm:chat', messages),
    setProvider: (provider: LLMProvider) => ipcRenderer.invoke('llm:set-provider', provider)
  },
  
  // Database
  db: {
    saveProfile: (profile: UserProfile) => ipcRenderer.invoke('db:save-profile', profile),
    getProfile: () => ipcRenderer.invoke('db:get-profile')
  },
  
  // OCR
  ocr: {
    processImage: (imagePath: string) => ipcRenderer.invoke('ocr:process-image', imagePath)
  },
  
  // ... weitere APIs
});
```

---

### 3. Main Process (Backend)

**Technologie:** Node.js + TypeScript

#### Services Layer

| Service | Datei | Beschreibung |
|---------|-------|--------------|
| **LLM Service** | `llmService.ts` | Unified Interface für Ollama, LM Studio, Claude |
| **Database Service** | `dbService.ts` | SQLite Datenbank mit sql.js |
| **OCR Service** | `ocrService.ts` | Tesseract.js für Texterkennung |
| **Document Organizer** | `documentOrganizer.ts` | KI-gestützte Kategorisierung |
| **Form Generator** | `formGenerator.ts` | PDF-Generierung für L1, L1ab, L1k |
| **Guide Generator** | `guideGenerator.ts` | Personalisierte Anleitungen |

#### Multi-Agent System

| Agent | Datei | Aufgabe |
|-------|-------|---------|
| **Interviewer** | `interviewerAgent.ts` | Führt das Steuer-Interview |
| **Document Inspector** | `documentInspectorAgent.ts` | Analysiert hochgeladene Belege |
| **Analyzer** | `analyzerAgent.ts` | Berechnet Steuern und Optimierungen |
| **Report Writer** | `reportWriterAgent.ts` | Erstellt finale Berichte |

#### RAG System (Retrieval Augmented Generation)

```
┌─────────────────────────────────────────────────────────────┐
│                      RAG System                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  Embeddings │ →  │ Knowledge   │ →  │  Retriever  │    │
│   │   Service   │    │    Base     │    │             │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                              │
│   Ollama              In-Memory          Semantic Search    │
│   nomic-embed-text    Vector Store       + Citations        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. LangGraph Workflow

**Technologie:** LangGraph (LangChain)

Der Steuererklärungs-Workflow ist als 6-Node Graph implementiert:

```
┌─────────────────────────────────────────────────────────────┐
│                    Tax Filing Workflow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [START]                                                    │
│      │                                                       │
│      ▼                                                       │
│   ┌──────────────┐                                          │
│   │  Interview   │ ─── Fragen zu Einkommen, Pendeln, etc.   │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │  Documents   │ ─── OCR + Kategorisierung               │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │   Review     │ ─── Datenüberprüfung                    │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │  Analysis    │ ─── Steuerberechnung                    │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │    Forms     │ ─── L1, L1ab, L1k Generierung           │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │    Guide     │ ─── FinanzOnline Anleitung              │
│   └──────┬───────┘                                          │
│          │                                                   │
│          ▼                                                   │
│      [END]                                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Datenfluss

### 1. Interview Flow

```
User Input → React Form → IPC → Interviewer Agent → LLM → Response → IPC → React State
```

### 2. Document Processing Flow

```
File Drop → React → IPC → OCR Service → Document Inspector → Document Organizer → Database
```

### 3. Export Flow

```
Review → IPC → Analyzer Agent → Form Generator → PDF → File System → IPC → Download Dialog
```

---

## Datenbank Schema

**Technologie:** SQLite (sql.js - WASM)

### Tabellen

```sql
-- Benutzer
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  tax_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Interviews
CREATE TABLE interviews (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  tax_year INTEGER,
  status TEXT,
  data TEXT, -- JSON
  created_at TEXT,
  updated_at TEXT
);

-- Dokumente
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  interview_id TEXT REFERENCES interviews(id),
  file_name TEXT,
  file_path TEXT,
  category TEXT,
  ocr_text TEXT,
  extracted_data TEXT, -- JSON
  confidence REAL,
  created_at TEXT
);

-- Generierte Formulare
CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  interview_id TEXT REFERENCES interviews(id),
  form_type TEXT, -- L1, L1ab, L1k
  file_path TEXT,
  data TEXT, -- JSON
  created_at TEXT
);
```

---

## Sicherheit

### Lokale Verarbeitung

- **Kein Cloud-Zwang:** Alle Daten bleiben auf dem Gerät
- **Optionales BYOK:** Bring Your Own Key für Claude API
- **Keine Telemetrie:** Kein Tracking, keine Analytics

### Electron Security

- **Context Isolation:** Aktiviert
- **Node Integration:** Deaktiviert im Renderer
- **Preload Script:** Sichere API-Exposition über contextBridge
- **CSP:** Content Security Policy konfiguriert

---

## Erweiterbarkeit

### Neue LLM Provider

1. Interface in `llmService.ts` erweitern
2. Provider-spezifische Methode implementieren
3. In `setProvider()` registrieren

### Neue Agenten

1. Neuen Agent in `src/backend/agents/` erstellen
2. Agent-Interface implementieren
3. In IPC Handlers registrieren
4. Optional: In Workflow integrieren

### Neue Formulare

1. Formular-Definition in `formGenerator.ts` erweitern
2. PDF-Layout implementieren
3. IPC Handler hinzufügen

---

## Deployment

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run package  # Unverpackte App
npm run make     # Installer (DMG, EXE, DEB)
```

### Unterstützte Plattformen

- **Windows:** NSIS Installer (.exe)
- **macOS:** DMG Image (.dmg)
- **Linux:** DEB, RPM, AppImage

---

*Letzte Aktualisierung: 2026-02-05*
