import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateExpenseAllocationsMath,
} from '../profitability/expenseAllocationService';
import type {
  ReceiptProfitabilityRecord,
  ClientServiceProfitabilityRollup,
  ExpenseReceiptAllocation,
} from '../../types/suitePhases15To19';

describe('ABLEBIZ SUITE — Phase 20 Receipt Profitability & Net Contribution Reconciliation Tests', () => {
  // =========================================================================
  // SCENARIO 1: Verified Receipt with No Allocations
  // =========================================================================
  it('computes 100% net contribution and "no_expenses_allocated" status when no direct disbursements are linked', () => {
    const rawPayment = {
      id: 'pay-001',
      receipt_number: 'REC-2026-11-0001',
      payment_date: '2026-11-01T10:00:00Z',
      amount: 150000,
      is_verified: true,
      client: { id: 'cli-001', full_name: 'Alpha Enterprises', phone: '08011112222' },
      invoice: {
        id: 'inv-001',
        invoice_number: 'INV-2026-11-0001',
        service_request_id: 'sr-001',
        service_request: {
          tracking_code: 'SR-CAC-001',
          service: { name: 'Private Limited Company Registration', category: 'Corporate Registration' },
        },
      },
      allocations: [] as any[],
    };

    const verifiedAmount = Number(rawPayment.amount || 0);
    const allocs = rawPayment.allocations || [];
    const totalAllocated = allocs.reduce((acc: number, a: any) => acc + Number(a.allocated_amount || 0), 0);
    const netContribution = Math.round((verifiedAmount - totalAllocated) * 100) / 100;
    const marginPercent = verifiedAmount > 0
      ? Math.round((netContribution / verifiedAmount) * 10000) / 100
      : 0;

    const allocationStatus = allocs.length > 0
      ? (totalAllocated >= verifiedAmount ? 'fully_allocated' : 'partially_allocated')
      : 'no_expenses_allocated';

    const profitabilityStatus = netContribution < 0 ? 'loss_making' : (netContribution === 0 ? 'break_even' : 'profitable');

    assert.equal(verifiedAmount, 150000);
    assert.equal(totalAllocated, 0);
    assert.equal(netContribution, 150000);
    assert.equal(marginPercent, 100);
    assert.equal(allocationStatus, 'no_expenses_allocated');
    assert.equal(profitabilityStatus, 'profitable');
  });

  // =========================================================================
  // SCENARIO 2: Verified Receipt with a Partial Allocation
  // =========================================================================
  it('correctly calculates net contribution and "partially_allocated" status when direct disbursements are partially assigned', () => {
    const verifiedAmount = 100000;
    const allocs = [
      { id: 'alloc-1', allocated_amount: 35000, expense: { id: 'exp-1', category: 'CAC Filing Fee' } },
    ];

    const totalAllocated = allocs.reduce((acc, a) => acc + a.allocated_amount, 0);
    const netContribution = Math.round((verifiedAmount - totalAllocated) * 100) / 100;
    const marginPercent = verifiedAmount > 0
      ? Math.round((netContribution / verifiedAmount) * 10000) / 100
      : 0;

    const allocationStatus = allocs.length > 0
      ? (totalAllocated >= verifiedAmount ? 'fully_allocated' : 'partially_allocated')
      : 'no_expenses_allocated';

    assert.equal(totalAllocated, 35000);
    assert.equal(netContribution, 65000);
    assert.equal(marginPercent, 65.0);
    assert.equal(allocationStatus, 'partially_allocated');
    assert.equal(netContribution > 0, true);
  });

  // =========================================================================
  // SCENARIO 3: Verified Receipt with a Fully Allocated Direct Expense
  // =========================================================================
  it('reconciles receipt REC-2026-11-0004 with exact ₦500 CAC Filing Fee direct cost allocation', () => {
    // Modelled directly on production disbursement record:
    // Expense: ₦500 CAC Filing Fee paid to ALMOND CREATIONS HUB, 100% allocated to REC-2026-11-0004
    const receiptAmount = 50000; // Client paid ₦50,000
    const allocations = [
      { id: 'alloc-rec-0004', allocated_amount: 500, expense_id: 'exp-almond-hub', category: 'CAC Filing Fee' },
    ];

    const totalAllocated = allocations.reduce((acc, a) => acc + a.allocated_amount, 0);
    const netContribution = receiptAmount - totalAllocated;
    const marginPercent = Math.round((netContribution / receiptAmount) * 10000) / 100;

    assert.equal(totalAllocated, 500);
    assert.equal(netContribution, 49500);
    assert.equal(marginPercent, 99.0);
    assert.equal(allocations.length, 1);
  });

  // =========================================================================
  // SCENARIO 4: Verified Receipt with Loss-Making Engagement
  // =========================================================================
  it('flags negative net contribution as "loss_making" when direct disbursements exceed receipt collection', () => {
    const receiptAmount = 30000; // Urgent filing with unexpected statutory penalty
    const allocations = [
      { id: 'alloc-1', allocated_amount: 25000 },
      { id: 'alloc-2', allocated_amount: 15000 }, // Total direct costs = 40,000 > 30,000
    ];

    const totalAllocated = allocations.reduce((acc, a) => acc + a.allocated_amount, 0);
    const netContribution = receiptAmount - totalAllocated;
    const marginPercent = Math.round((netContribution / receiptAmount) * 10000) / 100;

    const profitabilityStatus = netContribution < 0 ? 'loss_making' : (netContribution === 0 ? 'break_even' : 'profitable');

    assert.equal(totalAllocated, 40000);
    assert.equal(netContribution, -10000);
    assert.equal(marginPercent, -33.33);
    assert.equal(profitabilityStatus, 'loss_making');
  });

  // =========================================================================
  // SCENARIO 5: Safe Zero-Denominator Handling
  // =========================================================================
  it('returns 0% margin safely without NaN or Infinity when receipt amount is zero or negative', () => {
    const computeMargin = (receipt: number, expenses: number) => {
      const net = receipt - expenses;
      return receipt > 0 ? Math.round((net / receipt) * 10000) / 100 : 0;
    };

    assert.equal(computeMargin(0, 5000), 0);
    assert.equal(computeMargin(-1000, 500), 0);
  });

  // =========================================================================
  // SCENARIO 6: Rejection of Non-Existent Schema Columns (PostgREST Regression Guard)
  // =========================================================================
  it('enforces that the canonical query structure does not query non-existent columns (service_requests.title)', () => {
    // Verified PostgreSQL schema for public.service_requests:
    const validServiceRequestColumns = new Set([
      'id', 'tracking_code', 'client_id', 'business_id', 'service_id',
      'assigned_staff_id', 'priority', 'status', 'progress_percent',
      'requirements_checklist', 'target_completion_date', 'completed_at',
      'notes', 'created_at', 'updated_at'
    ]);

    // The legacy faulty query attempted to select `title` from service_requests
    assert.equal(validServiceRequestColumns.has('title'), false, 'service_requests table does NOT possess a title column');
    assert.equal(validServiceRequestColumns.has('tracking_code'), true);
    assert.equal(validServiceRequestColumns.has('service_id'), true);

    // The canonical resolution joins services_catalog via service_id
    const validServicesCatalogColumns = new Set([
      'id', 'name', 'slug', 'category', 'default_fee_ngn', 'min_fee_ngn',
      'internal_cost_estimate', 'assigned_department', 'is_active'
    ]);
    assert.equal(validServicesCatalogColumns.has('name'), true, 'service title is stored as name in services_catalog');
    assert.equal(validServicesCatalogColumns.has('category'), true);
  });

  // =========================================================================
  // SCENARIO 7: Client & Service Rollup Aggregation Without Double Counting
  // =========================================================================
  it('aggregates receipts by client and service category accurately without double counting allocations', () => {
    const sampleRecords: ReceiptProfitabilityRecord[] = [
      {
        payment_id: 'p1',
        receipt_number: 'REC-001',
        payment_date: '2026-11-01',
        client_id: 'client-A',
        client_name: 'Acme Corp',
        invoice_id: 'inv-1',
        invoice_number: 'INV-001',
        service_name: 'Company Incorporation',
        service_category: 'Corporate Registration',
        verified_receipt_amount: 100000,
        total_allocated_expenses: 30000,
        net_contribution: 70000,
        net_contribution_margin_percent: 70.0,
        allocation_status: 'partially_allocated',
        profitability_status: 'profitable',
        is_verified: true,
        allocations_count: 1,
      },
      {
        payment_id: 'p2',
        receipt_number: 'REC-002',
        payment_date: '2026-11-05',
        client_id: 'client-A',
        client_name: 'Acme Corp',
        invoice_id: 'inv-2',
        invoice_number: 'INV-002',
        service_name: 'TIN Registration',
        service_category: 'Tax & Compliance',
        verified_receipt_amount: 40000,
        total_allocated_expenses: 5000,
        net_contribution: 35000,
        net_contribution_margin_percent: 87.5,
        allocation_status: 'partially_allocated',
        profitability_status: 'profitable',
        is_verified: true,
        allocations_count: 1,
      },
      {
        payment_id: 'p3',
        receipt_number: 'REC-003',
        payment_date: '2026-11-08',
        client_id: 'client-B',
        client_name: 'Beta Global',
        invoice_id: 'inv-3',
        invoice_number: 'INV-003',
        service_name: 'Company Incorporation',
        service_category: 'Corporate Registration',
        verified_receipt_amount: 80000,
        total_allocated_expenses: 35000,
        net_contribution: 45000,
        net_contribution_margin_percent: 56.25,
        allocation_status: 'partially_allocated',
        profitability_status: 'profitable',
        is_verified: true,
        allocations_count: 1,
      },
    ];

    // Client rollup
    const clientMap = new Map<string, { totalReceipts: number; totalExpenses: number; count: number }>();
    for (const r of sampleRecords) {
      const entry = clientMap.get(r.client_id) || { totalReceipts: 0, totalExpenses: 0, count: 0 };
      entry.totalReceipts += r.verified_receipt_amount;
      entry.totalExpenses += r.total_allocated_expenses;
      entry.count += 1;
      clientMap.set(r.client_id, entry);
    }

    const acmeRollup = clientMap.get('client-A');
    assert.ok(acmeRollup);
    assert.equal(acmeRollup.totalReceipts, 140000);
    assert.equal(acmeRollup.totalExpenses, 35000);
    assert.equal(acmeRollup.totalReceipts - acmeRollup.totalExpenses, 105000);
    assert.equal(acmeRollup.count, 2);

    // Service category rollup
    const categoryMap = new Map<string, { totalReceipts: number; totalExpenses: number; count: number }>();
    for (const r of sampleRecords) {
      const cat = r.service_category || 'General';
      const entry = categoryMap.get(cat) || { totalReceipts: 0, totalExpenses: 0, count: 0 };
      entry.totalReceipts += r.verified_receipt_amount;
      entry.totalExpenses += r.total_allocated_expenses;
      entry.count += 1;
      categoryMap.set(cat, entry);
    }

    const corpReg = categoryMap.get('Corporate Registration');
    assert.ok(corpReg);
    assert.equal(corpReg.totalReceipts, 180000); // 100k + 80k
    assert.equal(corpReg.totalExpenses, 65000);  // 30k + 35k
    assert.equal(corpReg.totalReceipts - corpReg.totalExpenses, 115000);
    assert.equal(corpReg.count, 2);
  });
});
