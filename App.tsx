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
  const [businessData, setBusinessData] = useState<any>(null);
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.email !== ADMIN_EMAIL) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) { 
          const data = docSnap.data();
          setBusinessData(data);
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
        else { 
          setBusinessData(null);
          setHasActivePlan(false); 
        }
      }, (err) => {
        console.error("Protected Route Error:", err);
        setBusinessData(null);
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
  
  return <AppLayout businessData={businessData} />;
};

const AdminRoute = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-white" size={40} /></div>;
  if (currentUser && currentUser.email === ADMIN_EMAIL) return <AdminLayout />;
  return <Navigate to="/admin/login" replace />;
};

const AppLayout = ({ businessData }: { businessData?: any }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const planExpiryDate = businessData?.planExpiryDate || null;
  const planName = businessData?.planName || null;
  
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

  const daysToExpiry = planExpiryDate ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) : 100;
  const showExpiryWarning = daysToExpiry <= 10 && daysToExpiry >= 0;
  const isFreeTrial = planName === 'Free Trial';

  const handleLogout = async () => { await logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-slate-50/60 relative overflow-hidden font-sans">
      {/* Ambient Glassmorphic Glow Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-28 -right-28 w-96 h-96 bg-primary-200/25 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-28 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-28 right-1/4 w-[450px] h-[450px] bg-sky-200/20 rounded-full blur-3xl" />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {showExpiryWarning && (
          <div className={`${isFreeTrial ? 'bg-emerald-600/95' : 'bg-red-600/95'} backdrop-blur-md text-white text-sm font-semibold py-2.5 px-4 z-40 flex items-center justify-center gap-3 shadow-sm animate-in slide-in-from-top-full duration-500`}>
            {isFreeTrial ? <Zap size={16} /> : <AlertTriangle size={16} />}
            <span>{isFreeTrial ? `Your Free Trial ends in ${daysToExpiry} days. Subscribe to keep full access.` : `Your subscription expires in ${daysToExpiry} days. Renew now to avoid interruption.`}</span>
            <button onClick={() => navigate('/app/profile')} className="bg-white text-slate-900 px-3.5 py-1 rounded-full text-xs font-bold transition-transform active:scale-95 shadow-xs">
              {isFreeTrial ? 'Subscribe Now' : 'Renew Plan'}
            </button>
          </div>
        )}
        
        <header className="h-16 bg-white/75 backdrop-blur-xl border-b border-white/80 shadow-xs flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
           <button 
             onClick={() => setIsSidebarOpen(true)} 
             className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white/90 rounded-xl border border-transparent hover:border-slate-200/60 transition-all shadow-xs"
             aria-label="Open navigation menu"
           >
             <Menu size={20} />
           </button>
           
           <div className="flex items-center gap-3 md:gap-4 ml-auto">
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
                  className="p-2.5 text-slate-600 hover:text-primary-600 hover:bg-white/80 rounded-xl border border-transparent hover:border-slate-200/60 relative transition-all"
                  aria-label="View notifications"
                >
                   <Bell size={18} />
                   {expiringCustomers.length > 0 && (
                     <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-400" />
                   )}
                </button>
                {isNotificationsOpen && (
                   <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-2xl shadow-glass-lg z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm font-display">Expiring Subscriptions</h4>
                          <p className="text-xs text-slate-500">Upcoming renewals needed</p>
                        </div>
                        <span className="text-xs bg-red-50 text-red-600 border border-red-200/60 px-2.5 py-0.5 rounded-full font-semibold">{expiringCustomers.length} due</span>
                      </div>
                      <div className="max-h-[480px] overflow-y-auto no-scrollbar divide-y divide-slate-100">
                        {expiringCustomers.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                            <CheckCircle size={36} className="mb-2 text-emerald-500/60" />
                            <p className="text-xs font-semibold text-slate-600">All subscriptions are up to date</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">No renewals due in the next 10 days</p>
                          </div>
                        ) : expiringCustomers.map((cust: any) => {
                          const planName = plans.find((p:any) => p.id === cust.planId)?.name || 'Standard Plan';
                          const whatsappMsg = `Hello ${cust.name}, your meal subscription plan (${planName}) is scheduled to conclude on ${cust.endDate}. We'd love to continue serving you. Please let us know if you'd like to renew!`;
                          const whatsappLink = `https://wa.me/${(cust.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
                          
                          return (
                            <div key={cust.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <h5 className="font-semibold text-slate-900 text-sm truncate">{cust.name}</h5>
                                  <p className="text-slate-400 font-mono text-xs mt-0.5">{cust.mobile}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                    cust.realDaysLeft <= 0 
                                      ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-200/70'
                                  }`}>
                                    {cust.realDaysLeft <= 0 ? 'Expired' : `${cust.realDaysLeft} days left`}
                                  </span>
                                  <div className="flex gap-1.5">
                                    <a href={whatsappLink} target="_blank" rel="noreferrer" title="Chat on WhatsApp" className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-200/60 hover:bg-emerald-100 transition-colors">
                                      <MessageSquare size={14} />
                                    </a>
                                    <a href={`tel:${cust.mobile}`} title="Call customer" className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-200/60 hover:bg-blue-100 transition-colors">
                                      <Phone size={14} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100/60">
                                <span className="text-xs font-medium text-slate-600 bg-slate-100/70 px-2.5 py-0.5 rounded-md">
                                  {planName}
                                </span>
                                <button 
                                  onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }} 
                                  className="text-primary-600 hover:text-primary-700 font-semibold text-xs flex items-center gap-1 transition-colors"
                                >
                                  Renew Plan <ArrowRight size={13} />
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
              <button 
                onClick={() => navigate('/app/profile')} 
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/80 hover:border-primary-400/60 shadow-xs transition-all hover:bg-white"
              >
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser?.displayName?.charAt(0) || 'U'}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-slate-700">{currentUser?.displayName || 'My Kitchen'}</span>
              </button>
           </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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