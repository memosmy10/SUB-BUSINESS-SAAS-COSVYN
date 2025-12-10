
import React, { useState, useMemo } from 'react';
import { Search, Download, Loader2, UserCheck, UserX, Clock, MapPin, Calendar } from 'lucide-react';
import { useAdminTenants } from '../../services/dbService';
import { getDaysDifference } from '../../services/store';

const AdminUsers = () => {
  const { tenants, loading } = useAdminTenants();
  const [activeTab, setActiveTab] = useState<'owners' | 'signups'>('owners');
  
  // Filters for each column
  const [filters, setFilters] = useState({
     business: '',
     owner: '', // searches name or email
     number: '',
     plan: '',
     status: '',
     city: '',
     state: ''
  });

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  // 1. Separate Owners (Paid/Active/Expired History) vs Signups (Never paid/Inactive plan)
  const filteredByTab = tenants.filter(t => {
     const isInactiveSignup = t.planStatus === 'Inactive' || t.planName === 'None' || !t.planStatus;
     
     if (activeTab === 'owners') {
        // Show if they have a plan or had one (not 'Inactive' without plan)
        // Usually, a signup starts as Inactive. 
        return !isInactiveSignup;
     } else {
        return isInactiveSignup;
     }
  });

  // 2. Apply Column Filters
  const displayedTenants = filteredByTab.filter(t => {
     return (
        (t.businessName || '').toLowerCase().includes(filters.business.toLowerCase()) &&
        ((t.ownerName || '').toLowerCase().includes(filters.owner.toLowerCase()) || (t.email || '').toLowerCase().includes(filters.owner.toLowerCase())) &&
        (t.mobile || '').includes(filters.number) &&
        (t.planName || '').toLowerCase().includes(filters.plan.toLowerCase()) &&
        (t.planStatus || '').toLowerCase().includes(filters.status.toLowerCase()) &&
        (t.city || '').toLowerCase().includes(filters.city.toLowerCase()) &&
        (t.state || '').toLowerCase().includes(filters.state.toLowerCase())
     );
  });

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
               {activeTab === 'owners' ? 'Paid Business Owners' : 'New Signups (No Plan)'}
            </h1>
            <p className="text-slate-400 text-sm">
               {activeTab === 'owners' 
                 ? 'Manage businesses with active or past subscriptions.' 
                 : 'Users who created an account but haven\'t purchased a plan yet.'}
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors">
             <Download size={16} /> Export CSV
          </button>
       </div>

       {/* TABS */}
       <div className="flex space-x-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-full sm:w-fit">
          <button 
             onClick={() => setActiveTab('owners')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none justify-center ${
                activeTab === 'owners' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
             }`}
          >
             <UserCheck size={16} /> Business Owners
          </button>
          <button 
             onClick={() => setActiveTab('signups')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none justify-center ${
                activeTab === 'signups' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
             }`}
          >
             <UserX size={16} /> Signups (Unpaid)
          </button>
       </div>

       {/* TABLE CONTAINER */}
       <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider">
                   {/* HEADER ROW */}
                   <tr>
                      <th className="p-4 border-b border-slate-800 min-w-[160px]">Business</th>
                      <th className="p-4 border-b border-slate-800 min-w-[200px]">Owner & Email</th>
                      <th className="p-4 border-b border-slate-800 min-w-[120px]">Number</th>
                      <th className="p-4 border-b border-slate-800 min-w-[140px]">Plan</th>
                      <th className="p-4 border-b border-slate-800 min-w-[100px]">Status</th>
                      <th className="p-4 border-b border-slate-800 text-center min-w-[100px]">Exp In</th>
                      <th className="p-4 border-b border-slate-800 min-w-[120px]">Expiry Date</th>
                      <th className="p-4 border-b border-slate-800 min-w-[120px]">City</th>
                      <th className="p-4 border-b border-slate-800 min-w-[120px]">State</th>
                   </tr>
                   {/* FILTER ROW */}
                   <tr className="bg-slate-900">
                      <th className="p-2 border-b border-slate-800">
                         <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" placeholder="Filter Business" value={filters.business} onChange={e => setFilters({...filters, business: e.target.value})} />
                      </th>
                      <th className="p-2 border-b border-slate-800">
                         <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" placeholder="Name or Email" value={filters.owner} onChange={e => setFilters({...filters, owner: e.target.value})} />
                      </th>
                      <th className="p-2 border-b border-slate-800">
                         <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" placeholder="Mobile" value={filters.number} onChange={e => setFilters({...filters, number: e.target.value})} />
                      </th>
                      <th className="p-2 border-b border-slate-800">
                         <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" value={filters.plan} onChange={e => setFilters({...filters, plan: e.target.value})}>
                            <option value="">All</option>
                            <option value="Monthly">Monthly</option>
                            <option value="6 Months">6 Months</option>
                            <option value="Yearly">Yearly</option>
                         </select>
                      </th>
                      <th className="p-2 border-b border-slate-800">
                         <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                            <option value="">All</option>
                            <option value="Active">Active</option>
                            <option value="Expired">Expired</option>
                            <option value="Inactive">Inactive</option>
                         </select>
                      </th>
                      <th className="p-2 border-b border-slate-800"></th>
                      <th className="p-2 border-b border-slate-800"></th>
                      <th className="p-2 border-b border-slate-800">
                         <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" placeholder="Filter City" value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})} />
                      </th>
                      <th className="p-2 border-b border-slate-800">
                         <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" placeholder="Filter State" value={filters.state} onChange={e => setFilters({...filters, state: e.target.value})} />
                      </th>
                   </tr>
                </thead>
                <tbody className="text-sm text-slate-300">
                   {displayedTenants.map((t, idx) => {
                      const today = new Date().toISOString().split('T')[0];
                      const daysLeft = t.planExpiryDate ? getDaysDifference(today, t.planExpiryDate) : 0;
                      const isExpired = daysLeft < 0;
                      const cleanPlanName = t.planName?.replace('COSVYN ONE', '').replace(/[()]/g, '').trim() || '-';

                      return (
                         <tr key={t.id || idx} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-bold text-white">
                               {t.businessName || 'Unnamed Business'}
                            </td>
                            <td className="p-4">
                               <div className="font-medium text-slate-200">{t.ownerName || 'Unknown'}</div>
                               <div className="text-xs text-slate-500">{t.email}</div>
                            </td>
                            <td className="p-4 font-mono text-slate-400">
                               {t.mobile || '-'}
                            </td>
                            <td className="p-4">
                               <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-medium border border-slate-700">
                                  {cleanPlanName}
                               </span>
                            </td>
                            <td className="p-4">
                               <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${
                                  t.planStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                  t.planStatus === 'Inactive' ? 'bg-slate-700 text-slate-400' :
                                  'bg-red-500/10 text-red-400 border border-red-500/20'
                               }`}>
                                  {t.planStatus || 'Unknown'}
                               </span>
                            </td>
                            <td className="p-4 text-center">
                               {activeTab === 'owners' && (
                                  <span className={`font-bold ${daysLeft <= 7 ? 'text-red-400' : 'text-slate-300'}`}>
                                     {isExpired ? 'Expired' : `${daysLeft} days`}
                                  </span>
                               )}
                               {activeTab === 'signups' && <span className="text-slate-600">-</span>}
                            </td>
                            <td className="p-4 text-slate-400 text-xs">
                               {t.planExpiryDate ? (
                                  <div className="flex items-center gap-1">
                                     <Calendar size={12} /> {t.planExpiryDate}
                                  </div>
                               ) : '-'}
                            </td>
                            <td className="p-4 text-slate-400">{t.city}</td>
                            <td className="p-4 text-slate-400">{t.state}</td>
                         </tr>
                      );
                   })}
                   {displayedTenants.length === 0 && (
                      <tr>
                         <td colSpan={9} className="p-12 text-center text-slate-500 flex flex-col items-center justify-center w-full">
                            <Search size={32} className="mb-2 opacity-50" />
                            No records found matching your filters.
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};

export default AdminUsers;
