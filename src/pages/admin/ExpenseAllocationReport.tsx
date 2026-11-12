import { useEffect, useState } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Receipt,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { fetchExpenseAllocationLedgerReport } from '../../lib/profitability/expenseAllocationService';
import type { ExpenseAllocationLedgerRecord } from '../../types/suitePhases15To19';

export function ExpenseAllocationReportPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'fully_allocated' | 'partially_allocated' | 'unallocated'>('all');
  const [expenses, setExpenses] = useState<ExpenseAllocationLedgerRecord[]>([]);

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenseAllocationLedgerReport();
      setExpenses(data);
    } catch (err) {
      console.error('[ExpenseAllocationLedger] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.vendor_name && e.vendor_name.toLowerCase().includes(q)) ||
      e.linked_receipts.some((r) => r.receipt_number.toLowerCase().includes(q) || (r.client_name && r.client_name.toLowerCase().includes(q)));

    const matchesStatus = statusFilter === 'all' || e.allocation_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalDisbursements = filteredExpenses.reduce((acc, e) => acc + e.expense_amount, 0);
  const totalAllocated = filteredExpenses.reduce((acc, e) => acc + e.total_allocated, 0);
  const totalUnallocated = filteredExpenses.reduce((acc, e) => acc + e.unallocated_amount, 0);
  const coveragePercent = totalDisbursements > 0
    ? Math.round((totalAllocated / totalDisbursements) * 10000) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200 shadow-2xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Expense Allocation Ledger & Cost Audit</h1>
              <p className="text-xs text-slate-500">
                Audit operational disbursements, trace unallocated corporate overhead, and review client receipt associations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disbursements */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Disbursements</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0A2558]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            ₦{totalDisbursements.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {filteredExpenses.length} disbursements recorded
          </p>
        </div>

        {/* Allocated Direct Costs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Allocated to Receipts</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            ₦{totalAllocated.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Directly attributed to client jobs
          </p>
        </div>

        {/* Unallocated Expenses */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unallocated Operating Overhead</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            ₦{totalUnallocated.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            General corporate or unlinked costs
          </p>
        </div>

        {/* Allocation Coverage */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Allocation Coverage</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {coveragePercent}%
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Portion of costs linked to receipts
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor, description, category, or linked receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0A2558]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold">Allocation Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="all">All Disbursements</option>
            <option value="fully_allocated">Fully Allocated</option>
            <option value="partially_allocated">Partially Allocated</option>
            <option value="unallocated">Unallocated Only</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Category & Description</th>
                <th className="py-2.5 px-3">Vendor / Recipient</th>
                <th className="py-2.5 px-3">Disbursement (₦)</th>
                <th className="py-2.5 px-3">Allocated (₦)</th>
                <th className="py-2.5 px-3">Unallocated (₦)</th>
                <th className="py-2.5 px-3">Linked Client Receipts</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.expense_id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{e.expense_date}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900 block capitalize">
                        {e.category.replace(/_/g, ' ')}
                      </span>
                      {e.description && <span className="text-[11px] text-slate-500">{e.description}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{e.vendor_name}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      ₦{e.expense_amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-medium">
                      ₦{e.total_allocated.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      ₦{e.unallocated_amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      {e.linked_receipts.length === 0 ? (
                        <span className="text-slate-400 italic">None (Unlinked)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {e.linked_receipts.map((r, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200"
                              title={`${r.client_name || 'Client'}: ₦${r.allocated_amount.toLocaleString()}`}
                            >
                              {r.receipt_number}: ₦{r.allocated_amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        e.allocation_status === 'fully_allocated'
                          ? 'bg-emerald-50 text-emerald-700'
                          : e.allocation_status === 'partially_allocated'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {e.allocation_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
