
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
