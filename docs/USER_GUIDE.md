# TaxLogic.local - Benutzerhandbuch

## Willkommen

TaxLogic.local ist Ihr persönlicher KI-Steuerberater für Österreich. Diese Anleitung führt Sie durch alle Funktionen der Anwendung.

---

## Erste Schritte

### 1. Anwendung starten

Nach dem Start sehen Sie den Onboarding-Bildschirm:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     🇦🇹 TaxLogic.local                          │
│                                                 │
│     ┌─────────────────────────────────────┐    │
│     │  ✓ Ollama verbunden                 │    │
│     │    Modell: mistral:latest           │    │
│     └─────────────────────────────────────┘    │
│                                                 │
│     [Weiter]                                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. Profil einrichten

Geben Sie Ihre Basisdaten ein:

- **Vorname & Nachname**
- **E-Mail** (optional)
- **Steuer-ID** (falls bekannt)
- **Adresse** (für Formulare)

Diese Daten werden **nur lokal** gespeichert.

### 3. LLM-Verbindung prüfen

TaxLogic.local benötigt ein lokales LLM. Unterstützt werden:

| Provider | Status | Empfehlung |
|----------|--------|------------|
| **Ollama** | ✅ Empfohlen | Schnell, einfach, kostenlos |
| **LM Studio** | ✅ Alternative | Gute UI, viele Modelle |
| **Claude API** | ⚠️ Cloud | BYOK, Kosten pro Anfrage |

---

## Interview

### Übersicht

Das Interview sammelt alle relevanten Informationen für Ihre Steuererklärung:

```
┌─────────────────────────────────────────────────┐
│  Interview - Steuerjahr 2024                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Kategorie: Einkommen                           │
│  Fortschritt: ████████░░ 80%                    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Wie hoch war Ihr Bruttoeinkommen 2024?  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ € [45.000                             ] │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Zurück]                        [Weiter]       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Kategorien

Das Interview deckt folgende Bereiche ab:

#### 1. Persönliche Daten
- Familienstand
- Kinder
- Behinderung

#### 2. Einkommen
- Bruttoeinkommen
- Nebeneinkünfte
- Kapitalerträge

#### 3. Werbungskosten
- Arbeitsweg (Pendlerpauschale)
- Home-Office
- Arbeitsmittel
- Fortbildung

#### 4. Sonderausgaben
- Versicherungen
- Spenden
- Kirchenbeitrag

#### 5. Außergewöhnliche Belastungen
- Krankheitskosten
- Kinderbetreuung
- Behinderung

### Tipps

- **Ehrliche Antworten:** Alle Daten bleiben lokal
- **Ungefähre Werte OK:** Exakte Beträge bei Belegen
- **Zurück erlaubt:** Sie können jederzeit Antworten ändern

---

## Dokumente hochladen

### Unterstützte Formate

| Format | OCR | Empfehlung |
|--------|-----|------------|
| **JPG/PNG** | ✅ Ja | Gut lesbare Fotos |
| **PDF** | ⚠️ Begrenzt | Text-PDFs besser |
| **HEIC** | ✅ Ja | iPhone Fotos |

### So laden Sie Belege hoch

1. **Drag & Drop:** Dateien in den Upload-Bereich ziehen
2. **Datei-Dialog:** "Dateien auswählen" klicken
3. **Ordner:** "Ordner auswählen" für mehrere Dateien

```
┌─────────────────────────────────────────────────┐
│  Dokumente hochladen                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │   📄 Dateien hierher ziehen             │   │
│  │      oder klicken zum Auswählen         │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Hochgeladene Belege:                          │
│                                                 │
│  ✅ rechnung_buero.jpg     Arbeitsmittel  95%  │
│  ✅ bahnticket.pdf         Pendler        88%  │
│  ✅ spende_rotes_kreuz.jpg Sonderausgaben 92%  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Automatische Kategorisierung

Die KI erkennt automatisch:
- **Betrag** (€)
- **Datum**
- **Händler/Aussteller**
- **Kategorie** (z.B. Arbeitsmittel, Fahrtkosten)

**Hinweis:** Überprüfen Sie die Kategorien und korrigieren Sie bei Bedarf.

---

## Überprüfung

### Daten prüfen

Vor der Formular-Generierung können Sie alle Daten überprüfen:

```
┌─────────────────────────────────────────────────┐
│  Überprüfung - Steuerjahr 2024                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 Zusammenfassung                             │
│                                                 │
│  Bruttoeinkommen:           € 45.000,00        │
│  - Sozialversicherung:      € -8.100,00        │
│  = Einkommen:               € 36.900,00        │
│                                                 │
│  Absetzbeträge:                                 │
│  ├─ Werbungskosten:         € -2.450,00        │
│  ├─ Sonderausgaben:         €   -730,00        │
│  └─ Pendlerpauschale:       € -1.560,00        │
│                                                 │
│  = Zu versteuerndes Eink.:  € 32.160,00        │
│                                                 │
│  Geschätzte Steuer:         €  8.040,00        │
│  Bereits bezahlt:           €  9.500,00        │
│  ─────────────────────────────────────────     │
│  Geschätzte Erstattung:     €  1.460,00 ✅     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Optimierungsvorschläge

Die KI zeigt Verbesserungsmöglichkeiten:

```
💡 Optimierungsvorschläge

1. Home-Office Pauschale (Hoch)
   Sie haben Home-Office angegeben aber keine Pauschale
   beantragt. Potenzielle Ersparnis: € 300

2. Fortbildungskosten (Mittel)
   Berufliche Weiterbildungen sind absetzbar.
   Haben Sie 2024 Kurse besucht?

3. Computer-Abschreibung (Niedrig)
   Ihr 2022 gekaufter Laptop kann noch abgeschrieben
   werden. Restbetrag: € 233
```

---

## Export

### Formulare generieren

Nach der Überprüfung können Sie die offiziellen Formulare erstellen:

| Formular | Beschreibung | Wann benötigt |
|----------|--------------|---------------|
| **L1** | Hauptformular | Immer |
| **L1ab** | Beilage für Einkünfte | Bei Nebeneinkünften |
| **L1k** | Sonderausgaben | Bei Sonderausgaben |

```
┌─────────────────────────────────────────────────┐
│  Export - Steuerjahr 2024                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Generierte Formulare:                          │
│                                                 │
│  📄 L1_2024.pdf          [Öffnen] [Download]   │
│  📄 L1k_2024.pdf         [Öffnen] [Download]   │
│                                                 │
│  📖 Anleitung_2024.pdf   [Öffnen] [Download]   │
│                                                 │
│  ─────────────────────────────────────────     │
│                                                 │
│  [Alle herunterladen]  [FinanzOnline öffnen]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Schritt-für-Schritt Anleitung

Die generierte Anleitung enthält:

1. **Vorbereitung**
   - Welche Unterlagen Sie bereithalten sollten
   - Checkliste

2. **FinanzOnline Login**
   - Schritt-für-Schritt mit Screenshots

3. **Formular-Eingabe**
   - Wo welche Werte einzutragen sind
   - Feld-für-Feld Anleitung

4. **Absenden**
   - Prüfung vor Absendung
   - Bestätigung speichern

---

## Einstellungen

### LLM Konfiguration

```
┌─────────────────────────────────────────────────┐
│  Einstellungen                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  🤖 LLM Provider                                │
│                                                 │
│  ○ Ollama (empfohlen)                          │
│    URL: http://localhost:11434                  │
│    Modell: [mistral:latest    ▼]               │
│                                                 │
│  ○ LM Studio                                    │
│    URL: http://localhost:1234                   │
│                                                 │
│  ○ Claude API (Cloud)                           │
│    API Key: [sk-ant-***************]            │
│                                                 │
│  [Verbindung testen]                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Daten & Datenschutz

- **Daten exportieren:** Alle Ihre Daten als JSON
- **Daten löschen:** Alle gespeicherten Daten entfernen
- **Backup erstellen:** Verschlüsseltes Backup

---

## Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| `Ctrl+N` | Neues Interview |
| `Ctrl+S` | Speichern |
| `Ctrl+E` | Export |
| `Ctrl+,` | Einstellungen |
| `Ctrl+Q` | Beenden |

---

## Häufige Fragen

### Sind meine Daten sicher?

**Ja.** Alle Daten werden ausschließlich lokal auf Ihrem Computer gespeichert. Es werden keine Daten an Server gesendet (außer Sie wählen Claude API).

### Kann ich die App offline nutzen?

**Ja**, wenn Sie Ollama oder LM Studio verwenden. Diese laufen vollständig lokal.

### Was passiert, wenn die KI einen Fehler macht?

Überprüfen Sie alle Vorschläge. Die KI ist ein Hilfsmittel, ersetzt aber keine Steuerberatung. Bei Unsicherheiten konsultieren Sie einen Steuerberater.

### Kann ich mehrere Steuerjahre verwalten?

**Ja.** Jedes Steuerjahr hat ein eigenes Interview und eigene Dokumente.

### Wie aktualisiere ich die Steuerregeln?

Updates werden über die App bereitgestellt. Die Wissensbasis enthält die aktuellen Steuergesetze für 2024-2026.

---

## Support

Bei Fragen oder Problemen:

- **GitHub Issues:** https://github.com/taxlogic/taxlogic-local/issues
- **Dokumentation:** https://github.com/taxlogic/taxlogic-local/docs

---

*TaxLogic.local - Ihre Steuern, Ihre Kontrolle, Ihre Privatsphäre.*
