
import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, Loader2 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAdminBillingHistory, useAdminTenants } from '../../services/dbService';

const AdminPayments = () => {
  const [filterPlan, setFilterPlan] = useState('All');
  
  // FETCH REAL DATA
  const { history, loading: l1 } = useAdminBillingHistory();
  const { tenants, loading: l2 } = useAdminTenants();

  const loading = l1 || l2;

  const paymentsWithDetails = useMemo(() => {
    return history.map(pay => {
      const tenant = tenants.find(t => t.id === pay.tenantId);

      return {
        ...pay,
        businessName: tenant?.businessName || 'Unknown Business',
        ownerName: tenant?.ownerName || 'Unknown Owner',
        mobile: tenant?.mobile || 'Unknown',
        planType: pay.planName || 'Unknown',
        amountPaid: pay.amount || 0,
        startDate: pay.date || new Date().toISOString(),
        transactionId: pay.paymentId || pay.id // Prefer paymentId if available
      };
    }).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [history, tenants]);

  const filteredPayments = filterPlan === 'All' 
    ? paymentsWithDetails 
    : paymentsWithDetails.filter(p => p.planType.includes(filterPlan));

  const totalCollected = filteredPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

  // Real chart data for trend
  const chartData = useMemo(() => {
     if (filteredPayments.length === 0) return [];
     
     // Group by Date YYYY-MM-DD
     const grouped = filteredPayments.reduce((acc: any, curr: any) => {
        const date = curr.startDate.split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date] += curr.amountPaid;
        return acc;
     }, {});

     const sortedDates = Object.keys(grouped).sort();
     return sortedDates.map(date => ({ name: date, value: grouped[date] }));
  }, [filteredPayments]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-white">SaaS Revenue (Billing History)</h1>
           <p className="text-xs text-slate-400">Tracking subscription payments from businesses to you.</p>
        </div>
        <div className="w-full md:w-auto bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center md:block md:text-right">
           <p className="text-xs text-slate-400 uppercase font-bold">Total Collected</p>
           <p className="text-2xl font-bold text-emerald-400">₹{totalCollected.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Chart */}
         <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/> Revenue Trend</h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fill="url(#colorPaid)" />
                 </AreaChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Filters */}
         <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-4">Filters</h3>
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Subscription Type</label>
                  <div className="flex flex-wrap gap-2">
                     {['All', 'Monthly', '6 Months', 'Yearly'].map(plan => (
                        <button 
                          key={plan}
                          onClick={() => setFilterPlan(plan)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                            filterPlan === plan 
                             ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                             : 'border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                           {plan}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Table with Horizontal Scroll */}
      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-950/50 text-xs uppercase font-bold text-slate-500">
                   <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Payer (Business)</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Plan</th>
                      <th className="px-6 py-4 text-right">Payment ID</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                   {filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                         <td className="px-6 py-4 text-slate-300 text-sm font-mono">
                            {p.startDate.split('T')[0]}
                         </td>
                         <td className="px-6 py-4">
                            <div className="font-bold text-white">{p.businessName}</div>
                            <div className="text-xs text-slate-500">{p.ownerName} • {p.mobile}</div>
                         </td>
                         <td className="px-6 py-4 text-emerald-400 font-bold">
                            ₹{p.amountPaid}
                         </td>
                         <td className="px-6 py-4">
                            <span className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">{p.planType}</span>
                         </td>
                         <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">
                            {p.transactionId}
                         </td>
                      </tr>
                   ))}
                   {filteredPayments.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">No transactions found.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
      </div>

    </div>
  );
};

export default AdminPayments;
