import { useEffect, useState } from "react";
import {
  FileCheck2,
  Search,
  Filter,
  Plus,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

export interface ServiceRequest {
  id: string;
  tracking_id: string;
  client_id: string;
  business_id?: string;
  service_id: string;
  assigned_staff_id?: string;
  title: string;
  status: string;
  priority: string;
  intake_notes?: string;
  created_at: string;
  // Joins
  client?: { full_name: string; phone: string; email: string };
  business?: { name: string };
  service?: { name: string; category: string };
}

export function ServiceRequestsPage() {
  const { user, profile, hasPermission } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const canCreate = hasPermission("operations", "create");

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          id,
          tracking_id,
          client_id,
          business_id,
          service_id,
          assigned_staff_id,
          title,
          status,
          priority,
          intake_notes,
          created_at,
          client:clients(full_name, phone, email),
          business:businesses(name),
          service:services_catalog(name, category)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ServiceRequests] Fetch error:", error.message);
      } else if (data) {
        setRequests(data as any[]);
      }
    } catch (err) {
      console.error("[ServiceRequests] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tracking_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = [
    "all",
    "pending_review",
    "quoted",
    "in_progress",
    "awaiting_client",
    "under_review",
    "completed",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Service Requests</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Operations Hub
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Central operational lifecycle linking clients, businesses, filing tasks, quotations, and documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            <span>{requests.length} Operational Engagements</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by request title, tracking code, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/10 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#043F2E] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading service requests from database...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileCheck2 className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-700">No active service requests found</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Service requests appear here when consultations or client workflows are initiated.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Tracking ID</th>
                  <th className="px-4 py-3.5">Request Title</th>
                  <th className="px-4 py-3.5">Client & Business</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      {req.tracking_id}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{req.title}</p>
                      <p className="text-[11px] text-slate-500">{req.service?.name || "General Engagement"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{req.client?.full_name || "Unassigned Client"}</p>
                      <p className="text-[11px] text-slate-500">{req.business?.name || "Individual"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        req.priority === "urgent"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : req.priority === "high"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        req.status === "completed"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : req.status === "in_progress"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {req.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
