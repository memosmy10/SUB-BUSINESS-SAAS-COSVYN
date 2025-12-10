
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { MapPin, Building2, Loader2 } from 'lucide-react';
import { useAdminTenants } from '../../services/dbService';

const AdminAnalytics = () => {
  const { tenants, loading } = useAdminTenants();

  // --- Data Calculations ---

  const monthlyRevenue = useMemo(() => {
     // Mock distribution for demo visualization since we don't have historical snapshots stored yet
     if (tenants.length === 0) return [];
     return [
       { name: 'Jan', Active: tenants.length * 0.2 },
       { name: 'Feb', Active: tenants.length * 0.4 },
       { name: 'Mar', Active: tenants.length * 0.6 },
       { name: 'Apr', Active: tenants.length * 0.8 },
       { name: 'May', Active: tenants.length }
     ];
  }, [tenants]);

  const planDistribution = useMemo(() => [
    { name: 'Monthly', value: tenants.filter(t => t.planName?.includes('Monthly')).length, color: '#3b82f6' },
    { name: '6 Months', value: tenants.filter(t => t.planName?.includes('6 Months')).length, color: '#8b5cf6' },
    { name: 'Yearly', value: tenants.filter(t => t.planName?.includes('Yearly')).length, color: '#06b6d4' },
  ].filter(d => d.value > 0), [tenants]);

  // Top Cities Logic
  const topCities = useMemo(() => {
    const cityMap: Record<string, number> = {};
    tenants.forEach(tenant => {
        if(tenant.city) cityMap[tenant.city] = (cityMap[tenant.city] || 0) + 1;
    });
    return Object.entries(cityMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tenants]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
          <div className="text-sm font-medium text-slate-400">Live Data</div>
       </div>

       {/* GEO ANALYTICS SECTION */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Revenue By State (Visual List simulating Map Data) */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <MapPin className="text-cyan-500" size={20} /> Tenant Distribution
             </h3>
             <div className="h-64 flex items-center justify-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                Map Visualization Coming Soon (Needs GeoData)
             </div>
          </div>

          {/* Top Cities */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <Building2 className="text-violet-500" size={20} /> Top Cities
             </h3>
             <div className="space-y-4">
                {topCities.map((city, idx) => (
                   <div key={idx} className="flex items-center justify-between p-3 bg-slate-950/30 border border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-8 rounded-full ${
                            idx === 0 ? 'bg-yellow-500' : 
                            idx === 1 ? 'bg-slate-400' : 
                            idx === 2 ? 'bg-amber-700' : 'bg-slate-700'
                         }`} />
                         <span className="text-slate-200 font-bold">{city.name}</span>
                      </div>
                      <span className="text-sm font-medium bg-slate-800 text-slate-300 px-2 py-1 rounded-lg">
                         {city.count} Owners
                      </span>
                   </div>
                ))}
                {topCities.length === 0 && <div className="text-slate-500 text-center">No city data available.</div>}
             </div>
          </div>

       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Revenue Breakdown */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6">Growth Trend (Active Users)</h3>
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                        cursor={{fill: '#1e293b'}}
                      />
                      <Legend />
                      <Bar dataKey="Active" fill="#3b82f6" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Plan Distribution */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6">Active Subscriptions by Plan</h3>
             <div className="h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie 
                        data={planDistribution} 
                        innerRadius={60} 
                        outerRadius={100} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                         {planDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                         ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                      <Legend verticalAlign="bottom" height={36}/>
                   </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                   <div className="text-3xl font-bold text-white">{tenants.length}</div>
                   <div className="text-xs text-slate-500 uppercase font-bold">Total</div>
                </div>
             </div>
          </div>

       </div>
    </div>
  );
};

export default AdminAnalytics;
