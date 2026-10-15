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
  Edit,
  UserCheck,
  X,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface CacApplicationRecord {
  id: string;
  service_request_id?: string | null;
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

  // Selection & Workbench
  const [selectedApp, setSelectedApp] = useState<CacApplicationRecord | null>(null);
  const [workbenchTasks, setWorkbenchTasks] = useState<any[]>([]);
  const [workbenchDocs, setWorkbenchDocs] = useState<any[]>([]);
  const [loadingWorkbench, setLoadingWorkbench] = useState(false);

  // Auxiliary Options for Forms
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [businessesList, setBusinessesList] = useState<any[]>([]);
  const [serviceRequestsList, setServiceRequestsList] = useState<any[]>([]);
  const [officersList, setOfficersList] = useState<any[]>([]);

  // Modals
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Create Form State
  const [newClientId, setNewClientId] = useState("");
  const [newBusinessId, setNewBusinessId] = useState("");
  const [newServiceRequestId, setNewServiceRequestId] = useState("");
  const [newAppType, setNewAppType] = useState("business_name");
  const [newProposedName1, setNewProposedName1] = useState("");
  const [newProposedName2, setNewProposedName2] = useState("");
  const [newAssignedOfficer, setNewAssignedOfficer] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Form State
  const [editProposedName1, setEditProposedName1] = useState("");
  const [editProposedName2, setEditProposedName2] = useState("");
  const [editApprovedName, setEditApprovedName] = useState("");
  const [editReservationCode, setEditReservationCode] = useState("");
  const [editCertificateNumber, setEditCertificateNumber] = useState("");
  const [editFilingRef, setEditFilingRef] = useState("");
  const [editSubmissionDate, setEditSubmissionDate] = useState("");
  const [editApprovalDate, setEditApprovalDate] = useState("");
  const [editRejectionReason, setEditRejectionReason] = useState("");
  const [editRectificationNotes, setEditRectificationNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAssignedOfficer, setEditAssignedOfficer] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Transition Modal State
  const [nextStage, setNextStage] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [transitionCertNo, setTransitionCertNo] = useState("");
  const [transitionRejectionReason, setTransitionRejectionReason] = useState("");
  const [isSubmittingTransition, setIsSubmittingTransition] = useState(false);
  const [transitionError, setTransitionError] = useState("");

  // Role permissions
  const role = profile?.role;
  const canCreate =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager" ||
    role === "registration_officer" ||
    role === "client_service_officer" ||
    hasPermission("operations", "create");

  const canEdit =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager" ||
    role === "registration_officer" ||
    hasPermission("operations", "edit");

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
        } else if (selectedApp) {
          const updated = data.find((a: any) => a.id === selectedApp.id);
          if (updated) setSelectedApp(updated as any);
        }
      }
    } catch (err) {
      console.error("[CAC] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    if (!supabase) return;
    try {
      const [cRes, bRes, srRes, sRes] = await Promise.all([
        supabase.from("clients").select("id, full_name, phone, email").order("full_name"),
        supabase.from("businesses").select("id, name, client_id").order("name"),
        supabase.from("service_requests").select("id, tracking_code, client_id").order("created_at", { ascending: false }).limit(100),
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
      ]);
      setClientsList(cRes.data || []);
      setBusinessesList(bRes.data || []);
      setServiceRequestsList(srRes.data || []);
      setOfficersList(sRes.data || []);
    } catch (e) {
      console.warn("[CAC] Auxiliary data fetch error:", e);
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
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      fetchWorkbenchDetails(selectedApp.id);
    }
  }, [selectedApp?.id]);

  // Handle Create Application
  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    if (!newClientId || !newProposedName1.trim()) {
      setCreateError("Client selection and Proposed Name 1 are required.");
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError("");

    try {
      let finalServiceRequestId = newServiceRequestId || null;

      // If no service request selected, automatically create or link one for operational traceability
      if (!finalServiceRequestId) {
        // Find default CAC service from catalog
        const { data: catService } = await supabase
          .from("services_catalog")
          .select("id")
          .ilike("category", "%business_registration%")
          .limit(1)
          .maybeSingle();

        if (catService) {
          const genTracking = `SR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          const { data: newSr, error: srErr } = await supabase
            .from("service_requests")
            .insert({
              tracking_code: genTracking,
              client_id: newClientId,
              business_id: newBusinessId || null,
              service_id: catService.id,
              priority: "normal",
              status: "in_progress",
              notes: `Auto-generated for CAC filing: ${newProposedName1.trim()}`,
            })
            .select("id")
            .single();

          if (!srErr && newSr) {
            finalServiceRequestId = newSr.id;
          }
        }
      }

      if (!finalServiceRequestId) {
        // Fallback: pick any existing service request or raise helpful guidance
        const { data: anySr } = await supabase.from("service_requests").select("id").limit(1).maybeSingle();
        finalServiceRequestId = anySr?.id || null;
      }

      const insertPayload: any = {
        client_id: newClientId,
        business_id: newBusinessId || null,
        service_request_id: finalServiceRequestId,
        application_type: newAppType,
        current_stage: "new_request",
        proposed_name_1: newProposedName1.trim(),
        proposed_name_2: newProposedName2.trim() || null,
        assigned_officer_id: newAssignedOfficer || null,
        notes: newNotes.trim() || null,
      };

      const { data: createdApp, error: insertErr } = await supabase
        .from("cac_applications")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Log to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "cac_application",
        entity_id: createdApp.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "cac_application_registered",
        event_title: `New CAC filing registered: ${newProposedName1.trim()}`,
      });

      setIsCreating(false);
      setNewClientId("");
      setNewBusinessId("");
      setNewServiceRequestId("");
      setNewProposedName1("");
      setNewProposedName2("");
      setNewAssignedOfficer("");
      setNewNotes("");

      await fetchApplications();
      setSelectedApp(createdApp);
    } catch (err: any) {
      console.error("[CAC] Create error:", err);
      setCreateError(err?.message || "Failed to create CAC application.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal with current app data
  const openEditModal = () => {
    if (!selectedApp) return;
    setEditProposedName1(selectedApp.proposed_name_1 || "");
    setEditProposedName2(selectedApp.proposed_name_2 || "");
    setEditApprovedName(selectedApp.approved_name || "");
    setEditReservationCode(selectedApp.reservation_code || "");
    setEditCertificateNumber(selectedApp.certificate_number || "");
    setEditFilingRef(selectedApp.filing_reference_number || "");
    setEditSubmissionDate(selectedApp.submission_date || "");
    setEditApprovalDate(selectedApp.approval_date || "");
    setEditRejectionReason(selectedApp.rejection_reason || "");
    setEditRectificationNotes(selectedApp.rectification_notes || "");
    setEditNotes(selectedApp.notes || "");
    setEditAssignedOfficer(selectedApp.assigned_officer_id || "");
    setEditError("");
    setIsEditing(true);
  };

  // Handle Edit Particulars Submission
  const handleEditApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedApp || !canEdit) return;

    setIsSubmittingEdit(true);
    setEditError("");

    try {
      const updatePayload: any = {
        proposed_name_1: editProposedName1.trim() || null,
        proposed_name_2: editProposedName2.trim() || null,
        approved_name: editApprovedName.trim() || null,
        reservation_code: editReservationCode.trim() || null,
        certificate_number: editCertificateNumber.trim() || null,
        filing_reference_number: editFilingRef.trim() || null,
        submission_date: editSubmissionDate || null,
        approval_date: editApprovalDate || null,
        rejection_reason: editRejectionReason.trim() || null,
        rectification_notes: editRectificationNotes.trim() || null,
        notes: editNotes.trim() || null,
        assigned_officer_id: editAssignedOfficer || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("cac_applications")
        .update(updatePayload)
        .eq("id", selectedApp.id);

      if (error) throw error;

      // Log to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "cac_application",
        entity_id: selectedApp.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "cac_particulars_updated",
        event_title: `CAC filing details updated: ${editApprovedName || editProposedName1 || "Application"}`,
      });

      setIsEditing(false);
      await fetchApplications();
    } catch (err: any) {
      console.error("[CAC] Edit error:", err);
      setEditError(err?.message || "Failed to update particulars.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Stage Transition Modal
  const openTransitionModal = () => {
    if (!selectedApp) return;
    setNextStage(selectedApp.current_stage);
    setTransitionNotes("");
    setTransitionCertNo(selectedApp.certificate_number || "");
    setTransitionRejectionReason(selectedApp.rejection_reason || "");
    setTransitionError("");
    setIsTransitioning(true);
  };

  // Handle Stage Transition
  const handleStageTransition = async () => {
    if (!supabase || !selectedApp || !nextStage || !canEdit) return;

    if (nextStage === "rejected" && !transitionRejectionReason.trim()) {
      setTransitionError("A rejection reason / CAC query note is required when marking as Rejected.");
      return;
    }

    setIsSubmittingTransition(true);
    setTransitionError("");

    try {
      const updateData: any = {
        current_stage: nextStage,
        updated_at: new Date().toISOString(),
      };

      if (transitionNotes.trim()) {
        const noteStamp = `[Stage: ${nextStage} - ${new Date().toLocaleDateString()}]: ${transitionNotes.trim()}`;
        updateData.notes = selectedApp.notes ? `${selectedApp.notes}\n${noteStamp}` : noteStamp;
      }

      if (nextStage === "application_submitted" && !selectedApp.submission_date) {
        updateData.submission_date = new Date().toISOString().split("T")[0];
      }

      if (nextStage === "approved" && !selectedApp.approval_date) {
        updateData.approval_date = new Date().toISOString().split("T")[0];
      }

      if (nextStage === "rejected") {
        updateData.rejection_reason = transitionRejectionReason.trim();
      }

      if ((nextStage === "completed" || nextStage === "documents_received") && transitionCertNo.trim()) {
        updateData.certificate_number = transitionCertNo.trim();
      }

      const { error } = await supabase
        .from("cac_applications")
        .update(updateData)
        .eq("id", selectedApp.id);

      if (error) throw error;

      // Log transition to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "cac_application",
        entity_id: selectedApp.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "cac_stage_changed",
        event_title: `CAC stage moved to ${nextStage.replace(/_/g, " ")}: ${selectedApp.approved_name || selectedApp.proposed_name_1 || "Filing"}`,
      });

      setIsTransitioning(false);
      await fetchApplications();
    } catch (err: any) {
      console.error("[CAC] Stage transition error:", err);
      setTransitionError(err?.message || "Stage transition failed.");
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

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0A2558]">
            <span>{applications.length} Active Filings</span>
          </div>

          {canCreate && (
            <button
              onClick={() => {
                setCreateError("");
                setIsCreating(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Register Filing</span>
            </button>
          )}
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
                        ? "border-[#0A2558] bg-blue-50/70 shadow-xs ring-1 ring-[#0A2558]/30"
                        : "border-slate-200 bg-white hover:border-blue-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {app.service_request?.tracking_code || "SR-UNLINKED"}
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
                      Client: {selectedApp.client?.full_name} • Ref: {selectedApp.service_request?.tracking_code || "None"} • Officer: {selectedApp.assigned_officer?.full_name || "Unassigned"}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={openEditModal}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Edit Particulars</span>
                      </button>

                      <button
                        onClick={openTransitionModal}
                        className="rounded-xl bg-[#0A2558] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
                      >
                        Update Stage
                      </button>
                    </div>
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
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Approved Name</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{selectedApp.approved_name || "Pending"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Reservation Code</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedApp.reservation_code || "Pending"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Certificate No.</span>
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
                    {selectedApp.rectification_notes && (
                      <p className="mt-1 text-slate-600 italic">Rectification: {selectedApp.rectification_notes}</p>
                    )}
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

                {/* Notes History */}
                {selectedApp.notes && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Filing Notes</h4>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {selectedApp.notes}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE APPLICATION MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Register New CAC Filing</h2>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Client *</label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                >
                  <option value="">Select Client...</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Business (Optional)</label>
                  <select
                    value={newBusinessId}
                    onChange={(e) => setNewBusinessId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  >
                    <option value="">Select Existing Business...</option>
                    {businessesList
                      .filter((b) => !newClientId || b.client_id === newClientId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Application Type *</label>
                  <select
                    value={newAppType}
                    onChange={(e) => setNewAppType(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-semibold"
                  >
                    <option value="business_name">Business Name</option>
                    <option value="company_incorporation">Company Incorporation (LTD)</option>
                    <option value="ngo_trustees">Incorporated Trustees (NGO)</option>
                    <option value="annual_returns">Annual Returns Filing</option>
                    <option value="post_incorporation_change">Post-Incorporation Change</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Proposed Name 1 *</label>
                <input
                  value={newProposedName1}
                  onChange={(e) => setNewProposedName1(e.target.value)}
                  placeholder="e.g. ABLEBIZ GLOBAL VENTURES"
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Proposed Name 2 (Alternative)</label>
                <input
                  value={newProposedName2}
                  onChange={(e) => setNewProposedName2(e.target.value)}
                  placeholder="e.g. ABLEBIZ ENTERPRISES"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Assigned Registration Officer</label>
                  <select
                    value={newAssignedOfficer}
                    onChange={(e) => setNewAssignedOfficer(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  >
                    <option value="">Unassigned</option>
                    {officersList.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name} ({o.role.replace(/_/g, " ")})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Linked Service Request</label>
                  <select
                    value={newServiceRequestId}
                    onChange={(e) => setNewServiceRequestId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-mono"
                  >
                    <option value="">Auto-create or None</option>
                    {serviceRequestsList
                      .filter((sr) => !newClientId || sr.client_id === newClientId)
                      .map((sr) => (
                        <option key={sr.id} value={sr.id}>{sr.tracking_code}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Initial Filing Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Client needs expedited name reservation for banking compliance."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmittingCreate ? "Creating..." : "Save CAC Filing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT APPLICATION MODAL */}
      {isEditing && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Edit Application Particulars</h2>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditApplication} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Proposed Name 1</label>
                  <input
                    value={editProposedName1}
                    onChange={(e) => setEditProposedName1(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Proposed Name 2</label>
                  <input
                    value={editProposedName2}
                    onChange={(e) => setEditProposedName2(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Approved Name</label>
                  <input
                    value={editApprovedName}
                    onChange={(e) => setEditApprovedName(e.target.value)}
                    placeholder="CAC Approved Name"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Reservation Code</label>
                  <input
                    value={editReservationCode}
                    onChange={(e) => setEditReservationCode(e.target.value)}
                    placeholder="e.g. RES-2026-XXXX"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Certificate Number</label>
                  <input
                    value={editCertificateNumber}
                    onChange={(e) => setEditCertificateNumber(e.target.value)}
                    placeholder="RC or BN Number"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Filing Ref. Number</label>
                  <input
                    value={editFilingRef}
                    onChange={(e) => setEditFilingRef(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Submission Date</label>
                  <input
                    type="date"
                    value={editSubmissionDate}
                    onChange={(e) => setEditSubmissionDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Approval Date</label>
                  <input
                    type="date"
                    value={editApprovalDate}
                    onChange={(e) => setEditApprovalDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Assigned Officer</label>
                <select
                  value={editAssignedOfficer}
                  onChange={(e) => setEditAssignedOfficer(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                >
                  <option value="">Unassigned</option>
                  {officersList.map((o) => (
                    <option key={o.id} value={o.id}>{o.full_name} ({o.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Rejection Reason / Query Note</label>
                <textarea
                  rows={2}
                  value={editRejectionReason}
                  onChange={(e) => setEditRejectionReason(e.target.value)}
                  placeholder="Official query comments issued by CAC officer..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Rectification Notes</label>
                <textarea
                  rows={2}
                  value={editRectificationNotes}
                  onChange={(e) => setEditRectificationNotes(e.target.value)}
                  placeholder="Steps taken to address the query..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAGE TRANSITION MODAL */}
      {isTransitioning && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Update CAC Workflow Stage</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select the next statutory milestone for <strong>{selectedApp.approved_name || selectedApp.proposed_name_1 || "Filing"}</strong>.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Next Stage *</label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-semibold"
                >
                  {CAC_STAGES_FLOW.map((st) => (
                    <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
                  ))}
                  <option value="rejected">Rejected (Returned for Query)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {nextStage === "rejected" && (
                <div>
                  <label className="font-semibold text-red-700">Rejection Reason / Query Note *</label>
                  <textarea
                    rows={2}
                    value={transitionRejectionReason}
                    onChange={(e) => setTransitionRejectionReason(e.target.value)}
                    required
                    placeholder="Describe the exact reason or objection raised by CAC..."
                    className="mt-1 w-full rounded-xl border border-red-300 p-2 outline-none focus:border-red-600"
                  />
                </div>
              )}

              {(nextStage === "completed" || nextStage === "documents_received") && (
                <div>
                  <label className="font-semibold text-emerald-800">Certificate Number (BN / RC)</label>
                  <input
                    value={transitionCertNo}
                    onChange={(e) => setTransitionCertNo(e.target.value)}
                    placeholder="e.g. BN 3928192 or RC 1928374"
                    className="mt-1 h-9 w-full rounded-xl border border-emerald-300 px-3 outline-none focus:border-emerald-600 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700">Transition Notes / Officer Remark</label>
                <textarea
                  rows={2}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder="e.g. CAC approved name; proceeding to upload constitution..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-blue-600"
                />
              </div>

              {transitionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {transitionError}
                </div>
              )}
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
