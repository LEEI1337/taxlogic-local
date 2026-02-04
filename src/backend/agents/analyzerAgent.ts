/**
 * TaxLogic.local - Analyzer Agent
 *
 * AI agent that performs tax calculations:
 * - Austrian tax law calculations
 * - Deduction optimization
 * - Refund estimation
 * - Tax-saving recommendations
 */

import { llmService, Message } from '../services/llmService';
import { ExpenseCategory } from '../services/documentOrganizer';

// ========================================
// Type Definitions
// ========================================

export interface TaxProfile {
  taxYear: number;
  personalInfo: PersonalInfo;
  income: IncomeInfo;
  deductions: DeductionInfo;
  family: FamilyInfo;
}

export interface PersonalInfo {
  name?: string;
  birthDate?: string;
  hasDisability: boolean;
  disabilityDegree?: number;
}

export interface IncomeInfo {
  grossIncome: number;
  withheldTax: number;
  employerCount: number;
  hasSelfEmployment: boolean;
  selfEmploymentIncome?: number;
}

export interface DeductionInfo {
  // Werbungskosten
  pendlerpauschale: PendlerInfo;
  homeOffice: HomeOfficeInfo;
  workEquipment: number;
  education: number;
  otherWerbungskosten: number;

  // Sonderausgaben
  churchTax: number;
  donations: number;
  insurance: number;

  // Außergewöhnliche Belastungen
  medicalExpenses: number;
  disabilityExpenses: number;
  childcareExpenses: number;
}

export interface PendlerInfo {
  distance: number;
  daysPerYear: number;
  publicTransportFeasible: boolean;
  monthlyTicketCost?: number;
}

export interface HomeOfficeInfo {
  days: number;
  equipmentCost: number;
}

export interface FamilyInfo {
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  singleEarner: boolean;
  singleParent: boolean;
  children: ChildInfo[];
}

export interface ChildInfo {
  birthDate: string;
  receivingFamilyAllowance: boolean;
  inHousehold: boolean;
}

export interface TaxCalculationResult {
  // Income
  grossIncome: number;
  taxableIncome: number;

  // Deductions Breakdown
  totalWerbungskosten: number;
  totalSonderausgaben: number;
  totalAussergewoehnlicheBelastungen: number;
  werbungskostenPauschale: number;
  effectiveDeductions: number;

  // Detailed Breakdown
  breakdown: DetailedBreakdown;

  // Tax Calculation
  calculatedTax: number;
  withheldTax: number;

  // Result
  estimatedRefund: number;
  estimatedBackpayment: number;

  // Absetzbeträge
  absetzbetraege: Absetzbetraege;

  // AI Analysis
  analysis: TaxAnalysis;

  // Metadata
  calculatedAt: string;
  taxYear: number;
}

export interface DetailedBreakdown {
  pendlerpauschale: { amount: number; type: 'klein' | 'gross' | 'none'; details: string };
  homeOffice: { amount: number; days: number; details: string };
  workEquipment: { amount: number; details: string };
  education: { amount: number; details: string };
  churchTax: { amount: number; details: string };
  donations: { amount: number; details: string };
  medicalExpenses: { amount: number; selfRetention: number; details: string };
  childcare: { amount: number; details: string };
}

export interface Absetzbetraege {
  verkehrsabsetzbetrag: number;
  arbeitnehmerabsetzbetrag: number;
  alleinverdienerabsetzbetrag: number;
  alleinerzieherabsetzbetrag: number;
  kinderabsetzbetrag: number;
  familienbonus: number;
  pensionistenabsetzbetrag: number;
}

export interface TaxAnalysis {
  summary: string;
  taxBracket: string;
  effectiveTaxRate: number;
  unusedPotential: number;
  recommendations: Recommendation[];
  warnings: string[];
}

export interface Recommendation {
  category: string;
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

// ========================================
// Austrian Tax Constants (2024)
// ========================================

const TAX_BRACKETS_2024 = [
  { min: 0, max: 11693, rate: 0 },
  { min: 11693, max: 19134, rate: 0.2 },
  { min: 19134, max: 32075, rate: 0.3 },
  { min: 32075, max: 62080, rate: 0.4 },
  { min: 62080, max: 93120, rate: 0.48 },
  { min: 93120, max: 1000000, rate: 0.5 },
  { min: 1000000, max: Infinity, rate: 0.55 }
];

const WERBUNGSKOSTEN_PAUSCHALE = 132;
const VERKEHRSABSETZBETRAG = 463;
const ARBEITNEHMERABSETZBETRAG = 0; // Integrated into tax brackets since 2020

const HOME_OFFICE_PER_DAY = 3;
const HOME_OFFICE_MAX = 300;
const HOME_OFFICE_MAX_DAYS = 100;

const CHURCH_TAX_MAX = 600;

const FAMILIENBONUS_PER_CHILD = 2000; // Full amount for children under 18
const FAMILIENBONUS_PER_CHILD_ADULT = 650; // For children 18+

// Pendlerpauschale tables (per year)
const PENDLERPAUSCHALE_KLEIN = [
  { minKm: 20, maxKm: 40, amount: 696 },
  { minKm: 40, maxKm: 60, amount: 1356 },
  { minKm: 60, maxKm: Infinity, amount: 2016 }
];

const PENDLERPAUSCHALE_GROSS = [
  { minKm: 2, maxKm: 20, amount: 372 },
  { minKm: 20, maxKm: 40, amount: 1476 },
  { minKm: 40, maxKm: 60, amount: 2568 },
  { minKm: 60, maxKm: Infinity, amount: 3672 }
];

// ========================================
// Analyzer Agent Class
// ========================================

export class AnalyzerAgent {
  /**
   * Perform complete tax calculation
   */
  async calculateTax(profile: TaxProfile): Promise<TaxCalculationResult> {
    console.log('[Analyzer] Calculating tax for year', profile.taxYear);

    // Calculate all deductions
    const breakdown = this.calculateBreakdown(profile);
    const absetzbetraege = this.calculateAbsetzbetraege(profile);

    // Sum up deductions
    const totalWerbungskosten =
      breakdown.pendlerpauschale.amount +
      breakdown.homeOffice.amount +
      breakdown.workEquipment.amount +
      breakdown.education.amount;

    const totalSonderausgaben = breakdown.churchTax.amount + breakdown.donations.amount;

    const totalAussergewoehnlicheBelastungen =
      breakdown.medicalExpenses.amount + breakdown.childcare.amount;

    // Use Werbungskosten or Pauschale (whichever is higher)
    const effectiveWerbungskosten = Math.max(totalWerbungskosten, WERBUNGSKOSTEN_PAUSCHALE);

    const effectiveDeductions =
      effectiveWerbungskosten + totalSonderausgaben + totalAussergewoehnlicheBelastungen;

    // Calculate taxable income
    const grossIncome = profile.income.grossIncome;
    const taxableIncome = Math.max(0, grossIncome - effectiveDeductions);

    // Calculate tax
    const calculatedTax = this.calculateProgressiveTax(taxableIncome);

    // Apply Absetzbeträge
    const totalAbsetzbetraege = Object.values(absetzbetraege).reduce((sum, val) => sum + val, 0);
    const taxAfterAbsetzbetraege = Math.max(0, calculatedTax - totalAbsetzbetraege);

    // Compare with withheld tax
    const withheldTax = profile.income.withheldTax;
    const difference = withheldTax - taxAfterAbsetzbetraege;

    const estimatedRefund = difference > 0 ? difference : 0;
    const estimatedBackpayment = difference < 0 ? Math.abs(difference) : 0;

    // Generate AI analysis
    const analysis = await this.generateAnalysis(profile, {
      grossIncome,
      taxableIncome,
      effectiveDeductions,
      totalWerbungskosten,
      calculatedTax,
      estimatedRefund
    });

    return {
      grossIncome,
      taxableIncome,
      totalWerbungskosten,
      totalSonderausgaben,
      totalAussergewoehnlicheBelastungen,
      werbungskostenPauschale: WERBUNGSKOSTEN_PAUSCHALE,
      effectiveDeductions,
      breakdown,
      calculatedTax: taxAfterAbsetzbetraege,
      withheldTax,
      estimatedRefund: Math.round(estimatedRefund * 100) / 100,
      estimatedBackpayment: Math.round(estimatedBackpayment * 100) / 100,
      absetzbetraege,
      analysis,
      calculatedAt: new Date().toISOString(),
      taxYear: profile.taxYear
    };
  }

  /**
   * Calculate detailed breakdown of all deductions
   */
  private calculateBreakdown(profile: TaxProfile): DetailedBreakdown {
    const { deductions } = profile;

    // Pendlerpauschale
    const pendler = this.calculatePendlerpauschale(deductions.pendlerpauschale);

    // Home Office
    const homeOfficeDays = Math.min(deductions.homeOffice.days, HOME_OFFICE_MAX_DAYS);
    const homeOfficeAmount = Math.min(homeOfficeDays * HOME_OFFICE_PER_DAY, HOME_OFFICE_MAX);

    // Church Tax (max €600)
    const churchTaxAmount = Math.min(deductions.churchTax, CHURCH_TAX_MAX);

    // Donations (no cap, but must be to approved organizations)
    const donationsAmount = deductions.donations;

    // Medical expenses (with self-retention calculation)
    const medicalResult = this.calculateMedicalExpenses(
      deductions.medicalExpenses,
      profile.income.grossIncome
    );

    // Childcare (max €2300 per child under 10)
    const childcareMax = profile.family.children.filter(
      (c) => this.getAge(c.birthDate) < 10
    ).length * 2300;
    const childcareAmount = Math.min(deductions.childcareExpenses, childcareMax);

    return {
      pendlerpauschale: {
        amount: pendler.amount,
        type: pendler.type,
        details: pendler.details
      },
      homeOffice: {
        amount: homeOfficeAmount,
        days: homeOfficeDays,
        details: `${homeOfficeDays} Tage x €${HOME_OFFICE_PER_DAY} = €${homeOfficeAmount}`
      },
      workEquipment: {
        amount: deductions.workEquipment,
        details: 'Arbeitsmittel (Computer, Software, etc.)'
      },
      education: {
        amount: deductions.education,
        details: 'Aus- und Fortbildungskosten'
      },
      churchTax: {
        amount: churchTaxAmount,
        details: churchTaxAmount < deductions.churchTax
          ? `Gekappt auf €${CHURCH_TAX_MAX} (Höchstbetrag)`
          : 'Vollständig absetzbar'
      },
      donations: {
        amount: donationsAmount,
        details: 'Spenden an begünstigte Organisationen'
      },
      medicalExpenses: {
        amount: medicalResult.deductible,
        selfRetention: medicalResult.selfRetention,
        details: medicalResult.details
      },
      childcare: {
        amount: childcareAmount,
        details: `Kinderbetreuung (max €2.300 pro Kind unter 10)`
      }
    };
  }

  /**
   * Calculate Pendlerpauschale
   */
  private calculatePendlerpauschale(info: PendlerInfo): {
    amount: number;
    type: 'klein' | 'gross' | 'none';
    details: string;
  } {
    if (info.distance < 2) {
      return { amount: 0, type: 'none', details: 'Entfernung unter 2 km' };
    }

    const table = info.publicTransportFeasible ? PENDLERPAUSCHALE_KLEIN : PENDLERPAUSCHALE_GROSS;
    const type = info.publicTransportFeasible ? 'klein' : 'gross';

    // Find matching bracket
    for (const bracket of table) {
      if (info.distance >= bracket.minKm && info.distance < bracket.maxKm) {
        // Pro-rate for days worked (assuming 220 work days)
        const workDays = Math.min(info.daysPerYear, 220);
        const proRatedAmount = Math.round((bracket.amount * workDays) / 220);

        return {
          amount: proRatedAmount,
          type: type as 'klein' | 'gross',
          details: `${type === 'klein' ? 'Kleine' : 'Große'} Pendlerpauschale für ${info.distance} km (${workDays} Arbeitstage)`
        };
      }
    }

    return { amount: 0, type: 'none', details: 'Keine Pendlerpauschale anwendbar' };
  }

  /**
   * Calculate medical expenses deduction
   */
  private calculateMedicalExpenses(
    expenses: number,
    grossIncome: number
  ): { deductible: number; selfRetention: number; details: string } {
    // Self-retention is a percentage of income (simplified calculation)
    // Actually depends on family situation, but we use a simplified rate
    const selfRetentionRate = 0.06; // 6% simplified
    const selfRetention = grossIncome * selfRetentionRate;

    const deductible = Math.max(0, expenses - selfRetention);

    return {
      deductible,
      selfRetention,
      details: `Selbstbehalt: €${Math.round(selfRetention)} (${selfRetentionRate * 100}% vom Einkommen). Absetzbar: €${Math.round(deductible)}`
    };
  }

  /**
   * Calculate Absetzbeträge (tax credits)
   */
  private calculateAbsetzbetraege(profile: TaxProfile): Absetzbetraege {
    const absetzbetraege: Absetzbetraege = {
      verkehrsabsetzbetrag: VERKEHRSABSETZBETRAG,
      arbeitnehmerabsetzbetrag: 0,
      alleinverdienerabsetzbetrag: 0,
      alleinerzieherabsetzbetrag: 0,
      kinderabsetzbetrag: 0,
      familienbonus: 0,
      pensionistenabsetzbetrag: 0
    };

    // Alleinverdienerabsetzbetrag
    if (profile.family.singleEarner && profile.family.children.length > 0) {
      absetzbetraege.alleinverdienerabsetzbetrag = 494; // + €175 per child
      absetzbetraege.alleinverdienerabsetzbetrag += profile.family.children.length * 175;
    }

    // Alleinerzieherabsetzbetrag
    if (profile.family.singleParent && profile.family.children.length > 0) {
      absetzbetraege.alleinerzieherabsetzbetrag = 494; // + €175 per child
      absetzbetraege.alleinerzieherabsetzbetrag += profile.family.children.length * 175;
    }

    // Familienbonus Plus
    for (const child of profile.family.children) {
      if (child.receivingFamilyAllowance) {
        const age = this.getAge(child.birthDate);
        if (age < 18) {
          absetzbetraege.familienbonus += FAMILIENBONUS_PER_CHILD;
        } else if (age < 24) {
          absetzbetraege.familienbonus += FAMILIENBONUS_PER_CHILD_ADULT;
        }
      }
    }

    return absetzbetraege;
  }

  /**
   * Calculate progressive tax
   */
  private calculateProgressiveTax(taxableIncome: number): number {
    let tax = 0;
    let remainingIncome = taxableIncome;

    for (const bracket of TAX_BRACKETS_2024) {
      if (remainingIncome <= 0) break;

      const bracketRange = bracket.max - bracket.min;
      const incomeInBracket = Math.min(remainingIncome, bracketRange);

      tax += incomeInBracket * bracket.rate;
      remainingIncome -= incomeInBracket;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Generate AI-powered analysis and recommendations
   */
  private async generateAnalysis(
    profile: TaxProfile,
    calculation: {
      grossIncome: number;
      taxableIncome: number;
      effectiveDeductions: number;
      totalWerbungskosten: number;
      calculatedTax: number;
      estimatedRefund: number;
    }
  ): Promise<TaxAnalysis> {
    // Determine tax bracket
    const taxBracket = this.getTaxBracket(calculation.taxableIncome);
    const effectiveTaxRate =
      calculation.grossIncome > 0
        ? (calculation.calculatedTax / calculation.grossIncome) * 100
        : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(profile, calculation);

    // Calculate unused potential (simplified)
    const unusedPotential = this.calculateUnusedPotential(profile, calculation);

    try {
      // AI-enhanced summary
      const systemPrompt = `Du bist ein österreichischer Steuerberater-Assistent.
Erstelle eine kurze Zusammenfassung der Steuerberechnung.
Sei präzise und hilfsbereit. Antworte auf Deutsch.`;

      const userPrompt = `Steuerberechnung ${profile.taxYear}:
- Bruttoeinkommen: €${calculation.grossIncome}
- Abzüge: €${calculation.effectiveDeductions}
- Geschätzte Rückerstattung: €${calculation.estimatedRefund}

Erstelle eine 2-3 Sätze Zusammenfassung.`;

      const response = await llmService.query(userPrompt, [], systemPrompt);

      return {
        summary: response.content,
        taxBracket,
        effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
        unusedPotential,
        recommendations,
        warnings: this.generateWarnings(profile, calculation)
      };
    } catch {
      // Fallback summary
      return {
        summary: `Bei einem Bruttoeinkommen von €${calculation.grossIncome.toLocaleString('de-AT')} und Abzügen von €${calculation.effectiveDeductions.toLocaleString('de-AT')} ergibt sich eine geschätzte Rückerstattung von €${calculation.estimatedRefund.toLocaleString('de-AT')}.`,
        taxBracket,
        effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
        unusedPotential,
        recommendations,
        warnings: this.generateWarnings(profile, calculation)
      };
    }
  }

  /**
   * Get tax bracket description
   */
  private getTaxBracket(taxableIncome: number): string {
    for (const bracket of TAX_BRACKETS_2024) {
      if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
        return `${bracket.rate * 100}% Grenzsteuersatz (€${bracket.min.toLocaleString('de-AT')} - €${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString('de-AT')})`;
      }
    }
    return 'Unbekannt';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    profile: TaxProfile,
    calculation: { totalWerbungskosten: number; grossIncome: number }
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check if using Pauschale
    if (calculation.totalWerbungskosten < WERBUNGSKOSTEN_PAUSCHALE) {
      recommendations.push({
        category: 'Werbungskosten',
        title: 'Werbungskosten erhöhen',
        description: `Ihre Werbungskosten (€${calculation.totalWerbungskosten}) liegen unter der Pauschale von €${WERBUNGSKOSTEN_PAUSCHALE}. Sammeln Sie mehr Belege für berufliche Ausgaben.`,
        potentialSavings: (WERBUNGSKOSTEN_PAUSCHALE - calculation.totalWerbungskosten) * 0.4,
        priority: 'high'
      });
    }

    // Home Office
    if (profile.deductions.homeOffice.days < 100) {
      const additionalDays = 100 - profile.deductions.homeOffice.days;
      recommendations.push({
        category: 'Home Office',
        title: 'Home Office Tage prüfen',
        description: `Sie haben ${profile.deductions.homeOffice.days} Home Office Tage angegeben. Falls Sie mehr hatten, können Sie bis zu ${additionalDays} weitere Tage geltend machen.`,
        potentialSavings: additionalDays * HOME_OFFICE_PER_DAY * 0.4,
        priority: 'medium'
      });
    }

    // Pendlerpauschale
    if (profile.deductions.pendlerpauschale.distance > 0 && profile.deductions.pendlerpauschale.publicTransportFeasible) {
      recommendations.push({
        category: 'Pendlerpauschale',
        title: 'Große Pendlerpauschale prüfen',
        description: 'Wenn öffentliche Verkehrsmittel unzumutbar sind (z.B. Fahrtzeit > 2,5 Std.), können Sie die höhere große Pendlerpauschale beantragen.',
        potentialSavings: 500,
        priority: 'medium'
      });
    }

    // Donations
    if (profile.deductions.donations === 0) {
      recommendations.push({
        category: 'Sonderausgaben',
        title: 'Spenden absetzbar',
        description: 'Spenden an begünstigte Organisationen sind bis zu 10% des Einkommens absetzbar.',
        potentialSavings: 0,
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Calculate unused deduction potential
   */
  private calculateUnusedPotential(
    profile: TaxProfile,
    calculation: { totalWerbungskosten: number }
  ): number {
    let potential = 0;

    // Unused Home Office
    if (profile.deductions.homeOffice.days < 100) {
      potential += (100 - profile.deductions.homeOffice.days) * HOME_OFFICE_PER_DAY;
    }

    // Unused Werbungskosten potential (if below average)
    const averageWerbungskosten = 2000; // Assumed average
    if (calculation.totalWerbungskosten < averageWerbungskosten) {
      potential += averageWerbungskosten - calculation.totalWerbungskosten;
    }

    return potential;
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    profile: TaxProfile,
    calculation: { grossIncome: number; estimatedRefund: number }
  ): string[] {
    const warnings: string[] = [];

    if (profile.income.employerCount > 1) {
      warnings.push(
        'Bei mehreren Arbeitgebern ist die Arbeitnehmerveranlagung meist verpflichtend.'
      );
    }

    if (calculation.estimatedRefund > 5000) {
      warnings.push(
        'Hohe geschätzte Rückerstattung - bitte prüfen Sie alle Angaben sorgfältig.'
      );
    }

    if (profile.deductions.medicalExpenses > profile.income.grossIncome * 0.1) {
      warnings.push(
        'Hohe Krankheitskosten - bewahren Sie alle Belege für eine eventuelle Prüfung auf.'
      );
    }

    return warnings;
  }

  /**
   * Helper: Calculate age from birth date
   */
  private getAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

// Singleton instance
export const analyzerAgent = new AnalyzerAgent();
export default AnalyzerAgent;
