# Full-Stack Audit Report and Compliance Checklist

Date: 2026-02-16  
Project: `taxlogic-local`  
Scope: Security, engineering quality, and tax-domain correctness  
Method: Local static/runtime evidence + external official Austrian sources for tax-law checks

## Executive Summary

This audit found multiple high-impact gaps between documented claims and current measured behavior.

- Critical: tax calculation logic is hardcoded to 2024 tariff constants while runtime defaults to tax year 2025 on 2026-02-16.
- High: production dependency risk includes a high-severity `axios` advisory; runtime input validation is not wired into IPC paths; sensitive values are logged.
- Medium: CSP and navigation hardening are partially implemented; CI security step is non-blocking.
- Passes: type-check passes, tests pass (163/163), `.env.local` is not git-tracked, and no hardcoded real API keys were detected in source.

## Scope and Methodology

Audit context was anchored to:

`c:\Users\Legion\Documents\2026 tax\taxlogic-local`

Core evidence commands executed:

- `git status --short --branch`
- `node -v`, `npm -v`, `npm ls --depth=0`
- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm audit --omit=dev --audit-level=moderate`
- `npm audit --audit-level=low`
- targeted code inspection in:
  - `src/main/index.ts`
  - `src/main/preload.ts`
  - `src/main/ipcHandlers.ts`
  - `src/main/utils/logger.ts`
  - `src/backend/utils/validation.ts`
  - `src/backend/agents/analyzerAgent.ts`
  - `src/backend/rag/knowledgeBase.ts`
  - `.github/workflows/ci.yml`
  - `docs/SECURITY_AUDIT.md`
  - `docs/QUALITY_ASSURANCE_REPORT.md`
  - `README.md`

External tax-law verification (official sources):

- BMF tax tariff and rate bands:  
  https://www.bmf.gv.at/themen/steuern/arbeitnehmerinnenveranlagung/steuertarif-absetzbetrage.html
- BMF tax credits / offsets:  
  https://www.bmf.gv.at/themen/steuern/arbeitnehmerinnenveranlagung/steuerabsetzbetrage.html
- BMF pendlerpauschale amounts:  
  https://www.bmf.gv.at/themen/steuern/arbeitnehmerinnenveranlagung/pendlerpauschale-pendlereuro.html
- BMF tax calendar (updated 2026):  
  https://www.bmf.gv.at/themen/steuern/fristen-verfahren/steuertermine.html

## Compliance Checklist (Claims vs Evidence)

| Control / Claim | Source of Claim | Expected State | Observed Evidence | Status | Severity | Patch-Ready Remediation Task |
|---|---|---|---|---|---|---|
| Zero lint errors | `docs/QUALITY_ASSURANCE_REPORT.md:29` | `npm run lint` passes cleanly | `npm run lint` fails with 2 errors + 2 warnings in `src/main/index.ts`; see `src/main/index.ts:43`, `src/main/index.ts:65` | Fail | Medium | Replace CommonJS `require` usage with ESM imports and enforce lint in CI branch protections. |
| Type safety passing | `docs/QUALITY_ASSURANCE_REPORT.md:35` | `npm run type-check` passes | `npm run type-check` passed on 2026-02-16 | Pass | Low | Keep as gate; no change needed. |
| Tests all passing and coverage statement current | `docs/QUALITY_ASSURANCE_REPORT.md:49` | Reported test inventory matches reality | `npm test` passes 163/163 (not 97); docs drift present | Partial | Low | Update QA docs automatically from CI output artifacts after each release candidate. |
| No high production vulnerabilities | `docs/QUALITY_ASSURANCE_REPORT.md:71` and `docs/SECURITY_AUDIT.md:10` | Production dependency audit has no high findings | `npm audit --omit=dev --audit-level=moderate` reports high severity `axios` plus moderate `electron` and `langsmith` chain | Fail | High | Pin/upgrade `axios` to patched version, schedule Electron major upgrade plan, and re-run prod audit as release blocker. |
| Security posture is "strong" with all best practices | `docs/SECURITY_AUDIT.md:18` | Runtime hardening and validation controls are active | Multiple gaps: `sandbox: false` in `src/main/index.ts:130`, permissive navigation in `src/main/index.ts:171`, broad IPC config acceptance in `src/main/ipcHandlers.ts:159` | Partial | High | Harden BrowserWindow security defaults and enforce strict URL origin checks + schema validation in every IPC entrypoint. |
| Input validation is implemented and effective | `docs/SECURITY_AUDIT.md:19` and `docs/SECURITY_AUDIT.md:92` | Validation module is integrated on runtime data boundaries | No references to validation helpers/schemas outside `src/backend/utils/validation.ts` (search returned no matches) | Fail | High | Add Zod validation wrappers for all IPC handlers (`llm`, `interview`, `forms`, `fs`, `settings`, `apiKeys`) with reject-on-fail behavior and tests. |
| No sensitive data in logs | `docs/QUALITY_ASSURANCE_REPORT.md:116` and `docs/SECURITY_AUDIT.md:101` | PII/secrets are redacted before logging | `src/main/ipcHandlers.ts:217` logs interview user input; `src/main/ipcHandlers.ts:948` logs settings values; logger prints args directly in `src/main/utils/logger.ts:56` | Fail | High | Introduce structured redaction (`key`, `token`, `input`, file paths) and prohibit raw payload logging in production mode. |
| API key handling is secure and operational | `docs/SECURITY_AUDIT.md:109` and UI claims in `src/renderer/pages/SettingsPage.tsx:27` | Encrypted storage and runtime provider config stay consistent | Fallback stores keys in plaintext settings when safeStorage unavailable (`src/main/ipcHandlers.ts:875`); UI loads masked keys and writes edited values (`src/renderer/pages/SettingsPage.tsx:40`, `src/renderer/pages/SettingsPage.tsx:55`); key storage path is not connected to LLM runtime config (`src/renderer/stores/appStore.ts:156`) | Partial | High | Keep encrypted store mandatory, add explicit migration/error state if unavailable, and implement key-to-runtime sync in main process (never via renderer plaintext state). |
| Electron navigation hardening prevents remote content abuse | Implied by security docs and architecture | Only trusted app origins should render with preload bridge | URL allowlist uses substring check `includes('localhost')` in `src/main/index.ts:174`, which is not origin-safe; preload exposes privileged invoke surface (`src/main/preload.ts:228`) | Fail | High | Replace substring checks with strict URL parsing + exact origin allowlist (`file://` + explicit dev origin), and deny all other main-frame navigation. |
| CSP is hardened | `docs/SECURITY_AUDIT.md:154` action item for CSP | CSP should avoid `unsafe-eval` and broad wildcard network targets in production | CSP currently includes `script-src 'unsafe-eval'` and `connect-src ... http://*:11434` in `src/renderer/index.html:6` | Partial | Medium | Split dev/prod CSP; remove `unsafe-eval` in prod and constrain connect targets to configured trusted endpoints. |
| Tax calculations are based on current Austrian law | `README.md:142` | Constants should match current filing year behavior | Analyzer uses fixed `TAX_BRACKETS_2024` in `src/backend/agents/analyzerAgent.ts:161` while app defaults to previous year (`src/main/ipcHandlers.ts:198`), which is 2025 on 2026-02-16 | Fail | Critical | Externalize tax rules by year (2024/2025/2026), bind by selected `taxYear`, and add yearly regression suites from official tables. |
| Tax offsets are current for selected year | Same as above | Credits should reflect BMF values for selected filing year | Code values: `VERKEHRSABSETZBETRAG=463` and adult `FAMILIENBONUS=650` in `src/backend/agents/analyzerAgent.ts:172`, `src/backend/agents/analyzerAgent.ts:182`; BMF lists 2025 values 487 and 700 respectively | Fail | Critical | Implement versioned credit tables and automated annual data update check against official BMF source snapshots. |
| Embedded knowledge base is current | README and RAG description | Knowledge snippets should align with active tax year | Default KB metadata/year locked to 2024 across entries in `src/backend/rag/knowledgeBase.ts:90` through `src/backend/rag/knowledgeBase.ts:255` | Fail | High | Version knowledge corpus by year, annotate answer confidence by law year, and block "current law" claims when stale. |
| CI security gate blocks unsafe merges | `.github/workflows/ci.yml` | Security job should fail pipeline on actionable vulnerabilities | Security step is explicitly non-blocking: `npm audit --production --audit-level=high || true` in `.github/workflows/ci.yml:43` | Fail | Medium | Remove `|| true`, define severity threshold policy, and enforce required status check in branch protection. |
| Secret hygiene in VCS | Security docs | Local env secrets should not be tracked | `.env.local` is not tracked; tracked env file is only `.env.example` | Pass | Low | Keep current ignore patterns; add pre-commit secret scanning for defense-in-depth. |

## Findings by Severity

## Critical Findings

### C-1: Outdated tax tariff and credit constants for active filing year

- Classification: Measured + externally verified
- Evidence:
  - `src/backend/agents/analyzerAgent.ts:161` uses `TAX_BRACKETS_2024`
  - `src/backend/agents/analyzerAgent.ts:172` sets `VERKEHRSABSETZBETRAG = 463`
  - `src/backend/agents/analyzerAgent.ts:182` sets adult `FAMILIENBONUS = 650`
  - Runtime tax year defaults to previous year in `src/main/ipcHandlers.ts:198` (2025 on 2026-02-16)
  - BMF 2025 tariff/offset values are different (see official links above)
- Impact:
  - Tax estimation can materially diverge from correct 2025 liabilities/refunds.
  - Derived comparison using current code constants vs 2025 BMF bands showed deltas:
    - taxable income 13,000: +224.60 EUR
    - taxable income 35,000: +636.80 EUR
    - taxable income 70,000: +999.36 EUR
- Exploitability/context:
  - Not an attacker exploit; this is a correctness failure in a high-stakes financial workflow.
- Patch-ready remediation tasks:
1. Create `taxRules/{year}.ts` with bracket and credit tables for each supported year.
2. Add `getTaxRulesForYear(taxYear)` and fail fast for unsupported years.
3. Replace hardcoded constants in analyzer with selected rule set.
4. Add unit and E2E fixtures per year (2024, 2025, 2026) using official BMF values.
5. Add CI check requiring rule refresh before annual release window.

## High Findings

### H-1: Runtime validation not integrated at IPC boundaries

- Classification: Measured
- Evidence:
  - Validation module exists: `src/backend/utils/validation.ts:13`
  - No usage outside module (search with excluded file returned no matches).
- Impact:
  - Renderer-provided payloads reach core services without schema enforcement.
  - Raises risk for malformed input handling, unsafe config injection, and inconsistent behavior.
- Exploitability/context:
  - If renderer is compromised, absence of strict validation magnifies abuse impact.
- Patch-ready remediation tasks:
1. Define per-channel Zod schemas for all `ipcMain.handle` payloads and responses.
2. Add a shared `validateInvoke(channel, payload)` middleware wrapper.
3. Reject invalid payloads with safe error messages and structured error codes.
4. Add handler-level tests for valid/invalid payload paths.

### H-2: Sensitive data can be written to logs

- Classification: Measured
- Evidence:
  - Interview raw input logged in `src/main/ipcHandlers.ts:217`
  - Settings values logged in `src/main/ipcHandlers.ts:948`
  - Logger prints args directly in `src/main/utils/logger.ts:56`
- Impact:
  - PII and possibly secrets may leak to local logs, consoles, CI artifacts, or support bundles.
- Exploitability/context:
  - Privacy risk exists even without external attacker if logs are shared or persisted.
- Patch-ready remediation tasks:
1. Add redaction utility for keys matching `password|key|token|secret|input|path`.
2. Replace payload logging with event metadata only.
3. Set stricter production log level and disable debug payload logs in packaged builds.
4. Add tests for redaction behavior.

### H-3: Navigation/origin checks are not strict enough for preload-exposed IPC

- Classification: Measured + inferred
- Evidence:
  - Allow rule: `navigationUrl.includes('localhost')` in `src/main/index.ts:174`
  - Preload generic invoke bridge in `src/main/preload.ts:228`
  - `sandbox: false` in `src/main/index.ts:130`
- Impact:
  - Remote origin navigation controls are weaker than required for a privileged bridge model.
  - In a renderer compromise scenario, this increases blast radius.
- Exploitability/context:
  - Requires navigation to untrusted content; risk posture should assume this is possible.
- Patch-ready remediation tasks:
1. Parse URL with `new URL()` and enforce exact allowlist origins (`file://` plus explicit dev origin).
2. Deny all untrusted main-frame navigation and all new-window remote loads.
3. Reassess `sandbox` requirement and isolate native-dependent features instead of global disable.
4. Add security tests for navigation policy bypass attempts.

### H-4: API key storage and runtime key use are inconsistent

- Classification: Measured
- Evidence:
  - Fallback plaintext path at `src/main/ipcHandlers.ts:875`
  - UI loads masked keys (`src/renderer/pages/SettingsPage.tsx:40`) and writes values directly (`src/renderer/pages/SettingsPage.tsx:55`)
  - Runtime config sync only forwards provider/ollama fields (`src/renderer/stores/appStore.ts:156`)
  - Provider checks require actual keys in `src/backend/services/llmService.ts:403`, `src/backend/services/llmService.ts:423`
- Impact:
  - BYOK behavior can appear configured but fail at runtime.
  - Key material handling lacks robust guarantees when encryption is unavailable.
- Exploitability/context:
  - Primarily integrity/availability and privacy risk.
- Patch-ready remediation tasks:
1. Move all key->LLM config wiring into main process and never expose key values to renderer state.
2. Treat unavailable `safeStorage` as explicit degraded mode with blocking warning.
3. Store opaque key references in settings; keep secret values only in encrypted store.
4. Add integration tests for save/restart/query across each provider.

### H-5: Dependency risk level is higher than documented

- Classification: Measured
- Evidence:
  - `npm audit --omit=dev --audit-level=moderate`: 7 vulnerabilities (6 moderate, 1 high)
  - `npm audit --audit-level=low`: 44 vulnerabilities (5 low, 12 moderate, 27 high)
- Impact:
  - Production and toolchain attack surface is larger than represented in current docs.
- Exploitability/context:
  - Severity varies; at least one production high advisory (`axios`) has direct fix path.
- Patch-ready remediation tasks:
1. Patch non-breaking advisories first (start with `axios`).
2. Create break-glass upgrade track for Electron and LangChain ecosystem.
3. Add monthly dependency triage with ownership and SLA.
4. Fail CI on production high vulnerabilities.

## Medium Findings

### M-1: CI security gate is non-enforcing

- Classification: Measured
- Evidence:
  - `.github/workflows/ci.yml:43` appends `|| true` to `npm audit`.
- Impact:
  - Security findings do not block merges even when threshold is exceeded.
- Patch-ready remediation tasks:
1. Remove `|| true`.
2. Set explicit policy (`prod high => fail`, `moderate => ticket required`).
3. Mark security job as required in branch protection.

### M-2: CSP is permissive for production hardening standards

- Classification: Measured
- Evidence:
  - `src/renderer/index.html:6` includes `script-src 'unsafe-eval'` and wildcard connect target `http://*:11434`.
- Impact:
  - Increases attack surface if any script injection occurs.
- Patch-ready remediation tasks:
1. Split dev/prod CSP at build time.
2. Remove `unsafe-eval` in prod.
3. Restrict connect destinations to trusted configured hosts only.

### M-3: Lint gate currently fails locally

- Classification: Measured
- Evidence:
  - `npm run lint` failed with import order warnings and `no-var-requires` errors in `src/main/index.ts`.
- Impact:
  - Reduces confidence in quality gate consistency and can block CI workflows unexpectedly.
- Patch-ready remediation tasks:
1. Refactor `require` calls to ESM imports.
2. Run `eslint --fix` for formatting group issues.
3. Add a pre-commit lint check for changed files.

## Low Findings

### L-1: Documentation drift against current runtime state

- Classification: Measured
- Evidence:
  - Docs claim no lint errors and lower vulnerability counts: `docs/QUALITY_ASSURANCE_REPORT.md:29`, `docs/SECURITY_AUDIT.md:10`
  - Current measurements differ significantly.
- Impact:
  - Governance/reporting quality issue; can mislead release decisions.
- Patch-ready remediation tasks:
1. Generate QA/security docs from CI artifacts.
2. Include "last validated" date and command hashes in docs.
3. Require doc refresh in release checklist.

## Patch-Ready Remediation Backlog

## P0 (Blocker Before User-Facing Release)

1. Introduce year-versioned tax rule engine and replace hardcoded 2024 constants.
2. Re-validate analyzer outputs for 2025/2026 against official BMF figures.
3. Implement strict IPC payload validation for all handler families.
4. Remove sensitive payload/value logging and enforce redaction policy.

## P1 (High Priority)

1. Harden navigation/origin allowlisting and reassess `sandbox` setting.
2. Repair API key lifecycle: encrypted storage, runtime injection, and provider status consistency.
3. Patch `axios` production vulnerability and re-run `npm audit --omit=dev`.
4. Make CI security gate blocking and enforce branch protection.

## P2 (Medium Priority)

1. Strengthen production CSP and split from dev allowances.
2. Resolve current lint failures and keep lint green.
3. Version knowledge base content by tax year and add freshness controls.

## Residual Risks and Unknowns

1. Only official public BMF pages were used for external verification; full legal text cross-check (`RIS`) was not fully modeled in this pass.
2. No dynamic penetration test was executed; abuse scenarios are assessed via static review and inferred threat modeling.
3. Cloud-provider behavior was assessed from code paths and tests, not from live provider calls.

## Evidence Appendix

## Baseline Environment (Pre-Remediation Snapshot, 2026-02-16)

- `git status --short --branch`: `## master...origin/master`
- `node -v`: `v24.11.1`
- `npm -v`: `11.6.2`
- `npm ls --depth=0`: captured top-level dependency inventory (includes `axios@1.13.4`, `electron@28.3.3`)

## Quality Commands

- `npm run type-check`: pass
- `npm run lint`: fail (`2 errors`, `2 warnings`, `src/main/index.ts`)
- `npm test`: pass (`8 files`, `163 tests`)

## Security / Dependency Commands

- `npm audit --omit=dev --audit-level=moderate`: fail (`7 vulnerabilities`, including `1 high`)
- `npm audit --audit-level=low`: fail (`44 vulnerabilities`)

Note: Current post-remediation measurements are documented in `Remediation Update (2026-02-16, Implementation Pass)` below.

## Key Local File Evidence

- `src/main/index.ts:130`
- `src/main/index.ts:171`
- `src/main/ipcHandlers.ts:159`
- `src/main/ipcHandlers.ts:217`
- `src/main/ipcHandlers.ts:579`
- `src/main/ipcHandlers.ts:875`
- `src/main/ipcHandlers.ts:948`
- `src/backend/utils/validation.ts:13`
- `src/backend/agents/analyzerAgent.ts:161`
- `src/backend/agents/analyzerAgent.ts:172`
- `src/backend/agents/analyzerAgent.ts:182`
- `src/backend/rag/knowledgeBase.ts:90`
- `.github/workflows/ci.yml:43`
- `docs/SECURITY_AUDIT.md:10`
- `docs/QUALITY_ASSURANCE_REPORT.md:29`

## External Verification Notes

Externally verified facts are based on official BMF pages accessed on 2026-02-16. These facts are cited via direct URLs in the methodology section and used only where explicit values were published.

## Remediation Update (2026-02-16, Implementation Pass)

This section reflects the post-audit implementation status in the same repository.

## Status by Critical/High Theme

| Finding Theme | Previous Status | Current Status | Evidence |
|---|---|---|---|
| Outdated tax tariff and credit constants for active filing year | Fail | Pass | `src/backend/taxRules/loader.ts:79`, `src/backend/agents/analyzerAgent.ts:167`, `src/backend/workflows/taxWorkflow.ts:384`, `config/tax-rules/2024.json`, `config/tax-rules/2025.json`, `config/tax-rules/2026.json` |
| Missing runtime gate for stale/missing tax rules | Fail | Pass | `src/main/ipcHandlers.ts:163`, `src/main/ipcHandlers.ts:505`, `src/main/ipcHandlers.ts:626`, `src/main/ipcHandlers.ts:742` |
| Insufficient IPC input validation at trust boundary | Fail | Pass (top-fix scope) | `src/main/ipcValidation.ts:1`, `src/main/ipcHandlers.ts:281`, `src/main/ipcHandlers.ts:323` |
| Sensitive logging risk | Fail | Pass | `src/main/utils/logger.ts:1` |
| RAG year drift / non-versioned default knowledge | Fail | Pass | `src/backend/rag/knowledgeBase.ts:140`, `src/backend/rag/retriever.ts:94`, `config/tax-knowledge/2024/steuertarif.md`, `config/tax-knowledge/2025/steuertarif.md`, `config/tax-knowledge/2026/steuertarif.md` |
| CI tax-rule gates missing | Fail | Pass | `.github/workflows/ci.yml:21`, `.github/workflows/tax-rules-freshness.yml:1`, `scripts/tax-rules/doctor.ts:1` |

## New Tooling Delivered

1. `tax-rules:check` (schema, year coverage, staleness)
2. `tax-rules:verify` (snapshot assertions)
3. `tax-rules:init-year --from Y --to Z` (year scaffold)
4. `tax-rules:report` (diff report, md/json)
5. `tax-rules:sync-rag --year Y` (knowledge metadata consistency)
6. `tax-rules:doctor` (aggregated health-check)

Script wiring evidence:
- `package.json:21`
- `package.json:22`
- `package.json:23`
- `package.json:24`
- `package.json:25`
- `package.json:26`

## Updated Measurements

- `npm run type-check`: pass
- `npm run lint`: pass
- `npm test`: pass (`10 files`, `178 tests`)
- `npm run tax-rules:doctor`: pass
- `npm audit --omit=dev --audit-level=moderate`: pass (`0 vulnerabilities`)
- `npm audit --audit-level=moderate`: pass
- Full-tree audit snapshot: `5 low vulnerabilities` (0 moderate, 0 high, 0 critical)

## Security Gate Policy (Current)

1. CI keeps production dependency blocking at `moderate`:
   - `.github/workflows/ci.yml:46`
2. Full-tree audit is blocking at `moderate`:
   - `.github/workflows/ci.yml:47`
3. Reason:
   - Production dependency tree is clean at `moderate`.
   - Full-tree high/moderate/critical findings were removed by toolchain upgrades and patched transitive overrides.
   - Remaining full-tree findings are low severity (`@inquirer/prompts -> external-editor -> tmp`) in Forge CLI transitive dependencies.

## Remaining Risk (Not in Top-Fix Scope)

1. Remaining full-tree low-severity advisories are inherited from Forge CLI transitive dependencies.
2. Full removal depends on upstream dependency refresh for the `tmp` advisory chain.
