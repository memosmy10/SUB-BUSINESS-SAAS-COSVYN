
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  DollarSign, AlertCircle, TrendingUp, Calendar, Filter, Search, ArrowRight, Loader2, Phone, UserX
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';
import { calculateRemainingDeliveries } from '../services/store';

const Payments = () => {
  // Real Data
  const { data: customers, loading: l1 } = useStreamCollection<any>('customers');
  const { data: payments, loading: l2 } = useStreamCollection<any>('payments');
  const { data: branches, loading: l3 } = useStreamCollection<any>('branches');
  const { data: plans, loading: l4 } = useStreamCollection<any>('plans');

  const isLoading = l1 || l2 || l3 || l4;

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // --- DATA PROCESSING ---

  // Filter customers by branch
  const filteredCustomers = useMemo(() => {
    return selectedBranch === 'All' 
      ? customers 
      : customers.filter((c:any) => c.branchId === selectedBranch);
  }, [selectedBranch, customers]);

  // Valid Payments (filtered by existing customers)
  const validPayments = useMemo(() => {
     const custIds = new Set(customers.map((c:any) => c.id));
     return payments.filter((p:any) => custIds.has(p.customerId));
  }, [payments, customers]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    const totalPending = filteredCustomers.reduce((acc: number, c: any) => acc + (c.pendingAmount || 0), 0);
    
    // Total Revenue = Sum of all Plan Prices (Contract Value)
    const totalRevenue = filteredCustomers.reduce((acc: number, c: any) => acc + (c.planPrice || 0), 0);
    
    // Total Collected = Sum of Amount Paid fields (or we could sum payments collection, but using customer fields for consistency with pie chart)
    const totalCollected = filteredCustomers.reduce((acc: number, c: any) => acc + (c.amountPaid || 0), 0);

    // Calculate pending explicitly for expired customers
    const expiredPending = filteredCustomers
      .filter((c:any) => {
         if ((c.pendingAmount || 0) <= 0) return false;

         // 1. Check explicit inactive flag
         if (!c.isActive) return true;

         // 2. Check calculated expiry (active flag might be stale)
         const plan = plans.find((p:any) => p.id === c.planId);
         // If no plan found, assume default weekdays to calculate. If no end date, it handles gracefully.
         const weekdays = plan?.weekdays || [0,1,2,3,4,5,6];
         const daysLeft = calculateRemainingDeliveries(c.endDate, weekdays);
         
         // If days are exhausted, they are effectively expired for payment purposes
         return daysLeft <= 0;
      })
      .reduce((acc: number, c: any) => acc + (c.pendingAmount || 0), 0);

    return { totalPending, totalRevenue, totalCollected, expiredPending };
  }, [filteredCustomers, selectedBranch, validPayments, customers, plans]);

  // Branch-wise Pending Data
  const branchPendingData = useMemo(() => {
    return branches.map((b: any) => {
      const pending = customers
        .filter((c: any) => c.branchId === b.id)
        .reduce((acc: number, c: any) => acc + (c.pendingAmount || 0), 0);
      return { name: b.name, value: pending };
    }).filter((d: any) => d.value > 0);
  }, [branches, customers]);

  // Chart Data: Collections Over Time (Line)
  const revenueData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(m => {
       const total = validPayments
         .filter((tx: any) => new Date(tx.date).toLocaleString('default', { month: 'short' }) === m)
         .reduce((acc: number, tx: any) => {
            if (selectedBranch !== 'All') {
               const cust = customers.find((c:any) => c.id === tx.customerId);
               if (cust?.branchId !== selectedBranch) return acc;
            }
            return acc + (tx.amount || 0);
         }, 0);
       return { name: m, revenue: total };
    });
  }, [selectedBranch, validPayments, customers]);

  // Chart Data: Monthly Pending Dues (Bar)
  const pendingByMonthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map(m => ({ name: m, value: 0 }));

    filteredCustomers.forEach((c: any) => {
       if ((c.pendingAmount || 0) > 0 && c.endDate) {
          const date = new Date(c.endDate);
          const m = date.toLocaleString('default', { month: 'short' });
          const idx = months.indexOf(m);
          if (idx !== -1) {
             data[idx].value += c.pendingAmount;
          }
       }
    });
    return data;
  }, [filteredCustomers]);

  // Chart Data: Paid vs Pending (Pie)
  const pieData = [
    { name: 'Paid', value: metrics.totalCollected, color: '#16a34a' }, // green-600
    { name: 'Pending', value: metrics.totalPending, color: '#dc2626' } // red-600
  ];

  // --- SUB-COMPONENTS ---

  const MetricCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">{title}</p>
          <h3 className="text-2xl font-extrabold text-slate-900">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
           <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
        </div>
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-2 z-10 font-medium">{subtext}</p>}
      <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5 group-hover:scale-110 transition-transform ${colorClass}`} />
    </div>
  );

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-500">Track revenue, pending dues, and financial health.</p>
        </div>
        <div className="w-full md:w-64">
           <select 
             className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
             value={selectedBranch}
             onChange={(e) => setSelectedBranch(e.target.value)}
           >
             <option value="All">All Branches</option>
             {branches.map((b: any) => (
               <option key={b.id} value={b.id}>{b.name}</option>
             ))}
           </select>
        </div>
      </div>

      {/* 2. TOP METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Revenue" 
          value={`₹${metrics.totalRevenue.toLocaleString()}`} 
          subtext="Total Contract Value" 
          icon={DollarSign} 
          colorClass="bg-green-600 text-green-600" 
        />
        <MetricCard 
          title="Total Pending" 
          value={`₹${metrics.totalPending.toLocaleString()}`} 
          subtext="From Active & Expired" 
          icon={AlertCircle} 
          colorClass="bg-red-600 text-red-600" 
        />
        <MetricCard 
          title="Expired & Pending" 
          value={`₹${metrics.expiredPending.toLocaleString()}`} 
          subtext="Due from inactive users" 
          icon={UserX} 
          colorClass="bg-slate-700 text-slate-700" 
        />
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden h-32">
           <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Branch-wise Pending</h4>
           <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
             {branchPendingData.length > 0 ? branchPendingData.map((d: any, i: number) => (
               <div key={i} className="flex justify-between items-center text-sm">
                 <span className="text-slate-600 truncate max-w-[100px]">{d.name}</span>
                 <span className="font-bold text-red-600">₹{d.value}</span>
               </div>
             )) : <span className="text-slate-400 text-sm italic">No pending dues</span>}
           </div>
        </div>
      </div>

      {/* 3. CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Line Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600"/> Cash Flow (Collections)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                   formatter={(val: number) => [`₹${val}`, 'Collected']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Paid vs Pending Pie */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Revenue Realization</h3>
          <div className="h-64 relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie 
                   data={pieData} 
                   innerRadius={60} 
                   outerRadius={80} 
                   paddingAngle={5} 
                   dataKey="value"
                 >
                   {pieData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                 </Pie>
                 <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
             {/* Center Text */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                <div className="text-xs text-slate-400 font-bold uppercase">Total</div>
                <div className="text-xl font-extrabold text-slate-900">₹{metrics.totalRevenue.toLocaleString()}</div>
             </div>
          </div>
        </div>

      </div>

      {/* 4. NEW: MONTHLY PENDING DUES CHART */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500"/> Month-on-Month Pending Dues
         </h3>
         <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={pendingByMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                     cursor={{fill: '#fee2e2'}}
                     contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                     formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Pending Amount']}
                  />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* 5. PENDING PAYMENTS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
           <h3 className="font-bold text-slate-900 flex items-center gap-2">
             <AlertCircle size={18} className="text-red-500" /> Outstanding Payments List
           </h3>
           <div className="relative w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text"
               placeholder="Search..."
               className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white text-slate-900 placeholder:text-slate-400"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Subscription</th>
                <th className="px-6 py-4 text-right">Paid</th>
                <th className="px-6 py-4 text-right">Pending Amount</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredCustomers
                .filter((c: any) => (c.pendingAmount || 0) > 0) // Only show pending
                .filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a: any, b: any) => (b.pendingAmount || 0) - (a.pendingAmount || 0)) // Highest pending first
                .map((c: any) => {
                   const branchName = branches.find((b: any) => b.id === c.branchId)?.name;
                   const plan = plans.find((p:any) => p.id === c.planId);
                   const planName = plan?.name || 'Unknown Plan';
                   
                   // Recalculate expiry status to be sure
                   const weekdays = plan?.weekdays || [0,1,2,3,4,5,6];
                   const daysLeft = calculateRemainingDeliveries(c.endDate, weekdays);
                   const isExpired = !c.isActive || daysLeft <= 0;

                   return (
                     <tr key={c.id} className={`hover:bg-red-50/10 transition-colors ${isExpired ? 'bg-red-50/20' : ''}`}>
                       <td className="px-6 py-4">
                         <div className="font-bold text-slate-900">{c.name}</div>
                         <div className="text-xs text-slate-500">{c.mobile}</div>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600">{branchName || 'Unknown'}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">{planName}</td>
                       <td className="px-6 py-4">
                         {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                               <UserX size={12} /> Expired
                            </span>
                         ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                               <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"/> Active
                            </span>
                         )}
                       </td>
                       <td className="px-6 py-4 text-right font-medium text-slate-500">₹{c.amountPaid}</td>
                       <td className="px-6 py-4 text-right">
                          <span className="font-bold text-red-600 text-lg">₹{c.pendingAmount}</span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <a 
                            href={`tel:${c.mobile}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Phone size={12} /> Call
                          </a>
                       </td>
                     </tr>
                   );
                })}
              {filteredCustomers.filter((c: any) => (c.pendingAmount || 0) > 0).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                     No pending payments found. Great job!
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

export default Payments;
