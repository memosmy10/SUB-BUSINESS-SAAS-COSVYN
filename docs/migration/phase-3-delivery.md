# ScaleKitchen — Phase 3: Delivery Boy Frontend Extraction Runbook

## 1. Executive Summary
Phase 3 extracts the Delivery Boy (Rider) mobile web application into an independent frontend workspace located at `apps/delivery/` (`@scalekitchen/delivery` v0.1.0).

This extraction achieves:
- Independent build, dev server, and deployment pipeline for delivery operations.
- 100% preservation of existing production functionality, WhatsApp links, URL token formats, and root application fallbacks.
- Complete isolation of Firebase Auth instances via a dedicated named app (`ScaleKitchenDelivery`), eliminating session crosstalk with Owner or Manager sessions on the same origin.
- Zero changes to production Firestore rules, schemas, or Cloud Functions.

---

## 2. Source Provenance & File Inventory

### Files Created:
1. `apps/delivery/package.json` — Independent workspace package `@scalekitchen/delivery`.
2. `apps/delivery/tsconfig.json` — TypeScript config extending base.
3. `apps/delivery/vite.config.ts` — Independent Vite build configuration (dedicated dev port: 3002).
4. `apps/delivery/vercel.json` — Independent Vercel deployment specification (SPA rewrites, security headers).
5. `apps/delivery/index.html` — Mobile-first viewport, meta tags for rider portal.
6. `apps/delivery/.env.example` — Example client environment variables (no secrets).
7. `apps/delivery/README.md` — Workspace documentation and run commands.
8. `apps/delivery/src/vite-env.d.ts` — Vite client typing definitions.
9. `apps/delivery/src/index.css` — Mobile dark-mode and glassmorphic styles.
10. `apps/delivery/src/main.tsx` — Independent React DOM entry point.
11. `apps/delivery/src/App.tsx` — Standalone Delivery Boy application.
12. `apps/delivery/src/services/firebase.ts` — Dedicated named Firebase app (`ScaleKitchenDelivery`), isolated Auth, Firestore, and `driverLogin` callable.
13. `apps/delivery/src/services/driverStore.ts` — Extracted pure domain types, date/session logic, box tracking, and legacy token decoder.
14. `apps/delivery/src/services/whatsapp.ts` — Extracted WhatsApp communication builder.
15. `test/delivery-app.test.ts` — 19 comprehensive unit & integration tests.
16. `docs/migration/phase-3-delivery.md` — This Phase 3 runbook.

### Files Modified:
1. `package.json` — Added root workspace scripts: `build:delivery`, `dev:delivery`, `lint:delivery`.
2. `vitest.config.ts` — Added `test/delivery-app.test.ts` to test runner include array.
3. `docs/architecture/target-architecture.md` — Updated Phase 3 extraction status.
4. `docs/migration/file-migration-map.md` — Updated delivery migration status to dual-operational fallback.
5. `docs/testing/regression-test-plan.md` — Added Phase 3 test cases.

### Files Moved or Deleted:
- **NONE.** Root `pages/DriverPortal.tsx` and root `/driver` route remain 100% intact as production fallback.

---

## 3. Delivery Authentication & Security Model

### Authentication Contract (Preserved):
1. Rider enters 10-digit phone number and 4-6 digit PIN.
2. Frontend calls Firebase Callable Function `driverLogin({ phone, pin })`.
3. Callable enforces rate-limiting (5 failed attempts -> 15 min lock at `auth_rate_limits/driver_{phone}`).
4. Callable reads `driver_auth_lookup/{phone}` and validates PIN hash with `bcrypt.compareSync`.
5. Callable verifies kitchen subscription is not `Expired`.
6. Callable issues Firebase Custom Token with claims:
   ```json
   {
     "role": "driver",
     "bizId": "<business_id>",
     "staffId": "<staff_id>",
     "branchId": "<branch_id>"
   }
   ```
7. Frontend calls `signInWithCustomToken(auth, result.data.token)`.
8. Frontend listens to `onAuthStateChanged` and verifies `claims.role === 'driver'`.
9. Client stores session persistence keys scoped to driver (`driver_is_logged_in`, `driver_session_expires`, `driver_biz_id`, `driver_boy_id`, `driver_name`, `driver_phone`, `driver_branch_id`).
10. Logout invokes `signOut(auth)` on Delivery app's own Auth instance only and clears only `driver_*` keys.

### Firebase Named App Isolation:
- Initialized with `initializeApp(firebaseConfig, 'ScaleKitchenDelivery')`.
- Ensures that testing or using the Delivery app in the same browser does not log out or overwrite the default Firebase Auth instance used by kitchen owners.

---

## 4. Firestore Operations Access Map

| Subcollection / Path | Operation | Performed By | Rule Condition | Fields Used / Updated |
|---|---|---|---|---|
| `businesses/{bizId}` | `get` | Client | `isTenantDriver(userId)` | `businessName`, `logoUrl` |
| `businesses/{bizId}/staff` | `read` (stream) | Client | `isTenantDriver(userId)` | `id`, `name`, `mobile`, `status`, `branchId` |
| `businesses/{bizId}/staff/{staffId}` | `update` | Client | `isTenantDriver && staffId == auth.staffId` | `status`, `currentLat`, `currentLng`, `lastLocationUpdate`, `lastAttendanceDate`, `attendanceMarkedAt`, `updatedAt` |
| `businesses/{bizId}/customers` | `read` (stream) | Client | `isTenantDriver(userId)` | Customer profiles, addresses, plans, uncollected boxes |
| `businesses/{bizId}/customers/{id}` | `update` | Client | `isTenantDriver(userId)` | `uncollectedBoxesCount`, `boxCollections.{date_session}` |
| `businesses/{bizId}/plans` | `read` (stream) | Client | `isTenantDriver(userId)` | Plan configurations, schedules, weekdays |
| `businesses/{bizId}/branches` | `read` (stream) | Client | `isTenantDriver(userId)` | Branch hubs, hubAddress, hubLocationLink |
| `businesses/{bizId}/delivery_logs` | `read` & `write` | Client | `isTenantDriver(userId)` | `date`, `customerId`, `mealTime`, `status`, `boxStatus`, `boxNotes`, `boxCollectedAt` |
| `businesses/{bizId}/driver_manifest/{staffId}` | `read` & `write` | Client | `isTenantDriver(userId)` | Real-time manifest sync, attendance sync |
| `businesses/{bizId}/driver_status/{staffId}` | `read` & `write` | Client | `isTenantDriver && staffId == auth.staffId` | `status`, `isShiftActive`, `currentLat`, `currentLng`, `lastLocationUpdate` |
| `businesses/{bizId}/driver_sessions/{sessionId}` | `read` & `write` | Client | `isTenantDriver(userId)` | Shift attendance, `startTime`, `endTime`, `durationMinutes` |
| `driver_auth_lookup/{phone}` | `get` | Function | `allow get: if true; allow list: if false;` | Phone lookup, `pinHash`, `bizId`, `staffId` |

---

## 5. Legacy Link Backward Compatibility
- Formats supported:
  - `/#/driver?auth=<token>` (obfuscated base64 token)
  - `/#/driver?k=<token>`
  - `/#/driver?token=<token>`
  - `/#/driver?biz=<bizId>&boy=<staffId>&phone=<phone>`
  - Path search strings: `/driver?auth=...`
- Token payload parsed by `decodeDriverToken`: `{ b: bizId, s: boyId, m: mobile, n: name }`.
- Security Guard: Parameters are non-authoritative. They only prefill the rider interface; PIN authentication through the callable Cloud Function remains strictly mandatory.

---

## 6. Verification Commands & Test Results

| Command | Target | Status | Result |
|---|---|---|---|
| `npm test` | Monorepo Test Suite | PASS | 43 / 43 tests passing (24 persistence + 19 delivery) |
| `npm run lint:delivery` | `@scalekitchen/delivery` | PASS | 0 TypeScript errors |
| `npm run build:delivery` | `@scalekitchen/delivery` | PASS | Successfully bundled `dist` in 6.38s |
| `npm run lint:landing` | `@scalekitchen/landing` | PASS | 0 TypeScript errors |
| `npm run build:landing` | `@scalekitchen/landing` | PASS | Successfully bundled `dist` in 5.84s |
| `npm run lint` | Root Application | PASS | 0 TypeScript errors |
| `npm run build` | Root Application | PASS | Successfully bundled `dist` in 13.23s |

---

## 7. Rollback Procedure
If any issue arises with the independent delivery application:
1. The root application's `/driver` route (`/pages/DriverPortal.tsx`) is completely untouched and operational.
2. WhatsApp links continue pointing to the root app fallback without changes.
3. No database migrations were performed; roll back simply by deleting `apps/delivery` or redirecting traffic back to the root application.
