
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

// Use memoryLocalCache to ensure clean in-memory state in iframe environments
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache({}) 
});

export default app;
