/**
 * TaxLogic.local - Guide Generator Service
 *
 * Generates personalized step-by-step filing guides:
 * - FinanzOnline submission instructions
 * - Document preparation checklists
 * - Audit readiness documentation
 */

import * as fs from 'fs';
import * as path from 'path';

import PDFDocument from 'pdfkit';

import { L1FormData } from './formGenerator';

// ========================================
// Type Definitions
// ========================================

export interface PersonalizedGuide {
  userId: string;
  taxYear: number;
  generatedAt: string;
  sections: GuideSection[];
  checklist: ChecklistItem[];
  importantDates: ImportantDate[];
  estimatedRefund: number;
  tips: string[];
}

export interface GuideSection {
  title: string;
  content: string;
  steps?: GuideStep[];
  subsections?: GuideSubsection[];
}

export interface GuideSubsection {
  title: string;
  content: string;
}

export interface GuideStep {
  number: number;
  title: string;
  description: string;
  screenshot?: string;
  note?: string;
}

export interface ChecklistItem {
  category: string;
  item: string;
  completed: boolean;
  required: boolean;
  note?: string;
}

export interface ImportantDate {
  date: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GuideGenerationInput {
  userId: string;
  taxYear: number;
  formData: L1FormData;
  hasL1ab: boolean;
  hasL1k: boolean;
  totalDeductions: number;
  estimatedRefund: number;
  documentCount: number;
}

// ========================================
// Guide Generator Service Class
// ========================================

class GuideGeneratorService {
  private outputPath: string;

  constructor() {
    this.outputPath = path.join(process.cwd(), 'data', 'output');
  }

  /**
   * Set the output path
   */
  setOutputPath(outputPath: string): void {
    this.outputPath = outputPath;
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  /**
   * Generate a complete personalized guide
   */
  async generateGuide(input: GuideGenerationInput): Promise<PersonalizedGuide> {
    const { userId, taxYear, formData, hasL1ab, hasL1k, totalDeductions, estimatedRefund, documentCount } = input;

    console.log(`[GuideGenerator] Generating guide for user ${userId}, year ${taxYear}`);

    const guide: PersonalizedGuide = {
      userId,
      taxYear,
      generatedAt: new Date().toISOString(),
      sections: [],
      checklist: [],
      importantDates: [],
      estimatedRefund,
      tips: []
    };

    // Section 1: Overview
    guide.sections.push(this.generateOverviewSection(formData, totalDeductions, estimatedRefund));

    // Section 2: Document Preparation
    guide.sections.push(this.generateDocumentSection(documentCount, hasL1ab, hasL1k));

    // Section 3: FinanzOnline Instructions
    guide.sections.push(this.generateFinanzOnlineSection(formData, hasL1ab, hasL1k));

    // Section 4: Specific Deduction Guidance
    guide.sections.push(this.generateDeductionSection(formData));

    // Section 5: After Submission
    guide.sections.push(this.generateAfterSubmissionSection());

    // Generate Checklist
    guide.checklist = this.generateChecklist(formData, hasL1ab, hasL1k, documentCount);

    // Important Dates
    guide.importantDates = this.generateImportantDates(taxYear);

    // Tips
    guide.tips = this.generateTips(formData, estimatedRefund);

    return guide;
  }

  /**
   * Export guide as Markdown
   */
  exportAsMarkdown(guide: PersonalizedGuide): string {
    let md = '';

    // Header
    md += `# Ihre persönliche Steueranleitung ${guide.taxYear}\n\n`;
    md += `*Generiert am ${new Date(guide.generatedAt).toLocaleDateString('de-AT')}*\n\n`;
    md += `---\n\n`;

    // Estimated Refund Highlight
    md += `## 💰 Geschätzte Rückerstattung: €${guide.estimatedRefund.toLocaleString('de-AT', { minimumFractionDigits: 2 })}\n\n`;
    md += `---\n\n`;

    // Sections
    for (const section of guide.sections) {
      md += `## ${section.title}\n\n`;
      md += `${section.content}\n\n`;

      if (section.steps) {
        for (const step of section.steps) {
          md += `### Schritt ${step.number}: ${step.title}\n\n`;
          md += `${step.description}\n\n`;
          if (step.note) {
            md += `> **Hinweis:** ${step.note}\n\n`;
          }
        }
      }

      if (section.subsections) {
        for (const sub of section.subsections) {
          md += `### ${sub.title}\n\n`;
          md += `${sub.content}\n\n`;
        }
      }

      md += `---\n\n`;
    }

    // Checklist
    md += `## ✅ Checkliste\n\n`;
    const categories = [...new Set(guide.checklist.map((i) => i.category))];
    for (const category of categories) {
      md += `### ${category}\n\n`;
      const items = guide.checklist.filter((i) => i.category === category);
      for (const item of items) {
        const checkbox = item.completed ? '☑' : '☐';
        const required = item.required ? ' **(Pflicht)**' : '';
        md += `- ${checkbox} ${item.item}${required}\n`;
        if (item.note) md += `  - *${item.note}*\n`;
      }
      md += '\n';
    }

    // Important Dates
    md += `## 📅 Wichtige Termine\n\n`;
    for (const date of guide.importantDates) {
      const emoji = date.priority === 'high' ? '🔴' : date.priority === 'medium' ? '🟡' : '🟢';
      md += `- ${emoji} **${date.date}**: ${date.description}\n`;
    }
    md += '\n';

    // Tips
    md += `## 💡 Tipps\n\n`;
    for (const tip of guide.tips) {
      md += `- ${tip}\n`;
    }
    md += '\n';

    // Footer
    md += `---\n\n`;
    md += `*Generiert von TaxLogic.local - 100% lokal & privat*\n`;

    return md;
  }

  /**
   * Export guide as PDF
   */
  async exportAsPDF(guide: PersonalizedGuide): Promise<string> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const filename = `Steueranleitung_${guide.taxYear}_${Date.now()}.pdf`;
    const filepath = path.join(this.outputPath, filename);

    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Title Page
    doc.fontSize(24).font('Helvetica-Bold').text('Ihre persönliche', { align: 'center' });
    doc.text('Steueranleitung', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).font('Helvetica').text(`Veranlagungsjahr ${guide.taxYear}`, { align: 'center' });
    doc.moveDown(2);

    // Estimated Refund Box
    doc.rect(100, doc.y, 395, 60).fill('#e8f5e9');
    doc.fillColor('black');
    doc.fontSize(14).text('Geschätzte Rückerstattung:', 120, doc.y - 45);
    doc.fontSize(24).font('Helvetica-Bold');
    doc.text(
      `€ ${guide.estimatedRefund.toLocaleString('de-AT', { minimumFractionDigits: 2 })}`,
      120,
      doc.y - 25
    );
    doc.font('Helvetica');

    doc.moveDown(4);

    // Generation Info
    doc.fontSize(10).fillColor('gray');
    doc.text(`Generiert am: ${new Date(guide.generatedAt).toLocaleString('de-AT')}`, { align: 'center' });
    doc.fillColor('black');

    // Add pages for each section
    for (const section of guide.sections) {
      doc.addPage();

      doc.fontSize(16).font('Helvetica-Bold').text(section.title);
      doc.moveDown();
      doc.fontSize(11).font('Helvetica').text(section.content);
      doc.moveDown();

      if (section.steps) {
        for (const step of section.steps) {
          doc.fontSize(12).font('Helvetica-Bold').text(`Schritt ${step.number}: ${step.title}`);
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').text(step.description);
          if (step.note) {
            doc.moveDown(0.5);
            doc.fontSize(9).fillColor('gray').text(`Hinweis: ${step.note}`);
            doc.fillColor('black');
          }
          doc.moveDown();
        }
      }

      if (section.subsections) {
        for (const sub of section.subsections) {
          doc.fontSize(12).font('Helvetica-Bold').text(sub.title);
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').text(sub.content);
          doc.moveDown();
        }
      }
    }

    // Checklist Page
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Checkliste');
    doc.moveDown();

    const categories = [...new Set(guide.checklist.map((i) => i.category))];
    for (const category of categories) {
      doc.fontSize(12).font('Helvetica-Bold').text(category);
      doc.moveDown(0.5);

      const items = guide.checklist.filter((i) => i.category === category);
      for (const item of items) {
        const checkbox = item.completed ? '☑' : '☐';
        const required = item.required ? ' (Pflicht)' : '';
        doc.fontSize(10).font('Helvetica').text(`${checkbox} ${item.item}${required}`);
      }
      doc.moveDown();
    }

    // Important Dates
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Wichtige Termine');
    doc.moveDown();

    for (const date of guide.importantDates) {
      const priority = date.priority === 'high' ? '!' : date.priority === 'medium' ? '•' : '○';
      doc.fontSize(10).text(`${priority} ${date.date}: ${date.description}`);
    }

    // Tips
    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold').text('Tipps');
    doc.moveDown();

    for (const tip of guide.tips) {
      doc.fontSize(10).font('Helvetica').text(`• ${tip}`);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('gray').text('TaxLogic.local - 100% lokal & privat', { align: 'center' });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      doc.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`[GuideGenerator] Generated PDF guide: ${filepath}`);
    return filepath;
  }

  // ========================================
  // Section Generators
  // ========================================

  private generateOverviewSection(formData: L1FormData, totalDeductions: number, estimatedRefund: number): GuideSection {
    return {
      title: '📋 Übersicht Ihrer Arbeitnehmerveranlagung',
      content: `Diese Anleitung wurde speziell für Sie, ${formData.vorname} ${formData.familienname}, erstellt.
Sie enthält alle Schritte zur Einreichung Ihrer Arbeitnehmerveranlagung für das Jahr ${formData.veranlagungsjahr}.

**Zusammenfassung:**
- Gesamte Werbungskosten: €${totalDeductions.toLocaleString('de-AT', { minimumFractionDigits: 2 })}
- Geschätzte Rückerstattung: €${estimatedRefund.toLocaleString('de-AT', { minimumFractionDigits: 2 })}

Bitte beachten Sie, dass die tatsächliche Rückerstattung von der Berechnung des Finanzamts abweichen kann.`,
      subsections: [
        {
          title: 'Was ist die Arbeitnehmerveranlagung?',
          content: `Die Arbeitnehmerveranlagung (auch "Lohnsteuerausgleich" genannt) ermöglicht es Ihnen, zu viel gezahlte Lohnsteuer
zurückzubekommen. Dies ist besonders dann der Fall, wenn Sie berufliche Ausgaben hatten, die Ihr Arbeitgeber nicht berücksichtigt hat.`
        },
        {
          title: 'Warum sollten Sie einreichen?',
          content: `Basierend auf Ihren Angaben haben Sie Anspruch auf Absetzbeträge und Werbungskosten,
die zu einer Steuerrückerstattung führen können. Die Einreichung ist freiwillig, lohnt sich aber in Ihrem Fall!`
        }
      ]
    };
  }

  private generateDocumentSection(documentCount: number, hasL1ab: boolean, hasL1k: boolean): GuideSection {
    const forms = ['L1 (Hauptformular)'];
    if (hasL1ab) forms.push('L1ab (Beilage für zusätzliche Einkünfte)');
    if (hasL1k) forms.push('L1k (Beilage für Kinder)');

    return {
      title: '📁 Dokumentenvorbereitung',
      content: `Bevor Sie mit der Einreichung beginnen, stellen Sie sicher, dass Sie alle notwendigen Dokumente bereit haben.

**Generierte Formulare:**
${forms.map((f) => `- ${f}`).join('\n')}

**Anzahl hochgeladener Belege:** ${documentCount}`,
      subsections: [
        {
          title: 'Aufbewahrungspflicht',
          content: `Bewahren Sie alle Originalbelege mindestens 7 Jahre auf! Das Finanzamt kann diese jederzeit anfordern.
TaxLogic.local speichert Ihre digitalen Kopien lokal auf Ihrem Computer.`
        },
        {
          title: 'Organisation der Belege',
          content: `Ihre Belege wurden automatisch in folgende Kategorien sortiert:
- Pendlerpauschale
- Home Office
- Fortbildungskosten
- Arbeitsmittel
- Medizinische Ausgaben
- Spenden
- Sonstige`
        }
      ]
    };
  }

  private generateFinanzOnlineSection(formData: L1FormData, _hasL1ab: boolean, _hasL1k: boolean): GuideSection {
    return {
      title: '🖥️ Einreichung über FinanzOnline',
      content: 'Folgen Sie diesen Schritten, um Ihre Arbeitnehmerveranlagung über FinanzOnline einzureichen.',
      steps: [
        {
          number: 1,
          title: 'Anmeldung bei FinanzOnline',
          description: `Öffnen Sie finanzonline.bmf.gv.at und melden Sie sich an.
Falls Sie noch keinen Zugang haben, können Sie sich mit Ihrer Handysignatur oder ID Austria registrieren.`,
          note: 'Die Erstanmeldung kann einige Tage dauern, da ein Aktivierungscode per Post gesendet wird.'
        },
        {
          number: 2,
          title: 'Arbeitnehmerveranlagung auswählen',
          description: `Navigieren Sie zu: Eingaben > Erklärungen > Arbeitnehmerveranlagung (L1)
Wählen Sie das Veranlagungsjahr ${formData.veranlagungsjahr}.`,
          note: 'Die Vorjahreserklärung ist noch bis zu 5 Jahre rückwirkend möglich!'
        },
        {
          number: 3,
          title: 'Persönliche Daten prüfen',
          description: `Überprüfen Sie Ihre persönlichen Daten:
- Name: ${formData.vorname} ${formData.familienname}
- Adresse: ${formData.strasse} ${formData.hausnummer}, ${formData.plz} ${formData.ort}
- SVNR: ${formData.sozialversicherungsnummer}`,
          note: 'Änderungen der Adresse müssen Sie separat beim Finanzamt melden.'
        },
        {
          number: 4,
          title: 'Werbungskosten eintragen',
          description: `Tragen Sie Ihre Werbungskosten in die entsprechenden Kennzahlen ein.
Die Werte finden Sie in Ihrem generierten L1-Formular:
${formData.pendlerpauschale ? `- KZ 718 (Pendlerpauschale): €${formData.pendlerpauschale}` : ''}
${formData.arbeitsmittel ? `- KZ 719 (Arbeitsmittel): €${formData.arbeitsmittel}` : ''}
${formData.fortbildungskosten ? `- KZ 720 (Fortbildung): €${formData.fortbildungskosten}` : ''}
${formData.homeOfficePauschale ? `- KZ 724 (Home Office): €${formData.homeOfficePauschale}` : ''}`,
          note: 'Achten Sie auf die korrekte Kennzahl!'
        },
        {
          number: 5,
          title: 'Sonderausgaben eintragen',
          description: `Falls zutreffend, tragen Sie Ihre Sonderausgaben ein:
${formData.kirchenbeitrag ? `- KZ 458 (Kirchenbeitrag): €${formData.kirchenbeitrag}` : ''}
${formData.spendenBeguenstigte ? `- KZ 459 (Spenden): €${formData.spendenBeguenstigte}` : ''}`,
          note: 'Kirchenbeiträge und Spenden werden oft automatisch von den Organisationen gemeldet.'
        },
        {
          number: 6,
          title: 'Bankverbindung prüfen',
          description: `Stellen Sie sicher, dass Ihre Bankverbindung für die Gutschrift hinterlegt ist:
IBAN: ${formData.iban || '(bitte in FinanzOnline eintragen)'}`,
          note: 'Ohne gültige Bankverbindung kann keine Rückerstattung erfolgen!'
        },
        {
          number: 7,
          title: 'Prüfen und Absenden',
          description: `Nutzen Sie die Vorschaufunktion von FinanzOnline, um alle Eingaben zu prüfen.
Wenn alles korrekt ist, klicken Sie auf "Erklärung absenden".
Sie erhalten eine Eingangsbestätigung mit Erfassungsnummer.`,
          note: 'Notieren Sie sich die Erfassungsnummer für eventuelle Rückfragen!'
        }
      ]
    };
  }

  private generateDeductionSection(formData: L1FormData): GuideSection {
    const subsections: GuideSubsection[] = [];

    if (formData.pendlerpauschale) {
      subsections.push({
        title: 'Pendlerpauschale',
        content: `Sie haben Anspruch auf die Pendlerpauschale für ${formData.pendlerkilometer || '?'} km Arbeitsweg.

Voraussetzungen:
- Die Strecke Wohnung-Arbeit beträgt mehr als 20 km (kleine Pendlerpauschale) oder ist mit öffentlichen Verkehrsmitteln unzumutbar (große Pendlerpauschale)
- Sie fahren regelmäßig zur Arbeitsstätte

Behalten Sie als Nachweis:
- Jahreskarten / Fahrscheine
- Tankbelege (bei KFZ-Nutzung)
- Pendlerrechner-Ausdruck von bmf.gv.at`
      });
    }

    if (formData.homeOfficePauschale) {
      subsections.push({
        title: 'Home Office Pauschale',
        content: `Sie haben ${formData.homeOfficeTage || '?'} Home Office Tage angegeben.

Berechnung: €3 pro Tag, maximal €300 pro Jahr (100 Tage)
Ihr Betrag: €${formData.homeOfficePauschale}

Behalten Sie als Nachweis:
- Bestätigung des Arbeitgebers über Home Office Tage
- Kalenderaufzeichnungen
- Ergonomische Arbeitsmittel-Rechnungen (falls zusätzlich absetzbar)`
      });
    }

    if (formData.fortbildungskosten) {
      subsections.push({
        title: 'Fortbildungskosten',
        content: `Berufliche Weiterbildung ist absetzbar, wenn sie mit Ihrer Tätigkeit zusammenhängt.

Ihr Betrag: €${formData.fortbildungskosten}

Absetzbar sind:
- Kursgebühren und Seminarkosten
- Fachliteratur und E-Learning
- Prüfungsgebühren
- Fahrtkosten zu Kursen

Behalten Sie als Nachweis:
- Rechnungen und Zahlungsbestätigungen
- Kursbeschreibungen
- Zertifikate`
      });
    }

    return {
      title: '💡 Details zu Ihren Absetzbeträgen',
      content: 'Hier finden Sie detaillierte Informationen zu den von Ihnen geltend gemachten Absetzbeträgen.',
      subsections: subsections.length > 0 ? subsections : [{
        title: 'Keine besonderen Absetzbeträge',
        content: 'Sie haben keine spezifischen Werbungskosten angegeben. Die Werbungskostenpauschale von €132 wird automatisch berücksichtigt.'
      }]
    };
  }

  private generateAfterSubmissionSection(): GuideSection {
    return {
      title: '📮 Nach der Einreichung',
      content: 'Was passiert nach dem Absenden Ihrer Arbeitnehmerveranlagung?',
      steps: [
        {
          number: 1,
          title: 'Bearbeitungszeit',
          description: `Die Bearbeitung durch das Finanzamt dauert in der Regel 2-4 Wochen.
Bei komplexeren Fällen oder während der Hauptsaison kann es länger dauern.`
        },
        {
          number: 2,
          title: 'Bescheid erhalten',
          description: `Sie erhalten einen Einkommensteuerbescheid per Post oder elektronisch in Ihrer FinanzOnline-Databox.
Prüfen Sie den Bescheid sorgfältig!`
        },
        {
          number: 3,
          title: 'Gutschrift',
          description: `Bei einer Gutschrift wird der Betrag auf Ihr hinterlegtes Bankkonto überwiesen.
Dies erfolgt meist innerhalb weniger Tage nach Bescheiderstellung.`
        },
        {
          number: 4,
          title: 'Einspruch bei Abweichungen',
          description: `Wenn der Bescheid von Ihrer Berechnung abweicht, haben Sie 1 Monat Zeit für eine Beschwerde.
TaxLogic.local kann Ihnen helfen, die Abweichungen zu analysieren.`
        }
      ]
    };
  }

  // ========================================
  // Checklist Generator
  // ========================================

  private generateChecklist(
    formData: L1FormData,
    hasL1ab: boolean,
    hasL1k: boolean,
    documentCount: number
  ): ChecklistItem[] {
    const checklist: ChecklistItem[] = [];

    // Documents
    checklist.push(
      { category: 'Dokumente', item: 'Lohnzettel L16 vom Arbeitgeber erhalten', completed: true, required: true },
      { category: 'Dokumente', item: `${documentCount} Belege digitalisiert`, completed: documentCount > 0, required: false },
      { category: 'Dokumente', item: 'L1 Formular generiert', completed: true, required: true }
    );

    if (hasL1ab) {
      checklist.push({ category: 'Dokumente', item: 'L1ab Formular generiert', completed: true, required: true });
    }
    if (hasL1k) {
      checklist.push({ category: 'Dokumente', item: 'L1k Formular generiert', completed: true, required: true });
    }

    // FinanzOnline
    checklist.push(
      { category: 'FinanzOnline', item: 'FinanzOnline Zugang vorhanden', completed: false, required: true },
      { category: 'FinanzOnline', item: 'Persönliche Daten geprüft', completed: false, required: true },
      { category: 'FinanzOnline', item: 'Bankverbindung hinterlegt', completed: !!formData.iban, required: true }
    );

    // Submission
    checklist.push(
      { category: 'Einreichung', item: 'Werbungskosten eingetragen', completed: false, required: true },
      { category: 'Einreichung', item: 'Sonderausgaben eingetragen', completed: false, required: false },
      { category: 'Einreichung', item: 'Erklärung abgesendet', completed: false, required: true },
      { category: 'Einreichung', item: 'Erfassungsnummer notiert', completed: false, required: true }
    );

    // Archive
    checklist.push(
      { category: 'Archivierung', item: 'Originalbelege aufbewahrt', completed: false, required: true, note: '7 Jahre Aufbewahrungspflicht' },
      { category: 'Archivierung', item: 'Bescheid erhalten und geprüft', completed: false, required: true }
    );

    return checklist;
  }

  // ========================================
  // Important Dates Generator
  // ========================================

  private generateImportantDates(taxYear: number): ImportantDate[] {
    return [
      {
        date: `31.12.${taxYear + 5}`,
        description: `Letzte Möglichkeit zur Einreichung der Arbeitnehmerveranlagung ${taxYear}`,
        priority: 'high'
      },
      {
        date: `30.04.${taxYear + 1}`,
        description: 'Empfohlener Einreichungszeitraum (schnellere Bearbeitung)',
        priority: 'medium'
      },
      {
        date: `31.12.${taxYear + 7}`,
        description: 'Ende der Aufbewahrungspflicht für Belege',
        priority: 'low'
      }
    ];
  }

  // ========================================
  // Tips Generator
  // ========================================

  private generateTips(formData: L1FormData, estimatedRefund: number): string[] {
    const tips: string[] = [];

    tips.push('Reichen Sie Ihre Erklärung so früh wie möglich ein - frühe Einreichungen werden schneller bearbeitet.');

    if (estimatedRefund > 500) {
      tips.push(`Bei einer Rückerstattung von über €500 lohnt es sich, alle Belege sorgfältig zu prüfen.`);
    }

    if (formData.pendlerpauschale) {
      tips.push('Nutzen Sie den offiziellen Pendlerrechner auf bmf.gv.at, um Ihren Anspruch zu dokumentieren.');
    }

    if (formData.homeOfficePauschale) {
      tips.push('Führen Sie ein Home Office Tagebuch - das Finanzamt kann einen Nachweis verlangen.');
    }

    tips.push('Spenden an begünstigte Organisationen werden automatisch gemeldet - prüfen Sie, ob diese korrekt übermittelt wurden.');
    tips.push('Bewahren Sie diese Anleitung zusammen mit Ihren Steuerunterlagen auf.');

    return tips;
  }
}

// Singleton instance
export const guideGenerator = new GuideGeneratorService();
export default GuideGeneratorService;
