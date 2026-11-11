import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  MessageSquare,
  Phone,
  Mail,
  Building2,
  FileCheck2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Award,
  Layers,
  X,
  Send,
  HelpCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  calculateComplianceDeadlineStatus,
  computeComplianceSummary,
  composeComplianceReminderMessage,
  createComplianceFollowUpOpportunity,
  calculateNextComplianceDueDate,
  fetchComplianceDataset,
  ComplianceObligationRecord,
  ComplianceRule,
  ComplianceReminderRecord,
  ComplianceStatus,
  OpportunityStatus,
  DEFAULT_COMPLIANCE_RULES,
} from "../../lib/compliance/complianceService";

export function ComplianceCalendarPage() {
  const { profile, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<{
    obligations: ComplianceObligationRecord[];
    rules: ComplianceRule[];
    reminders: ComplianceReminderRecord[];
    clients: any[];
    businesses: any[];
    services: any[];
    staffProfiles: any[];
  } | null>(null);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"calendar" | "obligations" | "opportunities" | "rules">("calendar");

  // Filters for Obligations
  const [filterDueWindow, setFilterDueWindow] = useState<"all" | "30d" | "60d" | "90d" | "overdue" | "completed">("30d");
  const [filterEntityType, setFilterEntityType] = useState("all");
  const [filterOfficerId, setFilterOfficerId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Calendar State (Month View in Africa/Lagos)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    business_id: "",
    obligation_name: "CAC Annual Returns",
    obligation_type: "cac_annual_returns" as any,
    applicable_entity_type: "business_name" as any,
    service_id: "",
    due_date: new Date(new Date().getFullYear(), 5, 30).toISOString().split("T")[0], // Default 30th June
    recurrence_frequency: "annual" as any,
    assigned_officer_id: "",
    statutory_source: "CAMA 2020 s. 822 / CAC Annual Return Regulations",
    verification_status: "verified" as "verified" | "requires_verification",
    notes: "",
  });

  const [reminderModalData, setReminderModalData] = useState<{
    obligation: ComplianceObligationRecord;
    channel: "email" | "whatsapp" | "phone";
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageCompliance =
    profile?.role === "super_admin" ||
    profile?.role === "admin" ||
    profile?.role === "operations_manager" ||
    profile?.role === "registration_officer" ||
    profile?.role === "client_service_officer" ||
    hasPermission("operations", "edit");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchComplianceDataset();
      setDataset(data);
    } catch (err) {
      console.error("[ComplianceCalendar] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Compute Metrics Summary dynamically
  const summaryMetrics = useMemo(() => {
    if (!dataset) {
      return {
        totalActiveObligations: 0,
        dueNext30Days: 0,
        dueNext60Days: 0,
        dueNext90Days: 0,
        overdueCount: 0,
        completedThisYear: 0,
        recurringOpportunitiesIdentified: 0,
        recurringOpportunitiesConverted: 0,
        requiresVerificationCount: 0,
      };
    }
    return computeComplianceSummary(dataset.obligations, new Date());
  }, [dataset]);

  // Filtered Obligations List
  const filteredObligations = useMemo(() => {
    if (!dataset) return [];
    const now = new Date();

    return dataset.obligations.filter((ob) => {
      if (filterEntityType !== "all" && ob.applicable_entity_type !== filterEntityType) return false;
      if (filterOfficerId !== "all" && ob.assigned_officer_id !== filterOfficerId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = ob.client?.full_name?.toLowerCase().includes(q);
        const matchesBiz = ob.business?.name?.toLowerCase().includes(q);
        const matchesName = ob.obligation_name.toLowerCase().includes(q);
        if (!matchesClient && !matchesBiz && !matchesName) return false;
      }

      const { daysDiff, isOverdue } = calculateComplianceDeadlineStatus(ob.due_date, ob.status, now);

      if (filterDueWindow === "completed") return ob.status === "completed";
      if (filterDueWindow === "overdue") return isOverdue && ob.status !== "completed";
      if (filterDueWindow === "30d") return !isOverdue && daysDiff <= 30 && ob.status !== "completed";
      if (filterDueWindow === "60d") return !isOverdue && daysDiff <= 60 && ob.status !== "completed";
      if (filterDueWindow === "90d") return !isOverdue && daysDiff <= 90 && ob.status !== "completed";

      return true;
    });
  }, [dataset, filterDueWindow, filterEntityType, filterOfficerId, searchQuery]);

  // Calendar Days computation
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, dateStr: null, items: [] });
    }

    const obligationMap = new Map<string, ComplianceObligationRecord[]>();
    for (const ob of dataset?.obligations || []) {
      const cur = obligationMap.get(ob.due_date) || [];
      cur.push(ob);
      obligationMap.set(ob.due_date, cur);
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const items = obligationMap.get(dateStr) || [];
      days.push({ dayNumber: d, dateStr, items });
    }

    return days;
  }, [currentCalendarDate, dataset]);

  // Create new obligation
  const handleCreateObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.obligation_name || !formData.due_date) {
      setFeedback({ type: "error", text: "Please select a client, obligation name, and due date." });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("compliance_obligations").insert({
        client_id: formData.client_id,
        business_id: formData.business_id || null,
        obligation_name: formData.obligation_name.trim(),
        obligation_type: formData.obligation_type,
        applicable_entity_type: formData.applicable_entity_type,
        service_id: formData.service_id || null,
        due_date: formData.due_date,
        recurrence_frequency: formData.recurrence_frequency,
        assigned_officer_id: formData.assigned_officer_id || null,
        statutory_source: formData.statutory_source || null,
        verification_status: formData.verification_status,
        verified_by: profile?.full_name || "Compliance Desk",
        date_last_verified: new Date().toISOString().split("T")[0],
        notes: formData.notes || null,
        status: "upcoming",
        opportunity_status: "identified",
      });

      if (error) throw error;

      setFeedback({ type: "success", text: "Compliance obligation scheduled successfully." });
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("[Compliance] Insert error:", err);
      setFeedback({ type: "error", text: err?.message || "Could not save compliance obligation." });
    } finally {
      setSubmitting(false);
    }
  };

  // Convert to Opportunity
  const handleConvertToOpportunity = async (ob: ComplianceObligationRecord) => {
    try {
      const officerId = ob.assigned_officer_id || profile?.id;
      if (!officerId) {
        setFeedback({ type: "error", text: "Please assign an officer before generating follow-up task." });
        return;
      }

      const res = await createComplianceFollowUpOpportunity({
        obligation: ob,
        assignedStaffId: officerId,
      });

      if (res.ok) {
        setFeedback({ type: "success", text: res.message });
        await loadData();
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Error creating follow-up opportunity" });
    }
  };

  // Mark Completed
  const handleMarkCompleted = async (ob: ComplianceObligationRecord) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextDue = calculateNextComplianceDueDate(ob.due_date, ob.recurrence_frequency);

      const { error } = await supabase
        .from("compliance_obligations")
        .update({
          status: "completed",
          last_completed_date: todayStr,
          next_due_date: nextDue,
          opportunity_status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ob.id);

      if (error) throw error;

      setFeedback({
        type: "success",
        text: `Obligation marked completed. ${nextDue ? `Next statutory due date projected for ${nextDue}.` : ""}`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Error updating obligation." });
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md w-fit mb-2 border border-purple-200">
            <CalendarIcon className="w-3.5 h-3.5" />
            Statutory Compliance & Recurring Engagements
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Annual Compliance & Recurring Service Management
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Proactively monitor CAC Annual Returns, SCUML, Tax Clearance renewals, and recurring business obligations across all active corporate clients.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canManageCompliance && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[#061738] hover:bg-[#0a2355] rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Schedule Client Obligation
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          onClick={() => { setActiveTab("obligations"); setFilterDueWindow("30d"); }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1">
            <span>Due in 30 Days</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summaryMetrics.dueNext30Days}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">High-priority follow-up</div>
        </div>

        <div
          onClick={() => { setActiveTab("obligations"); setFilterDueWindow("60d"); }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700 mb-1">
            <span>Due in 60 Days</span>
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summaryMetrics.dueNext60Days}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Advance reminder window</div>
        </div>

        <div
          onClick={() => { setActiveTab("obligations"); setFilterDueWindow("overdue"); }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-rose-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 mb-1">
            <span>Overdue Filings</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-700">{summaryMetrics.overdueCount}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Penalties accruing</div>
        </div>

        <div
          onClick={() => setActiveTab("opportunities")}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-purple-700 mb-1">
            <span>Recurring Opportunities</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-800">{summaryMetrics.recurringOpportunitiesIdentified}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ready for engagement</div>
        </div>

        <div
          onClick={() => { setActiveTab("obligations"); setFilterDueWindow("completed"); }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
            <span>Completed This Year</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{summaryMetrics.completedThisYear}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Retained compliance</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "calendar" ? "border-purple-600 text-purple-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Compliance Calendar
        </button>
        <button
          onClick={() => setActiveTab("obligations")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "obligations" ? "border-purple-600 text-purple-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Client Obligations ({filteredObligations.length})
        </button>
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "opportunities" ? "border-purple-600 text-purple-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Recurring Service Opportunities ({summaryMetrics.recurringOpportunitiesIdentified})
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === "rules" ? "border-purple-600 text-purple-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Statutory Rules & Verification
        </button>
      </div>

      {/* TAB 1: CALENDAR VIEW */}
      {activeTab === "calendar" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">
              {monthNames[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentCalendarDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
              >
                Current Month
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2 border-b border-slate-100">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell, idx) => (
              <div
                key={idx}
                className={`min-h-[90px] p-2 rounded-lg border text-xs flex flex-col justify-between ${
                  !cell.dayNumber
                    ? "bg-slate-50/50 border-transparent"
                    : cell.items.length > 0
                    ? "bg-purple-50/40 border-purple-200"
                    : "bg-white border-slate-100 hover:bg-slate-50/60"
                }`}
              >
                {cell.dayNumber && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">{cell.dayNumber}</span>
                      {cell.items.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-purple-700 text-white font-bold text-[10px] flex items-center justify-center">
                          {cell.items.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1">
                      {cell.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveTab("obligations");
                            setSearchQuery(item.client?.full_name || "");
                          }}
                          className="px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-purple-950 border border-purple-200 truncate cursor-pointer hover:bg-purple-100 transition-colors"
                          title={`${item.obligation_name} - ${item.client?.full_name}`}
                        >
                          {item.client?.full_name || item.obligation_name}
                        </div>
                      ))}
                      {cell.items.length > 2 && (
                        <div className="text-[9px] text-purple-700 font-bold">
                          +{cell.items.length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT OBLIGATIONS TABLE */}
      {activeTab === "obligations" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </div>

            <select
              value={filterDueWindow}
              onChange={(e) => setFilterDueWindow(e.target.value as any)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700"
            >
              <option value="30d">Due Next 30 Days</option>
              <option value="60d">Due Next 60 Days</option>
              <option value="90d">Due Next 90 Days</option>
              <option value="overdue">Overdue Obligations</option>
              <option value="completed">Completed History</option>
              <option value="all">All Obligations</option>
            </select>

            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700"
            >
              <option value="all">All Entity Types</option>
              <option value="business_name">Business Names</option>
              <option value="company">Limited Companies</option>
              <option value="incorporated_trustee">Incorporated Trustees</option>
              <option value="individual">Individuals</option>
            </select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search client or business name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Obligations Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Client / Entity</th>
                    <th className="py-3 px-4">Obligation</th>
                    <th className="py-3 px-4">Statutory Reference</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-center">Deadline Status</th>
                    <th className="py-3 px-4">Assigned Officer</th>
                    <th className="py-3 px-4 text-center">Opportunity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredObligations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No compliance obligations match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredObligations.map((ob) => {
                      const { statusLabel, badgeTone } = calculateComplianceDeadlineStatus(ob.due_date, ob.status);
                      return (
                        <tr key={ob.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{ob.client?.full_name || "Client"}</div>
                            {ob.business?.name && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {ob.business.name}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {ob.obligation_name}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-500 max-w-[200px] truncate" title={ob.statutory_source || ""}>
                            {ob.statutory_source || "Statutory CAMA requirement"}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                            {ob.due_date}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                badgeTone === "rose"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : badgeTone === "amber"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : badgeTone === "emerald"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {ob.assigned_officer?.full_name || "Unassigned"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                              {ob.opportunity_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setReminderModalData({ obligation: ob, channel: "whatsapp" })}
                              className="p-1 rounded hover:bg-emerald-50 text-emerald-700"
                              title="Prepare Client Reminder"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleConvertToOpportunity(ob)}
                              className="px-2 py-1 text-[11px] font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                              title="Create Task & Follow-Up Opportunity"
                            >
                              Engage
                            </button>
                            {ob.status !== "completed" && (
                              <button
                                onClick={() => handleMarkCompleted(ob)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                                title="Mark Statutory Filing Completed"
                              >
                                Complete
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
        </div>
      )}

      {/* TAB 3: RECURRING SERVICE OPPORTUNITIES */}
      {activeTab === "opportunities" && dataset && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Client Recurring Service Opportunities</h3>
            <p className="text-xs text-slate-500">
              Proactively engage active clients whose annual compliance or statutory renewal is due.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataset.obligations
              .filter((ob) => ob.opportunity_status !== "converted" && ob.status !== "completed")
              .map((ob) => (
                <div key={ob.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{ob.client?.full_name}</div>
                      <div className="text-xs text-purple-700 font-semibold">{ob.obligation_name}</div>
                      {ob.business?.name && (
                        <div className="text-[11px] text-slate-500">{ob.business.name}</div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                      {ob.opportunity_status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400">Due:</span>{" "}
                      <span className="font-semibold text-slate-700">{ob.due_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReminderModalData({ obligation: ob, channel: "whatsapp" })}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Reminder
                      </button>
                      <button
                        onClick={() => handleConvertToOpportunity(ob)}
                        className="px-3 py-1 text-xs font-semibold text-white bg-[#061738] hover:bg-[#0a2355] rounded-lg shadow-sm"
                      >
                        Create Task
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 4: STATUTORY RULES & VERIFICATION */}
      {activeTab === "rules" && dataset && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Statutory Compliance Rules & Regulatory Verification</h3>
            <p className="text-xs text-slate-500">
              Verified legal citations under CAMA 2020, SCUML, and tax statutes governing Nigerian business compliance obligations.
            </p>
          </div>

          <div className="space-y-3">
            {(dataset.rules.length > 0 ? dataset.rules : DEFAULT_COMPLIANCE_RULES).map((rule, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">{rule.name}</div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      rule.verification_status === "verified"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {rule.verification_status === "verified" ? "Statutorily Verified" : "Requires Verification"}
                  </span>
                </div>

                <div className="text-slate-600">
                  <span className="font-semibold text-slate-700">Legal Citation:</span> {rule.statutory_reference}
                </div>

                <div className="text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                  <div>Applicable: <span className="font-medium capitalize text-slate-700">{rule.applicable_entity_type.replace(/_/g, " ")}</span></div>
                  <div>Default Recurrence: <span className="font-medium capitalize text-slate-700">{rule.default_recurrence}</span></div>
                  {rule.verified_by && <div>Verified By: <span className="font-medium text-slate-700">{rule.verified_by}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE OBLIGATION MODAL */}
      {isCreateModalOpen && dataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Schedule Client Compliance Obligation</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateObligation} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Client *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Choose Client...</option>
                  {dataset.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Linked Business Entity (Optional)</label>
                <select
                  value={formData.business_id}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">General Client Obligation (No specific business)</option>
                  {dataset.businesses
                    .filter((b) => !formData.client_id || b.client_id === formData.client_id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Obligation Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.obligation_name}
                    onChange={(e) => setFormData({ ...formData, obligation_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Statutory Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity Type</label>
                  <select
                    value={formData.applicable_entity_type}
                    onChange={(e) => setFormData({ ...formData, applicable_entity_type: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="business_name">Business Name</option>
                    <option value="company">Limited Company</option>
                    <option value="incorporated_trustee">Incorporated Trustee</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recurrence</label>
                  <select
                    value={formData.recurrence_frequency}
                    onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="annual">Annual</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="one_time">One-Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Responsible Officer</label>
                <select
                  value={formData.assigned_officer_id}
                  onChange={(e) => setFormData({ ...formData, assigned_officer_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Unassigned</option>
                  {dataset.staffProfiles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Statutory Reference & Authority</label>
                <input
                  type="text"
                  value={formData.statutory_source}
                  onChange={(e) => setFormData({ ...formData, statutory_source: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#061738] hover:bg-[#0a2355] text-white font-semibold rounded-lg shadow-sm"
                >
                  {submitting ? "Saving..." : "Schedule Obligation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMINDER MODAL */}
      {reminderModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Prepare Client Compliance Reminder</h3>
              <button onClick={() => setReminderModalData(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const msg = composeComplianceReminderMessage({
                clientName: reminderModalData.obligation.client?.full_name || "Valued Client",
                businessName: reminderModalData.obligation.business?.name,
                obligationName: reminderModalData.obligation.obligation_name,
                dueDate: reminderModalData.obligation.due_date,
                channel: reminderModalData.channel,
              });

              return (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Dispatch Channel:</span>
                    <button
                      onClick={() => setReminderModalData({ ...reminderModalData, channel: "whatsapp" })}
                      className={`px-2.5 py-1 rounded font-semibold ${reminderModalData.channel === "whatsapp" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => setReminderModalData({ ...reminderModalData, channel: "email" })}
                      className={`px-2.5 py-1 rounded font-semibold ${reminderModalData.channel === "email" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      Email (hello@ablebiz.com.ng)
                    </button>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Subject Preview</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium">
                      {msg.subject}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                    <textarea
                      readOnly
                      rows={7}
                      value={msg.body}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px]"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                    Notice: Opening the communication client prepares the message. In accordance with ABLEBIZ integrity policies, messages are not logged as sent until confirmed.
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                      onClick={() => setReminderModalData(null)}
                      className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    {reminderModalData.channel === "whatsapp" && msg.whatsappUrl && (
                      <a
                        href={msg.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Open WhatsApp Chat
                      </a>
                    )}
                    {reminderModalData.channel === "email" && msg.mailtoUrl && (
                      <a
                        href={msg.mailtoUrl}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        Compose in Email Client
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
