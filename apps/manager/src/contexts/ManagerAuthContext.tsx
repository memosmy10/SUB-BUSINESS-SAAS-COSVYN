import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  managerLoginCallable,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  getManagerClaims,
  ManagerClaims
} from '../services/firebase';
import {
  BranchManager,
  getTodayStr,
  normalizeEmail
} from '../services/managerStore';

interface ManagerAuthContextType {
  currentUser: User | null;
  claims: ManagerClaims | null;
  loggedInManager: BranchManager | null;
  bizId: string;
  branchId: string;
  allowedPages: string[];
  sessionLogId: string | null;
  loading: boolean;
  setBizId: (bizId: string) => void;
  login: (email: string, password: string, targetBizId: string) => Promise<BranchManager>;
  logout: () => Promise<void>;
}

const ManagerAuthContext = createContext<ManagerAuthContextType | undefined>(undefined);

export const ManagerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read biz from URL search, hash query, or localStorage
  const getInitialBiz = (): string => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlBiz = searchParams.get('biz');
      if (urlBiz) return urlBiz;

      const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashPart);
      const hashBiz = hashParams.get('biz');
      if (hashBiz) return hashBiz;

      return localStorage.getItem('manager_biz_id') || '';
    } catch {
      return '';
    }
  };

  const [bizId, setBizIdState] = useState<string>(getInitialBiz());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<ManagerClaims | null>(null);
  const [loggedInManager, setLoggedInManager] = useState<BranchManager | null>(null);
  const [branchId, setBranchId] = useState<string>('All');
  const [allowedPages, setAllowedPages] = useState<string[]>(['dashboard']);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const setBizId = (newBizId: string) => {
    const trimmed = newBizId.trim();
    setBizIdState(trimmed);
    if (trimmed) {
      localStorage.setItem('manager_biz_id', trimmed);
    } else {
      localStorage.removeItem('manager_biz_id');
    }
  };

  // Listen to auth changes on the dedicated ScaleKitchenManager Firebase app
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const fetchedClaims = await getManagerClaims(user);
          setClaims(fetchedClaims);

          // Verify manager claim role
          if (fetchedClaims?.role === 'manager') {
            if (fetchedClaims.bizId) {
              setBizIdState(fetchedClaims.bizId);
              localStorage.setItem('manager_biz_id', fetchedClaims.bizId);
            }
            if (fetchedClaims.branchId) {
              setBranchId(fetchedClaims.branchId);
              localStorage.setItem('manager_branch_id', fetchedClaims.branchId);
            }
          }

          // Restore manager profile from localStorage if matching
          const savedManagerRaw = localStorage.getItem('manager_data');
          const savedLogId = localStorage.getItem('manager_session_log_id');
          if (savedManagerRaw) {
            try {
              const parsed: BranchManager = JSON.parse(savedManagerRaw);
              setLoggedInManager(parsed);
              if (parsed.branchId) setBranchId(parsed.branchId);
              if (parsed.allowedPages && parsed.allowedPages.length > 0) {
                setAllowedPages(parsed.allowedPages);
              }
            } catch (parseErr) {
              console.warn("Failed to parse cached manager_data:", parseErr);
            }
          }
          if (savedLogId) setSessionLogId(savedLogId);
        } catch (err) {
          console.warn("Error processing manager auth state:", err);
        }
      } else {
        setClaims(null);
        setLoggedInManager(null);
        setBranchId('All');
        setAllowedPages(['dashboard']);
        setSessionLogId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, targetBizId: string): Promise<BranchManager> => {
    const cleanEmail = normalizeEmail(email);
    const cleanBizId = targetBizId.trim();

    if (!cleanBizId) {
      throw new Error("A valid Kitchen / Business ID is required.");
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("A valid manager email address is required.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    // Invoke cloud function
    const result = await managerLoginCallable({
      email: cleanEmail,
      password,
      bizId: cleanBizId
    });

    if (!result?.data?.token) {
      throw new Error("No authorization token received from server.");
    }

    // Authenticate with custom token on the dedicated app instance
    const cred = await signInWithCustomToken(auth, result.data.token);
    const managerData = result.data.manager as unknown as BranchManager;

    const resolvedBranch = managerData.branchId || 'All';
    const pages = (managerData.allowedPages && managerData.allowedPages.length > 0)
      ? managerData.allowedPages
      : ['dashboard'];

    // Create session audit log in Firestore
    const todayStr = getTodayStr();
    const now = new Date();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const logData = {
      id: logId,
      managerId: managerData.id,
      managerName: managerData.name,
      managerEmail: cleanEmail,
      branchId: resolvedBranch,
      branchName: resolvedBranch === 'All' ? 'All Branches' : 'Main Branch',
      date: todayStr,
      loginTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      logoutTime: null,
      status: 'Active',
      createdAt: now.toISOString()
    };

    try {
      await setDoc(doc(db, 'businesses', cleanBizId, 'manager_logs', logId), logData);
    } catch (logErr) {
      console.warn("Could not record manager session log:", logErr);
    }

    // Update local states & storage
    setBizIdState(cleanBizId);
    setBranchId(resolvedBranch);
    setAllowedPages(pages);
    setLoggedInManager(managerData);
    setSessionLogId(logId);

    localStorage.setItem('manager_biz_id', cleanBizId);
    localStorage.setItem('manager_data', JSON.stringify(managerData));
    localStorage.setItem('manager_branch_id', resolvedBranch);
    localStorage.setItem('manager_session_log_id', logId);

    // Refresh claims
    const verifiedClaims = await getManagerClaims(cred.user);
    setClaims(verifiedClaims);

    return managerData;
  };

  const logout = async (): Promise<void> => {
    if (bizId && sessionLogId) {
      try {
        const now = new Date();
        const logDocRef = doc(db, 'businesses', bizId, 'manager_logs', sessionLogId);
        await updateDoc(logDocRef, {
          logoutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'Logged Out',
          updatedAt: now.toISOString()
        });
      } catch (err) {
        console.warn("Could not update manager logout timestamp:", err);
      }
    }

    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out error:", err);
    }

    localStorage.removeItem('manager_data');
    localStorage.removeItem('manager_branch_id');
    localStorage.removeItem('manager_session_log_id');
    setLoggedInManager(null);
    setClaims(null);
    setSessionLogId(null);
  };

  return (
    <ManagerAuthContext.Provider
      value={{
        currentUser,
        claims,
        loggedInManager,
        bizId,
        branchId,
        allowedPages,
        sessionLogId,
        loading,
        setBizId,
        login,
        logout
      }}
    >
      {children}
    </ManagerAuthContext.Provider>
  );
};

export const useManagerAuth = (): ManagerAuthContextType => {
  const context = useContext(ManagerAuthContext);
  if (!context) {
    throw new Error('useManagerAuth must be used within a ManagerAuthProvider');
  }
  return context;
};
