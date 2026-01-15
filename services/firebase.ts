
// @ts-ignore
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4",
  authDomain: "subbussinesssaas.firebaseapp.com",
  projectId: "subbussinesssaas",
  storageBucket: "subbussinesssaas.firebasestorage.app",
  messagingSenderId: "954257463672",
  appId: "1:954257463672:web:6bef130b67567997e9108d",
  measurementId: "G-QHYDRHE6RG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// FIX: Initializing Firestore with experimentalForceLongPolling to prevent "Could not reach backend" errors
// and adding multi-tab persistence for a smoother SaaS experience.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Bypass WebSocket issues
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export default app;
