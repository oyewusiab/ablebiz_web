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
  const { user, profile, hasPermission } = useAuth();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedService, setSelectedService] = useState<CatalogService | null>(null);

  const canEdit = hasPermission("operations", "edit");
  const canViewPricing = hasPermission("finance", "view") || profile?.role === "super_admin" || profile?.role === "admin";

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
              Operations
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Internal master catalog with turnaround baselines, client deliverables, and internal reference pricing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0A2558]">
            <span>{services.length} Registered Services</span>
          </div>
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
              className="group cursor-pointer flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-500 hover:shadow-xs transition"
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

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition">
                  {service.name}
                </h3>
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

                <div className="flex items-center gap-2">
                  {service.is_publicly_visible ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <Eye className="h-2.5 w-2.5" /> Public View
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
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                  {selectedService.category.replace(/_/g, " ")}
                </span>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedService.name}</h2>
                <p className="text-xs text-slate-500">Assigned: {selectedService.assigned_department}</p>
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
                <h4 className="font-bold text-slate-900 mb-1">Turnaround Time</h4>
                <p className="text-slate-600">{selectedService.expected_turnaround_days} Business Days</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Deliverables</h4>
                {selectedService.deliverables && Array.isArray(selectedService.deliverables) ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {selectedService.deliverables.map((d: any, i: number) => (
                      <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic">None specified</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedService(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
