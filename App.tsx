import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OnboardingPayment from './pages/OnboardingPayment';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Analytics from './pages/Analytics';
import Support from './pages/Support';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Deliveries from './pages/Deliveries';
import Inventory from './pages/Inventory';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminFeatureSupport from './pages/admin/AdminFeatureSupport';
import AdminProfile from './pages/admin/AdminProfile';
import AdminPlans from './pages/admin/AdminPlans';
import AdminLogin from './pages/admin/AdminLogin';

// Legal Pages
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Shipping from './pages/legal/Shipping';
import Refunds from './pages/legal/Refunds';
import Contact from './pages/legal/Contact';

import { 
  Menu, X, Zap, LogOut, Bell, AlertTriangle, Loader2, Clock, User, CheckCircle, ShieldCheck, Phone, MapPin, ArrowRight, MessageSquare
} from 'lucide-react';
import { INITIAL_BUSINESS_PROFILE, getDaysDifference } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAIL } from './services/adminStore';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useStreamCollection } from './services/dbService';
import { SHARED_SAAS_PLANS } from './services/saasStore';

// --- ROBUST SUBSCRIPTION MANAGER ---
const SubscriptionManager = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const capturePaymentParams = () => {
      const rawParams = new URLSearchParams(window.location.search);
      const urlStatus = rawParams.get('status');
      
      if (urlStatus === 'success') {
        const planId = rawParams.get('plan_id');
        const paymentId = rawParams.get('payment_id');
        
        if (planId) {
          localStorage.setItem('pending_subscription', JSON.stringify({
            planId,
            paymentId: paymentId || 'manual_entry',
            timestamp: Date.now()
          }));
          
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    };

    capturePaymentParams();

    const getPlanDetails = (planId: string) => {
      let durationMonths = 1;
      let internalPlanName = 'Monthly';
      const pid = planId.toLowerCase();
      if (pid.includes('6months') || pid.includes('6 months') || pid.includes('half')) {
        durationMonths = 6;
        internalPlanName = '6 Months';
      } else if (pid.includes('yearly') || pid.includes('annual') || pid.includes('12months')) {
        durationMonths = 12;
        internalPlanName = 'Yearly';
      }
      return { durationMonths, internalPlanName };
    };

    const processActivation = async () => {
      if (!currentUser || !currentUser.email || status !== 'idle') return;

      const pendingStr = localStorage.getItem('pending_subscription');
      let pendingFirestoreData = null;

      // Only check Firestore if we don't have local storage data
      if (!pendingStr) {
         try {
            const docRef = doc(db, 'pending_activations', currentUser.email);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
               pendingFirestoreData = { ...docSnap.data(), ref: docRef };
            }
         } catch (e: any) {
            // Silently fail if permissions are an issue during transition
            if (e.code !== 'permission-denied') {
                console.error("Error checking pending activations:", e);
            }
         }
      }

      if (pendingStr || pendingFirestoreData) {
        setStatus('processing');
        try {
          let planId, paymentId;
          if (pendingStr) {
             const parsed = JSON.parse(pendingStr);
             planId = parsed.planId;
             paymentId = parsed.paymentId;
          } else {
             planId = pendingFirestoreData.planId;
             paymentId = pendingFirestoreData.paymentId || 'external_checkout';
          }

          const { durationMonths, internalPlanName } = getPlanDetails(planId);
          const now = new Date();
          now.setMonth(now.getMonth() + durationMonths);
          const newExpiryDate = now.toISOString().split('T')[0];

          const docRef = doc(db, 'businesses', currentUser.uid);
          await updateDoc(docRef, {
            planName: `COSVYN ONE (${internalPlanName})`,
            planStatus: 'Active',
            planExpiryDate: newExpiryDate,
            lastPaymentId: paymentId,
            updatedAt: new Date().toISOString()
          });

          if (pendingStr) localStorage.removeItem('pending_subscription');
          if (pendingFirestoreData) await deleteDoc(pendingFirestoreData.ref);
          
          setStatus('success');
          setTimeout(() => {
            setStatus('idle');
            navigate('/app/dashboard', { replace: true });
          }, 2000);
        } catch (error) {
          console.error("Subscription Activation Failed:", error);
          setStatus('error');
        }
      }
    };

    processActivation();
  }, [currentUser, navigate, status]);

  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === 'processing' && (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Activating Plan...</h2>
            <p className="text-slate-500 text-sm">Syncing your account status.</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <CheckCircle size={32} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Success!</h2>
            <p className="text-slate-500 text-sm mb-6">Plan activated. Redirecting...</p>
            <div className="w-full bg-slate-100 rounded-lg h-1.5 overflow-hidden">
              <div className="h-full bg-green-500 animate-[progress_2s_linear_forwards] w-full origin-left"></div>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 text-sm mb-6">We recorded your payment. If access isn't restored, contact support.</p>
            <button onClick={() => setStatus('idle')} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">Close</button>
          </div>
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
          setHasActivePlan(data.planStatus === 'Active');
        } else {
          setHasActivePlan(false);
        }
      }, (err) => {
        // Fallback for permission errors during log-in transition
        console.warn("Auth check listener warning:", err.message);
      });
      return () => unsubscribe();
    } else if (currentUser) {
      setHasActivePlan(true); 
    }
  }, [currentUser]);
  
  if (loading || (currentUser && hasActivePlan === null)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400 flex-col gap-4">
        <Loader2 className="animate-spin" size={40} />
        <p className="text-sm font-medium">Authenticating...</p>
      </div>
    );
  }

  if (currentUser?.email === ADMIN_EMAIL) return <Navigate to="/admin/dashboard" replace />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (hasActivePlan === false) return <Navigate to="/onboarding" replace />;

  return <AppLayout />;
};

const AdminRoute = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-400"><Loader2 className="animate-spin" size={40} /></div>;
  if (currentUser && currentUser.email === ADMIN_EMAIL) return <AdminLayout />;
  return <Navigate to="/admin/login" replace />;
};

const AppLayout = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [planExpiryDate, setPlanExpiryDate] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  const { data: customers } = useStreamCollection<any>('customers');
  const { data: plans } = useStreamCollection<any>('plans');
  const { data: branches } = useStreamCollection<any>('branches');

  const expiringCustomers = React.useMemo(() => {
    return (customers || [])
      .filter((c: any) => c.isActive && c.daysLeft <= 10)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [customers]);

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlanExpiryDate(data.planExpiryDate);
          setBusinessProfile(data);
        }
      }, (err) => {
        console.error("Profile sync error:", err);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  const daysToExpiry = planExpiryDate ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) : 100;
  const showExpiryWarning = daysToExpiry <= 10;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', path: '/app' },
    { label: 'Customers', path: '/app/customers' },
    { label: 'Payments', path: '/app/payments' },
    { label: 'Expenses', path: '/app/expenses' },
    { label: 'Deliveries', path: '/app/deliveries' },
    { label: 'Inventory', path: '/app/inventory' },
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Support', path: '/app/support' },
    { label: 'Settings', path: '/app/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}>
           <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 flex flex-col animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 p-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                    <Zap size={18} fill="currentColor" />
                  </div>
                  <span className="text-xl font-bold text-slate-900 tracking-tight">ScaleKitchen</span>
                </div>
                <button onClick={() => setIsMobileNavOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                 {navItems.map(item => (
                    <NavLink key={item.path} to={item.path} onClick={() => setIsMobileNavOpen(false)} className={({ isActive }) => `block px-4 py-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'}`}>{item.label}</NavLink>
                 ))}
                 <NavLink to="/app/profile" onClick={() => setIsMobileNavOpen(false)} className="block px-4 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Profile</NavLink>
              </div>
              <div className="p-4 border-t border-slate-100 mt-auto">
                <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"><LogOut size={20} />Sign Out</button>
              </div>
           </div>
        </div>
      )}
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        {showExpiryWarning && (
          <div className="bg-red-600 text-white text-sm font-bold py-3 px-4 shadow-md z-40 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-center">
             <div className="flex items-center gap-2">
               <AlertTriangle size={18} fill="white" className="text-red-700" />
               <span>{daysToExpiry > 0 ? `Your SaaS Subscription expires in ${daysToExpiry} days! Renew now.` : `Your SaaS Subscription expires today! Renew now.`}</span>
             </div>
             <div className="bg-red-700/50 px-3 py-1 rounded-lg border border-red-500/50 text-xs md:text-sm font-normal">Your data will be locked if not renewed.</div>
             <button onClick={() => navigate('/app/profile')} className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wide shadow-sm">Renew Now</button>
          </div>
        )}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileNavOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"><Menu size={24} /></button>
           </div>
           <div className="flex items-center gap-4">
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 rounded-full transition-colors relative">
                  <Bell size={20} />
                  {expiringCustomers.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
                </button>
                {isNotificationsOpen && (
                   <>
                     <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                     <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                           <h4 className="font-bold text-slate-900 text-sm">Customer Expiries</h4>
                           <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{expiringCustomers.length}</span>
                        </div>
                        <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                           {expiringCustomers.length === 0 ? (
                             <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                <CheckCircle size={32} className="opacity-20" />
                                <span>No expiries in the next 10 days.</span>
                             </div>
                           ) : expiringCustomers.map((cust: any) => {
                                 const branchName = branches.find((b:any) => b.id === cust.branchId)?.name || 'N/A';
                                 const planName = plans.find((p:any) => p.id === cust.planId)?.name || 'N/A';
                                 const isExpired = cust.daysLeft <= 0;
                                 
                                 // WhatsApp Message logic
                                 const whatsappMsg = `Hello ${cust.name} sir/mam, we are from ${businessProfile?.businessName || 'your meal service'}. This message is to inform you that your plan expires on ${cust.endDate}, in ${cust.daysLeft <= 0 ? '0' : cust.daysLeft} days, for the plan ${planName}. Please let us know if you would like to renew!`;
                                 const whatsappLink = `https://wa.me/${cust.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;

                                 return (
                                    <div key={cust.id} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group relative">
                                       <div className="flex justify-between items-start mb-2">
                                          <div className="flex-1 min-w-0">
                                             <h5 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                                                <User size={14} className="text-slate-400 shrink-0" />
                                                {cust.name}
                                             </h5>
                                             <div className="flex flex-col gap-0.5 mt-1">
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                   <Phone size={10} className="text-slate-300" />
                                                   {cust.mobile}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                   <MapPin size={10} className="text-slate-300" />
                                                   <span className="truncate">{cust.area || 'No Area'}</span>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="flex flex-col items-end gap-1.5">
                                             <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${
                                                isExpired 
                                                   ? 'bg-red-600 text-white' 
                                                   : cust.daysLeft <= 3 
                                                      ? 'bg-red-100 text-red-700 border border-red-200' 
                                                      : 'bg-orange-100 text-orange-700 border border-orange-200'
                                             }`}>
                                                {isExpired ? 'Expired' : `${cust.daysLeft} Days Left`}
                                             </span>
                                             <div className="flex gap-1.5">
                                               <a 
                                                  href={whatsappLink}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center border border-green-100"
                                                  onClick={e => e.stopPropagation()}
                                                  title={`WhatsApp ${cust.name}`}
                                               >
                                                  <MessageSquare size={14} fill="currentColor" className="opacity-80" />
                                               </a>
                                               <a 
                                                  href={`tel:${cust.mobile}`}
                                                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center border border-blue-100"
                                                  onClick={e => e.stopPropagation()}
                                                  title={`Call ${cust.name}`}
                                               >
                                                  <Phone size={14} fill="currentColor" className="opacity-80" />
                                               </a>
                                             </div>
                                          </div>
                                       </div>
                                       
                                       <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tight max-w-[120px] truncate" title={planName}>
                                             {planName}
                                          </span>
                                          <button 
                                             onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }} 
                                             className="text-[11px] text-primary-600 font-extrabold hover:text-primary-800 flex items-center gap-1 uppercase tracking-wider group/btn"
                                          >
                                             Renew <ArrowRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                          </button>
                                       </div>
                                    </div>
                                 );
                              })
                           }
                        </div>
                     </div>
                   </>
                )}
              </div>
              <button onClick={() => navigate('/app/profile')} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group">
                {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full bg-slate-200" /> : <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">{currentUser?.displayName?.charAt(0) || 'U'}</div>}
                <span className="hidden sm:block text-sm font-medium text-slate-700 group-hover:text-slate-900">{currentUser?.displayName || 'Owner'}</span>
              </button>
           </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8"><div className="max-w-7xl mx-auto"><Outlet /></div></main>
      </div>
    </div>
  );
};

const App = () => {
  return (
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
            <Route path="customers" element={<Customers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="analytics" element={<Analytics />} />
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
            <Route path="profile" element={<AdminProfile />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;