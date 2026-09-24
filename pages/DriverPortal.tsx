import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Truck, MapPin, Phone, MessageSquare, CheckCircle2, Clock, 
  AlertCircle, AlertTriangle, Navigation, ArrowRight, RefreshCw, 
  ChevronRight, Calendar, User, Shield, Info, Battery, Compass,
  Sparkles, Check, X, RotateCcw, Package, HelpCircle, ExternalLink, Play
} from 'lucide-react';
import { 
  collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs, getDoc 
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { 
  getTodayStr, isCustomerDeliveryDay2Plus, REUSABLE_BOX_TYPES, 
  BoxRecollectionStatus, DeliveryBoyStaff, GlobalCustomer, SubscribedPlan 
} from '../services/store';

// Sample demo data for instant preview or offline testing
const DEMO_STAFF: DeliveryBoyStaff[] = [
  {
    id: 'demo-rider-1',
    name: 'Raju Express',
    mobile: '9876543210',
    branchId: 'main-hub',
    role: 'Delivery Boy',
    status: 'Online',
    currentLat: 12.9716,
    currentLng: 77.5946,
    lastLocationUpdate: new Date().toISOString(),
    lastAttendanceDate: getTodayStr(),
    attendanceMarkedAt: '08:30 AM'
  },
  {
    id: 'demo-rider-2',
    name: 'Amit Kumar',
    mobile: '9812345678',
    branchId: 'main-hub',
    role: 'Delivery Boy',
    status: 'Offline',
    lastAttendanceDate: '',
    attendanceMarkedAt: ''
  }
];

const DEMO_CUSTOMERS: GlobalCustomer[] = [
  {
    id: 'demo-cust-1',
    name: 'Rahul Verma',
    mobile: '9845012345',
    address: 'Flat 402, Green Glen Towers, Outer Ring Road, Bellandur',
    area: 'Bellandur',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 1,
    isActive: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    planId: 'p-lunch-deluxe',
    mealTime: ['Lunch'],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 3200,
    planPrice: 3200,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 1,
    reusableBoxEnabled: true,
    reusableBoxType: '3-Tier Stainless Steel Tiffin',
    uncollectedBoxesCount: 1,
    activePlans: [
      {
        planId: 'p-lunch-deluxe',
        planName: 'Deluxe Healthy Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-01',
        endDate: '2026-10-31',
        price: 3200,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: '3-Tier Stainless Steel Tiffin'
      }
    ]
  },
  {
    id: 'demo-cust-2',
    name: 'Pooja Hegde',
    mobile: '9741098765',
    address: 'Villa 18, Palm Meadows Phase 2, Whitefield',
    area: 'Whitefield',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 2,
    isActive: true,
    createdAt: '2026-09-05T08:00:00.000Z',
    planId: 'p-lunch-deluxe',
    mealTime: ['Lunch'],
    startDate: '2026-09-05',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 3200,
    planPrice: 3200,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 0,
    reusableBoxEnabled: true,
    reusableBoxType: 'Insulated Hot-Box 4-Container',
    uncollectedBoxesCount: 2,
    activePlans: [
      {
        planId: 'p-lunch-deluxe',
        planName: 'Deluxe Healthy Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-05',
        endDate: '2026-10-31',
        price: 3200,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: 'Insulated Hot-Box 4-Container'
      }
    ]
  },
  {
    id: 'demo-cust-3',
    name: 'Vikram Malhotra',
    mobile: '9980123456',
    address: '#104, Sunrise Residency, Kadubeesanahalli',
    area: 'Kadubeesanahalli',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 3,
    isActive: true,
    createdAt: '2026-09-10T08:00:00.000Z',
    planId: 'p-lunch-eco',
    mealTime: ['Lunch'],
    startDate: '2026-09-10',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 2400,
    planPrice: 2400,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 0,
    reusableBoxEnabled: false,
    reusableBoxType: 'None',
    uncollectedBoxesCount: 0,
    activePlans: [
      {
        planId: 'p-lunch-eco',
        planName: 'Standard Homestyle Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-10',
        endDate: '2026-10-31',
        price: 2400,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: 'None'
      }
    ]
  }
];

export const DriverPortal: React.FC = () => {
  // Read params from URL or localStorage
  const getParam = (key: string) => {
    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashPart);
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get(key) || searchParams.get(key) || '';
  };

  const paramBiz = getParam('biz') || localStorage.getItem('driver_biz_id') || auth.currentUser?.uid || '';
  const paramBoy = getParam('boy') || localStorage.getItem('driver_boy_id') || '';
  const paramPhone = getParam('phone') || '';

  const [bizId, setBizId] = useState<string>(paramBiz);
  const [bizInput, setBizInput] = useState<string>('');
  const [selectedBoyId, setSelectedBoyId] = useState<string>(paramBoy);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(paramBiz === 'demo');
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>(() => {
    const hr = new Date().getHours();
    if (hr < 11) return 'Breakfast';
    if (hr < 16) return 'Lunch';
    return 'Dinner';
  });

  const [allStaff, setAllStaff] = useState<DeliveryBoyStaff[]>([]);
  const [customers, setCustomers] = useState<GlobalCustomer[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [punchInTime, setPunchInTime] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(!paramBoy);
  const [phoneInput, setPhoneInput] = useState(paramPhone);
  const [pinInput, setPinInput] = useState('');
  const [activeBoxModal, setActiveBoxModal] = useState<{ customer: GlobalCustomer; logKey: string } | null>(null);
  const [selectedBoxStatus, setSelectedBoxStatus] = useState<BoxRecollectionStatus>('Collected');
  const [boxNotes, setBoxNotes] = useState('');
  const [showAllUnassigned, setShowAllUnassigned] = useState(false);

  const todayStr = getTodayStr();
  const dayOfWeek = new Date().getDay();
  const watchIdRef = useRef<number | null>(null);

  // Auto-connect anonymous auth if not authenticated
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.warn("Driver anonymous auth initialization:", err);
      });
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !bizId && !isDemoMode) {
        setBizId(user.uid);
      }
    });

    return () => unsub();
  }, [bizId, isDemoMode]);

  // Sync to localStorage
  useEffect(() => {
    if (bizId) localStorage.setItem('driver_biz_id', bizId);
    if (selectedBoyId) localStorage.setItem('driver_boy_id', selectedBoyId);
  }, [bizId, selectedBoyId]);

  // Load Demo Data if in demo mode
  const launchDemoMode = () => {
    setIsDemoMode(true);
    setBizId('demo');
    setAllStaff(DEMO_STAFF);
    setSelectedBoyId(DEMO_STAFF[0].id);
    setCustomers(DEMO_CUSTOMERS);
    setSelectedMeal('Lunch');
    setIsShiftActive(true);
    setPunchInTime('08:30 AM');
    setLoginModalOpen(false);
    setLoading(false);
  };

  // Subscribe to staff members of this business
  useEffect(() => {
    if (!bizId) {
      setLoading(false);
      return;
    }

    if (bizId === 'demo') {
      launchDemoMode();
      return;
    }

    const staffRef = collection(db, 'businesses', bizId, 'staff');
    const unsubscribeStaff = onSnapshot(staffRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DeliveryBoyStaff[];
      setAllStaff(list);
      
      // Auto-select boy if matching phone or boy ID
      if (selectedBoyId) {
        const found = list.find(s => s.id === selectedBoyId || s.name === selectedBoyId);
        if (found) {
          setIsShiftActive(found.status === 'Online' && found.lastAttendanceDate === todayStr);
          setPunchInTime(found.attendanceMarkedAt || null);
        }
      } else if (paramPhone) {
        const digits = paramPhone.replace(/\D/g, '');
        const found = list.find(s => s.mobile?.replace(/\D/g, '').endsWith(digits.slice(-10)));
        if (found) {
          setSelectedBoyId(found.id);
          setIsShiftActive(found.status === 'Online' && found.lastAttendanceDate === todayStr);
          setPunchInTime(found.attendanceMarkedAt || null);
          setLoginModalOpen(false);
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn("Staff stream err (using fallback if needed):", err);
      setLoading(false);
    });

    // Customers stream
    const custRef = collection(db, 'businesses', bizId, 'customers');
    const unsubscribeCust = onSnapshot(custRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as GlobalCustomer[];
      setCustomers(list);
    }, (err) => console.error("Customer stream err:", err));

    // Plans stream
    const plansRef = collection(db, 'businesses', bizId, 'plans');
    const unsubscribePlans = onSnapshot(plansRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlans(list);
    });

    // Today's delivery logs stream
    const logsRef = collection(db, 'businesses', bizId, 'delivery_logs');
    const unsubscribeLogs = onSnapshot(logsRef, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.date === todayStr) {
          map[`${data.customerId}_${data.mealTime}`] = { id: d.id, ...data };
        }
      });
      setDeliveryLogs(map);
    });

    return () => {
      unsubscribeStaff();
      unsubscribeCust();
      unsubscribePlans();
      unsubscribeLogs();
    };
  }, [bizId, selectedBoyId, todayStr]);

  // GPS Watcher when shift is active
  useEffect(() => {
    if (isShiftActive && navigator.geolocation) {
      const updateLocation = (pos: GeolocationPosition) => {
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setGpsError(null);

        // Update driver doc in Firestore
        if (bizId && selectedBoyId) {
          const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
          updateDoc(boyDocRef, {
            currentLat: latitude,
            currentLng: longitude,
            lastLocationUpdate: new Date().toISOString(),
            status: 'Online'
          }).catch(err => console.warn("GPS update err:", err));
        }
      };

      const handleError = (err: GeolocationPositionError) => {
        setGpsError(err.message);
      };

      navigator.geolocation.getCurrentPosition(updateLocation, handleError, { enableHighAccuracy: true });
      watchIdRef.current = navigator.geolocation.watchPosition(updateLocation, handleError, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000
      });

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };
    }
  }, [isShiftActive, bizId, selectedBoyId]);

  // Active delivery boy
  const currentBoy = useMemo(() => {
    return allStaff.find(s => s.id === selectedBoyId) || null;
  }, [allStaff, selectedBoyId]);

  // Stops assigned to this delivery boy for the selected meal session
  const stops = useMemo(() => {
    if (!selectedBoyId) return [];

    const activeStops: any[] = [];

    customers
      .filter(c => {
        if (showAllUnassigned) return true;
        return (
          c.deliveryBoyId === selectedBoyId || 
          (currentBoy && (c.deliveryBoyId === currentBoy.name || c.deliveryBoyName === currentBoy.name)) ||
          (!c.deliveryBoyId && allStaff.length <= 1)
        );
      })
      .forEach(c => {
        (c.activePlans || []).forEach((ap: SubscribedPlan) => {
          if (ap.mealTime !== selectedMeal) return;

          const planConfig = plans.find(p => p.id === ap.planId);
          const weekdays = planConfig?.weekdays || ap.weekdays || [1, 2, 3, 4, 5, 6];
          const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
          const isValidDay = weekdays.includes(dayOfWeek);
          const isWithinRange = todayStr >= ap.startDate && todayStr <= ap.endDate;

          if (isWithinRange && isValidDay && !isPaused) {
            const logKey = `${c.id}_${selectedMeal}`;
            const logRecord = deliveryLogs[logKey];
            const isDelivered = logRecord?.status === 'Delivered';

            // Check if Customer is on Day 2+ for reusable box
            const isDay2Plus = isCustomerDeliveryDay2Plus(c, todayStr);

            activeStops.push({
              customer: c,
              plan: ap,
              planConfig,
              logKey,
              logRecord,
              isDelivered,
              isDay2Plus,
              routeOrder: c.routeOrder ?? 999
            });
          }
        });
      });

    // Sort by optimal route order
    return activeStops.sort((a, b) => a.routeOrder - b.routeOrder);
  }, [customers, selectedBoyId, currentBoy, selectedMeal, plans, todayStr, dayOfWeek, deliveryLogs, showAllUnassigned, allStaff.length]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = stops.length;
    const delivered = stops.filter(s => s.isDelivered).length;
    const pending = total - delivered;

    // Reusable boxes metrics
    const reusableStops = stops.filter(s => s.customer.reusableBoxEnabled && s.isDay2Plus);
    const boxesToRecollect = reusableStops.length;
    const boxesCollected = reusableStops.filter(s => s.logRecord?.boxStatus === 'Collected').length;
    const boxesIssues = reusableStops.filter(s => 
      s.logRecord?.boxStatus === 'Dirty / Unwashed' || 
      s.logRecord?.boxStatus === 'Damaged / Missing Parts' || 
      s.logRecord?.boxStatus === 'Not Returned'
    ).length;

    return { total, delivered, pending, boxesToRecollect, boxesCollected, boxesIssues };
  }, [stops]);

  // Handle Attendance Punch In / Shift Start
  const handlePunchIn = async () => {
    if (!bizId || !selectedBoyId) return;

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Online',
        lastAttendanceDate: todayStr,
        attendanceMarkedAt: timeStr,
        updatedAt: now.toISOString()
      });

      setIsShiftActive(true);
      setPunchInTime(timeStr);

      // Trigger location prompt
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            updateDoc(boyDocRef, {
              currentLat: pos.coords.latitude,
              currentLng: pos.coords.longitude,
              lastLocationUpdate: new Date().toISOString()
            });
          },
          (err) => console.warn("GPS init:", err.message)
        );
      }
    } catch (err) {
      console.error("Punch in error:", err);
      alert("Failed to mark attendance. Check your connection.");
    }
  };

  // Handle Shift End
  const handlePunchOut = async () => {
    if (!confirm("Are you sure you want to end your shift?")) return;
    if (!bizId || !selectedBoyId) return;

    try {
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Offline',
        updatedAt: new Date().toISOString()
      });

      setIsShiftActive(false);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    } catch (err) {
      console.error("Punch out error:", err);
    }
  };

  // Mark Delivery Status
  const handleToggleDelivered = async (stop: any) => {
    if (!bizId) return;

    const logKey = stop.logKey;
    const currentStatus = stop.isDelivered ? 'Pending' : 'Delivered';
    const now = new Date();

    // Optimistic UI update
    setDeliveryLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        date: todayStr,
        customerId: stop.customer.id,
        customerName: stop.customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        status: currentStatus,
        deliveredAt: currentStatus === 'Delivered' ? now.toISOString() : null,
      }
    }));

    if (bizId === 'demo') {
      return;
    }

    try {
      const logDocRef = doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${stop.customer.id}_${selectedMeal}`);
      await setDoc(logDocRef, {
        date: todayStr,
        customerId: stop.customer.id,
        customerName: stop.customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        status: currentStatus,
        deliveredAt: currentStatus === 'Delivered' ? now.toISOString() : null,
        reusableBoxEnabled: stop.customer.reusableBoxEnabled || false,
        boxType: stop.customer.reusableBoxType || 'None',
        isDay2Plus: stop.isDay2Plus,
        boxStatus: stop.logRecord?.boxStatus || (stop.customer.reusableBoxEnabled && stop.isDay2Plus ? 'Pending' : 'None'),
        boxNotes: stop.logRecord?.boxNotes || '',
        updatedAt: now.toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Toggle delivery error:", err);
      alert("Could not update delivery status.");
    }
  };

  // Save Box Recollection Condition
  const handleSaveBoxRecollection = async () => {
    if (!activeBoxModal || !bizId) return;

    const { customer, logKey } = activeBoxModal;
    const now = new Date();
    const isClean = selectedBoxStatus === 'Collected' || selectedBoxStatus === 'Collected Clean';
    const isCollectedAny = isClean || selectedBoxStatus === 'Dirty / Unwashed';

    // Optimistic UI update
    setDeliveryLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || '3-Tier Stainless Steel Tiffin',
        isDay2Plus: true,
        boxStatus: selectedBoxStatus,
        boxNotes: boxNotes.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }
    }));

    setCustomers(prev => prev.map(c => {
      if (c.id === customer.id) {
        const prevCount = typeof c.uncollectedBoxesCount === 'number' ? c.uncollectedBoxesCount : 1;
        const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
        return {
          ...c,
          uncollectedBoxesCount: newCount,
          boxCollections: {
            ...(c.boxCollections || {}),
            [`${todayStr}_${selectedMeal}`]: {
              status: selectedBoxStatus,
              boxType: customer.reusableBoxType || 'Stainless Steel 3-Tier Dabba',
              issueNote: boxNotes.trim(),
              collectedAt: now.toISOString(),
              updatedBy: currentBoy?.name || 'Delivery Partner'
            }
          }
        };
      }
      return c;
    }));

    setActiveBoxModal(null);
    setBoxNotes('');

    if (bizId === 'demo') {
      return;
    }

    try {
      const logDocRef = doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${customer.id}_${selectedMeal}`);

      await setDoc(logDocRef, {
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || '3-Tier Stainless Steel Tiffin',
        isDay2Plus: true,
        boxStatus: selectedBoxStatus,
        boxNotes: boxNotes.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }, { merge: true });

      // Update customer uncollected boxes count and history in businesses/{bizId}/customers/{customer.id}
      try {
        const custDocRef = doc(db, 'businesses', bizId, 'customers', customer.id);
        const prevCount = typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1;
        const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
        
        await updateDoc(custDocRef, {
          uncollectedBoxesCount: newCount,
          [`boxCollections.${todayStr}_${selectedMeal}`]: {
            status: selectedBoxStatus === 'Collected' ? 'Collected Clean' : selectedBoxStatus === 'Dirty / Unwashed' ? 'Collected Unclean' : selectedBoxStatus,
            boxType: customer.reusableBoxType || 'Stainless Steel 3-Tier Dabba',
            issueNote: boxNotes.trim(),
            collectedAt: now.toISOString(),
            updatedBy: currentBoy?.name || 'Delivery Partner'
          },
          updatedAt: now.toISOString()
        });
      } catch (custErr) {
        console.warn("Could not sync customer box record directly:", custErr);
      }
    } catch (err) {
      console.error("Save box recollection error:", err);
      alert("Could not save box status.");
    }
  };

  if (!bizId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-card bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl max-w-md w-full border border-white/20 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
            <Truck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Delivery Partner Portal</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Open your kitchen's delivery run, mark live deliveries, track GPS, and record collected reusable dabbas.
            </p>
          </div>

          {/* Business ID input */}
          <div className="space-y-2 pt-1 text-left">
            <label className="text-[11px] font-semibold text-slate-300">Kitchen / Business ID</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. kitchen_abc123 or User ID"
                value={bizInput}
                onChange={(e) => setBizInput(e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = bizInput.trim();
                    if (val) setBizId(val);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = bizInput.trim();
                  if (val) setBizId(val);
                  else alert("Please enter your Kitchen ID or click 'Try Demo Route' below.");
                }}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                Connect
              </button>
            </div>
          </div>

          {/* Quick Connect Current Session */}
          {auth.currentUser && (
            <button
              onClick={() => setBizId(auth.currentUser!.uid)}
              className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <span>Connect As Current Kitchen Owner</span>
              <ArrowRight size={14} className="text-amber-400" />
            </button>
          )}

          {/* Demo Mode Button */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-[11px] text-slate-400">Testing or previewing the delivery boy interface?</p>
            <button
              type="button"
              onClick={launchDemoMode}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Sparkles size={15} />
              <span>Launch Demo Rider Route (Instant Preview)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-slate-100 flex flex-col font-sans pb-24">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-glass">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Truck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold font-display text-sm tracking-tight text-white">
                {currentBoy ? currentBoy.name : 'Select Driver'}
              </h1>
              {isShiftActive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{todayStr}</span>
              <span>•</span>
              <button 
                onClick={() => setLoginModalOpen(true)} 
                className="text-amber-400 hover:underline font-medium"
              >
                Change Rider
              </button>
            </p>
          </div>
        </div>

        {/* Shift Action Button */}
        <div>
          {isShiftActive ? (
            <button 
              onClick={handlePunchOut}
              className="text-xs font-semibold px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw size={13} /> End Shift
            </button>
          ) : (
            <button 
              onClick={handlePunchIn}
              className="text-xs font-bold px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-1.5"
            >
              <Check size={14} /> Punch In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        
        {/* Attendance Banner when not punched in */}
        {!isShiftActive && (
          <div className="glass-card bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300">Shift Not Started</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">Punch in to activate GPS tracking & record deliveries.</p>
              </div>
            </div>
            <button 
              onClick={handlePunchIn}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm active:scale-95"
            >
              Start Shift
            </button>
          </div>
        )}

        {/* GPS Active Pill */}
        {isShiftActive && (
          <div className="glass-card bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <Navigation size={14} className="animate-spin text-emerald-400" />
              <span>GPS Tracking Active</span>
              {punchInTime && <span className="text-slate-400 text-[11px]">(Started at {punchInTime})</span>}
            </div>
            {currentCoords && (
              <a 
                href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-[11px] text-emerald-400 underline font-mono flex items-center gap-1"
              >
                Maps Pin <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}

        {/* Meal Session Filter Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
          {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                selectedMeal === meal 
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{meal === 'Breakfast' ? '🌅' : meal === 'Lunch' ? '☀️' : '🌙'}</span>
              <span>{meal}</span>
            </button>
          ))}
        </div>

        {/* Route Progress Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Deliveries Progress</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-display text-white">
                {metrics.delivered} <span className="text-xs font-normal text-slate-400">/ {metrics.total}</span>
              </span>
              <span className="text-xs font-semibold text-amber-400">
                {metrics.total > 0 ? `${Math.round((metrics.delivered / metrics.total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.total > 0 ? (metrics.delivered / metrics.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="glass-card bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
              <Package size={12} /> Reusable Boxes
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-display text-white">
                {metrics.boxesCollected} <span className="text-xs font-normal text-slate-400">/ {metrics.boxesToRecollect}</span>
              </span>
              {metrics.boxesIssues > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {metrics.boxesIssues} Issues
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {metrics.boxesToRecollect === 0 
                ? 'No boxes to recollect' 
                : `${metrics.boxesToRecollect - metrics.boxesCollected} pending recollection`}
            </p>
          </div>
        </div>

        {/* Stops List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
            <span>Optimized Sequence ({stops.length} Stops)</span>
            <span>{selectedMeal} Route</span>
          </div>

          {stops.map((stop, idx) => {
            const { customer, plan, logKey, logRecord, isDelivered, isDay2Plus } = stop;
            const hasBox = customer.reusableBoxEnabled;
            const boxStatus = logRecord?.boxStatus;

            return (
              <div 
                key={`${customer.id}-${idx}`}
                className={`glass-card rounded-2xl border transition-all duration-300 p-4 relative overflow-hidden ${
                  isDelivered 
                    ? 'bg-white/[0.03] border-white/10 opacity-80' 
                    : 'bg-white/[0.08] border-white/20 shadow-glass hover:border-amber-500/40'
                }`}
              >
                {/* Top Badge Row */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <h3 className="font-bold font-display text-base text-white tracking-tight">
                      {customer.name}
                    </h3>
                  </div>

                  {/* Delivery Status Checkbox */}
                  <button
                    onClick={() => handleToggleDelivered(stop)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
                      isDelivered 
                        ? 'bg-emerald-500 text-slate-950' 
                        : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20'
                    }`}
                  >
                    <CheckCircle2 size={15} className={isDelivered ? 'text-slate-950' : 'text-slate-400'} />
                    <span>{isDelivered ? 'Delivered' : 'Mark Done'}</span>
                  </button>
                </div>

                {/* Plan and Special Notes */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                  <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-md font-medium">
                    {plan.planName}
                  </span>
                  {customer.highlightMark && customer.highlightMark !== 'None' && (
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-semibold">
                      {customer.highlightMark}
                    </span>
                  )}
                  {customer.notes && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-medium italic">
                      "{customer.notes}"
                    </span>
                  )}
                </div>

                {/* Address & Navigation */}
                <div className="p-3 bg-black/20 rounded-xl border border-white/5 mb-3 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-slate-300">
                    <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{customer.address} {customer.area && `(${customer.area})`}</span>
                  </div>

                  {/* Action Buttons: Directions, Call, WhatsApp */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                    <a
                      href={customer.locationLink || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address + ' ' + (customer.area || ''))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Navigation size={13} />
                      <span>Route</span>
                    </a>

                    <a
                      href={`tel:${customer.mobile}`}
                      className="py-2 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </a>

                    <a
                      href={`https://wa.me/91${customer.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${customer.name}, your ${selectedMeal} meal is arriving shortly from ScaleKitchen!`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <MessageSquare size={13} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* REUSABLE BOX SECTION (Applied from 2nd Day of delivery) */}
                {hasBox && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/10">
                    {!isDay2Plus ? (
                      /* Day 1: First Handover */
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2.5 text-xs text-blue-200">
                        <Package size={16} className="text-blue-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-blue-300">📦 Day 1 Delivery — Handover Fresh Box</p>
                          <p className="text-[11px] text-blue-200/80">
                            Provide {customer.reusableBoxType || 'Reusable Box'}. No previous box to collect today.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Day 2 onwards: Recollect Yesterday's Box */
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                              RECOLLECT
                            </span>
                            <span className="font-bold text-amber-300 text-xs">
                              Yesterday's Box: {customer.reusableBoxType || 'Reusable Tiffin'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setActiveBoxModal({ customer, logKey });
                              setSelectedBoxStatus(boxStatus || 'Collected');
                              setBoxNotes(logRecord?.boxNotes || '');
                            }}
                            className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline"
                          >
                            {boxStatus ? 'Edit Status' : 'Log Return'}
                          </button>
                        </div>

                        {/* Current Box Status Pill */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {boxStatus ? (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              boxStatus === 'Collected' 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                              boxStatus === 'Dirty / Unwashed'
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                              boxStatus === 'Damaged / Missing Parts'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                                'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}>
                              {boxStatus === 'Collected' ? '✅' : boxStatus === 'Dirty / Unwashed' ? '🧽' : boxStatus === 'Damaged / Missing Parts' ? '💥' : '⏳'}
                              {boxStatus}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveBoxModal({ customer, logKey });
                                setSelectedBoxStatus('Collected');
                                setBoxNotes('');
                              }}
                              className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                            >
                              <Check size={14} /> Mark Box Recollected (Clean)
                            </button>
                          )}

                          {logRecord?.boxNotes && (
                            <span className="text-[10px] text-slate-400 italic">
                              Note: {logRecord.boxNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {stops.length === 0 && (
            <div className="glass-card bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-3">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-base">All Caught Up!</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No active deliveries scheduled for {selectedMeal} under {currentBoy ? currentBoy.name : 'this rider'} today.
              </p>
              {!showAllUnassigned && customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllUnassigned(true)}
                  className="mt-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Show All Kitchen Drops for {selectedMeal}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Rider Switcher Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-display text-base text-white">Select Delivery Partner</h3>
              {selectedBoyId && (
                <button onClick={() => setLoginModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Enter your mobile number or tap your profile to load today's route.
            </p>

            {/* Mobile Number Login Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-300">Rider Mobile Number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="tel"
                    placeholder="Enter 10-digit number"
                    value={phoneInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhoneInput(val);
                      const digits = val.replace(/\D/g, '');
                      if (digits.length >= 10) {
                        const matched = allStaff.find(s => s.mobile?.replace(/\D/g, '').endsWith(digits.slice(-10)));
                        if (matched) {
                          setSelectedBoyId(matched.id);
                          setLoginModalOpen(false);
                        }
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const digits = phoneInput.replace(/\D/g, '');
                    const matched = allStaff.find(s => s.mobile?.replace(/\D/g, '').endsWith(digits.slice(-10)));
                    if (matched) {
                      setSelectedBoyId(matched.id);
                      setLoginModalOpen(false);
                    } else {
                      alert('No rider found with this phone number. Please choose your name from the list below or check with kitchen manager.');
                    }
                  }}
                  className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                >
                  Login
                </button>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase font-semibold">Or Select Profile</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {allStaff.map(boy => (
                <button
                  key={boy.id}
                  onClick={() => {
                    setSelectedBoyId(boy.id);
                    setLoginModalOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedBoyId === boy.id 
                      ? 'bg-amber-500/20 border-amber-500/50 text-white' 
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white">{boy.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{boy.mobile}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              ))}
              {allStaff.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4 italic">
                  No delivery partners found in this kitchen branch.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Box Recollection Detailed Modal */}
      {activeBoxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base text-white">Box Return Condition</h3>
                <p className="text-xs text-slate-400">{activeBoxModal.customer.name}</p>
              </div>
              <button onClick={() => setActiveBoxModal(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Assigned Box</span>
              <span className="font-bold text-amber-300 text-sm">
                🍱 {activeBoxModal.customer.reusableBoxType || '3-Tier Stainless Steel'}
              </span>
            </div>

            {/* Condition Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Select Return Status:</label>
              {[
                { status: 'Collected', icon: '✅', label: 'Collected (Clean & Intact)', desc: 'Returned in good hygiene condition' },
                { status: 'Dirty / Unwashed', icon: '🧽', label: 'Dirty / Needs Cleaning', desc: 'Returned with food residue / unwashed' },
                { status: 'Damaged / Missing Parts', icon: '💥', label: 'Damaged or Missing Part', desc: 'Broken clip, missing lid, or dented' },
                { status: 'Not Returned', icon: '⏳', label: 'Not Returned Today', desc: 'Customer retained box; recollect tomorrow' }
              ].map(opt => (
                <button
                  key={opt.status}
                  type="button"
                  onClick={() => setSelectedBoxStatus(opt.status as BoxRecollectionStatus)}
                  className={`w-full p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedBoxStatus === opt.status 
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs' 
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div>
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Condition Remarks (Optional):</label>
              <textarea
                value={boxNotes}
                onChange={e => setBoxNotes(e.target.value)}
                placeholder="e.g. Lid clip missing, will pay ₹50 replacement fee..."
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-400 resize-none h-16"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveBoxModal(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBoxRecollection}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold shadow-md active:scale-95"
              >
                Confirm Box Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;
