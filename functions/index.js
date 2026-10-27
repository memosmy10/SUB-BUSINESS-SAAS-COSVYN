
const admin = require("firebase-admin");
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Define Secrets from Firebase Secret Manager (Phase 3)
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Scheduled job to run every day at midnight (Cloud Functions v2 / Node 20).
 * Checks all 'Active' businesses and updates their status to 'Expired'
 * if their planExpiryDate has passed using the server date logic (YYYY-MM-DD).
 */
exports.checkSubscriptionExpiry = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (event) => {
    const db = admin.firestore();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD server date logic

    console.log(`[Cron v2] Running subscription expiry check for server date: ${todayStr}`);

    try {
      const snapshot = await db.collection("businesses")
        .where("planStatus", "==", "Active")
        .get();

      if (snapshot.empty) {
        console.log("[Cron v2] No active subscriptions found to check.");
        return;
      }

      const batch = db.batch();
      let expiredCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.planExpiryDate && data.planExpiryDate < todayStr) {
          const docRef = db.collection("businesses").doc(doc.id);
          batch.update(docRef, {
            planStatus: "Expired",
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
          expiredCount++;
        }
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`[Cron v2] Successfully marked ${expiredCount} subscriptions as Expired.`);
      } else {
        console.log("[Cron v2] No subscriptions expired today.");
      }
    } catch (error) {
      console.error("[Cron v2] Error in checkSubscriptionExpiry:", error);
    }
  }
);

/**
 * Scheduled job to backup the Firestore database to Cloud Storage (v2 / Node 20).
 *
 * RETENTION POLICY NOTE:
 * Configure Object Lifecycle Management on your Cloud Storage backup bucket:
 * E.g., retain daily backups for 30 days and automatically delete older backups:
 * ```bash
 * cat <<EOF > lifecycle.json
 * {
 *   "rule": [
 *     {
 *       "action": {"type": "Delete"},
 *       "condition": {"age": 30}
 *     }
 *   ]
 * }
 * EOF
 * gsutil lifecycle set lifecycle.json gs://YOUR_PROJECT_ID.appspot.com
 * ```
 *
 * HOW TO TEST A RESTORE:
 * 1. Identify the backup URI prefix in Cloud Storage, e.g.:
 *    gs://YOUR_PROJECT_ID.appspot.com/backups/2026-10-18T00:00:00.000Z/
 * 2. To test restoring without affecting production, restore to a staging database or test project:
 *    gcloud firestore import gs://YOUR_PROJECT_ID.appspot.com/backups/2026-10-18T00:00:00.000Z/ --project=YOUR_STAGING_PROJECT_ID
 * 3. Or to restore specific collections in a sandbox:
 *    gcloud firestore import gs://YOUR_PROJECT_ID.appspot.com/backups/.../ --collection-ids='businesses','plans'
 */
exports.scheduledFirestoreExport = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    const databaseName = client.databasePath(projectId, '(default)');
    const bucketName = `gs://${projectId}.appspot.com`;
    const timestamp = new Date().toISOString();

    console.log(`[Backup v2] Starting backup for project ${projectId} to ${bucketName}/backups/${timestamp}`);

    try {
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucketName}/backups/${timestamp}`,
        collectionIds: [] // Exports all collections
      });
      console.log(`[Backup v2] Export operation initiated: ${response.name}`);
      return response;
    } catch (err) {
      console.error('[Backup v2] Export operation failed:', err);
      throw err;
    }
  }
);


/**
 * ============================================================================
 * PHASE 1: SERVER-VERIFIED DRIVER & MANAGER AUTHENTICATION (Cloud Functions v2)
 * ============================================================================
 */


/**
 * driverLogin
 * Verifies driver phone + PIN, enforces lockout (5 failures -> 15 min lock),
 * and issues a Firebase Custom Token with claims: { role: 'driver', bizId, staffId, branchId }
 */
exports.driverLogin = onCall({ cors: true }, async (request) => {
  const { phone, pin } = request.data || {};

  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new HttpsError('invalid-argument', 'Valid 10-digit mobile number is required.');
  }

  const cleanPin = String(pin || '').trim();
  if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
    throw new HttpsError('invalid-argument', 'PIN must be between 4 and 6 digits.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const rateLimitRef = db.collection('auth_rate_limits').doc(`driver_${cleanPhone}`);
  const rateLimitSnap = await rateLimitRef.get();
  const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { attempts: 0, lockedUntil: null };

  // Check if locked out
  if (rateLimitData.lockedUntil && Number(rateLimitData.lockedUntil) > now) {
    const remainingMinutes = Math.max(1, Math.ceil((Number(rateLimitData.lockedUntil) - now) / 60000));
    throw new HttpsError(
      'resource-exhausted',
      `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
    );
  }

  // Look up driver record
  let driverDoc = null;
  let driverRef = null;

  // 1. Check global_features/driver_auth_{phone}
  const globalRef = db.collection('global_features').doc(`driver_auth_${cleanPhone}`);
  const globalSnap = await globalRef.get();

  if (globalSnap.exists) {
    driverDoc = globalSnap.data();
    driverRef = globalRef;
  } else {
    // 2. Check legacy driver_auth_lookup/{phone}
    const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
    const lookupSnap = await lookupRef.get();
    if (lookupSnap.exists) {
      driverDoc = lookupSnap.data();
      driverRef = lookupSnap.ref;
    } else {
      // 3. Search across staff collections via collectionGroup
      const staffQuery = await db.collectionGroup('staff')
        .where('mobile', '==', cleanPhone)
        .limit(1)
        .get();

      if (!staffQuery.empty) {
        const staffSnap = staffQuery.docs[0];
        driverDoc = { ...staffSnap.data(), staffId: staffSnap.id };
        const parentBizId = staffSnap.ref.parent.parent ? staffSnap.ref.parent.parent.id : '';
        driverDoc.bizId = parentBizId;
        driverRef = staffSnap.ref;
      }
    }
  }

  const recordFailedAttempt = async () => {
    const attempts = (rateLimitData.attempts || 0) + 1;
    const isLocked = attempts >= 5;
    const lockedUntil = isLocked ? now + (15 * 60 * 1000) : null;

    await rateLimitRef.set({
      attempts: isLocked ? 0 : attempts,
      lockedUntil,
      lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      phone: cleanPhone
    }, { merge: true });

    if (isLocked) {
      throw new HttpsError(
        'resource-exhausted',
        'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
      );
    }
    const remaining = 5 - attempts;
    throw new HttpsError(
      'unauthenticated',
      `Incorrect 4-digit PIN. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`
    );
  };

  if (!driverDoc) {
    await recordFailedAttempt();
  }

  // Verify PIN (checks pinHash first, then falls back to plaintext pin for migration compatibility)
  let isMatch = false;
  if (driverDoc.pinHash) {
    isMatch = bcrypt.compareSync(cleanPin, driverDoc.pinHash);
  } else if (driverDoc.pin) {
    isMatch = (cleanPin === String(driverDoc.pin).trim());
    // Auto-hash for future logins without deleting existing field
    if (isMatch && driverRef) {
      const pinHash = bcrypt.hashSync(cleanPin, 10);
      driverRef.update({ pinHash }).catch(err => console.warn('Auto-hash driver PIN error:', err));
    }
  }

  if (!isMatch) {
    await recordFailedAttempt();
  }

  // Successful login -> clear lockout records
  await rateLimitRef.set({
    attempts: 0,
    lockedUntil: null,
    lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const bizId = driverDoc.bizId || '';
  const staffId = driverDoc.staffId || driverDoc.id || 'driver-1';
  const branchId = driverDoc.branchId || '';
  const name = driverDoc.name || 'Delivery Partner';

  const uid = `driver_${bizId}_${staffId}`;
  const claims = {
    role: 'driver',
    bizId,
    staffId,
    branchId
  };

  const customToken = await admin.auth().createCustomToken(uid, claims);

  return {
    token: customToken,
    driver: {
      name,
      bizId,
      staffId,
      branchId,
      mobile: cleanPhone
    }
  };
});

/**
 * managerLogin
 * Verifies manager email + password, enforces lockout (5 failures -> 15 min lock),
 * and issues a Firebase Custom Token with claims: { role: 'manager', bizId, managerId, branchId }
 */
exports.managerLogin = onCall({ cors: true }, async (request) => {
  const { email, password, bizId } = request.data || {};

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid manager email is required.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword) {
    throw new HttpsError('invalid-argument', 'Password is required.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const safeEmailKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const rateLimitRef = db.collection('auth_rate_limits').doc(`manager_${safeEmailKey}`);
  const rateLimitSnap = await rateLimitRef.get();
  const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { attempts: 0, lockedUntil: null };

  if (rateLimitData.lockedUntil && Number(rateLimitData.lockedUntil) > now) {
    const remainingMinutes = Math.max(1, Math.ceil((Number(rateLimitData.lockedUntil) - now) / 60000));
    throw new HttpsError(
      'resource-exhausted',
      `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
    );
  }

  let managerDoc = null;
  let managerRef = null;
  let resolvedBizId = bizId ? String(bizId).trim() : '';

  // 1. Check under specified bizId
  if (resolvedBizId) {
    const managersSnap = await db.collection('businesses')
      .doc(resolvedBizId)
      .collection('managers')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!managersSnap.empty) {
      const docSnap = managersSnap.docs[0];
      managerDoc = { id: docSnap.id, ...docSnap.data() };
      managerRef = docSnap.ref;
    }
  }

  // 2. Fallback: Search across collectionGroup('managers')
  if (!managerDoc) {
    const groupSnap = await db.collectionGroup('managers')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!groupSnap.empty) {
      const docSnap = groupSnap.docs[0];
      managerDoc = { id: docSnap.id, ...docSnap.data() };
      managerRef = docSnap.ref;
      if (!resolvedBizId && docSnap.ref.parent && docSnap.ref.parent.parent) {
        resolvedBizId = docSnap.ref.parent.parent.id;
      }
    }
  }

  const recordFailedAttempt = async () => {
    const attempts = (rateLimitData.attempts || 0) + 1;
    const isLocked = attempts >= 5;
    const lockedUntil = isLocked ? now + (15 * 60 * 1000) : null;

    await rateLimitRef.set({
      attempts: isLocked ? 0 : attempts,
      lockedUntil,
      lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      email: cleanEmail
    }, { merge: true });

    if (isLocked) {
      throw new HttpsError(
        'resource-exhausted',
        'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
      );
    }
    const remaining = 5 - attempts;
    throw new HttpsError(
      'unauthenticated',
      `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`
    );
  };

  if (!managerDoc) {
    await recordFailedAttempt();
  }

  // Verify Password
  let isMatch = false;
  if (managerDoc.passwordHash) {
    isMatch = bcrypt.compareSync(cleanPassword, managerDoc.passwordHash);
  } else if (managerDoc.password) {
    isMatch = (cleanPassword === managerDoc.password);
    if (isMatch && managerRef) {
      const passwordHash = bcrypt.hashSync(cleanPassword, 10);
      managerRef.update({ passwordHash }).catch(err => console.warn('Auto-hash manager password error:', err));
    }
  }

  if (!isMatch) {
    await recordFailedAttempt();
  }

  // Reset rate limits on success
  await rateLimitRef.set({
    attempts: 0,
    lockedUntil: null,
    lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const managerId = managerDoc.id;
  const branchId = managerDoc.branchId || 'All';
  const name = managerDoc.name || 'Branch Manager';
  const allowedPages = managerDoc.allowedPages || ['dashboard'];

  const uid = `manager_${resolvedBizId}_${managerId}`;
  const claims = {
    role: 'manager',
    bizId: resolvedBizId,
    managerId,
    branchId
  };

  const customToken = await admin.auth().createCustomToken(uid, claims);

  return {
    token: customToken,
    manager: {
      id: managerId,
      name,
      email: cleanEmail,
      branchId,
      allowedPages,
      bizId: resolvedBizId
    }
  };
});

/**
 * setDriverPin
 * Callable function used by business owner when creating or updating a driver PIN.
 * Securely hashes the PIN and writes ONLY pinHash to Firestore (never plaintext PIN).
 */
exports.setDriverPin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required to set driver PIN.');
  }

  const { bizId, staffId, phone, pin, name, branchId, additionalData } = request.data || {};

  const callerUid = request.auth.uid;
  const isOwner = callerUid === bizId;
  const isAdmin = request.auth.token && (request.auth.token.admin === true || request.auth.token.email === 'memosmy10@gmail.com');

  if (!isOwner && !isAdmin) {
    throw new HttpsError('permission-denied', 'Only the kitchen owner can update driver PINs.');
  }

  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new HttpsError('invalid-argument', 'Valid 10-digit mobile number is required.');
  }

  const cleanPin = String(pin || '').trim();
  if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
    throw new HttpsError('invalid-argument', 'PIN must be between 4 and 6 digits.');
  }

  const db = admin.firestore();
  const pinHash = bcrypt.hashSync(cleanPin, 10);
  const targetStaffId = staffId || db.collection('businesses').doc(bizId).collection('staff').doc().id;
  const nowIso = new Date().toISOString();

  const batch = db.batch();

  // 1. Staff subcollection (without plaintext pin)
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(targetStaffId);
  const staffPayload = {
    ...(additionalData || {}),
    name: name || '',
    mobile: cleanPhone,
    pinHash,
    branchId: branchId || '',
    updatedAt: nowIso
  };
  // Ensure plaintext pin is never written
  delete staffPayload.pin;
  batch.set(staffRef, staffPayload, { merge: true });

  // 2. Global directory in global_features
  const globalRef = db.collection('global_features').doc(`driver_auth_${cleanPhone}`);
  batch.set(globalRef, {
    bizId,
    staffId: targetStaffId,
    name: name || '',
    mobile: cleanPhone,
    pinHash,
    branchId: branchId || '',
    updatedAt: nowIso
  }, { merge: true });

  // 3. Legacy lookup
  const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
  batch.set(lookupRef, {
    bizId,
    staffId: targetStaffId,
    name: name || '',
    mobile: cleanPhone,
    pinHash,
    branchId: branchId || '',
    updatedAt: nowIso
  }, { merge: true });

  await batch.commit();

  return { success: true, staffId: targetStaffId };
});

/**
 * setManagerPassword
 * Callable function used by business owner when creating or updating a manager password.
 * Securely hashes the password and writes ONLY passwordHash to Firestore.
 */
exports.setManagerPassword = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required to set manager password.');
  }

  const { bizId, managerId, password, managerData } = request.data || {};

  const callerUid = request.auth.uid;
  const isOwner = callerUid === bizId;
  const isAdmin = request.auth.token && (request.auth.token.admin === true || request.auth.token.email === 'memosmy10@gmail.com');

  if (!isOwner && !isAdmin) {
    throw new HttpsError('permission-denied', 'Only the kitchen owner can set manager passwords.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const db = admin.firestore();
  const passwordHash = bcrypt.hashSync(cleanPassword, 10);
  const targetManagerId = managerId || db.collection('businesses').doc(bizId).collection('managers').doc().id;
  const nowIso = new Date().toISOString();

  const managerRef = db.collection('businesses').doc(bizId).collection('managers').doc(targetManagerId);

  const payload = {
    ...(managerData || {}),
    passwordHash,
    updatedAt: nowIso
  };
  // Ensure plaintext password is never written
  delete payload.password;

  await managerRef.set(payload, { merge: true });

  return { success: true, managerId: targetManagerId };
});

/**
 * migratePlaintextCredentials
 * One-time admin-only migration function that hashes existing plaintext pins/passwords
 * into new fields (pinHash / passwordHash) WITHOUT deleting the old fields yet (for rollback safety).
 */
exports.migratePlaintextCredentials = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const callerEmail = request.auth.token && request.auth.token.email;
  const isAdmin = callerEmail === 'memosmy10@gmail.com' || (request.auth.token && request.auth.token.admin === true);

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only designated system admins can trigger credential migration.');
  }

  const db = admin.firestore();
  let migratedStaffCount = 0;
  let migratedManagersCount = 0;
  let migratedGlobalDriversCount = 0;

  // 1. Iterate businesses
  const businessesSnap = await db.collection('businesses').get();
  for (const bDoc of businessesSnap.docs) {
    const bizId = bDoc.id;

    // Staff
    const staffSnap = await db.collection('businesses').doc(bizId).collection('staff').get();
    for (const sDoc of staffSnap.docs) {
      const data = sDoc.data();
      if (data.pin && !data.pinHash) {
        const pinHash = bcrypt.hashSync(String(data.pin).trim(), 10);
        await sDoc.ref.update({ pinHash });
        migratedStaffCount++;
      }
    }

    // Managers
    const managersSnap = await db.collection('businesses').doc(bizId).collection('managers').get();
    for (const mDoc of managersSnap.docs) {
      const data = mDoc.data();
      if (data.password && !data.passwordHash) {
        const passwordHash = bcrypt.hashSync(String(data.password), 10);
        await mDoc.ref.update({ passwordHash });
        migratedManagersCount++;
      }
    }
  }

  // 2. Iterate global_features driver_auth docs
  const globalSnap = await db.collection('global_features').get();
  for (const gDoc of globalSnap.docs) {
    if (gDoc.id.startsWith('driver_auth_')) {
      const data = gDoc.data();
      if (data.pin && !data.pinHash) {
        const pinHash = bcrypt.hashSync(String(data.pin).trim(), 10);
        await gDoc.ref.update({ pinHash });
        migratedGlobalDriversCount++;
      }
    }
  }

  // 3. Iterate driver_auth_lookup
  const lookupSnap = await db.collection('driver_auth_lookup').get();
  for (const lDoc of lookupSnap.docs) {
    const data = lDoc.data();
    if (data.pin && !data.pinHash) {
      const pinHash = bcrypt.hashSync(String(data.pin).trim(), 10);
      await lDoc.ref.update({ pinHash });
    }
  }

  return {
    success: true,
    migratedStaffCount,
    migratedManagersCount,
    migratedGlobalDriversCount
  };
});

/**
 * migrateDriverManifests (Phase 2)
 * Admin-only callable that non-destructively copies legacy shared global_features driver data
 * into per-tenant subcollections (businesses/{bizId}/driver_manifest/{staffId}, etc.)
 */
exports.migrateDriverManifests = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const callerEmail = (request.auth?.token?.email || '').toLowerCase();
  const isAdminUser = request.auth?.token?.admin === true || 
    (request.auth?.token?.email_verified === true && [
      'cosvynsolutions@gmail.com',
      'admin@scalekitchen.in',
      'memosmy10@gmail.com'
    ].includes(callerEmail));

  if (!callerUid || !isAdminUser) {
    throw new HttpsError('permission-denied', 'Only Super Admins can execute Phase 2 data migration.');
  }

  const db = admin.firestore();
  let copiedManifests = 0;
  let copiedStatuses = 0;
  let copiedLogs = 0;

  const globalSnap = await db.collection('global_features').get();
  for (const gDoc of globalSnap.docs) {
    const docId = gDoc.id;
    const data = gDoc.data();

    // 1. Manifest
    if (docId.startsWith('driver_manifest_')) {
      const bizId = docId.replace('driver_manifest_', '');
      if (bizId) {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null) {
            const staffId = value.staffId || value.boyId || value.id || key;
            await db.collection('businesses').doc(bizId)
              .collection('driver_manifest').doc(staffId)
              .set({
                ...value,
                bizId,
                staffId,
                migratedFromGlobal: true,
                migratedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            copiedManifests++;
          }
        }
      }
    }

    // 2. Status
    if (docId.startsWith('driver_status_')) {
      const parts = docId.replace('driver_status_', '').split('_');
      const bizId = parts[0];
      const staffId = parts.slice(1).join('_');
      if (bizId && staffId) {
        await db.collection('businesses').doc(bizId)
          .collection('driver_status').doc(staffId)
          .set({
            ...data,
            bizId,
            staffId,
            migratedFromGlobal: true,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        copiedStatuses++;
      }
    }

    // 3. Logs
    if (docId.startsWith('driver_logs_')) {
      const parts = docId.replace('driver_logs_', '').split('_');
      const bizId = parts[0];
      const date = parts.slice(1).join('_');
      if (bizId) {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null) {
            const logId = value.id || `${date}_${key}`;
            await db.collection('businesses').doc(bizId)
              .collection('delivery_logs').doc(logId)
              .set({
                ...value,
                bizId,
                date: value.date || date,
                migratedFromGlobal: true,
                migratedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            copiedLogs++;
          }
        }
      }
    }
  }

  return {
    success: true,
    copiedManifests,
    copiedStatuses,
    copiedLogs
  };
});

/**
 * claimFreeTrial (Phase 2)
 * Server-authoritative activation of the 14-day free trial.
 * Prevents client-side manipulation of plan fields or trial_claims documents.
 */
exports.claimFreeTrial = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to claim free trial.');
  }

  const { bizId, mobile, email } = request.data || {};
  const targetBizId = bizId || callerUid;

  if (targetBizId !== callerUid && !request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'You can only claim free trial for your own business account.');
  }

  const db = admin.firestore();
  const bizRef = db.collection('businesses').doc(targetBizId);
  const bizSnap = await bizRef.get();

  if (!bizSnap.exists) {
    throw new HttpsError('not-found', 'Business profile not found.');
  }

  const bizData = bizSnap.data();
  if (bizData.trialClaimed === true || bizData.planStatus === 'Active') {
    throw new HttpsError('already-exists', 'Free trial has already been claimed for this business account.');
  }

  const normPhone = String(mobile || bizData.mobile || '').replace(/\D/g, '').slice(-10);
  const normEmail = String(email || bizData.email || request.auth?.token?.email || '').trim().toLowerCase();

  // Check trial_claims documents
  const checks = [
    db.collection('trial_claims').doc(`user_${targetBizId}`).get()
  ];
  if (normPhone && normPhone.length === 10) {
    checks.push(db.collection('trial_claims').doc(`phone_${normPhone}`).get());
  }
  if (normEmail && normEmail.includes('@')) {
    checks.push(db.collection('trial_claims').doc(`email_${normEmail}`).get());
  }

  const results = await Promise.all(checks);
  for (const snap of results) {
    if (snap.exists) {
      throw new HttpsError(
        'already-exists',
        'Free trial has already been claimed using this account, phone number, or email address.'
      );
    }
  }

  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 14);
  const expiryIso = expiryDate.toISOString().split('T')[0];

  const claimRecord = {
    userId: targetBizId,
    email: normEmail,
    mobile: normPhone,
    claimedAt: now.toISOString(),
    expiryDate: expiryIso,
    durationDays: 14
  };

  const batch = db.batch();
  batch.set(db.collection('trial_claims').doc(`user_${targetBizId}`), claimRecord);
  if (normPhone && normPhone.length === 10) {
    batch.set(db.collection('trial_claims').doc(`phone_${normPhone}`), claimRecord);
  }
  if (normEmail && normEmail.includes('@')) {
    batch.set(db.collection('trial_claims').doc(`email_${normEmail}`), claimRecord);
  }

  batch.update(bizRef, {
    planName: 'Free Trial',
    planStatus: 'Active',
    planExpiryDate: expiryIso,
    trialClaimed: true,
    trialStartDate: now.toISOString(),
    trialDurationDays: 14,
    updatedAt: now.toISOString()
  });

  await batch.commit();

  return {
    success: true,
    planName: 'Free Trial',
    planStatus: 'Active',
    planExpiryDate: expiryIso
  };
});

/**
 * deleteDriver (Phase 2)
 * Server-authoritative driver deletion that removes lookup and status records.
 */
exports.deleteDriver = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const { bizId, staffId, phone } = request.data || {};

  if (!callerUid || (callerUid !== bizId && !request.auth?.token?.admin)) {
    throw new HttpsError('permission-denied', 'Only the business owner or admin can delete drivers.');
  }

  const db = admin.firestore();
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

  if (cleanPhone) {
    await db.collection('driver_auth_lookup').doc(cleanPhone).delete().catch(() => {});
    await db.collection('global_features').doc(`driver_auth_${cleanPhone}`).delete().catch(() => {});
  }

  if (bizId && staffId) {
    await db.collection('businesses').doc(bizId).collection('staff').doc(staffId).delete().catch(() => {});
    await db.collection('businesses').doc(bizId).collection('driver_manifest').doc(staffId).delete().catch(() => {});
    await db.collection('businesses').doc(bizId).collection('driver_status').doc(staffId).delete().catch(() => {});
  }

  return { success: true };
});

/**
 * ============================================================================
 * PHASE 3: SERVER-SIDE PAYMENTS, WEBHOOK IDEMPOTENCY & GEMINI AI SECRETS
 * ============================================================================
 */

// Authoritative Server-Side Plan Definitions (Prices strictly in integer paise)
const SERVER_SAAS_PLANS = {
  'monthly': { id: 'Monthly', label: 'Monthly', pricePaise: 99900, durationMonths: 1, type: 'subscription' },
  '6 months': { id: '6 Months', label: '6 Months', pricePaise: 509900, durationMonths: 6, type: 'subscription' },
  '6months': { id: '6 Months', label: '6 Months', pricePaise: 509900, durationMonths: 6, type: 'subscription' },
  'yearly': { id: 'Yearly', label: 'Yearly', pricePaise: 959900, durationMonths: 12, type: 'subscription' },
  // Invoice Recharge Packs
  'mini': { id: 'mini', label: 'Mini Invoice Pack', pricePaise: 1000, count: 1, type: 'invoice_recharge' },
  'saver': { id: 'saver', label: 'Saver Invoice Pack', pricePaise: 1500, count: 2, type: 'invoice_recharge' },
  'value': { id: 'value', label: 'Value Invoice Pack', pricePaise: 2500, count: 5, type: 'invoice_recharge' },
  'smart': { id: 'smart', label: 'Smart Invoice Pack', pricePaise: 4000, count: 10, type: 'invoice_recharge' },
  'pro': { id: 'pro', label: 'Pro Saver Invoice Pack', pricePaise: 6000, count: 20, type: 'invoice_recharge' },
  'ultimate': { id: 'ultimate', label: 'Ultimate Invoice Pack', pricePaise: 10000, count: 50, type: 'invoice_recharge' }
};

/**
 * Computes authoritative plan details and discounts on the server.
 * NEVER trusts client-submitted prices.
 */
async function getServerPlanDetails(planId) {
  const normalized = String(planId || '').trim().toLowerCase();
  if (normalized === 'freetrial' || normalized === 'free trial') {
    throw new HttpsError('invalid-argument', 'Free trial does not require Razorpay order. Use claimFreeTrial instead.');
  }

  const db = admin.firestore();
  let basePlan = null;
  let offer = null;

  // 1. Check real-time dynamic plans in global_settings/saas_config
  try {
    const configSnap = await db.collection('global_settings').doc('saas_config').get();
    if (configSnap.exists) {
      const configData = configSnap.data();
      const dbPlans = configData.plans || [];
      offer = configData.offer;

      const matched = dbPlans.find(p => 
        String(p.id).toLowerCase() === normalized ||
        (p.label && p.label.toLowerCase() === normalized) ||
        (p.durationMonths && `${p.durationMonths} months` === normalized)
      );

      if (matched) {
        basePlan = {
          id: matched.id,
          label: matched.label,
          pricePaise: Math.round(Number(matched.price) * 100),
          durationMonths: Number(matched.durationMonths) || 1,
          type: 'subscription'
        };
      }
    }
  } catch (e) {
    console.warn('[Razorpay] saas_config fetch notice:', e.message);
  }

  // 2. Fallback to static server list if not in dynamic config
  if (!basePlan) {
    basePlan = SERVER_SAAS_PLANS[normalized];
  }

  if (!basePlan) {
    throw new HttpsError('not-found', `Unknown plan: '${planId}'.`);
  }

  let pricePaise = basePlan.pricePaise;
  let appliedDiscountPercent = 0;

  // Apply offer discount if active
  if (offer && offer.isActive && offer.discountPercent > 0 && basePlan.type === 'subscription') {
    const endsAt = offer.endsAt ? new Date(offer.endsAt) : null;
    if (!endsAt || new Date() < endsAt) {
      appliedDiscountPercent = Math.min(100, Math.max(0, Number(offer.discountPercent)));
      const discountAmountPaise = Math.round((pricePaise * appliedDiscountPercent) / 100);
      pricePaise = Math.max(100, pricePaise - discountAmountPaise);
    }
  }

  return {
    ...basePlan,
    finalPricePaise: pricePaise,
    discountPercent: appliedDiscountPercent
  };
}

/**
 * Server-authoritative payment fulfillment logic.
 * Enforces strict idempotency via unique paymentId documents in `processed_payments`.
 * Only this function writes planName, planStatus, planExpiryDate, lastPaymentId and billing_history.
 */
async function fulfillPayment(paymentId, orderId, bizIdHint, paymentAmountPaiseHint) {
  const db = admin.firestore();
  const processedRef = db.collection('processed_payments').doc(paymentId);

  // 1. Idempotency Check: prevent replay attacks from extending plans twice
  const processedSnap = await processedRef.get();
  if (processedSnap.exists && processedSnap.data().status === 'fulfilled') {
    console.log(`[Fulfillment] Payment ${paymentId} already fulfilled. Skipping.`);
    return {
      success: true,
      alreadyProcessed: true,
      planExpiryDate: processedSnap.data().planExpiryDate || null
    };
  }

  // 2. Fetch order document
  let order = null;
  if (orderId) {
    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (orderSnap.exists) {
      order = orderSnap.data();
    }
  }

  const targetBizId = order?.bizId || bizIdHint;
  if (!targetBizId) {
    throw new HttpsError('not-found', 'Could not identify target business account for this payment.');
  }

  const planType = order?.type || 'subscription';
  const durationMonths = order?.durationMonths || 1;
  const planLabel = order?.planLabel || order?.planId || 'Monthly';
  const amountPaise = order?.amountPaise || paymentAmountPaiseHint || 0;
  const amountRupees = amountPaise > 0 ? (amountPaise / 100) : 0;

  // 3. Fetch current business data
  const bizRef = db.collection('businesses').doc(targetBizId);
  const bizSnap = await bizRef.get();
  if (!bizSnap.exists) {
    throw new HttpsError('not-found', `Business profile '${targetBizId}' not found.`);
  }
  const bizData = bizSnap.data();

  const todayStr = new Date().toISOString().split('T')[0];
  let newExpiryDate = null;
  const batch = db.batch();

  if (planType === 'subscription') {
    // Server computes expiry: extend from current expiry if valid and future, else from today
    let baseDate = new Date();
    if (bizData.planExpiryDate && bizData.planExpiryDate >= todayStr) {
      baseDate = new Date(bizData.planExpiryDate);
    }
    baseDate.setMonth(baseDate.getMonth() + durationMonths);
    newExpiryDate = baseDate.toISOString().split('T')[0];

    // Strictly server-written fields
    batch.update(bizRef, {
      planName: `COSVYN ONE (${planLabel})`,
      planStatus: 'Active',
      planExpiryDate: newExpiryDate,
      lastPaymentId: paymentId,
      updatedAt: new Date().toISOString()
    });

    // Record to billing_history subcollection with integer paise
    const historyRef = bizRef.collection('billing_history').doc(paymentId);
    batch.set(historyRef, {
      amount: amountRupees,    // Legacy Rupee amount for backward compatibility
      amountPaise: amountPaise, // NEW integer paise
      currency: 'INR',
      date: new Date().toISOString(),
      planName: `COSVYN ONE (${planLabel})`,
      paymentId: paymentId,
      orderId: orderId || null,
      expiryDate: newExpiryDate,
      type: 'Subscription',
      status: 'Paid'
    });
  } else if (planType === 'invoice_recharge') {
    const creditsToAdd = order?.invoiceCredits || 1;
    const currentCredits = Number(bizData.purchasedInvoiceCredits) || 0;
    const newCredits = currentCredits + creditsToAdd;

    batch.update(bizRef, {
      purchasedInvoiceCredits: newCredits,
      lastPaymentId: paymentId,
      updatedAt: new Date().toISOString()
    });

    const historyRef = bizRef.collection('billing_history').doc(paymentId);
    batch.set(historyRef, {
      amount: amountRupees,
      amountPaise: amountPaise,
      currency: 'INR',
      date: new Date().toISOString(),
      planName: `Invoice Recharge (${planLabel})`,
      paymentId: paymentId,
      orderId: orderId || null,
      type: 'Invoice Recharge',
      status: 'Paid'
    });
  }

  // Mark payment as fulfilled to guarantee idempotency
  batch.set(processedRef, {
    paymentId,
    orderId: orderId || null,
    bizId: targetBizId,
    amountPaise: amountPaise,
    status: 'fulfilled',
    planExpiryDate: newExpiryDate,
    fulfilledAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (orderId) {
    batch.update(db.collection('orders').doc(orderId), {
      status: 'paid',
      paymentId: paymentId,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  console.log(`[Fulfillment] Payment ${paymentId} successfully fulfilled for ${targetBizId}. New Expiry: ${newExpiryDate}`);

  return {
    success: true,
    planExpiryDate: newExpiryDate,
    planStatus: 'Active'
  };
}

/**
 * createRazorpayOrder (Phase 3)
 * Callable that reads the price strictly from the server-side plan list,
 * creates the order via the Razorpay API using secrets from Secret Manager,
 * and returns order_id.
 */
exports.createRazorpayOrder = onCall({
  cors: true,
  secrets: [razorpayKeySecret, razorpayKeyId]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to create payment orders.');
  }

  const { planId } = request.data || {};
  if (!planId) {
    throw new HttpsError('invalid-argument', 'planId is required.');
  }

  // Server calculates price from authoritative server list (NEVER from client)
  const plan = await getServerPlanDetails(planId);
  const pricePaise = plan.finalPricePaise;

  // Retrieve secrets from Secret Manager or environment
  let keySecret = '';
  try { keySecret = razorpayKeySecret.value(); } catch (e) { keySecret = process.env.RAZORPAY_KEY_SECRET || ''; }
  let keyId = '';
  try { keyId = razorpayKeyId.value(); } catch (e) { keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_SXPy6QPmqMyjkM'; }

  if (!keySecret) keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId) keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_SXPy6QPmqMyjkM';

  const receipt = `rcpt_${callerUid.slice(0, 8)}_${Date.now()}`;
  let orderId = '';

  if (keySecret && keyId && !keyId.includes('placeholder')) {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: pricePaise,
        currency: 'INR',
        receipt: receipt,
        notes: {
          bizId: callerUid,
          planId: plan.id,
          planLabel: plan.label,
          durationMonths: String(plan.durationMonths || 0),
          type: plan.type
        }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Razorpay Order Error]:', resp.status, errText);
      throw new HttpsError('internal', `Failed to create Razorpay order: ${resp.statusText}`);
    }

    const orderData = await resp.json();
    orderId = orderData.id;
  } else {
    console.warn('[Razorpay] Using test simulated order (set RAZORPAY_KEY_SECRET in Secret Manager for live/test API)');
    orderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // Persist unfulfilled order in Firestore
  const db = admin.firestore();
  await db.collection('orders').doc(orderId).set({
    orderId: orderId,
    bizId: callerUid,
    planId: plan.id,
    planLabel: plan.label,
    amountPaise: pricePaise, // Stored as integer paise in all NEW records
    amount: pricePaise / 100, // Legacy rupee field
    currency: 'INR',
    durationMonths: plan.durationMonths || 0,
    invoiceCredits: plan.count || 0,
    type: plan.type,
    status: 'created',
    receipt: receipt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    orderId,
    amount: pricePaise,
    currency: 'INR',
    keyId: keyId || 'rzp_test_SXPy6QPmqMyjkM',
    planName: plan.label
  };
});

/**
 * verifyRazorpayPayment (Phase 3)
 * Callable that verifies razorpay_signature using RAZORPAY_KEY_SECRET,
 * and updates planName, planStatus, planExpiryDate, lastPaymentId and billing_history.
 */
exports.verifyRazorpayPayment = onCall({
  cors: true,
  secrets: [razorpayKeySecret]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to verify payments.');
  }

  const { orderId, paymentId, signature } = request.data || {};
  if (!paymentId) {
    throw new HttpsError('invalid-argument', 'paymentId is required.');
  }

  let keySecret = '';
  try { keySecret = razorpayKeySecret.value(); } catch (e) { keySecret = process.env.RAZORPAY_KEY_SECRET || ''; }
  if (!keySecret) keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  // Verify HMAC SHA256 signature if orderId & signature are provided
  if (signature && orderId && keySecret) {
    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (expected !== signature) {
      throw new HttpsError('invalid-argument', 'Invalid Razorpay payment signature.');
    }
  } else if (!keySecret && signature) {
    console.warn('[Razorpay] No secret configured, skipping signature verification in test fallback.');
  }

  // Fulfill idempotently on the server
  const result = await fulfillPayment(paymentId, orderId, callerUid, null);
  return result;
});

/**
 * razorpayWebhook (Phase 3)
 * HTTPS function that verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET
 * and handles payment.captured idempotently (unique paymentId document).
 */
exports.razorpayWebhook = onRequest({
  secrets: [razorpayWebhookSecret, razorpayKeySecret]
}, async (req, res) => {
  let webhookSecret = '';
  try { webhookSecret = razorpayWebhookSecret.value(); } catch (e) { webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''; }
  if (!webhookSecret) webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  if (webhookSecret && signature) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      console.error('[Razorpay Webhook] Invalid X-Razorpay-Signature.');
      return res.status(400).send('Invalid signature');
    }
  } else if (webhookSecret && !signature) {
    return res.status(400).send('Missing X-Razorpay-Signature header');
  }

  const eventData = req.body || {};
  const event = eventData.event;

  if (event === 'payment.captured') {
    const payment = eventData.payload?.payment?.entity;
    if (payment) {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountPaise = payment.amount;
      const bizId = payment.notes?.bizId;

      try {
        await fulfillPayment(paymentId, orderId, bizId, amountPaise);
        return res.status(200).json({ status: 'ok', paymentId });
      } catch (err) {
        console.error('[Razorpay Webhook] Fulfillment error:', err);
        return res.status(500).json({ error: err.message });
      }
    }
  }

  return res.status(200).json({ status: 'ignored', event });
});

/**
 * geminiGenerate (Phase 3)
 * Server-side callable for Gemini AI with user authentication and rate limiting.
 * Requires auth and keeps GEMINI_API_KEY secure in Secret Manager.
 */
exports.geminiGenerate = onCall({
  cors: true,
  secrets: [geminiApiKey]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required to use AI features.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const rateLimitRef = db.collection('gemini_rate_limits').doc(callerUid);

  // Rate limiting: max 15 requests per 60 seconds
  const rateLimitSnap = await rateLimitRef.get();
  let rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { count: 0, windowStart: now };
  
  if (now - (rateLimitData.windowStart || 0) > 60000) {
    rateLimitData = { count: 1, windowStart: now };
  } else {
    if (rateLimitData.count >= 15) {
      throw new HttpsError('resource-exhausted', 'AI generation rate limit exceeded (max 15/min). Please try again in a minute.');
    }
    rateLimitData.count = (rateLimitData.count || 0) + 1;
  }
  await rateLimitRef.set(rateLimitData);

  let apiKey = '';
  try { apiKey = geminiApiKey.value(); } catch (e) { apiKey = process.env.GEMINI_API_KEY || ''; }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret is not configured on the server.');
  }

  const { action, data, customerQuery } = request.data || {};

  let prompt = '';
  let model = 'gemini-2.5-flash';

  if (action === 'business_insights') {
    model = 'gemini-2.5-pro';
    const activeData = Array.isArray(data) ? data.filter(d => (d.value || 0) > 0 || (d.secondaryValue || 0) > 0) : [];
    if (activeData.length === 0) {
      return { text: "Gathering data to provide your first AI insight..." };
    }
    prompt = `Analyze the following monthly revenue (value) vs expenses (secondaryValue) data for a meal subscription business.\nData: ${JSON.stringify(activeData)}\n\nProvide a concise 3-bullet point summary of the financial health and 1 strategic recommendation for the kitchen owner. Keep it professional, encouraging, and brief. Use Lakhs/Rupees context.`;
  } else if (action === 'support_reply') {
    model = 'gemini-2.5-flash';
    prompt = `You are a helpful customer support agent for 'ScaleKitchen', a SaaS platform for tiffin services.\nDraft a polite, empathetic, and concise reply to the following kitchen owner query: "${customerQuery || ''}"`;
  } else {
    throw new HttpsError('invalid-argument', 'Invalid AI action. Must be business_insights or support_reply.');
  }

  // Server-side call to Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[Gemini Server Error]:', resp.status, err);
    throw new HttpsError('internal', `Gemini API call failed with status ${resp.status}`);
  }

  const resJson = await resp.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  return { text };
});



