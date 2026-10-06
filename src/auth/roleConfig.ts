export type CanonicalStaffRole =
  | "super_admin"
  | "admin"
  | "operations_manager"
  | "registration_officer"
  | "accounts_officer"
  | "client_service_officer"
  | "marketing_officer"
  | "viewer";

export interface RoleConfig {
  canonical: CanonicalStaffRole;
  title: string;
  department: string;
  description: string;
  canManageTeam: boolean;
  canViewFinance: boolean;
  canManageSystem: boolean;
  badgeTone: "emerald" | "blue" | "amber" | "slate" | "purple";
}

export const ROLE_DEFINITIONS: Record<CanonicalStaffRole, RoleConfig> = {
  super_admin: {
    canonical: "super_admin",
    title: "Managing Director",
    department: "Executive Management",
    description: "Full executive system authority, strategic oversight, financial sign-off, and staff management.",
    canManageTeam: true,
    canViewFinance: true,
    canManageSystem: true,
    badgeTone: "purple",
  },
  admin: {
    canonical: "admin",
    title: "System Administrator",
    department: "Executive Operations",
    description: "Operational administration, user accounts, system configurations, and daily operations oversight.",
    canManageTeam: true,
    canViewFinance: true,
    canManageSystem: true,
    badgeTone: "blue",
  },
  operations_manager: {
    canonical: "operations_manager",
    title: "Operations Manager",
    department: "Operations",
    description: "Directs client operations, CAC filing pipelines, task distribution, and turnaround monitoring.",
    canManageTeam: false,
    canViewFinance: false,
    canManageSystem: false,
    badgeTone: "emerald",
  },
  registration_officer: {
    canonical: "registration_officer",
    title: "Compliance & Registration Officer",
    department: "Legal & Compliance",
    description: "Executes CAC submissions, status tracking, statutory filings, and compliance document verification.",
    canManageTeam: false,
    canViewFinance: false,
    canManageSystem: false,
    badgeTone: "emerald",
  },
  accounts_officer: {
    canonical: "accounts_officer",
    title: "Accountant / Finance Officer",
    department: "Finance & Accounts",
    description: "Manages quotations, invoices, verified receipts, vendor fees, disbursements, and financial balances.",
    canManageTeam: false,
    canViewFinance: true,
    canManageSystem: false,
    badgeTone: "amber",
  },
  client_service_officer: {
    canonical: "client_service_officer",
    title: "Receptionist / Client Support",
    department: "Client Relations",
    description: "Inbound inquiry triage, consultation bookings, follow-up calls, client onboarding, and messaging.",
    canManageTeam: false,
    canViewFinance: false,
    canManageSystem: false,
    badgeTone: "blue",
  },
  marketing_officer: {
    canonical: "marketing_officer",
    title: "Marketing Officer",
    department: "Growth & Marketing",
    description: "Leads attribution, referral reward tracking, growth campaigns, and partner networks.",
    canManageTeam: false,
    canViewFinance: false,
    canManageSystem: false,
    badgeTone: "purple",
  },
  viewer: {
    canonical: "viewer",
    title: "Staff Observer",
    department: "General Staff",
    description: "Read-only access to assigned records and operational timelines without edit permissions.",
    canManageTeam: false,
    canViewFinance: false,
    canManageSystem: false,
    badgeTone: "slate",
  },
};

/**
 * Normalizes any string (including conversational/legacy aliases)
 * into a valid database CanonicalStaffRole.
 */
export function normalizeStaffRole(roleStr: string | null | undefined): CanonicalStaffRole {
  if (!roleStr) return "viewer";
  const r = roleStr.toLowerCase().trim();

  // Explicit alias mappings
  if (r === "managing_director" || r === "superadmin" || r === "super_admin") return "super_admin";
  if (r === "admin" || r === "administrator") return "admin";
  if (r === "operations_manager" || r === "ops_manager") return "operations_manager";
  if (r === "compliance_officer" || r === "legal_officer" || r === "registration_officer") return "registration_officer";
  if (r === "accountant" || r === "finance_officer" || r === "accounts_officer") return "accounts_officer";
  if (r === "receptionist_support" || r === "client_service_officer" || r === "support") return "client_service_officer";
  if (r === "marketing_officer" || r === "growth_officer") return "marketing_officer";

  return "viewer";
}

/**
 * Returns the official human-friendly UI title for any role string.
 */
export function getRoleTitle(roleStr: string | null | undefined): string {
  const canonical = normalizeStaffRole(roleStr);
  return ROLE_DEFINITIONS[canonical]?.title || "Staff Member";
}

/**
 * Returns complete role metadata including department, badge tone, and capabilities.
 */
export function getRoleConfig(roleStr: string | null | undefined): RoleConfig {
  const canonical = normalizeStaffRole(roleStr);
  return ROLE_DEFINITIONS[canonical] || ROLE_DEFINITIONS.viewer;
}
