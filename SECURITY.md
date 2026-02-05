# Security Policy / Sicherheitsrichtlinien

```
███████╗███████╗ ██████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗
██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
███████╗█████╗  ██║     ██║   ██║██████╔╝██║   ██║    ╚████╔╝ 
╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██║   ██║     ╚██╔╝  
███████║███████╗╚██████╗╚██████╔╝██║  ██║██║   ██║      ██║   
╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝   
```

## Übersicht / Overview

TaxLogic.local nimmt die Sicherheit Ihrer Daten sehr ernst. Da die Anwendung sensible Steuerdaten verarbeitet, ist Sicherheit ein Kernprinzip unserer Architektur.

TaxLogic.local takes the security of your data very seriously. Since the application processes sensitive tax data, security is a core principle of our architecture.

---

## 🔒 Sicherheitsarchitektur / Security Architecture

### Privacy-First Design

```
┌─────────────────────────────────────────────────────────────┐
│                    LOKALE VERARBEITUNG                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌────────────────┐    ┌────────────────┐                  │
│   │  Ihre Daten    │    │  Lokales LLM   │                  │
│   │  (SQLite)      │ ←→ │  (Ollama)      │                  │
│   └────────────────┘    └────────────────┘                  │
│          │                      │                            │
│          ▼                      ▼                            │
│   ┌────────────────────────────────────────┐                │
│   │         Ihr Computer - OFFLINE          │                │
│   │         Keine Cloud-Verbindung          │                │
│   │         Keine Telemetrie                │                │
│   └────────────────────────────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sicherheitsfeatures / Security Features

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| **Lokale Verarbeitung** | Alle Daten bleiben auf Ihrem Gerät | ✅ Implementiert |
| **Keine Telemetrie** | Kein Tracking, keine Analytics | ✅ Implementiert |
| **Context Isolation** | Electron-Sicherheitsmechanismus | ✅ Implementiert |
| **Node Integration Off** | Renderer hat keinen Node.js-Zugriff | ✅ Implementiert |
| **Content Security Policy** | XSS-Schutz | ✅ Implementiert |
| **Secure IPC** | Sichere Inter-Process Communication | ✅ Implementiert |

---

## 🚨 Schwachstellen melden / Reporting Vulnerabilities

### Verantwortungsvolle Offenlegung / Responsible Disclosure

Wenn Sie eine Sicherheitslücke in TaxLogic.local entdecken, bitten wir Sie um **verantwortungsvolle Offenlegung**.

If you discover a security vulnerability in TaxLogic.local, we ask for **responsible disclosure**.

### Meldeprozess / Reporting Process

**❌ NICHT öffentlich melden:**
- Keine GitHub Issues für Sicherheitslücken
- Keine öffentlichen Diskussionen

**✅ Bitte melden an:**

📧 **security@taxlogic.local**

oder nutzen Sie GitHub Security Advisories (privat).

### Informationen zur Meldung / Information to Include

Bitte geben Sie folgende Informationen an:

```markdown
## Vulnerability Report

### Zusammenfassung
[Kurze Beschreibung der Schwachstelle]

### Betroffene Version
[z.B. 1.0.0-alpha]

### Schritte zur Reproduktion
1. [Erster Schritt]
2. [Zweiter Schritt]
3. [...]

### Erwartetes Verhalten
[Was sollte passieren]

### Tatsächliches Verhalten
[Was passiert stattdessen]

### Auswirkungen
[Mögliche Auswirkungen der Schwachstelle]

### Proof of Concept (optional)
[Code oder Screenshots]

### Vorgeschlagene Lösung (optional)
[Ihre Empfehlung]
```

---

## ⏱️ Reaktionszeiten / Response Times

| Schweregrad | Erste Antwort | Fix-Ziel |
|-------------|---------------|----------|
| **Kritisch** | 24 Stunden | 7 Tage |
| **Hoch** | 48 Stunden | 14 Tage |
| **Mittel** | 7 Tage | 30 Tage |
| **Niedrig** | 14 Tage | 90 Tage |

### Schweregrad-Klassifizierung / Severity Classification

| Schweregrad | Kriterien |
|-------------|-----------|
| **Kritisch** | Datenexfiltration, Remote Code Execution, Auth Bypass |
| **Hoch** | Lokale Privilege Escalation, sensible Datenlecks |
| **Mittel** | Denial of Service, nicht-kritische Informationslecks |
| **Niedrig** | Geringe Auswirkung, theoretische Schwachstellen |

---

## ✅ Unterstützte Versionen / Supported Versions

| Version | Unterstützt | Sicherheitsupdates |
|---------|-------------|-------------------|
| 1.0.x (alpha) | ✅ Ja | ✅ Ja |
| < 1.0.0 | ❌ Nein | ❌ Nein |

**Hinweis:** Als Alpha-Software empfehlen wir regelmäßige Updates.

---

## 🛡️ Sicherheitsrichtlinien für Entwickler / Security Guidelines for Developers

### Allgemeine Prinzipien / General Principles

1. **Defense in Depth** - Mehrere Sicherheitsebenen
2. **Least Privilege** - Minimale Berechtigungen
3. **Secure by Default** - Sichere Standardeinstellungen
4. **Fail Secure** - Bei Fehlern sicher fehlschlagen

### Electron-spezifische Sicherheit / Electron Security

```typescript
// ✅ KORREKT: Sichere Konfiguration
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,        // Isolation aktiviert
    nodeIntegration: false,        // Node.js im Renderer deaktiviert
    sandbox: true,                 // Sandbox aktiviert
    preload: path.join(__dirname, 'preload.js')
  }
});

// ❌ FALSCH: Unsichere Konfiguration
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: false,       // NIEMALS!
    nodeIntegration: true,         // NIEMALS!
  }
});
```

### IPC-Sicherheit / IPC Security

```typescript
// ✅ KORREKT: Input validieren
ipcMain.handle('db:save-profile', async (event, profile: unknown) => {
  // Schema-Validierung mit Zod
  const validatedProfile = UserProfileSchema.parse(profile);
  return dbService.saveProfile(validatedProfile);
});

// ❌ FALSCH: Keine Validierung
ipcMain.handle('db:save-profile', async (event, profile) => {
  return dbService.saveProfile(profile); // Unsicher!
});
```

### Datenbankzugriff / Database Access

```typescript
// ✅ KORREKT: Parametrisierte Abfragen
db.run('SELECT * FROM users WHERE id = ?', [userId]);

// ❌ FALSCH: SQL Injection möglich
db.run(`SELECT * FROM users WHERE id = '${userId}'`); // NIEMALS!
```

### Sensible Daten / Sensitive Data

```typescript
// ✅ KORREKT: API-Keys aus Environment
const apiKey = process.env.ANTHROPIC_API_KEY;

// ❌ FALSCH: Hardcoded Secrets
const apiKey = 'sk-ant-123456789'; // NIEMALS!
```

---

## 📋 Sicherheits-Checkliste / Security Checklist

### Für Contributors / For Contributors

Vor dem Erstellen eines Pull Requests:

- [ ] Keine Secrets im Code (API-Keys, Passwörter)
- [ ] Keine Logging von sensiblen Daten
- [ ] Input-Validierung implementiert
- [ ] Keine `eval()` oder `new Function()`
- [ ] Keine unsicheren Electron-Einstellungen
- [ ] Abhängigkeiten auf Vulnerabilities geprüft

### Für Maintainer / For Maintainers

Bei jedem Release:

- [ ] `npm audit` ausgeführt
- [ ] Abhängigkeiten aktualisiert
- [ ] Sicherheitsrelevante PRs geprüft
- [ ] SECURITY.md aktuell
- [ ] Keine bekannten kritischen Vulnerabilities

---

## 🔐 Abhängigkeiten / Dependencies

### Überprüfung / Auditing

```bash
# Vulnerabilities prüfen
npm audit

# Automatische Fixes
npm audit fix

# Detaillierter Bericht
npm audit --json > security-report.json
```

### Aktuelle Situation / Current Status

```
Letzte Prüfung: 2026-02-05
Kritische Vulnerabilities: 0 (Produktion)
Hohe Vulnerabilities: 26 (nur Dev-Dependencies)
```

**Hinweis:** Vulnerabilities in Dev-Dependencies betreffen nicht die ausgelieferte Anwendung.

---

## 🎖️ Security Hall of Fame

Wir danken den folgenden Personen für ihre verantwortungsvolle Meldung von Sicherheitslücken:

| Name | Datum | Schweregrad |
|------|-------|-------------|
| *Noch keine Meldungen* | - | - |

Möchten Sie hier erscheinen? Melden Sie Schwachstellen verantwortungsvoll!

---

## 📚 Weitere Ressourcen / Additional Resources

- [OWASP Electron Security Checklist](https://owasp.org/www-project-electron-security/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Austrian Data Protection Authority (DSB)](https://www.dsb.gv.at/)
- [GDPR Compliance](https://gdpr.eu/)

---

## Kontakt / Contact

Für Sicherheitsfragen:
- 📧 **security@taxlogic.local**
- 🔐 GitHub Security Advisories

---

*Letzte Aktualisierung / Last updated: 2026-02-05*
