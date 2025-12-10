
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

import { 
  Menu, X, Zap, LogOut, Bell, AlertTriangle, Loader2, Clock, User
} from 'lucide-react';
import { INITIAL_BUSINESS_PROFILE, getDaysDifference } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAIL } from './services/adminStore';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useStreamCollection } from './services/dbService';
import { SHARED_SAAS_PLANS } from './services/saasStore';

// --- GLOBAL PAYMENT LISTENER ---
const GlobalPaymentListener = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    const processPayment = async () => {
      const params = new URLSearchParams(location.search);
      const status = params.get('status');
      const planId = params.get('plan_id'); // 'plan_monthly', 'plan_6months', 'plan_yearly'
      const paymentId = params.get('payment_id');

      // STRICT CHECK as requested
      if (status === 'success' && currentUser) {
        
        let durationMonths = 1;
        let internalPlanName = 'Monthly';

        // Map gateway plan_id to internal duration
        if (planId === 'plan_6months') {
          durationMonths = 6;
          internalPlanName = '6 Months';
        } else if (planId === 'plan_yearly') {
          durationMonths = 12;
          internalPlanName = 'Yearly';
        } else {
          // Default to monthly if plan_id is missing or 'plan_monthly'
          durationMonths = 1;
          internalPlanName = 'Monthly';
        }
        
        try {
          // Calculate New Expiry
          const now = new Date();
          now.setMonth(now.getMonth() + durationMonths);
          const newExpiryDate = now.toISOString().split('T')[0];

          // Update Firestore
          const docRef = doc(db, 'businesses', currentUser.uid);
          await updateDoc(docRef, {
            planName: `COSVYN ONE (${internalPlanName})`,
            planStatus: 'Active',
            planExpiryDate: newExpiryDate,
            lastPaymentId: paymentId || 'manual_entry',
            updatedAt: new Date().toISOString()
          });

          // Store State in LocalStorage as requested
          localStorage.setItem('isProUser', 'true');
          
          // Clear pending intent
          localStorage.removeItem('pending_plan_id');
          localStorage.removeItem('pending_renew_plan_id');

          // Success Message & Redirect
          alert(`Payment Successful! Your ${internalPlanName} subscription is now active.`);
          
          // Navigate to dashboard and replace URL to remove query params
          navigate('/app/dashboard', { replace: true });
          
        } catch (error) {
          console.error("Payment Activation Error:", error);
          alert("Payment received but activation failed. Please contact support.");
        }
      }
    };

    processPayment();
  }, [location, currentUser, navigate]);

  return null;
};

// Protected Route for Business Owners
const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.email !== ADMIN_EMAIL) {
      // Real-time listener for subscription status
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // STRICT CHECK: Must be 'Active' to enter app
          if (data.planStatus === 'Active') {
            setHasActivePlan(true);
          } else {
            setHasActivePlan(false);
          }
        } else {
          setHasActivePlan(false); // No profile = No plan
        }
      });
      return () => unsubscribe();
    } else if (currentUser) {
      // If admin logged in as user or other edge case, treat as handled elsewhere or allow
      setHasActivePlan(true); 
    }
  }, [currentUser]);
  
  if (loading || (currentUser && hasActivePlan === null)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400 flex-col gap-4">
        <Loader2 className="animate-spin" size={40} />
        <p className="text-sm font-medium">Verifying Subscription...</p>
      </div>
    );
  }

  // Prevent Admin from accessing the SaaS App Dashboard via this route
  if (currentUser?.email === ADMIN_EMAIL) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If plan is NOT active, force redirect to onboarding payment page
  if (hasActivePlan === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout />;
};

// Protected Route for Admin
const AdminRoute = () => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  // Strict Email Check for Admin
  if (currentUser && currentUser.email === ADMIN_EMAIL) {
    return <AdminLayout />;
  }

  // Redirect unauthenticated admins to the dedicated admin login page
  return <Navigate to="/admin/login" replace />;
};

// Layout component for the authenticated app
const AppLayout = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [planExpiryDate, setPlanExpiryDate] = useState<string | null>(null);

  // Fetch Customers, Plans, Branches for Notifications
  const { data: customers } = useStreamCollection<any>('customers');
  const { data: plans } = useStreamCollection<any>('plans');
  const { data: branches } = useStreamCollection<any>('branches');

  // Filter customers expiring in 7 days
  const expiringCustomers = React.useMemo(() => {
    return customers
      .filter((c: any) => c.isActive && c.daysLeft <= 7)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [customers]);

  // Listen to real-time profile updates for subscription status
  useEffect(() => {
    if (currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlanExpiryDate(data.planExpiryDate);
          // If subscription expires/becomes inactive while user is using the app, reload to trigger ProtectedRoute check
          if (data.planStatus !== 'Active') {
             window.location.reload();
          }
        }
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // Calculate days to expiry based on live data
  const daysToExpiry = planExpiryDate 
    ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) 
    : 100;

  // Show warning if 10 days or less (only if > 0, because if <=0 they should be kicked out by ProtectedRoute usually, but keep as failsafe)
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
      
      {/* Mobile Menu Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}>
           <div 
             className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 flex flex-col animate-in slide-in-from-left duration-300" 
             onClick={e => e.stopPropagation()}
           >
              <div className="flex justify-between items-center mb-6 p-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                    <Zap size={18} fill="currentColor" />
                  </div>
                  <span className="text-xl font-bold text-slate-900 tracking-tight">COSVYN</span>
                </div>
                <button 
                  onClick={() => setIsMobileNavOpen(false)} 
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2">
                 {navItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileNavOpen(false)} // CLOSE NAV ON CLICK
                      className={({ isActive }) => `block px-4 py-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {item.label}
                    </NavLink>
                 ))}
                 <NavLink 
                    to="/app/profile"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="block px-4 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
                 >
                    Profile
                 </NavLink>
              </div>

              <div className="p-4 border-t border-slate-100 mt-auto">
                <button 
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        
        {/* SUBSCRIPTION EXPIRY BANNER */}
        {showExpiryWarning && (
          <div className="bg-red-600 text-white text-sm font-bold py-3 px-4 shadow-md z-40 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-center">
             <div className="flex items-center gap-2">
               <AlertTriangle size={18} fill="white" className="text-red-700" />
               <span>
                 {daysToExpiry > 0 
                   ? `Your SaaS Subscription expires in ${daysToExpiry} days! Renew now.` 
                   : `Your SaaS Subscription expires today! Renew now.`
                 }
               </span>
             </div>
             <div className="bg-red-700/50 px-3 py-1 rounded-lg border border-red-500/50 text-xs md:text-sm font-normal">
               Your data will be lost if not renewed.
             </div>
             <button 
               onClick={() => navigate('/app/profile')} 
               className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wide shadow-sm"
             >
               Renew Subscription
             </button>
          </div>
        )}

        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileNavOpen(true)} 
                className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <Menu size={24} />
              </button>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 rounded-full transition-colors relative"
                >
                  <Bell size={20} />
                  {expiringCustomers.length > 0 && (
                     <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {isNotificationsOpen && (
                   <>
                     <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                     <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                           <h4 className="font-bold text-slate-900 text-sm">Customer Expiries</h4>
                           <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{expiringCustomers.length}</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                           {expiringCustomers.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-sm">No upcoming expiries.</div>
                           ) : (
                              expiringCustomers.map((cust: any) => {
                                 const branchName = branches.find((b:any) => b.id === cust.branchId)?.name || 'Unknown Branch';
                                 const planName = plans.find((p:any) => p.id === cust.planId)?.name || 'Unknown Plan';
                                 
                                 return (
                                    <div key={cust.id} className="p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                       <div className="flex justify-between items-start mb-1">
                                          <div className="font-bold text-slate-800 text-sm flex items-center gap-1">
                                             <User size={12} className="text-slate-400"/> {cust.name}
                                          </div>
                                          <span className={`text-xs font-bold ${cust.daysLeft <= 3 ? 'text-red-600' : 'text-orange-500'}`}>
                                             {cust.daysLeft <= 0 ? 'Expired' : `${cust.daysLeft} days left`}
                                          </span>
                                       </div>
                                       <p className="text-xs text-slate-500 mb-1">{cust.mobile} • {branchName}</p>
                                       <div className="flex justify-between items-center">
                                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{planName}</span>
                                          <button 
                                             onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }}
                                             className="text-xs text-blue-600 font-bold hover:underline"
                                          >
                                             Renew
                                          </button>
                                       </div>
                                    </div>
                                 );
                              })
                           )}
                        </div>
                     </div>
                   </>
                )}
              </div>

              <button 
                onClick={() => navigate('/app/profile')}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group"
              >
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full bg-slate-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                    {currentUser?.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-medium text-slate-700 group-hover:text-slate-900">
                  {currentUser?.displayName || 'Owner'}
                </span>
              </button>
           </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
           <div className="max-w-7xl mx-auto">
             <Outlet />
           </div>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <GlobalPaymentListener />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<OnboardingPayment />} />
          
          {/* Admin Login Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected App Routes (Business Owner) */}
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

          {/* Admin Routes (Super Admin) - Protected by Email Check */}
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
