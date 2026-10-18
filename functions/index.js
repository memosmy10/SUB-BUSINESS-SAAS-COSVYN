
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

admin.initializeApp();

/**
 * Scheduled job to run every day at midnight.
 * Checks all 'Active' businesses and updates their status to 'Expired'
 * if their planExpiryDate has passed.
 */
exports.checkSubscriptionExpiry = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const db = admin.firestore();
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`[Cron] Running subscription expiry check for date: ${todayStr}`);

  try {
    // 1. Query all businesses that are currently 'Active'
    // This reduces reads by ignoring already expired/inactive users.
    const snapshot = await db.collection('businesses')
      .where('planStatus', '==', 'Active')
      .get();

    if (snapshot.empty) {
      console.log('[Cron] No active subscriptions found to check.');
      return null;
    }

    const batch = db.batch();
    let expiredCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Check if planExpiryDate exists and is strictly less than today's date
      // Example: Expiry "2023-10-01" < Today "2023-10-02" -> TRUE (Expired)
      if (data.planExpiryDate && data.planExpiryDate < todayStr) {
        const docRef = db.collection('businesses').doc(doc.id);
        
        batch.update(docRef, { 
          planStatus: 'Expired',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        expiredCount++;
      }
    });

    // Commit the batch if there are updates
    if (expiredCount > 0) {
      await batch.commit();
      console.log(`[Cron] Successfully expired ${expiredCount} subscriptions.`);
    } else {
      console.log('[Cron] No subscriptions matched expiry criteria today.');
    }

  } catch (error) {
    console.error('[Cron] Error executing checkSubscriptionExpiry:', error);
  }

  return null;
});

/**
 * Scheduled job to run every day to backup the Firestore database to Cloud Storage.
 * REQUIRES: 
 * 1. 'Cloud Datastore Import Export Admin' role for the App Engine default service account.
 * 2. A default App Engine storage bucket enabled.
 */
exports.scheduledFirestoreExport = functions.pubsub.schedule('every 24 hours').onRun((context) => {
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  const databaseName = client.databasePath(projectId, '(default)');
  const bucketName = `gs://${projectId}.appspot.com`;

  console.log(`[Backup] Starting backup for project ${projectId} to ${bucketName}/backups`);

  return client.exportDocuments({
    name: databaseName,
    outputUriPrefix: `${bucketName}/backups/${new Date().toISOString()}`,
    // Leave collectionIds empty to export all collections
    collectionIds: []
  })
  .then(responses => {
    const response = responses[0];
    console.log(`[Backup] Operation Name: ${response.name}`);
    return response;
  })
  .catch(err => {
    console.error('[Backup] Export operation failed:', err);
    throw new Error('Export operation failed');
  });
});

/**
 * ============================================================================
 * PHASE 1: SERVER-VERIFIED DRIVER & MANAGER AUTHENTICATION (Cloud Functions v2)
 * ============================================================================
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const bcrypt = require("bcryptjs");

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


