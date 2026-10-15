import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Search,
  Filter,
  Plus,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  X,
  Loader2,
  Edit,
  UserCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
  CheckSquare,
  Square,
  FileText,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface ServiceRequestRecord {
  id: string;
  tracking_code: string;
  client_id: string;
  business_id?: string | null;
  service_id: string;
  assigned_staff_id?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending_review" | "quoted" | "in_progress" | "awaiting_client" | "under_review" | "completed" | "cancelled";
  progress_percent: number;
  requirements_checklist: Array<{ title: string; completed: boolean }>;
  target_completion_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  client?: { id: string; full_name: string; phone: string; email: string };
  business?: { id: string; name: string };
  service?: { id: string; name: string; category: string; default_fee_ngn?: number; expected_turnaround_days?: number };
  assigned_staff?: { id: string; full_name: string; role: string };
}

const SR_STATUSES = [
  "pending_review",
  "quoted",
  "in_progress",
  "awaiting_client",
  "under_review",
  "completed",
  "cancelled",
];

export function ServiceRequestsPage() {
  const { profile, hasPermission } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection & Workbench
  const [selectedReq, setSelectedReq] = useState<ServiceRequestRecord | null>(null);

  // Auxiliary Lists for Create/Edit
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [businessesList, setBusinessesList] = useState<any[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Modals
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Create Form State
  const [newClientId, setNewClientId] = useState("");
  const [newBusinessId, setNewBusinessId] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newAssignedStaffId, setNewAssignedStaffId] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Workbench Quick Updates State
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Role permissions
  const role = profile?.role;
  const canCreate =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager" ||
    role === "client_service_officer" ||
    hasPermission("operations", "create");

  const canEdit =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager" ||
    role === "client_service_officer" ||
    role === "registration_officer" ||
    hasPermission("operations", "edit");

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          client:clients(id, full_name, phone, email),
          business:businesses(id, name),
          service:services_catalog(id, name, category, default_fee_ngn, expected_turnaround_days),
          assigned_staff:staff_profiles!service_requests_assigned_staff_id_fkey(id, full_name, role)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ServiceRequests] Fetch error:", error.message);
      } else if (data) {
        setRequests(data as any[]);
        if (!selectedReq && data.length > 0) {
          setSelectedReq(data[0] as any);
        } else if (selectedReq) {
          const updated = data.find((r: any) => r.id === selectedReq.id);
          if (updated) setSelectedReq(updated as any);
        }
      }
    } catch (err) {
      console.error("[ServiceRequests] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    if (!supabase) return;
    try {
      const [cRes, bRes, sRes, staffRes] = await Promise.all([
        supabase.from("clients").select("id, full_name, phone, email").order("full_name"),
        supabase.from("businesses").select("id, name, client_id").order("name"),
        supabase.from("services_catalog").select("id, name, category, default_fee_ngn, requirements").eq("is_active", true).order("name"),
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
      ]);
      setClientsList(cRes.data || []);
      setBusinessesList(bRes.data || []);
      setServicesCatalog(sRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (e) {
      console.warn("[ServiceRequests] Aux load error:", e);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchAuxiliaryData();
  }, []);

  // Handle Create Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    if (!newClientId || !newServiceId) {
      setCreateError("Client and Service selection are required.");
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError("");

    try {
      const trackingCode = `SR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // Derive initial requirements checklist from catalog if present
      const selectedService = servicesCatalog.find((s) => s.id === newServiceId);
      let initialChecklist: any[] = [];
      if (selectedService?.requirements && Array.isArray(selectedService.requirements)) {
        initialChecklist = selectedService.requirements.map((r: any) => ({
          title: typeof r === "string" ? r : r.title || "Required item",
          completed: false,
        }));
      }

      const insertPayload: any = {
        tracking_code: trackingCode,
        client_id: newClientId,
        business_id: newBusinessId || null,
        service_id: newServiceId,
        priority: newPriority,
        status: "pending_review",
        progress_percent: 0,
        requirements_checklist: initialChecklist,
        target_completion_date: newTargetDate || null,
        assigned_staff_id: newAssignedStaffId || null,
        notes: newNotes.trim() || null,
      };

      const { data: createdReq, error: insertErr } = await supabase
        .from("service_requests")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Log to Activity Timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "service_request",
        entity_id: createdReq.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "service_request_created",
        event_title: `New Service Request: ${trackingCode} (${selectedService?.name || "Service"})`,
      });

      setIsCreating(false);
      setNewClientId("");
      setNewBusinessId("");
      setNewServiceId("");
      setNewPriority("normal");
      setNewAssignedStaffId("");
      setNewTargetDate("");
      setNewNotes("");

      await fetchRequests();
      setSelectedReq(createdReq);
    } catch (err: any) {
      console.error("[ServiceRequests] Create error:", err);
      setCreateError(err?.message || "Failed to create service request.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Quick Status Transition
  const handleUpdateStatus = async (nextStatus: ServiceRequestRecord["status"]) => {
    if (!supabase || !selectedReq || !canEdit) return;
    setIsUpdatingStatus(true);

    try {
      const updateData: any = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
        updateData.progress_percent = 100;
      } else if (nextStatus === "in_progress" && selectedReq.progress_percent === 0) {
        updateData.progress_percent = 25;
      }

      const { error } = await supabase
        .from("service_requests")
        .update(updateData)
        .eq("id", selectedReq.id);

      if (error) throw error;

      await supabase.from("activity_timeline").insert({
        entity_type: "service_request",
        entity_id: selectedReq.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "service_request_status_updated",
        event_title: `Status updated to ${nextStatus.replace(/_/g, " ")}: ${selectedReq.tracking_code}`,
      });

      await fetchRequests();
    } catch (err: any) {
      alert("Status update failed: " + err?.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Progress Percentage Change
  const handleUpdateProgress = async (newPercent: number) => {
    if (!supabase || !selectedReq || !canEdit) return;

    try {
      await supabase
        .from("service_requests")
        .update({ progress_percent: newPercent, updated_at: new Date().toISOString() })
        .eq("id", selectedReq.id);

      setSelectedReq((prev) => (prev ? { ...prev, progress_percent: newPercent } : null));
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedReq.id ? { ...r, progress_percent: newPercent } : r))
      );
    } catch (e) {
      console.error("[ServiceRequests] Progress update error:", e);
    }
  };

  // Handle Checklist Item Toggle
  const handleToggleChecklist = async (index: number) => {
    if (!supabase || !selectedReq || !canEdit) return;
    const currentList = Array.isArray(selectedReq.requirements_checklist)
      ? [...selectedReq.requirements_checklist]
      : [];

    if (!currentList[index]) return;
    currentList[index] = {
      ...currentList[index],
      completed: !currentList[index].completed,
    };

    try {
      await supabase
        .from("service_requests")
        .update({ requirements_checklist: currentList, updated_at: new Date().toISOString() })
        .eq("id", selectedReq.id);

      setSelectedReq((prev) => (prev ? { ...prev, requirements_checklist: currentList } : null));
    } catch (e) {
      console.error("[ServiceRequests] Checklist toggle error:", e);
    }
  };

  // Add Item to Checklist
  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedReq || !canEdit || !newChecklistText.trim()) return;

    const currentList = Array.isArray(selectedReq.requirements_checklist)
      ? [...selectedReq.requirements_checklist]
      : [];

    const updatedList = [...currentList, { title: newChecklistText.trim(), completed: false }];

    try {
      await supabase
        .from("service_requests")
        .update({ requirements_checklist: updatedList, updated_at: new Date().toISOString() })
        .eq("id", selectedReq.id);

      setNewChecklistText("");
      setSelectedReq((prev) => (prev ? { ...prev, requirements_checklist: updatedList } : null));
    } catch (e) {
      console.error("[ServiceRequests] Add checklist item error:", e);
    }
  };

  // Reassign Staff
  const handleReassignStaff = async (staffId: string) => {
    if (!supabase || !selectedReq || !canEdit) return;

    try {
      await supabase
        .from("service_requests")
        .update({ assigned_staff_id: staffId || null, updated_at: new Date().toISOString() })
        .eq("id", selectedReq.id);

      await fetchRequests();
    } catch (e) {
      console.error("[ServiceRequests] Reassign error:", e);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const title = r.service?.name || r.notes || "";
    const matchesSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Service Requests</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Operations Hub
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Central operational lifecycle linking clients, businesses, filing tasks, quotations, and documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            <span>{requests.length} Operational Engagements</span>
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
              <span>New Service Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Directory (5 cols) & Workbench (7 cols) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Requests Directory */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by tracking code, client, service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">All Statuses</option>
              {SR_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {/* Cards List */}
          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                No service requests found.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isSelected = selectedReq?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReq(req)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition ${
                      isSelected
                        ? "border-[#0A2558] bg-blue-50/70 shadow-xs ring-1 ring-[#0A2558]/30"
                        : "border-slate-200 bg-white hover:border-blue-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {req.tracking_code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                          {req.service?.name || "Service Engagement"}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Client: {req.client?.full_name} {req.business?.name ? `(${req.business.name})` : ""}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                          req.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : req.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : req.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {req.status.replace(/_/g, " ")}
                        </span>
                        <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                          req.priority === "urgent"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : req.priority === "high"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {req.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Request Details & Workbench */}
        <div className="lg:col-span-7">
          {!selectedReq ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-xs text-slate-400">
              Select a service request to inspect lifecycle details.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Header */}
              <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {selectedReq.tracking_code}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      {selectedReq.service?.name || "Service Engagement"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Client: <strong>{selectedReq.client?.full_name}</strong> ({selectedReq.client?.phone})
                      {selectedReq.business?.name ? ` • Business: ${selectedReq.business.name}` : ""}
                    </p>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                    selectedReq.status === "completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedReq.status === "in_progress"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    {selectedReq.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Status Lifecycle Transition Buttons */}
                {canEdit && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Update Status</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SR_STATUSES.map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st as any)}
                          disabled={isUpdatingStatus || selectedReq.status === st}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                            selectedReq.status === st
                              ? "bg-[#0A2558] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          } disabled:opacity-50`}
                        >
                          {st.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Workbench Body */}
              <div className="p-5 space-y-5 text-xs text-slate-700">
                {/* Progress Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">Execution Progress</span>
                    <span className="font-bold text-blue-700">{selectedReq.progress_percent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={!canEdit}
                    value={selectedReq.progress_percent}
                    onChange={(e) => handleUpdateProgress(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0A2558]"
                  />
                </div>

                {/* Assignment & Target Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Assigned Staff</span>
                    {canEdit ? (
                      <select
                        value={selectedReq.assigned_staff_id || ""}
                        onChange={(e) => handleReassignStaff(e.target.value)}
                        className="mt-1 w-full bg-transparent font-bold text-slate-900 outline-none"
                      >
                        <option value="">Unassigned</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>{st.full_name} ({st.role.replace(/_/g, " ")})</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-bold text-slate-900 mt-1">
                        {selectedReq.assigned_staff?.full_name || "Unassigned"}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Target Completion</span>
                    <p className="font-bold text-slate-900 mt-1">
                      {selectedReq.target_completion_date
                        ? new Date(selectedReq.target_completion_date).toLocaleDateString()
                        : "Not specified"}
                    </p>
                  </div>
                </div>

                {/* Quick Operational Actions */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Operational Links</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      to="/admin/cac-operations"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2558] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#061738] shadow-xs"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>CAC Filings Hub</span>
                    </Link>

                    <Link
                      to="/admin/quotations"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-50 shadow-xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Prepare Quotation</span>
                    </Link>
                  </div>
                </div>

                {/* Requirements Checklist */}
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Requirements & Deliverables Checklist</h4>
                  {(!selectedReq.requirements_checklist || selectedReq.requirements_checklist.length === 0) ? (
                    <p className="text-slate-400 italic">No checklist items defined.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedReq.requirements_checklist.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => canEdit && handleToggleChecklist(idx)}
                          className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition ${
                            canEdit ? "cursor-pointer hover:bg-slate-50" : ""
                          } ${item.completed ? "border-emerald-200 bg-emerald-50/50 text-emerald-900" : "border-slate-200"}`}
                        >
                          {item.completed ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span className={`text-xs ${item.completed ? "line-through text-slate-400" : "font-medium text-slate-800"}`}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {canEdit && (
                    <form onSubmit={handleAddChecklistItem} className="mt-2.5 flex gap-2">
                      <input
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Add required document or action item..."
                        className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Add
                      </button>
                    </form>
                  )}
                </div>

                {/* Notes History */}
                {selectedReq.notes && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Engagement Notes</h4>
                    <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      {selectedReq.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE SERVICE REQUEST MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Initiate Service Request</h2>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="mt-4 space-y-3.5 text-xs">
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
                <label className="font-semibold text-slate-700">Service from Catalogue *</label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-semibold"
                >
                  <option value="">Select Service...</option>
                  {servicesCatalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Target Completion Date</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Assigned Staff</label>
                <select
                  value={newAssignedStaffId}
                  onChange={(e) => setNewAssignedStaffId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>{st.full_name} ({st.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Initial Engagement Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Specific requirements or client requests..."
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
                  {isSubmittingCreate ? "Initiating..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
