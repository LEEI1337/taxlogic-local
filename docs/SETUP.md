# TaxLogic.local - Setup Guide

## Voraussetzungen

### Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| **Betriebssystem** | Windows 10, macOS 11, Ubuntu 20.04 | Windows 11, macOS 14, Ubuntu 22.04 |
| **RAM** | 8 GB | 16 GB |
| **Festplatte** | 2 GB frei | 10 GB frei (fuer LLM-Modelle) |
| **CPU** | 4 Kerne | 8+ Kerne |
| **GPU** | Nicht erforderlich | NVIDIA (fuer schnellere LLM) |

### Software

```bash
# Erforderlich
Node.js >= 22.0.0
npm >= 10.0.0

# Empfohlen (fuer lokales LLM)
Ollama - https://ollama.com
Docker - https://docker.com (fuer Ollama in Container)
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

### 2. Abhaengigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren (Optional)

```bash
cp .env.example .env.local
```

Standard-Konfiguration funktioniert direkt mit Ollama auf `localhost:11434`.

```bash
# .env.local (optionale Anpassungen)

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# LM Studio
LM_STUDIO_URL=http://localhost:1234

# Cloud Provider (Optional BYOK)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

---

## Ollama einrichten

### Option A: Docker (Empfohlen)

```bash
# Ollama Container starten
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

# Hauptmodell herunterladen (~4.9 GB)
docker exec ollama ollama pull llama3.1:8b

# Embedding-Modell herunterladen (~274 MB) - WICHTIG fuer RAG!
docker exec ollama ollama pull nomic-embed-text

# Pruefen
docker exec ollama ollama list
```

**Wichtig:** Das Embedding-Modell `nomic-embed-text` wird fuer die Wissensbasis (RAG) benoetigt. Ohne dieses Modell funktioniert die App trotzdem, aber Steuerrecht-Referenzen sind nicht verfuegbar.

### Option B: Ollama Nativ

**Windows:** Download von https://ollama.com/download

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

Dann Modelle herunterladen:
```bash
ollama pull llama3.1:8b
ollama pull nomic-embed-text
ollama list
```

### Erforderliche Modelle

| Modell | Groesse | Zweck |
|--------|---------|-------|
| `llama3.1:8b` | ~4.9 GB | Hauptmodell fuer Interviews & Analyse |
| `nomic-embed-text` | ~274 MB | Embeddings fuer RAG-Wissensbasis |

---

## Alternative: LM Studio

1. **Download:** https://lmstudio.ai
2. **Modell laden:** z.B. `mistral-7b-instruct` oder `llama-3.1-8b`
3. **Server starten:** "Local Server" Tab -> "Start Server"
4. **Port:** Standardmaessig `http://localhost:1234`

In der App: Einstellungen -> LLM Provider -> "LM Studio" auswaehlen

---

## Alternative: Claude API (BYOK)

1. **API Key besorgen:** https://console.anthropic.com
2. **In .env.local eintragen:** `ANTHROPIC_API_KEY=sk-ant-...`
3. **In App aktivieren:** Einstellungen -> LLM Provider -> "Claude" auswaehlen

> **Datenschutz-Warnung:** Bei Cloud-Providern werden Ihre Steuerdaten an externe Server gesendet. Fuer maximale Privatsphaere verwenden Sie Ollama oder LM Studio.

---

## Anwendung starten

### Entwicklungsmodus

```bash
npm run dev
```

### Installer erstellen

```bash
npm run make
```

Die Setup-EXE wird erstellt unter: `out/make/squirrel.windows/x64/TaxLogic-1.0.0-alpha Setup.exe`

Bei Installation werden automatisch Desktop- und Startmenue-Verknuepfungen erstellt.

---

## Erste Schritte

### 1. Onboarding

Beim ersten Start fuehrt der Einrichtungsassistent durch:
- **LLM Setup** - Ollama URL konfigurieren, Modell auswaehlen, Verbindung testen
- **Profil** - Beruf und Beschaeftigungsstatus (Angestellt/Selbststaendig)
- **Datenschutz-Hinweis** - Warnung bei Cloud-Providern

### 2. Interview starten

- KI-gefuehrte Fragen beantworten
- 25 Fragen zu Einkommen, Pendeln, Home-Office, Ausgaben etc.

### 3. Belege hochladen

- Drag & Drop oder Dateiauswahl
- Automatische OCR-Erkennung
- KI-Kategorisierung

### 4. Ueberpruefen & Exportieren

- Steuerberechnung pruefen
- L1/L1ab/L1k Formulare generieren
- Schritt-fuer-Schritt Anleitung fuer FinanzOnline

---

## Fehlerbehebung

### Ollama nicht erreichbar

```bash
# Docker
docker ps | grep ollama
docker exec ollama ollama list

# Nativ
curl http://localhost:11434/api/tags
```

### Wissensbasis-Fehler (Embedding model missing)

```bash
# Docker
docker exec ollama ollama pull nomic-embed-text

# Nativ
ollama pull nomic-embed-text
```

Die App funktioniert auch ohne - RAG-Features sind dann nicht verfuegbar.

### Port-Konflikte (EADDRINUSE)

Standard-Ports 3000/9000 koennten belegt sein. Konfiguriert in `forge.config.ts`:
- `port: 3456` (Dev Server)
- `loggerPort: 9876` (Webpack Logger)

### Blank Page nach Installation

Verursacht durch `@vercel/webpack-asset-relocator-loader` im Renderer-Bundle. Behoben in `webpack.renderer.config.ts` durch Filtern von `node-loader` und `asset-relocator-loader`.

### EPIPE Crash-Loop

Tritt auf wenn Squirrel den Parent-Prozess schliesst. Behoben durch:
- Error-Handler auf PDF-Streams
- try/catch im Logger
- EPIPE ignorieren im `uncaughtException` Handler

---

## Naechste Schritte

- [Benutzerhandbuch](USER_GUIDE.md)
- [Architektur](ARCHITECTURE.md)
- [API Dokumentation](API.md)

---

*Letzte Aktualisierung: 2026-02-11*
