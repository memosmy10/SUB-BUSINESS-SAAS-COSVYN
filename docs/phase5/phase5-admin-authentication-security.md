# ScaleKitchen — Phase 5: Super Admin Authentication & Security

## 1. Threat Model & Security Objectives

Super Admin access provides omnipotent platform oversight: inspecting tenant financials, reading subscriber metrics, modifying SaaS pricing, and sending global in-app announcements. A compromise of admin privileges represents a catastrophic systemic breach.

### Primary Threat Vectors Mitigated
1. **Tenant Role Spoofing**: An Owner, Manager, or Delivery Rider attempting to navigate to `/admin` or invoke admin endpoints.
2. **Client-Side Flag Injection**: An attacker setting `localStorage.setItem('isAdmin', 'true')` or modifying JavaScript memory flags in browser DevTools.
3. **Unverified Email Collisions**: An attacker registering an account with a public email provider using an admin alias where `email_verified` is `false`.
4. **Session Cross-Contamination**: A platform operator managing their personal cloud kitchen as an Owner and subsequently switching tabs into the Super Admin console.

---

## 2. Cryptographic Token Enforcement

### 2.1. The Zero-Trust Invariant
The frontend never trusts client-side state. Access is granted solely through cryptographically signed Firebase ID token custom claims issued by Google's backend:

```typescript
const idTokenResult = await user.getIdTokenResult(true);
const isSuperAdmin = idTokenResult.claims.admin === true;
```

### 2.2. Server-Authoritative Verification Callable (`verifyAdminAuth`)
To bridge the gap between initial Google/Email sign-in and manual CLI script provisioning, Phase 5 introduces a server-authoritative Cloud Function:

```javascript
exports.verifyAdminAuth = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Super Admin authentication required.');
  }

  const callerUid = request.auth.uid;
  const callerEmail = (request.auth.token?.email || '').toLowerCase().trim();
  const emailVerified = request.auth.token?.email_verified === true;
  const hasAdminClaim = request.auth.token?.admin === true;

  const AUTHORIZED_ADMIN_EMAILS = [
    'cosvynsolutions@gmail.com',
    'admin@scalekitchen.in',
    'memosmy10@gmail.com'
  ];

  const isEmailAuthorized = emailVerified && AUTHORIZED_ADMIN_EMAILS.includes(callerEmail);

  if (!hasAdminClaim && !isEmailAuthorized) {
    throw new HttpsError('permission-denied', 'Access denied. You do not have Super Admin privileges.');
  }

  // Automatic custom claim minting for verified admin emails
  let claimUpdated = false;
  if (!hasAdminClaim && isEmailAuthorized) {
    const user = await admin.auth().getUser(callerUid);
    await admin.auth().setCustomUserClaims(callerUid, {
      ...(user.customClaims || {}),
      admin: true
    });
    claimUpdated = true;
  }

  return { authorized: true, uid: callerUid, email: callerEmail, admin: true, claimUpdated };
});
```

---

## 3. Client Session Lifecycle in `AdminAuthContext`

```
[ User Enters Credentials / Google SSO ]
                  │
                  ▼
   [ Firebase Auth Sign-In ]
                  │
                  ▼
  [ Fetch ID Token with Claims ]
                  │
      ┌───────────┴───────────┐
      │                       │
[ token.admin == true ]   [ No Claim ]
      │                       │
      │                       ▼
      │             [ Call verifyAdminAuth ]
      │                       │
      │           ┌───────────┴───────────┐
      │           │                       │
      │       [ Success ]            [ Failure ]
      │           │                       │
      │     (Token Refreshed)             ▼
      │           │               [ Immediate SignOut ]
      │           │               [ Clear State ]
      │           │               [ Display Error ]
      ▼           ▼
[ Grant Super Admin Session ]
[ Render AdminLayout & Dashboard ]
```

---

## 4. Audit Log Integrity & Security Verification Matrix

| Actor Role | Action Attempted | Defense Mechanism | Result |
| :--- | :--- | :--- | :--- |
| **Owner** | Log into Admin with owner email | `verifyAdminAuth` rejects; `isAdminEmail()` returns false | **Blocked (403 Permission Denied)** |
| **Manager** | Log into Admin with manager token | Token claims role `manager`; no `admin: true` claim | **Blocked (Immediate SignOut)** |
| **Driver** | Log into Admin with driver token | Token claims role `driver`; no `admin: true` claim | **Blocked (Immediate SignOut)** |
| **Attacker** | Inject `isAdmin: true` into `localStorage` | Client auth checks signed JWT token from server | **Blocked (Ignored)** |
| **Attacker** | Register admin email without verification | Security rule requires `email_verified == true` | **Blocked (Firestore Rule Denial)** |
| **Valid Admin** | Sign in with authorized Google/Email | Token verified; custom claim confirmed | **Granted (Full Dashboard Access)** |
