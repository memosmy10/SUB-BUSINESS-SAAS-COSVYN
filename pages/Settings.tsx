
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, X, Store, Truck, Calendar, Loader2, Edit2, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, deleteItem, updateItem } from '../services/dbService';
import { INDIA_STATES } from '../services/store';

// --- Types ---
interface Branch { id: string; name: string; city: string; state: string; }
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
      state: initialData?.state || '' 
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.city || !formData.state) return;
      handleSaveBranch({ 
        name: formData.name, 
        city: formData.city, 
        state: formData.state 
      });
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between mb-4 items-center">
            <h3 className="font-bold text-lg text-slate-900">{initialData ? 'Edit Branch' : 'Add Branch'}</h3>
            <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-700"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch Name</label>
              <input 
                required autoFocus
                placeholder="e.g. Main Kitchen" 
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
              <input 
                required 
                placeholder="e.g. Mumbai" 
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State</label>
              <select 
                required
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.state}
                onChange={e => setFormData({...formData, state: e.target.value})}
              >
                <option value="">Select State</option>
                {INDIA_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">
              {initialData ? 'Save Changes' : 'Create Branch'}
            </button>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between mb-4 items-center">
            <h3 className="font-bold text-lg text-slate-900">{initialData ? 'Edit Plan' : 'Add Plan'}</h3>
            <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-700"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plan Name</label>
                <input required placeholder="Plan Name" value={formData.name} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                <input required type="number" placeholder="Price" value={formData.price} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
              <textarea placeholder="Description" value={formData.description} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Cycle</label>
                 <select className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                   <option value="Monthly">Monthly</option><option value="Weekly">Weekly</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Delivery Days</label>
                 <input type="number" placeholder="e.g. 26" value={formData.numberOfDeliveryDays} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, numberOfDeliveryDays: Number(e.target.value)})} />
               </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-2 text-slate-700 uppercase">Weekly Schedule</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS_MAP.map(d => (
                  <button type="button" key={d.id} onClick={() => toggleDay(d.id)} className={`px-3 py-1.5 text-xs rounded border transition-colors font-medium ${formData.weekdays?.includes(d.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>{d.label}</button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                This schedule determines how many calendar days the plan lasts based on the total delivery days above.
              </p>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">
              {initialData ? 'Save Plan Changes' : 'Create Plan'}
            </button>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between mb-4 items-center">
            <h3 className="font-bold text-lg text-slate-900">{initialData ? 'Edit Staff' : 'Add Staff'}</h3>
            <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-700"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
              <input required placeholder="Name" value={formData.name} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
              <input required placeholder="Mobile" value={formData.mobile} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, mobile: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Joining Date</label>
                <input required type="date" value={formData.dateOfJoining} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, dateOfJoining: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salary (₹)</label>
                <input required type="number" placeholder="Salary" value={formData.salary} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" onChange={e => setFormData({...formData, salary: Number(e.target.value)})} />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">
              {initialData ? 'Save Staff' : 'Add Staff'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div><h1 className="text-2xl font-bold text-slate-900">Configurations</h1><p className="text-slate-500">Live Database Management.</p></div>

      {/* BRANCHES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3"><Store className="text-blue-600"/><h2 className="font-bold text-slate-900">Branches</h2></div>
          <button onClick={() => handleOpenModal('branch')} className="flex gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"><Plus size={18}/> Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">City</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
            <tbody className="text-slate-700">
              {branches.map(b => (
                <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold">{b.name}</td>
                  <td className="px-6 py-4">{b.city}, {b.state}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('branch', b)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete('branches', b.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">No branches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLANS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3"><Calendar className="text-violet-600"/><h2 className="font-bold text-slate-900">Plans</h2></div>
          <button onClick={() => handleOpenModal('plan')} disabled={branches.length === 0} className="flex gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"><Plus size={18}/> Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Branch</th><th className="px-6 py-4">Price</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
            <tbody className="text-slate-700">
              {plans.map(p => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><div>{p.name}</div><div className="text-xs text-slate-400">{p.deliveryTypeLabel}</div></td>
                  <td className="px-6 py-4">{branches.find(b => b.id === p.branchId)?.name}</td>
                  <td className="px-6 py-4">₹{p.price}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('plan', p)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete('plans', p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No plans yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* STAFF */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3"><Truck className="text-orange-600"/><h2 className="font-bold text-slate-900">Staff</h2></div>
          <button onClick={() => handleOpenModal('delivery')} disabled={branches.length === 0} className="flex gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"><Plus size={18}/> Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Branch</th><th className="px-6 py-4">Salary</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
            <tbody className="text-slate-700">
              {deliveryBoys.map(d => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><div>{d.name}</div><div className="text-xs text-slate-400">{d.mobile}</div></td>
                  <td className="px-6 py-4">{branches.find(b => b.id === d.branchId)?.name}</td>
                  <td className="px-6 py-4">₹{d.salary}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('delivery', d)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete('staff', d.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {deliveryBoys.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No staff yet.</td></tr>}
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
