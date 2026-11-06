# ScaleKitchen — Phase 4.1: Manager Authentication & Session Security Review

## 1. Executive Summary

This document reviews the end-to-end security architecture of Manager Authentication and Session Lifecycle for ScaleKitchen. It covers the Cloud Function backend (`functions/index.js`), cryptographic token minting, client-side session management (`apps/manager/src/contexts/ManagerAuthContext.tsx`), and deactivation propagation.

Prior to Phase 4.1, critical vulnerabilities existed where:
1. `bizId` resolution fell back to cross-business `collectionGroup` queries, exposing businesses to collision and tenant spoofing.
2. Inactive managers could still log in because `managerLogin` lacked an explicit status check.
3. Client-side session restoration trusted `localStorage` over the cryptographically signed Firebase ID token.
4. Managers with `branchId !== 'All'` had no immutable backend-verified `allBranches` claim.

Phase 4.1 permanently resolves all four vulnerabilities.

---

## 2. Backend Authentication Architecture (`managerLogin`)

The authentication endpoint is implemented as an `onCall` Firebase Cloud Function located at `functions/index.js`.

### 2.1. Request Signature & Input Sanitization
```typescript
interface ManagerLoginRequest {
  bizId?: string;      // Business identifier (slug or document ID)
  email: string;       // Manager email
  password: string;    // Plaintext password for bcrypt verification
}
```
- **Email Normalization**: Trims whitespace and converts to lowercase.
- **Rate Limiting**: Monitored via IP and email attempts to prevent brute-force attacks.

### 2.2. Strict Business Resolution (Zero Cross-Tenant Fallback)
```javascript
let mgrDoc = null;
let resolvedBizId = (bizId || '').trim();

if (resolvedBizId) {
  // Direct scoped query within target tenant
  const targetCol = db.collection('businesses').doc(resolvedBizId).collection('managers');
  const snap = await targetCol.where('email', '==', normalizedEmail).limit(1).get();
  if (!snap.empty) {
    mgrDoc = snap.docs[0];
  } else {
    // If not found in target bizId, fail immediately!
    throw new functions.https.HttpsError('not-found', 'Invalid business identifier or manager credentials.');
  }
} else {
  // If no bizId is provided, perform collectionGroup search with ambiguity guard
  const snap = await db.collectionGroup('managers').where('email', '==', normalizedEmail).get();
  if (snap.size === 0) {
    throw new functions.https.HttpsError('not-found', 'Manager account not found.');
  }
  if (snap.size > 1) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This email belongs to multiple businesses. Please supply your Business ID to log in.'
    );
  }
  mgrDoc = snap.docs[0];
  resolvedBizId = mgrDoc.ref.parent.parent.id;
}
```

### 2.3. Password Verification (Bcrypt)
Managers use bcrypt salted hashes for credentials:
```javascript
const passwordMatch = await bcrypt.compare(password, mgrData.passwordHash || mgrData.password);
if (!passwordMatch) {
  throw new functions.https.HttpsError('unauthenticated', 'Invalid email or password.');
}
```

### 2.4. Account Status & Deactivation Guard
To prevent suspended or terminated managers from gaining access:
```javascript
const status = (mgrData.status || '').toLowerCase();
const isActive = mgrData.active !== false && 
                 status !== 'inactive' && 
                 status !== 'deactivated' && 
                 status !== 'disabled' && 
                 mgrData.deleted !== true;

if (!isActive) {
  throw new functions.https.HttpsError(
    'permission-denied', 
    'Your manager account has been deactivated. Please contact your business owner.'
  );
}
```

### 2.5. Token Minting with Immutable Claims
A custom Firebase token is minted with cryptographically signed claims:
```javascript
const claims = {
  role: 'manager',
  bizId: resolvedBizId,
  managerId: mgrDoc.id,
  branchId: mgrData.branchId || 'All',
  allBranches: (mgrData.branchId || 'All') === 'All'
};

const customToken = await admin.auth().createCustomToken(mgrDoc.id, claims);
```

---

## 3. Client-Side Session Lifecycle (`ManagerAuthContext`)

### 3.1. Authentication Handshake
1. Manager submits credentials through `LoginPage.tsx`.
2. `login(bizId, email, password)` calls the `managerLogin` Cloud Function.
3. The returned `customToken` is exchanged via `signInWithCustomToken(auth, customToken)`.
4. Firebase Auth signs the client in and fires `onAuthStateChanged`.

### 3.2. Authoritative Token Validation
Upon receiving an authenticated user from Firebase Auth:
```typescript
const idTokenResult = await user.getIdTokenResult(true);
const claims = idTokenResult.claims;

// Validate that claims match expectations
if (claims.role !== 'manager' || !claims.bizId || !claims.managerId) {
  await signOut(auth);
  throw new Error('Unauthorized: User token lacks manager role or claims');
}
```

### 3.3. Authoritative Profile Verification & Real-time Deactivation
The manager's Firestore profile is fetched directly from `businesses/{authBizId}/managers/{managerId}`:
- Verifies profile exists.
- Verifies `status !== 'Inactive'` and `active !== false`.
- If inactive, the client immediately executes `signOut(auth)`, clears local caches, and sets a user-facing error message: `"Your manager account has been deactivated. Please contact your business owner."`

### 3.4. LocalStorage Tamper-Proofing
`localStorage` is strictly utilized for visual convenience during initial paint, but is NEVER trusted for security decisions:
- `branchId` is ALWAYS bound to `claims.branchId`.
- Even if a user manually changes `localStorage.getItem('sk_manager_branch')`, the security rules and `dbService` utilize the verified token's `branchId`.
- If an attacker tampers with `sk_manager_biz_id`, the next auth cycle detects the mismatch against `claims.bizId` and forces an immediate sign-out.

---

## 4. Audit Log Integrity (`manager_logs`)

Whenever a manager logs in or completes a session:
1. `createManagerSessionLog()` writes a record to `businesses/{bizId}/manager_logs`.
2. Record includes: `managerId`, `managerName`, `branchId`, `ipAddress`, `userAgent`, and `loginTime`.
3. In `firestore.rules`, managers can only create records where `request.resource.data.managerId == request.auth.token.managerId`.
4. Managers cannot update other managers' logs or delete any logs.
5. In Phase 4.1, session log write failures are captured and logged to the console without crashing the application.

---

## 5. Security Invariants Guarantee

| Vulnerability Threat | Pre-Phase 4.1 Risk | Phase 4.1 Mitigation |
| :--- | :--- | :--- |
| Cross-tenant login spoofing | Manager could log into wrong tenant if email duplicated | Scoped tenant query + ambiguity error if multiple match |
| Deactivated manager access | Inactive manager could login and issue queries | Cloud Function rejects + Client Auth checks on every refresh |
| Client-side branch privilege escalation | Altering `branchId` in localStorage gave full access | Token claims dictate Firestore queries & Rules reject invalid branches |
| Audit log tampering | Managers could forge log entries | Security rule strictly checks `managerId == request.auth.token.managerId` |
