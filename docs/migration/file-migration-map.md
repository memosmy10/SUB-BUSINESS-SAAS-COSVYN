# ScaleKitchen — File Migration Mapping Table

This document details the planned migration path for every source file when Phase 2 frontend extraction commences.

| Current File Path | Target Workspace Location | Migration Type | Notes / Safeguards |
| :--- | :--- | :--- | :--- |
| `/App.tsx` | Split into `apps/*/src/App.tsx` | Refactor | Monolith router decomposed into app-specific root routers. |
| `/pages/LandingPage.tsx` | `apps/landing/src/pages/LandingPage.tsx` | Extracted (Dual) | Public landing page and ROI calculator. Original preserved as fallback. |
| `/pages/legal/Terms.tsx` | `apps/landing/src/pages/legal/Terms.tsx` | Extracted (Dual) | Public terms of service. Original preserved as fallback. |
| `/pages/legal/Privacy.tsx` | `apps/landing/src/pages/legal/Privacy.tsx` | Extracted (Dual) | Public privacy policy. Original preserved as fallback. |
| `/pages/legal/Shipping.tsx` | `apps/landing/src/pages/legal/Shipping.tsx` | Extracted (Dual) | Public shipping policy. Original preserved as fallback. |
| `/pages/legal/Refunds.tsx` | `apps/landing/src/pages/legal/Refunds.tsx` | Extracted (Dual) | Public refund policy. Original preserved as fallback. |
| `/pages/legal/Contact.tsx` | `apps/landing/src/pages/legal/Contact.tsx` | Extracted (Dual) | Public contact page. Original preserved as fallback. |
| `/pages/Login.tsx` | `apps/owner/src/pages/Login.tsx` | Move | Kitchen owner authentication. |
| `/pages/Signup.tsx` | `apps/owner/src/pages/Signup.tsx` | Move | Kitchen owner onboarding. |
| `/pages/OnboardingPayment.tsx`| `apps/owner/src/pages/OnboardingPayment.tsx`| Move | Subscription activation. |
| `/pages/Dashboard.tsx` | `packages/ui/src/pages/Dashboard.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Prep.tsx` | `packages/ui/src/pages/Prep.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Customers.tsx` | `packages/ui/src/pages/Customers.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Deliveries.tsx` | `packages/ui/src/pages/Deliveries.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/SingleOrders.tsx` | `packages/ui/src/pages/SingleOrders.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Payments.tsx` | `packages/ui/src/pages/Payments.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Invoices.tsx` | `packages/ui/src/pages/Invoices.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Expenses.tsx` | `packages/ui/src/pages/Expenses.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Inventory.tsx` | `packages/ui/src/pages/Inventory.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Notes.tsx` | `packages/ui/src/pages/Notes.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Analytics.tsx` | `packages/ui/src/pages/Analytics.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Messages.tsx` | `packages/ui/src/pages/Messages.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Support.tsx` | `packages/ui/src/pages/Support.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Settings.tsx` | `packages/ui/src/pages/Settings.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/Profile.tsx` | `packages/ui/src/pages/Profile.tsx` | Shared | Imported by `apps/owner` and `apps/manager`. |
| `/pages/DriverPortal.tsx` | `apps/delivery/src/App.tsx` | Extracted (Dual) | Standalone rider web app extracted. Original root page & /driver route preserved 100% intact as fallback. |
| `/pages/ManagerPortal.tsx` | `apps/manager/src/pages/ManagerPortal.tsx` | Move | Branch manager portal shell. |
| `/layouts/AdminLayout.tsx` | `apps/admin/src/layouts/AdminLayout.tsx` | Move | Admin layout shell. |
| `/pages/admin/*` | `apps/admin/src/pages/*` | Move | Super admin operational pages. |
| `/components/*` | `packages/ui/src/components/*` | Move | Shared UI modals, charts, and widgets. |
| `/contexts/AuthContext.tsx` | `packages/api-client/src/auth/AuthContext.tsx` | Move | Shared Firebase Auth context. |
| `/services/firebase.ts` | `packages/api-client/src/firebase.ts` | Move | Firebase app & callable function exports. |
| `/services/dbService.ts` | `packages/api-client/src/dbService.ts` | Move | Real-time Firestore streams and mutators. |
| `/services/razorpayService.ts`| `packages/api-client/src/razorpay.ts` | Move | Razorpay payment integration helpers. |
| `/services/geminiService.ts` | `packages/api-client/src/gemini.ts` | Move | Gemini AI callable functions wrapper. |
| `/services/store.ts` | `packages/utils/src/store.ts` | Move | Pure date, pause, and business math logic. |
| `/services/routeOptimizer.ts` | `packages/utils/src/routeOptimizer.ts` | Move | Travelling salesperson route optimizer. |
| `/services/messageTemplates.ts`| `packages/utils/src/messageTemplates.ts` | Move | WhatsApp message builders. |
| `/services/moneyUtils.ts` | `packages/utils/src/moneyUtils.ts` | Move | Currency and paise formatting. |
| `/services/saasStore.ts` | `packages/utils/src/saasStore.ts` | Move | Pricing plans & discount logic. |
| `/services/adminStore.ts` | `apps/admin/src/store/adminStore.ts` | Move | Admin configuration & email constants. |
| `/functions/*` | `/functions/*` | Preserve | Cloud Functions v2 backend. |
| `/firestore.rules` | `/firestore.rules` | Preserve | Multi-tenant RBAC rules. |
| `/scripts/patch-firestore.cjs`| `/scripts/patch-firestore.cjs` | Preserve | Critical postinstall patch. |
