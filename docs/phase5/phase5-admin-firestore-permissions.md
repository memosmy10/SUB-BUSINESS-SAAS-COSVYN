# ScaleKitchen — Phase 5: Super Admin Firestore Permissions & Data Governance

## 1. Executive Summary

This document details the Firestore security rules, access permissions, and data governance controls for the Super Admin Portal (`apps/admin/`).

Super Admins require global read and management capabilities across multi-tenant collections (e.g. `businesses`, `billing_history`, `global_settings`), while ensuring that non-admin tenants (Owners, Managers, Delivery boys) are strictly barred from cross-tenant operations.

---

## 2. Firestore Rule Implementation (`firestore.rules`)

### 2.1. The `isAdmin()` Rule Predicate
```javascript
function isAdmin() {
  return request.auth != null && 
         request.auth.token != null && (
           ('admin' in request.auth.token && request.auth.token.admin == true) ||
           (
             'email_verified' in request.auth.token && 
             request.auth.token.email_verified == true &&
             'email' in request.auth.token && (
               request.auth.token.email.lower() == 'cosvynsolutions@gmail.com' || 
               request.auth.token.email.lower() == 'admin@scalekitchen.in' ||
               request.auth.token.email.lower() == 'memosmy10@gmail.com'
             )
           )
         );
}
```

### 2.2. Permissions Matrix by Collection

| Collection Path | Operation | Non-Admin Permission | Super Admin Permission | Governance Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `global_settings/saas_config` | Read | Public / Authenticated | `isAdmin()` | SaaS pricing and promo offers are public read; modifications restricted to Super Admin. |
| `global_settings/saas_config` | Write | **Denied** | `allow write: if isAdmin();` | Prevents unauthorized pricing tampering. |
| `admin_messages/{docId}` | Read | Authenticated Users | `allow read: if request.auth != null;` | Tenants can read system-wide broadcasts. |
| `admin_messages/{docId}` | Write | **Denied** | `allow write: if isAdmin();` | Only Super Admins can publish or delete broadcasts. |
| `global_features/{docId}` | Create | Tenant (`tenantId == auth.uid`) | Authenticated | Tenants post feature requests. |
| `global_features/{docId}` | Update/Delete | Tenant (Own requests only) | `allow update, delete: if isAdmin();` | Super Admin can triage, accept, or reject requests. |
| `global_tickets/{docId}` | Read | Tenant (Own tickets only) | `allow read: if isAdmin();` | Super Admin views all customer support tickets. |
| `global_tickets/{docId}` | Update/Delete | **Denied** | `allow update, delete: if isAdmin();` | Only Super Admin can resolve or close support tickets. |
| `global_reviews/{docId}` | Update/Delete | **Denied** | `allow update, delete: if isAdmin();` | Only Super Admin can moderate reviews. |
| `businesses/{userId}` | List | **Denied** | `allow list: if isAdmin();` | Only Super Admin can list all businesses globally. |
| `businesses/{userId}` | Get | Owner / Assigned Staff | `allow get: if ... || isAdmin();` | Super Admin can inspect business details. |
| `businesses/{userId}` | Update | Owner (Restricted fields) | `allow update: if isAdmin();` | Super Admin can override plan status or fix trial dates. |
| `{path=**}/billing_history/{docId}` | Read | Owner (`uid == path[1]`) | `allow read: if isAdmin();` | CollectionGroup query allows Super Admin to view all payments. |
| `{path=**}/payments/{docId}` | Read | Owner / Branch Manager | `allow read: if isAdmin();` | CollectionGroup query allows Super Admin to aggregate GMV. |
| `orders/{orderId}` | All | **Denied** | Cloud Functions Admin SDK Only | Payment webhook secrets are inaccessible to browser client. |
| `processed_payments/{payId}` | All | **Denied** | Cloud Functions Admin SDK Only | Razorpay transaction logs are strictly backend only. |

---

## 3. Data Integrity & Free Trial Tamper Repair

In multi-tenant SaaS environments, tenant owners may attempt to extend free trial durations by directly patching their business documents. `adminDbService.ts` implements an automated audit and correction routine:

1. **Footprint Collection**: Aggregates timestamps from `createdAt`, `trialOriginalStartDate`, `trialStartDate`, and `recentLoginDates`.
2. **Earliest Anchor Determination**: Calculates the true initial registration date.
3. **Strict 30-Day Limit**: Calculates `earliestFootprint + 30 days`.
4. **Correction Injection**: If `planExpiryDate > correctTrialExpiry`, flags `tamperResetDetected: true`, resets `planExpiryDate` to the true 30-day cutoff, and marks status as `'Expired'` if the date has passed.
