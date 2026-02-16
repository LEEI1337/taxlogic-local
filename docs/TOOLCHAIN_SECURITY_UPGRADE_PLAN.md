# Toolchain Security Upgrade Plan

Date: 2026-02-16  
Status: phase delivered, monitoring active

---

## Context

Production dependency tree is clean at moderate severity.
Full dependency tree is now clean at moderate/high/critical severity. Remaining findings are low-severity dev-toolchain advisories.

Current CI policy:

1. `npm audit --omit=dev --audit-level=moderate` (blocking)
2. `npm audit --audit-level=moderate` (blocking)

---

## Objective

Keep the hardened toolchain baseline stable and remove remaining low advisories as upstream packages are updated.

Current delivered outcome:

1. Keep all existing quality gates green.
2. Full-tree moderate/high/critical findings reduced to zero.
3. CI full-tree blocking threshold tightened from `critical` to `moderate`.

---

## Scope

Primary packages and related ecosystem:

- `electron`
- `@electron-forge/*`
- `electron-rebuild` / `@electron/rebuild`
- `vite` / `vitest` / `@vitest/ui`
- `webpack-dev-server`
- `tar`

---

## Delivered Changes

1. Upgraded runtime/toolchain packages:
   - `electron` -> `^35.7.5`
   - `vitest`/`@vitest/ui` -> `^4.0.18`
   - `@electron/rebuild` -> `^4.0.3`
2. Removed direct legacy `electron-rebuild` dependency.
3. Added transitive security overrides:
   - `tar@^7.5.9`
   - `webpack-dev-server@^5.2.2`
4. Validated build/runtime quality gates:
   - lint, type-check, test, tax-rules doctor, package.
5. Tightened CI full-tree security gate to moderate.

## Remaining Work

1. Track upstream Forge/Inquirer chain for `tmp` advisory removal.
2. Remove local override once upstream path is clean and validated.
3. Keep monthly `tax-rules` and dependency baseline checks.

---

## Acceptance Criteria

1. `npm run lint` passes.
2. `npm run type-check` passes.
3. `npm test` passes.
4. `npm run tax-rules:doctor` passes.
5. Installer build passes.
6. `npm audit --omit=dev --audit-level=moderate` passes.
7. `npm audit --audit-level=moderate` passes.

---

## Owner and Cadence

- Owner: release engineering maintainer
- Cadence: separate milestone, not bundled with tax-rules monthly updates
