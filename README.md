<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9d08b35e-dbb2-4138-8d71-868d4a1a9a0a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Delivery Partner (Rider) App Security & Testing

> ⚠️ **Owner Session Notice**: Signing in as a delivery partner in the same browser replaces the active owner session with the driver custom token. When testing rider login on your computer, always test in a private/incognito window.

### Delivery Verification Checklist (Task F)

1. **Fresh phone / Incognito (No owner session)**:
   - Open rider link: `https://<host>/#/driver?phone=9876543210`
   - Enter 10-digit mobile + 4-digit PIN set by owner.
   - Verify: Route loads immediately, Start Shift / Punch In marks attendance, marking order delivered writes a `delivery_log` entry with `date == todayStr`, and box recollection updates `customers/{id}.boxCollections` and `uncollectedBoxesCount`.
2. **Brute-Force & Lockout**:
   - Enter wrong PIN 5 times: Account is locked out with lockout message.
   - Enter an unknown/unregistered phone number: Returns identical generic error `"Invalid mobile number or PIN."` and counts toward the lockout.
3. **Owner PIN Reset**:
   - Kitchen owner updates rider PIN in Settings -> `setDriverPin` increments `pinVersion`.
   - Rider's active session detects version mismatch within seconds -> signs out and prompts for new PIN.
4. **Owner Deactivation**:
   - Kitchen owner deactivates or deletes rider -> rider is immediately signed out from the app within seconds.
5. **Multi-Tenant & Role Isolation (Firestore Rules)**:
   - Rider CANNOT read other kitchens or data belonging to another `bizId`.
   - Rider CANNOT list the `staff` collection.
   - Rider CANNOT read `staff_credentials` (plaintext PIN storage).
   - Rider CANNOT read financial collections (`expenses`, `invoices`, `payments`, `notes`, `inventory`).
   - Rider CANNOT read or write `driver_auth_lookup` or `global_features/driver_*`.
6. **Network & Server Diagnostics**:
   - Slow / offline network or unreachable server displays `"Cannot reach server. Check internet and try again."` rather than an invalid credentials error.
   - "Having trouble?" diagnostic modal displays live network status and exact server error code with direct WhatsApp support link.
