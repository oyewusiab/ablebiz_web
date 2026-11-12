import { supabase } from '../supabaseClient';
import type {
  ExpenseReceiptAllocation,
  ReceiptProfitabilityRecord,
  ExpenseAllocationLedgerRecord,
  ClientServiceProfitabilityRollup,
  ReceiptAllocationStatus,
  ReceiptProfitabilityStatus,
} from '../../types/suitePhases15To19';

export interface AllocationItemInput {
  payment_id: string;
  allocated_amount: number;
  notes?: string;
}

/**
 * Validates allocations against expense amount and constraints
 */
export function validateExpenseAllocationsMath(
  expenseAmount: number,
  allocations: AllocationItemInput[]
): { valid: boolean; error?: string; totalAllocated: number; unallocated: number } {
  if (expenseAmount <= 0) {
    return { valid: false, error: 'Expense amount must be greater than zero.', totalAllocated: 0, unallocated: 0 };
  }

  const paymentIds = new Set<string>();
  let totalAllocated = 0;

  for (const item of allocations) {
    const amt = Number(item.allocated_amount);
    if (isNaN(amt) || amt <= 0) {
      return {
        valid: false,
        error: 'Each receipt allocation amount must be a positive number.',
        totalAllocated,
        unallocated: expenseAmount - totalAllocated,
      };
    }
    if (paymentIds.has(item.payment_id)) {
      return {
        valid: false,
        error: 'Duplicate receipt selected. An expense can only be allocated once per receipt.',
        totalAllocated,
        unallocated: expenseAmount - totalAllocated,
      };
    }
    paymentIds.add(item.payment_id);
    totalAllocated += amt;
  }

  // Round to 2 decimals for monetary precision
  totalAllocated = Math.round(totalAllocated * 100) / 100;
  const unallocated = Math.round((expenseAmount - totalAllocated) * 100) / 100;

  if (totalAllocated > expenseAmount) {
    return {
      valid: false,
      error: `Total allocated amount (₦${totalAllocated.toLocaleString()}) exceeds the total expense amount (₦${expenseAmount.toLocaleString()}).`,
      totalAllocated,
      unallocated,
    };
  }

  return { valid: true, totalAllocated, unallocated };
}

/**
 * Fetch allocations for a specific expense
 */
export async function fetchAllocationsForExpense(expenseId: string): Promise<ExpenseReceiptAllocation[]> {
  try {
    const { data, error } = await supabase
      .from('expense_receipt_allocations')
      .select(`
        *,
        payment:payments(
          receipt_number,
          amount,
          payment_date,
          is_verified,
          client:clients(full_name, phone),
          invoice:invoices(invoice_number, total_amount)
        )
      `)
      .eq('expense_id', expenseId);

    if (error) {
      console.warn('[ExpenseAllocation] Fetch error:', error.message);
      return [];
    }
    return (data || []) as ExpenseReceiptAllocation[];
  } catch {
    return [];
  }
}

/**
 * Save / replace allocations for an expense with audit trail
 */
export async function saveExpenseAllocations(
  expenseId: string,
  expenseAmount: number,
  allocations: AllocationItemInput[],
  operatorStaffId?: string
): Promise<{ success: boolean; error?: string; totalAllocated: number; unallocated: number }> {
  const mathCheck = validateExpenseAllocationsMath(expenseAmount, allocations);
  if (!mathCheck.valid) {
    return {
      success: false,
      error: mathCheck.error,
      totalAllocated: mathCheck.totalAllocated,
      unallocated: mathCheck.unallocated,
    };
  }

  try {
    // 1. Fetch existing allocations for audit logging
    const { data: existing } = await supabase
      .from('expense_receipt_allocations')
      .select('id, payment_id, allocated_amount')
      .eq('expense_id', expenseId);

    // 2. Delete existing allocations
    await supabase.from('expense_receipt_allocations').delete().eq('expense_id', expenseId);

    // 3. Insert new allocations if any provided
    if (allocations.length > 0) {
      const rows = allocations.map((a) => ({
        expense_id: expenseId,
        payment_id: a.payment_id,
        allocated_amount: a.allocated_amount,
        notes: a.notes || null,
        created_by: operatorStaffId || null,
      }));

      const { error: insErr } = await supabase.from('expense_receipt_allocations').insert(rows);
      if (insErr) throw insErr;
    }

    // 4. Audit logging is handled automatically by the PostgreSQL trigger `trg_log_expense_allocation_audit`
    // (public.expense_allocation_audit_logs is an append-only security-definer protected ledger).

    return {
      success: true,
      totalAllocated: mathCheck.totalAllocated,
      unallocated: mathCheck.unallocated,
    };
  } catch (err: any) {
    console.error('[ExpenseAllocation] Save error:', err);
    return {
      success: false,
      error: err.message || 'Failed to save expense allocations.',
      totalAllocated: mathCheck.totalAllocated,
      unallocated: mathCheck.unallocated,
    };
  }
}

/**
 * Fetch Receipt Profitability Records (Net Contribution per Receipt)
 */
export async function fetchReceiptProfitabilityReport(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  clientId?: string;
}): Promise<ReceiptProfitabilityRecord[]> {
  try {
    let query = supabase
      .from('payments')
      .select(`
        id,
        receipt_number,
        payment_date,
        amount,
        is_verified,
        client:clients(id, full_name, phone),
        invoice:invoices(
          id,
          invoice_number,
          service_request_id,
          service_request:service_requests(
            tracking_code,
            service:services_catalog(name, category)
          )
        ),
        allocations:expense_receipt_allocations(
          id,
          allocated_amount,
          expense:expenses(id, category, description)
        )
      `)
      .eq('is_verified', true)
      .order('payment_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('payment_date', `${filters.startDate}T00:00:00Z`);
    }
    if (filters?.endDate) {
      query = query.lte('payment_date', `${filters.endDate}T23:59:59Z`);
    }
    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data: payments, error } = await query;
    if (error) throw error;

    const records: ReceiptProfitabilityRecord[] = (payments || []).map((p: any) => {
      const verifiedAmount = Number(p.amount || 0);
      const allocs = p.allocations || [];
      const totalAllocated = allocs.reduce((acc: number, a: any) => acc + Number(a.allocated_amount || 0), 0);
      const netContribution = Math.round((verifiedAmount - totalAllocated) * 100) / 100;
      const marginPercent = verifiedAmount > 0
        ? Math.round((netContribution / verifiedAmount) * 10000) / 100
        : 0;

      let allocationStatus: ReceiptAllocationStatus = 'no_expenses_allocated';
      if (allocs.length > 0) {
        allocationStatus = totalAllocated >= verifiedAmount ? 'fully_allocated' : 'partially_allocated';
      }

      let profitabilityStatus: ReceiptProfitabilityStatus = 'profitable';
      if (netContribution < 0) {
        profitabilityStatus = 'loss_making';
      } else if (netContribution === 0) {
        profitabilityStatus = 'break_even';
      }

      const serviceObj = p.invoice?.service_request?.service;

      return {
        payment_id: p.id,
        receipt_number: p.receipt_number,
        payment_date: p.payment_date,
        client_id: p.client?.id || '',
        client_name: p.client?.full_name || 'Individual Client',
        client_phone: p.client?.phone || '',
        invoice_id: p.invoice?.id || '',
        invoice_number: p.invoice?.invoice_number || 'INV-DIRECT',
        service_request_id: p.invoice?.service_request_id || null,
        service_tracking_code: p.invoice?.service_request?.tracking_code || null,
        service_name: serviceObj?.name || 'General Professional Service',
        service_category: serviceObj?.category || 'Professional Services',
        verified_receipt_amount: verifiedAmount,
        total_allocated_expenses: totalAllocated,
        net_contribution: netContribution,
        net_contribution_margin_percent: marginPercent,
        allocation_status: allocationStatus,
        profitability_status: profitabilityStatus,
        is_verified: p.is_verified,
        allocations_count: allocs.length,
      };
    });

    if (filters?.status && filters.status !== 'all') {
      return records.filter((r) => r.profitability_status === filters.status || r.allocation_status === filters.status);
    }

    return records;
  } catch (err) {
    console.error('[ReceiptProfitability] Fetch error:', err);
    throw err;
  }
}

/**
 * Fetch Expense Allocation Ledger (Allocated vs Unallocated per Expense)
 */
export async function fetchExpenseAllocationLedgerReport(): Promise<ExpenseAllocationLedgerRecord[]> {
  try {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select(`
        id,
        expense_date,
        category,
        description,
        amount,
        vendor:vendors(name),
        payer:staff_profiles(full_name),
        allocations:expense_receipt_allocations(
          allocated_amount,
          payment:payments(
            receipt_number,
            client:clients(full_name)
          )
        )
      `)
      .order('expense_date', { ascending: false });

    if (error) throw error;

    return (expenses || []).map((e: any) => {
      const expAmt = Number(e.amount || 0);
      const allocs = e.allocations || [];
      const totalAllocated = allocs.reduce((acc: number, a: any) => acc + Number(a.allocated_amount || 0), 0);
      const unallocated = Math.max(0, Math.round((expAmt - totalAllocated) * 100) / 100);

      let status: 'fully_allocated' | 'partially_allocated' | 'unallocated' = 'unallocated';
      if (totalAllocated >= expAmt && expAmt > 0) {
        status = 'fully_allocated';
      } else if (totalAllocated > 0) {
        status = 'partially_allocated';
      }

      const linked = allocs.map((a: any) => ({
        receipt_number: a.payment?.receipt_number || 'RCP-UNKNOWN',
        allocated_amount: Number(a.allocated_amount || 0),
        client_name: a.payment?.client?.full_name || 'Individual Client',
      }));

      return {
        expense_id: e.id,
        expense_date: e.expense_date,
        category: e.category,
        description: e.description,
        expense_amount: expAmt,
        total_allocated: totalAllocated,
        unallocated_amount: unallocated,
        allocation_status: status,
        linked_receipts: linked,
        vendor_name: e.vendor?.name || 'Third-Party Vendor / Regulator',
        recorded_by: e.payer?.full_name || 'Accounts Department',
      };
    });
  } catch (err) {
    console.error('[ExpenseLedger] Fetch error:', err);
    return [];
  }
}

/**
 * Rollup Net Contribution by Client or Service Category without double counting
 */
export async function fetchRollupProfitability(
  entityType: 'client' | 'service_category'
): Promise<ClientServiceProfitabilityRollup[]> {
  try {
    const records = await fetchReceiptProfitabilityReport();
    const groupMap = new Map<string, {
      name: string;
      receiptsTotal: number;
      expensesTotal: number;
      receiptCount: number;
    }>();

    for (const r of records) {
      const key = entityType === 'client' ? (r.client_id || 'unassigned') : (r.service_category || r.service_name || 'General');
      const name = entityType === 'client' ? r.client_name : (r.service_category || r.service_name || 'General');

      const entry = groupMap.get(key) || {
        name,
        receiptsTotal: 0,
        expensesTotal: 0,
        receiptCount: 0,
      };

      entry.receiptsTotal += r.verified_receipt_amount;
      entry.expensesTotal += r.total_allocated_expenses;
      entry.receiptCount += 1;

      groupMap.set(key, entry);
    }

    return Array.from(groupMap.entries()).map(([id, g]) => {
      const net = Math.round((g.receiptsTotal - g.expensesTotal) * 100) / 100;
      const margin = g.receiptsTotal > 0 ? Math.round((net / g.receiptsTotal) * 10000) / 100 : 0;
      return {
        entity_id: id,
        entity_name: g.name,
        entity_type: entityType,
        total_receipts_verified: g.receiptsTotal,
        total_allocated_expenses: g.expensesTotal,
        net_contribution: net,
        margin_percent: margin,
        receipts_count: g.receiptCount,
      };
    }).sort((a, b) => b.total_receipts_verified - a.total_receipts_verified);
  } catch (err) {
    console.error('[RollupProfitability] Error:', err);
    return [];
  }
}
