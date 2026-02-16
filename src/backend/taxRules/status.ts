import { getTaxRulePackPath, listSupportedTaxRuleYears, loadTaxRulePack } from './loader';
import { TaxRuleStatus } from './types';

const DEFAULT_STALE_AFTER_DAYS = 35;

function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function getTaxRuleStatus(year: number, now: Date = new Date()): TaxRuleStatus {
  const supportedYears = listSupportedTaxRuleYears();

  if (!Number.isInteger(year)) {
    return {
      year,
      state: 'invalid',
      message: `Tax year must be an integer. Received: ${String(year)}`,
      supportedYears
    };
  }

  if (!supportedYears.includes(year)) {
    return {
      year,
      state: 'unsupportedYear',
      message: `Unsupported tax year ${year}. Supported years: ${supportedYears.join(', ') || '(none)'}`,
      supportedYears
    };
  }

  const packPath = getTaxRulePackPath(year);
  try {
    const pack = loadTaxRulePack(year);
    const verifiedAtDate = new Date(pack.verifiedAt);
    if (Number.isNaN(verifiedAtDate.getTime())) {
      return {
        year,
        state: 'invalid',
        message: `Tax rule pack has invalid verifiedAt timestamp: ${pack.verifiedAt}`,
        supportedYears,
        packPath
      };
    }

    const staleAfterDays = pack.staleAfterDays || DEFAULT_STALE_AFTER_DAYS;
    const daysSinceVerification = daysBetween(verifiedAtDate, now);

    if (daysSinceVerification > staleAfterDays) {
      return {
        year,
        state: 'stale',
        message: `Tax rules for ${year} are stale (${daysSinceVerification} days old, max ${staleAfterDays})`,
        supportedYears,
        packPath,
        verifiedAt: pack.verifiedAt,
        daysSinceVerification
      };
    }

    return {
      year,
      state: 'ok',
      message: `Tax rules for ${year} are valid`,
      supportedYears,
      packPath,
      verifiedAt: pack.verifiedAt,
      daysSinceVerification
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown tax rule error';
    const isMissing = message.toLowerCase().includes('missing') || message.toLowerCase().includes('enoent');
    return {
      year,
      state: isMissing ? 'missing' : 'invalid',
      message,
      supportedYears,
      packPath
    };
  }
}

export function getAllTaxRuleStatuses(
  years: number[] = listSupportedTaxRuleYears(),
  now: Date = new Date()
): TaxRuleStatus[] {
  return years.map((year) => getTaxRuleStatus(year, now));
}
