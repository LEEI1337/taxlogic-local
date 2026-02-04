/**
 * TaxLogic.local - Report Writer Agent
 *
 * AI agent that generates comprehensive tax reports:
 * - Personalized filing guides
 * - Tax summary reports
 * - FinanzOnline instructions
 * - Audit preparation documents
 */

import { llmService, Message } from '../services/llmService';
import { TaxCalculationResult, TaxProfile } from './analyzerAgent';
import { DocumentAnalysis } from './documentInspectorAgent';
import { PersonalizedGuide, guideGenerator, GuideGenerationInput } from '../services/guideGenerator';
import { L1FormData } from '../services/formGenerator';

// ========================================
// Type Definitions
// ========================================

export interface ReportInput {
  userId: string;
  taxYear: number;
  profile: TaxProfile;
  calculation: TaxCalculationResult;
  documents: DocumentAnalysis[];
  interviewResponses: Record<string, unknown>;
}

export interface TaxReport {
  id: string;
  userId: string;
  taxYear: number;
  generatedAt: string;

  // Report Sections
  executiveSummary: ExecutiveSummary;
  incomeSection: IncomeSection;
  deductionsSection: DeductionsSection;
  calculationSection: CalculationSection;
  documentsSection: DocumentsSection;
  recommendationsSection: RecommendationsSection;
  appendix: ReportAppendix;

  // Output Formats
  markdown: string;
  pdfPath?: string;
}

export interface ExecutiveSummary {
  headline: string;
  keyFigures: KeyFigure[];
  highlights: string[];
  nextSteps: string[];
}

export interface KeyFigure {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  note?: string;
}

export interface IncomeSection {
  title: string;
  grossIncome: number;
  netIncome: number;
  employers: string[];
  additionalIncome: { source: string; amount: number }[];
  explanation: string;
}

export interface DeductionsSection {
  title: string;
  totalDeductions: number;
  categories: DeductionCategory[];
  comparison: {
    yourDeductions: number;
    averageDeductions: number;
    percentile: number;
  };
  explanation: string;
}

export interface DeductionCategory {
  name: string;
  amount: number;
  percentage: number;
  items: { description: string; amount: number }[];
  tips: string[];
}

export interface CalculationSection {
  title: string;
  taxableIncome: number;
  calculatedTax: number;
  withheldTax: number;
  result: number;
  isRefund: boolean;
  steps: CalculationStep[];
  explanation: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  calculation: string;
  result: number;
}

export interface DocumentsSection {
  title: string;
  totalDocuments: number;
  byCategory: { category: string; count: number; amount: number }[];
  missingDocuments: string[];
  qualityAssessment: string;
}

export interface RecommendationsSection {
  title: string;
  shortTerm: Recommendation[];
  longTerm: Recommendation[];
  warnings: string[];
}

export interface Recommendation {
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
}

export interface ReportAppendix {
  glossary: { term: string; definition: string }[];
  legalReferences: { reference: string; description: string }[];
  contactInfo: { type: string; value: string }[];
}

// ========================================
// Report Writer Agent Class
// ========================================

export class ReportWriterAgent {
  /**
   * Generate a comprehensive tax report
   */
  async generateReport(input: ReportInput): Promise<TaxReport> {
    console.log('[ReportWriter] Generating report for user', input.userId);

    const { userId, taxYear, profile, calculation, documents, interviewResponses } = input;
    const generatedAt = new Date().toISOString();
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate all sections
    const executiveSummary = await this.generateExecutiveSummary(profile, calculation);
    const incomeSection = this.generateIncomeSection(profile, calculation);
    const deductionsSection = this.generateDeductionsSection(calculation);
    const calculationSection = this.generateCalculationSection(calculation);
    const documentsSection = this.generateDocumentsSection(documents);
    const recommendationsSection = this.generateRecommendationsSection(calculation);
    const appendix = this.generateAppendix();

    // Compile markdown
    const markdown = this.compileMarkdown({
      executiveSummary,
      incomeSection,
      deductionsSection,
      calculationSection,
      documentsSection,
      recommendationsSection,
      appendix,
      taxYear,
      generatedAt
    });

    return {
      id: reportId,
      userId,
      taxYear,
      generatedAt,
      executiveSummary,
      incomeSection,
      deductionsSection,
      calculationSection,
      documentsSection,
      recommendationsSection,
      appendix,
      markdown
    };
  }

  /**
   * Generate executive summary with AI
   */
  private async generateExecutiveSummary(
    profile: TaxProfile,
    calculation: TaxCalculationResult
  ): Promise<ExecutiveSummary> {
    const isRefund = calculation.estimatedRefund > 0;
    const resultAmount = isRefund ? calculation.estimatedRefund : calculation.estimatedBackpayment;

    // Key figures
    const keyFigures: KeyFigure[] = [
      {
        label: 'Bruttoeinkommen',
        value: `€${calculation.grossIncome.toLocaleString('de-AT')}`,
        trend: 'neutral'
      },
      {
        label: 'Absetzbeträge',
        value: `€${calculation.effectiveDeductions.toLocaleString('de-AT')}`,
        trend: calculation.effectiveDeductions > 1000 ? 'up' : 'neutral'
      },
      {
        label: isRefund ? 'Geschätzte Rückerstattung' : 'Geschätzte Nachzahlung',
        value: `€${resultAmount.toLocaleString('de-AT')}`,
        trend: isRefund ? 'up' : 'down'
      },
      {
        label: 'Effektiver Steuersatz',
        value: `${calculation.analysis.effectiveTaxRate}%`,
        trend: 'neutral'
      }
    ];

    // Generate AI headline
    let headline: string;
    try {
      const response = await llmService.query(
        `Erstelle eine motivierende Überschrift (max 15 Wörter) für einen Steuerbericht.
         Rückerstattung: €${calculation.estimatedRefund}, Jahr: ${profile.taxYear}.
         Antworte nur mit der Überschrift, ohne Anführungszeichen.`,
        [],
        'Du bist ein freundlicher Steuerberater-Assistent. Antworte auf Deutsch.'
      );
      headline = response.content.trim();
    } catch {
      headline = isRefund
        ? `Gute Nachrichten: Sie erhalten voraussichtlich €${resultAmount.toLocaleString('de-AT')} zurück!`
        : `Ihre Arbeitnehmerveranlagung ${profile.taxYear} ist bereit zur Einreichung`;
    }

    // Highlights
    const highlights: string[] = [];
    if (calculation.breakdown.pendlerpauschale.amount > 0) {
      highlights.push(`Pendlerpauschale: €${calculation.breakdown.pendlerpauschale.amount}`);
    }
    if (calculation.breakdown.homeOffice.amount > 0) {
      highlights.push(`Home Office: €${calculation.breakdown.homeOffice.amount} (${calculation.breakdown.homeOffice.days} Tage)`);
    }
    if (calculation.totalSonderausgaben > 0) {
      highlights.push(`Sonderausgaben: €${calculation.totalSonderausgaben}`);
    }
    if (calculation.absetzbetraege.familienbonus > 0) {
      highlights.push(`Familienbonus Plus: €${calculation.absetzbetraege.familienbonus}`);
    }

    // Next steps
    const nextSteps = [
      'Prüfen Sie alle Angaben in diesem Bericht',
      'Laden Sie Ihre Formulare (L1, L1ab, L1k) herunter',
      'Melden Sie sich bei FinanzOnline an',
      'Übertragen Sie die Daten gemäß der Schritt-für-Schritt Anleitung',
      'Bewahren Sie Ihre Belege 7 Jahre auf'
    ];

    return {
      headline,
      keyFigures,
      highlights,
      nextSteps
    };
  }

  /**
   * Generate income section
   */
  private generateIncomeSection(
    profile: TaxProfile,
    calculation: TaxCalculationResult
  ): IncomeSection {
    return {
      title: 'Einkünfte',
      grossIncome: calculation.grossIncome,
      netIncome: calculation.taxableIncome,
      employers: profile.income.employerCount > 1
        ? [`${profile.income.employerCount} Arbeitgeber`]
        : ['1 Arbeitgeber'],
      additionalIncome: profile.income.hasSelfEmployment && profile.income.selfEmploymentIncome
        ? [{ source: 'Selbstständige Tätigkeit', amount: profile.income.selfEmploymentIncome }]
        : [],
      explanation: `Ihr zu versteuerndes Einkommen beträgt €${calculation.taxableIncome.toLocaleString('de-AT')} nach Abzug aller Werbungskosten und Sonderausgaben.`
    };
  }

  /**
   * Generate deductions section
   */
  private generateDeductionsSection(calculation: TaxCalculationResult): DeductionsSection {
    const categories: DeductionCategory[] = [];
    const total = calculation.effectiveDeductions;

    // Werbungskosten
    if (calculation.totalWerbungskosten > 0) {
      categories.push({
        name: 'Werbungskosten',
        amount: calculation.totalWerbungskosten,
        percentage: (calculation.totalWerbungskosten / total) * 100,
        items: [
          { description: 'Pendlerpauschale', amount: calculation.breakdown.pendlerpauschale.amount },
          { description: 'Home Office', amount: calculation.breakdown.homeOffice.amount },
          { description: 'Arbeitsmittel', amount: calculation.breakdown.workEquipment.amount },
          { description: 'Fortbildung', amount: calculation.breakdown.education.amount }
        ].filter((i) => i.amount > 0),
        tips: ['Sammeln Sie alle beruflich bedingten Ausgaben', 'Auch kleine Beträge summieren sich']
      });
    }

    // Sonderausgaben
    if (calculation.totalSonderausgaben > 0) {
      categories.push({
        name: 'Sonderausgaben',
        amount: calculation.totalSonderausgaben,
        percentage: (calculation.totalSonderausgaben / total) * 100,
        items: [
          { description: 'Kirchenbeitrag', amount: calculation.breakdown.churchTax.amount },
          { description: 'Spenden', amount: calculation.breakdown.donations.amount }
        ].filter((i) => i.amount > 0),
        tips: ['Spenden werden oft automatisch an das Finanzamt gemeldet']
      });
    }

    // Außergewöhnliche Belastungen
    if (calculation.totalAussergewoehnlicheBelastungen > 0) {
      categories.push({
        name: 'Außergewöhnliche Belastungen',
        amount: calculation.totalAussergewoehnlicheBelastungen,
        percentage: (calculation.totalAussergewoehnlicheBelastungen / total) * 100,
        items: [
          { description: 'Krankheitskosten', amount: calculation.breakdown.medicalExpenses.amount },
          { description: 'Kinderbetreuung', amount: calculation.breakdown.childcare.amount }
        ].filter((i) => i.amount > 0),
        tips: ['Bewahren Sie alle Arztrechungen und Rezepte auf']
      });
    }

    return {
      title: 'Absetzbare Kosten',
      totalDeductions: total,
      categories,
      comparison: {
        yourDeductions: total,
        averageDeductions: 2500, // Assumed average
        percentile: total > 2500 ? 60 : 40
      },
      explanation: `Ihre gesamten Absetzbeträge von €${total.toLocaleString('de-AT')} reduzieren Ihr zu versteuerndes Einkommen.`
    };
  }

  /**
   * Generate calculation section
   */
  private generateCalculationSection(calculation: TaxCalculationResult): CalculationSection {
    const isRefund = calculation.estimatedRefund > 0;
    const result = isRefund ? calculation.estimatedRefund : calculation.estimatedBackpayment;

    const steps: CalculationStep[] = [
      {
        step: 1,
        description: 'Bruttoeinkommen',
        calculation: '',
        result: calculation.grossIncome
      },
      {
        step: 2,
        description: 'Abzüglich Werbungskosten',
        calculation: `€${calculation.grossIncome} - €${calculation.effectiveDeductions}`,
        result: calculation.taxableIncome
      },
      {
        step: 3,
        description: 'Berechnete Einkommensteuer',
        calculation: 'Progressive Steuersätze angewendet',
        result: calculation.calculatedTax
      },
      {
        step: 4,
        description: 'Bereits einbehaltene Lohnsteuer',
        calculation: '',
        result: calculation.withheldTax
      },
      {
        step: 5,
        description: isRefund ? 'Erstattung' : 'Nachzahlung',
        calculation: `€${calculation.withheldTax} - €${calculation.calculatedTax}`,
        result: isRefund ? calculation.estimatedRefund : -calculation.estimatedBackpayment
      }
    ];

    return {
      title: 'Steuerberechnung',
      taxableIncome: calculation.taxableIncome,
      calculatedTax: calculation.calculatedTax,
      withheldTax: calculation.withheldTax,
      result,
      isRefund,
      steps,
      explanation: isRefund
        ? `Da Ihr Arbeitgeber €${calculation.withheldTax.toLocaleString('de-AT')} Lohnsteuer einbehalten hat, aber nur €${calculation.calculatedTax.toLocaleString('de-AT')} geschuldet werden, erhalten Sie die Differenz zurück.`
        : `Die einbehaltene Lohnsteuer reicht nicht aus, um die berechnete Steuer zu decken.`
    };
  }

  /**
   * Generate documents section
   */
  private generateDocumentsSection(documents: DocumentAnalysis[]): DocumentsSection {
    const byCategory: { category: string; count: number; amount: number }[] = [];

    // Group by category
    const categoryMap = new Map<string, { count: number; amount: number }>();
    for (const doc of documents) {
      const cat = doc.classification.category;
      const current = categoryMap.get(cat) || { count: 0, amount: 0 };
      current.count++;
      current.amount += doc.aiAnalysis.suggestedAmount || 0;
      categoryMap.set(cat, current);
    }

    categoryMap.forEach((value, key) => {
      byCategory.push({ category: key, ...value });
    });

    return {
      title: 'Belegübersicht',
      totalDocuments: documents.length,
      byCategory: byCategory.sort((a, b) => b.amount - a.amount),
      missingDocuments: documents.length === 0
        ? ['Keine Belege hochgeladen - Laden Sie Ihre Rechnungen für höhere Absetzbeträge hoch']
        : [],
      qualityAssessment: documents.length > 0
        ? `${documents.filter((d) => d.ocrQuality.score > 80).length} von ${documents.length} Belegen mit guter OCR-Qualität`
        : 'Keine Belege zur Bewertung vorhanden'
    };
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendationsSection(calculation: TaxCalculationResult): RecommendationsSection {
    const shortTerm: Recommendation[] = calculation.analysis.recommendations.map((r) => ({
      title: r.title,
      description: r.description,
      impact: `Potenzielle Ersparnis: €${r.potentialSavings}`,
      priority: r.priority
    }));

    const longTerm: Recommendation[] = [
      {
        title: 'Vorsorge für nächstes Jahr',
        description: 'Beginnen Sie jetzt, Belege für das kommende Steuerjahr zu sammeln.',
        impact: 'Höhere Absetzbeträge möglich',
        priority: 'medium'
      },
      {
        title: 'Regelmäßige Überprüfung',
        description: 'Prüfen Sie quartalsweise Ihre Werbungskosten.',
        impact: 'Nichts vergessen',
        priority: 'low'
      }
    ];

    return {
      title: 'Empfehlungen',
      shortTerm,
      longTerm,
      warnings: calculation.analysis.warnings
    };
  }

  /**
   * Generate appendix
   */
  private generateAppendix(): ReportAppendix {
    return {
      glossary: [
        { term: 'Werbungskosten', definition: 'Aufwendungen zur Erwerbung, Sicherung und Erhaltung von Einnahmen' },
        { term: 'Sonderausgaben', definition: 'Bestimmte private Ausgaben, die steuerlich begünstigt sind' },
        { term: 'Pendlerpauschale', definition: 'Pauschalbetrag für Fahrten zwischen Wohnung und Arbeitsstätte' },
        { term: 'Familienbonus Plus', definition: 'Steuerabsetzbetrag für Kinder bis zu €2.000 pro Kind' },
        { term: 'IBAN', definition: 'International Bank Account Number für Überweisungen' }
      ],
      legalReferences: [
        { reference: '§ 16 EStG', description: 'Werbungskosten' },
        { reference: '§ 18 EStG', description: 'Sonderausgaben' },
        { reference: '§ 33 EStG', description: 'Steuersätze und Absetzbeträge' },
        { reference: '§ 34 EStG', description: 'Außergewöhnliche Belastungen' }
      ],
      contactInfo: [
        { type: 'FinanzOnline', value: 'finanzonline.bmf.gv.at' },
        { type: 'Finanzamt Hotline', value: '+43 50 233 233' },
        { type: 'TaxLogic Support', value: 'support@taxlogic.local' }
      ]
    };
  }

  /**
   * Compile all sections into markdown
   */
  private compileMarkdown(data: {
    executiveSummary: ExecutiveSummary;
    incomeSection: IncomeSection;
    deductionsSection: DeductionsSection;
    calculationSection: CalculationSection;
    documentsSection: DocumentsSection;
    recommendationsSection: RecommendationsSection;
    appendix: ReportAppendix;
    taxYear: number;
    generatedAt: string;
  }): string {
    let md = '';

    // Title
    md += `# Steuerbericht ${data.taxYear}\n\n`;
    md += `*Generiert am ${new Date(data.generatedAt).toLocaleString('de-AT')}*\n\n`;
    md += `---\n\n`;

    // Executive Summary
    md += `## ${data.executiveSummary.headline}\n\n`;

    md += `### Wichtige Kennzahlen\n\n`;
    md += `| Kennzahl | Wert |\n`;
    md += `|----------|------|\n`;
    data.executiveSummary.keyFigures.forEach((kf) => {
      const trend = kf.trend === 'up' ? '↑' : kf.trend === 'down' ? '↓' : '';
      md += `| ${kf.label} | ${kf.value} ${trend} |\n`;
    });
    md += '\n';

    if (data.executiveSummary.highlights.length > 0) {
      md += `### Highlights\n\n`;
      data.executiveSummary.highlights.forEach((h) => {
        md += `- ${h}\n`;
      });
      md += '\n';
    }

    md += `### Nächste Schritte\n\n`;
    data.executiveSummary.nextSteps.forEach((s, i) => {
      md += `${i + 1}. ${s}\n`;
    });
    md += '\n---\n\n';

    // Income Section
    md += `## ${data.incomeSection.title}\n\n`;
    md += `- **Bruttoeinkommen:** €${data.incomeSection.grossIncome.toLocaleString('de-AT')}\n`;
    md += `- **Zu versteuerndes Einkommen:** €${data.incomeSection.netIncome.toLocaleString('de-AT')}\n`;
    md += `\n${data.incomeSection.explanation}\n\n`;
    md += `---\n\n`;

    // Deductions Section
    md += `## ${data.deductionsSection.title}\n\n`;
    md += `**Gesamte Absetzbeträge:** €${data.deductionsSection.totalDeductions.toLocaleString('de-AT')}\n\n`;

    data.deductionsSection.categories.forEach((cat) => {
      md += `### ${cat.name} (€${cat.amount.toLocaleString('de-AT')})\n\n`;
      cat.items.forEach((item) => {
        md += `- ${item.description}: €${item.amount.toLocaleString('de-AT')}\n`;
      });
      md += '\n';
    });
    md += `---\n\n`;

    // Calculation Section
    md += `## ${data.calculationSection.title}\n\n`;
    md += `| Schritt | Beschreibung | Betrag |\n`;
    md += `|---------|--------------|--------|\n`;
    data.calculationSection.steps.forEach((step) => {
      md += `| ${step.step} | ${step.description} | €${step.result.toLocaleString('de-AT')} |\n`;
    });
    md += `\n${data.calculationSection.explanation}\n\n`;
    md += `---\n\n`;

    // Documents Section
    md += `## ${data.documentsSection.title}\n\n`;
    md += `**Verarbeitete Belege:** ${data.documentsSection.totalDocuments}\n\n`;
    if (data.documentsSection.byCategory.length > 0) {
      md += `| Kategorie | Anzahl | Betrag |\n`;
      md += `|-----------|--------|--------|\n`;
      data.documentsSection.byCategory.forEach((cat) => {
        md += `| ${cat.category} | ${cat.count} | €${cat.amount.toLocaleString('de-AT')} |\n`;
      });
    }
    md += '\n---\n\n';

    // Recommendations
    md += `## ${data.recommendationsSection.title}\n\n`;
    if (data.recommendationsSection.shortTerm.length > 0) {
      md += `### Kurzfristig\n\n`;
      data.recommendationsSection.shortTerm.forEach((r) => {
        const emoji = r.priority === 'high' ? '🔴' : r.priority === 'medium' ? '🟡' : '🟢';
        md += `${emoji} **${r.title}**\n`;
        md += `${r.description}\n`;
        md += `*${r.impact}*\n\n`;
      });
    }
    if (data.recommendationsSection.warnings.length > 0) {
      md += `### ⚠️ Hinweise\n\n`;
      data.recommendationsSection.warnings.forEach((w) => {
        md += `- ${w}\n`;
      });
    }
    md += '\n---\n\n';

    // Footer
    md += `## Anhang\n\n`;
    md += `### Glossar\n\n`;
    data.appendix.glossary.forEach((g) => {
      md += `- **${g.term}:** ${g.definition}\n`;
    });
    md += '\n';

    md += `### Kontakt\n\n`;
    data.appendix.contactInfo.forEach((c) => {
      md += `- ${c.type}: ${c.value}\n`;
    });
    md += '\n';

    md += `---\n\n`;
    md += `*Dieser Bericht wurde von TaxLogic.local erstellt - 100% lokal & privat*\n`;

    return md;
  }

  /**
   * Generate FinanzOnline filing guide
   */
  async generateFilingGuide(input: ReportInput): Promise<PersonalizedGuide> {
    const guideInput: GuideGenerationInput = {
      userId: input.userId,
      taxYear: input.taxYear,
      formData: this.buildFormData(input),
      hasL1ab: input.profile.income.hasSelfEmployment,
      hasL1k: input.profile.family.children.length > 0,
      totalDeductions: input.calculation.effectiveDeductions,
      estimatedRefund: input.calculation.estimatedRefund,
      documentCount: input.documents.length
    };

    return guideGenerator.generateGuide(guideInput);
  }

  /**
   * Build form data from input
   */
  private buildFormData(input: ReportInput): L1FormData {
    const { profile, calculation } = input;

    return {
      sozialversicherungsnummer: 'XXXX XXXXXX',
      familienname: profile.personalInfo.name?.split(' ').pop() || 'Name',
      vorname: profile.personalInfo.name?.split(' ')[0] || 'Vorname',
      geburtsdatum: profile.personalInfo.birthDate || '01.01.1980',
      strasse: 'Adresse',
      hausnummer: '1',
      plz: '1010',
      ort: 'Wien',
      veranlagungsjahr: input.taxYear,
      bruttoeinkunfte: calculation.grossIncome,
      lohnsteuer: calculation.withheldTax,
      pendlerpauschale: calculation.breakdown.pendlerpauschale.amount || undefined,
      pendlerkilometer: profile.deductions.pendlerpauschale.distance || undefined,
      homeOfficePauschale: calculation.breakdown.homeOffice.amount || undefined,
      homeOfficeTage: calculation.breakdown.homeOffice.days || undefined,
      arbeitsmittel: calculation.breakdown.workEquipment.amount || undefined,
      fortbildungskosten: calculation.breakdown.education.amount || undefined,
      kirchenbeitrag: calculation.breakdown.churchTax.amount || undefined,
      spendenBeguenstigte: calculation.breakdown.donations.amount || undefined,
      krankheitskosten: calculation.breakdown.medicalExpenses.amount || undefined,
      kinderbetreuungskosten: calculation.breakdown.childcare.amount || undefined
    };
  }
}

// Singleton instance
export const reportWriterAgent = new ReportWriterAgent();
export default ReportWriterAgent;
