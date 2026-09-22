
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

export interface SubscribedPlan {
  planId: string;
  planName: string;
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner';
  startDate: string;
  endDate: string;
  price: number;
  pauses: PauseEvent[];
  isStarred?: boolean; // NEW: Track special preparation requirements per plan
  isCustom?: boolean;
  totalDeliveries?: number;
  weekdays?: number[];
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
  
  // NEW: Multi-plan support
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

  // NEW: Highlight and Notes
  highlightMark?: 'None' | 'VIP' | 'Dietary' | 'Allergy' | 'Urgent';
  notes?: string;
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
