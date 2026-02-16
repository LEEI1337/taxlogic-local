import * as fs from 'fs';
import * as path from 'path';

import { parseTaxRulePack } from './schema';
import { TaxRulePack } from './types';

const cache = new Map<number, TaxRulePack>();

function resolveConfigRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), 'config'),
    path.resolve(process.cwd(), 'taxlogic-local', 'config'),
    path.resolve(__dirname, '..', '..', '..', '..', 'config'),
    path.resolve(__dirname, '..', '..', '..', 'config')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tax-rules'))) {
      return candidate;
    }
  }

  throw new Error(`Could not locate config directory with tax-rules. Checked: ${candidates.join(', ')}`);
}

export function getConfigRoot(): string {
  return resolveConfigRoot();
}

export function getTaxRulesDirectory(): string {
  return path.join(resolveConfigRoot(), 'tax-rules');
}

export function getTaxRulePackPath(year: number): string {
  return path.join(getTaxRulesDirectory(), `${year}.json`);
}

export function listSupportedTaxRuleYears(): number[] {
  const rulesDirectory = getTaxRulesDirectory();
  if (!fs.existsSync(rulesDirectory)) {
    return [];
  }

  return fs.readdirSync(rulesDirectory)
    .map((filename) => {
      const match = filename.match(/^(\d{4})\.json$/);
      return match ? Number(match[1]) : null;
    })
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);
}

export function clearTaxRuleCache(): void {
  cache.clear();
}

export function loadTaxRulePack(year: number): TaxRulePack {
  if (cache.has(year)) {
    return cache.get(year)!;
  }

  const packPath = getTaxRulePackPath(year);
  if (!fs.existsSync(packPath)) {
    throw new Error(`Tax rule pack missing for year ${year}: ${packPath}`);
  }

  const rawContent = fs.readFileSync(packPath, 'utf-8');
  const parsedJson = JSON.parse(rawContent);
  const pack = parseTaxRulePack(parsedJson);

  if (pack.year !== year) {
    throw new Error(`Tax rule pack year mismatch. Expected ${year}, found ${pack.year}`);
  }

  cache.set(year, pack);
  return pack;
}

export function getTaxRulesForYear(year: number): TaxRulePack {
  return loadTaxRulePack(year);
}
