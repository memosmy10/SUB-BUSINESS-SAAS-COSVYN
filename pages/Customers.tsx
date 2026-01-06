import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserCheck, RefreshCw, Plus, PauseCircle, Store,
  Search, Filter, Calendar, MapPin, X, AlertCircle, Loader2, Edit, Trash2, Pause, Clock, ArrowRight, CheckCircle, Calculator, Phone, Building, Truck, ChevronDown, ChevronRight, MessageSquare, Share2
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
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

const Customers = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Real Data
  const { data: customers, loading: l1 } = useStreamCollection<GlobalCustomer>('customers');
  const { data: branches, loading: l2 } = useStreamCollection<any>('branches');
  const { data: plans, loading: l3 } = useStreamCollection<any>('plans');
  const { data: deliveryBoys, loading: l4 } = useStreamCollection<any>('staff');

  const isLoading = l1 || l2 || l3 || l4;

  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

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
  const handleAddOrEditCustomer = async (data: any) => {
    if (!currentUser) return;
    
    if (activeCustomer) {
       const oldPaid = activeCustomer.amountPaid || 0;
       const newPaid = Number(data.amountPaid);
       const difference = newPaid - oldPaid;
       await updateItem(currentUser.uid, 'customers', activeCustomer.id, data);
       if (difference > 0) {
          await addItem(currentUser.uid, 'payments', {
             amount: difference,
             customerId: activeCustomer.id,
             customerName: data.name,
             date: new Date().toISOString(),
             type: 'Income',
             note: 'Balance Collection'
          });
       }
       setActiveCustomer(null);
    } else {
       const newId = await addItem(currentUser.uid, 'customers', data);
       if (data.amountPaid > 0) {
         const revenueDate = new Date(data.startDate + 'T12:00:00').toISOString();
         await addItem(currentUser.uid, 'payments', {
            amount: data.amountPaid,
            customerId: newId,
            customerName: data.name,
            date: revenueDate,
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
      deliveryCharges: data.deliveryCharges || 0,
      amountPaid: data.amountPaid,
      paymentStatus: data.paymentStatus,
      pendingAmount: data.pendingAmount,
      deliveryBoyId: data.deliveryBoyId,
      renewalCount: (cust.renewalCount || 0) + 1
    });

    if (data.amountPaid > 0) {
      const revenueDate = new Date(data.startDate + 'T12:00:00').toISOString();
      await addItem(currentUser.uid, 'payments', {
         amount: data.amountPaid,
         customerId: customerId,
         customerName: cust.name,
         date: revenueDate,
         type: 'Income',
         note: 'Subscription Renewal'
      });
    }
    setIsRenewModalOpen(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (currentUser && window.confirm('Delete customer? This action will also delete all revenue records associated with this customer. This cannot be undone.')) {
      try {
        const batch = writeBatch(db);
        const customerRef = doc(db, 'businesses', currentUser.uid, 'customers', id);
        batch.delete(customerRef);
        const paymentsRef = collection(db, 'businesses', currentUser.uid, 'payments');
        const q = query(paymentsRef, where('customerId', '==', id));
        const paymentSnap = await getDocs(q);
        paymentSnap.forEach((pDoc) => batch.delete(pDoc.ref));
        await batch.commit();
      } catch (error) {
        console.error("Error deleting customer and payments:", error);
        alert("Failed to delete customer completely.");
      }
    }
  };

  const handlePauseBranch = async (branchId: string, pauseStart: string, pauseEnd: string) => {
     if (!currentUser) return;
     const branchCustomers = customers.filter(c => c.branchId === branchId && c.isActive);
     let updatedCount = 0;
     for (const c of branchCustomers) {
        const plan = plans.find((p:any) => p.id === c.planId);
        const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
        const missedDeliveries = countDeliveryDays(pauseStart, pauseEnd, weekdays);
        if (missedDeliveries > 0) {
           const newEndDate = calculateEndDate(c.endDate, missedDeliveries, weekdays);
           await updateItem(currentUser.uid, 'customers', c.id, { endDate: newEndDate });
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
     const missedDeliveries = countDeliveryDays(pauseStart, pauseEnd, weekdays);
     if (missedDeliveries > 0) {
        const newEndDate = calculateEndDate(c.endDate, missedDeliveries, weekdays);
        await updateItem(currentUser.uid, 'customers', c.id, { endDate: newEndDate });
     }
     setIsPauseCustomerModalOpen(false);
     setActiveCustomer(null);
  };

  const filteredCustomers = useMemo(() => {
     return customers.filter(c => {
        const planName = plans.find((p:any) => p.id === c.planId)?.name || '';
        return (
           c.name.toLowerCase().includes(filters.name.toLowerCase()) &&
           c.mobile.includes(filters.mobile) &&
           c.area.toLowerCase().includes(filters.area.toLowerCase()) &&
           (filters.payment === '' || c.paymentStatus === filters.payment) &&
           (filters.branch === '' || c.branchId === filters.branch) &&
           planName.toLowerCase().includes(filters.plan.toLowerCase())
        );
     }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [customers, filters, branches, plans]);

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

  const toggleRow = (id: string) => {
    if (expandedCustomerId === id) {
      setExpandedCustomerId(null);
    } else {
      setExpandedCustomerId(id);
      const cust = customers.find(c => c.id === id);
      if (cust) {
        const date = new Date(cust.startDate);
        setSelectedMonthKey(`${date.getFullYear()}-${date.getMonth()}`);
      }
    }
  };

  const shareStatusWhatsApp = (cust: GlobalCustomer, summary: any) => {
    const monthName = new Date(parseInt(selectedMonthKey?.split('-')[0] || '2025'), parseInt(selectedMonthKey?.split('-')[1] || '0')).toLocaleString('default', { month: 'long', year: 'numeric' });
    const msg = `Hello ${cust.name}, here is your delivery status for ${monthName}:\n\n✅ Total Delivered: ${summary.delivered}\n⏸️ User Paused: ${summary.userPaused}\n🛑 Branch Paused: ${summary.branchPaused}\n☀️ Sundays: ${summary.sundays}\n⚪ Days with No Active Plan: ${summary.noPlan}\n\nThank you for choosing our service!`;
    window.open(`https://wa.me/${cust.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-20">
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
        <button onClick={() => { if (isProfileComplete) { setActiveCustomer(null); setIsAddModalOpen(true); } else { alert('Complete profile first'); } }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors">
           <Plus size={24} className="mb-1"/> <span className="font-bold text-sm">Add Customer</span>
        </button>
        <button onClick={() => setIsPauseCustomerModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors">
           <Pause size={24} className="mb-1"/> <span className="font-bold text-sm">Pause Customer</span>
        </button>
        <button onClick={() => setIsPauseBranchModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow flex flex-col items-center justify-center p-4 transition-colors">
           <Store size={24} className="mb-1"/> <span className="font-bold text-sm">Pause Branch</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
               <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                     <th className="p-3 border-b border-slate-200 w-12"></th>
                     <th className="p-3 border-b border-slate-200 w-12">S.No</th>
                     <th className="p-3 border-b border-slate-200 min-w-[150px]">Name</th>
                     <th className="p-3 border-b border-slate-200">Number</th>
                     <th className="p-3 border-b border-slate-200">Plan</th>
                     <th className="p-3 border-b border-slate-200">Time</th>
                     <th className="p-3 border-b border-slate-200">Area</th>
                     <th className="p-3 border-b border-slate-200">Payment</th>
                     <th className="p-3 border-b border-slate-200 text-center">Deliveries Left</th>
                     <th className="p-3 border-b border-slate-200">Start Date</th>
                     <th className="p-3 border-b border-slate-200">End Date</th>
                     <th className="p-3 border-b border-slate-200">Branch</th>
                     <th className="p-3 border-b border-slate-200 text-right min-w-[140px]">Actions</th>
                  </tr>
                  <tr className="bg-slate-50/50">
                     <th className="p-2 border-b border-slate-200"></th>
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
                     const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
                     const daysLeft = calculateRemainingDeliveries(c.endDate, weekdays);
                     const isExpired = daysLeft <= 0;
                     const isExpanded = expandedCustomerId === c.id;

                     return (
                        <React.Fragment key={c.id}>
                           <tr onClick={() => toggleRow(c.id)} className={`border-b border-slate-100 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                              <td className="p-3 text-center text-slate-400">
                                 {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </td>
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
                              <td className="p-3 text-slate-500 text-xs">{c.startDate}</td>
                              <td className="p-3 text-slate-500 text-xs">{c.endDate}</td>
                              <td className="p-3 text-slate-600">{branch?.name || '-'}</td>
                              <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
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
                           {isExpanded && (
                              <tr className="bg-white border-b border-slate-100">
                                 <td colSpan={13} className="p-0">
                                    <div className="p-6 bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                          {/* Timeline Column */}
                                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                                <Calendar size={14}/> Subscription Timeline
                                             </h4>
                                             <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                                {generateTimeline(c).map((t: any) => (
                                                   <div 
                                                      key={t.key} 
                                                      onClick={() => setSelectedMonthKey(t.key)}
                                                      className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${
                                                         selectedMonthKey === t.key 
                                                            ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                                            : 'border-slate-100 hover:border-slate-200'
                                                      }`}
                                                   >
                                                      <div>
                                                         <div className="font-bold text-slate-900 text-sm">{t.monthName}</div>
                                                         <div className="text-[10px] text-slate-500">{t.year}</div>
                                                      </div>
                                                      <div className={`w-3 h-3 rounded-full shadow-sm ${t.status === 'renewed' ? 'bg-green-500' : t.status === 'active' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                                   </div>
                                                ))}
                                             </div>
                                          </div>

                                          {/* Days Status Grid Column */}
                                          <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                             <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                   <Truck size={14}/> Daily Status Tracker
                                                </h4>
                                                <div className="flex gap-2">
                                                   <button onClick={() => shareStatusWhatsApp(c, getMonthSummary(c, selectedMonthKey, plans))} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
                                                      <Share2 size={12}/> Share Status
                                                   </button>
                                                </div>
                                             </div>
                                             
                                             <div className="grid grid-cols-7 gap-2 mb-6">
                                                {['S','M','T','W','T','F','S'].map((day, i) => (
                                                   <div key={i} className="text-center text-[10px] font-black text-slate-300 uppercase">{day}</div>
                                                ))}
                                                {generateMonthDays(selectedMonthKey).map((d: any, i: number) => {
                                                   const status = getDayStatus(c, d.date, plans);
                                                   return (
                                                      <div key={i} className="flex flex-col items-center">
                                                         <div 
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shadow-sm transition-all border ${
                                                               status === 'sunday' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                               status === 'delivered' ? 'bg-green-500 text-white border-green-600' :
                                                               status === 'user-paused' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                               status === 'branch-paused' ? 'bg-red-100 text-red-700 border-red-200' :
                                                               status === 'no-plan' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                                               'bg-white text-slate-300 border-slate-100'
                                                            }`}
                                                            title={d.date?.toDateString()}
                                                         >
                                                            {d.day}
                                                         </div>
                                                      </div>
                                                   );
                                                })}
                                             </div>

                                             {/* Legend */}
                                             <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 border-t border-slate-100">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><div className="w-3 h-3 rounded bg-green-500" /> Delivered</div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><div className="w-3 h-3 rounded bg-orange-100 border border-orange-200" /> Sunday</div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> Paused</div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><div className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Holiday</div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><div className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> No Plan</div>
                                             </div>
                                          </div>

                                          {/* Summary Metrics Column */}
                                          <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg border border-slate-800 flex flex-col justify-between">
                                             <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Monthly Summary</h4>
                                             {(() => {
                                                const summary = getMonthSummary(c, selectedMonthKey, plans);
                                                return (
                                                   <div className="space-y-4">
                                                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                         <span className="text-xs text-slate-400 font-bold uppercase">Delivered</span>
                                                         <span className="text-xl font-black text-green-400">{summary.delivered}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                         <span className="text-xs text-slate-400 font-bold uppercase">Sundays</span>
                                                         <span className="text-xl font-black text-orange-400">{summary.sundays}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                         <span className="text-xs text-slate-400 font-bold uppercase">User Paused</span>
                                                         <span className="text-xl font-black text-blue-400">{summary.userPaused}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                         <span className="text-xs text-slate-400 font-bold uppercase">Branch Paused</span>
                                                         <span className="text-xl font-black text-red-400">{summary.branchPaused}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center">
                                                         <span className="text-xs text-slate-400 font-bold uppercase">Total Active Months</span>
                                                         <span className="text-xl font-black text-white">{generateTimeline(c).filter(t => t.status !== 'expired').length}</span>
                                                      </div>
                                                   </div>
                                                );
                                             })()}
                                          </div>
                                       </div>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </React.Fragment>
                     )
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* Modals are kept the same */}
      {isAddModalOpen && ( <CustomerModal branches={branches} plans={plans} staff={deliveryBoys} initialData={activeCustomer} onClose={() => { setIsAddModalOpen(false); setActiveCustomer(null); }} onSubmit={handleAddOrEditCustomer} /> )}
      {isRenewModalOpen && activeCustomer && ( <RenewCustomerModal customer={activeCustomer} plans={plans.filter((p: any) => p.branchId === activeCustomer.branchId)} staff={deliveryBoys.filter((s: any) => s.branchId === activeCustomer.branchId)} branchName={branches.find((b: any) => b.id === activeCustomer.branchId)?.name || ''} onClose={() => { setIsRenewModalOpen(false); setActiveCustomer(null); }} onSubmit={(data: any) => handleRenewCustomer(activeCustomer.id, data)} /> )}
      {isPauseBranchModalOpen && ( <PauseBranchModal branches={branches} customers={customers} onClose={() => setIsPauseBranchModalOpen(false)} onSubmit={handlePauseBranch} /> )}
      {isPauseCustomerModalOpen && ( <PauseCustomerModal customers={customers} plans={plans} branches={branches} onClose={() => setIsPauseCustomerModalOpen(false)} onSubmit={handlePauseCustomer} /> )}
    </div>
  );
};

// --- HELPER LOGIC FOR EXPANDED VIEW ---

const generateTimeline = (cust: GlobalCustomer) => {
   const start = new Date(cust.startDate);
   const end = new Date(cust.endDate);
   const now = new Date();
   const months = [];
   
   let current = new Date(start.getFullYear(), start.getMonth(), 1);
   const limit = new Date(Math.max(end.getTime(), now.getTime()));

   while (current <= limit) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      const status = current <= end ? (cust.renewalCount > 0 && current.getTime() > start.getTime() ? 'renewed' : 'active') : 'expired';
      months.unshift({
         key,
         monthName: current.toLocaleString('default', { month: 'short' }),
         year: current.getFullYear(),
         status
      });
      current.setMonth(current.getMonth() + 1);
   }
   return months;
};

const generateMonthDays = (monthKey: string | null) => {
   if (!monthKey) return [];
   const [year, month] = monthKey.split('-').map(Number);
   const daysInMonth = new Date(year, month + 1, 0).getDate();
   const days = [];
   
   // Padding for calendar view
   const firstDay = new Date(year, month, 1).getDay();
   for (let i = 0; i < firstDay; i++) days.push({ empty: true });

   for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, date: new Date(year, month, i) });
   }
   return days;
};

// Fix: Explicitly type return value to include all possible statuses used in the app, 
// avoiding narrowing errors in getMonthSummary and render logic.
const getDayStatus = (cust: GlobalCustomer, date: Date, plans: any[]): 'empty' | 'no-plan' | 'sunday' | 'delivered' | 'user-paused' | 'branch-paused' => {
   if (!date) return 'empty';
   const d = new Date(date);
   d.setHours(0,0,0,0);
   const start = new Date(cust.startDate);
   start.setHours(0,0,0,0);
   const end = new Date(cust.endDate);
   end.setHours(0,0,0,0);

   if (d < start || d > end) return 'no-plan';
   if (d.getDay() === 0) return 'sunday';

   const plan = plans.find(p => p.id === cust.planId);
   const weekdays = plan?.weekdays || [0,1,2,3,4,5,6];
   
   if (!weekdays.includes(d.getDay())) return 'no-plan';

   // In real app, we'd check a logs collection for specific pauses.
   // For now, if active and within range, it's delivered.
   return 'delivered';
};

const getMonthSummary = (cust: GlobalCustomer, monthKey: string | null, plans: any[]) => {
   if (!monthKey) return { delivered: 0, sundays: 0, userPaused: 0, branchPaused: 0, noPlan: 0 };
   const [year, month] = monthKey.split('-').map(Number);
   const daysInMonth = new Date(year, month + 1, 0).getDate();
   
   const summary = { delivered: 0, sundays: 0, userPaused: 0, branchPaused: 0, noPlan: 0 };
   for (let i = 1; i <= daysInMonth; i++) {
      const status = getDayStatus(cust, new Date(year, month, i), plans);
      if (status === 'delivered') summary.delivered++;
      else if (status === 'sunday') summary.sundays++;
      else if (status === 'user-paused') summary.userPaused++;
      else if (status === 'branch-paused') summary.branchPaused++;
      else if (status === 'no-plan') summary.noPlan++;
   }
   return summary;
};

// --- SUB COMPONENTS (Kept original for brevity) ---
// Note: Keeping Original Modal definitions from provided source file to ensure full functionality.
const CustomerModal = ({ branches, plans, staff, initialData, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState<any>({
      branchId: branches[0]?.id || '', 
      name: '', mobile: '', address: '', area: '', 
      planId: '', 
      paymentStatus: 'Paid', 
      amountPaid: 0, 
      pendingAmount: 0,
      planPrice: 0,
      deliveryCharges: 0,
      startDate: new Date().toISOString().split('T')[0], 
      deliveryBoyId: '',
      mealTime: 'Lunch', 
      ...initialData
   });
   
   const branchPlans = useMemo(() => plans.filter((p: any) => p.branchId === formData.branchId), [plans, formData.branchId]);
   const branchStaff = useMemo(() => staff.filter((s: any) => s.branchId === formData.branchId), [staff, formData.branchId]);

   useEffect(() => {
      if (!initialData) {
         const isValidPlan = branchPlans.find((p:any) => p.id === formData.planId);
         if (!isValidPlan && branchPlans.length > 0) {
            const firstPlan = branchPlans[0];
            setFormData((prev:any) => ({
                ...prev, 
                planId: firstPlan.id,
                planPrice: firstPlan.price,
                amountPaid: firstPlan.price + (prev.deliveryCharges || 0),
                pendingAmount: 0,
                paymentStatus: 'Paid'
            }));
         }
         const isValidStaff = branchStaff.find((s:any) => s.id === formData.deliveryBoyId);
         if (!isValidStaff && branchStaff.length > 0) {
            setFormData((prev:any) => ({...prev, deliveryBoyId: branchStaff[0].id}));
         }
      }
   }, [formData.branchId, branchPlans, branchStaff, initialData]); 

   const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPlanId = e.target.value;
      const selectedPlan = plans.find((p:any) => p.id === newPlanId);
      if (selectedPlan) {
         const totalContract = selectedPlan.price + (formData.deliveryCharges || 0);
         setFormData({ ...formData, planId: newPlanId, planPrice: selectedPlan.price, amountPaid: totalContract, pendingAmount: 0, paymentStatus: 'Paid' });
      }
   };

   const handleDeliveryChargesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const charges = Number(e.target.value) || 0;
      const totalContract = formData.planPrice + charges;
      const newPending = Math.max(0, totalContract - formData.amountPaid);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, deliveryCharges: charges, pendingAmount: newPending, paymentStatus: newStatus });
   };

   const handlePaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPaid = Number(e.target.value);
      const totalContract = formData.planPrice + (formData.deliveryCharges || 0);
      const newPending = Math.max(0, totalContract - newPaid);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, amountPaid: newPaid, pendingAmount: newPending, paymentStatus: newStatus });
   };

   const handlePendingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPending = Number(e.target.value);
      const totalContract = formData.planPrice + (formData.deliveryCharges || 0);
      const newPaid = Math.max(0, totalContract - newPending);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, amountPaid: newPaid, pendingAmount: newPending, paymentStatus: newStatus });
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const selectedPlan = plans.find((p: any) => p.id === formData.planId);
      if(!selectedPlan) return;
      const weekdays = selectedPlan.weekdays || [0,1,2,3,4,5,6];
      const endDate = calculateEndDate(formData.startDate, selectedPlan.numberOfDeliveryDays, weekdays);
      const daysLeft = calculateRemainingDeliveries(endDate, weekdays);
      onSubmit({ ...formData, isActive: true, daysLeft, endDate, planPrice: formData.planPrice, deliveryCharges: Number(formData.deliveryCharges), amountPaid: Number(formData.amountPaid), pendingAmount: Number(formData.pendingAmount), paymentStatus: formData.paymentStatus, renewalCount: initialData ? initialData.renewalCount : 0, routeOrder: initialData ? initialData.routeOrder : 999 });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
         <div className="bg-white w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh] shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-slate-900 border-b pb-2">{initialData ? 'Edit Customer' : 'Add New Customer'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Branch</label>
                     <select disabled={!!initialData} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-100 outline-none focus:ring-2 focus:ring-blue-500" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                        {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select Plan</label>
                     <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" value={formData.planId} onChange={handlePlanChange}>
                        {branchPlans.map((p:any) => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Full Name" value={formData.name} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input required placeholder="Mobile Number" value={formData.mobile} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, mobile: e.target.value})} />
               </div>
               <input required placeholder="Full Address" value={formData.address} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, address: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Area / Locality" value={formData.area} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" onChange={e => setFormData({...formData, area: e.target.value})} />
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Start Date</label>
                     <input required type="date" value={formData.startDate} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Delivery Boy</label>
                     <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.deliveryBoyId} onChange={e => setFormData({...formData, deliveryBoyId: e.target.value})}>
                        <option value="">Select Staff</option>
                        {branchStaff.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Meal Time</label>
                     <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.mealTime || 'Lunch'} onChange={e => setFormData({...formData, mealTime: e.target.value})}>
                        <option value="Breakfast">Breakfast</option><option value="Lunch">Lunch</option><option value="Dinner">Dinner</option>
                     </select>
                  </div>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Calculator size={14}/> Payment Details</span>
                     <span className={`text-xs font-bold px-2 py-1 rounded ${formData.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Status: {formData.paymentStatus}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-xs font-bold text-slate-500 block mb-1">Amount Paid (₹)</label><input type="number" min="0" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-bold text-green-600" value={formData.amountPaid} onChange={handlePaidChange}/></div>
                     <div><label className="text-xs font-bold text-slate-500 block mb-1">Pending Amount (₹)</label><input type="number" min="0" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-bold text-red-600" value={formData.pendingAmount} onChange={handlePendingChange}/></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><Truck size={14}/> Delivery Charges</label>
                     <input type="number" min="0" placeholder="Enter extra delivery fee" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium" value={formData.deliveryCharges} onChange={handleDeliveryChargesChange}/>
                  </div>
                  <div className="mt-2 text-right text-xs text-slate-400">Total Value: <b>₹{formData.planPrice + (formData.deliveryCharges || 0)}</b></div>
               </div>
               <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 bg-white hover:bg-slate-50 font-bold">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg">Save Customer</button>
               </div>
            </form>
         </div>
      </div>
   )
}

const RenewCustomerModal = ({ customer, plans, staff, branchName, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({ planId: customer.planId, startDate: new Date().toISOString().split('T')[0], paymentStatus: 'Paid', amountPaid: 0, pendingAmount: 0, planPrice: 0, deliveryCharges: customer.deliveryCharges || 0, deliveryBoyId: customer.deliveryBoyId || '' });
   useEffect(() => {
      const plan = plans.find((p:any) => p.id === customer.planId);
      if(plan) {
         const totalContract = plan.price + (formData.deliveryCharges || 0);
         setFormData(prev => ({ ...prev, planPrice: plan.price, amountPaid: totalContract, pendingAmount: 0, paymentStatus: 'Paid' }));
      }
   }, [customer.planId, plans]);
   const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPlanId = e.target.value;
      const selectedPlan = plans.find((p:any) => p.id === newPlanId);
      if (selectedPlan) {
         const totalContract = selectedPlan.price + (formData.deliveryCharges || 0);
         setFormData({ ...formData, planId: newPlanId, planPrice: selectedPlan.price, amountPaid: totalContract, pendingAmount: 0, paymentStatus: 'Paid' });
      }
   };
   const handleDeliveryChargesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const charges = Number(e.target.value) || 0;
      const totalContract = formData.planPrice + charges;
      const newPending = Math.max(0, totalContract - formData.amountPaid);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, deliveryCharges: charges, pendingAmount: newPending, paymentStatus: newStatus });
   };
   const handlePaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPaid = Number(e.target.value);
      const totalContract = formData.planPrice + (formData.deliveryCharges || 0);
      const newPending = Math.max(0, totalContract - newPaid);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, amountPaid: newPaid, pendingAmount: newPending, paymentStatus: newStatus });
   };
   const handlePendingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPending = Number(e.target.value);
      const totalContract = formData.planPrice + (formData.deliveryCharges || 0);
      const newPaid = Math.max(0, totalContract - newPending);
      const newStatus = newPending > 0 ? 'Pending' : 'Paid';
      setFormData({ ...formData, amountPaid: newPaid, pendingAmount: newPending, paymentStatus: newStatus });
   };
   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const selectedPlan = plans.find((p: any) => p.id === formData.planId);
      if(!selectedPlan) return;
      const weekdays = selectedPlan.weekdays || [0,1,2,3,4,5,6];
      const endDate = calculateEndDate(formData.startDate, selectedPlan.numberOfDeliveryDays, weekdays);
      onSubmit({ ...formData, endDate });
   };
   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="mb-6 border-b border-slate-100 pb-4">
               <h3 className="font-bold text-lg text-slate-900 mb-1">Renew Subscription</h3>
               <div className="flex flex-col gap-1 text-sm text-slate-500">
                  <span className="font-bold text-slate-700 text-base">{customer.name}</span>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-1"><Phone size={14}/> {customer.mobile}</span><span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs font-bold"><Building size={12}/> {branchName}</span></div>
               </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select New Plan</label><select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 outline-none" value={formData.planId} onChange={handlePlanChange}>{plans.map((p:any) => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}</select></div>
               <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Start Date</label><input required type="date" value={formData.startDate} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
               <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Delivery Boy</label><select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.deliveryBoyId} onChange={e => setFormData({...formData, deliveryBoyId: e.target.value})}><option value="">-- Assign Delivery Boy --</option>{staff.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Calculator size={14}/> Payment</span><span className={`text-xs font-bold px-2 py-1 rounded ${formData.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{formData.paymentStatus}</span></div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                     <div><label className="text-xs font-bold text-slate-500 block mb-1">Paid (₹)</label><input type="number" min="0" className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 font-bold text-green-600" value={formData.amountPaid} onChange={handlePaidChange}/></div>
                     <div><label className="text-xs font-bold text-slate-500 block mb-1">Pending (₹)</label><input type="number" min="0" className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 font-bold text-red-600" value={formData.pendingAmount} onChange={handlePendingChange}/></div>
                  </div>
                  <div className="border-t border-slate-200 pt-3"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><Truck size={14}/> Delivery Charges</label><input type="number" min="0" className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900" value={formData.deliveryCharges} onChange={handleDeliveryChargesChange}/></div>
                  <div className="mt-2 text-right text-xs text-slate-400">Renewal Total: <b>₹{formData.planPrice + (formData.deliveryCharges || 0)}</b></div>
               </div>
               <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-bold">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold">Confirm Renewal</button>
               </div>
            </form>
         </div>
      </div>
   )
}

const PauseBranchModal = ({ branches, customers, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({ branchId: branches[0]?.id || '', pauseStart: '', pauseEnd: '' });
   const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!formData.branchId || !formData.pauseStart || !formData.pauseEnd) return; onSubmit(formData.branchId, formData.pauseStart, formData.pauseEnd); };
   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-slate-900">Pause Branch Operations</h3>
            <p className="text-sm text-slate-500 mb-4">This will automatically extend the subscription end dates for all active customers in this branch by the number of delivery days missed.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select Branch</label><select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>{branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pause From</label><input required type="date" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, pauseStart: e.target.value})} /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Resume On</label><input required type="date" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, pauseEnd: e.target.value})} /></div>
               </div>
               <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-bold">Cancel</button><button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-bold">Confirm Pause</button></div>
            </form>
         </div>
      </div>
   );
};

const PauseCustomerModal = ({ customers, plans, branches, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({ customerId: '', pauseStart: '', pauseEnd: '' });
   const activeCustomers = useMemo(() => customers.filter((c:any) => c.isActive), [customers]);
   const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!formData.customerId) return; onSubmit(formData.customerId, formData.pauseStart, formData.pauseEnd); };
   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-slate-900">Pause Subscription</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select Customer</label><select required className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}><option value="">-- Choose Customer --</option>{activeCustomers.map((c:any) => ( <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option> ))}</select></div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pause From</label><input required type="date" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, pauseStart: e.target.value})} /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Resume On</label><input required type="date" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, pauseEnd: e.target.value})} /></div>
               </div>
               <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-bold">Cancel</button><button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-bold">Confirm Pause</button></div>
            </form>
         </div>
      </div>
   );
};

export default Customers;