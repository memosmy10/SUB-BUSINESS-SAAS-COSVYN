import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import { 
  DollarSign, AlertCircle, TrendingUp, Calendar, Search, 
  Loader2, Phone, ChevronDown, Receipt, Filter, ArrowRight, Wallet, Building2
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const StatCard = ({ title, value, icon: Icon, colorClass, iconColor, subtext }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-36">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">
          {typeof value === 'number' 
            ? `₹${Math.round(value).toLocaleString('en-IN')}` 
            : value}
        </h3>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
    {subtext && (
      <div className="mt-2">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{subtext}</p>
      </div>
    )}
  </div>
);

const Payments = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: payments = [], loading: l2 } = useStreamCollection<any>('payments');
  const { data: branches = [], loading: l3 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2 || l3;

  // Top Global Filters - UPDATED DEFAULT TO 'All'
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Outstanding List Specific Filters
  const [listBranch, setListBranch] = useState('All');
  const [listYear, setListYear] = useState('All');
  const [listMonth, setListMonth] = useState('All');
  const [listSearch, setListSearch] = useState('');

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers]);

  // Derived Metrics based on Global Filters
  const metrics = useMemo(() => {
    const filteredCust = customers.filter(c => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const totalRevenue = filteredCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const totalCollected = filteredCust.reduce((acc, c) => acc + (Number(c.amountPaid) || 0), 0);
    const totalPending = filteredCust.reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);

    const branchPending: Record<string, number> = {};
    filteredCust.forEach(c => {
      const bName = branches.find(b => b.id === c.branchId)?.name || 'Main';
      branchPending[bName] = (branchPending[bName] || 0) + (Number(c.pendingAmount) || 0);
    });

    return { totalRevenue, totalCollected, totalPending, branchPending };
  }, [customers, branches, selectedBranch, selectedYear]);

  // Charts Logic
  const chartYear = selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear;

  const cashFlowTrend = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const total = payments
        .filter((p: any) => {
          const d = new Date(p.date);
          const matchesDate = d.getMonth() === idx && d.getFullYear().toString() === chartYear;
          const cust = customers.find(c => c.id === p.customerId);
          const matchesBranch = selectedBranch === 'All' || (cust && cust.branchId === selectedBranch);
          return matchesDate && matchesBranch;
        })
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return { name: m, amount: total };
    });
  }, [payments, customers, chartYear, selectedBranch]);

  const pendingDuesTrend = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const total = customers
        .filter((c: any) => {
          const d = new Date(c.createdAt || c.startDate);
          const matchesDate = d.getMonth() === idx && d.getFullYear().toString() === chartYear;
          const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
          return matchesDate && matchesBranch;
        })
        .reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);
      return { name: m, amount: total };
    });
  }, [customers, chartYear, selectedBranch]);

  const realizationData = [
    { name: 'Paid', value: metrics.totalCollected },
    { name: 'Pending', value: metrics.totalPending }
  ];

  // Outstanding List Logic
  const outstandingList = useMemo(() => {
    return customers.filter(c => {
      if ((Number(c.pendingAmount) || 0) <= 0) return false;
      const d = new Date(c.createdAt || c.startDate);
      const matchesBranch = listBranch === 'All' || c.branchId === listBranch;
      const matchesYear = listYear === 'All' || d.getFullYear().toString() === listYear;
      const matchesMonth = listMonth === 'All' || d.getMonth().toString() === listMonth;
      const matchesSearch = c.name.toLowerCase().includes(listSearch.toLowerCase()) || c.mobile.includes(listSearch);
      return matchesBranch && matchesYear && matchesMonth && matchesSearch;
    }).sort((a, b) => (Number(b.pendingAmount) || 0) - (Number(a.pendingAmount) || 0));
  }, [customers, listBranch, listYear, listMonth, listSearch]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Payments
          </h1>
          <p className="text-slate-500 font-medium mt-1">Track revenue, pending dues, and financial health.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-48">
            <select 
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
          <div className="relative flex-1 md:flex-none md:w-36">
            <select 
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={metrics.totalRevenue} icon={DollarSign} colorClass="bg-blue-600" iconColor="text-blue-600" subtext="Plans + Delivery Charges" />
        <StatCard title="Total Collected" value={metrics.totalCollected} icon={Receipt} colorClass="bg-emerald-600" iconColor="text-emerald-600" subtext="Total Paid by Customers" />
        <StatCard title="Total Pending" value={metrics.totalPending} icon={AlertCircle} colorClass="bg-rose-500" iconColor="text-rose-500" subtext="Outstanding Dues" />
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-36 flex flex-col justify-between overflow-hidden">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Branch-wise Pending</p>
              <div className="space-y-1 max-h-[60px] overflow-y-auto no-scrollbar">
                 {Object.entries(metrics.branchPending).map(([name, amt]) => (
                   <div key={name} className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-600">{name}</span>
                      <span className="font-black text-rose-600">₹{amt.toLocaleString()}</span>
                   </div>
                 ))}
                 {Object.keys(metrics.branchPending).length === 0 && <p className="text-xs text-slate-300 italic">No data</p>}
              </div>
           </div>
           <Building2 className="absolute -right-2 -bottom-2 text-slate-50" size={60} />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20}/></div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Month-on-Month Cash Flow ({chartYear})</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={cashFlowTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                    <Tooltip cursor={{stroke: '#e2e8f0', strokeWidth: 2}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }} formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Collected']} />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Realization Pie */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet size={20}/></div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Revenue Realization</h3>
           </div>
           <div className="flex-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={realizationData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                       {realizationData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Amount']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-18px]">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                 <p className="text-lg font-black text-slate-900">₹{Math.round(metrics.totalRevenue / 1000)}k</p>
              </div>
           </div>
        </div>
      </div>

      {/* Pending Dues Trend */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[350px]">
         <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={20}/></div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Month-on-Month Pending Dues ({chartYear})</h3>
         </div>
         <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={pendingDuesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                  <Tooltip cursor={{fill: '#fff1f2'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }} formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Pending']} />
                  <Bar dataKey="amount" fill="#f43f5e" radius={[10, 10, 0, 0]} barSize={40} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Outstanding Payments List Section */}
      <div className="space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><AlertCircle size={24}/></div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Outstanding Payments List</h2>
                  <p className="text-slate-500 font-medium text-sm">Customers with remaining balance.</p>
               </div>
            </div>
            
            {/* List Sub-Filters */}
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
               <div className="relative flex-1 md:flex-none">
                  <select 
                    className="w-full md:w-32 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none appearance-none pr-8"
                    value={listBranch} onChange={e => setListBranch(e.target.value)}
                  >
                     <option value="All">All Branches</option>
                     {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
               </div>
               <div className="relative flex-1 md:flex-none">
                  <select 
                    className="w-full md:w-28 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none appearance-none pr-8"
                    value={listYear} onChange={e => setListYear(e.target.value)}
                  >
                     <option value="All">All Years</option>
                     {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
               </div>
               <div className="relative flex-1 md:flex-none">
                  <select 
                    className="w-full md:w-28 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none appearance-none pr-8"
                    value={listMonth} onChange={e => setListMonth(e.target.value)}
                  >
                     <option value="All">All Months</option>
                     {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
               <Search className="text-slate-400" size={18} />
               <input 
                 className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600 text-xs placeholder:text-slate-300" 
                 placeholder="Search by name or number..." 
                 value={listSearch} onChange={e => setListSearch(e.target.value)}
               />
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                     <tr>
                        <th className="p-5">Customer</th>
                        <th className="p-5">Branch</th>
                        <th className="p-5">Plan Status</th>
                        <th className="p-5 text-right">Paid</th>
                        <th className="p-5 text-right">Pending Amount</th>
                        <th className="p-5 text-center">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {outstandingList.map((c) => {
                        const branchName = branches.find(b => b.id === c.branchId)?.name || 'Main';
                        const primaryPlan = (c.activePlans && c.activePlans.length > 0) ? c.activePlans[0].planName : 'No Plan';

                        return (
                           <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="p-5">
                                 <div className="font-black text-slate-900 text-sm uppercase">{c.name}</div>
                                 <div className="text-[10px] font-mono text-slate-400">{c.mobile}</div>
                              </td>
                              <td className="p-5">
                                 <span className="text-[10px] font-black text-slate-500 uppercase">{branchName}</span>
                              </td>
                              <td className="p-5">
                                 <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    <span className="text-xs font-bold text-slate-700">{primaryPlan}</span>
                                 </div>
                              </td>
                              <td className="p-5 text-right font-black text-slate-400 text-sm">₹{c.amountPaid || 0}</td>
                              <td className="p-5 text-right">
                                 <div className="font-black text-rose-600 text-lg">₹{c.pendingAmount}</div>
                              </td>
                              <td className="p-5 text-center">
                                 <a 
                                   href={`tel:${c.mobile}`}
                                   className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                                 >
                                    <Phone size={14}/> Call
                                 </a>
                              </td>
                           </tr>
                        );
                     })}
                     {outstandingList.length === 0 && (
                        <tr><td colSpan={6} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No outstanding payments found.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

    </div>
  );
};

export default Payments;