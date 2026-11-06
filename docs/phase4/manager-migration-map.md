# ScaleKitchen — Phase 4: Manager Migration Map

**Document Version:** 1.0.0  
**Phase:** Phase 4 — Manager Extraction & Isolation  

---

## 1. Migration Overview
This document records all files created, modified, or preserved during the Phase 4 Manager Portal extraction.

---

## 2. File Status Matrix

| Component / File | Original Location | Extracted Location | Action | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Manager Portal View** | `pages/ManagerPortal.tsx` | `apps/manager/src/App.tsx` | Re-architected into standalone app | Preserved in root for fallback |
| **Root Manager Route** | `App.tsx` (`/#/manager`) | `apps/manager/src/App.tsx` | Kept dual-operational | Untouched in root |
| **Firebase App Instance** | `services/firebase.ts` | `apps/manager/src/services/firebase.ts` | Named app `ScaleKitchenManager` | Zero collision |
| **Auth Context** | `contexts/AuthContext.tsx` | `apps/manager/src/contexts/ManagerAuthContext.tsx` | Dedicated Manager Context | Clean claims boundary |
| **Store & Types** | `services/store.ts` | `apps/manager/src/services/managerStore.ts` | Extracted pure types & date logic | Zero root dependency |
| **Collection Stream** | `services/dbService.ts` | `apps/manager/src/services/dbService.ts` | Scoped by manager claims & branch | Strictly branch-filtered |
| **Veg/Non-Veg Badge** | `components/VegNonVegIndicator.tsx` | `apps/manager/src/components/VegNonVegIndicator.tsx` | Extracted visual badge component | Fully modular |
| **Dashboard Module** | `pages/Dashboard.tsx` | `apps/manager/src/views/DashboardView.tsx` | Manager-specific KPI dashboard | Fully extracted |
| **Kitchen Prep Module** | `pages/Prep.tsx` | `apps/manager/src/views/PrepView.tsx` | Batch prep tallies & dietary breakdown | Fully extracted |
| **Deliveries Module** | `pages/Deliveries.tsx` | `apps/manager/src/views/DeliveriesView.tsx` | Route & driver dispatch view | Fully extracted |
| **Customers Module** | `pages/Customers.tsx` | `apps/manager/src/views/CustomersView.tsx` | Branch subscriber management | Fully extracted |
| **Kitchen Notes** | `pages/Notes.tsx` | `apps/manager/src/views/NotesView.tsx` | Dietary memos & operational notes | Fully extracted |
| **Single Orders** | `pages/SingleOrders.tsx` | `apps/manager/src/views/SingleOrdersView.tsx` | Ad-hoc meal bookings | Fully extracted |
| **Inventory** | `pages/Inventory.tsx` | `apps/manager/src/views/InventoryView.tsx` | Pantry items & reorder alerts | Fully extracted |
| **Broadcast Messages** | `pages/Messages.tsx` | `apps/manager/src/views/MessagesView.tsx` | Customer/driver notices | Fully extracted |
| **Payments** | `pages/Payments.tsx` | `apps/manager/src/views/PaymentsView.tsx` | Branch payment transactions | Fully extracted |
| **Invoices** | `pages/Invoices.tsx` | `apps/manager/src/views/InvoicesView.tsx` | Branch GST invoice records | Fully extracted |
| **Expenses** | `pages/Expenses.tsx` | `apps/manager/src/views/ExpensesView.tsx` | Daily petty cash expenditures | Fully extracted |
| **Analytics** | `pages/Analytics.tsx` | `apps/manager/src/views/AnalyticsView.tsx` | Branch operations reports | Fully extracted |
| **Settings** | `pages/Settings.tsx` | `apps/manager/src/views/SettingsView.tsx` | Branch configuration & hours | Fully extracted |
| **Profile** | `pages/Profile.tsx` | `apps/manager/src/views/ProfileView.tsx` | Manager identity & permissions | Fully extracted |
| **Support** | `pages/Support.tsx` | `apps/manager/src/views/SupportView.tsx` | Helpdesk & escalation desk | Fully extracted |
