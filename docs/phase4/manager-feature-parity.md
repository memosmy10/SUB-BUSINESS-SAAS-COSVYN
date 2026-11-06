# ScaleKitchen — Phase 4: Manager Feature Parity Matrix

**Document Version:** 1.0.0  
**Status:** 100% Feature Parity Verified  

---

## 1. Feature Comparison: Root vs. Extracted Standalone App

| Feature | Root `pages/ManagerPortal.tsx` | Extracted `apps/manager/` | Parity Status |
| :--- | :--- | :--- | :---: |
| **Kitchen Business Connect** | Connect via input code or URL param `?biz=` | Connect via input code or URL param `?biz=` | **100%** |
| **Authentication Flow** | Email + Password verified via `managerLogin` | Email + Password verified via `managerLogin` | **100%** |
| **Lockout Enforcement** | 5 failed attempts -> 15 min lock | 5 failed attempts -> 15 min lock | **100%** |
| **Firebase App Scope** | Shared default Firebase app (`[DEFAULT]`) | Dedicated named app (`ScaleKitchenManager`) | **Superior** (zero collision) |
| **Token Claims Verification** | Custom token claims attached | Strict claims verification via `getManagerClaims()` | **Superior** (enforced) |
| **Session Audit Logging** | Written to `businesses/{bizId}/manager_logs` | Written to `businesses/{bizId}/manager_logs` | **100%** |
| **Logout Shift Timing** | Updates `logoutTime` in session log doc | Updates `logoutTime` in session log doc | **100%** |
| **Granular Page Control** | Filtered by `BranchManager.allowedPages` | Filtered by `BranchManager.allowedPages` | **100%** |
| **Branch Scoping** | In-memory filtering via `getManagerBranchId` | Claims-authorized filtering via `useManagerAuth` | **Superior** (tamper-proof) |
| **Dashboard Operations** | Active counts, prep tally, fleet status | Active counts, prep tally, fleet status | **100%** |
| **Kitchen Prep Tally** | Veg/Non-Veg production breakdown | Veg/Non-Veg production breakdown with badges | **100%** |
| **Fleet Deliveries** | Driver list, drop tallies, live routes | Driver list, drop tallies, live routes | **100%** |
| **Branch Customers** | Subscriber directory, pause filters, search | Subscriber directory, pause filters, search | **100%** |
| **Kitchen Notes** | Dietary alerts, memos, shift instructions | Dietary alerts, memos, shift instructions | **100%** |
| **Single Meal Orders** | Ad-hoc bookings, guest orders | Ad-hoc bookings, guest orders | **100%** |
| **Kitchen Inventory** | Pantry stock, reorder warnings | Pantry stock, reorder warnings, quick adjust | **100%** |
| **Customer Messages** | Operational broadcasts, notices | Operational broadcasts, notices | **100%** |
| **Payments Ledger** | Transaction records, payment method | Transaction records, payment method | **100%** |
| **Tax Invoices** | GST invoices, billing summaries | GST invoices, billing summaries | **100%** |
| **Petty Cash Expenses** | Daily branch overheads, expense logging | Daily branch overheads, expense logging | **100%** |
| **Operations Analytics** | Operational health, customer retention | Operational health, customer retention | **100%** |
| **Branch Settings** | Hub address, hours, branch parameters | Hub address, hours, branch parameters | **100%** |
| **Manager Profile** | Session identity, granted permissions | Session identity, granted permissions | **100%** |
| **Help & Support** | Emergency escalation, documentation | Emergency escalation, documentation | **100%** |
| **Mobile Navigation** | Responsive slide-over drawer | Responsive slide-over drawer with backdrop | **100%** |
