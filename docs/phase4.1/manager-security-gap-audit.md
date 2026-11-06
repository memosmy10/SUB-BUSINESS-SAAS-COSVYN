# ScaleKitchen — Phase 4.1: Manager Security Gap Audit

**Date:** November 2026  
**Auditor:** Principal Firebase Security Architect & Senior SaaS Multi-Tenant Security Engineer  
**Status:** In Progress / Remediating  

---

## 1. Executive Summary

A comprehensive architectural and security audit was conducted on the extracted ScaleKitchen Branch Manager application (`apps/manager/`), its authentication context (`ManagerAuthContext.tsx`), data service (`dbService.ts`), cloud functions (`functions/index.js`), and database security rules (`firestore.rules`).

While Phase 4 successfully extracted the Manager application structure, independent build pipeline, and UI views, several **critical security vulnerabilities**, **backend authorization gaps**, and **Firestore permission mismatches** were identified that must be remediated to achieve production security standards.

---

## 2. Actual Security Vulnerabilities Identified

### Vulnerability 1: Frontend-Only Branch Filtering (Missing Backend Enforcement)
- **Location:** `apps/manager/src/services/dbService.ts` lines 33–71.
- **Flaw:** `useStreamCollection` issued an unconstrained query:
  ```ts
  const colRef = collection(db, 'businesses', bizId, collectionName);
  const q = query(colRef);
  ```
  The results were filtered in client-side JavaScript memory (`items = items.filter(c => c.branchId === branchId)`).
- **Impact:** Any manager with browser DevTools could execute `getDocs(collection(db, 'businesses', bizId, 'customers'))` and download customer names, phone numbers, delivery addresses, and meal plans across **all other branches** of the business.
- **Rule Defect:** `firestore.rules` helper `isTenantManager(bizId)` only verified:
  ```
  request.auth.token.role == 'manager' && request.auth.token.bizId == bizId
  ```
  It did **not** validate `request.auth.token.branchId` against `resource.data.branchId`.

### Vulnerability 2: Tenant Spoofing via Ambiguous Manager Resolution
- **Location:** `functions/index.js` lines 320–349 (`managerLogin`).
- **Flaw:** If a caller passed an invalid or foreign `bizId` (e.g. `bizId: "victim_kitchen"`), and the manager email was not found in `businesses/victim_kitchen/managers`, the function fell back to a global `collectionGroup('managers')` search:
  ```js
  if (!managerDoc) {
    const groupSnap = await db.collectionGroup('managers').where('email', '==', cleanEmail).limit(1).get();
    if (!groupSnap.empty) {
      managerDoc = { id: docSnap.id, ...docSnap.data() };
      if (!resolvedBizId && docSnap.ref.parent && docSnap.ref.parent.parent) {
        resolvedBizId = docSnap.ref.parent.parent.id;
      }
    }
  }
  ```
  Notice that if `resolvedBizId` was initially provided by the client, line 345 did **not** overwrite `resolvedBizId`! Consequently, `createCustomToken` minted a token with `claims.bizId = "victim_kitchen"`, granting the attacker unauthorized manager access to `victim_kitchen`!
- **Fix:** If `bizId` is supplied, search strictly within `businesses/{bizId}/managers`. Never fall back to another business. If omitted, resolve strictly from the parent doc of the found manager doc. If ambiguous (multiple businesses with same manager email), reject with authentication error.

### Vulnerability 3: Missing Manager Deactivation Check
- **Location:** `functions/index.js` (`managerLogin`).
- **Flaw:** `managerLogin` only checked password hash via `bcrypt.compareSync()`. It completely ignored the manager's operational status. A manager whose account was deactivated, disabled, or set to inactive (`status: 'Inactive'`, `active: false`, or deleted) could continue to authenticate and receive a valid custom token.
- **Fix:** Server-side verification of `managerDoc.status !== 'Inactive' && managerDoc.status !== 'deactivated' && managerDoc.active !== false && !managerDoc.deleted`.

### Vulnerability 4: Client-Side Authorization Source of Truth in Session Restoration
- **Location:** `apps/manager/src/contexts/ManagerAuthContext.tsx` lines 95–109.
- **Flaw:** On page refresh, `ManagerAuthContext` parsed `localStorage.getItem('manager_data')` and blindly executed:
  ```ts
  if (parsed.branchId) setBranchId(parsed.branchId);
  ```
  This allowed a manager with physical access to DevTools to alter their `branchId` to `'All'` or another branch in `localStorage`.
- **Fix:** Token claims retrieved from `user.getIdTokenResult(true)` must be the sole, authoritative source of truth. Cached `localStorage` must never grant or override branch or business permissions.

### Vulnerability 5: Unprotected & Failing Manager Audit Logs
- **Location:** `firestore.rules` line 299 & `apps/manager/src/contexts/ManagerAuthContext.tsx` lines 180–184.
- **Flaw:** The Manager client attempted to write login/logout events to `businesses/{bizId}/manager_logs/{logId}`. However, `firestore.rules` line 301 specified:
  ```
  match /manager_logs/{logId} {
    allow read: if isOwner(userId) || isAdmin();
    allow write: if isOwner(userId) || isAdmin();
  }
  ```
  All manager writes to `manager_logs` were rejected with `permission-denied` and silently swallowed with `console.warn()`. Login/logout audit trails were completely unrecorded.
- **Fix:** Authorize manager session logging in `firestore.rules` with strict anti-forgery guards (`request.resource.data.managerId == request.auth.token.managerId`), or provide a dedicated secure backend callable.

---

## 3. Firestore Permission Mismatches

| Collection | Manager Operation in UI | Current Rule in `firestore.rules` | Actual Status | Required Hardened Rule |
| :--- | :--- | :--- | :--- | :--- |
| `customers` | Read, Create, Update, Delete | `isTenantManager(userId)` | Overly broad (all branches) | Allow only if `isBranchManager(userId, resource.data.branchId)` |
| `staff` | Read delivery drivers | `isTenantManager(userId)` | Overly broad (all branches) | Allow read only if `isBranchManager(userId, resource.data.branchId)` |
| `plans` | Read available plans | `isTenantManager(userId)` | All plans accessible | Allow read if org plan or `isBranchManager(userId, resource.data.branchId)` |
| `branches` | Read branch hub details | `isTenantManager(userId)` | Allowed | Allow read (needed for branch details & hub address) |
| `delivery_logs` | Read, Update | `isTenantManager(userId)` | Overly broad (all branches) | Allow only if `isBranchManager(userId, resource.data.branchId)` |
| `driver_manifest` | Read, Update | `isTenantManager(userId)` | Overly broad (all branches) | Scoped to drivers in manager's branch |
| `driver_status` | Read | `isTenantManager(userId)` | Overly broad (all branches) | Scoped to drivers in manager's branch |
| `expenses` | Read, Create, Delete | `isTenantManager(userId)` | Overly broad (all branches) | Allow only if `isBranchManager(userId, resource.data.branchId)` |
| `inventory` | Read, Create, Update | `isTenantManager(userId)` | Overly broad (all branches) | Allow only if `isBranchManager(userId, resource.data.branchId)` |
| `notes` | Read, Create, Delete | `isOwner(userId) \|\| isAdmin()` | **DENIED** (Manager blocked) | Allow read/write if `isBranchManager(userId, resource.data.branchId)` |
| `single_orders` | Read, Create | `isOwner(userId) \|\| isAdmin()` | **DENIED** (Manager blocked) | Allow read/write if `isBranchManager(userId, resource.data.branchId)` |
| `invoices` | Read tax invoices | `isOwner(userId) \|\| isAdmin()` | **DENIED** (Manager blocked) | Allow read-only if `isBranchManager(userId, resource.data.branchId)` |
| `payments` | Read payment logs | `isOwner(userId) \|\| isAdmin()` | **DENIED** (Manager blocked) | Allow read-only if `isBranchManager(userId, resource.data.branchId)` |
| `manager_logs` | Create & Update session log | `isOwner(userId) \|\| isAdmin()` | **DENIED** (Manager blocked) | Allow create/update for own managerId only |
| `broadcasts` | Read, Create | Caught by default deny | **DENIED** (Manager blocked) | Add `match /broadcasts/{id}` with branch scope |

---

## 4. Manager & Branch Data Schema Specifications

### Manager Document Schema (`businesses/{bizId}/managers/{managerId}`)
```json
{
  "id": "string (doc ID)",
  "name": "string",
  "email": "string (lowercase, unique per business)",
  "mobile": "string (10-digit normalized)",
  "passwordHash": "string (bcrypt hash, 10 rounds)",
  "branchId": "string (branch doc ID, or 'All')",
  "allowedPages": ["dashboard", "prep", "deliveries", "customers", "..."],
  "status": "string ('Active' | 'Inactive')",
  "active": "boolean (true | false)",
  "salary": "number (optional)",
  "aadharNumber": "string (optional)",
  "dateOfJoining": "string (YYYY-MM-DD)",
  "location": "string (optional)",
  "createdAt": "string (ISO timestamp)",
  "updatedAt": "string (ISO timestamp)"
}
```

### Custom Token Claims Schema
```json
{
  "role": "manager",
  "bizId": "string (exact business ID of parent doc)",
  "managerId": "string (exact manager document ID)",
  "branchId": "string (exact branch assignment, or 'All')",
  "allBranches": "boolean (true if branchId === 'All')"
}
```

### Branch Document Schema (`businesses/{bizId}/branches/{branchId}`)
```json
{
  "id": "string",
  "name": "string",
  "city": "string",
  "state": "string",
  "hubAddress": "string",
  "hubLocationLink": "string",
  "hubLat": "number",
  "hubLng": "number",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## 5. Security & Migration Risk Assessment

1. **Firestore Query Constraint Requirement:**
   - In Firestore, rules cannot filter collection streams. When rules enforce `resource.data.branchId == request.auth.token.branchId`, a client query must explicitly specify:
     ```ts
     query(colRef, where('branchId', '==', branchId))
     ```
   - If the client calls `query(colRef)` without the `where` filter, Firestore denies the entire query.
   - For all-branch managers (`branchId === 'All'`), the unconstrained query is valid.
   - **Remediation:** `apps/manager/src/services/dbService.ts` must construct the exact query matching the rule.

2. **Documents Without `branchId` (Legacy Records):**
   - In older deployments, some documents in `plans`, `notes`, or `single_orders` may omit `branchId` or have it set to `null` or `'All'`.
   - **Remediation:** Security rules must explicitly handle missing/null/`'All'` values for org-wide resources (e.g. `!('branchId' in resource.data) || resource.data.branchId == null || resource.data.branchId == 'All'`).

3. **Owner Application Preservation:**
   - The Owner application accesses all collections using `isOwner(userId)`.
   - `isOwner(userId)` is evaluated first and remains completely unconstrained by `branchId`.
   - Zero regression to Owner SaaS or Delivery applications.
