import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileCheck2,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  History,
  FileText,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface ClientRecord {
  id: string;
  full_name: string;
  email?: string | null;
  phone: string;
  alt_phone?: string | null;
  state?: string | null;
  address?: string | null;
  acquisition_source?: string | null;
  referral_code?: string | null;
  referred_by_code?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDetailData extends ClientRecord {
  businesses: any[];
  service_requests: any[];
  follow_ups: any[];
  communications: any[];
  activity_timeline: any[];
  invoices?: any[];
}

export function AdminClients() {
  const { user, profile, hasPermission } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Selection & 360° View
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [active360Tab, setActive360Tab] = useState<"overview" | "businesses" | "requests" | "followups" | "timeline" | "finance">("overview");

  // Create Client Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    alt_phone: "",
    address: "",
    state: "Ogun",
    acquisition_source: "direct",
    notes: "",
  });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canCreate = hasPermission("crm", "create");
  const canEdit = hasPermission("crm", "edit");
  const canViewFinance = hasPermission("finance", "view");

  const fetchClients = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Clients] Fetch error:", error.message);
      } else if (data) {
        setClients(data as ClientRecord[]);
        if (!selectedClientId && data.length > 0) {
          setSelectedClientId(data[0].id);
        }
      }
    } catch (err) {
      console.error("[Clients] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClient360 = async (clientId: string) => {
    if (!supabase) return;
    setLoadingDetail(true);
    try {
      const [
        clientRes,
        bizRes,
        srRes,
        fuRes,
        commRes,
        actRes,
        invRes,
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("businesses").select("*").eq("client_id", clientId),
        supabase.from("service_requests").select("*, service:services_catalog(name)").eq("client_id", clientId),
        supabase.from("follow_ups").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: false }),
        supabase.from("communications").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("activity_timeline").select("*").eq("entity_id", clientId).order("created_at", { ascending: false }),
        canViewFinance ? supabase.from("invoices").select("*").eq("client_id", clientId) : Promise.resolve({ data: [] }),
      ]);

      if (clientRes.data) {
        setClientDetail({
          ...clientRes.data,
          businesses: bizRes.data || [],
          service_requests: srRes.data || [],
          follow_ups: fuRes.data || [],
          communications: commRes.data || [],
          activity_timeline: actRes.data || [],
          invoices: invRes.data || [],
        });
      }
    } catch (err) {
      console.error("[Client 360] Detail fetch error:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchClient360(selectedClientId);
    }
  }, [selectedClientId]);

  // Duplicate Check
  const checkDuplicates = (email: string, phone: string) => {
    const cleanPhone = phone.trim().replace(/\D/g, "");
    const cleanEmail = email.trim().toLowerCase();

    const matched = clients.find(
      (c) =>
        (cleanEmail && c.email?.toLowerCase() === cleanEmail) ||
        (cleanPhone && c.phone.replace(/\D/g, "") === cleanPhone)
    );

    if (matched) {
      setDuplicateWarning(`Potential duplicate detected: ${matched.full_name} (${matched.phone}) is already in the database.`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    setFormError("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          full_name: formData.full_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim(),
          alt_phone: formData.alt_phone.trim() || null,
          address: formData.address.trim() || null,
          state: formData.state.trim() || "Ogun",
          acquisition_source: formData.acquisition_source,
          notes: formData.notes.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        setFormError(error.message);
      } else if (data) {
        // Also log to Activity Timeline
        await supabase.from("activity_timeline").insert({
          entity_type: "client",
          entity_id: data.id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "client_created",
          event_title: `Client created: ${data.full_name}`,
        });

        setIsCreateOpen(false);
        setFormData({
          full_name: "",
          email: "",
          phone: "",
          alt_phone: "",
          address: "",
          state: "Ogun",
          acquisition_source: "direct",
          notes: "",
        });
        setDuplicateWarning(null);
        await fetchClients();
        setSelectedClientId(data.id);
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to create client record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSource = sourceFilter === "all" || c.acquisition_source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients 360°</h1>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-[#0A2558]">
              CRM Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Consolidated client profiles linking legal entities, statutory filings, documents, and communications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Client</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Directory on Left, 360° Profile on Right */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Client List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients by name, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">All Sources</option>
              <option value="direct">Direct</option>
              <option value="referral">Referral</option>
              <option value="consultation">Consultation</option>
              <option value="spin_win">Spin & Win</option>
            </select>
          </div>

          {/* List Cards */}
          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading clients...</div>
            ) : filteredClients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                No client records found.
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = selectedClientId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition ${
                      isSelected
                        ? "border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700/30"
                        : "border-slate-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{c.full_name}</h4>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3 text-emerald-600" />
                          <span>{c.phone}</span>
                        </div>
                      </div>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                        {c.acquisition_source || "direct"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Client 360° Workspace (7 cols) */}
        <div className="lg:col-span-7">
          {loadingDetail || !clientDetail ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-xs text-slate-400">
              Select a client to inspect complete 360° profile.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Profile Card Header */}
              <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A2558] text-white font-bold text-base shadow-xs">
                      {clientDetail.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{clientDetail.full_name}</h2>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-600" /> {clientDetail.phone}
                        </span>
                        {clientDetail.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-emerald-600" /> {clientDetail.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    clientDetail.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    {clientDetail.is_active ? "Active Client" : "Archived"}
                  </span>
                </div>

                {/* 360° Navigation Tabs */}
                <div className="mt-4 flex gap-1 border-t border-slate-200 pt-3 overflow-x-auto">
                  {[
                    { id: "overview", label: "Overview", count: null },
                    { id: "businesses", label: "Businesses", count: clientDetail.businesses.length },
                    { id: "requests", label: "Service Requests", count: clientDetail.service_requests.length },
                    { id: "followups", label: "Follow-ups", count: clientDetail.follow_ups.length },
                    { id: "timeline", label: "Timeline", count: clientDetail.activity_timeline.length },
                    ...(canViewFinance ? [{ id: "finance", label: "Finance & Invoices", count: clientDetail.invoices?.length || 0 }] : []),
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActive360Tab(tab.id as any)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        active360Tab === tab.id
                          ? "bg-[#0A2558] text-white"
                          : "text-slate-600 hover:bg-slate-200/60"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                          active360Tab === tab.id ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Contents */}
              <div className="p-5">
                {active360Tab === "overview" && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">State & Address</span>
                        <p className="mt-1 font-medium text-slate-900">{clientDetail.state || "Ogun"}, Nigeria</p>
                        <p className="text-slate-500 mt-0.5">{clientDetail.address || "No address on file"}</p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Acquisition & Referral</span>
                        <p className="mt-1 font-medium text-slate-900 capitalize">{clientDetail.acquisition_source || "Direct"}</p>
                        <p className="text-slate-500 mt-0.5">Ref Code: {clientDetail.referral_code || "None"}</p>
                      </div>
                    </div>

                    {clientDetail.notes && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Internal Notes</span>
                        <p className="mt-1 text-slate-700 whitespace-pre-wrap">{clientDetail.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {active360Tab === "businesses" && (
                  <div className="space-y-3">
                    {clientDetail.businesses.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No businesses currently linked to this client.</p>
                    ) : (
                      clientDetail.businesses.map((biz) => (
                        <div key={biz.id} className="rounded-xl border border-slate-200 p-3.5 hover:border-emerald-500 transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-emerald-700" />
                              <h4 className="text-xs font-bold text-slate-900">{biz.name}</h4>
                            </div>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                              {biz.entity_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">RC / Reg No: {biz.registration_number || "Pending Registration"}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {active360Tab === "requests" && (
                  <div className="space-y-3">
                    {clientDetail.service_requests.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No service requests for this client yet.</p>
                    ) : (
                      clientDetail.service_requests.map((sr) => (
                        <div key={sr.id} className="rounded-xl border border-slate-200 p-3.5 hover:border-emerald-500 transition">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-slate-500">{sr.tracking_code || sr.tracking_id}</span>
                            <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-semibold capitalize">
                              {sr.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 mt-1">{sr.service?.name || "Service Request"}</p>
                          <p className="text-[11px] text-slate-500">{sr.notes || sr.service?.name}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {active360Tab === "followups" && (
                  <div className="space-y-3">
                    {clientDetail.follow_ups.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No follow-ups recorded for this client.</p>
                    ) : (
                      clientDetail.follow_ups.map((fu) => (
                        <div key={fu.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{fu.type.replace(/_/g, " ")}</span>
                            <span className={`text-[10px] font-bold uppercase ${fu.status === "completed" ? "text-emerald-700" : "text-amber-700"}`}>
                              {fu.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Scheduled: {new Date(fu.scheduled_at).toLocaleDateString()}</p>
                          {fu.outcome_notes && <p className="text-slate-600 mt-1 italic">"{fu.outcome_notes}"</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {active360Tab === "timeline" && (
                  <div className="space-y-3">
                    {clientDetail.activity_timeline.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No chronological events logged yet.</p>
                    ) : (
                      <div className="relative pl-4 border-l border-slate-200 space-y-4">
                        {clientDetail.activity_timeline.map((act) => (
                          <div key={act.id} className="relative text-xs">
                            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#0A2558]" />
                            <p className="font-semibold text-slate-900">{act.event_title}</p>
                            <span className="text-[10px] text-slate-400">{new Date(act.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {active360Tab === "finance" && (
                  <div className="space-y-3">
                    {!clientDetail.invoices || clientDetail.invoices.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No invoices or billing history for this client yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {clientDetail.invoices.map((inv: any) => (
                          <div key={inv.id} className="rounded-xl border border-slate-200 p-3 hover:border-emerald-500 transition text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {inv.status}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                              <span>Total: ₦{Number(inv.total_amount).toLocaleString()}</span>
                              <span className="font-semibold text-emerald-700">Paid: ₦{Number(inv.amount_paid).toLocaleString()}</span>
                              <span className="font-bold text-amber-700">Due: ₦{Number(inv.balance_due).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Client Modal with Duplicate Detection */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Register New Client</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {duplicateWarning && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Adebayo Olumide"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      checkDuplicates(formData.email, e.target.value);
                    }}
                    placeholder="08012345678"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      checkDuplicates(e.target.value, formData.phone);
                    }}
                    placeholder="client@gmail.com"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Acquisition Source</label>
                  <select
                    value={formData.acquisition_source}
                    onChange={(e) => setFormData({ ...formData, acquisition_source: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="direct">Direct Walk-in / Inbound</option>
                    <option value="referral">Client Referral</option>
                    <option value="consultation">Website Consultation</option>
                    <option value="spin_win">Spin & Win Lead</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Office / Physical Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Abeokuta, Ogun State"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Client requirements, business context..."
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
                  {isSubmitting ? "Creating..." : "Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
