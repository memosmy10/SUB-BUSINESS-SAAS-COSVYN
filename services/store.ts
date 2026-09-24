
// Types for the Store
export interface GlobalBranch {
  id: string;
  name: string;
  city: string;
  state: string;
  hubAddress?: string;
  hubLocationLink?: string;
  hubLat?: number;
  hubLng?: number;
}

export interface GlobalPlan {
  id: string;
  branchId: string;
  name: string;
  price: number;
  numberOfDeliveryDays: number;
  weekdays: number[];
}

export interface PauseEvent {
  start: string;
  end: string;
  type: 'User' | 'Branch';
}

export type BoxRecollectionStatus = 'Collected Clean' | 'Collected Unclean' | 'Damaged / Missing Part' | 'Not Returned' | 'Pending';

export interface BoxCollectionEntry {
  status: BoxRecollectionStatus;
  boxType: string;
  issueNote?: string;
  collectedAt?: string;
  updatedBy?: string;
}

export interface ReusableBoxConfig {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  defaultDeposit: number;
}

export const REUSABLE_BOX_TYPES: ReusableBoxConfig[] = [
  { id: 'None', name: 'None (Disposable / Paper Meal Tray)', shortLabel: 'Disposable', description: 'Single-use biodegradable packaging (no recollection needed)', defaultDeposit: 0 },
  { id: 'Stainless Steel 3-Tier Dabba', name: 'Stainless Steel 3-Tier Dabba', shortLabel: 'Steel 3-Tier', description: 'Classic 3-tier stainless steel tiffin with latch handle', defaultDeposit: 300 },
  { id: 'Stainless Steel 4-Tier Dabba', name: 'Stainless Steel 4-Tier Dabba', shortLabel: 'Steel 4-Tier', description: 'Heavy-gauge 4-tier steel tiffin carrier for full meals', defaultDeposit: 400 },
  { id: 'Insulated Thermal Bento Box', name: 'Insulated Thermal Bento Box', shortLabel: 'Thermal Bento', description: 'Multi-compartment leakproof thermal insulated box', defaultDeposit: 350 },
  { id: 'Eco Glass-Lock Meal Container', name: 'Eco Glass-Lock Meal Container', shortLabel: 'Glass-Lock', description: 'Borosilicate glass box with 4-snap airtight silicone lid', defaultDeposit: 250 },
  { id: 'Microwavable Heavy-Duty PP Box', name: 'Microwavable Heavy-Duty PP Box', shortLabel: 'Heavy PP', description: 'BPA-free reusable dishwasher-safe plastic container', defaultDeposit: 150 },
  { id: 'Custom Reusable Box', name: 'Custom Reusable Box', shortLabel: 'Custom Box', description: 'Custom branded commercial reusable tiffin box', defaultDeposit: 200 }
];

export interface SubscribedPlan {
  planId: string;
  planName: string;
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner';
  startDate: string;
  endDate: string;
  price: number;
  pauses: PauseEvent[];
  isStarred?: boolean; // Track special preparation requirements per plan
  isCustom?: boolean;
  totalDeliveries?: number;
  weekdays?: number[];
  
  // Reusable Box Configuration
  reusableBoxType?: string; // e.g. 'Stainless Steel 3-Tier Dabba' or 'None'
  boxTagOrNumber?: string; // Box identifier or barcode e.g. 'BX-102'
  boxDeposit?: number; // Refundable box deposit if taken
}

export interface GlobalCustomer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  area: string;
  locationLink?: string;
  createdAt: string;
  branchId: string;
  deliveryBoyId: string;
  deliveryBoyName?: string;
  
  // Multi-plan support
  activePlans: SubscribedPlan[];
  pastPlans?: SubscribedPlan[];
  
  // Flattened for quick table access (primary plan)
  planId: string; 
  mealTime: string[]; // ['Breakfast', 'Lunch']
  isActive: boolean;
  startDate: string;
  endDate: string; // Max end date across all plans
  daysLeft: number; // Max days left across all plans
  
  // Financials
  paymentStatus: 'Paid' | 'Pending';
  amountPaid: number;
  planPrice: number; // Total price of all plans
  deliveryCharges: number;
  pendingAmount: number;
  renewalCount: number;
  
  routeOrder: number;
  updatedAt?: string;

  // Highlight and Notes
  highlightMark?: 'None' | 'VIP' | 'Dietary' | 'Allergy' | 'Urgent';
  notes?: string;

  // Reusable Box Collection Records (keyed by `${dateStr}_${mealTime}`)
  boxCollections?: Record<string, BoxCollectionEntry>;
  reusableBoxType?: string;
  reusableBoxEnabled?: boolean;
  boxTagOrNumber?: string;
  uncollectedBoxesCount?: number;
}

export interface DeliveryBoyStaff {
  id: string;
  name: string;
  mobile: string;
  branchId?: string;
  role?: string;
  status?: 'Online' | 'Offline' | 'On Delivery';
  lastAttendanceDate?: string;
  attendanceMarkedAt?: string;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;
  batteryLevel?: number;
  updatedAt?: string;
}

// Fix: Added missing Expense types used in Expenses.tsx
export interface ExpenseItem {
  name: string;
  quantity: number;
  unit: string;
  amount: number;
}

export interface GlobalExpense {
  id: string;
  branchId: string;
  date: string;
  category: string;
  title: string;
  description?: string;
  paymentStatus: 'Paid' | 'Pending';
  paymentMethod: string;
  amount: number;
  items?: ExpenseItem[];
  createdAt?: string;
  updatedAt?: string;
}

// Fix: Added missing InventoryItem type used in Inventory.tsx
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  branchId: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- HELPER LOGIC ---

export const calculateEndDate = (startDateStr: string, totalDeliveryDays: number, allowedWeekdays: number[], pauses: PauseEvent[] = []): string => {
  if (!startDateStr || totalDeliveryDays <= 0 || !allowedWeekdays || allowedWeekdays.length === 0) return startDateStr;
  
  const [y, m, d] = startDateStr.split('-').map(Number);
  let currentDate = new Date(y, m - 1, d);
  let deliveriesCounted = 0;
  
  const isPaused = (dateStr: string) => {
    return pauses.some(p => dateStr >= p.start && dateStr <= p.end);
  };

  let safetyLoop = 0; 
  while (deliveriesCounted < totalDeliveryDays && safetyLoop < 1000) {
    const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayOfWeek = currentDate.getDay();
    
    if (allowedWeekdays.includes(dayOfWeek) && !isPaused(dStr)) {
      deliveriesCounted++;
    }
    
    if (deliveriesCounted < totalDeliveryDays) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    safetyLoop++;
  }
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
};

export const calculateRemainingDeliveries = (endDateStr: string, allowedWeekdays: number[], pauses: PauseEvent[] = []): number => {
  if (!endDateStr || !allowedWeekdays || allowedWeekdays.length === 0) return 0;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);
  
  if (today > end) return 0;
  
  let count = 0;
  let current = new Date(today);
  current.setDate(current.getDate() + 1); // Count remaining deliveries starting from tomorrow
  
  const isPaused = (dateStr: string) => {
    return pauses.some(p => dateStr >= p.start && dateStr <= p.end);
  };

  let safetyLoop = 0;
  while (current <= end && safetyLoop < 366) {
    const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (allowedWeekdays.includes(current.getDay()) && !isPaused(dStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }
  return count;
};

export const countDeliveryDays = (startStr: string, endStr: string, allowedWeekdays: number[]): number => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  if (start > end) return 0;
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (allowedWeekdays.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculates which delivery day number (1-based index) today is for a customer's specific plan.
 * - Returns 1: First delivery day (New box issued, NO previous box to recollect)
 * - Returns >= 2: 2nd day or later (Previous day's reusable box MUST be recollected)
 * - Returns 0: Not an active delivery day today (paused or off-day)
 */
export const getPlanDeliveryDayNumber = (
  planOrStart: SubscribedPlan | string,
  targetDateStr: string,
  allowedWeekdays?: number[],
  pauses?: PauseEvent[]
): number => {
  let startDateStr = '';
  let weekdays = allowedWeekdays || [1, 2, 3, 4, 5, 6];
  let pauseEvents = pauses || [];

  if (typeof planOrStart === 'object' && planOrStart !== null) {
    startDateStr = planOrStart.startDate || '';
    weekdays = planOrStart.weekdays || weekdays;
    pauseEvents = planOrStart.pauses || pauseEvents;
  } else if (typeof planOrStart === 'string') {
    startDateStr = planOrStart;
  }

  if (!startDateStr || !targetDateStr) return 0;
  if (targetDateStr < startDateStr) return 0;

  const isPaused = (dStr: string) => {
    return (pauseEvents || []).some(p => dStr >= p.start && dStr <= p.end);
  };

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const target = new Date(ty, tm - 1, td);

  let deliveryDayCount = 0;
  let current = new Date(start);
  let safetyLoop = 0;

  while (current <= target && safetyLoop < 1000) {
    const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const dayOfWeek = current.getDay();

    if (weekdays.includes(dayOfWeek) && !isPaused(dStr)) {
      deliveryDayCount++;
      if (dStr === targetDateStr) {
        return deliveryDayCount;
      }
    } else if (dStr === targetDateStr) {
      // Target date itself is not a scheduled delivery day
      return 0;
    }

    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }

  return deliveryDayCount;
};

export const isCustomerDeliveryDay2Plus = (customer: GlobalCustomer, targetDateStr: string): boolean => {
  if (!customer) return false;
  // Check any active plan with reusable box
  const plans = (customer.activePlans || []).filter(p => p.reusableBoxType && p.reusableBoxType !== 'None');
  if (plans.length > 0) {
    return plans.some(p => {
      const dayNum = getPlanDeliveryDayNumber(p, targetDateStr);
      return dayNum >= 2;
    });
  }
  // Check if customer has general reusable box enabled
  if (customer.reusableBoxEnabled || (customer.reusableBoxType && customer.reusableBoxType !== 'None')) {
    const start = customer.startDate || '';
    if (!start) return false;
    return targetDateStr > start;
  }
  return false;
};

/**
 * Calculates how many reusable boxes are currently with the customer (uncollected).
 * Supports manual override if owner has updated `customer.uncollectedBoxesCount`.
 */
export const getCustomerUncollectedBoxesCount = (customer: GlobalCustomer): number => {
  if (!customer) return 0;
  if (typeof customer.uncollectedBoxesCount === 'number') {
    return Math.max(0, customer.uncollectedBoxesCount);
  }
  const health = getCustomerBoxHealth(customer);
  // Default estimate: unreturned count + (if day 2+ and has reusable box, 1 box is currently at customer)
  const hasReusablePlan = (customer.activePlans || []).some(p => p.reusableBoxType && p.reusableBoxType !== 'None') || Boolean(customer.reusableBoxEnabled);
  if (!hasReusablePlan) return 0;
  
  if (health.unreturned > 0) return health.unreturned;
  // If active customer on reusable box, they at least hold 1 container from previous delivery
  return customer.isActive ? 1 : 0;
};

export const getCustomerBoxHealth = (customer: GlobalCustomer) => {
  const collections = Object.entries(customer.boxCollections || {}).map(([key, val]: [string, any]) => ({
    key,
    date: val.date || key.split('_')[0],
    mealTime: val.mealTime || key.split('_')[1] || 'Lunch',
    status: val.status,
    notes: val.notes || val.issueNote || '',
    boxTagOrNumber: val.boxTagOrNumber || '',
    boxType: val.boxType || ''
  }));
  const clean = collections.filter(c => c.status === 'Collected Clean' || c.status === 'returned_clean').length;
  const unclean = collections.filter(c => c.status === 'Collected Unclean' || c.status === 'unclean').length;
  const damaged = collections.filter(c => c.status === 'Damaged / Missing Part' || c.status === 'damaged' || c.status === 'missing_part').length;
  const notReturned = collections.filter(c => c.status === 'Not Returned' || c.status === 'not_returned').length;
  const damagedOrDirty = unclean + damaged;
  const unreturned = notReturned;
  const totalCollected = clean;
  const totalExpected = collections.length;

  return { 
    clean, 
    unclean, 
    damaged, 
    notReturned, 
    damagedOrDirty,
    unreturned,
    totalCollected,
    totalExpected,
    totalRecorded: collections.length,
    history: collections
  };
};

export const isDeliveryDay = (date: Date, allowedWeekdays: number[]): boolean => {
  if (!allowedWeekdays) return false;
  return allowedWeekdays.includes(date.getDay());
}

export const getDaysDifference = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

export const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
];

export interface BusinessProfile {
  ownerName: string;
  email: string;
  mobile: string; 
  businessName: string;
  description: string;
  category: string;
  country: string;
  state: string;
  city: string;
  isProfileComplete: boolean;
  planName: string;
  planExpiryDate: string; 
  planStatus: 'Active' | 'Expired' | 'Inactive';
}

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  ownerName: "", email: "", mobile: "", businessName: "", description: "",
  category: "Cloud Kitchen", country: "India", state: "", city: "",
  isProfileComplete: false, planName: "None", planExpiryDate: new Date().toISOString().split('T')[0],
  planStatus: 'Inactive'
};
