import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  TrendingDown,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Filter,
  RefreshCw,
  Download,
  Info,
  Calendar,
  Layers,
  Award,
  ChevronRight,
  Receipt,
  FileCheck2,
  X,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  calculateServiceProfitability,
  fetchProfitabilityDataset,
  ServiceProfitabilityAnalysis,
  ServiceProfitabilityRecord,
  CostClassification,
} from "../../lib/profitability/profitabilityService";

export function ServiceProfitabilityPage() {
  const { profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<{
    catalog: any[];
    serviceRequests: any[];
    invoices: any[];
    invoiceItems: any[];
    expenses: any[];
    staffProfiles: any[];
  } | null>(null);

  // Filters
  const [periodPreset, setPeriodPreset] = useState<"this_month" | "last_3_months" | "this_year" | "all">("this_month");
  const [serviceCategory, setServiceCategory] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [serviceStatus, setServiceStatus] = useState<"all" | "completed" | "active">("all");
  const [responsibleOfficerId, setResponsibleOfficerId] = useState("all");
  const [activeTab, setActiveTab] = useState<"overview" | "rankings" | "trends" | "traceability">("overview");

  // Selected Service for Traceability Drawer
  const [selectedService, setSelectedService] = useState<ServiceProfitabilityRecord | null>(null);

  const canViewReports =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    profile?.role === "operations_manager" ||
    hasPermission("reports", "view") ||
    hasPermission("finance", "view");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchProfitabilityDataset();
      setDataset(data);
    } catch (err) {
      console.error("[ServiceProfitability] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Compute date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodPreset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { start, end };
    }
    if (periodPreset === "last_3_months") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { start, end };
    }
    if (periodPreset === "this_year") {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
      return { start, end };
    }
    return { start: null, end: null };
  }, [periodPreset]);

  // Run calculation
  const analysis: ServiceProfitabilityAnalysis | null = useMemo(() => {
    if (!dataset) return null;
    return calculateServiceProfitability(
      dataset.catalog,
      dataset.serviceRequests,
      dataset.invoices,
      dataset.invoiceItems,
      dataset.expenses,
      {
        startDate: dateRange.start,
        endDate: dateRange.end,
        serviceCategory,
        serviceId,
        serviceStatus,
        responsibleOfficerId,
      }
    );
  }, [dataset, dateRange, serviceCategory, serviceId, serviceStatus, responsibleOfficerId]);

  // CSV Export
  const handleExportCsv = () => {
    if (!analysis) return;
    const headers = [
      "Service Name",
      "Category",
      "Completed Jobs",
      "Recognized Revenue (NGN)",
      "Discounts Granted (NGN)",
      "Direct Costs (NGN)",
      "Cost Type",
      "Gross Profit (NGN)",
      "Gross Margin %",
      "Avg Revenue/Job (NGN)",
    ];

    const rows = analysis.services.map((s) => [
      `"${s.serviceName.replace(/"/g, '""')}"`,
      `"${s.serviceCategory}"`,
      s.completedCount,
      s.recognizedServiceRevenue,
      s.discountsGranted,
      s.totalDirectCosts,
      s.costClassification,
      s.grossProfit,
      s.grossProfitMarginPercent,
      s.averageRevenuePerCompletedService,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ABLEBIZ_Service_Profitability_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canViewReports) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Restricted Access</h2>
        <p className="text-slate-600 mt-1">
          Your role does not have authorization to view financial profitability and cost analysis.
        </p>
      </div>
    );
  }

  const formatNgn = (val: number) => `₦${Math.round(val || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-fit mb-2 border border-emerald-200">
            <DollarSign className="w-3.5 h-3.5" />
            Executive Financial Analysis
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Service Profitability & Cost Analysis
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Evaluate revenue, direct operational disbursements, gross margins, and profitability rankings across all corporate services.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!analysis || analysis.services.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[#061738] hover:bg-[#0a2355] rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </div>

        {/* Period Preset */}
        <select
          value={periodPreset}
          onChange={(e) => setPeriodPreset(e.target.value as any)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="this_month">This Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="this_year">This Year</option>
          <option value="all">All Time</option>
        </select>

        {/* Service Category */}
        <select
          value={serviceCategory}
          onChange={(e) => setServiceCategory(e.target.value)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">All Categories</option>
          <option value="business_registration">Business Registration</option>
          <option value="post_incorporation">Post-Incorporation</option>
          <option value="regulatory_compliance">Regulatory Compliance</option>
          <option value="tax_accounting">Tax & Accounting</option>
        </select>

        {/* Service Status */}
        <select
          value={serviceStatus}
          onChange={(e) => setServiceStatus(e.target.value as any)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">All Service Requests</option>
          <option value="completed">Completed Jobs Only</option>
          <option value="active">Active In-Progress Only</option>
        </select>

        {/* Responsible Officer */}
        {dataset?.staffProfiles && dataset.staffProfiles.length > 0 && (
          <select
            value={responsibleOfficerId}
            onChange={(e) => setResponsibleOfficerId(e.target.value)}
            className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Assigned Officers</option>
            {dataset.staffProfiles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Completeness / Notice Banner */}
      {analysis?.totals.dataCompletenessNotice && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Notice: Incomplete Cost Records Detected</div>
            <div className="text-amber-800 text-xs mt-0.5">
              {analysis.totals.dataCompletenessNotice} Unallocated overhead is displayed distinctly to prevent misleading actual-profit calculations.
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Total Recognized Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNgn(analysis.totals.totalServiceRevenue)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Discounts granted: <span className="font-semibold text-slate-700">{formatNgn(analysis.totals.totalDiscountsGranted)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Total Direct Costs</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNgn(analysis.totals.totalDirectCosts)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Unallocated overhead: <span className="font-semibold text-slate-700">{formatNgn(analysis.totals.unallocatedExpensesTotal)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Gross Profit</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className={`text-2xl font-black ${analysis.totals.totalGrossProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {formatNgn(analysis.totals.totalGrossProfit)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Net Surplus: <span className="font-semibold text-slate-700">{formatNgn(analysis.totals.netOperatingSurplusAfterOverhead)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Gross Profit Margin</span>
              <Percent className="w-4 h-4 text-blue-600" />
            </div>
            <div className={`text-2xl font-black ${analysis.totals.overallGrossMarginPercent >= 30 ? "text-emerald-700" : analysis.totals.overallGrossMarginPercent >= 15 ? "text-amber-600" : "text-rose-600"}`}>
              {analysis.totals.overallGrossMarginPercent}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Completed jobs: <span className="font-semibold text-slate-700">{analysis.totals.totalServicesCompleted}</span> (Avg {formatNgn(analysis.totals.averageRevenuePerCompletedService)}/job)
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "overview" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          All Services Breakdown
        </button>
        <button
          onClick={() => setActiveTab("rankings")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "rankings" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Top & Underperforming
        </button>
        <button
          onClick={() => setActiveTab("trends")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "trends" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Profitability Trends
        </button>
      </div>

      {/* TAB 1: OVERVIEW TABLE */}
      {activeTab === "overview" && analysis && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Jobs Completed</th>
                  <th className="py-3 px-4 text-right">Recognized Revenue</th>
                  <th className="py-3 px-4 text-right">Discounts Granted</th>
                  <th className="py-3 px-4 text-right">Direct Costs</th>
                  <th className="py-3 px-4 text-center">Cost Method</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-right">Gross Margin</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analysis.services.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No service records match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  analysis.services.map((svc) => (
                    <tr key={svc.serviceId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{svc.serviceName}</div>
                        <div className="text-[11px] text-slate-400">{svc.totalRequestsCount} total commissioned</div>
                      </td>
                      <td className="py-3.5 px-4 capitalize font-medium text-slate-600">
                        {svc.serviceCategory.replace(/_/g, " ")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                        {svc.completedCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatNgn(svc.recognizedServiceRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500">
                        {svc.discountsGranted > 0 ? formatNgn(svc.discountsGranted) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-rose-700">
                        {formatNgn(svc.totalDirectCosts)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            svc.costClassification === "actual"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : svc.costClassification === "allocated"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {svc.costClassification}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        <span className={svc.grossProfit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                          {formatNgn(svc.grossProfit)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black">
                        <span
                          className={
                            svc.grossProfitMarginPercent >= 30
                              ? "text-emerald-700"
                              : svc.grossProfitMarginPercent >= 15
                              ? "text-amber-600"
                              : "text-rose-600"
                          }
                        >
                          {svc.grossProfitMarginPercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedService(svc)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#061738] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          Trace
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RANKINGS */}
      {activeTab === "rankings" && analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 Most Profitable */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Award className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Top 5 Most Profitable Services</h3>
            </div>
            <div className="space-y-3">
              {analysis.topProfitableServices.map((svc, idx) => (
                <div key={svc.serviceId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">{svc.serviceName}</div>
                      <div className="text-[11px] text-slate-500">
                        {svc.completedCount} completed · Revenue: {formatNgn(svc.recognizedServiceRevenue)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xs text-emerald-700">{formatNgn(svc.grossProfit)}</div>
                    <div className="text-[11px] text-slate-500">{svc.grossProfitMarginPercent}% margin</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Underperforming / Low Margin Services */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-base">Services Needing Pricing Review</h3>
            </div>
            <div className="space-y-3">
              {analysis.lowMarginServices.length === 0 && analysis.lossMakingServices.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No underperforming or low-margin services identified for the selected period.
                </div>
              ) : (
                [...analysis.lossMakingServices, ...analysis.lowMarginServices].slice(0, 5).map((svc) => (
                  <div key={svc.serviceId} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{svc.serviceName}</div>
                      <div className="text-[11px] text-slate-500">
                        Costs: {formatNgn(svc.totalDirectCosts)} · Revenue: {formatNgn(svc.recognizedServiceRevenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-xs ${svc.grossProfit < 0 ? "text-rose-600" : "text-amber-600"}`}>
                        {formatNgn(svc.grossProfit)}
                      </div>
                      <div className="text-[11px] font-bold text-rose-700">{svc.grossProfitMarginPercent}% margin</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRENDS */}
      {activeTab === "trends" && analysis && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-4">Monthly Profitability Progression</h3>
          <div className="space-y-4">
            {analysis.trends.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No monthly historical records available for trend analysis.
              </div>
            ) : (
              analysis.trends.map((t) => (
                <div key={t.periodKey} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-sm">{t.periodLabel}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${t.marginPercent >= 30 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {t.marginPercent}% Gross Margin
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Revenue:</span>{" "}
                      <span className="font-bold text-slate-900">{formatNgn(t.revenue)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Direct Costs:</span>{" "}
                      <span className="font-bold text-rose-700">{formatNgn(t.directCosts)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Gross Profit:</span>{" "}
                      <span className={`font-bold ${t.grossProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {formatNgn(t.grossProfit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Completed Jobs:</span>{" "}
                      <span className="font-bold text-slate-900">{t.completedCount}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedService.serviceName}</h3>
                <div className="text-xs text-slate-500">Financial Audit & Cost Traceability Record</div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Catalog Default Fee:</span>{" "}
                  <span className="font-bold text-slate-800">{formatNgn(selectedService.defaultFeeNgn)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Catalog Internal Cost:</span>{" "}
                  <span className="font-bold text-slate-800">{formatNgn(selectedService.catalogCostEstimate)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Cost Coverage:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedService.costCoveragePercent}% of jobs</span>
                </div>
                <div>
                  <span className="text-slate-500">Cost Attribution Method:</span>{" "}
                  <span className="font-bold uppercase text-slate-800">{selectedService.costClassification}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-600" /> Linked Invoice Records ({selectedService.contributingInvoiceIds.length})
                </h4>
                {selectedService.contributingInvoiceIds.length === 0 ? (
                  <div className="text-slate-400 italic">No direct invoices linked yet.</div>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    {selectedService.contributingInvoiceIds.map((id) => (
                      <div key={id} className="text-slate-700 font-mono text-[11px]">
                        • Invoice Record: {id}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600" /> Linked Direct Expense Records ({selectedService.contributingExpenseIds.length})
                </h4>
                {selectedService.contributingExpenseIds.length === 0 ? (
                  <div className="text-slate-400 italic">
                    No direct expenses recorded. {selectedService.completedCount > 0 ? "Baseline cost estimation applied." : ""}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    {selectedService.contributingExpenseIds.map((id) => (
                      <div key={id} className="text-slate-700 font-mono text-[11px]">
                        • Expense Record: {id}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
