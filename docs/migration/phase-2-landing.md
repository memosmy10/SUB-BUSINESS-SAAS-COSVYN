# ScaleKitchen — Phase 2: Independent Landing Frontend Extraction Runbook

## 1. Executive Summary
- **Target Application:** `apps/landing/`
- **Package Name:** `@scalekitchen/landing`
- **Status:** Complete, Independently Buildable, Verified, Zero Type Errors.
- **Production Safety:** Root SPA (`/pages/LandingPage.tsx`, `/pages/legal/*`, `/App.tsx`) remains 100% UNTOUCHED and active as an operational fallback for the live production domain.
- **Backend Touchpoints:** Zero modifications to Firebase Auth, Firestore schemas, Cloud Functions, Firestore Security Rules, or Razorpay payment handlers.

---

## 2. Directory Structure of `apps/landing/`
```
apps/landing/
├── index.html                  # Dedicated SEO-optimized HTML entry point
├── package.json                # Standalone @scalekitchen/landing configuration
├── tsconfig.json               # Extends tsconfig.base.json with local rootDir
├── vite.config.ts              # Dedicated Vite bundler targeting outDir: 'dist' (port 3001)
├── vercel.json                 # Independent Vercel deployment & rewrite configuration
├── .env.example                # Documented environment variables (VITE_APP_URL)
├── README.md                   # Application-specific documentation
└── src/
    ├── main.tsx                # Independent React 19 createRoot entry point
    ├── App.tsx                 # Dedicated BrowserRouter with scroll-to-top & legal routes
    ├── vite-env.d.ts           # Vite client environment type definitions
    ├── index.css               # Glassmorphic and ambient styling tokens
    ├── pages/
    │   ├── LandingPage.tsx     # Full feature showcase, ROI calculator, testimonials, FAQs
    │   └── legal/
    │       ├── Terms.tsx       # Independent Terms & Conditions page
    │       ├── Privacy.tsx     # Independent Privacy Policy page
    │       ├── Shipping.tsx    # Independent Shipping & Digital Delivery Policy
    │       ├── Refunds.tsx     # Independent Cancellation & Refund Policy
    │       └── Contact.tsx     # Independent Contact & Support page
    └── services/
        └── pricing.ts          # Encapsulated Firestore live pricing stream & offline fallback
```

---

## 3. Dependency & Decoupling Strategy

### A. Zero Dependencies on Root SPA
- `apps/landing/` does not import any files from the root `/pages/`, `/components/`, `/contexts/`, or `/services/` folders.
- It operates completely independently with its own `vite.config.ts` running on port 3001.

### B. Encapsulated Pricing Service (`src/services/pricing.ts`)
- The public landing page requires dynamic pricing fetched from Firestore (`global_settings/saas_config`).
- Rather than importing heavy kitchen state or authenticated Firestore services from the root app, `apps/landing/src/services/pricing.ts` initializes a lightweight, read-only Firebase instance using the existing production project credentials (`subbussinesssaas`).
- If network connection drops or Firestore is blocked, it seamlessly falls back to canonical default pricing plans (`SHARED_SAAS_PLANS`) with zero console spam or user disruption.

### C. Portal Navigation & Cross-App Linking (`VITE_APP_URL`)
- Public legal pages (`/terms`, `/privacy`, `/shipping`, `/refunds`, `/contact`) are routed internally within `apps/landing` via standard `<Link to="...">`.
- Authentication action buttons ("Start Free Trial", "Customer Login", "Choose Monthly/Yearly") support an optional environment variable `VITE_APP_URL`:
  - When `VITE_APP_URL` is set (e.g. `https://app.scalekitchen.com`), buttons link directly to `${VITE_APP_URL}/#/signup` and `${VITE_APP_URL}/#/login`.
  - When `VITE_APP_URL` is unset, buttons fall back to standard relative routes (`/signup` and `/login`), ensuring compatibility with single-origin previews.
- Live WhatsApp demo CTA directly opens `https://wa.me/917702667567` with a prefilled inquiry message.

---

## 4. Verification & Health Checks
The following suite of commands was run and passed:
1. `npm run lint:landing` (`tsc --noEmit` in `apps/landing`): **0 errors (Exit code 0)**.
2. `npm run build:landing` (`vite build` in `apps/landing`): **Success in 9.25s**. Output generated in `apps/landing/dist/`.
3. Root `npm run lint` (`tsc`): **0 errors (Exit code 0)**.
4. Root `npm test` (`vitest run`): **24/24 persistence and data integrity tests passed**.
5. `compile_applet`: **Compilation Succeeded**.

---

## 5. Vercel Independent Deployment Instructions (When Ready)
To deploy `apps/landing` as an independent Vercel project:
1. Create a new project in the Vercel Dashboard connected to the repository.
2. Set **Root Directory** to `apps/landing`.
3. Set **Framework Preset** to `Vite`.
4. Configure Build & Development Settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Configure Environment Variables:
   - `VITE_APP_URL`: The production URL of the ScaleKitchen Owner SaaS application (e.g. `https://app.scalekitchen.com`).
6. Deploy. Vercel will build solely the landing application and route all SPA routes (`/terms`, `/privacy`, etc.) to `/index.html` via `apps/landing/vercel.json`.
