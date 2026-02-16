import * as fs from 'fs';
import * as path from 'path';

import {
  REQUIRED_YEARS,
  RuleCheckMessage,
  hasFailures,
  parseFlagValue,
  printMessages,
  taxKnowledgeDir
} from './lib.ts';

function checkKnowledgeFile(filePath: string, expectedYear: number): RuleCheckMessage[] {
  const messages: RuleCheckMessage[] = [];
  const raw = fs.readFileSync(filePath, 'utf-8');

  const hasTitle = /^#\s+/m.test(raw);
  const hasCategory = /^Category:\s+/mi.test(raw);
  const hasSource = /^Source:\s+/mi.test(raw);
  const yearMatch = raw.match(/^Year:\s*(\d{4})/mi);

  if (!hasTitle) {
    messages.push({ state: 'fail', message: `Missing markdown title in ${filePath}` });
  }
  if (!hasCategory) {
    messages.push({ state: 'fail', message: `Missing Category metadata in ${filePath}` });
  }
  if (!hasSource) {
    messages.push({ state: 'fail', message: `Missing Source metadata in ${filePath}` });
  }

  if (!yearMatch) {
    messages.push({ state: 'fail', message: `Missing Year metadata in ${filePath}` });
  } else if (Number(yearMatch[1]) !== expectedYear) {
    messages.push({
      state: 'fail',
      message: `Year metadata mismatch in ${filePath}: expected ${expectedYear}, got ${yearMatch[1]}`
    });
  }

  if (messages.length === 0) {
    messages.push({ state: 'ok', message: `Knowledge file OK: ${filePath}` });
  }

  return messages;
}

const args = process.argv.slice(2);
const yearValue = parseFlagValue('--year', args);
const years = yearValue ? [Number(yearValue)] : [...REQUIRED_YEARS];

const messages: RuleCheckMessage[] = [];

for (const year of years) {
  if (!Number.isInteger(year)) {
    messages.push({ state: 'fail', message: `Invalid year argument: ${String(year)}` });
    continue;
  }

  const yearDir = path.join(taxKnowledgeDir(), String(year));
  if (!fs.existsSync(yearDir)) {
    messages.push({ state: 'fail', message: `Missing knowledge directory: ${yearDir}` });
    continue;
  }

  const files = fs.readdirSync(yearDir).filter((file) => file.endsWith('.md'));
  if (files.length === 0) {
    messages.push({ state: 'fail', message: `No markdown files in ${yearDir}` });
    continue;
  }

  for (const file of files) {
    const filePath = path.join(yearDir, file);
    messages.push(...checkKnowledgeFile(filePath, year));
  }
}

printMessages(messages);
if (hasFailures(messages)) {
  process.exit(1);
}
