import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  Briefcase,
  CheckSquare,
  Users,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { DocumentHeader, DocumentFooter } from "../../components/admin/DocumentBranding";

type DateRangeOption = "today" | "this_week" | "this_month" | "this_quarter" | "this_year" | "all";

export function AdminReports() {
  const { profile, hasPermission } = useAuth();
  const [dateRange, setDateRange] = useState<DateRangeOption>("this_month");
  const [activeTab, setActiveTab] = useState<"overview" | "operations" | "finance" | "staff" | "growth">("overview");
  const [loading, setLoading] = useState(true);

  // Raw Aggregates State
  const [clientsCount, setClientsCount] = useState(0);
  const [businessesCount, setBusinessesCount] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [cacApplications, setCacApplications] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  const isSuper = profile?.role === "super_admin" || profile?.role === "admin";
  const canViewFinance =
    isSuper ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "view");

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  // Date Range Boundary Calculator
  const getDateThreshold = (range: DateRangeOption): Date | null => {
    const now = new Date();
    switch (range) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "this_week": {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        return new Date(now.setDate(diff));
      }
      case "this_month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "this_quarter": {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), qMonth, 1);
      }
      case "this_year":
        return new Date(now.getFullYear(), 0, 1);
      case "all":
      default:
        return null;
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const threshold = getDateThreshold(dateRange);
      const isoThreshold = threshold ? threshold.toISOString() : null;

      const [
        clientsRes,
        bizRes,
        leadsRes,
        srRes,
        cacRes,
        tasksRes,
        docsRes,
        invRes,
        payRes,
        expRes,
        staffRes,
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("businesses").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id, tracking_code, status, priority, created_at, service:services_catalog(name, category, default_fee_ngn, internal_cost_estimate)"),
        supabase.from("cac_applications").select("id, current_stage, application_type, submission_date, approval_date, assigned_officer_id, created_at"),
        supabase.from("tasks").select("id, title, status, priority, due_date, assigned_to, completed_at, created_at"),
        supabase.from("documents").select("id, category, is_verified, created_at"),
        canViewFinance ? supabase.from("invoices").select("id, invoice_number, total_amount, amount_paid, balance_due, due_date, status, created_at") : Promise.resolve({ data: [] }),
        canViewFinance ? supabase.from("payments").select("id, amount, payment_method, payment_date") : Promise.resolve({ data: [] }),
        canViewFinance ? supabase.from("expenses").select("id, amount, category, expense_date") : Promise.resolve({ data: [] }),
        supabase.from("staff_profiles").select("id, full_name, role, department").eq("is_active", true),
      ]);

      setClientsCount(clientsRes.count || 0);
      setBusinessesCount(bizRes.count || 0);
      setLeadsCount(leadsRes.count || 0);

      // Filter in-memory by date threshold where applicable
      const filterByDate = (items: any[], dateField: string) => {
        if (!items || !Array.isArray(items)) return [];
        if (!isoThreshold) return items;
        return items.filter((item) => new Date(item[dateField]) >= threshold!);
      };

      setServiceRequests(filterByDate(srRes.data || [], "created_at"));
      setCacApplications(filterByDate(cacRes.data || [], "created_at"));
      setTasks(filterByDate(tasksRes.data || [], "created_at"));
      setDocuments(filterByDate(docsRes.data || [], "created_at"));
      setInvoices(filterByDate(invRes.data || [], "created_at"));
      setPayments(filterByDate(payRes.data || [], "payment_date"));
      setExpenses(filterByDate(expRes.data || [], "expense_date"));
      setStaffList(staffRes.data || []);
    } catch (err) {
      console.error("[Reports] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Operational SLA Computations
  const now = new Date();
  const overdueTasksCount = tasks.filter((t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < now).length;
  const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
  const activeCacCount = cacApplications.filter((c) => !["completed", "rejected", "cancelled"].includes(c.current_stage)).length;
  const unverifiedDocsCount = documents.filter((d) => !d.is_verified).length;

  // Financial Computations
  const totalInvoiced = invoices.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0);
  const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const outstandingBalance = invoices.reduce((acc, i) => acc + (Number(i.balance_due) || 0), 0);
  const overdueInvoicesCount = invoices.filter(
    (i) => i.status !== "paid" && Number(i.balance_due) > 0 && new Date(i.due_date) < now
  ).length;
  const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netOperatingMargin = totalCollected - totalExpenses;

  // Internal Estimated Cost vs Actual
  const estimatedCostSum = serviceRequests.reduce((acc, sr) => {
    return acc + (Number(sr.service?.internal_cost_estimate) || 0);
  }, 0);

  // Export to CSV Function
  const exportReportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ABLEBIZ SUITE — EXECUTIVE PERFORMANCE REPORT\r\n";
    csvContent += `Generated Date: ${new Date().toLocaleDateString()}\r\n`;
    csvContent += `Selected Period: ${dateRange.replace(/_/g, " ").toUpperCase()}\r\n\r\n`;

    csvContent += "METRIC,VALUE\r\n";
    csvContent += `Total Clients,${clientsCount}\r\n`;
    csvContent += `Total Businesses,${businessesCount}\r\n`;
    csvContent += `Total Leads,${leadsCount}\r\n`;
    csvContent += `Service Requests in Period,${serviceRequests.length}\r\n`;
    csvContent += `Active CAC Applications,${activeCacCount}\r\n`;
    csvContent += `Overdue Tasks,${overdueTasksCount}\r\n`;
    csvContent += `Unverified Documents,${unverifiedDocsCount}\r\n`;

    if (canViewFinance) {
      csvContent += `\r\nFINANCIAL METRIC,AMOUNT (NGN)\r\n`;
      csvContent += `Total Invoiced,${totalInvoiced}\r\n`;
      csvContent += `Total Collected Revenue,${totalCollected}\r\n`;
      csvContent += `Outstanding Receivables,${outstandingBalance}\r\n`;
      csvContent += `Overdue Invoices Count,${overdueInvoicesCount}\r\n`;
      csvContent += `Actual Recorded Expenses,${totalExpenses}\r\n`;
      csvContent += `Net Operating Margin,${netOperatingMargin}\r\n`;
      csvContent += `Catalog Estimated Costs,${estimatedCostSum}\r\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ablebiz_executive_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="print-document space-y-6">
      {/* Print-Only Document Letterhead */}
      <div className="print-only mb-6">
        <DocumentHeader
          title="EXECUTIVE PERFORMANCE & OPERATIONS REPORT"
          date={new Date()}
          status="OFFICIAL REPORT"
          documentNumber={`REP-${new Date().getFullYear()}-${dateRange.toUpperCase()}`}
          recipientLabel="REPORT GENERATED FOR"
          recipient={{
            name: "Ablebiz Executive Management",
            email: "management@ablebiz.com.ng",
          }}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Executive Reports & Management Intelligence</h1>
              <p className="text-xs text-slate-500">
                Authoritative cross-module operational performance, SLA tracking, and financial analytics
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter & Export Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>

          <button
            onClick={exportReportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#061738] shadow-xs transition active:translate-y-px"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto text-xs font-semibold no-print">
        {[
          { id: "overview", label: "Executive Overview" },
          { id: "operations", label: "Operations & CAC SLA" },
          ...(canViewFinance ? [{ id: "finance", label: "Finance & Economics" }] : []),
          { id: "staff", label: "Staff & Workload" },
          { id: "growth", label: "Growth & Pipeline" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 transition border-b-2 ${
              activeTab === tab.id
                ? "border-[#0A2558] text-[#0A2558] font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Aggregating executive report metrics...</div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Link
                  to="/admin/clients"
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#0A2558] transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Active Clients</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-[#0A2558]" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{clientsCount}</p>
                  <span className="text-[11px] text-slate-400">{businessesCount} registered businesses</span>
                </Link>

                <Link
                  to="/admin/cac-operations"
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#0A2558] transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Active CAC Filings</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-[#0A2558]" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{activeCacCount}</p>
                  <span className="text-[11px] text-slate-400">Applications currently processing</span>
                </Link>

                <Link
                  to="/admin/tasks"
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-400 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Overdue Operational Tasks</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-red-500" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-red-600">{overdueTasksCount}</p>
                  <span className="text-[11px] text-red-500">{completedTasksCount} completed in period</span>
                </Link>

                {canViewFinance ? (
                  <Link
                    to="/admin/invoices"
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#0A2558] transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Collected Collections</span>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-[#0A2558]" />
                    </div>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">₦{totalCollected.toLocaleString()}</p>
                    <span className="text-[11px] text-slate-400">Outstanding: ₦{outstandingBalance.toLocaleString()}</span>
                  </Link>
                ) : (
                  <Link
                    to="/admin/documents"
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-400 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Pending Documents</span>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500" />
                    </div>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{unverifiedDocsCount}</p>
                    <span className="text-[11px] text-amber-500">Awaiting officer verification</span>
                  </Link>
                )}
              </div>

              {/* Actionable Attention Checklist */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Executive Action Matrix
                  </h3>
                  <span className="text-[11px] text-slate-400">Instant triage to unblock delivery</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <span className="font-bold text-slate-900 block mb-1">Overdue Invoices</span>
                    <p className="text-slate-500 text-[11px] mb-3">
                      {overdueInvoicesCount} invoices have exceeded their contractual due date.
                    </p>
                    <Link
                      to="/admin/invoices"
                      className="inline-flex items-center gap-1 font-semibold text-[#0A2558] hover:underline text-[11px]"
                    >
                      Inspect Overdue Invoices →
                    </Link>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <span className="font-bold text-slate-900 block mb-1">Unverified Vault Documents</span>
                    <p className="text-slate-500 text-[11px] mb-3">
                      {unverifiedDocsCount} client documents uploaded without officer verification stamp.
                    </p>
                    <Link
                      to="/admin/documents"
                      className="inline-flex items-center gap-1 font-semibold text-[#0A2558] hover:underline text-[11px]"
                    >
                      Verify Documents in Vault →
                    </Link>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <span className="font-bold text-slate-900 block mb-1">Active CAC Workload</span>
                    <p className="text-slate-500 text-[11px] mb-3">
                      {activeCacCount} CAC registrations across Abeokuta and national filings.
                    </p>
                    <Link
                      to="/admin/cac-operations"
                      className="inline-flex items-center gap-1 font-semibold text-[#0A2558] hover:underline text-[11px]"
                    >
                      Open CAC Workbench →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATIONS & CAC SLA */}
          {activeTab === "operations" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CAC Stage Breakdown */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">CAC Applications by Stage</h3>
                  <p className="text-xs text-slate-500 mb-4">Volume distribution across the 11-stage pipeline</p>

                  <div className="space-y-2 text-xs">
                    {[
                      "new_request",
                      "documents_required",
                      "documents_verified",
                      "name_search",
                      "name_reserved",
                      "application_prepared",
                      "application_submitted",
                      "under_cac_review",
                      "approved",
                      "completed",
                    ].map((stage) => {
                      const count = cacApplications.filter((c) => c.current_stage === stage).length;
                      const percent = cacApplications.length > 0 ? (count / cacApplications.length) * 100 : 0;

                      return (
                        <div key={stage} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="capitalize text-slate-700 font-medium">{stage.replace(/_/g, " ")}</span>
                            <span className="font-bold text-slate-900">{count}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#0A2558] rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Service Request Demand */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Service Demand Velocity</h3>
                  <p className="text-xs text-slate-500 mb-4">Requested services during the selected period</p>

                  {serviceRequests.length === 0 ? (
                    <p className="text-xs text-slate-400 py-10 text-center">No service requests recorded in this period.</p>
                  ) : (
                    <div className="space-y-3 text-xs">
                      {serviceRequests.slice(0, 6).map((sr) => (
                        <div key={sr.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-slate-500">{sr.tracking_code}</span>
                            <p className="font-semibold text-slate-900">{sr.service?.name || "Service Engagement"}</p>
                          </div>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {sr.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCE & ECONOMICS */}
          {activeTab === "finance" && canViewFinance && (
            <div className="space-y-6">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Total Invoiced</span>
                  <p className="mt-1 text-2xl font-bold text-slate-900">₦{totalInvoiced.toLocaleString()}</p>
                  <span className="text-[11px] text-slate-400">Total contractual billing</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Reconciled Collections</span>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">₦{totalCollected.toLocaleString()}</p>
                  <span className="text-[11px] text-emerald-600">Actual bank cash received</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Recorded Expenses</span>
                  <p className="mt-1 text-2xl font-bold text-red-600">₦{totalExpenses.toLocaleString()}</p>
                  <span className="text-[11px] text-slate-400">Statutory fees & overheads</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Net Operating Margin</span>
                  <p className={`mt-1 text-2xl font-bold ${netOperatingMargin >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                    ₦{netOperatingMargin.toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-400">Collections minus actual costs</span>
                </div>
              </div>

              {/* Distinguish Actual vs Estimated Cost */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Service Delivery Cost Analysis</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Comparative breakdown between catalogue estimates and actual recorded expenses
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Catalogue Estimated Internal Costs</span>
                    <p className="text-xl font-bold text-slate-900 mt-1">₦{estimatedCostSum.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Computed from standard cost baselines across {serviceRequests.length} service requests.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Actual Recorded Disbursements</span>
                    <p className="text-xl font-bold text-red-700 mt-1">₦{totalExpenses.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Verified expense transactions paid to statutory authorities (CAC, FIRS) and logistics.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STAFF & WORKLOAD */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Staff Workload & Task Allocation</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Operational visibility across departments and assigned responsibility
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Officer Name</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Active CAC Filings</th>
                        <th className="py-2.5 px-3">Pending Tasks</th>
                        <th className="py-2.5 px-3">Completed Tasks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((st) => {
                        const officerCac = cacApplications.filter((c) => c.assigned_officer_id === st.id).length;
                        const officerPendingTasks = tasks.filter((t) => t.assigned_to === st.id && t.status !== "completed").length;
                        const officerCompleted = tasks.filter((t) => t.assigned_to === st.id && t.status === "completed").length;

                        return (
                          <tr key={st.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{st.full_name}</td>
                            <td className="py-2.5 px-3 capitalize text-slate-600">{st.role.replace(/_/g, " ")}</td>
                            <td className="py-2.5 px-3 text-slate-500">{st.department}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-700">{officerCac}</td>
                            <td className="py-2.5 px-3 font-semibold text-amber-600">{officerPendingTasks}</td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-700">{officerCompleted}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GROWTH & PIPELINE */}
          {activeTab === "growth" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Total Leads</span>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{leadsCount}</p>
                  <span className="text-[11px] text-slate-400">Total inquiries captured</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Client Conversion Rate</span>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {leadsCount > 0 ? Math.round((clientsCount / leadsCount) * 100) : 0}%
                  </p>
                  <span className="text-[11px] text-emerald-600">Lead-to-client velocity</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Business Density</span>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    {clientsCount > 0 ? (businessesCount / clientsCount).toFixed(1) : 0}
                  </p>
                  <span className="text-[11px] text-blue-500">Average businesses per client</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Print-Only Document Footer */}
      <div className="print-only mt-8">
        <DocumentFooter
          documentId={`REP-${dateRange.toUpperCase()}`}
          notes="Confidential internal operations intelligence document. Authorized for ABLEBIZ Business Services executive decision-making."
        />
      </div>
    </div>
  );
}
