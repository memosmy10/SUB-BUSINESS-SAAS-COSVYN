# ScaleKitchen Architecture Document (Restructured v2.0)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USERS (5 Personas)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  PUBLIC    │  OWNER   │  MANAGER  │  DRIVER   │  ADMIN                     │
│ (Landing)  │(Dashboard)│(Analytics)│(Route)    │(Super Portal)             │
└──────┬──────┬──────────┬──────────┬──────────┬──────────────────────────────┘
       │      │          │          │          │
       └──────┴──────────┴──────────┴──────────┘
              │
       ┌──────▼──────────────────────────────────────────────────────────────┐
       │         FRONTEND LAYER (Vercel - Multiple SPA Bundles)              │
       ├──────────────────────────────────────────────────────────────────────┤
       │  Landing Page    Owner Dashboard    Driver App    Manager App      │
       │  (React)         (React)            (React)       (React)          │
       │                                                                      │
       │  All clients authenticate via /api/auth/login or /api/driver/login  │
       │  All clients call role-specific /api/* endpoints                   │
       └──────┬───────────────────────────────────────────────────────────────┘
              │ HTTPS Only
              │ JWT Token in Authorization: Bearer <accessToken>
       ┌──────▼──────────────────────────────────────────────────────────────┐
       │    BACKEND API LAYER (Full-Stack Express / Vercel Serverless)       │
       ├──────────────────────────────────────────────────────────────────────┤
       │  /api/auth/*       /api/driver/*        /api/admin/*                │
       │  /api/owner/*      /api/manager/*       /api/webhooks/*             │
       │                                                                      │
       │  Middlewares:                                                        │
       │  ├─ JWT Verification & Claims Extraction                            │
       │  ├─ Multi-Tenant Isolation Enforcement                              │
       │  ├─ Role-Based Access Control (RBAC)                                │
       │  ├─ Brute-Force Rate Limiting (5 failures -> 15m lockout)           │
       │  ├─ Standardized Error Formatter                                    │
       │  └─ Comprehensive Audit Logger                                      │
       └──────┬───────────────────────────────────────────────────────────────┘
              │
       ┌──────▼──────────────────────────────────────────────────────────────┐
       │         DATA PERSISTENCE LAYER (Firestore & Cloud Storage)          │
       ├──────────────────────────────────────────────────────────────────────┤
       │  Collections:                                                       │
       │  ├─ /auth_users/{uid}             [Owner & manager credentials]    │
       │  ├─ /driver_auth/{phone}          [Driver PIN hash lookups]        │
       │  ├─ /businesses/{bizId}           [Multi-tenant root]              │
       │  │  ├─ /staff/{staffId}           [Riders & managers]              │
       │  │  ├─ /customers/{custId}        [Subscribers]                    │
       │  │  └─ /delivery_logs/{logId}     [Deliveries & box returns]       │
       │  ├─ /audit_logs/{logId}            [System-wide immutable trail]    │
       │  └─ /processed_payments/{payId}   [Idempotent payment records]     │
       └──────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

1. **API-First & Decoupled Frontend**:
   All frontend user interfaces talk strictly to `/api/*` endpoints rather than directly writing raw database documents.

2. **Defense in Depth**:
   - Token-based stateless authentication (JWT).
   - Bcrypt-hashed credentials (cost 12 for owners, 10 for driver PINs).
   - Mandatory multi-tenant isolation validation at the API middleware layer.
   - Comprehensive immutable audit logging for all mutations.

3. **Multi-Tenancy**:
   Each kitchen operates inside its own isolated `businessId` space. Branch managers are strictly bounded to their assigned `branchId`.
