import { useEffect, useState } from "react";
import {
  MessageSquare,
  Search,
  Plus,
  Phone,
  Mail,
  Users,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export type CommChannel = "whatsapp" | "phone_call" | "email" | "in_person" | "sms";
export type CommDirection = "inbound" | "outbound";

export interface CommunicationRecord {
  id: string;
  client_id: string;
  service_request_id?: string | null;
  staff_id: string;
  channel: CommChannel;
  direction: CommDirection;
  summary: string;
  details?: string | null;
  created_at: string;
  // Joins
  client?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
  } | null;
  staff?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  service_request?: {
    id: string;
    tracking_code: string;
  } | null;
}

export function ClientCommunicationsPage() {
  const { profile, hasPermission } = useAuth();
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; full_name: string; phone: string; email?: string | null }>>([]);
  const [serviceRequests, setServiceRequests] = useState<Array<{ id: string; tracking_code: string; client_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");

  // Modal State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    client_id: "",
    service_request_id: "",
    channel: "whatsapp" as CommChannel,
    direction: "outbound" as CommDirection,
    summary: "",
    details: "",
  });

  const canCreate = hasPermission("crm", "create");

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [commRes, clientRes, srRes] = await Promise.all([
        supabase
          .from("communications")
          .select(
            `
            id,
            client_id,
            service_request_id,
            staff_id,
            channel,
            direction,
            summary,
            details,
            created_at,
            client:clients(id, full_name, phone, email),
            staff:staff_profiles(id, full_name, email),
            service_request:service_requests(id, tracking_code)
          `
          )
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, full_name, phone, email").order("full_name", { ascending: true }),
        supabase.from("service_requests").select("id, tracking_code, client_id").order("created_at", { ascending: false }),
      ]);

      if (commRes.data) {
        setCommunications(commRes.data as unknown as CommunicationRecord[]);
      }
      if (clientRes.data) {
        setClients(clientRes.data);
      }
      if (srRes.data) {
        setServiceRequests(srRes.data);
      }
    } catch (err) {
      console.error("[Communications] Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate || !profile?.id) return;

    if (!formData.client_id) {
      setFormError("Please select a client.");
      return;
    }
    if (!formData.summary.trim()) {
      setFormError("Communication summary is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const { data, error } = await supabase
        .from("communications")
        .insert({
          client_id: formData.client_id,
          service_request_id: formData.service_request_id || null,
          staff_id: profile.id,
          channel: formData.channel,
          direction: formData.direction,
          summary: formData.summary.trim(),
          details: formData.details.trim() || null,
        })
        .select()
        .single();

      if (error) {
        setFormError(error.message);
      } else if (data) {
        // Also log event to activity_timeline
        await supabase.from("activity_timeline").insert({
          entity_type: "client",
          entity_id: formData.client_id,
          actor_type: "staff",
          actor_id: profile.id,
          event_type: "communication_logged",
          event_title: `Communication logged via ${formData.channel.replace(/_/g, " ")} (${formData.direction})`,
        });

        setIsLogOpen(false);
        setFormData({
          client_id: "",
          service_request_id: "",
          channel: "whatsapp",
          direction: "outbound",
          summary: "",
          details: "",
        });
        await fetchData();
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to log communication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCommunications = communications.filter((comm) => {
    const matchesSearch =
      comm.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.details && comm.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (comm.client?.full_name && comm.client.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (comm.client?.phone && comm.client.phone.includes(searchQuery)) ||
      (comm.staff?.full_name && comm.staff.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesChannel = channelFilter === "all" || comm.channel === channelFilter;
    const matchesDirection = directionFilter === "all" || comm.direction === directionFilter;

    return matchesSearch && matchesChannel && matchesDirection;
  });

  const getChannelBadge = (channel: CommChannel) => {
    switch (channel) {
      case "whatsapp":
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">WhatsApp</span>;
      case "phone_call":
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Phone Call</span>;
      case "email":
        return <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Email</span>;
      case "in_person":
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">In-Person</span>;
      case "sms":
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800">SMS</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 capitalize">{channel}</span>;
    }
  };

  const relevantServiceRequests = formData.client_id
    ? serviceRequests.filter((sr) => sr.client_id === formData.client_id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client Communications</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              CRM Communications
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Log and review interactions across WhatsApp, phone calls, email, and meetings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsLogOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#043F2E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#06553F] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Log Communication</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500">Total Interactions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{communications.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500">Outbound Messages</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {communications.filter((c) => c.direction === "outbound").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500">Inbound Inquiries</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {communications.filter((c) => c.direction === "inbound").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500">WhatsApp Records</p>
          <p className="mt-1 text-2xl font-bold text-purple-700">
            {communications.filter((c) => c.channel === "whatsapp").length}
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search communications by client, staff, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone_call">Phone Call</option>
            <option value="email">Email</option>
            <option value="in_person">In-Person</option>
            <option value="sms">SMS</option>
          </select>

          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
          >
            <option value="all">All Directions</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
      </div>

      {/* Communication Records Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading communications log...</div>
      ) : filteredCommunications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No communications found</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Logged client messages and touchpoints will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Client</th>
                <th className="px-4 py-3.5">Channel / Direction</th>
                <th className="px-4 py-3.5">Summary</th>
                <th className="px-4 py-3.5">Linked Request</th>
                <th className="px-4 py-3.5">Staff Officer</th>
                <th className="px-4 py-3.5 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCommunications.map((comm) => (
                <tr key={comm.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    <div>
                      <span className="font-semibold">{comm.client?.full_name || "Unknown Client"}</span>
                      {comm.client?.phone && (
                        <p className="text-[11px] text-slate-400">{comm.client.phone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {getChannelBadge(comm.channel)}
                      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        comm.direction === "outbound" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {comm.direction === "outbound" ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                        {comm.direction}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 max-w-sm">
                    <p className="font-medium text-slate-900">{comm.summary}</p>
                    {comm.details && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{comm.details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {comm.service_request?.tracking_code ? (
                      <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {comm.service_request.tracking_code}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    <span className="text-xs">{comm.staff?.full_name || "System"}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(comm.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Communication Modal */}
      {isLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Log Client Communication</h2>
              <button
                onClick={() => setIsLogOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCommunication} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Client *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value, service_request_id: "" })}
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Channel *</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as CommChannel })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="in_person">In-Person</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Direction *</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as CommDirection })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="outbound">Outbound (Sent to client)</option>
                    <option value="inbound">Inbound (Received from client)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Related Service Request (Optional)</label>
                <select
                  value={formData.service_request_id}
                  onChange={(e) => setFormData({ ...formData, service_request_id: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                >
                  <option value="">None / General Inquiry</option>
                  {relevantServiceRequests.map((sr) => (
                    <option key={sr.id} value={sr.id}>
                      {sr.tracking_code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Subject / Summary *</label>
                <input
                  type="text"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="e.g. Sent CAC document requirements checklist"
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Detailed Notes / Conversation Record</label>
                <textarea
                  rows={3}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Key points discussed, client confirmations, next steps..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
