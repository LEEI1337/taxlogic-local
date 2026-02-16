# Tax Rules Runbook

Date: 2026-02-16

This runbook defines how to maintain year-based tax rules and knowledge packs in this repository.

---

## Scope

Applies to:

- `config/tax-rules/<year>.json`
- `config/tax-sources/<year>/summary.json`
- `config/tax-knowledge/<year>/*.md`
- `scripts/tax-rules/*`

Supported years in current release:

- 2024
- 2025
- 2026

---

## Required Local Checks

Run from repository root:

```powershell
Set-Location -LiteralPath 'c:\Users\Legion\Documents\2026 tax\taxlogic-local'
npm run tax-rules:check
npm run tax-rules:verify
npm run tax-rules:sync-rag
npm run tax-rules:doctor
```

Expected result:

- all commands exit `0`

---

## Monthly Maintenance Cycle

1. Review official sources for tax tariff and credits.
2. Update `config/tax-rules/<year>.json`.
3. Update source snapshot assertions in `config/tax-sources/<year>/summary.json`.
4. Update knowledge markdown files in `config/tax-knowledge/<year>/`.
5. Run local checks.
6. Generate diff report:

```powershell
npm run tax-rules:report -- --from 2025 --to 2026 --out docs/tax-rules-diff-2025-2026.md
```

7. Open PR with:
   - changed rule values
   - source links
   - command output summary

---

## New Year Bootstrap

To scaffold a new year from a previous one:

```powershell
npm run tax-rules:init-year -- --from 2026 --to 2027
```

After scaffold:

1. Replace all `TODO` markers.
2. Validate every copied value against official sources.
3. Run `npm run tax-rules:doctor`.
4. Add/refresh comparison report with `tax-rules:report`.

---

## Runtime Behavior

The app blocks tax-critical flows when rules are not ready.

Blocked operations:

- `analysis:calculate`
- `forms:generate`
- `forms:export`
- `guide:generate`
- `guide:export`

Rule states:

- `ok`
- `missing`
- `stale`
- `invalid`
- `unsupportedYear`

Stale threshold:

- `verifiedAt` older than `staleAfterDays` (default 35 days)

---

## CI Integration

CI workflow:

- `.github/workflows/ci.yml`

Required jobs:

1. `npm run lint`
2. `npm run type-check`
3. `npm test`
4. `npm run tax-rules:check`
5. `npm run tax-rules:verify`

Scheduled freshness workflow:

- `.github/workflows/tax-rules-freshness.yml`

---

## Hotfix Process (Outside Monthly Cycle)

Use this when legal or official values change unexpectedly.

1. Create hotfix branch.
2. Update rule pack + source snapshot + knowledge files.
3. Run full tax-rules command suite.
4. Add short risk note in PR:
   - affected year
   - affected fields
   - user-facing impact
5. Merge after required checks pass.

---

## Incident Handling

If `tax-rules:doctor` fails:

1. Identify failing command.
2. Fix malformed JSON/metadata/schema issues first.
3. Re-run `tax-rules:check`.
4. Re-run `tax-rules:verify`.
5. Re-run `tax-rules:sync-rag`.
6. Re-run `tax-rules:doctor`.

If CI scheduled job fails:

1. Review issue auto-created by freshness workflow.
2. Assign owner and SLA.
3. Complete hotfix process above.

---

## Ownership

Primary owner:

- Tax rules maintainer group

Backup owner:

- Release engineering maintainer
