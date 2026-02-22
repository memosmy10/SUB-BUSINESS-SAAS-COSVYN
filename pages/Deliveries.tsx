import React, { useState, useMemo } from 'react';
import { 
  Truck, Package, MapPin, ChevronDown, ChevronUp, 
  Loader2, ArrowUp, ArrowDown, Phone,
  Sunrise, Sun, Moon, Star, CheckCircle2, UserX, 
  ArrowRight, MessageSquare, ClipboardList, ExternalLink, Users, LayoutGrid, ListChecks
} from 'lucide-react';
import { useStreamCollection, updateItem } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { calculateRemainingDeliveries, getTodayStr } from '../services/store';

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-36">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="mt-2">
      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight truncate">{subtext}</p>
    </div>
  </div>
);

const Deliveries = () => {
  const { currentUser } = useAuth();
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: staff = [], loading: l2 } = useStreamCollection<any>('staff');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');

  const [activeMealTab, setActiveMealTab] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [expandedBoyId, setExpandedBoyId] = useState<string | null>(null);
  const [expandedMatrixBoyId, setExpandedMatrixBoyId] = useState<string | null>(null);

  const isLoading = l1 || l2 || l3 || l4;

  const todayStr = getTodayStr();
  const dayOfWeek = new Date().getDay();

  // --- GLOBAL DAILY SUMMARY ---
  const globalDailySummary = useMemo(() => {
    const stats = { Breakfast: 0, Lunch: 0, Dinner: 0, GrandTotal: 0 };
    
    customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      return true;
    }).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        
        const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
        const isValidDay = weekdays.includes(dayOfWeek);
        const isWithinRange = todayStr >= ap.startDate && todayStr <= ap.endDate;
        
        if (isWithinRange && isValidDay && !isPaused) {
          if (ap.mealTime === 'Breakfast') stats.Breakfast++;
          if (ap.mealTime === 'Lunch') stats.Lunch++;
          if (ap.mealTime === 'Dinner') stats.Dinner++;
          stats.GrandTotal++;
        }
      });
    });

    return stats;
  }, [customers, plans, selectedBranch, todayStr, dayOfWeek]);

  // --- DELIVERY BOY WISE WORKLOAD MATRIX WITH PLAN BREAKDOWN ---
  const deliveryBoyMatrix = useMemo(() => {
    const filteredStaff = staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch);
    
    return filteredStaff.map(boy => {
      const boyWork: any = { 
        id: boy.id, 
        name: boy.name, 
        Breakfast: 0, 
        Lunch: 0, 
        Dinner: 0, 
        Total: 0,
        breakdown: {
          Breakfast: {} as Record<string, { count: number, isStarred: boolean }>,
          Lunch: {} as Record<string, { count: number, isStarred: boolean }>,
          Dinner: {} as Record<string, { count: number, isStarred: boolean }>
        }
      };
      
      customers.filter(c => c.deliveryBoyId === boy.id).forEach(c => {
        (c.activePlans || []).forEach((ap: any) => {
          const planConfig = plans.find(p => p.id === ap.planId);
          const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
          
          const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
          const isValidDay = weekdays.includes(dayOfWeek);
          const isWithinRange = todayStr >= ap.startDate && todayStr <= ap.endDate;
          
          if (isWithinRange && isValidDay && !isPaused) {
            const session = ap.mealTime as 'Breakfast' | 'Lunch' | 'Dinner';
            boyWork[session]++;
            boyWork.Total++;
            
            // Handle breakdown grouping
            const planKey = `${ap.planName}-${ap.isStarred || false}`;
            if (!boyWork.breakdown[session][planKey]) {
              boyWork.breakdown[session][planKey] = { count: 0, isStarred: ap.isStarred || (c.highlightMark && c.highlightMark !== 'None'), name: ap.planName };
            }
            boyWork.breakdown[session][planKey].count++;
          }
        });
      });
      
      return boyWork;
    }).sort((a, b) => b.Total - a.Total);
  }, [customers, plans, staff, selectedBranch, todayStr, dayOfWeek]);

  // 1. Filter customers scheduled for TODAY and current Meal Session (FOR EXISTING MODULES)
  const deliveriesToday = useMemo(() => {
    return customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      
      const mealPlansToday = (c.activePlans || []).filter((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        
        const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
        const isValidDay = weekdays.includes(dayOfWeek);
        const isWithinRange = todayStr >= ap.startDate && todayStr <= ap.endDate;
        const matchesMeal = ap.mealTime === activeMealTab;
        
        return isWithinRange && isValidDay && !isPaused && matchesMeal;
      });

      return mealPlansToday.length > 0;
    });
  }, [customers, plans, activeMealTab, selectedBranch, todayStr, dayOfWeek]);

  // Existing session metrics
  const sessionMetrics = useMemo(() => {
    let totalBoxes = 0;
    let totalStarBoxes = 0;
    deliveriesToday.forEach(c => {
      const sessionPlans = (c.activePlans || []).filter((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
        return ap.mealTime === activeMealTab && weekdays.includes(dayOfWeek) && todayStr >= ap.startDate && todayStr <= ap.endDate && !isPaused;
      });
      totalBoxes += sessionPlans.length;
      totalStarBoxes += sessionPlans.filter((p: any) => p.isStarred || (c.highlightMark && c.highlightMark !== 'None')).length;
    });
    return { customers: deliveriesToday.length, plans: totalBoxes, starPlans: totalStarBoxes };
  }, [deliveriesToday, activeMealTab, plans, todayStr, dayOfWeek]);

  const handleMoveOrder = async (customerId: string, direction: 'up' | 'down') => {
    if (!currentUser) return;
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    const newOrder = direction === 'up' ? (cust.routeOrder || 0) - 1 : (cust.routeOrder || 0) + 1;
    await updateItem(currentUser.uid, 'customers', customerId, { routeOrder: Math.max(0, newOrder) });
  };

  const handleShareRoute = (boy: any, boyCustomers: any[]) => {
    const body = boyCustomers
      .sort((a, b) => (a.routeOrder || 999) - (b.routeOrder || 999))
      .map((c, i) => {
        const sessionPlans = (c.activePlans || []).filter((ap: any) => ap.mealTime === activeMealTab);
        const planSummary = sessionPlans.map(p => `• ${p.planName}${p.isStarred ? ' ⭐' : ''}`).join('\n');
        let str = `${i + 1}. *${c.name}* (Total: ${sessionPlans.length} boxes)\n${planSummary}\n📍 ${c.address}${c.area ? `, ${c.area}` : ''}\n📞 ${c.mobile}`;
        if (c.locationLink) str += `\n🗺️ Map: ${c.locationLink}`;
        if (c.notes) str += `\n📝 Note: ${c.notes}`;
        return str;
      }).join('\n\n');
    const whatsappMsg = `🚚 *${activeMealTab} Route - ${boy.name}*\n📅 Date: ${todayStr}\n\n${body}`;
    window.open(`https://wa.me/${(boy.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

  return (
    <div className="space-y-10 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">Deliveries</h1>
          <p className="text-slate-500 font-medium mt-1">Global logistics summary and route optimization.</p>
        </div>
        <div className="w-full md:w-64 relative">
          <select 
            className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-sm font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase cursor-pointer"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="All">All Branches</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* 2. GLOBAL KITCHEN LOAD (TODAY) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid size={18} className="text-primary-600" />
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Kitchen Load (Today)</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard title="Total Boxes Today" value={globalDailySummary.GrandTotal} icon={Package} colorClass="bg-slate-900" subtext="All meal sessions" />
          <StatCard title="Breakfast Total" value={globalDailySummary.Breakfast} icon={Sunrise} colorClass="bg-orange-500" subtext="Morning session" />
          <StatCard title="Lunch Total" value={globalDailySummary.Lunch} icon={Sun} colorClass="bg-blue-600" subtext="Afternoon session" />
          <StatCard title="Dinner Total" value={globalDailySummary.Dinner} icon={Moon} colorClass="bg-purple-600" subtext="Night session" />
        </div>
      </div>

      {/* 3. DELIVERY BOY WORKLOAD MATRIX */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <ListChecks size={18} className="text-primary-600" />
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Delivery Boy Workload Matrix</h2>
        </div>
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                <tr>
                  <th className="p-5 pl-8">Delivery Boy Name</th>
                  <th className="p-5 text-center text-orange-600 bg-orange-50/30">Breakfast</th>
                  <th className="p-5 text-center text-blue-600 bg-blue-50/30">Lunch</th>
                  <th className="p-5 text-center text-purple-600 bg-purple-50/30">Dinner</th>
                  <th className="p-5 text-right pr-8">Daily Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryBoyMatrix.map(boy => (
                  <React.Fragment key={boy.id}>
                    <tr 
                      className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${expandedMatrixBoyId === boy.id ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedMatrixBoyId(expandedMatrixBoyId === boy.id ? null : boy.id)}
                    >
                      <td className="p-5 pl-8">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${expandedMatrixBoyId === boy.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-primary-600 group-hover:text-white'}`}>
                            <Truck size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-xs uppercase tracking-tight">{boy.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Click to expand details</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center font-black text-slate-700 bg-orange-50/10">{boy.Breakfast}</td>
                      <td className="p-5 text-center font-black text-slate-700 bg-blue-50/10">{boy.Lunch}</td>
                      <td className="p-5 text-center font-black text-slate-700 bg-purple-50/10">{boy.Dinner}</td>
                      <td className="p-5 text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-block bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-black min-w-[40px] text-center shadow-lg">
                            {boy.Total}
                          </span>
                          {expandedMatrixBoyId === boy.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                    {expandedMatrixBoyId === boy.id && (
                      <tr className="bg-slate-50/30">
                        <td colSpan={5} className="p-6 pl-12">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-1 duration-300">
                            {/* Breakfast Details */}
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5 border-b border-orange-100 pb-2">
                                <Sunrise size={12} /> Breakfast Breakdown
                              </h4>
                              <div className="space-y-2">
                                {Object.values(boy.breakdown.Breakfast).length > 0 ? Object.values(boy.breakdown.Breakfast).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-xs">
                                    <span className="font-bold text-slate-600 flex items-center gap-1 uppercase tracking-tight">
                                      {p.name} {p.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-black text-slate-900 bg-slate-100 px-1.5 rounded">{p.count}</span>
                                  </div>
                                )) : <p className="text-[10px] italic text-slate-400">No Breakfast deliveries</p>}
                              </div>
                            </div>
                            {/* Lunch Details */}
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 border-b border-blue-100 pb-2">
                                <Sun size={12} /> Lunch Breakdown
                              </h4>
                              <div className="space-y-2">
                                {Object.values(boy.breakdown.Lunch).length > 0 ? Object.values(boy.breakdown.Lunch).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-xs">
                                    <span className="font-bold text-slate-600 flex items-center gap-1 uppercase tracking-tight">
                                      {p.name} {p.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-black text-slate-900 bg-slate-100 px-1.5 rounded">{p.count}</span>
                                  </div>
                                )) : <p className="text-[10px] italic text-slate-400">No Lunch deliveries</p>}
                              </div>
                            </div>
                            {/* Dinner Details */}
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1.5 border-b border-purple-100 pb-2">
                                <Moon size={12} /> Dinner Breakdown
                              </h4>
                              <div className="space-y-2">
                                {Object.values(boy.breakdown.Dinner).length > 0 ? Object.values(boy.breakdown.Dinner).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-xs">
                                    <span className="font-bold text-slate-600 flex items-center gap-1 uppercase tracking-tight">
                                      {p.name} {p.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-black text-slate-900 bg-slate-100 px-1.5 rounded">{p.count}</span>
                                  </div>
                                )) : <p className="text-[10px] italic text-slate-400">No Dinner deliveries</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {deliveryBoyMatrix.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">No staff found for current branch.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* 4. Active Route Details */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Route Details</h2>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1">Currently viewing detailed {activeMealTab} data</p>
          </div>
          <div className="bg-slate-100/50 p-1.5 rounded-2xl flex gap-2 w-full md:w-fit shadow-inner">
            {[
              { id: 'Breakfast', icon: Sunrise, color: 'text-orange-600', bg: 'bg-orange-100' },
              { id: 'Lunch', icon: Sun, color: 'text-blue-600', bg: 'bg-blue-100' },
              { id: 'Dinner', icon: Moon, color: 'text-purple-600', bg: 'bg-purple-100' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveMealTab(tab.id as any); setExpandedBoyId(null); }}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeMealTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:bg-white/50'
                }`}
              >
                <tab.icon size={14} className={tab.color} />
                {tab.id}
              </button>
            ))}
          </div>
        </div>

        {/* Existing Session Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title={`${activeMealTab} Customers`} value={sessionMetrics.customers} icon={Users} colorClass="bg-blue-600" subtext="Unique session routes" />
          <StatCard title={`${activeMealTab} Boxes`} value={sessionMetrics.plans} icon={Package} colorClass="bg-primary-600" subtext="Production count" />
          <StatCard title={`${activeMealTab} Starred`} value={sessionMetrics.starPlans} icon={Star} colorClass="bg-amber-600" subtext="Attention required" />
        </div>

        {/* Staff Route List */}
        <div className="space-y-4">
          {deliveriesToday.filter(c => !c.deliveryBoyId).length > 0 && (
            <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-[2.5rem] p-8 mb-8">
              <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center"><UserX size={24} /></div><h3 className="text-xl font-black text-rose-900">Unassigned Customers</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {deliveriesToday.filter(c => !c.deliveryBoyId).map(c => (
                   <div key={c.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex justify-between items-center group">
                      <div><p className="font-black text-slate-900 text-sm uppercase">{c.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{c.area}</p></div>
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowRight size={14} /></div>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch).map(boy => {
            const boyCustomers = deliveriesToday.filter(c => c.deliveryBoyId === boy.id);
            if (boyCustomers.length === 0) return null;
            const isExpanded = expandedBoyId === boy.id;
            let boyTotalBoxes = 0;
            let boyStarBoxes = 0;
            boyCustomers.forEach(c => {
              const cPlans = (c.activePlans || []).filter((ap: any) => ap.mealTime === activeMealTab);
              boyTotalBoxes += cPlans.length;
              boyStarBoxes += cPlans.filter((p: any) => p.isStarred || (c.highlightMark && c.highlightMark !== 'None')).length;
            });

            return (
              <div key={boy.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all">
                <div onClick={() => setExpandedBoyId(isExpanded ? null : boy.id)} className={`p-6 flex flex-col xl:flex-row justify-between items-center cursor-pointer gap-6 ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}`}>
                  <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><Truck size={28} /></div>
                    <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{boy.name}</h3><p className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mt-0.5"><Phone size={14}/> {boy.mobile}</p></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto flex-1 md:flex-none">
                    <div className="bg-white border border-slate-100 p-2.5 rounded-xl text-center shadow-xs">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Customers</p><p className="font-black text-slate-900">{boyCustomers.length}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-2.5 rounded-xl text-center shadow-xs">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Total Boxes</p><p className="font-black text-primary-600">{boyTotalBoxes}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-2.5 rounded-xl text-center shadow-xs">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Normal</p><p className="font-black text-slate-600">{boyTotalBoxes - boyStarBoxes}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-2.5 rounded-xl text-center shadow-xs">
                      <p className="text-[8px] font-black text-amber-600 uppercase mb-0.5">Starred</p><p className="font-black text-amber-700">{boyStarBoxes}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full xl:w-auto">
                    <button onClick={(e) => { e.stopPropagation(); handleShareRoute(boy, boyCustomers); }} className="flex-1 xl:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"><MessageSquare size={16} fill="currentColor" /> Share Route</button>
                    <div className={`p-2 rounded-xl border ${isExpanded ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400'}`}>{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                          <tr><th className="p-4 w-12 text-center">Seq</th><th className="p-4 w-20 text-center">Move</th><th className="p-4">Customer</th><th className="p-4">Number</th><th className="p-4 min-w-[200px]">Plans (Quantity)</th><th className="p-4 text-center">Star</th><th className="p-4">Area / Address</th><th className="p-4 text-center">Days Left</th><th className="p-4 text-center">Location</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {boyCustomers.sort((a, b) => (a.routeOrder || 999) - (b.routeOrder || 999)).map((c, idx) => {
                              const sessionPlans = (c.activePlans || []).filter((ap: any) => ap.mealTime === activeMealTab);
                              const groupedPlans = sessionPlans.reduce((acc: any, p: any) => {
                                 acc[p.planName] = acc[p.planName] || { name: p.planName, count: 0, isStarred: p.isStarred, pConfig: plans.find(pc => pc.id === p.planId), endDate: p.endDate, pauses: p.pauses };
                                 acc[p.planName].count++;
                                 if (p.isStarred) acc[p.planName].isStarred = true;
                                 return acc;
                              }, {});
                              const overallStarred = sessionPlans.some((p: any) => p.isStarred) || (c.highlightMark && c.highlightMark !== 'None');
                              return (
                                <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${overallStarred ? 'bg-amber-50/20' : ''}`}>
                                  <td className="p-4 text-center font-black text-slate-300">{idx + 1}</td>
                                  <td className="p-4"><div className="flex items-center justify-center gap-1"><button onClick={() => handleMoveOrder(c.id, 'up')} className="p-1 hover:bg-slate-200 rounded text-slate-400"><ArrowUp size={14}/></button><button onClick={() => handleMoveOrder(c.id, 'down')} className="p-1 hover:bg-slate-200 rounded text-slate-400"><ArrowDown size={14}/></button></div></td>
                                  <td className="p-4"><div className="flex items-center gap-2"><span className="font-black text-slate-900 text-sm truncate max-w-[140px] uppercase">{c.name}</span>{overallStarred && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}</div></td>
                                  <td className="p-4 font-mono text-[10px] text-slate-500">{c.mobile}</td>
                                  <td className="p-4"><div className="space-y-1.5">{Object.values(groupedPlans).map((gp: any, i) => (<div key={i} className="flex items-center justify-between gap-4 bg-white border border-slate-100 p-1.5 rounded-lg shadow-xs"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px] uppercase">{gp.name}</span>{gp.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}</div><span className="bg-slate-900 text-white text-[10px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0">{gp.count}</span></div>))}</div></td>
                                  <td className="p-4 text-center">{overallStarred ? <Star size={16} className="text-amber-500 mx-auto" fill="currentColor" /> : <span className="text-slate-200">—</span>}</td>
                                  <td className="p-4"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">{c.area}</p><p className="text-xs font-bold text-slate-600 truncate">{c.address}</p></div></td>
                                  <td className="p-4 text-center"><div className="space-y-1">{Object.values(groupedPlans).map((gp: any, i) => (<div key={i} className="text-[10px] font-black text-slate-900 bg-slate-50 border border-slate-100 rounded py-0.5 px-1">{calculateRemainingDeliveries(gp.endDate, gp.pConfig?.weekdays || [], gp.pauses || [])}</div>))}</div></td>
                                  <td className="p-4 text-center">{c.locationLink ? (<a href={c.locationLink.startsWith('http') ? c.locationLink : `https://${c.locationLink}`} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors inline-flex"><ExternalLink size={16} /></a>) : (<span className="text-slate-200">—</span>)}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {deliveriesToday.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm"><div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6 border-4 border-dashed border-slate-100"><Truck size={48} /></div><h3 className="text-2xl font-black text-slate-900 uppercase">No deliveries scheduled</h3><p className="text-slate-500 mt-2 max-w-sm mx-auto font-medium">There are no active plans for the {activeMealTab} session today.</p></div>
        )}
      </div>

    </div>
  );
};

export default Deliveries;