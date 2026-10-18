import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  FileText,
  Megaphone,
  BarChart3,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Eye,
  Edit2,
  Lock,
  Briefcase,
  Building2,
  Phone,
  Mail,
  MapPin,
  HeartHandshake,
  Cake,
  Award,
  CheckSquare,
  ArrowUpRight,
  Pin,
  Send,
  LogIn,
  LogOut,
  History,
} from "lucide-react";
import { useAuth, type StaffProfile } from "../../auth/AuthContext";
import {
  ROLE_DEFINITIONS,
  getRoleTitle,
  normalizeStaffRole,
  type CanonicalStaffRole,
} from "../../auth/roleConfig";
import {
  HR_PERMISSION_MATRIX,
  getHrPermissions,
  canAccessHrManagementWorkspace,
  canAccessHrManagementTab,
  getAllowedHrManagementTabs,
  evaluateLeaveDecisionEligibility,
  evaluateAttendanceCorrectionEligibility,
  canEditTargetStaffHrMetadata,
  type HrManagementTab,
  type HrPortalTab,
} from "../../lib/hrPermissions";
import {
  fetchHrWorkspaceData,
  updateOwnPersonalDetails,
  updateStaffEmploymentMetadata,
  submitLeaveRequest,
  decideLeaveRequest,
  cancelOwnLeaveRequest,
  resubmitLeaveRequest,
  recordSelfCheckInOut,
  recordManagementAttendance,
  submitAttendanceCorrection,
  decideAttendanceCorrection,
  uploadHrDocument,
  createHrDocumentSignedUrl,
  verifyOrArchiveHrDocument,
  createOrUpdateAnnouncement,
  saveHrPolicySettings,
  updateLeavePolicyEntitlement,
  calculateWorkingDays,
  type HrPolicySettings,
  type HrStaffDetails,
  type HrLeavePolicy,
  type HrLeaveRequest,
  type HrAttendanceRecord,
  type HrAttendanceCorrection,
  type HrDocumentRecord,
  type HrAnnouncementRecord,
  type HrUpcomingMilestone,
} from "../../lib/hrService";

const CANONICAL_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "accounts_officer",
  "client_service_officer",
  "marketing_officer",
  "viewer",
];

const MANAGEMENT_TAB_META: Array<{
  key: HrManagementTab;
  label: string;
  icon: any;
}> = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "directory", label: "Staff Directory", icon: Users },
  { key: "attendance", label: "Attendance", icon: Clock },
  { key: "leave", label: "Leave Management", icon: Calendar },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "reports", label: "HR Reports", icon: BarChart3 },
  { key: "settings", label: "HR Settings", icon: Settings },
];

const PORTAL_TAB_META: Array<{
  key: HrPortalTab;
  label: string;
  icon: any;
}> = [
  { key: "profile", label: "My Profile", icon: UserCheck },
  { key: "attendance", label: "My Attendance", icon: Clock },
  { key: "leave", label: "My Leave", icon: Calendar },
  { key: "documents", label: "My Documents", icon: FileText },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "responsibilities", label: "My Responsibilities", icon: CheckSquare },
];

const HR_DOC_CATEGORIES: Array<{ value: HrDocumentRecord["category"]; label: string; selfAllowed?: boolean }> = [
  { value: "employment_contract", label: "Employment Contract" },
  { value: "offer_letter", label: "Offer / Appointment Letter" },
  { value: "identification", label: "Government Identification (NIN / Passport)", selfAllowed: true },
  { value: "certification_qualification", label: "Academic / Professional Certificate", selfAllowed: true },
  { value: "performance_appraisal", label: "Performance Appraisal" },
  { value: "disciplinary_record", label: "Disciplinary / Query Record" },
  { value: "compensation_salary", label: "Compensation / Salary Review" },
  { value: "hr_policy_handbook", label: "Company HR Policy / Handbook" },
  { value: "leave_supporting_doc", label: "Leave Supporting Document", selfAllowed: true },
  { value: "other", label: "Other Employment Record", selfAllowed: true },
];

function syncFormAriaInvalid(formEl: HTMLFormElement) {
  const requiredControls = formEl.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("[required]");
  requiredControls.forEach((ctrl) => {
    if (!ctrl.checkValidity()) {
      ctrl.setAttribute("aria-invalid", "true");
    } else {
      ctrl.removeAttribute("aria-invalid");
    }
  });
}

function handleFieldBlurAria(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) {
  const el = e.currentTarget;
  if (el.required) {
    if (!el.checkValidity()) {
      el.setAttribute("aria-invalid", "true");
    } else {
      el.removeAttribute("aria-invalid");
    }
  }
}

export function HrWorkspacePage() {
  const { profile, refreshProfile } = useAuth();
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();

  const hasMgmtAccess = canAccessHrManagementWorkspace(profile?.role);
  const allowedMgmtTabs = useMemo(
    () => getAllowedHrManagementTabs(profile?.role),
    [profile?.role]
  );
  const hrPerms = useMemo(() => getHrPermissions(profile?.role), [profile?.role]);

  // Determine active workspace mode ('management' vs 'portal') and active tab from URL param
  const [portalTab, setPortalTab] = useState<HrPortalTab>("profile");
  const [periodFilter, setPeriodFilter] = useState<"this_month" | "this_quarter" | "this_year" | "all">("this_month");

  // Data state
  const [loading, setLoading] = useState(true);
  const [hrTablesReady, setHrTablesReady] = useState(true);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffChangeRequests, setStaffChangeRequests] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [policySettings, setPolicySettings] = useState<HrPolicySettings>({
    id: 1,
    attendance_enabled: true,
    allow_self_clock_in: true,
    workday_start_time: "08:30:00",
    workday_end_time: "17:00:00",
    late_threshold_minutes: 15,
    leave_balances_enabled: false,
    require_maker_checker_leave: true,
  });
  const [ownPrivateDetails, setOwnPrivateDetails] = useState<HrStaffDetails | null>(null);
  const [allPrivateDetails, setAllPrivateDetails] = useState<HrStaffDetails[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<HrLeavePolicy[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<HrAttendanceRecord[]>([]);
  const [attendanceCorrections, setAttendanceCorrections] = useState<HrAttendanceCorrection[]>([]);
  const [hrDocuments, setHrDocuments] = useState<HrDocumentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<HrAnnouncementRecord[]>([]);
  const [birthdays, setBirthdays] = useState<HrUpcomingMilestone[]>([]);
  const [anniversaries, setAnniversaries] = useState<HrUpcomingMilestone[]>([]);

  // Feedback banners
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Directory filters & modals
  const [dirSearch, setDirSearch] = useState("");
  const [dirRoleFilter, setDirRoleFilter] = useState("all");
  const [dirDeptFilter, setDirDeptFilter] = useState("all");
  const [dirStatusFilter, setDirStatusFilter] = useState("all");
  const [inspectingStaff, setInspectingStaff] = useState<StaffProfile | null>(null);
  const [editingEmploymentStaff, setEditingEmploymentStaff] = useState<StaffProfile | null>(null);
  const [employmentForm, setEmploymentForm] = useState({
    job_title: "",
    department: "Operations",
    employment_type: "full_time",
    employment_status: "active",
    reporting_manager_id: "",
    hire_date: "",
    work_location: "Abeokuta Head Office",
    hr_notes: "",
  });

  // Self-service personal details form
  const [personalForm, setPersonalForm] = useState({
    phone: "",
    date_of_birth: "",
    residential_address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
  });

  // Leave filters & modals
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [reviewingLeave, setReviewingLeave] = useState<HrLeaveRequest | null>(null);
  const [leaveDecision, setLeaveDecision] = useState<"approved" | "rejected" | "correction_requested">("approved");
  const [leaveReviewComment, setLeaveReviewComment] = useState("");
  const [resubmittingLeave, setResubmittingLeave] = useState<HrLeaveRequest | null>(null);
  const [resubmitForm, setResubmitForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  // Attendance filters & modals
  const [attDateFilter, setAttDateFilter] = useState("");
  const [attStatusFilter, setAttStatusFilter] = useState("all");
  const [isRecordAttModalOpen, setIsRecordAttModalOpen] = useState(false);
  const [mgmtAttForm, setMgmtAttForm] = useState({
    staff_id: "",
    attendance_date: new Date().toISOString().slice(0, 10),
    status: "present" as HrAttendanceRecord["status"],
    absence_type: "",
    check_in_time: "08:30",
    check_out_time: "17:00",
    notes: "",
  });
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    attendance_date: new Date().toISOString().slice(0, 10),
    requested_status: "present" as HrAttendanceRecord["status"],
    requested_check_in_time: "08:30",
    requested_check_out_time: "17:00",
    reason: "",
  });
  const [reviewingCorrection, setReviewingCorrection] = useState<HrAttendanceCorrection | null>(null);
  const [correctionDecision, setCorrectionDecision] = useState<"approved" | "rejected">("approved");
  const [correctionReviewComment, setCorrectionReviewComment] = useState("");

  // HR Document filters & upload modal
  const [docSearch, setDocSearch] = useState("");
  const [docCatFilter, setDocCatFilter] = useState("all");
  const [docScopeFilter, setDocScopeFilter] = useState("all");
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
  const [docUploadMode, setDocUploadMode] = useState<"management" | "self">("self");
  const [docForm, setDocForm] = useState({
    title: "",
    category: "identification" as HrDocumentRecord["category"],
    visibility_scope: "employee_and_hr" as HrDocumentRecord["visibility_scope"],
    staff_id: "",
    expiry_date: "",
    notes: "",
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  // HR Announcements modal
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    id: "",
    title: "",
    body: "",
    category: "general" as HrAnnouncementRecord["category"],
    priority: "normal" as HrAnnouncementRecord["priority"],
    status: "published" as HrAnnouncementRecord["status"],
    target_department: "",
    target_role: "",
    is_pinned: false,
    effective_date: new Date().toISOString().slice(0, 10),
    expires_at: "",
  });

  // Load workspace data
  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await fetchHrWorkspaceData(profile);
      setHrTablesReady(res.hrTablesReady);
      setStaffList(res.staffList);
      setStaffChangeRequests(res.staffChangeRequests);
      setMyTasks(res.myTasks);
      setRecentActivities(res.recentActivities);
      setPolicySettings(res.policySettings);
      setOwnPrivateDetails(res.ownPrivateDetails);
      setAllPrivateDetails(res.allPrivateDetails);
      setLeavePolicies(res.leavePolicies);
      setLeaveRequests(res.leaveRequests);
      setAttendanceRecords(res.attendanceRecords);
      setAttendanceCorrections(res.attendanceCorrections);
      setHrDocuments(res.hrDocuments);
      setAnnouncements(res.announcements);
      setBirthdays(res.birthdays);
      setAnniversaries(res.anniversaries);

      setPersonalForm({
        phone: profile.phone || "",
        date_of_birth: res.ownPrivateDetails?.date_of_birth || "",
        residential_address: res.ownPrivateDetails?.residential_address || "",
        emergency_contact_name: res.ownPrivateDetails?.emergency_contact_name || "",
        emergency_contact_phone: res.ownPrivateDetails?.emergency_contact_phone || "",
        emergency_contact_relationship:
          res.ownPrivateDetails?.emergency_contact_relationship || "",
      });
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to load HR workspace data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  // Safe identity guard: Never fabricate auth_uid or allow unprovisioned profiles
  if (!profile || !profile.auth_uid || profile.auth_status === "not_provisioned") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs max-w-lg mx-auto my-12">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Staff Profile Not Provisioned</h2>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          Your current session cannot be resolved to a verified, provisioned ABLEBIZ SUITE staff identity.
          For security reasons, accounts are never matched by email alone. Please contact a Super Administrator
          to reconcile your profile in <strong>Staff &amp; RBAC</strong>.
        </p>
      </div>
    );
  }

  // Route & Section Authorization Resolution
  const normalizedSection = (section || "").toLowerCase().trim();

  // If ordinary staff (no management HR permissions) visits /admin/hr or any management sub-route,
  // enforce /admin/hr/portal strictly.
  if (!hasMgmtAccess && normalizedSection !== "portal") {
    return <Navigate to="/admin/hr/portal" replace />;
  }

  // If management staff visits /admin/hr without a section, default to /admin/hr/overview
  if (hasMgmtAccess && !normalizedSection) {
    return <Navigate to="/admin/hr/overview" replace />;
  }

  const isPortalMode = normalizedSection === "portal" || !hasMgmtAccess;
  const activeMgmtTab: HrManagementTab = !isPortalMode
    ? (normalizedSection as HrManagementTab)
    : "overview";

  // Block unauthorized management sub-routes (e.g. operations_manager visiting /admin/hr/settings or /admin/hr/documents)
  if (!isPortalMode && !canAccessHrManagementTab(profile.role, activeMgmtTab)) {
    return <Navigate to="/admin/hr/overview" replace />;
  }

  // Active super_admin count for maker-checker checks
  const activeSuperAdminCount = staffList.filter(
    (s) => normalizeStaffRole(s.role) === "super_admin" && s.is_active
  ).length;

  // Map staff by ID for fast manager & name lookups
  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfile>();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  const privateDetailsMap = useMemo(() => {
    const map = new Map<string, HrStaffDetails>();
    allPrivateDetails.forEach((d) => map.set(d.staff_id, d));
    if (ownPrivateDetails) {
      map.set(profile.id, ownPrivateDetails);
    }
    return map;
  }, [allPrivateDetails, ownPrivateDetails, profile.id]);

  // Period boundary helper for Overview & Reports
  const periodStartDate = useMemo(() => {
    const now = new Date();
    if (periodFilter === "this_month") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (periodFilter === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qMonth, 1);
    }
    if (periodFilter === "this_year") {
      return new Date(now.getFullYear(), 0, 1);
    }
    return null;
  }, [periodFilter]);

  // Computed metrics for Overview & Reports
  const totalStaffCount = staffList.length;
  const activeStaffCount = staffList.filter((s) => s.is_active).length;
  const inactiveStaffCount = totalStaffCount - activeStaffCount;

  const newHiresInPeriod = useMemo(() => {
    return staffList.filter((s) => {
      const refDateStr = s.hire_date || s.created_at;
      if (!refDateStr) return false;
      if (!periodStartDate) return true;
      return new Date(refDateStr) >= periodStartDate;
    });
  }, [staffList, periodStartDate]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = useMemo(
    () => attendanceRecords.filter((a) => a.attendance_date === todayStr),
    [attendanceRecords, todayStr]
  );
  const myTodayAttendance = useMemo(
    () => attendanceRecords.find((a) => a.staff_id === profile.id && a.attendance_date === todayStr),
    [attendanceRecords, profile.id, todayStr]
  );

  const pendingLeaveRequests = useMemo(
    () => leaveRequests.filter((l) => l.status === "pending" || l.status === "correction_requested"),
    [leaveRequests]
  );
  const pendingAttendanceCorrections = useMemo(
    () => attendanceCorrections.filter((c) => c.status === "pending"),
    [attendanceCorrections]
  );
  const pendingStaffChangeRequests = useMemo(
    () => staffChangeRequests.filter((r) => r.status === "pending"),
    [staffChangeRequests]
  );

  // Self-service scoped records
  const myLeaveRequests = useMemo(
    () => leaveRequests.filter((l) => l.staff_id === profile.id),
    [leaveRequests, profile.id]
  );
  const myAttendanceRecords = useMemo(
    () => attendanceRecords.filter((a) => a.staff_id === profile.id),
    [attendanceRecords, profile.id]
  );
  const myAttendanceCorrections = useMemo(
    () => attendanceCorrections.filter((c) => c.staff_id === profile.id),
    [attendanceCorrections, profile.id]
  );
  const myPermittedDocuments = useMemo(
    () =>
      hrDocuments.filter(
        (d) =>
          !d.is_archived &&
          (d.visibility_scope === "company_wide" ||
            (d.staff_id === profile.id && d.visibility_scope === "employee_and_hr"))
      ),
    [hrDocuments, profile.id]
  );
  const publishedAnnouncementsForMe = useMemo(() => {
    const myCanonicalRole = normalizeStaffRole(profile.role);
    return announcements.filter((a) => {
      if (a.status !== "published") return false;
      if (a.expires_at && a.expires_at < todayStr) return false;
      if (a.target_department && a.target_department !== profile.department) return false;
      if (a.target_role && normalizeStaffRole(a.target_role) !== myCanonicalRole) return false;
      return true;
    });
  }, [announcements, profile.department, profile.role, todayStr]);

  // Leave balance computation (Strictly only when leave_balances_enabled AND annual_entitlement_days is defined)
  const currentYear = new Date().getFullYear();
  const myLeaveUsageByType = useMemo(() => {
    const usage = new Map<string, number>();
    myLeaveRequests
      .filter(
        (r) =>
          r.status === "approved" &&
          new Date(`${r.start_date}T00:00:00`).getFullYear() === currentYear
      )
      .forEach((r) => {
        usage.set(r.leave_type, (usage.get(r.leave_type) || 0) + Number(r.days_count || 0));
      });
    return usage;
  }, [myLeaveRequests, currentYear]);

  // Filtered Staff Directory
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffList]);

  const filteredDirectory = useMemo(() => {
    return staffList.filter((s) => {
      const q = dirSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q) ||
        (s.job_title || "").toLowerCase().includes(q) ||
        getRoleTitle(s.role).toLowerCase().includes(q);
      const matchesRole = dirRoleFilter === "all" || normalizeStaffRole(s.role) === dirRoleFilter;
      const matchesDept = dirDeptFilter === "all" || s.department === dirDeptFilter;
      const empStatus = s.employment_status || (s.is_active ? "active" : "deprovisioned");
      const matchesStatus =
        dirStatusFilter === "all" ||
        (dirStatusFilter === "active_account" && s.is_active) ||
        (dirStatusFilter === "inactive_account" && !s.is_active) ||
        empStatus === dirStatusFilter;
      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [staffList, dirSearch, dirRoleFilter, dirDeptFilter, dirStatusFilter]);

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  const clearFeedback = () => {
    setFeedbackError("");
    setFeedbackSuccess("");
  };

  const handleSaveOwnPersonalDetails = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await updateOwnPersonalDetails(profile, personalForm);
      setFeedbackSuccess("Your personal & emergency contact details have been saved.");
      await refreshProfile();
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to update personal details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditEmployment = (target: StaffProfile) => {
    clearFeedback();
    const priv = privateDetailsMap.get(target.id);
    setEditingEmploymentStaff(target);
    setEmploymentForm({
      job_title: target.job_title || getRoleTitle(target.role),
      department: target.department || "Operations",
      employment_type: target.employment_type || "full_time",
      employment_status: target.employment_status || (target.is_active ? "active" : "deprovisioned"),
      reporting_manager_id: target.reporting_manager_id || "",
      hire_date: target.hire_date || "",
      work_location: target.work_location || "Abeokuta Head Office",
      hr_notes: priv?.hr_notes || "",
    });
  };

  const handleSaveEmploymentMetadata = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!editingEmploymentStaff || !e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await updateStaffEmploymentMetadata(profile, editingEmploymentStaff, {
        job_title: employmentForm.job_title,
        department: employmentForm.department,
        employment_type: employmentForm.employment_type,
        employment_status: employmentForm.employment_status,
        reporting_manager_id: employmentForm.reporting_manager_id || null,
        hire_date: employmentForm.hire_date || null,
        work_location: employmentForm.work_location,
        hr_notes: employmentForm.hr_notes,
      });
      setFeedbackSuccess(`Employment profile updated for ${editingEmploymentStaff.full_name}.`);
      setEditingEmploymentStaff(null);
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to update employment metadata.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitLeave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await submitLeaveRequest(profile, leaveRequests, leaveForm);
      setFeedbackSuccess("Leave application submitted and logged for review.");
      setIsLeaveModalOpen(false);
      setLeaveForm({
        leave_type: "annual",
        start_date: "",
        end_date: "",
        reason: "",
      });
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to submit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteLeaveDecision = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!reviewingLeave || !e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await decideLeaveRequest(
        profile,
        reviewingLeave,
        leaveDecision,
        leaveReviewComment,
        activeSuperAdminCount
      );
      setFeedbackSuccess(
        `Leave application for ${reviewingLeave.staff?.full_name || "Staff"} marked as ${leaveDecision.replace(/_/g, " ")}.`
      );
      setReviewingLeave(null);
      setLeaveReviewComment("");
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to record leave decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelLeave = async (req: HrLeaveRequest) => {
    clearFeedback();
    setIsSubmitting(true);
    try {
      await cancelOwnLeaveRequest(profile, req);
      setFeedbackSuccess("Your leave request has been cancelled.");
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Could not cancel leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmitLeave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!resubmittingLeave || !e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await resubmitLeaveRequest(profile, resubmittingLeave, resubmitForm);
      setFeedbackSuccess("Corrected leave request resubmitted for approval.");
      setResubmittingLeave(null);
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to resubmit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelfCheckInOut = async (mode: "check_in" | "check_out") => {
    clearFeedback();
    setIsSubmitting(true);
    try {
      await recordSelfCheckInOut(profile, mode, myTodayAttendance, policySettings);
      setFeedbackSuccess(
        mode === "check_in"
          ? "Checked in successfully for today."
          : "Checked out successfully for today."
      );
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Attendance action failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordManagementAttendance = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await recordManagementAttendance(profile, {
        staff_id: mgmtAttForm.staff_id,
        attendance_date: mgmtAttForm.attendance_date,
        status: mgmtAttForm.status,
        absence_type: mgmtAttForm.absence_type || null,
        check_in_time:
          ["present", "late", "half_day", "remote"].includes(mgmtAttForm.status)
            ? mgmtAttForm.check_in_time || null
            : null,
        check_out_time:
          ["present", "late", "half_day", "remote"].includes(mgmtAttForm.status)
            ? mgmtAttForm.check_out_time || null
            : null,
        notes: mgmtAttForm.notes,
      });
      setFeedbackSuccess("Attendance record saved.");
      setIsRecordAttModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to save attendance record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAttendanceCorrection = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await submitAttendanceCorrection(profile, {
        attendance_date: correctionForm.attendance_date,
        requested_status: correctionForm.requested_status,
        requested_check_in_time: correctionForm.requested_check_in_time || null,
        requested_check_out_time: correctionForm.requested_check_out_time || null,
        reason: correctionForm.reason,
      });
      setFeedbackSuccess("Attendance correction request submitted for management review.");
      setIsCorrectionModalOpen(false);
      setCorrectionForm({
        attendance_date: new Date().toISOString().slice(0, 10),
        requested_status: "present",
        requested_check_in_time: "08:30",
        requested_check_out_time: "17:00",
        reason: "",
      });
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to submit correction request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteCorrectionDecision = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!reviewingCorrection || !e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await decideAttendanceCorrection(
        profile,
        reviewingCorrection,
        correctionDecision,
        correctionReviewComment,
        activeSuperAdminCount
      );
      setFeedbackSuccess(`Attendance correction request ${correctionDecision}.`);
      setReviewingCorrection(null);
      setCorrectionReviewComment("");
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to process attendance correction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadDocumentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!docFile || !e.currentTarget.checkValidity()) {
      setFeedbackError("Please select a valid file (PDF, JPEG, PNG, or WEBP up to 20MB).");
      return;
    }

    clearFeedback();
    setIsSubmitting(true);
    try {
      await uploadHrDocument(profile, {
        file: docFile,
        title: docForm.title,
        category: docForm.category,
        visibility_scope:
          docUploadMode === "self" ? "employee_and_hr" : docForm.visibility_scope,
        staff_id: docUploadMode === "self" ? profile.id : docForm.staff_id || null,
        expiry_date: docForm.expiry_date || null,
        notes: docForm.notes || null,
      });
      setFeedbackSuccess("HR document securely uploaded to private vault.");
      setIsDocUploadOpen(false);
      setDocFile(null);
      setDocForm({
        title: "",
        category: "identification",
        visibility_scope: "employee_and_hr",
        staff_id: "",
        expiry_date: "",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Document upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadHrDoc = async (doc: HrDocumentRecord) => {
    clearFeedback();
    try {
      const signedUrl = await createHrDocumentSignedUrl(profile, doc);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setFeedbackError(err?.message || "Could not access private HR document.");
    }
  };

  const handleSaveAnnouncement = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncFormAriaInvalid(e.currentTarget);
    if (!e.currentTarget.checkValidity()) return;

    clearFeedback();
    setIsSubmitting(true);
    try {
      await createOrUpdateAnnouncement(profile, {
        id: announcementForm.id || undefined,
        title: announcementForm.title,
        body: announcementForm.body,
        category: announcementForm.category,
        priority: announcementForm.priority,
        status: announcementForm.status,
        target_department: announcementForm.target_department || null,
        target_role: announcementForm.target_role || null,
        is_pinned: announcementForm.is_pinned,
        effective_date: announcementForm.effective_date || null,
        expires_at: announcementForm.expires_at || null,
      });
      setFeedbackSuccess(
        `Announcement '${announcementForm.title}' saved (${announcementForm.status}).`
      );
      setIsAnnouncementModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to save announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePolicySettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearFeedback();
    setIsSubmitting(true);
    try {
      await saveHrPolicySettings(profile, policySettings);
      setFeedbackSuccess("HR policy configuration updated and audited.");
      await loadData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Failed to save HR policy settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportSafeHrCsv = () => {
    if (!hrPerms.export_hr_reports) {
      setFeedbackError("Forbidden: Your role is not authorized to export HR reports.");
      return;
    }

    // Explicitly excludes private fields (residential_address, emergency_contact, date_of_birth, hr_notes)
    const rows: string[][] = [
      ["ABLEBIZ SUITE - PERMISSION-SCOPED HR SUMMARY REPORT"],
      [`Generated At`, new Date().toISOString()],
      [`Generated By`, `${profile.full_name} (${getRoleTitle(profile.role)})`],
      [`Period Filter`, periodFilter.toUpperCase()],
      [],
      ["SUMMARY METRICS", "COUNT"],
      ["Total Staff Profiles", String(totalStaffCount)],
      ["Active Staff", String(activeStaffCount)],
      ["Inactive / Deprovisioned Staff", String(inactiveStaffCount)],
      ["New Hires in Selected Period", String(newHiresInPeriod.length)],
      ["Pending Leave Applications", String(pendingLeaveRequests.length)],
      [],
      [
        "STAFF FULL NAME",
        "CANONICAL ROLE",
        "JOB TITLE",
        "DEPARTMENT",
        "EMPLOYMENT TYPE",
        "EMPLOYMENT STATUS",
        "ACCOUNT ACTIVE",
        "WORK LOCATION",
        "HIRE DATE",
      ],
    ];

    staffList.forEach((s) => {
      rows.push([
        `"${(s.full_name || "").replace(/"/g, '""')}"`,
        normalizeStaffRole(s.role),
        `"${(s.job_title || getRoleTitle(s.role)).replace(/"/g, '""')}"`,
        `"${(s.department || "Operations").replace(/"/g, '""')}"`,
        s.employment_type || "full_time",
        s.employment_status || (s.is_active ? "active" : "deprovisioned"),
        s.is_active ? "YES" : "NO",
        `"${(s.work_location || "Abeokuta Head Office").replace(/"/g, '""')}"`,
        s.hire_date || (s.created_at ? s.created_at.slice(0, 10) : ""),
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\r\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `ablebiz_hr_report_${periodFilter}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & WORKSPACE SWITCHER                                   */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A2558]">
              {isPortalMode ? "My Staff Portal" : "Human Resources Workspace"}
            </h1>
            <span className="rounded-md bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              {getRoleTitle(profile.role)}
            </span>
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {profile.department || "Operations"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isPortalMode
              ? `Welcome back, ${profile.full_name}. View your employment profile, attendance, leave applications, personal documents, and company announcements.`
              : "Authoritative HR operations, staff directory, leave governance, attendance oversight, private employment vault, and announcements."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dual Experience Switcher (Rendered ONLY if user holds HR management permissions) */}
          {hasMgmtAccess && (
            <div
              className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-bold"
              role="group"
              aria-label="HR Experience Mode"
            >
              <button
                type="button"
                onClick={() => navigate("/admin/hr/overview")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  !isPortalMode
                    ? "bg-[#0A2558] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Management Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/hr/portal")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  isPortalMode
                    ? "bg-[#0A2558] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>My Staff Portal</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0A2558]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. MIGRATION & FEEDBACK BANNERS                                      */}
      {/* ==================================================================== */}
      {!hrTablesReady && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">
                HR Extended Database Tables Pending Deployment (`implementation/MIGRATION_HR_WORKSPACE.sql`)
              </p>
              <p className="text-amber-900 leading-relaxed">
                Live staff profiles, maker-checker governance, tasks, and audit logs are active. To enable persistent
                leave requests, attendance logs, private HR document metadata, and announcements in Supabase, execute{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-semibold">
                  implementation/MIGRATION_HR_WORKSPACE.sql
                </code>{" "}
                in the Supabase SQL Editor. No fake or browser-storage data is shown.
              </p>
            </div>
          </div>
        </div>
      )}

      {feedbackError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackError("")}
            className="text-red-500 hover:text-red-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {feedbackSuccess && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccess("")}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. NAVIGATION TABS (ROLE-AWARE)                                      */}
      {/* ==================================================================== */}
      {!isPortalMode ? (
        <div
          className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs"
          role="tablist"
          aria-label="HR Management Sections"
        >
          {MANAGEMENT_TAB_META.filter((item) => allowedMgmtTabs.includes(item.key)).map((item) => {
            const Icon = item.icon;
            const active = activeMgmtTab === item.key;
            const badgeCount =
              item.key === "leave"
                ? pendingLeaveRequests.length
                : item.key === "attendance"
                ? pendingAttendanceCorrections.length
                : undefined;

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  clearFeedback();
                  navigate(`/admin/hr/${item.key}`);
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-[#0A2558] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                      active ? "bg-amber-400 text-slate-950" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs"
          role="tablist"
          aria-label="My Staff Portal Sections"
        >
          {PORTAL_TAB_META.map((item) => {
            const Icon = item.icon;
            const active = portalTab === item.key;
            const badgeCount =
              item.key === "responsibilities"
                ? myTasks.filter((t) => t.status !== "completed").length
                : item.key === "announcements"
                ? publishedAnnouncementsForMe.length
                : undefined;

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  clearFeedback();
                  setPortalTab(item.key);
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-[#0A2558] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                      active ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MANAGEMENT WORKSPACE VIEWS                                        */}
      {/* ==================================================================== */}
      {!isPortalMode && (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* A. HR OVERVIEW                                                   */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "overview" && (
            <div className="space-y-6">
              {/* Period Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-[#0A2558]" />
                  <span>Scope: {hrPerms.scopeDescription}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">New Hires Period:</span>
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as any)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Year</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>

              {/* Persisted Metric Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Total Staff
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558]">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-slate-900">{totalStaffCount}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-bold text-emerald-700">{activeStaffCount} Active</span> •{" "}
                    <span className="text-slate-500">{inactiveStaffCount} Inactive</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      New Hires ({periodFilter.replace(/_/g, " ")})
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <UserCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-slate-900">
                    {newHiresInPeriod.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    From persisted <code className="font-mono">staff_profiles</code> records
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Pending Leave Requests
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <Calendar className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-slate-900">
                    {pendingLeaveRequests.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/hr/leave")}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#0A2558] hover:underline"
                  >
                    <span>Review leave queue</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Today&apos;s Attendance
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-slate-900">
                    {todayAttendance.filter((a) => ["present", "late", "remote", "half_day"].includes(a.status)).length}
                    <span className="text-sm font-semibold text-slate-400"> / {activeStaffCount}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {todayAttendance.length === 0
                      ? "No attendance logged for today yet"
                      : `${todayAttendance.filter((a) => a.status === "on_leave").length} on leave • ${pendingAttendanceCorrections.length} pending corrections`}
                  </p>
                </div>
              </div>

              {/* Outstanding Actions & Milestones Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Outstanding HR Actions */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Outstanding HR Actions &amp; Recent Activity
                      </h2>
                      <p className="text-xs text-slate-500">
                        Live items requiring management review and recent audited HR events
                      </p>
                    </div>
                    {(profile.role === "super_admin" || profile.role === "admin") && (
                      <Link
                        to="/admin/team"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#0A2558] hover:bg-slate-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Staff &amp; RBAC ({pendingStaffChangeRequests.length} Pending)</span>
                      </Link>
                    )}
                  </div>

                  {/* Action Queue */}
                  <div className="space-y-2">
                    {pendingLeaveRequests.slice(0, 3).map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            Leave Request: {req.staff?.full_name || "Staff Member"}
                          </span>
                          <p className="text-[11px] text-slate-600">
                            {req.leave_type.toUpperCase()} • {req.start_date} to {req.end_date} ({req.days_count} working days)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/admin/hr/leave")}
                          className="rounded-lg bg-[#0A2558] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#061738]"
                        >
                          Review
                        </button>
                      </div>
                    ))}

                    {pendingAttendanceCorrections.slice(0, 2).map((corr) => (
                      <div
                        key={corr.id}
                        className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            Attendance Correction: {corr.staff?.full_name || "Staff Member"}
                          </span>
                          <p className="text-[11px] text-slate-600">
                            Date: {corr.attendance_date} • Requested: {corr.requested_status}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/admin/hr/attendance")}
                          className="rounded-lg bg-[#0A2558] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#061738]"
                        >
                          Inspect
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Recent HR Timeline */}
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                      Recent Audited HR Activity
                    </h3>
                    {recentActivities.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                        No HR timeline events recorded yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {recentActivities.slice(0, 6).map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center justify-between py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-[#0A2558]" />
                              <span className="font-semibold text-slate-800">
                                {act.event_title}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap ml-3">
                              {new Date(act.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Birthdays & Work Anniversaries */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cake className="h-4 w-4 text-amber-600" />
                      <h2 className="text-sm font-bold text-slate-900">
                        Birthdays &amp; Work Anniversaries
                      </h2>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Displayed from recorded staff dates (month &amp; day only)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Recorded Birthdays
                    </h3>
                    {birthdays.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                        No staff birth dates recorded yet. Staff can add their birth date in{" "}
                        <strong>My Staff Portal</strong>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {birthdays.slice(0, 5).map((b) => (
                          <div
                            key={b.staff_id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{b.full_name}</p>
                              <p className="text-[11px] text-slate-500">{b.department}</p>
                            </div>
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                              {b.display_date}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Work Anniversaries (Hire Date)
                    </h3>
                    {anniversaries.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                        No formal hire dates configured yet. HR managers can set hire dates in the{" "}
                        <strong>Staff Directory</strong>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {anniversaries.slice(0, 5).map((a) => (
                          <div
                            key={a.staff_id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{a.full_name}</p>
                              <p className="text-[11px] text-slate-500">{a.department}</p>
                            </div>
                            <div className="text-right">
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0A2558]">
                                {a.display_date}
                              </span>
                              {typeof a.years_of_service === "number" && (
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {a.years_of_service} yr(s)
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* B. STAFF DIRECTORY                                               */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "directory" && (
            <div className="space-y-5">
              {/* Governance Banner linking to /admin/team */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-[#0A2558] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#0A2558]">
                      Separation of HR Metadata &amp; Privileged Account Governance
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      HR employment metadata (job title, reporting manager, start date, work location) is managed here.
                      Privileged account provisioning, canonical role changes, deactivation, and deprovisioning strictly
                      follow the Maker-Checker workflow in <strong>Staff &amp; RBAC</strong>.
                    </p>
                  </div>
                </div>
                {(profile.role === "super_admin" || profile.role === "admin") && (
                  <Link
                    to="/admin/team"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738] transition"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Open Staff &amp; RBAC</span>
                  </Link>
                )}
              </div>

              {/* Search & Filter Bar */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, title, dept..."
                    value={dirSearch}
                    onChange={(e) => setDirSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#0A2558]"
                  />
                </div>

                <select
                  value={dirRoleFilter}
                  onChange={(e) => setDirRoleFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Canonical Roles</option>
                  {CANONICAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DEFINITIONS[r].title} ({r})
                    </option>
                  ))}
                </select>

                <select
                  value={dirDeptFilter}
                  onChange={(e) => setDirDeptFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Departments</option>
                  {departmentsList.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                <select
                  value={dirStatusFilter}
                  onChange={(e) => setDirStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Employment Statuses</option>
                  <option value="active_account">Active System Accounts</option>
                  <option value="inactive_account">Inactive / Deprovisioned Accounts</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Staff Directory Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">Staff Member</th>
                        <th className="px-4 py-3.5">Job Title &amp; Role</th>
                        <th className="px-4 py-3.5">Department</th>
                        <th className="px-4 py-3.5">Reporting Manager</th>
                        <th className="px-4 py-3.5">Start Date</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredDirectory.map((staff) => {
                        const manager = staff.reporting_manager_id
                          ? staffMap.get(staff.reporting_manager_id)
                          : null;
                        const empStatus =
                          staff.employment_status || (staff.is_active ? "active" : "deprovisioned");
                        const canEditHr = canEditTargetStaffHrMetadata(profile.role, staff.role);

                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{staff.full_name}</div>
                              <div className="text-[11px] text-slate-500">{staff.email}</div>
                              {staff.phone && (
                                <div className="text-[11px] text-slate-400">{staff.phone}</div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-900">
                                {staff.job_title || getRoleTitle(staff.role)}
                              </div>
                              <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
                                {normalizeStaffRole(staff.role)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div>{staff.department || "Operations"}</div>
                              <div className="text-[10px] text-slate-400">
                                {(staff.employment_type || "full_time").replace(/_/g, " ").toUpperCase()}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              {manager ? (
                                <span className="font-medium text-slate-800">
                                  {manager.full_name}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">
                              {staff.hire_date ||
                                (staff.created_at ? new Date(staff.created_at).toLocaleDateString() : "—")}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    staff.is_active
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-red-50 text-red-700 border border-red-200"
                                  }`}
                                >
                                  {empStatus.replace(/_/g, " ")}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectingStaff(staff)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Profile
                                </button>
                                {canEditHr && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEmployment(staff)}
                                    className="rounded-lg bg-[#0A2558] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#061738]"
                                  >
                                    Edit HR Info
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
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* C. ATTENDANCE & ABSENCE MANAGEMENT                               */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "attendance" && (
            <div className="space-y-6">
              {/* Attendance Process Clarity Banner */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Staff Attendance &amp; Absence Register
                    </h2>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                      {policySettings.attendance_enabled ? "Manual & Portal Recording Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Standard working hours: <strong>{policySettings.workday_start_time}</strong> to{" "}
                    <strong>{policySettings.workday_end_time}</strong> (Late threshold:{" "}
                    {policySettings.late_threshold_minutes} mins). Biometric, geolocation, and automated payroll
                    integrations are intentionally not enabled.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setMgmtAttForm({
                      staff_id: staffList.find((s) => s.is_active)?.id || "",
                      attendance_date: todayStr,
                      status: "present",
                      absence_type: "",
                      check_in_time: "08:30",
                      check_out_time: "17:00",
                      notes: "",
                    });
                    setIsRecordAttModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Record Attendance</span>
                </button>
              </div>

              {/* Pending Correction Requests Queue */}
              {attendanceCorrections.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Attendance Correction Requests ({pendingAttendanceCorrections.length} Pending)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5">Staff Member</th>
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Requested Status</th>
                          <th className="px-3 py-2.5">Reason</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceCorrections.map((corr) => {
                          const elig = evaluateAttendanceCorrectionEligibility(
                            profile,
                            corr.staff_id,
                            activeSuperAdminCount
                          );
                          return (
                            <tr key={corr.id}>
                              <td className="px-3 py-2.5 font-bold text-slate-900">
                                {corr.staff?.full_name || "Staff"}
                              </td>
                              <td className="px-3 py-2.5">{corr.attendance_date}</td>
                              <td className="px-3 py-2.5 uppercase font-semibold">
                                {corr.requested_status.replace(/_/g, " ")}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">{corr.reason}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    corr.status === "approved"
                                      ? "bg-emerald-50 text-emerald-800"
                                      : corr.status === "rejected"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-amber-50 text-amber-800"
                                  }`}
                                >
                                  {corr.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {corr.status === "pending" && elig.allowed ? (
                                  <div className="inline-flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewingCorrection(corr);
                                        setCorrectionDecision("approved");
                                        setCorrectionReviewComment("");
                                      }}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewingCorrection(corr);
                                        setCorrectionDecision("rejected");
                                        setCorrectionReviewComment("");
                                      }}
                                      className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : corr.status === "pending" ? (
                                  <span className="text-[11px] text-slate-400" title={elig.reason}>
                                    Self-review blocked
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    Reviewed by {corr.reviewer?.full_name || "Management"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance Filter & Log Table */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={attDateFilter}
                  onChange={(e) => setAttDateFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
                />
                <select
                  value={attStatusFilter}
                  onChange={(e) => setAttStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Attendance Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On Leave</option>
                  <option value="remote">Remote</option>
                  <option value="half_day">Half Day</option>
                  <option value="excused">Excused</option>
                </select>
                {attDateFilter && (
                  <button
                    type="button"
                    onClick={() => setAttDateFilter("")}
                    className="text-xs font-semibold text-[#0A2558] hover:underline"
                  >
                    Clear Date Filter
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {attendanceRecords.length === 0 ? (
                  <div className="p-12 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No attendance records logged yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Attendance entries recorded by staff or HR management will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Staff Member</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Check In</th>
                          <th className="px-4 py-3">Check Out</th>
                          <th className="px-4 py-3">Source / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceRecords
                          .filter((r) => {
                            const matchDate = !attDateFilter || r.attendance_date === attDateFilter;
                            const matchStatus = attStatusFilter === "all" || r.status === attStatusFilter;
                            return matchDate && matchStatus;
                          })
                          .map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                                {rec.attendance_date}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">
                                  {rec.staff?.full_name || staffMap.get(rec.staff_id)?.full_name || "Staff"}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {rec.staff?.department || staffMap.get(rec.staff_id)?.department}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    rec.status === "present" || rec.status === "remote"
                                      ? "bg-emerald-50 text-emerald-800"
                                      : rec.status === "late" || rec.status === "half_day"
                                      ? "bg-amber-50 text-amber-800"
                                      : rec.status === "absent"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-blue-50 text-blue-800"
                                  }`}
                                >
                                  {rec.status.replace(/_/g, " ")}
                                </span>
                                {rec.absence_type && (
                                  <span className="ml-1.5 text-[10px] text-slate-500">
                                    ({rec.absence_type.replace(/_/g, " ")})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {rec.check_in_at
                                  ? new Date(rec.check_in_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {rec.check_out_at
                                  ? new Date(rec.check_out_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                <span className="uppercase text-[10px] font-semibold text-slate-400">
                                  {rec.source.replace(/_/g, " ")}
                                </span>
                                {rec.notes ? ` • ${rec.notes}` : ""}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* D. LEAVE MANAGEMENT                                              */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "leave" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Leave Applications &amp; Maker-Checker Approval Queue
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Separation of duties is strictly enforced: approvers cannot approve their own leave applications.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={leaveStatusFilter}
                    onChange={(e) => setLeaveStatusFilter(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">All Leave Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="correction_requested">Correction Requested</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {leaveRequests.length === 0 ? (
                  <div className="p-12 text-center">
                    <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No leave requests recorded</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Staff leave submissions and approval decisions will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Staff Member</th>
                          <th className="px-4 py-3.5">Leave Category</th>
                          <th className="px-4 py-3.5">Dates &amp; Duration</th>
                          <th className="px-4 py-3.5">Reason &amp; Reviewer Comment</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Decision Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaveRequests
                          .filter((r) => leaveStatusFilter === "all" || r.status === leaveStatusFilter)
                          .map((req) => {
                            const elig = evaluateLeaveDecisionEligibility(
                              profile,
                              req.staff_id,
                              req.staff?.role || staffMap.get(req.staff_id)?.role,
                              activeSuperAdminCount
                            );

                            return (
                              <tr key={req.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-slate-900">
                                    {req.staff?.full_name || staffMap.get(req.staff_id)?.full_name || "Staff"}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {req.staff?.department || staffMap.get(req.staff_id)?.department}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 font-semibold uppercase text-slate-700">
                                  {req.leave_type.replace(/_/g, " ")}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-slate-900">
                                    {req.start_date} → {req.end_date}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {req.days_count} working day(s)
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 max-w-xs">
                                  <p className="text-slate-800">{req.reason}</p>
                                  {req.reviewer_comment && (
                                    <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                      <strong>Reviewer ({req.reviewer?.full_name || "HR"}):</strong>{" "}
                                      {req.reviewer_comment}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                      req.status === "approved"
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : req.status === "rejected" || req.status === "cancelled"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-amber-50 text-amber-800 border border-amber-200"
                                    }`}
                                  >
                                    {req.status.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  {req.status === "pending" && elig.allowed ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewingLeave(req);
                                          setLeaveDecision("approved");
                                          setLeaveReviewComment("");
                                        }}
                                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewingLeave(req);
                                          setLeaveDecision("correction_requested");
                                          setLeaveReviewComment("");
                                        }}
                                        className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
                                      >
                                        Request Correction
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewingLeave(req);
                                          setLeaveDecision("rejected");
                                          setLeaveReviewComment("");
                                        }}
                                        className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : req.status === "pending" ? (
                                    <span className="text-[11px] text-slate-400" title={elig.reason}>
                                      {elig.reason || "Restricted"}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">
                                      {req.reviewed_at
                                        ? `Decided ${new Date(req.reviewed_at).toLocaleDateString()}`
                                        : "Closed"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* E. HR DOCUMENTS VAULT                                            */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "documents" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Confidential HR Document Vault
                    </h2>
                    <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-[#0A2558]">
                      Private Bucket: ablebiz_hr_documents
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Access-controlled employment contracts, identification, appraisals, disciplinary records, and
                    policies. Delivered strictly via 60-second signed URLs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setDocUploadMode("management");
                    setDocForm({
                      title: "",
                      category: "employment_contract",
                      visibility_scope: "employee_and_hr",
                      staff_id: staffList[0]?.id || "",
                      expiry_date: "",
                      notes: "",
                    });
                    setDocFile(null);
                    setIsDocUploadOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload HR Document</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search document title or employee..."
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none"
                  />
                </div>
                <select
                  value={docCatFilter}
                  onChange={(e) => setDocCatFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All HR Document Categories</option>
                  {HR_DOC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={docScopeFilter}
                  onChange={(e) => setDocScopeFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Visibility Scopes</option>
                  <option value="employee_and_hr">Employee &amp; HR Management</option>
                  <option value="hr_management_only">HR Management Only (Confidential)</option>
                  <option value="super_admin_only">Super Admin Only (Executive Restricted)</option>
                  <option value="company_wide">Company-Wide Policy / Handbook</option>
                </select>
              </div>

              {/* Documents Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {hrDocuments.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No HR documents in vault</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Uploaded contracts, identification, and policy handbooks will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Document Title</th>
                          <th className="px-4 py-3.5">Employee / Scope</th>
                          <th className="px-4 py-3.5">Category</th>
                          <th className="px-4 py-3.5">Access Scope</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hrDocuments
                          .filter((d) => {
                            if (d.is_archived) return false;
                            const q = docSearch.toLowerCase().trim();
                            const matchQ =
                              !q ||
                              d.title.toLowerCase().includes(q) ||
                              (d.staff?.full_name || "").toLowerCase().includes(q);
                            const matchCat = docCatFilter === "all" || d.category === docCatFilter;
                            const matchScope =
                              docScopeFilter === "all" || d.visibility_scope === docScopeFilter;
                            return matchQ && matchCat && matchScope;
                          })
                          .map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3.5 font-bold text-slate-900">
                                {doc.title}
                                <div className="text-[10px] font-normal text-slate-400">
                                  {(doc.file_size / 1024 / 1024).toFixed(2)} MB •{" "}
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                {doc.visibility_scope === "company_wide" ? (
                                  <span className="font-semibold text-[#0A2558]">All Staff (Company-Wide)</span>
                                ) : (
                                  <span>
                                    {doc.staff?.full_name ||
                                      staffMap.get(doc.staff_id || "")?.full_name ||
                                      "Assigned Staff"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 uppercase text-[11px] font-semibold text-slate-600">
                                {doc.category.replace(/_/g, " ")}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    doc.visibility_scope === "super_admin_only"
                                      ? "bg-purple-50 text-purple-800 border border-purple-200"
                                      : doc.visibility_scope === "hr_management_only"
                                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {doc.visibility_scope.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                {doc.is_verified ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold text-[11px]">
                                    Pending Verification
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadHrDoc(doc)}
                                    className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-[#0A2558] hover:bg-blue-100"
                                  >
                                    Signed URL
                                  </button>
                                  {!doc.is_verified && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        verifyOrArchiveHrDocument(profile, doc, { is_verified: true }).then(
                                          loadData
                                        )
                                      }
                                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                    >
                                      Verify
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      verifyOrArchiveHrDocument(profile, doc, { is_archived: true }).then(
                                        loadData
                                      )
                                    }
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                                  >
                                    Archive
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* F. HR ANNOUNCEMENTS MANAGEMENT                                   */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "announcements" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    HR Announcements &amp; Internal Circulars
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Drafts and archived notices are strictly concealed from ordinary staff at the database RLS layer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setAnnouncementForm({
                      id: "",
                      title: "",
                      body: "",
                      category: "general",
                      priority: "normal",
                      status: "published",
                      target_department: "",
                      target_role: "",
                      is_pinned: false,
                      effective_date: todayStr,
                      expires_at: "",
                    });
                    setIsAnnouncementModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Announcement</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {announcements.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                    <Megaphone className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No announcements created yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Publish company notices, policy updates, or holiday schedules for staff.
                    </p>
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {ann.is_pinned && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              <Pin className="h-3 w-3" /> Pinned
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              ann.status === "published"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : ann.status === "draft"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {ann.status}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {ann.category.replace(/_/g, " ")}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAnnouncementForm({
                                id: ann.id,
                                title: ann.title,
                                body: ann.body,
                                category: ann.category,
                                priority: ann.priority,
                                status: ann.status,
                                target_department: ann.target_department || "",
                                target_role: ann.target_role || "",
                                is_pinned: ann.is_pinned,
                                effective_date: ann.effective_date || todayStr,
                                expires_at: ann.expires_at || "",
                              });
                              setIsAnnouncementModalOpen(true);
                            }}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit / Status
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        {ann.body}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                        <span>Author: {ann.author?.full_name || "HR Management"}</span>
                        {ann.published_at && (
                          <span>
                            Published: {new Date(ann.published_at).toLocaleDateString()} by{" "}
                            {ann.publisher?.full_name || "HR"}
                          </span>
                        )}
                        <span>
                          Audience: {ann.target_department || "All Departments"} /{" "}
                          {ann.target_role ? getRoleTitle(ann.target_role) : "All Roles"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* G. HR REPORTS                                                    */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "reports" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Permission-Scoped HR Analytics &amp; Reports
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time headcount, employment status distribution, leave utilization, and attendance summaries.
                    Private residential, emergency contact, and salary records are stripped from exports.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as any)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Year</option>
                    <option value="all">All Time</option>
                  </select>

                  {hrPerms.export_hr_reports && (
                    <button
                      type="button"
                      onClick={handleExportSafeHrCsv}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Safe CSV</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Headcount by Canonical Role & Department */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Headcount Breakdown by Canonical Role
                  </h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {CANONICAL_ROLES.map((r) => {
                      const count = staffList.filter((s) => normalizeStaffRole(s.role) === r).length;
                      const activeCount = staffList.filter(
                        (s) => normalizeStaffRole(s.role) === r && s.is_active
                      ).length;
                      return (
                        <div key={r} className="flex items-center justify-between py-2.5">
                          <div>
                            <span className="font-bold text-slate-800">
                              {ROLE_DEFINITIONS[r].title}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-slate-400">({r})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">{count} total</span>
                            <span className="ml-2 text-[11px] text-emerald-700">
                              ({activeCount} active)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leave & Attendance Summary */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Leave &amp; Attendance Activity Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <p className="text-slate-500 font-semibold">Approved Leave Requests</p>
                      <p className="mt-1 text-xl font-extrabold text-emerald-700">
                        {leaveRequests.filter((l) => l.status === "approved").length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <p className="text-slate-500 font-semibold">Total Approved Leave Days</p>
                      <p className="mt-1 text-xl font-extrabold text-[#0A2558]">
                        {leaveRequests
                          .filter((l) => l.status === "approved")
                          .reduce((acc, l) => acc + Number(l.days_count || 0), 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <p className="text-slate-500 font-semibold">Attendance Logs Recorded</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-900">
                        {attendanceRecords.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <p className="text-slate-500 font-semibold">Verified HR Documents</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-900">
                        {hrDocuments.filter((d) => d.is_verified && !d.is_archived).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* H. HR SETTINGS & POLICY CONFIGURATION (SUPER ADMIN ONLY)         */}
          {/* ---------------------------------------------------------------- */}
          {activeMgmtTab === "settings" && hrPerms.configure_hr_policies && (
            <div className="space-y-6">
              {/* General HR Policy Settings */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <h2 className="text-base font-bold text-slate-900">
                  HR Policy &amp; Entitlement Governance (Super Admin Only)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure attendance recording rules and activate verified leave entitlements. Leave balances are
                  never fabricated or displayed as authoritative unless explicitly enabled below.
                </p>

                <form onSubmit={handleSavePolicySettings} className="mt-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="font-bold text-slate-700">Workday Start Time</label>
                      <input
                        type="time"
                        value={policySettings.workday_start_time?.slice(0, 5) || "08:30"}
                        onChange={(e) =>
                          setPolicySettings((p) => ({
                            ...p,
                            workday_start_time: `${e.target.value}:00`,
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Workday End Time</label>
                      <input
                        type="time"
                        value={policySettings.workday_end_time?.slice(0, 5) || "17:00"}
                        onChange={(e) =>
                          setPolicySettings((p) => ({
                            ...p,
                            workday_end_time: `${e.target.value}:00`,
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Late Grace Threshold (Minutes)</label>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={policySettings.late_threshold_minutes}
                        onChange={(e) =>
                          setPolicySettings((p) => ({
                            ...p,
                            late_threshold_minutes: Number(e.target.value),
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policySettings.attendance_enabled}
                        onChange={(e) =>
                          setPolicySettings((p) => ({ ...p, attendance_enabled: e.target.checked }))
                        }
                      />
                      <span className="font-semibold text-slate-800">Enable Attendance Module</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policySettings.allow_self_clock_in}
                        onChange={(e) =>
                          setPolicySettings((p) => ({ ...p, allow_self_clock_in: e.target.checked }))
                        }
                      />
                      <span className="font-semibold text-slate-800">
                        Allow Self-Service Portal Check-In/Out
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policySettings.leave_balances_enabled}
                        onChange={(e) =>
                          setPolicySettings((p) => ({
                            ...p,
                            leave_balances_enabled: e.target.checked,
                          }))
                        }
                      />
                      <span className="font-semibold text-slate-800">
                        Enable Verified Leave Balance Calculation
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                    >
                      {isSubmitting ? "Saving Policy..." : "Save HR Policy Configuration"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Leave Category Entitlements Configuration */}
              {leavePolicies.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Leave Category Entitlement Rules
                    </h3>
                    <p className="text-xs text-slate-500">
                      Set annual working-day entitlements per category. Leave blank (unconfigured) if no fixed cap
                      applies.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5">Annual Entitlement (Days)</th>
                          <th className="px-3 py-2.5">Paid Leave</th>
                          <th className="px-3 py-2.5">Requires Document</th>
                          <th className="px-3 py-2.5 text-right">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leavePolicies.map((lp) => (
                          <tr key={lp.id}>
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              {lp.display_name}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min={0}
                                max={365}
                                placeholder="Unconfigured"
                                value={lp.annual_entitlement_days ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === "" ? null : Number(e.target.value);
                                  setLeavePolicies((prev) =>
                                    prev.map((item) =>
                                      item.id === lp.id
                                        ? { ...item, annual_entitlement_days: val }
                                        : item
                                    )
                                  );
                                }}
                                className="h-8 w-28 rounded-lg border border-slate-200 px-2.5 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={lp.is_paid}
                                onChange={(e) =>
                                  setLeavePolicies((prev) =>
                                    prev.map((item) =>
                                      item.id === lp.id
                                        ? { ...item, is_paid: e.target.checked }
                                        : item
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={lp.requires_document}
                                onChange={(e) =>
                                  setLeavePolicies((prev) =>
                                    prev.map((item) =>
                                      item.id === lp.id
                                        ? { ...item, requires_document: e.target.checked }
                                        : item
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  updateLeavePolicyEntitlement(profile, lp.id, {
                                    annual_entitlement_days: lp.annual_entitlement_days,
                                    requires_document: lp.requires_document,
                                    is_paid: lp.is_paid,
                                    is_active: lp.is_active,
                                  }).then(() => {
                                    setFeedbackSuccess(`Updated entitlement for ${lp.display_name}.`);
                                    loadData();
                                  })
                                }
                                className="rounded-lg bg-[#0A2558] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#061738]"
                              >
                                Update
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Canonical HR Permission Matrix Reference */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Canonical 8-Role HR Permission Matrix (Enforced by RLS &amp; RPC)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Read-only governance reference showing exact HR capabilities per canonical role.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
                      <tr>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5 text-center">Overview</th>
                        <th className="p-2.5 text-center">Directory</th>
                        <th className="p-2.5 text-center">Own Profile</th>
                        <th className="p-2.5 text-center">Other Profile</th>
                        <th className="p-2.5 text-center">Edit HR Meta</th>
                        <th className="p-2.5 text-center">Attendance Mgmt</th>
                        <th className="p-2.5 text-center">Submit Leave</th>
                        <th className="p-2.5 text-center">Decide Leave</th>
                        <th className="p-2.5 text-center">HR Docs</th>
                        <th className="p-2.5 text-center">Announce</th>
                        <th className="p-2.5 text-center">Export</th>
                        <th className="p-2.5 text-center">Policies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {CANONICAL_ROLES.map((r) => {
                        const row = HR_PERMISSION_MATRIX[r];
                        const renderMark = (v: boolean) =>
                          v ? (
                            <span className="font-bold text-emerald-700">YES</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          );
                        return (
                          <tr key={r}>
                            <td className="p-2.5 font-bold text-slate-900">
                              {ROLE_DEFINITIONS[r].title}
                            </td>
                            <td className="p-2.5 text-center">{renderMark(row.view_hr_overview)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.view_staff_directory)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.view_own_profile)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.view_other_staff_profile)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.edit_staff_hr_metadata)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.manage_attendance_records)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.submit_leave_requests)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.review_decide_leave_requests)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.manage_hr_documents)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.publish_announcements)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.export_hr_reports)}</td>
                            <td className="p-2.5 text-center">{renderMark(row.configure_hr_policies)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* 5. MY STAFF PORTAL (PERSONALIZED SELF-SERVICE EXPERIENCE)            */}
      {/* ==================================================================== */}
      {isPortalMode && (
        <div className="space-y-6">
          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 1: MY PROFILE & PERMITTED PERSONAL DETAILS            */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "profile" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Read-Only Canonical Employment Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A2558] text-amber-300 font-extrabold text-lg">
                    {(profile.full_name?.[0] || "S").toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.full_name}</h2>
                    <p className="text-xs font-semibold text-amber-700">
                      {profile.job_title || getRoleTitle(profile.role)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Work Email</span>
                    <span className="font-semibold text-slate-900">{profile.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Canonical Role</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {normalizeStaffRole(profile.role)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold text-slate-900">
                      {profile.department || "Operations"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employment Type</span>
                    <span className="font-semibold text-slate-900 uppercase">
                      {(profile.employment_type || "full_time").replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employment Status</span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                      {(profile.employment_status || "active").replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reporting Manager</span>
                    <span className="font-semibold text-slate-900">
                      {profile.reporting_manager_id
                        ? staffMap.get(profile.reporting_manager_id)?.full_name || "Assigned"
                        : "Executive Management"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Start / Hire Date</span>
                    <span className="font-semibold text-slate-900">
                      {profile.hire_date ||
                        (profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Work Location</span>
                    <span className="font-semibold text-slate-900">
                      {profile.work_location || "Abeokuta Head Office"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500">
                  <Lock className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                  Protected employment fields (role, department, status, reporting line) are governed by HR Management
                  and cannot be modified through self-service.
                </div>
              </div>

              {/* Editable Permitted Personal & Emergency Contact Form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-2">
                <h2 className="text-base font-bold text-slate-900">
                  Update Permitted Personal &amp; Emergency Contact Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your private address and emergency contact details are protected by Row-Level Security and visible
                  only to you and authorized executive HR.
                </p>

                <form onSubmit={handleSaveOwnPersonalDetails} className="mt-5 space-y-4 text-xs" noValidate>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="self-phone" className="font-bold text-slate-700">
                        Phone Number *
                      </label>
                      <input
                        id="self-phone"
                        type="tel"
                        required
                        onBlur={handleFieldBlurAria}
                        value={personalForm.phone}
                        onChange={(e) => setPersonalForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="e.g. 0803 000 0000"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558] user-invalid:border-red-600 user-invalid:bg-red-50/40"
                      />
                    </div>

                    <div>
                      <label htmlFor="self-dob" className="font-bold text-slate-700">
                        Date of Birth (Used for Month/Day Birthday Celebrations)
                      </label>
                      <input
                        id="self-dob"
                        type="date"
                        value={personalForm.date_of_birth}
                        onChange={(e) =>
                          setPersonalForm((p) => ({ ...p, date_of_birth: e.target.value }))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="self-address" className="font-bold text-slate-700">
                      Residential Address
                    </label>
                    <input
                      id="self-address"
                      type="text"
                      value={personalForm.residential_address}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, residential_address: e.target.value }))
                      }
                      placeholder="Current residential address"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2 border-t border-slate-100">
                    <div>
                      <label htmlFor="self-ec-name" className="font-bold text-slate-700">
                        Emergency Contact Name
                      </label>
                      <input
                        id="self-ec-name"
                        type="text"
                        value={personalForm.emergency_contact_name}
                        onChange={(e) =>
                          setPersonalForm((p) => ({
                            ...p,
                            emergency_contact_name: e.target.value,
                          }))
                        }
                        placeholder="Full name"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558]"
                      />
                    </div>

                    <div>
                      <label htmlFor="self-ec-phone" className="font-bold text-slate-700">
                        Emergency Contact Phone
                      </label>
                      <input
                        id="self-ec-phone"
                        type="tel"
                        value={personalForm.emergency_contact_phone}
                        onChange={(e) =>
                          setPersonalForm((p) => ({
                            ...p,
                            emergency_contact_phone: e.target.value,
                          }))
                        }
                        placeholder="Phone number"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558]"
                      />
                    </div>

                    <div>
                      <label htmlFor="self-ec-rel" className="font-bold text-slate-700">
                        Relationship
                      </label>
                      <input
                        id="self-ec-rel"
                        type="text"
                        value={personalForm.emergency_contact_relationship}
                        onChange={(e) =>
                          setPersonalForm((p) => ({
                            ...p,
                            emergency_contact_relationship: e.target.value,
                          }))
                        }
                        placeholder="e.g. Spouse, Parent, Sibling"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#0A2558]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-[#0A2558] px-4 py-2 text-xs font-bold text-white hover:bg-[#061738] transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Saving..." : "Save Personal Details"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 2: MY ATTENDANCE                                      */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "attendance" && (
            <div className="space-y-6">
              {/* Self Check-In / Check-Out & Correction Bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    My Daily Attendance ({todayStr})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {myTodayAttendance
                      ? `Status today: ${myTodayAttendance.status.toUpperCase()} • Check-in: ${
                          myTodayAttendance.check_in_at
                            ? new Date(myTodayAttendance.check_in_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"
                        } • Check-out: ${
                          myTodayAttendance.check_out_at
                            ? new Date(myTodayAttendance.check_out_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Not checked out"
                        }`
                      : "You have not logged check-in for today yet."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {policySettings.attendance_enabled && policySettings.allow_self_clock_in && (
                    <>
                      {!myTodayAttendance?.check_in_at && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelfCheckInOut("check_in")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <LogIn className="h-4 w-4" />
                          <span>Check In Now</span>
                        </button>
                      )}
                      {myTodayAttendance?.check_in_at && !myTodayAttendance?.check_out_at && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelfCheckInOut("check_out")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Check Out Now</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      setIsCorrectionModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <History className="h-4 w-4" />
                    <span>Request Attendance Correction</span>
                  </button>
                </div>
              </div>

              {/* My Attendance History */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h3 className="text-sm font-bold text-slate-900">My Attendance History</h3>
                </div>
                {myAttendanceRecords.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No personal attendance records found yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Check In</th>
                          <th className="px-4 py-3">Check Out</th>
                          <th className="px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myAttendanceRecords.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-mono font-semibold">{r.attendance_date}</td>
                            <td className="px-4 py-3 uppercase font-bold text-slate-700">
                              {r.status.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3">
                              {r.check_in_at
                                ? new Date(r.check_in_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {r.check_out_at
                                ? new Date(r.check_out_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{r.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* My Correction Requests */}
              {myAttendanceCorrections.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  <div className="border-b border-slate-100 px-5 py-3.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      My Attendance Correction Requests
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Requested Status</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Decision Status</th>
                          <th className="px-4 py-3">Reviewer Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myAttendanceCorrections.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-3 font-mono">{c.attendance_date}</td>
                            <td className="px-4 py-3 uppercase font-semibold">
                              {c.requested_status.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3">{c.reason}</td>
                            <td className="px-4 py-3 uppercase font-bold">{c.status}</td>
                            <td className="px-4 py-3 text-slate-500">{c.reviewer_comment || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 3: MY LEAVE & BALANCES                                */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "leave" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    My Leave Applications &amp; Entitlement Summary
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submit new leave applications and track reviewer decisions and comments.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setIsLeaveModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Request Leave</span>
                </button>
              </div>

              {/* Leave Balance / Usage Cards */}
              {policySettings.leave_balances_enabled &&
              leavePolicies.some((lp) => lp.annual_entitlement_days !== null) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {leavePolicies
                    .filter((lp) => lp.is_active && lp.annual_entitlement_days !== null)
                    .map((lp) => {
                      const used = myLeaveUsageByType.get(lp.leave_type) || 0;
                      const entitlement = Number(lp.annual_entitlement_days || 0);
                      const remaining = Math.max(0, entitlement - used);
                      return (
                        <div
                          key={lp.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                        >
                          <p className="text-xs font-bold text-slate-500">{lp.display_name}</p>
                          <p className="mt-2 text-2xl font-extrabold text-[#0A2558]">
                            {remaining} <span className="text-xs font-normal text-slate-500">days left</span>
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Used: {used} / {entitlement} days ({currentYear})
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <strong>Leave Balance Policy Notice:</strong> Fixed annual leave entitlement balances have not yet
                  been activated in HR Settings. No unverified balance is displayed. Your approved leave taken in{" "}
                  {currentYear} is{" "}
                  <strong>
                    {Array.from(myLeaveUsageByType.values()).reduce((a, b) => a + b, 0)} working day(s)
                  </strong>
                  .
                </div>
              )}

              {/* My Leave Requests Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {myLeaveRequests.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    You have not submitted any leave applications yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Category</th>
                          <th className="px-4 py-3.5">Dates</th>
                          <th className="px-4 py-3.5">Working Days</th>
                          <th className="px-4 py-3.5">Reason &amp; Reviewer Comment</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myLeaveRequests.map((req) => (
                          <tr key={req.id}>
                            <td className="px-4 py-3.5 font-bold uppercase text-slate-800">
                              {req.leave_type.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3.5">
                              {req.start_date} → {req.end_date}
                            </td>
                            <td className="px-4 py-3.5 font-semibold">{req.days_count}</td>
                            <td className="px-4 py-3.5 max-w-sm">
                              <p className="text-slate-800">{req.reason}</p>
                              {req.reviewer_comment && (
                                <p className="mt-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-950">
                                  <strong>Reviewer Note:</strong> {req.reviewer_comment}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  req.status === "approved"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : req.status === "rejected" || req.status === "cancelled"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-amber-50 text-amber-800"
                                }`}
                              >
                                {req.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex gap-1.5">
                                {req.status === "correction_requested" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResubmittingLeave(req);
                                      setResubmitForm({
                                        start_date: req.start_date,
                                        end_date: req.end_date,
                                        reason: req.reason,
                                      });
                                    }}
                                    className="rounded-lg bg-[#0A2558] px-2.5 py-1 text-[11px] font-bold text-white"
                                  >
                                    Edit &amp; Resubmit
                                  </button>
                                )}
                                {(req.status === "pending" ||
                                  req.status === "correction_requested") && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelLeave(req)}
                                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 4: MY DOCUMENTS                                       */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "documents" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    My Personal HR Documents &amp; Company Policies
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Access your personal employment records and company handbooks, or upload supporting documents for
                    HR verification.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setDocUploadMode("self");
                    setDocForm({
                      title: "",
                      category: "identification",
                      visibility_scope: "employee_and_hr",
                      staff_id: profile.id,
                      expiry_date: "",
                      notes: "",
                    });
                    setDocFile(null);
                    setIsDocUploadOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Personal Document</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {myPermittedDocuments.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No personal or company-wide HR documents available yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Document Title</th>
                          <th className="px-4 py-3.5">Category</th>
                          <th className="px-4 py-3.5">Scope</th>
                          <th className="px-4 py-3.5">Verification</th>
                          <th className="px-4 py-3.5 text-right">Download</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myPermittedDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td className="px-4 py-3.5 font-bold text-slate-900">{doc.title}</td>
                            <td className="px-4 py-3.5 uppercase text-[11px] text-slate-600">
                              {doc.category.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3.5">
                              {doc.visibility_scope === "company_wide"
                                ? "Company Policy"
                                : "My Personal Record"}
                            </td>
                            <td className="px-4 py-3.5">
                              {doc.is_verified ? (
                                <span className="text-emerald-700 font-bold">Verified</span>
                              ) : (
                                <span className="text-amber-700">Pending HR Review</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDownloadHrDoc(doc)}
                                className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-[#0A2558] hover:bg-blue-100"
                              >
                                Download Signed
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 5: PUBLISHED ANNOUNCEMENTS                            */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "announcements" && (
            <div className="space-y-4">
              {publishedAnnouncementsForMe.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <Megaphone className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No published announcements</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Official HR notices and company updates published for your department or role will appear here.
                  </p>
                </div>
              ) : (
                publishedAnnouncementsForMe.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      {ann.is_pinned && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          Pinned
                        </span>
                      )}
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0A2558]">
                        {ann.category.replace(/_/g, " ")}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                      {ann.body}
                    </p>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Published{" "}
                      {ann.published_at
                        ? new Date(ann.published_at).toLocaleDateString()
                        : new Date(ann.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* PORTAL TAB 6: MY ASSIGNED RESPONSIBILITIES (FROM public.tasks)   */}
          {/* ---------------------------------------------------------------- */}
          {portalTab === "responsibilities" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    My Assigned Operational Responsibilities
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live tasks delegated to your staff profile in the ABLEBIZ SUITE Operations Task Board.
                  </p>
                </div>
                <Link
                  to="/admin/tasks"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#061738]"
                >
                  <span>Open Task Board</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {myTasks.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No tasks are currently assigned to your staff profile.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{t.title}</span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                              {t.status.replace(/_/g, " ")}
                            </span>
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                              {t.priority}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-slate-500 mt-1">{t.description}</p>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t.due_date
                            ? `Due: ${new Date(t.due_date).toLocaleDateString()}`
                            : "No fixed deadline"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODALS                                                            */}
      {/* ==================================================================== */}

      {/* MODAL A: INSPECT STAFF PROFILE */}
      {inspectingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{inspectingStaff.full_name}</h3>
                <p className="text-slate-500">
                  {inspectingStaff.job_title || getRoleTitle(inspectingStaff.role)} •{" "}
                  {inspectingStaff.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStaff(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block">Email</span>
                <span className="font-semibold text-slate-900">{inspectingStaff.email}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block">Phone</span>
                <span className="font-semibold text-slate-900">{inspectingStaff.phone || "—"}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block">Employment Type</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {(inspectingStaff.employment_type || "full_time").replace(/_/g, " ")}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block">Hire Date</span>
                <span className="font-semibold text-slate-900">
                  {inspectingStaff.hire_date ||
                    (inspectingStaff.created_at
                      ? new Date(inspectingStaff.created_at).toLocaleDateString()
                      : "—")}
                </span>
              </div>
            </div>

            {/* Private Details (Strictly visible ONLY if hrPerms.view_other_private_details is true) */}
            {hrPerms.view_other_private_details && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
                <p className="font-bold text-amber-950">
                  Confidential Employee Details (Executive HR Access Only)
                </p>
                {(() => {
                  const priv = privateDetailsMap.get(inspectingStaff.id);
                  if (!priv) {
                    return <p className="text-slate-500">No private HR details recorded yet.</p>;
                  }
                  return (
                    <div className="space-y-1 text-slate-700">
                      <p>
                        <strong>Residential Address:</strong> {priv.residential_address || "—"}
                      </p>
                      <p>
                        <strong>Emergency Contact:</strong> {priv.emergency_contact_name || "—"}{" "}
                        {priv.emergency_contact_phone ? `(${priv.emergency_contact_phone})` : ""}{" "}
                        {priv.emergency_contact_relationship
                          ? `[${priv.emergency_contact_relationship}]`
                          : ""}
                      </p>
                      {priv.hr_notes && (
                        <p>
                          <strong>HR Management Notes:</strong> {priv.hr_notes}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingStaff(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL B: EDIT EMPLOYMENT METADATA */}
      {editingEmploymentStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Edit HR Employment Profile — {editingEmploymentStaff.full_name}
            </h3>
            <p className="text-slate-500 mt-1">
              Updates non-privileged HR employment metadata. Canonical role and account status changes require{" "}
              <Link to="/admin/team" className="font-bold text-[#0A2558] underline">
                Staff &amp; RBAC Maker-Checker approval
              </Link>
              .
            </p>

            <form onSubmit={handleSaveEmploymentMetadata} className="mt-4 space-y-3" noValidate>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700">Job Title *</label>
                  <input
                    type="text"
                    required
                    onBlur={handleFieldBlurAria}
                    value={employmentForm.job_title}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({ ...f, job_title: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Department *</label>
                  <input
                    type="text"
                    required
                    onBlur={handleFieldBlurAria}
                    value={employmentForm.department}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({ ...f, department: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Employment Type</label>
                  <select
                    value={employmentForm.employment_type}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({ ...f, employment_type: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="full_time">Full-Time</option>
                    <option value="part_time">Part-Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern / NYSC</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">HR Employment Status</label>
                  <select
                    value={employmentForm.employment_status}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({ ...f, employment_status: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="active">Active</option>
                    <option value="probation">Probation</option>
                    <option value="on_leave">On Leave</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Reporting Manager</label>
                  <select
                    value={employmentForm.reporting_manager_id}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({
                        ...f,
                        reporting_manager_id: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="">-- Executive Management --</option>
                    {staffList
                      .filter((s) => s.id !== editingEmploymentStaff.id && s.is_active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({getRoleTitle(s.role)})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Hire / Start Date</label>
                  <input
                    type="date"
                    value={employmentForm.hire_date}
                    onChange={(e) =>
                      setEmploymentForm((f) => ({ ...f, hire_date: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Work Location</label>
                <input
                  type="text"
                  value={employmentForm.work_location}
                  onChange={(e) =>
                    setEmploymentForm((f) => ({ ...f, work_location: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">
                  Internal HR Notes (Confidential — Hidden from General Staff)
                </label>
                <textarea
                  rows={2}
                  value={employmentForm.hr_notes}
                  onChange={(e) =>
                    setEmploymentForm((f) => ({ ...f, hr_notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEmploymentStaff(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Employment Info"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL C: SUBMIT LEAVE REQUEST */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">Submit Leave Request</h3>
            <p className="text-slate-500 mt-1">
              Overlapping dates and invalid ranges are automatically prevented.
            </p>

            <form onSubmit={handleSubmitLeave} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">Leave Category *</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick / Medical Leave</option>
                  <option value="casual">Casual / Personal Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="compassionate">Compassionate / Bereavement Leave</option>
                  <option value="study">Study / Examination Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    onBlur={handleFieldBlurAria}
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 user-invalid:border-red-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">End Date *</label>
                  <input
                    type="date"
                    required
                    min={leaveForm.start_date || undefined}
                    onBlur={handleFieldBlurAria}
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 user-invalid:border-red-600"
                  />
                </div>
              </div>

              {leaveForm.start_date && leaveForm.end_date && leaveForm.end_date >= leaveForm.start_date && (
                <div className="rounded-xl bg-blue-50 px-3 py-2 text-[#0A2558] font-semibold">
                  Calculated Duration: {calculateWorkingDays(leaveForm.start_date, leaveForm.end_date)}{" "}
                  working day(s)
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700">Reason / Handover Notes *</label>
                <textarea
                  rows={3}
                  required
                  onBlur={handleFieldBlurAria}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Provide reason for leave and task handover summary..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 user-invalid:border-red-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL D: REVIEW & DECIDE LEAVE REQUEST */}
      {reviewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Leave Review Decision: {leaveDecision.replace(/_/g, " ").toUpperCase()}
            </h3>
            <p className="text-slate-500 mt-1">
              Applicant: <strong>{reviewingLeave.staff?.full_name || "Staff"}</strong> •{" "}
              {reviewingLeave.start_date} to {reviewingLeave.end_date} ({reviewingLeave.days_count}{" "}
              days)
            </p>

            <form onSubmit={handleExecuteLeaveDecision} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">
                  Reviewer Comment {leaveDecision !== "approved" ? "*" : "(Optional)"}
                </label>
                <textarea
                  rows={3}
                  required={leaveDecision !== "approved"}
                  onBlur={handleFieldBlurAria}
                  value={leaveReviewComment}
                  onChange={(e) => setLeaveReviewComment(e.target.value)}
                  placeholder="Enter decision rationale or correction instructions..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 user-invalid:border-red-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewingLeave(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white hover:bg-[#061738] disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : "Confirm Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL E: RESUBMIT LEAVE REQUEST */}
      {resubmittingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Update &amp; Resubmit Leave Application
            </h3>
            <form onSubmit={handleResubmitLeave} className="mt-4 space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={resubmitForm.start_date}
                    onChange={(e) =>
                      setResubmitForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">End Date *</label>
                  <input
                    type="date"
                    required
                    min={resubmitForm.start_date || undefined}
                    value={resubmitForm.end_date}
                    onChange={(e) =>
                      setResubmitForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700">Updated Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={resubmitForm.reason}
                  onChange={(e) => setResubmitForm((f) => ({ ...f, reason: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setResubmittingLeave(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white"
                >
                  Resubmit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL F: RECORD MANAGEMENT ATTENDANCE */}
      {isRecordAttModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">Record Staff Attendance</h3>
            <form onSubmit={handleRecordManagementAttendance} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">Staff Member *</label>
                <select
                  required
                  value={mgmtAttForm.staff_id}
                  onChange={(e) => setMgmtAttForm((f) => ({ ...f, staff_id: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                >
                  {staffList
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.department})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={mgmtAttForm.attendance_date}
                    onChange={(e) =>
                      setMgmtAttForm((f) => ({ ...f, attendance_date: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Status *</label>
                  <select
                    value={mgmtAttForm.status}
                    onChange={(e) =>
                      setMgmtAttForm((f) => ({
                        ...f,
                        status: e.target.value as HrAttendanceRecord["status"],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="remote">Remote</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent</option>
                    <option value="on_leave">On Leave</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>

              {(mgmtAttForm.status === "absent" || mgmtAttForm.status === "excused") && (
                <div>
                  <label className="font-bold text-slate-700">Absence Type</label>
                  <select
                    value={mgmtAttForm.absence_type}
                    onChange={(e) =>
                      setMgmtAttForm((f) => ({ ...f, absence_type: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="">-- Select Absence Category --</option>
                    <option value="sick">Sick / Medical</option>
                    <option value="authorized_absence">Authorized Absence</option>
                    <option value="unexcused">Unexcused Absence</option>
                    <option value="official_assignment">Official External Assignment</option>
                    <option value="public_holiday">Public Holiday</option>
                  </select>
                </div>
              )}

              {["present", "late", "remote", "half_day"].includes(mgmtAttForm.status) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700">Check-In Time</label>
                    <input
                      type="time"
                      value={mgmtAttForm.check_in_time}
                      onChange={(e) =>
                        setMgmtAttForm((f) => ({ ...f, check_in_time: e.target.value }))
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Check-Out Time</label>
                    <input
                      type="time"
                      value={mgmtAttForm.check_out_time}
                      onChange={(e) =>
                        setMgmtAttForm((f) => ({ ...f, check_out_time: e.target.value }))
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={mgmtAttForm.notes}
                  onChange={(e) => setMgmtAttForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRecordAttModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL G: SUBMIT ATTENDANCE CORRECTION */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">Request Attendance Correction</h3>
            <form onSubmit={handleSubmitAttendanceCorrection} className="mt-4 space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Attendance Date *</label>
                  <input
                    type="date"
                    required
                    value={correctionForm.attendance_date}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({ ...f, attendance_date: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Requested Status *</label>
                  <select
                    value={correctionForm.requested_status}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        requested_status: e.target.value as HrAttendanceRecord["status"],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  >
                    <option value="present">Present</option>
                    <option value="remote">Remote</option>
                    <option value="late">Late</option>
                    <option value="half_day">Half Day</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Check-In Time</label>
                  <input
                    type="time"
                    value={correctionForm.requested_check_in_time}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        requested_check_in_time: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Check-Out Time</label>
                  <input
                    type="time"
                    value={correctionForm.requested_check_out_time}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        requested_check_out_time: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Reason for Correction *</label>
                <textarea
                  rows={3}
                  required
                  onBlur={handleFieldBlurAria}
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain why this attendance record requires correction..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 user-invalid:border-red-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL H: REVIEW ATTENDANCE CORRECTION */}
      {reviewingCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">
              {correctionDecision === "approved" ? "Approve" : "Reject"} Attendance Correction
            </h3>
            <form onSubmit={handleExecuteCorrectionDecision} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">Reviewer Note</label>
                <textarea
                  rows={2}
                  value={correctionReviewComment}
                  onChange={(e) => setCorrectionReviewComment(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewingCorrection(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL I: UPLOAD HR DOCUMENT */}
      {isDocUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-slate-900">
              {docUploadMode === "self" ? "Upload Personal HR Document" : "Upload to HR Document Vault"}
            </h3>
            <p className="text-slate-500 mt-1">
              Encrypted in private bucket <code className="font-mono">ablebiz_hr_documents</code>. Max 20MB (PDF,
              JPEG, PNG, WEBP).
            </p>

            <form onSubmit={handleUploadDocumentSubmit} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">Document Title *</label>
                <input
                  type="text"
                  required
                  onBlur={handleFieldBlurAria}
                  value={docForm.title}
                  onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Signed Employment Contract / NIN Slip"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 user-invalid:border-red-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Category *</label>
                <select
                  value={docForm.category}
                  onChange={(e) =>
                    setDocForm((f) => ({
                      ...f,
                      category: e.target.value as HrDocumentRecord["category"],
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                >
                  {HR_DOC_CATEGORIES.filter((c) =>
                    docUploadMode === "self" ? c.selfAllowed : true
                  ).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {docUploadMode === "management" && (
                <>
                  <div>
                    <label className="font-bold text-slate-700">Access Visibility Scope *</label>
                    <select
                      value={docForm.visibility_scope}
                      onChange={(e) =>
                        setDocForm((f) => ({
                          ...f,
                          visibility_scope: e.target.value as HrDocumentRecord["visibility_scope"],
                        }))
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                    >
                      <option value="employee_and_hr">
                        Employee &amp; HR Management (Visible in Employee Portal)
                      </option>
                      <option value="hr_management_only">
                        HR Management Only (Hidden from Employee)
                      </option>
                      {profile.role === "super_admin" && (
                        <option value="super_admin_only">
                          Super Admin Only (Executive Confidential)
                        </option>
                      )}
                      <option value="company_wide">Company-Wide Policy / Handbook (All Staff)</option>
                    </select>
                  </div>

                  {docForm.visibility_scope !== "company_wide" && (
                    <div>
                      <label className="font-bold text-slate-700">Target Staff Member *</label>
                      <select
                        required
                        value={docForm.staff_id}
                        onChange={(e) => setDocForm((f) => ({ ...f, staff_id: e.target.value }))}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3"
                      >
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.department})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="font-bold text-slate-700">Select File (PDF, JPEG, PNG, WEBP) *</label>
                <input
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-bold file:text-[#0A2558]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDocUploadOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white disabled:opacity-50"
                >
                  {isSubmitting ? "Uploading..." : "Upload Securely"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL J: CREATE / EDIT ANNOUNCEMENT */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              {announcementForm.id ? "Edit HR Announcement" : "Create HR Announcement"}
            </h3>

            <form onSubmit={handleSaveAnnouncement} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="font-bold text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  onBlur={handleFieldBlurAria}
                  value={announcementForm.title}
                  onChange={(e) =>
                    setAnnouncementForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 user-invalid:border-red-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Publication Status *</label>
                  <select
                    value={announcementForm.status}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({
                        ...f,
                        status: e.target.value as HrAnnouncementRecord["status"],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Hidden from Staff)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={announcementForm.category}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({
                        ...f,
                        category: e.target.value as HrAnnouncementRecord["category"],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5"
                  >
                    <option value="general">General Notice</option>
                    <option value="policy_update">Policy Update</option>
                    <option value="holiday_notice">Holiday Notice</option>
                    <option value="training">Training &amp; Development</option>
                    <option value="leadership">Leadership Circular</option>
                    <option value="urgent">Urgent Alert</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Priority</label>
                  <select
                    value={announcementForm.priority}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({
                        ...f,
                        priority: e.target.value as HrAnnouncementRecord["priority"],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Target Department (Optional)</label>
                  <select
                    value={announcementForm.target_department}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({ ...f, target_department: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5"
                  >
                    <option value="">All Departments</option>
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Target Role (Optional)</label>
                  <select
                    value={announcementForm.target_role}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({ ...f, target_role: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5"
                  >
                    <option value="">All Staff Roles</option>
                    {CANONICAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DEFINITIONS[r].title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Announcement Body *</label>
                <textarea
                  rows={4}
                  required
                  onBlur={handleFieldBlurAria}
                  value={announcementForm.body}
                  onChange={(e) =>
                    setAnnouncementForm((f) => ({ ...f, body: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 user-invalid:border-red-600"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={announcementForm.is_pinned}
                  onChange={(e) =>
                    setAnnouncementForm((f) => ({ ...f, is_pinned: e.target.checked }))
                  }
                />
                <span className="font-semibold text-slate-700">Pin to top of announcements</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A2558] px-4 py-2 font-bold text-white"
                >
                  {isSubmitting ? "Saving..." : "Save Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
