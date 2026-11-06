# ScaleKitchen — Phase 4.1: Manager Authorization Architecture

**Document Version:** 1.0.0  
**Phase:** 4.1 — Security Hardening & Backend Authorization  

---

## 1. Architectural Philosophy: Genuine Branch-Level Authorization

In a multi-branch food subscription SaaS, branch managers are operational supervisors for physical kitchen locations. While they need write permissions for meal production counts, customer dietary requirements, shift memos, and local delivery dispatches, they must never have access to other kitchen branches or tenant-level financial control.

Security cannot rely on frontend UI filters or `localStorage`. The trusted backend (Firestore Security Rules and Firebase Cloud Functions) must enforce tenant isolation, branch isolation, and least-privilege access.

---

## 2. Authorization Boundary Architecture

```
                                  [Manager Client]
                                         │
                   1. Calls managerLogin({ email, password, bizId })
                                         │
                                         ▼
                             [Cloud Functions v2 Backend]
                                         │
                  2. Validates rate limits (5 failures -> 15 min lock)
                  3. Resolves Manager doc strictly within target business
                  4. Verifies account status: active !== false, status !== 'Inactive'
                  5. Verifies bcrypt.compareSync(password, passwordHash)
                  6. Mints Custom Token with immutable claims:
                     { role: 'manager', bizId, managerId, branchId, allBranches }
                                         │
                                         ▼
                            [ScaleKitchenManager Auth]
                                         │
                  7. Client signs in: signInWithCustomToken(auth, token)
                  8. Client forces token refresh: getIdTokenResult(true)
                  9. Claims verified client-side before setting context state
                                         │
                                         ▼
                             [Cloud Firestore Requests]
                                         │
                  10. Direct rule enforcement via firestore.rules:
                      - isTenantManager(bizId): role == 'manager' && bizId == targetBiz
                      - isBranchAuthorized(branchId): allBranches || branchId == claim.branchId
                      - resource.data.branchId == request.auth.token.branchId
```

---

## 3. Architecture Selection: Hybrid Approach (Approach C)

### Why Approach C (Hybrid) is Chosen:
1. **Firestore Rules for Branch-Scoped Operational Data:**
   - For `customers`, `staff`, `delivery_logs`, `expenses`, `inventory`, `notes`, `single_orders`, `driver_manifest`, `driver_status`, and `plans`, Firestore security rules directly validate:
     ```
     isBranchAuthorized(resource.data.branchId)
     ```
   - For writes, rules validate that the incoming payload's `branchId` matches the manager's claim (`request.resource.data.branchId == request.auth.token.branchId`) and that the existing document cannot be reassigned across branches (`request.resource.data.branchId == resource.data.branchId`).
   - This provides sub-millisecond real-time sync with mathematical security guarantees enforced by the database engine.

2. **Backend Callable for Sensitive Operations:**
   - **Authentication:** Handled exclusively via `managerLogin` Cloud Function (bcrypt password verification, rate limits, token minting).
   - **Password Setting:** Handled exclusively via `setManagerPassword` Cloud Function (Owner-only).
   - **Session Logging:** Secured in rules via strict identity binding (`request.resource.data.managerId == request.auth.token.managerId`), ensuring session logs persist accurately while preventing any manager from forging logs for another manager.

---

## 4. Query Constraint Alignment

Firestore rules require that client queries match rule constraints. For any collection enforced by `resource.data.branchId == request.auth.token.branchId`:
- **Single-Branch Manager:**
  ```ts
  query(collectionRef, where('branchId', '==', verifiedBranchId))
  ```
- **All-Branch Manager (`branchId === 'All'`):**
  ```ts
  query(collectionRef) // Permitted because allBranches claim is true
  ```

This architecture ensures zero client-side bypass, zero data leakage, and compatibility with Firestore query execution.
