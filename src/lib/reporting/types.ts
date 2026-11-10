import type { CanonicalStaffRole } from "../../auth/roleConfig";

export type ReportCategoryId =
  | "executive"
  | "financial"
  | "crm"
  | "operations"
  | "hr"
  | "marketing"
  | "compliance";

export type ReportDataScope = "organisation" | "department" | "personal";

export type ReportPermissionAction =
  | "view_report"
  | "view_detailed_records"
  | "export_report"
  | "generate_report"
  | "view_sensitive_fields"
  | "access_org_data"
  | "access_dept_data"
  | "access_personal_data";

export type ReportPeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "campaign_window"
  | "custom"
  | "all";

export type ReportComparisonMode = "previous_period" | "previous_year" | "none";

export type ReportOutputFormat = "pdf" | "xlsx" | "csv" | "print";

export type ReportFrequencyLabel =
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "Quarterly"
  | "Annually"
  | "Campaign Window"
  | "On-Demand";

export type ReportFilterField =
  | "period"
  | "comparison"
  | "department"
  | "staff"
  | "service_category"
  | "service"
  | "campaign"
  | "client"
  | "status";

export interface ReportFilterState {
  period: ReportPeriodPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  comparisonMode: ReportComparisonMode;
  department: string; // "all" or department name
  staffId: string; // "all" or staff_profile.id
  serviceCategory: string; // "all" or category
  serviceId: string; // "all" or service.id
  campaignId: string; // "all" or campaign.id / slug
  clientId: string; // "all" or client.id
  status: string; // "all" or status value
}

export interface ReportCatalogueEntry {
  id: string;
  category: ReportCategoryId;
  categoryLabel: string;
  title: string;
  shortTitle: string;
  description: string;
  purpose: string;
  applicableRoles: CanonicalStaffRole[];
  defaultScopeByRole: Partial<Record<CanonicalStaffRole, ReportDataScope>>;
  requiresSensitiveFinance?: boolean;
  requiresSensitiveHr?: boolean;
  requiresSecurityAudit?: boolean;
  frequency: ReportFrequencyLabel;
  availableFilters: ReportFilterField[];
  supportedFormats: ReportOutputFormat[];
  authoritativeSources: string[];
  primaryMetrics: string[];
  drillDownRoutes: { label: string; route: string; module?: string }[];
}

export interface MetricDefinition {
  id: string;
  name: string;
  category: ReportCategoryId;
  description: string;
  calculationFormula: string;
  authoritativeSource: string;
  applicableDateField: string;
  defaultFilters: string;
  unit: "NGN" | "count" | "percentage" | "days" | "ratio" | "score";
  permissionsRequired: string[];
  knownLimitations: string;
}

export interface PeriodWindow {
  preset: ReportPeriodPreset;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  comparisonLabel: string;
  comparisonStartDate: Date | null;
  comparisonEndDate: Date | null;
}

export interface PeriodComparisonValue {
  currentValue: number;
  previousValue: number | null;
  absoluteDifference: number | null;
  percentageChange: number | null;
  direction: "up" | "down" | "flat" | "na";
  formattedCurrent: string;
  formattedPrevious: string;
  formattedDifference: string;
  formattedPercentage: string;
  comparisonNote?: string;
}

export interface ReportKpiItem {
  id: string;
  metricId?: string;
  label: string;
  unit: "NGN" | "count" | "percentage" | "days" | "ratio" | "score";
  comparison: PeriodComparisonValue;
  tone: "navy" | "emerald" | "amber" | "rose" | "blue" | "purple" | "slate";
  interpretation: string;
  isPositiveWhenUp?: boolean;
  drillDownRoute?: string;
  drillDownKey?: string;
}

export interface ReportChartSeriesPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  formattedValue?: string;
  formattedSecondary?: string;
  color?: string;
  sharePercent?: number;
}

export interface ReportChartSpec {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "horizontal_bar" | "trend_line" | "distribution" | "comparison_bar";
  unit: "NGN" | "count" | "percentage" | "days" | "score";
  primarySeriesLabel: string;
  secondarySeriesLabel?: string;
  points: ReportChartSeriesPoint[];
  emptyMessage?: string;
}

export interface ReportTableColumn {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  format?: "text" | "currency_ngn" | "number" | "percentage" | "date" | "badge" | "mono";
}

export interface ReportTableSpec {
  id: string;
  title: string;
  subtitle: string;
  columns: ReportTableColumn[];
  rows: Record<string, any>[];
  totalsRow?: Record<string, any>;
  emptyMessage: string;
  drillDownRoute?: string;
  maxPreviewRows?: number;
}

export interface HealthDimensionAssessment {
  id: string;
  name: string;
  weightPercent: number;
  score: number | null; // 0-100 or null if insufficient data / restricted
  status: "strong" | "satisfactory" | "attention" | "critical" | "insufficient_data" | "restricted";
  statusLabel: string;
  contributingMetrics: string[];
  calculationExplanation: string;
  measuredValueLabel: string;
  authoritativeSources: string[];
  dataAvailable: boolean;
  limitationOrNote?: string;
}

export interface OrganisationalHealthAssessment {
  overallScore: number | null; // 0-100 or null if insufficient data
  overallBand: "Strong / Healthy" | "Satisfactory / Watch" | "Needs Management Attention" | "Critical Action Required" | "Insufficient Data for Assessment";
  dataCompletenessPercent: number;
  evaluatedDimensionsCount: number;
  totalDimensionsCount: number;
  methodologySummary: string;
  dimensions: HealthDimensionAssessment[];
}

export interface ReportBusinessInsights {
  executiveNarrative: string;
  keyAchievements: string[];
  significantChanges: string[];
  growthOpportunities: string[];
  decliningPerformance: string[];
  operationalBottlenecks: string[];
  financialRisks: string[];
  areasRequiringAttention: string[];
  recommendedActions: string[];
}

export interface DrillDownRecordItem {
  id: string;
  reference: string;
  title: string;
  subtitle: string;
  status: string;
  amountOrMetric?: string;
  dateLabel: string;
  route: string;
  entityType: string;
}

export interface GeneratedReportPayload {
  reportId: string;
  category: ReportCategoryId;
  categoryLabel: string;
  title: string;
  subtitle: string;
  documentNumber: string;
  generatedAtIso: string;
  generatedAtFormatted: string;
  generatedBy: {
    staffId: string;
    name: string;
    role: CanonicalStaffRole;
    roleTitle: string;
    department: string;
  };
  scopeApplied: ReportDataScope;
  scopeDescription: string;
  periodWindow: PeriodWindow;
  filtersApplied: ReportFilterState;
  filterSummaryText: string;
  authoritativeSources: string[];
  totalSourceRecords: number;
  kpis: ReportKpiItem[];
  healthAssessment?: OrganisationalHealthAssessment;
  charts: ReportChartSpec[];
  tables: ReportTableSpec[];
  insights: ReportBusinessInsights;
  dataLimitations: string[];
  metricDefinitionsUsed: MetricDefinition[];
  drillDownGroups: Record<string, { title: string; route: string; items: DrillDownRecordItem[] }>;
}

export interface SavedReportConfiguration {
  id: string;
  name: string;
  reportId: string;
  category: ReportCategoryId;
  filters: ReportFilterState;
  isFavourite: boolean;
  createdByStaffId: string;
  createdByName: string;
  createdAt: string;
}

export interface ReportHistoryEntry {
  id: string;
  reportId: string;
  reportTitle: string;
  category: ReportCategoryId;
  generatedByStaffId: string;
  generatedByName: string;
  generatedByRole: CanonicalStaffRole;
  generatedAt: string;
  reportingPeriodLabel: string;
  filtersApplied: ReportFilterState;
  scopeApplied: ReportDataScope;
  outputFormat: ReportOutputFormat | "preview";
  recordCount: number;
  documentNumber: string;
}

export interface ScheduledReportConfig {
  id: string;
  reportId: string;
  reportTitle: string;
  category: ReportCategoryId;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  outputFormat: "pdf" | "xlsx" | "csv";
  recipientStaffIds: string[];
  recipientNames: string[];
  scopeApplied: ReportDataScope;
  filters: ReportFilterState;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failed" | "pending" | null;
  lastFailureReason?: string | null;
  createdByStaffId: string;
  createdByName: string;
  createdAt: string;
}

export interface RoleReportAccessProfile {
  role: CanonicalStaffRole;
  roleTitle: string;
  canAccessReportingWorkspace: boolean;
  allowedCategories: ReportCategoryId[];
  allowedReportIds: string[];
  defaultDataScope: ReportDataScope;
  canViewDetailedRecords: boolean;
  canExportReports: boolean;
  canExportCsv: boolean;
  canExportExcel: boolean;
  canExportPdf: boolean;
  canPrintReports: boolean;
  canGenerateReports: boolean;
  canViewSensitiveFinancials: boolean;
  canViewSensitiveHr: boolean;
  canViewSecurityAudit: boolean;
  canAccessOrgWideData: boolean;
  canAccessDepartmentData: boolean;
  canAccessPersonalData: boolean;
  canManageSchedules: boolean;
}
