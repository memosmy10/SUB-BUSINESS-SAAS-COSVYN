
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ADMIN_EMAIL } from '../services/adminStore';

const Login = () => {
  const { loginWithEmail, currentUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The logic to route user based on subscription status and role
  const handleAuthSuccess = async (user: any) => {
    // 1. Check if Admin
    if (user.email === ADMIN_EMAIL) {
      navigate('/admin/dashboard');
      return;
    }

    // 2. Check if Business Owner
    try {
      const docRef = doc(db, 'businesses', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.planStatus === 'Active') {
          navigate('/app/dashboard');
        } else {
          // Subscription inactive or expired
          navigate('/onboarding');
        }
      } else {
        // No profile found? Should technically go to signup, or onboarding to create one
        navigate('/onboarding');
      }
    } catch (e) {
      console.error("Error fetching profile", e);
      // Fallback
      navigate('/app/dashboard'); 
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await loginWithEmail(email, password);
      await handleAuthSuccess(user);
    } catch (err: any) {
      // Extract code and message safe checking
      const errorCode = err.code;
      const errorMessage = err.message || "";

      // Log only unexpected errors
      if (errorCode !== 'auth/invalid-credential' && errorCode !== 'auth/user-not-found' && errorCode !== 'auth/wrong-password') {
        console.error("Login Error:", err);
      }

      // Handle specific Firebase errors
      if (
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' ||
        errorMessage.includes('auth/invalid-credential')
      ) {
         if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
             setError("Admin account not found. You must click 'Sign up' below to create the admin account first.");
         } else {
             setError("Invalid email or password. Please check your credentials or Sign Up.");
         }
      } else if (errorCode === 'auth/too-many-requests') {
         setError("Too many failed attempts. Please try again later.");
      } else {
         setError("Login failed: " + errorMessage);
      }
      setLoading(false);
    }
  };

  // Watch for auth state changes
  useEffect(() => {
    if (currentUser) {
      handleAuthSuccess(currentUser);
    }
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px]" />

      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full grid md:grid-cols-2 relative z-10">
        
        {/* Left: Branding (Hidden on Mobile) */}
        <div className="hidden md:flex bg-gradient-to-br from-slate-900 to-slate-800 p-12 text-white flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap size={24} fill="currentColor" />
              </div>
              <span className="text-2xl font-bold tracking-tight">COSVYN</span>
            </div>
            <h2 className="text-4xl font-bold mb-6 leading-tight">Run your meal prep business on autopilot.</h2>
            <p className="text-slate-400 text-lg">Manage subscriptions, deliveries, and payments in one unified dashboard.</p>
          </div>

          <div className="space-y-4 mt-8">
            {['Automated Billing', 'Delivery Routing', 'Customer Insights'].map((feat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                  <CheckCircle size={14} />
                </div>
                <span className="font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="p-6 md:p-12 flex flex-col justify-center items-center relative w-full">
          
          {/* Back Button */}
          <Link to="/" className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back
          </Link>

          <div className="w-full max-w-sm mt-8 md:mt-0">
            <div className="text-center mb-6 md:mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h3>
              <p className="text-slate-500">Log in to access your dashboard.</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium border border-red-100 mb-6 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" /> 
                  <span className="leading-snug">{error}</span>
                </div>
                {error.includes("Admin account not found") && (
                   <Link to="/signup" className="text-red-700 underline text-xs ml-7 font-bold">
                      Create Admin Account Now
                   </Link>
                )}
                {error.includes("Domain") && (
                   <div className="ml-7 text-xs text-red-700 bg-red-100/50 p-2 rounded">
                      <strong>How to fix:</strong> Go to Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized Domains &rarr; Add Domain.
                   </div>
                )}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Log In"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Don't have an account? <Link to="/signup" className="text-primary-600 font-bold hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
