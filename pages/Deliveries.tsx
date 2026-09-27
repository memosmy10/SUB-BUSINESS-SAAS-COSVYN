import React, { useState, useMemo } from 'react';
import { 
  Truck, Package, MapPin, ChevronDown, ChevronUp, 
  Loader2, ArrowUp, ArrowDown, Phone,
  Sunrise, Sun, Moon, Star, CheckCircle2, UserX, 
  ArrowRight, MessageSquare, ClipboardList, ExternalLink, Users, LayoutGrid, ListChecks,
  Compass, Navigation, Sparkles, Zap, RotateCcw, Share2, Smartphone, Activity,
  Calendar, X
} from 'lucide-react';
import { useStreamCollection, updateItem } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { calculateRemainingDeliveries, getTodayStr, getPlanDeliveryDayNumber, getCustomerUncollectedBoxesCount } from '../services/store';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RouteOptimizerModal } from '../components/RouteOptimizerModal';
import { ShareDriverLinkModal } from '../components/ShareDriverLinkModal';
import { ReusableBoxTracker } from '../components/ReusableBoxTracker';
import { LiveFleetTracker } from '../components/LiveFleetTracker';
import { optimizeRouteOrder, formatWhatsAppOptimizedRoute } from '../services/routeOptimizer';

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
  <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all min-h-[110px]">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 mt-0.5">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 backdrop-blur-xs`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="mt-2">
      <p className="text-xs text-slate-400 font-medium truncate">{subtext}</p>
    </div>
  </div>
);

const Deliveries = () => {
  const { currentUser } = useAuth();
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: staff = [], loading: l2 } = useStreamCollection<any>('staff');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');
  const { data: deliveryLogs = [] } = useStreamCollection<any>('delivery_logs');

  const [mainTab, setMainTab] = useState<'routes' | 'boxes' | 'fleet'>('routes');
  const [activeMealTab, setActiveMealTab] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [expandedBoyId, setExpandedBoyId] = useState<string | null>(null);
  const [expandedMatrixBoyId, setExpandedMatrixBoyId] = useState<string | null>(null);
  const [optimizerModalData, setOptimizerModalData] = useState<{ boy: any; customers: any[]; branch: any } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedShareBoy, setSelectedShareBoy] = useState<any>(null);

  // DATE SELECTOR STATE (Default: Today's date)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [optimizeAllSuccess, setOptimizeAllSuccess] = useState<string | null>(null);

  const isLoading = l1 || l2 || l3 || l4;

  const todayStr = getTodayStr();
  const isSelectedToday = selectedDate === todayStr;

  // Derive Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat) from selectedDate
  const targetDayOfWeek = useMemo(() => {
    const parts = selectedDate.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    }
    return new Date().getDay();
  }, [selectedDate]);

  const handleShiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  };

  // Map of selected date's delivery status by customer and mealTime
  const dateLogsMap = useMemo(() => {
    const map: Record<string, any> = {};
    deliveryLogs.forEach((l: any) => {
      if (l.date === selectedDate) {
        map[`${l.customerId}_${l.mealTime}`] = l;
      }
    });
    return map;
  }, [deliveryLogs, selectedDate]);

  // Overall uncollected boxes count across customers
  const totalUncollectedBoxes = useMemo(() => {
    return customers.reduce((sum, c) => sum + getCustomerUncollectedBoxesCount(c), 0);
  }, [customers]);

  // Online delivery boys count
  const onlineStaffCount = useMemo(() => {
    return staff.filter(s => s.status === 'Online' && s.lastAttendanceDate === selectedDate).length;
  }, [staff, selectedDate]);

  // --- GLOBAL KITCHEN LOAD (FOR SELECTED DATE) ---
  const globalDailySummary = useMemo(() => {
    const stats = { Breakfast: 0, Lunch: 0, Dinner: 0, GrandTotal: 0 };
    
    customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      return true;
    }).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        
        const isPaused = ap.pauses?.some((p: any) => selectedDate >= p.start && selectedDate <= p.end);
        const isValidDay = weekdays.includes(targetDayOfWeek);
        const isWithinRange = selectedDate >= ap.startDate && selectedDate <= ap.endDate;
        
        if (isWithinRange && isValidDay && !isPaused) {
          if (ap.mealTime === 'Breakfast') stats.Breakfast++;
          if (ap.mealTime === 'Lunch') stats.Lunch++;
          if (ap.mealTime === 'Dinner') stats.Dinner++;
          stats.GrandTotal++;
        }
      });
    });

    return stats;
  }, [customers, plans, selectedBranch, selectedDate, targetDayOfWeek]);

  // --- DELIVERY BOY WISE WORKLOAD MATRIX FOR SELECTED DATE ---
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
          
          const isPaused = ap.pauses?.some((p: any) => selectedDate >= p.start && selectedDate <= p.end);
          const isValidDay = weekdays.includes(targetDayOfWeek);
          const isWithinRange = selectedDate >= ap.startDate && selectedDate <= ap.endDate;
          
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
  }, [customers, plans, staff, selectedBranch, selectedDate, targetDayOfWeek]);

  // 1. Filter customers scheduled for SELECTED DATE and current Meal Session
  const deliveriesToday = useMemo(() => {
    return customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      
      const mealPlansToday = (c.activePlans || []).filter((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        
        const isPaused = ap.pauses?.some((p: any) => selectedDate >= p.start && selectedDate <= p.end);
        const isValidDay = weekdays.includes(targetDayOfWeek);
        const isWithinRange = selectedDate >= ap.startDate && selectedDate <= ap.endDate;
        const matchesMeal = ap.mealTime === activeMealTab;
        
        return isWithinRange && isValidDay && !isPaused && matchesMeal;
      });

      return mealPlansToday.length > 0;
    });
  }, [customers, plans, activeMealTab, selectedBranch, selectedDate, targetDayOfWeek]);

  // Session metrics for selected date
  const sessionMetrics = useMemo(() => {
    let totalBoxes = 0;
    let totalStarBoxes = 0;
    deliveriesToday.forEach(c => {
      const sessionPlans = (c.activePlans || []).filter((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        const weekdays = planConfig?.weekdays || ap.weekdays || [1,2,3,4,5,6];
        const isPaused = ap.pauses?.some((p: any) => selectedDate >= p.start && selectedDate <= p.end);
        return ap.mealTime === activeMealTab && weekdays.includes(targetDayOfWeek) && selectedDate >= ap.startDate && selectedDate <= ap.endDate && !isPaused;
      });
      totalBoxes += sessionPlans.length;
      totalStarBoxes += sessionPlans.filter((p: any) => p.isStarred || (c.highlightMark && c.highlightMark !== 'None')).length;
    });
    return { customers: deliveriesToday.length, plans: totalBoxes, starPlans: totalStarBoxes };
  }, [deliveriesToday, activeMealTab, plans, selectedDate, targetDayOfWeek]);

  const handleMoveOrder = async (customerId: string, direction: 'up' | 'down') => {
    if (!currentUser) return;
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    const newOrder = direction === 'up' ? (cust.routeOrder || 0) - 1 : (cust.routeOrder || 0) + 1;
    await updateItem(currentUser.uid, 'customers', customerId, { routeOrder: Math.max(0, newOrder) });
  };

  const handleOpenOptimizer = (boy: any, boyCustomers: any[]) => {
    // Find boy's branch or fallback to selected branch or first branch
    const branch = branches.find((b: any) => b.id === boy.branchId) || 
                   branches.find((b: any) => b.id === selectedBranch) || 
                   branches[0] || { name: 'Main Kitchen Hub' };
    
    setOptimizerModalData({
      boy,
      customers: boyCustomers,
      branch
    });
  };

  const handleApplyOptimizedOrder = async (orderedCustomerIds: string[]) => {
    if (!currentUser || orderedCustomerIds.length === 0) return;
    const batch = writeBatch(db);
    orderedCustomerIds.forEach((id, index) => {
      const custRef = doc(db, 'businesses', currentUser.uid, 'customers', id);
      batch.update(custRef, { routeOrder: index + 1 });
    });
    await batch.commit();
  };

  // 1-Click Auto-Sort All Partner Routes to Shortest Order
  const handleOptimizeAllRoutes = async () => {
    if (!currentUser || deliveriesToday.length === 0) {
      alert("No active deliveries to optimize for this date & session.");
      return;
    }
    setIsOptimizingAll(true);
    setOptimizeAllSuccess(null);

    try {
      const batch = writeBatch(db);
      let updatedTotalStops = 0;
      const eligibleStaff = staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch);

      eligibleStaff.forEach(boy => {
        const boyStops = deliveriesToday.filter(c => c.deliveryBoyId === boy.id);
        if (boyStops.length > 0) {
          const branch = branches.find((b: any) => b.id === boy.branchId) || 
                         branches.find((b: any) => b.id === selectedBranch) || 
                         branches[0] || { name: 'Main Kitchen Hub' };
          
          const hub = {
            name: branch.name || 'Kitchen Hub',
            address: branch.hubAddress || `${branch.name || 'Kitchen Hub'}, ${branch.city || ''}`,
            locationLink: branch.hubLocationLink || ''
          };

          const routeResult = optimizeRouteOrder(hub, boyStops);
          routeResult.orderedStops.forEach((stop, index) => {
            const custRef = doc(db, 'businesses', currentUser.uid, 'customers', stop.id);
            batch.update(custRef, { routeOrder: index + 1 });
            updatedTotalStops++;
          });
        }
      });

      if (updatedTotalStops > 0) {
        await batch.commit();
        setOptimizeAllSuccess(`✅ Sorted & saved ${updatedTotalStops} stops into shortest route sequence! Delivery apps updated.`);
        setTimeout(() => setOptimizeAllSuccess(null), 5000);
      } else {
        alert("No assigned deliveries found to optimize. Please assign delivery partners first.");
      }
    } catch (err) {
      console.error("Error optimizing all routes:", err);
      alert("Failed to auto-sort routes. Please try again.");
    } finally {
      setIsOptimizingAll(false);
    }
  };

  const handleUpdateHubLocation = async (branchId: string, hubAddress: string, hubLocationLink: string) => {
    if (!currentUser || !branchId) return;
    await updateItem(currentUser.uid, 'branches', branchId, {
      hubAddress,
      hubLocationLink
    });
  };

  const handleShareRoute = (boy: any, boyCustomers: any[]) => {
    const branch = branches.find((b: any) => b.id === boy.branchId) || 
                   branches.find((b: any) => b.id === selectedBranch) || 
                   branches[0] || { name: 'Main Kitchen Hub' };
    
    const hub = {
      name: branch.name || 'Kitchen Hub',
      address: branch.hubAddress || `${branch.name || 'Kitchen Hub'}, ${branch.city || ''}`,
      locationLink: branch.hubLocationLink || ''
    };

    // Calculate shortest route metrics on the fly for WhatsApp using selectedDate
    const routeResult = optimizeRouteOrder(hub, boyCustomers);
    const whatsappMsg = formatWhatsAppOptimizedRoute(
      activeMealTab,
      selectedDate,
      boy,
      routeResult
    );

    window.open(`https://wa.me/${(boy.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading delivery schedules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 pt-1 animate-in fade-in duration-300">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">Delivery Logistics & Routing</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">Real-time dispatches, shortest round-trip route solver, and workload management.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Share Driver App Link Button */}
          <button
            onClick={() => { setSelectedShareBoy(null); setShareModalOpen(true); }}
            className="flex-1 md:flex-none px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
            title="Open Driver Portal Link Generator & WhatsApp Dispatch"
          >
            <Smartphone size={15} />
            <span>Share Driver App Link</span>
          </button>

          {/* Branch selector */}
          <div className="w-full sm:w-56 relative">
            <select 
              className="w-full py-2.5 pl-4 pr-10 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-glass outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Kitchen Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          </div>
        </div>
      </div>

      {/* 2. DATE SELECTOR & LOGISTICS CONTROL BAR */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-glass flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        
        {/* Left: Quick Date Stepper & Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/70 shadow-inner">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronDown className="rotate-90" size={16} />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Calendar size={15} className="text-primary-600" />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronDown className="-rotate-90" size={16} />
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                isSelectedToday 
                  ? 'bg-primary-600 text-white shadow-xs' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>
            <span className="text-xs text-slate-600 font-semibold px-1 hidden sm:inline">
              {new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            {!isSelectedToday && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                selectedDate < todayStr ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedDate < todayStr ? 'Past Date Record' : 'Future Scheduled Date'}
              </span>
            )}
          </div>
        </div>

        {/* Right: 1-Click Auto-Sort All Partner Routes Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOptimizeAllRoutes}
            disabled={isOptimizingAll || deliveriesToday.length === 0}
            className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Sorts and re-orders customer sequence (#1, #2, #3...) for all delivery partners based on shortest round-trip path"
          >
            <Zap size={14} className="text-amber-300" />
            <span>{isOptimizingAll ? 'Optimizing Routes...' : '⚡ Auto-Sort All Routes (Shortest Path)'}</span>
          </button>
        </div>
      </div>

      {optimizeAllSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{optimizeAllSuccess}</span>
          <button onClick={() => setOptimizeAllSuccess(null)} className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMainTab('routes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'routes'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Truck size={15} />
          <span>Route Dispatch & Workload</span>
        </button>

        <button
          onClick={() => setMainTab('boxes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'boxes'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Package size={15} />
          <span>Customer Box Inventory</span>
          {totalUncollectedBoxes > 0 && (
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
              mainTab === 'boxes' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-800'
            }`}>
              {totalUncollectedBoxes} uncollected
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'fleet'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Activity size={15} />
          <span>Live Rider Fleet & GPS Tracker</span>
          {onlineStaffCount > 0 && (
            <span className={`flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
              mainTab === 'fleet' ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {onlineStaffCount} Online
            </span>
          )}
        </button>
      </div>

      {/* TAB 2: REUSABLE BOX INVENTORY & CUSTOMER TRACKER */}
      {mainTab === 'boxes' && (
        <ReusableBoxTracker 
          customers={customers} 
          currentUser={currentUser} 
          todayStr={selectedDate} 
        />
      )}

      {/* TAB 3: LIVE FLEET & GPS TRACKER */}
      {mainTab === 'fleet' && (
        <LiveFleetTracker 
          staff={staff} 
          customers={customers} 
          deliveryLogs={deliveryLogs} 
          plans={plans}
          branches={branches}
          selectedBranch={selectedBranch}
          activeMealTab={activeMealTab}
          todayStr={selectedDate} 
          onShareLink={(boy) => { setSelectedShareBoy(boy); setShareModalOpen(true); }}
        />
      )}

      {/* TAB 1: EXISTING ROUTE DISPATCH & WORKLOAD */}
      {mainTab === 'routes' && (
        <div className="space-y-8 animate-in fade-in duration-200">

      {/* 2. GLOBAL KITCHEN LOAD (TODAY) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid size={16} className="text-primary-600" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Kitchen Production Load</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Meal Boxes" value={globalDailySummary.GrandTotal} icon={Package} colorClass="bg-slate-900" subtext="Combined daily total" />
          <StatCard title="Breakfast Boxes" value={globalDailySummary.Breakfast} icon={Sunrise} colorClass="bg-orange-500" subtext="Morning slot" />
          <StatCard title="Lunch Boxes" value={globalDailySummary.Lunch} icon={Sun} colorClass="bg-blue-600" subtext="Afternoon slot" />
          <StatCard title="Dinner Boxes" value={globalDailySummary.Dinner} icon={Moon} colorClass="bg-purple-600" subtext="Evening slot" />
        </div>
      </div>

      {/* 3. DELIVERY BOY WORKLOAD MATRIX */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ListChecks size={16} className="text-primary-600" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Partner Workload Distribution</h2>
        </div>
        <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50/70 backdrop-blur-sm text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="py-3.5 px-6">Delivery Partner</th>
                  <th className="py-3.5 px-4 text-center text-orange-700 bg-orange-50/30">Breakfast</th>
                  <th className="py-3.5 px-4 text-center text-blue-700 bg-blue-50/30">Lunch</th>
                  <th className="py-3.5 px-4 text-center text-purple-700 bg-purple-50/30">Dinner</th>
                  <th className="py-3.5 px-6 text-right">Daily Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {deliveryBoyMatrix.map(boy => (
                  <React.Fragment key={boy.id}>
                    <tr 
                      className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${expandedMatrixBoyId === boy.id ? 'bg-slate-50/90' : ''}`}
                      onClick={() => setExpandedMatrixBoyId(expandedMatrixBoyId === boy.id ? null : boy.id)}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${expandedMatrixBoyId === boy.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary-600 group-hover:text-white'}`}>
                            <Truck size={15} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-sm">{boy.name}</span>
                            <span className="text-[10px] text-slate-400">Click to view meal plan breakdown</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-orange-50/10">{boy.Breakfast}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-blue-50/10">{boy.Lunch}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-purple-50/10">{boy.Dinner}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded-full text-xs font-bold min-w-[32px] text-center shadow-xs">
                            {boy.Total}
                          </span>
                          {expandedMatrixBoyId === boy.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                    {expandedMatrixBoyId === boy.id && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={5} className="p-5 pl-12">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-in slide-in-from-top-1 duration-200">
                            {/* Breakfast Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-orange-100 pb-1.5">
                                <Sunrise size={13} /> Breakfast ({boy.Breakfast})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Breakfast).length > 0 ? Object.values(boy.breakdown.Breakfast).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1">
                                      {p.name} {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No breakfast drops assigned</p>}
                              </div>
                            </div>
                            {/* Lunch Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-100 pb-1.5">
                                <Sun size={13} /> Lunch ({boy.Lunch})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Lunch).length > 0 ? Object.values(boy.breakdown.Lunch).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1">
                                      {p.name} {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No lunch drops assigned</p>}
                              </div>
                            </div>
                            {/* Dinner Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-100 pb-1.5">
                                <Moon size={13} /> Dinner ({boy.Dinner})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Dinner).length > 0 ? Object.values(boy.breakdown.Dinner).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1">
                                      {p.name} {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No dinner drops assigned</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {deliveryBoyMatrix.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-xs">No delivery personnel found for selected branch.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Active Route Details */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">Active Route Management</h2>
            <p className="text-slate-500 text-xs mt-0.5">Dispatches and route sequences for <strong className="text-slate-800 font-semibold">{activeMealTab}</strong></p>
          </div>
          <div className="glass-panel p-1 rounded-xl flex gap-1.5 w-full md:w-fit shadow-xs">
            {[
              { id: 'Breakfast', icon: Sunrise, color: 'text-orange-600', activeBg: 'bg-white shadow-xs text-orange-700' },
              { id: 'Lunch', icon: Sun, color: 'text-blue-600', activeBg: 'bg-white shadow-xs text-blue-700' },
              { id: 'Dinner', icon: Moon, color: 'text-purple-600', activeBg: 'bg-white shadow-xs text-purple-700' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveMealTab(tab.id as any); setExpandedBoyId(null); }}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeMealTab === tab.id 
                    ? tab.activeBg + ' ring-1 ring-slate-200/80' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <tab.icon size={14} className={tab.color} />
                {tab.id}
              </button>
            ))}
          </div>
        </div>

        {/* Existing Session Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <StatCard title={`${activeMealTab} Customers`} value={sessionMetrics.customers} icon={Users} colorClass="bg-blue-600" subtext="Unique session stops" />
          <StatCard title={`${activeMealTab} Tiffin Boxes`} value={sessionMetrics.plans} icon={Package} colorClass="bg-primary-600" subtext="Dispatched boxes" />
          <StatCard title={`${activeMealTab} Special Requirements`} value={sessionMetrics.starPlans} icon={Star} colorClass="bg-amber-600" subtext="Custom instructions" />
        </div>

        {/* Staff Route List */}
        <div className="space-y-4">
          {deliveriesToday.filter(c => !c.deliveryBoyId).length > 0 && (
            <div className="bg-rose-50/70 backdrop-blur-sm border border-rose-200/80 rounded-2xl p-5 mb-4 shadow-glass">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                  <UserX size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Unassigned Customers ({deliveriesToday.filter(c => !c.deliveryBoyId).length})</h3>
                  <p className="text-[11px] text-rose-600">Assign a delivery partner to include these customers in optimized routes.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                 {deliveriesToday.filter(c => !c.deliveryBoyId).map(c => (
                   <div key={c.id} className="bg-white/90 p-3 rounded-xl border border-rose-100 shadow-xs flex justify-between items-center group">
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{c.area || 'No area set'}</p>
                      </div>
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition-colors">
                        <ArrowRight size={13} />
                      </div>
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
              <div key={boy.id} className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden transition-all">
                <div onClick={() => setExpandedBoyId(isExpanded ? null : boy.id)} className={`p-4 sm:p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center cursor-pointer gap-4 ${isExpanded ? 'bg-slate-50/80 border-b border-slate-200/60' : 'hover:bg-slate-50/50'}`}>
                  <div className="flex items-center gap-3.5 w-full xl:w-auto">
                    <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center shrink-0 border border-primary-100 shadow-xs">
                      <Truck size={22} />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 tracking-tight">{boy.name}</h3>
                      <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5"><Phone size={13}/> {boy.mobile || 'No contact'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full xl:w-auto flex-1 md:flex-none">
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Stops</p>
                      <p className="font-bold text-slate-800 text-sm">{boyCustomers.length}</p>
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Boxes</p>
                      <p className="font-bold text-primary-600 text-sm">{boyTotalBoxes}</p>
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Regular</p>
                      <p className="font-bold text-slate-600 text-sm">{boyTotalBoxes - boyStarBoxes}</p>
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-amber-600">Starred</p>
                      <p className="font-bold text-amber-700 text-sm">{boyStarBoxes}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 w-full xl:w-auto justify-end">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedShareBoy(boy); setShareModalOpen(true); }} 
                      className="flex-1 xl:flex-none bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      title="Share personalized Driver Portal link & login"
                    >
                      <Smartphone size={14} /> Driver App
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenOptimizer(boy, boyCustomers); }} 
                      className="flex-1 xl:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <Compass size={14} /> Shortest Route
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShareRoute(boy, boyCustomers); }} 
                      className="flex-1 xl:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <MessageSquare size={14} fill="currentColor" /> Share WhatsApp
                    </button>
                    <div className={`p-1.5 rounded-xl border transition-colors ${isExpanded ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400 bg-white'}`}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="animate-in slide-in-from-top-1 duration-200">
                    <div className="p-3 bg-slate-50/70 border-b border-slate-200/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          <Compass size={12} />
                        </div>
                        <span className="font-semibold text-slate-700">Hub ➔ Delivery Sequence ➔ Hub:</span>
                        <span className="text-slate-500 hidden md:inline">Calculates shortest round-trip sequence to save travel time.</span>
                      </div>
                      <button 
                        onClick={() => handleOpenOptimizer(boy, boyCustomers)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 shadow-xs shrink-0 active:scale-95 transition-all"
                      >
                        <Zap size={12} className="text-amber-400" /> Optimize Sequence
                      </button>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[1050px] text-xs">
                        <thead className="bg-slate-50/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/60">
                          <tr>
                            <th className="py-3 px-4 w-12 text-center">Stop</th>
                            <th className="py-3 px-3 w-16 text-center">Reorder</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Contact</th>
                            <th className="py-3 px-4 min-w-[200px]">Meal Plans</th>
                            <th className="py-3 px-3 text-center">Priority</th>
                            <th className="py-3 px-3 text-center">Live Status</th>
                            <th className="py-3 px-4">Delivery Area / Address</th>
                            <th className="py-3 px-3 text-center">Remaining</th>
                            <th className="py-3 px-3 text-center">Maps</th>
                          </tr>
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

                              const logKey = `${c.id}_${activeMealTab}`;
                              const logRecord = dateLogsMap[logKey];
                              const isDelivered = logRecord?.status === 'Delivered';
                              const boxCondition = logRecord?.boxStatus;

                              return (
                                <tr key={c.id} className={`hover:bg-slate-50/70 transition-colors ${overallStarred ? 'bg-amber-50/30' : ''}`}>
                                  <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <button onClick={() => handleMoveOrder(c.id, 'up')} className="p-1 hover:bg-slate-200/70 rounded text-slate-500" title="Move Up"><ArrowUp size={13}/></button>
                                      <button onClick={() => handleMoveOrder(c.id, 'down')} className="p-1 hover:bg-slate-200/70 rounded text-slate-500" title="Move Down"><ArrowDown size={13}/></button>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{c.name}</span>
                                      {overallStarred && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{c.mobile}</td>
                                  <td className="py-3 px-4">
                                    <div className="space-y-1">
                                      {Object.values(groupedPlans).map((gp: any, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 bg-white/90 border border-slate-100 py-1 px-2 rounded-lg shadow-xs">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-medium text-slate-700 truncate max-w-[120px]">{gp.name}</span>
                                            {gp.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}
                                          </div>
                                          <span className="bg-slate-900 text-white text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0">{gp.count}</span>
                                        </div>
                                      ))}
                                      {sessionPlans.filter((p: any) => p.reusableBoxType && p.reusableBoxType !== 'None').map((rp: any, rIdx: number) => {
                                        const dayNum = getPlanDeliveryDayNumber(rp, todayStr);
                                        const isSecondDayOrMore = dayNum >= 2;
                                        return (
                                          <div 
                                            key={`box-${rIdx}`} 
                                            className={`text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 border shadow-xs ${
                                              isSecondDayOrMore 
                                                ? 'bg-teal-50 border-teal-200 text-teal-800' 
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                            }`}
                                          >
                                            <RotateCcw size={10} className={isSecondDayOrMore ? 'text-teal-600 animate-spin-slow' : 'text-slate-400'} />
                                            <span>
                                              {isSecondDayOrMore 
                                                ? `🔄 Recollect: Yesterday's ${rp.reusableBoxType}${rp.boxTagOrNumber ? ` (#${rp.boxTagOrNumber})` : ''}`
                                                : `📦 Day 1: New ${rp.reusableBoxType} (recollect starts tomorrow)`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {overallStarred ? <Star size={15} className="text-amber-500 mx-auto" fill="currentColor" /> : <span className="text-slate-300">—</span>}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      {isDelivered ? (
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 shadow-xs">
                                          <CheckCircle2 size={11} className="text-emerald-600" />
                                          Delivered
                                        </span>
                                      ) : (
                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium text-[10px]">
                                          Pending
                                        </span>
                                      )}
                                      {boxCondition && boxCondition !== 'None' && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shadow-xs ${
                                          boxCondition === 'Collected' || boxCondition === 'Collected Clean'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}>
                                          🍱 {boxCondition}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div>
                                      <p className="text-[11px] font-semibold text-slate-700 truncate">{c.area || 'Area not specified'}</p>
                                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{c.address}</p>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="space-y-1">
                                      {Object.values(groupedPlans).map((gp: any, i) => (
                                        <div key={i} className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded py-0.5 px-1.5">
                                          {calculateRemainingDeliveries(gp.endDate, gp.pConfig?.weekdays || [], gp.pauses || [])} left
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {c.locationLink ? (
                                      <a href={c.locationLink.startsWith('http') ? c.locationLink : `https://${c.locationLink}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors inline-flex" title="Open Map Location">
                                        <ExternalLink size={14} />
                                      </a>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
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
          })}
        </div>

        {deliveriesToday.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center text-center glass-card rounded-2xl border border-white/80 shadow-glass">
            <div className="w-16 h-16 bg-slate-100/70 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
              <Truck size={30} />
            </div>
            <h3 className="text-lg font-bold font-display text-slate-800">No Deliveries Scheduled</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-xs">There are no active subscription plans scheduled for the {activeMealTab} session today.</p>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Driver Portal Link Share Modal */}
      <ShareDriverLinkModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        bizId={currentUser?.uid || ''}
        staff={staff}
        selectedBoy={selectedShareBoy}
      />

      {/* Route Optimizer Modal */}
      {optimizerModalData && (
        <RouteOptimizerModal 
          isOpen={Boolean(optimizerModalData)}
          onClose={() => setOptimizerModalData(null)}
          deliveryBoy={optimizerModalData.boy}
          customersToday={optimizerModalData.customers}
          mealTime={activeMealTab}
          branch={optimizerModalData.branch}
          dateStr={selectedDate}
          onApplyNewOrder={handleApplyOptimizedOrder}
          onUpdateHubLocation={handleUpdateHubLocation}
        />
      )}

    </div>
  );
};

export default Deliveries;