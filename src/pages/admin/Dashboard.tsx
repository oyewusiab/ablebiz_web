import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  FileCheck2,
  Users,
  Building2,
  CheckSquare,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  FolderOpen,
  Calendar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { getRoleTitle } from "../../auth/roleConfig";

interface AttentionItem {
  id: string;
  type: "task" | "service_request" | "cac_application" | "invoice" | "lead";
  title: string;
  subtitle: string;
  priority: "urgent" | "high" | "normal";
  link: string;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName?: string;
}

interface DashboardMetrics {
  activeClients: number;
  activeBusinesses: number;
  openServiceRequests: number;
  pendingCacApplications: number;
  openTasks: number;
  unpaidInvoices: number;
  totalRevenueNgn: number;
  totalExpensesNgn: number;
}

export function AdminDashboard() {
  const { user, profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeClients: 0,
    activeBusinesses: 0,
    openServiceRequests: 0,
    pendingCacApplications: 0,
    openTasks: 0,
    unpaidInvoices: 0,
    totalRevenueNgn: 0,
    totalExpensesNgn: 0,
  });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  const roleTitle = getRoleTitle(profile?.role);
  const canViewFinance = hasPermission("finance", "view");

  const loadWorkbenchData = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // 1. Fetch real counts from operational tables
      const [
        clientsRes,
        businessesRes,
        srRes,
        cacRes,
        tasksRes,
        invRes,
        paymentsRes,
        expensesRes,
        activityRes,
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("businesses").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id, title, status, priority, created_at").neq("status", "completed"),
        supabase.from("cac_applications").select("id, proposed_name_1, status, stage, created_at").neq("stage", "completed"),
        supabase.from("tasks").select("id, title, status, priority, due_date").neq("status", "completed"),
        supabase.from("invoices").select("id, invoice_number, total_amount, balance_due, status").neq("status", "paid"),
        canViewFinance ? supabase.from("payments").select("amount") : Promise.resolve({ data: [] }),
        canViewFinance ? supabase.from("expenses").select("amount") : Promise.resolve({ data: [] }),
        supabase.from("activity_timeline").select("id, event_title, entity_type, created_at").order("created_at", { ascending: false }).limit(6),
      ]);

      // Calculate Finance Totals if allowed
      let revTotal = 0;
      if (paymentsRes.data && Array.isArray(paymentsRes.data)) {
        revTotal = paymentsRes.data.reduce((acc, p: any) => acc + (Number(p.amount) || 0), 0);
      }
      let expTotal = 0;
      if (expensesRes.data && Array.isArray(expensesRes.data)) {
        expTotal = expensesRes.data.reduce((acc, e: any) => acc + (Number(e.amount) || 0), 0);
      }

      setMetrics({
        activeClients: clientsRes.count || 0,
        activeBusinesses: businessesRes.count || 0,
        openServiceRequests: (srRes.data || []).length,
        pendingCacApplications: (cacRes.data || []).length,
        openTasks: (tasksRes.data || []).length,
        unpaidInvoices: (invRes.data || []).length,
        totalRevenueNgn: revTotal,
        totalExpensesNgn: expTotal,
      });

      // 2. Synthesize Actionable Attention Items
      const attention: AttentionItem[] = [];

      // Check overdue or urgent tasks
      if (tasksRes.data) {
        tasksRes.data.slice(0, 3).forEach((t: any) => {
          attention.push({
            id: `task-${t.id}`,
            type: "task",
            title: `Task: ${t.title}`,
            subtitle: t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "Priority Action Required",
            priority: t.priority === "urgent" ? "urgent" : "high",
            link: "/admin/tasks",
          });
        });
      }

      // Check pending service requests
      if (srRes.data) {
        srRes.data.slice(0, 3).forEach((sr: any) => {
          attention.push({
            id: `sr-${sr.id}`,
            type: "service_request",
            title: `Request: ${sr.title}`,
            subtitle: `Status: ${sr.status.replace(/_/g, " ")}`,
            priority: "normal",
            link: "/admin/service-requests",
          });
        });
      }

      // Check pending CAC applications
      if (cacRes.data) {
        cacRes.data.slice(0, 2).forEach((cac: any) => {
          attention.push({
            id: `cac-${cac.id}`,
            type: "cac_application",
            title: `CAC Filing: ${cac.proposed_name_1}`,
            subtitle: `Stage: ${cac.stage.replace(/_/g, " ")}`,
            priority: "high",
            link: "/admin/cac-operations",
          });
        });
      }

      setAttentionItems(attention);

      if (activityRes.data) {
        setRecentActivities(
          activityRes.data.map((item: any) => ({
            id: item.id,
            action: item.event_title || item.action || "Operational Activity",
            entityType: item.entity_type,
            createdAt: item.created_at,
          }))
        );
      }
    } catch (err) {
      console.error("[Dashboard] Error loading metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkbenchData();
  }, [profile]);

  return (
    <div className="space-y-6">
      {/* 1. Executive Greetings & Status Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Good day, {profile?.full_name?.split(" ")[0] || "Staff Member"}
            </h1>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {roleTitle}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} • Operational Overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadWorkbenchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span>Sync Live Data</span>
          </button>
        </div>
      </div>

      {/* 2. Priority Attention Center ("What requires my attention today?") */}
      <div className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-5 lg:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-xs">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Requires Your Immediate Attention</h2>
              <p className="text-xs text-slate-500">Items awaiting internal review, filing, or client response</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            {attentionItems.length} Action Items
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-white/60 p-6 text-center">
            <FileCheck2 className="mx-auto h-8 w-8 text-emerald-600 mb-2 opacity-70" />
            <p className="text-xs font-semibold text-slate-800">All queues are clear!</p>
            <p className="text-[11px] text-slate-500">No overdue tasks or pending filings require immediate escalation.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 hover:border-emerald-500 hover:shadow-xs transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {item.type.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[10px] font-semibold ${item.priority === "urgent" ? "text-red-600" : "text-amber-600"}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 line-clamp-1">{item.title}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{item.subtitle}</p>
                </div>
                <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-emerald-700 group-hover:translate-x-0.5 transition">
                  Resolve <ArrowUpRight className="ml-1 h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 3. Operational Snapshot Metrics */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Operational Pipeline Snapshot</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Active Clients</span>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.activeClients}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Client entities with active records</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Businesses</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.activeBusinesses}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Registered business entities</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Service Requests</span>
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.openServiceRequests}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Active operational engagements</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">CAC Applications</span>
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.pendingCacApplications}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">In statutory filing workflow</p>
          </div>
        </div>
      </div>

      {/* 4. Financial Snapshot (Only if staff has permission) */}
      {canViewFinance && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Financial Ledger Summary</h3>
            </div>
            <Link to="/admin/invoices" className="text-xs font-semibold text-emerald-700 hover:underline">
              View Invoices & Payments →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs text-slate-500 font-medium">Total Received Payments</span>
              <p className="mt-1 text-xl font-bold text-emerald-800">
                ₦{metrics.totalRevenueNgn.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Verified inflows to date</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs text-slate-500 font-medium">Recorded Expenses</span>
              <p className="mt-1 text-xl font-bold text-slate-900">
                ₦{metrics.totalExpensesNgn.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Disbursements & statutory fees</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs text-slate-500 font-medium">Unpaid/Pending Invoices</span>
              <p className="mt-1 text-xl font-bold text-amber-600">{metrics.unpaidInvoices}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Awaiting client payment</p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Live Activity Ledger & Quick Operations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Operational Activity</h3>
            <span className="text-xs text-slate-500">Real-time Timeline</span>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent timeline activities recorded in the database.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{act.action}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono">
                      {act.entityType}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Launchpad */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Quick Operational Actions</h3>
            <p className="text-xs text-slate-500 mb-4">Initiate standard client service workflows</p>

            <div className="space-y-2">
              <Link
                to="/admin/services-catalog"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition"
              >
                <span>Browse Services Catalogue</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" />
              </Link>
              <Link
                to="/admin/service-requests"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition"
              >
                <span>Manage Service Requests</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" />
              </Link>
              <Link
                to="/admin/clients"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition"
              >
                <span>Client 360° Directory</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" />
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
              Operational Security Active
            </p>
            <p className="mt-0.5 text-emerald-700">All data queries are secured via Supabase PostgreSQL Row-Level Security.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
