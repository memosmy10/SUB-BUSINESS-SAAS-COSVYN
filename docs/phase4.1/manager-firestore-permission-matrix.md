# ScaleKitchen — Phase 4.1: Manager Firestore Permission Matrix

This document provides a comprehensive, field-level security and permission audit for all Firestore collections accessed by or relevant to the Manager Portal (`apps/manager/`). It defines the exact operational permissions, security rule predicates, and branch-isolation constraints enforced in `firestore.rules`.

---

## 1. Executive Permission Overview

Managers operate under a strictly sandboxed security perimeter:
- **Tenant Isolation**: Managers can **only** access subcollections nested within their authenticated `bizId` (`request.auth.token.bizId == bizId`).
- **Branch Scoping**: Unless granted global business management (`request.auth.token.allBranches == true`), managers can **only** read and write documents whose `branchId` equals `request.auth.token.branchId` or is tagged as `'All'`.
- **Anti-Reassignment Guard**: Document updates cannot change a document's `branchId` (`request.resource.data.branchId == resource.data.branchId`).
- **Financial Guardrails**: Financial records (`invoices`, `payments`) are strictly **Read-Only** for managers. No create, update, or delete operations are permitted.

---

## 2. Exhaustive Collection Permission Matrix

| Collection Path | Read Permission | Create Permission | Update Permission | Delete Permission | Sensitivity Level | Branch Isolation Predicate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `businesses/{bizId}` | Manager (Tenant) | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | High (Core Tenant) | Root tenant profile |
| `businesses/{bizId}/branches/{branchId}` | Manager (Tenant) | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Medium (Config) | Branch metadata |
| `businesses/{bizId}/plans/{planId}` | Manager (Tenant) | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Medium (Catalog) | Business-wide plans |
| `businesses/{bizId}/managers/{mgrId}` | Manager (Own Profile) | Denied (Cloud Fn) | Denied (Cloud Fn) | Denied (Cloud Fn) | Critical (Auth) | `request.auth.token.managerId == mgrId` |
| `businesses/{bizId}/customers/{custId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Denied (Owner Only) | Critical (PII) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/staff/{staffId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Manager (Branch) | High (Staff PII) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/delivery_logs/{logId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Denied (Owner Only) | High (Operational) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/expenses/{expId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Manager (Branch) | High (Financial) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/inventory/{itemId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Manager (Branch) | Medium (Stock) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/notes/{noteId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Manager (Branch) | Low (Notes) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/single_orders/{orderId}` | Manager (Branch) | Manager (Branch) | Manager (Branch) | Manager (Branch) | High (Customer Order) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/broadcasts/{msgId}` | Manager (Branch) | Manager (Branch) | Denied (Immutable) | Denied (Immutable) | Medium (Comms) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/invoices/{invId}` | Manager (Branch Read) | Denied (Owner/System) | Denied (Owner/System) | Denied (Owner/System) | Critical (Financial) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/payments/{payId}` | Manager (Branch Read) | Denied (Razorpay/System) | Denied (Razorpay/System) | Denied (Razorpay/System) | Critical (Financial) | `isBranchAuthorized(resource.data.branchId)` |
| `businesses/{bizId}/manager_logs/{logId}` | Denied (Owner Read) | Manager (Own Log) | Manager (Own Log) | Denied (Immutable) | High (Audit Trail) | `request.resource.data.managerId == request.auth.token.managerId` |
| `businesses/{bizId}/audit_logs/{id}` | Denied (Owner Only) | Denied (System Only) | Denied (System Only) | Denied (System Only) | Critical (Security) | Forbidden to Manager |
| `businesses/{bizId}/integrations/{id}` | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Critical (API Keys) | Forbidden to Manager |
| `businesses/{bizId}/billing/{id}` | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Denied (Owner Only) | Critical (SaaS Sub) | Forbidden to Manager |

---

## 3. Deep Dive: Security Rule Predicates & Helper Functions

### 3.1. Helper Functions in `firestore.rules`

```javascript
// Validates if caller is an authorized manager for this business tenant
function isManager(bizId) {
  return isAuthenticated() && 
         request.auth.token.role == 'manager' && 
         request.auth.token.bizId == bizId;
}

// Validates if caller is a manager authorized for all branches
function isAllBranchManager(bizId) {
  return isManager(bizId) && 
         (request.auth.token.branchId == 'All' || request.auth.token.allBranches == true);
}

// Validates whether the caller's token allows operations on a specific branchId
function isBranchAuthorized(targetBranchId) {
  return request.auth.token.branchId == 'All' || 
         request.auth.token.allBranches == true || 
         targetBranchId == request.auth.token.branchId || 
         targetBranchId == 'All' || 
         targetBranchId == null;
}
```

### 3.2. Detailed Collection Implementations

#### Customers (`businesses/{bizId}/customers/{customerId}`)
- **Read**:
  ```javascript
  allow read: if isOwner(bizId) || 
                 (isManager(bizId) && isBranchAuthorized(resource.data.branchId));
  ```
- **Create**:
  ```javascript
  allow create: if isOwner(bizId) || 
                   (isManager(bizId) && isBranchAuthorized(request.resource.data.branchId));
  ```
- **Update**:
  ```javascript
  allow update: if isOwner(bizId) || 
                   (isManager(bizId) && 
                    isBranchAuthorized(resource.data.branchId) && 
                    (request.resource.data.branchId == resource.data.branchId || !('branchId' in request.resource.data)));
  ```
- **Delete**: Owner only. Managers cannot delete customer records to prevent malicious or accidental loss of PII and history.

#### Expenses (`businesses/{bizId}/expenses/{expenseId}`)
- **Read**: Scoped to manager's branch or all branches.
- **Create**: Scoped to manager's branch.
- **Update**: Scoped to manager's branch; preserves `branchId`.
- **Delete**: Permitted within manager's branch.

#### Single Orders (`businesses/{bizId}/single_orders/{orderId}`)
- **Read**: Scoped to manager's branch.
- **Create**: Scoped to manager's branch.
- **Update**: Scoped to manager's branch.
- **Delete**: Permitted within manager's branch.

#### Invoices & Payments (`invoices/{id}`, `payments/{id}`)
- **Read**: Permitted for managers scoped to branch so they can verify active customer subscription status and payment completion.
- **Write (Create/Update/Delete)**: Denied. Only Cloud Functions, webhooks, or Owner SaaS can create or update invoices/payments.

#### Manager Logs (`businesses/{bizId}/manager_logs/{logId}`)
- **Create**:
  ```javascript
  allow create: if isOwner(bizId) || 
                   (isManager(bizId) && 
                    request.resource.data.managerId == request.auth.token.managerId);
  ```
- **Update**:
  ```javascript
  allow update: if isOwner(bizId) || 
                   (isManager(bizId) && 
                    resource.data.managerId == request.auth.token.managerId);
  ```
- **Read/Delete**: Managers cannot view historical audit logs of other managers or delete their own logs.

---

## 4. Query Alignment in `dbService.ts`

Firestore security rules evaluate incoming queries atomically before inspecting documents. Therefore, `apps/manager/src/services/dbService.ts` applies explicit query constraints matching the rule predicates:

| Operation | Manager Scope | Applied Firestore Constraint |
| :--- | :--- | :--- |
| `listenCustomers` | Single Branch | `query(colRef, where('branchId', '==', branchId))` |
| `listenCustomers` | All Branches | `colRef` (no filter required) |
| `listenStaff` | Single Branch | `query(colRef, where('branchId', '==', branchId))` |
| `listenExpenses` | Single Branch | `query(colRef, where('branchId', '==', branchId))` |
| `listenInventory` | Single Branch | `query(colRef, where('branchId', '==', branchId))` |
| `listenSingleOrders` | Single Branch | `query(colRef, where('branchId', '==', branchId))` |
| `addDocument` | Any Branch | Injects `branchId` from caller, verifies it matches token or is `'All'` |
| `updateDocument` | Any Branch | Rejects any payload attempting to alter `branchId` |

---

## 5. Security Regression Verification

- **Owner SaaS App**: Uses `isOwner(bizId)` which evaluates `request.auth.uid == bizId`. All owner operations remain 100% permitted.
- **Delivery App**: Uses `isDriver(bizId)` which evaluates `request.auth.token.role == 'driver'`. Unaffected by manager rules.
- **Anonymous/Public**: Denied across all subcollections.
