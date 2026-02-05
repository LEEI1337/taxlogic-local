# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

All notable changes to this project will be documented in this file.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Geplant / Planned
- FinanzOnline API Integration
- Multi-Language Support (DE/EN)
- Qdrant Vector Database Integration
- Voice Input für Interviews
- Mobile Companion App

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

- PDF OCR noch nicht implementiert (nur Bilder)
- Qdrant Integration ausstehend
- Keine Tests vorhanden
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

*Letzte Aktualisierung / Last updated: 2026-02-05*
