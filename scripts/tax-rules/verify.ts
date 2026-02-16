import * as fs from 'fs';

import {
  REQUIRED_YEARS,
  RuleCheckMessage,
  SourceSnapshot,
  getByPath,
  getRulePath,
  getSourceSnapshotPath,
  hasFailures,
  listRuleYears,
  printMessages,
  readJson
} from './lib.ts';

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function runVerification(): RuleCheckMessage[] {
  const messages: RuleCheckMessage[] = [];
  const years = listRuleYears().filter((year) => REQUIRED_YEARS.includes(year as (typeof REQUIRED_YEARS)[number]));

  for (const year of years) {
    const rulePath = getRulePath(year);
    const snapshotPath = getSourceSnapshotPath(year);

    if (!fs.existsSync(snapshotPath)) {
      messages.push({ state: 'fail', message: `Missing source snapshot for ${year}: ${snapshotPath}` });
      continue;
    }

    const rulePack = readJson<Record<string, unknown>>(rulePath);
    const snapshot = readJson<SourceSnapshot>(snapshotPath);

    if (snapshot.year !== year) {
      messages.push({
        state: 'fail',
        message: `Snapshot year mismatch in ${snapshotPath}: expected ${year}, got ${snapshot.year}`
      });
    }

    if (!Array.isArray(snapshot.sources) || snapshot.sources.length === 0) {
      messages.push({
        state: 'fail',
        message: `Snapshot ${snapshotPath} has no source URLs`
      });
    }

    if (!Array.isArray(snapshot.assertions) || snapshot.assertions.length === 0) {
      messages.push({
        state: 'fail',
        message: `Snapshot ${snapshotPath} has no assertions`
      });
      continue;
    }

    for (const assertion of snapshot.assertions) {
      const actual = getByPath(rulePack, assertion.path);
      if (!valuesEqual(actual, assertion.equals)) {
        messages.push({
          state: 'fail',
          message: `Assertion failed (${year}) ${assertion.path}: expected ${JSON.stringify(assertion.equals)} got ${JSON.stringify(actual)}`
        });
      }
    }

    messages.push({
      state: 'ok',
      message: `Snapshot verification completed for ${year}`
    });
  }

  return messages;
}

const messages = runVerification();
printMessages(messages);

if (hasFailures(messages)) {
  process.exit(1);
}
