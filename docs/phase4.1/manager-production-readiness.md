# ScaleKitchen — Phase 4.1: Manager Production Readiness Assessment

## 1. Executive Summary

This document evaluates the production readiness of the extracted Manager Portal (`apps/manager/`) and the hardened backend configuration (`firestore.rules`, `functions/index.js`) resulting from Phase 4.1.

**Readiness Verdict**: **READY FOR STAGING / PRE-PRODUCTION DEPLOYMENT**  
All identified security gaps, privilege escalation vulnerabilities, permission mismatches, and session spoofing risks have been resolved and verified with automated unit and build tests.

---

## 2. Phase 4.1 Requirements Checklist

| Requirement | Target Component | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Backend Branch Authorization** | `firestore.rules` | **PASSED** | Added `isBranchAuthorized()` checking token `branchId` and `allBranches`. Enforced across all subcollections. |
| **Remove Memory-Only Filtering** | `apps/manager/src/services/dbService.ts` | **PASSED** | Replaced client filtering with explicit Firestore `where('branchId', '==', branchId)` queries matching rule requirements. |
| **Fix Permission Mismatches** | `firestore.rules` | **PASSED** | Fixed rules for `notes`, `single_orders`, `invoices`, `payments`, `broadcasts`, and `manager_logs`. |
| **Secure Manager Login** | `functions/index.js` | **PASSED** | Strict `bizId` resolution without cross-business fallback; ambiguity guard on duplicate emails. |
| **Enforce Deactivation** | `functions/index.js` & `ManagerAuthContext.tsx` | **PASSED** | Cloud Function rejects inactive logins; Client checks status on refresh and signs out inactive accounts. |
| **Immutable Claims** | `functions/index.js` & `firebase.ts` | **PASSED** | Added `allBranches: branchId === 'All'` directly into minted Firebase custom token claims. |
| **Tamper-Proof Session** | `ManagerAuthContext.tsx` | **PASSED** | Token claims are authoritative source of truth. Tampered `localStorage` cannot elevate branch privileges. |
| **Audit Log Persistence** | `ManagerAuthContext.tsx` & `firestore.rules` | **PASSED** | Corrected log permissions; manager log writes now succeed and are tied to `request.auth.token.managerId`. |
| **Operational Views Validation** | `apps/manager/src/pages/*` | **PASSED** | All 15 views verified against hardened security rules and data services. |
| **Preserve Owner & Delivery Apps** | `App.tsx`, `apps/delivery/` | **PASSED** | Owner SaaS (`isOwner`) and Driver portal (`isDriver`) rules and workflows 100% preserved. |
| **Zero Production Deployment** | CI/CD & Deploy Tools | **PASSED** | No deployment tools invoked. All changes kept local to workspace pending user review. |

---

## 3. Operational Views Security Audit

All 15 Manager Operational Views were audited for read/write permissions, branch scoping, and rule alignment:

| Feature / Operational View | Read Scope | Write Scope | Backend Authorized? | Branch Scoped? | Verified? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Dashboard Overview** | `customers`, `delivery_logs`, `staff` | None | Yes | Yes (`branchId`) | Yes |
| **2. Active Subscriptions** | `customers` | Update notes / preferences | Yes | Yes (`branchId`) | Yes |
| **3. Delivery Operations** | `customers`, `delivery_logs`, `staff` | Update delivery status | Yes | Yes (`branchId`) | Yes |
| **4. Kitchen Production** | `customers`, `plans` | None (View-only count) | Yes | Yes (`branchId`) | Yes |
| **5. Staff & Drivers** | `staff` | Add / Edit staff | Yes | Yes (`branchId`) | Yes |
| **6. Expenses Tracking** | `expenses` | Add / Edit / Delete expense | Yes | Yes (`branchId`) | Yes |
| **7. Inventory Management** | `inventory` | Add / Edit stock | Yes | Yes (`branchId`) | Yes |
| **8. Customer Inquiries / Notes**| `notes`, `customers` | Add / Edit notes | Yes | Yes (`branchId`) | Yes |
| **9. Single Orders** | `single_orders` | Add / Edit single order | Yes | Yes (`branchId`) | Yes |
| **10. Customer Messages / Broadcasts** | `broadcasts` | Create broadcast | Yes | Yes (`branchId`) | Yes |
| **11. Customer Directory** | `customers` | Edit customer info | Yes | Yes (`branchId`) | Yes |
| **12. Payments & Invoices (Read)** | `invoices`, `payments` | Read-only | Yes | Yes (`branchId`) | Yes |
| **13. Meal Plans Reference** | `plans` | Read-only | Yes | Yes (`bizId`) | Yes |
| **14. Manager Profile & Settings** | `managers/{managerId}` | None | Yes | Yes (`managerId`) | Yes |
| **15. Session Log Audit** | `manager_logs` | Create / Update own session | Yes | Yes (`managerId`) | Yes |

---

## 4. Remaining Risks & Caveats

1. **Firestore Compound Indexes**:
   Queries using `where('branchId', '==', branchId)` combined with `orderBy('createdAt', 'desc')` (such as in `listenExpenses` or `listenSingleOrders`) may require composite indexes in Firestore if not already defined in `firestore.indexes.json`.
   - *Mitigation*: The queries sort on the client if index errors are received, or indexes should be deployed via `firebase deploy --only firestore:indexes`.
2. **Existing Manager Tokens**:
   Managers currently logged in with tokens minted prior to Phase 4.1 will not have the `allBranches` claim until they log in again or their token refreshes.
   - *Mitigation*: `ManagerAuthContext` handles fallback gracefully by checking `claims.branchId === 'All'` when `allBranches` is undefined.

---

## 5. Rollback Plan

If unexpected production issues arise during deployment:
1. **Firestore Rules Rollback**:
   - Revert `firestore.rules` to the pre-Phase 4.1 commit.
   - Run `firebase deploy --only firestore:rules`.
2. **Cloud Functions Rollback**:
   - Revert `functions/index.js` to previous version.
   - Run `firebase deploy --only functions:managerLogin`.
3. **Manager Application Rollback**:
   - Vercel deployments can be rolled back to the previous deployment instant via the Vercel dashboard.

---

## 6. Deployment Procedure (When Instructed by User)

When the business owner approves deployment:
```bash
# 1. Deploy Cloud Functions
firebase deploy --only functions:managerLogin

# 2. Deploy Firestore Rules
firebase deploy --only firestore:rules

# 3. Deploy Manager App to Vercel (Independent Project)
cd apps/manager && vercel --prod
```
