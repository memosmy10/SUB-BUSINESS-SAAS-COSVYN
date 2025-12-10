
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserCheck, RefreshCw, Plus, PauseCircle, Store,
  Search, Filter, Calendar, MapPin, X, AlertCircle, Loader2, Edit, Trash2, Pause, Clock, ArrowRight, CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem } from '../services/dbService';
import { 
  INITIAL_BUSINESS_PROFILE, 
  calculateEndDate, 
  calculateRemainingDeliveries, 
  countDeliveryDays,
  getDaysDifference,
  GlobalCustomer 
} from '../services/store';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const Customers = () => {
  const { currentUser } = useAuth();
  
  // Real Data
  const { data: customers, loading: l1 } = useStreamCollection<GlobalCustomer>('customers');
  const { data: branches, loading: l2 } = useStreamCollection<any>('branches');
  const { data: plans, loading: l3 } = useStreamCollection<any>('plans');
  const { data: deliveryBoys, loading: l4 } = useStreamCollection<any>('staff');

  const isLoading = l1 || l2 || l3 || l4;

  const [isProfileComplete, setIsProfileComplete] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isPauseBranchModalOpen, setIsPauseBranchModalOpen] = useState(false);
  const [isPauseCustomerModalOpen, setIsPauseCustomerModalOpen] = useState(false);
  
  const [activeCustomer, setActiveCustomer] = useState<GlobalCustomer | null>(null);

  // Column Filters
  const [filters, setFilters] = useState({
    name: '', mobile: '', plan: '', area: '', payment: '', branch: ''
  });

  // Check Profile
  useEffect(() => {
    if(currentUser) {
      getDoc(doc(db, 'businesses', currentUser.uid)).then(snap => {
        if(snap.exists()) setIsProfileComplete(snap.data().isProfileComplete);
      });
    }
  }, [currentUser]);

  // Actions
  const handleAddOrEditCustomer = async (data: GlobalCustomer) => {
    if (!currentUser) return;
    
    if (activeCustomer) {
       // Edit Mode
       await updateItem(currentUser.uid, 'customers', activeCustomer.id, data);
       setActiveCustomer(null);
    } else {
       // Add Mode
       const newId = await addItem(currentUser.uid, 'customers', data);
       if (data.amountPaid > 0) {
         await addItem(currentUser.uid, 'payments', {
            amount: data.amountPaid,
            customerId: newId,
            customerName: data.name,
            date: new Date().toISOString(),
            type: 'Income'
         });
       }
    }
    setIsAddModalOpen(false);
  };

  const handleRenewCustomer = async (customerId: string, data: any) => {
    if (!currentUser) return;
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    const plan = plans.find((p:any) => p.id === data.planId);
    const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
    
    const daysLeft = calculateRemainingDeliveries(data.endDate, weekdays);

    await updateItem(currentUser.uid, 'customers', customerId, {
      isActive: true,
      planId: data.planId,
      startDate: data.startDate,
      endDate: data.endDate,
      daysLeft: daysLeft,
      planPrice: data.planPrice,
      amountPaid: data.amountPaid,
      paymentStatus: data.paymentStatus,
      pendingAmount: data.paymentStatus === 'Pending' ? (data.planPrice - data.amountPaid) : 0,
      renewalCount: (cust.renewalCount || 0) + 1
    });

    if (data.amountPaid > 0) {
      await addItem(currentUser.uid, 'payments', {
         amount: data.amountPaid,
         customerId: customerId,
         customerName: cust.name,
         date: new Date().toISOString(),
         type: 'Income'
      });
    }

    setIsRenewModalOpen(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (currentUser && window.confirm('Delete customer? This cannot be undone.')) {
      await deleteItem(currentUser.uid, 'customers', id);
    }
  };

  const handlePauseBranch = async (branchId: string, pauseStart: string, pauseEnd: string) => {
     if (!currentUser) return;
     const branchCustomers = customers.filter(c => c.branchId === branchId && c.isActive);
     
     let updatedCount = 0;

     for (const c of branchCustomers) {
        const plan = plans.find((p:any) => p.id === c.planId);
        const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
        
        // 1. Calculate how many *delivery days* are lost for this specific customer in the pause window
        const missedDeliveries = countDeliveryDays(pauseStart, pauseEnd, weekdays);
        
        if (missedDeliveries > 0) {
           // 2. Extend End Date by exactly 'missedDeliveries' count of valid days
           const newEndDate = calculateEndDate(c.endDate, missedDeliveries, weekdays);
           
           await updateItem(currentUser.uid, 'customers', c.id, {
              endDate: newEndDate,
              // Days left technically remains same (we push end date to compensate for pause gap)
           });
           updatedCount++;
        }
     }
     setIsPauseBranchModalOpen(false);
     alert(`Paused branch. ${updatedCount} subscriptions extended.`);
  };

  const handlePauseCustomer = async (customerId: string, pauseStart: string, pauseEnd: string) => {
     if (!currentUser) return;
     const c = customers.find(x => x.id === customerId);
     if (!c) return;

     const plan = plans.find((p:any) => p.id === c.planId);
     const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];

     // Calculate missed delivery days in the pause window
     const missedDeliveries = countDeliveryDays(pauseStart, pauseEnd, weekdays);
     
     if (missedDeliveries > 0) {
        // Extend end date by adding missed delivery slots to the current end date
        const newEndDate = calculateEndDate(c.endDate, missedDeliveries, weekdays);

        await updateItem(currentUser.uid, 'customers', c.id, {
           endDate: newEndDate
        });
     }

     setIsPauseCustomerModalOpen(false);
     setActiveCustomer(null);
  };

  // Filter Logic
  const filteredCustomers = useMemo(() => {
     return customers.filter(c => {
        const branchName = branches.find((b:any) => b.id === c.branchId)?.name || '';
        const planName = plans.find((p:any) => p.id === c.planId)?.name || '';
        
        return (
           c.name.toLowerCase().includes(filters.name.toLowerCase()) &&
           c.mobile.includes(filters.mobile) &&
           c.area.toLowerCase().includes(filters.area.toLowerCase()) &&
           (filters.payment === '' || c.paymentStatus === filters.payment) &&
           (filters.branch === '' || c.branchId === filters.branch) &&
           planName.toLowerCase().includes(filters.plan.toLowerCase())
        );
     });
  }, [customers, filters, branches, plans]);

  // Metrics (Recalculated Live)
  const metrics = useMemo(() => {
    const unique = customers.length;
    let active = 0;
    
    customers.forEach(c => {
       const plan = plans.find((p:any) => p.id === c.planId);
       const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
       const daysLeft = calculateRemainingDeliveries(c.endDate, weekdays);
       if (c.isActive && daysLeft > 0) active++;
    });

    const totalRenewals = customers.reduce((acc, c) => acc + (c.renewalCount || 0), 0);
    const renewalRate = unique > 0 ? Math.round((totalRenewals / (unique + totalRenewals)) * 100) : 0;
    return { unique, active, renewalRate };
  }, [customers, plans]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-20">
      
      {/* 6 Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow border border-slate-100">
           <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Unique</div>
           <div className="text-2xl font-bold text-slate-900">{metrics.unique}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow border border-slate-100">
           <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Active</div>
           <div className="text-2xl font-bold text-slate-900 text-blue-600">{metrics.active}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow border border-slate-100">
           <div className="text-xs text-slate-400 font-bold uppercase mb-1">Renewal Rate</div>
           <div className="text-2xl font-bold text-slate-900 text-green-600">{metrics.renewalRate}%</div>
        </div>
        
        <button 
          onClick={() => {
             if (isProfileComplete) {
                setActiveCustomer(null);
                setIsAddModalOpen(true);
             } else {
                alert('Complete profile first');
             }
          }} 
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors"
        >
           <Plus size={24} className="mb-1"/> <span className="font-bold text-sm">Add Customer</span>
        </button>

        <button 
          onClick={() => setIsPauseCustomerModalOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors"
        >
           <Pause size={24} className="mb-1"/> <span className="font-bold text-sm">Pause Customer</span>
        </button>

        <button 
          onClick={() => setIsPauseBranchModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors"
        >
           <Store size={24} className="mb-1"/> <span className="font-bold text-sm">Pause Branch</span>
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
               <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  {/* Column Headers */}
                  <tr>
                     <th className="p-3 border-b border-slate-200 w-12">S.No</th>
                     <th className="p-3 border-b border-slate-200 min-w-[150px]">Name</th>
                     <th className="p-3 border-b border-slate-200">Number</th>
                     <th className="p-3 border-b border-slate-200">Plan</th>
                     <th className="p-3 border-b border-slate-200">Time</th>
                     <th className="p-3 border-b border-slate-200">Area</th>
                     <th className="p-3 border-b border-slate-200">Payment</th>
                     <th className="p-3 border-b border-slate-200 text-center">Deliveries Left</th>
                     <th className="p-3 border-b border-slate-200">End Date</th>
                     <th className="p-3 border-b border-slate-200">Branch</th>
                     <th className="p-3 border-b border-slate-200 text-right min-w-[140px]">Actions</th>
                  </tr>
                  {/* Filter Row */}
                  <tr className="bg-slate-50/50">
                     <th className="p-2 border-b border-slate-200"></th>
                     <th className="p-2 border-b border-slate-200">
                        <input className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" placeholder="Filter Name" value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} />
                     </th>
                     <th className="p-2 border-b border-slate-200">
                        <input className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" placeholder="Filter No." value={filters.mobile} onChange={e => setFilters({...filters, mobile: e.target.value})} />
                     </th>
                     <th className="p-2 border-b border-slate-200">
                        <input className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" placeholder="Filter Plan" value={filters.plan} onChange={e => setFilters({...filters, plan: e.target.value})} />
                     </th>
                     <th className="p-2 border-b border-slate-200"></th>
                     <th className="p-2 border-b border-slate-200">
                        <input className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" placeholder="Filter Area" value={filters.area} onChange={e => setFilters({...filters, area: e.target.value})} />
                     </th>
                     <th className="p-2 border-b border-slate-200">
                        <select className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" value={filters.payment} onChange={e => setFilters({...filters, payment: e.target.value})}>
                           <option value="">All</option><option value="Paid">Paid</option><option value="Pending">Pending</option>
                        </select>
                     </th>
                     <th className="p-2 border-b border-slate-200"></th>
                     <th className="p-2 border-b border-slate-200"></th>
                     <th className="p-2 border-b border-slate-200">
                        <select className="w-full p-1 text-xs border border-slate-200 rounded font-normal bg-white text-slate-900" value={filters.branch} onChange={e => setFilters({...filters, branch: e.target.value})}>
                           <option value="">All</option>
                           {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                     </th>
                     <th className="p-2 border-b border-slate-200"></th>
                  </tr>
               </thead>
               <tbody className="text-slate-900 text-sm">
                  {filteredCustomers.map((c, idx) => {
                     const plan = plans.find((p: any) => p.id === c.planId);
                     const branch = branches.find((b: any) => b.id === c.branchId);
                     
                     // Live Calculation of Days Left
                     const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
                     const daysLeft = calculateRemainingDeliveries(c.endDate, weekdays);
                     const isExpired = daysLeft <= 0;

                     return (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                           <td className="p-3 text-slate-500">{idx + 1}</td>
                           <td className="p-3 font-bold">{c.name}</td>
                           <td className="p-3 font-mono text-slate-600">{c.mobile}</td>
                           <td className="p-3">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700 font-medium">
                                 {plan?.name || 'Unknown'}
                              </span>
                           </td>
                           <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                c.mealTime === 'Breakfast' ? 'bg-orange-100 text-orange-700' : 
                                c.mealTime === 'Lunch' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                 {c.mealTime || 'Lunch'}
                              </span>
                           </td>
                           <td className="p-3 text-slate-600">{c.area}</td>
                           <td className="p-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                 {c.paymentStatus}
                              </span>
                           </td>
                           <td className="p-3 text-center">
                              <span className={`font-bold ${isExpired ? 'text-red-600' : daysLeft <= 3 ? 'text-orange-500' : 'text-slate-900'}`}>
                                 {isExpired ? 'Exp' : daysLeft}
                              </span>
                           </td>
                           <td className="p-3 text-slate-500 text-xs">{c.endDate}</td>
                           <td className="p-3 text-slate-600">{branch?.name || '-'}</td>
                           <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                 <button onClick={() => { setActiveCustomer(c); setIsRenewModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Renew">
                                    <RefreshCw size={16} />
                                 </button>
                                 <button onClick={() => { setActiveCustomer(c); setIsAddModalOpen(true); }} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Edit">
                                    <Edit size={16} />
                                 </button>
                                 <button onClick={() => handleDeleteCustomer(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     )
                  })}
                  {filteredCustomers.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-slate-400">No customers found matching filters.</td></tr>}
               </tbody>
            </table>
         </div>
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
         <CustomerModal 
            branches={branches} plans={plans} staff={deliveryBoys}
            initialData={activeCustomer}
            onClose={() => { setIsAddModalOpen(false); setActiveCustomer(null); }} 
            onSubmit={handleAddOrEditCustomer} 
         />
      )}

      {/* Renew Modal */}
      {isRenewModalOpen && activeCustomer && (
         <RenewCustomerModal
            customer={activeCustomer}
            plans={plans.filter((p: any) => p.branchId === activeCustomer.branchId)}
            onClose={() => { setIsRenewModalOpen(false); setActiveCustomer(null); }}
            onSubmit={(data: any) => handleRenewCustomer(activeCustomer.id, data)}
         />
      )}

      {/* Pause Branch Modal */}
      {isPauseBranchModalOpen && (
         <PauseBranchModal 
            branches={branches}
            customers={customers}
            onClose={() => setIsPauseBranchModalOpen(false)}
            onSubmit={handlePauseBranch}
         />
      )}

      {/* Pause Customer Modal */}
      {isPauseCustomerModalOpen && (
         <PauseCustomerModal 
            customers={customers}
            plans={plans}
            branches={branches}
            onClose={() => setIsPauseCustomerModalOpen(false)}
            onSubmit={handlePauseCustomer}
         />
      )}

    </div>
  );
};

// --- SUB COMPONENTS / MODALS ---

const CustomerModal = ({ branches, plans, staff, initialData, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState<any>({
      branchId: branches[0]?.id || '', name: '', mobile: '', address: '', area: '', 
      planId: '', paymentStatus: 'Paid', amountPaid: 0, startDate: new Date().toISOString().split('T')[0], deliveryBoyId: '',
      mealTime: 'Lunch', // Default
      ...initialData
   });
   
   const branchPlans = useMemo(() => plans.filter((p: any) => p.branchId === formData.branchId), [plans, formData.branchId]);
   const branchStaff = useMemo(() => staff.filter((s: any) => s.branchId === formData.branchId), [staff, formData.branchId]);

   // Default plan selection if invalid
   useEffect(() => {
      if (!initialData) {
         const isValidPlan = branchPlans.find((p:any) => p.id === formData.planId);
         if (!isValidPlan && branchPlans.length > 0) {
            setFormData((prev:any) => ({...prev, planId: branchPlans[0].id}));
         }
         
         const isValidStaff = branchStaff.find((s:any) => s.id === formData.deliveryBoyId);
         if (!isValidStaff && branchStaff.length > 0) {
            setFormData((prev:any) => ({...prev, deliveryBoyId: branchStaff[0].id}));
         }
      }
   }, [formData.branchId, branchPlans, branchStaff, initialData, formData.planId, formData.deliveryBoyId]); 

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const selectedPlan = plans.find((p: any) => p.id === formData.planId);
      if(!selectedPlan) return;
      
      // Strict Calculation
      const weekdays = selectedPlan.weekdays || [0,1,2,3,4,5,6];
      const endDate = calculateEndDate(formData.startDate, selectedPlan.numberOfDeliveryDays, weekdays);
      const daysLeft = calculateRemainingDeliveries(endDate, weekdays);
      
      onSubmit({
         ...formData,
         isActive: true, 
         daysLeft,
         endDate,
         planPrice: selectedPlan.price,
         pendingAmount: formData.paymentStatus === 'Pending' ? (selectedPlan.price - Number(formData.amountPaid)) : 0,
         renewalCount: initialData ? initialData.renewalCount : 0,
         routeOrder: initialData ? initialData.routeOrder : 999
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="font-bold text-lg mb-4 text-slate-900">{initialData ? 'Edit Customer' : 'Add Customer'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <select disabled={!!initialData} className="p-2 border border-slate-300 rounded bg-white text-slate-900 disabled:bg-slate-100" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                     {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select className="p-2 border border-slate-300 rounded bg-white text-slate-900" value={formData.planId} onChange={e => setFormData({...formData, planId: e.target.value})}>
                     {branchPlans.map((p:any) => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                  </select>
               </div>
               <input required placeholder="Name" value={formData.name} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, name: e.target.value})} />
               <input required placeholder="Mobile" value={formData.mobile} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, mobile: e.target.value})} />
               <input required placeholder="Address" value={formData.address} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, address: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Area" value={formData.area} className="p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, area: e.target.value})} />
                  <input required type="date" value={formData.startDate} className="p-2 border border-slate-300 rounded bg-white text-slate-900" onChange={e => setFormData({...formData, startDate: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <select className="p-2 border border-slate-300 rounded bg-white text-slate-900" value={formData.deliveryBoyId} onChange={e => setFormData({...formData, deliveryBoyId: e.target.value})}>
                     <option value="">Select Delivery Boy</option>
                     {branchStaff.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="relative">
                     <Clock size={16} className="absolute left-3 top-3 text-slate-400" />
                     <select 
                       className="w-full p-2 pl-9 border border-slate-300 rounded bg-white text-slate-900" 
                       value={formData.mealTime || 'Lunch'} 
                       onChange={e => setFormData({...formData, mealTime: e.target.value})}
                     >
                        <option value="Breakfast">Breakfast</option>
                        <option value="Lunch">Lunch</option>
                        <option value="Dinner">Dinner</option>
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded border border-slate-100">
                  <select className="p-2 border border-slate-300 rounded bg-white text-slate-900" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})}>
                     <option value="Paid">Paid</option><option value="Pending">Pending</option>
                  </select>
                  <input type="number" placeholder="Paid Amount" value={formData.amountPaid} className="p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, amountPaid: Number(e.target.value)})} />
               </div>
               <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded text-slate-700 bg-white hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors">Save</button>
               </div>
            </form>
         </div>
      </div>
   )
}

const RenewCustomerModal = ({ customer, plans, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({
      planId: customer.planId, startDate: new Date().toISOString().split('T')[0], paymentStatus: 'Paid', amountPaid: 0
   });
   
   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const selectedPlan = plans.find((p: any) => p.id === formData.planId);
      if(!selectedPlan) return;
      
      const weekdays = selectedPlan.weekdays || [0,1,2,3,4,5,6];
      const endDate = calculateEndDate(formData.startDate, selectedPlan.numberOfDeliveryDays, weekdays);
      
      onSubmit({ ...formData, planPrice: selectedPlan.price, endDate });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-md rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 text-slate-900">Renew {customer.name}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <select className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900" value={formData.planId} onChange={e => setFormData({...formData, planId: e.target.value})}>
                  {plans.map((p:any) => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
               </select>
               <input required type="date" value={formData.startDate} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900" onChange={e => setFormData({...formData, startDate: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <select className="p-2 border border-slate-300 rounded bg-white text-slate-900" onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})}><option value="Paid">Paid</option><option value="Pending">Pending</option></select>
                  <input type="number" placeholder="Paid" className="p-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, amountPaid: Number(e.target.value)})} />
               </div>
               <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">Confirm Renewal</button>
               <button type="button" onClick={onClose} className="w-full text-slate-500 py-1 text-sm hover:text-slate-700">Cancel</button>
            </form>
         </div>
      </div>
   )
}

const PauseBranchModal = ({ branches, customers, onClose, onSubmit }: any) => {
   const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '');
   const [pauseStart, setPauseStart] = useState('');
   const [pauseEnd, setPauseEnd] = useState('');

   // Calculate stats
   const affectedCustomers = useMemo(() => {
      return customers.filter((c:any) => c.branchId === selectedBranch && c.isActive && c.daysLeft > 0).length;
   }, [customers, selectedBranch]);

   const pauseDuration = useMemo(() => {
      if(!pauseStart || !pauseEnd) return 0;
      return getDaysDifference(pauseStart, pauseEnd) + 1; // inclusive
   }, [pauseStart, pauseEnd]);

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 text-slate-900 flex items-center gap-2">
               <Store className="text-slate-600"/> Pause Branch (Holiday)
            </h3>
            <p className="text-sm text-slate-500 mb-4">Extend all active subscriptions in a branch by the number of delivery days missed.</p>
            <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Branch</label>
                  <select className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                     {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Pause From</label>
                     <input type="date" value={pauseStart} onChange={e => setPauseStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Pause To</label>
                     <input type="date" value={pauseEnd} onChange={e => setPauseEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" />
                  </div>
               </div>

               {pauseDuration > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center text-sm">
                     <span className="text-slate-500">Duration: <b>{pauseDuration} Days</b></span>
                     <span className="text-slate-500">Affected: <b className="text-orange-600">{affectedCustomers}</b></span>
                  </div>
               )}

               <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 py-2 border rounded text-slate-600">Cancel</button>
                  <button 
                     disabled={!pauseStart || !pauseEnd || new Date(pauseStart) > new Date(pauseEnd)}
                     onClick={() => onSubmit(selectedBranch, pauseStart, pauseEnd)} 
                     className="flex-1 py-2 bg-slate-800 text-white rounded font-bold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     Confirm Pause
                  </button>
               </div>
            </div>
         </div>
      </div>
   )
}

const PauseCustomerModal = ({ customers, plans, branches, onClose, onSubmit }: any) => {
   const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
   const [selectedId, setSelectedId] = useState('');
   const [pauseStart, setPauseStart] = useState('');
   const [pauseEnd, setPauseEnd] = useState('');

   // Filter customers by selected branch first
   const filtered = useMemo(() => {
      return customers.filter((c:any) => c.branchId === selectedBranchId && c.isActive && c.daysLeft > 0);
   }, [customers, selectedBranchId]);

   const customer = customers.find((c:any) => c.id === selectedId);
   const plan = customer ? plans.find((p:any) => p.id === customer.planId) : null;

   // Auto-calculate stats
   const stats = useMemo(() => {
      if(!customer || !plan || !pauseStart || !pauseEnd) return null;
      
      const weekdays = plan.weekdays || [0,1,2,3,4,5,6];
      const missedDeliveries = countDeliveryDays(pauseStart, pauseEnd, weekdays);
      const newEndDate = calculateEndDate(customer.endDate, missedDeliveries, weekdays);
      const duration = getDaysDifference(pauseStart, pauseEnd) + 1;

      return { missedDeliveries, newEndDate, duration };
   }, [customer, plan, pauseStart, pauseEnd]);

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 text-slate-900 flex items-center gap-2">
               <PauseCircle className="text-orange-500"/> Pause Customer
            </h3>
            
            <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">1. Select Branch</label>
                  <select 
                     className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" 
                     value={selectedBranchId} 
                     onChange={e => { setSelectedBranchId(e.target.value); setSelectedId(''); }}
                  >
                     {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">2. Select Customer</label>
                  <select 
                     className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1"
                     value={selectedId}
                     onChange={e => setSelectedId(e.target.value)}
                  >
                     <option value="">-- Choose Customer --</option>
                     {filtered.map((c:any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.daysLeft} left)</option>
                     ))}
                  </select>
                  {filtered.length === 0 && <div className="text-xs text-slate-400 mt-1">No active customers in this branch.</div>}
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Pause From</label>
                     <input type="date" value={pauseStart} onChange={e => setPauseStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Pause To</label>
                     <input type="date" value={pauseEnd} onChange={e => setPauseEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 mt-1" />
                  </div>
               </div>

               {stats && (
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 space-y-2">
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Total Pause Duration:</span>
                        <span className="font-bold text-slate-900">{stats.duration} Days</span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Missed Deliveries:</span>
                        <span className="font-bold text-slate-900">{stats.missedDeliveries}</span>
                     </div>
                     <div className="pt-2 border-t border-orange-200 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-orange-700">New End Date</span>
                        <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded flex items-center gap-1">
                           {stats.newEndDate} <ArrowRight size={12}/>
                        </span>
                     </div>
                  </div>
               )}

               <div className="flex gap-2 pt-2">
                  <button onClick={onClose} className="flex-1 py-2 border rounded text-slate-600">Cancel</button>
                  <button 
                     disabled={!selectedId || !stats} 
                     onClick={() => onSubmit(selectedId, pauseStart, pauseEnd)} 
                     className="flex-1 py-2 bg-orange-500 text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"
                  >
                     Confirm Pause
                  </button>
               </div>
            </div>
         </div>
      </div>
   )
}

export default Customers;
