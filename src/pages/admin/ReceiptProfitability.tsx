import { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Building2,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  fetchReceiptProfitabilityReport,
  fetchRollupProfitability,
} from '../../lib/profitability/expenseAllocationService';
import type {
  ReceiptProfitabilityRecord,
  ClientServiceProfitabilityRollup,
} from '../../types/suitePhases15To19';

export function ReceiptProfitabilityPage() {
  const { profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeView, setActiveView] = useState<'receipts' | 'client_rollup' | 'service_rollup'>('receipts');

  const [receipts, setReceipts] = useState<ReceiptProfitabilityRecord[]>([]);
  const [clientRollup, setClientRollup] = useState<ClientServiceProfitabilityRollup[]>([]);
  const [serviceRollup, setServiceRollup] = useState<ClientServiceProfitabilityRollup[]>([]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [recList, cRoll, sRoll] = await Promise.all([
        fetchReceiptProfitabilityReport({ status: statusFilter }),
        fetchRollupProfitability('client'),
        fetchRollupProfitability('service_category'),
      ]);

      setReceipts(recList);
      setClientRollup(cRoll);
      setServiceRollup(sRoll);
    } catch (err: any) {
      console.error('[ReceiptProfitability] Load error:', err);
      setErrorMessage(err.message || 'Unable to retrieve live receipt profitability records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      r.invoice_number.toLowerCase().includes(q) ||
      (r.service_tracking_code && r.service_tracking_code.toLowerCase().includes(q))
    );
  });

  const totalReceiptsAmount = filteredReceipts.reduce((acc, r) => acc + r.verified_receipt_amount, 0);
  const totalAllocatedExpenses = filteredReceipts.reduce((acc, r) => acc + r.total_allocated_expenses, 0);
  const totalNetContribution = totalReceiptsAmount - totalAllocatedExpenses;
  const overallMarginPercent = totalReceiptsAmount > 0
    ? Math.round((totalNetContribution / totalReceiptsAmount) * 10000) / 100
    : 0;

  const lossMakingCount = filteredReceipts.filter((r) => r.profitability_status === 'loss_making').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Receipt Profitability & Net Contribution</h1>
              <p className="text-xs text-slate-500">
                Track client payments against allocated delivery expenses to evaluate individual engagement profitability
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Formula Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-xs text-emerald-950 shadow-2xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-800">Verified Financial Calculation Basis:</span>
          <p className="font-mono text-xs font-semibold text-emerald-900">
            Net Contribution per Receipt = Verified Receipt Amount − Expenses Allocated to That Receipt
          </p>
          <p className="text-[11px] text-emerald-700">
            Represents direct engagement margin after specific disbursements (e.g. CAC statutory filing, courier, and search fees).
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-[11px] text-emerald-700 block">Overall Margin:</span>
          <span className="text-lg font-bold text-emerald-900">
            {errorMessage ? '—' : loading ? '...' : `${overallMarginPercent}%`}
          </span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Unable to load live receipt profitability</p>
              <p className="text-[11px] text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-red-100 hover:bg-red-200 text-red-900 px-3 py-1.5 font-semibold transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receipts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verified Collections</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {errorMessage ? '—' : loading ? '...' : `₦${totalReceiptsAmount.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {errorMessage ? 'Query failed' : loading ? 'Fetching...' : `${filteredReceipts.length} verified receipts`}
          </p>
        </div>

        {/* Allocated Expenses */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Allocated Direct Costs</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {errorMessage ? '—' : loading ? '...' : `₦${totalAllocatedExpenses.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {errorMessage ? 'Unavailable' : 'Disbursements tied to receipts'}
          </p>
        </div>

        {/* Net Contribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Net Contribution</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {errorMessage ? '—' : loading ? '...' : `₦${totalNetContribution.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {errorMessage ? 'Unavailable' : 'Gross contribution after direct cost'}
          </p>
        </div>

        {/* Loss-making Warning */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Loss-Making Engagements</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${lossMakingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {errorMessage ? '—' : loading ? '...' : lossMakingCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {errorMessage ? 'Unavailable' : lossMakingCount > 0 ? 'Disbursements exceed receipt' : 'Zero loss engagements detected'}
          </p>
        </div>
      </div>

      {/* Filter Bar & View Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt, client name, invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0A2558]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="profitable">Profitable Only</option>
            <option value="loss_making">Loss-Making Only</option>
            <option value="fully_allocated">Fully Allocated</option>
            <option value="partially_allocated">Partially Allocated</option>
            <option value="no_expenses_allocated">No Expenses Allocated</option>
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView('receipts')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              activeView === 'receipts'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Receipt Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveView('client_rollup')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              activeView === 'client_rollup'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Client Rollup
          </button>
          <button
            type="button"
            onClick={() => setActiveView('service_rollup')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              activeView === 'service_rollup'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Service Rollup
          </button>
        </div>
      </div>

      {/* Main Table View 1: Receipts Breakdown */}
      {activeView === 'receipts' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Invoice / Request</th>
                  <th className="py-2.5 px-3">Received (₦)</th>
                  <th className="py-2.5 px-3">Allocated Cost (₦)</th>
                  <th className="py-2.5 px-3">Net Contribution (₦)</th>
                  <th className="py-2.5 px-3">Margin (%)</th>
                  <th className="py-2.5 px-3">Allocation Status</th>
                  <th className="py-2.5 px-3">Profitability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        <span>Loading live receipt profitability data...</span>
                      </div>
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-red-600">
                      Failed to load receipt records: {errorMessage}
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      {receipts.length === 0
                        ? 'No verified receipts found in the system.'
                        : 'No receipts match your search and filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => (
                    <tr key={r.payment_id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{r.receipt_number}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{r.client_name}</div>
                        {r.client_phone && <span className="text-[10px] text-slate-400">{r.client_phone}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-slate-600 block">{r.invoice_number}</span>
                        {r.service_tracking_code && (
                          <span className="text-[10px] text-blue-600 font-semibold">{r.service_tracking_code}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        ₦{r.verified_receipt_amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-red-600 font-medium">
                        ₦{r.total_allocated_expenses.toLocaleString()}
                        {r.allocations_count > 0 && (
                          <span className="text-[10px] text-slate-400 block">({r.allocations_count} expenses)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={r.net_contribution >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                          ₦{r.net_contribution.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span className={r.net_contribution >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                          {r.net_contribution_margin_percent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.allocation_status === 'fully_allocated'
                            ? 'bg-blue-50 text-blue-700'
                            : r.allocation_status === 'partially_allocated'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.allocation_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.profitability_status === 'profitable'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.profitability_status === 'loss_making'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {r.profitability_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table View 2: Client Rollup */}
      {activeView === 'client_rollup' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Client Name</th>
                  <th className="py-2.5 px-3">Receipts Count</th>
                  <th className="py-2.5 px-3">Total Verified Received (₦)</th>
                  <th className="py-2.5 px-3">Total Allocated Direct Costs (₦)</th>
                  <th className="py-2.5 px-3">Net Contribution (₦)</th>
                  <th className="py-2.5 px-3">Average Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Loading client rollups...</td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-red-600">Unable to load client rollups: {errorMessage}</td>
                  </tr>
                ) : clientRollup.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No client rollup records available.</td>
                  </tr>
                ) : (
                  clientRollup.map((c) => (
                    <tr key={c.entity_id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{c.entity_name}</td>
                      <td className="py-2.5 px-3">{c.receipts_count}</td>
                      <td className="py-2.5 px-3 font-semibold">₦{c.total_receipts_verified.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-red-600">₦{c.total_allocated_expenses.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">₦{c.net_contribution.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{c.margin_percent}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table View 3: Service Rollup */}
      {activeView === 'service_rollup' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Service / Request Title</th>
                  <th className="py-2.5 px-3">Receipts Processed</th>
                  <th className="py-2.5 px-3">Total Revenue Collected (₦)</th>
                  <th className="py-2.5 px-3">Total Direct Disbursements (₦)</th>
                  <th className="py-2.5 px-3">Net Service Contribution (₦)</th>
                  <th className="py-2.5 px-3">Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Loading service rollups...</td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-red-600">Unable to load service rollups: {errorMessage}</td>
                  </tr>
                ) : serviceRollup.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No service rollup records available.</td>
                  </tr>
                ) : (
                  serviceRollup.map((s) => (
                    <tr key={s.entity_id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{s.entity_name}</td>
                      <td className="py-2.5 px-3">{s.receipts_count}</td>
                      <td className="py-2.5 px-3 font-semibold">₦{s.total_receipts_verified.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-red-600">₦{s.total_allocated_expenses.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">₦{s.net_contribution.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.margin_percent}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
