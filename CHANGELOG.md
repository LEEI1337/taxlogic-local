# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

All notable changes to this project will be documented in this file.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Year-versioned tax rules (`2024-2026`) under `config/tax-rules/`
- Source snapshot assertions under `config/tax-sources/`
- Year-versioned RAG knowledge packs under `config/tax-knowledge/`
- New tax-rules CLI suite:
  - `tax-rules:check`
  - `tax-rules:verify`
  - `tax-rules:init-year`
  - `tax-rules:report`
  - `tax-rules:sync-rag`
  - `tax-rules:doctor`
- New IPC validation schemas in `src/main/ipcValidation.ts`
- New tax-rules IPC channels:
  - `taxRules:getStatus`
  - `taxRules:getSupportedYears`
  - `taxRules:getDiagnostics`
- Monthly freshness workflow: `.github/workflows/tax-rules-freshness.yml`
- IPC integration tests for validation and runtime rule blocking:
  - `tests/unit/ipcHandlers.integration.test.ts`

### Changed
- Analyzer and workflow now load tax constants from year-based rule packs instead of hardcoded 2024 values
- Interview start API now supports optional tax year:
  - `interview.start(userProfile, taxYear?)`
- Renderer now supports active tax year selection and persistence
- RAG retriever now emits source-year metadata and mismatch warnings
- Main process security hardening:
  - stricter navigation handling
  - logger redaction for sensitive fields
  - API key storage flow without plaintext fallback
- CI quality/security gates updated:
  - `lint`, `type-check`, `test`, `tax-rules:check`, `tax-rules:verify`
  - `npm audit --omit=dev --audit-level=moderate`
  - `npm audit --audit-level=moderate`
- Dependency overrides added for vulnerable transitive toolchain paths:
  - `tar@^7.5.9`
  - `webpack-dev-server@^5.2.2`

### Security
- Upgraded LangChain packages to remove production moderate `langsmith` advisory path
- Removed unused runtime dependencies `@langchain/community` and `langchain`
- Upgraded `electron` to `^35.7.5`
- Upgraded `vitest` and `@vitest/ui` to `^4.0.18`

### Geplant / Planned
- FinanzOnline API Integration
- Multi-Language Support (DE/EN)
- Qdrant Vector Database Integration
- Voice Input für Interviews
- Mobile Companion App

## [1.0.0-alpha.3] - 2026-02-09

### Hinzugefügt / Added
- **Ollama Netzwerk-Support** - Ollama-Server URL in den Einstellungen konfigurierbar (lokal oder Netzwerk)
- **dotenv Integration** - `.env.local` wird beim Start geladen für Konfiguration ohne Code-Änderungen
- **LLM Config Sync** - Settings-Änderungen werden live an den LLM-Service propagiert (kein App-Neustart nötig)

### Geändert / Changed
- Default-Modell von `mistral:latest` auf `llama3.1:8b` geändert
- SettingsPage zeigt Ollama-URL Feld mit Netzwerk-Hinweis

---

## [1.0.0-alpha.2] - 2026-02-09

### Behoben / Fixed

#### Kritische Steuerberechnungsfehler
- **Arbeitnehmerabsetzbetrag (€500) fehlte** - War fälschlich als "in Steuerstufen integriert" kommentiert, jetzt korrekt als Absetzposten implementiert
- **Medizinkosten-Selbstbehalt** - War hardcodiert auf 6%, jetzt dynamisch basierend auf Familienstatus (Behinderung: 0%, Alleinerzieher mit 3+ Kindern: 4%, etc.)
- **Steuerrückerstattung** - War pauschal 30%, jetzt mit progressiven österreichischen Steuersätzen berechnet

#### Formulare & Daten
- **Platzhalterdaten in Formularen** - "Max Mustermann" durch echte Benutzerdaten aus dem Profil ersetzt (L1, L1ab, L1k, Guide)
- **Kinderbetreuungskosten** - 50%-Regel bei geteilter Obsorge implementiert
- **Familienbonus Plus** - Einkommensgrenze (€15.000) für 18-24-Jährige dokumentiert

#### Sicherheit
- **API-Keys** - Aus localStorage (unverschlüsselt) in Electron safeStorage (verschlüsselt) verschoben
- **SettingsPage** - API-Key Felder nutzen jetzt IPC + React State statt Zustand/localStorage
- **Steuer-ID Validierung** - Prüfziffern-Algorithmus für österreichische Steuernummern implementiert

#### Verbesserungen
- **PDF-OCR** - Text-basierte PDFs können jetzt verarbeitet werden (pdf-parse)
- **Interview-Skip-Logik** - Von hardcodierten IDs zu datengetriebenem Skip-Rules-System refactored
- **Hardcodierte Durchschnittswerte** - Irreführende averageDeductions/percentile-Werte entfernt
- **TypeScript** - pdf-parse Type-Deklaration hinzugefügt, alle TS-Fehler behoben

### Hinzugefügt / Added
- GitHub Actions CI/CD Pipeline (lint, type-check, test)
- **163 Unit-Tests** (vorher 21): E2E Steuerberechnung (19), Validation (23), DB-Service (24)
- 17 realistische Steuerszenarien mit handgerechneten Erwartungswerten
- Platzhalter App-Icons für Build

---

## [1.0.0-alpha] - 2026-02-05

### 🎉 Erste Alpha-Version / First Alpha Release

Dies ist die erste öffentliche Alpha-Version von TaxLogic.local.

This is the first public alpha release of TaxLogic.local.

### Hinzugefügt / Added

#### Phase 1 - MVP Foundation
- **Electron + React Foundation**
  - Cross-platform Desktop App (Windows, macOS, Linux)
  - Electron 28+ mit React 18
  - TypeScript 5.3 für vollständige Typsicherheit
  
- **UI-Komponenten / UI Components**
  - OnboardingPage mit LLM-Verbindungsprüfung
  - InterviewPage mit KI-gesteuerten Fragen
  - DocumentUploadPage mit Drag & Drop
  - ReviewPage mit Zusammenfassung
  - ExportPage mit PDF-Generierung
  - SettingsPage für Konfiguration
  
- **State Management**
  - Zustand Store für globalen Zustand
  - Persistenz-Mechanismus
  
- **LLM Service**
  - Ollama Integration (localhost:11434)
  - LM Studio Integration (localhost:1234)
  - Claude API Support (BYOK)
  - Automatisches Fallback

- **Datenbank / Database**
  - SQLite mit sql.js (WASM)
  - Lokale Datenspeicherung
  - Migrations-System

#### Phase 2 - Core Features

- **OCR Service**
  - Tesseract.js Integration
  - Mehrsprachige Texterkennung
  - Konfidenz-Bewertung
  
- **Document Organizer**
  - KI-gestützte Kategorisierung
  - Automatische Ausgabenzuordnung
  - Unterstützte Kategorien:
    - Werbungskosten
    - Sonderausgaben
    - Außergewöhnliche Belastungen
    - Home-Office
    - Pendlerpauschale

- **Form Generator**
  - L1 Hauptformular
  - L1ab Beilage
  - L1k Sonderausgaben
  - PDFKit-basierte Generierung

- **Guide Generator**
  - Personalisierte Schritt-für-Schritt Anleitungen
  - FinanzOnline Anweisungen
  - Checklisten

- **LangGraph Workflow**
  - 6-Node Steuererklärungs-Workflow:
    1. Interview Node
    2. Document Node
    3. Review Node
    4. Analysis Node
    5. Forms Node
    6. Guide Node
  - Zustandsbasierte Übergänge

- **Multi-Agent System**
  - Interviewer Agent - Intelligente Steuer-Interviews
  - Document Inspector Agent - Beleg-Analyse
  - Analyzer Agent - Steuerberechnungen
  - Report Writer Agent - Berichtserstellung

- **RAG System**
  - Embeddings Service (Ollama nomic-embed-text)
  - In-Memory Vector Store
  - Semantische Suche
  - Quellenangaben

- **IPC Integration**
  - Vollständige Frontend-Backend-Verbindung
  - Typisierte API
  - Error Handling

### Dokumentation / Documentation

- README.md mit vollständiger Projektbeschreibung
- ARCHITECTURE.md für Systementwurf
- SETUP.md für Installation
- USER_GUIDE.md für Endanwender
- API.md für Entwickler
- CONTRIBUTING.md für Mitwirkende
- CODE_OF_CONDUCT.md für Verhaltensregeln
- SECURITY.md für Sicherheitsrichtlinien
- CHANGELOG.md (diese Datei)

### Sicherheit / Security

- Context Isolation aktiviert
- Node Integration im Renderer deaktiviert
- Preload Script für sichere IPC
- Keine Cloud-Abhängigkeiten (außer optionalem BYOK)
- Keine Telemetrie

### Bekannte Einschränkungen / Known Limitations

- PDF OCR für gescannte PDFs eingeschränkt (Text-PDFs funktionieren)
- Qdrant Integration ausstehend (In-Memory Vector Store aktiv)
- Testabdeckung ~33% des Backends (5 von 15 Dateien)
- Alpha-Stabilität

---

## Versionsschema / Version Schema

```
MAJOR.MINOR.PATCH[-PRERELEASE]

MAJOR - Inkompatible API-Änderungen
MINOR - Neue Features, abwärtskompatibel
PATCH - Bugfixes, abwärtskompatibel
PRERELEASE - alpha, beta, rc
```

### Beispiele / Examples

- `1.0.0-alpha` - Erste Alpha-Version
- `1.0.0-beta.1` - Erste Beta-Version
- `1.0.0-rc.1` - Erster Release Candidate
- `1.0.0` - Erstes stabiles Release

---

## Migration Guides

### Von 0.x auf 1.0.0

Dies ist die erste Version, daher keine Migration erforderlich.

---

## Links

- [GitHub Releases](https://github.com/taxlogic/taxlogic-local/releases)
- [Dokumentation](./docs/)
- [Issue Tracker](https://github.com/taxlogic/taxlogic-local/issues)

---

*Letzte Aktualisierung / Last updated: 2026-02-09*
