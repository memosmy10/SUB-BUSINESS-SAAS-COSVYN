# ScaleKitchen — Target Monorepo Architecture

## 1. Architectural Philosophy
ScaleKitchen is a multi-tenant business operating platform built specifically for commercial subscription meal businesses and tiffin services.
The target architecture migrates the application from a single monolithic Single Page Application (SPA) to an npm/pnpm workspace monorepo with independent frontend applications sharing a battle-tested Firebase-first backend.

```
                           +----------------------------------------+
                           |           SCALEKITCHEN REPO            |
                           +----------------------------------------+
                                                |
                 +------------------------------+------------------------------+
                 |                                                             |
                 v                                                             v
        [apps/ (Frontends)]                                           [packages/ (Shared)]
  +------------------------------+                              +------------------------------+
  | apps/landing/                |                              | packages/types/              |
  |   (Public site & calculator) |                              |   (TypeScript contracts)     |
  | apps/owner/                  |                              | packages/utils/              |
  |   (Kitchen HQ Dashboard)     |                              |   (Domain math, formatters)  |
  | apps/delivery/               |                              | packages/ui/                 |
  |   (PWA Rider App & Route)    |                              |   (Design system, charts)    |
  | apps/manager/                |                              | packages/api-client/         |
  |   (Branch Manager Portal)    |                              |   (Firebase & API SDK)       |
  | apps/admin/                  |                              +------------------------------+
  |   (Super Admin Operations)   |
  +------------------------------+
                 |
                 +------------------------------+
                                                |
                                                v
                                  [Firebase-First Backend]
                        +---------------------------------------+
                        | functions/ (Cloud Functions v2)       |
                        |   - driverLogin / managerLogin        |
                        |   - setDriverPin / setManagerPassword |
                        |   - Razorpay orders, verify & webhook |
                        |   - geminiGenerate AI functions       |
                        |   - checkSubscriptionExpiry daily cron|
                        | Cloud Firestore: businesses/{bizId}/* |
                        | Firebase Authentication (Custom Token)|
                        | firestore.rules (Multi-Tenant RBAC)   |
                        +---------------------------------------+
```

## 2. Directory Structure & Workspace Layout
```
/
├── apps/
│   ├── landing/          # Public marketing site, pricing, ROI calculator, legal
│   ├── owner/            # Main kitchen owner HQ (Dashboard, Customers, Deliveries, Settings)
│   ├── delivery/         # Rider mobile web app (Stop-by-stop route, GPS, Dabba tracker)
│   ├── manager/          # Branch manager hub (Restricted by manager_branch_id & allowedPages)
│   └── admin/            # Super admin monitoring console, tenant dossiers, billing analytics
├── functions/
│   ├── index.js          # Cloud Functions v2 runtime
│   └── package.json      # Backend dependencies (firebase-admin, bcryptjs, @google-cloud/firestore)
├── packages/
│   ├── types/            # Canonical TypeScript data contracts (@scalekitchen/types)
│   ├── utils/            # Pure domain functions, dates, pauses, phone cleaners (@scalekitchen/utils)
│   ├── ui/               # Shared glassmorphic components, modals, and charts (@scalekitchen/ui)
│   └── api-client/       # Firebase SDK client, auth context, callable helpers (@scalekitchen/api-client)
├── docs/
│   ├── architecture/     # System architecture specifications
│   ├── migration/        # Step-by-step phased migration runbooks
│   └── testing/          # QA verification & regression test plans
├── firestore.rules       # Hardened multi-tenant production security rules
├── pnpm-workspace.yaml   # Workspace definitions
├── turbo.json            # Task caching & execution pipeline
└── package.json          # Root orchestration & scripts
```

## 3. Core Component Dependencies & Coupling Solutions

### A. Manager / Owner Component Dependency
- **Current Problem:** `ManagerPortal.tsx` directly imports 15 Owner page components (`Dashboard`, `Customers`, `Prep`, `Deliveries`, etc.) and renders them dynamically based on `manager.allowedPages`.
- **Target Resolution:** The operational views (`DashboardView`, `CustomerTableView`, `PrepSheetView`, `DeliveryRouteView`) are factored into shared component modules inside `packages/ui` (or `packages/features-kitchen`). Both `apps/owner` and `apps/manager` import these standardized views. `apps/manager` passes its scoped `manager_branch_id` and permission flags as props, guaranteeing that branch restrictions are clean and isolated.

### B. Delivery Boy Authentication Flow
- **Current & Target Implementation:**
  1. Kitchen Owner assigns PIN via the `setDriverPin` callable. The PIN hash is stored only in the server-only `driver_auth_lookup` collection; plaintext PINs are not retained.
  2. Rider visits `apps/delivery` on mobile smartphone browser.
  3. Rider submits 10-digit mobile number + 4-digit PIN.
  4. Backend Cloud Function `driverLogin` performs:
     - 5-attempt/15-minute rate limit check (`auth_rate_limits/driver_{phone}`).
     - O(1) document read from `driver_auth_lookup/{phone}`.
     - `bcrypt.compareSync(pin, lookupDoc.pinHash)`.
     - Validates kitchen subscription is not `Expired`.
     - Generates Firebase Custom Token with claims `{ role: 'driver', bizId, staffId, branchId }`.
  5. Driver app calls `signInWithCustomToken(auth, customToken)`.
  6. Firestore security rules allow read/write access scoped exclusively to the driver's own tenant and assigned stops.

### C. Legacy Delivery Link Compatibility
- **Preservation Requirement:** Kitchen owners send WhatsApp links to riders containing tokens: `https://app.domain/#/driver?auth=...` or `?biz=...&boy=...`.
- **Target Resolution:**
  - Vercel rewrite or redirect rule redirects `/driver*` to `apps/delivery`.
  - The URL parameter parser and `decodeDriverToken` utility are preserved verbatim in `apps/delivery`, ensuring instant backwards compatibility with existing WhatsApp links in the field.

### D. Production Deployment Safeguards
1. **Zero Database Changes:** Firestore schemas, subcollections, and indexes remain unchanged.
2. **Postinstall WebChannel Patch:** Root `package.json` retains `"postinstall": "node scripts/patch-firestore.cjs"` to prevent Firebase WebChannel assertion crashes (`this.pe -= 1`).
3. **Idempotent Payments:** Razorpay fulfillment is strictly handled server-side in Cloud Functions with `processed_payments/{paymentId}` deduplication.

## 4. Migration Phase Progress
- **Phase 1 (Monorepo Foundation):** COMPLETED. Workspaces (`apps/*`, `packages/*`), `pnpm-workspace.yaml`, `turbo.json`, shared `tsconfig.base.json`, and core packages (`types`, `utils`, `ui`, `api-client`) initialized.
- **Phase 2 (Independent Landing Extraction):** COMPLETED. Public marketing site and legal pages extracted into standalone `apps/landing/` (`@scalekitchen/landing`), with independent build, HTML entry, and dedicated pricing service. Root SPA preserved 100% intact.
- **Phase 3 (Delivery Boy App Extraction):** COMPLETED. Rider mobile web app extracted into independent `apps/delivery/` (`@scalekitchen/delivery`) with isolated named Firebase app instance (`ScaleKitchenDelivery`), custom token claims verification, full tiffin box recollection tracking, shift punch-in/out, GPS tracking, and complete backwards compatibility for existing WhatsApp links. Root SPA `/driver` preserved 100% intact as fallback.
- **Phase 4 (Owner SaaS Extraction):** PENDING. Extract Kitchen Owner HQ into `apps/owner/`.
- **Phase 5 (Branch Manager Portal Extraction):** PENDING. Extract Manager Portal into `apps/manager/`.
- **Phase 6 (Admin Console Extraction):** PENDING. Extract Super Admin into `apps/admin/`.

