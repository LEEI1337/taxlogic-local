# TaxLogic.local - Setup Guide

## Voraussetzungen

### Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| **Betriebssystem** | Windows 10, macOS 11, Ubuntu 20.04 | Windows 11, macOS 14, Ubuntu 22.04 |
| **RAM** | 8 GB | 16 GB |
| **Festplatte** | 2 GB frei | 10 GB frei (für LLM-Modelle) |
| **CPU** | 4 Kerne | 8+ Kerne |
| **GPU** | Nicht erforderlich | NVIDIA (für schnellere LLM) |

### Software

```bash
# Erforderlich
Node.js >= 22.0.0
npm >= 10.0.0

# Empfohlen (für lokales LLM)
Ollama - https://ollama.ai
# oder
LM Studio - https://lmstudio.ai
```

---

## Installation

### 1. Repository klonen

```bash
git clone https://github.com/LEEI1337/taxlogic-local.git
cd taxlogic-local
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

Dies installiert:
- Electron 28+
- React 18
- LangGraph/LangChain
- Tesseract.js (OCR)
- sql.js (SQLite)
- PDFKit
- und weitere...

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env.local
```

Bearbeite `.env.local`:

```bash
# LLM Konfiguration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest
LM_STUDIO_URL=http://localhost:1234

# Optional: Claude API (BYOK)
ANTHROPIC_API_KEY=sk-ant-...

# Datenbank
DATABASE_PATH=./db/taxlogic.db

# Features
FEATURE_OCR_ENABLED=true
FEATURE_RAG_ENABLED=true
```

### 4. Ollama einrichten (empfohlen)

#### Installation

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download von https://ollama.ai/download

#### Modelle herunterladen

```bash
# Hauptmodell für Konversationen
ollama pull mistral:latest

# Embedding-Modell für RAG
ollama pull nomic-embed-text:latest
```

#### Ollama starten

```bash
ollama serve
```

Überprüfe die Verbindung:
```bash
curl http://localhost:11434/api/tags
```

### 5. Anwendung starten

```bash
npm run dev
```

---

## Alternative: LM Studio

Falls du LM Studio statt Ollama verwenden möchtest:

1. **Download:** https://lmstudio.ai
2. **Modell laden:** z.B. `mistral-7b-instruct`
3. **Server starten:** "Local Server" Tab → "Start Server"
4. **Port:** Standardmäßig `http://localhost:1234`

In der App:
- Einstellungen → LLM Provider → "LM Studio" auswählen

---

## Alternative: Claude API (BYOK)

Für Cloud-basierte KI mit Claude:

1. **API Key besorgen:** https://console.anthropic.com
2. **In .env.local eintragen:** `ANTHROPIC_API_KEY=sk-ant-...`
3. **In App aktivieren:** Einstellungen → LLM Provider → "Claude" auswählen

**Hinweis:** Daten werden an Anthropic gesendet. Nicht für sensible Steuerdaten empfohlen.

---

## Verzeichnisstruktur nach Installation

```
taxlogic-local/
├── node_modules/          # npm Pakete
├── src/                   # Quellcode
├── data/                  # Benutzerdaten
│   ├── documents/         # Hochgeladene Belege
│   ├── output/            # Generierte PDFs
│   ├── models/            # Gecachte Modelle
│   └── cache/             # Verarbeitungs-Cache
├── db/                    # SQLite Datenbank
├── .env.local             # Umgebungsvariablen
└── package.json
```

---

## Erste Schritte

### 1. Onboarding

Beim ersten Start führt die App durch:
- LLM-Verbindungstest
- Profil-Erstellung
- Basis-Einstellungen

### 2. Interview starten

- "Neues Interview" klicken
- Steuerjahr auswählen
- KI-geführte Fragen beantworten

### 3. Belege hochladen

- Drag & Drop oder Dateiauswahl
- Automatische OCR-Erkennung
- KI-Kategorisierung

### 4. Überprüfung

- Alle Daten prüfen
- Änderungen vornehmen
- Optimierungsvorschläge beachten

### 5. Export

- L1/L1ab/L1k Formulare generieren
- Schritt-für-Schritt Anleitung erhalten
- Für FinanzOnline vorbereiten

---

## Fehlerbehebung

### Problem: "Ollama nicht erreichbar"

```bash
# Prüfe ob Ollama läuft
curl http://localhost:11434/api/tags

# Falls nicht, starte Ollama
ollama serve
```

### Problem: "Modell nicht gefunden"

```bash
# Liste installierte Modelle
ollama list

# Installiere fehlendes Modell
ollama pull mistral:latest
```

### Problem: "npm install schlägt fehl"

```bash
# Node Version prüfen
node --version  # >= 22.0.0 erforderlich

# npm Cache leeren
npm cache clean --force

# Erneut installieren
rm -rf node_modules package-lock.json
npm install
```

### Problem: "Electron startet nicht"

```bash
# Native Module neu bauen
npm run postinstall
# oder
npx electron-rebuild
```

---

## Build für Produktion

### Package (unverpackt)

```bash
npm run package
```

Ergebnis in `out/`

### Installer erstellen

```bash
npm run make
```

Ergebnis in `out/make/`:
- Windows: `.exe` (Squirrel)
- macOS: `.dmg`
- Linux: `.deb`, `.rpm`

---

## Nächste Schritte

- [Benutzerhandbuch](USER_GUIDE.md) lesen
- [API Dokumentation](API.md) für Entwickler
- [Architektur](ARCHITECTURE.md) für tieferes Verständnis

---

*Letzte Aktualisierung: 2026-02-05*
