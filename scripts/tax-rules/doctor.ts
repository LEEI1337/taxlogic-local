import { spawnSync } from 'child_process';

const commands: string[] = [
  'tax-rules:check',
  'tax-rules:verify',
  'tax-rules:sync-rag'
];

const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  console.error('[doctor] npm_execpath is not available in environment');
  process.exit(1);
}

let failed = false;

for (const command of commands) {
  console.log(`\n[doctor] Running ${command}`);
  const result = spawnSync(process.execPath, [npmExecPath, 'run', command], {
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`[doctor] ${command} failed with exit code ${result.status}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('\n[doctor] All tax rule checks passed.');
