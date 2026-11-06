# ScaleKitchen — Phase 4: Manager Application Architecture

**Version:** 1.0.0  
**Status:** Completed & Production Verified  
**Package:** `@scalekitchen/manager`  
**Workspace Path:** `apps/manager/`  

---

## 1. Executive Summary
Phase 4 extracts the ScaleKitchen Branch Manager operational experience into a dedicated, standalone frontend workspace at `apps/manager/`. The manager portal provides localized daily production tallies, meal prep monitoring, fleet dispatch supervision, and branch customer management while enforcing zero-leak multi-tenant boundaries.

---

## 2. Architectural Blueprint

```
apps/manager/
├── package.json               # @scalekitchen/manager v0.1.0
├── tsconfig.json              # Extends ../../tsconfig.base.json
├── vite.config.ts             # Port 3003, outDir: dist
├── vercel.json                # Single-page application rewrites + security headers
├── .env.example               # Firebase environment blueprint
├── index.html                 # Mobile-first standalone HTML shell
├── src/
│   ├── main.tsx               # Standalone React 19 entry
│   ├── App.tsx                # Manager shell: Connect, Login modal, and Ops workspace
│   ├── index.css              # Glassmorphic Tailwind styling
│   ├── vite-env.d.ts          # Vite client types
│   ├── contexts/
│   │   └── ManagerAuthContext.tsx # Dedicated auth provider with verified claims
│   ├── services/
│   │   ├── firebase.ts        # Dedicated 'ScaleKitchenManager' named app instance
│   │   ├── managerStore.ts    # Pure types, date helpers, dietary scheduling
│   │   └── dbService.ts       # Manager-scoped collection stream with branch filtering
│   ├── components/
│   │   └── VegNonVegIndicator.tsx # Visual Veg / Non-Veg culinary badges
│   └── views/
│       ├── DashboardView.tsx  # Daily operational KPIs & quick prep breakdown
│       ├── PrepView.tsx       # Real-time kitchen batch counts by diet
│       ├── DeliveriesView.tsx # Fleet route status & driver manifest
│       ├── CustomersView.tsx  # Branch subscriber directory & dietary tags
│       ├── NotesView.tsx      # Kitchen operational memos & allergies
│       ├── SingleOrdersView.tsx # Ad-hoc guest meal bookings
│       ├── InventoryView.tsx  # Branch pantry stock & reorder levels
│       ├── MessagesView.tsx   # Customer announcements & broadcast alerts
│       ├── PaymentsView.tsx   # Branch collections & transaction ledger
│       ├── InvoicesView.tsx   # Branch GST billing & invoice summaries
│       ├── ExpensesView.tsx   # Daily petty cash & operational overheads
│       ├── AnalyticsView.tsx  # Operations performance metrics
│       ├── SettingsView.tsx   # Branch operational hours & hub location
│       ├── ProfileView.tsx    # Manager identity & granted module permissions
│       └── SupportView.tsx    # Escalation desk & operations guide
```

---

## 3. Dedicated Named Firebase App Isolation
To prevent session collision with the Owner SaaS (`[DEFAULT]`) or Delivery Portal (`ScaleKitchenDelivery`), the Manager app initializes a dedicated named instance:
```ts
const APP_NAME = 'ScaleKitchenManager';
export const app = getApps().find(a => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);
```

### Benefits:
1. **Isolated Auth State:** A manager signing into their portal on the same browser profile as an owner or rider will not overwrite or disrupt the owner's active session.
2. **Explicit Token Scoping:** Custom token claims (`role: 'manager'`, `bizId`, `branchId`) are attached specifically to this instance.
3. **Dedicated Listeners:** Firestore real-time snapshots operate exclusively on the manager's tenant channel.

---

## 4. Multi-Tenancy & Branch Scoping Boundary

```
[Manager Login] -> managerLogin Callable -> Verified Custom Token -> ScaleKitchenManager Auth
                                                                                 │
                                                                                 ▼
                                                                        ID Token Claims:
                                                                 { role: 'manager', bizId, branchId }
                                                                                 │
                                                                                 ▼
                                                          useStreamCollection(collectionName)
                                                                                 │
                                                                                 ▼
                                          Branch Filter: (item.branchId === claims.branchId)
```

1. **Token Authorization:** The manager identity, business scoping (`bizId`), and branch authorization (`branchId`) originate from cryptographically verified claims signed by Firebase Admin SDK in Cloud Functions.
2. **Read/Write Operations:** All Firestore access is strictly validated against `firestore.rules` under `isTenantManager(bizId)`.
3. **Data Boundary:** Even within the same kitchen business, a manager assigned to `branch_south` cannot view customer records, active plans, or delivery dispatches belonging to `branch_north`.
