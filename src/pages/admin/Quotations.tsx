import { useEffect, useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Send,
  Receipt,
  Download,
  Trash2,
  Sparkles,
  Layers,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { DocumentHeader, DocumentFooter } from "../../components/admin/DocumentBranding";
import { useBusinessProfile } from "../../lib/businessProfileContext";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import {
  fetchServiceBundles,
  getComplementaryRecommendations,
  computeQuotationFinancials,
  convertQuotationToInvoiceSafe,
} from "../../lib/quotations/quotationIntelligence";
import { createApprovalRequest } from "../../lib/approvals/approvalService";
import type { ServiceBundle, ServiceRecommendation } from "../../types/suitePhases15To19";

export interface QuotationRecord {
  id: string;
  quotation_number: string;
  service_request_id?: string | null;
  client_id: string;
  business_id?: string | null;
  quotation_date: string;
  valid_until: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  terms_and_conditions?: string | null;
  internal_notes?: string | null;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "converted" | "cancelled";
  created_by?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  client?: { full_name: string; phone: string; email: string };
  business?: { name: string };
  service_request?: { tracking_code: string };
  creator?: { full_name: string };
  items?: QuotationItemRecord[];
}

export interface QuotationItemRecord {
  id?: string;
  quotation_id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ServiceOption {
  id: string;
  name: string;
  category: string;
  default_fee_ngn: number;
  min_fee_ngn: number;
  internal_cost_estimate: number;
}

export function QuotationsPage() {
  const { profile, hasPermission } = useAuth();
  const { profile: bizProfile, defaultBankAccount } = useBusinessProfile();
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection & Print
  const [selectedQuote, setSelectedQuote] = useState<QuotationRecord | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuotationItemRecord[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string; client_id: string }[]>([]);
  const [serviceRequests, setServiceRequests] = useState<{ id: string; tracking_code: string; client_id: string }[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    client_id: "",
    business_id: "",
    service_request_id: "",
    valid_until_days: 14,
    discount_amount: 0,
    tax_percent: 0, // e.g. 7.5% VAT or 0
    terms_and_conditions: "1. Quotation is valid for 14 calendar days from issue date.\n2. 70% mobilization deposit required before filing commencement.\n3. Government statutory fees are subject to regulatory adjustments.",
    internal_notes: "",
  });

  const [formItems, setFormItems] = useState<
    { service_id: string; description: string; quantity: number; unit_price: number; min_fee: number; total_price: number }[]
  >([]);

  // Phase 17 Intelligence & Bundles
  const [bundles, setBundles] = useState<ServiceBundle[]>([]);
  const [recommendations, setRecommendations] = useState<ServiceRecommendation[]>([]);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const canManageFinance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "accounts_officer" ||
    hasPermission("finance", "create");

  useEffect(() => {
    fetchQuotations();
    fetchOptions();
  }, []);

  useEffect(() => {
    if (formItems.length > 0) {
      const ids = formItems.map((i) => i.service_id).filter(Boolean);
      getComplementaryRecommendations(ids).then(setRecommendations);
    } else {
      setRecommendations([]);
    }
  }, [formItems]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);

      // 1. Primary query using explicit verified foreign key relationship constraint
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          client:clients(full_name, phone, email),
          business:businesses(name),
          service_request:service_requests(tracking_code),
          creator:staff_profiles!quotations_created_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setQuotations(data);
        return;
      }

      // 2. Resilient fallback: If creator relation fails for any reason, fetch base quotations so records are NEVER hidden
      if (error) {
        console.warn("[Quotations] Primary query failed, attempting base fallback:", error.message);
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from("quotations")
          .select(`
            *,
            client:clients(full_name, phone, email),
            business:businesses(name),
            service_request:service_requests(tracking_code)
          `)
          .order("created_at", { ascending: false });

        if (fallbackErr) {
          console.error("[Quotations] Fallback query error:", fallbackErr.message);
        } else {
          setQuotations(fallbackData || []);
          return;
        }
      }
    } catch (err) {
      console.error("[Quotations] Load error:", err);
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
        supabase.from("services_catalog").select("id, name, category, default_fee_ngn, min_fee_ngn, internal_cost_estimate").eq("is_active", true).order("name"),
      ]);

      setClients(cRes.data || []);
      setBusinesses(bRes.data || []);
      setServiceRequests(srRes.data || []);
      setServices(sRes.data || []);

      const bList = await fetchServiceBundles();
      setBundles(bList);
    } catch (err) {
      console.error("[Quotations] Options load error:", err);
    }
  };

  const openQuoteDetail = async (quote: QuotationRecord) => {
    setSelectedQuote(quote);
    try {
      const { data, error } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quote.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setQuoteItems(data);
      }
    } catch (err) {
      console.error("[Quotations] Items load error:", err);
    }
    setIsPrintModalOpen(true);
  };

  // Generate Unique Sequential Quotation Number: QT-YYYYMM-XXXX
  const generateQuotationNumber = async (): Promise<string> => {
    const date = new Date();
    const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `QT-${ym}-`;

    const { data } = await supabase
      .from("quotations")
      .select("quotation_number")
      .ilike("quotation_number", `${prefix}%`)
      .order("quotation_number", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].quotation_number) {
      const parts = data[0].quotation_number.split("-");
      const lastSeq = parseInt(parts[2], 10);
      const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
      return `${prefix}${String(nextSeq).padStart(4, "0")}`;
    }
    return `${prefix}0001`;
  };

  // Add line item in creation form
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
        min_fee: Number(s.min_fee_ngn) || 0,
        total_price: Number(s.default_fee_ngn) || 0,
      },
    ]);
  };

  const handleAddBundleItem = (bundleId: string) => {
    const b = bundles.find((x) => x.id === bundleId);
    if (!b) return;

    // Add each included service with its proportionate or bundle price
    const included = services.filter((s) => b.included_service_ids.includes(s.id));
    if (included.length === 0) {
      setFormItems((prev) => [
        ...prev,
        {
          service_id: b.id,
          description: b.name,
          quantity: 1,
          unit_price: Number(b.bundle_price_ngn),
          min_fee: 0,
          total_price: Number(b.bundle_price_ngn),
        },
      ]);
      return;
    }

    const discountFactor = b.standard_total_ngn > 0 ? b.bundle_price_ngn / b.standard_total_ngn : 1;
    const newItems = included.map((s) => {
      const price = Math.round(Number(s.default_fee_ngn || 0) * discountFactor);
      return {
        service_id: s.id,
        description: `${s.name} (${b.name})`,
        quantity: 1,
        unit_price: price,
        min_fee: Number(s.min_fee_ngn || 0),
        total_price: price,
      };
    });

    setFormItems((prev) => [...prev, ...newItems]);
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

  // Form Calculations
  const calculatedSubtotal = formItems.reduce((acc, item) => acc + item.total_price, 0);
  const calculatedTax = (calculatedSubtotal - Number(formData.discount_amount || 0)) * (Number(formData.tax_percent) / 100);
  const calculatedTotal = Math.max(0, calculatedSubtotal - Number(formData.discount_amount || 0) + calculatedTax);

  const financialsPreview = useMemo(() => {
    return computeQuotationFinancials(
      formItems.map((item) => {
        const s = services.find((sv) => sv.id === item.service_id);
        return {
          unit_price: item.unit_price,
          quantity: item.quantity,
          statutory_fee: s?.category.includes("registration") ? 10000 : 0,
          internal_cost: Number(s?.internal_cost_estimate || 0),
          min_fee_ngn: item.min_fee,
        };
      }),
      Number(formData.discount_amount || 0),
      Number(formData.tax_percent || 0)
    );
  }, [formItems, formData.discount_amount, formData.tax_percent, services]);

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      setFormError("Please select a client.");
      return;
    }
    if (formItems.length === 0) {
      setFormError("Please add at least one service line item to the quotation.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const quoteNumber = await generateQuotationNumber();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + Number(formData.valid_until_days));

      const financials = computeQuotationFinancials(
        formItems.map((item) => {
          const s = services.find((sv) => sv.id === item.service_id);
          return {
            unit_price: item.unit_price,
            quantity: item.quantity,
            statutory_fee: s?.category.includes("registration") ? 10000 : 0,
            internal_cost: Number(s?.internal_cost_estimate || 0),
            min_fee_ngn: item.min_fee,
          };
        }),
        Number(formData.discount_amount || 0),
        Number(formData.tax_percent || 0)
      );

      // 1. Insert quotation header with frozen snapshot and margin calculations
      const { data: quote, error: quoteErr } = await supabase
        .from("quotations")
        .insert({
          quotation_number: quoteNumber,
          client_id: formData.client_id,
          business_id: formData.business_id || null,
          service_request_id: formData.service_request_id || null,
          quotation_date: new Date().toISOString().split("T")[0],
          valid_until: validUntilDate.toISOString().split("T")[0],
          subtotal: financials.subtotal,
          discount_amount: financials.discount_amount,
          tax_amount: financials.tax_amount,
          total_amount: financials.total_amount,
          statutory_fees_total: financials.statutory_fees_total,
          internal_cost_total: financials.internal_cost_total,
          margin_amount: financials.margin_amount,
          margin_percentage: financials.margin_percentage,
          requires_approval: financials.requires_approval,
          terms_and_conditions: formData.terms_and_conditions,
          internal_notes: formData.internal_notes || null,
          status: financials.requires_approval ? "draft" : "draft",
          created_by: profile?.id || null,
        })
        .select()
        .single();

      if (quoteErr) throw quoteErr;

      // 2. Insert line items (frozen unit price snapshots)
      const itemsPayload = formItems.map((item) => ({
        quotation_id: quote.id,
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsErr } = await supabase.from("quotation_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3. If quotation requires commercial approval, create approval request in Phase 13
      if (financials.requires_approval && profile?.id) {
        await createApprovalRequest(
          {
            category: "commercial",
            request_type: "discount",
            title: `Commercial Quotation Approval: ${quoteNumber}`,
            description: `Quotation ${quoteNumber} requires commercial approval before issuance. ${financials.approval_reasons.join(" ")}`,
            justification: `Quotation contains commercial terms requiring executive sign-off. Total: ₦${financials.total_amount.toLocaleString()}`,
            amount: financials.discount_amount > 0 ? financials.discount_amount : financials.total_amount,
            related_module: "quotations",
            related_record_id: quote.id,
          },
          profile.id
        );
      }

      // 4. Log to activity timeline
      await supabase.from("activity_timeline").insert({
        entity_type: "quotation",
        entity_id: quote.id,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: "quotation_created",
        event_title: `Quotation ${quoteNumber} drafted for ₦${financials.total_amount.toLocaleString()}`,
        metadata: {
          quotation_number: quoteNumber,
          client_id: formData.client_id,
          total_amount: financials.total_amount,
          requires_approval: financials.requires_approval,
        },
      });

      setIsCreateOpen(false);
      setFormItems([]);
      setFormData({
        client_id: "",
        business_id: "",
        service_request_id: "",
        valid_until_days: 14,
        discount_amount: 0,
        tax_percent: 0,
        terms_and_conditions: "1. Quotation is valid for 14 calendar days from issue date.\n2. 70% mobilization deposit required before filing commencement.\n3. Government statutory fees are subject to regulatory adjustments.",
        internal_notes: "",
      });
      fetchQuotations();
    } catch (err: any) {
      console.error("[Quotation Create] Error:", err);
      setFormError(err.message || "Failed to create quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  // Controlled Status Transitions
  const handleUpdateStatus = async (quoteId: string, newStatus: QuotationRecord["status"]) => {
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", quoteId);

      if (error) throw error;

      await supabase.from("activity_timeline").insert({
        entity_type: "quotation",
        entity_id: quoteId,
        actor_type: "staff",
        actor_id: profile?.id || null,
        event_type: `quotation_${newStatus}`,
        event_title: `Quotation marked as ${newStatus}`,
        metadata: { new_status: newStatus },
      });

      setQuotations((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
      );
      if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: newStatus });
      }
    } catch (err) {
      console.error("[Quotation Status] Update error:", err);
      alert("Failed to update quotation status.");
    }
  };

  // Explicit Conversion to Invoice
  const handleConvertToInvoice = async (quote: QuotationRecord) => {
    if (quote.status === "converted") {
      alert("This quotation has already been converted to an invoice.");
      return;
    }
    if (!confirm(`Convert Quotation ${quote.quotation_number} into an official Invoice?`)) {
      return;
    }

    setConvertingId(quote.id);
    try {
      const res = await convertQuotationToInvoiceSafe(
        quote.id,
        profile?.id || "",
        bizProfile.default_payment_terms
      );

      if (!res.success) {
        alert(res.error || "Failed to convert quotation to invoice.");
        return;
      }

      alert(`Quotation ${quote.quotation_number} converted into official Invoice ${res.invoiceNumber}!`);
      setIsPrintModalOpen(false);
      fetchQuotations();
    } catch (err: any) {
      console.error("[Convert to Invoice] Error:", err);
      alert(err.message || "Failed to convert quotation.");
    } finally {
      setConvertingId(null);
    }
  };

  // Filtered Quotations
  const filteredQuotations = quotations.filter((q) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      q.quotation_number.toLowerCase().includes(query) ||
      Boolean(q.client?.full_name && q.client.full_name.toLowerCase().includes(query)) ||
      Boolean(q.business?.name && q.business.name.toLowerCase().includes(query));

    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalQuotedValue = quotations.reduce((acc, q) => acc + Number(q.total_amount || 0), 0);
  const acceptedValue = quotations
    .filter((q) => q.status === "accepted" || q.status === "converted")
    .reduce((acc, q) => acc + Number(q.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* On-Screen Dashboard View - Hidden during print when quotation preview modal is open */}
      <div className={isPrintModalOpen ? "space-y-6 print:hidden" : "space-y-6"}>
        {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Quotations & Price Snapshots</h1>
              <p className="text-xs text-slate-500">
                Official cost estimates, line item freeze, and explicit invoice conversion
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
            Create Quotation
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Quotations</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{quotations.length}</p>
          <span className="text-[11px] text-slate-400">Total pipeline records</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Quoted Value</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">₦{totalQuotedValue.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Gross proposal sum</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Accepted / Converted</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {quotations.filter((q) => q.status === "accepted" || q.status === "converted").length}
          </p>
          <span className="text-[11px] text-blue-500">₦{acceptedValue.toLocaleString()} converted</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Pending Client Decision</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {quotations.filter((q) => q.status === "sent" || q.status === "viewed").length}
          </p>
          <span className="text-[11px] text-amber-500">Awaiting client response</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotation #, client name, business..."
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
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent to Client</option>
            <option value="accepted">Accepted</option>
            <option value="converted">Converted to Invoice</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading quotations...</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No quotations found matching your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Client / Business</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((q) => {
                  const isExpired = new Date(q.valid_until) < new Date() && q.status !== "converted" && q.status !== "accepted";

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {q.quotation_number}
                        {q.service_request && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            SR: {q.service_request.tracking_code}
                          </span>
                        )}
                        {q.creator?.full_name && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            By: {q.creator.full_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{q.client?.full_name}</p>
                        {q.business && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {q.business.name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{new Date(q.quotation_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <span className={isExpired ? "text-red-600 font-semibold" : "text-slate-600"}>
                          {new Date(q.valid_until).toLocaleDateString()}
                          {isExpired && " (Expired)"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">₦{Number(q.total_amount).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            q.status === "converted"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : q.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : q.status === "sent"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : q.status === "rejected"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openQuoteDetail(q)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition"
                          >
                            View & Print
                          </button>

                          {canManageFinance && q.status !== "converted" && (
                            <button
                              onClick={() => handleConvertToInvoice(q)}
                              disabled={convertingId === q.id}
                              className="rounded-lg bg-[#0A2558] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#061738] transition disabled:opacity-50"
                              title="Convert directly to official Invoice"
                            >
                              {convertingId === q.id ? "Converting..." : "Convert to Invoice"}
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

      {/* CREATE QUOTATION MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Create Official Quotation</h2>
                <p className="text-xs text-slate-500">
                  Pre-populate from Service Catalogue with frozen line-item pricing
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

            <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs">
              {/* Linked Entities */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <SearchableSelect
                    label="Client"
                    required
                    placeholder="Search and select client..."
                    searchPlaceholder="Search by name or phone..."
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.full_name,
                      sublabel: c.phone || undefined,
                      keywords: [c.full_name, c.phone || ""],
                    }))}
                    value={formData.client_id}
                    onChange={(val) => setFormData({ ...formData, client_id: val })}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Linked Business (Optional)"
                    placeholder="Search and select business..."
                    searchPlaceholder="Filter businesses..."
                    allowClear={true}
                    options={businesses
                      .filter((b) => !formData.client_id || b.client_id === formData.client_id)
                      .map((b) => ({
                        value: b.id,
                        label: b.name,
                        keywords: [b.name],
                      }))}
                    value={formData.business_id || ""}
                    onChange={(val) => setFormData({ ...formData, business_id: val })}
                    onClear={() => setFormData({ ...formData, business_id: "" })}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Service Request (Optional)"
                    placeholder="None"
                    searchPlaceholder="Filter service requests..."
                    allowClear={true}
                    options={serviceRequests
                      .filter((sr) => !formData.client_id || sr.client_id === formData.client_id)
                      .map((sr) => ({
                        value: sr.id,
                        label: sr.tracking_code,
                        keywords: [sr.tracking_code],
                      }))}
                    value={formData.service_request_id || ""}
                    onChange={(val) => setFormData({ ...formData, service_request_id: val })}
                    onClear={() => setFormData({ ...formData, service_request_id: "" })}
                  />
                </div>
              </div>

              {/* Service Line Items Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Quotation Line Items</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddBundleItem(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="h-8 rounded-lg border border-purple-200 bg-purple-50/50 px-2.5 text-xs outline-none focus:border-purple-600 font-semibold text-purple-900"
                    >
                      <option value="">+ Add Service Bundle...</option>
                      {bundles.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (₦{Number(b.bundle_price_ngn).toLocaleString()})
                        </option>
                      ))}
                    </select>

                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddServiceItem(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-600"
                    >
                      <option value="">+ Add Service from Catalog...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (₦{Number(s.default_fee_ngn).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formItems.length === 0 ? (
                  <p className="text-center py-4 text-slate-400">No services added yet. Add at least one line item.</p>
                ) : (
                  <div className="space-y-2">
                    {formItems.map((item, idx) => {
                      const isBelowMin = item.min_fee > 0 && item.unit_price < item.min_fee;

                      return (
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
                              <label className="text-[10px] text-slate-500">Qty</label>
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
                                className={`h-8 w-full rounded-lg border px-2 ${
                                  isBelowMin ? "border-amber-400 bg-amber-50" : "border-slate-200"
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Line Total (₦)</label>
                              <p className="h-8 flex items-center font-bold text-slate-900">
                                ₦{item.total_price.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {isBelowMin && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              <span>
                                Price is below minimum fee threshold (₦{item.min_fee.toLocaleString()}). Requires authorized approval.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phase 17 Intelligent Complementary Recommendations */}
                {recommendations.length > 0 && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-2 text-left">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      <span>Intelligent Complementary Recommendations</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recommendations.map((rec) => (
                        <div key={rec.service_id} className="rounded-lg bg-white p-2.5 border border-purple-100 flex items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{rec.name}</span>
                            <span className="text-[10px] text-slate-500 leading-tight block">{rec.reason}</span>
                            <span className="text-[11px] font-semibold text-purple-700 block mt-0.5">
                              ₦{rec.default_fee_ngn.toLocaleString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddServiceItem(rec.service_id)}
                            className="rounded-lg bg-purple-100 px-2 py-1 text-[11px] font-bold text-purple-800 hover:bg-purple-200 shrink-0 transition"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subtotal & Discount Calculation Summary */}
                <div className="border-t border-slate-200 pt-3 space-y-1.5 text-right">
                  <div className="text-slate-600">Subtotal: <span className="font-bold text-slate-900">₦{calculatedSubtotal.toLocaleString()}</span></div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-slate-600">Discount (₦):</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount_amount}
                      onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
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
                    Total Quotation: ₦{financialsPreview.total_amount.toLocaleString()}
                  </div>

                  {/* Phase 17 Profit Margin Preview (Restricted to Finance Roles) */}
                  {canManageFinance && (
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 text-left text-xs space-y-1">
                      <div className="flex items-center justify-between text-blue-900 font-bold">
                        <span>Expected Gross Operating Margin:</span>
                        <span>₦{financialsPreview.margin_amount.toLocaleString()} ({financialsPreview.margin_percentage}%)</span>
                      </div>
                      <div className="text-[10px] text-blue-700/80 leading-relaxed">
                        Statutory Regulatory Fees: ₦{financialsPreview.statutory_fees_total.toLocaleString()} (Excluded from margin).
                        Internal Cost Estimate: ₦{financialsPreview.internal_cost_total.toLocaleString()}.
                      </div>
                    </div>
                  )}

                  {/* Commercial Approval Alert */}
                  {financialsPreview.requires_approval && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-left text-xs text-amber-900 flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Executive Commercial Approval Required</span>
                        <ul className="list-disc list-inside text-[11px] text-amber-800 mt-0.5">
                          {financialsPreview.approval_reasons.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms and Internal Notes */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-slate-700">Client-facing Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Internal Pricing Notes (Confidential)</label>
                  <textarea
                    rows={3}
                    placeholder="Rationale for fee negotiations or cost estimates..."
                    value={formData.internal_notes}
                    onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
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
                  {submitting ? "Saving..." : "Save Draft Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* VIEW & PRINT QUOTATION MODAL */}
      {isPrintModalOpen && selectedQuote && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="print-modal-content w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            {/* Modal Controls */}
            <div className="no-print flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0A2558] bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                  {selectedQuote.quotation_number}
                </span>
                <span className="text-xs text-slate-400 capitalize">({selectedQuote.status})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Document
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="print-document p-4 border border-slate-200 rounded-xl bg-white space-y-6 print:border-none print:p-0">
              <DocumentHeader
                title="OFFICIAL QUOTATION"
                documentNumber={selectedQuote.quotation_number}
                date={selectedQuote.quotation_date}
                dueDate={selectedQuote.valid_until}
                dueLabel="Valid Until"
                status={selectedQuote.status}
                recipient={{
                  name: selectedQuote.client?.full_name,
                  phone: selectedQuote.client?.phone,
                  email: selectedQuote.client?.email,
                  businessName: selectedQuote.business?.name,
                }}
                recipientLabel="PREPARED FOR"
                paymentDetails={
                  defaultBankAccount && defaultBankAccount.account_number ? {
                    bankName: defaultBankAccount.bank_name,
                    accountName: defaultBankAccount.account_name,
                    accountNumber: defaultBankAccount.account_number,
                    notes: defaultBankAccount.notes,
                  } : undefined
                }
              />

              {/* Items Breakdown */}
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
                  {quoteItems.map((item, idx) => (
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

              {/* Totals Summary */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1.5 border-t border-slate-200 pt-2 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₦{Number(selectedQuote.subtotal).toLocaleString()}</span>
                  </div>
                  {Number(selectedQuote.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>-₦{Number(selectedQuote.discount_amount).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(selectedQuote.tax_amount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / VAT:</span>
                      <span>₦{Number(selectedQuote.tax_amount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1.5">
                    <span>Total Quoted:</span>
                    <span className="text-emerald-800">₦{Number(selectedQuote.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <DocumentFooter
                documentId={selectedQuote.id}
                notes={selectedQuote.terms_and_conditions || "This quotation is valid until the stated date. Formal engagement commences upon acceptance and confirmation of advance deposit."}
              />
            </div>

            {/* Status Management Actions */}
            {canManageFinance && (
              <div className="no-print mt-5 border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Transition Status:</span>
                  {selectedQuote.status === "draft" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedQuote.id, "sent")}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      Mark as Sent
                    </button>
                  )}
                  {(selectedQuote.status === "sent" || selectedQuote.status === "draft") && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(selectedQuote.id, "accepted")}
                        className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 font-semibold hover:bg-emerald-100"
                      >
                        Client Accepted
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedQuote.id, "rejected")}
                        className="rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-1 font-semibold hover:bg-red-100"
                      >
                        Client Rejected
                      </button>
                    </>
                  )}
                </div>

                {selectedQuote.status !== "converted" && (
                  <button
                    onClick={() => handleConvertToInvoice(selectedQuote)}
                    disabled={convertingId === selectedQuote.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] disabled:opacity-50 transition"
                  >
                    <Receipt className="h-4 w-4" />
                    {convertingId === selectedQuote.id ? "Converting..." : "Convert to Official Invoice"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
