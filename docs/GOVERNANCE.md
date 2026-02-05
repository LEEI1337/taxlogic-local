# Governance / Projektführung

```
 ██████╗  ██████╗ ██╗   ██╗███████╗██████╗ ███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗
██╔════╝ ██╔═══██╗██║   ██║██╔════╝██╔══██╗████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝
██║  ███╗██║   ██║██║   ██║█████╗  ██████╔╝██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  
██║   ██║██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  
╚██████╔╝╚██████╔╝ ╚████╔╝ ███████╗██║  ██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗
 ╚═════╝  ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
```

Dieses Dokument beschreibt die Governance-Struktur des TaxLogic.local Projekts.

This document describes the governance structure of the TaxLogic.local project.

---

## Übersicht / Overview

TaxLogic.local ist ein Open-Source-Projekt unter der MIT-Lizenz. Das Projekt wird von der Community entwickelt und von einem Kernteam gepflegt.

TaxLogic.local is an open-source project under the MIT license. The project is developed by the community and maintained by a core team.

---

## Rollen / Roles

### 👑 Maintainer

Maintainer sind für die Gesamtführung des Projekts verantwortlich.

**Verantwortlichkeiten:**
- Review und Merge von Pull Requests
- Release-Management
- Architektur-Entscheidungen
- Community-Moderation
- Sicherheits-Patches

**Aktuelle Maintainer:**
| Name | GitHub | Bereich |
|------|--------|---------|
| TaxLogic Team | @taxlogic | Alle Bereiche |

### 🔧 Contributors

Contributors sind Personen, die zum Projekt beitragen.

**Arten von Beiträgen:**
- Code-Beiträge (Features, Bugfixes)
- Dokumentation
- Tests
- Bug Reports
- Feature Requests
- Übersetzungen
- Design

### 👥 Community

Alle Nutzer und Interessenten des Projekts.

---

## Entscheidungsprozess / Decision Making

### RFC-Prozess (Request for Comments)

Für größere Änderungen verwenden wir einen RFC-Prozess:

1. **Proposal erstellen**
   - Erstellen Sie ein Issue mit dem Tag `[RFC]`
   - Beschreiben Sie das Problem und die vorgeschlagene Lösung
   
2. **Diskussion**
   - Mindestens 7 Tage offene Diskussion
   - Feedback von Maintainern und Community
   
3. **Entscheidung**
   - Maintainer treffen finale Entscheidung
   - Dokumentation der Gründe

### Abstimmungsregeln / Voting Rules

Bei kontroversen Entscheidungen:

| Entscheidungstyp | Erforderlich |
|------------------|--------------|
| Minor Changes | 1 Maintainer Approval |
| Features | 2+ Maintainer Approval |
| Breaking Changes | Alle Maintainer + Community Input |
| Governance Changes | Alle Maintainer einstimmig |

---

## Kommunikation / Communication

### Kanäle / Channels

| Kanal | Zweck |
|-------|-------|
| GitHub Issues | Bug Reports, Feature Requests |
| GitHub Discussions | Allgemeine Diskussionen |
| Pull Requests | Code Reviews |

### Sprache / Language

- **Primär:** Deutsch (für Endanwender-Dokumentation)
- **Code/Commits:** Englisch
- **Technische Docs:** Zweisprachig (DE/EN)

---

## Release-Prozess / Release Process

### Versionsschema / Versioning

Wir folgen [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE]

MAJOR - Inkompatible Änderungen
MINOR - Neue Features, abwärtskompatibel
PATCH - Bugfixes, abwärtskompatibel
```

### Release-Zyklus / Release Cycle

| Phase | Dauer | Beschreibung |
|-------|-------|--------------|
| Development | Laufend | Neue Features in `main` |
| Feature Freeze | 1 Woche | Nur Bugfixes |
| Release Candidate | 1 Woche | Testing |
| Release | - | Stable Release |

### Release-Checkliste / Release Checklist

- [ ] Alle Tests bestehen
- [ ] CHANGELOG.md aktualisiert
- [ ] Version in package.json erhöht
- [ ] Dokumentation aktualisiert
- [ ] Security Audit durchgeführt
- [ ] Release Notes erstellt
- [ ] Ankündigung vorbereitet

---

## Verhaltensregeln / Code of Conduct

Alle Teilnehmer müssen unserem [Code of Conduct](../CODE_OF_CONDUCT.md) folgen.

**Zusammenfassung:**
- Respektvoller Umgang
- Konstruktives Feedback
- Inklusive Sprache
- Keine Belästigung

### Durchsetzung / Enforcement

| Verstoß | Konsequenz |
|---------|------------|
| Erster | Warnung |
| Zweiter | Temporäre Sperre |
| Dritter | Dauerhafte Sperre |
| Schwer | Sofortige Sperre |

---

## Sicherheit / Security

### Schwachstellenmeldung / Vulnerability Reporting

- **NICHT** öffentlich melden
- E-Mail an: security@taxlogic.local
- Siehe [SECURITY.md](../SECURITY.md)

### Reaktionszeit / Response Time

| Schweregrad | Reaktion |
|-------------|----------|
| Kritisch | 24h |
| Hoch | 48h |
| Mittel | 7 Tage |
| Niedrig | 14 Tage |

---

## Lizenz und Copyright / License & Copyright

### Lizenz / License

Das Projekt steht unter der [MIT License](../LICENSE).

### Contributor License Agreement

Mit dem Einreichen von Code stimmen Contributors zu:
- Sie haben das Recht, den Code beizutragen
- Der Code steht unter der MIT-Lizenz
- Sie verzichten auf keine bestehenden Rechte

### Copyright

Copyright-Notices:
- Projekt-Copyright: TaxLogic Team
- Beitragende behalten Copyright für ihre Beiträge
- Alle unter MIT-Lizenz

---

## Ressourcen / Resources

### Wichtige Dokumente / Key Documents

| Dokument | Beschreibung |
|----------|--------------|
| [README.md](../README.md) | Projektübersicht |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Beitragsrichtlinien |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Verhaltensregeln |
| [SECURITY.md](../SECURITY.md) | Sicherheitsrichtlinien |
| [CHANGELOG.md](../CHANGELOG.md) | Versionshistorie |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Codierungsstandards |

### Links

- [GitHub Repository](https://github.com/taxlogic/taxlogic-local)
- [Issue Tracker](https://github.com/taxlogic/taxlogic-local/issues)
- [Discussions](https://github.com/taxlogic/taxlogic-local/discussions)

---

## Änderungen an diesem Dokument / Changes to this Document

Änderungen an der Governance erfordern:
1. RFC mit Tag `[GOVERNANCE]`
2. Mindestens 14 Tage Diskussion
3. Einstimmige Zustimmung der Maintainer

---

*Letzte Aktualisierung / Last updated: 2026-02-05*
