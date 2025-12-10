
import React, { useState, useEffect } from 'react';
import { 
  User, Building, CreditCard, Shield, CheckCircle, AlertCircle, 
  MapPin, Globe, Rocket, Monitor, LayoutTemplate, ExternalLink, X, Zap, Loader2, Tag 
} from 'lucide-react';
import { 
  INITIAL_BUSINESS_PROFILE, INDIA_STATES, BusinessProfile, getDaysDifference 
} from '../services/store';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { calculateEffectivePrice } from '../services/saasStore';
import { useGlobalPricing } from '../services/dbService';
import { useLocation, useNavigate } from 'react-router-dom';

const Profile = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>({...INITIAL_BUSINESS_PROFILE});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BusinessProfile>({...INITIAL_BUSINESS_PROFILE});
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // FETCH PROFILE
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'businesses', currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as BusinessProfile;
          setProfile(data);
          Object.assign(INITIAL_BUSINESS_PROFILE, data);
        } else {
          const newProfile = {
            ...INITIAL_BUSINESS_PROFILE,
            email: currentUser.email || '',
            ownerName: currentUser.displayName || '',
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser]);

  // Days left helper
  const daysToExpiry = getDaysDifference(new Date().toISOString().split('T')[0], profile.planExpiryDate);

  const handleSave = async () => {
    if (!currentUser) return;

    const isComplete = Boolean(
      formData.ownerName?.trim() && 
      formData.email?.trim() && 
      formData.mobile?.trim() && 
      formData.businessName?.trim() && 
      formData.state?.trim() && 
      formData.city?.trim()
    );

    const updatedProfile = {
      ...formData,
      isProfileComplete: isComplete
    };

    try {
      const docRef = doc(db, 'businesses', currentUser.uid);
      await updateDoc(docRef, updatedProfile);
      
      setProfile(updatedProfile);
      Object.assign(INITIAL_BUSINESS_PROFILE, updatedProfile);
      setIsEditing(false);
      alert("Profile Updated!");
    } catch (e) {
      console.error("Error saving profile:", e);
      alert("Failed to save changes.");
    }
  };

  const handleRedirectForRenewal = () => {
    if (!currentUser) return;
    
    // --- STRICT PAYMENT REDIRECT LOGIC ---
    // 1. The ID of this specific SaaS tool (Matches Cosvyn configuration)
    const PRODUCT_ID = 'saas_1'; 

    // 2. The URL where the user should return after paying
    const CALLBACK_URL = window.location.origin; 

    // 3. Construct the Product Page URL with the callback param
    const productPageUrl = `https://cosvyn.space/#/product/${PRODUCT_ID}?callback=${encodeURIComponent(CALLBACK_URL)}`;

    // 4. Redirect
    window.location.href = productPageUrl;
  };

  const ServiceCard = ({ title, desc, icon: Icon }: any) => (
    <a href="https://cosvyn.space" target="_blank" rel="noopener noreferrer" className="group block h-full">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50 hover:border-primary-500/50 transition-all h-full relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
           <ExternalLink className="text-primary-400" size={18} />
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4 text-primary-400 group-hover:text-white group-hover:bg-primary-600 transition-colors">
           <Icon size={24} />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </a>
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center flex-col">
        <Loader2 className="animate-spin text-primary-600 mb-2" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Business Profile</h1>
          <p className="text-slate-500 mt-1">Complete your profile to unlock full features.</p>
        </div>
        {!profile.isProfileComplete && (
           <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-amber-200">
              <AlertCircle size={16} /> Action Required: Complete Profile
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: EDITABLE FORM */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building size={20} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Business Details</h3>
              </div>
              <button 
                onClick={() => {
                   if (isEditing) handleSave();
                   else {
                     setFormData({...profile});
                     setIsEditing(true);
                   }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                   isEditing 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isEditing ? 'Save Changes' : 'Edit Profile'}
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="md:col-span-2 flex items-center gap-4 mb-2">
                  <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl border-4 border-white shadow-md uppercase">
                     {profile.businessName ? profile.businessName.charAt(0) : 'B'}
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-slate-900">{profile.businessName || 'Your Business'}</h2>
                     <p className="text-slate-500 text-sm">{profile.ownerName}</p>
                  </div>
               </div>

               {/* Fields */}
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Owner Name *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.ownerName : profile.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email *</label>
                  <input 
                    disabled={!isEditing}
                    type="email" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.email : profile.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mobile Number *</label>
                  <input 
                    disabled={!isEditing}
                    type="tel" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.mobile : profile.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Business Name *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.businessName : profile.businessName}
                    onChange={e => setFormData({...formData, businessName: e.target.value})}
                  />
               </div>
               <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                  <textarea 
                    rows={2}
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
                    value={isEditing ? formData.description : profile.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                  <select
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.category : profile.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                     <option>Cloud Kitchen</option>
                     <option>Tiffin Service</option>
                     <option>Catering</option>
                     <option>Restaurant</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Country</label>
                  <input 
                    disabled
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    value="India"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">State *</label>
                  <select
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.state : profile.state}
                    onChange={e => setFormData({...formData, state: e.target.value})}
                  >
                     <option value="">Select State</option>
                     {INDIA_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">City *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Enter City"
                    value={isEditing ? formData.city : profile.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUBSCRIPTION & UPSELL */}
        <div className="space-y-6">
           
           {/* SaaS Subscription Card */}
           <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-3 opacity-10">
                <Shield size={120} />
             </div>
             <div className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Current Plan</p>
                      <h3 className="text-xl font-bold text-white">{profile.planName}</h3>
                   </div>
                   <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                     <CheckCircle size={12} /> {profile.planStatus}
                   </span>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-4 mb-6">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-300">Expires On</span>
                     <span className={`font-bold ${daysToExpiry <= 7 ? 'text-red-400' : 'text-white'}`}>
                        {profile.planExpiryDate}
                     </span>
                   </div>
                   {daysToExpiry <= 7 && (
                      <div className="bg-red-500/20 border border-red-500/30 p-2 rounded text-xs text-red-200 flex gap-2 items-center">
                         <AlertCircle size={14} /> Expiring in {daysToExpiry} days.
                      </div>
                   )}
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => setIsRenewModalOpen(true)}
                    className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-xl hover:bg-slate-100 transition-colors shadow-lg"
                  >
                    Renew Subscription
                  </button>
                  <button className="w-full bg-transparent border border-white/20 text-slate-300 font-medium py-2.5 rounded-xl hover:bg-white/5 transition-colors text-sm">
                    View Billing History
                  </button>
                </div>
             </div>
          </div>

          {/* Upgrade / Marketing Upsell */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6">
             <h4 className="font-bold text-violet-900 mb-2">Need a Website?</h4>
             <p className="text-violet-700 text-sm mb-4">Cosvyn can build a high-converting website for your kitchen.</p>
             <a href="https://cosvyn.space" target="_blank" rel="noreferrer" className="block w-full text-center bg-violet-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
                Explore Services
             </a>
          </div>

        </div>

      </div>

      {/* MARKETING SLIDES / MORE SERVICES */}
      <div className="pt-8 border-t border-slate-200">
         <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Rocket className="text-primary-600" /> Grow with Cosvyn
         </h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-48">
            <ServiceCard 
               title="Website Building" 
               desc="Get a custom, SEO-optimized landing page for your meal prep brand."
               icon={Monitor}
            />
            <ServiceCard 
               title="Digital Marketing" 
               desc="Run targeted Ads on Instagram & Facebook to get more subscribers."
               icon={Globe}
            />
            <ServiceCard 
               title="Branding & Design" 
               desc="Logo, menu design, and packaging assets that stand out."
               icon={LayoutTemplate}
            />
         </div>
      </div>

      {/* RENEWAL MODAL */}
      {isRenewModalOpen && (
        <RenewSaaSModal 
          onClose={() => setIsRenewModalOpen(false)} 
          onRenew={handleRedirectForRenewal}
        />
      )}

    </div>
  );
};

const RenewSaaSModal = ({ onClose, onRenew }: any) => {
  const { offer, loading } = useGlobalPricing();
  
  if (loading) return null; // Or a spinner if necessary, but modal shouldn't flash

  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in zoom-in-95">
       <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div className="flex items-center gap-2">
               <Zap className="text-primary-600" size={20} fill="currentColor" />
               <h3 className="font-bold text-xl text-slate-900">Renew Subscription</h3>
             </div>
             <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
          </div>
          <div className="p-6 space-y-4">
             <p className="text-slate-600 text-sm mb-4">Click below to proceed to our secure payment gateway where you can select your renewal plan.</p>
             
             {isOfferActive && (
               <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 mb-2">
                 <Tag size={14} /> {offer.title} - {offer.discountPercent}% Discount Applied!
               </div>
             )}

             <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-500 leading-relaxed border border-slate-100 flex gap-2">
                <ExternalLink size={14} className="shrink-0 mt-0.5" />
                Redirecting to cosvyn.space for plan selection and payment.
             </div>

             <button 
               onClick={onRenew}
               className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-800 transition-all mt-2 flex items-center justify-center gap-2"
             >
                <CreditCard size={20} />
                Proceed to Renew
             </button>
          </div>
       </div>
    </div>
  );
};

export default Profile;
