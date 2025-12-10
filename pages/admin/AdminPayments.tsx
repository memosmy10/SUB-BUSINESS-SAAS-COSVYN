
import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, Loader2 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAdminGlobalPayments, useAdminTenants } from '../../services/dbService';

const AdminPayments = () => {
  const [filterPlan, setFilterPlan] = useState('All');
  
  // FETCH REAL DATA
  const { payments, loading: l1 } = useAdminGlobalPayments();
  const { tenants, loading: l2 } = useAdminTenants();

  const loading = l1 || l2;

  const paymentsWithDetails = useMemo(() => {
    return payments.map(payment => {
      // payment.path usually looks like businesses/{uid}/payments/{id}
      // We can try to match by customerName in payment record if available, 
      // or assume we need to join manually. 
      // Since `payment` record in User app stores `customerName` (which is end-customer, not tenant),
      // we need to find the Business Owner (Tenant) who received this payment.
      // Wait, Admin Payments page usually tracks SaaS Subscription Payments (Business -> Admin).
      // However, the current Schema in Onboarding only updates `lastPaymentId`.
      // It doesn't create a `subscriptions` collection for the SaaS product itself in a separate place.
      // Assuming for this MVP, "Admin Payments" view actually shows the aggregate of *Tenant's Revenue* 
      // OR *SaaS Subscription Revenue*.
      // Based on previous mock data (`MOCK_SUBSCRIPTIONS`), it was tracking SaaS Revenue.
      // Since we don't have a dedicated `saas_transactions` collection in this MVP, 
      // I will adapt this to show "Tenant Revenue Flow" (Global Payments) OR handle empty state.
      
      // LET'S ASSUME FOR LAUNCH: We want to see User's payments to Tenants to gauge platform volume.
      // OR if we want SaaS Revenue, we'd need to create a record in `OnboardingPayment`.
      // Let's stick to Global Volume for now as it's verifiable data.
      
      // Actually, let's map the `payment` object from `businesses/{uid}/payments`.
      // We need to know WHICH Business (Tenant) it belongs to.
      // The `payment` object doesn't have `tenantId` explicitly, but we can derive from parent path or if we saved it.
      // The `useAdminGlobalPayments` hook adds `path`.
      
      const pathSegments = payment.path ? payment.path.split('/') : [];
      const tenantId = pathSegments[1]; // businesses/{tenantId}/payments
      const tenant = tenants.find(t => t.id === tenantId);

      return {
        ...payment,
        businessName: tenant?.businessName || 'Unknown Business',
        ownerName: tenant?.ownerName || 'Unknown Owner',
        mobile: tenant?.mobile || 'Unknown',
        planType: tenant?.planName || 'Unknown',
        amountPaid: payment.amount || 0, // Ensure field match
        startDate: payment.date || new Date().toISOString(),
        transactionId: payment.id
      };
    }).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [payments, tenants]);

  const filteredPayments = filterPlan === 'All' 
    ? paymentsWithDetails 
    : paymentsWithDetails.filter(p => p.planType.includes(filterPlan));

  const totalCollected = filteredPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

  // Mock chart data for trend (aggregated from real data)
  const chartData = useMemo(() => {
     if (filteredPayments.length === 0) return [];
     // Group by date/week simply
     const data = filteredPayments.slice(0, 20).map((p, i) => ({
        name: `T${i}`, value: p.amountPaid
     })).reverse();
     return data;
  }, [filteredPayments]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-white">Platform GMV (Global Payments)</h1>
           <p className="text-xs text-slate-400">Tracking all transaction volume across all tenants.</p>
        </div>
        <div className="w-full md:w-auto bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center md:block md:text-right">
           <p className="text-xs text-slate-400 uppercase font-bold">Total Volume</p>
           <p className="text-2xl font-bold text-emerald-400">₹{totalCollected.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Chart */}
         <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/> Transaction Trend</h3>
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
                  <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Tenant Plan</label>
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
                      <th className="px-6 py-4">Business (Receiver)</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Plan</th>
                      <th className="px-6 py-4 text-right">Transaction ID</th>
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
