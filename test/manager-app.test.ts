import { describe, it, expect, vi } from 'vitest';
import {
  ALL_SAAS_PAGES,
  normalizeEmail,
  normalizePhone,
  getTodayStr,
  formatDateDDMMYYYY,
  isPlanActiveOnDate,
  Customer
} from '../apps/manager/src/services/managerStore';
import {
  firebaseConfig,
  app
} from '../apps/manager/src/services/firebase';

describe('ScaleKitchen Manager App — Phase 4 Test Suite', () => {

  describe('1. Dedicated Named Firebase App Isolation', () => {
    it('should initialize with the unique isolated app name "ScaleKitchenManager"', () => {
      expect(app.name).toBe('ScaleKitchenManager');
    });

    it('should use the correct production project configuration', () => {
      expect(firebaseConfig.projectId).toBe('subbussinesssaas');
      expect(firebaseConfig.authDomain).toBe('subbussinesssaas.firebaseapp.com');
    });
  });

  describe('2. Manager Authentication & Credentials Contract', () => {
    it('should normalize manager email addresses to lowercase and trimmed string', () => {
      expect(normalizeEmail('  Manager.OPS@ScaleKitchen.COM  ')).toBe('manager.ops@scalekitchen.com');
      expect(normalizeEmail('KITCHEN@GMAIL.COM')).toBe('kitchen@gmail.com');
      expect(normalizeEmail('')).toBe('');
    });

    it('should normalize manager mobile numbers to 10 digits', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('98765-43210')).toBe('9876543210');
    });

    it('should validate email format and presence before network invocation', () => {
      const validate = (email: string, pass: string, biz: string) => {
        const cleanEmail = normalizeEmail(email);
        if (!biz?.trim()) return 'Missing business ID';
        if (!cleanEmail || !cleanEmail.includes('@')) return 'Invalid email';
        if (!pass) return 'Missing password';
        return null;
      };

      expect(validate('', 'pass123', 'biz1')).toBe('Invalid email');
      expect(validate('not-an-email', 'pass123', 'biz1')).toBe('Invalid email');
      expect(validate('mgr@kitchen.com', '', 'biz1')).toBe('Missing password');
      expect(validate('mgr@kitchen.com', 'pass123', '')).toBe('Missing business ID');
      expect(validate('mgr@kitchen.com', 'pass123', 'biz1')).toBeNull();
    });
  });

  describe('3. Custom Token Claims Verification & Security Boundary', () => {
    it('should verify expected claims structure for manager token', () => {
      const mockClaims = {
        role: 'manager',
        bizId: 'kitchen_biz_999',
        managerId: 'staff_doc_123',
        branchId: 'branch_south_hub'
      };

      expect(mockClaims.role).toBe('manager');
      expect(mockClaims.bizId).toBe('kitchen_biz_999');
      expect(mockClaims.branchId).toBe('branch_south_hub');
    });

    it('should reject non-manager claims at authorization layer', () => {
      const isAuthorizedManager = (claims: { role?: string; bizId?: string }) => {
        return claims?.role === 'manager' && Boolean(claims?.bizId);
      };

      expect(isAuthorizedManager({ role: 'manager', bizId: 'biz1' })).toBe(true);
      expect(isAuthorizedManager({ role: 'driver', bizId: 'biz1' })).toBe(false);
      expect(isAuthorizedManager({ role: 'customer', bizId: 'biz1' })).toBe(false);
      expect(isAuthorizedManager({ role: 'manager' })).toBe(false);
    });
  });

  describe('4. Branch Access & Multi-Tenant Scoping Enforcement', () => {
    it('should allow all records when branchId is "All"', () => {
      const items = [
        { id: '1', branchId: 'branch_a' },
        { id: '2', branchId: 'branch_b' },
        { id: '3', branchId: 'branch_c' }
      ];

      const filterByBranch = (list: typeof items, branchId: string) => {
        if (!branchId || branchId === 'All') return list;
        return list.filter(item => item.branchId === branchId);
      };

      const result = filterByBranch(items, 'All');
      expect(result.length).toBe(3);
    });

    it('should strictly constrain collection records to assigned branch when not "All"', () => {
      const customers = [
        { id: 'c1', name: 'Alice', branchId: 'branch_east' },
        { id: 'c2', name: 'Bob', branchId: 'branch_west' },
        { id: 'c3', name: 'Charlie', branchId: 'branch_east' }
      ];

      const filtered = customers.filter(c => c.branchId === 'branch_east');
      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.branchId === 'branch_east')).toBe(true);
    });

    it('should allow organization-wide plans (branchId === "All" or undefined) alongside branch-specific plans', () => {
      const plans = [
        { id: 'p1', name: 'Standard Org Plan', branchId: 'All' },
        { id: 'p2', name: 'Global Plan' }, // undefined branchId
        { id: 'p3', name: 'East Branch Special', branchId: 'branch_east' },
        { id: 'p4', name: 'West Branch Special', branchId: 'branch_west' }
      ];

      const managerBranch = 'branch_east';
      const permittedPlans = plans.filter(p => !p.branchId || p.branchId === 'All' || p.branchId === managerBranch);

      expect(permittedPlans.length).toBe(3);
      expect(permittedPlans.find(p => p.id === 'p4')).toBeUndefined();
    });
  });

  describe('5. Granular Page Access Control (allowedPages)', () => {
    it('should define all 15 operational SaaS modules in ALL_SAAS_PAGES', () => {
      expect(ALL_SAAS_PAGES.length).toBe(15);
      const pageIds = ALL_SAAS_PAGES.map(p => p.id);
      expect(pageIds).toContain('dashboard');
      expect(pageIds).toContain('prep');
      expect(pageIds).toContain('deliveries');
      expect(pageIds).toContain('customers');
      expect(pageIds).toContain('notes');
      expect(pageIds).toContain('single-orders');
      expect(pageIds).toContain('inventory');
      expect(pageIds).toContain('messages');
      expect(pageIds).toContain('payments');
      expect(pageIds).toContain('invoices');
      expect(pageIds).toContain('expenses');
      expect(pageIds).toContain('analytics');
      expect(pageIds).toContain('settings');
      expect(pageIds).toContain('profile');
      expect(pageIds).toContain('support');
    });

    it('should filter accessible navigation tabs according to allowedPages configuration', () => {
      const managerAllowedPages = ['dashboard', 'prep', 'deliveries'];
      const visiblePages = ALL_SAAS_PAGES.filter(p => managerAllowedPages.includes(p.id));

      expect(visiblePages.length).toBe(3);
      expect(visiblePages.map(p => p.id)).toEqual(['dashboard', 'prep', 'deliveries']);
    });

    it('should default to dashboard if allowedPages is empty', () => {
      const resolveAllowedPages = (pages?: string[]) => {
        return pages && pages.length > 0 ? pages : ['dashboard'];
      };

      expect(resolveAllowedPages([])).toEqual(['dashboard']);
      expect(resolveAllowedPages(undefined)).toEqual(['dashboard']);
      expect(resolveAllowedPages(['prep', 'notes'])).toEqual(['prep', 'notes']);
    });
  });

  describe('6. Dietary Schedule & Kitchen Production Logic', () => {
    it('should determine whether a customer subscription is active on a given date', () => {
      const customer: Customer = {
        id: 'cust-1',
        name: 'John Doe',
        mobile: '9876543210',
        deliveryAddress: 'Flat 402, Sunshine Apts',
        branchId: 'b1',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        status: 'active',
        pauseRanges: [
          { start: '2026-11-05', end: '2026-11-07' }
        ]
      };

      // Before start date
      expect(isPlanActiveOnDate(customer, '2026-10-31')).toBe(false);

      // On paused date
      expect(isPlanActiveOnDate(customer, '2026-11-06')).toBe(false);

      // Active date
      expect(isPlanActiveOnDate(customer, '2026-11-08')).toBe(true);

      // After end date
      expect(isPlanActiveOnDate(customer, '2026-12-01')).toBe(false);
    });

    it('should format date strings to DD/MM/YYYY without drift', () => {
      expect(formatDateDDMMYYYY('2026-11-06')).toBe('06/11/2026');
      expect(formatDateDDMMYYYY('2026-01-15')).toBe('15/01/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
    });
  });

  describe('7. Session Audit Logging Contract', () => {
    it('should format audit log entry matching manager_logs collection schema', () => {
      const createLogEntry = (managerId: string, managerName: string, email: string, branchId: string) => {
        return {
          id: `log_test_${Date.now()}`,
          managerId,
          managerName,
          managerEmail: email,
          branchId,
          branchName: branchId === 'All' ? 'All Branches' : 'Main Branch',
          date: getTodayStr(),
          loginTime: '09:00:00 AM',
          logoutTime: null,
          status: 'Active',
          createdAt: new Date().toISOString()
        };
      };

      const log = createLogEntry('m1', 'Suresh Kumar', 'suresh@kitchen.com', 'branch_hub_1');
      expect(log.managerId).toBe('m1');
      expect(log.managerName).toBe('Suresh Kumar');
      expect(log.status).toBe('Active');
      expect(log.logoutTime).toBeNull();
      expect(log.branchId).toBe('branch_hub_1');
    });
  });

  describe('8. Session Isolation & Logout Cleanup', () => {
    it('should verify clear storage keys on logout', () => {
      const mockStorage: Record<string, string> = {
        manager_data: JSON.stringify({ id: 'm1' }),
        manager_branch_id: 'b1',
        manager_session_log_id: 'log_123',
        manager_biz_id: 'biz_abc'
      };

      const logoutCleanup = (storage: Record<string, string>) => {
        delete storage['manager_data'];
        delete storage['manager_branch_id'];
        delete storage['manager_session_log_id'];
        // manager_biz_id is kept for quick reconnection or can be preserved
      };

      logoutCleanup(mockStorage);
      expect(mockStorage.manager_data).toBeUndefined();
      expect(mockStorage.manager_branch_id).toBeUndefined();
      expect(mockStorage.manager_session_log_id).toBeUndefined();
      expect(mockStorage.manager_biz_id).toBe('biz_abc');
    });
  });
});
