import * as fs from 'fs';

import { taxRulePackSchema } from '../../src/backend/taxRules/schema.ts';

import {
  REQUIRED_YEARS,
  RuleCheckMessage,
  daysOld,
  getRulePath,
  hasFailures,
  listRuleYears,
  printMessages,
  readJson
} from './lib.ts';

function runCheck(now: Date = new Date()): RuleCheckMessage[] {
  const messages: RuleCheckMessage[] = [];
  const discoveredYears = listRuleYears();

  for (const year of REQUIRED_YEARS) {
    if (!discoveredYears.includes(year)) {
      messages.push({ state: 'fail', message: `Missing tax rule pack for ${year}` });
    }
  }

  for (const year of discoveredYears) {
    const filePath = getRulePath(year);

    if (!fs.existsSync(filePath)) {
      messages.push({ state: 'fail', message: `Rule file missing: ${filePath}` });
      continue;
    }

    try {
      const raw = readJson<unknown>(filePath);
      const parsed = taxRulePackSchema.parse(raw);

      if (parsed.year !== year) {
        messages.push({
          state: 'fail',
          message: `Rule year mismatch in ${filePath}: filename ${year}, payload ${parsed.year}`
        });
      }

      const staleLimit = parsed.staleAfterDays || 35;
      const age = daysOld(parsed.verifiedAt, now);
      if (!Number.isFinite(age)) {
        messages.push({
          state: 'fail',
          message: `Invalid verifiedAt date in ${filePath}: ${parsed.verifiedAt}`
        });
      } else if (age > staleLimit) {
        messages.push({
          state: 'fail',
          message: `Rule pack ${year} is stale (${age}d old, limit ${staleLimit}d)`
        });
      } else {
        messages.push({
          state: 'ok',
          message: `Rule pack ${year} is valid (${age}d old)`
        });
      }
    } catch (error) {
      messages.push({
        state: 'fail',
        message: `Schema validation failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  for (const requiredYear of REQUIRED_YEARS) {
    if (!discoveredYears.includes(requiredYear)) {
      continue;
    }
  }

  for (const discoveredYear of discoveredYears) {
    if (!REQUIRED_YEARS.includes(discoveredYear as (typeof REQUIRED_YEARS)[number])) {
      messages.push({
        state: 'warn',
        message: `Additional non-required year found: ${discoveredYear}`
      });
    }
  }

  return messages;
}

const messages = runCheck();
printMessages(messages);

if (hasFailures(messages)) {
  process.exit(1);
}
