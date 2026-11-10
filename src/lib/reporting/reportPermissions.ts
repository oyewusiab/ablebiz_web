import {
  normalizeStaffRole,
  ROLE_DEFINITIONS as ROLE_CONFIGS,
  type CanonicalStaffRole,
} from "../../auth/roleConfig";
import { REPORT_CATALOGUE, getReportById } from "./reportCatalogue";
import type {
  ReportCatalogueEntry,
  ReportCategoryId,
  ReportDataScope,
  ReportOutputFormat,
  ReportPermissionAction,
  RoleReportAccessProfile,
} from "./types";

export type PermissionCheckFn = (module: string, action: string) => boolean;

/**
 * Default canonical permission checks per role when a runtime `hasPermission`
 * callback is not passed (e.g. during unit tests or recipient validation).
 */
export function defaultRolePermissionCheck(
  roleInput: string | null | undefined,
  module: string,
  action: string
): boolean {
  const role = normalizeStaffRole(roleInput);
  if (!role) return false;
  if (role === "super_admin") return true;

  const matrix: Record<CanonicalStaffRole, Record<string, string[]>> = {
    super_admin: { "*": ["*"] },
    admin: {
      dashboard: ["view"],
      clients: ["view", "create", "edit"],
      leads: ["view", "create", "edit"],
      service_requests: ["view", "create", "edit", "assign", "approve"],
      cac_operations: ["view", "create", "edit", "assign", "approve"],
      documents: ["view", "create", "edit", "approve"],
      finance: ["view", "create", "edit", "export"],
      payments: ["view", "create"],
      expenses: ["view", "create", "edit"],
      vendors: ["view", "create", "edit"],
      campaigns: ["view", "create", "edit", "export"],
      referrals: ["view", "create", "edit", "approve", "export"],
      discounts: ["view", "create", "edit", "approve"],
      spin_rewards: ["view", "edit"],
      reports: ["view", "export"],
      team: ["view", "create", "edit"],
      hr: ["view", "create", "edit", "approve", "export"],
      settings: ["view", "edit"],
      audit_logs: ["view"],
      inquiries: ["view", "edit"],
      blog: ["view", "create", "edit", "delete"],
      services: ["view", "create", "edit"],
      ai_secretary: ["view", "create"],
    },
    operations_manager: {
      dashboard: ["view"],
      clients: ["view", "create", "edit"],
      leads: ["view", "create", "edit"],
      service_requests: ["view", "create", "edit", "assign", "approve"],
      cac_operations: ["view", "create", "edit", "assign", "approve"],
      documents: ["view", "create", "edit", "approve"],
      reports: ["view", "export"],
      team: ["view"],
      hr: ["view", "create", "approve"],
      inquiries: ["view", "edit"],
      services: ["view"],
      ai_secretary: ["view", "create"],
    },
    registration_officer: {
      dashboard: ["view"],
      clients: ["view", "create", "edit"],
      service_requests: ["view", "edit"],
      cac_operations: ["view", "create", "edit"],
      documents: ["view", "create", "edit"],
      hr: ["view", "create"],
      reports: ["view"],
      ai_secretary: ["view"],
    },
    accounts_officer: {
      dashboard: ["view"],
      clients: ["view"],
      service_requests: ["view"],
      finance: ["view", "create", "edit", "export"],
      payments: ["view", "create", "edit", "export"],
      expenses: ["view", "create", "edit", "export"],
      vendors: ["view", "create", "edit"],
      referrals: ["view", "export"],
      discounts: ["view"],
      hr: ["view", "create"],
      reports: ["view", "export"],
      ai_secretary: ["view"],
    },
    client_service_officer: {
      dashboard: ["view"],
      clients: ["view", "create", "edit"],
      leads: ["view", "create", "edit"],
      service_requests: ["view", "create", "edit"],
      documents: ["view", "create"],
      campaigns: ["view"],
      referrals: ["view", "create"],
      hr: ["view", "create"],
      inquiries: ["view", "create", "edit"],
      reports: ["view"],
      ai_secretary: ["view"],
    },
    marketing_officer: {
      dashboard: ["view"],
      leads: ["view", "create", "edit", "export"],
      campaigns: ["view", "create", "edit", "export"],
      referrals: ["view", "create", "edit", "export"],
      discounts: ["view", "create", "edit"],
      spin_rewards: ["view", "create", "edit"],
      hr: ["view", "create"],
      inquiries: ["view", "edit"],
      blog: ["view", "create", "edit"],
      reports: ["view", "export"],
      ai_secretary: ["view"],
    },
    viewer: {
      dashboard: ["view"],
      clients: ["view"],
      service_requests: ["view"],
      cac_operations: ["view"],
      documents: ["view"],
      hr: ["view", "create"],
      reports: ["view"],
      ai_secretary: ["view"],
    },
  };

  const roleMap = matrix[role] || {};
  const actions = roleMap[module] || [];
  return actions.includes("*") || actions.includes(action);
}

/**
 * Checks whether a given canonical role is allowed to access a specific report entry,
 * combining the report's `applicableRoles` with module-level and sensitivity-level permissions.
 */
export function canAccessReport(
  roleInput: string | null | undefined,
  reportOrId: string | ReportCatalogueEntry,
  hasPermissionFn?: PermissionCheckFn
): boolean {
  const role = normalizeStaffRole(roleInput);
  if (!role) return false;

  const report =
    typeof reportOrId === "string" ? getReportById(reportOrId) : reportOrId;
  if (!report) return false;

  const checkPerm: PermissionCheckFn =
    hasPermissionFn ||
    ((mod, act) => defaultRolePermissionCheck(role, mod, act));

  // Role must be explicitly listed on the report catalogue entry
  if (!report.applicableRoles.includes(role)) {
    return false;
  }

  // Must have reports.view or role-authorized reporting access
  if (role !== "super_admin" && !checkPerm("reports", "view")) {
    // Allow if default role matrix grants reports.view
    if (!defaultRolePermissionCheck(role, "reports", "view")) {
      return false;
    }
  }

  // Sensitive financial reports require finance.view
  if (report.requiresSensitiveFinance) {
    if (role !== "super_admin" && !checkPerm("finance", "view")) {
      return false;
    }
  }

  // Sensitive HR reports requiresuper_admin, admin, or operations_manager with hr/team view
  if (report.requiresSensitiveHr) {
    if (
      role !== "super_admin" &&
      role !== "admin" &&
      role !== "operations_manager"
    ) {
      return false;
    }
    if (
      role !== "super_admin" &&
      !checkPerm("hr", "view") &&
      !checkPerm("team", "view")
    ) {
      return false;
    }
  }

  // Security / Audit reports require audit_logs.view or finance/operations oversight
  if (report.requiresSecurityAudit) {
    const allowedSecurityRoles: CanonicalStaffRole[] = [
      "super_admin",
      "admin",
      "operations_manager",
      "accounts_officer",
    ];
    if (!allowedSecurityRoles.includes(role)) {
      return false;
    }
    if (
      report.id === "comp_audit_log" ||
      report.id === "audit_log_report" ||
      report.id === "comp_sensitive_actions" ||
      report.id === "sensitive_action_report" ||
      report.id === "comp_user_access" ||
      report.id === "user_access_report" ||
      report.id === "comp_role_assignment" ||
      report.id === "role_assignment_report"
    ) {
      if (
        role !== "super_admin" &&
        role !== "admin" &&
        !checkPerm("audit_logs", "view")
      ) {
        return false;
      }
    }
    if (
      report.id === "comp_financial_controls" ||
      report.id === "financial_control_exceptions_report"
    ) {
      if (role !== "super_admin" && !checkPerm("finance", "view")) {
        return false;
      }
    }
  }

  // Category-level module guards
  if (report.category === "financial") {
    if (role !== "super_admin" && !checkPerm("finance", "view")) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the effective data scope ("organisation" | "department" | "personal")
 * for a role and report. Prevents privilege escalation (e.g., a registration_officer
 * requesting "organisation" scope is clamped to "personal").
 */
export function resolveEffectiveReportScope(
  roleInput: string | null | undefined,
  reportOrId: string | ReportCatalogueEntry,
  requestedScope?: ReportDataScope
): ReportDataScope {
  const role = normalizeStaffRole(roleInput);
  if (!role) return "personal";

  const report =
    typeof reportOrId === "string" ? getReportById(reportOrId) : reportOrId;

  const defaultScope: ReportDataScope =
    report?.defaultScopeByRole?.[role] ??
    (role === "super_admin" ||
    role === "admin" ||
    role === "accounts_officer" ||
    role === "marketing_officer"
      ? "organisation"
      : role === "operations_manager"
      ? "department"
      : "personal");

  if (!requestedScope) return defaultScope;

  // Privilege hierarchy: organisation > department > personal
  const allowedScopesByRole: Record<CanonicalStaffRole, ReportDataScope[]> = {
    super_admin: ["organisation", "department", "personal"],
    admin: ["organisation", "department", "personal"],
    operations_manager: ["organisation", "department", "personal"],
    accounts_officer: ["organisation", "department", "personal"],
    marketing_officer: ["organisation", "department", "personal"],
    client_service_officer: ["department", "personal"],
    registration_officer: ["personal"],
    viewer: ["organisation", "department", "personal"],
  };

  // Further constrain by report's defaultScopeByRole ceiling
  const roleCeiling = defaultScope;
  const rank: Record<ReportDataScope, number> = {
    personal: 1,
    department: 2,
    organisation: 3,
  };

  if (
    allowedScopesByRole[role].includes(requestedScope) &&
    rank[requestedScope] <= rank[roleCeiling]
  ) {
    return requestedScope;
  }

  return defaultScope;
}

/**
 * Builds the complete `RoleReportAccessProfile` for a user's canonical role.
 */
export function getRoleReportAccessProfile(
  roleInput: string | null | undefined,
  hasPermissionFn?: PermissionCheckFn
): RoleReportAccessProfile {
  const role = normalizeStaffRole(roleInput);
  if (!role) {
    return {
      role: "viewer",
      roleTitle: "Unauthorized / Unassigned",
      canAccessReportingWorkspace: false,
      allowedCategories: [],
      allowedReportIds: [],
      defaultDataScope: "personal",
      canViewDetailedRecords: false,
      canExportReports: false,
      canExportCsv: false,
      canExportExcel: false,
      canExportPdf: false,
      canPrintReports: false,
      canGenerateReports: false,
      canViewSensitiveFinancials: false,
      canViewSensitiveHr: false,
      canViewSecurityAudit: false,
      canAccessOrgWideData: false,
      canAccessDepartmentData: false,
      canAccessPersonalData: false,
      canManageSchedules: false,
    };
  }

  const checkPerm: PermissionCheckFn =
    hasPermissionFn ||
    ((mod, act) => defaultRolePermissionCheck(role, mod, act));

  const allowedReports = REPORT_CATALOGUE.filter((r) =>
    canAccessReport(role, r, checkPerm)
  );
  const allowedReportIds = allowedReports.map((r) => r.id);
  const allowedCategories = Array.from(
    new Set(allowedReports.map((r) => r.category))
  ) as ReportCategoryId[];

  const canExport =
    role === "super_admin" ||
    role === "admin" ||
    role === "operations_manager" ||
    role === "accounts_officer" ||
    role === "marketing_officer" ||
    checkPerm("reports", "export");

  // Registration officers and client service officers can export/print their own scoped operational/CRM summaries
  const canScopedExport =
    canExport ||
    role === "registration_officer" ||
    role === "client_service_officer";

  // Viewers have read-only summary access and cannot export sensitive datasets
  const isViewer = role === "viewer";

  const canViewSensitiveFinancials =
    role === "super_admin" ||
    role === "admin" ||
    role === "accounts_officer" ||
    checkPerm("finance", "view");

  const canViewSensitiveHr =
    role === "super_admin" || role === "admin";

  const canViewSecurityAudit =
    role === "super_admin" ||
    role === "admin" ||
    checkPerm("audit_logs", "view");

  const defaultDataScope: ReportDataScope =
    role === "super_admin" ||
    role === "admin" ||
    role === "accounts_officer" ||
    role === "marketing_officer"
      ? "organisation"
      : role === "operations_manager"
      ? "department"
      : "personal";

  return {
    role,
    roleTitle: ROLE_CONFIGS[role]?.title || role,
    canAccessReportingWorkspace: allowedReportIds.length > 0,
    allowedCategories,
    allowedReportIds,
    defaultDataScope,
    canViewDetailedRecords: !isViewer,
    canExportReports: !isViewer && canScopedExport,
    canExportCsv: !isViewer && canScopedExport,
    canExportExcel: !isViewer && canScopedExport,
    canExportPdf: !isViewer && canScopedExport,
    canPrintReports: !isViewer && canScopedExport,
    canGenerateReports: allowedReportIds.length > 0,
    canViewSensitiveFinancials,
    canViewSensitiveHr,
    canViewSecurityAudit,
    canAccessOrgWideData:
      role === "super_admin" ||
      role === "admin" ||
      role === "operations_manager" ||
      role === "accounts_officer" ||
      role === "marketing_officer",
    canAccessDepartmentData: role !== "registration_officer",
    canAccessPersonalData: true,
    canManageSchedules:
      role === "super_admin" ||
      role === "admin" ||
      role === "operations_manager" ||
      role === "accounts_officer" ||
      role === "marketing_officer",
  };
}

/**
 * Checks a granular `ReportPermissionAction` on a specific report for the given role.
 */
export function canPerformReportAction(
  roleInput: string | null | undefined,
  reportOrId: string | ReportCatalogueEntry,
  action: ReportPermissionAction,
  hasPermissionFn?: PermissionCheckFn
): boolean {
  const role = normalizeStaffRole(roleInput);
  if (!role) return false;

  const report =
    typeof reportOrId === "string" ? getReportById(reportOrId) : reportOrId;
  if (!report) return false;

  if (!canAccessReport(role, report, hasPermissionFn)) {
    return false;
  }

  const profile = getRoleReportAccessProfile(role, hasPermissionFn);
  const effectiveScope = resolveEffectiveReportScope(role, report);

  switch (action) {
    case "view_report":
    case "generate_report":
      return true;
    case "view_detailed_records":
      return profile.canViewDetailedRecords;
    case "export_report":
      return profile.canExportReports;
    case "view_sensitive_fields":
      if (report.category === "financial" || report.requiresSensitiveFinance) {
        return profile.canViewSensitiveFinancials;
      }
      if (report.category === "hr" || report.requiresSensitiveHr) {
        return profile.canViewSensitiveHr;
      }
      if (report.category === "compliance" || report.requiresSecurityAudit) {
        return profile.canViewSecurityAudit;
      }
      return role === "super_admin" || role === "admin";
    case "access_org_data":
      return effectiveScope === "organisation";
    case "access_dept_data":
      return (
        effectiveScope === "organisation" || effectiveScope === "department"
      );
    case "access_personal_data":
      return true;
    default:
      return false;
  }
}

/**
 * Checks if a user can export a specific report in the requested format.
 */
export function canExportReportFormat(
  roleInput: string | null | undefined,
  reportOrId: string | ReportCatalogueEntry,
  format: ReportOutputFormat,
  hasPermissionFn?: PermissionCheckFn
): boolean {
  if (
    !canPerformReportAction(
      roleInput,
      reportOrId,
      "export_report",
      hasPermissionFn
    )
  ) {
    return false;
  }
  const report =
    typeof reportOrId === "string" ? getReportById(reportOrId) : reportOrId;
  if (!report) return false;
  return report.supportedFormats.includes(format);
}

/**
 * Validates that every recipient assigned to a scheduled report is authorized to view that report.
 * Prevents scheduled report configurations from leaking unauthorized reports to restricted staff.
 */
export function validateScheduledReportRecipients(
  reportId: string,
  recipients: Array<{ id: string; full_name: string; role: string | null }>
): {
  valid: boolean;
  authorizedRecipients: Array<{ id: string; full_name: string; role: CanonicalStaffRole }>;
  unauthorizedRecipients: Array<{ id: string; full_name: string; role: string | null; reason: string }>;
} {
  const report = getReportById(reportId);
  if (!report) {
    return {
      valid: false,
      authorizedRecipients: [],
      unauthorizedRecipients: recipients.map((r) => ({
        ...r,
        reason: `Unknown report ID "${reportId}"`,
      })),
    };
  }

  const authorizedRecipients: Array<{
    id: string;
    full_name: string;
    role: CanonicalStaffRole;
  }> = [];
  const unauthorizedRecipients: Array<{
    id: string;
    full_name: string;
    role: string | null;
    reason: string;
  }> = [];

  for (const recipient of recipients) {
    const canonicalRole = normalizeStaffRole(recipient.role);
    if (!canonicalRole) {
      unauthorizedRecipients.push({
        ...recipient,
        reason: "Recipient does not have a valid canonical ABLEBIZ role.",
      });
      continue;
    }

    if (!canAccessReport(canonicalRole, report)) {
      unauthorizedRecipients.push({
        ...recipient,
        reason: `Role "${ROLE_CONFIGS[canonicalRole]?.title || canonicalRole}" is not authorized to access "${report.title}".`,
      });
      continue;
    }

    authorizedRecipients.push({
      id: recipient.id,
      full_name: recipient.full_name,
      role: canonicalRole,
    });
  }

  return {
    valid: unauthorizedRecipients.length === 0 && authorizedRecipients.length > 0,
    authorizedRecipients,
    unauthorizedRecipients,
  };
}
