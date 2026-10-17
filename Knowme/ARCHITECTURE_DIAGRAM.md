# ScaleKitchen OS — Detailed Architecture Diagrams & Flow Specifications

This document provides visual architectural diagrams, subsystem interaction models, and sequence workflows for the **ScaleKitchen** enterprise SaaS platform.

> **Visual Artifacts Available in this Folder:**
> - Vector Graphic Architecture Diagram: [`ARCHITECTURE_DIAGRAM.svg`](./ARCHITECTURE_DIAGRAM.svg)
> - Interactive HTML Diagram Viewer: [`ARCHITECTURE_DIAGRAM.html`](./ARCHITECTURE_DIAGRAM.html)
> - Full Technical Architecture Reference: [`TECHNICAL_ARCHITECTURE.md`](./TECHNICAL_ARCHITECTURE.md)

---

## 1. System Topology & Tier Architecture (Mermaid)

```mermaid
graph TD
    %% User Layer
    subgraph Client_Layer ["Client & Actor Layer"]
        A1["👑 Kitchen Owner Hub<br/>(React Desktop/Tablet)"]
        A2["👨‍🍳 Kitchen KDS Display<br/>(Prep Sheet Station)"]
        A3["🏢 Branch Dispatch Hub<br/>(Manager Portal)"]
        A4["🛵 Delivery Boy App<br/>(Mobile PWA)"]
        A5["💬 End Customer<br/>(WhatsApp & Web Receipts)"]
    end

    %% Network & Application Layer
    subgraph Application_Layer ["React 18 & Vite Business Engines"]
        B1["📅 Subscription Engine<br/>• 0-9 A-Z Natural Plan Combobox<br/>• Dynamic End-Date Auto Shift<br/>• Vacation / Pause Calendar"]
        B2["📦 Eco-Dabba Tracker<br/>• Day 2+ Recollection Protocol<br/>• Condition Audit (Clean/Dirty/Damage)<br/>• Security Deposit (₹) Ledger"]
        B3["🍳 Kitchen Prep Engine<br/>• KDS Batch Aggregation<br/>• Dietary & VIP Tagging<br/>• Raw Inventory BOM Calculator"]
        B4["🗺️ Route & Fleet Engine<br/>• Stop-Based Grouping (1 Stop/Cust)<br/>• Nearest-Neighbor TSP Optimizer<br/>• OpenStreetMap Live Markers"]
        B5["🧾 Billing & GST Engine<br/>• Tax Invoice PDF & 80mm Thermal<br/>• Daily Cash vs Online Ledger<br/>• Renewal History Auditing"]
    end

    %% Universal Real-Time Bridge
    subgraph Universal_Mesh ["Universal Real-Time Mesh (global_features)"]
        C1["🔑 driver_auth_{phone}<br/>• Mobile & 4-Digit PIN Registry<br/>• Cross-Origin Iframe Safe"]
        C2["📋 driver_manifest_{bizId}<br/>• Real-time Fleet Snapshot<br/>• Zero-Permission Driver Reads"]
        C3["📦 driver_logs_{bizId}_{date}<br/>• Delivery Completed Stream<br/>• Box Recollection Status"]
        C4["📡 driver_status_{bizId}_{staffId}<br/>• Sub-Second GPS Breadcrumbs<br/>• Shift Punch In/Out Status"]
    end

    %% Cloud Database Layer
    subgraph Database_Layer ["Google Cloud Firestore (Permanent Tenant Store)"]
        D1[("🏢 /businesses/{userId}<br/>Root Tenant Document")]
        D2["📁 branches/ (Kitchen Hubs)"]
        D3["📁 plans/ (Subscription Catalog)"]
        D4["📁 customers/ (Subscribers & Addresses)"]
        D5["📁 staff/ (Cooks, Managers & Riders)"]
        D6["📁 delivery_logs/ (Permanent Audit Trail)"]
        D7["📁 invoices/ & expenses/ (P&L Ledger)"]
        D8["🛡️ Cloud Security Rules<br/>(Tenant Isolation & Anti-Tamper)"]
    end

    %% Flow Connections
    A1 --> B1
    A1 --> B4
    A1 --> B5
    A2 --> B3
    A3 --> B4
    A4 --> C1
    A4 --> C3
    A4 --> C4
    A5 -.-> B5

    B1 --> D1
    B2 --> C3
    B3 --> D4
    B4 --> C2
    B5 --> D7

    C1 -.-> D5
    C2 -.-> D4
    C3 -.-> D6
    C4 -.-> D5

    D1 --- D2
    D1 --- D3
    D1 --- D4
    D1 --- D5
    D1 --- D6
    D1 --- D7
    D8 --- D1

    classDef client fill:#1e293b,stroke:#3b82f6,stroke-width:1.5px,color:#fff;
    classDef engine fill:#0f172a,stroke:#06b6d4,stroke-width:1.5px,color:#fff;
    classDef mesh fill:#1c1917,stroke:#f59e0b,stroke-width:2px,color:#fff;
    classDef db fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;

    class A1,A2,A3,A4,A5 client;
    class B1,B2,B3,B4,B5 engine;
    class C1,C2,C3,C4 mesh;
    class D1,D2,D3,D4,D5,D6,D7,D8 db;
```

---

## 2. Delivery Boy Shift & Field Operation Lifecycle (Sequence Flow)

This sequence diagram depicts how a rider logs in with their PIN, marks attendance, navigates stops, and completes deliveries without permission barriers:

```mermaid
sequenceDiagram
    autonumber
    actor Driver as 🛵 Delivery Partner
    participant PWA as 📱 Driver Portal PWA
    participant Mesh as ⚡ Universal Mesh (global_features)
    participant Cloud as ☁️ Firestore DB (businesses/{bizId})
    actor Kitchen as 👑 Kitchen Dashboard

    %% Authentication Flow
    Note over Driver,PWA: 1. Rider Authentication
    Driver->>PWA: Enter Mobile (10-digit) + 4-digit PIN
    PWA->>Mesh: Query driver_auth_{mobile}
    Mesh-->>PWA: Return { staffId, bizId, name, pin }
    alt PIN matches
        PWA->>PWA: Save to safeStorage (driver_is_logged_in = true)
        PWA->>PWA: Hide Owner Preview Banner & Show Top-Right Name Badge
        PWA-->>Driver: "Welcome back, Raju! Ready for today's deliveries."
    else Invalid PIN
        PWA-->>Driver: Display error toast: "Incorrect 4-digit PIN"
    end

    %% Shift Punch In Flow
    Note over Driver,Kitchen: 2. Shift Start & Attendance Punch-In
    Driver->>PWA: Click "Punch In" / "Start Shift"
    PWA->>PWA: Optimistic Shift Activation (isShiftActive = true)
    PWA->>PWA: Record punchInTime in LocalStorage
    PWA->>Mesh: Write driver_status_{bizId}_{staffId} { status: 'Online', attendanceMarkedAt: '...' }
    PWA->>Mesh: Update driver_manifest_{bizId} (driverAttendance)
    PWA--)Cloud: Async update businesses/{bizId}/staff/{staffId}
    Mesh-->>Kitchen: Real-time Snapshot fires -> Live Fleet Tracker shows "Raju: Online"

    %% Delivery & Box Recollection Flow
    Note over Driver,Kitchen: 3. Stop Navigation & Box Recollection
    PWA->>Driver: Display scheduled meal stops (Auto-selected session: Lunch 10 Stops)
    Driver->>PWA: Click "Navigate" (Opens Google Maps)
    Driver->>PWA: Click "Mark Delivered"
    PWA->>PWA: Open Box Recollection Modal (if Day 2+ customer)
    Driver->>PWA: Select Box Status: "Collected Clean" + Notes
    PWA->>PWA: Optimistic UI mark Stop Delivered
    PWA->>Mesh: Commit to driver_logs_{bizId}_{date}
    PWA--)Cloud: Set delivery_logs document & decrement uncollectedBoxesCount
    Mesh-->>Kitchen: Dispatch Dashboard updates Delivery Progress Bar & Box Count
```

---

## 3. Recurring Subscription & Dynamic Scheduling Architecture

```mermaid
flowchart LR
    subgraph Input ["Owner Adds Customer"]
        CUST["Customer Details<br/>• Name & Phone<br/>• Delivery Address<br/>• Google Maps Pin"]
        PLAN["Select Plan<br/>• Natural 0-9, A-Z Combobox<br/>• eg. 30G SALAD WEEKLY"]
        TIME["Select Session<br/>• Breakfast / Lunch / Dinner"]
    end

    subgraph Calculation ["Subscription Scheduling Engine"]
        DAYS["Delivery Count<br/>(e.g., 26 days)"]
        WK["Weekday Filter<br/>[Mon, Tue, Wed, Thu, Fri, Sat]"]
        PAUSE["Customer Pauses<br/>Vacation Date Ranges"]
        END_CALC["calculateEndDate()<br/>Traverse calendar skipping non-working days & pauses"]
    end

    subgraph Output ["Synchronized Production Output"]
        KITCHEN["Kitchen Prep Sheet<br/>Aggregated daily portions"]
        DISPATCH["Delivery Route<br/>Stop-based consolidation"]
        RENEW["Renewal Watchdog<br/>Alerts owner 3 days before expiry"]
    end

    CUST --> END_CALC
    PLAN --> DAYS
    PLAN --> WK
    PAUSE --> END_CALC
    DAYS --> END_CALC
    WK --> END_CALC

    END_CALC --> KITCHEN
    END_CALC --> DISPATCH
    END_CALC --> RENEW
```

---

## 4. Reusable Eco-Container (Dabba) State Machine

```mermaid
stateDiagram-v2
    [*] --> InKitchen: New Reusable Container (Deposit Paid)
    InKitchen --> DispatchedToCustomer: Day 1 - Meal packed & dispatched
    DispatchedToCustomer --> InCustomerCustody: Delivered to customer address
    
    state InCustomerCustody {
        [*] --> EmptyWaitingPickup
    }

    InCustomerCustody --> InspectedByRider: Day 2+ - Rider arrives with fresh meal
    
    state InspectedByRider {
        [*] --> ConditionAudit
        ConditionAudit --> CollectedClean: Box washed by customer
        ConditionAudit --> CollectedDirty: Box unwashed
        ConditionAudit --> DamagedBroken: Seal/Tiffin broken
        ConditionAudit --> NotReturned: Customer kept box / not available
    }

    CollectedClean --> BackToKitchenHub: Sanitization & restocking
    CollectedDirty --> BackToKitchenHub: Dishwashing & sterilization
    DamagedBroken --> DeductDeposit: Write-off or deposit forfeited
    NotReturned --> IncrementUncollectedCount: Alert triggered on dashboard

    BackToKitchenHub --> InKitchen: Container available for next cycle
```

---

## 5. Security & Authorization Matrix (RBAC)

| Resource Path | Super Admin | Kitchen Owner | Branch Manager | Delivery Partner | Public |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/businesses/{userId}` | **Full (R/W)** | **Self Only (R/W)\*** | **Read Only** | **Read Only** | Read (Branding) |
| `.../staff/{id}` | **Full (R/W)** | **Self (R/W)** | **Read** | **Whitelist Update\*\*** | No Access |
| `.../customers/{id}` | **Full (R/W)** | **Self (R/W)** | **Self Branch (R/W)** | **Read / Box Update** | No Access |
| `.../delivery_logs/{id}`| **Full (R/W)** | **Self (R/W)** | **Self Branch (R/W)** | **Create / Update** | No Access |
| `.../invoices/{id}` | **Full (R/W)** | **Self (R/W)** | **Self Branch (R)** | **No Access** | Read (Direct Token) |
| `/global_features/*` | **Full (R/W)** | **Full (R/W)** | **Full (R/W)** | **Self Stream (R/W)** | No Access |
| `/global_settings/*` | **Full (R/W)** | **Read Only** | **Read Only** | **Read Only** | Read Only |

*\* Kitchen Owners cannot extend `planExpiryDate` or reset `trialClaimed` directly in Firestore (governed by anti-tampering rules).*  
*\*\* Delivery Partners can only update: `status`, `currentLat`, `currentLng`, `lastLocationUpdate`, `lastAttendanceDate`, `attendanceMarkedAt`, `batteryLevel`, and `updatedAt`.*
