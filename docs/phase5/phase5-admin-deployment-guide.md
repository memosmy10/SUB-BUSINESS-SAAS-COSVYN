# ScaleKitchen — Phase 5: Super Admin Deployment Guide

## 1. Executive Summary

This deployment guide outlines the step-by-step procedure for deploying the newly extracted Super Admin Portal (`apps/admin/`) to Vercel and updating the Firebase backend.

Per prompt instructions, **no production deployments were executed during Phase 5**. All configurations, builds, and routing definitions have been prepared for execution when the user decides to deploy.

---

## 2. Pre-Deployment Checklist

- [x] Independent package and dependencies (`apps/admin/package.json`)
- [x] Dedicated Vite build configuration (`apps/admin/vite.config.ts`)
- [x] SPA rewrite rules & security headers (`apps/admin/vercel.json`)
- [x] Verified build output (`dist/index.html` and bundled assets)
- [x] Server-authoritative callable function (`verifyAdminAuth` in `functions/index.js`)
- [x] 100% test pass rate (82 tests passing across all workspaces)

---

## 3. Manual Deployment Procedure

### Step 1: Deploy Firebase Cloud Functions
Deploy the updated Cloud Functions to register the `verifyAdminAuth` callable:
```bash
# In project root:
firebase deploy --only functions:verifyAdminAuth,functions:migratePlaintextCredentials,functions:purgeLegacyDriverDocs
```

### Step 2: Deploy Firestore Security Rules
Deploy the hardened rules:
```bash
firebase deploy --only firestore:rules
```

### Step 3: Deploy Super Admin Application to Vercel
Deploy `apps/admin` as an independent Vercel project:
```bash
# Navigate to the admin workspace:
cd apps/admin

# Link project or deploy to production:
vercel --prod
```

### Step 4: Configure Vercel Environment Variables
Set the required environment variables in the Vercel project settings:
```
VITE_FIREBASE_API_KEY=AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4
VITE_FIREBASE_AUTH_DOMAIN=subbussinesssaas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=subbussinesssaas
VITE_FIREBASE_STORAGE_BUCKET=subbussinesssaas.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=954257463672
VITE_FIREBASE_APP_ID=1:954257463672:web:6bef130b67567997e9108d
VITE_FIREBASE_MEASUREMENT_ID=G-QHYDRHE6RG
```

### Step 5: Configure Custom Domain (Optional)
In the Vercel dashboard:
- Add domain: `admin.scalekitchen.in` or `ops.scalekitchen.in`
- Configure CNAME record pointing to `cname.vercel-dns.com`

---

## 4. Post-Deployment Verification

1. Navigate to the deployed Admin URL (e.g. `https://admin.scalekitchen.in/#/login`).
2. Attempt login with non-admin credentials (should display "Access denied: Account lacks Super Admin privileges").
3. Log in with authorized super admin credentials (`cosvynsolutions@gmail.com` or `memosmy10@gmail.com`).
4. Confirm real-time metrics populate on the Dashboard.
5. Verify Owners registry, deep dossier modal, and payments ledger load cleanly.

---

## 5. Rollback Plan

If unexpected issues arise after production deployment:
1. **Frontend Rollback**: In the Vercel dashboard for `apps/admin`, click "Deployments" and instantly roll back to the prior deployment.
2. **Backend Rollback**: Revert `functions/index.js` and run `firebase deploy --only functions`.
3. **Fallback Route**: The root Owner SPA at `https://scalekitchen.in/#/admin` remains fully functional as an emergency operational backup.
