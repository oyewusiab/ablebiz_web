import { useEffect, useState } from "react";
import {
  DollarSign,
  Search,
  Filter,
  Plus,
  Building2,
  Calendar,
  FileCheck2,
  CreditCard,
  TrendingDown,
  Tag,
  AlertCircle,
  FileText,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface ExpenseRecord {
  id: string;
  vendor_id?: string | null;
  service_request_id?: string | null;
  amount: number;
  expense_date: string;
  category: string;
  receipt_document_id?: string | null;
  paid_by?: string | null;
  payment_method: string;
  description?: string | null;
  created_at: string;
  // Joins
  vendor?: { name: string; category: string };
  service_request?: { tracking_code: string };
  payer?: { full_name: string };
}

export function ExpensesPage() {
  const { profile, hasPermission } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [serviceRequests, setServiceRequests] = useState<{ id: string; tracking_code: string }[]>([]);
  const [formData, setFormData] = useState({
    vendor_id: "",
    service_request_id: "",
    amount: 0,
    expense_date: new Date().toISOString().split("T")[0],
    category: "cac_filing_fee",
    payment_method: "bank_transfer",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create");

  useEffect(() => {
    fetchExpenses();
    fetchOptions();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          vendor:vendors(name, category),
          service_request:service_requests(tracking_code),
          payer:staff_profiles(full_name)
        `)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error("[Expenses] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [vRes, srRes] = await Promise.all([
        supabase.from("vendors").select("id, name").eq("is_active", true).order("name"),
        supabase.from("service_requests").select("id, tracking_code").neq("status", "completed"),
      ]);

      setVendors(vRes.data || []);
      setServiceRequests(srRes.data || []);
    } catch (err) {
      console.error("[Expenses] Options load error:", err);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(formData.amount);
    if (amt <= 0) {
      setFormError("Expense amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const { data: exp, error: expErr } = await supabase
        .from("expenses")
        .insert({
          vendor_id: formData.vendor_id || null,
          service_request_id: formData.service_request_id || null,
          amount: amt,
          expense_date: formData.expense_date,
          category: formData.category,
          payment_method: formData.payment_method,
          description: formData.description || null,
          paid_by: profile?.id || null,
        })
        .select()
        .single();

      if (expErr) throw expErr;

      // Activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "expense",
        entity_id: exp.id,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: "expense_recorded",
        event_title: `Disbursement of ₦${amt.toLocaleString()} recorded (${formData.category.replace(/_/g, " ")})`,
        metadata: {
          category: formData.category,
          amount: amt,
          vendor_id: formData.vendor_id,
        },
      });

      setIsCreateOpen(false);
      setFormData({
        vendor_id: "",
        service_request_id: "",
        amount: 0,
        expense_date: new Date().toISOString().split("T")[0],
        category: "cac_filing_fee",
        payment_method: "bank_transfer",
        description: "",
      });
      fetchExpenses();
    } catch (err: any) {
      console.error("[Expense Create] Error:", err);
      setFormError(err.message || "Failed to record expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.service_request?.tracking_code?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = categoryFilter === "all" || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const statutoryFees = expenses
    .filter((e) => ["cac_filing_fee", "firs_tax_fee", "scuml_fee", "stamp_duty"].includes(e.category))
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const operationalOverhead = totalExpenses - statutoryFees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Expenses & Cost Tracking</h1>
              <p className="text-xs text-slate-500">
                Track disbursements, statutory regulatory fees, and service delivery direct costs
              </p>
            </div>
          </div>
        </div>

        {canManageFinance && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] transition"
          >
            <Plus className="h-4 w-4" />
            Record Disbursement
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Expenses</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">₦{totalExpenses.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">{expenses.length} disbursements</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Statutory Filing Costs</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">₦{statutoryFees.toLocaleString()}</p>
          <span className="text-[11px] text-amber-500">CAC, FIRS, Stamp duties</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Operating Overhead</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">₦{operationalOverhead.toLocaleString()}</p>
          <span className="text-[11px] text-blue-500">Office, logistics, utilities</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Linked to Client Requests</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {expenses.filter((e) => e.service_request_id).length}
          </p>
          <span className="text-[11px] text-emerald-600">Direct cost of service</span>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, vendor name, tracking code..."
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
            <option value="all">All Expense Categories</option>
            <option value="cac_filing_fee">CAC Filing Fee</option>
            <option value="firs_tax_fee">FIRS Tax Fee</option>
            <option value="scuml_fee">SCUML Fee</option>
            <option value="stamp_duty">Stamp Duty</option>
            <option value="office_supplies">Office Supplies</option>
            <option value="transportation">Transportation</option>
            <option value="software_cloud">Software & Subscriptions</option>
            <option value="logistics">Logistics & Dispatch</option>
            <option value="utilities">Utilities</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No expenses recorded matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Vendor / Payee</th>
                  <th className="py-3 px-4">Service Request</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {new Date(e.expense_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                        {e.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{e.description || "—"}</td>
                    <td className="py-3 px-4 text-slate-700">{e.vendor?.name || "Direct Expense"}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {e.service_request?.tracking_code || "General Overhead"}
                    </td>
                    <td className="py-3 px-4 font-bold text-red-700">₦{Number(e.amount).toLocaleString()}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {e.payment_method?.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{e.payer?.full_name || "Staff"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD DISBURSEMENT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Record Operational Expense / Disbursement</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Disbursement Amount (₦) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600 font-bold text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Disbursement Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="cac_filing_fee">CAC Official Filing Fee</option>
                  <option value="firs_tax_fee">FIRS Tax Processing Fee</option>
                  <option value="scuml_fee">SCUML Certificate Fee</option>
                  <option value="stamp_duty">Stamp Duty & Notary</option>
                  <option value="office_supplies">Office Supplies & Printing</option>
                  <option value="transportation">Transportation & Local Dispatch</option>
                  <option value="software_cloud">Software, Cloud & Subscriptions</option>
                  <option value="logistics">Courier & Freight Logistics</option>
                  <option value="utilities">Office Utilities & Rent</option>
                  <option value="other">Other Operational Disbursement</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Vendor / Payee</label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  >
                    <option value="">None / Direct Expense</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Link to Service Request</label>
                  <select
                    value={formData.service_request_id}
                    onChange={(e) => setFormData({ ...formData, service_request_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  >
                    <option value="">General Overhead</option>
                    {serviceRequests.map((sr) => (
                      <option key={sr.id} value={sr.id}>
                        {sr.tracking_code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS Terminal</option>
                  <option value="cash">Petty Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Description / Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Detail the reason for disbursement..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#0A2558] px-5 py-2 font-semibold text-white hover:bg-[#061738] disabled:opacity-50 transition"
                >
                  {submitting ? "Saving..." : "Record Disbursement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
