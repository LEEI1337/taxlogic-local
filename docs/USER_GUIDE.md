# TaxLogic.local - Benutzerhandbuch

## Willkommen

TaxLogic.local ist Ihr persoenlicher KI-Steuerberater fuer Oesterreich. Diese Anleitung fuehrt Sie durch alle Funktionen der Anwendung.

---

## Voraussetzungen

Bevor Sie beginnen, stellen Sie sicher dass:

1. **Ollama** laeuft (Docker oder nativ) mit folgenden Modellen:
   - `llama3.1:8b` - Hauptmodell fuer Gespraeche
   - `nomic-embed-text` - Embedding-Modell fuer Wissensbasis

2. Pruefen Sie mit:
   ```bash
   # Docker
   docker exec ollama ollama list

   # Nativ
   ollama list
   ```

Falls ein Modell fehlt:
```bash
docker exec ollama ollama pull llama3.1:8b
docker exec ollama ollama pull nomic-embed-text
```

---

## Erste Schritte

### 1. Onboarding-Assistent

Beim ersten Start fuehrt Sie der Einrichtungsassistent durch 4 Schritte:

**Schritt 1: Willkommen**
- Uebersicht ueber die App
- "Einrichtung starten" klicken

**Schritt 2: LLM-Setup**
- Ollama URL eingeben (Standard: `http://localhost:11434`)
- "Testen" klicken um Verbindung zu pruefen
- Modell auswaehlen (z.B. `llama3.1:8b`)
- Optional: Claude API Key eingeben (mit Datenschutz-Warnung)

**Schritt 3: Profil**
- Beruf eingeben
- Beschaeftigungsstatus waehlen:
  - Angestellt (Formular L1)
  - Selbststaendig mit Anstellung (Formular L1 + L1ab)

**Schritt 4: Abschluss**
- Zusammenfassung aller Einstellungen
- "Los geht's!" startet die App

### 2. Einstellungen aendern

Sie koennen jederzeit Einstellungen aendern:
- **Einstellungen** -> **Profil** -> Beruf/Status aendern
- **Einstellungen** -> **LLM** -> Provider/Modell wechseln
- **Einstellungsassistent erneut starten** -> Komplettes Onboarding wiederholen

---

## Interview

### Uebersicht

Das KI-Interview sammelt alle relevanten Informationen fuer Ihre Steuererklaerung in einem Chat-Format.

### So starten Sie

1. Navigieren Sie zu **Interview**
2. Klicken Sie **Interview starten**
3. Beantworten Sie die Fragen im Chat

### Abgedeckte Bereiche (25 Fragen)

| Kategorie | Themen |
|-----------|--------|
| **Persoenliche Daten** | Name, Steuer-ID |
| **Einkommen** | Bruttoeinkommen, Nebeneinkuenfte |
| **Pendeln** | Entfernung, Transportmittel (Pendlerpauschale) |
| **Home-Office** | Anzahl Tage, Pauschalbetraege |
| **Werbungskosten** | Arbeitsmittel, Fortbildung, Fachliteratur |
| **Sonderausgaben** | Spenden, Kirchenbeitrag, Versicherungen |
| **Aussergewoehnliche Belastungen** | Krankheitskosten, Kinderbetreuung |
| **Familienbonus** | Kinder, Alleinverdiener/Alleinerzieher |

### Tipps

- Antworten koennen ungefaehre Werte sein
- "Weiter zu Dokumenten" ueberspringt restliche Fragen
- Der Chat zeigt "Interview abgeschlossen" wenn alle Fragen beantwortet sind

---

## Dokumente hochladen

### Unterstuetzte Formate

| Format | OCR | Empfehlung |
|--------|-----|------------|
| **JPG/PNG** | Ja | Gut lesbare Fotos |
| **PDF** | Begrenzt | Text-PDFs besser |
| **HEIC** | Ja | iPhone Fotos |

### Hochladen

1. **Drag & Drop:** Dateien in den Upload-Bereich ziehen
2. **Datei-Dialog:** "Dateien auswaehlen" klicken

### Automatische Verarbeitung

Die KI erkennt automatisch:
- **Betrag** (EUR)
- **Datum**
- **Haendler/Aussteller**
- **Kategorie** (z.B. Arbeitsmittel, Fahrtkosten, Spende)

Ueberpruefen Sie die Kategorien und korrigieren Sie bei Bedarf.

---

## Ueberpruefung & Analyse

Die Review-Seite zeigt:

- **Bruttoeinkommen** - Ihr Gesamteinkommen
- **Absetzungen** - Alle erkannten Abzuege
- **Zu versteuerndes Einkommen** - Nach Abzuegen
- **Geschaetzte Rueckerstattung** - Ihre voraussichtliche Erstattung

### Absetzungen im Detail

Klicken Sie auf eine Kategorie um einzelne Posten zu sehen.

---

## Export

### Formulare generieren

| Formular | Beschreibung | Wann benoetigt |
|----------|--------------|----------------|
| **L1** | Hauptformular Arbeitnehmerveranlagung | Immer |
| **L1ab** | Beilage fuer Einkuenfte aus Gewerbebetrieb | Bei Selbststaendigkeit |
| **L1k** | Beilage fuer Kinder | Bei Kindern |

### Filing-Guide

Die generierte Anleitung enthaelt:
1. **Vorbereitung** - Welche Unterlagen Sie brauchen
2. **FinanzOnline Login** - Schritt-fuer-Schritt
3. **Formular-Eingabe** - Wo welche Werte einzutragen sind
4. **Absenden** - Pruefung und Bestaetigung

---

## LLM Provider

### Lokal (Kostenlos, Privat)

| Provider | URL | Empfohlene Modelle |
|----------|-----|-------------------|
| **Ollama** | `http://localhost:11434` | llama3.1:8b, mistral, qwen2.5 |
| **LM Studio** | `http://localhost:1234` | Jedes GGUF-Modell |

### Cloud (BYOK)

| Provider | Datenschutz-Warnung |
|----------|---------------------|
| **Claude** (Anthropic) | Daten werden an Anthropic gesendet |
| **OpenAI/ChatGPT** | Daten werden an OpenAI gesendet |
| **Google Gemini** | Daten werden an Google gesendet |

> Bei Cloud-Providern werden Ihre Steuerdaten an externe Server uebermittelt!

---

## Haeufige Fragen

### Sind meine Daten sicher?
**Ja.** Bei Verwendung von Ollama/LM Studio bleiben alle Daten auf Ihrem Computer. Keine Telemetrie, kein Tracking.

### Kann ich die App offline nutzen?
**Ja**, mit Ollama oder LM Studio. Diese laufen vollstaendig lokal.

### Was ist das nomic-embed-text Modell?
Ein kleines (~274 MB) Embedding-Modell das Texte in Vektoren umwandelt. Es wird fuer die Steuerrecht-Wissensbasis (RAG) benoetigt. Ohne dieses Modell funktioniert die App, aber Steuerrecht-Referenzen sind nicht verfuegbar.

### Was wenn die KI einen Fehler macht?
Ueberpruefen Sie alle Vorschlaege. Die KI ist ein Hilfsmittel, ersetzt aber keine Steuerberatung. Bei Unsicherheiten konsultieren Sie einen Steuerberater.

---

## Support

- **GitHub Issues:** https://github.com/LEEI1337/taxlogic-local/issues
- **Dokumentation:** https://github.com/LEEI1337/taxlogic-local/tree/master/docs

---

*TaxLogic.local - Ihre Steuern, Ihre Kontrolle, Ihre Privatsphaere.*

*Letzte Aktualisierung: 2026-02-11*
