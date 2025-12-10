
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  DollarSign, Activity, Users, TrendingUp, Loader2, Repeat, UserPlus, Calendar, ArrowUpRight 
} from 'lucide-react';
import { useAdminTenants } from '../../services/dbService';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

const AdminDashboard = () => {
  const { tenants, loading } = useAdminTenants();

  const metrics = useMemo(() => {
    let active = 0;
    let mrr = 0;
    let totalRev = 0; // Snapshot revenue of current active plans
    let monthlyCount = 0;
    let sixMonthCount = 0;
    let yearlyCount = 0;
    let monthlyRev = 0;
    let sixMonthRev = 0;
    let yearlyRev = 0;

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
            totalRev += price;
        }
      }
    });

    const arr = mrr * 12;
    const signups = tenants.length;
    const churn = signups > 0 ? ((signups - active) / signups) * 100 : 0;

    return { 
        revenue: totalRev, 
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
  }, [tenants]);

  // Mock Trend Data (Since we don't have historical snapshots in this demo)
  const trendData = useMemo(() => {
     return [
        { name: 'Jul', Revenue: metrics.revenue * 0.6 },
        { name: 'Aug', Revenue: metrics.revenue * 0.7 },
        { name: 'Sep', Revenue: metrics.revenue * 0.85 },
        { name: 'Oct', Revenue: metrics.revenue * 0.9 },
        { name: 'Nov', Revenue: metrics.revenue * 0.95 },
        { name: 'Dec', Revenue: metrics.revenue }
     ];
  }, [metrics.revenue]);

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
      
      {/* 1. KEY METRICS (6 Widgets, 2 per row on mobile) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
         <Widget 
            title="Total Revenue" 
            value={`₹${metrics.revenue.toLocaleString()}`} 
            icon={DollarSign} 
            colorClass="bg-emerald-500 text-emerald-400" 
            subtext="Current Active Value"
         />
         <Widget 
            title="Active Business" 
            value={metrics.active} 
            icon={Activity} 
            colorClass="bg-blue-500 text-blue-400" 
         />
         <Widget 
            title="MRR" 
            value={`₹${Math.round(metrics.mrr).toLocaleString()}`} 
            icon={Repeat} 
            colorClass="bg-violet-500 text-violet-400" 
            subtext="Monthly Recurring"
         />
         <Widget 
            title="ARR" 
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
            <select className="bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-lg px-2 py-1 outline-none">
               <option>Last 6 Months</option>
               <option>Last Year</option>
            </select>
         </div>
         <div className="h-80 w-full">
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
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }}
                     formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* 3. PLAN WISE REVENUE & DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Pie Chart */}
         <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm flex flex-col">
            <h3 className="text-white font-bold mb-6">Revenue by Plan</h3>
            <div className="flex-1 min-h-[300px] flex items-center">
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
            </div>
            {/* Stats below chart */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
               {metrics.planDistribution.map((p, i) => (
                  <div key={p.name} className="bg-slate-950/50 rounded-lg p-2 border border-slate-800">
                     <div className="text-xs text-slate-500 font-bold uppercase">{p.name}</div>
                     <div className="text-white font-bold text-sm">₹{p.value.toLocaleString()}</div>
                     <div className="text-[10px] text-slate-400">{p.count} Users</div>
                  </div>
               ))}
            </div>
         </div>

         {/* 4. RECENT SUBSCRIPTIONS LIST */}
         <div className="bg-slate-900/70 p-0 rounded-2xl border border-slate-800 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
               <h3 className="text-white font-bold">Recent Subscriptions</h3>
               <button className="text-xs text-cyan-400 font-bold hover:text-cyan-300">View All</button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px]">
               {tenants.slice(0, 8).map((t, idx) => (
                  <div key={t.id || idx} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm uppercase">
                           {t.businessName?.substring(0,2) || 'BU'}
                        </div>
                        <div>
                           <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{t.businessName}</h4>
                           <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={10} /> {t.planExpiryDate ? `Exp: ${t.planExpiryDate}` : 'No Date'}
                           </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-sm font-bold text-white">
                           {t.planName?.replace('COSVYN ONE', '').replace(/[()]/g, '') || 'Trial'}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.planStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                           {t.planStatus}
                        </span>
                     </div>
                  </div>
               ))}
               {tenants.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">No subscriptions yet.</div>
               )}
            </div>
         </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
