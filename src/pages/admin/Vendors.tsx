import { useEffect, useState } from "react";
import {
  Building2,
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  CreditCard,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface VendorRecord {
  id: string;
  name: string;
  category: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  account_details?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function VendorsPage() {
  const { profile, hasPermission } = useAuth();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "statutory_authority",
    contact_person: "",
    phone: "",
    email: "",
    account_details: "",
    notes: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error("[Vendors] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingVendor(null);
    setFormData({
      name: "",
      category: "statutory_authority",
      contact_person: "",
      phone: "",
      email: "",
      account_details: "",
      notes: "",
      is_active: true,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: VendorRecord) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      category: v.category,
      contact_person: v.contact_person || "",
      phone: v.phone || "",
      email: v.email || "",
      account_details: v.account_details || "",
      notes: v.notes || "",
      is_active: v.is_active,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Vendor name is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (editingVendor) {
        const { error } = await supabase
          .from("vendors")
          .update({
            name: formData.name.trim(),
            category: formData.category,
            contact_person: formData.contact_person || null,
            phone: formData.phone || null,
            email: formData.email || null,
            account_details: formData.account_details || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingVendor.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendors").insert({
          name: formData.name.trim(),
          category: formData.category,
          contact_person: formData.contact_person || null,
          phone: formData.phone || null,
          email: formData.email || null,
          account_details: formData.account_details || null,
          notes: formData.notes || null,
          is_active: formData.is_active,
        });

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchVendors();
    } catch (err: any) {
      console.error("[Vendors] Save error:", err);
      setFormError(err.message || "Failed to save vendor.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.phone?.includes(searchQuery);

    const matchesCat = categoryFilter === "all" || v.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Vendors & Statutory Authorities</h1>
              <p className="text-xs text-slate-500">
                Government regulatory bodies, service contractors, and operational suppliers
              </p>
            </div>
          </div>
        </div>

        {canManageFinance && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            Add New Vendor
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Vendors</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{vendors.length}</p>
          <span className="text-[11px] text-slate-400">Registered entities</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Statutory Authorities</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {vendors.filter((v) => v.category === "statutory_authority").length}
          </p>
          <span className="text-[11px] text-emerald-600">CAC, FIRS, EFCC/SCUML</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Active Partners</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {vendors.filter((v) => v.is_active).length}
          </p>
          <span className="text-[11px] text-blue-500">Operational suppliers</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Service Categories</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {new Set(vendors.map((v) => v.category)).size}
          </p>
          <span className="text-[11px] text-amber-500">Distinct expense streams</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor name, contact person, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600"
          >
            <option value="all">All Categories</option>
            <option value="statutory_authority">Statutory Authority</option>
            <option value="legal_services">Legal Services</option>
            <option value="printing_stationery">Printing & Stationery</option>
            <option value="logistics">Logistics & Dispatch</option>
            <option value="software_subscriptions">Software & Cloud</option>
            <option value="utilities">Utilities & Office</option>
            <option value="general_vendor">General Vendor</option>
          </select>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading vendors...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No vendors found matching your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Vendor Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone / Email</th>
                  <th className="py-3 px-4">Bank / Account Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                        {v.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{v.contact_person || "—"}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {v.phone && <div>{v.phone}</div>}
                      {v.email && <div className="text-[11px] text-slate-400">{v.email}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {v.account_details || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          v.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManageFinance && (
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-emerald-600 hover:text-emerald-700 transition"
                          title="Edit Vendor"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT VENDOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingVendor ? "Edit Vendor Details" : "Register Vendor / Statutory Authority"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Vendor / Authority Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate Affairs Commission (CAC)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="statutory_authority">Statutory Authority (CAC, FIRS, etc.)</option>
                  <option value="legal_services">Legal Services / Notary</option>
                  <option value="printing_stationery">Printing & Stationery</option>
                  <option value="logistics">Logistics & Dispatch</option>
                  <option value="software_subscriptions">Software & Subscriptions</option>
                  <option value="utilities">Office Utilities & Rent</option>
                  <option value="general_vendor">General Vendor</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Bank / Settlement Details</label>
                <input
                  type="text"
                  placeholder="Bank Name, Account Name, Account Number"
                  value={formData.account_details}
                  onChange={(e) => setFormData({ ...formData, account_details: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vendorActive"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="vendorActive" className="font-semibold text-slate-700">
                  Active Vendor Status
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingVendor ? "Update Vendor" : "Create Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
