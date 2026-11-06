# ScaleKitchen — Phase 5: Super Admin Architecture

## 1. System Context & Overview

The Super Admin application (`apps/admin/`) is an independent workspace within the ScaleKitchen monorepo. It serves as the master operations, governance, analytics, and tenant management console for the SaaS platform.

```
scalekitchen/
├── apps/
│   ├── landing/          (Public conversion marketing, port 3001)
│   ├── delivery/         (Driver manifest & live route execution, port 3002)
│   ├── manager/          (Branch operations & staff dispatch, port 3003)
│   ├── admin/            (Super Admin Operations & Tenant Governance, port 3004)
│   └── ...               (Root Owner SaaS SPA, port 3000)
├── functions/            (Firebase Cloud Functions backend)
└── packages/             (Shared types, utils, api-client)
```

---

## 2. Directory Structure of `apps/admin/`

```
apps/admin/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── EmailOutreach.tsx          # Bulk email campaign generator & clipboard tool
│   │   ├── WhatsAppOutreach.tsx       # Zero-cost bulk WhatsApp queue runner
│   │   └── outreachUtils.ts           # Number sanitizers, template variables, CSV export
│   ├── contexts/
│   │   └── AdminAuthContext.tsx       # Zero-trust cryptographic session & claims
│   ├── layouts/
│   │   └── AdminLayout.tsx            # Responsive sidebar, notification bell, user avatar
│   ├── pages/
│   │   ├── AdminAnalytics.tsx         # Signups growth, plan popularity, top cities
│   │   ├── AdminDashboard.tsx         # MRR, churn, lifetime revenue, live kitchen stats
│   │   ├── AdminFeatureSupport.tsx    # Feature requests, tickets, reviews management
│   │   ├── AdminInvoiceCredits.tsx    # Tenant delivery invoice recharge ledger
│   │   ├── AdminLogin.tsx             # Multi-factor authentication & Google SSO gate
│   │   ├── AdminMessages.tsx          # In-app broadcasts, popups, outreach dashboard
│   │   ├── AdminPayments.tsx          # Platform-wide subscription payments ledger
│   │   ├── AdminPlans.tsx             # SaaS pricing tier & promo banner editor
│   │   ├── AdminProfile.tsx           # Admin profile details & avatar persistence
│   │   └── AdminUsers.tsx             # Tenant registry, deep dossier, stats sync
│   ├── services/
│   │   ├── adminDbService.ts          # Real-time Firestore streams & aggregate math
│   │   ├── adminStore.ts              # Data contracts, date formatting, pure helpers
│   │   └── firebase.ts                # Isolated Firebase app instance (`ScaleKitchenAdminApp`)
│   ├── App.tsx                        # Protected router & root context provider
│   ├── index.css                      # Sleek dark theme, glassmorphism, scrollbars
│   └── main.tsx                       # React 19 entry point
├── index.html                         # Dedicated HTML entry point
├── package.json                       # @scalekitchen/admin package definition
├── tsconfig.json                      # Workspace TypeScript configuration
├── vercel.json                        # SPA fallback rewrites & security headers
├── .env.example                       # Environment variables template
└── README.md                          # Application documentation
```

---

## 3. Technology Stack & Design Decisions

| Category | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript | Standard monorepo framework; high performance and type safety. |
| **Build Tool** | Vite 6 | Rapid HMR and optimized tree-shaken production bundles. |
| **Data Viz** | Recharts 3 | Responsive SVG area charts, bar charts, and interactive donut pies. |
| **Iconography** | Lucide React | Consistent icon set matching the ScaleKitchen design language. |
| **Routing** | React Router 7 (HashRouter) | Prevents static hosting 404s on subpaths; enables direct bookmarking without complex server rewrites. |
| **Styling** | Tailwind CSS + Custom CSS | Sleek dark-mode aesthetic with custom cyan/violet gradients. |

---

## 4. Key Architectural Invariants

1. **Named Firebase App Isolation**: Initializes with `initializeApp(firebaseConfig, "ScaleKitchenAdminApp")`. This prevents accidental session leakage or state pollution when opening Owner or Manager portals in adjacent browser tabs.
2. **Cryptographic Token Verification**: The frontend refuses to rely on `localStorage`, cookies, or unverified emails. Every authenticated session must possess `token.admin === true` or pass the server-side `verifyAdminAuth` callable.
3. **Reactive Real-Time Streaming**: High-value metrics (active owners, MRR, incoming payments, feature requests) update instantaneously via Firestore `onSnapshot` listeners.
4. **Resilient Error Propagation**: Permission errors and network disconnects surface clean toast/alert banners without crashing the component tree.
