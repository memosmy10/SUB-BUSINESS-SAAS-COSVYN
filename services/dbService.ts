import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  where,
  getDocs,
  getDoc,
  collectionGroup,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '../contexts/AuthContext';
import { SHARED_SAAS_PLANS, SHARED_OFFER, SaasPlan, SpecialOffer } from './saasStore';
import { normalizePhone, normalizeEmail } from './store';

// Hook to subscribe to a sub-collection of the current user or manager-connected business
export const useStreamCollection = <T>(collectionName: string, customBizId?: string) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUid = customBizId || (window.location.hash.includes('/manager') ? localStorage.getItem('manager_biz_id') : null) || currentUser?.uid;

  useEffect(() => {
    if (!effectiveUid) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'businesses', effectiveUid, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      setData(items);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn(`Firestore Stream Error (${collectionName}):`, error.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [effectiveUid, collectionName]);

  return { data, loading };
};

export const addItem = async (userId: string, collectionName: string, data: any) => {
  try {
    const colRef = collection(db, 'businesses', userId, collectionName);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding to ${collectionName}:`, error);
    throw error;
  }
};

export const updateItem = async (userId: string, collectionName: string, docId: string, data: any) => {
  try {
    const docRef = doc(db, 'businesses', userId, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error updating ${collectionName}/${docId}:`, error);
    throw error;
  }
};

export const setItem = async (userId: string, collectionName: string, docId: string, data: any) => {
  try {
    const docRef = doc(db, 'businesses', userId, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error(`Error setting ${collectionName}/${docId}:`, error);
    throw error;
  }
};

export const deleteItem = async (userId: string, collectionName: string, docId: string) => {
  try {
    const docRef = doc(db, 'businesses', userId, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting ${collectionName}/${docId}:`, error);
    throw error;
  }
};

// --- GLOBAL PRICING SERVICE ---
export const useGlobalPricing = () => {
  const [plans, setPlans] = useState<SaasPlan[]>(SHARED_SAAS_PLANS);
  const [offer, setOffer] = useState<SpecialOffer>(SHARED_OFFER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'global_settings', 'saas_config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.plans) setPlans(data.plans);
        if (data.offer) setOffer(data.offer);
      }
      setLoading(false);
    }, (error) => {
      // Fallback silently to shared constants if permissions are temporarily unavailable
      setPlans(SHARED_SAAS_PLANS);
      setOffer(SHARED_OFFER);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { plans, offer, loading };
};

export const saveGlobalPricing = async (plans: SaasPlan[], offer: SpecialOffer) => {
  await setDoc(doc(db, 'global_settings', 'saas_config'), {
    plans,
    offer,
    updatedAt: new Date().toISOString()
  });
};

// --- ADMIN SERVICES ---
export const useAdminTenants = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'businesses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTenants(users);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Admin tenants stream error:", error.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { tenants, loading };
};

export const useAdminBillingHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collectionGroup(db, 'billing_history'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const pathSegments = doc.ref.path.split('/');
        return {
          id: doc.id,
          ...doc.data(),
          tenantId: pathSegments[1]
        };
      });
      setHistory(items);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.warn("Admin billing history error:", err.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { history, loading };
};

export const useGlobalCollection = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(items);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn(`Global Collection Error (${collectionName}):`, error.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [collectionName]);

  return { data, loading };
};

export const updateGlobalItem = async (collectionName: string, docId: string, data: any) => {
  await updateDoc(doc(db, collectionName, docId), data);
};

export const addGlobalItem = async (collectionName: string, data: any) => {
  await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: new Date().toISOString()
  });
};

/**
 * Checks if a given email or mobile number has already consumed a Free Trial.
 * Prevents users from abusing the 30-day trial with duplicate numbers or emails.
 */
export const checkFreeTrialEligibility = async (
  email: string, 
  mobile: string
): Promise<{ eligible: boolean; reason?: string }> => {
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(mobile);

  try {
    // 1. Check Phone in trial_claims
    if (normPhone) {
      const phoneSnap = await getDoc(doc(db, 'trial_claims', `phone_${normPhone}`));
      if (phoneSnap.exists()) {
        return {
          eligible: false,
          reason: `Mobile number (+91 ${normPhone}) has already been used for a Free Trial. Please select a subscription plan to continue.`
        };
      }
    }

    // 2. Check Email in trial_claims
    if (normEmail) {
      const emailSnap = await getDoc(doc(db, 'trial_claims', `email_${normEmail}`));
      if (emailSnap.exists()) {
        return {
          eligible: false,
          reason: `Email (${normEmail}) has already claimed a Free Trial. Please choose a subscription plan to continue.`
        };
      }
    }

    return { eligible: true };
  } catch (err) {
    console.warn("Error checking free trial eligibility:", err);
    // Fail-open or fallback gracefully
    return { eligible: true };
  }
};

/**
 * Permanently records a Free Trial activation under the user's phone and email.
 */
export const recordFreeTrialClaim = async (userId: string, email: string, mobile: string) => {
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(mobile);
  const now = new Date().toISOString();

  const promises: Promise<any>[] = [];

  if (normPhone) {
    promises.push(
      setDoc(doc(db, 'trial_claims', `phone_${normPhone}`), {
        userId,
        mobile: normPhone,
        email: normEmail,
        claimedAt: now
      }, { merge: true })
    );
  }

  if (normEmail) {
    promises.push(
      setDoc(doc(db, 'trial_claims', `email_${normEmail}`), {
        userId,
        mobile: normPhone,
        email: normEmail,
        claimedAt: now
      }, { merge: true })
    );
  }

  await Promise.all(promises);
};