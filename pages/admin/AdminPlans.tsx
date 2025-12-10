
import React, { useState, useEffect } from 'react';
import { Save, Tag, Clock, DollarSign, Check, Percent, AlertCircle, Loader2 } from 'lucide-react';
import { SaasPlan, SpecialOffer } from '../../services/saasStore';
import { useGlobalPricing, saveGlobalPricing } from '../../services/dbService';

const AdminPlans = () => {
  // Use the hook to fetch real data
  const { plans: fetchedPlans, offer: fetchedOffer, loading } = useGlobalPricing();
  
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [offer, setOffer] = useState<SpecialOffer | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Sync state when data is loaded
  useEffect(() => {
    if (!loading) {
      setPlans(fetchedPlans);
      setOffer(fetchedOffer);
    }
  }, [loading, fetchedPlans, fetchedOffer]);

  const handlePriceChange = (id: string, newPrice: string) => {
    const price = parseInt(newPrice) || 0;
    setPlans(prev => prev.map(p => p.id === id ? { ...p, price } : p));
  };

  const handleSave = async () => {
    if (!offer) return;
    try {
      await saveGlobalPricing(plans, offer);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      console.error("Error saving plans:", e);
      alert("Failed to save changes.");
    }
  };

  if (loading || !offer) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Plans & Offers</h1>
          <p className="text-slate-400">Manage SaaS pricing and run limited-time campaigns.</p>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
        >
          {isSaved ? <Check size={20} /> : <Save size={20} />}
          {isSaved ? 'Published!' : 'Publish Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT: PRICING CONFIG */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400"><DollarSign size={20} /></div>
            <h2 className="text-xl font-bold text-white">Base Pricing</h2>
          </div>

          <div className="space-y-4">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-white">{plan.label}</span>
                  {plan.isBestValue && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-bold">Best Value</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Price (₹)</label>
                    <input 
                      type="number"
                      value={plan.price}
                      onChange={(e) => handlePriceChange(plan.id, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-cyan-500 font-mono text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Display Text</label>
                    <div className="text-slate-400 text-sm py-2.5">{plan.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: SPECIAL OFFER CONFIG */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400"><Tag size={20} /></div>
            <h2 className="text-xl font-bold text-white">Limited Time Offer</h2>
          </div>

          <div className={`bg-slate-900/70 border rounded-2xl p-6 backdrop-blur-sm transition-all ${offer.isActive ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.1)]' : 'border-slate-800'}`}>
            
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-300 font-medium">Enable Campaign</span>
              <button 
                onClick={() => setOffer({...offer, isActive: !offer.isActive})}
                className={`w-14 h-8 rounded-full p-1 transition-colors ${offer.isActive ? 'bg-violet-600' : 'bg-slate-700'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${offer.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className={`space-y-5 transition-opacity ${offer.isActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Campaign Title</label>
                <input 
                  type="text"
                  value={offer.title}
                  onChange={(e) => setOffer({...offer, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                  placeholder="e.g. Black Friday Sale"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Discount %</label>
                  <div className="relative">
                    <Percent size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="number"
                      value={offer.discountPercent}
                      onChange={(e) => setOffer({...offer, discountPercent: parseInt(e.target.value) || 0})}
                      className="w-full pl-9 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Ends At</label>
                  <input 
                    type="datetime-local"
                    value={offer.endsAt ? offer.endsAt.slice(0, 16) : ''} 
                    onChange={(e) => setOffer({...offer, endsAt: new Date(e.target.value).toISOString()})}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 text-sm"
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-violet-900/20 border border-violet-500/20 p-4 rounded-xl flex items-start gap-3">
                <Clock className="text-violet-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-violet-200 font-bold text-sm">Banner Preview</p>
                  <p className="text-violet-300/70 text-xs mt-1">
                    "{offer.title} - Get {offer.discountPercent}% OFF! Ends in [Timer]"
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPlans;
