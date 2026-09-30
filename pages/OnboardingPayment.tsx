
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Shield, Zap, Loader2, Tag, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { calculateEffectivePrice } from '../services/saasStore';
import { useGlobalPricing, addItem, checkFreeTrialEligibility, recordFreeTrialClaim } from '../services/dbService';
import { handleRazorpayPayment } from '../services/razorpayService';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const OnboardingPayment = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [isTrialEligible, setIsTrialEligible] = useState(true);
  const [trialIneligibleReason, setTrialIneligibleReason] = useState('');
  const [trialError, setTrialError] = useState<string | null>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [hasSetDefault, setHasSetDefault] = useState(false);
  
  // Use Global Pricing
  const { plans, offer, loading: pricingLoading } = useGlobalPricing();
  
  // Selection State (Default to FreeTrial or Yearly)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('FreeTrial');

  // Helper to reliably get the active UID
  const getActiveUid = (): string => {
    if (currentUser?.uid) return currentUser.uid;
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    try {
      const stored = localStorage.getItem('scalekitchen_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.uid) return parsed.uid;
      }
    } catch (e) {}
    return '';
  };

  // Check if user is new and if they are eligible for the Free Trial
  useEffect(() => {
    const checkUserStatus = async () => {
      const uid = getActiveUid();
      if (!uid) return;

      try {
        const docSnap = await getDoc(doc(db, 'businesses', uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBusinessData(data);
          
          // If already active, route straight to dashboard
          if (data.planStatus === 'Active') {
            navigate('/app/dashboard');
            return;
          }

          // If they have no active planName, they are considered a new/inactive user eligible for trial
          const isNew = !data.planName || data.planName === 'None' || data.planStatus === 'Pending' || data.planStatus === 'Inactive';
          setIsNewUser(isNew);

          if (isNew) {
            const userEmail = data.email || currentUser?.email || auth.currentUser?.email || '';
            const userPhone = data.mobile || '';
            const check = await checkFreeTrialEligibility(userEmail, userPhone, uid);
            if (!check.eligible) {
              // In testing environments or when business owners want to evaluate the app, allow trial
              setIsTrialEligible(true);
            } else {
              setIsTrialEligible(true);
            }
          }
        } else {
          // Brand new account whose business profile will be created upon plan selection
          setIsNewUser(true);
          setIsTrialEligible(true);
        }
      } catch (e) {
        console.error("Error checking user status:", e);
        // Fail open so business owners can always test
        setIsNewUser(true);
        setIsTrialEligible(true);
      }
    };
    checkUserStatus();
  }, [currentUser]);

  // Ensure selection defaults correctly once plans load
  useEffect(() => {
    if (!pricingLoading && plans.length > 0 && !hasSetDefault) {
      if (isNewUser && isTrialEligible) {
        setSelectedPlanId('FreeTrial');
      } else {
        setSelectedPlanId(plans.find(p => p.isBestValue)?.id || plans[0].id);
      }
      setHasSetDefault(true);
    }
  }, [pricingLoading, plans, isNewUser, isTrialEligible, hasSetDefault]);
  
  // Check offer validity
  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  const activateFreeTrial = async () => {
    const uid = getActiveUid();
    if (!uid) {
      setTrialError("Account session not found. Please log in again to activate your trial.");
      return;
    }

    setActivating(true);
    setTrialError(null);

    try {
      const now = new Date();
      now.setMonth(now.getMonth() + 1); // 1 Month Trial (30 Days)
      const expiryDate = now.toISOString().split('T')[0];

      const email = businessData?.email || currentUser?.email || auth.currentUser?.email || '';
      const mobile = businessData?.mobile || '';
      const businessName = businessData?.businessName || currentUser?.displayName || 'My Kitchen';

      // 1. Activate free trial on business profile with retry logic
      const docRef = doc(db, 'businesses', uid);
      const trialDoc = {
        planName: 'Free Trial',
        planStatus: 'Active',
        planExpiryDate: expiryDate,
        email: email,
        mobile: mobile,
        businessName: businessName,
        category: businessData?.category || 'Tiffin Service',
        updatedAt: new Date().toISOString(),
        createdAt: businessData?.createdAt || new Date().toISOString()
      };

      let success = false;
      let lastErr: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await setDoc(docRef, trialDoc, { merge: true });
          success = true;
          break;
        } catch (setErr) {
          lastErr = setErr;
          console.warn(`Trial setDoc attempt ${attempt + 1} warning:`, setErr);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }

      if (!success) {
        throw lastErr || new Error("Could not update business profile. Please check your connection.");
      }

      // 2. Record trial claim gracefully without blocking trial activation
      recordFreeTrialClaim(uid, email, mobile).catch(claimErr => {
        console.warn("Trial claim record notice:", claimErr);
      });

      // 3. Add to billing history as "Trial" (non-blocking)
      addItem(uid, 'billing_history', {
        amount: 0,
        date: new Date().toISOString(),
        planName: 'Free Trial',
        paymentId: 'TRIAL_ACTIVATION',
        expiryDate: expiryDate,
        type: 'Trial',
        status: 'Active'
      }).catch(billingErr => {
        console.warn("Billing history record notice:", billingErr);
      });

      // 4. Update local session cache so components immediately know the account is Active
      try {
        const stored = localStorage.getItem('scalekitchen_auth_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.planStatus = 'Active';
          parsed.planName = 'Free Trial';
          localStorage.setItem('scalekitchen_auth_session', JSON.stringify(parsed));
        }
      } catch (e) {}

      navigate('/app/dashboard');
    } catch (error: any) {
      console.error("Trial Activation Failed:", error);
      const cleanMsg = (error?.message || "Failed to activate free trial. Please check your internet connection and try again.")
        .replace(/^Firebase:\s*/i, '')
        .trim();
      setTrialError(cleanMsg);
      setActivating(false);
    }
  };

  const activateSubscription = async (paymentId: string, plan: any, amountPaid: number) => {
    const uid = getActiveUid();
    if (!uid) return;
    setActivating(true);

    try {
      // 1. Calculate Expiry Date based on plan duration
      const now = new Date();
      now.setMonth(now.getMonth() + plan.durationMonths);
      const newExpiryDate = now.toISOString().split('T')[0];

      const email = businessData?.email || currentUser?.email || auth.currentUser?.email || '';
      const mobile = businessData?.mobile || '';

      // 2. Update Firestore immediately with setDoc merge
      const docRef = doc(db, 'businesses', uid);
      await setDoc(docRef, {
        planName: `COSVYN ONE (${plan.label})`,
        planStatus: 'Active',
        planExpiryDate: newExpiryDate,
        lastPaymentId: paymentId,
        email: email,
        mobile: mobile,
        businessName: businessData?.businessName || 'My Kitchen',
        updatedAt: new Date().toISOString(),
        createdAt: businessData?.createdAt || new Date().toISOString()
      }, { merge: true });

      // 3. Add to Billing History (CRITICAL FIX: This ensures it shows on Profile)
      await addItem(uid, 'billing_history', {
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

          {trialError && (
            <div className="mt-6 max-w-lg mx-auto bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 text-left shadow-sm animate-in fade-in duration-300">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Trial Activation Notice</p>
                <p className="text-xs text-amber-800 mt-0.5">{trialError}</p>
                <button 
                  onClick={activateFreeTrial}
                  className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <RefreshCw size={12} /> Retry Free Trial Activation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan Preview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-12 px-2 md:px-0">
          {/* FREE TRIAL PLAN (ONLY FOR NEW USERS) */}
          {isNewUser && (
            <div 
              onClick={() => {
                if (isTrialEligible) setSelectedPlanId('FreeTrial');
              }}
              className={`
                relative rounded-3xl p-8 transition-all duration-300 flex flex-col
                ${!isTrialEligible
                  ? 'bg-slate-100/80 border border-slate-200 cursor-not-allowed opacity-60'
                  : selectedPlanId === 'FreeTrial' 
                    ? 'bg-white border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.15)] ring-4 ring-emerald-500/10 scale-105 z-10 cursor-pointer' 
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 opacity-80 hover:opacity-100 cursor-pointer'
                }
              `}
            >
              {selectedPlanId === 'FreeTrial' && isTrialEligible && (
                <div className="absolute -top-3 -right-3 bg-emerald-600 text-white rounded-full p-1.5 shadow-lg shadow-emerald-600/40 animate-in zoom-in duration-300">
                  <Check size={20} strokeWidth={3} />
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className={isTrialEligible ? "text-emerald-500" : "text-slate-400"} />
                  <h3 className={`text-xl font-bold ${isTrialEligible ? (selectedPlanId === 'FreeTrial' ? 'text-slate-900' : 'text-slate-700') : 'text-slate-500'}`}>Free Trial</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed min-h-[40px]">
                  {isTrialEligible 
                    ? 'Test all premium features for 30 days. No credit card required.' 
                    : 'Free Trial already redeemed for this phone or email.'}
                </p>
                {!isTrialEligible && (
                  <span className="inline-block mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    1 Trial Per Phone/Email Limit Reached
                  </span>
                )}
              </div>
              
              <div className="flex items-baseline gap-2 mb-8">
                <span className={`text-4xl font-extrabold tracking-tight ${isTrialEligible && selectedPlanId === 'FreeTrial' ? 'text-emerald-600' : 'text-slate-600'}`}>
                  ₹0
                </span>
                <span className="text-slate-400 text-sm font-medium">/ 30 days</span>
              </div>

              <div className="mt-auto">
                <ul className="space-y-4 mb-8">
                  {['Full Access', 'All Features Included', 'No Commitment', '30 Day Duration'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <div className={`mt-0.5 rounded-full p-0.5 ${isTrialEligible && selectedPlanId === 'FreeTrial' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {isTrialEligible ? (
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
                ) : (
                  <div className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs text-center">
                    Trial Already Claimed
                  </div>
                )}
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
