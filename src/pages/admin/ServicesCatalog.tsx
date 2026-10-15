import { useEffect, useState } from "react";
import {
  Briefcase,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Plus,
  Tag,
  ShieldCheck,
  Eye,
  EyeOff,
  DollarSign,
  AlertCircle,
  FileText,
  Edit,
  Power,
  X,
  Loader2,
  Archive,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface CatalogService {
  id: string;
  name: string;
  slug: string;
  category: string;
  short_description: string;
  full_description?: string;
  deliverables?: string[] | any;
  requirements?: string[] | any;
  expected_turnaround_days: number;
  assigned_department: string;
  default_workflow?: string;
  is_active: boolean;
  is_publicly_visible: boolean;
  default_fee_ngn?: number;
  min_fee_ngn?: number;
  internal_cost_estimate?: number;
  pricing_notes?: string;
  public_display_order?: number;
}

export function ServicesCatalogPage() {
  const { profile, hasPermission } = useAuth();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedService, setSelectedService] = useState<CatalogService | null>(null);

  // Modals
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form State (Shared for create/edit)
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("business_registration");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formFullDesc, setFormFullDesc] = useState("");
  const [formTurnaround, setFormTurnaround] = useState(5);
  const [formDepartment, setFormDepartment] = useState("Legal & Compliance");
  const [formDefaultFee, setFormDefaultFee] = useState<string>("");
  const [formMinFee, setFormMinFee] = useState<string>("");
  const [formCostEstimate, setFormCostEstimate] = useState<string>("");
  const [formPricingNotes, setFormPricingNotes] = useState("");
  const [formDeliverables, setFormDeliverables] = useState("");
  const [formRequirements, setFormRequirements] = useState("");
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const role = profile?.role;
  const canManageCatalog =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager";

  const canViewPricing =
    hasPermission("finance", "view") ||
    role === "super_admin" ||
    role === "admin" ||
    role === "accounts_officer";

  const fetchServices = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services_catalog")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[ServicesCatalog] Fetch error:", error.message);
      } else if (data) {
        setServices(data as CatalogService[]);
        if (selectedService) {
          const updated = data.find((s: any) => s.id === selectedService.id);
          if (updated) setSelectedService(updated as CatalogService);
        }
      }
    } catch (err) {
      console.error("[ServicesCatalog] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormCategory("business_registration");
    setFormShortDesc("");
    setFormFullDesc("");
    setFormTurnaround(5);
    setFormDepartment("Legal & Compliance");
    setFormDefaultFee("");
    setFormMinFee("");
    setFormCostEstimate("");
    setFormPricingNotes("");
    setFormDeliverables("");
    setFormRequirements("");
    setFormIsPublic(true);
    setFormIsActive(true);
    setFormError("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreating(true);
  };

  const openEditModal = (svc: CatalogService) => {
    setFormName(svc.name);
    setFormCategory(svc.category);
    setFormShortDesc(svc.short_description || "");
    setFormFullDesc(svc.full_description || "");
    setFormTurnaround(svc.expected_turnaround_days || 5);
    setFormDepartment(svc.assigned_department || "Legal & Compliance");
    setFormDefaultFee(svc.default_fee_ngn ? String(svc.default_fee_ngn) : "");
    setFormMinFee(svc.min_fee_ngn ? String(svc.min_fee_ngn) : "");
    setFormCostEstimate(svc.internal_cost_estimate ? String(svc.internal_cost_estimate) : "");
    setFormPricingNotes(svc.pricing_notes || "");

    const delivs = Array.isArray(svc.deliverables)
      ? svc.deliverables.map((d: any) => (typeof d === "string" ? d : d.title || "")).join("\n")
      : "";
    setFormDeliverables(delivs);

    const reqs = Array.isArray(svc.requirements)
      ? svc.requirements.map((r: any) => (typeof r === "string" ? r : r.title || "")).join("\n")
      : "";
    setFormRequirements(reqs);

    setFormIsPublic(svc.is_publicly_visible);
    setFormIsActive(svc.is_active);
    setFormError("");
    setIsEditing(true);
  };

  const parseLines = (text: string): string[] => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Submit Create
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canManageCatalog) return;
    if (!formName.trim() || !formShortDesc.trim()) {
      setFormError("Service name and short description are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const slug = generateSlug(formName);
      const payload: any = {
        name: formName.trim(),
        slug,
        category: formCategory,
        short_description: formShortDesc.trim(),
        full_description: formFullDesc.trim() || null,
        expected_turnaround_days: Number(formTurnaround) || 5,
        assigned_department: formDepartment.trim() || "Legal & Compliance",
        default_fee_ngn: formDefaultFee ? Number(formDefaultFee) : null,
        min_fee_ngn: formMinFee ? Number(formMinFee) : null,
        internal_cost_estimate: formCostEstimate ? Number(formCostEstimate) : null,
        pricing_notes: formPricingNotes.trim() || null,
        deliverables: parseLines(formDeliverables),
        requirements: parseLines(formRequirements),
        is_publicly_visible: formIsPublic,
        is_active: formIsActive,
      };

      const { data, error } = await supabase
        .from("services_catalog")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("activity_timeline").insert({
        entity_type: "services_catalog",
        entity_id: data.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "catalog_service_created",
        event_title: `Added service to catalog: ${data.name}`,
      });

      setIsCreating(false);
      resetForm();
      await fetchServices();
    } catch (err: any) {
      console.error("[ServicesCatalog] Create error:", err);
      setFormError(err?.message || "Failed to create catalog service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedService || !canManageCatalog) return;
    if (!formName.trim() || !formShortDesc.trim()) {
      setFormError("Service name and short description are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload: any = {
        name: formName.trim(),
        category: formCategory,
        short_description: formShortDesc.trim(),
        full_description: formFullDesc.trim() || null,
        expected_turnaround_days: Number(formTurnaround) || 5,
        assigned_department: formDepartment.trim() || "Legal & Compliance",
        default_fee_ngn: formDefaultFee ? Number(formDefaultFee) : null,
        min_fee_ngn: formMinFee ? Number(formMinFee) : null,
        internal_cost_estimate: formCostEstimate ? Number(formCostEstimate) : null,
        pricing_notes: formPricingNotes.trim() || null,
        deliverables: parseLines(formDeliverables),
        requirements: parseLines(formRequirements),
        is_publicly_visible: formIsPublic,
        is_active: formIsActive,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("services_catalog")
        .update(payload)
        .eq("id", selectedService.id);

      if (error) throw error;

      await supabase.from("activity_timeline").insert({
        entity_type: "services_catalog",
        entity_id: selectedService.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "catalog_service_updated",
        event_title: `Updated service catalog item: ${formName.trim()}`,
      });

      setIsEditing(false);
      await fetchServices();
    } catch (err: any) {
      console.error("[ServicesCatalog] Edit error:", err);
      setFormError(err?.message || "Failed to update catalog service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active State (Soft Archive instead of unsafe hard delete)
  const handleToggleActiveState = async (service: CatalogService) => {
    if (!supabase || !canManageCatalog) return;
    const nextState = !service.is_active;
    const actionLabel = nextState ? "reactivate" : "deactivate (archive)";

    if (!window.confirm(`Are you sure you want to ${actionLabel} "${service.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("services_catalog")
        .update({ is_active: nextState, updated_at: new Date().toISOString() })
        .eq("id", service.id);

      if (error) throw error;

      await supabase.from("activity_timeline").insert({
        entity_type: "services_catalog",
        entity_id: service.id,
        actor_type: "staff",
        actor_id: profile?.id,
        event_type: "catalog_service_status_toggled",
        event_title: `${nextState ? "Reactivated" : "Deactivated"} catalog service: ${service.name}`,
      });

      await fetchServices();
    } catch (err: any) {
      alert("Failed to toggle status: " + err?.message);
    }
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.short_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = ["all", ...Array.from(new Set(services.map((s) => s.category)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services Catalogue</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Master Operations
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Internal master catalog with turnaround SLAs, client deliverables, and reference pricing baselines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0A2558]">
            <span>{services.length} Registered Services</span>
          </div>

          {canManageCatalog && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Service</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by service name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/10 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#0A2558] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading service definitions from Supabase...
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No matching services found</p>
          <p className="text-[11px] text-slate-400 mt-1">Try clearing your search query or category filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              onClick={() => setSelectedService(service)}
              className={`group cursor-pointer flex flex-col justify-between rounded-xl border bg-white p-4 hover:border-blue-500 hover:shadow-xs transition ${
                !service.is_active ? "opacity-60 border-dashed border-slate-300 bg-slate-50/50" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {service.category.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3 text-emerald-600" />
                    <span>{service.expected_turnaround_days}d SLA</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-800 transition">
                    {service.name}
                  </h3>
                  {!service.is_active && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                      Archived
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{service.short_description}</p>
              </div>

              {/* Internal Reference Fee Display (Protected) */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Default Fee</span>
                  <p className="text-xs font-bold text-slate-900">
                    {canViewPricing && service.default_fee_ngn
                      ? `₦${Number(service.default_fee_ngn).toLocaleString()}`
                      : "Internal Only"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {service.is_publicly_visible ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <Eye className="h-2.5 w-2.5" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      <EyeOff className="h-2.5 w-2.5" /> Internal
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Detail Modal */}
      {selectedService && !isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                  {selectedService.category.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-lg font-bold text-slate-900">{selectedService.name}</h2>
                  {!selectedService.is_active && (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      Archived / Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Department: {selectedService.assigned_department}</p>
              </div>

              <button
                onClick={() => setSelectedService(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Description</h4>
                <p className="text-slate-600 leading-relaxed">
                  {selectedService.full_description || selectedService.short_description}
                </p>
              </div>

              {canViewPricing && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 space-y-2">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-700" />
                    Internal Suite Pricing Reference
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2 border border-emerald-200/50">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Default Fee</span>
                      <p className="text-xs font-bold text-slate-900">
                        ₦{Number(selectedService.default_fee_ngn || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-emerald-200/50">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Floor (Min Fee)</span>
                      <p className="text-xs font-bold text-slate-900">
                        ₦{Number(selectedService.min_fee_ngn || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-emerald-200/50">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Cost Estimate</span>
                      <p className="text-xs font-bold text-slate-900">
                        ₦{Number(selectedService.internal_cost_estimate || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {selectedService.pricing_notes && (
                    <p className="text-[11px] text-emerald-800/80 italic mt-1">
                      Note: {selectedService.pricing_notes}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Turnaround Time SLA</h4>
                <p className="text-slate-600">{selectedService.expected_turnaround_days} Business Days</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Deliverables</h4>
                {selectedService.deliverables && Array.isArray(selectedService.deliverables) && selectedService.deliverables.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {selectedService.deliverables.map((d: any, i: number) => (
                      <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic">None specified</p>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Requirements from Client</h4>
                {selectedService.requirements && Array.isArray(selectedService.requirements) && selectedService.requirements.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {selectedService.requirements.map((r: any, i: number) => (
                      <li key={i}>{typeof r === "string" ? r : JSON.stringify(r)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic">None specified</p>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                {canManageCatalog && (
                  <button
                    onClick={() => handleToggleActiveState(selectedService)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedService.is_active
                        ? "border-red-200 text-red-700 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>{selectedService.is_active ? "Deactivate (Archive)" : "Reactivate"}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {canManageCatalog && (
                  <button
                    onClick={() => openEditModal(selectedService)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#061738] transition shadow-xs"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit Service</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedService(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {isCreating ? "Add New Service to Catalog" : `Edit Service: ${selectedService?.name}`}
              </h2>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={isCreating ? handleCreateService : handleEditService} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Service Name *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Business Name Registration"
                    required
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600 font-semibold"
                  >
                    <option value="business_registration">Business Registration</option>
                    <option value="company_incorporation">Company Incorporation</option>
                    <option value="post_incorporation">Post-Incorporation</option>
                    <option value="compliance_tax">Compliance & Tax</option>
                    <option value="trademark_ip">Trademark & IP</option>
                    <option value="advisory_support">Advisory & Legal</option>
                    <option value="general">General Services</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Short Summary *</label>
                <input
                  value={formShortDesc}
                  onChange={(e) => setFormShortDesc(e.target.value)}
                  placeholder="One sentence summary for client cards..."
                  required
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Full Description</label>
                <textarea
                  rows={2}
                  value={formFullDesc}
                  onChange={(e) => setFormFullDesc(e.target.value)}
                  placeholder="Detailed breakdown of what this service covers..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Expected SLA Turnaround (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formTurnaround}
                    onChange={(e) => setFormTurnaround(Number(e.target.value))}
                    required
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assigned Department</label>
                  <input
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Pricing Fields (Internal Reference) */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 space-y-3">
                <span className="text-[10px] font-bold uppercase text-emerald-900">Reference Pricing (NGN)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Default Fee</label>
                    <input
                      type="number"
                      value={formDefaultFee}
                      onChange={(e) => setFormDefaultFee(e.target.value)}
                      placeholder="e.g. 25000"
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Floor (Min Fee)</label>
                    <input
                      type="number"
                      value={formMinFee}
                      onChange={(e) => setFormMinFee(e.target.value)}
                      placeholder="e.g. 20000"
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Internal Cost Est.</label>
                    <input
                      type="number"
                      value={formCostEstimate}
                      onChange={(e) => setFormCostEstimate(e.target.value)}
                      placeholder="e.g. 15000"
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Pricing Notes</label>
                  <input
                    value={formPricingNotes}
                    onChange={(e) => setFormPricingNotes(e.target.value)}
                    placeholder="e.g. Includes statutory filing fee; stamp duty extra."
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Deliverables (one per line)</label>
                  <textarea
                    rows={2}
                    value={formDeliverables}
                    onChange={(e) => setFormDeliverables(e.target.value)}
                    placeholder="CAC Certificate&#10;Status Report&#10;Tax Identification Number"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Requirements (one per line)</label>
                  <textarea
                    rows={2}
                    value={formRequirements}
                    onChange={(e) => setFormRequirements(e.target.value)}
                    placeholder="Valid ID Card&#10;Passport Photo&#10;Signature Specimen"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span>Publicly Visible on Website</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600"
                  />
                  <span>Active in Suite</span>
                </label>
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : isCreating ? "Create Service" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
