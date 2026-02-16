import { z } from 'zod';

import { TaxRulePack } from './types';

const nonNegativeNumber = z.number().finite().nonnegative();

const taxBracketSchema = z.object({
  min: nonNegativeNumber,
  max: nonNegativeNumber.nullable(),
  rate: z.number().min(0).max(1)
});

const pendlerBracketSchema = z.object({
  minKm: nonNegativeNumber,
  maxKm: nonNegativeNumber.nullable(),
  amount: nonNegativeNumber
});

const tieredFamilyCreditSchema = z.object({
  firstChild: nonNegativeNumber,
  secondChildIncrement: nonNegativeNumber,
  additionalChildIncrement: nonNegativeNumber
});

const taxRuleCreditsSchema = z.object({
  werbungskostenPauschale: nonNegativeNumber,
  verkehrsabsetzbetrag: nonNegativeNumber,
  arbeitnehmerabsetzbetrag: nonNegativeNumber,
  churchTaxMax: nonNegativeNumber,
  familienbonusPerChild: nonNegativeNumber,
  familienbonusPerChildAdult: nonNegativeNumber,
  alleinverdiener: tieredFamilyCreditSchema,
  alleinerzieher: tieredFamilyCreditSchema
});

const homeOfficeSchema = z.object({
  perDay: nonNegativeNumber,
  maxAmount: nonNegativeNumber,
  maxDays: nonNegativeNumber
});

const childcareSchema = z.object({
  maxPerChild: nonNegativeNumber,
  sharedCustodyFactor: z.number().min(0).max(1),
  maxAge: nonNegativeNumber
});

const medicalSchema = z.object({
  defaultSelfRetentionRate: z.number().min(0).max(1),
  manyChildrenSelfRetentionRate: z.number().min(0).max(1),
  singleWithTwoChildrenRate: z.number().min(0).max(1),
  singleWithThreeOrMoreChildrenRate: z.number().min(0).max(1),
  disabilityRate: z.number().min(0).max(1)
});

const metadataSchema = z.object({
  lawYear: z.number().int().min(2000).max(2100),
  verificationStatus: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  sources: z.array(z.string().url()).min(1)
});

const pendlerSchema = z.object({
  klein: z.array(pendlerBracketSchema).min(1),
  gross: z.array(pendlerBracketSchema).min(1)
});

export const taxRulePackSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  version: z.string().min(1).max(100),
  verifiedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  staleAfterDays: z.number().int().min(1).max(365),
  metadata: metadataSchema,
  taxBrackets: z.array(taxBracketSchema).min(2),
  credits: taxRuleCreditsSchema,
  homeOffice: homeOfficeSchema,
  childcare: childcareSchema,
  medical: medicalSchema,
  pendlerpauschale: pendlerSchema
}).superRefine((pack, ctx) => {
  let previousMax: number | null = null;
  for (let i = 0; i < pack.taxBrackets.length; i++) {
    const bracket = pack.taxBrackets[i];
    if (i === 0 && bracket.min !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxBrackets', i, 'min'],
        message: 'First tax bracket must start at 0'
      });
    }
    if (bracket.max !== null && bracket.max <= bracket.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxBrackets', i, 'max'],
        message: 'Tax bracket max must be greater than min'
      });
    }
    if (previousMax !== null && bracket.min !== previousMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxBrackets', i, 'min'],
        message: 'Tax brackets must be continuous'
      });
    }
    previousMax = bracket.max;
  }

  const validatePendlerTable = (tableName: 'klein' | 'gross'): void => {
    let lastMax: number | null = null;
    pack.pendlerpauschale[tableName].forEach((entry, index) => {
      if (entry.maxKm !== null && entry.maxKm <= entry.minKm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pendlerpauschale', tableName, index, 'maxKm'],
          message: 'Pendler bracket maxKm must be greater than minKm'
        });
      }
      if (lastMax !== null && entry.minKm !== lastMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pendlerpauschale', tableName, index, 'minKm'],
          message: `Pendler table "${tableName}" must be continuous`
        });
      }
      lastMax = entry.maxKm;
    });
  };

  validatePendlerTable('klein');
  validatePendlerTable('gross');
});

export function parseTaxRulePack(input: unknown): TaxRulePack {
  return taxRulePackSchema.parse(input) as TaxRulePack;
}
