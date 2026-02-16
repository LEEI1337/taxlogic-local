import * as fs from 'fs';

import {
  getRulePath,
  listRuleYears,
  parseFlagValue,
  readJson
} from './lib.ts';

function flatten(value: unknown, prefix: string = ''): Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return prefix ? { [prefix]: value } : {};
  }

  if (Array.isArray(value)) {
    return value.reduce((acc, item, index) => {
      const key = `${prefix}[${index}]`;
      return { ...acc, ...flatten(item, key) };
    }, {} as Record<string, unknown>);
  }

  return Object.entries(value as Record<string, unknown>).reduce((acc, [key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return { ...acc, ...flatten(nested, nextPrefix) };
  }, {} as Record<string, unknown>);
}

function renderMarkdownDiff(
  fromYear: number,
  toYear: number,
  changes: Array<{ path: string; from: unknown; to: unknown }>
): string {
  const lines: string[] = [];
  lines.push(`# Tax Rules Diff Report ${fromYear} -> ${toYear}`);
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Path | From | To |');
  lines.push('|---|---:|---:|');

  for (const change of changes) {
    lines.push(`| \`${change.path}\` | ${JSON.stringify(change.from)} | ${JSON.stringify(change.to)} |`);
  }

  if (changes.length === 0) {
    lines.push('| _no changes_ | - | - |');
  }

  lines.push('');
  return lines.join('\n');
}

const args = process.argv.slice(2);
const years = listRuleYears();

const explicitFrom = parseFlagValue('--from', args);
const explicitTo = parseFlagValue('--to', args);
const outputPath = parseFlagValue('--out', args);
const format = parseFlagValue('--format', args) ?? 'md';

const fromYear = explicitFrom ? Number(explicitFrom) : years[years.length - 2];
const toYear = explicitTo ? Number(explicitTo) : years[years.length - 1];

if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
  console.error('Unable to infer years. Provide --from and --to explicitly.');
  process.exit(1);
}

const fromPack = readJson<Record<string, unknown>>(getRulePath(fromYear));
const toPack = readJson<Record<string, unknown>>(getRulePath(toYear));

const flattenedFrom = flatten(fromPack);
const flattenedTo = flatten(toPack);
const allPaths = Array.from(new Set([...Object.keys(flattenedFrom), ...Object.keys(flattenedTo)])).sort();

const changes = allPaths
  .map((entryPath) => ({
    path: entryPath,
    from: flattenedFrom[entryPath],
    to: flattenedTo[entryPath]
  }))
  .filter((entry) => JSON.stringify(entry.from) !== JSON.stringify(entry.to));

const report = format === 'json'
  ? JSON.stringify({ fromYear, toYear, generatedAt: new Date().toISOString(), changes }, null, 2)
  : renderMarkdownDiff(fromYear, toYear, changes);

if (outputPath) {
  fs.writeFileSync(outputPath, report + '\n', 'utf-8');
  console.log(`[OK] Report written to ${outputPath}`);
} else {
  console.log(report);
}
