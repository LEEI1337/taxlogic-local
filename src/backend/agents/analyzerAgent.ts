/**
 * TaxLogic.local - Analyzer Agent
 *
 * AI agent that performs tax calculations:
 * - Austrian tax law calculations
 * - Deduction optimization
 * - Refund estimation
 * - Tax-saving recommendations
 */

import { llmService } from '../services/llmService';
import { getTaxRulesForYear, TaxRulePack, TieredFamilyCredit } from '../taxRules';

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

  // Aussergewoehnliche Belastungen
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
  ownIncome?: number;
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

  // Absetzbetraege
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
// Analyzer Agent Class
// ========================================

export class AnalyzerAgent {
  /**
   * Perform complete tax calculation
   */
  async calculateTax(profile: TaxProfile): Promise<TaxCalculationResult> {
    const rules = getTaxRulesForYear(profile.taxYear);

    // Calculate all deductions
    const breakdown = this.calculateBreakdown(profile, rules);
    const absetzbetraege = this.calculateAbsetzbetraege(profile, rules);

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
    const effectiveWerbungskosten = Math.max(
      totalWerbungskosten,
      rules.credits.werbungskostenPauschale
    );

    const effectiveDeductions =
      effectiveWerbungskosten + totalSonderausgaben + totalAussergewoehnlicheBelastungen;

    // Calculate taxable income
    const grossIncome = profile.income.grossIncome;
    const taxableIncome = Math.max(0, grossIncome - effectiveDeductions);

    // Calculate tax
    const calculatedTax = this.calculateProgressiveTax(taxableIncome, rules);

    // Apply Absetzbetraege
    const totalAbsetzbetraege = Object.values(absetzbetraege).reduce((sum, val) => sum + val, 0);
    const taxAfterAbsetzbetraege = Math.max(0, calculatedTax - totalAbsetzbetraege);

    // Compare with withheld tax
    const withheldTax = profile.income.withheldTax;
    const difference = withheldTax - taxAfterAbsetzbetraege;

    const estimatedRefund = difference > 0 ? difference : 0;
    const estimatedBackpayment = difference < 0 ? Math.abs(difference) : 0;

    // Generate AI analysis
    const analysis = await this.generateAnalysis(
      profile,
      {
        grossIncome,
        taxableIncome,
        effectiveDeductions,
        totalWerbungskosten,
        calculatedTax,
        estimatedRefund
      },
      rules
    );

    return {
      grossIncome,
      taxableIncome,
      totalWerbungskosten,
      totalSonderausgaben,
      totalAussergewoehnlicheBelastungen,
      werbungskostenPauschale: rules.credits.werbungskostenPauschale,
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
  private calculateBreakdown(profile: TaxProfile, rules: TaxRulePack): DetailedBreakdown {
    const { deductions } = profile;

    // Pendlerpauschale
    const pendler = this.calculatePendlerpauschale(deductions.pendlerpauschale, rules);

    // Home Office
    const homeOfficeDays = Math.min(deductions.homeOffice.days, rules.homeOffice.maxDays);
    const homeOfficeAmount = Math.min(
      homeOfficeDays * rules.homeOffice.perDay,
      rules.homeOffice.maxAmount
    );

    // Church Tax
    const churchTaxAmount = Math.min(deductions.churchTax, rules.credits.churchTaxMax);

    // Donations (no cap, but must be to approved organizations)
    const donationsAmount = deductions.donations;

    // Medical expenses (with self-retention calculation based on family situation)
    const medicalResult = this.calculateMedicalExpenses(
      deductions.medicalExpenses,
      profile.income.grossIncome,
      profile,
      rules
    );

    // Childcare
    let childcareMax = 0;
    const referenceDate = new Date(profile.taxYear, 11, 31);
    for (const child of profile.family.children) {
      if (this.getAge(child.birthDate, referenceDate) < rules.childcare.maxAge) {
        childcareMax += child.inHousehold
          ? rules.childcare.maxPerChild
          : Math.round(rules.childcare.maxPerChild * rules.childcare.sharedCustodyFactor);
      }
    }
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
        details: `${homeOfficeDays} Tage x EUR ${rules.homeOffice.perDay} = EUR ${homeOfficeAmount}`
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
          ? `Gekappt auf EUR ${rules.credits.churchTaxMax} (Hoechstbetrag)`
          : 'Vollstaendig absetzbar'
      },
      donations: {
        amount: donationsAmount,
        details: 'Spenden an beguenstigte Organisationen'
      },
      medicalExpenses: {
        amount: medicalResult.deductible,
        selfRetention: medicalResult.selfRetention,
        details: medicalResult.details
      },
      childcare: {
        amount: childcareAmount,
        details: `Kinderbetreuung (max EUR ${rules.childcare.maxPerChild} pro Kind unter ${rules.childcare.maxAge})`
      }
    };
  }

  /**
   * Calculate Pendlerpauschale
   */
  private calculatePendlerpauschale(
    info: PendlerInfo,
    rules: TaxRulePack
  ): {
    amount: number;
    type: 'klein' | 'gross' | 'none';
    details: string;
  } {
    if (info.distance < 2) {
      return { amount: 0, type: 'none', details: 'Entfernung unter 2 km' };
    }

    const table = info.publicTransportFeasible
      ? rules.pendlerpauschale.klein
      : rules.pendlerpauschale.gross;
    const type = info.publicTransportFeasible ? 'klein' : 'gross';

    // Find matching bracket
    for (const bracket of table) {
      const maxKm = bracket.maxKm ?? Infinity;
      if (info.distance >= bracket.minKm && info.distance < maxKm) {
        // Pro-rate for days worked (assuming 220 work days)
        const workDays = Math.min(info.daysPerYear, 220);
        const proRatedAmount = Math.round((bracket.amount * workDays) / 220);

        return {
          amount: proRatedAmount,
          type,
          details: `${type === 'klein' ? 'Kleine' : 'Grosse'} Pendlerpauschale fuer ${info.distance} km (${workDays} Arbeitstage)`
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
    grossIncome: number,
    profile: TaxProfile | undefined,
    rules: TaxRulePack
  ): { deductible: number; selfRetention: number; details: string } {
    let selfRetentionRate = rules.medical.defaultSelfRetentionRate;

    if (profile) {
      if (profile.personalInfo.hasDisability) {
        selfRetentionRate = rules.medical.disabilityRate;
      } else {
        const childCount = profile.family.children.length;
        const isAlleinverdienerOrAlleinerzieher =
          profile.family.singleEarner || profile.family.singleParent;

        if (isAlleinverdienerOrAlleinerzieher) {
          if (childCount >= 3) {
            selfRetentionRate = rules.medical.singleWithThreeOrMoreChildrenRate;
          } else if (childCount === 2) {
            selfRetentionRate = rules.medical.singleWithTwoChildrenRate;
          }
        } else if (childCount > 3) {
          selfRetentionRate = rules.medical.manyChildrenSelfRetentionRate;
        }
      }
    }

    const selfRetention = grossIncome * selfRetentionRate;
    const deductible = Math.max(0, expenses - selfRetention);

    const rateLabel = selfRetentionRate === 0
      ? 'Kein Selbstbehalt (Behinderung)'
      : `Selbstbehalt: EUR ${Math.round(selfRetention)} (${(selfRetentionRate * 100).toFixed(2)}% vom Einkommen)`;

    return {
      deductible,
      selfRetention,
      details: `${rateLabel}. Absetzbar: EUR ${Math.round(deductible)}`
    };
  }

  /**
   * Calculate Absetzbetraege (tax credits)
   */
  private calculateAbsetzbetraege(profile: TaxProfile, rules: TaxRulePack): Absetzbetraege {
    const absetzbetraege: Absetzbetraege = {
      verkehrsabsetzbetrag: rules.credits.verkehrsabsetzbetrag,
      arbeitnehmerabsetzbetrag: rules.credits.arbeitnehmerabsetzbetrag,
      alleinverdienerabsetzbetrag: 0,
      alleinerzieherabsetzbetrag: 0,
      kinderabsetzbetrag: 0,
      familienbonus: 0,
      pensionistenabsetzbetrag: 0
    };

    // Alleinverdienerabsetzbetrag
    if (profile.family.singleEarner && profile.family.children.length > 0) {
      absetzbetraege.alleinverdienerabsetzbetrag = this.calculateTieredFamilyCredit(
        profile.family.children.length,
        rules.credits.alleinverdiener
      );
    }

    // Alleinerzieherabsetzbetrag
    if (profile.family.singleParent && profile.family.children.length > 0) {
      absetzbetraege.alleinerzieherabsetzbetrag = this.calculateTieredFamilyCredit(
        profile.family.children.length,
        rules.credits.alleinerzieher
      );
    }

    // Familienbonus Plus
    const referenceDate = new Date(profile.taxYear, 11, 31);
    for (const child of profile.family.children) {
      if (!child.receivingFamilyAllowance) {
        continue;
      }

      const age = this.getAge(child.birthDate, referenceDate);
      if (age < 18) {
        absetzbetraege.familienbonus += rules.credits.familienbonusPerChild;
      } else if (age < 24) {
        absetzbetraege.familienbonus += rules.credits.familienbonusPerChildAdult;
      }
    }

    return absetzbetraege;
  }

  /**
   * Calculate progressive tax
   */
  private calculateProgressiveTax(taxableIncome: number, rules: TaxRulePack): number {
    let tax = 0;
    let remainingIncome = taxableIncome;

    for (const bracket of rules.taxBrackets) {
      if (remainingIncome <= 0) {
        break;
      }

      const max = bracket.max ?? Infinity;
      const bracketRange = max - bracket.min;
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
    },
    rules: TaxRulePack
  ): Promise<TaxAnalysis> {
    // Determine tax bracket
    const taxBracket = this.getTaxBracket(calculation.taxableIncome, rules);
    const effectiveTaxRate =
      calculation.grossIncome > 0
        ? (calculation.calculatedTax / calculation.grossIncome) * 100
        : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(profile, calculation, rules);

    // Calculate unused potential (simplified)
    const unusedPotential = this.calculateUnusedPotential(profile, calculation, rules);

    try {
      // AI-enhanced summary
      const systemPrompt = `Du bist ein oesterreichischer Steuerberater-Assistent.
Erstelle eine kurze Zusammenfassung der Steuerberechnung.
Sei praezise und hilfsbereit. Antworte auf Deutsch.`;

      const userPrompt = `Steuerberechnung ${profile.taxYear}:
- Bruttoeinkommen: EUR ${calculation.grossIncome}
- Abzuege: EUR ${calculation.effectiveDeductions}
- Geschaetzte Rueckerstattung: EUR ${calculation.estimatedRefund}

Erstelle eine 2-3 Saetze Zusammenfassung.`;

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
        summary: `Bei einem Bruttoeinkommen von EUR ${calculation.grossIncome.toLocaleString('de-AT')} und Abzuegen von EUR ${calculation.effectiveDeductions.toLocaleString('de-AT')} ergibt sich eine geschaetzte Rueckerstattung von EUR ${calculation.estimatedRefund.toLocaleString('de-AT')}.`,
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
  private getTaxBracket(taxableIncome: number, rules: TaxRulePack): string {
    for (const bracket of rules.taxBrackets) {
      const max = bracket.max ?? Infinity;
      if (taxableIncome >= bracket.min && taxableIncome < max) {
        const upperLabel = max === Infinity ? 'infinity' : max.toLocaleString('de-AT');
        return `${bracket.rate * 100}% Grenzsteuersatz (EUR ${bracket.min.toLocaleString('de-AT')} - EUR ${upperLabel})`;
      }
    }
    return 'Unbekannt';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    profile: TaxProfile,
    calculation: { totalWerbungskosten: number; grossIncome: number },
    rules: TaxRulePack
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check if using Pauschale
    if (calculation.totalWerbungskosten < rules.credits.werbungskostenPauschale) {
      recommendations.push({
        category: 'Werbungskosten',
        title: 'Werbungskosten erhoehen',
        description: `Ihre Werbungskosten (EUR ${calculation.totalWerbungskosten}) liegen unter der Pauschale von EUR ${rules.credits.werbungskostenPauschale}. Sammeln Sie mehr Belege fuer berufliche Ausgaben.`,
        potentialSavings: (rules.credits.werbungskostenPauschale - calculation.totalWerbungskosten) * 0.4,
        priority: 'high'
      });
    }

    // Home Office
    if (profile.deductions.homeOffice.days < rules.homeOffice.maxDays) {
      const additionalDays = rules.homeOffice.maxDays - profile.deductions.homeOffice.days;
      recommendations.push({
        category: 'Home Office',
        title: 'Home Office Tage pruefen',
        description: `Sie haben ${profile.deductions.homeOffice.days} Home Office Tage angegeben. Falls Sie mehr hatten, koennen Sie bis zu ${additionalDays} weitere Tage geltend machen.`,
        potentialSavings: additionalDays * rules.homeOffice.perDay * 0.4,
        priority: 'medium'
      });
    }

    // Pendlerpauschale
    if (
      profile.deductions.pendlerpauschale.distance > 0 &&
      profile.deductions.pendlerpauschale.publicTransportFeasible
    ) {
      recommendations.push({
        category: 'Pendlerpauschale',
        title: 'Grosse Pendlerpauschale pruefen',
        description: 'Wenn oeffentliche Verkehrsmittel unzumutbar sind (z.B. Fahrtzeit > 2,5 Std.), koennen Sie die hoehere grosse Pendlerpauschale beantragen.',
        potentialSavings: 500,
        priority: 'medium'
      });
    }

    // Donations
    if (profile.deductions.donations === 0) {
      recommendations.push({
        category: 'Sonderausgaben',
        title: 'Spenden absetzbar',
        description: 'Spenden an beguenstigte Organisationen sind bis zu 10% des Einkommens absetzbar.',
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
    calculation: { totalWerbungskosten: number },
    rules: TaxRulePack
  ): number {
    let potential = 0;

    // Unused Home Office
    if (profile.deductions.homeOffice.days < rules.homeOffice.maxDays) {
      potential +=
        (rules.homeOffice.maxDays - profile.deductions.homeOffice.days) * rules.homeOffice.perDay;
    }

    // Check if basic deduction categories are underutilized
    // (no assumed averages - only check if common deductions are at zero)
    if (calculation.totalWerbungskosten === 0) {
      potential += 500;
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
        'Hohe geschaetzte Rueckerstattung - bitte pruefen Sie alle Angaben sorgfaeltig.'
      );
    }

    if (profile.deductions.medicalExpenses > profile.income.grossIncome * 0.1) {
      warnings.push(
        'Hohe Krankheitskosten - bewahren Sie alle Belege fuer eine eventuelle Pruefung auf.'
      );
    }

    return warnings;
  }

  private calculateTieredFamilyCredit(childCount: number, credit: TieredFamilyCredit): number {
    if (childCount <= 0) {
      return 0;
    }

    let total = credit.firstChild;
    if (childCount >= 2) {
      total += credit.secondChildIncrement;
    }
    if (childCount >= 3) {
      total += (childCount - 2) * credit.additionalChildIncrement;
    }

    return total;
  }

  /**
   * Helper: Calculate age from birth date
   */
  private getAge(birthDate: string, atDate: Date = new Date()): number {
    const birth = new Date(birthDate);
    let age = atDate.getFullYear() - birth.getFullYear();
    const monthDiff = atDate.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

// Singleton instance
export const analyzerAgent = new AnalyzerAgent();
export default AnalyzerAgent;
