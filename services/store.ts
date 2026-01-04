
// Types for the Store
export interface GlobalBranch {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface GlobalPlan {
  id: string;
  branchId: string;
  name: string;
  price: number;
  numberOfDeliveryDays: number; // e.g., 26 for monthly
  weekdays: number[]; // [1,2,3,4,5] (0=Sun, 1=Mon)
}

export interface GlobalDeliveryBoy {
  id: string;
  branchId: string;
  name: string;
  mobile: string;
}

export interface GlobalCustomer {
  id: string;
  branchId: string;
  name: string;
  mobile: string;
  address: string;
  area: string;
  locationLink?: string;
  planId: string;
  deliveryBoyId: string;
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner'; 
  
  // Status & Dates
  isActive: boolean;
  startDate: string;
  endDate: string;
  daysLeft: number; // This is a snapshot, but UI should calculate live
  
  // Financials
  paymentStatus: 'Paid' | 'Pending';
  amountPaid: number;
  planPrice: number;
  deliveryCharges?: number; // Optional delivery charges
  pendingAmount: number;
  renewalCount: number;
  
  // Delivery Logic
  routeOrder: number;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  month: string; // e.g., 'Jan'
}

export type ExpenseCategory = 'Food' | 'Salaries' | 'Packaging' | 'Rent' | 'Marketing' | 'Transportation' | 'Others';

export interface ExpenseItem {
  name: string;
  quantity: number;
  unit: string;
  amount: number;
}

export interface GlobalExpense {
  id: string;
  branchId: string;
  category: ExpenseCategory;
  title: string;
  description: string;
  date: string;
  paymentStatus: 'Paid' | 'Pending';
  paymentMethod: 'UPI' | 'Cash' | 'Card';
  amount: number;
  items?: ExpenseItem[];
}

export interface InventoryItem {
  id: string;
  branchId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  costPerUnit?: number;
  lastUpdated: string;
}

// --- HELPER LOGIC ---

/**
 * Calculates End Date by adding 'count' valid delivery days to Start Date.
 * Skips days NOT in allowedWeekdays.
 */
export const calculateEndDate = (startDateStr: string, totalDeliveryDays: number, allowedWeekdays: number[]): string => {
  if (!startDateStr || totalDeliveryDays <= 0 || !allowedWeekdays || allowedWeekdays.length === 0) return startDateStr;
  
  let currentDate = new Date(startDateStr);
  let deliveriesCounted = 0;
  
  // If the start date itself is a delivery day, count it (depends on business logic, usually subscription starts ON the day)
  if (allowedWeekdays.includes(currentDate.getDay())) {
    deliveriesCounted++;
  }

  // Safety break to prevent infinite loops if something is wrong
  let safetyLoop = 0; 
  while (deliveriesCounted < totalDeliveryDays && safetyLoop < 730) { // Max 2 years loop
    currentDate.setDate(currentDate.getDate() + 1);
    if (allowedWeekdays.includes(currentDate.getDay())) {
      deliveriesCounted++;
    }
    safetyLoop++;
  }
  
  return currentDate.toISOString().split('T')[0];
};

/**
 * Calculates how many VALID delivery days are left between Today and EndDate.
 */
export const calculateRemainingDeliveries = (endDateStr: string, allowedWeekdays: number[]): number => {
  if (!endDateStr || !allowedWeekdays || allowedWeekdays.length === 0) return 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const end = new Date(endDateStr);
  end.setHours(0,0,0,0);

  if (today > end) return 0;

  let count = 0;
  let current = new Date(today);

  // Loop from Today until End Date
  // Safety loop 365 days
  let safetyLoop = 0;
  while (current <= end && safetyLoop < 366) {
    if (allowedWeekdays.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }

  return count;
};

/**
 * Counts how many delivery days fall within a specific date range (inclusive).
 * Used for Pause calculation.
 */
export const countDeliveryDays = (startStr: string, endStr: string, allowedWeekdays: number[]): number => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  if (start > end) return 0;

  let count = 0;
  let current = new Date(start);
  
  while (current <= end) {
    if (allowedWeekdays.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Checks if a specific date is a valid delivery day for a plan
 */
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

export const addDaysToDate = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

// --- MOCK DATA FOR INITIALIZATION ---
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
  ownerName: "",
  email: "",
  mobile: "", 
  businessName: "",
  description: "",
  category: "Cloud Kitchen",
  country: "India",
  state: "",
  city: "",
  isProfileComplete: false,
  planName: "None",
  planExpiryDate: new Date().toISOString().split('T')[0],
  planStatus: 'Inactive'
};
