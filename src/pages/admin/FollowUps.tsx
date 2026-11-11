import { useEffect, useState, useMemo } from "react";
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Users,
  Mail,
  RotateCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  UserCheck,
  X,
  FileCheck2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  createFollowUp,
  FOLLOW_UP_OUTCOMES,
  FollowUpChannel,
  FollowUpOutcome,
  recordFollowUpOutcome,
} from "../../lib/followUps/followUpService";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../../lib/communications/emailConfig";

export interface FollowUpRecord {
  id: string;
  client_id?: string | null;
  lead_id?: string | null;
  service_request_id?: string | null;
  business_id?: string | null;
  assigned_staff_id: string;
  scheduled_at: string;
  type: string;
  channel?: FollowUpChannel;
  status: string;
  outcome?: FollowUpOutcome | string | null;
  outcome_notes?: string | null;
  priority?: string;
  created_at: string;
  updated_at?: string;
  client?: { full_name: string; phone: string; email?: string };
  lead?: { name: string; phone: string; email?: string; business_type?: string };
  assigned_staff?: { full_name: string; role?: string };
  service_request?: { tracking_code: string };
}

export function FollowUpsPage() {
  const { profile, hasPermission } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: due_today, upcoming, overdue, waiting_response, completed
  const [activeTab, setActiveTab] = useState<"due_today" | "upcoming" | "overdue" | "waiting_response" | "completed">("due_today");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  // Schedule Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetType, setTargetType] = useState<"client" | "lead">("client");
  const [formData, setFormData] = useState({
    targetId: "",
    scheduled_at: new Date().toISOString().split("T")[0] + "T10:00",
    type: "consultation_call",
    channel: "phone_call" as FollowUpChannel,
    assigned_staff_id: "",
    priority: "normal" as any,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Record Outcome Modal
  const [recordingFollowUp, setRecordingFollowUp] = useState<FollowUpRecord | null>(null);
  const [outcomeData, setOutcomeData] = useState<{
    outcome: FollowUpOutcome;
    notes: string;
    nextDate: string;
    nextChannel: FollowUpChannel;
    nextNotes: string;
  }>({
    outcome: "client_contacted",
    notes: "",
    nextDate: "",
    nextChannel: "phone_call",
    nextNotes: "",
  });
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);

  const canCreate = hasPermission("crm", "create");
  const canEdit = hasPermission("crm", "edit");
  const isManager =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager";

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [fuRes, clientsRes, leadsRes, staffRes, srvRes] = await Promise.all([
        supabase
          .from("follow_ups")
          .select(`
            *,
            client:clients(full_name, phone, email),
            lead:leads(name, phone, email, business_type),
            assigned_staff:staff_profiles(full_name, role),
            service_request:service_requests(tracking_code)
          `)
          .order("scheduled_at", { ascending: true }),
        supabase.from("clients").select("id, full_name, phone, email").eq("is_active", true).order("full_name"),
        supabase.from("leads").select("id, name, phone, email, business_type").order("created_at", { ascending: false }),
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true),
        supabase.from("services_catalog").select("id, name").order("name"),
      ]);

      if (fuRes.data) setFollowUps(fuRes.data as any[]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (staffRes.data) setStaffList(staffRes.data);
      if (srvRes.data) setServicesList(srvRes.data);
    } catch (err) {
      console.error("[FollowUps] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setIsSubmitting(true);

    try {
      await createFollowUp({
        clientId: targetType === "client" ? formData.targetId : null,
        leadId: targetType === "lead" ? formData.targetId : null,
        assignedStaffId: formData.assigned_staff_id || profile?.id || "",
        scheduledAt: new Date(formData.scheduled_at).toISOString(),
        type: formData.type,
        channel: formData.channel,
        notes: formData.notes,
        priority: formData.priority,
        actorStaffId: profile?.id,
      });

      setIsCreateOpen(false);
      setFormData({
        targetId: "",
        scheduled_at: new Date().toISOString().split("T")[0] + "T10:00",
        type: "consultation_call",
        channel: "phone_call",
        assigned_staff_id: "",
        priority: "normal",
        notes: "",
      });
      await fetchData();
    } catch (err: any) {
      alert("Failed to schedule follow-up: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingFollowUp || !canEdit) return;
    setIsSubmittingOutcome(true);

    try {
      await recordFollowUpOutcome({
        followUpId: recordingFollowUp.id,
        outcome: outcomeData.outcome,
        outcomeNotes: outcomeData.notes,
        actorStaffId: profile?.id,
        nextFollowUpDate: outcomeData.nextDate ? new Date(outcomeData.nextDate).toISOString() : null,
        nextFollowUpChannel: outcomeData.nextChannel,
        nextFollowUpNotes: outcomeData.nextNotes,
      });

      setRecordingFollowUp(null);
      setOutcomeData({
        outcome: "client_contacted",
        notes: "",
        nextDate: "",
        nextChannel: "phone_call",
        nextNotes: "",
      });
      await fetchData();
    } catch (err: any) {
      alert("Failed to record outcome: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmittingOutcome(false);
    }
  };

  // Tab Filtering
  const tabFilteredFollowUps = useMemo(() => {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const now = new Date();

    return followUps.filter((f) => {
      const scheduledYmd = f.scheduled_at ? f.scheduled_at.slice(0, 10) : "";
      const isPending = f.status === "pending" || !f.status;
      const isCompleted = f.status === "completed";

      switch (activeTab) {
        case "due_today":
          return isPending && scheduledYmd === todayYmd;
        case "upcoming":
          return isPending && scheduledYmd > todayYmd;
        case "overdue":
          return isPending && f.scheduled_at && new Date(f.scheduled_at) < now && scheduledYmd !== todayYmd;
        case "waiting_response":
          return f.outcome === "awaiting_response" || (isPending && f.type === "document_request");
        case "completed":
          return isCompleted;
        default:
          return true;
      }
    });
  }, [followUps, activeTab]);

  // Secondary Filters
  const filteredList = useMemo(() => {
    return tabFilteredFollowUps.filter((f) => {
      const clientName = f.client?.full_name || f.lead?.name || "";
      const phone = f.client?.phone || f.lead?.phone || "";
      const matchesSearch =
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm) ||
        (f.assigned_staff?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStaff = staffFilter === "all" || f.assigned_staff_id === staffFilter;
      const matchesChannel = channelFilter === "all" || f.channel === channelFilter;
      const matchesOutcome = outcomeFilter === "all" || f.outcome === outcomeFilter;

      return matchesSearch && matchesStaff && matchesChannel && matchesOutcome;
    });
  }, [tabFilteredFollowUps, searchTerm, staffFilter, channelFilter, outcomeFilter]);

  const getChannelIcon = (ch?: FollowUpChannel) => {
    switch (ch) {
      case "whatsapp":
        return <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">WhatsApp</span>;
      case "phone_call":
        return <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px]">Phone Call</span>;
      case "email":
        return <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[10px]">Official Email</span>;
      case "in_person":
        return <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px]">Office Meeting</span>;
      default:
        return <span className="text-[10px] text-slate-500">Phone</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client Follow-Up & Relationships</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              CRM Engagement
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Timely communication tracking, lead conversion callbacks, document request reminders, and post-service appreciation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Follow-Up</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px text-xs font-bold">
        <button
          onClick={() => setActiveTab("due_today")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === "due_today"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Due Today</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px]">
            {
              followUps.filter(
                (f) =>
                  f.status === "pending" &&
                  f.scheduled_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === "upcoming"
              ? "border-[#0A2558] text-[#0A2558]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Upcoming Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab("overdue")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === "overdue"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>Overdue Follow-Ups</span>
          <span className="rounded-full bg-rose-50 text-rose-700 px-1.5 py-0.2 text-[10px]">
            {
              followUps.filter(
                (f) =>
                  f.status === "pending" &&
                  new Date(f.scheduled_at) < new Date() &&
                  f.scheduled_at?.slice(0, 10) !== new Date().toISOString().slice(0, 10)
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab("waiting_response")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === "waiting_response"
              ? "border-amber-600 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <MessageSquare className="h-4 w-4 text-amber-600" />
          <span>Waiting for Client Response</span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === "completed"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Recently Completed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client or lead name, phone number, staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0A2558] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />

          {isManager && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Assigned Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="phone_call">Phone Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Official Email</option>
            <option value="in_person">Office Meeting</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Recorded Outcomes</option>
            {FOLLOW_UP_OUTCOMES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
          <RotateCw className="h-5 w-5 animate-spin mr-2" />
          Loading follow-up schedule...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white">
          <CheckSquare className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-2 text-sm font-bold text-slate-900">No follow-ups in this queue</h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeTab === "overdue"
              ? "All follow-up callbacks are up to date! Great work."
              : "No follow-up records found matching your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredList.map((fu) => {
            const isClient = Boolean(fu.client_id);
            const targetName = fu.client?.full_name || fu.lead?.name || "Prospect";
            const targetPhone = fu.client?.phone || fu.lead?.phone || "";
            const targetEmail = fu.client?.email || fu.lead?.email || "";
            const isOverdue =
              fu.status === "pending" &&
              new Date(fu.scheduled_at) < new Date() &&
              fu.scheduled_at?.slice(0, 10) !== new Date().toISOString().slice(0, 10);

            // WhatsApp link builder
            const cleanPhone = targetPhone.replace(/\D/g, "");
            const intlPhone = cleanPhone.startsWith("0") ? "234" + cleanPhone.slice(1) : cleanPhone;
            const waText = encodeURIComponent(
              `Hello ${targetName},\n\nThis is ${profile?.full_name || "ABLEBIZ"} from ABLEBIZ BUSINESS SERVICES.\nRegarding your inquiry / service, we would like to provide an update and assist with your requirements.`
            );
            const waUrl = intlPhone ? `https://wa.me/${intlPhone}?text=${waText}` : null;

            return (
              <div
                key={fu.id}
                className={`rounded-2xl border p-4.5 transition bg-white ${
                  isOverdue ? "border-rose-200 bg-rose-50/10" : "border-slate-200 hover:border-[#0A2558]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {isClient ? "Client" : "Inbound Lead"}
                      </span>
                      {getChannelIcon(fu.channel)}
                      {fu.priority === "high" && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          High Priority
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                          Deadline Missed
                        </span>
                      )}
                      {fu.status === "completed" && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Completed
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{targetName}</h3>

                    {fu.outcome_notes && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {fu.outcome_notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500">
                      {targetPhone && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {targetPhone}
                        </span>
                      )}

                      {targetEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {targetEmail}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        Assigned: <strong>{fu.assigned_staff?.full_name || "Unassigned"}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions & Schedule Column */}
                  <div className="flex flex-col sm:items-end justify-between gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-xs font-bold text-[#0A2558]">
                      {new Date(fu.scheduled_at).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* One-click WhatsApp */}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                          title="Open WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      {/* Phone dialer */}
                      {targetPhone && (
                        <a
                          href={`tel:${targetPhone}`}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                          title="Call Client"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>Call</span>
                        </a>
                      )}

                      {/* Record outcome button */}
                      {canEdit && fu.status !== "completed" && (
                        <button
                          onClick={() => {
                            setRecordingFollowUp(fu);
                            setOutcomeData({
                              outcome: "client_contacted",
                              notes: "",
                              nextDate: "",
                              nextChannel: fu.channel || "phone_call",
                              nextNotes: "",
                            });
                          }}
                          className="rounded-lg bg-[#0A2558] px-3 py-1 text-xs font-bold text-white hover:bg-[#061738] transition"
                        >
                          Record Outcome
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Outcome Modal */}
      {recordingFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Record Follow-Up Outcome</h2>
                <p className="text-xs text-slate-500">
                  {recordingFollowUp.client?.full_name || recordingFollowUp.lead?.name || "Client"}
                </p>
              </div>
              <button onClick={() => setRecordingFollowUp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOutcome} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Follow-Up Outcome *</label>
                <select
                  value={outcomeData.outcome}
                  onChange={(e) => setOutcomeData({ ...outcomeData, outcome: e.target.value as FollowUpOutcome })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                >
                  {FOLLOW_UP_OUTCOMES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} — {o.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Discussion Notes / Client Feedback</label>
                <textarea
                  rows={2}
                  placeholder="Record summary of conversation, client responses, or agreed terms..."
                  value={outcomeData.notes}
                  onChange={(e) => setOutcomeData({ ...outcomeData, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              {/* Conditional Next Follow-Up Schedule */}
              {FOLLOW_UP_OUTCOMES.find((o) => o.id === outcomeData.outcome)?.requiresNextFollowUp && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-3">
                  <span className="font-bold text-[#0A2558] text-[11px] block">
                    Schedule Next Required Follow-Up
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700">Next Date & Time</label>
                      <input
                        type="datetime-local"
                        value={outcomeData.nextDate}
                        onChange={(e) => setOutcomeData({ ...outcomeData, nextDate: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700">Preferred Channel</label>
                      <select
                        value={outcomeData.nextChannel}
                        onChange={(e) => setOutcomeData({ ...outcomeData, nextChannel: e.target.value as FollowUpChannel })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                      >
                        <option value="phone_call">Phone Call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Official Email</option>
                        <option value="in_person">Office Meeting</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRecordingFollowUp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOutcome}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmittingOutcome ? "Saving..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-Up Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Schedule Client Follow-Up</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="mt-4 space-y-3.5 text-xs">
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("client");
                    setFormData({ ...formData, targetId: "" });
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    targetType === "client" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                  }`}
                >
                  Existing Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("lead");
                    setFormData({ ...formData, targetId: "" });
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    targetType === "lead" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                  }`}
                >
                  Prospective Lead
                </button>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  {targetType === "client" ? "Select Client *" : "Select Prospective Lead *"}
                </label>
                <select
                  required
                  value={formData.targetId}
                  onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                >
                  <option value="">Select...</option>
                  {targetType === "client"
                    ? clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.phone || "No phone"})
                        </option>
                      ))
                    : leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.phone || "No phone"}) — {l.business_type || "Lead"}
                        </option>
                      ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Channel *</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as FollowUpChannel })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Official Email</option>
                    <option value="in_person">Office Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Purpose</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="consultation_call">Consultation Call</option>
                    <option value="document_request">Request Missing Documents</option>
                    <option value="invoice_reminder">Payment / Invoice Follow-Up</option>
                    <option value="post_service_feedback">Post-Service Feedback</option>
                    <option value="referral_checkin">Referral Check-In</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Scheduled Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assigned Officer</label>
                  <select
                    value={formData.assigned_staff_id}
                    onChange={(e) => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                  >
                    <option value="">Assigned to Me ({profile?.full_name})</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Notes / Talking Points</label>
                <textarea
                  rows={2}
                  placeholder="Notes, discussion agenda, or questions to ask..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-[#0A2558] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
