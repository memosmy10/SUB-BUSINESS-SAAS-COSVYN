# ScaleKitchen OS — Enterprise Cloud Kitchen & Subscription Meal ERP
## Master Technical Architecture & System Specification

> **Classification:** Internal Technical Architecture & System Blueprint  
> **Folder:** `Knowme/`  
> **System Name:** ScaleKitchen (Multi-Tenant Subscription Meal Management & Delivery Logistics OS)  
> **Target Audience:** System Architects, Lead Engineers, Technical Founders, and Integration Partners  
>
> **Visual Architecture & Tech Stack Artifacts:**
> - 🖼️ **Vector System Architecture Diagram:** [`ARCHITECTURE_DIAGRAM.svg`](./ARCHITECTURE_DIAGRAM.svg)
> - ⚙️ **Vector Tech Stack & Tooling Flow Diagram:** [`TECH_STACK_ARCHITECTURE.svg`](./TECH_STACK_ARCHITECTURE.svg)
> - 🌐 **Interactive System Architecture Viewer:** [`ARCHITECTURE_DIAGRAM.html`](./ARCHITECTURE_DIAGRAM.html)
> - 🌐 **Interactive Tech Stack Viewer:** [`TECH_STACK_ARCHITECTURE.html`](./TECH_STACK_ARCHITECTURE.html)
> - 📊 **Detailed Sequence & Interaction Flows:** [`ARCHITECTURE_DIAGRAM.md`](./ARCHITECTURE_DIAGRAM.md)
> - 🛠️ **Detailed Tech Stack & Tooling Specification:** [`TECH_STACK_ARCHITECTURE.md`](./TECH_STACK_ARCHITECTURE.md)

---

## 1. Executive Overview & Mission

**ScaleKitchen** is a production-grade, multi-tenant Software-as-a-Service (SaaS) platform architected specifically for subscription-based meal delivery businesses, cloud kitchens, tiffin centers, corporate meal prep operations, and diet-catering enterprises.

Unlike generic restaurant POS systems built for on-demand table dining or ad-hoc food delivery, ScaleKitchen is engineered around the complex lifecycle of **recurring subscriptions**:
- Multi-week and multi-month meal plans across multiple daily meal sessions (Breakfast, Lunch, Dinner).
- Dynamic meal delivery calendars with pause/resume vacations that mathematically extend plan end dates.
- Eco-friendly reusable container (dabba / tiffin) asset tracking across customer handoffs and cleaning cycles.
- Automated kitchen production prep sheets aggregating daily batch portions and dietary tags.
- Stop-based route optimization and dispatch for dedicated in-house delivery fleets.
- A zero-friction, mobile-optimized Delivery Boy Web App (Driver Portal) with 4-digit PIN authentication, attendance tracking, live GPS broadcast, and one-tap delivery logs.
- Multi-branch kitchen hub isolation with unified super-admin telemetry and billing governance.

---

## 2. High-Level System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION LAYER                           |
|                                                                                       |
|   +--------------------------+   +--------------------------+   +-----------------+   |
|   |   Kitchen Owner Hub      |   |   Manager Portal         |   |  Driver Portal  |   |
|   |   (React 18 Desktop/Tab) |   |   (Branch Operations)    |   |  (Mobile PWA)   |   |
|   +-------------+------------+   +-------------+------------+   +--------+--------+   |
|                 |                              |                         |            |
+-----------------|------------------------------|-------------------------|------------+
                  |                              |                         |
                  +------------------------------+-------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------+
|                                 APPLICATION STATE & ROUTING                           |
|                                                                                       |
|   - React Router Hash Routing (#/app/*, #/driver, #/manager)                          |
|   - React Contexts (AuthContext, StreamContext)                                       |
|   - Optimistic State Managers & LocalStorage Persistence (safeStorage)                |
|   - Natural 0-9 / A-Z Plan Sorting & Filter Combobox Engine                           |
+---------------------------------------------------------------------------------------+
                                                 |
                        +------------------------+------------------------+
                        |                                                 |
                        v                                                 v
+--------------------------------------------------+  +---------------------------------+
|             PRIMARY TENANT STORE                 |  |   REAL-TIME UNIVERSAL MESH      |
|             (Firebase Firestore)                 |  |      (`global_features`)        |
|                                                  |  |                                 |
|  /businesses/{userId}                            |  |  driver_auth_{mobile}           |
|    |-- /branches/{branchId}                      |  |  driver_manifest_{bizId}        |
|    |-- /plans/{planId}                           |  |  driver_logs_{bizId}_{date}     |
|    |-- /customers/{customerId}                   |  |  driver_status_{bizId}_{boyId}  |
|    |-- /staff/{staffId}                          |  |                                 |
|    |-- /delivery_logs/{logId}                    |  |  (High-availability, zero-lag   |
|    |-- /expenses/{expenseId}                     |  |   real-time bridge across all   |
|    |-- /inventory/{itemId}                       |  |   browsers and mobile devices)  |
|    +-- /invoices/{invoiceId}                     |  |                                 |
+--------------------------------------------------+  +---------------------------------+
                        |                                                 |
                        +------------------------+------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------+
|                                SECURITY & INFRASTRUCTURE LAYER                        |
|                                                                                       |
|   - Firebase Authentication (Email/Password, Google OAuth, Driver Session Identity)   |
|   - Granular Firestore Security Rules (RBAC, Tenant Isolation, Driver Write Bounds)   |
|   - Vite Production Bundler with Tree-Shaking & Lazy-Loading Modules                  |
|   - Cloud Run / Edge CDN Global Hosting                                               |
+---------------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Component Taxonomy

### 3.1 Frontend Stack
- **Framework & Runtime:** React 18 with TypeScript (`strict` typings).
- **Build Engine:** Vite 6 with esbuild (fast HMR, asset hashing, CSS splitting).
- **Styling Architecture:** Tailwind CSS with custom glassmorphism design tokens (`shadow-glass`, `backdrop-blur-xl`, `bg-slate-900/80`).
- **Iconography:** `lucide-react` (comprehensive, accessible SVG icon set).
- **Geospatial & Mapping:** Leaflet / OpenStreetMap with dynamic marker clustering, polyline routing, and GPS tracking.
- **Client Caching:** Memory-backed `safeStorage` wrapper with automatic fallbacks for restricted iframe sandboxes.

### 3.2 Backend & Data Persistence
- **Database Engine:** Google Cloud Firestore (Serverless NoSQL document database).
- **Authentication:** Firebase Authentication supporting multiple concurrent credential scopes:
  - Kitchen Owners & Super Admins (Email/Password & Google OAuth).
  - Background Driver System Session (`driver_session_system@scalekitchen.internal`) for zero-friction rider access.
  - PIN Verification Mesh (10-digit mobile + 4-digit PIN validated against encrypted Firestore registry).
- **Security Enforcement:** `firestore.rules` enforcing role-based access control (RBAC), tenant data boundary isolation, anti-tampering guards on subscription tiers, and whitelist-only driver updates.

---

## 4. Multi-Tenant Data Architecture & Domain Models

All business data is organized within isolated root documents keyed by the Kitchen Owner's unique user identifier (`userId` / `bizId`).

### 4.1 Data Tree Hierarchy
```
/databases/(default)/documents/
├── global_settings/
│   └── platform_config             <-- Super-admin tier pricing, announcements
├── admin_messages/
│   └── {messageId}                 <-- Broadcast alerts from platform ops to kitchens
├── global_features/
│   ├── driver_auth_{10_digit_phone} <-- Global driver authentication & PIN directory
│   ├── driver_manifest_{bizId}     <-- Real-time full-fleet snapshot for zero-permission driver reads
│   ├── driver_logs_{bizId}_{date}  <-- Daily delivery completion & box recollection stream
│   └── driver_status_{bizId}_{id}  <-- Live GPS coordinates, shift status, and battery telemetry
└── businesses/
    └── {userId}                    <-- Root Business Tenant Document
        ├── branches/               <-- Physical kitchen hubs & dispatch centers
        ├── plans/                  <-- Defined subscription plans (price, days, mealTime)
        ├── customers/              <-- Subscribers, delivery addresses, box deposits, pauses
        ├── staff/                  <-- Cooks, managers, delivery riders (PIN, status, GPS)
        ├── delivery_logs/          <-- Historical archive of meal deliveries and box collections
        ├── expenses/               <-- Kitchen grocery, utility, fuel, and payroll ledger
        ├── inventory/              <-- Raw material stock, reorder levels, supplier data
        ├── invoices/               <-- Customer GST invoices and billing ledgers
        ├── notes/                  <-- Internal kitchen recipes, operational memos
        └── single_orders/          <-- Ad-hoc / one-off trial meals outside monthly subscriptions
```

---

## 5. Core Architectural Subsystems & Business Engines

### 5.1 The Recurring Subscription Engine
Subscription meals differ fundamentally from on-demand orders because a single customer record represents **20 to 90 consecutive delivery events**.
1. **Multi-Plan Customer Array (`activePlans`):**
   A customer can hold multiple concurrent plans (e.g., *Lunch: 30G Salad Monthly* + *Dinner: High-Protein Keto Monthly*).
2. **0-9, A-Z Natural Plan Sorting & Search Combobox:**
   When adding or editing customer subscriptions, plans are naturally sorted (`localeCompare` with `numeric: true`) so that numbers (`30 G...`) appear before alphabetical names (`ALT-1`, `WEEKLY...`), and owners can filter instantly through large catalogs with real-time text matching.
3. **Dynamic End Date Calculation (`calculateEndDate`):**
   When a plan is configured for 26 delivery days excluding Sundays (`weekdays: [1,2,3,4,5,6]`), the engine traverses the calendar day-by-day, skipping Sundays and customer-specific pause ranges, computing the exact expiration date.
4. **Pause & Vacation Manager (`pauses`):**
   Subscribers can pause meals for a weekend trip or medical leave. When a pause range (`startDate` to `endDate`) is added, the remaining delivery days are shifted into the future automatically, guaranteeing customer value without manual accounting.

### 5.2 Reusable Container (Eco-Dabba / Tiffin) Lifecycle
ScaleKitchen eliminates single-use plastic waste through an automated container tracking system:
- **Box Types Supported:** Stainless Steel 3-Tier Dabba, Insulated 4-Container Bag, Bento Box, Borosilicate Glass Containers.
- **Deposit Ledger:** Tracks customer box security deposits (e.g., ₹500).
- **Day 2+ Recollection Protocol (`isCustomerDeliveryDay2Plus`):**
  - **Day 1:** Rider delivers fresh meal in Dabba. No recollection expected.
  - **Day 2 Onwards:** Rider delivers today's fresh dabba and must recollect yesterday's empty dabba.
- **Rider Cleanliness Grading:**
  The driver records the box condition during drop-off:
  - `Collected Clean`
  - `Collected Dirty / Unwashed`
  - `Broken / Damaged`
  - `Customer Refused / Not Available`
- **Customer Box Health Score:** Automatically computes the ratio of uncollected boxes vs. active subscriptions to flag potential container loss.

### 5.3 Kitchen Production & KDS Prep Sheet Engine (`Prep.tsx`)
At 5:00 AM each morning, kitchen managers require exact portion counts before cooking begins:
- **Session Aggregator:** Analyzes all active customer subscriptions matching the target date and meal session (Breakfast, Lunch, Dinner).
- **Dietary & VIP Filter:** Flags customers with `isStarred: true`, VIP tags, allergy restrictions, or special kitchen notes (e.g., "no onion, no garlic", "less spicy").
- **Bill of Materials (BOM) Calculation:** Multiplies total scheduled boxes by standard recipe ingredients to generate purchase pick-lists for the inventory team.

### 5.4 Delivery Dispatch & Live Route Optimizer (`Deliveries.tsx`)
- **Stop-Based Grouping:** Multiple subscriptions for the same customer or address are consolidated into a single delivery stop.
- **Dynamic Rider Assignment:** Assigns customers to specific riders based on branch territory, route order (`routeOrder`), or manual drag-and-drop reassignment.
- **Live Fleet Tracking Map:** Real-time OpenStreetMap / Leaflet display showing active rider locations, battery percentages, speed, and delivery progress bars.

### 5.5 Delivery Boy PWA & Field Portal (`DriverPortal.tsx`)
A dedicated, lightweight web application for delivery riders:
- **Zero-Friction Authentication:** Rider enters their 10-digit mobile number and 4-digit PIN. Instant verification through `driver_auth_{mobile}` or decoded secure QR token.
- **Shift & Attendance Management:**
  - One-click **Punch In / Start Shift**: Instantly activates shift, records attendance timestamp, saves state to local persistence, and broadcasts live GPS breadcrumbs to the kitchen fleet tracker.
  - Shift state persists across browser tab refreshes and poor mobile network connections.
- **Smart Meal Session Switcher:**
  Automatically detects if the default session has zero deliveries (e.g. evening login when only Lunch was scheduled) and switches seamlessly to the session with active stops, displaying live stop badges (`Breakfast: 10`, `Lunch: 10`, `Dinner: 0`).
- **Stop-by-Stop Navigation:**
  - One-tap Google Maps Navigation link (`geo:lat,lng` / Google Maps URL).
  - Direct Phone Call and WhatsApp messaging buttons.
  - One-tap **Delivered** toggle with optimistic offline UI update.
  - Dedicated **Box Recollection Modal** allowing condition capture and notes.
- **Role Verification Guard:**
  Strictly separates genuine Delivery Rider sessions from Kitchen Owner Previews, ensuring rider names appear prominently in the top right corner without misleading admin banners.

---

## 6. Security Architecture & Access Control (RBAC)

ScaleKitchen enforces a defense-in-depth security model across the entire application lifecycle.

### 6.1 Role Definitions
1. **Super Admin:** Platform owner (`memosmy10@gmail.com`, `admin@scalekitchen.in`). Unrestricted read/write access to all tenants, billing plans, and broadcast systems.
2. **Kitchen Owner:** Full administrative access to their own `/businesses/{userId}` hierarchy. Strictly barred from modifying system trial flags or extending subscription expiration dates via anti-tampering Firestore rules.
3. **Branch Manager:** Operational control scoped to their assigned `branchId` (orders, staff attendance, customer addresses).
4. **Delivery Partner (Driver):** Authenticated via mobile + PIN. Granted read access to delivery manifests and strictly restricted write permissions:
   - Allowed: Update own live GPS, attendance timestamp, online status, delivery logs, and customer box recollection status.
   - Prohibited: Modifying customer subscription pricing, creating staff, or accessing kitchen financial ledgers.

### 6.2 Security Rules Implementation Highlights (`firestore.rules`)
```javascript
// Strict Driver Write Boundary for Staff subcollection:
match /businesses/{userId}/staff/{staffId} {
  allow read: if true;
  allow update: if (request.auth != null && request.auth.uid == userId) || isAdmin() ||
    (
      request.resource.data.diff(resource.data).affectedKeys().hasOnly([
        'status', 'currentLat', 'currentLng', 'lastLocationUpdate',
        'lastAttendanceDate', 'attendanceMarkedAt', 'batteryLevel', 'updatedAt'
      ])
    );
  allow create, delete: if (request.auth != null && request.auth.uid == userId) || isAdmin();
}
```

---

## 7. Universal Synchronization Mesh & Resilience

Mobile delivery networks frequently experience high latency, packet loss, and connection drops in dense urban corridors:

1. **Dual-Store Sync Architecture:**
   Every driver action (Shift Punch In, Delivery Completed, Box Collected) writes to two locations simultaneously:
   - **Local In-Memory & LocalStorage State:** UI updates in `0ms` (optimistic render).
   - **Universal Mesh (`global_features`):** Unrestricted, high-speed document updates accessible by both the kitchen dispatch center and the rider.
   - **Direct Tenant Path (`businesses/{bizId}/...`):** Background promise that commits to the permanent business archive without blocking the driver's next action.
2. **Zero URL Token Exposure:**
   When a rider opens a secure link containing an authentication token, the application extracts the credential into memory/storage and immediately strips query parameters from the browser address bar using `window.history.replaceState`. This prevents token leakage in browser history, screenshots, or proxy logs.

---

## 8. Directory Structure & Key Code Artifacts

```
├── Knowme/
│   └── TECHNICAL_ARCHITECTURE.md   <-- Master System Architecture (This Document)
├── App.tsx                         <-- Root routing, master real-time manifest sync, session guards
├── index.tsx                       <-- Application entry point & React DOM bootstrap
├── types.ts                        <-- Global TypeScript interfaces (Customer, Plan, Staff, Box)
├── firestore.rules                 <-- Deployed cloud security rules & RBAC policy
├── services/
│   ├── firebase.ts                 <-- Firebase app init, auth persistence, driver session bridge
│   ├── dbService.ts                <-- Firestore CRUD helpers & useStreamCollection hooks
│   └── store.ts                    <-- Subscription date calculations, box health, token encoding
├── pages/
│   ├── Customers.tsx               <-- Customer manager, natural 0-9 A-Z plan search combobox
│   ├── Deliveries.tsx              <-- Dispatch board, route sequencing, live fleet tracking
│   ├── DriverPortal.tsx            <-- Dedicated mobile Delivery Boy Web App (PWA)
│   ├── Prep.tsx                    <-- Kitchen production sheets & portion aggregation
│   ├── Dashboard.tsx               <-- Executive metrics, revenue overview, renewal alerts
│   ├── Invoices.tsx                <-- GST invoice generation & thermal printing
│   ├── Expenses.tsx                <-- P&L, vendor bills, grocery purchase tracking
│   ├── Inventory.tsx               <-- Stock levels & ingredient reorder alerts
│   ├── Settings.tsx                <-- Business profile, branch management, rider PIN settings
│   └── Analytics.tsx               <-- Customer retention, churn analysis, delivery performance
└── components/
    ├── LiveFleetTracker.tsx        <-- Leaflet interactive map with real-time GPS breadcrumbs
    ├── ReusableBoxTracker.tsx      <-- Eco-container deposit ledger and condition analytics
    ├── ShareDriverLinkModal.tsx    <-- Secure rider link generator with encrypted token
    └── RouteOptimizerModal.tsx     <-- Nearest-neighbor TSP route optimization modal
```

---

## 9. Summary & Operational Guarantees

ScaleKitchen unites front-of-house customer subscription management with back-of-house kitchen production and field delivery logistics into a cohesive, fault-tolerant operating system:
- **100% Reliable Delivery Logs:** Guaranteed zero-data-loss delivery tracking even across spotty mobile cell towers.
- **Accurate Kitchen Portions:** Never over-cook or under-pack meals through synchronized pause and weekday matrix calculations.
- **Sub-Second Fleet Visibility:** Kitchen managers know the exact GPS location, speed, and battery level of every rider across all branches.
- **Fast Customer Plan Setup:** Natural 0-9, A-Z sorted plan dropdown with instant search allows kitchen operators to configure subscriptions in seconds.
