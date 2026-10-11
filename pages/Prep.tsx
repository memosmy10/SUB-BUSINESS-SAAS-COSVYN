
import React, { useState, useMemo } from 'react';
import { 
  ChefHat, Calendar, Sunrise, Sun, Moon, Loader2, 
  Info, Star, Users, Package, CheckCircle2, Clock, ChevronDown, Store
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';
import { GlobalCustomer, GlobalPlan, getTodayStr, isPlanActiveOnDate, shiftDateStr } from '../services/store';

const Prep = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<GlobalCustomer>('customers');
  const { data: plansArr = [], loading: l2 } = useStreamCollection<GlobalPlan>('plans');
  const { data: singleOrders = [], loading: l3 } = useStreamCollection<any>('single_orders');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2 || l3 || l4;

  const [selectedBranch, setSelectedBranch] = useState('All');

  // Auto-lock branch if single branch is available (e.g. for branch manager)
  React.useEffect(() => {
    if (branches.length === 1 && selectedBranch !== branches[0].id) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  const todayStr = getTodayStr();
  const tomorrowStr = shiftDateStr(todayStr, 1);

  const getPrepData = (targetDate: string) => {
    const [y, m, d] = targetDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay();
    
    // Breakdowns
    const normalSummary: any = { Breakfast: {}, Lunch: {}, Dinner: {} };
    const starredSummary: any = { Breakfast: {}, Lunch: {}, Dinner: {} };
    const sessionTotals: any = { Breakfast: 0, Lunch: 0, Dinner: 0 };
    
    const specialRequests: any[] = [];
    const activeCustomerIds = new Set<string>();
    
    let totalNormalBoxes = 0;
    let totalStarredBoxes = 0;

    // 1. Process Subscription Plans
    customers.filter(c => {
      const branchMatch = selectedBranch === 'All' || c.branchId === selectedBranch;
      return branchMatch;
    }).forEach(c => {
      let customerHasMealOnThisDate = false;

      (c.activePlans || []).forEach(ap => {
        const planConfig = plansArr.find(p => p.id === ap.planId);

        if (isPlanActiveOnDate(ap, targetDate, planConfig)) {
          const time = ap.mealTime;
          const isStarred = Boolean(ap.isStarred || (c.highlightMark && c.highlightMark !== 'None'));
          const qty = Number(ap.quantity) || 1;
          
          sessionTotals[time] = (sessionTotals[time] || 0) + qty;
          customerHasMealOnThisDate = true;

          if (isStarred) {
            totalStarredBoxes += qty;
            starredSummary[time][ap.planName] = (starredSummary[time][ap.planName] || 0) + qty;
            specialRequests.push({
              id: `${c.id}-${time}-${ap.planId}`,
              name: c.name,
              time: ap.mealTime,
              note: c.notes || 'Standard Preparation',
              type: 'Subscription',
              tag: c.highlightMark || 'Special',
              plan: ap.planName,
              isStarred: true
            });
          } else {
            totalNormalBoxes += qty;
            normalSummary[time][ap.planName] = (normalSummary[time][ap.planName] || 0) + qty;
          }
        }
      });

      if (customerHasMealOnThisDate) {
        activeCustomerIds.add(c.id);
      }
    });

    // 2. Process Single Orders
    singleOrders.forEach(o => {
      const branchMatch = selectedBranch === 'All' || o.branchId === selectedBranch;
      if (o.date === targetDate && branchMatch) {
        const time = (o.time || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
        sessionTotals[time]++;
        
        // Single orders are treated as starred/special by default in this context
        totalStarredBoxes++;
        starredSummary[time]['Single Orders'] = (starredSummary[time]['Single Orders'] || 0) + 1;
        
        activeCustomerIds.add(o.customerName); 
        
        specialRequests.push({
          id: o.id,
          name: o.customerName,
          time: o.time,
          note: `ORDER: ${o.item}`,
          type: 'Single Order',
          tag: 'Urgent',
          plan: 'Direct Item',
          isStarred: true
        });
      }
    });

    return { 
      normalSummary,
      starredSummary,
      totals: sessionTotals,
      special: specialRequests,
      totalCustomers: activeCustomerIds.size,
      totalNormalBoxes,
      totalStarredBoxes,
      grandTotal: totalNormalBoxes + totalStarredBoxes
    };
  };

  const todayPrep = useMemo(() => getPrepData(todayStr), [customers, plansArr, singleOrders, todayStr, selectedBranch]);
  const tomorrowPrep = useMemo(() => getPrepData(tomorrowStr), [customers, plansArr, singleOrders, tomorrowStr, selectedBranch]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* Header with Branch Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ChefHat className="text-primary-600" size={32} /> Kitchen Preparation Hub
          </h1>
          <p className="text-slate-500 font-medium mt-1">Production summaries for today and tomorrow.</p>
        </div>

        <div className="relative w-full md:w-64">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Store size={18} />
          </div>
          <select 
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none transition-all cursor-pointer hover:border-slate-300"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.length > 1 && <option value="All">All Branches</option>}
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {/* Main Production Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <PrepCard 
          title="Daily Prep" 
          dateLabel="Today" 
          dateValue={todayStr} 
          data={todayPrep} 
          themeColor="primary"
        />
        <PrepCard 
          title="Tomorrow's Plan" 
          dateLabel="Tomorrow" 
          dateValue={tomorrowStr} 
          data={tomorrowPrep} 
          themeColor="slate"
        />
      </div>

      {/* Checklist Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
           <Star className="text-amber-500" fill="currentColor" size={24} />
           <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Special Preparation Checklist</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <SpecialList title="Today's Specials" list={todayPrep.special} dateLabel={todayStr} />
           <SpecialList title="Tomorrow's Specials" list={tomorrowPrep.special} dateLabel={tomorrowStr} />
        </div>
      </div>

    </div>
  );
};

const PrepCard = ({ title, dateLabel, dateValue, data, themeColor }: any) => {
  const isPrimary = themeColor === 'primary';
  
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header Row */}
      <div className={`p-8 pb-6 flex justify-between items-start ${isPrimary ? 'bg-primary-50/30' : 'bg-slate-50/50'}`}>
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span className={isPrimary ? 'text-primary-600' : 'text-slate-600'}>
              {isPrimary ? <UtensilsIcon /> : <ClockIcon />}
            </span> 
            {title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{dateLabel}</span>
             <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-400">{dateValue}</span>
          </div>
        </div>
        <div className={`px-5 py-2.5 rounded-2xl font-black text-lg border shadow-md ${isPrimary ? 'bg-primary-600 text-white border-primary-700' : 'bg-slate-800 text-white border-slate-900'}`}>
          {data.grandTotal} Boxes
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4 px-8 mb-8">
         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Users size={10}/> Active Customers
            </p>
            <p className="text-2xl font-black text-slate-900">{data.totalCustomers}</p>
         </div>
         <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Package size={10}/> Normal Plans
            </p>
            <p className="text-2xl font-black text-blue-700">{data.totalNormalBoxes}</p>
         </div>
         <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Star size={10} fill="currentColor"/> Starred Plans
            </p>
            <p className="text-2xl font-black text-amber-700">{data.totalStarredBoxes}</p>
         </div>
      </div>

      {/* Normal Breakdown Row */}
      <div className="px-8 mb-4">
         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            Normal Preparation Summary
         </h4>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MealSlot 
              icon={Sunrise} 
              type="Breakfast" 
              plans={data.normalSummary.Breakfast} 
              color="text-yellow-500" 
              bg="bg-yellow-50/40" 
            />
            <MealSlot 
              icon={Sun} 
              type="Lunch" 
              plans={data.normalSummary.Lunch} 
              color="text-orange-500" 
              bg="bg-orange-50/40" 
            />
            <MealSlot 
              icon={Moon} 
              type="Dinner" 
              plans={data.normalSummary.Dinner} 
              color="text-indigo-500" 
              bg="bg-indigo-50/40" 
            />
         </div>
      </div>

      {/* Starred Breakdown Row */}
      <div className="px-8 pb-10">
         <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mt-6 mb-4 flex items-center gap-2">
            <Star size={12} fill="currentColor" /> Starred Preparation Summary
         </h4>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MealSlot 
              icon={Sunrise} 
              type="Breakfast" 
              plans={data.starredSummary.Breakfast} 
              color="text-amber-500" 
              bg="bg-amber-50/50" 
              isStarred
            />
            <MealSlot 
              icon={Sun} 
              type="Lunch" 
              plans={data.starredSummary.Lunch} 
              color="text-amber-500" 
              bg="bg-amber-50/50" 
              isStarred
            />
            <MealSlot 
              icon={Moon} 
              type="Dinner" 
              plans={data.starredSummary.Dinner} 
              color="text-amber-500" 
              bg="bg-amber-50/50" 
              isStarred
            />
         </div>
      </div>
    </div>
  );
};

const MealSlot = ({ icon: Icon, type, plans, color, bg, isStarred }: any) => {
  const totalInSlot = Object.values(plans || {}).reduce((a: any, b: any) => a + b, 0);

  return (
    <div className={`p-4 rounded-[1.5rem] border border-slate-100 flex flex-col min-h-[140px] ${bg}`}>
      <div className="flex justify-between items-center mb-3">
        <div className={`p-2 bg-white rounded-xl shadow-xs ${color}`}><Icon size={16} /></div>
        <div className={`font-black text-lg ${isStarred ? 'text-amber-700' : 'text-slate-900'}`}>{totalInSlot}</div>
      </div>
      <div className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">{type}</div>
      <div className="space-y-2 overflow-y-auto max-h-[100px] no-scrollbar">
        {Object.entries(plans || {}).map(([name, qty]: any) => (
          <div key={name} className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-bold truncate pr-2">{name}</span>
            <span className={`font-black ${isStarred ? 'text-amber-600' : 'text-slate-900'}`}>{qty}</span>
          </div>
        ))}
        {totalInSlot === 0 && (
          <div className="text-[9px] text-slate-300 italic py-2">Nothing to prep</div>
        )}
      </div>
    </div>
  );
};

const SpecialList = ({ title, list, dateLabel }: any) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
     <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest">{title}</h3>
        <span className="text-[10px] font-bold text-slate-400 font-mono">{dateLabel}</span>
     </div>
     <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
        {list.length > 0 ? list.map((item: any) => (
          <div key={item.id} className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border-l-4 border-l-amber-400">
             <div className="flex justify-between items-start mb-2">
                <div>
                   <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                   <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase ${
                        item.time === 'Breakfast' ? 'bg-yellow-50 text-yellow-600' :
                        item.time === 'Lunch' ? 'bg-orange-50 text-orange-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        {item.time}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{item.plan}</span>
                   </div>
                </div>
                <div className="flex gap-1">
                   <Star size={12} className="text-amber-500" fill="currentColor" />
                   <span className={`text-[7px] font-black px-1 rounded-sm uppercase ${
                      item.tag === 'Urgent' ? 'bg-red-500 text-white' : 
                      item.tag === 'Dietary' ? 'bg-emerald-500 text-white' : 
                      'bg-primary-600 text-white'
                   }`}>{item.tag}</span>
                </div>
             </div>
             
             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <Info size={10}/> Chef's Note
                </p>
                <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                   "{item.note}"
                </p>
             </div>

             <div className="mt-3 flex justify-between items-center text-[8px] font-black text-slate-300 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Clock size={8}/> {item.type}</span>
                <CheckCircle2 size={14} className="group-hover:text-emerald-500 transition-colors cursor-pointer" />
             </div>
          </div>
        )) : (
          <div className="text-center py-10">
             <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-slate-200" />
             </div>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">All Standard Prep</p>
          </div>
        )}
     </div>
  </div>
);

// Helpers
const UtensilsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
);
const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default Prep;
