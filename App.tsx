import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  Menu, X, Zap, LogOut, Bell, AlertTriangle, Loader2, User, CheckCircle, Phone, MapPin, ArrowRight, MessageSquare
} from 'lucide-react';
import { getDaysDifference } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAIL } from './services/adminStore';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useStreamCollection } from './services/dbService';

// --- ERROR BOUNDARY ---
interface Props { children: ReactNode; }
interface State { hasError: boolean; }
class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };
  public static getDerivedStateFromError(_: Error): State { return { hasError: true }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Uncaught error:", error, errorInfo); }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm border border-slate-200">
             <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
             <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
             <p className="text-slate-500 text-sm mb-6">A small glitch occurred. Please refresh the page to continue.</p>
             <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">Refresh App</button>
          </div>
        </div>
      );
    }
    // Fixed: children must be accessed from this.props in a class component to resolve type error
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
      const rawParams = new URLSearchParams(window.location.search);
      const urlStatus = rawParams.get('status');
      if (urlStatus === 'success') {
        const planId = rawParams.get('plan_id');
        const paymentId = rawParams.get('payment_id');
        if (planId) {
          localStorage.setItem('pending_subscription', JSON.stringify({
            planId, paymentId: paymentId || 'manual_entry', timestamp: Date.now()
          }));
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
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
        } catch (error) { setStatus('error'); }
      }
    };
    processActivation();
  }, [currentUser, navigate, status]);

  if (status === 'idle') return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
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
        if (docSnap.exists()) { setHasActivePlan(docSnap.data().planStatus === 'Active'); } 
        else { setHasActivePlan(false); }
      }, () => setHasActivePlan(false));
      return () => unsubscribe();
    } else if (currentUser) { setHasActivePlan(true); }
  }, [currentUser]);
  if (loading || (currentUser && hasActivePlan === null)) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin" size={40} /></div>;
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [planExpiryDate, setPlanExpiryDate] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const { data: customers = [] } = useStreamCollection<any>('customers');
  const { data: plans = [] } = useStreamCollection<any>('plans');
  const { data: branches = [] } = useStreamCollection<any>('branches');
  const expiringCustomers = React.useMemo(() => (customers || []).filter((c: any) => c.isActive && c.daysLeft <= 10).sort((a: any, b: any) => a.daysLeft - b.daysLeft), [customers]);
  useEffect(() => {
    if (currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) { const d = docSnap.data(); setPlanExpiryDate(d.planExpiryDate); setBusinessProfile(d); }
      });
      return () => unsubscribe();
    }
  }, [currentUser]);
  const daysToExpiry = planExpiryDate ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) : 100;
  const showExpiryWarning = daysToExpiry <= 10;
  const handleLogout = async () => { await logout(); navigate('/'); };
  const navItems = [
    { label: 'Dashboard', path: '/app' }, { label: 'Customers', path: '/app/customers' }, { label: 'Payments', path: '/app/payments' },
    { label: 'Expenses', path: '/app/expenses' }, { label: 'Deliveries', path: '/app/deliveries' }, { label: 'Inventory', path: '/app/inventory' },
    { label: 'Analytics', path: '/app/analytics' }, { label: 'Support', path: '/app/support' }, { label: 'Settings', path: '/app/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}>
           <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 p-2"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-violet-600 rounded-lg flex items-center justify-center text-white"><Zap size={18} fill="currentColor" /></div><span className="text-xl font-bold text-slate-900">ScaleKitchen</span></div><button onClick={() => setIsMobileNavOpen(false)} className="p-2 text-slate-500"><X size={20} /></button></div>
              <div className="flex-1 overflow-y-auto space-y-2">{navItems.map(item => (<NavLink key={item.path} to={item.path} onClick={() => setIsMobileNavOpen(false)} className={({ isActive }) => `block px-4 py-3 rounded-lg font-medium ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600'}`}>{item.label}</NavLink>))}<NavLink to="/app/profile" onClick={() => setIsMobileNavOpen(false)} className="block px-4 py-3 rounded-lg font-medium text-slate-600">Profile</NavLink></div>
              <div className="p-4 border-t border-slate-100"><button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600"><LogOut size={20} />Sign Out</button></div>
           </div>
        </div>
      )}
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        {showExpiryWarning && (<div className="bg-red-600 text-white text-sm font-bold py-3 px-4 z-40 flex items-center justify-center gap-4"><AlertTriangle size={18} /><span>SaaS Expiry in {daysToExpiry} days! Renew now.</span><button onClick={() => navigate('/app/profile')} className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase">Renew Now</button></div>)}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
           <button onClick={() => setIsMobileNavOpen(true)} className="md:hidden p-2 text-slate-600"><Menu size={24} /></button>
           <div className="flex items-center gap-4 ml-auto">
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 text-slate-500 hover:text-primary-600 relative"><Bell size={20} />{expiringCustomers.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}</button>
                {isNotificationsOpen && (
                   <><div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} /><div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden"><div className="p-3 border-b border-slate-100 flex justify-between bg-slate-50"><h4 className="font-bold text-slate-900 text-sm">Customer Expiries</h4><span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{expiringCustomers.length}</span></div><div className="max-h-[450px] overflow-y-auto">{expiringCustomers.length === 0 ? (<div className="p-8 text-center text-slate-400">No expiries soon.</div>) : expiringCustomers.map((cust: any) => {
                         const planName = plans.find((p:any) => p.id === cust.planId)?.name || 'N/A';
                         const whatsappMsg = `Hello ${cust.name}, plan expires on ${cust.endDate}. Please renew!`;
                         const whatsappLink = `https://wa.me/${(cust.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
                         return (
                            <div key={cust.id} className="p-4 border-b border-slate-100 hover:bg-slate-50"><div className="flex justify-between items-start mb-2"><div className="flex-1 min-w-0"><h5 className="font-bold text-slate-900 text-sm truncate">{cust.name}</h5><div className="text-[11px] text-slate-500 mt-1">{cust.mobile}</div></div><div className="flex flex-col items-end gap-1.5"><span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">{cust.daysLeft} Days Left</span><div className="flex gap-1.5"><a href={whatsappLink} target="_blank" rel="noreferrer" className="p-2 bg-green-50 text-green-600 rounded-lg shadow-sm"><MessageSquare size={14} /></a><a href={`tel:${cust.mobile}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg shadow-sm"><Phone size={14} /></a></div></div></div><div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between"><span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{planName}</span><button onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }} className="text-[11px] text-primary-600 font-extrabold uppercase flex items-center gap-1">Renew <ArrowRight size={12} /></button></div></div>
                         );
                      })}</div></div></>
                )}
              </div>
              <button onClick={() => navigate('/app/profile')} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 hover:border-slate-300">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">{currentUser?.displayName?.charAt(0) || 'U'}</div>
                <span className="hidden sm:block text-sm font-medium text-slate-700">{currentUser?.displayName || 'Owner'}</span>
              </button>
           </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8"><div className="max-w-7xl mx-auto"><ErrorBoundary><Outlet /></ErrorBoundary></div></main>
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
    </ErrorBoundary>
  );
};

export default App;