import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Filter,
  Plus,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface CacApplicationRecord {
  id: string;
  service_request_id: string;
  business_id?: string | null;
  client_id: string;
  assigned_officer_id?: string | null;
  application_type: string;
  current_stage: string;
  proposed_name_1?: string | null;
  proposed_name_2?: string | null;
  approved_name?: string | null;
  reservation_code?: string | null;
  submission_date?: string | null;
  approval_date?: string | null;
  certificate_number?: string | null;
  rejection_reason?: string | null;
  rectification_notes?: string | null;
  filing_reference_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  client?: { full_name: string; phone: string; email: string };
  business?: { name: string };
  service_request?: { tracking_code: string; priority: string };
  assigned_officer?: { full_name: string; email: string };
}

const CAC_STAGES_FLOW = [
  "new_request",
  "documents_required",
  "documents_verified",
  "name_search",
  "name_reserved",
  "application_prepared",
  "application_submitted",
  "under_cac_review",
  "approved",
  "documents_received",
  "completed",
];

export function CacOperationsPage() {
  const { profile, hasPermission } = useAuth();
  const [applications, setApplications] = useState<CacApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Detail Workbench
  const [selectedApp, setSelectedApp] = useState<CacApplicationRecord | null>(null);
  const [workbenchTasks, setWorkbenchTasks] = useState<any[]>([]);
  const [workbenchDocs, setWorkbenchDocs] = useState<any[]>([]);
  const [loadingWorkbench, setLoadingWorkbench] = useState(false);

  // Transition Modal State
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextStage, setNextStage] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [isSubmittingTransition, setIsSubmittingTransition] = useState(false);

  const canEdit = hasPermission("operations", "edit");

  const fetchApplications = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cac_applications")
        .select(`
          *,
          client:clients(full_name, phone, email),
          business:businesses(name),
          service_request:service_requests(tracking_code, priority),
          assigned_officer:staff_profiles!cac_applications_assigned_officer_id_fkey(full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[CAC] Fetch error:", error.message);
      } else if (data) {
        setApplications(data as any[]);
        if (!selectedApp && data.length > 0) {
          setSelectedApp(data[0] as any);
        }
      }
    } catch (err) {
      console.error("[CAC] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkbenchDetails = async (appId: string) => {
    if (!supabase) return;
    setLoadingWorkbench(true);
    try {
      const [tasksRes, docsRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("cac_application_id", appId),
        supabase.from("documents").select("*").eq("cac_application_id", appId),
      ]);
      setWorkbenchTasks(tasksRes.data || []);
      setWorkbenchDocs(docsRes.data || []);
    } catch (err) {
      console.error("[CAC Workbench] Error:", err);
    } finally {
      setLoadingWorkbench(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      fetchWorkbenchDetails(selectedApp.id);
    }
  }, [selectedApp]);

  const handleStageTransition = async () => {
    if (!supabase || !selectedApp || !nextStage || !canEdit) return;
    setIsSubmittingTransition(true);

    try {
      const { error } = await supabase
        .from("cac_applications")
        .update({
          current_stage: nextStage,
          notes: transitionNotes ? `${selectedApp.notes || ""}\n[Transition to ${nextStage}]: ${transitionNotes}` : selectedApp.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedApp.id);

      if (error) throw error;

      // Log transition to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "cac_application",
        entity_id: selectedApp.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "cac_stage_changed",
        event_title: `CAC stage moved to ${nextStage.replace(/_/g, " ")}: ${selectedApp.proposed_name_1 || "Filing"}`,
      });

      setIsTransitioning(false);
      setNextStage("");
      setTransitionNotes("");
      await fetchApplications();
      setSelectedApp((prev) => (prev ? { ...prev, current_stage: nextStage } : null));
    } catch (err: any) {
      alert("Transition failed: " + err?.message);
    } finally {
      setIsSubmittingTransition(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.proposed_name_1 && app.proposed_name_1.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.approved_name && app.approved_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      app.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.service_request?.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "all" || app.current_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">CAC Operations</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              Statutory Filing Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            11-stage statutory registration workflow from name availability search to official certificate issuance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0A2558]">
            <span>{applications.length} Active Filings</span>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Applications Directory & Officer Workbench */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Application Directory (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by proposed name, client, tracking code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">All Stages</option>
              {CAC_STAGES_FLOW.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
              <option value="rejected">Rejected (Query)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Applications Cards */}
          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading CAC filings...</div>
            ) : filteredApps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                No CAC applications found.
              </div>
            ) : (
              filteredApps.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                const isException = app.current_stage === "rejected" || app.current_stage === "cancelled";
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition ${
                      isSelected
                        ? "border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700/30"
                        : "border-slate-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {app.service_request?.tracking_code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                          {app.approved_name || app.proposed_name_1 || "Unnamed CAC Request"}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Client: {app.client?.full_name}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        isException
                          ? "bg-red-100 text-red-800"
                          : app.current_stage === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {app.current_stage.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Officer Workbench (7 cols) */}
        <div className="lg:col-span-7">
          {!selectedApp ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-xs text-slate-400">
              Select a CAC application to inspect filing progress.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Header */}
              <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {selectedApp.application_type.replace(/_/g, " ")}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {selectedApp.approved_name || selectedApp.proposed_name_1 || "CAC Filing Engagement"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Client: {selectedApp.client?.full_name} • Ref: {selectedApp.service_request?.tracking_code}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setNextStage(selectedApp.current_stage);
                        setIsTransitioning(true);
                      }}
                      className="rounded-xl bg-[#0A2558] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
                    >
                      Update Stage
                    </button>
                  )}
                </div>

                {/* 11-Stage Workflow Visualizer */}
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workflow Progress</span>
                  <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
                    {CAC_STAGES_FLOW.map((st, i) => {
                      const currentIndex = CAC_STAGES_FLOW.indexOf(selectedApp.current_stage);
                      const isPast = currentIndex > i;
                      const isCurrent = currentIndex === i;
                      return (
                        <div
                          key={st}
                          className={`flex items-center gap-1 shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${
                            isCurrent
                              ? "bg-emerald-700 text-white font-bold"
                              : isPast
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <span>{i + 1}. {st.replace(/_/g, " ")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Workbench Body */}
              <div className="p-5 space-y-5 text-xs text-slate-700">
                {/* Proposed Names & Particulars */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Proposed Name 1</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedApp.proposed_name_1 || "None"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Proposed Name 2</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedApp.proposed_name_2 || "None"}</p>
                  </div>
                </div>

                {/* Filing Status & Resolution */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Reservation Code</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedApp.reservation_code || "Pending"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Certificate Number</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedApp.certificate_number || "Not Issued"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Approval Date</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {selectedApp.approval_date ? new Date(selectedApp.approval_date).toLocaleDateString() : "Pending"}
                    </p>
                  </div>
                </div>

                {/* Exception Notice (Query/Rejection) */}
                {selectedApp.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>Official CAC Query Notice</span>
                    </div>
                    <p>{selectedApp.rejection_reason}</p>
                  </div>
                )}

                {/* Associated Tasks */}
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Filing Tasks ({workbenchTasks.length})</h4>
                  {workbenchTasks.length === 0 ? (
                    <p className="text-slate-400 italic">No operational tasks assigned to this CAC application.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {workbenchTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
                          <span className="font-semibold text-slate-900">{t.title}</span>
                          <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                            t.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Associated Documents */}
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Filing Documents ({workbenchDocs.length})</h4>
                  {workbenchDocs.length === 0 ? (
                    <p className="text-slate-400 italic">No documents uploaded to this filing yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {workbenchDocs.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
                          <span className="font-semibold text-slate-900">{d.title}</span>
                          <span className="font-mono text-[10px] text-slate-400">{d.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage Transition Modal */}
      {isTransitioning && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Update CAC Workflow Stage</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select the next statutory milestone for <strong>{selectedApp.proposed_name_1 || "Filing"}</strong>.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Next Stage *</label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600 font-semibold"
                >
                  {CAC_STAGES_FLOW.map((st) => (
                    <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
                  ))}
                  <option value="rejected">Rejected (Returned for Query)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Transition Notes / Officer Remark</label>
                <textarea
                  rows={2}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder="e.g. CAC approved name; proceeding to upload constitution..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTransitioning(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStageTransition}
                disabled={isSubmittingTransition}
                className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] transition disabled:opacity-50"
              >
                {isSubmittingTransition ? "Updating..." : "Confirm Stage Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
