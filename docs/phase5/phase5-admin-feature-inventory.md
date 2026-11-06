# ScaleKitchen — Phase 5: Super Admin Feature Inventory

This document maps all Super Admin features discovered across the codebase to their extraction destinations in `apps/admin/`.

---

## 1. Feature Inventory & Mapping

| Feature ID | Feature Name | Source File | Extracted Destination | Core Functionality | Validation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-01** | Admin Authentication & Gate | `pages/admin/AdminLogin.tsx` | `apps/admin/src/pages/AdminLogin.tsx` | Email/password login with cryptographic custom claim validation, error handling, and redirection | Automated test for valid admin login, rejection of owner/manager/driver credentials |
| **FEAT-02** | Executive Dashboard & KPIs | `pages/admin/AdminDashboard.tsx` | `apps/admin/src/pages/AdminDashboard.tsx` | Active tenants count, MRR calculation, ARPU, churn, lifetime revenue, plan distribution pie chart, revenue area chart | Verify metric formulas and chart rendering with live Firestore streams |
| **FEAT-03** | Owners & Tenant Management | `pages/admin/AdminUsers.tsx` | `apps/admin/src/pages/AdminUsers.tsx` | Searchable/filterable tenant table, trial status tracking, live stats sync button, deep business dossier modal | Test search filters, dossier modal fetching, and tamper detection |
| **FEAT-04** | Live Business Stats Sync | `services/dbService.ts` (`syncBusinessLiveStats`) | `apps/admin/src/services/adminDbService.ts` | Calculates live counts (branches, riders, customers, GMV) and repairs tampered free trial dates | Unit test calculating aggregates and trial expiration checks |
| **FEAT-05** | Deep Tenant Dossier | `services/dbService.ts` (`fetchBusinessDetailedDossier`) | `apps/admin/src/services/adminDbService.ts` | Fetches complete snapshot: branches, staff, active customers, login logs | Test dossier data assembly against mock Firestore snapshot |
| **FEAT-06** | Subscription & Payments Ledger | `pages/admin/AdminPayments.tsx` | `apps/admin/src/pages/AdminPayments.tsx` | Real-time global payment history, search by tenant or transaction ID, CSV export | Verify collectionGroup streaming and payment aggregation |
| **FEAT-07** | Plans & Promotional Pricing | `pages/admin/AdminPlans.tsx` | `apps/admin/src/pages/AdminPlans.tsx` | Configure SaaS subscription plan pricing, features, duration, and promotional discount banner | Test Firestore update to `global_settings/saas_config` |
| **FEAT-08** | Business Growth Analytics | `pages/admin/AdminAnalytics.tsx` | `apps/admin/src/pages/AdminAnalytics.tsx` | Monthly signups histogram, active paid breakdown, top cities geographic concentration | Test aggregation logic and chart rendering |
| **FEAT-09** | Feedback & Support Desk | `pages/admin/AdminFeatureSupport.tsx` | `apps/admin/src/pages/AdminFeatureSupport.tsx` | Manage global feature requests, customer support tickets, and reviews with status transitions | Test status updates on `global_features`, `global_tickets`, `global_reviews` |
| **FEAT-10** | Broadcasts & In-App Popups | `pages/admin/AdminMessages.tsx` | `apps/admin/src/pages/AdminMessages.tsx` | Send in-app broadcast alerts, priority flags, target segmentation (all, active, inactive, specific) | Test create/delete in `admin_messages` |
| **FEAT-11** | WhatsApp Bulk Outreach | `components/admin/WhatsAppOutreach.tsx` | `apps/admin/src/components/WhatsAppOutreach.tsx` | Template selector, placeholder substitution (`{{ownerName}}`, etc.), direct WhatsApp Web launcher | Test phone number sanitization and template replacement |
| **FEAT-12** | Email Bulk Outreach | `components/admin/EmailOutreach.tsx` | `apps/admin/src/components/EmailOutreach.tsx` | Mass email generator, mailto links, batch clipboard copying for external mailing clients | Test mailto URI generation and tenant list filtering |
| **FEAT-13** | Invoice Credits Ledger | `pages/admin/AdminInvoiceCredits.tsx` | `apps/admin/src/pages/AdminInvoiceCredits.tsx` | Track tenant recharge purchases for delivery invoicing credits, per-tenant credit history | Test filtering on `billing_history` for `type === 'Invoice Recharge'` |
| **FEAT-14** | Admin Profile & Settings | `pages/admin/AdminProfile.tsx` | `apps/admin/src/pages/AdminProfile.tsx` | Admin profile information, security status, avatar persistence | Test avatar persistence and profile view |
| **FEAT-15** | Expiring Subscriptions Notification | `layouts/AdminLayout.tsx` | `apps/admin/src/layouts/AdminLayout.tsx` | Top-bar bell badge and dropdown displaying all tenants with plans expiring within 10 days | Verify filtering logic (`daysLeft <= 10 && daysLeft >= 0`) |
| **FEAT-16** | Cloud Maintenance Operations | `pages/admin/AdminUsers.tsx` | `apps/admin/src/pages/AdminUsers.tsx` | Run credential hashing migration (`migratePlaintextCredentials`) and purge legacy driver docs | Verify Cloud Function invocation with admin claims |

---

## 2. Parity Invariants

- **No Mock Fallbacks**: All 16 features will connect to live Firestore and Firebase Auth services.
- **Zero Omission**: Every single action (Dossier modal, login history, WhatsApp launcher, email copier, credential migration button) is ported intact.
- **Root Fallback Preservation**: The existing files in `pages/admin/*`, `layouts/AdminLayout.tsx`, and `components/admin/*` remain active in the root SPA.
