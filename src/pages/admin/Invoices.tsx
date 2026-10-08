import { useEffect, useState } from "react";
import {
  Receipt,
  Search,
  Filter,
  Plus,
  CreditCard,
  Printer,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { DocumentHeader, DocumentFooter } from "../../components/admin/DocumentBranding";

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  quotation_id?: string | null;
  service_request_id?: string | null;
  client_id: string;
  business_id?: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled" | "refunded";
  payment_terms?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  client?: { full_name: string; phone: string; email: string };
  business?: { name: string };
  service_request?: { tracking_code: string };
  creator?: { full_name: string };
  items?: InvoiceItemRecord[];
  payments?: any[];
}

export interface InvoiceItemRecord {
  id?: string;
  invoice_id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export function InvoicesPage() {
  const { profile, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Detail / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRecord[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string; client_id: string }[]>([]);
  const [serviceRequests, setServiceRequests] = useState<{ id: string; tracking_code: string; client_id: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; default_fee_ngn: number }[]>([]);

  // Create Form State
  const [formData, setFormData] = useState({
    client_id: "",
    business_id: "",
    service_request_id: "",
    due_days: 7,
    discount: 0,
    tax_percent: 0,
    payment_terms: "Payment due within 7 days of invoice issuance. Remit to Moniepoint MFB - Ablebiz Business Services.",
    notes: "",
  });

  const [formItems, setFormItems] = useState<
    { service_id: string; description: string; quantity: number; unit_price: number; total_price: number }[]
  >([]);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quick Payment Modal (from invoice)
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: "bank_transfer",
    transaction_reference: "",
    bank_account_credited: "Moniepoint MFB - Ablebiz",
    notes: "",
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create");

  useEffect(() => {
    fetchInvoices();
    fetchOptions();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(full_name, phone, email),
          business:businesses(name),
          service_request:service_requests(tracking_code),
          creator:staff_profiles(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error("[Invoices] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [cRes, bRes, srRes, sRes] = await Promise.all([
        supabase.from("clients").select("id, full_name, phone").eq("is_active", true).order("full_name"),
        supabase.from("businesses").select("id, name, client_id").order("name"),
        supabase.from("service_requests").select("id, tracking_code, client_id").neq("status", "completed"),
        supabase.from("services_catalog").select("id, name, default_fee_ngn").eq("is_active", true).order("name"),
      ]);

      setClients(cRes.data || []);
      setBusinesses(bRes.data || []);
      setServiceRequests(srRes.data || []);
      setServices(sRes.data || []);
    } catch (err) {
      console.error("[Invoices] Options load error:", err);
    }
  };

  const openInvoiceDetail = async (inv: InvoiceRecord) => {
    setSelectedInvoice(inv);
    try {
      const [itemsRes, payRes] = await Promise.all([
        supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("created_at", { ascending: true }),
        supabase.from("payments").select("*, receiver:staff_profiles(full_name)").eq("invoice_id", inv.id).order("payment_date", { ascending: false }),
      ]);

      setInvoiceItems(itemsRes.data || []);
      setInvoicePayments(payRes.data || []);
    } catch (err) {
      console.error("[Invoices] Details load error:", err);
    }
    setIsPrintModalOpen(true);
  };

  // Generate Unique Sequential Invoice Number: INV-YYYYMM-XXXX
  const generateInvoiceNumber = async (): Promise<string> => {
    const date = new Date();
    const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `INV-${ym}-`;

    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].invoice_number) {
      const parts = data[0].invoice_number.split("-");
      const lastSeq = parseInt(parts[2], 10);
      const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
      return `${prefix}${String(nextSeq).padStart(4, "0")}`;
    }
    return `${prefix}0001`;
  };

  // Generate Unique Sequential Receipt Number: REC-YYYYMM-XXXX
  const generateReceiptNumber = async (): Promise<string> => {
    const date = new Date();
    const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `REC-${ym}-`;

    const { data } = await supabase
      .from("payments")
      .select("receipt_number")
      .ilike("receipt_number", `${prefix}%`)
      .order("receipt_number", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].receipt_number) {
      const parts = data[0].receipt_number.split("-");
      const lastSeq = parseInt(parts[2], 10);
      const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
      return `${prefix}${String(nextSeq).padStart(4, "0")}`;
    }
    return `${prefix}0001`;
  };

  const handleAddServiceItem = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;

    setFormItems((prev) => [
      ...prev,
      {
        service_id: s.id,
        description: s.name,
        quantity: 1,
        unit_price: Number(s.default_fee_ngn) || 0,
        total_price: Number(s.default_fee_ngn) || 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemPrice = (index: number, newUnitPrice: number) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          unit_price: newUnitPrice,
          total_price: newUnitPrice * item.quantity,
        };
      })
    );
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const q = Math.max(1, newQty);
        return {
          ...item,
          quantity: q,
          total_price: item.unit_price * q,
        };
      })
    );
  };

  // Calculations
  const calculatedSubtotal = formItems.reduce((acc, item) => acc + item.total_price, 0);
  const calculatedTax = (calculatedSubtotal - Number(formData.discount || 0)) * (Number(formData.tax_percent) / 100);
  const calculatedTotal = Math.max(0, calculatedSubtotal - Number(formData.discount || 0) + calculatedTax);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      setFormError("Please select a client.");
      return;
    }
    if (formItems.length === 0) {
      setFormError("Please add at least one line item.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const invNumber = await generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Number(formData.due_days));

      // 1. Insert invoice header
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invNumber,
          client_id: formData.client_id,
          business_id: formData.business_id || null,
          service_request_id: formData.service_request_id || null,
          issue_date: new Date().toISOString().split("T")[0],
          due_date: dueDate.toISOString().split("T")[0],
          subtotal: calculatedSubtotal,
          discount: Number(formData.discount) || 0,
          tax: calculatedTax,
          total_amount: calculatedTotal,
          amount_paid: 0.0,
          balance_due: calculatedTotal,
          status: "draft",
          payment_terms: formData.payment_terms,
          notes: formData.notes || null,
          created_by: profile?.id || null,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 2. Insert invoice items (frozen prices)
      const itemsPayload = formItems.map((item) => ({
        invoice_id: inv.id,
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itErr } = await supabase.from("invoice_items").insert(itemsPayload);
      if (itErr) throw itErr;

      // 3. Log to activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "invoice",
        entity_id: inv.id,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: "invoice_created",
        event_title: `Invoice ${invNumber} generated for ₦${calculatedTotal.toLocaleString()}`,
        metadata: {
          invoice_number: invNumber,
          client_id: formData.client_id,
          total_amount: calculatedTotal,
        },
      });

      setIsCreateOpen(false);
      setFormItems([]);
      setFormData({
        client_id: "",
        business_id: "",
        service_request_id: "",
        due_days: 7,
        discount: 0,
        tax_percent: 0,
        payment_terms: "Payment due within 7 days of invoice issuance. Remit to Moniepoint MFB - Ablebiz Business Services.",
        notes: "",
      });
      fetchInvoices();
    } catch (err: any) {
      console.error("[Invoice Create] Error:", err);
      setFormError(err.message || "Failed to create invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  // Record Payment Handler (Triggers database balance recalculation)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const amt = Number(paymentData.amount);
    if (amt <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }
    if (amt > Number(paymentModalInvoice.balance_due)) {
      if (!confirm(`Payment amount (₦${amt.toLocaleString()}) exceeds balance due (₦${Number(paymentModalInvoice.balance_due).toLocaleString()}). Continue?`)) {
        return;
      }
    }

    setRecordingPayment(true);
    try {
      const recNumber = await generateReceiptNumber();

      // Insert payment record (DB trigger will automatically recalculate invoice balance and status!)
      const { data: pay, error: payErr } = await supabase
        .from("payments")
        .insert({
          receipt_number: recNumber,
          invoice_id: paymentModalInvoice.id,
          client_id: paymentModalInvoice.client_id,
          amount: amt,
          payment_date: new Date().toISOString(),
          payment_method: paymentData.payment_method,
          transaction_reference: paymentData.transaction_reference || null,
          bank_account_credited: paymentData.bank_account_credited,
          notes: paymentData.notes || null,
          received_by: profile?.id || null,
          is_verified: true,
        })
        .select()
        .single();

      if (payErr) throw payErr;

      // Activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "payment",
        entity_id: pay.id,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: "payment_recorded",
        event_title: `Payment of ₦${amt.toLocaleString()} recorded (${recNumber})`,
        metadata: {
          receipt_number: recNumber,
          invoice_number: paymentModalInvoice.invoice_number,
          amount: amt,
        },
      });

      alert(`Payment recorded successfully! Receipt generated: ${recNumber}`);
      setPaymentModalInvoice(null);
      setPaymentData({
        amount: 0,
        payment_method: "bank_transfer",
        transaction_reference: "",
        bank_account_credited: "Moniepoint MFB - Ablebiz",
        notes: "",
      });
      fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === paymentModalInvoice.id) {
        openInvoiceDetail(paymentModalInvoice);
      }
    } catch (err: any) {
      console.error("[Record Payment] Error:", err);
      alert(err.message || "Failed to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  };

  // Filtering
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.business?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const isOverdue = new Date(inv.due_date) < new Date() && Number(inv.balance_due) > 0;

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "overdue") return matchesSearch && isOverdue;
    if (statusFilter === "unpaid") return matchesSearch && Number(inv.amount_paid) === 0;
    return matchesSearch && inv.status === statusFilter;
  });

  // Aggregates
  const totalInvoiced = invoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
  const totalCollected = invoices.reduce((acc, i) => acc + Number(i.amount_paid || 0), 0);
  const outstandingBalance = invoices.reduce((acc, i) => acc + Number(i.balance_due || 0), 0);
  const overdueCount = invoices.filter(
    (i) => new Date(i.due_date) < new Date() && Number(i.balance_due) > 0 && i.status !== "paid"
  ).length;

  return (
    <div className="space-y-6">
      {/* On-Screen Dashboard View - Hidden during print when invoice preview modal is open */}
      <div className={isPrintModalOpen ? "space-y-6 print:hidden" : "space-y-6"}>
        {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Tax Invoices & Billing</h1>
              <p className="text-xs text-slate-500">
                Official billing records, payment reconciliation, and immutable financial history
              </p>
            </div>
          </div>
        </div>

        {canManageFinance && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] transition active:translate-y-px"
          >
            <Plus className="h-4 w-4" />
            Create Direct Invoice
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Invoiced</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">₦{totalInvoiced.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">{invoices.length} invoices generated</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Collected Revenue</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">₦{totalCollected.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-600">Reconciled payments</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Outstanding Balance</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">₦{outstandingBalance.toLocaleString()}</p>
          <span className="text-[11px] text-amber-500">Pending receivables</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Overdue Invoices</span>
          <p className="mt-1 text-2xl font-bold text-red-600">{overdueCount}</p>
          <span className="text-[11px] text-red-500">Exceeded payment due date</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, client name, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600"
          >
            <option value="all">All Invoices</option>
            <option value="unpaid">Unpaid (₦0 collected)</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Fully Paid</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No invoices found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client / Business</th>
                  <th className="py-3 px-4">Issue / Due Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isOverdue =
                    new Date(inv.due_date) < new Date() && Number(inv.balance_due) > 0 && inv.status !== "paid";

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                        {inv.service_request && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            SR: {inv.service_request.tracking_code}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{inv.client?.full_name}</p>
                        {inv.business && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {inv.business.name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>Issued: {new Date(inv.issue_date).toLocaleDateString()}</div>
                        <div className={isOverdue ? "text-red-600 font-semibold text-[11px]" : "text-slate-500 text-[11px]"}>
                          Due: {new Date(inv.due_date).toLocaleDateString()}
                          {isOverdue && " ⚠️"}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₦{Number(inv.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        ₦{Number(inv.amount_paid).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-700">
                        ₦{Number(inv.balance_due).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            inv.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.status === "partially_paid"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : isOverdue
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isOverdue && inv.status !== "paid" ? "overdue" : inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openInvoiceDetail(inv)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition"
                          >
                            View & Print
                          </button>

                          {canManageFinance && Number(inv.balance_due) > 0 && inv.status !== "cancelled" && (
                            <button
                              onClick={() => {
                                setPaymentModalInvoice(inv);
                                setPaymentData({
                                  amount: Number(inv.balance_due),
                                  payment_method: "bank_transfer",
                                  transaction_reference: "",
                                  bank_account_credited: "Moniepoint MFB - Ablebiz",
                                  notes: "",
                                });
                              }}
                              className="rounded-lg bg-[#0A2558] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#061738] transition"
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE INVOICE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Issue Direct Tax Invoice</h2>
                <p className="text-xs text-slate-500">
                  Generate official invoice with immutable transaction snapshot
                </p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-semibold text-slate-700">Client *</label>
                  <select
                    required
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  >
                    <option value="">Select Client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Linked Business (Optional)</label>
                  <select
                    value={formData.business_id}
                    onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  >
                    <option value="">None / General</option>
                    {businesses
                      .filter((b) => !formData.client_id || b.client_id === formData.client_id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Payment Due Term</label>
                  <select
                    value={formData.due_days}
                    onChange={(e) => setFormData({ ...formData, due_days: parseInt(e.target.value, 10) || 7 })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                  >
                    <option value={7}>7 Days Net</option>
                    <option value={14}>14 Days Net</option>
                    <option value={30}>30 Days Net</option>
                    <option value={0}>Immediate / Due on Receipt</option>
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Invoice Items</h3>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddServiceItem(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-600"
                  >
                    <option value="">+ Add Service from Catalogue...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (₦{Number(s.default_fee_ngn).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {formItems.length === 0 ? (
                  <p className="text-center py-4 text-slate-400">Add at least one service item to invoice.</p>
                ) : (
                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                              );
                            }}
                            className="font-bold text-slate-900 w-2/3 border-b border-transparent hover:border-slate-300 focus:border-emerald-600 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value, 10) || 1)}
                              className="h-8 w-full rounded-lg border border-slate-200 px-2"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Unit Price (₦)</label>
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className="h-8 w-full rounded-lg border border-slate-200 px-2"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Total Price</label>
                            <p className="h-8 flex items-center font-bold text-slate-900">
                              ₦{item.total_price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Calculation Summary */}
                <div className="border-t border-slate-200 pt-3 space-y-1.5 text-right">
                  <div className="text-slate-600">Subtotal: <span className="font-bold text-slate-900">₦{calculatedSubtotal.toLocaleString()}</span></div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-slate-600">Discount (₦):</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-28 rounded-lg border border-slate-200 px-2 text-right text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-slate-600">Tax / VAT (%):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.tax_percent}
                      onChange={(e) => setFormData({ ...formData, tax_percent: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-20 rounded-lg border border-slate-200 px-2 text-right text-xs"
                    />
                  </div>
                  <div className="text-sm font-bold text-emerald-800 pt-1">
                    Total Invoice Amount: ₦{calculatedTotal.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Terms</label>
                <textarea
                  rows={2}
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-emerald-600"
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
                  {submitting ? "Issuing..." : "Generate Official Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* VIEW & PRINT INVOICE MODAL */}
      {isPrintModalOpen && selectedInvoice && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="print-modal-content w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="no-print flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0A2558] bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                  {selectedInvoice.invoice_number}
                </span>
                <span className="text-xs text-slate-400 uppercase">({selectedInvoice.status})</span>
                {Number(selectedInvoice.amount_paid) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                    <Lock className="h-3 w-3" /> Immutably Locked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Invoice
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document */}
            <div className="print-document p-4 border border-slate-200 rounded-xl bg-white space-y-6 print:border-none print:p-0">
              <DocumentHeader
                title="TAX INVOICE"
                documentNumber={selectedInvoice.invoice_number}
                date={selectedInvoice.issue_date}
                dueDate={selectedInvoice.due_date}
                dueLabel="Payment Due"
                status={selectedInvoice.status}
                recipient={{
                  name: selectedInvoice.client?.full_name,
                  phone: selectedInvoice.client?.phone,
                  email: selectedInvoice.client?.email,
                  businessName: selectedInvoice.business?.name,
                }}
                paymentDetails={{
                  bankName: "Moniepoint Microfinance Bank",
                  accountName: "Ablebiz Business Services",
                  accountNumber: "8243178920",
                }}
              />

              {/* Items */}
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">₦{Number(item.unit_price).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        ₦{Number(item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Balance Summary */}
              <div className="flex justify-end text-xs">
                <div className="w-72 space-y-1.5 border-t border-slate-200 pt-2 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₦{Number(selectedInvoice.subtotal).toLocaleString()}</span>
                  </div>
                  {Number(selectedInvoice.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>-₦{Number(selectedInvoice.discount).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(selectedInvoice.tax) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / VAT:</span>
                      <span>₦{Number(selectedInvoice.tax).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1.5">
                    <span>Total Amount:</span>
                    <span>₦{Number(selectedInvoice.total_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-700">
                    <span>Amount Paid:</span>
                    <span>₦{Number(selectedInvoice.amount_paid).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-amber-700 border-t border-slate-200 pt-1.5">
                    <span>Balance Due:</span>
                    <span>₦{Number(selectedInvoice.balance_due).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment History on this invoice */}
              {invoicePayments.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-900 mb-2">Confirmed Payments Received</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-[11px]">
                    {invoicePayments.map((p) => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between bg-slate-50/50">
                        <div>
                          <span className="font-mono font-bold text-emerald-800">{p.receipt_number}</span>
                          <span className="ml-2 text-slate-500 capitalize">{p.payment_method?.replace(/_/g, " ")}</span>
                          {p.transaction_reference && (
                            <span className="ml-2 font-mono text-slate-400">Ref: {p.transaction_reference}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-700">₦{Number(p.amount).toLocaleString()}</span>
                          <span className="block text-[10px] text-slate-400">
                            {new Date(p.payment_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DocumentFooter
                documentId={selectedInvoice.id}
                notes={selectedInvoice.payment_terms || "Thank you for engaging ABLEBIZ Business Services. CAC compliance and operational filings commence following payment reconciliation."}
              />
            </div>

            {/* Bottom Actions */}
            {canManageFinance && Number(selectedInvoice.balance_due) > 0 && (
              <div className="no-print mt-5 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setPaymentModalInvoice(selectedInvoice);
                    setPaymentData({
                      amount: Number(selectedInvoice.balance_due),
                      payment_method: "bank_transfer",
                      transaction_reference: "",
                      bank_account_credited: "Moniepoint MFB - Ablebiz",
                      notes: "",
                    });
                  }}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] transition active:translate-y-px"
                >
                  Record Payment for this Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK PAYMENT RECORDING MODAL */}
      {paymentModalInvoice && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Client Payment</h3>
                <p className="text-xs text-slate-500">
                  Invoice: {paymentModalInvoice.invoice_number} • Balance Due: ₦
                  {Number(paymentModalInvoice.balance_due).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setPaymentModalInvoice(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Payment Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] focus:ring-1 focus:ring-[#0A2558]/20 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Method *</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] focus:ring-1 focus:ring-[#0A2558]/20"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS Terminal</option>
                  <option value="cash">Cash</option>
                  <option value="online_gateway">Online Payment Gateway</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Transaction Reference / Session ID</label>
                <input
                  type="text"
                  placeholder="e.g. NIP Transfer 9823487192"
                  value={paymentData.transaction_reference}
                  onChange={(e) => setPaymentData({ ...paymentData, transaction_reference: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] focus:ring-1 focus:ring-[#0A2558]/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Bank Account Credited</label>
                <input
                  type="text"
                  value={paymentData.bank_account_credited}
                  onChange={(e) => setPaymentData({ ...paymentData, bank_account_credited: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] focus:ring-1 focus:ring-[#0A2558]/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional payment commentary..."
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] focus:ring-1 focus:ring-[#0A2558]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="rounded-xl bg-[#0A2558] px-5 py-2 font-semibold text-white hover:bg-[#061738] disabled:opacity-50 transition"
                >
                  {recordingPayment ? "Processing..." : "Confirm & Issue Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
