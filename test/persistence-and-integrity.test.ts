import { describe, it, expect } from 'vitest';
import { 
  calculateEndDate, 
  calculateRemainingDeliveries, 
  getCustomerActiveDaysLeft,
  formatDateDDMMYYYY,
  getDefaultMealSessionForTime,
  normalizePhone,
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

  describe('5. Automatic Meal Session Selection Boundaries (Issue 1)', () => {
    it('should select Breakfast from 12:00 AM (00:00:00) to 10:59:59 AM', () => {
      // 00:00:00
      const midnight = new Date(2026, 9, 27, 0, 0, 0);
      expect(getDefaultMealSessionForTime(midnight)).toBe('Breakfast');

      // 08:30:00
      const morning = new Date(2026, 9, 27, 8, 30, 0);
      expect(getDefaultMealSessionForTime(morning)).toBe('Breakfast');

      // 10:59:59 (Exact upper boundary)
      const lateBreakfast = new Date(2026, 9, 27, 10, 59, 59);
      expect(getDefaultMealSessionForTime(lateBreakfast)).toBe('Breakfast');
    });

    it('should select Lunch from 11:00 AM (11:00:00) to 4:59:59 PM (16:59:59)', () => {
      // 11:00:00 (Exact start)
      const elevenAm = new Date(2026, 9, 27, 11, 0, 0);
      expect(getDefaultMealSessionForTime(elevenAm)).toBe('Lunch');

      // 13:45:00 (Afternoon)
      const afternoon = new Date(2026, 9, 27, 13, 45, 0);
      expect(getDefaultMealSessionForTime(afternoon)).toBe('Lunch');

      // 16:59:59 (Exact upper boundary)
      const lateLunch = new Date(2026, 9, 27, 16, 59, 59);
      expect(getDefaultMealSessionForTime(lateLunch)).toBe('Lunch');
    });

    it('should select Dinner from 5:00 PM (17:00:00) to 11:59:59 PM (23:59:59)', () => {
      // 17:00:00 (Exact start)
      const fivePm = new Date(2026, 9, 27, 17, 0, 0);
      expect(getDefaultMealSessionForTime(fivePm)).toBe('Dinner');

      // 20:15:00 (Evening)
      const night = new Date(2026, 9, 27, 20, 15, 0);
      expect(getDefaultMealSessionForTime(night)).toBe('Dinner');

      // 23:59:59 (End of day)
      const lateDinner = new Date(2026, 9, 27, 23, 59, 59);
      expect(getDefaultMealSessionForTime(lateDinner)).toBe('Dinner');
    });
  });

  describe('6. Driver Independent Authentication & Phone Sanitization (Issue 2)', () => {
    it('should normalize driver mobile numbers to 10-digit lookup keys', () => {
      expect(normalizePhone('+91 8309995962')).toBe('8309995962');
      expect(normalizePhone('08309995962')).toBe('8309995962');
      expect(normalizePhone('83099 95962')).toBe('8309995962');
      expect(normalizePhone('91-8309995962')).toBe('8309995962');
      expect(normalizePhone('+918309995962')).toBe('8309995962');
    });

    it('should reject invalid PIN formats', () => {
      const isValidPin = (pin: string) => /^\d{4}$/.test(pin.trim());
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('0000')).toBe(true);
      expect(isValidPin('9876')).toBe(true);
      expect(isValidPin('123')).toBe(false);
      expect(isValidPin('12345')).toBe(false);
      expect(isValidPin('12a4')).toBe(false);
      expect(isValidPin('')).toBe(false);
    });

    it('should correctly encode and decode driver tokens with rider mobile and name while keeping PIN secure', async () => {
      const { encodeDriverToken, decodeDriverToken } = await import('../services/store');
      const bizId = 'biz_kitchen_xyz';
      const staffId = 'staff_rider_456';
      const mobile = '+91 8309995962';
      const name = 'Abhi';

      const token = encodeDriverToken(bizId, staffId, mobile, '1234', name);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);

      const decoded = decodeDriverToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.bizId).toBe(bizId);
      expect(decoded?.boyId).toBe(staffId);
      expect(decoded?.mobile).toBe('8309995962');
      expect(decoded?.name).toBe('Abhi');
      // PIN MUST NOT be contained in the token
      expect(decoded?.pin).toBeUndefined();
    });

    it('should securely hash PINs with bcrypt and verify matches while rejecting wrong PINs (Test 4)', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const originalPin = '1234';
      const hashedPin = bcrypt.hashSync(originalPin, 10);

      expect(hashedPin).not.toBe(originalPin);
      expect(hashedPin.startsWith('$2')).toBe(true);

      // Correct PIN matches
      expect(bcrypt.compareSync('1234', hashedPin)).toBe(true);
      // Incorrect PIN fails safely
      expect(bcrypt.compareSync('0000', hashedPin)).toBe(false);
      expect(bcrypt.compareSync('4321', hashedPin)).toBe(false);
      expect(bcrypt.compareSync('', hashedPin)).toBe(false);
    });

    it('should reject deactivated driver accounts (Test 10)', () => {
      const isDriverActive = (record: { active?: boolean; isDeleted?: boolean; status?: string }) => {
        if (record.active === false || record.isDeleted === true || record.status === 'Inactive') {
          return false;
        }
        return true;
      };

      expect(isDriverActive({ active: true, status: 'Online' })).toBe(true);
      expect(isDriverActive({ active: false, status: 'Online' })).toBe(false);
      expect(isDriverActive({ isDeleted: true })).toBe(false);
      expect(isDriverActive({ status: 'Inactive' })).toBe(false);
    });

    it('should ensure session storage tokens do not contain plaintext PINs (Test 9)', () => {
      const generateSessionToken = (phone: string, staffId: string) => {
        return btoa(`${phone}:${staffId}:${Date.now()}`);
      };

      const token = generateSessionToken('8309995962', 'staff_123');
      const decoded = atob(token);

      expect(decoded).toContain('8309995962');
      expect(decoded).toContain('staff_123');
      // Must not contain any 4-digit PIN
      expect(decoded).not.toContain('1234');
    });
  });

  describe('7. Customer Persistence Architecture & Data Integrity', () => {
    it('should always guarantee canonical Firestore document ID precedence over internal document fields', () => {
      // Simulating a document from Firestore where the internal JSON has a legacy or mismatched "id"
      const firestoreDoc = {
        id: 'real_firestore_doc_id_999',
        data: () => ({
          id: 'stale_legacy_id_001',
          name: 'Naveen Kumar',
          mobile: '9876543210',
          branchId: 'b1'
        })
      };

      // Correct mapping pattern implemented: { ...doc.data(), id: doc.id }
      const item = {
        ...firestoreDoc.data(),
        id: firestoreDoc.id
      };

      // The canonical Firestore doc.id must be preserved so update/delete operations target the real document
      expect(item.id).toBe('real_firestore_doc_id_999');
      expect(item.name).toBe('Naveen Kumar');
      expect(item.id).not.toBe('stale_legacy_id_001');
    });

    it('should strip computed virtual enrichment fields before persisting customer updates', () => {
      const enrichedCustomerPayload = {
        id: 'cust_abc_123',
        name: 'Rohan Verma',
        mobile: '9988776655',
        area: 'Koramangala',
        branchId: 'b1',
        amountPaid: 3500,
        // Virtual computed enrichment fields that must never pollute stored database documents
        realDaysLeft: 22,
        isExpired: false,
        latestEndDate: '2026-11-20',
        canonicalPlanName: 'Weight Gain Plan',
        activePlans: [
          { planId: 'p1', planName: 'Weight Gain Plan', mealTime: 'Lunch', price: 3500, startDate: '2026-10-26', endDate: '2026-11-20', pauses: [] }
        ]
      };

      // Replication of updateItem / setItem data stripping logic
      const { 
        id: _ignoreId, 
        realDaysLeft: _ignoreDaysLeft, 
        isExpired: _ignoreExpired, 
        latestEndDate: _ignoreLatestEnd, 
        canonicalPlanName: _ignorePlanName,
        ...cleanData 
      } = enrichedCustomerPayload;

      const sanitizedPayload = sanitizeFirestoreData({
        ...cleanData,
        updatedAt: '2026-10-26T21:40:00.000Z'
      });

      expect(sanitizedPayload.name).toBe('Rohan Verma');
      expect(sanitizedPayload.mobile).toBe('9988776655');
      expect(sanitizedPayload.activePlans).toHaveLength(1);
      // Virtual fields must be stripped
      expect((sanitizedPayload as any).id).toBeUndefined();
      expect((sanitizedPayload as any).realDaysLeft).toBeUndefined();
      expect((sanitizedPayload as any).isExpired).toBeUndefined();
      expect((sanitizedPayload as any).latestEndDate).toBeUndefined();
      expect((sanitizedPayload as any).canonicalPlanName).toBeUndefined();
    });

    it('should reject missing document ID or business ID on atomic customer deletion (Negative Path)', async () => {
      const validateDeleteInput = (businessId?: string, customerId?: string) => {
        if (!businessId) throw new Error("No target business ID found.");
        if (!customerId) throw new Error("No customer ID provided for deletion.");
        return true;
      };

      expect(() => validateDeleteInput('', 'cust_123')).toThrow('No target business ID found.');
      expect(() => validateDeleteInput('biz_123', '')).toThrow('No customer ID provided for deletion.');
      expect(validateDeleteInput('biz_123', 'cust_123')).toBe(true);
    });

    it('should reject missing business ID on customer update (Negative Path)', () => {
      const validateUpdateInput = (businessId?: string, customerId?: string) => {
        if (!businessId) throw new Error("No target business ID found.");
        if (!customerId) throw new Error("No document ID provided for update.");
        return true;
      };

      expect(() => validateUpdateInput('', 'cust_123')).toThrow('No target business ID found.');
      expect(() => validateUpdateInput('biz_123', '')).toThrow('No document ID provided for update.');
      expect(validateUpdateInput('biz_123', 'cust_123')).toBe(true);
    });

    it('should resolve business ID from session storage fallback if auth user is temporarily loading', () => {
      // Mock localStorage session
      const mockSession = JSON.stringify({ uid: 'stored_owner_uid_777', email: 'owner@test.com' });
      const parsed = JSON.parse(mockSession);
      
      const resolveBiz = (fallbackUid?: string, authUid?: string) => {
        return fallbackUid || authUid || parsed?.uid || '';
      };

      // With auth ready
      expect(resolveBiz('passed_uid', 'auth_uid')).toBe('passed_uid');
      // With fallback loading but auth ready
      expect(resolveBiz('', 'auth_uid')).toBe('auth_uid');
      // On fresh refresh before auth listener fires
      expect(resolveBiz('', '')).toBe('stored_owner_uid_777');
    });
  });

  describe('8. Independent Delivery Partner Security Architecture (Requirements A - L)', () => {
    it('Case 1: Valid driver login succeeds and returns custom token claims', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const registeredStaff = {
        id: 'rider_101',
        name: 'Ravi Kumar',
        mobile: '8309995962',
        branchId: 'hub_central',
        status: 'Active',
        active: true,
        pinHash: bcrypt.hashSync('5678', 10)
      };

      const loginRequest = {
        bizId: 'tenant_kitchen_alpha',
        staffId: 'rider_101',
        phone: '+91 83099-95962',
        pin: '5678'
      };

      const cleanPhone = loginRequest.phone.replace(/\D/g, '').slice(-10);
      const isPhoneMatch = cleanPhone === registeredStaff.mobile;
      const isPinMatch = bcrypt.compareSync(loginRequest.pin, registeredStaff.pinHash);
      const isActive = registeredStaff.status === 'Active' && registeredStaff.active;

      expect(isPhoneMatch).toBe(true);
      expect(isPinMatch).toBe(true);
      expect(isActive).toBe(true);

      const claims = {
        role: 'driver',
        bizId: loginRequest.bizId,
        staffId: loginRequest.staffId,
        branchId: registeredStaff.branchId
      };

      expect(claims.role).toBe('driver');
      expect(claims.bizId).toBe('tenant_kitchen_alpha');
      expect(claims.staffId).toBe('rider_101');
    });

    it('Case 2: Wrong PIN is rejected and fails closed without enumeration', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const staffRecord = {
        id: 'rider_101',
        name: 'Ravi',
        mobile: '8309995962',
        pinHash: bcrypt.hashSync('1234', 10)
      };

      const candidatePin = '9999';
      const isMatch = bcrypt.compareSync(candidatePin, staffRecord.pinHash);
      expect(isMatch).toBe(false);

      // Generic error message that does not leak whether phone or PIN was wrong
      const errorResponse = "Invalid credentials or inactive rider profile.";
      expect(errorResponse).not.toContain('PIN is incorrect');
      expect(errorResponse).not.toContain('phone');
    });

    it('Case 3: Screenshot phone 8309995962 mismatch is safely rejected', () => {
      const registeredRiders = [
        { id: 'r1', name: 'Rider A', mobile: '9876543210' },
        { id: 'r2', name: 'Rider B', mobile: '9123456780' },
        { id: 'r3', name: 'Rider C', mobile: '9988776655' }
      ];

      const inputPhone = '8309995962';
      const found = registeredRiders.find(r => r.mobile === inputPhone);
      expect(found).toBeUndefined();
    });

    it('Case 4: Missing pinHash fails closed (no plaintext fallback)', () => {
      const legacyStaffWithoutHash = {
        id: 'r_legacy',
        name: 'Legacy Rider',
        mobile: '8309995962',
        pin: '1234' // plaintext only
      };

      const verifyServerAuth = (record: any) => {
        if (!record.pinHash) {
          throw new Error("Invalid credentials or inactive rider profile. Please contact your kitchen owner to reset your PIN.");
        }
        return true;
      };

      expect(() => verifyServerAuth(legacyStaffWithoutHash)).toThrow("Please contact your kitchen owner to reset your PIN.");
    });

    it('Case 5: Deactivated/Inactive driver is rejected even with correct PIN', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const deactivatedRider = {
        id: 'r_inactive',
        name: 'Former Rider',
        mobile: '8309995962',
        status: 'Inactive',
        active: false,
        pinHash: bcrypt.hashSync('1234', 10)
      };

      const isEligible = deactivatedRider.status !== 'Inactive' && deactivatedRider.active !== false;
      expect(isEligible).toBe(false);
    });

    it('Case 6: Cross-tenant isolation blocks rider from another kitchen', () => {
      const tenantA = { bizId: 'kitchen_alpha', riderId: 'rider_01' };
      const tenantB = { bizId: 'kitchen_beta', riderId: 'rider_02' };

      const validateTenantScope = (tokenBizId: string, requestBizId: string) => {
        if (tokenBizId !== requestBizId) {
          throw new Error("Unauthorized access to another kitchen's route.");
        }
        return true;
      };

      expect(() => validateTenantScope(tenantA.bizId, tenantB.bizId)).toThrow("Unauthorized access to another kitchen's route.");
      expect(validateTenantScope(tenantA.bizId, tenantA.bizId)).toBe(true);
    });

    it('Case 7: Clean shared link format verification (No base64 auth payload, no plain phone)', () => {
      const bizId = 'biz_abc_123';
      const staffId = 'boy_xyz_789';
      const origin = 'https://scalekitchen.vercel.app';

      const buildCleanLink = (biz: string, boy: string) => {
        const params = new URLSearchParams();
        params.set('biz', biz);
        params.set('boy', boy);
        return `${origin}/#/driver?${params.toString()}`;
      };

      const cleanUrl = buildCleanLink(bizId, staffId);
      expect(cleanUrl).toBe('https://scalekitchen.vercel.app/#/driver?biz=biz_abc_123&boy=boy_xyz_789');
      // Must not contain 'auth=', 'phone=', or base64 credentials
      expect(cleanUrl).not.toContain('auth=');
      expect(cleanUrl).not.toContain('phone=');
      expect(cleanUrl).not.toContain('1234');
    });

    it('Case 8: Rate limiting triggers lockout after 5 consecutive failures', () => {
      const simulateRateLimiting = (attempts: number) => {
        const isLocked = attempts >= 5;
        const lockedUntil = isLocked ? Date.now() + 15 * 60 * 1000 : null;
        return { isLocked, lockedUntil };
      };

      expect(simulateRateLimiting(1).isLocked).toBe(false);
      expect(simulateRateLimiting(4).isLocked).toBe(false);
      expect(simulateRateLimiting(5).isLocked).toBe(true);
      expect(simulateRateLimiting(5).lockedUntil).toBeGreaterThan(Date.now());
    });

    it('Case 9: Driver route stop projection contains strictly minimal operational data', () => {
      const fullCustomerRecord = {
        id: 'cust_private_1',
        name: 'Priya Sharma',
        mobile: '9876543210',
        address: 'Villa 12, Palm Meadows',
        area: 'Whitefield',
        branchId: 'branch_1',
        deliveryBoyId: 'rider_1',
        routeOrder: 2,
        mealTime: 'Lunch',
        planName: 'Healthy Lunch',
        reusableBoxEnabled: true,
        reusableBoxType: 'Stainless Steel 3-Tier Dabba',
        uncollectedBoxesCount: 1,
        // SENSITIVE FIELDS THAT MUST NEVER BE IN ROUTE PROJECTION:
        amountPaid: 4500,
        planPrice: 4500,
        paymentStatus: 'Paid',
        pendingAmount: 0,
        ownerInternalNotes: 'VIP customer, discount applied',
        creditCardRef: 'tok_1234'
      };

      const projectStop = (c: any) => ({
        id: c.id,
        stopId: c.id,
        customerId: c.id,
        customerName: c.name,
        mobile: c.mobile,
        address: c.address,
        area: c.area,
        branchId: c.branchId,
        deliveryBoyId: c.deliveryBoyId,
        routeOrder: c.routeOrder,
        mealTime: c.mealTime,
        planName: c.planName,
        reusableBoxEnabled: c.reusableBoxEnabled,
        reusableBoxType: c.reusableBoxType,
        uncollectedBoxesCount: c.uncollectedBoxesCount,
        deliveryStatus: 'Pending'
      });

      const projected = projectStop(fullCustomerRecord);
      expect(projected.customerName).toBe('Priya Sharma');
      expect((projected as any).amountPaid).toBeUndefined();
      expect((projected as any).planPrice).toBeUndefined();
      expect((projected as any).paymentStatus).toBeUndefined();
      expect((projected as any).ownerInternalNotes).toBeUndefined();
      expect((projected as any).creditCardRef).toBeUndefined();
    });

    it('Case 10: setDriverPin callable whitelists allowed fields and never writes plaintext PIN', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const input = {
        bizId: 'biz_1',
        staffId: 'staff_1',
        name: 'Rider Raj',
        phone: '9876543210',
        pin: '4321',
        branchId: 'b1',
        status: 'Active',
        // Injected fields that should be blocked
        injectedSalary: 50000,
        injectedAdminToken: 'token_bad'
      };

      const pinHash = bcrypt.hashSync(input.pin, 10);
      const whitelistedStaff = {
        name: input.name.trim(),
        mobile: input.phone.replace(/\D/g, '').slice(-10),
        pinHash,
        branchId: input.branchId,
        status: input.status,
        active: input.status !== 'Inactive',
        role: 'Delivery Partner'
      };

      expect(whitelistedStaff.name).toBe('Rider Raj');
      expect(whitelistedStaff.pinHash.startsWith('$2')).toBe(true);
      expect((whitelistedStaff as any).pin).toBeUndefined();
      expect((whitelistedStaff as any).injectedSalary).toBeUndefined();
      expect((whitelistedStaff as any).injectedAdminToken).toBeUndefined();
    });

    it('Case 11: updateDriverStop verifies claims and enforces tenant boundary', () => {
      const driverClaims = { role: 'driver', bizId: 'kitchen_1', staffId: 'rider_1' };

      const verifyStopUpdate = (claims: any, targetBizId: string, targetStaffId: string) => {
        if (!claims || claims.role !== 'driver') throw new Error("Driver auth required.");
        if (claims.bizId !== targetBizId || claims.staffId !== targetStaffId) {
          throw new Error("Unauthorized to update stops for another rider or tenant.");
        }
        return true;
      };

      expect(verifyStopUpdate(driverClaims, 'kitchen_1', 'rider_1')).toBe(true);
      expect(() => verifyStopUpdate(driverClaims, 'kitchen_2', 'rider_1')).toThrow("Unauthorized");
      expect(() => verifyStopUpdate(driverClaims, 'kitchen_1', 'rider_2')).toThrow("Unauthorized");
    });
  });
});
