
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence, 
  indexedDBLocalPersistence,
  GoogleAuthProvider
} from "firebase/auth";
import { initializeFirestore, memoryLocalCache, setLogLevel } from "firebase/firestore";

// Silence internal WebChannel reconnect logs in iFrame
setLogLevel('silent');

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4",
  authDomain: "subbussinesssaas.firebaseapp.com",
  projectId: "subbussinesssaas",
  storageBucket: "subbussinesssaas.firebasestorage.app",
  messagingSenderId: "954257463672",
  appId: "1:954257463672:web:6bef130b67567997e9108d",
  measurementId: "G-QHYDRHE6RG"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with browser and memory persistence (prevents iframe sandbox indexedDB SecurityError and auth/network-request-failed)
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
  } catch {
    return getAuth(app);
  }
})();

export const googleProvider = new GoogleAuthProvider();

import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize Firebase Functions for secure server-side callables
export const functions = getFunctions(app);

// Callable function instances
export const driverLoginCallable = httpsCallable<
  { phone: string; pin: string },
  { token: string; driver: { name: string; bizId: string; staffId: string; branchId: string; mobile: string } }
>(functions, 'driverLogin');

export const managerLoginCallable = httpsCallable<
  { email: string; password: string; bizId?: string },
  { token: string; manager: { id: string; name: string; email: string; branchId: string; allowedPages: string[]; bizId: string } }
>(functions, 'managerLogin');

export const setDriverPinCallable = httpsCallable<
  { bizId: string; staffId?: string; phone: string; pin: string; name?: string; branchId?: string; additionalData?: any },
  { success: boolean; staffId: string }
>(functions, 'setDriverPin');

export const setManagerPasswordCallable = httpsCallable<
  { bizId: string; managerId?: string; password: string; managerData: any },
  { success: boolean; managerId: string }
>(functions, 'setManagerPassword');

export const migrateCredentialsCallable = httpsCallable<
  Record<string, never>,
  { success: boolean; migratedStaffCount: number; migratedManagersCount: number; migratedGlobalDriversCount: number }
>(functions, 'migratePlaintextCredentials');

/**
 * @deprecated Legacy shared session removed in Phase 1 security hardening.
 * Driver authentication is now handled via secure driverLogin callable returning custom tokens.
 */
export const ensureDriverAuth = async () => {
  return auth.currentUser;
};

// Use memoryLocalCache to ensure clean in-memory state in iframe environments
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache({}) 
});

export default app;
