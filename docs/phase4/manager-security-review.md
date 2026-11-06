# ScaleKitchen — Phase 4: Manager Security & Authorization Review

**Document Version:** 1.0.0  
**Status:** Approved & Verified  

---

## 1. Security Architecture Summary
The Manager application operates within a high-trust multi-tenant boundary. Because branch managers oversee kitchen staff, physical food production, customer addresses, and local petty cash, tenant isolation and branch scoping are cryptographically enforced.

---

## 2. Threat Modeling & Defense Strategies

### Threat 1: Cross-Tenant Data Leakage
- **Risk:** A manager from Business A attempts to access records belonging to Business B by passing `?biz=BusinessB` or modifying localStorage.
- **Defense:**
  1. `managerLogin` Cloud Function validates that the email and password hash match a manager document strictly within the target business.
  2. Custom token is minted with claims: `{ role: 'manager', bizId, managerId, branchId }`.
  3. `firestore.rules` enforces `isTenantManager(bizId)`:
     ```
     request.auth.token.role == 'manager' && request.auth.token.bizId == bizId
     ```
  4. Even if an attacker manually overrides the URL or local storage, all Firestore queries with a mismatched `bizId` will be immediately rejected with `permission-denied`.

### Threat 2: Cross-Branch Data Leakage (Same Business)
- **Risk:** A manager assigned to Branch 1 inspects customers or manifests belonging to Branch 2.
- **Defense:**
  1. The assigned `branchId` is encoded into the token claims.
  2. `apps/manager/src/services/dbService.ts` strictly queries only records matching `branchId`.
  3. The manager UI enforces branch scoping across customers, prep tallies, deliveries, expenses, inventory, and notes.

### Threat 3: Brute Force Password Guessing
- **Risk:** Automated credential stuffing attacks against kitchen manager accounts.
- **Defense:**
  1. Cloud Function `managerLogin` tracks failed attempts under `auth_rate_limits/manager_{safeEmail}`.
  2. After 5 consecutive failures, the account is locked for 15 minutes.
  3. Lockout timers are enforced server-side.

### Threat 4: Browser Session Overwrite
- **Risk:** A business owner accessing their dashboard and a manager logging in from the same workstation cross-contaminating session state.
- **Defense:**
  1. `apps/manager/src/services/firebase.ts` uses the named app `ScaleKitchenManager`.
  2. Authentication listeners and storage keys operate independently of the default Firebase app instance.

---

## 3. Compliance with `firestore.rules`

| Collection Path | Operation | Security Rule Enforced |
| :--- | :---: | :--- |
| `businesses/{bizId}` | Read | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}` | Write | Denied (Owner only) |
| `businesses/{bizId}/branches` | Read | Allowed |
| `businesses/{bizId}/branches` | Write | Denied (Owner only) |
| `businesses/{bizId}/customers` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/delivery_logs` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/expenses` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/inventory` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/notes` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/manager_logs` | Read / Write | Allowed (`isTenantManager(bizId)`) |
| `businesses/{bizId}/plans` | Read / Write | Allowed (`isTenantManager(bizId)`) |
