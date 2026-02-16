import * as fs from 'fs';
import * as path from 'path';

import {
  ensureDirectory,
  getRulePath,
  parseFlagValue,
  readJson,
  taxKnowledgeDir,
  taxSourcesDir,
  writeJson
} from './lib.ts';

const args = process.argv.slice(2);
const fromYearValue = parseFlagValue('--from', args);
const toYearValue = parseFlagValue('--to', args);

if (!fromYearValue || !toYearValue) {
  console.error('Usage: npm run tax-rules:init-year -- --from 2025 --to 2026');
  process.exit(1);
}

const fromYear = Number(fromYearValue);
const toYear = Number(toYearValue);

if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
  console.error('Both --from and --to must be integer years.');
  process.exit(1);
}

const sourceRulePath = getRulePath(fromYear);
const targetRulePath = getRulePath(toYear);

if (!fs.existsSync(sourceRulePath)) {
  console.error(`Source rule pack not found: ${sourceRulePath}`);
  process.exit(1);
}

if (fs.existsSync(targetRulePath)) {
  console.error(`Target rule pack already exists: ${targetRulePath}`);
  process.exit(1);
}

const sourceRulePack = readJson<Record<string, unknown>>(sourceRulePath);
const nextRulePack = {
  ...sourceRulePack,
  year: toYear,
  version: `${toYear}.draft`,
  verifiedAt: new Date().toISOString().slice(0, 10),
  metadata: {
    ...(sourceRulePack.metadata as Record<string, unknown>),
    lawYear: toYear,
    verificationStatus: 'unverified',
    notes: `TODO: validate and refresh values for tax year ${toYear}`
  }
};

writeJson(targetRulePath, nextRulePack);

const sourceSnapshotPath = path.join(taxSourcesDir(), String(fromYear), 'summary.json');
const targetSnapshotDir = path.join(taxSourcesDir(), String(toYear));
const targetSnapshotPath = path.join(targetSnapshotDir, 'summary.json');
ensureDirectory(targetSnapshotDir);

if (fs.existsSync(sourceSnapshotPath)) {
  const snapshot = readJson<Record<string, unknown>>(sourceSnapshotPath);
  const nextSnapshot = {
    ...snapshot,
    year: toYear,
    capturedAt: new Date().toISOString().slice(0, 10),
    sources: [
      'TODO: add official source URL(s) for the new year'
    ]
  };
  writeJson(targetSnapshotPath, nextSnapshot);
} else {
  writeJson(targetSnapshotPath, {
    year: toYear,
    capturedAt: new Date().toISOString().slice(0, 10),
    sources: ['TODO: add official source URL(s)'],
    assertions: []
  });
}

const sourceKnowledgeDir = path.join(taxKnowledgeDir(), String(fromYear));
const targetKnowledgeDir = path.join(taxKnowledgeDir(), String(toYear));
ensureDirectory(targetKnowledgeDir);

if (fs.existsSync(sourceKnowledgeDir)) {
  const files = fs.readdirSync(sourceKnowledgeDir).filter((file) => file.endsWith('.md'));
  for (const file of files) {
    const src = path.join(sourceKnowledgeDir, file);
    const dst = path.join(targetKnowledgeDir, file);
    const content = fs.readFileSync(src, 'utf-8');
    const nextContent = content.replace(new RegExp(String(fromYear), 'g'), String(toYear));
    fs.writeFileSync(
      dst,
      `> TODO: Validate this file against official ${toYear} sources before release.\n\n${nextContent}`,
      'utf-8'
    );
  }
}

console.log(`[OK] Initialized tax year ${toYear} from ${fromYear}`);
console.log(`- Rule pack: ${targetRulePath}`);
console.log(`- Source snapshot: ${targetSnapshotPath}`);
console.log(`- Knowledge dir: ${targetKnowledgeDir}`);
