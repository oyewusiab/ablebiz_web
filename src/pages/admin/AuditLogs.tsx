import { useEffect, useState } from "react";
import {
  FileCheck2,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  User,
  Database,
  Eye,
  Calendar,
  Lock,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface AuditRecord {
  id: string;
  staff_id?: string | null;
  staff_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: any;
  new_values?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface ActivityTimelineRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id?: string | null;
  event_type: string;
  event_title: string;
  metadata?: any;
  created_at: string;
}

export function AuditLogsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"security_audit" | "activity_timeline">("security_audit");
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<ActivityTimelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  // Selected Log Modal for JSON payload inspection
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  const isSuper = profile?.role === "super_admin" || profile?.role === "admin";

  useEffect(() => {
    if (activeTab === "security_audit") {
      fetchAuditLogs();
    } else {
      fetchTimelineLogs();
    }
  }, [activeTab]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err) {
      console.error("[AuditLogs] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimelineLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_timeline")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setTimelineLogs(data || []);
    } catch (err) {
      console.error("[TimelineLogs] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists
  const filteredAudit = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.staff_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const filteredTimeline = timelineLogs.filter((log) => {
    const matchesSearch =
      log.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Governance & Security Audit Ledger</h1>
              <p className="text-xs text-slate-500">
                Immutable system audit trails, access governance, and chronological activity records
              </p>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-xs text-xs font-semibold">
          <button
            onClick={() => setActiveTab("security_audit")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "security_audit"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Security Audit Logs
          </button>
          <button
            onClick={() => setActiveTab("activity_timeline")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "activity_timeline"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Operational Activity
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === "security_audit"
                ? "Search action, entity type, staff email..."
                : "Search event title, entity type, actor..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600"
          >
            <option value="all">All Entity Types</option>
            <option value="quotation">Quotations</option>
            <option value="invoice">Invoices</option>
            <option value="payment">Payments</option>
            <option value="expense">Expenses</option>
            <option value="cac_application">CAC Applications</option>
            <option value="task">Tasks</option>
            <option value="document">Documents</option>
            <option value="staff_profile">Staff Profiles</option>
          </select>
        </div>
      </div>

      {/* Security Audit Table */}
      {activeTab === "security_audit" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading audit records...</div>
          ) : filteredAudit.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No security audit events found matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Staff Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAudit.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {log.staff_email || "System"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {log.entity_type}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedAudit(log)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700"
                        >
                          Inspect Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Operational Activity Timeline Table */}
      {activeTab === "activity_timeline" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading timeline events...</div>
          ) : filteredTimeline.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No timeline activities recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTimeline.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/50 transition flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.event_title}</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-semibold uppercase">
                        {item.entity_type}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Type: {item.event_type} • Actor: {item.actor_type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AUDIT DIFF INSPECTION MODAL */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Audit State Inspection</h3>
                <p className="text-xs text-slate-500">
                  Action: {selectedAudit.action} • Target: {selectedAudit.entity_type}
                </p>
              </div>
              <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Before State (Old Values):</span>
                <pre className="bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-x-auto text-[11px] text-slate-800">
                  {selectedAudit.old_values ? JSON.stringify(selectedAudit.old_values, null, 2) : "None recorded"}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">After State (New Values):</span>
                <pre className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 overflow-x-auto text-[11px] text-emerald-950">
                  {selectedAudit.new_values ? JSON.stringify(selectedAudit.new_values, null, 2) : "None recorded"}
                </pre>
              </div>

              <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 font-sans">
                <p>Recorded by: {selectedAudit.staff_email || "System"} at {new Date(selectedAudit.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
