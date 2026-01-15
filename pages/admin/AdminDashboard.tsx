
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  DollarSign, Activity, Users, TrendingUp, Loader2, Repeat, UserPlus, Calendar, CreditCard
} from 'lucide-react';
import { useAdminTenants, useAdminBillingHistory } from '../../services/dbService';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

const AdminDashboard = () => {
  const { tenants, loading: l1 } = useAdminTenants();
  const { history, loading: l2 } = useAdminBillingHistory();
  const [filterPeriod, setFilterPeriod] = useState('All');

  const loading = l1 || l2;

  const getPlanDetails = (planName: string) => {
     const name = (planName || '').toLowerCase();
     if (name.includes('monthly')) return { price: 999, months: 1 };
     if (name.includes('6 months')) return { price: 5099, months: 6 };
     if (name.includes('yearly')) return { price: 9599, months: 12 };
     return { price: 0, months: 1 };
  };

  const metrics = useMemo(() => {
    let activeCount = 0;
    let activeRevenueSum = 0;
    let totalMonthlyEquivalent = 0;
    const planDist = { 'Monthly': 0, '6 Months': 0, 'Yearly': 0 };

    tenants.forEach(t => {
      if (t.planStatus === 'Active') {
        activeCount++;
        const { price, months } = getPlanDetails(t.planName);
        if (price > 0) {
           activeRevenueSum += Number(price);
           totalMonthlyEquivalent += (Number(price) / months);
           if (t.planName.toLowerCase().includes('monthly')) planDist['Monthly'] += price;
           else if (t.planName.toLowerCase().includes('6 months')) planDist['6 Months'] += price;
           else if (t.planName.toLowerCase().includes('yearly')) planDist['Yearly'] += price;
        }
      }
    });

    // FORCE NUMERIC ADDITION FOR HISTORY
    const totalLifetimeCollected = history.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const arpu = activeCount > 0 ? totalMonthlyEquivalent / activeCount : 0;
    const mrr = activeCount * arpu;
    const signups = tenants.length;
    const churn = signups > 0 ? ((signups - activeCount) / signups) * 100 : 0;

    return { 
        activeRevenue: activeRevenueSum,
        lifetimeRevenue: totalLifetimeCollected,
        active: activeCount, 
        mrr, arpu, churn: churn.toFixed(1), signups,
        planDistribution: [
           { name: 'Monthly', value: planDist['Monthly'] },
           { name: '6 Months', value: planDist['6 Months'] },
           { name: 'Yearly', value: planDist['Yearly'] },
        ].filter(i => i.value > 0)
    };
  }, [tenants, history]);

  const trendData = useMemo(() => {
     if (history.length === 0) return [];
     const grouped = history.reduce((acc: any, curr: any) => {
        if (!curr.date) return acc;
        const date = new Date(curr.date);
        if (isNaN(date.getTime())) return acc;
        const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        const sortKey = date.getTime(); 
        if (!acc[key]) acc[key] = { name: key, Revenue: 0, sort: sortKey };
        acc[key].Revenue += Number(curr.amount || 0);
        return acc;
     }, {});
     return Object.values(grouped).sort((a: any, b: any) => a.sort - b.sort);
  }, [history]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  const Widget = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
      <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm flex flex-col justify-between h-full hover:border-slate-700 transition-colors">
         <div className="flex justify-between items-start mb-2">
            <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 text-opacity-100`}><Icon size={20} className={colorClass.replace('bg-', 'text-')} /></div>
         </div>
         <div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">{title}</div>
            {subtext && <div className="text-slate-500 text-xs mt-1">{subtext}</div>}
         </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
         <Widget title="Lifetime Revenue" value={`₹${metrics.lifetimeRevenue.toLocaleString()}`} icon={CreditCard} colorClass="bg-blue-500 text-blue-400" subtext="Total Collections" />
         <Widget title="Active Revenue" value={`₹${metrics.activeRevenue.toLocaleString()}`} icon={DollarSign} colorClass="bg-emerald-500 text-emerald-400" subtext="Sum of active plans" />
         <Widget title="Active Owners" value={metrics.active} icon={Activity} colorClass="bg-violet-500 text-violet-400" subtext="Paying Customers" />
         <Widget title="MRR" value={`₹${Math.round(metrics.mrr).toLocaleString()}`} icon={Repeat} colorClass="bg-cyan-500 text-cyan-400" subtext={`Avg: ₹${Math.round(metrics.arpu)}`} />
         <Widget title="Churn Rate" value={`${metrics.churn}%`} icon={Users} colorClass="bg-red-500 text-red-400" subtext="Inactive / Total" />
         <Widget title="Total Signups" value={metrics.signups} icon={UserPlus} colorClass="bg-amber-500 text-amber-400" />
      </div>

      <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm h-80">
         <h3 className="text-white font-bold mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-400" /> Revenue Trend</h3>
         <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
               <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} />
               <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
               <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} formatter={(val: number) => `₹${val.toLocaleString()}`} />
               <Area type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={3} fill="url(#colorRev)" />
            </AreaChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminDashboard;
