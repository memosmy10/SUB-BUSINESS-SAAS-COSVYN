
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Activity, Loader2, 
  ChevronDown, Calendar, Store, PieChart as PieIcon, BarChart3, Utensils
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Analytics = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: expenses = [], loading: l2 } = useStreamCollection<any>('expenses');
  const { data: branches = [], loading: l3 } = useStreamCollection<any>('branches');
  const { data: payments = [], loading: l4 } = useStreamCollection<any>('payments');

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');

  const isLoading = l1 || l2 || l3 || l4;

  // Dynamic Options for Filters
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const current = new Date().getFullYear().toString();
    years.add(current);
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    expenses.forEach(e => { if(e.date) years.add(new Date(e.date).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers, expenses]);

  // --- CORE FILTER LOGIC ---
  const filteredData = useMemo(() => {
    const fCust = customers.filter(c => {
      const date = new Date(c.createdAt || c.startDate);
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;
      const matchesMonth = selectedMonth === 'All' || date.getMonth().toString() === selectedMonth;
      return matchesBranch && matchesYear && matchesMonth;
    });

    const fExp = expenses.filter(e => {
      const date = new Date(e.date);
      const matchesBranch = selectedBranch === 'All' || e.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;
      const matchesMonth = selectedMonth === 'All' || date.getMonth().toString() === selectedMonth;
      return matchesBranch && matchesYear && matchesMonth;
    });

    return { fCust, fExp };
  }, [customers, expenses, selectedBranch, selectedYear, selectedMonth]);

  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    const revenue = filteredData.fCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const expense = filteredData.fExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const active = filteredData.fCust.filter(c => c.isActive).length;
    return { revenue, expense, profit: revenue - expense, active };
  }, [filteredData]);

  // --- ADAPTIVE MAIN TREND GRAPH ---
  const trendData = useMemo(() => {
    if (selectedYear === 'All') {
      // Year vs Year
      return yearOptions.map(y => {
        const rev = customers.filter(c => new Date(c.createdAt || c.startDate).getFullYear().toString() === y)
          .reduce((a, b) => a + (Number(b.planPrice) || 0) + (Number(b.deliveryCharges) || 0), 0);
        const exp = expenses.filter(e => new Date(e.date).getFullYear().toString() === y)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        return { name: y, Revenue: rev, Expense: exp, Profit: rev - exp };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (selectedMonth === 'All') {
      // Month vs Month (Standard)
      return MONTHS.map((m, i) => {
        const rev = customers.filter(c => {
          const d = new Date(c.createdAt || c.startDate);
          return d.getFullYear().toString() === selectedYear && d.getMonth() === i;
        }).reduce((a, b) => a + (Number(b.planPrice) || 0) + (Number(b.deliveryCharges) || 0), 0);

        const exp = expenses.filter(e => {
          const d = new Date(e.date);
          return d.getFullYear().toString() === selectedYear && d.getMonth() === i;
        }).reduce((a, b) => a + (Number(b.amount) || 0), 0);

        return { name: m, Revenue: rev, Expense: exp, Profit: rev - exp };
      });
    }

    // Week vs Week (If specific Month and Year selected)
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w, idx) => {
      // Simple logic: split month into 4 quarters
      const rev = kpis.revenue / 4;
      const exp = kpis.expense / 4;
      return { name: w, Revenue: Math.round(rev), Expense: Math.round(exp), Profit: Math.round(rev - exp) };
    });
  }, [selectedYear, selectedMonth, customers, expenses, yearOptions, kpis]);

  // --- SECONDARY BREAKDOWNS ---
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.fExp.forEach(e => map[e.category] = (map[e.category] || 0) + Number(e.amount || 0));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData.fExp]);

  const customerGrowth = useMemo(() => {
    const monthsData = MONTHS.map((m, i) => {
      const count = customers.filter(c => {
        const d = new Date(c.createdAt);
        const yMatches = selectedYear === 'All' || d.getFullYear().toString() === selectedYear;
        return yMatches && d.getMonth() === i;
      }).length;
      return { name: m, Signups: count };
    });
    return monthsData;
  }, [customers, selectedYear]);

  const revenueByPlan = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.fCust.forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        map[ap.planName] = (map[ap.planName] || 0) + (Number(ap.price) || 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData.fCust]);

  const mealTimeBreakdown = useMemo(() => {
    const slots = [
      { name: 'Breakfast', total: 0 },
      { name: 'Lunch', total: 0 },
      { name: 'Dinner', total: 0 }
    ];
    
    const uniquePlans = new Set<string>();

    filteredData.fCust.forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const slot: any = slots.find(d => d.name === ap.mealTime);
        if (slot) {
          slot[ap.planName] = (slot[ap.planName] || 0) + 1;
          slot.total++;
          uniquePlans.add(ap.planName);
        }
      });
    });

    return {
      data: slots,
      plans: Array.from(uniquePlans)
    };
  }, [filteredData.fCust]);

  const KpiCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-36">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">₹{Math.round(value).toLocaleString()}</h3>
        </div>
        <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}>
          <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
        </div>
      </div>
    </div>
  );

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* Header & Advanced Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Analytics
          </h1>
          <p className="text-slate-500 font-medium mt-1">Platform performance metrics and financial health.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          {/* Branch Filter */}
          <div className="relative flex-1 md:flex-none md:w-48">
            <select 
              className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Store className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          {/* Year Filter */}
          <div className="relative flex-1 md:flex-none md:w-40">
            <select 
              className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth('All'); }}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          {/* Month Filter */}
          <div className="relative flex-1 md:flex-none md:w-40">
            <select 
              className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer disabled:opacity-50" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={selectedYear === 'All'}
            >
              <option value="All">All Months</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Revenue" value={kpis.revenue} icon={DollarSign} colorClass="bg-blue-600" />
        <KpiCard title="Total Expense" value={kpis.expense} icon={TrendingDown} colorClass="bg-rose-500" />
        <KpiCard title="Total Net Profit" value={kpis.profit} icon={TrendingUp} colorClass="bg-emerald-600" />
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-36">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Active Users</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{kpis.active}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-600 bg-opacity-10">
              <Users size={20} className="text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Adaptive Trend Chart */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[450px]">
        <div className="flex items-center gap-3 mb-8">
           <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><Activity size={20}/></div>
           <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Performance Trends</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {selectedYear === 'All' ? 'Yearly Progression' : selectedMonth === 'All' ? `Monthly Breakdown (${selectedYear})` : `Weekly Distribution (${MONTHS[parseInt(selectedMonth)]} ${selectedYear})`}
              </p>
           </div>
        </div>
        <div className="flex-1">
           <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                 <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                 <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }} />
                 <Legend verticalAlign="top" height={36} iconType="circle" />
                 <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={4} fill="url(#colorRev)" />
                 <Area type="monotone" dataKey="Expense" stroke="#f43f5e" strokeWidth={4} fill="url(#colorExp)" />
                 <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={4} fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
           </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Expense Breakdown */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><PieIcon size={20}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Expense Breakdown</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                       {expenseBreakdown.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Customer Growth */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><BarChart3 size={20}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Customer Growth</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={customerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} allowDecimals={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none' }} />
                    <Bar dataKey="Signups" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Revenue by Plan */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={20}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Revenue by Plan</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={revenueByPlan} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                       {revenueByPlan.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" iconType="rect" />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Meal Time Breakdown - UPDATED TO STACKED VERTICAL BARS */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Utensils size={20}/></div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Meal Time Breakdown</h3>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mealTimeBreakdown.data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#475569', fontWeight: 900, fontSize: 12}} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                    />
                    <Legend verticalAlign="top" align="center" iconType="rect" wrapperStyle={{ paddingBottom: '20px' }} />
                    {mealTimeBreakdown.plans.map((planName, index) => (
                      <Bar 
                        key={planName} 
                        dataKey={planName} 
                        stackId="a" 
                        fill={COLORS[index % COLORS.length]} 
                        barSize={60}
                        radius={index === mealTimeBreakdown.plans.length - 1 ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active plans per meal time</p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
