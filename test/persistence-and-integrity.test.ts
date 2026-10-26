import { describe, it, expect } from 'vitest';
import { 
  calculateEndDate, 
  calculateRemainingDeliveries, 
  getCustomerActiveDaysLeft,
  formatDateDDMMYYYY,
  GlobalCustomer,
  GlobalPlan,
  PauseEvent
} from '../services/store';
import { 
  sanitizeFirestoreData, 
  getTargetBusinessId 
} from '../services/dbService';

describe('ScaleKitchen Database Persistence & Data Integrity Tests', () => {

  describe('1. Data Sanitization (Protection against Firestore undefined crash)', () => {
    it('should strip undefined values recursively from flat and nested objects', () => {
      const rawPayload = {
        name: 'Avinash',
        mobile: '9876543210',
        emptyField: undefined,
        nested: {
          area: 'Indiranagar',
          landmark: undefined,
          deep: {
            valid: 100,
            invalid: undefined
          }
        },
        items: [
          { planId: 'p1', notes: undefined, price: 500 },
          { planId: 'p2', notes: 'Vegetarian', price: undefined }
        ]
      };

      const sanitized = sanitizeFirestoreData(rawPayload);

      expect(sanitized.emptyField).toBeUndefined();
      expect(sanitized.name).toBe('Avinash');
      expect(sanitized.nested.landmark).toBeUndefined();
      expect(sanitized.nested.area).toBe('Indiranagar');
      expect(sanitized.nested.deep.invalid).toBeUndefined();
      expect(sanitized.nested.deep.valid).toBe(100);
      expect(sanitized.items[0].notes).toBeUndefined();
      expect(sanitized.items[0].price).toBe(500);
      expect(sanitized.items[1].notes).toBe('Vegetarian');
      expect(sanitized.items[1].price).toBeUndefined();
    });

    it('should handle primitives and null values safely', () => {
      expect(sanitizeFirestoreData(null)).toBeNull();
      expect(sanitizeFirestoreData(undefined)).toBeNull();
      expect(sanitizeFirestoreData('string')).toBe('string');
      expect(sanitizeFirestoreData(12345)).toBe(12345);
      expect(sanitizeFirestoreData(true)).toBe(true);
    });
  });

  describe('2. Multi-Tenant Business ID Resolution', () => {
    it('should return default owner UID when outside manager and driver routes', () => {
      const ownerUid = 'owner_user_123';
      const resolved = getTargetBusinessId(ownerUid);
      expect(resolved).toBe(ownerUid);
    });

    it('should return empty string safely when no fallback and no auth currentUser', () => {
      const resolved = getTargetBusinessId('');
      expect(typeof resolved).toBe('string');
    });
  });

  describe('3. Customer Expiration & Days Left Consistency (Preventing Old Expired Customers in Notifications)', () => {
    const samplePlans: GlobalPlan[] = [
      { id: 'plan_lunch', branchId: 'b1', name: 'Weight Gain', price: 3000, numberOfDeliveryDays: 26, weekdays: [1,2,3,4,5,6] },
      { id: 'plan_dinner', branchId: 'b1', name: 'Keto Diet', price: 3500, numberOfDeliveryDays: 26, weekdays: [1,2,3,4,5,6] }
    ];

    it('should accurately detect expired customers with past end dates', () => {
      const pastCustomer = {
        id: 'cust_expired_1',
        name: 'Avinash Expired',
        mobile: '9123456789',
        address: '123 MG Road',
        area: 'Indiranagar',
        createdAt: '2026-09-01',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_lunch',
            planName: 'Weight Gain',
            mealTime: 'Lunch',
            startDate: '2026-09-01',
            endDate: '2026-09-30', // expired weeks ago
            price: 3000,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(pastCustomer, samplePlans);
      expect(status.isExpired).toBe(true);
      expect(status.daysLeft).toBe(0);
    });

    it('should accurately detect customer ending today (0 days left)', () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const kartiCustomer = {
        id: 'cust_karti_13',
        name: 'Karti',
        mobile: '4400228854',
        address: 'RG Nagar',
        area: 'Bellenduru',
        createdAt: '2026-09-26',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_dinner',
            planName: 'Keto Diet',
            mealTime: 'Dinner',
            startDate: '2026-09-26',
            endDate: todayStr, // ends today
            price: 3500,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(kartiCustomer, samplePlans);
      expect(status.isExpired).toBe(false);
      expect(status.daysLeft).toBe(0);
      expect(status.endDate).toBe(todayStr);
    });

    it('should calculate future deliveries correctly for active customers', () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 14);
      const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

      const activeCustomer = {
        id: 'cust_active_1',
        name: 'Priya Sharma',
        mobile: '9876501234',
        address: 'HSR Layout Sector 2',
        area: 'HSR Layout',
        createdAt: '2026-10-15',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_lunch',
            planName: 'Weight Gain',
            mealTime: 'Lunch',
            startDate: '2026-10-15',
            endDate: futureStr,
            price: 3000,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(activeCustomer, samplePlans);
      expect(status.isExpired).toBe(false);
      expect(status.daysLeft).toBeGreaterThan(0);
    });
  });

  describe('4. Date and Pause Calculation Precision', () => {
    it('should push end date forward by the exact number of paused delivery days', () => {
      const weekdays = [1, 2, 3, 4, 5, 6]; // Mon to Sat (6 days/week)
      const startDate = '2026-11-02'; // Monday

      // 6 days delivery without pauses ends on Saturday 2026-11-07
      const normalEnd = calculateEndDate(startDate, 6, weekdays, []);
      expect(normalEnd).toBe('2026-11-07');

      // Adding 2 delivery days pause (Wednesday 2026-11-04 to Thursday 2026-11-05)
      const pauses: PauseEvent[] = [
        { start: '2026-11-04', end: '2026-11-05', type: 'User' }
      ];

      const pausedEnd = calculateEndDate(startDate, 6, weekdays, pauses);
      // Pushed by 2 delivery days from Saturday 2026-11-07: Sunday skipped -> Mon 2026-11-09, Tue 2026-11-10
      expect(pausedEnd).toBe('2026-11-10');
    });

    it('should format dates as DD/MM/YYYY reliably', () => {
      expect(formatDateDDMMYYYY('2026-10-26')).toBe('26/10/2026');
      expect(formatDateDDMMYYYY('2026-01-05')).toBe('05/01/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
    });
  });
});
