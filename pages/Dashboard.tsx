
import React, { useMemo, useState } from 'react';
import { 
  ArrowUpRight, ArrowDownRight, Users, DollarSign, Package, Loader2, 
  AlertCircle, TrendingUp, RefreshCw, Calendar, Utensils, Sunrise, Sun, Moon 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useStreamCollection } from '../services/dbService';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const StatCard = ({ title, value, change, icon: Icon, isPositive, colorClass }: any) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
      {change && (
        <div className={`flex items-center text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      )}
    </div>
    <div>
      <h3 className="text-xl md:text-2xl font-bold text-slate-900">{value}</h3>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">{title}</p>
    </div>
  </div>
);

const Dashboard = () => {
  // Fetch Real Data
  const { data: customers, loading: l1 } = useStreamCollection<any>('customers');
  const { data: payments, loading: l2 } = useStreamCollection<any>('payments');
  const { data: expenses, loading: l3 } = useStreamCollection<any>('expenses');
  const { data: plans, loading: l4 } = useStreamCollection<any>('plans');
  const { data: branches, loading: l5 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Add Branch Filter State
  const [selectedBranch, setSelectedBranch] = useState('All');

  // --- FILTERED DATA ---
  const filteredCustomers = useMemo(() => {
    return selectedBranch === 'All' 
      ? customers 
      : customers.filter((c: any) => c.branchId === selectedBranch);
  }, [customers, selectedBranch]);

  const filteredPayments = useMemo(() => {
    // 1. Get Set of ALL valid customer IDs currently in system
    const allCustomerIds = new Set(customers.map((c: any) => c.id));

    // 2. Filter payments: Must have a valid customer ID (Strict Cleanup for Deleted Customers)
    const validPayments = payments.filter((p: any) => allCustomerIds.has(p.customerId));

    // 3. Apply Branch Logic
    if (selectedBranch === 'All') {
        return validPayments;
    } else {
        // If branch selected, only include payments for customers in that branch
        const branchCustomerIds = new Set(filteredCustomers.map((c: any) => c.id));
        return validPayments.filter((p: any) => branchCustomerIds.has(p.customerId));
    }
  }, [payments, customers, filteredCustomers, selectedBranch]);

  const filteredExpenses = useMemo(() => {
    return selectedBranch === 'All'
      ? expenses
      : expenses.filter((e: any) => e.branchId === selectedBranch);
  }, [expenses, selectedBranch]);


  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    if (isLoading) return { revenue: 0, pending: 0, expenses: 0, activeUsers: 0, deliveriesToday: 0, renewalRate: 0 };

    const revenue = filteredPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
    const expensesTotal = filteredExpenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
    
    // Active customers with days left
    const activeCusts = filteredCustomers.filter((c: any) => c.isActive && c.daysLeft > 0);
    const activeUsers = activeCusts.length;

    // Total Pending from all customers
    const pending = filteredCustomers.reduce((acc: number, c: any) => acc + (c.pendingAmount || 0), 0);

    // Today's Deliveries: 
    const todayDayId = new Date().getDay(); // 0 = Sun, 1 = Mon...
    const deliveriesToday = activeCusts.filter((c: any) => {
      const plan = plans.find((p: any) => p.id === c.planId);
      return plan && plan.weekdays ? plan.weekdays.includes(todayDayId) : true;
    }).length;

    // Renewal Rate
    const totalRenewals = filteredCustomers.reduce((acc: number, c: any) => acc + (c.renewalCount || 0), 0);
    const totalUnique = filteredCustomers.length;
    const renewalRate = totalUnique > 0 ? Math.round((totalRenewals / (totalUnique + totalRenewals)) * 100) : 0;

    return { revenue, pending, expenses: expensesTotal, activeUsers, deliveriesToday, renewalRate };
  }, [filteredCustomers, filteredPayments, filteredExpenses, plans, isLoading]);

  // --- DAILY KITCHEN PREP METRICS ---
  const kitchenMetrics = useMemo(() => {
    const todayDayId = new Date().getDay();
    const activeToday = filteredCustomers.filter((c: any) => {
       if (!c.isActive || c.daysLeft <= 0) return false;
       const plan = plans.find((p: any) => p.id === c.planId);
       return plan && plan.weekdays ? plan.weekdays.includes(todayDayId) : true;
    });

    const breakdown = {
       Breakfast: { count: 0, plans: {} as Record<string, number> },
       Lunch: { count: 0, plans: {} as Record<string, number> },
       Dinner: { count: 0, plans: {} as Record<string, number> },
       Total: activeToday.length
    };

    activeToday.forEach((c: any) => {
       const meal = c.mealTime || 'Lunch'; // Default to Lunch if missing
       const planName = plans.find((p: any) => p.id === c.planId)?.name || 'Unknown Plan';
       
       if (breakdown[meal as keyof typeof breakdown]) {
          const target = breakdown[meal as keyof typeof breakdown] as { count: number, plans: Record<string, number> };
          target.count++;
          target.plans[planName] = (target.plans[planName] || 0) + 1;
       }
    });

    return breakdown;
  }, [filteredCustomers, plans]);


  // --- CHART DATA 1: Revenue vs Expenses ---
  const barChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => {
      const monthlyRevenue = filteredPayments
        .filter((p: any) => new Date(p.date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
      
      const monthlyExpenses = filteredExpenses
        .filter((e: any) => new Date(e.date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((acc: number, e: any) => acc + (e.amount || 0), 0);

      return { name: month, value: monthlyRevenue, secondaryValue: monthlyExpenses };
    });
  }, [filteredPayments, filteredExpenses]);

  // --- CHART DATA 2: Plan Wise Revenue (Pie) ---
  const planPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCustomers.forEach((c: any) => {
      if (c.isActive && c.planPrice) {
        // Try to find plan name
        const plan = plans.find((p: any) => p.id === c.planId);
        const name = plan ? plan.name : 'Unknown Plan';
        map[name] = (map[name] || 0) + (c.planPrice);
      }
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredCustomers, plans]);

  // Current Date Formatter
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Date and Branch Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Dashboard 
            <span className="text-sm font-normal text-slate-400 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1">
              <Calendar size={14}/> {todayDate}
            </span>
          </h1>
          <p className="text-slate-500 mt-1">Overview of your meal subscription business.</p>
        </div>
        
        {/* Branch Filter */}
        <select 
           className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto"
           value={selectedBranch}
           onChange={(e) => setSelectedBranch(e.target.value)}
        >
           <option value="All">All Branches</option>
           {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* 6 Widgets Grid: 2 columns on mobile, 3 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={`₹${kpis.revenue.toLocaleString()}`} 
          icon={DollarSign} 
          isPositive={true} 
          colorClass="bg-green-600 text-green-600"
        />
        <StatCard 
          title="Pending Payments" 
          value={`₹${kpis.pending.toLocaleString()}`} 
          icon={AlertCircle} 
          isPositive={false} 
          colorClass="bg-red-500 text-red-500"
        />
        <StatCard 
          title="Total Expenses" 
          value={`₹${kpis.expenses.toLocaleString()}`} 
          icon={TrendingUp} 
          isPositive={true} 
          colorClass="bg-orange-500 text-orange-500"
        />
        <StatCard 
          title="Active Customers" 
          value={kpis.activeUsers} 
          icon={Users} 
          isPositive={true} 
          colorClass="bg-blue-600 text-blue-600"
        />
        <StatCard 
          title="Deliveries Today" 
          value={kpis.deliveriesToday} 
          icon={Package} 
          isPositive={true} 
          colorClass="bg-violet-600 text-violet-600"
        />
        <StatCard 
          title="Renewal Rate" 
          value={`${kpis.renewalRate}%`} 
          icon={RefreshCw} 
          isPositive={kpis.renewalRate > 50} 
          colorClass="bg-cyan-500 text-cyan-500"
        />
      </div>

      {/* NEW: KITCHEN PREP WIDGET */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex justify-between items-start mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
               <Utensils className="text-orange-500" size={20} /> Daily Kitchen Prep
            </h2>
            <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100">
               {kitchenMetrics.Total} Boxes Total
            </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Breakfast Column */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/50">
                  <Sunrise size={18} className="text-yellow-500" />
                  <span className="font-bold text-slate-700">Breakfast</span>
                  <span className="ml-auto bg-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">{kitchenMetrics.Breakfast.count}</span>
               </div>
               <div className="space-y-2">
                  {Object.entries(kitchenMetrics.Breakfast.plans).map(([plan, count]) => (
                     <div key={plan} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate pr-2">{plan}</span>
                        <span className="font-bold text-slate-900">{count}</span>
                     </div>
                  ))}
                  {kitchenMetrics.Breakfast.count === 0 && <div className="text-xs text-slate-400 italic">No orders</div>}
               </div>
            </div>

            {/* Lunch Column */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/50">
                  <Sun size={18} className="text-orange-500" />
                  <span className="font-bold text-slate-700">Lunch</span>
                  <span className="ml-auto bg-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">{kitchenMetrics.Lunch.count}</span>
               </div>
               <div className="space-y-2">
                  {Object.entries(kitchenMetrics.Lunch.plans).map(([plan, count]) => (
                     <div key={plan} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate pr-2">{plan}</span>
                        <span className="font-bold text-slate-900">{count}</span>
                     </div>
                  ))}
                  {kitchenMetrics.Lunch.count === 0 && <div className="text-xs text-slate-400 italic">No orders</div>}
               </div>
            </div>

            {/* Dinner Column */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/50">
                  <Moon size={18} className="text-indigo-500" />
                  <span className="font-bold text-slate-700">Dinner</span>
                  <span className="ml-auto bg-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">{kitchenMetrics.Dinner.count}</span>
               </div>
               <div className="space-y-2">
                  {Object.entries(kitchenMetrics.Dinner.plans).map(([plan, count]) => (
                     <div key={plan} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate pr-2">{plan}</span>
                        <span className="font-bold text-slate-900">{count}</span>
                     </div>
                  ))}
                  {kitchenMetrics.Dinner.count === 0 && <div className="text-xs text-slate-400 italic">No orders</div>}
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Revenue vs Expenses</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="value" name="Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="secondaryValue" name="Expenses" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Wise Monthly Revenue Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Revenue by Plan</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={planPieData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={80} 
                  innerRadius={50}
                  paddingAngle={5}
                >
                  {planPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend verticalAlign="bottom" layout="horizontal" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-slate-400 mt-2">Based on current active subscriptions</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
