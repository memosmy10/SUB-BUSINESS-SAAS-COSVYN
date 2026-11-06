# ScaleKitchen — Phase 5: Super Admin Portal Extraction Audit

## 1. Executive Summary

This audit assesses the pre-migration state of the Super Admin portal in the ScaleKitchen production repository. The Super Admin functionality was previously embedded inside the root Vite React SPA (`pages/admin/*`, `layouts/AdminLayout.tsx`, `components/admin/*`), sharing runtime state, routing, and Firebase contexts with the multi-tenant Owner SaaS application.

The goal of Phase 5 is to extract the Super Admin portal into a fully independent, production-grade frontend workspace at `apps/admin/`, with isolated authentication, cryptographic claim enforcement, dedicated routing, and zero-trust backend authorization, while strictly preserving the root Admin pages as a non-breaking fallback.

---

## 2. Pre-Migration Repository Inventory

### 2.1. Admin Pages & Views
| Existing File Path | Component | Purpose | Data Source |
| :--- | :--- | :--- | :--- |
| `pages/admin/AdminLogin.tsx` | `AdminLogin` | Authentication gateway for Super Admins | Firebase Auth + `isAdminEmail()` client check |
| `pages/admin/AdminDashboard.tsx` | `AdminDashboard` | High-level KPI dashboard, active MRR, live revenue, churn, and platform trends | `businesses` collection + `billing_history` collectionGroup |
| `pages/admin/AdminUsers.tsx` | `AdminUsers` | Tenant registry, live metrics sync, deep dossier modal, credentials migration | `businesses` collection + subcollections |
| `pages/admin/AdminPayments.tsx` | `AdminPayments` | Global billing and subscription payment transactions | `billing_history` collectionGroup + `businesses` |
| `pages/admin/AdminPlans.tsx` | `AdminPlans` | Platform pricing tiers and promotional offers editor | `global_settings/saas_config` |
| `pages/admin/AdminAnalytics.tsx` | `AdminAnalytics` | Chronological tenant signups, plan distribution, top cities | `businesses` collection + `billing_history` |
| `pages/admin/AdminFeatureSupport.tsx` | `AdminFeatureSupport` | Global feature requests, support tickets, and business reviews | `global_features`, `global_tickets`, `global_reviews` |
| `pages/admin/AdminMessages.tsx` | `AdminMessages` | In-app broadcasts, feature announcements, WhatsApp & Email bulk outreach | `admin_messages` + WhatsApp/Email web links |
| `pages/admin/AdminInvoiceCredits.tsx` | `AdminInvoiceCredits` | Tenant invoice recharge tracking and token usage | `billing_history` filtered by `'Invoice Recharge'` |
| `pages/admin/AdminProfile.tsx` | `AdminProfile` | Super admin user profile, security details, avatar settings | Firebase Auth + LocalStorage |

### 2.2. Admin Layout & Shared Components
| File Path | Description |
| :--- | :--- |
| `layouts/AdminLayout.tsx` | Desktop/Mobile responsive sidebar, top bar with expiring tenant alerts, navigation |
| `components/admin/WhatsAppOutreach.tsx` | WhatsApp template builder, placeholder engine, dynamic link launcher |
| `components/admin/EmailOutreach.tsx` | Bulk email outreach client, mailto launcher, clipboard copy utility |
| `components/admin/outreachUtils.ts` | WhatsApp number sanitizer, template variable interpolator, canvas image converter |

### 2.3. Admin Backend & Data Services
| File Path | Description |
| :--- | :--- |
| `services/adminStore.ts` | Data models (`TenantUser`, `Subscription`, `FeatureRequest`, `SupportTicket`), `ADMIN_EMAILS` |
| `services/dbService.ts` | `useAdminTenants`, `useAdminBillingHistory`, `useGlobalCollection`, `syncBusinessLiveStats`, `fetchBusinessDetailedDossier` |
| `scripts/set-admin-claim.cjs` | Node script to provision `{ admin: true }` custom claim via Firebase Admin SDK |
| `functions/index.js` | Cloud Functions: `migratePlaintextCredentials`, `purgeLegacyDriverDocs`, `migrateDriverManifests` |
| `firestore.rules` | Security rule predicate `isAdmin()`: checks custom claim `admin == true` or verified admin email |

---

## 3. Discovered Architectural & Security Vulnerabilities

Prior to Phase 5, several critical security and operational gaps existed:
1. **Shared Authentication Session**: Logging into the Owner app and the Admin portal shared the same Firebase Auth context. An admin logging in as an owner could inadvertently expose admin routes, or vice versa.
2. **Client-Side Authorization Check**: Root `App.tsx` protected `/admin` using `isAdminEmail(currentUser.email)`. While Firestore security rules prevented unauthorized document reads, the client-side UI route protection relied entirely on a hardcoded string array check on the client.
3. **Missing Server-Side Auth Verification Endpoint**: When admins log in, their token may not immediately contain the `{ admin: true }` custom claim until `scripts/set-admin-claim.cjs` is run manually. No automated, server-verified claim minting endpoint existed.
4. **Monolithic Bundle**: Recharts, canvas manipulation, and admin-specific reporting added ~800KB to the public and owner bundles.
5. **Collection Group Query Scalability**: `useAdminBillingHistory` performed an unindexed `collectionGroup('billing_history')` query without pagination or date boundaries.

---

## 4. Extraction Strategy

1. **Standalone Workspace**: Extract to `apps/admin` with independent Vite build, TypeScript configuration, and Vercel routing.
2. **Cryptographic Token Enforcement**: Implement `AdminAuthContext` that inspects ID token custom claims (`token.admin === true`), with fallback to a server-side verification callable (`verifyAdminAuth`) that mints the claim on verified emails.
3. **Session Partitioning**: Configure isolated Firebase Auth persistence namespaces to eliminate session cross-contamination with the Owner, Manager, or Delivery boy applications.
4. **Preserve Fallbacks**: Retain root Admin routes in `App.tsx` to maintain 100% backward compatibility for existing Vercel deployments.
