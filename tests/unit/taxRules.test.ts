import { describe, expect, it } from 'vitest';

import {
  clearTaxRuleCache,
  getTaxRuleStatus,
  getTaxRulesForYear,
  listSupportedTaxRuleYears
} from '../../src/backend/taxRules';

describe('Tax Rules', () => {
  it('loads rule packs for required years', () => {
    clearTaxRuleCache();
    const years = listSupportedTaxRuleYears();

    expect(years).toContain(2024);
    expect(years).toContain(2025);
    expect(years).toContain(2026);

    const pack = getTaxRulesForYear(2025);
    expect(pack.year).toBe(2025);
    expect(pack.taxBrackets.length).toBeGreaterThan(1);
  });

  it('returns ok status for fresh packs', () => {
    const status = getTaxRuleStatus(2025, new Date('2026-02-16T00:00:00.000Z'));
    expect(status.state).toBe('ok');
  });

  it('returns stale status when verifiedAt exceeds threshold', () => {
    const status = getTaxRuleStatus(2025, new Date('2026-04-30T00:00:00.000Z'));
    expect(status.state).toBe('stale');
  });

  it('returns unsupportedYear for unknown year', () => {
    const status = getTaxRuleStatus(2032, new Date('2026-02-16T00:00:00.000Z'));
    expect(status.state).toBe('unsupportedYear');
  });
});
