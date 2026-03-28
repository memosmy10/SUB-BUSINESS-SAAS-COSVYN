
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Shield, Zap, Loader2, Tag, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { calculateEffectivePrice } from '../services/saasStore';
import { useGlobalPricing, addItem } from '../services/dbService';
import { handleRazorpayPayment } from '../services/razorpayService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const OnboardingPayment = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [hasSetDefault, setHasSetDefault] = useState(false);
  
  // Use Global Pricing
  const { plans, offer, loading: pricingLoading } = useGlobalPricing();
  
  // Selection State (Default to Yearly or first available)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Check if user is new
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!currentUser) return;
      try {
        const docSnap = await getDoc(doc(db, 'businesses', currentUser.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          // If they have no planName, it's "None", or it's "Pending", they are "new" for trial purposes
          const isNew = !data.planName || data.planName === 'None' || data.planStatus === 'Pending';
          setIsNewUser(isNew);
        }
      } catch (e) {
        console.error("Error checking user status:", e);
      }
    };
    checkUserStatus();
  }, [currentUser]);

  // Ensure selection defaults correctly once plans load
  useEffect(() => {
    if (!pricingLoading && plans.length > 0 && !hasSetDefault) {
      if (isNewUser) {
        setSelectedPlanId('FreeTrial');
      } else {
        setSelectedPlanId(plans.find(p => p.isBestValue)?.id || plans[0].id);
      }
      setHasSetDefault(true);
    }
  }, [pricingLoading, plans, isNewUser, hasSetDefault]);
  
  // Check offer validity
  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  const activateFreeTrial = async () => {
    if (!currentUser) return;
    setActivating(true);

    try {
      const now = new Date();
      now.setMonth(now.getMonth() + 1); // 1 Month Trial
      const expiryDate = now.toISOString().split('T')[0];

      const docRef = doc(db, 'businesses', currentUser.uid);
      await updateDoc(docRef, {
        planName: 'Free Trial',
        planStatus: 'Active',
        planExpiryDate: expiryDate,
        updatedAt: new Date().toISOString()
      });

      // Add to billing history as "Trial"
      await addItem(currentUser.uid, 'billing_history', {
        amount: 0,
        date: new Date().toISOString(),
        planName: 'Free Trial',
        paymentId: 'TRIAL_ACTIVATION',
        expiryDate: expiryDate,
        type: 'Trial',
        status: 'Active'
      });

      navigate('/app/dashboard');
    } catch (error) {
      console.error("Trial Activation Failed:", error);
      alert("Failed to activate free trial. Please try again.");
      setActivating(false);
    }
  };

  const activateSubscription = async (paymentId: string, plan: any, amountPaid: number) => {
    if (!currentUser) return;
    setActivating(true);

    try {
      // 1. Calculate Expiry Date based on plan duration
      const now = new Date();
      now.setMonth(now.getMonth() + plan.durationMonths);
      const newExpiryDate = now.toISOString().split('T')[0];

      // 2. Update Firestore immediately (Main Profile)
      const docRef = doc(db, 'businesses', currentUser.uid);
      await updateDoc(docRef, {
        planName: `COSVYN ONE (${plan.label})`,
        planStatus: 'Active',
        planExpiryDate: newExpiryDate,
        lastPaymentId: paymentId,
        updatedAt: new Date().toISOString()
      });

      // 3. Add to Billing History (CRITICAL FIX: This ensures it shows on Profile)
      await addItem(currentUser.uid, 'billing_history', {
        amount: amountPaid,
        date: new Date().toISOString(),
        planName: `COSVYN ONE (${plan.label})`,
        paymentId: paymentId,
        expiryDate: newExpiryDate,
        type: 'Activation',
        status: 'Paid'
      });

      // 4. Navigate to Dashboard
      navigate('/app/dashboard');
    } catch (error) {
      console.error("Activation Failed:", error);
      alert("Payment successful but activation failed. Please contact support.");
      setActivating(false);
    }
  };

  const initiatePayment = () => {
    if (!currentUser) return;
    
    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan) return;

    const amount = calculateEffectivePrice(selectedPlan.price, offer);

    // Fetch user details for prefill if needed (optional, using auth defaults)
    const email = currentUser.email || "";
    const mobile = ""; 

    setLoading(true);

    handleRazorpayPayment({
      amount: amount,
      planName: selectedPlan.label,
      userEmail: email,
      userContact: mobile,
      businessName: currentUser.displayName || "Business Owner",
      onSuccess: (paymentId) => {
        setLoading(false);
        activateSubscription(paymentId, selectedPlan, amount);
      },
      onFailure: (error) => {
        setLoading(false);
        console.log("Payment Cancelled/Failed", error);
      }
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading || pricingLoading || activating) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900">
          {activating ? 'Activating Subscription...' : 'Processing Secure Payment...'}
        </h2>
        <p className="text-slate-500 mt-2 mb-6">Please do not close this window.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-violet-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/30 mx-auto mb-6 transform hover:scale-110 transition-transform duration-500">
            <Zap size={28} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Activate Your Account</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Select the plan that fits your business needs. You can upgrade or cancel at any time.</p>
          
          {isOfferActive && (
            <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 px-5 py-2.5 rounded-full text-sm font-bold border border-emerald-500/20 animate-pulse">
              <Tag size={16} className="text-emerald-600" /> 
              <span>{offer.title} - <span className="underline decoration-wavy">{offer.discountPercent}% OFF</span> applied!</span>
            </div>
          )}
        </div>

        {/* Plan Preview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-12 px-2 md:px-0">
          {/* FREE TRIAL PLAN (ONLY FOR NEW USERS) */}
          {isNewUser && (
            <div 
              onClick={() => setSelectedPlanId('FreeTrial')}
              className={`
                relative rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col
                ${selectedPlanId === 'FreeTrial' 
                  ? 'bg-white border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.15)] ring-4 ring-emerald-500/10 scale-105 z-10' 
                  : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 opacity-70 hover:opacity-100'
                }
              `}
            >
              {selectedPlanId === 'FreeTrial' && (
                <div className="absolute -top-3 -right-3 bg-emerald-600 text-white rounded-full p-1.5 shadow-lg shadow-emerald-600/40 animate-in zoom-in duration-300">
                  <Check size={20} strokeWidth={3} />
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-emerald-500" />
                  <h3 className={`text-xl font-bold ${selectedPlanId === 'FreeTrial' ? 'text-slate-900' : 'text-slate-700'}`}>Free Trial</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed min-h-[40px]">Test all premium features for 30 days. No credit card required.</p>
              </div>
              
              <div className="flex items-baseline gap-2 mb-8">
                <span className={`text-4xl font-extrabold tracking-tight ${selectedPlanId === 'FreeTrial' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  ₹0
                </span>
                <span className="text-slate-400 text-sm font-medium">/ 30 days</span>
              </div>

              <div className="mt-auto">
                <ul className="space-y-4 mb-8">
                  {['Full Access', 'All Features Included', 'No Commitment', '30 Day Duration'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <div className={`mt-0.5 rounded-full p-0.5 ${selectedPlanId === 'FreeTrial' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanId('FreeTrial');
                    activateFreeTrial();
                  }}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                    selectedPlanId === 'FreeTrial' 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          )}

          {plans.map((plan) => {
            const effectivePrice = calculateEffectivePrice(plan.price, offer);
            const isSelected = selectedPlanId === plan.id;
            
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`
                  relative rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col
                  ${isSelected 
                    ? 'bg-white border-2 border-primary-500 shadow-[0_0_40px_rgba(37,99,235,0.15)] ring-4 ring-primary-500/10 scale-105 z-10' 
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 opacity-70 hover:opacity-100 grayscale hover:grayscale-0'
                  }
                `}
              >
                {/* BLUE CIRCLE DOT INDICATOR */}
                {isSelected && (
                  <div className="absolute -top-3 -right-3 bg-primary-600 text-white rounded-full p-1.5 shadow-lg shadow-primary-600/40 animate-in zoom-in spin-in-12 duration-300">
                    <Check size={20} strokeWidth={3} />
                  </div>
                )}

                {plan.isBestValue && (
                  <div className={`absolute top-0 inset-x-0 mx-auto w-fit -mt-3 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ${isSelected ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-200 text-slate-500'}`}>
                    Best Value
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{plan.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed min-h-[40px]">{plan.description}</p>
                </div>
                
                <div className="flex items-baseline gap-2 mb-8">
                  {isOfferActive && (
                    <span className="text-lg text-slate-400 line-through font-medium">₹{plan.price.toLocaleString()}</span>
                  )}
                  <span className={`text-4xl font-extrabold tracking-tight ${isOfferActive ? 'text-emerald-600' : isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    ₹{effectivePrice.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">/ {plan.durationMonths === 1 ? 'mo' : plan.durationMonths === 6 ? '6mo' : 'yr'}</span>
                </div>

                <div className="mt-auto">
                  <ul className="space-y-4 mb-8">
                    {['Unlimited Customers', 'Smart Delivery Routes', 'Expenses & Inventory', 'Priority Support'].map((feat, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className={`mt-0.5 rounded-full p-0.5 ${isSelected ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className={isSelected ? 'text-slate-700 font-medium' : ''}>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlanId(plan.id);
                      initiatePayment();
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                      isSelected 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? 'Proceed to Payment' : 'Select & Pay'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-md mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <button 
            onClick={selectedPlanId === 'FreeTrial' ? activateFreeTrial : initiatePayment}
            className="group w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 text-lg relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {selectedPlanId === 'FreeTrial' ? <Zap size={22} className="text-emerald-400" /> : <Shield size={22} className="text-emerald-400" />}
            <span>{selectedPlanId === 'FreeTrial' ? 'Start Free Trial Now' : 'Pay Securely with Razorpay'}</span>
          </button>
          
          <div className="flex items-center justify-center gap-6 text-sm">
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 font-medium transition-colors">
              Sign Out
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <Lock size={12} /> SSL Encrypted Payment
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OnboardingPayment;
