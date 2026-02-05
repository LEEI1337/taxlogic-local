/**
 * Unit tests for AnalyzerAgent
 * 
 * Tests Austrian tax calculations including:
 * - Progressive tax calculation
 * - Pendlerpauschale (commuter allowance)
 * - Home office deductions
 * - Tax credits (Absetzbeträge)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzerAgent, TaxProfile } from '../../src/backend/agents/analyzerAgent';

// Mock the LLM service
vi.mock('../../src/backend/services/llmService', () => ({
  llmService: {
    query: vi.fn().mockResolvedValue({
      content: 'Mocked tax analysis summary.',
      provider: 'ollama',
      model: 'mistral'
    })
  }
}));

describe('AnalyzerAgent', () => {
  let agent: AnalyzerAgent;

  beforeEach(() => {
    agent = new AnalyzerAgent();
    vi.clearAllMocks();
  });

  const createBaseProfile = (overrides: Partial<TaxProfile> = {}): TaxProfile => ({
    taxYear: 2024,
    personalInfo: {
      name: 'Max Mustermann',
      birthDate: '1985-05-15',
      hasDisability: false
    },
    income: {
      grossIncome: 45000,
      withheldTax: 8000,
      employerCount: 1,
      hasSelfEmployment: false
    },
    deductions: {
      pendlerpauschale: {
        distance: 0,
        daysPerYear: 220,
        publicTransportFeasible: true
      },
      homeOffice: {
        days: 0,
        equipmentCost: 0
      },
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

  describe('calculateTax', () => {
    it('should calculate tax for basic income with no deductions', async () => {
      const profile = createBaseProfile();
      const result = await agent.calculateTax(profile);

      expect(result.grossIncome).toBe(45000);
      expect(result.taxableIncome).toBeGreaterThan(0);
      expect(result.calculatedTax).toBeGreaterThan(0);
      expect(result.taxYear).toBe(2024);
    });

    it('should return zero tax for income below threshold', async () => {
      const profile = createBaseProfile({
        income: {
          grossIncome: 11000,
          withheldTax: 0,
          employerCount: 1,
          hasSelfEmployment: false
        }
      });

      const result = await agent.calculateTax(profile);

      // Income below 11693 should have 0% tax rate
      expect(result.taxableIncome).toBeLessThan(11693);
      expect(result.calculatedTax).toBe(0);
    });

    it('should calculate refund when withheld tax exceeds calculated tax', async () => {
      const profile = createBaseProfile({
        income: {
          grossIncome: 30000,
          withheldTax: 6000, // High withholding
          employerCount: 1,
          hasSelfEmployment: false
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.estimatedRefund).toBeGreaterThan(0);
      expect(result.estimatedBackpayment).toBe(0);
    });
  });

  describe('Home Office Deductions', () => {
    it('should calculate home office deduction correctly', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          homeOffice: {
            days: 50,
            equipmentCost: 500
          }
        }
      });

      const result = await agent.calculateTax(profile);

      // 50 days * €3/day = €150
      expect(result.breakdown.homeOffice.amount).toBe(150);
      expect(result.breakdown.homeOffice.days).toBe(50);
    });

    it('should cap home office days at 100', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          homeOffice: {
            days: 150, // Exceeds max
            equipmentCost: 0
          }
        }
      });

      const result = await agent.calculateTax(profile);

      // Max 100 days * €3/day = €300
      expect(result.breakdown.homeOffice.days).toBe(100);
      expect(result.breakdown.homeOffice.amount).toBe(300);
    });
  });

  describe('Pendlerpauschale', () => {
    it('should return zero for distance under 2km', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          pendlerpauschale: {
            distance: 1.5,
            daysPerYear: 220,
            publicTransportFeasible: true
          }
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.breakdown.pendlerpauschale.amount).toBe(0);
      expect(result.breakdown.pendlerpauschale.type).toBe('none');
    });

    it('should calculate kleine Pendlerpauschale for public transport feasible', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          pendlerpauschale: {
            distance: 25,
            daysPerYear: 220,
            publicTransportFeasible: true
          }
        }
      });

      const result = await agent.calculateTax(profile);

      // Distance 20-40km, public transport feasible = kleine Pendlerpauschale
      expect(result.breakdown.pendlerpauschale.type).toBe('klein');
      expect(result.breakdown.pendlerpauschale.amount).toBeGreaterThan(0);
    });

    it('should calculate große Pendlerpauschale when public transport not feasible', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          pendlerpauschale: {
            distance: 25,
            daysPerYear: 220,
            publicTransportFeasible: false
          }
        }
      });

      const result = await agent.calculateTax(profile);

      // Distance 20-40km, public transport NOT feasible = große Pendlerpauschale
      expect(result.breakdown.pendlerpauschale.type).toBe('gross');
      expect(result.breakdown.pendlerpauschale.amount).toBeGreaterThan(0);
    });
  });

  describe('Church Tax', () => {
    it('should cap church tax at €600', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          churchTax: 800 // Exceeds max
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.breakdown.churchTax.amount).toBe(600);
    });

    it('should allow church tax below cap', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          churchTax: 400
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.breakdown.churchTax.amount).toBe(400);
    });
  });

  describe('Absetzbeträge (Tax Credits)', () => {
    it('should include Verkehrsabsetzbetrag', async () => {
      const profile = createBaseProfile();
      const result = await agent.calculateTax(profile);

      // Verkehrsabsetzbetrag is €463 for 2024
      expect(result.absetzbetraege.verkehrsabsetzbetrag).toBe(463);
    });

    it('should calculate Familienbonus for children under 18', async () => {
      const profile = createBaseProfile({
        family: {
          maritalStatus: 'married',
          singleEarner: false,
          singleParent: false,
          children: [
            {
              birthDate: '2015-03-15', // Child under 18
              receivingFamilyAllowance: true,
              inHousehold: true
            }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Familienbonus is €2000 per child under 18
      expect(result.absetzbetraege.familienbonus).toBe(2000);
    });

    it('should calculate reduced Familienbonus for children 18-24', async () => {
      const profile = createBaseProfile({
        family: {
          maritalStatus: 'married',
          singleEarner: false,
          singleParent: false,
          children: [
            {
              birthDate: '2004-03-15', // Child 20 years old
              receivingFamilyAllowance: true,
              inHousehold: true
            }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Familienbonus is €650 for children 18-24
      expect(result.absetzbetraege.familienbonus).toBe(650);
    });

    it('should calculate Alleinerzieherabsetzbetrag for single parents', async () => {
      const profile = createBaseProfile({
        family: {
          maritalStatus: 'single',
          singleEarner: false,
          singleParent: true,
          children: [
            {
              birthDate: '2015-03-15',
              receivingFamilyAllowance: true,
              inHousehold: true
            }
          ]
        }
      });

      const result = await agent.calculateTax(profile);

      // Base €494 + €175 per child = €669
      expect(result.absetzbetraege.alleinerzieherabsetzbetrag).toBe(669);
    });
  });

  describe('Werbungskosten Pauschale', () => {
    it('should use Pauschale when actual deductions are lower', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          workEquipment: 50 // Below Pauschale of €132
        }
      });

      const result = await agent.calculateTax(profile);

      // When total Werbungskosten < €132, should use Pauschale
      expect(result.werbungskostenPauschale).toBe(132);
      expect(result.effectiveDeductions).toBeGreaterThanOrEqual(132);
    });

    it('should use actual deductions when higher than Pauschale', async () => {
      const profile = createBaseProfile({
        deductions: {
          ...createBaseProfile().deductions,
          workEquipment: 500,
          education: 1000
        }
      });

      const result = await agent.calculateTax(profile);

      // Total Werbungskosten = €1500, should use actual amount
      expect(result.totalWerbungskosten).toBe(1500);
      expect(result.effectiveDeductions).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('Medical Expenses', () => {
    it('should calculate self-retention for medical expenses', async () => {
      const profile = createBaseProfile({
        income: {
          grossIncome: 50000,
          withheldTax: 10000,
          employerCount: 1,
          hasSelfEmployment: false
        },
        deductions: {
          ...createBaseProfile().deductions,
          medicalExpenses: 5000
        }
      });

      const result = await agent.calculateTax(profile);

      // Self-retention is 6% of income = €3000
      // Deductible = €5000 - €3000 = €2000
      expect(result.breakdown.medicalExpenses.selfRetention).toBe(3000);
      expect(result.breakdown.medicalExpenses.amount).toBe(2000);
    });

    it('should return zero deduction when expenses below self-retention', async () => {
      const profile = createBaseProfile({
        income: {
          grossIncome: 50000,
          withheldTax: 10000,
          employerCount: 1,
          hasSelfEmployment: false
        },
        deductions: {
          ...createBaseProfile().deductions,
          medicalExpenses: 2000 // Below 6% self-retention
        }
      });

      const result = await agent.calculateTax(profile);

      // Expenses €2000 < Self-retention €3000
      expect(result.breakdown.medicalExpenses.amount).toBe(0);
    });
  });

  describe('Recommendations and Analysis', () => {
    it('should generate recommendations when using Pauschale', async () => {
      const profile = createBaseProfile();
      const result = await agent.calculateTax(profile);

      // Should recommend increasing Werbungskosten when below Pauschale
      const werbungskostenRec = result.analysis.recommendations.find(
        (r) => r.category === 'Werbungskosten'
      );
      expect(werbungskostenRec).toBeDefined();
    });

    it('should generate warning for multiple employers', async () => {
      const profile = createBaseProfile({
        income: {
          grossIncome: 45000,
          withheldTax: 8000,
          employerCount: 2, // Multiple employers
          hasSelfEmployment: false
        }
      });

      const result = await agent.calculateTax(profile);

      expect(result.analysis.warnings).toContain(
        'Bei mehreren Arbeitgebern ist die Arbeitnehmerveranlagung meist verpflichtend.'
      );
    });

    it('should include effective tax rate in analysis', async () => {
      const profile = createBaseProfile();
      const result = await agent.calculateTax(profile);

      expect(result.analysis.effectiveTaxRate).toBeGreaterThanOrEqual(0);
      expect(result.analysis.effectiveTaxRate).toBeLessThanOrEqual(55);
    });
  });
});
