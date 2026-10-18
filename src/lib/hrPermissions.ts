import { normalizeStaffRole, type CanonicalStaffRole } from "../auth/roleConfig";
import type { StaffProfile } from "../auth/AuthContext";

export type HrPermissionKey =
  | "view_hr_overview"
  | "view_staff_directory"
  | "view_own_profile"
  | "view_other_staff_profile"
  | "edit_permitted_hr_profile_fields"
  | "edit_staff_hr_metadata"
  | "manage_attendance_records"
  | "submit_leave_requests"
  | "review_decide_leave_requests"
  | "manage_hr_documents"
  | "publish_announcements"
  | "view_export_hr_reports"
  | "export_hr_reports"
  | "configure_hr_policies";

export type HrManagementTab =
  | "overview"
  | "directory"
  | "attendance"
  | "leave"
  | "documents"
  | "announcements"
  | "reports"
  | "settings";

export type HrPortalTab =
  | "profile"
  | "attendance"
  | "leave"
  | "documents"
  | "announcements"
  | "responsibilities";

export interface HrRolePermissionMatrixEntry {
  role: CanonicalStaffRole;
  view_hr_overview: boolean;
  view_staff_directory: boolean;
  view_own_profile: boolean;
  view_other_staff_profile: boolean;
  view_other_private_details: boolean;
  edit_permitted_hr_profile_fields: boolean; // Own self-service personal fields
  edit_staff_hr_metadata: boolean; // Management employment metadata (non-role/non-status)
  manage_attendance_records: boolean;
  submit_leave_requests: boolean;
  review_decide_leave_requests: boolean;
  manage_hr_documents: boolean;
  publish_announcements: boolean;
  view_export_hr_reports: boolean;
  export_hr_reports: boolean;
  configure_hr_policies: boolean;
  scopeDescription: string;
}

/**
 * Authoritative HR Permission Matrix across the 8 canonical ABLEBIZ SUITE roles.
 * Enforces least privilege:
 * - Only super_admin, admin, and operations_manager have scoped HR Management access.
 * - admin does NOT have unrestricted HR authority (cannot configure HR policies,
 *   cannot view super_admin_only disciplinary records, cannot edit super_admin profiles,
 *   cannot approve own leave/attendance corrections, and must use maker-checker for role/status changes).
 * - operations_manager has operational team oversight (overview, directory, attendance, operational leave review,
 *   and summary reports) without private HR document management, announcement publishing, or CSV export.
 * - All 8 active roles have self-service access to My Staff Portal for their own records.
 */
export const HR_PERMISSION_MATRIX: Record<CanonicalStaffRole, HrRolePermissionMatrixEntry> = {
  super_admin: {
    role: "super_admin",
    view_hr_overview: true,
    view_staff_directory: true,
    view_own_profile: true,
    view_other_staff_profile: true,
    view_other_private_details: true,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: true,
    manage_attendance_records: true,
    submit_leave_requests: true,
    review_decide_leave_requests: true,
    manage_hr_documents: true,
    publish_announcements: true,
    view_export_hr_reports: true,
    export_hr_reports: true,
    configure_hr_policies: true,
    scopeDescription:
      "Full executive HR authority, policy configuration, leave/attendance governance, confidential document vault, and maker-checker final sign-off.",
  },
  admin: {
    role: "admin",
    view_hr_overview: true,
    view_staff_directory: true,
    view_own_profile: true,
    view_other_staff_profile: true,
    view_other_private_details: true,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: true,
    manage_attendance_records: true,
    submit_leave_requests: true,
    review_decide_leave_requests: true,
    manage_hr_documents: true,
    publish_announcements: true,
    view_export_hr_reports: true,
    export_hr_reports: true,
    configure_hr_policies: false,
    scopeDescription:
      "Operational HR administration (directory, attendance, non-executive leave approvals, non-executive HR documents, announcements, reports). Cannot alter HR policy entitlements, approve own requests, or bypass Super Admin maker-checker for role/status changes.",
  },
  operations_manager: {
    role: "operations_manager",
    view_hr_overview: true,
    view_staff_directory: true,
    view_own_profile: true,
    view_other_staff_profile: true,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: true,
    submit_leave_requests: true,
    review_decide_leave_requests: true,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: true,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription:
      "Team operations oversight: HR overview, operational directory (excluding private residential/emergency details), team attendance management, operational officer leave review, and summary reports.",
  },
  registration_officer: {
    role: "registration_officer",
    view_hr_overview: false,
    view_staff_directory: false,
    view_own_profile: true,
    view_other_staff_profile: false,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: false,
    submit_leave_requests: true,
    review_decide_leave_requests: false,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: false,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription: "Self-service access via My Staff Portal (own profile, attendance, leave applications, personal documents, and published announcements).",
  },
  accounts_officer: {
    role: "accounts_officer",
    view_hr_overview: false,
    view_staff_directory: false,
    view_own_profile: true,
    view_other_staff_profile: false,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: false,
    submit_leave_requests: true,
    review_decide_leave_requests: false,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: false,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription: "Self-service access via My Staff Portal (own profile, attendance, leave applications, personal documents, and published announcements).",
  },
  client_service_officer: {
    role: "client_service_officer",
    view_hr_overview: false,
    view_staff_directory: false,
    view_own_profile: true,
    view_other_staff_profile: false,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: false,
    submit_leave_requests: true,
    review_decide_leave_requests: false,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: false,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription: "Self-service access via My Staff Portal (own profile, attendance, leave applications, personal documents, and published announcements).",
  },
  marketing_officer: {
    role: "marketing_officer",
    view_hr_overview: false,
    view_staff_directory: false,
    view_own_profile: true,
    view_other_staff_profile: false,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: false,
    submit_leave_requests: true,
    review_decide_leave_requests: false,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: false,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription: "Self-service access via My Staff Portal (own profile, attendance, leave applications, personal documents, and published announcements).",
  },
  viewer: {
    role: "viewer",
    view_hr_overview: false,
    view_staff_directory: false,
    view_own_profile: true,
    view_other_staff_profile: false,
    view_other_private_details: false,
    edit_permitted_hr_profile_fields: true,
    edit_staff_hr_metadata: false,
    manage_attendance_records: false,
    submit_leave_requests: true,
    review_decide_leave_requests: false,
    manage_hr_documents: false,
    publish_announcements: false,
    view_export_hr_reports: false,
    export_hr_reports: false,
    configure_hr_policies: false,
    scopeDescription: "Self-service access via My Staff Portal (own profile, attendance, leave applications, personal documents, and published announcements).",
  },
};

export function getHrPermissions(roleStr: string | null | undefined): HrRolePermissionMatrixEntry {
  const canonical = normalizeStaffRole(roleStr);
  return HR_PERMISSION_MATRIX[canonical] || HR_PERMISSION_MATRIX.viewer;
}

export function hasHrPermission(roleStr: string | null | undefined, key: HrPermissionKey): boolean {
  const perms = getHrPermissions(roleStr);
  return Boolean(perms[key]);
}

export function canAccessHrManagementWorkspace(roleStr: string | null | undefined): boolean {
  const perms = getHrPermissions(roleStr);
  return perms.view_hr_overview || perms.view_staff_directory;
}

export function canAccessHrManagementTab(
  roleStr: string | null | undefined,
  tab: HrManagementTab
): boolean {
  const perms = getHrPermissions(roleStr);
  if (!canAccessHrManagementWorkspace(roleStr)) return false;

  switch (tab) {
    case "overview":
      return perms.view_hr_overview;
    case "directory":
      return perms.view_staff_directory;
    case "attendance":
      return perms.manage_attendance_records;
    case "leave":
      return perms.review_decide_leave_requests;
    case "documents":
      return perms.manage_hr_documents;
    case "announcements":
      return perms.publish_announcements;
    case "reports":
      return perms.view_export_hr_reports;
    case "settings":
      return perms.configure_hr_policies;
    default:
      return false;
  }
}

export function getAllowedHrManagementTabs(roleStr: string | null | undefined): HrManagementTab[] {
  const allTabs: HrManagementTab[] = [
    "overview",
    "directory",
    "attendance",
    "leave",
    "documents",
    "announcements",
    "reports",
    "settings",
  ];
  return allTabs.filter((tab) => canAccessHrManagementTab(roleStr, tab));
}

/**
 * Evaluates whether a caller can review and decide a specific leave request.
 * Enforces separation of duties (requester cannot approve own request) and role hierarchy.
 */
export function evaluateLeaveDecisionEligibility(
  caller: StaffProfile | null,
  requestStaffId: string,
  requestStaffRole: string | null | undefined,
  activeSuperAdminCount: number
): { allowed: boolean; reason?: string } {
  if (!caller || !caller.is_active) {
    return { allowed: false, reason: "Active staff profile required." };
  }

  const callerCanonical = normalizeStaffRole(caller.role);
  const targetCanonical = normalizeStaffRole(requestStaffRole);
  const perms = getHrPermissions(callerCanonical);

  if (!perms.review_decide_leave_requests) {
    return { allowed: false, reason: "Your role does not have leave review authority." };
  }

  // Separation of duties: requester cannot decide their own leave request
  if (caller.id === requestStaffId) {
    if (callerCanonical === "super_admin" && activeSuperAdminCount <= 1) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Separation of duties: You cannot approve or decide your own leave request.",
    };
  }

  // Role hierarchy enforcement
  if (callerCanonical === "operations_manager") {
    if (["super_admin", "admin", "operations_manager"].includes(targetCanonical)) {
      return {
        allowed: false,
        reason: "Operations Manager can only decide leave requests for operational officers.",
      };
    }
  }

  if (callerCanonical === "admin" && targetCanonical === "super_admin") {
    return {
      allowed: false,
      reason: "System Administrator cannot decide leave requests for a Super Admin.",
    };
  }

  return { allowed: true };
}

/**
 * Evaluates whether a caller can review and decide a specific attendance correction request.
 */
export function evaluateAttendanceCorrectionEligibility(
  caller: StaffProfile | null,
  requestStaffId: string,
  activeSuperAdminCount: number
): { allowed: boolean; reason?: string } {
  if (!caller || !caller.is_active) {
    return { allowed: false, reason: "Active staff profile required." };
  }

  const callerCanonical = normalizeStaffRole(caller.role);
  const perms = getHrPermissions(callerCanonical);

  if (!perms.manage_attendance_records) {
    return { allowed: false, reason: "Your role is not authorized to review attendance corrections." };
  }

  if (caller.id === requestStaffId) {
    if (callerCanonical === "super_admin" && activeSuperAdminCount <= 1) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Separation of duties: You cannot approve your own attendance correction request.",
    };
  }

  return { allowed: true };
}

export function canEditTargetStaffHrMetadata(
  callerRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  const callerCanonical = normalizeStaffRole(callerRole);
  const targetCanonical = normalizeStaffRole(targetRole);
  if (callerCanonical === "super_admin") return true;
  if (callerCanonical === "admin" && targetCanonical !== "super_admin") return true;
  return false;
}
