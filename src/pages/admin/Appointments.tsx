import { useEffect, useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Video,
  Phone,
  MessageSquare,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Send,
  HelpCircle,
  Settings as SettingsIcon,
  CalendarDays,
  FileText,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import {
  AppointmentRecord,
  AppointmentTypeRecord,
  StaffAvailabilityRuleRecord,
  AppointmentStatus,
  MeetingLocationType,
} from "../../lib/scheduling/types";
import {
  checkStaffAvailability,
  computeAppointmentSummary,
  generateAppointmentReferenceCode,
  composeAppointmentReminder,
  validateAppointmentStatusTransition,
  minutesToTimeString,
  timeStringToMinutes,
  DEFAULT_WORKING_HOURS,
} from "../../lib/scheduling/schedulingService";

const FALLBACK_APPOINTMENT_TYPES: AppointmentTypeRecord[] = [
  {
    id: "type-1",
    name: "Business Registration Consultation",
    slug: "business-registration-consultation",
    description: "Initial client advisory on business name registration, documentation, and timeline.",
    default_duration: 45,
    buffer_minutes: 15,
    eligible_roles: ["super_admin", "admin", "operations_manager", "registration_officer", "client_service_officer"],
    location_options: ["office", "google_meet", "phone_call", "whatsapp_call"],
    reminder_schedule: [1440, 120, 30],
    is_active: true,
  },
  {
    id: "type-2",
    name: "Company Registration Advisory",
    slug: "company-registration-advisory",
    description: "Comprehensive advisory on share capital structuring, directorship, and incorporation.",
    default_duration: 60,
    buffer_minutes: 15,
    eligible_roles: ["super_admin", "admin", "operations_manager", "registration_officer"],
    location_options: ["office", "google_meet", "phone_call", "whatsapp_call"],
    reminder_schedule: [1440, 120, 30],
    is_active: true,
  },
  {
    id: "type-3",
    name: "Annual Returns Consultation",
    slug: "annual-returns-consultation",
    description: "Statutory compliance advisory assessing historical CAC filings and penalty mitigation.",
    default_duration: 45,
    buffer_minutes: 15,
    eligible_roles: ["super_admin", "admin", "operations_manager", "registration_officer"],
    location_options: ["office", "google_meet", "phone_call", "whatsapp_call"],
    reminder_schedule: [1440, 120, 30],
    is_active: true,
  },
  {
    id: "type-4",
    name: "SCUML Compliance Consultation",
    slug: "scuml-compliance-consultation",
    description: "Anti-money laundering reporting and compliance certificate guidance.",
    default_duration: 45,
    buffer_minutes: 15,
    eligible_roles: ["super_admin", "admin", "operations_manager", "registration_officer"],
    location_options: ["office", "google_meet", "phone_call", "whatsapp_call"],
    reminder_schedule: [1440, 120, 30],
    is_active: true,
  },
  {
    id: "type-5",
    name: "General Business Consultation",
    slug: "general-business-consultation",
    description: "General advisory addressing business formalization, corporate compliance, and expansion.",
    default_duration: 30,
    buffer_minutes: 15,
    eligible_roles: ["super_admin", "admin", "operations_manager", "client_service_officer"],
    location_options: ["office", "google_meet", "phone_call", "whatsapp_call"],
    reminder_schedule: [1440, 120, 30],
    is_active: true,
  },
];

export function AppointmentsPage() {
  const { user, profile, hasPermission } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeRecord[]>(FALLBACK_APPOINTMENT_TYPES);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"list" | "calendar">("list");
  const [listTab, setListTab] = useState<"all" | "today" | "upcoming" | "unconfirmed" | "completed" | "cancelled">("today");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStaffId, setFilterStaffId] = useState("all");
  const [filterTypeId, setFilterTypeId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);

  // Form state for scheduling
  const [formData, setFormData] = useState({
    title: "",
    appointment_type_id: "",
    target_type: "client" as "client" | "lead" | "internal",
    client_id: "",
    lead_id: "",
    assigned_staff_id: profile?.id || "",
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "10:00",
    duration_minutes: 45,
    meeting_location: "office" as MeetingLocationType,
    meeting_link: "",
    purpose: "",
    internal_notes: "",
  });

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancellation state
  const [cancellationReason, setCancellationReason] = useState("");
  // Reschedule state
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  // Complete state
  const [completionOutcome, setCompletionOutcome] = useState("");
  const [createFollowUpTask, setCreateFollowUpTask] = useState(true);

  const canManage = hasPermission("crm", "edit") || ["super_admin", "admin", "operations_manager", "client_service_officer"].includes(profile?.role || "");

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Fetch appointments
      const { data: apptData, error: apptErr } = await supabase
        .from("appointments")
        .select(`
          *,
          appointment_type:appointment_types(*),
          client:clients(id, full_name, phone, email),
          lead:leads(id, contact_name, phone, email),
          assigned_staff:staff_profiles!assigned_staff_id(id, full_name, role, email)
        `)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (!apptErr && apptData) {
        setAppointments(apptData as any);
      }

      // 2. Fetch appointment types
      const { data: typeData } = await supabase
        .from("appointment_types")
        .select("*")
        .order("name", { ascending: true });

      if (typeData && typeData.length > 0) {
        setAppointmentTypes(typeData as any);
      }

      // 3. Fetch active staff
      const { data: staffData } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role, email, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (staffData) setStaffList(staffData);

      // 4. Fetch clients
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, full_name, phone, email")
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .limit(100);

      if (clientData) setClientsList(clientData);

      // 5. Fetch leads
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, contact_name, phone, email")
        .eq("is_converted", false)
        .order("created_at", { ascending: false })
        .limit(100);

      if (leadData) setLeadsList(leadData);
    } catch (err) {
      console.error("Error loading appointment workspace data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    return computeAppointmentSummary(appointments);
  }, [appointments]);

  // Filtered Appointments
  const todayStr = new Date().toISOString().slice(0, 10);
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Tab filter
      if (listTab === "today" && (appt.appointment_date !== todayStr || ["cancelled", "completed"].includes(appt.status))) {
        return false;
      }
      if (listTab === "upcoming" && (appt.appointment_date <= todayStr || ["cancelled", "completed"].includes(appt.status))) {
        return false;
      }
      if (listTab === "unconfirmed" && !["scheduled", "requested"].includes(appt.status)) {
        return false;
      }
      if (listTab === "completed" && appt.status !== "completed") {
        return false;
      }
      if (listTab === "cancelled" && appt.status !== "cancelled") {
        return false;
      }

      // Dropdown filters
      if (filterStaffId !== "all" && appt.assigned_staff_id !== filterStaffId) return false;
      if (filterTypeId !== "all" && appt.appointment_type_id !== filterTypeId) return false;
      if (filterStatus !== "all" && appt.status !== filterStatus) return false;
      if (filterLocation !== "all" && appt.meeting_location !== filterLocation) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const clientName = appt.client?.full_name?.toLowerCase() || "";
        const leadName = appt.lead?.contact_name?.toLowerCase() || "";
        const title = appt.title?.toLowerCase() || "";
        const ref = appt.reference_code?.toLowerCase() || "";
        const staffName = appt.assigned_staff?.full_name?.toLowerCase() || "";
        if (!clientName.includes(q) && !leadName.includes(q) && !title.includes(q) && !ref.includes(q) && !staffName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, listTab, filterStaffId, filterTypeId, filterStatus, filterLocation, searchTerm, todayStr]);

  // Handle appointment creation
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.title.trim()) {
      setFormError("Appointment title is required.");
      return;
    }

    if (!formData.assigned_staff_id) {
      setFormError("Please assign a staff member for this consultation.");
      return;
    }

    const startMins = timeStringToMinutes(formData.start_time);
    const endMins = startMins + Number(formData.duration_minutes);
    const endTimeStr = minutesToTimeString(endMins);

    // Check staff availability & conflict
    const availabilityCheck = checkStaffAvailability({
      staffId: formData.assigned_staff_id,
      date: formData.appointment_date,
      startTime: formData.start_time,
      endTime: endTimeStr,
      existingAppointments: appointments,
    });

    if (!availabilityCheck.isAvailable) {
      setFormError(availabilityCheck.reason || "The selected staff member is unavailable at this time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const referenceCode = generateAppointmentReferenceCode();

      const newRecord = {
        reference_code: referenceCode,
        title: formData.title.trim(),
        appointment_type_id: formData.appointment_type_id || null,
        client_id: formData.target_type === "client" ? formData.client_id || null : null,
        lead_id: formData.target_type === "lead" ? formData.lead_id || null : null,
        assigned_staff_id: formData.assigned_staff_id,
        appointment_date: formData.appointment_date,
        start_time: formData.start_time,
        end_time: endTimeStr,
        duration_minutes: formData.duration_minutes,
        timezone: "Africa/Lagos",
        meeting_location: formData.meeting_location,
        meeting_link: formData.meeting_link?.trim() || null,
        purpose: formData.purpose?.trim() || null,
        internal_notes: formData.internal_notes?.trim() || null,
        status: "scheduled" as AppointmentStatus,
        created_by: profile?.id || null,
      };

      if (supabase) {
        const { data, error } = await supabase.from("appointments").insert([newRecord]).select().single();
        if (error) {
          // If network blocked or table not yet populated, keep local optimistic record
          console.warn("Appointments insert warning:", error);
        }
      }

      // Optimistic update
      const resolvedStaff = staffList.find((s) => s.id === formData.assigned_staff_id);
      const resolvedClient = clientsList.find((c) => c.id === formData.client_id);
      const resolvedLead = leadsList.find((l) => l.id === formData.lead_id);
      const resolvedType = appointmentTypes.find((t) => t.id === formData.appointment_type_id);

      const optimisticAppt: AppointmentRecord = {
        ...newRecord,
        id: `local-${Date.now()}`,
        is_public_booking: false,
        assigned_staff: resolvedStaff,
        client: resolvedClient,
        lead: resolvedLead,
        appointment_type: resolvedType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setAppointments((prev) => [optimisticAppt, ...prev]);
      setIsScheduleModalOpen(false);
      setFormData({
        title: "",
        appointment_type_id: "",
        target_type: "client",
        client_id: "",
        lead_id: "",
        assigned_staff_id: profile?.id || "",
        appointment_date: new Date().toISOString().slice(0, 10),
        start_time: "10:00",
        duration_minutes: 45,
        meeting_location: "office",
        meeting_link: "",
        purpose: "",
        internal_notes: "",
      });
    } catch (err: any) {
      setFormError(err.message || "Could not schedule appointment. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transition handlers
  const handleConfirmAppointment = async (appt: AppointmentRecord) => {
    const transition = validateAppointmentStatusTransition(appt.status, "confirmed");
    if (!transition.isValid) {
      alert(transition.error);
      return;
    }

    if (supabase) {
      await supabase.from("appointments").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", appt.id);
    }

    setAppointments((prev) =>
      prev.map((a) => (a.id === appt.id ? { ...a, status: "confirmed" } : a))
    );
  };

  const handleCancelSubmit = async () => {
    if (!selectedAppointment) return;
    if (!cancellationReason.trim()) {
      alert("Please provide a valid cancellation reason.");
      return;
    }

    if (supabase) {
      await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: cancellationReason.trim(),
          cancelled_by: profile?.id || null,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAppointment.id);
    }

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === selectedAppointment.id
          ? {
              ...a,
              status: "cancelled",
              cancellation_reason: cancellationReason.trim(),
              cancelled_at: new Date().toISOString(),
            }
          : a
      )
    );

    setIsCancelModalOpen(false);
    setSelectedAppointment(null);
    setCancellationReason("");
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedAppointment) return;
    if (!rescheduleDate || !rescheduleTime) {
      alert("Please select a new appointment date and time.");
      return;
    }

    const startMins = timeStringToMinutes(rescheduleTime);
    const endMins = startMins + selectedAppointment.duration_minutes;
    const endTimeStr = minutesToTimeString(endMins);

    // Conflict check
    const check = checkStaffAvailability({
      staffId: selectedAppointment.assigned_staff_id || "",
      date: rescheduleDate,
      startTime: rescheduleTime,
      endTime: endTimeStr,
      existingAppointments: appointments,
      excludeAppointmentId: selectedAppointment.id,
    });

    if (!check.isAvailable) {
      alert(check.reason || "Staff is not available at the selected reschedule time.");
      return;
    }

    if (supabase) {
      await supabase
        .from("appointments")
        .update({
          appointment_date: rescheduleDate,
          start_time: rescheduleTime,
          end_time: endTimeStr,
          status: "rescheduled",
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAppointment.id);
    }

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === selectedAppointment.id
          ? {
              ...a,
              appointment_date: rescheduleDate,
              start_time: rescheduleTime,
              end_time: endTimeStr,
              status: "rescheduled",
            }
          : a
      )
    );

    setIsRescheduleModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleCompleteSubmit = async () => {
    if (!selectedAppointment) return;

    if (supabase) {
      await supabase
        .from("appointments")
        .update({
          status: "completed",
          completion_outcome: completionOutcome.trim() || "Consultation concluded successfully.",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAppointment.id);

      // Auto-create follow-up task if checked
      if (createFollowUpTask) {
        await supabase.from("tasks").insert([
          {
            title: `Follow-up: Consultation with ${selectedAppointment.client?.full_name || selectedAppointment.lead?.contact_name || "Client"}`,
            category: "client_relationship",
            priority: "normal",
            status: "pending",
            assigned_to: selectedAppointment.assigned_staff_id || profile?.id || null,
            client_id: selectedAppointment.client_id || null,
            lead_id: selectedAppointment.lead_id || null,
            notes: `Outcome: ${completionOutcome.trim() || "Follow up on consultation advisory and action items."}`,
          },
        ]);
      }
    }

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === selectedAppointment.id
          ? {
              ...a,
              status: "completed",
              completion_outcome: completionOutcome.trim(),
              completed_at: new Date().toISOString(),
            }
          : a
      )
    );

    setIsCompleteModalOpen(false);
    setSelectedAppointment(null);
    setCompletionOutcome("");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Appointment & Consultation Scheduling
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Schedule, manage, and coordinate advisory sessions, CAC registration consultations, and client meetings (Africa/Lagos).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsTypesModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <SettingsIcon className="h-4 w-4 text-slate-500" />
            Appointment Types
          </button>

          {canManage && (
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              Schedule Appointment
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Today</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{summary.todayCount}</p>
          <span className="text-[10px] text-slate-400">Scheduled for today</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Upcoming</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{summary.upcomingCount}</p>
          <span className="text-[10px] text-slate-400">Future scheduled</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Unconfirmed</p>
          <p className="text-xl font-bold text-amber-500 mt-0.5">{summary.unconfirmedCount}</p>
          <span className="text-[10px] text-slate-400">Awaiting confirmation</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Completed</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{summary.completedCount}</p>
          <span className="text-[10px] text-slate-400">Concluded sessions</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Missed / No Show</p>
          <p className="text-xl font-bold text-rose-500 mt-0.5">{summary.missedCount}</p>
          <span className="text-[10px] text-slate-400">Unattended</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Completion Rate</p>
          <p className="text-xl font-bold text-purple-600 mt-0.5">{summary.completionRate}%</p>
          <span className="text-[10px] text-slate-400">Concluded vs missed</span>
        </div>
      </div>

      {/* Filter and Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1 border-b md:border-b-0 pb-2 md:pb-0 border-slate-200 dark:border-slate-800">
          {(
            [
              { id: "today", label: "Today's Appointments" },
              { id: "upcoming", label: "Upcoming" },
              { id: "unconfirmed", label: "Unconfirmed" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
              { id: "all", label: "All History" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setListTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                listTab === tab.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <select
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="all">All Officers</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>

          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="all">All Locations</option>
            <option value="office">In-Office</option>
            <option value="google_meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="phone_call">Phone Call</option>
            <option value="whatsapp_call">WhatsApp Call</option>
          </select>
        </div>
      </div>

      {/* Main Appointment Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs">Loading appointment calendar and schedule records...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No appointments found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no appointments matching the selected tab, date, or filter criteria.
            </p>
            {canManage && (
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule Consultation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Ref & Title</th>
                  <th className="py-3 px-4">Client / Lead</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Officer</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAppointments.map((appt) => {
                  const clientName = appt.client?.full_name || appt.lead?.contact_name || appt.client_contact_name || "Internal Staff";
                  const clientContact = appt.client?.phone || appt.lead?.phone || appt.client_contact_phone || "";
                  const locationIcon =
                    appt.meeting_location === "office" ? (
                      <Building2 className="h-3.5 w-3.5 text-amber-500" />
                    ) : appt.meeting_location === "phone_call" ? (
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Video className="h-3.5 w-3.5 text-emerald-500" />
                    );

                  const statusBadgeTone =
                    appt.status === "completed"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : appt.status === "confirmed"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      : appt.status === "scheduled" || appt.status === "requested"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : appt.status === "cancelled"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {appt.title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {appt.reference_code} {appt.appointment_type ? `• ${appt.appointment_type.name}` : ""}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{clientName}</div>
                        {clientContact && <div className="text-[11px] text-slate-400">{clientContact}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{appt.appointment_date}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {appt.start_time.slice(0, 5)} - {appt.end_time.slice(0, 5)} ({appt.duration_minutes}m)
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200">
                          {appt.assigned_staff?.full_name || "Unassigned"}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {appt.assigned_staff?.role?.replace("_", " ") || ""}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 capitalize">
                          {locationIcon}
                          <span>{appt.meeting_location.replace("_", " ")}</span>
                        </div>
                        {appt.meeting_link && (
                          <a
                            href={appt.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            Open Link <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusBadgeTone}`}>
                          {appt.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Prepare Reminder */}
                          {["scheduled", "confirmed"].includes(appt.status) && (
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setIsReminderModalOpen(true);
                              }}
                              title="Prepare Appointment Reminder"
                              className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Confirm */}
                          {appt.status === "scheduled" && (
                            <button
                              onClick={() => handleConfirmAppointment(appt)}
                              title="Confirm Appointment"
                              className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Complete */}
                          {["scheduled", "confirmed", "rescheduled"].includes(appt.status) && (
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setIsCompleteModalOpen(true);
                              }}
                              title="Mark Completed"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Reschedule */}
                          {["scheduled", "confirmed"].includes(appt.status) && (
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setRescheduleDate(appt.appointment_date);
                                setRescheduleTime(appt.start_time.slice(0, 5));
                                setIsRescheduleModalOpen(true);
                              }}
                              title="Reschedule"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <CalendarIcon className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Cancel */}
                          {["scheduled", "confirmed", "requested", "rescheduled"].includes(appt.status) && (
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setIsCancelModalOpen(true);
                              }}
                              title="Cancel"
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <XCircle className="h-3.5 w-3.5" />
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

      {/* SCHEDULE APPOINTMENT MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Schedule Consultation or Advisory
                </h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Consultation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Company Incorporation Advisory Session"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Appointment Type
                  </label>
                  <select
                    value={formData.appointment_type_id}
                    onChange={(e) => {
                      const type = appointmentTypes.find((t) => t.id === e.target.value);
                      setFormData({
                        ...formData,
                        appointment_type_id: e.target.value,
                        duration_minutes: type?.default_duration || 45,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Select advisory category...</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.default_duration}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Staff Member *
                  </label>
                  <select
                    required
                    value={formData.assigned_staff_id}
                    onChange={(e) => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Select officer...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Selection: Client vs Lead vs Internal */}
              <div className="space-y-1.5">
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Target Participant
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="target_type"
                      checked={formData.target_type === "client"}
                      onChange={() => setFormData({ ...formData, target_type: "client" })}
                    />
                    <span>Existing Client</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="target_type"
                      checked={formData.target_type === "lead"}
                      onChange={() => setFormData({ ...formData, target_type: "lead" })}
                    />
                    <span>Prospective Lead</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="target_type"
                      checked={formData.target_type === "internal"}
                      onChange={() => setFormData({ ...formData, target_type: "internal" })}
                    />
                    <span>Internal Staff Meeting</span>
                  </label>
                </div>

                {formData.target_type === "client" && (
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full mt-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Choose registered client...</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                )}

                {formData.target_type === "lead" && (
                  <select
                    value={formData.lead_id}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    className="w-full mt-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Choose pipeline lead...</option>
                    {leadsList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.contact_name} ({l.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Appointment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <select
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins (1 hr)</option>
                    <option value={90}>90 mins (1.5 hrs)</option>
                  </select>
                </div>
              </div>

              {/* Location & Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Meeting Location / Channel
                  </label>
                  <select
                    value={formData.meeting_location}
                    onChange={(e) => setFormData({ ...formData, meeting_location: e.target.value as MeetingLocationType })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="office">ABLEBIZ Office (Abeokuta)</option>
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp_call">WhatsApp Call</option>
                    <option value="client_premises">Client Premises</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Online Meeting Link (if remote)
                  </label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Purpose / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Key discussion points, requested services, or advisory scope..."
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmitting ? "Verifying & Saving..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {isCancelModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-500" />
              Cancel Appointment
            </h3>
            <p className="text-xs text-slate-500">
              Please record the reason for cancelling <strong className="text-slate-700 dark:text-slate-300">{selectedAppointment.title}</strong> ({selectedAppointment.reference_code}).
            </p>

            <textarea
              required
              rows={3}
              placeholder="e.g. Client requested postponement due to travel..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              >
                Back
              </button>
              <button
                onClick={handleCancelSubmit}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {isRescheduleModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-amber-500" />
              Reschedule Appointment
            </h3>
            <p className="text-xs text-slate-500">
              Select the revised appointment date and time for <strong className="text-slate-700 dark:text-slate-300">{selectedAppointment.title}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">New Start Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRescheduleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Save Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE APPOINTMENT MODAL */}
      {isCompleteModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Complete Consultation Session
            </h3>

            <p className="text-xs text-slate-500">
              Record the outcome of the advisory session with {selectedAppointment.client?.full_name || selectedAppointment.lead?.contact_name || "the client"}.
            </p>

            <textarea
              rows={3}
              placeholder="Summary of consultation advice, client agreement, next statutory steps..."
              value={completionOutcome}
              onChange={(e) => setCompletionOutcome(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={createFollowUpTask}
                onChange={(e) => setCreateFollowUpTask(e.target.checked)}
              />
              <span>Automatically create relationship follow-up task</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSubmit}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREPARE REMINDER MODAL */}
      {isReminderModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-500" />
                Appointment Reminder Dispatch
              </h3>
              <button onClick={() => setIsReminderModalOpen(false)}>✕</button>
            </div>

            {(() => {
              const reminder = composeAppointmentReminder({
                appointment: selectedAppointment,
                clientName: selectedAppointment.client?.full_name || selectedAppointment.lead?.contact_name || "Valued Client",
                clientPhone: selectedAppointment.client?.phone || selectedAppointment.lead?.phone,
                clientEmail: selectedAppointment.client?.email || selectedAppointment.lead?.email,
                minutesBefore: 120,
              });

              return (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Official Sender:</span>
                    <p className="text-slate-500 text-[11px] font-mono">{reminder.fromIdentity}</p>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Email Subject Preview:</span>
                    <p className="p-2 rounded bg-slate-50 dark:bg-slate-800 text-[11px] font-mono">{reminder.emailSubject}</p>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Message Content:</span>
                    <pre className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {reminder.emailPlainBody}
                    </pre>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t">
                    <a
                      href={reminder.whatsappClickUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 text-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open WhatsApp Click-to-Chat
                    </a>

                    <button
                      onClick={() => {
                        alert("Email reminder draft prepared. In production with active Resend/SMTP credentials, this dispatches automatically.");
                        setIsReminderModalOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs"
                    >
                      Record Reminder Log
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* APPOINTMENT TYPES MODAL */}
      {isTypesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-amber-500" />
                Configurable Appointment Types
              </h3>
              <button onClick={() => setIsTypesModalOpen(false)}>✕</button>
            </div>

            <p className="text-xs text-slate-500">
              Authorized management may configure appointment types, default durations, location channels, and eligible staff roles.
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {appointmentTypes.map((type) => (
                <div key={type.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{type.name}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">{type.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span>Duration: {type.default_duration} mins</span>
                      <span>• Buffer: {type.buffer_minutes} mins</span>
                      <span>• Channels: {type.location_options.join(", ")}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${type.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                    {type.is_active ? "Active" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setIsTypesModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
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
