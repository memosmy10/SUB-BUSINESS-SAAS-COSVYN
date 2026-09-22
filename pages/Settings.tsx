
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, X, Store, Truck, Calendar, Loader2, Edit2, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, deleteItem, updateItem } from '../services/dbService';
import { INDIA_STATES } from '../services/store';

// --- Types ---
interface Branch { 
  id: string; 
  name: string; 
  city: string; 
  state: string; 
  hubAddress?: string;
  hubLocationLink?: string;
}
interface Plan { id: string; branchId: string; name: string; description: string; price: number; category: string; numberOfDeliveryDays: number; weekdays: number[]; deliveryTypeLabel: string; }
interface DeliveryBoy { id: string; branchId: string; name: string; mobile: string; dateOfJoining: string; salary: number; }

const WEEKDAYS_MAP = [
  { id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, 
  { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' },
];

const generateDeliveryLabel = (days: number[]): string => {
  if (!days || days.length === 0) return 'No days';
  if (days.length === 7) return 'All 7 Days';
  const sorted = [...days].sort();
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Mon-Fri';
  if (sorted.length === 6 && sorted.every((d, i) => d === i + 1)) return 'Mon-Sat';
  return sorted.map(d => WEEKDAYS_MAP.find(w => w.id === d)?.label).join(', ');
};

const Settings = () => {
  const { currentUser } = useAuth();
  
  // --- REAL DATA STREAMS ---
  const { data: branches, loading: l1 } = useStreamCollection<Branch>('branches');
  const { data: plans, loading: l2 } = useStreamCollection<Plan>('plans');
  const { data: deliveryBoys, loading: l3 } = useStreamCollection<DeliveryBoy>('staff');

  const isLoading = l1 || l2 || l3;

  // Modal State
  const [activeModal, setActiveModal] = useState<'branch' | 'plan' | 'delivery' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // --- ACTIONS ---
  
  const handleOpenModal = (type: 'branch' | 'plan' | 'delivery', item?: any) => {
    setEditingItem(item || null);
    setActiveModal(type);
  };

  const handleSaveBranch = async (data: Omit<Branch, 'id'>) => {
    if(!currentUser) return;
    if (editingItem) {
      await updateItem(currentUser.uid, 'branches', editingItem.id, data);
    } else {
      await addItem(currentUser.uid, 'branches', data);
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSavePlan = async (data: Omit<Plan, 'id'>) => {
    if(!currentUser) return;
    if (editingItem) {
      await updateItem(currentUser.uid, 'plans', editingItem.id, data);
    } else {
      await addItem(currentUser.uid, 'plans', data);
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSaveStaff = async (data: Omit<DeliveryBoy, 'id'>) => {
    if(!currentUser) return;
    if (editingItem) {
      await updateItem(currentUser.uid, 'staff', editingItem.id, data);
    } else {
      await addItem(currentUser.uid, 'staff', data);
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleDelete = async (collection: string, id: string) => {
    if(!currentUser || !window.confirm("Are you sure? This cannot be undone.")) return;
    await deleteItem(currentUser.uid, collection, id);
  };

  // --- MODALS ---
  
  const BranchModal = ({ initialData, onClose }: { initialData?: Branch, onClose: () => void }) => {
    const [formData, setFormData] = useState({ 
      name: initialData?.name || '', 
      city: initialData?.city || '',
      state: initialData?.state || '',
      hubAddress: initialData?.hubAddress || '',
      hubLocationLink: initialData?.hubLocationLink || ''
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.city || !formData.state) return;
      handleSaveBranch({ 
        name: formData.name, 
        city: formData.city, 
        state: formData.state,
        hubAddress: formData.hubAddress,
        hubLocationLink: formData.hubLocationLink
      });
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Kitchen Branch' : 'Add Kitchen Branch'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Physical dispatch hub and service geography</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name</label>
              <input 
                required autoFocus
                placeholder="e.g. Bandra Cloud Kitchen" 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input 
                  required 
                  placeholder="e.g. Mumbai" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <select 
                  required
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium"
                  value={formData.state}
                  onChange={e => setFormData({...formData, state: e.target.value})}
                >
                  <option value="">Select State</option>
                  {INDIA_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1">
                  Kitchen Hub Address (For Route Optimization)
                </label>
                <input 
                  placeholder="e.g. Shop 4, Food Court, Andheri West" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.hubAddress}
                  onChange={e => setFormData({...formData, hubAddress: e.target.value})} 
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Used as starting & return point for delivery boy shortest paths.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1">
                  Google Maps URL or Lat, Lng
                </label>
                <input 
                  placeholder="e.g. https://maps.app.goo.gl/... or 19.1136, 72.8697" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.hubLocationLink}
                  onChange={e => setFormData({...formData, hubLocationLink: e.target.value})} 
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Paste Google Maps share link or GPS coordinates.</p>
              </div>
            </div>
            
            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Branch' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const PlanModal = ({ initialData, onClose }: { initialData?: Plan, onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<Plan>>({
      branchId: branches[0]?.id || '', 
      category: 'Monthly', 
      weekdays: [1, 2, 3, 4, 5], 
      numberOfDeliveryDays: 20,
      ...initialData
    });

    const toggleDay = (d: number) => {
      const days = formData.weekdays || [];
      setFormData({...formData, weekdays: days.includes(d) ? days.filter(x => x !== d) : [...days, d]});
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name || !formData.price || !formData.branchId) return;
      handleSavePlan({
        ...formData,
        price: Number(formData.price),
        numberOfDeliveryDays: Number(formData.numberOfDeliveryDays),
        deliveryTypeLabel: generateDeliveryLabel(formData.weekdays || [])
      } as any);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-7 overflow-y-auto max-h-[90vh] border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Meal subscription offering and billing frequency</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kitchen Branch</label>
              <select 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name</label>
                <input required placeholder="e.g. Standard Tiffin Lunch" value={formData.name} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹)</label>
                <input required type="number" placeholder="e.g. 2500" value={formData.price} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea placeholder="e.g. 4 chapatis, 1 sabzi, dal, rice & salad" value={formData.description} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium resize-none h-18" onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Cycle</label>
                 <select className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                   <option value="Monthly">Monthly</option>
                   <option value="Weekly">Weekly</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">Total Delivery Days</label>
                 <input type="number" placeholder="e.g. 26" value={formData.numberOfDeliveryDays} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, numberOfDeliveryDays: Number(e.target.value)})} />
               </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-2 text-slate-700">Delivery Weekdays</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS_MAP.map(d => (
                  <button type="button" key={d.id} onClick={() => toggleDay(d.id)} className={`px-3 py-1.5 text-xs rounded-xl border transition-all font-medium ${formData.weekdays?.includes(d.id) ? 'bg-primary-600 text-white border-primary-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'}`}>{d.label}</button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Plan' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const DeliveryBoyModal = ({ initialData, onClose }: { initialData?: DeliveryBoy, onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<DeliveryBoy>>({ 
      branchId: branches[0]?.id || '',
      ...initialData
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSaveStaff({ ...formData, salary: Number(formData.salary) } as any);
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Delivery Partner' : 'Add Delivery Partner'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Staff profile and contact for WhatsApp routing</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
              <select 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input required placeholder="e.g. Ramesh Kumar" value={formData.name} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Mobile Number</label>
              <input required placeholder="e.g. 9876543210" value={formData.mobile} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium font-mono" onChange={e => setFormData({...formData, mobile: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Date</label>
                <input required type="date" value={formData.dateOfJoining} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, dateOfJoining: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Salary (₹)</label>
                <input required type="number" placeholder="Salary" value={formData.salary} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, salary: Number(e.target.value)})} />
              </div>
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Partner' : 'Add Partner'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 pt-1 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">Business Configuration</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">Configure kitchen hubs, meal plan structures, and delivery partners.</p>
      </div>

      {/* BRANCHES */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Kitchen Branches & Hubs</h2>
              <p className="text-[11px] text-slate-400">Dispatch centers and starting points for delivery route calculation</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('branch')} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Branch
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Branch Details</th>
                <th className="px-6 py-3">City & State</th>
                <th className="px-6 py-3">Hub Map / GPS Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {branches.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900">{b.name}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">{b.hubAddress || 'No address set'}</div>
                  </td>
                  <td className="px-6 py-3.5 font-medium">{b.city}, {b.state}</td>
                  <td className="px-6 py-3.5">
                    {b.hubLocationLink ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        GPS Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        No Maps Pin
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('branch', b)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete('branches', b.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No branches configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLANS */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Subscription Plans</h2>
              <p className="text-[11px] text-slate-400">Menu tier offerings, recurring pricing, and weekly schedules</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('plan')} 
            disabled={branches.length === 0} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Plan
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Plan Name & Schedule</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Days</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {plans.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{p.deliveryTypeLabel} • {p.category}</div>
                  </td>
                  <td className="px-6 py-3.5 font-medium">{branches.find(b => b.id === p.branchId)?.name || 'General'}</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">₹{p.price.toLocaleString()}</td>
                  <td className="px-6 py-3.5 text-slate-500">{p.numberOfDeliveryDays} Days</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('plan', p)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete('plans', p.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No meal plans configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* STAFF */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Delivery Staff</h2>
              <p className="text-[11px] text-slate-400">Riders and partners receiving WhatsApp route dispatches</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('delivery')} 
            disabled={branches.length === 0} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Partner
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Partner Name</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Salary</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {deliveryBoys.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5 font-semibold text-slate-900">{d.name}</td>
                  <td className="px-6 py-3.5 font-medium">{branches.find(b => b.id === d.branchId)?.name || 'General'}</td>
                  <td className="px-6 py-3.5 font-mono text-slate-600">{d.mobile}</td>
                  <td className="px-6 py-3.5 font-semibold text-slate-800">₹{d.salary?.toLocaleString() || 0}</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('delivery', d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete('staff', d.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {deliveryBoys.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No delivery partners assigned yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'branch' && <BranchModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'plan' && <PlanModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'delivery' && <DeliveryBoyModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
    </div>
  );
};

export default Settings;
