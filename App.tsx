import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OnboardingPayment from './pages/OnboardingPayment';
import Dashboard from './pages/Dashboard';
import Prep from './pages/Prep';
import Customers from './pages/Customers';
import SingleOrders from './pages/SingleOrders';
import Notes from './pages/Notes';
import Analytics from './pages/Analytics';
import Support from './pages/Support';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Payments from './pages/Payments';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Deliveries from './pages/Deliveries';
import Inventory from './pages/Inventory';
import Messages from './pages/Messages';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminFeatureSupport from './pages/admin/AdminFeatureSupport';
import AdminProfile from './pages/admin/AdminProfile';
import AdminPlans from './pages/admin/AdminPlans';
import AdminLogin from './pages/admin/AdminLogin';
import AdminMessages from './pages/admin/AdminMessages';
import AdminInvoiceCredits from './pages/admin/AdminInvoiceCredits';

// Legal Pages
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Shipping from './pages/legal/Shipping';
import Refunds from './pages/legal/Refunds';
import Contact from './pages/legal/Contact';

import { 
  Menu, X, Zap, LogOut, Bell, AlertTriangle, Loader2, User, CheckCircle, Phone, MapPin, ArrowRight, MessageSquare
} from 'lucide-react';
import { getDaysDifference, calculateRemainingDeliveries } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAIL } from './services/adminStore';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useStreamCollection } from './services/dbService';

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.group("ScaleKitchen Runtime Crash");
    console.error("Error:", error);
    console.error("Info:", errorInfo);
    console.groupEnd();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md border border-slate-200">
             <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
             </div>
             <h1 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h1>
             <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                The application encountered an unexpected error. This usually happens due to a temporary network glitch or missing data.
             </p>
             <div className="space-y-3">
                <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                  Try Refreshing
                </button>
                <button onClick={() => window.location.href = '/'} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                  Back to Home
                </button>
             </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- SUBSCRIPTION MANAGER ---
const SubscriptionManager = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const capturePaymentParams = () => {
      try {
        const rawParams = new URLSearchParams(window.location.search);
        const urlStatus = rawParams.get('status');
        if (urlStatus === 'success') {
          const planId = rawParams.get('plan_id');
          const paymentId = rawParams.get('payment_id');
          if (planId) {
            localStorage.setItem('pending_subscription', JSON.stringify({
              planId, paymentId: paymentId || 'manual_entry', timestamp: Date.now()
            }));
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.history.state;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      } catch (e) { console.error("URL Param processing failed:", e); }
    };
    capturePaymentParams();

    const getPlanDetails = (planId: string) => {
      let durationMonths = 1, internalPlanName = 'Monthly';
      const pid = (planId || '').toLowerCase();
      if (pid.includes('6months') || pid.includes('half')) { durationMonths = 6; internalPlanName = '6 Months'; }
      else if (pid.includes('yearly') || pid.includes('annual')) { durationMonths = 12; internalPlanName = 'Yearly'; }
      return { durationMonths, internalPlanName };
    };

    const processActivation = async () => {
      if (!currentUser || !currentUser.email || status !== 'idle') return;
      const pendingStr = localStorage.getItem('pending_subscription');
      let pendingFirestoreData = null;
      
      if (!pendingStr) {
         try {
            const docRef = doc(db, 'pending_activations', currentUser.email);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { pendingFirestoreData = { ...docSnap.data(), ref: docRef }; }
         } catch (e) {}
      }

      if (pendingStr || pendingFirestoreData) {
        setStatus('processing');
        try {
          let planId, paymentId;
          if (pendingStr) {
             const parsed = JSON.parse(pendingStr);
             planId = parsed.planId; paymentId = parsed.paymentId;
          } else {
             planId = pendingFirestoreData.planId; paymentId = pendingFirestoreData.paymentId || 'external';
          }
          const { durationMonths, internalPlanName } = getPlanDetails(planId);
          const now = new Date();
          now.setMonth(now.getMonth() + durationMonths);
          const newExpiryDate = now.toISOString().split('T')[0];
          
          await updateDoc(doc(db, 'businesses', currentUser.uid), {
            planName: `COSVYN ONE (${internalPlanName})`,
            planStatus: 'Active',
            planExpiryDate: newExpiryDate,
            lastPaymentId: paymentId,
            updatedAt: new Date().toISOString()
          });

          if (pendingStr) localStorage.removeItem('pending_subscription');
          if (pendingFirestoreData) await deleteDoc(pendingFirestoreData.ref);
          
          setStatus('success');
          setTimeout(() => { setStatus('idle'); navigate('/app/dashboard', { replace: true }); }, 2000);
        } catch (error) { 
          console.error("Subscription Activation Error:", error);
          setStatus('error'); 
        }
      }
    };
    processActivation();
  }, [currentUser, navigate, status]);

  if (status === 'idle') return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === 'processing' && (
          <div className="flex flex-col items-center"><Loader2 className="animate-spin text-primary-600 mb-4" size={48} /><h2 className="text-xl font-bold text-slate-900 mb-2">Activating Plan...</h2></div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"><CheckCircle size={32} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">Success!</h2></div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div><h2 className="text-xl font-bold text-slate-900 mb-2">Error</h2><button onClick={() => setStatus('idle')} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">Close</button></div>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.email !== ADMIN_EMAIL) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) { 
          const data = docSnap.data();
          const isStatusActive = data.planStatus === 'Active';
          const expiryDate = data.planExpiryDate;
          const today = new Date().toISOString().split('T')[0];
          const daysLeft = expiryDate ? getDaysDifference(today, expiryDate) : 100;
          
          const isActuallyActive = isStatusActive && daysLeft >= 0;
          setHasActivePlan(isActuallyActive);

          // Auto-update status in DB if expired
          if (isStatusActive && daysLeft < 0) {
            updateDoc(doc(db, 'businesses', currentUser.uid), { 
              planStatus: 'Expired',
              updatedAt: new Date().toISOString()
            }).catch(err => console.error("Auto-update plan status failed:", err));
          }
        } 
        else { setHasActivePlan(false); }
      }, (err) => {
        console.error("Protected Route Error:", err);
        setHasActivePlan(false);
      });
      return () => unsubscribe();
    } else if (currentUser) { setHasActivePlan(true); }
  }, [currentUser]);

  if (loading || (currentUser && hasActivePlan === null)) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;
  }
  
  if (currentUser?.email === ADMIN_EMAIL) return <Navigate to="/admin/dashboard" replace />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (hasActivePlan === false) return <Navigate to="/onboarding" replace />;
  
  return <AppLayout />;
};

const AdminRoute = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-white" size={40} /></div>;
  if (currentUser && currentUser.email === ADMIN_EMAIL) return <AdminLayout />;
  return <Navigate to="/admin/login" replace />;
};

const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [planExpiryDate, setPlanExpiryDate] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  
  const { data: customers = [] } = useStreamCollection<any>('customers');
  const { data: plans = [] } = useStreamCollection<any>('plans');

  // FIX: SYNCED LIVE CALCULATION FOR NOTIFICATIONS
  const expiringCustomers = React.useMemo(() => {
    return (customers || [])
      .map((c: any) => {
        // Calculate the TRUE days left for each customer based on their active plans
        const realDaysLeft = (c.activePlans || []).reduce((max: number, p: any) => {
          const planConfig = plans.find((pl: any) => pl.id === p.planId);
          if (!planConfig) return max;
          const left = calculateRemainingDeliveries(p.endDate, planConfig.weekdays || [], p.pauses || []);
          return Math.max(max, left);
        }, 0);
        return { ...c, realDaysLeft };
      })
      .filter((c: any) => c.isActive && c.realDaysLeft <= 10 && c.realDaysLeft > 0)
      .sort((a: any, b: any) => a.realDaysLeft - b.realDaysLeft);
  }, [customers, plans]);

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) { 
          const d = docSnap.data(); 
          setPlanExpiryDate(d.planExpiryDate || null); 
          setPlanName(d.planName || null);
        }
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  const daysToExpiry = planExpiryDate ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) : 100;
  const showExpiryWarning = daysToExpiry <= 10 && daysToExpiry >= 0;
  const isFreeTrial = planName === 'Free Trial';

  const handleLogout = async () => { await logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {showExpiryWarning && (
          <div className={`${isFreeTrial ? 'bg-emerald-600' : 'bg-red-600'} text-white text-sm font-bold py-3 px-4 z-40 flex items-center justify-center gap-4 animate-in slide-in-from-top-full duration-500`}>
            {isFreeTrial ? <Zap size={18} /> : <AlertTriangle size={18} />}
            <span>{isFreeTrial ? `Your Free Trial ends in ${daysToExpiry} days! Subscribe to continue.` : `SaaS Expiry in ${daysToExpiry} days! Renew now.`}</span>
            <button onClick={() => navigate('/app/profile')} className="bg-white text-slate-900 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase transition-transform active:scale-95">
              {isFreeTrial ? 'Subscribe Now' : 'Renew Now'}
            </button>
          </div>
        )}
        
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
             <Menu size={24} />
           </button>
           
           <div className="flex items-center gap-2 md:gap-4 ml-auto">
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 text-slate-500 hover:text-primary-600 relative transition-colors">
                   <Bell size={20} />
                   {expiringCustomers.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />}
                </button>
                {isNotificationsOpen && (
                   <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                    <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
                        <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Customer Expiries</h4>
                        <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-black">{expiringCustomers.length}</span>
                      </div>
                      <div className="max-h-[550px] overflow-y-auto no-scrollbar">
                        {expiringCustomers.length === 0 ? (
                          <div className="p-16 text-center text-slate-300 flex flex-col items-center">
                            <CheckCircle size={40} className="mb-3 opacity-20" />
                            <p className="text-xs font-black uppercase tracking-widest">No pending expiries</p>
                          </div>
                        ) : expiringCustomers.map((cust: any) => {
                          const planName = plans.find((p:any) => p.id === cust.planId)?.name || 'N/A';
                          const whatsappMsg = `Hello ${cust.name}, your subscription plan (${planName}) expires on ${cust.endDate}. Please renew!`;
                          const whatsappLink = `https://wa.me/${(cust.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
                          
                          return (
                            <div key={cust.id} className="p-5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                  <h5 className="font-black text-slate-900 text-base">{cust.name}</h5>
                                  <p className="text-slate-400 font-mono text-sm tracking-tight">{cust.mobile}</p>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                                    cust.realDaysLeft <= 0 
                                      ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                                  }`}>
                                    {cust.realDaysLeft <= 0 ? 'EXPIRED' : `${cust.realDaysLeft} DAYS LEFT`}
                                  </span>
                                  <div className="flex gap-2">
                                    <a href={whatsappLink} target="_blank" rel="noreferrer" className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100/50 hover:bg-emerald-100 transition-colors">
                                      <MessageSquare size={18} />
                                    </a>
                                    <a href={`tel:${cust.mobile}`} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/50 hover:bg-blue-100 transition-colors">
                                      <Phone size={18} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg uppercase">
                                  {planName}
                                </span>
                                <button 
                                  onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }} 
                                  className="text-blue-600 font-black text-[11px] uppercase tracking-widest flex items-center gap-1.5 hover:text-blue-800 transition-colors"
                                >
                                  RENEW <ArrowRight size={14} strokeWidth={4} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => navigate('/app/profile')} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 hover:border-slate-300 transition-all hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xs">{currentUser?.displayName?.charAt(0) || 'U'}</div>
                <span className="hidden sm:block text-xs font-bold text-slate-700">{currentUser?.displayName || 'Owner'}</span>
              </button>
           </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <SubscriptionManager />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<OnboardingPayment />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/app" element={<ProtectedRoute />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="prep" element={<Prep />} />
              <Route path="customers" element={<Customers />} />
              <Route path="single-orders" element={<SingleOrders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="notes" element={<Notes />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="messages" element={<Messages />} />
              <Route path="support" element={<Support />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<AdminRoute />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="feature-support" element={<AdminFeatureSupport />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="invoice-credits" element={<AdminInvoiceCredits />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;