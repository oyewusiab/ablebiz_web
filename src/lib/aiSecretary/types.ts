import type { CanonicalStaffRole } from "../../auth/roleConfig";
import type { PermissionAction, StaffProfile } from "../../auth/AuthContext";
import type { HrPermissionMatrix } from "../hrPermissions";

export type SuiteModuleId =
  | "dashboard"
  | "notifications"
  | "leads"
  | "clients"
  | "businesses"
  | "follow_ups"
  | "communications"
  | "services_catalog"
  | "service_requests"
  | "cac_operations"
  | "tasks"
  | "documents"
  | "quotations"
  | "invoices"
  | "payments"
  | "expenses"
  | "vendors"
  | "referrals"
  | "reports"
  | "hr_workspace"
  | "hr"
  | "staff_rbac"
  | "team"
  | "audit_logs"
  | "settings"
  | "account_security"
  | "change_password"
  | "general";

export type AssistantTopicFilterId =
  | "all"
  | "management"
  | "cac_operations"
  | "finance"
  | "referrals_crm"
  | "staff_hr"
  | "suite_guide";

export type AssistantIntentType =
  | "operational_report"
  | "suite_guide"
  | "troubleshooting"
  | "permission_explanation"
  | "capability_overview"
  | "unsupported_feature"
  | "clarification";

export type QueryResultStatus =
  | "ok"
  | "empty"
  | "permission_denied"
  | "schema_pending"
  | "query_error"
  | "unsupported";

export interface ParsedDateRange {
  key?:
    | "today"
    | "yesterday"
    | "this_week"
    | "last_7_days"
    | "next_7_days"
    | "next_14_days"
    | "next_21_days"
    | "next_n_days"
    | "this_month"
    | "last_month"
    | "next_month"
    | "this_quarter"
    | "this_year"
    | "all_time";
  preset: string;
  label: string;
  startDateIso: string; // YYYY-MM-DD in Africa/Lagos
  endDateIso: string; // YYYY-MM-DD in Africa/Lagos
  startDate: string | null;
  endDate: string | null;
  startTimestampIso: string;
  endTimestampIso: string;
  startIso?: string;
  endIso?: string;
  isFuture: boolean;
  isExplicit: boolean;
  daysSpan: number;
  timezone: "Africa/Lagos";
}

export interface MetricSummaryItem {
  label: string;
  value: string | number;
  sublabel?: string;
  subtext?: string;
  tone?: "default" | "slate" | "emerald" | "amber" | "red" | "rose" | "blue" | "purple";
}

export type AssistantMetricItem = MetricSummaryItem;

export interface SuiteLinkItem {
  label: string;
  path: string;
  route: string;
  moduleId?: SuiteModuleId;
  module?: string;
  description?: string;
  authorized?: boolean;
}

export interface ExpandableSection {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  contentMarkdown?: string;
  table?: {
    caption?: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  };
}

export interface DataFreshnessInfo {
  queriedAtIso: string;
  queriedAtFormatted: string;
  timezone: "Africa/Lagos";
  dateRangeLabel: string;
  sources: string[];
  verificationNote?: string;
}

export interface FollowUpSuggestion {
  label: string;
  prompt: string;
  category?: string;
}

export interface SuggestedQuestionChip {
  id: string;
  label: string;
  prompt: string;
  category: string;
  moduleId: SuiteModuleId;
  intentType: AssistantIntentType;
}

export interface SuggestedQuestionGroup {
  id: AssistantTopicFilterId;
  label: string;
  iconName: string;
  questions: SuggestedQuestionChip[];
}

export interface AssistantTableData {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface AssistantSourceMetadata {
  tablesQueried: string[];
  sourcesLabel?: string;
  reportingPeriodLabel: string;
  timezone: "Africa/Lagos";
  fetchedAtIso: string;
  fetchedAtFormatted: string;
  roleApplied: CanonicalStaffRole;
  scopeDescription: string;
  technicalDetails?: string;
}

export interface AssistantResponsePayload {
  id?: string;
  intentType: AssistantIntentType;
  moduleId: SuiteModuleId;
  status: QueryResultStatus;
  headline?: string;
  title?: string;
  summary?: string;
  markdown: string;
  metrics?: MetricSummaryItem[];
  table?: AssistantTableData;
  expandableSections?: ExpandableSection[];
  links?: SuiteLinkItem[];
  freshness?: DataFreshnessInfo;
  sourceMeta?: AssistantSourceMetadata;
  followUpSuggestions?: Array<string | FollowUpSuggestion>;
  errorDetails?: string;
}

export interface ClassifiedIntent {
  intentType: AssistantIntentType;
  primaryModule: SuiteModuleId;
  secondaryModules: SuiteModuleId[];
  dateRange: ParsedDateRange;
  normalizedQuery: string;
  isFollowUp: boolean;
  isRoleSpoofingAttempt: boolean;
  isWriteMutationAttempt: boolean;
  wantsTechnicalDiagnostics?: boolean;
  topicHintApplied?: boolean;
  guideTopicId?: string;
  unsupportedReason?: string;
  subIntent?: string;
}

export interface ConversationContext {
  lastModuleId?: SuiteModuleId;
  lastIntentType?: AssistantIntentType;
  lastDateRange?: ParsedDateRange;
  lastGuideTopicId?: string;
  lastQueryText?: string;
  turnCount: number;
}

export interface CapabilityModuleSpec {
  id?: SuiteModuleId;
  moduleId: SuiteModuleId;
  name: string;
  displayName?: string;
  domain:
    | "OVERVIEW"
    | "CRM"
    | "OPERATIONS"
    | "FINANCE"
    | "COMMUNICATION"
    | "GROWTH"
    | "REPORTING"
    | "TEAM"
    | "AI"
    | "SETTINGS";
  route: string;
  purpose: string;
  tables: string[];
  relationships: string[];
  supportedQueries: string[];
  supportedWorkflows: string[];
  supportedOperations?: string[];
  permissionModule: string | null;
  requiredPermissions?: string[];
  superOrAdminOnly?: boolean;
  allowedViewRoles: CanonicalStaffRole[];
  allowedCreateEditRoles: CanonicalStaffRole[];
  allowedRolesSummary?: string;
  approvalRules: string;
  knownLimitations: string | string[];
  dataFreshness: string;
}

export interface GuideTopicEntry {
  id: string;
  moduleId: SuiteModuleId;
  title: string;
  route: string;
  routeLabel: string;
  keywords: string[];
  questionPatterns: RegExp[];
  summary: string;
  prerequisites: string[];
  steps: string[];
  requiredFieldsAndValidation: string[];
  postSubmissionBehavior: string[];
  roleAndApprovalRules: string[];
  troubleshootingMissingOrFailed: string[];
  relatedPrompts: FollowUpSuggestion[];
}

export type HasPermissionFn = (module: string, action?: PermissionAction) => boolean;

export interface AssistantCallerContext {
  profile: StaffProfile | null;
  canonicalRole: CanonicalStaffRole;
  role: CanonicalStaffRole;
  roleTitle: string;
  roleLabel: string;
  jobTitle: string | null;
  department: string | null;
  userId: string | null;
  userName: string;
  email: string | null;
  identityVerified: boolean;
  identityWarning?: string;
  permissions: string[];
  isManagement: boolean;
  hrAccess: HrPermissionMatrix;
  hasPermission: HasPermissionFn;
}
