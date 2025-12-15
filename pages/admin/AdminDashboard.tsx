
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  DollarSign, Activity, Users, TrendingUp, Loader2, Repeat, UserPlus, Calendar
} from 'lucide-react';
import { useAdminTenants, useAdminBillingHistory } from '../../services/dbService';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

const AdminDashboard = () => {
  const { tenants, loading: l1 } = useAdminTenants();
  const { history, loading: l2 } = useAdminBillingHistory();
  const [filterPeriod, setFilterPeriod] = useState('All');

  const loading = l1 || l2;

  const metrics = useMemo(() => {
    let active = 0;
    let mrr = 0;
    let totalRevenue = 0; 
    let monthlyCount = 0;
    let sixMonthCount = 0;
    let yearlyCount = 0;
    let monthlyRev = 0;
    let sixMonthRev = 0;
    let yearlyRev = 0;

    // Snapshot metrics from Tenants state
    tenants.forEach(t => {
      if (t.planStatus === 'Active') {
        active++;
        let price = 0;
        let months = 1;
        
        if (t.planName?.includes('Monthly')) { 
            price = 999; 
            months = 1; 
            monthlyCount++;
            monthlyRev += price;
        } else if (t.planName?.includes('6 Months')) { 
            price = 5099; 
            months = 6; 
            sixMonthCount++;
            sixMonthRev += price;
        } else if (t.planName?.includes('Yearly')) { 
            price = 9599; 
            months = 12; 
            yearlyCount++;
            yearlyRev += price;
        }
        
        if (price > 0) {
            mrr += price / months;
        }
      }
    });

    // Total Historical Revenue from Billing History
    totalRevenue = history.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const arr = mrr * 12;
    const signups = tenants.length;
    const churn = signups > 0 ? ((signups - active) / signups) * 100 : 0;

    return { 
        revenue: totalRevenue, 
        active, 
        mrr, 
        arr, 
        churn: churn.toFixed(1), 
        signups,
        planDistribution: [
           { name: 'Monthly', value: monthlyRev, count: monthlyCount },
           { name: '6 Months', value: sixMonthRev, count: sixMonthCount },
           { name: 'Yearly', value: yearlyRev, count: yearlyCount },
        ]
    };
  }, [tenants, history]);

  // Real Trend Data derived from Billing History
  const trendData = useMemo(() => {
     if (history.length === 0) return [];

     // Group by Month (YYYY-MM)
     const grouped = history.reduce((acc: any, curr: any) => {
        if (!curr.date) return acc;
        const date = new Date(curr.date);
        if (isNaN(date.getTime())) return acc;
        
        const key = date.toLocaleString('default', { month: 'short', year: 'numeric' }); // e.g. "Oct 2023"
        const sortKey = date.getTime(); // Use for sorting

        if (!acc[key]) acc[key] = { name: key, Revenue: 0, sort: sortKey };
        acc[key].Revenue += (curr.amount || 0);
        return acc;
     }, {});

     return Object.values(grouped).sort((a: any, b: any) => a.sort - b.sort);
  }, [history]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  const Widget = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
      <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm flex flex-col justify-between h-full hover:border-slate-700 transition-colors">
         <div className="flex justify-between items-start mb-2">
            <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 text-opacity-100`}>
               <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
            </div>
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
      
      {/* 1. KEY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
         <Widget 
            title="Total Revenue" 
            value={`₹${metrics.revenue.toLocaleString()}`} 
            icon={DollarSign} 
            colorClass="bg-emerald-500 text-emerald-400" 
            subtext="Lifetime SaaS Income"
         />
         <Widget 
            title="Active Business" 
            value={metrics.active} 
            icon={Activity} 
            colorClass="bg-blue-500 text-blue-400" 
         />
         <Widget 
            title="MRR (Est)" 
            value={`₹${Math.round(metrics.mrr).toLocaleString()}`} 
            icon={Repeat} 
            colorClass="bg-violet-500 text-violet-400" 
            subtext="Monthly Recurring"
         />
         <Widget 
            title="ARR (Est)" 
            value={`₹${Math.round(metrics.arr).toLocaleString()}`} 
            icon={TrendingUp} 
            colorClass="bg-cyan-500 text-cyan-400" 
            subtext="Annual Run Rate"
         />
         <Widget 
            title="Churn Rate" 
            value={`${metrics.churn}%`} 
            icon={Users} 
            colorClass="bg-red-500 text-red-400" 
            subtext="Inactive / Total"
         />
         <Widget 
            title="Total Signups" 
            value={metrics.signups} 
            icon={UserPlus} 
            colorClass="bg-amber-500 text-amber-400" 
         />
      </div>

      {/* 2. REVENUE TREND */}
      <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-bold flex items-center gap-2">
               <TrendingUp size={20} className="text-cyan-400" /> Revenue Trend
            </h3>
            <select 
               className="bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-lg px-2 py-1 outline-none"
               value={filterPeriod}
               onChange={(e) => setFilterPeriod(e.target.value)}
            >
               <option value="All">All Time</option>
            </select>
         </div>
         <div className="h-80 w-full">
            {trendData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(v) => `₹${v}`} />
                     <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }}
                        formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                     />
                     <Area type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
               </ResponsiveContainer>
            ) : (
               <div className="flex items-center justify-center h-full text-slate-500 italic">
                  No revenue data available yet.
               </div>
            )}
         </div>
      </div>

      {/* 3. PLAN WISE REVENUE & DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Pie Chart */}
         <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm flex flex-col">
            <h3 className="text-white font-bold mb-6">Revenue Distribution by Plan</h3>
            <div className="flex-1 min-h-[300px] flex items-center justify-center">
               {metrics.revenue > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie 
                           data={metrics.planDistribution} 
                           dataKey="value" 
                           nameKey="name" 
                           cx="50%" 
                           cy="50%" 
                           innerRadius={80} 
                           outerRadius={110} 
                           paddingAngle={5}
                        >
                           {metrics.planDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                           ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                           formatter={(val: number) => `₹${val.toLocaleString()}`}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                     </PieChart>
                  </ResponsiveContainer>
               ) : (
                  <p className="text-slate-500 text-sm italic">No revenue recorded yet.</p>
               )}
            </div>
            {/* Stats below chart */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
               {metrics.planDistribution.map((p, i) => (
                  <div key={p.name} className="bg-slate-950/50 rounded-lg p-2 border border-slate-800">
                     <div className="text-xs text-slate-500 font-bold uppercase">{p.name}</div>
                     <div className="text-white font-bold text-sm">₹{p.value.toLocaleString()}</div>
                     <div className="text-[10px] text-slate-400">{p.count} Active</div>
                  </div>
               ))}
            </div>
         </div>

         {/* 4. RECENT SUBSCRIPTIONS LIST */}
         <div className="bg-slate-900/70 p-0 rounded-2xl border border-slate-800 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
               <h3 className="text-white font-bold">Latest Subscriptions</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px]">
               {history.slice(0, 8).map((pay, idx) => {
                  const tenant = tenants.find(t => t.id === pay.tenantId);
                  return (
                     <div key={pay.id || idx} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm uppercase">
                              {tenant?.businessName?.substring(0,2) || 'BU'}
                           </div>
                           <div>
                              <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                                 {tenant?.businessName || 'Unknown Business'}
                              </h4>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                 <Calendar size={10} /> {pay.date ? pay.date.split('T')[0] : 'No Date'}
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-white">₹{pay.amount}</div>
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                              {pay.planName}
                           </span>
                        </div>
                     </div>
                  );
               })}
               {history.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">No subscription payments yet.</div>
               )}
            </div>
         </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
