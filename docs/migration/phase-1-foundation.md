# Phase 1 Migration Runbook: Production-Safe Monorepo Foundation

## Overview
Phase 1 establishes the monorepo workspace foundation for ScaleKitchen without moving or extracting any active production code. The existing single-page application remains 100% operational in its original root directory.

## Objectives Achieved in Phase 1
1. **Workspace Configuration:**
   - `pnpm-workspace.yaml` configured with `apps/*` and `packages/*`.
   - Root `package.json` updated with `"workspaces": ["apps/*", "packages/*"]`.
   - `turbo.json` created for caching build, lint, and test pipelines.
   - `tsconfig.base.json` created with shared compiler settings.
   - Root `tsconfig.json` updated with path aliases to resolve workspace packages.

2. **Package Scaffolding (Empty foundations):**
   - `packages/types/` initialized with `@scalekitchen/types` package.json & tsconfig.
   - `packages/utils/` initialized with `@scalekitchen/utils` package.json & tsconfig.
   - `packages/ui/` created with `@scalekitchen/ui` package.json, tsconfig, and entry point.
   - `packages/api-client/` initialized with `@scalekitchen/api-client` package.json & tsconfig.

3. **Application Preservation:**
   - `App.tsx`, `pages/`, `components/`, `contexts/`, `services/`, and `layouts/` remain in place.
   - All existing scripts (`npm run dev`, `npm run build`, `npm run lint`, `npm test`) continue to run against the production SPA.
   - `scripts/patch-firestore.cjs` remains in `postinstall`.
   - No database schema, security rules, or Cloud Functions modified.

## Verification Checklist
- [x] `npm run build` builds the original SPA successfully (`dist/index.html`).
- [x] `npm test` passes all 24 unit tests in `test/persistence-and-integrity.test.ts`.
- [x] `npm run lint` (`tsc`) passes with 0 type errors.
- [x] `node --check functions/index.js` validates Cloud Functions syntax.
- [x] Node.js dev server runs without regressions.

## Rollback Procedure
If Phase 1 needs to be rolled back for any reason:
1. Revert `package.json` to omit the `"workspaces"` field and new helper scripts.
2. Revert `tsconfig.json` to remove the 4 workspace path aliases.
3. Remove `pnpm-workspace.yaml`, `turbo.json`, and `tsconfig.base.json`.
4. Remove `packages/ui/` directory and new `package.json` files in `packages/*/`.
5. Run `npm run build` to confirm clean recovery.
