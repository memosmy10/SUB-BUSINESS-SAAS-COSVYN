
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, ArrowRight, Loader2, MapPin, Building, User as UserIcon, Mail, Lock, Phone, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { INDIA_STATES } from '../services/store';

const Signup = () => {
  const { signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    // Check for pending subscription from redirected payment
    const pending = localStorage.getItem('pending_subscription');
    if (pending) {
      setHasPendingSubscription(true);
    }
  }, []);

  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    mobile: '',
    state: '',
    city: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Authentication User
      const user = await signupWithEmail(formData.email, formData.password);

      // 2. Create Inactive Profile in Firestore
      await setDoc(doc(db, 'businesses', user.uid), {
        ownerName: formData.ownerName,
        email: formData.email,
        mobile: formData.mobile,
        businessName: formData.businessName,
        state: formData.state,
        city: formData.city,
        country: 'India',
        description: '',
        category: 'Tiffin Service', // Default
        isProfileComplete: true,
        planName: 'None',
        planExpiryDate: new Date().toISOString().split('T')[0],
        planStatus: 'Inactive' // Crucial: This forces the payment flow next
      });

      // 3. Redirect to Onboarding (or Dashboard if pending sub exists)
      // The SubscriptionManager in App.tsx will handle the pending sub on navigation/load
      navigate('/onboarding');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left: Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-600/30 rounded-full blur-[100px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={24} fill="currentColor" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ScaleKitchen</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">Scale your kitchen.<br/>Simplify your life.</h1>
          <p className="text-slate-400 text-lg max-w-md">Join thousands of tiffin services and cloud kitchens managing their entire business on ScaleKitchen.</p>
        </div>

        <div className="space-y-4 relative z-10">
          {[
            'Automated Customer Renewals', 
            'Delivery Route Optimization', 
            'Expense & Profit Tracking',
            'Dedicated Business Profile'
          ].map((feat, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                <CheckCircle size={14} />
              </div>
              <span className="font-medium">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto relative">
        
        {/* Back Button */}
        <Link to="/" className="absolute top-6 left-6 lg:left-12 flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm font-medium group z-20">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back
        </Link>

        <div className="w-full max-w-md space-y-8 mt-8 lg:mt-0">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900">Create your account</h2>
            <p className="text-slate-500 mt-2">Start your 14-day free trial. No credit card required.</p>
          </div>

          {hasPendingSubscription && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm font-medium border border-green-200 flex flex-col gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="shrink-0 text-green-600" />
                <span className="font-bold text-lg">Payment Received!</span>
              </div>
              <p className="text-slate-600 ml-7">Create your account below to instantly activate your subscription.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Business Details</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <Building className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input required name="businessName" type="text" placeholder="Business Name" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                </div>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input required name="ownerName" type="text" placeholder="Owner Name" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input required name="mobile" type="tel" placeholder="Mobile Number" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <select required name="state" className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none appearance-none text-slate-900" onChange={handleChange} defaultValue="">
                      <option value="" disabled>Select State</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <MapPin className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={18} />
                  </div>
                  <div className="relative">
                    <input required name="city" type="text" placeholder="City" className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Login Credentials</h3>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input required name="email" type="email" placeholder="Email Address" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input required name="password" type="password" placeholder="Password" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input required name="confirmPassword" type="password" placeholder="Confirm Password" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 placeholder:text-slate-400" onChange={handleChange} />
                </div>
              </div>
            </div>

            <button 
              disabled={loading}
              type="submit" 
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Create Account <ArrowRight size={20} /></>}
            </button>

            <p className="text-center text-sm text-slate-500">
              Already have an account? <Link to="/login" className="text-primary-600 font-bold hover:underline">Log in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
