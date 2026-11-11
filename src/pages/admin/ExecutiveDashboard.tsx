import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Briefcase,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ExternalLink,
  Building2,
  FileSpreadsheet,
  Receipt,
  HeartPulse,
  Info,
  HelpCircle,
  Award,
  Layers,
  Lock,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { normalizeStaffRole, CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  ExecutiveDashboardData,
  ExecutiveDashboardFilters,
  ExecutivePeriodPreset,
  MetricWithComparison,
} from "../../types/executiveDashboard";
import {
  createDefaultExecutiveFilters,
  fetchExecutiveDashboardData,
} from "../../lib/executiveDashboard/executiveService";

export function ExecutiveDashboardPage() {
  const { user, profile, hasPermission } = useAuth();
  const userRole = (profile?.role as CanonicalStaffRole) || "viewer";

  // Access Guard: Management only
  const isAuthorizedManager =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "operations_manager";

  const [filters, setFilters] = useState<ExecutiveDashboardFilters>(
    createDefaultExecutiveFilters()
  );
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = async () => {
    if (!isAuthorizedManager) return;
    setLoading(true);
    try {
      const caller = {
        staffId: profile?.id || "",
        fullName: profile?.full_name || "Manager",
        email: profile?.email,
        role: userRole,
        department: profile?.department,
        hasPermission: (module: string, action?: any) => (hasPermission ? hasPermission(module, action) : false),
      };
      const result = await fetchExecutiveDashboardData(caller, filters);
      setData(result);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [filters, userRole]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  const handlePeriodChange = (preset: ExecutivePeriodPreset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
    } else if (preset === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (preset === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
    }

    setFilters({
      ...filters,
      period: preset,
      startDate: start.toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    });
  };

  if (!isAuthorizedManager) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg mx-auto mt-12">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Management Authorization Required</h2>
        <p className="text-sm text-slate-500 mt-1">
          The Executive Dashboard is strictly reserved for Managing Directors, System Administrators, and Operations Managers.
        </p>
        <div className="mt-4">
          <Link
            to="/admin/dashboard"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
          >
            Return to Staff Workbench
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            Executive Management Oversight
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Executive Business Intelligence Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidated organizational performance, financial health, statutory operations, and management decision metrics.
          </p>
        </div>

        {/* Date Filter & Refresh Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs font-medium">
            {[
              { id: "today", label: "Today" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "this_quarter", label: "This Quarter" },
              { id: "this_year", label: "This Year" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id as ExecutivePeriodPreset)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filters.period === p.id
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center p-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <Clock className="w-5 h-5 text-emerald-600 animate-spin mr-2" />
          <span className="text-sm text-slate-500">Calculating executive KPIs in Africa/Lagos timezone...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. EXECUTIVE OVERVIEW CARDS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                1. Executive Overview & Health Index
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Timezone: Africa/Lagos</span>
                <span>•</span>
                <span>Updated: {data.lastRefreshed}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Org Health Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Organizational Health</span>
                  <Award className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {data.organizationalHealthScore.score !== null ? `${data.organizationalHealthScore.score} / 100` : "Assessing"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${
                      data.organizationalHealthScore.status === "healthy"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : data.organizationalHealthScore.status === "attention"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {data.organizationalHealthScore.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Composite score evaluated across {data.organizationalHealthScore.dimensionsEvaluated} active dimensions without penalty for restricted metrics.
                </p>
              </div>

              {/* Net Cash Profit Card */}
              {data.financial ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Net Cash Profit (Actual)</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {data.financial.netCashProfit.formatted}
                    </span>
                    {data.financial.netCashProfit.percentageChange !== null && (
                      <span
                        className={`text-xs font-semibold flex items-center gap-0.5 ${
                          data.financial.netCashProfit.isFavorable ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {data.financial.netCashProfit.changeDirection === "positive" ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {Math.abs(data.financial.netCashProfit.percentageChange)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Verified cash collected minus verified corporate expenses. Excludes projections.
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Financial Metrics</span>
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500 mt-2">Restricted to Finance & Executives</div>
                  <p className="text-[11px] text-slate-400 mt-1">Role-based financial confidentiality active.</p>
                </div>
              )}

              {/* Active Clients Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Registered Clients</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {data.clients.totalActiveClients.formatted}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">
                    +{data.clients.newClients.value} in period
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Total client portfolio. Repeat client rate: {data.clients.repeatClients.formatted}.
                </p>
              </div>

              {/* SLA Compliance Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>SLA Delivery Compliance</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {data.operations.slaComplianceRate.formatted}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {data.operations.completedRequests.value} delivered
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Completed within target delivery date. Mean internal duration: {data.operations.averageInternalTurnaroundDays.formatted}.
                </p>
              </div>
            </div>
          </section>

          {/* 2. FINANCIAL HEALTH */}
          {data.financial && (
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    2. Financial Health & Cash Flow
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strict separation of Invoiced Revenue (issued bills) vs Verified Cash Collected (bank deposits).
                  </p>
                </div>
                <Link
                  to="/admin/invoices"
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  View Invoices & Payments
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-1">Invoiced Revenue</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white block">
                    {data.financial.invoicedRevenue.formatted}
                  </span>
                  <span className="text-[10px] text-slate-400">Total billings issued</span>
                </div>

                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mb-1 font-medium">
                    Cash Collected
                  </span>
                  <span className="text-base font-bold text-emerald-900 dark:text-emerald-200 block">
                    {data.financial.cashCollected.formatted}
                  </span>
                  <span className="text-[10px] text-emerald-600">Verified receipts</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-1">Verified Expenses</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white block">
                    {data.financial.verifiedExpenses.formatted}
                  </span>
                  <span className="text-[10px] text-slate-400">Approved corporate outlays</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-1">Net Cash Margin</span>
                  <span className="text-base font-bold text-emerald-600 block">
                    {data.financial.netCashProfit.formatted}
                  </span>
                  <span className="text-[10px] text-slate-400">Cash collected - expenses</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-1">Total A/R Balance</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white block">
                    {data.financial.outstandingReceivables.formatted}
                  </span>
                  <span className="text-[10px] text-slate-400">Uncollected client fees</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-1">Collection Rate</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white block">
                    {data.financial.collectionRate.formatted}
                  </span>
                  <span className="text-[10px] text-slate-400">Cash vs billed ratio</span>
                </div>
              </div>

              {/* Monthly Cash Trend & Revenue Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    6-Month Actual Cash Flow History (NGN)
                  </h4>
                  <div className="space-y-2">
                    {data.financial.monthlyCashTrend.map((m) => (
                      <div key={m.month} className="flex items-center justify-between text-xs">
                        <span className="w-10 font-bold text-slate-700 dark:text-slate-300">{m.month}</span>
                        <div className="flex-1 mx-3 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${Math.min(100, (m.collected / 500000) * 100)}%` }}
                            title={`Collected: ₦${m.collected.toLocaleString()}`}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-900 dark:text-white font-medium">
                          ₦{m.collected.toLocaleString("en-NG")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Revenue Contribution by Service Category
                  </h4>
                  <div className="space-y-2.5">
                    {data.financial.revenueByService.map((s) => (
                      <div key={s.serviceName} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{s.serviceName}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {s.percentage}% (₦{s.amount.toLocaleString("en-NG")})
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${s.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 3. OPERATIONAL HEALTH & CAC REGISTRATIONS */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  3. Operational Health & Statutory Registrations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filing throughput, internal processing efficiency, and statutory registry waiting duration.
                </p>
              </div>
              <Link
                to="/admin/cac-operations"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Open CAC Operations
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Active Engagements</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.operations.activeServiceRequests.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Total active service tickets</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">CAC In-Flight Filings</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.operations.activeCacApplications.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Submissions at registry</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Awaiting Client Docs</span>
                <span className="text-xl font-bold text-amber-600 block">
                  {data.operations.awaitingClientDocs}
                </span>
                <span className="text-[10px] text-slate-400">Waiting on client ID / sign</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Awaiting Registry</span>
                <span className="text-xl font-bold text-blue-600 block">
                  {data.operations.awaitingStatutoryAuthority}
                </span>
                <span className="text-[10px] text-slate-400">Under CAC officer review</span>
              </div>
            </div>

            {/* Operational Bottlenecks Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Operational Stage Turnaround Analysis
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                {data.operations.operationalBottlenecks.map((b) => (
                  <div key={b.stage} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{b.stage}</span>
                      <span className="text-slate-400 ml-2">({b.count} files currently in this phase)</span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Avg. {b.averageDays} days
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. CLIENT GROWTH & MARKETING ATTRIBUTION */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  4. Client Growth & Marketing Pipeline
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort lead conversion, referral conversions, and acquisition channel performance.
                </p>
              </div>
              <Link
                to="/admin/leads"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Open Leads Pipeline
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Lead Volume</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.clients.totalLeads.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Inbound inquiries</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Cohort Conversion</span>
                <span className="text-xl font-bold text-emerald-600 block">
                  {data.clients.leadConversionRate.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Inquiries to clients</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Referral Leads</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.marketing.referralLeads.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Introduced by partners</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Referral Rewards Payable</span>
                <span className="text-xl font-bold text-purple-600 block">
                  ₦{data.marketing.referralRewardsPayable.toLocaleString("en-NG")}
                </span>
                <span className="text-[10px] text-slate-400">Cumulative verified milestones</span>
              </div>
            </div>
          </section>

          {/* 5. SERVICE QUALITY & CLIENT SATISFACTION */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  5. Service Quality & Customer Satisfaction
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified client feedback scores, Net Promoter Score, and complaint turnaround.
                </p>
              </div>
              <Link
                to="/admin/service-quality"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Service Quality Dashboard
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {!data.quality.hasSufficientSample && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Sample Size Notice:</strong> Fewer than 5 client feedback submissions have been captured. Awaiting broader statistical sample.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Average CSAT Rating</span>
                <span className="text-xl font-bold text-emerald-600 block">
                  {data.quality.averageCsat.formatted} / 5.0
                </span>
                <span className="text-[10px] text-slate-400">From verified client reviews</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Net Promoter Score</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  +{data.quality.npsScore.value}
                </span>
                <span className="text-[10px] text-slate-400">Advocacy index</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Active Complaints</span>
                <span className="text-xl font-bold text-amber-600 block">
                  {data.quality.activeComplaints.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Under active investigation</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Mean Resolution Duration</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.quality.averageResolutionHours.formatted}
                </span>
                <span className="text-[10px] text-slate-400">Grievance closure SLA</span>
              </div>
            </div>
          </section>

          {/* 6. RECENT DECISIONS & PENDING APPROVALS (PHASE 13 INTEGRATION) */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  6. Governance & Pending Approval Requests
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-priority financial, operational, and commercial requests awaiting management authorization.
                </p>
              </div>
              <Link
                to="/admin/approvals"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Open Approval Center
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                <span className="text-[11px] text-amber-800 dark:text-amber-200 font-medium block mb-1">
                  Pending Approvals
                </span>
                <span className="text-xl font-bold text-amber-900 dark:text-amber-100 block">
                  {data.approvals.pendingApprovalsCount}
                </span>
                <span className="text-[10px] text-amber-700">Awaiting decision</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Executive Sign-Offs</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.approvals.awaitingExecutiveAction}
                </span>
                <span className="text-[10px] text-slate-400">Disbursements & write-offs</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Recently Approved</span>
                <span className="text-xl font-bold text-emerald-600 block">
                  {data.approvals.recentlyApprovedCount}
                </span>
                <span className="text-[10px] text-slate-400">Formal decisions executed</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-[11px] text-slate-500 block mb-1">Rejected Requests</span>
                <span className="text-xl font-bold text-red-600 block">
                  {data.approvals.recentlyRejectedCount}
                </span>
                <span className="text-[10px] text-slate-400">Declined with remarks</span>
              </div>
            </div>

            {/* High priority pending list */}
            {data.approvals.highPriorityPending.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  High-Priority Requests Awaiting Management Action
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                  {data.approvals.highPriorityPending.map((req) => (
                    <div key={req.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {req.referenceNumber}
                          </span>
                          <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                            {req.title}
                          </span>
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          Requested by {req.requesterName} on {new Date(req.dateSubmitted).toLocaleDateString()}
                          {req.amount && ` • ₦${Math.round(req.amount).toLocaleString("en-NG")}`}
                        </div>
                      </div>

                      <Link
                        to={`/admin/approvals?id=${req.id}`}
                        className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md font-medium hover:bg-emerald-100 transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
