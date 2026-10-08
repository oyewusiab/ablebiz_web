import { useEffect, useState } from "react";
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
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface FollowUpRecord {
  id: string;
  client_id?: string | null;
  lead_id?: string | null;
  assigned_staff_id: string;
  scheduled_at: string;
  type: string;
  status: string;
  outcome_notes?: string | null;
  created_at: string;
  client?: { full_name: string; phone: string };
  assigned_staff?: { full_name: string };
}

export function FollowUpsPage() {
  const { profile, hasPermission } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    scheduled_at: "",
    type: "consultation_call",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreate = hasPermission("crm", "create");
  const canEdit = hasPermission("crm", "edit");

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [fuRes, clientsRes] = await Promise.all([
        supabase
          .from("follow_ups")
          .select("*, client:clients(full_name, phone), assigned_staff:staff_profiles(full_name)")
          .order("scheduled_at", { ascending: true }),
        supabase.from("clients").select("id, full_name, phone").eq("is_active", true),
      ]);

      if (fuRes.data) setFollowUps(fuRes.data as any[]);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (err) {
      console.error("[FollowUps] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkComplete = async (id: string, notes?: string) => {
    if (!supabase || !canEdit) return;
    try {
      await supabase
        .from("follow_ups")
        .update({
          status: "completed",
          outcome_notes: notes || "Follow-up concluded successfully.",
        })
        .eq("id", id);
      await fetchData();
    } catch (err) {
      console.error("[FollowUps] Complete error:", err);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.from("follow_ups").insert({
        client_id: formData.client_id || null,
        assigned_staff_id: profile?.id,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        type: formData.type,
        status: "pending",
        outcome_notes: formData.notes || null,
      }).select().single();

      if (data && formData.client_id) {
        await supabase.from("activity_timeline").insert({
          entity_type: "client",
          entity_id: formData.client_id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "followup_scheduled",
          event_title: `Follow-up scheduled: ${formData.type.replace(/_/g, " ")}`,
        });
      }

      setIsCreateOpen(false);
      setFormData({
        client_id: "",
        scheduled_at: "",
        type: "consultation_call",
        notes: "",
      });
      await fetchData();
    } catch (err) {
      console.error("[FollowUps] Insert error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFollowUps = followUps.filter((fu) => {
    if (statusFilter === "all") return true;
    return fu.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client Follow-ups</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              CRM Communications
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Scheduled client check-ins, consultation calls, document chases, and compliance touchpoints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Follow-up</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["all", "pending", "completed", "rescheduled", "cancelled"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              statusFilter === st
                ? "bg-[#0A2558] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading scheduled follow-ups...</div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <CheckSquare className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No follow-ups recorded in this filter</p>
          <p className="text-[11px] text-slate-400 mt-1">Schedule phone calls or messaging check-ins to track outreach.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFollowUps.map((fu) => {
            const isOverdue = fu.status === "pending" && new Date(fu.scheduled_at) < new Date();
            return (
              <div key={fu.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-500 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {fu.type.replace(/_/g, " ")}
                    </span>
                    <span className={`rounded-full px-2 py-0.2 text-[10px] font-semibold capitalize ${
                      fu.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : isOverdue
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {isOverdue ? "Overdue" : fu.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{fu.client?.full_name || "General Touchpoint"}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-emerald-600" />
                    {new Date(fu.scheduled_at).toLocaleDateString()} at {new Date(fu.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {fu.outcome_notes && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 italic">
                      "{fu.outcome_notes}"
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Assigned: {fu.assigned_staff?.full_name || "Staff"}</span>
                  {fu.status === "pending" && canEdit && (
                    <button
                      onClick={() => handleMarkComplete(fu.id)}
                      className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 transition"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Schedule Follow-up</h2>
            <form onSubmit={handleCreateFollowUp} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Target Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="">-- General follow-up (unlinked) --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Channel / Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="consultation_call">Phone Call</option>
                    <option value="whatsapp_message">WhatsApp</option>
                    <option value="document_chase">Document Chase</option>
                    <option value="in_person_meeting">Office Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Objective / Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Purpose of this outreach..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] transition disabled:opacity-50"
                >
                  {isSubmitting ? "Scheduling..." : "Save Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
