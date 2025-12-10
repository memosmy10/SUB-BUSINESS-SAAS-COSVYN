
import React, { useState, useMemo } from 'react';
import { 
  Truck, Package, MapPin, ChevronDown, ChevronUp, 
  Share2, Loader2, ArrowUp, ArrowDown, Phone, Calendar, Sunrise, Sun, Moon, Layers
} from 'lucide-react';
import { useStreamCollection, updateItem } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { calculateRemainingDeliveries, isDeliveryDay } from '../services/store';

// Extracted Component to keep Render Pure and Clean
const DeliveryBoyCard = ({ 
  boy, 
  orders, 
  plans, 
  activeTab, 
  isExpanded, 
  onToggle, 
  onShare, 
  onMoveOrder 
}: any) => {
  
  // Calculate Breakdown for this specific delivery boy
  const breakdown = useMemo(() => {
     const data = {
        Breakfast: { count: 0, plans: {} as Record<string, number> },
        Lunch: { count: 0, plans: {} as Record<string, number> },
        Dinner: { count: 0, plans: {} as Record<string, number> },
     };

     orders.forEach((o: any) => {
        const meal = (o.mealTime || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
        const planName = plans.find((p: any) => p.id === o.planId)?.name || 'Unknown';
        
        if (data[meal]) {
           data[meal].count++;
           data[meal].plans[planName] = (data[meal].plans[planName] || 0) + 1;
        }
     });
     return data;
  }, [orders, plans]);

  // If no orders for the *active tab*, we shouldn't have reached here if parent filters correctly,
  // but if we show all boys and just empty state:
  const currentTabOrders = orders.filter((o: any) => (o.mealTime || 'Lunch') === activeTab);
  
  if (currentTabOrders.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all">
      <div 
         className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`} 
         onClick={() => onToggle(boy.id)}
      >
         <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${isExpanded ? 'bg-slate-200 text-slate-700' : 'bg-primary-50 text-primary-600'}`}>
               <Truck size={20}/>
            </div>
            <div>
               <h3 className="font-bold text-slate-900 text-lg">{boy.name}</h3>
               <div className="text-sm text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                     {activeTab}: <span className="bg-slate-100 px-2 rounded-full">{currentTabOrders.length} Orders</span>
                  </span>
                  <span className="flex items-center gap-1"><Phone size={14}/> {boy.mobile}</span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-3">
            {isExpanded && (
               <button 
                  onClick={(e) => onShare(e, boy, currentTabOrders)}
                  className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
               >
                  <Share2 size={16}/> WhatsApp
               </button>
            )}
            <div className="text-slate-400">{isExpanded ? <ChevronUp/> : <ChevronDown/>}</div>
         </div>
      </div>
      
      {isExpanded && (
         <div className="border-t border-slate-200">
            {/* Mobile Share Button */}
            <div className="sm:hidden p-4 pb-0">
               <button 
                  onClick={(e) => onShare(e, boy, currentTabOrders)}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg font-bold"
               >
                  <Share2 size={16}/> Share WhatsApp Route
               </button>
            </div>

            <div className="overflow-x-auto p-4">
               <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                     <tr>
                        <th className="p-3 rounded-l-lg w-16 text-center">Seq</th>
                        <th className="p-3 w-16 text-center">Move</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Number</th>
                        <th className="p-3">Plan</th>
                        <th className="p-3">Address & Area</th>
                        <th className="p-3 text-center rounded-r-lg">Days Left</th>
                     </tr>
                  </thead>
                  <tbody className="text-sm">
                     {currentTabOrders.map((order:any, idx:number) => {
                        const plan = plans.find((p: any) => p.id === order.planId);
                        const weekdays = plan ? plan.weekdays : [0,1,2,3,4,5,6];
                        const daysLeft = calculateRemainingDeliveries(order.endDate, weekdays);
                        const isFirst = idx === 0;
                        const isLast = idx === currentTabOrders.length - 1;

                        return (
                           <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">
                              <td className="p-3 text-center font-bold text-slate-400 bg-slate-50/50">{idx + 1}</td>
                              
                              {/* REORDER BUTTONS */}
                              <td className="p-3 text-center">
                                 <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button disabled={isFirst} onClick={(e) => onMoveOrder(e, currentTabOrders, idx, 'up')} className="hover:text-blue-600 disabled:text-slate-300 p-1 rounded hover:bg-blue-50"><ArrowUp size={16}/></button>
                                    <button disabled={isLast} onClick={(e) => onMoveOrder(e, currentTabOrders, idx, 'down')} className="hover:text-blue-600 disabled:text-slate-300 p-1 rounded hover:bg-blue-50"><ArrowDown size={16}/></button>
                                 </div>
                              </td>

                              <td className="p-3 font-bold text-slate-900">{order.name}</td>
                              <td className="p-3 font-mono text-slate-600">{order.mobile}</td>
                              <td className="p-3">
                                 <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                                    {plan?.name || 'Unknown'}
                                 </span>
                              </td>
                              <td className="p-3 max-w-[250px] text-slate-600">
                                 <div className="flex items-start gap-1">
                                    <MapPin size={14} className="shrink-0 text-slate-400 mt-0.5"/> 
                                    <span className="line-clamp-2">{order.address}, {order.area}</span>
                                 </div>
                              </td>
                              <td className="p-3 text-center">
                                 <span className={`font-bold ${daysLeft <= 3 ? 'text-red-500' : 'text-slate-700'}`}>
                                    {daysLeft}
                                 </span>
                              </td>
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
};

const Deliveries = () => {
  const { currentUser } = useAuth();

  // Data Fetching
  const { data: customers, loading: l1 } = useStreamCollection<any>('customers');
  const { data: staff, loading: l2 } = useStreamCollection<any>('staff');
  const { data: branches, loading: l3 } = useStreamCollection<any>('branches');
  const { data: plans, loading: l4 } = useStreamCollection<any>('plans');

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [activeTab, setActiveTab] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch'); 
  const [expandedBoyId, setExpandedBoyId] = useState<string | null>(null);

  // Filter Data
  const filteredStaff = useMemo(() => 
    staff.filter((s:any) => selectedBranch === 'All' || s.branchId === selectedBranch),
  [staff, selectedBranch]);
  
  // Filter ACTIVE customers for TODAY'S delivery
  const activeCustomers = useMemo(() => {
    const today = new Date();
    
    return customers.filter((c:any) => {
       if (!c.isActive) return false;
       if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;

       // Find Plan to check weekdays & remaining days
       const plan = plans.find((p:any) => p.id === c.planId);
       if (!plan) return false;

       const weekdays = plan.weekdays || [0,1,2,3,4,5,6];
       
       // 1. Check if Today is a delivery day
       if (!isDeliveryDay(today, weekdays)) return false;

       // 2. Check if remaining deliveries > 0
       const remaining = calculateRemainingDeliveries(c.endDate, weekdays);
       return remaining > 0;
    });
  }, [customers, selectedBranch, plans]);

  // --- STATS CALCULATIONS ---
  const stats = useMemo(() => {
    const data = {
      Breakfast: { count: 0, plans: {} as Record<string, number> },
      Lunch: { count: 0, plans: {} as Record<string, number> },
      Dinner: { count: 0, plans: {} as Record<string, number> },
      Total: activeCustomers.length
    };

    activeCustomers.forEach((c: any) => {
      const meal = (c.mealTime || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
      const planName = plans.find((p: any) => p.id === c.planId)?.name || 'Unknown';

      if (data[meal]) {
        data[meal].count++;
        data[meal].plans[planName] = (data[meal].plans[planName] || 0) + 1;
      }
    });

    return data;
  }, [activeCustomers, plans]);

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  // --- ACTIONS ---

  const handleMoveOrder = async (e: React.MouseEvent, list: any[], index: number, direction: 'up' | 'down') => {
    e.stopPropagation();
    if (!currentUser) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const itemCurrent = list[index];
    const itemTarget = list[targetIndex];

    const newOrderCurrent = targetIndex + 1;
    const newOrderTarget = index + 1;

    await Promise.all([
      updateItem(currentUser.uid, 'customers', itemCurrent.id, { routeOrder: newOrderCurrent }),
      updateItem(currentUser.uid, 'customers', itemTarget.id, { routeOrder: newOrderTarget })
    ]);
  };

  const handleShareRoute = (e: React.MouseEvent, boy: any, orders: any[]) => {
    e.stopPropagation();
    const header = `🚚 *${activeTab} Route - ${boy.name}*\n📅 ${todayDate}\n------------------\n`;
    const body = orders.map((o, i) => {
       const planName = plans.find((p: any) => p.id === o.planId)?.name || 'Plan';
       return `${i+1}. *${o.name}* (${planName})\n   📍 ${o.address}, ${o.area}\n   📞 ${o.mobile}`;
    }).join('\n\n');
    const footer = `\n------------------\nTotal Boxes: ${orders.length}`;
    const text = encodeURIComponent(header + body + footer);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (l1 || l2 || l3 || l4) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-20">
      
      {/* HEADER & BRANCH FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">Deliveries</h1>
            <p className="text-slate-500">Daily packing and route management.</p>
         </div>
         <select className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
            <option value="All">All Branches</option>
            {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
         </select>
      </div>

      {/* TOP WIDGETS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
         {/* WIDGET 1: TOTAL SUMMARY */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start z-10">
               <div>
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Orders Today</div>
                  <div className="text-4xl font-extrabold text-slate-900">{stats.Total}</div>
                  <div className="flex items-center gap-1 text-sm text-slate-500 mt-1 font-medium">
                     <Calendar size={14}/> {todayDate}
                  </div>
               </div>
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Package size={24}/></div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 z-10">
               <div className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs font-bold">B: {stats.Breakfast.count}</div>
               <div className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-bold">L: {stats.Lunch.count}</div>
               <div className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">D: {stats.Dinner.count}</div>
            </div>
         </div>

         {/* WIDGET 2: DETAILED BREAKDOWN (Plans) */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-3">
               <span className="text-xs font-bold uppercase text-slate-400">Plan Breakdown</span>
               <Layers size={16} className="text-slate-300"/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs h-full">
               
               {/* Breakfast Column */}
               <div className="bg-yellow-50/50 rounded-lg p-2 border border-yellow-100">
                  <div className="font-bold text-yellow-800 mb-1 flex items-center gap-1"><Sunrise size={10}/> Breakfast</div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                     {Object.entries(stats.Breakfast.plans).map(([plan, count]) => (
                        <div key={plan} className="flex justify-between text-slate-600">
                           <span className="truncate pr-1">{plan}</span> <b>{count}</b>
                        </div>
                     ))}
                     {stats.Breakfast.count === 0 && <div className="italic text-slate-400">-</div>}
                  </div>
               </div>

               {/* Lunch Column */}
               <div className="bg-orange-50/50 rounded-lg p-2 border border-orange-100">
                  <div className="font-bold text-orange-800 mb-1 flex items-center gap-1"><Sun size={10}/> Lunch</div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                     {Object.entries(stats.Lunch.plans).map(([plan, count]) => (
                        <div key={plan} className="flex justify-between text-slate-600">
                           <span className="truncate pr-1">{plan}</span> <b>{count}</b>
                        </div>
                     ))}
                     {stats.Lunch.count === 0 && <div className="italic text-slate-400">-</div>}
                  </div>
               </div>

               {/* Dinner Column */}
               <div className="bg-indigo-50/50 rounded-lg p-2 border border-indigo-100">
                  <div className="font-bold text-indigo-800 mb-1 flex items-center gap-1"><Moon size={10}/> Dinner</div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                     {Object.entries(stats.Dinner.plans).map(([plan, count]) => (
                        <div key={plan} className="flex justify-between text-slate-600">
                           <span className="truncate pr-1">{plan}</span> <b>{count}</b>
                        </div>
                     ))}
                     {stats.Dinner.count === 0 && <div className="italic text-slate-400">-</div>}
                  </div>
               </div>

            </div>
         </div>

         {/* WIDGET 3: DELIVERY STAFF */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
               <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Delivery Boys</div>
               <div className="text-3xl font-bold text-slate-900">{filteredStaff.length}</div>
               <div className="text-sm text-slate-500 mt-1">Available for assignment</div>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Truck size={24}/></div>
         </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full md:w-fit">
         {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
            <button
               key={meal}
               onClick={() => setActiveTab(meal as any)}
               className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === meal 
                     ? meal === 'Breakfast' ? 'bg-yellow-100 text-yellow-800' 
                     : meal === 'Lunch' ? 'bg-orange-100 text-orange-800' 
                     : 'bg-indigo-100 text-indigo-800'
                     : 'text-slate-500 hover:bg-slate-50'
               }`}
            >
               {meal === 'Breakfast' && <Sunrise size={16}/>}
               {meal === 'Lunch' && <Sun size={16}/>}
               {meal === 'Dinner' && <Moon size={16}/>}
               {meal}
            </button>
         ))}
      </div>

      {/* DELIVERY LIST */}
      <div className="space-y-4">
         {filteredStaff.map((boy: any) => {
            // Filter orders for this specific boy
            const boyOrders = activeCustomers
               .filter((c:any) => c.deliveryBoyId === boy.id)
               .sort((a: any, b: any) => (a.routeOrder || 999) - (b.routeOrder || 999));
            
            return (
               <DeliveryBoyCard
                  key={boy.id}
                  boy={boy}
                  orders={boyOrders}
                  plans={plans}
                  activeTab={activeTab}
                  isExpanded={expandedBoyId === boy.id}
                  onToggle={(id: string) => setExpandedBoyId(expandedBoyId === id ? null : id)}
                  onShare={handleShareRoute}
                  onMoveOrder={handleMoveOrder}
               />
            );
         })}
         
         {/* Empty State Check */}
         {!filteredStaff.some((boy: any) => 
            activeCustomers.some((c:any) => c.deliveryBoyId === boy.id && c.mealTime === activeTab)
         ) && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
               <div className="inline-flex p-4 bg-slate-50 rounded-full mb-3 text-slate-400">
                  <Package size={32} />
               </div>
               <h3 className="text-lg font-bold text-slate-900">No {activeTab} Orders</h3>
               <p className="text-slate-500">No active orders scheduled for {activeTab} today.</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default Deliveries;
