import { useEffect, useState } from "react";
import {
  CreditCard,
  Search,
  Filter,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  Building2,
  Receipt,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  DollarSign,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface PaymentRecord {
  id: string;
  receipt_number: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: "bank_transfer" | "pos" | "cash" | "online_gateway" | "cheque";
  transaction_reference?: string | null;
  bank_account_credited?: string | null;
  notes?: string | null;
  received_by?: string | null;
  is_verified: boolean;
  created_at: string;
  // Joins
  client?: { full_name: string; phone: string; email: string };
  invoice?: {
    invoice_number: string;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    service_request?: { tracking_code: string };
  };
  receiver?: { full_name: string };
}

export function PaymentsPage() {
  const { profile, hasPermission } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // Receipt Modal
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // New Payment Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    invoice_id: "",
    amount: 0,
    payment_method: "bank_transfer",
    transaction_reference: "",
    bank_account_credited: "Moniepoint MFB - Ablebiz",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create");

  useEffect(() => {
    fetchPayments();
    fetchUnpaidInvoices();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          client:clients(full_name, phone, email),
          invoice:invoices(
            invoice_number,
            total_amount,
            amount_paid,
            balance_due,
            service_request:service_requests(tracking_code)
          ),
          receiver:staff_profiles(full_name)
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error("[Payments] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          client_id,
          total_amount,
          amount_paid,
          balance_due,
          client:clients(full_name)
        `)
        .gt("balance_due", 0)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUnpaidInvoices(data);
      }
    } catch (err) {
      console.error("[Payments] Invoices load error:", err);
    }
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

  const openReceipt = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsReceiptModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoice_id) {
      setFormError("Please select an outstanding invoice.");
      return;
    }
    const amt = Number(formData.amount);
    if (amt <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }

    const targetInv = unpaidInvoices.find((i) => i.id === formData.invoice_id);
    if (targetInv && amt > Number(targetInv.balance_due)) {
      if (!confirm(`Entered amount (₦${amt.toLocaleString()}) exceeds invoice balance (₦${Number(targetInv.balance_due).toLocaleString()}). Continue?`)) {
        return;
      }
    }

    setSubmitting(true);
    setFormError("");

    try {
      const recNumber = await generateReceiptNumber();

      const { data: newPay, error: payErr } = await supabase
        .from("payments")
        .insert({
          receipt_number: recNumber,
          invoice_id: formData.invoice_id,
          client_id: targetInv ? targetInv.client_id : null,
          amount: amt,
          payment_date: new Date().toISOString(),
          payment_method: formData.payment_method,
          transaction_reference: formData.transaction_reference || null,
          bank_account_credited: formData.bank_account_credited,
          notes: formData.notes || null,
          received_by: profile?.id || null,
          is_verified: true,
        })
        .select(`
          *,
          client:clients(full_name, phone, email),
          invoice:invoices(invoice_number, total_amount, amount_paid, balance_due),
          receiver:staff_profiles(full_name)
        `)
        .single();

      if (payErr) throw payErr;

      // Activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "payment",
        entity_id: newPay.id,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: "payment_recorded",
        event_title: `Payment ₦${amt.toLocaleString()} recorded (${recNumber})`,
        metadata: {
          receipt_number: recNumber,
          amount: amt,
        },
      });

      setIsCreateOpen(false);
      setFormData({
        invoice_id: "",
        amount: 0,
        payment_method: "bank_transfer",
        transaction_reference: "",
        bank_account_credited: "Moniepoint MFB - Ablebiz",
        notes: "",
      });
      fetchPayments();
      fetchUnpaidInvoices();
      openReceipt(newPay);
    } catch (err: any) {
      console.error("[Payment Record] Error:", err);
      setFormError(err.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoice?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.transaction_reference?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMethod = methodFilter === "all" || p.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const avgPayment = payments.length > 0 ? totalCollected / payments.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Payments & Official Receipts</h1>
              <p className="text-xs text-slate-500">
                Payment reconciliation, atomic balance engine, and official client receipts
              </p>
            </div>
          </div>
        </div>

        {canManageFinance && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            Record New Payment
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Collections</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">₦{totalCollected.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-600">Reconciled in bank account</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Receipts Issued</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{payments.length}</p>
          <span className="text-[11px] text-slate-400">Total verified transactions</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Average Transaction</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">₦{Math.round(avgPayment).toLocaleString()}</p>
          <span className="text-[11px] text-blue-500">Mean payment value</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Pending Unpaid Invoices</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">{unpaidInvoices.length}</p>
          <span className="text-[11px] text-amber-500">Invoices awaiting settlement</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipt #, invoice #, client, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600"
          >
            <option value="all">All Payment Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="pos">POS Terminal</option>
            <option value="cash">Cash</option>
            <option value="online_gateway">Online Gateway</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">{p.receipt_number}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {p.invoice?.invoice_number || "—"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.client?.full_name || "—"}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">₦{Number(p.amount).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-800 font-medium">
                        {p.payment_method?.replace(/_/g, " ")}
                      </span>
                      {p.transaction_reference && (
                        <span className="block font-mono text-[10px] text-slate-400">
                          {p.transaction_reference}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.receiver?.full_name || "Staff"}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openReceipt(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition"
                      >
                        <Printer className="h-3 w-3" />
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OFFICIAL RECEIPT VIEW & PRINT MODAL */}
      {isReceiptModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                Official Receipt: {selectedPayment.receipt_number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Official Receipt Printable Card */}
            <div className="border-2 border-slate-200 rounded-xl p-6 bg-white space-y-5 print:border-none print:p-0">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900">
                    ABLEBIZ BUSINESS SERVICES
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    CAC Accredited Corporate Consultants • Abeokuta, Ogun State
                  </p>
                  <p className="text-[10px] text-slate-400">RC: 3341892 • info@ablebiz.com.ng • 0803 000 0000</p>
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-black text-emerald-700 tracking-wider">OFFICIAL RECEIPT</h3>
                  <p className="font-mono text-xs font-bold text-slate-900">{selectedPayment.receipt_number}</p>
                  <p className="text-[10px] text-slate-500">
                    Date: {new Date(selectedPayment.payment_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">RECEIVED FROM:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedPayment.client?.full_name}</p>
                    <p className="text-slate-600">{selectedPayment.client?.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">APPLIED TO INVOICE:</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">
                      {selectedPayment.invoice?.invoice_number || "Direct"}
                    </p>
                    {selectedPayment.invoice?.service_request && (
                      <p className="text-[11px] text-slate-500">
                        SR: {selectedPayment.invoice.service_request.tracking_code}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-600">Total Invoice Amount:</span>
                    <span className="text-slate-900 font-bold">
                      ₦{Number(selectedPayment.invoice?.total_amount || selectedPayment.amount).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-base font-black text-emerald-800 bg-emerald-50/70 p-2 rounded">
                    <span>Amount Paid in this Transaction:</span>
                    <span>₦{Number(selectedPayment.amount).toLocaleString()}</span>
                  </div>

                  {selectedPayment.invoice && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Paid to Date:</span>
                        <span className="text-emerald-700 font-semibold">
                          ₦{Number(selectedPayment.invoice.amount_paid).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-1">
                        <span>Remaining Balance:</span>
                        <span className="text-amber-700">
                          ₦{Number(selectedPayment.invoice.balance_due).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400">Payment Channel:</span>{" "}
                    <span className="font-semibold text-slate-900 capitalize">
                      {selectedPayment.payment_method?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Reference:</span>{" "}
                    <span className="font-mono text-slate-900">{selectedPayment.transaction_reference || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Credited To:</span>{" "}
                    <span className="font-semibold text-slate-900">{selectedPayment.bank_account_credited}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Received By:</span>{" "}
                    <span className="font-semibold text-slate-900">{selectedPayment.receiver?.full_name || "Accounts Dept."}</span>
                  </div>
                </div>
              </div>

              {/* Signature stamp */}
              <div className="border-t border-slate-200 pt-4 flex justify-between items-end">
                <div className="text-[10px] text-slate-400">
                  <p>Computer-generated official receipt.</p>
                  <p>Valid without physical stamp when referenced with bank transaction ID.</p>
                </div>
                <div className="text-center">
                  <div className="w-32 border-b border-slate-400 pb-1 mb-1 font-serif italic text-xs text-slate-600">
                    Ablebiz Accounts
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Client Payment</h3>
                <p className="text-xs text-slate-500">Atomic database balance reconciliation</p>
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

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Outstanding Invoice *</label>
                <select
                  required
                  value={formData.invoice_id}
                  onChange={(e) => {
                    const invId = e.target.value;
                    const inv = unpaidInvoices.find((i) => i.id === invId);
                    setFormData({
                      ...formData,
                      invoice_id: invId,
                      amount: inv ? Number(inv.balance_due) : 0,
                    });
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="">Select Invoice...</option>
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.client?.full_name} (Balance: ₦{Number(inv.balance_due).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Method *</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS Terminal</option>
                  <option value="cash">Cash</option>
                  <option value="online_gateway">Online Payment Gateway</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Transaction Reference / NIP Session</label>
                <input
                  type="text"
                  placeholder="e.g. 1000049281928"
                  value={formData.transaction_reference}
                  onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Bank Account Credited</label>
                <input
                  type="text"
                  value={formData.bank_account_credited}
                  onChange={(e) => setFormData({ ...formData, bank_account_credited: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Internal Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600"
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
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Confirm Payment & Issue Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
