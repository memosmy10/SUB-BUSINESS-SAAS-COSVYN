
// Types
export type SubscriptionPlanType = "Monthly" | "6 Months" | "Yearly";

export interface TenantUser {
  id: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  businessCategory: string;
  businessDescription: string;
  city: string;
  state: string; // Indian State
  currentPlanType: SubscriptionPlanType;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  isActive: boolean;
  consecutiveMonthsSubscribed: number;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planType: SubscriptionPlanType;
  startDate: string;
  endDate: string;
  amountPaid: number;
  transactionId: string;
}

export interface FeatureRequest {
  id: string;
  tenantId: string;
  businessName?: string;
  featureName: string;
  description: string;
  status: "Pending" | "Processing" | "Approved" | "Delayed";
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  businessName?: string;
  issueType: string;
  description: string;
  status: "Open" | "In Progress" | "Resolved";
  createdAt: string;
}

export interface Review {
  id: string;
  tenantId: string;
  businessName?: string;
  rating: number; // 1-5
  reviewText: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

// --- CONFIGURATION ---
export const ADMIN_EMAIL = 'cosvynsolutions@gmail.com';
