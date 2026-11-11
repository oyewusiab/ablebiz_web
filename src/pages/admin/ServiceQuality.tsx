import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  MessageSquare,
  AlertTriangle,
  Send,
  Building2,
  Calendar,
  ChevronRight,
  Upload,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  ClientComplaintRecord,
  ClientFeedbackRecord,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ServiceQualityReviewRecord,
} from "../../lib/quality/types";
import {
  computeQualitySummaryMetrics,
  evaluateComplaintEscalation,
  generateComplaintNumber,
  generateQualityReviewNumber,
  getFeedbackIntegrationConfig,
  aggregateOfficerQualitySummary,
} from "../../lib/quality/qualityService";

export function ServiceQualityPage() {
  const { user, profile, hasPermission } = useAuth();
  const [feedbackList, setFeedbackList] = useState<ClientFeedbackRecord[]>([]);
  const [complaintsList, setComplaintsList] = useState<ClientComplaintRecord[]>([]);
  const [reviewsList, setReviewsList] = useState<ServiceQualityReviewRecord[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "complaints" | "reviews" | "integration">("overview");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterComplaintStatus, setFilterComplaintStatus] = useState<string>("all");

  // Modals
  const [isRegisterComplaintOpen, setIsRegisterComplaintOpen] = useState(false);
  const [isResolveComplaintOpen, setIsResolveComplaintOpen] = useState(false);
  const [isManualFeedbackOpen, setIsManualFeedbackOpen] = useState(false);
  const [isRecordReviewOpen, setIsRecordReviewOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ClientComplaintRecord | null>(null);

  // New Complaint Form
  const [complaintForm, setComplaintForm] = useState({
    client_id: "",
    service_id: "",
    category: "service_quality" as ComplaintCategory,
    title: "",
    description: "",
    priority: "normal" as ComplaintPriority,
    assigned_officer_id: "",
    response_target_hours: 24,
    resolution_target_hours: 72,
  });

  // Resolve Complaint Form
  const [resolveForm, setResolveForm] = useState({
    root_cause: "",
    corrective_action: "",
    resolution_notes: "",
    is_verified_defect: false,
    client_response: "",
  });

  // Manual Feedback Form
  const [manualFeedbackForm, setManualFeedbackForm] = useState({
    client_name: "",
    client_phone: "",
    rating: 5,
    professionalism_rating: 5,
    timeliness_rating: 5,
    communication_rating: 5,
    comments: "",
    source: "external_bitly_form" as const,
  });

  const isManagement = ["super_admin", "admin", "operations_manager"].includes(profile?.role || "");

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Feedback
      const { data: fbData } = await supabase
        .from("client_feedback")
        .select(`
          *,
          client:clients(id, full_name, phone, email),
          service:services_catalog(id, name),
          assigned_officer:staff_profiles!assigned_officer_id(id, full_name, role)
        `)
        .order("created_at", { ascending: false });

      if (fbData) setFeedbackList(fbData as any);

      // 2. Complaints
      const { data: cmpData } = await supabase
        .from("client_complaints")
        .select(`
          *,
          client:clients(id, full_name, phone, email),
          service:services_catalog(id, name),
          assigned_officer:staff_profiles!assigned_officer_id(id, full_name, role)
        `)
        .order("created_at", { ascending: false });

      if (cmpData) setComplaintsList(cmpData as any);

      // 3. Reviews
      const { data: revData } = await supabase
        .from("service_quality_reviews")
        .select(`
          *,
          reviewed_officer:staff_profiles!reviewed_officer_id(id, full_name, role)
        `)
        .order("created_at", { ascending: false });

      if (revData) setReviewsList(revData as any);

      // 4. Staff
      const { data: staffData } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role, is_active")
        .eq("is_active", true);

      if (staffData) setStaffList(staffData);

      // 5. Clients
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, full_name, phone, email")
        .eq("is_active", true)
        .limit(100);

      if (clientData) setClientsList(clientData);

      // 6. Services
      const { data: serviceData } = await supabase
        .from("services_catalog")
        .select("id, name")
        .limit(50);

      if (serviceData) setServicesList(serviceData);
    } catch (err) {
      console.error("Error loading service quality data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    return computeQualitySummaryMetrics({
      feedbackList,
      complaintsList,
      satisfactionThreshold: 4,
    });
  }, [feedbackList, complaintsList]);

  // Complaints Resolution Queue Filter
  const filteredComplaints = useMemo(() => {
    return complaintsList.filter((cmp) => {
      if (filterComplaintStatus !== "all" && cmp.status !== filterComplaintStatus) return false;
      if (filterCategory !== "all" && cmp.category !== filterCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const clientName = cmp.client?.full_name?.toLowerCase() || "";
        const title = cmp.title?.toLowerCase() || "";
        const num = cmp.complaint_number?.toLowerCase() || "";
        if (!clientName.includes(q) && !title.includes(q) && !num.includes(q)) return false;
      }
      return true;
    });
  }, [complaintsList, filterComplaintStatus, filterCategory, searchTerm]);

  // Register Complaint Handler
  const handleRegisterComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.client_id || !complaintForm.title.trim() || !complaintForm.description.trim()) {
      alert("Please provide the client, title, and description.");
      return;
    }

    const complaintNumber = generateComplaintNumber();

    const newRecord: ClientComplaintRecord = {
      id: `local-${Date.now()}`,
      complaint_number: complaintNumber,
      client_id: complaintForm.client_id,
      service_id: complaintForm.service_id || null,
      category: complaintForm.category,
      title: complaintForm.title.trim(),
      description: complaintForm.description.trim(),
      date_received: new Date().toISOString().slice(0, 10),
      priority: complaintForm.priority,
      assigned_officer_id: complaintForm.assigned_officer_id || null,
      response_target_hours: complaintForm.response_target_hours,
      resolution_target_hours: complaintForm.resolution_target_hours,
      status: "received",
      is_verified_defect: false,
      is_escalated: false,
      created_by: profile?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client: clientsList.find((c) => c.id === complaintForm.client_id),
      service: servicesList.find((s) => s.id === complaintForm.service_id),
      assigned_officer: staffList.find((s) => s.id === complaintForm.assigned_officer_id),
    };

    if (supabase) {
      await supabase.from("client_complaints").insert([
        {
          complaint_number: newRecord.complaint_number,
          client_id: newRecord.client_id,
          service_id: newRecord.service_id,
          category: newRecord.category,
          title: newRecord.title,
          description: newRecord.description,
          priority: newRecord.priority,
          assigned_officer_id: newRecord.assigned_officer_id,
          response_target_hours: newRecord.response_target_hours,
          resolution_target_hours: newRecord.resolution_target_hours,
          status: "received",
          created_by: profile?.id || null,
        },
      ]);
    }

    setComplaintsList((prev) => [newRecord, ...prev]);
    setIsRegisterComplaintOpen(false);
    setComplaintForm({
      client_id: "",
      service_id: "",
      category: "service_quality",
      title: "",
      description: "",
      priority: "normal",
      assigned_officer_id: "",
      response_target_hours: 24,
      resolution_target_hours: 72,
    });
  };

  // Resolve Complaint Handler
  const handleResolveSubmit = async () => {
    if (!selectedComplaint) return;

    const resolutionDate = new Date().toISOString();

    if (supabase) {
      await supabase
        .from("client_complaints")
        .update({
          status: "resolved",
          root_cause: resolveForm.root_cause.trim() || null,
          corrective_action: resolveForm.corrective_action.trim() || null,
          resolution_notes: resolveForm.resolution_notes.trim() || null,
          is_verified_defect: resolveForm.is_verified_defect,
          client_response: resolveForm.client_response.trim() || null,
          resolution_date: resolutionDate,
          updated_at: resolutionDate,
        })
        .eq("id", selectedComplaint.id);
    }

    setComplaintsList((prev) =>
      prev.map((c) =>
        c.id === selectedComplaint.id
          ? {
              ...c,
              status: "resolved",
              root_cause: resolveForm.root_cause.trim(),
              corrective_action: resolveForm.corrective_action.trim(),
              resolution_notes: resolveForm.resolution_notes.trim(),
              is_verified_defect: resolveForm.is_verified_defect,
              resolution_date: resolutionDate,
            }
          : c
      )
    );

    setIsResolveComplaintOpen(false);
    setSelectedComplaint(null);
  };

  // Manual Feedback Submission Handler
  const handleManualFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFeedbackForm.client_name.trim()) {
      alert("Please enter the client name.");
      return;
    }

    const newFb: ClientFeedbackRecord = {
      id: `local-${Date.now()}`,
      client_name: manualFeedbackForm.client_name.trim(),
      client_phone: manualFeedbackForm.client_phone.trim() || null,
      rating: manualFeedbackForm.rating,
      professionalism_rating: manualFeedbackForm.professionalism_rating,
      timeliness_rating: manualFeedbackForm.timeliness_rating,
      communication_rating: manualFeedbackForm.communication_rating,
      comments: manualFeedbackForm.comments.trim() || null,
      source: manualFeedbackForm.source,
      is_verified: true,
      status: "published",
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      await supabase.from("client_feedback").insert([
        {
          client_name: newFb.client_name,
          client_phone: newFb.client_phone,
          rating: newFb.rating,
          professionalism_rating: newFb.professionalism_rating,
          timeliness_rating: newFb.timeliness_rating,
          communication_rating: newFb.communication_rating,
          comments: newFb.comments,
          source: newFb.source,
          is_verified: true,
          status: "published",
        },
      ]);
    }

    setFeedbackList((prev) => [newFb, ...prev]);
    setIsManualFeedbackOpen(false);
    setManualFeedbackForm({
      client_name: "",
      client_phone: "",
      rating: 5,
      professionalism_rating: 5,
      timeliness_rating: 5,
      communication_rating: 5,
      comments: "",
      source: "external_bitly_form",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Client Satisfaction & Service Quality Management
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Measure client satisfaction, audit service delivery, resolve complaints, and protect client retention.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsManualFeedbackOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            Log External Feedback
          </button>

          <button
            onClick={() => setIsRegisterComplaintOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <AlertCircle className="h-4 w-4" />
            Register Complaint
          </button>
        </div>
      </div>

      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Average Rating</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-amber-500">{metrics.averageSatisfaction}</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400">{metrics.totalFeedbackCount} client ratings</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Satisfied Clients</p>
          <div className="text-2xl font-bold text-emerald-600 mt-0.5">{metrics.satisfiedPercentage}%</div>
          <span className="text-[10px] text-slate-400">Ratings &gt;= 4 stars</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Net Promoter Score</p>
          <div className="text-2xl font-bold text-purple-600 mt-0.5">
            {metrics.npsScore !== null ? `+${metrics.npsScore}` : "N/A"}
          </div>
          <span className="text-[10px] text-slate-400">Advocacy propensity</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Active Complaints</p>
          <div className="text-2xl font-bold text-rose-500 mt-0.5">{metrics.activeComplaints}</div>
          <span className="text-[10px] text-slate-400">In resolution queue</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Overdue Complaints</p>
          <div className="text-2xl font-bold text-rose-600 mt-0.5">{metrics.overdueComplaints}</div>
          <span className="text-[10px] text-rose-500 font-semibold">Exceeded resolution SLA</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Avg Resolution</p>
          <div className="text-2xl font-bold text-blue-600 mt-0.5">{metrics.averageResolutionHours}h</div>
          <span className="text-[10px] text-slate-400">Hours to ticket close</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        {[
          { id: "overview", label: "Executive Overview" },
          { id: "feedback", label: `Client Feedback (${feedbackList.length})` },
          { id: "complaints", label: `Complaints Queue (${metrics.activeComplaints} open)` },
          { id: "reviews", label: `Quality Reviews (${reviewsList.length})` },
          { id: "integration", label: "Survey & Bitly Integration" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 transition ${
              activeTab === tab.id
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rating Distribution */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              Client Satisfaction Rating Breakdown
            </h3>

            <div className="space-y-2 text-xs">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = metrics.ratingDistribution[star] || 0;
                const pct = metrics.totalFeedbackCount > 0 ? Math.round((count / metrics.totalFeedbackCount) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="w-12 font-medium text-slate-600 dark:text-slate-400">{star} Stars</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          star >= 4 ? "bg-emerald-500" : star === 3 ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complaint Categories */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Complaint Categories & Root Causes
            </h3>

            <div className="space-y-2 text-xs">
              {Object.entries(metrics.complaintCategoryBreakdown).map(([category, count]) => {
                const pct = metrics.totalComplaints > 0 ? Math.round((count / metrics.totalComplaints) * 100) : 0;
                return (
                  <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">
                      {category.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {count} tickets ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FEEDBACK SUBMISSIONS */}
      {activeTab === "feedback" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Client Feedback Submissions</h3>
            <button
              onClick={() => setIsManualFeedbackOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              Log External Entry
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {feedbackList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No feedback records registered yet.</div>
            ) : (
              feedbackList.map((fb) => (
                <div key={fb.id} className="p-4 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white text-xs">
                        {fb.client_name || fb.client?.full_name || "Anonymous Client"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        via {fb.source.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {fb.comments && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg">
                      "{fb.comments}"
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    {fb.service && <span>Service: {fb.service.name}</span>}
                    {fb.assigned_officer && <span>Assigned: {fb.assigned_officer.full_name}</span>}
                    <span>Date: {new Date(fb.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLAINTS RESOLUTION QUEUE */}
      {activeTab === "complaints" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Complaints & Resolution Queue</h3>

            <div className="flex items-center gap-2">
              <select
                value={filterComplaintStatus}
                onChange={(e) => setFilterComplaintStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="all">All Ticket Statuses</option>
                <option value="received">Received / New</option>
                <option value="assigned">Assigned</option>
                <option value="resolution_in_progress">Resolution in Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <button
                onClick={() => setIsRegisterComplaintOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                New Complaint
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Ref & Subject</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Officer</th>
                  <th className="py-3 px-4">Status & SLA</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No complaints registered matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((cmp) => {
                    const escalation = evaluateComplaintEscalation(cmp);
                    return (
                      <tr key={cmp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{cmp.title}</div>
                          <div className="text-[10px] font-mono text-slate-400">{cmp.complaint_number}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {cmp.client?.full_name || "Unknown"}
                          </div>
                          <div className="text-[10px] text-slate-400">{cmp.client?.phone}</div>
                        </td>

                        <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-300">
                          {cmp.category.replace(/_/g, " ")}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              cmp.priority === "urgent"
                                ? "bg-rose-100 text-rose-800"
                                : cmp.priority === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {cmp.priority}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 dark:text-slate-200">
                            {cmp.assigned_officer?.full_name || "Unassigned"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              cmp.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : cmp.status === "received"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {cmp.status.replace(/_/g, " ")}
                          </span>
                          {escalation.isOverdue && (
                            <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">
                              Overdue by {escalation.hoursElapsed - cmp.resolution_target_hours}h
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {cmp.status !== "resolved" && (
                            <button
                              onClick={() => {
                                setSelectedComplaint(cmp);
                                setIsResolveComplaintOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: QUALITY REVIEWS */}
      {activeTab === "reviews" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Internal Service Quality Audits</h3>
              <p className="text-xs text-slate-500">
                Audits performed by Operations Managers on completed filings before client delivery.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reviewsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No service quality audits recorded yet.</div>
            ) : (
              reviewsList.map((rev) => (
                <div key={rev.id} className="py-3 flex items-start justify-between text-xs">
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{rev.review_number}</h4>
                    <p className="text-slate-500 text-[11px]">Reviewed Officer: {rev.reviewed_officer?.full_name}</p>
                    {rev.findings && <p className="text-slate-600 dark:text-slate-400 mt-1 italic">"{rev.findings}"</p>}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      rev.outcome === "passed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {rev.outcome.replace(/_/g, " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SURVEY & BITLY INTEGRATION */}
      {activeTab === "integration" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="border-b pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ABLEBIZ Feedback & Survey Link Architecture
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Integration status of historical bit.ly short-links and native ABLEBIZ Suite client experience tools.
            </p>
          </div>

          {(() => {
            const cfg = getFeedbackIntegrationConfig();
            return (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      Evaluated External Link: {cfg.officialFeedbackUrl}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{cfg.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Native In-Suite Survey URL</h4>
                    <p className="text-slate-500 text-[11px]">
                      Share direct survey link with clients following service completion:
                    </p>
                    <code className="block p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-emerald-600">
                      https://www.ablebiz.com.ng/feedback
                    </code>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Manual Entry & External Import</h4>
                    <p className="text-slate-500 text-[11px]">
                      Safely log customer feedback received via phone calls, WhatsApp, or Google Forms:
                    </p>
                    <button
                      onClick={() => setIsManualFeedbackOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                    >
                      Record External Survey Entry
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* REGISTER COMPLAINT MODAL */}
      {isRegisterComplaintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Register Client Complaint Ticket
            </h3>

            <form onSubmit={handleRegisterComplaint} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Client *</label>
                <select
                  required
                  value={complaintForm.client_id}
                  onChange={(e) => setComplaintForm({ ...complaintForm, client_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Select client...</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category *</label>
                  <select
                    value={complaintForm.category}
                    onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value as ComplaintCategory })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="delayed_service">Delayed Service</option>
                    <option value="communication_issue">Communication Issue</option>
                    <option value="documentation_error">Documentation Error</option>
                    <option value="incorrect_information">Incorrect Information</option>
                    <option value="billing_concern">Billing Concern</option>
                    <option value="service_quality">Service Quality</option>
                    <option value="staff_conduct">Staff Conduct</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={complaintForm.priority}
                    onChange={(e) => setComplaintForm({ ...complaintForm, priority: e.target.value as ComplaintPriority })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Subject / Summary *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAC Filing Delay on Business Name"
                  value={complaintForm.title}
                  onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the client's concern, timeline impact, and context..."
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Assign to Officer</label>
                <select
                  value={complaintForm.assigned_officer_id}
                  onChange={(e) => setComplaintForm({ ...complaintForm, assigned_officer_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRegisterComplaintOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
                >
                  Register Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE COMPLAINT MODAL */}
      {isResolveComplaintOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Resolve Complaint ({selectedComplaint.complaint_number})
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Root Cause Analysis</label>
                <textarea
                  rows={2}
                  placeholder="What caused the delay or breakdown in service?"
                  value={resolveForm.root_cause}
                  onChange={(e) => setResolveForm({ ...resolveForm, root_cause: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Corrective Action Taken</label>
                <textarea
                  rows={2}
                  placeholder="Action taken to rectify the issue for the client..."
                  value={resolveForm.corrective_action}
                  onChange={(e) => setResolveForm({ ...resolveForm, corrective_action: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={resolveForm.is_verified_defect}
                  onChange={(e) => setResolveForm({ ...resolveForm, is_verified_defect: e.target.checked })}
                />
                <span>Verified Internal Service Defect (distinguishes confirmed errors from external portal downtime)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsResolveComplaintOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolveSubmit}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  Close & Resolve Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOG EXTERNAL FEEDBACK MODAL */}
      {isManualFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-500" />
              Log External Client Feedback
            </h3>

            <p className="text-xs text-slate-500">
              Record client feedback collected via bit.ly/ablefeedback, telephone outreach, or post-delivery check-in.
            </p>

            <form onSubmit={handleManualFeedbackSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Olufemi"
                  value={manualFeedbackForm.client_name}
                  onChange={(e) => setManualFeedbackForm({ ...manualFeedbackForm, client_name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Satisfaction Rating (1-5 Stars)</label>
                <select
                  value={manualFeedbackForm.rating}
                  onChange={(e) => setManualFeedbackForm({ ...manualFeedbackForm, rating: Number(e.target.value) })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value={5}>5 Stars - Excellent</option>
                  <option value={4}>4 Stars - Very Good</option>
                  <option value={3}>3 Stars - Good</option>
                  <option value={2}>2 Stars - Fair</option>
                  <option value={1}>1 Star - Poor</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Feedback Comments</label>
                <textarea
                  rows={3}
                  placeholder="Notes from the client..."
                  value={manualFeedbackForm.comments}
                  onChange={(e) => setManualFeedbackForm({ ...manualFeedbackForm, comments: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsManualFeedbackOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  Save Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
