import * as fs from 'fs';
import * as path from 'path';

export const REQUIRED_YEARS = [2024, 2025, 2026] as const;

export type RuleCheckState = 'ok' | 'warn' | 'fail';

export interface RuleCheckMessage {
  state: RuleCheckState;
  message: string;
}

export interface SourceAssertion {
  path: string;
  equals: unknown;
}

export interface SourceSnapshot {
  year: number;
  capturedAt: string;
  sources: string[];
  assertions: SourceAssertion[];
}

export function repoRoot(): string {
  return process.cwd();
}

export function taxRulesDir(): string {
  return path.join(repoRoot(), 'config', 'tax-rules');
}

export function taxSourcesDir(): string {
  return path.join(repoRoot(), 'config', 'tax-sources');
}

export function taxKnowledgeDir(): string {
  return path.join(repoRoot(), 'config', 'tax-knowledge');
}

export function getRulePath(year: number): string {
  return path.join(taxRulesDir(), `${year}.json`);
}

export function getSourceSnapshotPath(year: number): string {
  return path.join(taxSourcesDir(), String(year), 'summary.json');
}

export function listRuleYears(): number[] {
  if (!fs.existsSync(taxRulesDir())) {
    return [];
  }

  return fs.readdirSync(taxRulesDir())
    .map((file) => {
      const match = file.match(/^(\d{4})\.json$/);
      return match ? Number(match[1]) : null;
    })
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);
}

export function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  const serialized = JSON.stringify(value, null, 2) + '\n';
  fs.writeFileSync(filePath, serialized, 'utf-8');
}

export function daysOld(dateValue: string, now: Date = new Date()): number {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const diff = now.getTime() - parsed.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function toPathTokens(pathExpression: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pathExpression)) !== null) {
    if (typeof match[1] === 'string') {
      tokens.push(match[1]);
    } else if (typeof match[2] === 'string') {
      tokens.push(Number(match[2]));
    }
  }

  return tokens;
}

export function getByPath(value: unknown, pathExpression: string): unknown {
  const tokens = toPathTokens(pathExpression);
  let cursor: unknown = value;

  for (const token of tokens) {
    if (cursor === null || typeof cursor === 'undefined') {
      return undefined;
    }

    if (typeof token === 'number') {
      if (!Array.isArray(cursor)) {
        return undefined;
      }
      cursor = cursor[token];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[token];
  }

  return cursor;
}

export function ensureDirectory(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

export function parseFlagValue(flag: string, args: string[]): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const next = args[index + 1];
  if (!next || next.startsWith('--')) {
    return undefined;
  }

  return next;
}

export function printMessages(messages: RuleCheckMessage[]): void {
  for (const msg of messages) {
    const prefix = msg.state === 'ok' ? '[OK]' : msg.state === 'warn' ? '[WARN]' : '[FAIL]';
    console.log(`${prefix} ${msg.message}`);
  }
}

export function hasFailures(messages: RuleCheckMessage[]): boolean {
  return messages.some((msg) => msg.state === 'fail');
}
