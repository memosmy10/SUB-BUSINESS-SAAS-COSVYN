import React, { useMemo, useState } from 'react';
import { 
  Users, DollarSign, Package, Loader2, 
  AlertCircle, Calendar, ChevronDown, TrendingUp, ShoppingBag, Activity, BarChart3, PieChart as PieIcon, MapPin
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useStreamCollection } from '../services/dbService';
import { calculateRemainingDeliveries } from '../services/store';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

const StatCard = ({ title, value, icon: Icon, colorClass, iconColor, subtext }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-32">
    <div className="flex justify-between items-start">
      <div className="space-y-0.5 overflow-hidden">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{title}</p>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
          {typeof value === 'number' && (title.toLowerCase().includes('revenue') || title.toLowerCase().includes('payment')) 
            ? `₹${Math.round(value).toLocaleString('en-IN')}` 
            : value}
        </h3>
      </div>
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass} bg-opacity-10`}>
        <Icon size={18} className={iconColor} />
      </div>
    </div>
    {subtext && (
      <div className="mt-1">
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate">{subtext}</p>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: singleOrders = [], loading: l2 } = useStreamCollection<any>('single_orders');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');
  const { data: payments = [], loading: l5 } = useStreamCollection<any>('payments');

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Defaults: All Branches, All Years
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  const today = new Date();
  const formattedToday = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    singleOrders.forEach(o => { if(o.date) years.add(new Date(o.date).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers, singleOrders]);

  const kpis = useMemo(() => {
    if (isLoading) return { subRevenue: 0, pending: 0, unqCust: 0, activeCust: 0, plansToday: 0, singleRev: 0, singleCount: 0 };

    const todayStr = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    const filteredCust = customers.filter((c: any) => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const filteredSingles = singleOrders.filter((o: any) => {
      const matchesBranch = selectedBranch === 'All' || o.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !o.date || new Date(o.date).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const subRevenue = filteredCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const pending = filteredCust.reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);
    
    // FIX: LIVE DATA CALCULATION - Matches Customer Page Logic
    const unqCust = filteredCust.length;
    const activeCust = filteredCust.filter(c => {
      if (!c.isActive) return false;
      
      // Real-time calculation of remaining days based on current clock and active plans
      const realDaysLeft = (c.activePlans || []).reduce((max: number, p: any) => {
        const planConfig = plans.find((pl: any) => pl.id === p.planId);
        if (!planConfig) return max;
        // The core helper that correctly handles holidays and pauses against the current date
        const left = calculateRemainingDeliveries(p.endDate, planConfig.weekdays || [], p.pauses || []);
        return Math.max(max, left);
      }, 0);

      return realDaysLeft > 0;
    }).length;

    let plansToday = 0;
    customers.filter(c => c.isActive && (selectedBranch === 'All' || c.branchId === selectedBranch)).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        if (!planConfig) return;
        const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
        const isValidDay = planConfig.weekdays.includes(dayOfWeek);
        const isWithinRange = todayStr >= ap.startDate && todayStr <= ap.endDate;
        if (isWithinRange && isValidDay && !isPaused) plansToday++;
      });
    });

    const singleRev = filteredSingles.reduce((acc, o) => acc + (Number(o.amount) || 0) + (Number(o.deliveryCharges) || 0), 0);
    const singleCount = filteredSingles.length;

    return { subRevenue, pending, unqCust, activeCust, plansToday, singleRev, singleCount };
  }, [customers, singleOrders, plans, selectedBranch, selectedYear, isLoading]);

  const cashFlowData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const subRev = payments
        .filter((p: any) => {
          const d = new Date(p.date);
          const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
          const cust = customers.find(c => c.id === p.customerId);
          const matchesBranch = selectedBranch === 'All' || (cust && cust.branchId === selectedBranch);
          return matchesDate && matchesBranch;
        })
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const sRev = singleOrders
        .filter((o: any) => {
          const d = new Date(o.date);
          const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
          const matchesBranch = selectedBranch === 'All' || o.branchId === selectedBranch;
          return matchesDate && matchesBranch;
        })
        .reduce((a, b) => a + (Number(b.amount) || 0) + (Number(b.deliveryCharges) || 0), 0);

      return { name: m, amount: subRev + sRev };
    });
  }, [payments, singleOrders, customers, selectedBranch, selectedYear]);

  const planRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    customers.filter(c => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    }).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        map[ap.planName] = (map[ap.planName] || 0) + Number(ap.price || 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers, selectedBranch, selectedYear]);

  const customerGrowthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const count = customers.filter(c => {
        const d = new Date(c.createdAt);
        const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
        const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
        return matchesDate && matchesBranch;
      }).length;
      return { name: m, count };
    });
  }, [customers, selectedBranch, selectedYear]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

  return (
    <div className="space-y-6 pb-16 pt-2 animate-in fade-in duration-500">
      
      {/* Header & Filters Unified Row (Horizontal Scroll on Mobile) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">Dashboard</h1>
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 whitespace-nowrap">
            <Calendar size={12} /> {formattedToday}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <select 
              className="pl-2 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black shadow-none outline-none focus:ring-1 focus:ring-primary-500 appearance-none uppercase tracking-tighter cursor-pointer" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
          </div>

          <div className="relative">
            <select 
              className="pl-2 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black shadow-none outline-none focus:ring-1 focus:ring-primary-500 appearance-none uppercase tracking-tighter cursor-pointer" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
          </div>
        </div>
      </div>

      {/* KPI Section - Paired Rows for Mobile Efficiency */}
      <div className="space-y-4">
        {/* Row 1: Revenue & Pending */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Total Revenue" value={kpis.subRevenue} icon={DollarSign} colorClass="bg-emerald-600" iconColor="text-emerald-600" subtext="Collected Total" />
          <StatCard title="Pending Payments" value={kpis.pending} icon={AlertCircle} colorClass="bg-rose-500" iconColor="text-rose-500" subtext="Collection Due" />
        </div>

        {/* Row 2: Unique & Active (FIXED LOGIC) */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Unq Customers" value={kpis.unqCust} icon={Users} colorClass="bg-blue-600" iconColor="text-blue-600" subtext="Total Historical" />
          <StatCard title="Active Users" value={kpis.activeCust} icon={Activity} colorClass="bg-indigo-600" iconColor="text-indigo-600" subtext="Running Plans" />
        </div>

        {/* Row 3: Single Orders */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Single Rev" value={kpis.singleRev} icon={TrendingUp} colorClass="bg-cyan-600" iconColor="text-cyan-600" subtext="Order Sales" />
          <StatCard title="Single Orders" value={kpis.singleCount} icon={ShoppingBag} colorClass="bg-violet-600" iconColor="text-violet-600" subtext="Order Count" />
        </div>

        {/* Row 4: Plans Today (Full Width) */}
        <div className="w-full">
           <div className="bg-slate-900 p-5 rounded-3xl flex items-center justify-between shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package size={80} className="text-white" />
              </div>
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plans Scheduled Today</p>
                 <h3 className="text-3xl font-black text-white">{kpis.plansToday} <span className="text-sm font-bold text-slate-500 ml-1 uppercase">Boxes</span></h3>
              </div>
              <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                 <Package size={24} />
              </div>
           </div>
        </div>
      </div>

      {/* Charts Section - Vertical Stack for Selected Years */}
      <div className="space-y-6">
        
        {/* Cash Flow Chart */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><BarChart3 size={18}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight truncate uppercase">Monthly Cash Flow {selectedYear === 'All' ? '(History)' : `(${selectedYear})`}</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="amount" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Plan Wise Revenue Pie */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><PieIcon size={18}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight truncate uppercase">Plan-wise Revenue {selectedYear === 'All' ? '(History)' : `(${selectedYear})`}</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={planRevenueData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                       {planRevenueData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Customer Growth Line Chart */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight truncate uppercase">Monthly Signups {selectedYear === 'All' ? '(History)' : `(${selectedYear})`}</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={customerGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} name="New Signups" />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;