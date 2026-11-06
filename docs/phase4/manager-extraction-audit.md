# Phase 4 Manager Application Extraction Audit

**Document Version:** 1.0.0  
**Phase:** Phase 4 — Manager Application Extraction & Isolation  
**Date:** March 2026  
**Status:** Approved for Implementation  

---

## 4.1 Current Manager Architecture

### Current Runtime Context
In the current monorepo structure, the Branch Manager experience is rendered via:
- **Root Route:** `/#/manager` handled in `/App.tsx` lines 122–128:
  ```tsx
  <Route
    path="/manager"
    element={
      <Suspense fallback={<PageFallback />}>
        <ManagerPortal />
      </Suspense>
    }
  />
  ```
- **Root Page Component:** `/pages/ManagerPortal.tsx` (704 lines).
- **Dual Runtime Dependency Issue:** Currently, `/pages/ManagerPortal.tsx` imports directly from root `/contexts/AuthContext` (`useAuth`), root `/services/dbService.ts` (`useStreamCollection`), and root pages (`Dashboard`, `Customers`, `Prep`, `Deliveries`, `Notes`, `SingleOrders`, `Inventory`, `Messages`, `Payments`, `Invoices`, `Expenses`, `Analytics`, `Settings`, `Profile`, `Support`).
- **Session Model:** Uses a dedicated Firebase Custom Token workflow authenticated against the backend Cloud Function `managerLogin` (`functions/index.js`). Upon login, it invokes `signInWithCustomToken(auth, data.token)`. However, it shares the default Firebase App instance (`[DEFAULT]`) with the Owner SaaS session unless explicitly isolated, which creates a collision risk if an owner and manager authenticate on the same browser profile.

---

## 4.2 Manager Feature Inventory

The Manager Portal delivers operational control for assigned kitchen branches:

1. **Kitchen Connect & Authentication:**
   - **Kitchen ID Resolver:** Resolves a business slug or ID (`bizId`).
   - **Credential Verification:** Takes `email` and `password`.
   - **Backend Handshake:** Invokes `managerLogin` Cloud Function (validates rate limits, bcrypt hash against `businesses/{bizId}/staff/{managerId}`).
   - **Firebase Custom Token Sign-in:** Acquires custom auth token with claims: `{ role: 'manager', bizId: string, managerId: string, branchId: string }`.
   - **Session Audit Logging:** Logs every successful session into `businesses/{bizId}/manager_logs`.

2. **Branch Scoping & Multi-Tenancy:**
   - **Single Branch Assignment:** When `branchId !== 'All'`, all operational views (customers, active plans, delivery dispatches, rider manifests, prep counts) are strictly filtered to the assigned branch ID.
   - **Multi-Branch ("All"):** When a manager has organizational permissions (`branchId === 'All'`), they can view aggregated operations or switch view filters.
   - **Security Boundary:** Token claims are authoritative; client-side overrides are prohibited.

3. **Granular Page Access Control (`allowedPages`):**
   - Configured by the Owner in `BranchManager.allowedPages`.
   - Supported modules:
     - `dashboard` (Real-time operational KPIs, meal breakdown, rider statuses)
     - `customers` (Subscriber profiles, delivery addresses, dietary preferences)
     - `prep` (Meal preparation tallies, veg/non-veg breakdown, diet tags)
     - `deliveries` (Live deliveries, route assignments, driver status)
     - `notes` (Branch operational instructions and kitchen memos)
     - `single_orders` (Ad-hoc single meal bookings)
     - `inventory` (Stock levels, consumables tracking)
     - `messages` (Customer broadcast announcements & SMS/WhatsApp notices)
     - `payments` (Payment records, collected cash/online)
     - `invoices` (Billing records and tax invoices)
     - `expenses` (Branch daily expenses, petty cash)
     - `analytics` (Branch performance charts and fulfillment metrics)
     - `settings` (Branch operational hours and notification toggles)
     - `profile` (Manager account credentials and assigned scope)
     - `support` (Branch helpdesk and platform support)
   - Navigation filters hide restricted tabs. Direct access renders an explicit `Access Restricted` state.

---

## 4.3 Dependency Inventory

### Core Dependencies Required for `apps/manager/`:
- **React 19 & React DOM (`^19.2.1`):** Functional components, hooks, concurrent rendering.
- **Firebase SDK (`11.3.1`):** `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/functions`.
- **Lucide React (`^1.16.0`):** Consistent UI icons matching the ScaleKitchen design system.
- **Recharts (`^3.7.0`):** Analytics charts and donut charts for prep/order breakdown.
- **Tailwind CSS & PostCSS:** Shared design tokens, glassmorphism, responsive navigation.
- **TypeScript & Vite:** Strict typing extending `tsconfig.base.json`, isolated build output to `dist`.

---

## 4.4 Firestore Inventory

Operations executed by the Manager application:

| Collection Path | Read | Write | Scope Enforcement |
| :--- | :---: | :---: | :--- |
| `businesses/{bizId}` | Yes | No | Read-only business profile and branch metadata |
| `businesses/{bizId}/branches` | Yes | No | Read-only branch list |
| `businesses/{bizId}/staff` | Yes | Limited | Reads manager profile & delivery boys |
| `businesses/{bizId}/customers` | Yes | Yes | Filtered by `branchId` if not 'All' |
| `businesses/{bizId}/plans` | Yes | Yes | Filtered by customer branch |
| `businesses/{bizId}/delivery_logs` | Yes | Yes | Daily delivery records for branch |
| `businesses/{bizId}/driver_manifest` | Yes | Yes | Active driver manifests for branch |
| `businesses/{bizId}/driver_status` | Yes | Yes | Real-time driver check-ins |
| `businesses/{bizId}/driver_sessions` | Yes | No | Read-only active driver shifts |
| `businesses/{bizId}/inventory` | Yes | Yes | Branch pantry & consumables |
| `businesses/{bizId}/expenses` | Yes | Yes | Branch petty cash expenses |
| `businesses/{bizId}/notes` | Yes | Yes | Operational shift memos |
| `businesses/{bizId}/manager_logs` | Yes | Yes | Audit log of login sessions |

All operations strictly align with `firestore.rules` under helper `isTenantManager(bizId)`.

---

## 4.5 Authentication & Claims Inventory

- **Cloud Function:** `managerLogin` in `functions/index.js` lines 284–435.
- **Payload:** `{ email, password, bizId }`.
- **Rate Limit:** Firestore doc `auth_rate_limits/manager_{email}` enforces max 5 failed attempts with 15-minute lockout.
- **Password Check:** `bcrypt.compareSync(password, managerDoc.passwordHash)`.
- **Custom Token Claims:**
  ```json
  {
    "role": "manager",
    "bizId": "<business_id>",
    "managerId": "<staff_doc_id>",
    "branchId": "<branch_id_or_All>"
  }
  ```
- **Firebase App Instance Isolation:** In `apps/manager/src/services/firebase.ts`, the app must initialize with:
  ```ts
  initializeApp(firebaseConfig, "ScaleKitchenManager")
  ```
  This guarantees complete independence from any existing `[DEFAULT]` Firebase app instance in localStorage/IndexedDB.
