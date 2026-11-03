
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
 * PHASE 1 & 2: SERVER-VERIFIED DRIVER & MANAGER AUTHENTICATION (Cloud Functions v2)
 * ============================================================================
 */

/**
 * driverLogin
 * Verifies driver phone + PIN, enforces lockout (5 failures -> 15 min lock),
 * and issues a Firebase Custom Token with tenant, staff, branch, and route-scope claims.
 */
exports.driverLogin = onCall({ cors: true }, async (request) => {
  const { phone, pin } = request.data || {};

  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new HttpsError('invalid-argument', 'Valid 10-digit mobile number is required.');
  }

  const cleanPin = String(pin || '').trim();
  if (!cleanPin || !/^\d{4,6}$/.test(cleanPin)) {
    throw new HttpsError('invalid-argument', 'PIN must be between 4 and 6 digits.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const rateLimitRef = db.collection('auth_rate_limits').doc(`driver_${cleanPhone}`);
  const rateLimitSnap = await rateLimitRef.get();
  const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { attempts: 0, lockedUntil: null };

  // Check if locked out
  const lockedUntil = Number(rateLimitData.lockedUntil);
  if (Number.isFinite(lockedUntil) && lockedUntil > now) {
    const remainingMinutes = Math.max(1, Math.ceil((lockedUntil - now) / 60000));
    throw new HttpsError(
      'resource-exhausted',
      `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
    );
  }

  const recordFailedAttempt = async () => {
    const failure = await db.runTransaction(async (transaction) => {
      const currentSnap = await transaction.get(rateLimitRef);
      const currentData = currentSnap.exists ? currentSnap.data() : {};
      const currentTime = Date.now();
      const currentLockedUntil = Number(currentData.lockedUntil);

      if (Number.isFinite(currentLockedUntil) && currentLockedUntil > currentTime) {
        return { alreadyLocked: true, lockedUntil: currentLockedUntil };
      }

      const currentAttempts = Number.isSafeInteger(currentData.attempts) && currentData.attempts >= 0
        ? currentData.attempts
        : 0;
      const attempts = currentAttempts + 1;
      const isLocked = attempts >= 5;
      const nextLockedUntil = isLocked ? currentTime + (15 * 60 * 1000) : null;

      transaction.set(rateLimitRef, {
        attempts: isLocked ? 0 : attempts,
        lockedUntil: nextLockedUntil,
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        phone: cleanPhone
      }, { merge: true });

      return { attempts, isLocked, lockedUntil: nextLockedUntil };
    });

    if (failure.alreadyLocked) {
      const remainingMinutes = Math.max(1, Math.ceil((failure.lockedUntil - Date.now()) / 60000));
      throw new HttpsError(
        'resource-exhausted',
        `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
      );
    }

    if (failure.isLocked) {
      throw new HttpsError(
        'resource-exhausted',
        'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
      );
    }
    const remaining = 5 - failure.attempts;
    throw new HttpsError(
      'unauthenticated',
      `Invalid mobile number or PIN. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`
    );
  };

  // 1. Resolve rider ONLY from driver_auth_lookup/{cleanPhone} (O(1) doc read)
  const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
  const lookupSnap = await lookupRef.get();

  if (!lookupSnap.exists) {
    await recordFailedAttempt();
  }

  const driverDoc = lookupSnap.data();

  // 2. Verify with bcrypt against pinHash ONLY (no plaintext fallback)
  let isMatch = false;
  if (driverDoc && driverDoc.pinHash) {
    try {
      isMatch = bcrypt.compareSync(cleanPin, driverDoc.pinHash);
    } catch (bcryptErr) {
      console.error('[driverLogin] bcrypt compare error:', bcryptErr);
      isMatch = false;
    }
  }

  if (!isMatch) {
    await recordFailedAttempt();
  }

  // 4. Reject if lookup.active === false or status === 'Inactive'
  if (driverDoc.active === false || driverDoc.status === 'Inactive') {
    throw new HttpsError('permission-denied', 'This delivery partner account has been deactivated. Please contact your kitchen owner.');
  }

  // 4b. Reject if the business planStatus is Expired
  const bizId = driverDoc.bizId || '';
  if (!bizId) {
    throw new HttpsError('not-found', 'No associated kitchen found for this delivery partner.');
  }

  const bizSnap = await db.collection('businesses').doc(bizId).get();
  if (!bizSnap.exists) {
    throw new HttpsError('not-found', 'Associated kitchen was not found.');
  }
  const staffId = driverDoc.staffId || driverDoc.id;
  if (!staffId) {
    throw new HttpsError('not-found', 'Delivery partner profile was not found.');
  }
  const staffSnap = await db.collection('businesses').doc(bizId).collection('staff').doc(staffId).get();
  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Delivery partner profile was not found.');
  }
  const staffData = staffSnap.data();
  if (staffData.active === false || staffData.status === 'Inactive') {
    throw new HttpsError('permission-denied', 'This delivery partner account has been deactivated. Please contact your kitchen owner.');
  }

  const bizData = bizSnap.data();
  if (bizData.planStatus === 'Expired') {
    throw new HttpsError('permission-denied', 'Kitchen subscription has expired. Please contact the kitchen owner.');
  }

  const tenantStaffSnapshot = await db.collection('businesses').doc(bizId).collection('staff').get();
  const isSingleDriverBusiness = tenantStaffSnapshot.size <= 1;

  // Successful login -> clear lockout records
  await rateLimitRef.set({
    attempts: 0,
    lockedUntil: null,
    lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const branchId = staffData.branchId || driverDoc.branchId || '';
  const name = staffData.name || driverDoc.name || 'Delivery Partner';

  // 5. Issue custom token with claims { role:'driver', bizId, staffId, branchId } and uid driver_${bizId}_${staffId}
  const uid = `driver_${bizId}_${staffId}`;
  const claims = {
    role: 'driver',
    bizId,
    staffId,
    branchId,
    isSingleDriverBusiness
  };

  let customToken;
  try {
    customToken = await admin.auth().createCustomToken(uid, claims);
  } catch (tokenErr) {
    console.error('[driverLogin] createCustomToken error:', tokenErr);
    throw new HttpsError('internal', 'Failed to generate authentication token. Please try again.');
  }

  return {
    token: customToken,
    driver: {
      name,
      bizId,
      staffId,
      branchId,
      mobile: cleanPhone,
      isSingleDriverBusiness
    }
  };
});

/**
 * managerLogin
 * Verifies manager email + passwordHash only, enforces lockout (5 failures -> 15 min lock),
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

  // Verify Password with passwordHash ONLY (no plaintext fallback)
  let isMatch = false;
  if (managerDoc.passwordHash) {
    try {
      isMatch = bcrypt.compareSync(cleanPassword, managerDoc.passwordHash);
    } catch (bcryptErr) {
      console.error('[managerLogin] bcrypt error:', bcryptErr);
      isMatch = false;
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

  let customToken;
  try {
    customToken = await admin.auth().createCustomToken(uid, claims);
  } catch (tokenErr) {
    console.error('[managerLogin] createCustomToken error:', tokenErr);
    throw new HttpsError('internal', 'Failed to generate manager token. Please try again.');
  }

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
 * Writes authentication hashes only to driver_auth_lookup/{phone}.
 * Staff documents contain profile/status data but no PIN credential material.
 * Removes any legacy plaintext PIN record.
 * Rejects phone if already registered with another business.
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
  if (!cleanPin || !/^\d{4}$/.test(cleanPin)) {
    throw new HttpsError('invalid-argument', 'PIN must be exactly 4 digits.');
  }

  const db = admin.firestore();
  
  const pinHash = bcrypt.hashSync(cleanPin, 10);
  const targetStaffId = staffId || db.collection('businesses').doc(bizId).collection('staff').doc().id;
  const nowIso = new Date().toISOString();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(targetStaffId);
  const isStaffActive = additionalData?.status !== 'Inactive' && additionalData?.active !== false;
  const staffStatus = additionalData?.status || (isStaffActive ? 'Offline' : 'Inactive');
  const staffPayload = {
    ...(additionalData || {}),
    name: name || '',
    mobile: cleanPhone,
    branchId: branchId || '',
    active: isStaffActive,
    status: staffStatus,
    updatedAt: nowIso,
    pinHash: admin.firestore.FieldValue.delete(),
    pinVersion: admin.firestore.FieldValue.delete(),
    pin: admin.firestore.FieldValue.delete()
  };
  const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
  const credsRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(targetStaffId);
  await db.runTransaction(async (transaction) => {
    const [existingLookup, staffSnap] = await Promise.all([
      transaction.get(lookupRef),
      transaction.get(staffRef)
    ]);
    const existingData = existingLookup.exists ? existingLookup.data() : {};
    if (existingLookup.exists && (
      existingData.bizId !== bizId ||
      existingData.staffId !== targetStaffId
    )) {
      throw new HttpsError('already-exists', 'This mobile number is already registered with another kitchen.');
    }

    const oldMobile = staffSnap.exists
      ? String(staffSnap.data().mobile || '').replace(/\D/g, '').slice(-10)
      : '';
    const oldLookupRef = oldMobile && oldMobile !== cleanPhone
      ? db.collection('driver_auth_lookup').doc(oldMobile)
      : null;
    const oldLookup = oldLookupRef ? await transaction.get(oldLookupRef) : null;

    transaction.set(staffRef, staffPayload, { merge: true });
    transaction.set(lookupRef, {
      bizId,
      staffId: targetStaffId,
      name: name || '',
      mobile: cleanPhone,
      pinHash,
      pinVersion: nowIso,
      branchId: branchId || '',
      active: isStaffActive,
      status: staffStatus,
      updatedAt: nowIso
    }, { merge: true });
    transaction.delete(credsRef);
    if (oldLookupRef && oldLookup?.exists) {
      const oldLookupData = oldLookup.data();
      if (oldLookupData.bizId === bizId && oldLookupData.staffId === targetStaffId) {
        transaction.delete(oldLookupRef);
      }
    }
  });

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
 * Admin or Owner callable that migrates legacy staff PINs:
 * - upserts driver_auth_lookup/{phone}
 * - removes legacy plaintext PIN records and staff PIN fields
 * Also migrates manager passwords unless called with { driversOnly: true }.
 */
exports.migratePlaintextCredentials = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const driversOnly = request.data?.driversOnly === true;
  const callerUid = request.auth.uid;
  const callerToken = request.auth.token || {};
  const isAdmin = callerToken.admin === true ||
    (callerToken.email === 'memosmy10@gmail.com' && callerToken.email_verified === true);

  const db = admin.firestore();
  let migratedStaffCount = 0;
  let skippedStaffCount = 0;
  let migratedManagersCount = 0;

  // If not admin, only allow migrating caller's own business
  const businessIds = [];
  if (isAdmin) {
    const businessesSnap = await db.collection('businesses').get();
    businessesSnap.docs.forEach(d => businessIds.push(d.id));
  } else {
    businessIds.push(callerUid);
  }

  for (const bizId of businessIds) {
    // 1. Staff
    const staffSnap = await db.collection('businesses').doc(bizId).collection('staff').get();
    for (const sDoc of staffSnap.docs) {
      const nowIso = new Date().toISOString();
      const credentialRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(sDoc.id);
      const result = await db.runTransaction(async (transaction) => {
        const currentStaff = await transaction.get(sDoc.ref);
        if (!currentStaff.exists) {
          transaction.delete(credentialRef);
          return { migrated: false, skipped: false };
        }

        const data = currentStaff.data();
        const rawPin = data.pin ? String(data.pin).trim() : '';
        const cleanPhone = String(data.mobile || '').replace(/\D/g, '').slice(-10);
        const lookupRef = cleanPhone.length === 10
          ? db.collection('driver_auth_lookup').doc(cleanPhone)
          : null;
        const lookupSnap = lookupRef ? await transaction.get(lookupRef) : null;
        const lookupData = lookupSnap?.exists ? lookupSnap.data() : {};
        const validRawPin = /^\d{4,6}$/.test(rawPin);
        const pinHash = validRawPin
          ? bcrypt.hashSync(rawPin, 10)
          : (lookupData.pinHash || data.pinHash || '');
        const lookupBelongsToOtherAccount = Boolean(
          lookupSnap?.exists &&
          (lookupData.bizId !== bizId || lookupData.staffId !== sDoc.id)
        );
        const canMoveHashToLookup = Boolean(lookupRef && pinHash && !lookupBelongsToOtherAccount);

        if (canMoveHashToLookup) {
          transaction.set(lookupRef, {
            bizId,
            staffId: sDoc.id,
            name: data.name || '',
            mobile: cleanPhone,
            pinHash,
            pinVersion: lookupData.pinVersion || data.pinVersion || nowIso,
            branchId: data.branchId || '',
            active: data.status !== 'Inactive' && data.active !== false,
            status: data.status || 'Offline',
            updatedAt: nowIso
          }, { merge: true });
        }

        if (data.pin || data.pinHash || data.pinVersion) {
          transaction.update(sDoc.ref, {
            pin: admin.firestore.FieldValue.delete(),
            pinHash: admin.firestore.FieldValue.delete(),
            pinVersion: admin.firestore.FieldValue.delete(),
            updatedAt: nowIso
          });
        }
        transaction.delete(credentialRef);

        return {
          migrated: canMoveHashToLookup && (validRawPin || data.pinHash || data.pinVersion),
          skipped: !canMoveHashToLookup && Boolean(data.pin || data.pinHash || data.pinVersion)
        };
      });
      if (result.migrated) migratedStaffCount++;
      if (result.skipped) skippedStaffCount++;
    }

    const remainingCredentialDocs = await db
      .collection('businesses')
      .doc(bizId)
      .collection('staff_credentials')
      .get();
    for (let offset = 0; offset < remainingCredentialDocs.docs.length; offset += 400) {
      const batch = db.batch();
      remainingCredentialDocs.docs.slice(offset, offset + 400).forEach((credentialDoc) => {
        batch.delete(credentialDoc.ref);
      });
      await batch.commit();
    }

    if (driversOnly) continue;

    // 2. Managers
    const managersSnap = await db.collection('businesses').doc(bizId).collection('managers').get();
    for (const mDoc of managersSnap.docs) {
      const data = mDoc.data();
      if (data.password) {
        const passwordHash = bcrypt.hashSync(String(data.password), 10);
        await mDoc.ref.update({
          passwordHash,
          password: admin.firestore.FieldValue.delete(),
          updatedAt: new Date().toISOString()
        });
        migratedManagersCount++;
      }
    }
  }

  return {
    success: true,
    migratedStaffCount,
    skippedStaffCount,
    migratedManagersCount
  };
});

/**
 * purgeLegacyDriverDocs
 * Admin-only callable that deletes all global_features documents whose ID starts with "driver_auth_" or "driver_manifest_"
 */
exports.purgeLegacyDriverDocs = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const callerEmail = (request.auth.token && request.auth.token.email) || '';
  const isAdmin = callerEmail === 'memosmy10@gmail.com' || (request.auth.token && request.auth.token.admin === true);

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only designated system admins can purge legacy driver docs.');
  }

  const db = admin.firestore();
  let deletedCount = 0;

  const globalSnap = await db.collection('global_features').get();
  const batch = db.batch();
  let batchOps = 0;

  for (const docSnap of globalSnap.docs) {
    const id = docSnap.id;
    if (id.startsWith('driver_auth_') || id.startsWith('driver_manifest_')) {
      batch.delete(docSnap.ref);
      batchOps++;
      deletedCount++;

      if (batchOps >= 400) {
        await batch.commit();
        batchOps = 0;
      }
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  return {
    success: true,
    deletedCount
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
 * Server-authoritative activation of the 30-day free trial.
 * Prevents client-side manipulation of plan fields or trial_claims documents.
 */
exports.claimFreeTrial = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to claim free trial.');
  }

  const { bizId } = request.data || {};
  const targetBizId = bizId || callerUid;

  if (targetBizId !== callerUid && !request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'You can only claim free trial for your own business account.');
  }

  const db = admin.firestore();
  const bizRef = db.collection('businesses').doc(targetBizId);
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  const expiryIso = expiryDate.toISOString().split('T')[0];

  await db.runTransaction(async (transaction) => {
    const currentBiz = await transaction.get(bizRef);
    if (!currentBiz.exists) {
      throw new HttpsError('not-found', 'Business profile not found.');
    }
    const currentData = currentBiz.data();
    if (currentData.trialClaimed === true || currentData.planStatus === 'Active') {
      throw new HttpsError('already-exists', 'Free trial has already been claimed for this business account.');
    }

    const normPhone = String(currentData.mobile || '').replace(/\D/g, '').slice(-10);
    const normEmail = String(request.auth.token.email || '').trim().toLowerCase();
    const claimRefs = [
      db.collection('trial_claims').doc(`user_${targetBizId}`)
    ];
    if (normPhone.length === 10) {
      claimRefs.push(db.collection('trial_claims').doc(`phone_${normPhone}`));
    }
    if (normEmail.includes('@')) {
      claimRefs.push(db.collection('trial_claims').doc(`email_${normEmail}`));
    }
    const claimSnaps = await Promise.all(claimRefs.map((claimRef) => transaction.get(claimRef)));
    if (claimSnaps.some((claimSnap) => claimSnap.exists)) {
      throw new HttpsError(
        'already-exists',
        'Free trial has already been claimed using this account, phone number, or email address.'
      );
    }

    const claimRecord = {
      userId: targetBizId,
      email: normEmail,
      mobile: normPhone,
      claimedAt: now.toISOString(),
      expiryDate: expiryIso,
      durationDays: 30
    };
    claimRefs.forEach((claimRef) => transaction.set(claimRef, claimRecord));
    transaction.update(bizRef, {
      planName: 'Free Trial',
      planStatus: 'Active',
      planExpiryDate: expiryIso,
      trialClaimed: true,
      trialStartDate: now.toISOString(),
      trialDurationDays: 30,
      updatedAt: now.toISOString()
    });
  });

  return {
    success: true,
    planName: 'Free Trial',
    planStatus: 'Active',
    planExpiryDate: expiryIso
  };
});

exports.consumeInvoiceCredit = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const bizId = request.data?.bizId;
  if (!callerUid || callerUid !== bizId) {
    throw new HttpsError('permission-denied', 'Only the business owner can consume invoice credits.');
  }

  const db = admin.firestore();
  const bizRef = db.collection('businesses').doc(callerUid);
  const now = new Date();
  const monthKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit'
  }).format(now);

  return db.runTransaction(async (transaction) => {
    const bizSnap = await transaction.get(bizRef);
    if (!bizSnap.exists) {
      throw new HttpsError('not-found', 'Business profile was not found.');
    }
    const data = bizSnap.data();
    const monthlyFreeUsed = data.lastInvoiceResetMonth === monthKey
      ? Number(data.monthlyFreeUsed || 0)
      : 0;
    const purchasedCredits = Number(data.purchasedInvoiceCredits || 0);
    if (
      !Number.isSafeInteger(monthlyFreeUsed) || monthlyFreeUsed < 0 ||
      !Number.isSafeInteger(purchasedCredits) || purchasedCredits < 0
    ) {
      throw new HttpsError('failed-precondition', 'Invoice credit balance is invalid.');
    }

    let nextMonthlyFreeUsed = monthlyFreeUsed;
    let nextPurchasedCredits = purchasedCredits;
    let source;
    if (monthlyFreeUsed < 3) {
      nextMonthlyFreeUsed += 1;
      source = 'monthly_free';
    } else if (purchasedCredits > 0) {
      nextPurchasedCredits -= 1;
      source = 'purchased';
    } else {
      throw new HttpsError('resource-exhausted', 'No invoice credits remain.');
    }

    transaction.update(bizRef, {
      monthlyFreeUsed: nextMonthlyFreeUsed,
      purchasedInvoiceCredits: nextPurchasedCredits,
      lastInvoiceResetMonth: monthKey,
      updatedAt: now.toISOString()
    });
    return {
      success: true,
      source,
      monthlyFreeUsed: nextMonthlyFreeUsed,
      purchasedInvoiceCredits: nextPurchasedCredits
    };
  });
});

/**
 * deleteDriver (Phase 2 & 3)
 * Server-authoritative driver deletion that removes credentials, lookup, and status records.
 */
exports.deleteDriver = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const { bizId, staffId } = request.data || {};

  if (!bizId || !staffId) {
    throw new HttpsError('invalid-argument', 'Business and driver IDs are required.');
  }
  if (!callerUid || (callerUid !== bizId && !request.auth?.token?.admin)) {
    throw new HttpsError('permission-denied', 'Only the business owner or admin can delete drivers.');
  }

  const db = admin.firestore();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();
  const cleanPhone = staffSnap.exists
    ? String(staffSnap.data().mobile || '').replace(/\D/g, '').slice(-10)
    : '';
  const batch = db.batch();
  if (cleanPhone.length === 10) {
    const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
    const legacyRef = db.collection('global_features').doc(`driver_auth_${cleanPhone}`);
    const [lookupSnap, legacySnap] = await Promise.all([lookupRef.get(), legacyRef.get()]);
    if (lookupSnap.exists) {
      const lookup = lookupSnap.data();
      if (lookup.bizId === bizId && lookup.staffId === staffId) batch.delete(lookupRef);
    }
    if (legacySnap.exists) {
      const legacy = legacySnap.data();
      if (legacy.tenantId === bizId && legacy.staffId === staffId) batch.delete(legacyRef);
    }
  }
  batch.delete(staffRef);
  batch.delete(db.collection('businesses').doc(bizId).collection('staff_credentials').doc(staffId));
  batch.delete(db.collection('businesses').doc(bizId).collection('driver_manifest').doc(staffId));
  batch.delete(db.collection('businesses').doc(bizId).collection('driver_status').doc(staffId));
  await batch.commit();

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

function addUtcMonthsClamped(date, months) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const originalDay = date.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

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
        (typeof p.label === 'string' && p.label.toLowerCase() === normalized) ||
        (p.durationMonths && `${p.durationMonths} months` === normalized)
      );

      if (matched) {
        basePlan = {
          id: matched.id,
          label: matched.label,
          pricePaise: Math.round(Number(matched.price) * 100),
          durationMonths: Number(matched.durationMonths),
          type: 'subscription'
        };
      }
    }
  } catch (e) {
    console.error('[Razorpay] Could not load server pricing configuration.');
    throw new HttpsError('unavailable', 'Pricing is temporarily unavailable.');
  }

  // 2. Fallback to static server list if not in dynamic config
  if (!basePlan) {
    basePlan = SERVER_SAAS_PLANS[normalized];
  }

  if (!basePlan) {
    throw new HttpsError('not-found', `Unknown plan: '${planId}'.`);
  }

  const durationMonths = Number(basePlan.durationMonths || 0);
  if (
    typeof basePlan.id !== 'string' || !basePlan.id.trim() ||
    typeof basePlan.label !== 'string' || !basePlan.label.trim() ||
    !Number.isSafeInteger(basePlan.pricePaise) || basePlan.pricePaise <= 0 ||
    (basePlan.type === 'subscription' && (!Number.isSafeInteger(durationMonths) || durationMonths < 1 || durationMonths > 24)) ||
    (basePlan.type === 'invoice_recharge' && (!Number.isSafeInteger(basePlan.count) || basePlan.count < 1))
  ) {
    throw new HttpsError('failed-precondition', 'The selected plan is not configured correctly.');
  }

  let pricePaise = basePlan.pricePaise;
  let appliedDiscountPercent = 0;

  // Apply offer discount if active
  if (offer?.isActive && basePlan.type === 'subscription') {
    const discountPercent = Number(offer.discountPercent);
    const endsAt = offer.endsAt ? new Date(offer.endsAt) : null;
    if (
      !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      (endsAt && !Number.isFinite(endsAt.getTime()))
    ) {
      throw new HttpsError('failed-precondition', 'The active pricing offer is not configured correctly.');
    }
    if (discountPercent > 0 && (!endsAt || new Date() < endsAt)) {
      appliedDiscountPercent = discountPercent;
      const discountAmountPaise = Math.round((pricePaise * appliedDiscountPercent) / 100);
      pricePaise = Math.max(100, pricePaise - discountAmountPaise);
    }
  }

  if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0) {
    throw new HttpsError('failed-precondition', 'The selected plan price is invalid.');
  }

  return {
    ...basePlan,
    finalPricePaise: pricePaise,
    discountPercent: appliedDiscountPercent
  };
}

/**
 * Server-authoritative payment fulfillment logic. Payment and order idempotency,
 * business entitlements, and billing history are committed atomically.
 */
async function fulfillPayment(paymentId, orderId, paymentAmountPaise, currency = 'INR') {
  if (
    typeof paymentId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(paymentId) ||
    typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(orderId) ||
    !Number.isSafeInteger(paymentAmountPaise) || paymentAmountPaise <= 0
  ) {
    throw new HttpsError('invalid-argument', 'A valid payment, order, and amount are required.');
  }

  const db = admin.firestore();
  const processedRef = db.collection('processed_payments').doc(paymentId);
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const processedSnap = await transaction.get(processedRef);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Payment order was not found.');
    }

    const order = orderSnap.data();
    if (processedSnap.exists) {
      const processed = processedSnap.data();
      if (processed.status === 'fulfilled' && processed.orderId === orderId) {
        return {
          success: true,
          alreadyProcessed: true,
          planExpiryDate: processed.planExpiryDate || null
        };
      }
      throw new HttpsError('already-exists', 'Payment was already applied to another order.');
    }
    if (order.status !== 'created') {
      throw new HttpsError('failed-precondition', 'Payment order is not awaiting payment.');
    }
    if (
      !order.bizId ||
      !Number.isSafeInteger(order.amountPaise) ||
      order.amountPaise !== paymentAmountPaise ||
      order.currency !== 'INR' ||
      currency !== order.currency
    ) {
      throw new HttpsError('failed-precondition', 'Payment details do not match the order.');
    }
    if (!['subscription', 'invoice_recharge'].includes(order.type)) {
      throw new HttpsError('failed-precondition', 'Payment order type is invalid.');
    }

    const bizRef = db.collection('businesses').doc(order.bizId);
    const bizSnap = await transaction.get(bizRef);
    if (!bizSnap.exists) {
      throw new HttpsError('not-found', 'Business profile was not found.');
    }

    const bizData = bizSnap.data();
    const now = new Date();
    const nowIso = now.toISOString();
    const amountRupees = paymentAmountPaise / 100;
    let newExpiryDate = null;
    const historyRef = bizRef.collection('billing_history').doc(paymentId);

    if (order.type === 'subscription') {
      const durationMonths = Number(order.durationMonths);
      if (!Number.isSafeInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
        throw new HttpsError('failed-precondition', 'Subscription duration is invalid.');
      }
      const todayStr = nowIso.split('T')[0];
      let baseDate = new Date(`${todayStr}T00:00:00.000Z`);
      const currentExpiry = typeof bizData.planExpiryDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(bizData.planExpiryDate)
        ? new Date(`${bizData.planExpiryDate}T00:00:00.000Z`)
        : null;
      if (
        currentExpiry &&
        Number.isFinite(currentExpiry.getTime()) &&
        currentExpiry.toISOString().slice(0, 10) === bizData.planExpiryDate &&
        bizData.planExpiryDate >= todayStr
      ) {
        baseDate = currentExpiry;
      }
      newExpiryDate = addUtcMonthsClamped(baseDate, durationMonths).toISOString().split('T')[0];

      transaction.update(bizRef, {
        planName: `COSVYN ONE (${order.planLabel})`,
        planStatus: 'Active',
        planExpiryDate: newExpiryDate,
        lastPaymentId: paymentId,
        updatedAt: nowIso
      });
      transaction.set(historyRef, {
        amount: amountRupees,
        amountPaise: paymentAmountPaise,
        currency: 'INR',
        date: nowIso,
        planName: `COSVYN ONE (${order.planLabel})`,
        paymentId,
        orderId,
        expiryDate: newExpiryDate,
        type: 'Subscription',
        status: 'Paid'
      });
    } else {
      const creditsToAdd = Number(order.invoiceCredits);
      if (!Number.isSafeInteger(creditsToAdd) || creditsToAdd < 1) {
        throw new HttpsError('failed-precondition', 'Invoice credit quantity is invalid.');
      }
      const currentCredits = Number.isSafeInteger(bizData.purchasedInvoiceCredits)
        ? bizData.purchasedInvoiceCredits
        : 0;
      if (!Number.isSafeInteger(currentCredits + creditsToAdd)) {
        throw new HttpsError('resource-exhausted', 'Invoice credit balance is at its supported limit.');
      }
      transaction.update(bizRef, {
        purchasedInvoiceCredits: currentCredits + creditsToAdd,
        lastPaymentId: paymentId,
        lastRechargePlan: order.planLabel,
        updatedAt: nowIso
      });
      transaction.set(historyRef, {
        amount: amountRupees,
        amountPaise: paymentAmountPaise,
        currency: 'INR',
        date: nowIso,
        planName: `Invoice Recharge (${order.planLabel})`,
        paymentId,
        orderId,
        type: 'Invoice Recharge',
        status: 'Paid',
        creditsAdded: creditsToAdd
      });
    }

    transaction.set(processedRef, {
      paymentId,
      orderId,
      bizId: order.bizId,
      amountPaise: paymentAmountPaise,
      status: 'fulfilled',
      planExpiryDate: newExpiryDate,
      fulfilledAt: admin.firestore.FieldValue.serverTimestamp()
    });
    transaction.update(orderRef, {
      status: 'paid',
      paymentId,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const result = { success: true };
    if (order.type === 'subscription') {
      result.planExpiryDate = newExpiryDate;
      result.planStatus = 'Active';
    } else {
      result.purchasedInvoiceCredits =
        (Number.isSafeInteger(bizData.purchasedInvoiceCredits) ? bizData.purchasedInvoiceCredits : 0) +
        Number(order.invoiceCredits);
    }
    return result;
  });
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
  if (typeof planId !== 'string' || !planId.trim()) {
    throw new HttpsError('invalid-argument', 'planId is required.');
  }

  // Server calculates price from authoritative server list (NEVER from client)
  const plan = await getServerPlanDetails(planId);
  const pricePaise = plan.finalPricePaise;

  let keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  let keyId = process.env.RAZORPAY_KEY_ID || '';
  try { keySecret = razorpayKeySecret.value() || keySecret; } catch (e) {}
  try { keyId = razorpayKeyId.value() || keyId; } catch (e) {}
  if (!keySecret || !keyId) {
    throw new HttpsError('failed-precondition', 'Razorpay is not configured.');
  }

  const receipt = `rcpt_${callerUid.slice(0, 8)}_${Date.now()}`;
  const db = admin.firestore();
  const businessSnap = await db.collection('businesses').doc(callerUid).get();
  if (!businessSnap.exists) {
    throw new HttpsError('failed-precondition', 'Create the business profile before purchasing a plan.');
  }

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
      receipt,
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
    console.error('[Razorpay Order Error]:', resp.status);
    throw new HttpsError('internal', 'Failed to create Razorpay order.');
  }
  const orderData = await resp.json();
  if (!orderData.id || orderData.amount !== pricePaise || orderData.currency !== 'INR') {
    throw new HttpsError('internal', 'Razorpay returned an invalid order.');
  }
  const orderId = orderData.id;

  // Persist unfulfilled order in Firestore
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
    keyId,
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
  secrets: [razorpayKeySecret, razorpayKeyId]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to verify payments.');
  }

  const { orderId, paymentId, signature } = request.data || {};
  if (
    typeof orderId !== 'string' || !orderId ||
    typeof paymentId !== 'string' || !paymentId ||
    typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    throw new HttpsError('invalid-argument', 'Payment, order, and signature are required.');
  }

  let keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  let keyId = process.env.RAZORPAY_KEY_ID || '';
  try { keySecret = razorpayKeySecret.value() || keySecret; } catch (e) {}
  try { keyId = razorpayKeyId.value() || keyId; } catch (e) {}
  if (!keySecret || !keyId) {
    throw new HttpsError('failed-precondition', 'Razorpay is not configured.');
  }

  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
    throw new HttpsError('invalid-argument', 'Invalid Razorpay payment signature.');
  }

  const db = admin.firestore();
  const orderSnap = await db.collection('orders').doc(orderId).get();
  if (!orderSnap.exists || orderSnap.data().bizId !== callerUid) {
    throw new HttpsError('permission-denied', 'Payment order does not belong to this account.');
  }

  const apiResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    }
  });
  if (!apiResponse.ok) {
    console.error('[Razorpay Payment Verification Error]:', apiResponse.status);
    throw new HttpsError('failed-precondition', 'Razorpay could not confirm this payment.');
  }
  const payment = await apiResponse.json();
  if (
    payment.order_id !== orderId ||
    payment.status !== 'captured' ||
    payment.captured !== true ||
    payment.currency !== 'INR' ||
    payment.amount !== orderSnap.data().amountPaise
  ) {
    throw new HttpsError('failed-precondition', 'Payment details do not match a captured order.');
  }

  return fulfillPayment(paymentId, orderId, payment.amount, payment.currency);
});

/**
 * razorpayWebhook (Phase 3)
 * HTTPS function that verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET
 * and handles payment.captured idempotently (unique paymentId document).
 */
exports.razorpayWebhook = onRequest({
  secrets: [razorpayWebhookSecret, razorpayKeySecret]
}, async (req, res) => {
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  try { webhookSecret = razorpayWebhookSecret.value() || webhookSecret; } catch (e) {}

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  if (!webhookSecret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(400).send('Webhook authentication is not configured.');
  }
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
    console.error('[Razorpay Webhook] Invalid X-Razorpay-Signature.');
    return res.status(400).send('Invalid signature');
  }

  const eventData = req.body || {};
  const event = eventData.event;

  if (event === 'payment.captured') {
    const payment = eventData.payload?.payment?.entity;
    if (payment?.status === 'captured' && payment.captured === true && payment.currency === 'INR') {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountPaise = payment.amount;
      try {
        await fulfillPayment(paymentId, orderId, amountPaise, payment.currency);
        return res.status(200).json({ status: 'ok', paymentId });
      } catch (err) {
        console.error('[Razorpay Webhook] Fulfillment failed:', err.code || err.name);
        return res.status(500).json({ error: 'Payment fulfillment failed.' });
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
