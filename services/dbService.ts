
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
  collectionGroup,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '../contexts/AuthContext';
import { SHARED_SAAS_PLANS, SHARED_OFFER, SaasPlan, SpecialOffer } from './saasStore';

// Hook to subscribe to a sub-collection of the current user
export const useStreamCollection = <T>(collectionName: string) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setData([]);
      setLoading(false);
      return;
    }

    // Reference: businesses/{userId}/{collectionName}
    const q = query(collection(db, 'businesses', currentUser.uid, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      setData(items);
      setLoading(false);
    }, (error) => {
      console.error(`Error streaming ${collectionName}:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, collectionName]);

  return { data, loading };
};

// Generic Add Function
export const addItem = async (userId: string, collectionName: string, data: any) => {
  try {
    const colRef = collection(db, 'businesses', userId, collectionName);
    // Add timestamps
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

// Generic Update Function
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

// Generic Delete Function
export const deleteItem = async (userId: string, collectionName: string, docId: string) => {
  try {
    const docRef = doc(db, 'businesses', userId, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting ${collectionName}/${docId}:`, error);
    throw error;
  }
};

// --- GLOBAL PRICING SERVICE (LANDING & SAAS) ---

export const useGlobalPricing = () => {
  const [plans, setPlans] = useState<SaasPlan[]>(SHARED_SAAS_PLANS);
  const [offer, setOffer] = useState<SpecialOffer>(SHARED_OFFER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to global_settings/saas_config
    const unsubscribe = onSnapshot(doc(db, 'global_settings', 'saas_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.plans) setPlans(data.plans);
        if (data.offer) setOffer(data.offer);
      }
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

// Fetch all businesses (Real Users)
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
    });
    return () => unsubscribe();
  }, []);

  return { tenants, loading };
};

// Fetch ALL billing history (SaaS Income)
export const useAdminBillingHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Queries all collections named 'billing_history'
    // NOTE: Removed orderBy to prevent "Missing Index" error on client without manual index creation
    const q = query(collectionGroup(db, 'billing_history'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        // Extract tenantId from path: businesses/{tenantId}/billing_history/{docId}
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
      console.error("Error fetching billing history:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { history, loading };
};

// Generic hook for root collections (Features, Support, Reviews)
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
