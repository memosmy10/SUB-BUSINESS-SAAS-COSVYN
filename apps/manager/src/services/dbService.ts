import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { useManagerAuth } from '../contexts/ManagerAuthContext';

/**
 * Real-time collection stream hook scoped strictly to the authenticated manager's business
 * and automatically filtered to their assigned branch.
 */
export const useStreamCollection = <T>(collectionName: string) => {
  const { bizId, branchId, currentUser } = useManagerAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bizId || !currentUser) {
      setData([]);
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'businesses', bizId, collectionName);
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let items = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        })) as any[];

        // Strict branch access enforcement for managers
        if (branchId && branchId !== 'All') {
          if (collectionName === 'branches') {
            items = items.filter((b) => b.id === branchId || b.name === branchId);
          } else if (collectionName === 'customers') {
            items = items.filter((c) => c.branchId === branchId);
          } else if (collectionName === 'staff') {
            items = items.filter((s) => s.branchId === branchId);
          } else if (collectionName === 'plans') {
            items = items.filter((p) => !p.branchId || p.branchId === 'All' || p.branchId === branchId);
          } else if (collectionName === 'single_orders') {
            items = items.filter((o) => o.branchId === branchId);
          } else if (collectionName === 'expenses') {
            items = items.filter((e) => e.branchId === branchId);
          } else if (collectionName === 'inventory') {
            items = items.filter((i) => i.branchId === branchId);
          } else if (collectionName === 'notes') {
            items = items.filter((n) => !n.branchId || n.branchId === branchId);
          } else if (collectionName === 'delivery_logs') {
            items = items.filter((l) => !l.branchId || l.branchId === branchId);
          } else if (collectionName === 'payments') {
            items = items.filter((p) => !p.branchId || p.branchId === branchId);
          } else if (collectionName === 'driver_manifest') {
            items = items.filter((m) => !m.branchId || m.branchId === branchId);
          } else if (collectionName === 'driver_status') {
            items = items.filter((s) => !s.branchId || s.branchId === branchId);
          }
        }

        setData(items as T[]);
        setLoading(false);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.warn(`[ScaleKitchenManager] Firestore Stream Error (${collectionName}):`, error.message);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bizId, branchId, currentUser, collectionName]);

  return { data, loading };
};

export const addDocument = async (bizId: string, collectionName: string, data: any) => {
  if (!bizId) throw new Error("Missing business ID");
  const colRef = collection(db, 'businesses', bizId, collectionName);
  return await addDoc(colRef, {
    ...data,
    createdAt: new Date().toISOString()
  });
};

export const updateDocument = async (bizId: string, collectionName: string, id: string, data: any) => {
  if (!bizId || !id) throw new Error("Missing parameters");
  const docRef = doc(db, 'businesses', bizId, collectionName, id);
  return await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

export const deleteDocument = async (bizId: string, collectionName: string, id: string) => {
  if (!bizId || !id) throw new Error("Missing parameters");
  const docRef = doc(db, 'businesses', bizId, collectionName, id);
  return await deleteDoc(docRef);
};
