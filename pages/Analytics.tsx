
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Activity, Lightbulb, ArrowUpRight, ArrowDownRight, Loader2, Utensils
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Analytics = () => {
  // Real Data Fetching
  const { data: customers, loading: l1 } = useStreamCollection<any>('customers');
  const { data: payments, loading: l2 } = useStreamCollection<any>('payments');
  const { data: expenses, loading: l3 } = useStreamCollection<any>('expenses');
  const { data: branches, loading: l4 } = useStreamCollection<any>('branches');
  const { data: plans, loading: l5 } = useStreamCollection<any>('plans');

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All'); // 'All' or 'Oct', 'Nov', etc.

  // --- DATA PROCESSING HELPERS ---

  const { filteredCustomers, filteredPayments, filteredExpenses } = useMemo(() => {
    if (isLoading) return { filteredCustomers: [], filteredPayments: [], filteredExpenses: [] };

    // Branch Filter
    const fCustomers = selectedBranch === 'All' ? customers : customers.filter((c: any) => c.branchId === selectedBranch);
    
    // Payments needs manual branch filtering via customer lookup since payment record usually has customerId
    const fPayments = payments.filter((p: any) => {
      if (selectedBranch === 'All') return true;
      const c = customers.find((cust: any) => cust.id === p.customerId);
      return c?.branchId === selectedBranch;
    });

    const fExpenses = selectedBranch === 'All' ? expenses : expenses.filter((e: any) => e.branchId === selectedBranch);

    // Month Filter
    const finalPayments = selectedMonth === 'All' ? fPayments : fPayments.filter((p: any) => new Date(p.date).toLocaleString('default', { month: 'short' }) === selectedMonth);
    const finalExpenses = selectedMonth === 'All' ? fExpenses : fExpenses.filter((e: any) => new Date(e.date).toLocaleString('default', { month: 'short' }) === selectedMonth);

    return { filteredCustomers: fCustomers, filteredPayments: finalPayments, filteredExpenses: finalExpenses };
  }, [customers, payments, expenses, selectedBranch, selectedMonth, isLoading]);

  // --- KPIS ---
  
  const totalRevenue = filteredPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const activeCustomers = filteredCustomers.filter((c: any) => c.isActive && c.daysLeft > 0).length;

  // --- CHART DATA PREPARATION ---

  // 1. Financial Trends (Line Chart)
  const financialTrendData = useMemo(() => {
    if (selectedMonth === 'All') {
      // Group by Month
      return MONTHS.map(m => {
        const rev = filteredPayments
          .filter((p: any) => new Date(p.date).toLocaleString('default', { month: 'short' }) === m)
          .reduce((a: number, b: any) => a + (b.amount || 0), 0);
        
        const exp = filteredExpenses
          .filter((e: any) => new Date(e.date).toLocaleString('default', { month: 'short' }) === m)
          .reduce((a: number, b: any) => a + (b.amount || 0), 0);
          
        return { name: m, Revenue: rev, Expenses: exp, Profit: rev - exp };
      }).filter(d => d.Revenue > 0 || d.Expenses > 0); 
    } else {
      // Show Weeks for selected month (Simulation)
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map(w => ({
        name: w,
        Revenue: Math.round(totalRevenue / 4 + (Math.random() * 1000 - 500)), // Mock distribution just for weekly viz
        Expenses: Math.round(totalExpenses / 4 + (Math.random() * 500 - 250)),
        Profit: 0 
      })).map(d => ({ ...d, Profit: d.Revenue - d.Expenses }));
    }
  }, [filteredPayments, filteredExpenses, selectedMonth, totalRevenue, totalExpenses]);

  // 2. Expense Breakdown (Pie)
  const expenseBreakdownData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredExpenses]);

  // 3. Customer Growth (Bar)
  const customerGrowthData = useMemo(() => {
    return MONTHS.map(m => {
      const count = filteredCustomers.filter((c: any) => {
        const startMonth = new Date(c.startDate).toLocaleString('default', { month: 'short' });
        // Simple logic: if they started in or before this month
        return startMonth === m || (c.isActive && MONTHS.indexOf(startMonth) <= MONTHS.indexOf(m));
      }).length;
      return { name: m, Active: count };
    });
  }, [filteredCustomers]);

  const uniqueCustomers = filteredCustomers.length;
  const renewals = filteredCustomers.reduce((acc: number, c: any) => acc + (c.renewalCount || 0), 0);
  const renewalRate = uniqueCustomers ? Math.round((renewals / (uniqueCustomers + renewals)) * 100) : 0;

  // 4. Plan Performance (Pie)
  const planPerformance = useMemo(() => {
    const map: Record<string, { revenue: number, count: number }> = {};
    filteredCustomers.forEach((c: any) => {
       const plan = plans.find((p: any) => p.id === c.planId);
       if (!plan) return;
       if (!map[plan.name]) map[plan.name] = { revenue: 0, count: 0 };
       
       map[plan.name].revenue += (c.planPrice || 0);
       map[plan.name].count += 1;
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k].revenue, count: map[k].count }));
  }, [filteredCustomers, plans]);

  // 5. NEW: Meal Time vs Plan Distribution (Stacked Bar)
  const mealTimePlanData = useMemo(() => {
    const rawData = {
      Breakfast: {} as Record<string, number>,
      Lunch: {} as Record<string, number>,
      Dinner: {} as Record<string, number>
    };

    const allPlanNames = new Set<string>();

    filteredCustomers.forEach((c: any) => {
      if (!c.isActive || c.daysLeft <= 0) return; // Only count active subs
      
      const meal = (c.mealTime || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
      const plan = plans.find((p: any) => p.id === c.planId);
      const planName = plan ? plan.name : 'Unknown';
      
      allPlanNames.add(planName);

      if (rawData[meal]) {
        rawData[meal][planName] = (rawData[meal][planName] || 0) + 1;
      }
    });

    // Format for Recharts: [{ name: 'Breakfast', 'Plan A': 10, 'Plan B': 5 }, ...]
    return {
      data: [
         { name: 'Breakfast', ...rawData.Breakfast },
         { name: 'Lunch', ...rawData.Lunch },
         { name: 'Dinner', ...rawData.Dinner },
      ],
      keys: Array.from(allPlanNames)
    };
  }, [filteredCustomers, plans]);

  // --- AI INSIGHTS LOGIC ---
  const aiInsights = useMemo(() => {
    const insights = [];
    
    if (netProfit < 0) {
      insights.push("Expenses exceeded revenue this period. Review 'Food' and 'Salaries' categories immediately.");
    }
    if (activeCustomers > 0 && renewalRate < 30) {
      insights.push("Renewal rate is below 30%. Consider offering a loyalty discount to expiring customers.");
    }
    const topExpense = expenseBreakdownData.sort((a,b) => b.value - a.value)[0];
    if (topExpense && topExpense.value > totalExpenses * 0.4) {
      insights.push(`'${topExpense.name}' accounts for over 40% of expenses. Look for alternative suppliers or cost-saving measures.`);
    }
    const topPlan = planPerformance.sort((a,b) => b.value - a.value)[0];
    if (topPlan && topPlan.value > totalRevenue * 0.5) {
      insights.push(`'${topPlan.name}' drives >50% of revenue. Ensure delivery quality for this plan is top-notch.`);
    }
    if (insights.length === 0) insights.push("Business looks healthy! Keep maintaining your current customer retention strategies.");

    return insights;
  }, [netProfit, renewalRate, expenseBreakdownData, totalExpenses, planPerformance, totalRevenue, activeCustomers]);


  // --- COMPONENT RENDER ---

  const KpiCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
           <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
        </div>
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-auto z-10">{subtext}</p>}
      <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-5 ${colorClass}`} />
    </div>
  );

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 pb-20">
      
      {/* 1. Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500">Performance metrics and financial health.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
           <select 
             className="w-full md:w-48 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 outline-none"
             value={selectedBranch}
             onChange={(e) => setSelectedBranch(e.target.value)}
           >
             <option value="All">All Branches</option>
             {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
           </select>
           <select 
             className="w-full md:w-36 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 outline-none"
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
           >
             <option value="All">All Time</option>
             {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
           </select>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total Revenue" 
          value={`₹${totalRevenue.toLocaleString()}`} 
          subtext="Gross income"
          icon={DollarSign} 
          colorClass="bg-green-600 text-green-600"
        />
        <KpiCard 
          title="Total Expenses" 
          value={`₹${totalExpenses.toLocaleString()}`} 
          subtext="Operational costs"
          icon={TrendingDown} 
          colorClass="bg-red-500 text-red-500"
        />
        <KpiCard 
          title="Net Profit" 
          value={`₹${netProfit.toLocaleString()}`} 
          subtext={netProfit > 0 ? "Healthy margin" : "Attention needed"}
          icon={TrendingUp} 
          colorClass={netProfit >= 0 ? "bg-violet-600 text-violet-600" : "bg-orange-500 text-orange-500"}
        />
        <KpiCard 
          title="Active Customers" 
          value={activeCustomers} 
          subtext="Currently subscribed"
          icon={Users} 
          colorClass="bg-blue-500 text-blue-500"
        />
      </div>

      {/* 3. Financial Trends (Line Chart) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Activity size={20} className="text-primary-600" /> Financial Trends
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={financialTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(v) => `₹${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                formatter={(val) => `₹${val}`}
              />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="Profit" stroke="#16a34a" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Split Row: Expense Breakdown & Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Expense Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <h3 className="text-lg font-bold text-slate-900 mb-4">Expense Breakdown</h3>
           <div className="flex-1 flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expenseBreakdownData} 
                      dataKey="value" 
                      cx="50%" cy="50%" 
                      outerRadius={70} 
                      innerRadius={40}
                      paddingAngle={4}
                    >
                      {expenseBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => `₹${val.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-3">
                 {expenseBreakdownData.sort((a,b) => b.value - a.value).map((entry, idx) => (
                   <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-slate-600">{entry.name}</span>
                      </div>
                      <span className="font-bold text-slate-900">₹{entry.value.toLocaleString()}</span>
                   </div>
                 ))}
                 {expenseBreakdownData.length === 0 && <p className="text-slate-400 italic text-center">No expenses for this period</p>}
              </div>
           </div>
        </div>

        {/* Customer Growth */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-slate-900">Customer Insights</h3>
              <div className="text-right">
                 <p className="text-xs text-slate-500 uppercase font-bold">Renewal Rate</p>
                 <p className={`text-xl font-bold ${renewalRate > 50 ? 'text-green-600' : 'text-orange-500'}`}>{renewalRate}%</p>
              </div>
           </div>
           
           <div className="h-56">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={customerGrowthData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                 <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px' }} />
                 <Bar dataKey="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Unique</p>
                <p className="text-lg font-bold text-slate-900">{uniqueCustomers}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Current Active</p>
                <p className="text-lg font-bold text-slate-900">{activeCustomers}</p>
              </div>
           </div>
        </div>

      </div>

      {/* 5. Plan Performance & Meal Time Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Plan Performance (Pie) */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Revenue by Plan</h3>
            <div className="flex-1 min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={planPerformance} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}>
                      {planPerformance.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => `₹${val}`} />
                    <Legend />
                 </PieChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Meal Time Performance (Stacked Bar) */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
               <Utensils size={20} className="text-orange-500" /> Meal Time Breakdown
            </h3>
            <div className="flex-1 min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mealTimePlanData.data} margin={{top: 20, right: 30, left: 0, bottom: 0}}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                     <Tooltip 
                       cursor={{fill: '#f8fafc'}}
                       contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                     />
                     <Legend verticalAlign="top" height={36} />
                     {mealTimePlanData.keys.map((key, index) => (
                        <Bar 
                           key={key} 
                           dataKey={key} 
                           stackId="a" 
                           fill={COLORS[index % COLORS.length]} 
                           radius={index === mealTimePlanData.keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                        />
                     ))}
                  </BarChart>
               </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">Active plans per meal time</p>
         </div>
      </div>

      {/* 6. AI Insights */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-xl border border-indigo-100">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
               <Lightbulb size={24} />
            </div>
            <h3 className="text-xl font-bold text-indigo-900">AI Business Insights</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiInsights.map((insight, idx) => (
               <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50/50 flex gap-3 items-start">
                  <div className="mt-1 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  <p className="text-slate-700 text-sm leading-relaxed">{insight}</p>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
};

export default Analytics;
