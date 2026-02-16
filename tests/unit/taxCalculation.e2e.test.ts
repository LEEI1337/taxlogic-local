/**
 * TaxLogic.local - Echte End-to-End Steuerberechnungstests
 *
 * Realistische Szenarien mit handgerechneten Erwartungswerten.
 * Basierend auf österreichischem Steuerrecht 2024 (EStG).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzerAgent, TaxProfile, TaxCalculationResult } from '../../src/backend/agents/analyzerAgent';
import { getTaxRulesForYear } from '../../src/backend/taxRules';

// Mock the LLM service (AI analysis is not the subject of these tests)
vi.mock('../../src/backend/services/llmService', () => ({
  llmService: {
    query: vi.fn().mockResolvedValue({
      content: 'Test-Analyse',
      provider: 'ollama',
      model: 'mistral'
    })
  }
}));

describe('E2E Steuerberechnung - Realistische Szenarien', () => {
  let agent: AnalyzerAgent;
  const rules2024 = getTaxRulesForYear(2024);

  beforeEach(() => {
    agent = new AnalyzerAgent();
    vi.clearAllMocks();
  });

  // Helper to create a full profile
  const makeProfile = (overrides: Partial<TaxProfile> = {}): TaxProfile => ({
    taxYear: 2024,
    personalInfo: {
      name: 'Test Person',
      birthDate: '1985-06-01',
      hasDisability: false
    },
    income: {
      grossIncome: 35000,
      withheldTax: 5000,
      employerCount: 1,
      hasSelfEmployment: false
    },
    deductions: {
      pendlerpauschale: { distance: 0, daysPerYear: 220, publicTransportFeasible: true },
      homeOffice: { days: 0, equipmentCost: 0 },
      workEquipment: 0,
      education: 0,
      otherWerbungskosten: 0,
      churchTax: 0,
      donations: 0,
      insurance: 0,
      medicalExpenses: 0,
      disabilityExpenses: 0,
      childcareExpenses: 0
    },
    family: {
      maritalStatus: 'single',
      singleEarner: false,
      singleParent: false,
      children: []
    },
    ...overrides
  });

  // ==========================================
  // Helper: Manual progressive tax calculation
  // ==========================================

  function manualProgressiveTax(taxableIncome: number): number {
    const brackets = rules2024.taxBrackets.map((bracket) => ({
      min: bracket.min,
      max: bracket.max ?? Infinity,
      rate: bracket.rate
    }));

    let tax = 0;
    let remaining = taxableIncome;
    for (const b of brackets) {
      if (remaining <= 0) break;
      const range = b.max - b.min;
      const inBracket = Math.min(remaining, range);
      tax += inBracket * b.rate;
      remaining -= inBracket;
    }
    return tax;
  }

  function tieredFamilyCredit(
    childCount: number,
    tier: { firstChild: number; secondChildIncrement: number; additionalChildIncrement: number }
  ): number {
    if (childCount <= 0) {
      return 0;
    }

    let total = tier.firstChild;
    if (childCount >= 2) {
      total += tier.secondChildIncrement;
    }
    if (childCount >= 3) {
      total += (childCount - 2) * tier.additionalChildIncrement;
    }
    return total;
  }

  // ==========================================
  // Szenario 1: Angestellter, Einkommen €35.000, keine Absetzbeträge
  // ==========================================

  describe('Szenario 1: Einfacher Angestellter - €35.000 Brutto', () => {
    let result: TaxCalculationResult;

    it('should compute correct values', async () => {
      const profile = makeProfile();
      result = await agent.calculateTax(profile);

      const expectedTaxableIncome = 35000 - rules2024.credits.werbungskostenPauschale;
      expect(result.taxableIncome).toBe(expectedTaxableIncome);

      // Progressive tax on €34,868
      const expectedTax = manualProgressiveTax(expectedTaxableIncome);

      const expectedTaxAfterCredits = Math.max(
        0,
        expectedTax - rules2024.credits.verkehrsabsetzbetrag - rules2024.credits.arbeitnehmerabsetzbetrag
      );
      expect(result.calculatedTax).toBeCloseTo(expectedTaxAfterCredits, 0);

      // Refund = withheldTax - calculatedTax
      const expectedRefund = Math.max(0, 5000 - expectedTaxAfterCredits);
      expect(result.estimatedRefund).toBeCloseTo(expectedRefund, 0);
    });

    it('should use the configured Werbungskostenpauschale as minimum', async () => {
      const profile = makeProfile();
      result = await agent.calculateTax(profile);
      expect(result.werbungskostenPauschale).toBe(rules2024.credits.werbungskostenPauschale);
      expect(result.effectiveDeductions).toBe(rules2024.credits.werbungskostenPauschale);
    });
  });

  // ==========================================
  // Szenario 2: Angestellter mit Pendlerpauschale (25 km, kein ÖV)
  // ==========================================

  describe('Szenario 2: Pendler - 25 km, große Pendlerpauschale', () => {
    it('should apply große Pendlerpauschale correctly', async () => {
      const profile = makeProfile({
        income: { grossIncome: 40000, withheldTax: 7000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 25, daysPerYear: 220, publicTransportFeasible: false },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Große Pendlerpauschale 20-40 km = €1.476/Jahr (at 220 days = full amount)
      expect(result.breakdown.pendlerpauschale.type).toBe('gross');
      expect(result.breakdown.pendlerpauschale.amount).toBe(1476);

      // Werbungskosten = 1476 > 132 Pauschale, so effective = 1476
      expect(result.totalWerbungskosten).toBe(1476);
      expect(result.effectiveDeductions).toBe(1476);

      // Taxable income = 40000 - 1476 = 38524
      expect(result.taxableIncome).toBe(40000 - 1476);
    });
  });

  // ==========================================
  // Szenario 3: Kleine Pendlerpauschale (30 km, ÖV möglich)
  // ==========================================

  describe('Szenario 3: Pendler - 30 km, kleine Pendlerpauschale', () => {
    it('should apply kleine Pendlerpauschale correctly', async () => {
      const profile = makeProfile({
        deductions: {
          pendlerpauschale: { distance: 30, daysPerYear: 220, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Kleine Pendlerpauschale 20-40 km = €696/Jahr
      expect(result.breakdown.pendlerpauschale.type).toBe('klein');
      expect(result.breakdown.pendlerpauschale.amount).toBe(696);
    });
  });

  // ==========================================
  // Szenario 4: Alleinerziehend mit 2 Kindern + Familienbonus
  // ==========================================

  describe('Szenario 4: Alleinerziehend, 2 Kinder unter 18', () => {
    it('should calculate Alleinerzieherabsetzbetrag and Familienbonus', async () => {
      const profile = makeProfile({
        income: { grossIncome: 45000, withheldTax: 9000, employerCount: 1, hasSelfEmployment: false },
        family: {
          maritalStatus: 'single',
          singleEarner: false,
          singleParent: true,
          children: [
            { birthDate: '2015-03-10', receivingFamilyAllowance: true, inHousehold: true },
            { birthDate: '2018-07-20', receivingFamilyAllowance: true, inHousehold: true }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      const expectedAlleinerzieher = tieredFamilyCredit(2, rules2024.credits.alleinerzieher);
      expect(result.absetzbetraege.alleinerzieherabsetzbetrag).toBe(expectedAlleinerzieher);

      // Familienbonus: 2 children under 18 = 2 * €2000 = €4000
      expect(result.absetzbetraege.familienbonus).toBe(4000);

      expect(result.absetzbetraege.verkehrsabsetzbetrag).toBe(rules2024.credits.verkehrsabsetzbetrag);
      expect(result.absetzbetraege.arbeitnehmerabsetzbetrag).toBe(rules2024.credits.arbeitnehmerabsetzbetrag);

      const totalCredits =
        rules2024.credits.verkehrsabsetzbetrag +
        rules2024.credits.arbeitnehmerabsetzbetrag +
        expectedAlleinerzieher +
        (2 * rules2024.credits.familienbonusPerChild);

      const expectedTax = manualProgressiveTax(45000 - rules2024.credits.werbungskostenPauschale);

      // Tax after credits (can't go below 0)
      const expectedTaxAfterCredits = Math.max(0, expectedTax - totalCredits);
      expect(result.calculatedTax).toBeCloseTo(expectedTaxAfterCredits, 0);

      // Big refund expected since credits exceed tax
      expect(result.estimatedRefund).toBeCloseTo(Math.max(0, 9000 - expectedTaxAfterCredits), 0);
    });
  });

  // ==========================================
  // Szenario 5: Home Office + Fortbildung + Kirchenbeitrag
  // ==========================================

  describe('Szenario 5: Kombinierte Absetzbeträge - Home Office, Fortbildung, Kirchenbeitrag', () => {
    it('should calculate combined deductions correctly', async () => {
      const profile = makeProfile({
        income: { grossIncome: 50000, withheldTax: 10000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 80, equipmentCost: 0 },
          workEquipment: 500,
          education: 1200,
          otherWerbungskosten: 0,
          churchTax: 450,
          donations: 300,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Home Office: 80 * €3 = €240
      expect(result.breakdown.homeOffice.amount).toBe(240);
      expect(result.breakdown.homeOffice.days).toBe(80);

      // Kirchenbeitrag: €450 (under €600 cap)
      expect(result.breakdown.churchTax.amount).toBe(450);

      // Donations: €300
      expect(result.breakdown.donations.amount).toBe(300);

      // Werbungskosten: 240 + 500 + 1200 = 1940 (> 132 Pauschale)
      expect(result.totalWerbungskosten).toBe(240 + 500 + 1200);

      // Sonderausgaben: 450 + 300 = 750
      expect(result.totalSonderausgaben).toBe(750);

      // Total effective deductions: 1940 + 750 = 2690
      expect(result.effectiveDeductions).toBe(1940 + 750);

      // Taxable income
      expect(result.taxableIncome).toBe(50000 - 2690);
    });
  });

  // ==========================================
  // Szenario 6: Kirchenbeitrag über €600 Cap
  // ==========================================

  describe('Szenario 6: Kirchenbeitrag-Cap bei €600', () => {
    it('should cap church tax at €600', async () => {
      const profile = makeProfile({
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 850,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);
      expect(result.breakdown.churchTax.amount).toBe(600);
    });
  });

  // ==========================================
  // Szenario 7: Home Office - Max 100 Tage, Max €300
  // ==========================================

  describe('Szenario 7: Home Office Limits', () => {
    it('should cap home office at 100 days / €300', async () => {
      const profile = makeProfile({
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 150, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Capped at 100 days * €3 = €300
      expect(result.breakdown.homeOffice.days).toBe(100);
      expect(result.breakdown.homeOffice.amount).toBe(300);
    });
  });

  // ==========================================
  // Szenario 8: Medizinische Kosten mit Selbstbehalt
  // ==========================================

  describe('Szenario 8: Medizinische Kosten - Standard 6% Selbstbehalt', () => {
    it('should deduct medical expenses above 6% self-retention', async () => {
      const profile = makeProfile({
        income: { grossIncome: 40000, withheldTax: 7000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 5000,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Self-retention: 40000 * 0.06 = €2400
      // Deductible: 5000 - 2400 = €2600
      expect(result.breakdown.medicalExpenses.selfRetention).toBeCloseTo(2400, 0);
      expect(result.breakdown.medicalExpenses.amount).toBeCloseTo(2600, 0);
    });
  });

  // ==========================================
  // Szenario 9: Medizinische Kosten - Behinderung (0% Selbstbehalt)
  // ==========================================

  describe('Szenario 9: Medizinische Kosten - Behinderung', () => {
    it('should have 0% self-retention with disability', async () => {
      const profile = makeProfile({
        personalInfo: { name: 'Test', birthDate: '1980-01-01', hasDisability: true, disabilityDegree: 50 },
        income: { grossIncome: 40000, withheldTax: 7000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 3000,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // No self-retention for disabled persons
      expect(result.breakdown.medicalExpenses.selfRetention).toBe(0);
      expect(result.breakdown.medicalExpenses.amount).toBe(3000);
    });
  });

  // ==========================================
  // Szenario 10: Alleinerziehend, 3 Kinder → 4% Selbstbehalt
  // ==========================================

  describe('Szenario 10: Selbstbehalt-Reduktion bei Alleinerzieher + 3 Kinder', () => {
    it('should apply 4% self-retention rate', async () => {
      const profile = makeProfile({
        income: { grossIncome: 50000, withheldTax: 10000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 8000,
          disabilityExpenses: 0,
          childcareExpenses: 0
        },
        family: {
          maritalStatus: 'single',
          singleEarner: false,
          singleParent: true,
          children: [
            { birthDate: '2014-01-01', receivingFamilyAllowance: true, inHousehold: true },
            { birthDate: '2016-06-01', receivingFamilyAllowance: true, inHousehold: true },
            { birthDate: '2019-09-01', receivingFamilyAllowance: true, inHousehold: true }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Alleinerziehend + 3 children → 4% self-retention
      const expectedSelfRetention = 50000 * 0.04; // €2000
      expect(result.breakdown.medicalExpenses.selfRetention).toBeCloseTo(expectedSelfRetention, 0);

      // Deductible: 8000 - 2000 = 6000
      expect(result.breakdown.medicalExpenses.amount).toBeCloseTo(6000, 0);
    });
  });

  // ==========================================
  // Szenario 11: Einkommen unter Steuerfreibetrag
  // ==========================================

  describe('Szenario 11: Einkommen unter €11.693 - Steuerfreigrenze', () => {
    it('should result in 0 tax and full refund of withheld tax', async () => {
      const profile = makeProfile({
        income: { grossIncome: 11000, withheldTax: 500, employerCount: 1, hasSelfEmployment: false }
      });

      const result = await agent.calculateTax(profile);

      const expectedTaxableIncome = 11000 - rules2024.credits.werbungskostenPauschale;
      expect(result.taxableIncome).toBe(expectedTaxableIncome);
      expect(result.calculatedTax).toBe(0);
      expect(result.estimatedRefund).toBeCloseTo(500, 0);
    });
  });

  // ==========================================
  // Szenario 12: Hohe Einkommen (>€93.120 Spitzensteuersatz 50%)
  // ==========================================

  describe('Szenario 12: Hohes Einkommen - Spitzensteuersatz', () => {
    it('should apply 50% bracket correctly', async () => {
      const profile = makeProfile({
        income: { grossIncome: 100000, withheldTax: 35000, employerCount: 1, hasSelfEmployment: false }
      });

      const result = await agent.calculateTax(profile);

      const expectedTaxableIncome = 100000 - rules2024.credits.werbungskostenPauschale;
      expect(result.taxableIncome).toBe(expectedTaxableIncome);

      const expectedTax = manualProgressiveTax(expectedTaxableIncome);
      const expectedTaxAfterCredits = Math.max(
        0,
        expectedTax - rules2024.credits.verkehrsabsetzbetrag - rules2024.credits.arbeitnehmerabsetzbetrag
      );

      expect(result.calculatedTax).toBeCloseTo(expectedTaxAfterCredits, 0);
    });
  });

  // ==========================================
  // Szenario 13: Kinderbetreuung - geteilte Obsorge (50%)
  // ==========================================

  describe('Szenario 13: Kinderbetreuung bei geteilter Obsorge', () => {
    it('should limit childcare deduction to 50% (€1150) for shared custody', async () => {
      const profile = makeProfile({
        income: { grossIncome: 40000, withheldTax: 7000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 3000
        },
        family: {
          maritalStatus: 'divorced',
          singleEarner: false,
          singleParent: false,
          children: [
            { birthDate: '2018-05-01', receivingFamilyAllowance: true, inHousehold: false } // shared custody
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Shared custody: max €1150 instead of €2300
      expect(result.breakdown.childcare.amount).toBe(1150);
    });

    it('should allow full €2300 when child is in household', async () => {
      const profile = makeProfile({
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 3000
        },
        family: {
          maritalStatus: 'single',
          singleEarner: false,
          singleParent: true,
          children: [
            { birthDate: '2018-05-01', receivingFamilyAllowance: true, inHousehold: true }
          ]
        }
      });

      const result = await agent.calculateTax(profile);
      expect(result.breakdown.childcare.amount).toBe(2300);
    });
  });

  // ==========================================
  // Szenario 14: Familienbonus für Kind 18-24 (Erwachsen)
  // ==========================================

  describe('Szenario 14: Familienbonus für erwachsenes Kind (18-24)', () => {
    it('should apply reduced Familienbonus (€650) for adult child', async () => {
      const profile = makeProfile({
        income: { grossIncome: 50000, withheldTax: 10000, employerCount: 1, hasSelfEmployment: false },
        family: {
          maritalStatus: 'married',
          singleEarner: false,
          singleParent: false,
          children: [
            { birthDate: '2004-01-15', receivingFamilyAllowance: true, inHousehold: true } // 20 years old in 2024
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.absetzbetraege.familienbonus).toBe(rules2024.credits.familienbonusPerChildAdult);
    });
  });

  // ==========================================
  // Szenario 15: Vollständiger realistischer Fall
  // "Typischer Angestellter in Wien"
  // ==========================================

  describe('Szenario 15: Realistischer Fall - Angestellter Wien, 1 Kind, Pendler', () => {
    it('should produce a plausible result matching hand calculation', async () => {
      const profile = makeProfile({
        income: { grossIncome: 42000, withheldTax: 7500, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 15, daysPerYear: 220, publicTransportFeasible: false },
          homeOffice: { days: 40, equipmentCost: 0 },
          workEquipment: 300,
          education: 800,
          otherWerbungskosten: 0,
          churchTax: 200,
          donations: 100,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 1500
        },
        family: {
          maritalStatus: 'married',
          singleEarner: false,
          singleParent: false,
          children: [
            { birthDate: '2017-09-01', receivingFamilyAllowance: true, inHousehold: true }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Große Pendlerpauschale 2-20km = €372
      expect(result.breakdown.pendlerpauschale.type).toBe('gross');
      expect(result.breakdown.pendlerpauschale.amount).toBe(372);

      // Home Office: 40 * €3 = €120
      expect(result.breakdown.homeOffice.amount).toBe(120);

      // Werbungskosten: 372 + 120 + 300 + 800 = 1592
      expect(result.totalWerbungskosten).toBe(1592);

      // Sonderausgaben: 200 + 100 = 300
      expect(result.totalSonderausgaben).toBe(300);

      // Childcare: child is 7 in 2024, in household → max €2300, claimed €1500
      expect(result.breakdown.childcare.amount).toBe(1500);

      // Außergew. Belastungen: 1500 (childcare)
      expect(result.totalAussergewoehnlicheBelastungen).toBe(1500);

      // Total deductions: 1592 + 300 + 1500 = 3392
      expect(result.effectiveDeductions).toBe(3392);

      // Taxable income: 42000 - 3392 = 38608
      expect(result.taxableIncome).toBe(38608);

      // Progressive tax
      const expectedTax = manualProgressiveTax(38608);

      expect(result.absetzbetraege.familienbonus).toBe(rules2024.credits.familienbonusPerChild);
      const totalCredits =
        rules2024.credits.verkehrsabsetzbetrag +
        rules2024.credits.arbeitnehmerabsetzbetrag +
        rules2024.credits.familienbonusPerChild;

      const taxAfterCredits = Math.max(0, expectedTax - totalCredits);
      expect(result.calculatedTax).toBeCloseTo(taxAfterCredits, 0);

      // Refund
      const expectedRefund = Math.max(0, 7500 - taxAfterCredits);
      expect(result.estimatedRefund).toBeCloseTo(expectedRefund, 0);

      // Plausibility: a typical Viennese employee should get somewhere between €1000-4000 back
      expect(result.estimatedRefund).toBeGreaterThan(500);
      expect(result.estimatedRefund).toBeLessThan(7500);
    });
  });

  // ==========================================
  // Szenario 16: Pendlerpauschale - Teilzeitarbeitstage
  // ==========================================

  describe('Szenario 16: Pendlerpauschale pro-rata bei Teilzeit', () => {
    it('should pro-rate Pendlerpauschale for fewer work days', async () => {
      const profile = makeProfile({
        deductions: {
          pendlerpauschale: { distance: 25, daysPerYear: 110, publicTransportFeasible: false },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 0,
          disabilityExpenses: 0,
          childcareExpenses: 0
        }
      });

      const result = await agent.calculateTax(profile);

      // Große Pendlerpauschale 20-40km = €1476 base, pro-rated: 1476 * 110/220 = 738
      expect(result.breakdown.pendlerpauschale.amount).toBe(738);
    });
  });

  // ==========================================
  // Szenario 17: Alleinverdiener mit 2 Kindern - Selbstbehalt 5%
  // ==========================================

  describe('Szenario 17: Alleinverdiener + 2 Kinder → 5% Selbstbehalt', () => {
    it('should apply 5% self-retention rate for single earner with 2 children', async () => {
      const profile = makeProfile({
        income: { grossIncome: 60000, withheldTax: 15000, employerCount: 1, hasSelfEmployment: false },
        deductions: {
          pendlerpauschale: { distance: 0, daysPerYear: 0, publicTransportFeasible: true },
          homeOffice: { days: 0, equipmentCost: 0 },
          workEquipment: 0,
          education: 0,
          otherWerbungskosten: 0,
          churchTax: 0,
          donations: 0,
          insurance: 0,
          medicalExpenses: 10000,
          disabilityExpenses: 0,
          childcareExpenses: 0
        },
        family: {
          maritalStatus: 'married',
          singleEarner: true,
          singleParent: false,
          children: [
            { birthDate: '2015-01-01', receivingFamilyAllowance: true, inHousehold: true },
            { birthDate: '2018-01-01', receivingFamilyAllowance: true, inHousehold: true }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Alleinverdiener + 2 children → 5% self-retention
      const expectedSelfRetention = 60000 * 0.05;
      expect(result.breakdown.medicalExpenses.selfRetention).toBeCloseTo(expectedSelfRetention, 0);
      expect(result.breakdown.medicalExpenses.amount).toBeCloseTo(10000 - expectedSelfRetention, 0);

      // Also should have Alleinverdienerabsetzbetrag
      expect(result.absetzbetraege.alleinverdienerabsetzbetrag).toBe(
        tieredFamilyCredit(2, rules2024.credits.alleinverdiener)
      );
    });
  });
});
