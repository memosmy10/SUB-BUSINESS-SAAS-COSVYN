# ScaleKitchen — Phase 5: Super Admin Cloud Functions Security

## 1. Overview of Privileged Admin Cloud Functions

The ScaleKitchen backend employs Firebase Cloud Functions (v2 / Node 20) in `functions/index.js` for privileged administrative operations. All endpoints enforce server-authoritative authentication and authorization checks.

---

## 2. Admin Endpoint Specifications

### 2.1. `verifyAdminAuth` (New in Phase 5)
- **Trigger**: `onCall({ cors: true })`
- **Purpose**: Authoritatively authenticates Super Admin sessions and mints `{ admin: true }` custom claims.
- **Authorization Guard**:
  ```javascript
  const callerEmail = (request.auth.token?.email || '').toLowerCase().trim();
  const emailVerified = request.auth.token?.email_verified === true;
  const hasAdminClaim = request.auth.token?.admin === true;
  const isSuperAdminEmail = ['cosvynsolutions@gmail.com', 'admin@scalekitchen.in', 'memosmy10@gmail.com'].includes(callerEmail) && emailVerified;

  if (!hasAdminClaim && !isSuperAdminEmail) {
    throw new HttpsError('permission-denied', 'Access denied. You do not have Super Admin privileges.');
  }
  ```
- **Claim Minting**: If an authorized administrator authenticates with a verified email but does not have the custom claim, the Admin SDK immediately attaches `{ admin: true }` via `setCustomUserClaims`.

### 2.2. `migratePlaintextCredentials`
- **Trigger**: `onCall({ cors: true })`
- **Purpose**: Migrates unhashed driver PINs and manager passwords to bcrypt hashes and creates dedicated `staff_credentials` documents.
- **Hardened Guard**: Restricts multi-tenant batch migration to verified super admins:
  ```javascript
  const isAdmin = (request.auth.token && request.auth.token.admin === true) || isSuperAdminEmail;
  if (!isAdmin) {
    // Non-admin can only migrate their own business
    businessIds.push(callerUid);
  }
  ```

### 2.3. `purgeLegacyDriverDocs`
- **Trigger**: `onCall({ cors: true })`
- **Purpose**: Deletes legacy shared documents in `global_features` starting with `driver_auth_` and `driver_manifest_` to eliminate cross-tenant leakage.
- **Hardened Guard**: Strictly requires super admin privileges; rejects any non-admin caller with `permission-denied`.

### 2.4. `migrateDriverManifests`
- **Trigger**: `onCall({ cors: true })`
- **Purpose**: Copies legacy driver data into tenant-isolated subcollections (`businesses/{bizId}/driver_manifest/{staffId}`).
- **Hardened Guard**: Validates `token.admin === true` or verified super admin email.

---

## 3. Scheduled Autonomous Background Jobs

1. **`checkSubscriptionExpiry`**: Runs every 24 hours at midnight Asia/Kolkata. Scans all active businesses and automatically marks subscriptions as `Expired` when `planExpiryDate < todayStr`.
2. **`scheduledFirestoreExport`**: Runs daily to create full Firestore snapshots to Google Cloud Storage (`gs://${projectId}.appspot.com/backups/...`) with retention lifecycle rules.

---

## 4. Security Invariants
- **No Client Secrets**: Secrets (Razorpay keys, Gemini API keys) are bound via Firebase Secret Manager (`defineSecret`) and never exposed to the frontend.
- **Fail-Closed**: If `request.auth` is undefined or lacks custom claims, all callables immediately throw `HttpsError('unauthenticated')` or `HttpsError('permission-denied')`.
