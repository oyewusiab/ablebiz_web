import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  UserCheck,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Plus,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface LeadRecord {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  service_needed?: string | null;
  status: string;
  qualification_status: string;
  priority: string;
  assigned_staff_id?: string | null;
  converted_client_id?: string | null;
  created_at: string;
}

export function LeadsPipelinePage() {
  const { profile, hasPermission } = useAuth();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Conversion Modal State
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState("");

  const canEdit = hasPermission("crm", "edit");

  const fetchLeads = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [leadsRes, clientsRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, full_name, phone"),
      ]);

      if (leadsRes.data) setLeads(leadsRes.data as LeadRecord[]);
      if (clientsRes.data) setExistingClients(clientsRes.data);
    } catch (err) {
      console.error("[Leads] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Handle Lead Qualification Progression
  const updateQualification = async (leadId: string, nextStatus: string) => {
    if (!supabase || !canEdit) return;
    try {
      await supabase
        .from("leads")
        .update({ qualification_status: nextStatus })
        .eq("id", leadId);
      await fetchLeads();
    } catch (err) {
      console.error("[Leads] Status error:", err);
    }
  };

  // Execute Lead Conversion into Client (Preserves original lead record)
  const handleConvertLead = async () => {
    if (!supabase || !convertingLead) return;
    setIsConverting(true);
    setConvertError("");

    try {
      let targetClientId = selectedExistingId;

      // If creating fresh client
      if (!targetClientId) {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            full_name: convertingLead.name,
            phone: convertingLead.phone,
            email: convertingLead.email || null,
            acquisition_source: convertingLead.source || "inbound_lead",
            notes: `Converted from Lead ID ${convertingLead.id}. Interested in: ${convertingLead.service_needed || "General Inquiry"}`,
            is_active: true,
          })
          .select()
          .single();

        if (clientErr) throw clientErr;
        targetClientId = newClient.id;

        // Log client creation in timeline
        await supabase.from("activity_timeline").insert({
          entity_type: "client",
          entity_id: newClient.id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "lead_converted",
          event_title: `Lead converted to client: ${newClient.full_name}`,
        });
      }

      // Update lead record with converted link without deleting it
      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          converted_client_id: targetClientId,
          qualification_status: "converted",
          status: "converted",
        })
        .eq("id", convertingLead.id);

      if (leadErr) throw leadErr;

      setConvertingLead(null);
      setSelectedExistingId("");
      await fetchLeads();
    } catch (err: any) {
      setConvertError(err?.message || "Failed to convert lead.");
    } finally {
      setIsConverting(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStage = stageFilter === "all" || l.qualification_status === stageFilter;
    return matchesSearch && matchesStage;
  });

  const pipelineStages = ["all", "new", "contacted", "qualified", "converted", "lost"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads Pipeline</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Acquisition
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Inbound prospective clients from website consultation forms, WhatsApp clicks, and partner referrals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            <span>{leads.length} Inbound Prospects</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {pipelineStages.map((st) => (
            <button
              key={st}
              onClick={() => setStageFilter(st)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition whitespace-nowrap ${
                stageFilter === st
                  ? "bg-[#043F2E] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading leads pipeline...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No leads currently in this stage</p>
          <p className="text-[11px] text-slate-400 mt-1">Inbound consultations and requests populate this pipeline automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-500 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {lead.source || "Website Inbound"}
                  </span>
                  <span className={`rounded-full px-2 py-0.2 text-[10px] font-semibold capitalize ${
                    lead.qualification_status === "converted"
                      ? "bg-emerald-100 text-emerald-800"
                      : lead.qualification_status === "qualified"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    {lead.qualification_status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{lead.name}</h3>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-emerald-600" /> {lead.phone}
                  </p>
                  {lead.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-emerald-600" /> {lead.email}
                    </p>
                  )}
                  {lead.service_needed && (
                    <p className="text-[11px] text-slate-700 font-medium pt-1">
                      Service: {lead.service_needed}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {lead.qualification_status !== "converted" ? (
                  <>
                    <select
                      value={lead.qualification_status}
                      onChange={(e) => updateQualification(lead.id, e.target.value)}
                      className="h-7 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-700"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="lost">Lost</option>
                    </select>

                    <button
                      onClick={() => setConvertingLead(lead)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 transition"
                    >
                      <UserCheck className="h-3 w-3" />
                      Convert to Client
                    </button>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Converted to Client
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Convert Lead Modal */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Convert Lead to Client</h2>
            <p className="text-xs text-slate-500 mt-1">
              Converting <strong>{convertingLead.name}</strong> will create a client record and preserve the lead in the historical ledger.
            </p>

            {convertError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {convertError}
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Link to Existing Client (Optional)</label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="">-- Create new client from lead details --</option>
                  {existingClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              {!selectedExistingId && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-1 text-emerald-950">
                  <p><strong>Name:</strong> {convertingLead.name}</p>
                  <p><strong>Phone:</strong> {convertingLead.phone}</p>
                  <p><strong>Email:</strong> {convertingLead.email || "None"}</p>
                  <p><strong>Source:</strong> {convertingLead.source}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvertingLead(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertLead}
                disabled={isConverting}
                className="rounded-xl bg-[#043F2E] px-4 py-2 text-xs font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
              >
                {isConverting ? "Converting..." : "Confirm Conversion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
