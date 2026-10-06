import { useEffect, useState } from "react";
import {
  Building2,
  Search,
  Filter,
  Plus,
  Users,
  MapPin,
  Calendar,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface BusinessRecord {
  id: string;
  client_id: string;
  name: string;
  alternate_name?: string | null;
  entity_type: string;
  registration_number?: string | null;
  tax_identification_number?: string | null;
  annual_return_due_date?: string | null;
  registered_address?: string | null;
  status: string;
  created_at: string;
  client?: { full_name: string; phone: string; email: string };
}

export function BusinessesPage() {
  const { profile, hasPermission } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    name: "",
    alternate_name: "",
    entity_type: "business_name",
    registration_number: "",
    tax_identification_number: "",
    registered_address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canCreate = hasPermission("crm", "create");

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [bizRes, clientsRes] = await Promise.all([
        supabase
          .from("businesses")
          .select("*, client:clients(full_name, phone, email)")
          .order("name", { ascending: true }),
        supabase.from("clients").select("id, full_name").eq("is_active", true),
      ]);

      if (bizRes.data) setBusinesses(bizRes.data as any[]);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (err) {
      console.error("[Businesses] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    setFormError("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          client_id: formData.client_id,
          name: formData.name.trim(),
          alternate_name: formData.alternate_name.trim() || null,
          entity_type: formData.entity_type,
          registration_number: formData.registration_number.trim() || null,
          tax_identification_number: formData.tax_identification_number.trim() || null,
          registered_address: formData.registered_address.trim() || null,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        setFormError(error.message);
      } else if (data) {
        await supabase.from("activity_timeline").insert({
          entity_type: "business",
          entity_id: data.id,
          actor_type: "staff",
          actor_id: profile?.id,
          event_type: "business_created",
          event_title: `Business registered: ${data.name}`,
        });

        setIsCreateOpen(false);
        setFormData({
          client_id: "",
          name: "",
          alternate_name: "",
          entity_type: "business_name",
          registration_number: "",
          tax_identification_number: "",
          registered_address: "",
        });
        await fetchData();
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to create business.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || b.entity_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Registered Businesses</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Corporate Ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Corporate entity registry connecting enterprises to client owners and CAC statutory records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#043F2E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#06553F] shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Link Business</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by business name, RC/BN number, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
        >
          <option value="all">All Legal Structures</option>
          <option value="business_name">Business Name</option>
          <option value="company_incorporation">Company Limited (LLC)</option>
          <option value="ngo_trustees">Incorporated Trustees / NGO</option>
          <option value="annual_returns">Annual Returns Entity</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading business entities...</div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No registered businesses found</p>
          <p className="text-[11px] text-slate-400 mt-1">Businesses linked to clients will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((biz) => (
            <div key={biz.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-500 transition">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {biz.entity_type.replace(/_/g, " ")}
                  </span>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900">{biz.name}</h3>
                </div>
                <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.2 text-[10px] font-semibold">
                  {biz.status}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <p className="flex items-center justify-between">
                  <span className="text-slate-400">Owner / Client:</span>
                  <span className="font-semibold text-slate-900">{biz.client?.full_name || "Unassigned"}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-400">RC / BN Number:</span>
                  <span className="font-mono text-slate-900">{biz.registration_number || "In Progress"}</span>
                </p>
                {biz.tax_identification_number && (
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">TIN:</span>
                    <span className="font-mono text-slate-900">{biz.tax_identification_number}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Business Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Link Business to Client</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBusiness} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Select Client Owner *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="">-- Choose registered client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Adebayo Agro Ventures"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Entity Structure *</label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 outline-none focus:border-emerald-600"
                  >
                    <option value="business_name">Business Name</option>
                    <option value="company_incorporation">Company Limited (LLC)</option>
                    <option value="ngo_trustees">Incorporated Trustees / NGO</option>
                    <option value="annual_returns">Annual Returns Entity</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">RC / BN Number</label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="e.g. BN 3928174"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Registered Address</label>
                <input
                  type="text"
                  value={formData.registered_address}
                  onChange={(e) => setFormData({ ...formData, registered_address: e.target.value })}
                  placeholder="Official registered address in Nigeria"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
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
                  className="rounded-xl bg-[#043F2E] px-4 py-2 font-bold text-white hover:bg-[#06553F] transition disabled:opacity-50"
                >
                  {isSubmitting ? "Linking..." : "Save Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
