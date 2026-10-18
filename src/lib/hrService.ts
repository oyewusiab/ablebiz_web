import { supabase, supabaseEnabled } from "./supabaseClient";
import type { StaffProfile } from "../auth/AuthContext";
import {
  evaluateLeaveDecisionEligibility,
  evaluateAttendanceCorrectionEligibility,
  canEditTargetStaffHrMetadata,
  hasHrPermission,
} from "./hrPermissions";

export interface HrPolicySettings {
  id: number;
  attendance_enabled: boolean;
  allow_self_clock_in: boolean;
  workday_start_time: string;
  workday_end_time: string;
  late_threshold_minutes: number;
  leave_balances_enabled: boolean;
  require_maker_checker_leave: boolean;
  policy_notes?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface HrStaffDetails {
  staff_id: string;
  date_of_birth?: string | null;
  residential_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  hr_notes?: string | null;
  updated_at?: string;
}

export interface HrLeavePolicy {
  id: string;
  leave_type: string;
  display_name: string;
  annual_entitlement_days: number | null;
  requires_reason: boolean;
  requires_document: boolean;
  is_paid: boolean;
  is_active: boolean;
}

export interface HrLeaveStatusHistoryItem {
  status: string;
  actor_id: string;
  actor_name: string;
  comment?: string | null;
  timestamp: string;
}

export interface HrLeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  supporting_document_path?: string | null;
  status: "pending" | "approved" | "rejected" | "correction_requested" | "cancelled";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_comment?: string | null;
  status_history: HrLeaveStatusHistoryItem[];
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string;
  } | null;
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface HrAttendanceRecord {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: "present" | "late" | "absent" | "half_day" | "on_leave" | "remote" | "excused";
  absence_type?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  source: "self_portal" | "manual_management";
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string;
  } | null;
}

export interface HrAttendanceCorrection {
  id: string;
  attendance_id?: string | null;
  staff_id: string;
  attendance_date: string;
  requested_status: "present" | "late" | "absent" | "half_day" | "on_leave" | "remote" | "excused";
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_comment?: string | null;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    full_name: string;
    email: string;
    department: string;
  } | null;
  reviewer?: {
    id: string;
    full_name: string;
  } | null;
}

export interface HrDocumentRecord {
  id: string;
  staff_id?: string | null;
  title: string;
  category:
    | "employment_contract"
    | "offer_letter"
    | "identification"
    | "certification_qualification"
    | "performance_appraisal"
    | "disciplinary_record"
    | "compensation_salary"
    | "hr_policy_handbook"
    | "leave_supporting_doc"
    | "other";
  visibility_scope: "employee_and_hr" | "hr_management_only" | "super_admin_only" | "company_wide";
  file_path: string;
  bucket_id: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  is_verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    full_name: string;
    email: string;
    department: string;
  } | null;
  uploader?: {
    id: string;
    full_name: string;
  } | null;
}

export interface HrAnnouncementRecord {
  id: string;
  title: string;
  body: string;
  category: "general" | "policy_update" | "holiday_notice" | "training" | "leadership" | "urgent";
  priority: "low" | "normal" | "high" | "urgent";
  status: "draft" | "published" | "archived";
  target_department?: string | null;
  target_role?: string | null;
  is_pinned: boolean;
  effective_date?: string | null;
  expires_at?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  created_by: string;
  published_by?: string | null;
  published_at?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
  } | null;
  publisher?: {
    id: string;
    full_name: string;
  } | null;
}

export interface HrUpcomingMilestone {
  staff_id: string;
  full_name: string;
  department: string;
  month_day: string;
  display_date: string;
  years_of_service?: number;
}

export const ALLOWED_HR_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_HR_DOC_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function isMissingSchemaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || err.details || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42703" ||
    msg.includes("could not find the table") ||
    msg.includes("relation") && msg.includes("does not exist") ||
    msg.includes("could not find the function")
  );
}

/**
 * Calculates working days (Monday–Friday) inclusive between two YYYY-MM-DD dates.
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export async function logHrAuditEvent(params: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  eventTitle: string;
}) {
  if (!supabaseEnabled || !supabase || !params.actorId) return;
  try {
    await Promise.all([
      supabase.from("audit_logs").insert({
        staff_id: params.actorId,
        staff_email: params.actorEmail || null,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        old_values: params.oldValues || null,
        new_values: params.newValues || null,
      }),
      params.entityId
        ? supabase.from("activity_timeline").insert({
            entity_type: params.entityType,
            entity_id: params.entityId,
            actor_type: "staff",
            actor_id: params.actorId,
            event_type: params.action,
            event_title: params.eventTitle,
            metadata: params.newValues || {},
          })
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn("[HR Audit] Failed to write audit log:", err);
  }
}

export async function sendStaffNotification(params: {
  recipientStaffId: string;
  title: string;
  message: string;
  link?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}) {
  if (!supabaseEnabled || !supabase) return;
  try {
    await supabase.from("notifications").insert({
      recipient_staff_id: params.recipientStaffId,
      title: params.title,
      message: params.message,
      link: params.link || "/admin/hr",
      priority: params.priority || "normal",
    });
  } catch (err) {
    console.warn("[HR Notification] Could not send notification:", err);
  }
}

export async function fetchHrWorkspaceData(caller: StaffProfile) {
  if (!supabaseEnabled || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  let hrTablesReady = true;

  // 1. Always fetch canonical staff_profiles (authoritative directory), own tasks, and recent HR activity
  const isManagement =
    hasHrPermission(caller.role, "view_hr_overview") ||
    hasHrPermission(caller.role, "view_staff_directory");

  const [staffRes, changeReqsRes, myTasksRes, activityRes] = await Promise.all([
    supabase.from("staff_profiles").select("*").order("created_at", { ascending: true }),
    isManagement
      ? supabase
          .from("staff_change_requests")
          .select("id, request_type, status, target_staff_profile_id, requested_role, created_at")
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tasks")
      .select("id, title, description, priority, status, due_date, completed_at, created_at")
      .eq("assigned_to", caller.id)
      .order("due_date", { ascending: true }),
    isManagement
      ? supabase
          .from("activity_timeline")
          .select("id, entity_type, entity_id, event_type, event_title, created_at")
          .in("entity_type", [
            "staff_profile",
            "hr_leave_request",
            "hr_attendance",
            "hr_document",
            "hr_announcement",
            "hr_policy",
          ])
          .order("created_at", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 2. Fetch HR-specific tables (detecting if MIGRATION_HR_WORKSPACE.sql is pending)
  const [
    policyRes,
    ownDetailsRes,
    allDetailsRes,
    leavePoliciesRes,
    leaveRequestsRes,
    attendanceRes,
    correctionsRes,
    docsRes,
    announcementsRes,
    milestonesRes,
  ] = await Promise.all([
    supabase.from("hr_policy_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("hr_staff_details").select("*").eq("staff_id", caller.id).maybeSingle(),
    hasHrPermission(caller.role, "edit_staff_hr_metadata")
      ? supabase.from("hr_staff_details").select("*")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("hr_leave_policies").select("*").order("display_name", { ascending: true }),
    supabase
      .from("hr_leave_requests")
      .select(`
        *,
        staff:staff_profiles!hr_leave_requests_staff_id_fkey(id, full_name, email, role, department),
        reviewer:staff_profiles!hr_leave_requests_reviewed_by_fkey(id, full_name, email)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("hr_attendance_records")
      .select(`
        *,
        staff:staff_profiles!hr_attendance_records_staff_id_fkey(id, full_name, email, role, department)
      `)
      .order("attendance_date", { ascending: false })
      .limit(200),
    supabase
      .from("hr_attendance_corrections")
      .select(`
        *,
        staff:staff_profiles!hr_attendance_corrections_staff_id_fkey(id, full_name, email, department),
        reviewer:staff_profiles!hr_attendance_corrections_reviewed_by_fkey(id, full_name)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("hr_documents")
      .select(`
        *,
        staff:staff_profiles!hr_documents_staff_id_fkey(id, full_name, email, department),
        uploader:staff_profiles!hr_documents_uploaded_by_fkey(id, full_name)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("hr_announcements")
      .select(`
        *,
        author:staff_profiles!hr_announcements_created_by_fkey(id, full_name),
        publisher:staff_profiles!hr_announcements_published_by_fkey(id, full_name)
      `)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    isManagement
      ? supabase.rpc("hr_get_upcoming_milestones")
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (
    isMissingSchemaError(policyRes.error) ||
    isMissingSchemaError(leaveRequestsRes.error) ||
    isMissingSchemaError(attendanceRes.error)
  ) {
    hrTablesReady = false;
  }

  const defaultPolicy: HrPolicySettings = {
    id: 1,
    attendance_enabled: true,
    allow_self_clock_in: true,
    workday_start_time: "08:30:00",
    workday_end_time: "17:00:00",
    late_threshold_minutes: 15,
    leave_balances_enabled: false,
    require_maker_checker_leave: true,
    policy_notes:
      "Standard ABLEBIZ SUITE HR operational policy. Leave entitlements become authoritative only when enabled and verified by Super Admin.",
  };

  const milestonesData = (milestonesRes.data || {}) as {
    birthdays?: HrUpcomingMilestone[];
    anniversaries?: HrUpcomingMilestone[];
  };

  return {
    hrTablesReady,
    staffList: (staffRes.data || []) as StaffProfile[],
    staffChangeRequests: (changeReqsRes.data || []) as any[],
    myTasks: (myTasksRes.data || []) as any[],
    recentActivities: (activityRes.data || []) as any[],
    policySettings: (policyRes.data as HrPolicySettings) || defaultPolicy,
    ownPrivateDetails: (ownDetailsRes.data as HrStaffDetails) || null,
    allPrivateDetails: ((allDetailsRes.data || []) as HrStaffDetails[]),
    leavePolicies: ((leavePoliciesRes.data || []) as HrLeavePolicy[]),
    leaveRequests: ((leaveRequestsRes.data || []) as HrLeaveRequest[]),
    attendanceRecords: ((attendanceRes.data || []) as HrAttendanceRecord[]),
    attendanceCorrections: ((correctionsRes.data || []) as HrAttendanceCorrection[]),
    hrDocuments: ((docsRes.data || []) as HrDocumentRecord[]),
    announcements: ((announcementsRes.data || []) as HrAnnouncementRecord[]),
    birthdays: milestonesData.birthdays || [],
    anniversaries: milestonesData.anniversaries || [],
  };
}

// ============================================================================
// 1. SELF-SERVICE & MANAGEMENT PROFILE UPDATES
// ============================================================================

export async function updateOwnPersonalDetails(
  caller: StaffProfile,
  input: {
    phone: string;
    date_of_birth?: string | null;
    residential_address?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    emergency_contact_relationship?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");

  // Try authoritative Security Definer RPC first
  const { error: rpcError } = await supabase.rpc("hr_update_own_personal_details", {
    p_phone: input.phone.trim(),
    p_date_of_birth: input.date_of_birth || null,
    p_residential_address: input.residential_address?.trim() || null,
    p_emergency_contact_name: input.emergency_contact_name?.trim() || null,
    p_emergency_contact_phone: input.emergency_contact_phone?.trim() || null,
    p_emergency_contact_relationship: input.emergency_contact_relationship?.trim() || null,
  });

  if (rpcError) {
    if (isMissingSchemaError(rpcError)) {
      throw new Error(
        "Database migration required: Please apply implementation/MIGRATION_HR_WORKSPACE.sql in Supabase SQL Editor to enable HR self-service profile persistence."
      );
    }
    throw new Error(rpcError.message);
  }
}

export async function updateStaffEmploymentMetadata(
  caller: StaffProfile,
  targetStaff: StaffProfile,
  input: {
    job_title?: string | null;
    department: string;
    employment_type: string;
    employment_status: string;
    reporting_manager_id?: string | null;
    hire_date?: string | null;
    work_location?: string | null;
    hr_notes?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");

  if (!canEditTargetStaffHrMetadata(caller.role, targetStaff.role)) {
    throw new Error("Forbidden: You do not have permission to edit this staff member's HR employment profile.");
  }

  const { error } = await supabase.rpc("hr_admin_update_employment_profile", {
    p_target_staff_id: targetStaff.id,
    p_job_title: input.job_title?.trim() || null,
    p_department: input.department.trim(),
    p_employment_type: input.employment_type,
    p_employment_status: input.employment_status,
    p_reporting_manager_id: input.reporting_manager_id || null,
    p_hire_date: input.hire_date || null,
    p_work_location: input.work_location?.trim() || null,
    p_hr_notes: input.hr_notes?.trim() ?? null,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new Error(
        "Database migration required: Please apply implementation/MIGRATION_HR_WORKSPACE.sql in Supabase SQL Editor to enable extended HR employment fields."
      );
    }
    throw new Error(error.message);
  }
}

// ============================================================================
// 2. LEAVE LIFECYCLE OPERATIONS
// ============================================================================

export async function submitLeaveRequest(
  caller: StaffProfile,
  existingRequests: HrLeaveRequest[],
  input: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    supporting_document_path?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!input.start_date || !input.end_date) {
    throw new Error("Start date and end date are required.");
  }
  if (input.end_date < input.start_date) {
    throw new Error("Invalid date range: End date cannot be earlier than start date.");
  }
  if (!input.reason.trim()) {
    throw new Error("Please provide a clear reason for your leave application.");
  }

  // Client-side overlap pre-check (backed by PostgreSQL trigger trg_validate_hr_leave_request)
  const overlapping = existingRequests.find(
    (req) =>
      req.staff_id === caller.id &&
      ["pending", "approved", "correction_requested"].includes(req.status) &&
      req.start_date <= input.end_date &&
      req.end_date >= input.start_date
  );

  if (overlapping) {
    throw new Error(
      `Overlapping Leave Request: You already have an active (${overlapping.status}) leave request from ${overlapping.start_date} to ${overlapping.end_date}.`
    );
  }

  const daysCount = calculateWorkingDays(input.start_date, input.end_date);
  const initialHistory: HrLeaveStatusHistoryItem[] = [
    {
      status: "pending",
      actor_id: caller.id,
      actor_name: caller.full_name,
      comment: "Leave application submitted.",
      timestamp: new Date().toISOString(),
    },
  ];

  const { data, error } = await supabase
    .from("hr_leave_requests")
    .insert({
      staff_id: caller.id,
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days_count: daysCount,
      reason: input.reason.trim(),
      supporting_document_path: input.supporting_document_path || null,
      status: "pending",
      status_history: initialHistory,
    })
    .select()
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new Error(
        "Database migration required: Please apply implementation/MIGRATION_HR_WORKSPACE.sql in Supabase SQL Editor."
      );
    }
    throw new Error(error.message);
  }

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_leave_requested",
    entityType: "hr_leave_request",
    entityId: data.id,
    newValues: {
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days_count: daysCount,
    },
    eventTitle: `Leave request (${input.leave_type}) submitted by ${caller.full_name} for ${daysCount} working day(s)`,
  });

  return data as HrLeaveRequest;
}

export async function decideLeaveRequest(
  caller: StaffProfile,
  request: HrLeaveRequest,
  decision: "approved" | "rejected" | "correction_requested",
  comment: string,
  activeSuperAdminCount: number
) {
  if (!supabase) throw new Error("Supabase client unavailable.");

  const eligibility = evaluateLeaveDecisionEligibility(
    caller,
    request.staff_id,
    request.staff?.role,
    activeSuperAdminCount
  );

  if (!eligibility.allowed) {
    throw new Error(eligibility.reason || "Unauthorized leave decision.");
  }

  if ((decision === "rejected" || decision === "correction_requested") && !comment.trim()) {
    throw new Error("A reviewer comment is required when rejecting or requesting correction.");
  }

  const nextHistory: HrLeaveStatusHistoryItem[] = [
    ...(Array.isArray(request.status_history) ? request.status_history : []),
    {
      status: decision,
      actor_id: caller.id,
      actor_name: caller.full_name,
      comment: comment.trim() || `Marked as ${decision.replace(/_/g, " ")}.`,
      timestamp: new Date().toISOString(),
    },
  ];

  const { error } = await supabase
    .from("hr_leave_requests")
    .update({
      status: decision,
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      reviewer_comment: comment.trim() || null,
      status_history: nextHistory,
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(error.message);
  }

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: `hr_leave_${decision}`,
    entityType: "hr_leave_request",
    entityId: request.id,
    oldValues: { status: request.status },
    newValues: { status: decision, reviewer_comment: comment.trim() || null },
    eventTitle: `Leave request for ${request.staff?.full_name || "Staff"} ${decision.replace(/_/g, " ")} by ${caller.full_name}`,
  });

  await sendStaffNotification({
    recipientStaffId: request.staff_id,
    title: `Leave Application ${decision.replace(/_/g, " ").toUpperCase()}`,
    message: `Your ${request.leave_type} leave request (${request.start_date} to ${request.end_date}) was ${decision.replace(/_/g, " ")} by ${caller.full_name}.${comment.trim() ? ` Note: ${comment.trim()}` : ""}`,
    link: "/admin/hr/portal",
    priority: decision === "approved" ? "normal" : "high",
  });
}

export async function cancelOwnLeaveRequest(caller: StaffProfile, request: HrLeaveRequest) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (request.staff_id !== caller.id) {
    throw new Error("You can only cancel your own leave request.");
  }
  if (!["pending", "correction_requested"].includes(request.status)) {
    throw new Error("Only pending or correction-requested leave applications can be cancelled.");
  }

  const nextHistory: HrLeaveStatusHistoryItem[] = [
    ...(Array.isArray(request.status_history) ? request.status_history : []),
    {
      status: "cancelled",
      actor_id: caller.id,
      actor_name: caller.full_name,
      comment: "Cancelled by requester.",
      timestamp: new Date().toISOString(),
    },
  ];

  const { error } = await supabase
    .from("hr_leave_requests")
    .update({
      status: "cancelled",
      status_history: nextHistory,
    })
    .eq("id", request.id);

  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_leave_cancelled",
    entityType: "hr_leave_request",
    entityId: request.id,
    oldValues: { status: request.status },
    newValues: { status: "cancelled" },
    eventTitle: `Leave request cancelled by ${caller.full_name}`,
  });
}

export async function resubmitLeaveRequest(
  caller: StaffProfile,
  request: HrLeaveRequest,
  updates: {
    start_date: string;
    end_date: string;
    reason: string;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (request.staff_id !== caller.id || request.status !== "correction_requested") {
    throw new Error("Only your own correction-requested leave application can be resubmitted.");
  }
  if (updates.end_date < updates.start_date) {
    throw new Error("End date cannot be earlier than start date.");
  }

  const daysCount = calculateWorkingDays(updates.start_date, updates.end_date);
  const nextHistory: HrLeaveStatusHistoryItem[] = [
    ...(Array.isArray(request.status_history) ? request.status_history : []),
    {
      status: "pending",
      actor_id: caller.id,
      actor_name: caller.full_name,
      comment: "Corrected and resubmitted for approval.",
      timestamp: new Date().toISOString(),
    },
  ];

  const { error } = await supabase
    .from("hr_leave_requests")
    .update({
      start_date: updates.start_date,
      end_date: updates.end_date,
      days_count: daysCount,
      reason: updates.reason.trim(),
      status: "pending",
      status_history: nextHistory,
    })
    .eq("id", request.id);

  if (error) throw new Error(error.message);
}

// ============================================================================
// 3. ATTENDANCE & CORRECTION OPERATIONS
// ============================================================================

export async function recordSelfCheckInOut(
  caller: StaffProfile,
  mode: "check_in" | "check_out",
  existingToday: HrAttendanceRecord | undefined,
  policy: HrPolicySettings,
  notes?: string
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!policy.attendance_enabled || !policy.allow_self_clock_in) {
    throw new Error("Self-service attendance recording is currently disabled by HR policy.");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  if (mode === "check_in") {
    if (existingToday?.check_in_at) {
      throw new Error("You have already checked in for today.");
    }

    // Determine if late based on policy workday_start_time + late_threshold_minutes
    let computedStatus: "present" | "late" = "present";
    try {
      const [h, m] = (policy.workday_start_time || "08:30:00").split(":").map(Number);
      const thresholdDate = new Date();
      thresholdDate.setHours(h || 8, (m || 30) + (policy.late_threshold_minutes || 15), 0, 0);
      if (new Date() > thresholdDate) {
        computedStatus = "late";
      }
    } catch {
      computedStatus = "present";
    }

    const { error } = await supabase.from("hr_attendance_records").upsert(
      {
        staff_id: caller.id,
        attendance_date: todayStr,
        status: computedStatus,
        check_in_at: nowIso,
        notes: notes?.trim() || null,
        recorded_by: caller.id,
        source: "self_portal",
      },
      { onConflict: "staff_id,attendance_date" }
    );

    if (error) throw new Error(error.message);
  } else {
    if (!existingToday?.id) {
      throw new Error("Cannot check out without an active check-in record for today.");
    }
    if (existingToday.check_out_at) {
      throw new Error("You have already checked out for today.");
    }

    const { error } = await supabase
      .from("hr_attendance_records")
      .update({
        check_out_at: nowIso,
        notes: notes?.trim() || existingToday.notes || null,
      })
      .eq("id", existingToday.id);

    if (error) throw new Error(error.message);
  }
}

export async function recordManagementAttendance(
  caller: StaffProfile,
  input: {
    staff_id: string;
    attendance_date: string;
    status: HrAttendanceRecord["status"];
    absence_type?: string | null;
    check_in_time?: string | null; // HH:MM
    check_out_time?: string | null; // HH:MM
    notes?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!hasHrPermission(caller.role, "manage_attendance_records")) {
    throw new Error("Forbidden: You do not have permission to manage attendance records.");
  }

  const checkInIso = input.check_in_time
    ? new Date(`${input.attendance_date}T${input.check_in_time}:00`).toISOString()
    : null;
  const checkOutIso = input.check_out_time
    ? new Date(`${input.attendance_date}T${input.check_out_time}:00`).toISOString()
    : null;

  if (checkInIso && checkOutIso && checkOutIso < checkInIso) {
    throw new Error("Check-out time cannot be earlier than check-in time.");
  }

  const { data, error } = await supabase
    .from("hr_attendance_records")
    .upsert(
      {
        staff_id: input.staff_id,
        attendance_date: input.attendance_date,
        status: input.status,
        absence_type: input.status === "absent" || input.status === "excused" ? input.absence_type || null : null,
        check_in_at: checkInIso,
        check_out_at: checkOutIso,
        notes: input.notes?.trim() || null,
        recorded_by: caller.id,
        source: "manual_management",
      },
      { onConflict: "staff_id,attendance_date" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_attendance_recorded",
    entityType: "hr_attendance",
    entityId: data.id,
    newValues: {
      staff_id: input.staff_id,
      attendance_date: input.attendance_date,
      status: input.status,
    },
    eventTitle: `Attendance recorded (${input.status}) for ${input.attendance_date} by ${caller.full_name}`,
  });
}

export async function submitAttendanceCorrection(
  caller: StaffProfile,
  input: {
    attendance_id?: string | null;
    attendance_date: string;
    requested_status: HrAttendanceRecord["status"];
    requested_check_in_time?: string | null;
    requested_check_out_time?: string | null;
    reason: string;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!input.attendance_date || !input.reason.trim()) {
    throw new Error("Attendance date and reason for correction are required.");
  }

  const reqCheckIn = input.requested_check_in_time
    ? new Date(`${input.attendance_date}T${input.requested_check_in_time}:00`).toISOString()
    : null;
  const reqCheckOut = input.requested_check_out_time
    ? new Date(`${input.attendance_date}T${input.requested_check_out_time}:00`).toISOString()
    : null;

  const { data, error } = await supabase
    .from("hr_attendance_corrections")
    .insert({
      attendance_id: input.attendance_id || null,
      staff_id: caller.id,
      attendance_date: input.attendance_date,
      requested_status: input.requested_status,
      requested_check_in: reqCheckIn,
      requested_check_out: reqCheckOut,
      reason: input.reason.trim(),
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_attendance_correction_requested",
    entityType: "hr_attendance",
    entityId: data.id,
    newValues: {
      attendance_date: input.attendance_date,
      requested_status: input.requested_status,
      reason: input.reason.trim(),
    },
    eventTitle: `Attendance correction requested by ${caller.full_name} for ${input.attendance_date}`,
  });
}

export async function decideAttendanceCorrection(
  caller: StaffProfile,
  correction: HrAttendanceCorrection,
  decision: "approved" | "rejected",
  comment: string,
  activeSuperAdminCount: number
) {
  if (!supabase) throw new Error("Supabase client unavailable.");

  const eligibility = evaluateAttendanceCorrectionEligibility(
    caller,
    correction.staff_id,
    activeSuperAdminCount
  );
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason || "Unauthorized to decide attendance correction.");
  }

  const { error: updErr } = await supabase
    .from("hr_attendance_corrections")
    .update({
      status: decision,
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      reviewer_comment: comment.trim() || null,
    })
    .eq("id", correction.id);

  if (updErr) throw new Error(updErr.message);

  if (decision === "approved") {
    const { error: attErr } = await supabase.from("hr_attendance_records").upsert(
      {
        staff_id: correction.staff_id,
        attendance_date: correction.attendance_date,
        status: correction.requested_status,
        check_in_at: correction.requested_check_in || null,
        check_out_at: correction.requested_check_out || null,
        notes: `Approved correction: ${correction.reason}`,
        recorded_by: caller.id,
        source: "manual_management",
      },
      { onConflict: "staff_id,attendance_date" }
    );
    if (attErr) throw new Error(attErr.message);
  }

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: `hr_attendance_correction_${decision}`,
    entityType: "hr_attendance",
    entityId: correction.id,
    oldValues: { status: "pending" },
    newValues: { status: decision, reviewer_comment: comment.trim() || null },
    eventTitle: `Attendance correction for ${correction.staff?.full_name || "Staff"} (${correction.attendance_date}) ${decision} by ${caller.full_name}`,
  });

  await sendStaffNotification({
    recipientStaffId: correction.staff_id,
    title: `Attendance Correction ${decision.toUpperCase()}`,
    message: `Your attendance correction request for ${correction.attendance_date} was ${decision} by ${caller.full_name}.`,
    link: "/admin/hr/portal",
  });
}

// ============================================================================
// 4. HR DOCUMENTS (PRIVATE BUCKET + SIGNED URLS)
// ============================================================================

export async function uploadHrDocument(
  caller: StaffProfile,
  input: {
    file: File;
    title: string;
    category: HrDocumentRecord["category"];
    visibility_scope: HrDocumentRecord["visibility_scope"];
    staff_id?: string | null;
    expiry_date?: string | null;
    notes?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!input.title.trim()) throw new Error("Document title is required.");

  if (!ALLOWED_HR_DOC_MIMES.includes(input.file.type)) {
    throw new Error("Invalid file type. Only PDF, JPEG, PNG, and WEBP files are permitted.");
  }

  if (input.file.size <= 0 || input.file.size > MAX_HR_DOC_SIZE_BYTES) {
    throw new Error("File size must be between 1 byte and 20 MB.");
  }

  const canManageAll = hasHrPermission(caller.role, "manage_hr_documents");

  // Self-service upload validation
  if (!canManageAll) {
    if (input.staff_id && input.staff_id !== caller.id) {
      throw new Error("Forbidden: You may only upload documents to your own staff profile.");
    }
    if (input.visibility_scope !== "employee_and_hr") {
      throw new Error("Forbidden: Self-service uploads must use 'employee_and_hr' visibility.");
    }
    if (
      !["identification", "certification_qualification", "leave_supporting_doc", "other"].includes(
        input.category
      )
    ) {
      throw new Error("Forbidden: Selected document category requires HR Management authority.");
    }
  }

  if (input.visibility_scope === "super_admin_only" && caller.role !== "super_admin") {
    throw new Error("Forbidden: Only Super Admin can create 'super_admin_only' confidential records.");
  }

  const targetStaffId =
    input.visibility_scope === "company_wide" ? null : input.staff_id || caller.id;

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folderPrefix =
    input.visibility_scope === "company_wide" ? "company_wide" : `${targetStaffId}/${input.category}`;
  const storagePath = `${folderPrefix}/${Date.now()}_${safeName}`;

  const { error: storageErr } = await supabase.storage
    .from("ablebiz_hr_documents")
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (storageErr) {
    if (storageErr.message?.toLowerCase().includes("bucket not found")) {
      throw new Error(
        "Private HR storage bucket ('ablebiz_hr_documents') not found. Please apply implementation/MIGRATION_HR_WORKSPACE.sql in Supabase first."
      );
    }
    throw new Error(`Storage upload failed: ${storageErr.message}`);
  }

  const { data: docRow, error: dbErr } = await supabase
    .from("hr_documents")
    .insert({
      staff_id: targetStaffId,
      title: input.title.trim(),
      category: input.category,
      visibility_scope: input.visibility_scope,
      file_path: storagePath,
      bucket_id: "ablebiz_hr_documents",
      file_size: input.file.size,
      mime_type: input.file.type,
      uploaded_by: caller.id,
      is_verified: canManageAll,
      verified_by: canManageAll ? caller.id : null,
      verified_at: canManageAll ? new Date().toISOString() : null,
      expiry_date: input.expiry_date || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message);
  }

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_document_uploaded",
    entityType: "hr_document",
    entityId: docRow.id,
    newValues: {
      title: docRow.title,
      category: docRow.category,
      visibility_scope: docRow.visibility_scope,
      staff_id: docRow.staff_id,
    },
    eventTitle: `HR document uploaded: ${docRow.title} (${docRow.category.replace(/_/g, " ")})`,
  });

  return docRow as HrDocumentRecord;
}

export async function createHrDocumentSignedUrl(
  caller: StaffProfile,
  doc: HrDocumentRecord
): Promise<string> {
  if (!supabase) throw new Error("Supabase client unavailable.");

  const canManageAll = hasHrPermission(caller.role, "manage_hr_documents");
  if (!canManageAll) {
    const isCompanyWide = doc.visibility_scope === "company_wide";
    const isOwnPermitted =
      doc.staff_id === caller.id && doc.visibility_scope === "employee_and_hr";
    if (!isCompanyWide && !isOwnPermitted) {
      throw new Error("Access Denied: You do not have permission to access this confidential HR document.");
    }
  }

  if (doc.visibility_scope === "super_admin_only" && caller.role !== "super_admin") {
    throw new Error("Access Denied: This record is restricted to Super Admin.");
  }

  const { data, error } = await supabase.storage
    .from(doc.bucket_id || "ablebiz_hr_documents")
    .createSignedUrl(doc.file_path, 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not generate time-limited signed URL.");
  }

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_document_accessed",
    entityType: "hr_document",
    entityId: doc.id,
    newValues: { title: doc.title, category: doc.category },
    eventTitle: `HR document accessed: ${doc.title} by ${caller.full_name}`,
  });

  return data.signedUrl;
}

export async function verifyOrArchiveHrDocument(
  caller: StaffProfile,
  doc: HrDocumentRecord,
  updates: { is_verified?: boolean; is_archived?: boolean }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!hasHrPermission(caller.role, "manage_hr_documents")) {
    throw new Error("Forbidden: HR Document Management permission required.");
  }

  const payload: any = {};
  if (typeof updates.is_verified === "boolean") {
    payload.is_verified = updates.is_verified;
    payload.verified_by = updates.is_verified ? caller.id : null;
    payload.verified_at = updates.is_verified ? new Date().toISOString() : null;
  }
  if (typeof updates.is_archived === "boolean") {
    payload.is_archived = updates.is_archived;
  }

  const { error } = await supabase.from("hr_documents").update(payload).eq("id", doc.id);
  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: updates.is_archived ? "hr_document_archived" : "hr_document_verified",
    entityType: "hr_document",
    entityId: doc.id,
    oldValues: { is_verified: doc.is_verified, is_archived: doc.is_archived },
    newValues: payload,
    eventTitle: `HR document '${doc.title}' ${updates.is_archived ? "archived" : "verified"} by ${caller.full_name}`,
  });
}

// ============================================================================
// 5. HR ANNOUNCEMENTS (DRAFT / PUBLISH / ARCHIVE)
// ============================================================================

export async function createOrUpdateAnnouncement(
  caller: StaffProfile,
  input: {
    id?: string;
    title: string;
    body: string;
    category: HrAnnouncementRecord["category"];
    priority: HrAnnouncementRecord["priority"];
    status: HrAnnouncementRecord["status"];
    target_department?: string | null;
    target_role?: string | null;
    is_pinned: boolean;
    effective_date?: string | null;
    expires_at?: string | null;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!hasHrPermission(caller.role, "publish_announcements")) {
    throw new Error("Forbidden: You do not have permission to create or publish HR announcements.");
  }
  if (!input.title.trim() || !input.body.trim()) {
    throw new Error("Announcement title and body are required.");
  }

  const isPublishing = input.status === "published";

  if (input.id) {
    const { data, error } = await supabase
      .from("hr_announcements")
      .update({
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category,
        priority: input.priority,
        status: input.status,
        target_department: input.target_department || null,
        target_role: input.target_role || null,
        is_pinned: input.is_pinned,
        effective_date: input.effective_date || null,
        expires_at: input.expires_at || null,
        published_by: isPublishing ? caller.id : undefined,
        published_at: isPublishing ? new Date().toISOString() : undefined,
        updated_by: caller.id,
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logHrAuditEvent({
      actorId: caller.id,
      actorEmail: caller.email,
      action: `hr_announcement_${input.status}`,
      entityType: "hr_announcement",
      entityId: data.id,
      newValues: { title: data.title, status: data.status },
      eventTitle: `HR Announcement '${data.title}' updated (${data.status}) by ${caller.full_name}`,
    });

    return data as HrAnnouncementRecord;
  } else {
    const { data, error } = await supabase
      .from("hr_announcements")
      .insert({
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category,
        priority: input.priority,
        status: input.status,
        target_department: input.target_department || null,
        target_role: input.target_role || null,
        is_pinned: input.is_pinned,
        effective_date: input.effective_date || new Date().toISOString().slice(0, 10),
        expires_at: input.expires_at || null,
        created_by: caller.id,
        published_by: isPublishing ? caller.id : null,
        published_at: isPublishing ? new Date().toISOString() : null,
        updated_by: caller.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logHrAuditEvent({
      actorId: caller.id,
      actorEmail: caller.email,
      action: `hr_announcement_${input.status}`,
      entityType: "hr_announcement",
      entityId: data.id,
      newValues: { title: data.title, status: data.status },
      eventTitle: `HR Announcement '${data.title}' created (${data.status}) by ${caller.full_name}`,
    });

    return data as HrAnnouncementRecord;
  }
}

// ============================================================================
// 6. HR SETTINGS & POLICY CONFIGURATION (SUPER ADMIN ONLY)
// ============================================================================

export async function saveHrPolicySettings(
  caller: StaffProfile,
  settings: Partial<HrPolicySettings>
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!hasHrPermission(caller.role, "configure_hr_policies")) {
    throw new Error("Forbidden: Only Super Admin can configure company-wide HR policies.");
  }

  const { error } = await supabase.from("hr_policy_settings").upsert({
    id: 1,
    attendance_enabled: settings.attendance_enabled ?? true,
    allow_self_clock_in: settings.allow_self_clock_in ?? true,
    workday_start_time: settings.workday_start_time || "08:30:00",
    workday_end_time: settings.workday_end_time || "17:00:00",
    late_threshold_minutes: Number(settings.late_threshold_minutes ?? 15),
    leave_balances_enabled: settings.leave_balances_enabled ?? false,
    require_maker_checker_leave: settings.require_maker_checker_leave ?? true,
    policy_notes: settings.policy_notes || null,
    updated_by: caller.id,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_policy_settings_updated",
    entityType: "hr_policy",
    entityId: caller.id,
    newValues: settings,
    eventTitle: `HR policy settings updated by ${caller.full_name}`,
  });
}

export async function updateLeavePolicyEntitlement(
  caller: StaffProfile,
  policyId: string,
  updates: {
    annual_entitlement_days: number | null;
    requires_document: boolean;
    is_paid: boolean;
    is_active: boolean;
  }
) {
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!hasHrPermission(caller.role, "configure_hr_policies")) {
    throw new Error("Forbidden: Only Super Admin can modify leave entitlements.");
  }

  const { error } = await supabase
    .from("hr_leave_policies")
    .update({
      annual_entitlement_days: updates.annual_entitlement_days,
      requires_document: updates.requires_document,
      is_paid: updates.is_paid,
      is_active: updates.is_active,
      updated_by: caller.id,
    })
    .eq("id", policyId);

  if (error) throw new Error(error.message);

  await logHrAuditEvent({
    actorId: caller.id,
    actorEmail: caller.email,
    action: "hr_leave_entitlement_updated",
    entityType: "hr_policy",
    entityId: policyId,
    newValues: updates,
    eventTitle: `Leave entitlement rule updated by ${caller.full_name}`,
  });
}
