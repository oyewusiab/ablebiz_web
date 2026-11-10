import {
  normalizeStaffRole,
  ROLE_DEFINITIONS as ROLE_CONFIGS,
  type CanonicalStaffRole,
} from "../../auth/roleConfig";
import {
  calculateReferralMilestoneReward,
  getApprovedCampaignBaseline,
} from "../campaignEngine";
import {
  formatBusinessStatusLabel,
  formatDataSourceLabel,
  getMetricDefinitionsByIds,
} from "./metricRegistry";
import { getReportById } from "./reportCatalogue";
import {
  canAccessReport,
  canPerformReportAction,
  getRoleReportAccessProfile,
  resolveEffectiveReportScope,
  type PermissionCheckFn,
} from "./reportPermissions";
import type {
  DrillDownRecordItem,
  GeneratedReportPayload,
  HealthDimensionAssessment,
  OrganisationalHealthAssessment,
  PeriodComparisonValue,
  PeriodWindow,
  ReportBusinessInsights,
  ReportChartSeriesPoint,
  ReportChartSpec,
  ReportDataScope,
  ReportFilterState,
  ReportKpiItem,
  ReportTableSpec,
} from "./types";

export interface ReportingCallerContext {
  staffId: string;
  fullName: string;
  email?: string;
  role: string | null | undefined;
  department?: string | null;
  hasPermission?: PermissionCheckFn;
}

export interface ReportingRawDataset {
  invoices: any[];
  payments: any[];
  expenses: any[];
  quotations: any[];
  vendors: any[];
  clients: any[];
  leads: any[];
  businesses: any[];
  serviceRequests: any[];
  cacRegistrations: any[];
  services: any[];
  campaigns: any[];
  campaignDiscounts: any[];
  referrers: any[];
  referralConversions: any[];
  referralRewardLedger: any[];
  spinEntries: any[];
  staffProfiles: any[];
  leaveRequests: any[];
  hrTasks: any[];
  hrAnnouncements: any[];
  auditLogs: any[];
  inquiries: any[];
  failedSources?: string[];
  queryDiagnostics?: string[];
}

export function createEmptyReportingDataset(): ReportingRawDataset {
  return {
    invoices: [],
    payments: [],
    expenses: [],
    quotations: [],
    vendors: [],
    clients: [],
    leads: [],
    businesses: [],
    serviceRequests: [],
    cacRegistrations: [],
    services: [],
    campaigns: [],
    campaignDiscounts: [],
    referrers: [],
    referralConversions: [],
    referralRewardLedger: [],
    spinEntries: [],
    staffProfiles: [],
    leaveRequests: [],
    hrTasks: [],
    hrAnnouncements: [],
    auditLogs: [],
    inquiries: [],
  };
}

export function createDefaultReportFilterState(): ReportFilterState {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    period: "this_month",
    startDate: startOfMonth.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    comparisonMode: "previous_period",
    department: "all",
    staffId: "all",
    serviceCategory: "all",
    serviceId: "all",
    campaignId: "all",
    clientId: "all",
    status: "all",
  };
}

export function formatMetricValue(
  value: number | null | undefined,
  unit: "NGN" | "count" | "percentage" | "days" | "ratio" | "score"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  switch (unit) {
    case "NGN":
      return `₦${Math.round(value).toLocaleString("en-NG")}`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${value.toFixed(1)} days`;
    case "ratio":
      return `${value.toFixed(2)}x`;
    case "score":
      return `${Math.round(value)} / 100`;
    case "count":
    default:
      return Math.round(value).toLocaleString("en-NG");
  }
}

/**
 * Computes deterministic current and comparison period windows without mutating inputs.
 */
export function computePeriodWindow(
  filters: Pick<
    ReportFilterState,
    "period" | "startDate" | "endDate" | "comparisonMode"
  >,
  referenceNow: Date = new Date()
): PeriodWindow {
  const now = new Date(referenceNow.getTime());
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  let startDate: Date | null = null;
  let endDate: Date | null = endOfToday;
  let label = "All Time";

  switch (filters.period) {
    case "today": {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );
      label = `Today (${startDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })})`;
      break;
    }
    case "this_week": {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + diffToMonday,
        0,
        0,
        0,
        0
      );
      label = `This Week (${startDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      })} – ${endOfToday.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })})`;
      break;
    }
    case "this_month": {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      label = now.toLocaleDateString("en-NG", {
        month: "long",
        year: "numeric",
      });
      break;
    }
    case "this_quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const qNumber = Math.floor(now.getMonth() / 3) + 1;
      startDate = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
      label = `Q${qNumber} ${now.getFullYear()}`;
      break;
    }
    case "this_year": {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      label = `FY ${now.getFullYear()}`;
      break;
    }
    case "campaign_window": {
      const baseline = getApprovedCampaignBaseline(now);
      startDate = new Date(baseline.start_date);
      endDate = new Date(baseline.end_date);
      label = `Office Opening Campaign (5 Nov – 20 Nov 2026)`;
      break;
    }
    case "custom": {
      startDate = filters.startDate
        ? new Date(`${filters.startDate}T00:00:00`)
        : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = filters.endDate
        ? new Date(`${filters.endDate}T23:59:59.999`)
        : endOfToday;
      label = `${startDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} – ${endDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
      break;
    }
    case "all":
    default: {
      startDate = null;
      endDate = null;
      label = "All-Time Historical Records";
      break;
    }
  }

  let comparisonStartDate: Date | null = null;
  let comparisonEndDate: Date | null = null;
  let comparisonLabel = "No Comparison Baseline";

  if (
    startDate &&
    endDate &&
    filters.comparisonMode &&
    filters.comparisonMode !== "none"
  ) {
    if (filters.comparisonMode === "previous_year") {
      comparisonStartDate = new Date(startDate.getTime());
      comparisonStartDate.setFullYear(comparisonStartDate.getFullYear() - 1);
      comparisonEndDate = new Date(endDate.getTime());
      comparisonEndDate.setFullYear(comparisonEndDate.getFullYear() - 1);
      comparisonLabel = "Same Period Prior Year";
    } else {
      const durationMs = Math.max(
        86_400_000,
        endDate.getTime() - startDate.getTime() + 1
      );
      comparisonEndDate = new Date(startDate.getTime() - 1);
      comparisonStartDate = new Date(
        comparisonEndDate.getTime() - durationMs + 1
      );
      comparisonLabel = "Immediate Prior Period";
    }
  }

  return {
    preset: filters.period,
    label,
    startDate,
    endDate,
    comparisonLabel,
    comparisonStartDate,
    comparisonEndDate,
  };
}

/**
 * Safely computes period-over-period comparisons, handling zero or missing
 * prior-period denominators without emitting Infinity or NaN.
 */
export function computePeriodComparison(
  currentValue: number,
  previousValue: number | null,
  unit: "NGN" | "count" | "percentage" | "days" | "ratio" | "score"
): PeriodComparisonValue {
  const safeCurrent = Number.isFinite(currentValue) ? currentValue : 0;
  const formattedCurrent = formatMetricValue(safeCurrent, unit);

  if (previousValue === null || previousValue === undefined || !Number.isFinite(previousValue)) {
    return {
      currentValue: safeCurrent,
      previousValue: null,
      absoluteDifference: null,
      percentageChange: null,
      direction: "na",
      formattedCurrent,
      formattedPrevious: "No prior baseline",
      formattedDifference: "—",
      formattedPercentage: "No baseline",
      comparisonNote: "Prior period comparison baseline not applicable or unavailable.",
    };
  }

  const diff = safeCurrent - previousValue;
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const formattedPrevious = formatMetricValue(previousValue, unit);
  const formattedDifference =
    diff === 0
      ? `0`
      : `${sign}${formatMetricValue(Math.abs(diff), unit)}`;

  if (previousValue === 0) {
    if (safeCurrent === 0) {
      return {
        currentValue: safeCurrent,
        previousValue: 0,
        absoluteDifference: 0,
        percentageChange: 0,
        direction: "flat",
        formattedCurrent,
        formattedPrevious,
        formattedDifference: "0",
        formattedPercentage: "0.0% (unchanged from 0)",
        comparisonNote: "Both current and prior period values are zero.",
      };
    }
    return {
      currentValue: safeCurrent,
      previousValue: 0,
      absoluteDifference: diff,
      percentageChange: null,
      direction: safeCurrent > 0 ? "up" : "down",
      formattedCurrent,
      formattedPrevious,
      formattedDifference,
      formattedPercentage: "New activity (prior period: 0)",
      comparisonNote:
        "Prior period denominator was 0; percentage growth rate is omitted to avoid division-by-zero distortion.",
    };
  }

  const pct = (diff / Math.abs(previousValue)) * 100;
  const direction = Math.abs(pct) < 0.05 ? "flat" : diff > 0 ? "up" : "down";
  const pctSign = pct > 0 ? "+" : "";

  return {
    currentValue: safeCurrent,
    previousValue,
    absoluteDifference: diff,
    percentageChange: Number(pct.toFixed(2)),
    direction,
    formattedCurrent,
    formattedPrevious,
    formattedDifference,
    formattedPercentage: `${pctSign}${pct.toFixed(1)}%`,
  };
}

function parseRecordDate(record: any, fields: string[]): Date | null {
  for (const field of fields) {
    const raw = record?.[field];
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return null;
}

function isWithinRange(
  date: Date | null,
  start: Date | null,
  end: Date | null
): boolean {
  if (!start || !end) return true;
  if (!date) return false;
  const ts = date.getTime();
  return ts >= start.getTime() && ts <= end.getTime();
}

function filterByWindow<T>(
  rows: T[],
  dateFields: string[],
  start: Date | null,
  end: Date | null
): T[] {
  if (!start || !end) return rows;
  return rows.filter((r) =>
    isWithinRange(parseRecordDate(r, dateFields), start, end)
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isBillableInvoice(inv: any): boolean {
  const status = String(inv?.status || "").toLowerCase();
  return status !== "draft" && status !== "cancelled" && status !== "refunded";
}

function isVerifiedPayment(pay: any): boolean {
  return pay?.is_verified !== false;
}

function isApprovedExpense(exp: any): boolean {
  const status = String(exp?.approval_status || "approved").toLowerCase();
  return status !== "rejected" && status !== "cancelled";
}

function isConvertedLead(lead: any): boolean {
  return Boolean(
    lead?.is_converted ||
      lead?.converted_client_id ||
      String(lead?.qualification_status || "").toLowerCase() === "converted"
  );
}

function isQualifiedLead(lead: any): boolean {
  const status = String(lead?.qualification_status || "").toLowerCase();
  return (
    status === "qualified" ||
    status === "proposal_sent" ||
    status === "negotiating" ||
    status === "converted" ||
    Boolean(lead?.is_converted)
  );
}

export type CacLifecycleCategory =
  | "submitted"
  | "in_progress"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled";

/**
 * Classifies a CAC application record into one of the distinct business lifecycle stages:
 * Submitted, In Progress, Approved, Completed, Rejected/Queried, or Cancelled.
 */
export function classifyCacApplicationStage(cac: any): CacLifecycleCategory {
  const raw = String(
    cac?.current_stage || cac?.stage || cac?.status || "intake"
  )
    .trim()
    .toLowerCase();

  if (raw === "cancelled") return "cancelled";
  if (raw === "completed") return "completed";
  if (raw === "approved" || raw === "documents_received") return "approved";
  if (raw === "rejected" || raw === "queried" || raw === "returned") {
    return "rejected";
  }
  if (raw === "application_submitted" || raw === "submitted") {
    return "submitted";
  }
  return "in_progress";
}

export interface CacStageSummary {
  total: number;
  submitted: number;
  inProgress: number;
  approved: number;
  completed: number;
  rejectedOrQueried: number;
  cancelled: number;
  eligibleCount: number;
  progressedCount: number;
  progressRatePct: number | null;
}

export function summarizeCacStages(cacRecords: any[]): CacStageSummary {
  let submitted = 0;
  let inProgress = 0;
  let approved = 0;
  let completed = 0;
  let rejectedOrQueried = 0;
  let cancelled = 0;

  for (const rec of cacRecords || []) {
    const bucket = classifyCacApplicationStage(rec);
    if (bucket === "submitted") submitted += 1;
    else if (bucket === "in_progress") inProgress += 1;
    else if (bucket === "approved") approved += 1;
    else if (bucket === "completed") completed += 1;
    else if (bucket === "rejected") rejectedOrQueried += 1;
    else if (bucket === "cancelled") cancelled += 1;
  }

  const total = (cacRecords || []).length;
  const eligibleCount = Math.max(0, total - cancelled);
  const progressedCount = approved + completed;
  const progressRatePct =
    eligibleCount > 0 ? (progressedCount / eligibleCount) * 100 : null;

  return {
    total,
    submitted,
    inProgress,
    approved,
    completed,
    rejectedOrQueried,
    cancelled,
    eligibleCount,
    progressedCount,
    progressRatePct,
  };
}

function isCompletedRequest(req: any): boolean {
  const status = String(
    req?.current_stage || req?.status || req?.stage || ""
  ).toLowerCase();
  return (
    status === "completed" ||
    status === "approved" ||
    status === "documents_received"
  );
}

function isQueriedOrRejectedRequest(req: any): boolean {
  const status = String(
    req?.current_stage || req?.status || req?.stage || ""
  ).toLowerCase();
  return (
    status === "queried" ||
    status === "rejected" ||
    status === "returned" ||
    Number(req?.query_count || 0) > 0
  );
}

function isPendingRequest(req: any): boolean {
  const status = String(
    req?.current_stage || req?.status || req?.stage || ""
  ).toLowerCase();
  return (
    status !== "completed" &&
    status !== "approved" &&
    status !== "documents_received" &&
    status !== "cancelled" &&
    status !== "rejected"
  );
}

function computeTurnaroundDays(req: any, referenceNow: Date): number | null {
  const start = parseRecordDate(req, [
    "submission_date",
    "submitted_at",
    "created_at",
  ]);
  const end = parseRecordDate(req, [
    "approval_date",
    "completed_at",
    "approved_at",
    "updated_at",
  ]);
  if (!start) return null;
  const finish = isCompletedRequest(req) ? end || referenceNow : referenceNow;
  const diffDays = (finish.getTime() - start.getTime()) / 86_400_000;
  return diffDays >= 0 ? diffDays : 0;
}

/**
 * Calculates the transparent, multi-dimensional Organisational Health Assessment.
 * Missing or restricted dimensions are excluded from the weight denominator rather than
 * treated as 0, and overall score is only computed when >= 3 dimensions have verified data.
 */
export function calculateOrganisationalHealth(params: {
  revenueGrowthPct: number | null;
  hasRevenueData: boolean;
  netProfitMarginPct: number | null;
  hasProfitData: boolean;
  collectionEfficiencyPct: number | null;
  overdueSharePct: number | null;
  hasReceivablesData: boolean;
  leadConversionPct: number | null;
  newClientsCount: number;
  hasCrmData: boolean;
  serviceCompletionPct: number | null;
  hasServiceData: boolean;
  cacQueryRatePct: number | null;
  cacAvgTurnaroundDays: number | null;
  hasCacData: boolean;
  taskCompletionPct: number | null;
  overdueTasksCount: number;
  hasStaffTaskData: boolean;
  referralVerificationPct: number | null;
  campaignRegistrationsCount: number;
  hasCampaignData: boolean;
  canViewFinance: boolean;
}): OrganisationalHealthAssessment {
  const dimensions: HealthDimensionAssessment[] = [];

  // 1. Revenue Performance (15%)
  if (!params.canViewFinance) {
    dimensions.push({
      id: "revenue_performance",
      name: "Revenue Performance",
      weightPercent: 15,
      score: null,
      status: "restricted",
      statusLabel: "Restricted by Role",
      contributingMetrics: ["cash_collected", "revenue_growth_rate"],
      calculationExplanation:
        "Evaluates confirmed customer payments received and period-over-period revenue trajectory.",
      measuredValueLabel: "Restricted",
      authoritativeSources: ["Payment Records", "Invoice Records"],
      dataAvailable: false,
      limitationOrNote: "Requires financial viewing permissions.",
    });
  } else if (!params.hasRevenueData) {
    dimensions.push({
      id: "revenue_performance",
      name: "Revenue Performance",
      weightPercent: 15,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: ["cash_collected", "revenue_growth_rate"],
      calculationExplanation:
        "Evaluates confirmed customer payments received and period-over-period revenue trajectory.",
      measuredValueLabel: "No revenue records in period",
      authoritativeSources: ["Payment Records", "Invoice Records"],
      dataAvailable: false,
      limitationOrNote: "No confirmed payments or issued invoices recorded in window.",
    });
  } else {
    const growth = params.revenueGrowthPct ?? 0;
    const score = Math.max(
      25,
      Math.min(100, Math.round(72 + Math.max(-35, Math.min(28, growth))))
    );
    dimensions.push({
      id: "revenue_performance",
      name: "Revenue Performance",
      weightPercent: 15,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: ["cash_collected", "revenue_growth_rate"],
      calculationExplanation:
        "Base score of 72 adjusted by period-over-period confirmed cash collection growth.",
      measuredValueLabel:
        params.revenueGrowthPct !== null
          ? `${params.revenueGrowthPct >= 0 ? "+" : ""}${params.revenueGrowthPct.toFixed(1)}% vs prior period`
          : "Active collection baseline established",
      authoritativeSources: ["Payment Records", "Invoice Records"],
      dataAvailable: true,
    });
  }

  // 2. Profitability & Cost Control (15%)
  if (!params.canViewFinance) {
    dimensions.push({
      id: "profitability_cost_control",
      name: "Profitability & Cost Control",
      weightPercent: 15,
      score: null,
      status: "restricted",
      statusLabel: "Restricted by Role",
      contributingMetrics: ["net_profit", "net_profit_margin"],
      calculationExplanation:
        "Evaluates net operating profit margin (Confirmed Cash Received minus Recorded Expenses).",
      measuredValueLabel: "Restricted",
      authoritativeSources: ["Payment Records", "Expense Records"],
      dataAvailable: false,
      limitationOrNote: "Requires financial viewing permissions.",
    });
  } else if (!params.hasProfitData || params.netProfitMarginPct === null) {
    dimensions.push({
      id: "profitability_cost_control",
      name: "Profitability & Cost Control",
      weightPercent: 15,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: ["net_profit", "net_profit_margin"],
      calculationExplanation:
        "Evaluates net operating profit margin (Confirmed Cash Received minus Recorded Expenses).",
      measuredValueLabel: "No cash baseline for margin",
      authoritativeSources: ["Payment Records", "Expense Records"],
      dataAvailable: false,
      limitationOrNote: "Net margin requires confirmed cash received greater than ₦0.",
    });
  } else {
    const margin = params.netProfitMarginPct;
    const score =
      margin >= 35
        ? 92
        : margin >= 20
        ? 80
        : margin >= 10
        ? 68
        : margin >= 0
        ? 55
        : Math.max(20, Math.round(45 + margin / 2));
    dimensions.push({
      id: "profitability_cost_control",
      name: "Profitability & Cost Control",
      weightPercent: 15,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: ["net_profit", "net_profit_margin"],
      calculationExplanation:
        "Benchmarks net cash operating margin against healthy professional service targets (>= 25%).",
      measuredValueLabel: `${margin.toFixed(1)}% Net Margin`,
      authoritativeSources: ["Payment Records", "Expense Records"],
      dataAvailable: true,
    });
  }

  // 3. Receivables & Cash Collection (15%)
  if (!params.canViewFinance) {
    dimensions.push({
      id: "receivables_collection",
      name: "Receivables & Cash Collection",
      weightPercent: 15,
      score: null,
      status: "restricted",
      statusLabel: "Restricted by Role",
      contributingMetrics: [
        "collection_efficiency_rate",
        "overdue_receivables",
      ],
      calculationExplanation:
        "Measures cash collection efficiency against issued invoices and overdue balance exposure.",
      measuredValueLabel: "Restricted",
      authoritativeSources: ["Invoice Records", "Payment Records"],
      dataAvailable: false,
      limitationOrNote: "Requires financial viewing permissions.",
    });
  } else if (!params.hasReceivablesData || params.collectionEfficiencyPct === null) {
    dimensions.push({
      id: "receivables_collection",
      name: "Receivables & Cash Collection",
      weightPercent: 15,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: [
        "collection_efficiency_rate",
        "overdue_receivables",
      ],
      calculationExplanation:
        "Measures cash collection efficiency against issued invoices and overdue balance exposure.",
      measuredValueLabel: "No billable invoices in period",
      authoritativeSources: ["Invoice Records", "Payment Records"],
      dataAvailable: false,
      limitationOrNote: "No issued invoices in the selected period.",
    });
  } else {
    const collEff = Math.min(100, Math.max(0, params.collectionEfficiencyPct));
    const overduePenalty = Math.min(35, (params.overdueSharePct ?? 0) * 0.5);
    const score = Math.max(15, Math.min(100, Math.round(collEff - overduePenalty)));
    dimensions.push({
      id: "receivables_collection",
      name: "Receivables & Cash Collection",
      weightPercent: 15,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: [
        "collection_efficiency_rate",
        "overdue_receivables",
      ],
      calculationExplanation:
        "Collection efficiency percentage penalized by overdue invoice share.",
      measuredValueLabel: `${collEff.toFixed(1)}% Collected (${(params.overdueSharePct ?? 0).toFixed(1)}% Overdue)`,
      authoritativeSources: ["Invoice Records", "Payment Records"],
      dataAvailable: true,
    });
  }

  // 4. Client Growth & Conversion (15%)
  if (!params.hasCrmData) {
    dimensions.push({
      id: "client_growth_conversion",
      name: "Client Growth & Conversion",
      weightPercent: 15,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: ["new_clients_acquired", "lead_conversion_rate"],
      calculationExplanation:
        "Evaluates new client onboarding volume and cohort lead-to-client conversion rate.",
      measuredValueLabel: "No leads/clients in period",
      authoritativeSources: ["Client Records", "Lead Records"],
      dataAvailable: false,
      limitationOrNote: "No client or lead records found in the reporting window.",
    });
  } else {
    const convRate = params.leadConversionPct ?? 25;
    const clientBonus = Math.min(25, params.newClientsCount * 4);
    const score = Math.max(
      30,
      Math.min(100, Math.round(45 + Math.min(35, convRate * 0.9) + clientBonus))
    );
    dimensions.push({
      id: "client_growth_conversion",
      name: "Client Growth & Conversion",
      weightPercent: 15,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: ["new_clients_acquired", "lead_conversion_rate"],
      calculationExplanation:
        "Combines cohort lead conversion rate with active new client onboarding.",
      measuredValueLabel: `${params.newClientsCount} New Clients | ${(params.leadConversionPct ?? 0).toFixed(1)}% Lead Conv.`,
      authoritativeSources: ["Client Records", "Lead Records"],
      dataAvailable: true,
    });
  }

  // 5. Service Delivery Efficiency (15%)
  if (!params.hasServiceData || params.serviceCompletionPct === null) {
    dimensions.push({
      id: "service_delivery_efficiency",
      name: "Service Delivery Efficiency",
      weightPercent: 15,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: [
        "service_completion_rate",
        "service_requests_pending",
      ],
      calculationExplanation:
        "Measures service request completion ratio against active backlog.",
      measuredValueLabel: "No service requests in period",
      authoritativeSources: ["Service Requests"],
      dataAvailable: false,
      limitationOrNote: "No service requests recorded in the reporting period.",
    });
  } else {
    const comp = params.serviceCompletionPct;
    const score = Math.max(25, Math.min(100, Math.round(comp * 0.85 + 15)));
    dimensions.push({
      id: "service_delivery_efficiency",
      name: "Service Delivery Efficiency",
      weightPercent: 15,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: [
        "service_completion_rate",
        "service_requests_pending",
      ],
      calculationExplanation:
        "Weighted completion ratio of active client service requests.",
      measuredValueLabel: `${comp.toFixed(1)}% Completion Rate`,
      authoritativeSources: ["Service Requests"],
      dataAvailable: true,
    });
  }

  // 6. CAC Operational Turnaround (10%)
  if (!params.hasCacData) {
    dimensions.push({
      id: "cac_operational_turnaround",
      name: "CAC Operational Turnaround",
      weightPercent: 10,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: ["cac_avg_turnaround_days", "cac_queried_rejected"],
      calculationExplanation:
        "Measures CAC filing turnaround speed and query/rejection minimization.",
      measuredValueLabel: "No CAC filings in period",
      authoritativeSources: ["CAC Registration Records"],
      dataAvailable: false,
      limitationOrNote: "No CAC registration filings in the reporting window.",
    });
  } else {
    const queryPenalty = Math.min(40, (params.cacQueryRatePct ?? 0) * 1.2);
    const turnaroundDays = params.cacAvgTurnaroundDays ?? 5;
    const speedScore =
      turnaroundDays <= 5
        ? 95
        : turnaroundDays <= 10
        ? 82
        : turnaroundDays <= 15
        ? 68
        : 52;
    const score = Math.max(20, Math.min(100, Math.round(speedScore - queryPenalty)));
    dimensions.push({
      id: "cac_operational_turnaround",
      name: "CAC Operational Turnaround",
      weightPercent: 10,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: ["cac_avg_turnaround_days", "cac_queried_rejected"],
      calculationExplanation:
        "Turnaround duration benchmark adjusted for CAC query/rejection frequency.",
      measuredValueLabel: `${turnaroundDays.toFixed(1)}d Avg Turnaround | ${(params.cacQueryRatePct ?? 0).toFixed(1)}% Query Rate`,
      authoritativeSources: ["CAC Registration Records"],
      dataAvailable: true,
    });
  }

  // 7. Staff Productivity & Task Execution (10%)
  if (!params.hasStaffTaskData || params.taskCompletionPct === null) {
    dimensions.push({
      id: "staff_productivity",
      name: "Staff Productivity & Execution",
      weightPercent: 10,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: ["staff_task_completion_rate", "active_staff_count"],
      calculationExplanation:
        "Evaluates staff task completion rate and overdue task discipline.",
      measuredValueLabel: "No assigned tasks in period",
      authoritativeSources: ["Staff Task Records", "Staff Records"],
      dataAvailable: false,
      limitationOrNote: "No HR/operational task records found for this scope.",
    });
  } else {
    const overduePenalty = Math.min(25, params.overdueTasksCount * 4);
    const score = Math.max(
      25,
      Math.min(100, Math.round(params.taskCompletionPct * 0.85 + 15 - overduePenalty))
    );
    dimensions.push({
      id: "staff_productivity",
      name: "Staff Productivity & Execution",
      weightPercent: 10,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: ["staff_task_completion_rate", "active_staff_count"],
      calculationExplanation:
        "Task completion ratio adjusted for overdue task backlog.",
      measuredValueLabel: `${params.taskCompletionPct.toFixed(1)}% Task Completion (${params.overdueTasksCount} Overdue)`,
      authoritativeSources: ["Staff Task Records", "Staff Records"],
      dataAvailable: true,
    });
  }

  // 8. Marketing & Referral Momentum (5%)
  if (!params.hasCampaignData) {
    dimensions.push({
      id: "marketing_referral_momentum",
      name: "Marketing & Referral Momentum",
      weightPercent: 5,
      score: null,
      status: "insufficient_data",
      statusLabel: "Insufficient Data",
      contributingMetrics: [
        "verified_referrals_count",
        "campaign_discounted_registrations",
      ],
      calculationExplanation:
        "Evaluates confirmed referral conversion rate and campaign registration traction.",
      measuredValueLabel: "No campaign/referral records in period",
      authoritativeSources: [
        "Referral Records",
        "Campaign Discount Records",
      ],
      dataAvailable: false,
      limitationOrNote: "No campaign or referral records in the selected window.",
    });
  } else {
    const verPct = params.referralVerificationPct ?? 50;
    const regBonus = Math.min(25, params.campaignRegistrationsCount * 3);
    const score = Math.max(
      35,
      Math.min(100, Math.round(50 + verPct * 0.3 + regBonus))
    );
    dimensions.push({
      id: "marketing_referral_momentum",
      name: "Marketing & Referral Momentum",
      weightPercent: 5,
      score,
      status:
        score >= 80
          ? "strong"
          : score >= 65
          ? "satisfactory"
          : score >= 50
          ? "attention"
          : "critical",
      statusLabel:
        score >= 80
          ? "Strong"
          : score >= 65
          ? "Satisfactory"
          : score >= 50
          ? "Needs Attention"
          : "Critical",
      contributingMetrics: [
        "verified_referrals_count",
        "campaign_discounted_registrations",
      ],
      calculationExplanation:
        "Confirmed referral conversion ratio plus campaign service adoption.",
      measuredValueLabel: `${params.campaignRegistrationsCount} Campaign Sales | ${(params.referralVerificationPct ?? 0).toFixed(1)}% Confirmed Referrals`,
      authoritativeSources: [
        "Referral Records",
        "Campaign Discount Records",
      ],
      dataAvailable: true,
    });
  }

  const activeDimensions = dimensions.filter(
    (d) => d.dataAvailable && d.score !== null
  );
  const totalDimensionsCount = dimensions.length;
  const evaluatedDimensionsCount = activeDimensions.length;
  const dataCompletenessPercent = Math.round(
    (evaluatedDimensionsCount / totalDimensionsCount) * 100
  );

  if (evaluatedDimensionsCount < 3) {
    return {
      overallScore: null,
      overallBand: "Insufficient Data for Assessment",
      dataCompletenessPercent,
      evaluatedDimensionsCount,
      totalDimensionsCount,
      methodologySummary:
        "At least 3 verified operational dimensions are required to compute a composite Organisational Health Score. Missing or restricted dimensions are never fabricated or treated as zero.",
      dimensions,
    };
  }

  const activeWeightSum = activeDimensions.reduce(
    (sum, d) => sum + d.weightPercent,
    0
  );
  const weightedSum = activeDimensions.reduce(
    (sum, d) => sum + (d.score ?? 0) * d.weightPercent,
    0
  );
  const overallScore =
    activeWeightSum > 0 ? Math.round(weightedSum / activeWeightSum) : null;

  const overallBand =
    overallScore === null
      ? "Insufficient Data for Assessment"
      : overallScore >= 80
      ? "Strong / Healthy"
      : overallScore >= 65
      ? "Satisfactory / Watch"
      : overallScore >= 50
      ? "Needs Management Attention"
      : "Critical Action Required";

  return {
    overallScore,
    overallBand,
    dataCompletenessPercent,
    evaluatedDimensionsCount,
    totalDimensionsCount,
    methodologySummary: `Composite score normalized across ${evaluatedDimensionsCount} of ${totalDimensionsCount} verified dimensions (${activeWeightSum}% active weight). Dimensions without data or restricted by role are excluded from the denominator rather than scored as zero.`,
    dimensions,
  };
}

/**
 * Generates an accurate, role-scoped, data-grounded report payload for any of the 78 reports.
 */
export function generateReportPayload(
  reportId: string,
  filters: ReportFilterState,
  caller: ReportingCallerContext,
  rawDataset: ReportingRawDataset,
  referenceNow: Date = new Date()
): GeneratedReportPayload {
  const role = normalizeStaffRole(caller.role) || "viewer";
  const report = getReportById(reportId);
  if (!report) {
    throw new Error(`Report definition "${reportId}" was not found in the catalogue.`);
  }

  if (!canAccessReport(role, report, caller.hasPermission)) {
    throw new Error(
      `Access Denied: Role "${ROLE_CONFIGS[role]?.title || role}" is not authorized to generate "${report.title}".`
    );
  }

  const accessProfile = getRoleReportAccessProfile(role, caller.hasPermission);
  const effectiveScope: ReportDataScope = resolveEffectiveReportScope(
    role,
    report
  );
  const canSeeDetailedRecords = canPerformReportAction(
    role,
    report,
    "view_detailed_records",
    caller.hasPermission
  );
  const canSeeSensitiveFinance = accessProfile.canViewSensitiveFinancials;
  const canSeeSensitiveHr = accessProfile.canViewSensitiveHr;
  const canSeeSecurityAudit = accessProfile.canViewSecurityAudit;

  const periodWindow = computePeriodWindow(filters, referenceNow);

  // Staff lookup map
  const staffById = new Map<string, any>();
  for (const s of rawDataset.staffProfiles || []) {
    if (s?.id) staffById.set(s.id, s);
  }

  const clientById = new Map<string, any>();
  for (const c of rawDataset.clients || []) {
    if (c?.id) clientById.set(c.id, c);
  }

  const serviceById = new Map<string, any>();
  for (const s of rawDataset.services || []) {
    if (s?.id) serviceById.set(s.id, s);
  }

  // Scope & Filter Predicates
  const callerDept = String(caller.department || "").trim().toLowerCase();

  const matchesStaffScope = (assignedStaffId?: string | null, dept?: string | null): boolean => {
    if (effectiveScope === "personal") {
      return assignedStaffId === caller.staffId;
    }
    if (effectiveScope === "department" && callerDept) {
      const staffRecord = assignedStaffId ? staffById.get(assignedStaffId) : null;
      const targetDept = String(
        dept || staffRecord?.department || ""
      )
        .trim()
        .toLowerCase();
      if (targetDept && targetDept !== callerDept) {
        return false;
      }
    }
    if (filters.staffId && filters.staffId !== "all") {
      if (assignedStaffId !== filters.staffId) return false;
    }
    if (filters.department && filters.department !== "all") {
      const staffRecord = assignedStaffId ? staffById.get(assignedStaffId) : null;
      const targetDept = String(
        dept || staffRecord?.department || ""
      )
        .trim()
        .toLowerCase();
      if (targetDept !== filters.department.trim().toLowerCase()) return false;
    }
    return true;
  };

  // Scope datasets before date filtering
  const scopedServiceRequests = (rawDataset.serviceRequests || []).filter((sr) => {
    if (
      !matchesStaffScope(
        sr.assigned_to || sr.assigned_officer_id || sr.created_by,
        sr.department
      )
    ) {
      return false;
    }
    if (filters.clientId !== "all" && sr.client_id !== filters.clientId) {
      return false;
    }
    if (filters.serviceId !== "all" && sr.service_id !== filters.serviceId) {
      return false;
    }
    if (filters.serviceCategory !== "all") {
      const svc = serviceById.get(sr.service_id);
      const cat = String(sr.service_category || svc?.category || "").toLowerCase();
      if (cat !== filters.serviceCategory.toLowerCase()) return false;
    }
    if (
      filters.status !== "all" &&
      String(sr.status || "").toLowerCase() !== filters.status.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const scopedCacRegistrations = (rawDataset.cacRegistrations || []).filter(
    (cac) => {
      if (
        !matchesStaffScope(
          cac.assigned_officer_id || cac.assigned_to,
          "CAC Registration & Post-Incorporation"
        )
      ) {
        return false;
      }
      if (filters.clientId !== "all" && cac.client_id !== filters.clientId) {
        return false;
      }
      if (
        filters.status !== "all" &&
        String(
          cac.current_stage || cac.stage || cac.status || ""
        ).toLowerCase() !== filters.status.toLowerCase()
      ) {
        return false;
      }
      return true;
    }
  );

  const scopedLeads = (rawDataset.leads || []).filter((lead) => {
    if (
      effectiveScope === "personal" &&
      lead.assigned_to &&
      lead.assigned_to !== caller.staffId
    ) {
      return false;
    }
    if (
      filters.staffId !== "all" &&
      lead.assigned_to !== filters.staffId
    ) {
      return false;
    }
    if (
      filters.status !== "all" &&
      String(lead.qualification_status || "").toLowerCase() !==
        filters.status.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const scopedClients = (rawDataset.clients || []).filter((client) => {
    if (
      effectiveScope === "personal" &&
      client.assigned_officer_id &&
      client.assigned_officer_id !== caller.staffId
    ) {
      return false;
    }
    if (filters.clientId !== "all" && client.id !== filters.clientId) {
      return false;
    }
    return true;
  });

  const scopedInvoices = canSeeSensitiveFinance
    ? (rawDataset.invoices || []).filter((inv) => {
        if (filters.clientId !== "all" && inv.client_id !== filters.clientId) {
          return false;
        }
        if (
          filters.status !== "all" &&
          String(inv.status || "").toLowerCase() !== filters.status.toLowerCase()
        ) {
          return false;
        }
        return true;
      })
    : [];

  const scopedPayments = canSeeSensitiveFinance
    ? (rawDataset.payments || []).filter((pay) => {
        if (filters.clientId !== "all" && pay.client_id !== filters.clientId) {
          return false;
        }
        return true;
      })
    : [];

  const scopedExpenses = canSeeSensitiveFinance
    ? (rawDataset.expenses || []).filter((exp) => {
        if (
          filters.status !== "all" &&
          String(exp.approval_status || "").toLowerCase() !==
            filters.status.toLowerCase()
        ) {
          return false;
        }
        return true;
      })
    : [];

  const scopedStaff = (rawDataset.staffProfiles || []).filter((st) => {
    if (effectiveScope === "personal") return st.id === caller.staffId;
    if (
      effectiveScope === "department" &&
      callerDept &&
      String(st.department || "").trim().toLowerCase() !== callerDept
    ) {
      return false;
    }
    if (
      filters.department !== "all" &&
      String(st.department || "").trim().toLowerCase() !==
        filters.department.trim().toLowerCase()
    ) {
      return false;
    }
    if (filters.staffId !== "all" && st.id !== filters.staffId) {
      return false;
    }
    return true;
  });

  const scopedTasks = (rawDataset.hrTasks || []).filter((t) =>
    matchesStaffScope(t.assigned_to, t.department)
  );

  const scopedLeaves = (rawDataset.leaveRequests || []).filter((lv) =>
    matchesStaffScope(lv.staff_id, lv.department)
  );

  // Period-filtered vs comparison-filtered slices
  const curInvoices = filterByWindow(
    scopedInvoices,
    ["issue_date", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevInvoices =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedInvoices,
          ["issue_date", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curPayments = filterByWindow(
    scopedPayments,
    ["payment_date", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevPayments =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedPayments,
          ["payment_date", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curExpenses = filterByWindow(
    scopedExpenses,
    ["expense_date", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevExpenses =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedExpenses,
          ["expense_date", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curClients = filterByWindow(
    scopedClients,
    ["created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevClients =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedClients,
          ["created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curLeads = filterByWindow(
    scopedLeads,
    ["created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevLeads =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedLeads,
          ["created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curServiceRequests = filterByWindow(
    scopedServiceRequests,
    ["submitted_at", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevServiceRequests =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedServiceRequests,
          ["submitted_at", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curCac = filterByWindow(
    scopedCacRegistrations,
    ["submission_date", "submitted_at", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevCac =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          scopedCacRegistrations,
          ["submission_date", "submitted_at", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curDiscounts = filterByWindow(
    rawDataset.campaignDiscounts || [],
    ["applied_at", "created_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevDiscounts =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          rawDataset.campaignDiscounts || [],
          ["applied_at", "created_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curReferrals = filterByWindow(
    rawDataset.referralConversions || [],
    ["created_at", "verified_at"],
    periodWindow.startDate,
    periodWindow.endDate
  );
  const prevReferrals =
    periodWindow.comparisonStartDate && periodWindow.comparisonEndDate
      ? filterByWindow(
          rawDataset.referralConversions || [],
          ["created_at", "verified_at"],
          periodWindow.comparisonStartDate,
          periodWindow.comparisonEndDate
        )
      : null;

  const curAuditLogs = canSeeSecurityAudit
    ? filterByWindow(
        rawDataset.auditLogs || [],
        ["created_at"],
        periodWindow.startDate,
        periodWindow.endDate
      )
    : [];

  // Core Authoritative Financial Aggregations
  const billableCurInvoices = curInvoices.filter(isBillableInvoice);
  const billablePrevInvoices = prevInvoices
    ? prevInvoices.filter(isBillableInvoice)
    : null;

  const getInvoiceTotal = (inv: any): number =>
    Number(inv?.total ?? inv?.total_amount ?? 0);

  const invoicesIssuedAmount = billableCurInvoices.reduce(
    (s, i) => s + getInvoiceTotal(i),
    0
  );
  const prevInvoicesIssuedAmount = billablePrevInvoices
    ? billablePrevInvoices.reduce((s, i) => s + getInvoiceTotal(i), 0)
    : null;

  const verifiedCurPayments = curPayments.filter(isVerifiedPayment);
  const verifiedPrevPayments = prevPayments
    ? prevPayments.filter(isVerifiedPayment)
    : null;

  const cashCollectedAmount = verifiedCurPayments.reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  );
  const prevCashCollectedAmount = verifiedPrevPayments
    ? verifiedPrevPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    : null;

  const outstandingInvoicesList = billableCurInvoices.filter((inv) => {
    const st = String(inv.status || "").toLowerCase();
    return (
      (st === "issued" ||
        st === "sent" ||
        st === "partially_paid" ||
        st === "overdue" ||
        st === "unpaid") &&
      Number(
        inv.balance_due ??
          getInvoiceTotal(inv) - Number(inv.amount_paid || 0)
      ) > 0
    );
  });

  const outstandingReceivablesAmount = outstandingInvoicesList.reduce(
    (s, i) =>
      s +
      Number(
        i.balance_due ??
          Math.max(0, getInvoiceTotal(i) - Number(i.amount_paid || 0))
      ),
    0
  );

  const prevOutstandingAmount = billablePrevInvoices
    ? billablePrevInvoices
        .filter((inv) => {
          const st = String(inv.status || "").toLowerCase();
          return (
            st === "issued" ||
            st === "sent" ||
            st === "partially_paid" ||
            st === "overdue" ||
            st === "unpaid"
          );
        })
        .reduce(
          (s, i) =>
            s +
            Number(
              i.balance_due ??
                Math.max(0, getInvoiceTotal(i) - Number(i.amount_paid || 0))
            ),
          0
        )
    : null;

  const overdueInvoicesList = outstandingInvoicesList.filter((inv) => {
    const st = String(inv.status || "").toLowerCase();
    if (st === "overdue") return true;
    const due = parseRecordDate(inv, ["due_date"]);
    return due ? due.getTime() < referenceNow.getTime() : false;
  });

  const overdueReceivablesAmount = overdueInvoicesList.reduce(
    (s, i) =>
      s +
      Number(
        i.balance_due ??
          Math.max(0, getInvoiceTotal(i) - Number(i.amount_paid || 0))
      ),
    0
  );

  const approvedCurExpenses = curExpenses.filter(isApprovedExpense);
  const approvedPrevExpenses = prevExpenses
    ? prevExpenses.filter(isApprovedExpense)
    : null;

  const expensesIncurredAmount = approvedCurExpenses.reduce(
    (s, e) => s + Number(e.amount || 0) + Number(e.tax_amount || 0),
    0
  );
  const prevExpensesIncurredAmount = approvedPrevExpenses
    ? approvedPrevExpenses.reduce(
        (s, e) => s + Number(e.amount || 0) + Number(e.tax_amount || 0),
        0
      )
    : null;

  const paidCurExpenses = approvedCurExpenses.filter((e) => {
    const st = String(e.payment_status || "paid").toLowerCase();
    return st === "paid" || st === "completed" || Boolean(e.paid_at);
  });
  const expensesPaidAmount = paidCurExpenses.reduce(
    (s, e) => s + Number(e.amount || 0) + Number(e.tax_amount || 0),
    0
  );

  const netProfitCashBasis = cashCollectedAmount - expensesIncurredAmount;
  const prevNetProfitCashBasis =
    prevCashCollectedAmount !== null && prevExpensesIncurredAmount !== null
      ? prevCashCollectedAmount - prevExpensesIncurredAmount
      : null;

  const netProfitMarginPct =
    cashCollectedAmount > 0
      ? (netProfitCashBasis / cashCollectedAmount) * 100
      : null;
  const prevNetProfitMarginPct =
    prevCashCollectedAmount !== null &&
    prevCashCollectedAmount > 0 &&
    prevNetProfitCashBasis !== null
      ? (prevNetProfitCashBasis / prevCashCollectedAmount) * 100
      : null;

  const collectionEfficiencyPct =
    invoicesIssuedAmount > 0
      ? (cashCollectedAmount / invoicesIssuedAmount) * 100
      : null;
  const prevCollectionEfficiencyPct =
    prevInvoicesIssuedAmount !== null &&
    prevInvoicesIssuedAmount > 0 &&
    prevCashCollectedAmount !== null
      ? (prevCashCollectedAmount / prevInvoicesIssuedAmount) * 100
      : null;

  // CRM & Lead Cohort Aggregations
  const convertedCurLeads = curLeads.filter(isConvertedLead);
  const convertedPrevLeads = prevLeads
    ? prevLeads.filter(isConvertedLead)
    : null;
  const qualifiedCurLeads = curLeads.filter(isQualifiedLead);

  const leadConversionRatePct =
    curLeads.length > 0 ? (convertedCurLeads.length / curLeads.length) * 100 : 0;
  const prevLeadConversionRatePct =
    prevLeads && prevLeads.length > 0 && convertedPrevLeads
      ? (convertedPrevLeads.length / prevLeads.length) * 100
      : null;

  // Service Delivery & CAC Operations Aggregations
  const completedCurRequests = curServiceRequests.filter(isCompletedRequest);
  const completedPrevRequests = prevServiceRequests
    ? prevServiceRequests.filter(isCompletedRequest)
    : null;
  const pendingCurRequests = curServiceRequests.filter(isPendingRequest);
  const queriedCurRequests = curServiceRequests.filter(isQueriedOrRejectedRequest);

  const serviceCompletionRatePct =
    curServiceRequests.length > 0
      ? (completedCurRequests.length / curServiceRequests.length) * 100
      : null;
  const prevServiceCompletionRatePct =
    prevServiceRequests &&
    prevServiceRequests.length > 0 &&
    completedPrevRequests
      ? (completedPrevRequests.length / prevServiceRequests.length) * 100
      : null;

  const cacStageSummary = summarizeCacStages(curCac);
  const completedCurCac = curCac.filter(isCompletedRequest);
  const pendingCurCac = curCac.filter(isPendingRequest);
  const queriedCurCac = curCac.filter(isQueriedOrRejectedRequest);

  const cacTurnarounds = completedCurCac
    .map((c) => computeTurnaroundDays(c, referenceNow))
    .filter((d): d is number => d !== null);
  const avgCacTurnaroundDays =
    cacTurnarounds.length > 0
      ? cacTurnarounds.reduce((a, b) => a + b, 0) / cacTurnarounds.length
      : 0;
  const medianCacTurnaroundDays = median(cacTurnarounds);

  // Campaign & Referral Authoritative Aggregations (Cumulative Milestone Engine)
  const verifiedCurReferrals = curReferrals.filter(
    (r) =>
      r.payment_verified === true ||
      String(r.verification_status || "").toLowerCase() === "verified" ||
      String(r.verification_status || "").toLowerCase() === "reward_unlocked" ||
      String(r.verification_status || "").toLowerCase() === "paid"
  );
  const pendingVerificationReferrals = curReferrals.filter(
    (r) =>
      !r.payment_verified &&
      String(r.verification_status || "pending").toLowerCase() === "pending"
  );

  // Compute cumulative referral reward liability per referrer using authoritative calculateReferralRewards
  const verifiedCountsByReferrer = new Map<string, number>();
  for (const conv of verifiedCurReferrals) {
    const refId = conv.referrer_id || conv.referrer_code || "unknown";
    verifiedCountsByReferrer.set(
      refId,
      (verifiedCountsByReferrer.get(refId) || 0) + 1
    );
  }
  // Also fallback to referrers.verified_referrals_count if conversion rows aren't populated separately
  if (verifiedCountsByReferrer.size === 0) {
    for (const ref of rawDataset.referrers || []) {
      const vCount = Number(ref.verified_referrals_count || 0);
      if (vCount > 0) {
        verifiedCountsByReferrer.set(ref.id || ref.referral_code, vCount);
      }
    }
  }

  let totalCumulativeReferralRewardsEarned = 0;
  for (const [, count] of verifiedCountsByReferrer.entries()) {
    const calc = calculateReferralMilestoneReward(count);
    totalCumulativeReferralRewardsEarned += calc.totalRewardEarned;
  }

  const paidLedgerEntries = (rawDataset.referralRewardLedger || []).filter(
    (l) => String(l.payout_status || "").toLowerCase() === "paid"
  );
  const totalReferralRewardsPaid = paidLedgerEntries.reduce(
    (s, l) => s + Number(l.reward_amount || 0),
    0
  );
  const totalReferralLiabilityPayable = Math.max(
    0,
    totalCumulativeReferralRewardsEarned - totalReferralRewardsPaid
  );

  const campaignOriginalTotal = curDiscounts.reduce(
    (s, d) => s + Number(d.original_price || 0),
    0
  );
  const campaignNetRevenue = curDiscounts.reduce(
    (s, d) => s + Number(d.discounted_price || 0),
    0
  );
  const campaignSavingsGranted = curDiscounts.reduce(
    (s, d) =>
      s +
      Number(
        d.discount_amount ??
          Math.max(0, Number(d.original_price || 0) - Number(d.discounted_price || 0))
      ),
    0
  );

  // HR & Staff Aggregations
  const activeStaffList = scopedStaff.filter((s) => s.is_active !== false);
  const completedTasks = scopedTasks.filter(
    (t) => String(t.status || "").toLowerCase() === "completed"
  );
  const overdueTasks = scopedTasks.filter((t) => {
    const st = String(t.status || "").toLowerCase();
    if (st === "completed" || st === "cancelled") return false;
    const due = parseRecordDate(t, ["due_date"]);
    return due ? due.getTime() < referenceNow.getTime() : false;
  });
  const taskCompletionRatePct =
    scopedTasks.length > 0
      ? (completedTasks.length / scopedTasks.length) * 100
      : null;

  // Organisational Health Score
  const revenueGrowthComp = computePeriodComparison(
    cashCollectedAmount,
    prevCashCollectedAmount,
    "NGN"
  );
  const orgHealth = calculateOrganisationalHealth({
    revenueGrowthPct: revenueGrowthComp.percentageChange,
    hasRevenueData:
      verifiedCurPayments.length > 0 || billableCurInvoices.length > 0,
    netProfitMarginPct,
    hasProfitData: cashCollectedAmount > 0 || approvedCurExpenses.length > 0,
    collectionEfficiencyPct,
    overdueSharePct:
      invoicesIssuedAmount > 0
        ? (overdueReceivablesAmount / invoicesIssuedAmount) * 100
        : 0,
    hasReceivablesData: billableCurInvoices.length > 0,
    leadConversionPct: curLeads.length > 0 ? leadConversionRatePct : null,
    newClientsCount: curClients.length,
    hasCrmData: curClients.length > 0 || curLeads.length > 0,
    serviceCompletionPct: serviceCompletionRatePct,
    hasServiceData: curServiceRequests.length > 0,
    cacQueryRatePct:
      curCac.length > 0 ? (queriedCurCac.length / curCac.length) * 100 : null,
    cacAvgTurnaroundDays: cacTurnarounds.length > 0 ? avgCacTurnaroundDays : null,
    hasCacData: curCac.length > 0,
    taskCompletionPct: taskCompletionRatePct,
    overdueTasksCount: overdueTasks.length,
    hasStaffTaskData: scopedTasks.length > 0,
    referralVerificationPct:
      curReferrals.length > 0
        ? (verifiedCurReferrals.length / curReferrals.length) * 100
        : null,
    campaignRegistrationsCount: curDiscounts.length,
    hasCampaignData: curDiscounts.length > 0 || curReferrals.length > 0,
    canViewFinance: canSeeSensitiveFinance,
  });

  // Build Drill-Down Groups (strictly scoped and respecting canSeeDetailedRecords)
  const drillDownGroups: Record<
    string,
    { title: string; route: string; items: DrillDownRecordItem[] }
  > = {};

  if (canSeeDetailedRecords) {
    if (canSeeSensitiveFinance) {
      drillDownGroups.invoices = {
        title: "Issued & Outstanding Invoices",
        route: "/admin/invoices",
        items: billableCurInvoices.slice(0, 25).map((inv) => ({
          id: String(inv.id),
          reference: inv.invoice_number || `INV-${String(inv.id).slice(0, 6)}`,
          title:
            inv.client_name ||
            clientById.get(inv.client_id)?.full_name ||
            clientById.get(inv.client_id)?.company_name ||
            "Client Invoice",
          subtitle: `Status: ${formatBusinessStatusLabel(inv.status || "issued")}`,
          status: formatBusinessStatusLabel(inv.status || "issued"),
          amountOrMetric: formatMetricValue(getInvoiceTotal(inv), "NGN"),
          dateLabel: new Date(
            inv.issue_date || inv.created_at || referenceNow
          ).toLocaleDateString("en-NG"),
          route: "/admin/invoices",
          entityType: "invoice",
        })),
      };

      drillDownGroups.payments = {
        title: "Verified Cash Payments",
        route: "/admin/payments",
        items: verifiedCurPayments.slice(0, 25).map((pay) => ({
          id: String(pay.id),
          reference:
            pay.reference_number ||
            pay.receipt_number ||
            `PAY-${String(pay.id).slice(0, 6)}`,
          title:
            pay.payer_name ||
            clientById.get(pay.client_id)?.full_name ||
            clientById.get(pay.client_id)?.company_name ||
            "Confirmed Payment",
          subtitle: `Method: ${String(pay.payment_method || "bank_transfer").replace(/_/g, " ")}`,
          status: formatBusinessStatusLabel(
            pay.is_verified !== false ? "verified" : "pending_verification"
          ),
          amountOrMetric: formatMetricValue(Number(pay.amount || 0), "NGN"),
          dateLabel: new Date(
            pay.payment_date || pay.created_at || referenceNow
          ).toLocaleDateString("en-NG"),
          route: "/admin/payments",
          entityType: "payment",
        })),
      };

      drillDownGroups.expenses = {
        title: "Operating Expenses",
        route: "/admin/expenses",
        items: approvedCurExpenses.slice(0, 25).map((exp) => ({
          id: String(exp.id),
          reference: exp.expense_number || `EXP-${String(exp.id).slice(0, 6)}`,
          title: exp.title || exp.description || exp.category || "Operating Expense",
          subtitle: `Category: ${exp.category || "General"}`,
          status: formatBusinessStatusLabel(exp.approval_status || "approved"),
          amountOrMetric: formatMetricValue(Number(exp.amount || 0), "NGN"),
          dateLabel: new Date(
            exp.expense_date || exp.created_at || referenceNow
          ).toLocaleDateString("en-NG"),
          route: "/admin/expenses",
          entityType: "expense",
        })),
      };
    }

    drillDownGroups.clients = {
      title: "Client Records",
      route: "/admin/clients",
      items: curClients.slice(0, 25).map((cl) => ({
        id: String(cl.id),
        reference: cl.client_code || `CL-${String(cl.id).slice(0, 6)}`,
        title: cl.full_name || cl.contact_person || cl.company_name || "Client Record",
        subtitle: cl.company_name || cl.source || "Direct Client",
        status: formatBusinessStatusLabel(cl.status || "active"),
        amountOrMetric: cl.client_type || "Corporate/Individual",
        dateLabel: new Date(cl.created_at || referenceNow).toLocaleDateString(
          "en-NG"
        ),
        route: "/admin/clients",
        entityType: "client",
      })),
    };

    drillDownGroups.leads = {
      title: "Lead Pipeline Records",
      route: "/admin/leads",
      items: curLeads.slice(0, 25).map((ld) => ({
        id: String(ld.id),
        reference: `LD-${String(ld.id).slice(0, 6)}`,
        title: ld.full_name || ld.name || ld.business_name || "Lead Enquiry",
        subtitle: `Source: ${ld.source || "Direct"} • Service: ${ld.service_interest || ld.business_type || "General"}`,
        status: formatBusinessStatusLabel(
          ld.qualification_status || (ld.is_converted ? "converted" : "new")
        ),
        amountOrMetric: ld.is_converted ? "Converted" : "In Pipeline",
        dateLabel: new Date(ld.created_at || referenceNow).toLocaleDateString(
          "en-NG"
        ),
        route: "/admin/leads",
        entityType: "lead",
      })),
    };

    drillDownGroups.service_requests = {
      title: "Service Delivery Requests",
      route: "/admin/service-requests",
      items: curServiceRequests.slice(0, 25).map((sr) => ({
        id: String(sr.id),
        reference: sr.request_number || `SR-${String(sr.id).slice(0, 6)}`,
        title: sr.service_name || sr.title || "Service Request",
        subtitle:
          clientById.get(sr.client_id)?.full_name ||
          sr.client_name ||
          "Client Request",
        status: formatBusinessStatusLabel(sr.status || "pending"),
        amountOrMetric: sr.priority ? `Priority: ${sr.priority}` : "Standard",
        dateLabel: new Date(
          sr.submitted_at || sr.created_at || referenceNow
        ).toLocaleDateString("en-NG"),
        route: "/admin/service-requests",
        entityType: "service_request",
      })),
    };

    drillDownGroups.cac_operations = {
      title: "CAC Registration Filings",
      route: "/admin/cac-operations",
      items: curCac.slice(0, 25).map((cac) => ({
        id: String(cac.id),
        reference: cac.rc_number || cac.tracking_code || `CAC-${String(cac.id).slice(0, 6)}`,
        title:
          cac.proposed_name_1 ||
          cac.business_name ||
          "CAC Registration Filing",
        subtitle: `Type: ${String(cac.registration_type || cac.application_type || "incorporation").replace(/_/g, " ")}`,
        status: formatBusinessStatusLabel(
          cac.current_stage || cac.stage || cac.status || "intake"
        ),
        amountOrMetric:
          Number(cac.query_count || 0) > 0
            ? `${cac.query_count} Query(s)`
            : "Clean Filing",
        dateLabel: new Date(
          cac.submission_date || cac.submitted_at || cac.created_at || referenceNow
        ).toLocaleDateString("en-NG"),
        route: "/admin/cac-operations",
        entityType: "cac_registration",
      })),
    };

    drillDownGroups.campaigns = {
      title: "Campaign & Referral Conversions",
      route: "/admin/campaigns",
      items: curDiscounts.slice(0, 25).map((cd) => ({
        id: String(cd.id),
        reference: cd.promo_code || `PRM-${String(cd.id).slice(0, 6)}`,
        title: cd.client_name || cd.service_name || "Campaign Registration",
        subtitle: `${cd.service_name || "Eligible Service"} (${cd.discount_percentage || 0}% Off)`,
        status: formatBusinessStatusLabel(cd.status || "applied"),
        amountOrMetric: formatMetricValue(Number(cd.discounted_price || 0), "NGN"),
        dateLabel: new Date(
          cd.applied_at || cd.created_at || referenceNow
        ).toLocaleDateString("en-NG"),
        route: "/admin/campaigns",
        entityType: "campaign_discount",
      })),
    };
  }

  // Construct Category-Specific KPIs, Charts, Tables, Insights, and Limitations
  const kpis: ReportKpiItem[] = [];
  const charts: ReportChartSpec[] = [];
  const tables: ReportTableSpec[] = [];
  const dataLimitations: string[] = [];

  // Build category-tailored content with report-specific overrides
  if (report.category === "executive") {
    if (canSeeSensitiveFinance) {
      kpis.push(
        {
          id: "kpi_cash_collected",
          metricId: "cash_collected",
          label: "Verified Cash Collected",
          unit: "NGN",
          comparison: computePeriodComparison(
            cashCollectedAmount,
            prevCashCollectedAmount,
            "NGN"
          ),
          tone: "emerald",
          interpretation:
            "Total payments received and confirmed during the selected reporting period (excludes unpaid invoices).",
          isPositiveWhenUp: true,
          drillDownRoute: "/admin/payments",
          drillDownKey: "payments",
        },
        {
          id: "kpi_invoices_issued",
          metricId: "invoices_issued",
          label: "Total Invoices Issued",
          unit: "NGN",
          comparison: computePeriodComparison(
            invoicesIssuedAmount,
            prevInvoicesIssuedAmount,
            "NGN"
          ),
          tone: "navy",
          interpretation: `${billableCurInvoices.length} non-cancelled invoices billed in period.`,
          isPositiveWhenUp: true,
          drillDownRoute: "/admin/invoices",
          drillDownKey: "invoices",
        },
        {
          id: "kpi_expenses_incurred",
          metricId: "expenses_incurred",
          label: "Expenses Paid",
          unit: "NGN",
          comparison: computePeriodComparison(
            expensesIncurredAmount,
            prevExpensesIncurredAmount,
            "NGN"
          ),
          tone: "amber",
          interpretation: `${approvedCurExpenses.length} recorded operating expense entries.`,
          isPositiveWhenUp: false,
          drillDownRoute: "/admin/expenses",
          drillDownKey: "expenses",
        },
        {
          id: "kpi_net_profit",
          metricId: "net_profit",
          label: "Net Operating Profit (Cash Basis)",
          unit: "NGN",
          comparison: computePeriodComparison(
            netProfitCashBasis,
            prevNetProfitCashBasis,
            "NGN"
          ),
          tone: netProfitCashBasis >= 0 ? "emerald" : "rose",
          interpretation:
            netProfitMarginPct !== null
              ? `Net Profit Margin: ${netProfitMarginPct.toFixed(1)}% of confirmed cash received.`
              : "Net Profit Margin: Not Available (no confirmed cash received in this period).",
          isPositiveWhenUp: true,
          drillDownRoute: "/admin/payments",
          drillDownKey: "payments",
        },
        {
          id: "kpi_outstanding_receivables",
          metricId: "outstanding_receivables",
          label: "Outstanding Customer Payments",
          unit: "NGN",
          comparison: computePeriodComparison(
            outstandingReceivablesAmount,
            prevOutstandingAmount,
            "NGN"
          ),
          tone: overdueReceivablesAmount > 0 ? "rose" : "blue",
          interpretation: `${formatMetricValue(overdueReceivablesAmount, "NGN")} across ${overdueInvoicesList.length} overdue invoice(s).`,
          isPositiveWhenUp: false,
          drillDownRoute: "/admin/invoices",
          drillDownKey: "invoices",
        }
      );
    } else {
      dataLimitations.push(
        "Detailed financial revenue, expense, and profit figures are restricted for your role and omitted from this executive view."
      );
    }

    kpis.push(
      {
        id: "kpi_new_clients",
        metricId: "new_clients_acquired",
        label: "New Clients",
        unit: "count",
        comparison: computePeriodComparison(
          curClients.length,
          prevClients ? prevClients.length : null,
          "count"
        ),
        tone: "blue",
        interpretation: `Cohort Lead Conversion Rate: ${leadConversionRatePct.toFixed(1)}% (${convertedCurLeads.length}/${curLeads.length} leads).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/clients",
        drillDownKey: "clients",
      },
      {
        id: "kpi_service_delivery",
        metricId: "service_requests_completed",
        label: "Completed Service Requests",
        unit: "count",
        comparison: computePeriodComparison(
          completedCurRequests.length,
          completedPrevRequests ? completedPrevRequests.length : null,
          "count"
        ),
        tone: "purple",
        interpretation: `${pendingCurRequests.length} in progress in active queue (${(serviceCompletionRatePct ?? 0).toFixed(1)}% completion rate).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/service-requests",
        drillDownKey: "service_requests",
      },
      {
        id: "kpi_cac_filings",
        metricId: "cac_total_applications",
        label: "CAC Filings Processed",
        unit: "count",
        comparison: computePeriodComparison(
          curCac.length,
          prevCac ? prevCac.length : null,
          "count"
        ),
        tone: "navy",
        interpretation: `${cacStageSummary.completed} completed, ${cacStageSummary.approved} approved, ${cacStageSummary.inProgress + cacStageSummary.submitted} in progress/submitted, ${queriedCurCac.length} queried (${cacStageSummary.progressRatePct !== null ? `${cacStageSummary.progressRatePct.toFixed(1)}% progress rate` : "Not Available"}).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/cac-operations",
        drillDownKey: "cac_operations",
      }
    );

    if (orgHealth.overallScore !== null) {
      kpis.push({
        id: "kpi_org_health",
        metricId: "organisational_health_score",
        label: "Organisational Health Score",
        unit: "score",
        comparison: computePeriodComparison(orgHealth.overallScore, null, "score"),
        tone:
          orgHealth.overallScore >= 80
            ? "emerald"
            : orgHealth.overallScore >= 65
            ? "blue"
            : "amber",
        interpretation: `${orgHealth.overallBand} (${orgHealth.evaluatedDimensionsCount}/${orgHealth.totalDimensionsCount} dimensions verified).`,
        isPositiveWhenUp: true,
      });
    }

    // Executive Charts
    charts.push({
      id: "chart_org_health_dimensions",
      title: "Organisational Health Dimension Breakdown",
      subtitle: "Verified 0–100 score across active operational pillars",
      type: "horizontal_bar",
      unit: "score",
      primarySeriesLabel: "Dimension Health Score",
      points: orgHealth.dimensions
        .filter((d) => d.score !== null)
        .map((d) => ({
          label: `${d.name} (${d.weightPercent}%)`,
          value: d.score ?? 0,
          formattedValue: `${d.score}/100 (${d.statusLabel})`,
          color:
            (d.score ?? 0) >= 80
              ? "#059669"
              : (d.score ?? 0) >= 65
              ? "#2563eb"
              : (d.score ?? 0) >= 50
              ? "#d97706"
              : "#dc2626",
        })),
      emptyMessage:
        "Insufficient multi-dimensional data in the selected window to render health scores.",
    });

    if (canSeeSensitiveFinance) {
      charts.push({
        id: "chart_exec_financial_architecture",
        title: "Financial Recognition Architecture (Accrual vs Cash)",
        subtitle:
          "Clear separation between Invoices Issued, Verified Cash Collected, Outstanding Customer Payments, and Expenses Paid",
        type: "bar",
        unit: "NGN",
        primarySeriesLabel: "Current Period (₦)",
        secondarySeriesLabel: "Prior Period (₦)",
        points: [
          {
            label: "Invoices Issued",
            value: invoicesIssuedAmount,
            secondaryValue: prevInvoicesIssuedAmount ?? 0,
            formattedValue: formatMetricValue(invoicesIssuedAmount, "NGN"),
            color: "#1e3a8a",
          },
          {
            label: "Cash Collected",
            value: cashCollectedAmount,
            secondaryValue: prevCashCollectedAmount ?? 0,
            formattedValue: formatMetricValue(cashCollectedAmount, "NGN"),
            color: "#059669",
          },
          {
            label: "Outstanding Payments",
            value: outstandingReceivablesAmount,
            secondaryValue: prevOutstandingAmount ?? 0,
            formattedValue: formatMetricValue(outstandingReceivablesAmount, "NGN"),
            color: "#d97706",
          },
          {
            label: "Expenses Paid",
            value: expensesIncurredAmount,
            secondaryValue: prevExpensesIncurredAmount ?? 0,
            formattedValue: formatMetricValue(expensesIncurredAmount, "NGN"),
            color: "#dc2626",
          },
          {
            label: "Net Cash Profit",
            value: Math.max(0, netProfitCashBasis),
            secondaryValue: Math.max(0, prevNetProfitCashBasis ?? 0),
            formattedValue: formatMetricValue(netProfitCashBasis, "NGN"),
            color: "#0d9488",
          },
        ],
      });
    }

    // Executive Consolidated Pillar Table
    tables.push({
      id: "table_executive_pillars",
      title: "Consolidated Organisational Performance Matrix",
      subtitle: "Cross-departmental performance indicators, baselines, and management status",
      columns: [
        { key: "pillar", header: "Organisational Pillar", align: "left" },
        { key: "metric", header: "Performance Indicator", align: "left" },
        { key: "current", header: "Current Period", align: "right", format: "mono" },
        { key: "previous", header: "Comparison Baseline", align: "right", format: "mono" },
        { key: "variance", header: "Period Change", align: "right", format: "mono" },
        { key: "status", header: "Management Status", align: "center", format: "badge" },
      ],
      rows: [
        ...(canSeeSensitiveFinance
          ? [
              {
                pillar: "Finance — Cash Inflow",
                metric: "Verified Cash Collected",
                current: formatMetricValue(cashCollectedAmount, "NGN"),
                previous: formatMetricValue(prevCashCollectedAmount, "NGN"),
                variance: computePeriodComparison(
                  cashCollectedAmount,
                  prevCashCollectedAmount,
                  "NGN"
                ).formattedPercentage,
                status: cashCollectedAmount > 0 ? "Healthy" : "No Inflow",
              },
              {
                pillar: "Finance — Billing",
                metric: "Billable Invoices Issued",
                current: formatMetricValue(invoicesIssuedAmount, "NGN"),
                previous: formatMetricValue(prevInvoicesIssuedAmount, "NGN"),
                variance: computePeriodComparison(
                  invoicesIssuedAmount,
                  prevInvoicesIssuedAmount,
                  "NGN"
                ).formattedPercentage,
                status: `${billableCurInvoices.length} Invoices`,
              },
              {
                pillar: "Finance — Credit Control",
                metric: "Outstanding Customer Payments (Overdue)",
                current: `${formatMetricValue(outstandingReceivablesAmount, "NGN")} (${formatMetricValue(overdueReceivablesAmount, "NGN")})`,
                previous: formatMetricValue(prevOutstandingAmount, "NGN"),
                variance: `${overdueInvoicesList.length} Overdue`,
                status: overdueInvoicesList.length > 0 ? "Action Required" : "On Track",
              },
              {
                pillar: "Finance — Cost & Profit",
                metric: "Net Operating Profit (Cash Basis)",
                current: formatMetricValue(netProfitCashBasis, "NGN"),
                previous: formatMetricValue(prevNetProfitCashBasis, "NGN"),
                variance:
                  netProfitMarginPct !== null
                    ? `${netProfitMarginPct.toFixed(1)}% Margin`
                    : "Not Available",
                status: netProfitCashBasis >= 0 ? "Surplus" : "Deficit",
              },
            ]
          : []),
        {
          pillar: "CRM & Acquisition",
          metric: "New Clients",
          current: String(curClients.length),
          previous: prevClients ? String(prevClients.length) : "Not Available",
          variance: `${leadConversionRatePct.toFixed(1)}% Lead Conv.`,
          status: curClients.length > 0 ? "Active Growth" : "Monitor",
        },
        {
          pillar: "Service Delivery",
          metric: "Completed vs In-Progress Requests",
          current: `${completedCurRequests.length} Completed / ${pendingCurRequests.length} In Progress`,
          previous: completedPrevRequests
            ? `${completedPrevRequests.length} Completed`
            : "Not Available",
          variance: `${(serviceCompletionRatePct ?? 0).toFixed(1)}% Rate`,
          status:
            (serviceCompletionRatePct ?? 100) >= 70
              ? "Strong"
              : "Backlog Watch",
        },
        {
          pillar: "CAC Operations",
          metric: "CAC Registration Progress & Stage Breakdown",
          current: `${cacStageSummary.completed} Completed | ${cacStageSummary.approved} Approved | ${cacStageSummary.inProgress + cacStageSummary.submitted} In Progress`,
          previous: prevCac ? `${prevCac.length} Filings` : "Not Available",
          variance:
            cacStageSummary.progressRatePct !== null
              ? `${cacStageSummary.progressRatePct.toFixed(1)}% Progress Rate`
              : "Not Available",
          status: queriedCurCac.length === 0 ? "On Track" : "Queries Active",
        },
        {
          pillar: "Marketing & Referrals",
          metric: "Successful Referrals & Campaign Sales",
          current: `${verifiedCurReferrals.length} Referrals | ${curDiscounts.length} Promo Sales`,
          previous: prevReferrals ? `${prevReferrals.length} Referrals` : "Not Available",
          variance: formatMetricValue(totalReferralLiabilityPayable, "NGN") + " Payable",
          status:
            pendingVerificationReferrals.length > 0
              ? `${pendingVerificationReferrals.length} Awaiting Verification`
              : "Confirmed",
        },
      ],
      emptyMessage: "No operational records found for the selected period.",
    });
  } else if (report.category === "financial") {
    // Financial Category KPIs
    kpis.push(
      {
        id: "fin_invoices_issued",
        metricId: "invoices_issued",
        label: "Invoices Issued (Billed)",
        unit: "NGN",
        comparison: computePeriodComparison(
          invoicesIssuedAmount,
          prevInvoicesIssuedAmount,
          "NGN"
        ),
        tone: "navy",
        interpretation: `${billableCurInvoices.length} issued invoices (excludes drafts and cancelled invoices).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/invoices",
        drillDownKey: "invoices",
      },
      {
        id: "fin_cash_collected",
        metricId: "cash_collected",
        label: "Verified Cash Collected",
        unit: "NGN",
        comparison: computePeriodComparison(
          cashCollectedAmount,
          prevCashCollectedAmount,
          "NGN"
        ),
        tone: "emerald",
        interpretation: `${verifiedCurPayments.length} confirmed payment receipts (${(collectionEfficiencyPct ?? 0).toFixed(1)}% collection rate).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/payments",
        drillDownKey: "payments",
      },
      {
        id: "fin_outstanding_ar",
        metricId: "outstanding_receivables",
        label: "Outstanding Customer Payments",
        unit: "NGN",
        comparison: computePeriodComparison(
          outstandingReceivablesAmount,
          prevOutstandingAmount,
          "NGN"
        ),
        tone: "amber",
        interpretation: `Unpaid customer balances across ${outstandingInvoicesList.length} open invoices.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/invoices",
        drillDownKey: "invoices",
      },
      {
        id: "fin_overdue_ar",
        metricId: "overdue_receivables",
        label: "Overdue Customer Payments",
        unit: "NGN",
        comparison: computePeriodComparison(overdueReceivablesAmount, null, "NGN"),
        tone: overdueReceivablesAmount > 0 ? "rose" : "slate",
        interpretation: `${overdueInvoicesList.length} invoice(s) past their payment due date requiring credit follow-up.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/invoices",
        drillDownKey: "invoices",
      },
      {
        id: "fin_expenses_incurred",
        metricId: "expenses_incurred",
        label: "Expenses Paid",
        unit: "NGN",
        comparison: computePeriodComparison(
          expensesIncurredAmount,
          prevExpensesIncurredAmount,
          "NGN"
        ),
        tone: "rose",
        interpretation: `${formatMetricValue(expensesPaidAmount, "NGN")} settled in cash across ${paidCurExpenses.length} vouchers.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/expenses",
        drillDownKey: "expenses",
      },
      {
        id: "fin_net_profit",
        metricId: "net_profit",
        label: "Net Operating Profit (Cash Basis)",
        unit: "NGN",
        comparison: computePeriodComparison(
          netProfitCashBasis,
          prevNetProfitCashBasis,
          "NGN"
        ),
        tone: netProfitCashBasis >= 0 ? "emerald" : "rose",
        interpretation:
          netProfitMarginPct !== null
            ? `Net Profit Margin: ${netProfitMarginPct.toFixed(1)}% (Confirmed cash received minus recorded expenses).`
            : "Net Profit Margin: Not Available (no confirmed cash received in this period).",
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/payments",
        drillDownKey: "payments",
      }
    );

    if (
      report.id === "fin_budget_vs_actual" ||
      report.id === "budget_vs_actual_report"
    ) {
      dataLimitations.push(
        "Formal departmental budget targets are not yet configured in the system. This report compares current period actual performance against prior-period historical baselines."
      );
    }

    // Expense by category breakdown
    const expByCategory = new Map<string, number>();
    for (const exp of approvedCurExpenses) {
      const cat = String(exp.category || "General Operations");
      expByCategory.set(
        cat,
        (expByCategory.get(cat) || 0) +
          Number(exp.amount || 0) +
          Number(exp.tax_amount || 0)
      );
    }

    charts.push(
      {
        id: "chart_fin_cash_vs_accrual",
        title: "Billing, Cash Collection & Expense Comparison",
        subtitle: "Invoices Issued vs Verified Cash Collected vs Expenses Paid",
        type: "comparison_bar",
        unit: "NGN",
        primarySeriesLabel: "Current Period (₦)",
        secondarySeriesLabel: "Comparison Period (₦)",
        points: [
          {
            label: "Invoices Issued",
            value: invoicesIssuedAmount,
            secondaryValue: prevInvoicesIssuedAmount ?? 0,
            formattedValue: formatMetricValue(invoicesIssuedAmount, "NGN"),
            color: "#1e3a8a",
          },
          {
            label: "Cash Collected",
            value: cashCollectedAmount,
            secondaryValue: prevCashCollectedAmount ?? 0,
            formattedValue: formatMetricValue(cashCollectedAmount, "NGN"),
            color: "#059669",
          },
          {
            label: "Outstanding Payments",
            value: outstandingReceivablesAmount,
            secondaryValue: prevOutstandingAmount ?? 0,
            formattedValue: formatMetricValue(outstandingReceivablesAmount, "NGN"),
            color: "#d97706",
          },
          {
            label: "Overdue Payments",
            value: overdueReceivablesAmount,
            secondaryValue: 0,
            formattedValue: formatMetricValue(overdueReceivablesAmount, "NGN"),
            color: "#dc2626",
          },
          {
            label: "Expenses Paid",
            value: expensesIncurredAmount,
            secondaryValue: prevExpensesIncurredAmount ?? 0,
            formattedValue: formatMetricValue(expensesIncurredAmount, "NGN"),
            color: "#e11d48",
          },
        ],
      },
      {
        id: "chart_fin_expense_categories",
        title: "Operating Expense Distribution by Category",
        subtitle: "Approved expense vouchers grouped by cost centre",
        type: "horizontal_bar",
        unit: "NGN",
        primarySeriesLabel: "Expense Amount (₦)",
        points: Array.from(expByCategory.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => ({
            label: cat,
            value: amt,
            formattedValue: formatMetricValue(amt, "NGN"),
            sharePercent:
              expensesIncurredAmount > 0
                ? (amt / expensesIncurredAmount) * 100
                : 0,
            color: "#dc2626",
          })),
        emptyMessage: "No approved expenses recorded in the selected period.",
      }
    );

    if (canSeeDetailedRecords) {
      tables.push(
        {
          id: "table_fin_invoices",
          title: "Invoice & Customer Receivables Ledger",
          subtitle:
            "Distinguishes total billed amount, confirmed amount paid, and unpaid customer balance",
          drillDownRoute: "/admin/invoices",
          columns: [
            { key: "invoice_number", header: "Invoice #", format: "mono" },
            { key: "client_name", header: "Client" },
            { key: "issue_date", header: "Issue Date", format: "date" },
            { key: "due_date", header: "Due Date", format: "date" },
            {
              key: "total",
              header: "Billed Total",
              align: "right",
              format: "currency_ngn",
            },
            {
              key: "amount_paid",
              header: "Amount Paid",
              align: "right",
              format: "currency_ngn",
            },
            {
              key: "balance_due",
              header: "Balance Due",
              align: "right",
              format: "currency_ngn",
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              format: "badge",
            },
          ],
          rows: billableCurInvoices.map((inv) => {
            const total = getInvoiceTotal(inv);
            const paid = Number(inv.amount_paid || 0);
            const bal = Number(inv.balance_due ?? Math.max(0, total - paid));
            return {
              invoice_number:
                inv.invoice_number || `INV-${String(inv.id).slice(0, 6)}`,
              client_name:
                inv.client_name ||
                clientById.get(inv.client_id)?.full_name ||
                clientById.get(inv.client_id)?.company_name ||
                "Client",
              issue_date: inv.issue_date || inv.created_at || "—",
              due_date: inv.due_date || "—",
              total,
              amount_paid: paid,
              balance_due: bal,
              status: formatBusinessStatusLabel(inv.status || "issued"),
            };
          }),
          totalsRow: {
            invoice_number: "TOTAL",
            client_name: `${billableCurInvoices.length} Invoice(s)`,
            issue_date: "",
            due_date: "",
            total: invoicesIssuedAmount,
            amount_paid: billableCurInvoices.reduce(
              (s, i) => s + Number(i.amount_paid || 0),
              0
            ),
            balance_due: outstandingReceivablesAmount,
            status: "",
          },
          emptyMessage: "No billable invoices found in the selected period.",
        },
        {
          id: "table_fin_payments",
          title: "Verified Cash Collection Register",
          subtitle:
            "Confirmed customer payment receipts recorded during the selected period",
          drillDownRoute: "/admin/payments",
          columns: [
            { key: "reference", header: "Reference #", format: "mono" },
            { key: "payer", header: "Client / Payer" },
            { key: "method", header: "Payment Method" },
            { key: "date", header: "Payment Date", format: "date" },
            {
              key: "amount",
              header: "Cash Collected",
              align: "right",
              format: "currency_ngn",
            },
            {
              key: "status",
              header: "Confirmation Status",
              align: "center",
              format: "badge",
            },
          ],
          rows: verifiedCurPayments.map((p) => ({
            reference:
              p.reference_number ||
              p.receipt_number ||
              `PAY-${String(p.id).slice(0, 6)}`,
            payer:
              p.payer_name ||
              clientById.get(p.client_id)?.full_name ||
              clientById.get(p.client_id)?.company_name ||
              "Client Payment",
            method: String(p.payment_method || "bank_transfer").replace(
              /_/g,
              " "
            ),
            date: p.payment_date || p.created_at || "—",
            amount: Number(p.amount || 0),
            status: formatBusinessStatusLabel(
              p.is_verified !== false ? "verified" : "pending_verification"
            ),
          })),
          totalsRow: {
            reference: "TOTAL",
            payer: `${verifiedCurPayments.length} Confirmed Receipt(s)`,
            method: "",
            date: "",
            amount: cashCollectedAmount,
            status: "",
          },
          emptyMessage: "No confirmed payments recorded in the selected period.",
        }
      );
    }
  } else if (report.category === "crm") {
    kpis.push(
      {
        id: "crm_new_clients",
        metricId: "new_clients_acquired",
        label: "New Clients",
        unit: "count",
        comparison: computePeriodComparison(
          curClients.length,
          prevClients ? prevClients.length : null,
          "count"
        ),
        tone: "emerald",
        interpretation: `Total active directory: ${scopedClients.length} client profiles.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/clients",
        drillDownKey: "clients",
      },
      {
        id: "crm_total_leads",
        metricId: "total_leads",
        label: "Leads Captured",
        unit: "count",
        comparison: computePeriodComparison(
          curLeads.length,
          prevLeads ? prevLeads.length : null,
          "count"
        ),
        tone: "navy",
        interpretation: `${qualifiedCurLeads.length} qualified leads in the current cohort.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/leads",
        drillDownKey: "leads",
      },
      {
        id: "crm_converted_leads",
        metricId: "lead_conversion_rate",
        label: "Cohort Lead Conversion Rate",
        unit: "percentage",
        comparison: computePeriodComparison(
          leadConversionRatePct,
          prevLeadConversionRatePct,
          "percentage"
        ),
        tone: "blue",
        interpretation: `${convertedCurLeads.length} of ${curLeads.length} cohort leads converted to clients.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/leads",
        drillDownKey: "leads",
      },
      {
        id: "crm_unconverted_leads",
        label: "Open / Unconverted Leads",
        unit: "count",
        comparison: computePeriodComparison(
          Math.max(0, curLeads.length - convertedCurLeads.length),
          prevLeads && convertedPrevLeads
            ? Math.max(0, prevLeads.length - convertedPrevLeads.length)
            : null,
          "count"
        ),
        tone: "amber",
        interpretation: "Leads requiring follow-up or qualification closure.",
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/leads",
        drillDownKey: "leads",
      }
    );

    if (
      report.id === "crm_client_retention" ||
      report.id === "client_retention_report"
    ) {
      dataLimitations.push(
        "ABLEBIZ Suite operates primarily on transactional corporate registration and compliance filings rather than recurring subscriptions. Retention is measured via verified repeat service requests per client."
      );
    }

    const bySource = new Map<string, number>();
    for (const l of curLeads) {
      const src = String(l.source || "Direct / Walk-In");
      bySource.set(src, (bySource.get(src) || 0) + 1);
    }
    for (const c of curClients) {
      const src = String(c.source || "Direct / Walk-In");
      if (!bySource.has(src)) bySource.set(src, 0);
    }

    charts.push({
      id: "chart_crm_lead_sources",
      title: "Lead & Client Acquisition by Source Channel",
      subtitle: "Attribution across referral, campaign, website, WhatsApp, and walk-in channels",
      type: "horizontal_bar",
      unit: "count",
      primarySeriesLabel: "Leads Captured",
      points: Array.from(bySource.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([src, cnt]) => ({
          label: src,
          value: cnt,
          formattedValue: `${cnt} Leads`,
          color: "#2563eb",
        })),
      emptyMessage: "No lead source records in the selected period.",
    });

    if (canSeeDetailedRecords) {
      tables.push(
        {
          id: "table_crm_clients",
          title: "Client Acquisition & Directory Register",
          subtitle: "Onboarded clients within the active reporting scope",
          drillDownRoute: "/admin/clients",
          columns: [
            { key: "client_code", header: "Client ID", format: "mono" },
            { key: "name", header: "Client / Company Name" },
            { key: "type", header: "Client Type" },
            { key: "source", header: "Acquisition Source" },
            { key: "created_at", header: "Onboarded Date", format: "date" },
            { key: "status", header: "Status", align: "center", format: "badge" },
          ],
          rows: curClients.map((c) => ({
            client_code: c.client_code || `CL-${String(c.id).slice(0, 6)}`,
            name: c.full_name || c.contact_person || c.company_name || "Client",
            type: c.client_type || "Corporate",
            source: c.source || "Direct",
            created_at: c.created_at || "—",
            status: formatBusinessStatusLabel(c.status || "active"),
          })),
          emptyMessage: "No client records onboarded in the selected period.",
        },
        {
          id: "table_crm_leads",
          title: "Lead Pipeline & Conversion Register",
          subtitle: "Cohort leads and qualification outcomes",
          drillDownRoute: "/admin/leads",
          columns: [
            { key: "name", header: "Lead Name" },
            { key: "service_interest", header: "Service Interest" },
            { key: "source", header: "Source Channel" },
            { key: "created_at", header: "Captured Date", format: "date" },
            {
              key: "status",
              header: "Pipeline Stage",
              align: "center",
              format: "badge",
            },
          ],
          rows: curLeads.map((l) => ({
            name: l.full_name || l.name || l.business_name || "Prospect",
            service_interest:
              l.service_interest || l.business_type || "Corporate Service",
            source: l.source || "Direct",
            created_at: l.created_at || "—",
            status: formatBusinessStatusLabel(
              l.qualification_status || (l.is_converted ? "converted" : "new")
            ),
          })),
          emptyMessage: "No lead records found in the selected period.",
        }
      );
    }
  } else if (report.category === "operations") {
    kpis.push(
      {
        id: "ops_total_requests",
        metricId: "service_requests_total",
        label: "Total Service Requests",
        unit: "count",
        comparison: computePeriodComparison(
          curServiceRequests.length,
          prevServiceRequests ? prevServiceRequests.length : null,
          "count"
        ),
        tone: "navy",
        interpretation: `Scoped to ${effectiveScope} operational records.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/service-requests",
        drillDownKey: "service_requests",
      },
      {
        id: "ops_completed_requests",
        metricId: "service_requests_completed",
        label: "Completed Service Requests",
        unit: "count",
        comparison: computePeriodComparison(
          completedCurRequests.length,
          completedPrevRequests ? completedPrevRequests.length : null,
          "count"
        ),
        tone: "emerald",
        interpretation: `Completion Rate: ${(serviceCompletionRatePct ?? 0).toFixed(1)}% of period requests.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/service-requests",
        drillDownKey: "service_requests",
      },
      {
        id: "ops_pending_requests",
        metricId: "service_requests_pending",
        label: "In-Progress Service Queue",
        unit: "count",
        comparison: computePeriodComparison(
          pendingCurRequests.length,
          null,
          "count"
        ),
        tone: pendingCurRequests.length > 10 ? "amber" : "blue",
        interpretation: `${queriedCurRequests.length} request(s) currently queried or returned.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/service-requests",
        drillDownKey: "service_requests",
      },
      {
        id: "ops_cac_total",
        metricId: "cac_total_applications",
        label: "CAC Registration Filings",
        unit: "count",
        comparison: computePeriodComparison(
          curCac.length,
          prevCac ? prevCac.length : null,
          "count"
        ),
        tone: "purple",
        interpretation: `${cacStageSummary.submitted} submitted, ${cacStageSummary.inProgress} in progress, ${cacStageSummary.approved} approved, ${cacStageSummary.completed} completed, ${cacStageSummary.cancelled + cacStageSummary.rejectedOrQueried} cancelled/rejected.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/cac-operations",
        drillDownKey: "cac_operations",
      },
      {
        id: "ops_cac_progress_rate",
        metricId: "cac_approved_completed",
        label: "CAC Registration Progress Rate",
        unit: "percentage",
        comparison: computePeriodComparison(
          cacStageSummary.progressRatePct ?? 0,
          null,
          "percentage"
        ),
        tone:
          (cacStageSummary.progressRatePct ?? 0) >= 70 ? "emerald" : "blue",
        interpretation: `${cacStageSummary.progressedCount} of ${cacStageSummary.eligibleCount} eligible applications reached Approved (${cacStageSummary.approved}) or Completed (${cacStageSummary.completed}) milestones.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/cac-operations",
        drillDownKey: "cac_operations",
      },
      {
        id: "ops_cac_turnaround",
        metricId: "cac_avg_turnaround_days",
        label: "Avg CAC Turnaround Time",
        unit: "days",
        comparison: computePeriodComparison(avgCacTurnaroundDays, null, "days"),
        tone: avgCacTurnaroundDays <= 7 ? "emerald" : "amber",
        interpretation: `Median Turnaround: ${medianCacTurnaroundDays.toFixed(1)} days across ${cacTurnarounds.length} progressed filings.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/cac-operations",
        drillDownKey: "cac_operations",
      }
    );

    if (
      report.id === "ops_sla_deadlines" ||
      report.id === "sla_and_deadline_report"
    ) {
      dataLimitations.push(
        "Formal per-service SLA target hours are only evaluated where explicit target completion dates or task due dates are recorded on the service request or task; no artificial SLA targets are fabricated."
      );
    }

    const stageDistribution = new Map<string, number>();
    for (const c of curCac) {
      const st = formatBusinessStatusLabel(
        c.current_stage || c.stage || c.status || "intake"
      );
      stageDistribution.set(st, (stageDistribution.get(st) || 0) + 1);
    }
    for (const sr of curServiceRequests) {
      const st = `Service Request: ${formatBusinessStatusLabel(sr.status || "pending")}`;
      stageDistribution.set(st, (stageDistribution.get(st) || 0) + 1);
    }

    charts.push({
      id: "chart_ops_workflow_stages",
      title: "CAC & Service Delivery Workflow Stage Distribution",
      subtitle: "Volume of filings and requests across active operational stages",
      type: "horizontal_bar",
      unit: "count",
      primarySeriesLabel: "Applications / Requests",
      points: Array.from(stageDistribution.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([stage, cnt]) => ({
          label: stage,
          value: cnt,
          formattedValue: `${cnt}`,
          color: "#1e3a8a",
        })),
      emptyMessage: "No CAC or service workflow items in the selected period.",
    });

    if (canSeeDetailedRecords) {
      tables.push(
        {
          id: "table_ops_cac_stage_summary",
          title: "CAC Application Stage Breakdown",
          subtitle:
            "Clearly distinguishes Submitted, In Progress, Approved, Completed, and Cancelled/Rejected CAC applications",
          drillDownRoute: "/admin/cac-operations",
          columns: [
            { key: "stage_group", header: "Application Stage Category" },
            { key: "description", header: "What This Stage Means" },
            {
              key: "count",
              header: "Application Count",
              align: "right",
              format: "number",
            },
            {
              key: "share",
              header: "Share of Total (%)",
              align: "right",
              format: "percentage",
            },
          ],
          rows: [
            {
              stage_group: "Submitted",
              description:
                "Applications formally submitted and awaiting CAC examination",
              count: cacStageSummary.submitted,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.submitted / cacStageSummary.total) * 100
                  : 0,
            },
            {
              stage_group: "In Progress",
              description:
                "Active applications in intake, document verification, name reservation, or CAC review",
              count: cacStageSummary.inProgress,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.inProgress / cacStageSummary.total) * 100
                  : 0,
            },
            {
              stage_group: "Approved (Documents Received)",
              description:
                "Applications approved by CAC or with official documents received, awaiting final handover",
              count: cacStageSummary.approved,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.approved / cacStageSummary.total) * 100
                  : 0,
            },
            {
              stage_group: "Completed",
              description:
                "Applications fully completed and delivered to the client",
              count: cacStageSummary.completed,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.completed / cacStageSummary.total) * 100
                  : 0,
            },
            {
              stage_group: "Queried / Rejected",
              description:
                "Applications returned with official CAC queries or rejected",
              count: cacStageSummary.rejectedOrQueried,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.rejectedOrQueried / cacStageSummary.total) *
                    100
                  : 0,
            },
            {
              stage_group: "Cancelled",
              description:
                "Withdrawn or cancelled applications (excluded from progress rate denominator)",
              count: cacStageSummary.cancelled,
              share:
                cacStageSummary.total > 0
                  ? (cacStageSummary.cancelled / cacStageSummary.total) * 100
                  : 0,
            },
          ],
          emptyMessage: "No CAC applications recorded in the selected period.",
        },
        {
          id: "table_ops_cac",
          title: "CAC Registration Operations Ledger",
          subtitle: "Actual workflow stages, query counts, and processing durations",
          drillDownRoute: "/admin/cac-operations",
          columns: [
            { key: "reference", header: "Tracking / RC #", format: "mono" },
            { key: "business_name", header: "Proposed / Registered Name" },
            { key: "type", header: "Registration Type" },
            { key: "officer", header: "Assigned Officer" },
            { key: "turnaround", header: "Duration (Days)", align: "right", format: "number" },
            { key: "queries", header: "Query Count", align: "center", format: "number" },
            { key: "stage", header: "Workflow Stage", align: "center", format: "badge" },
          ],
          rows: curCac.map((c) => {
            const officer = staffById.get(c.assigned_officer_id || c.assigned_to);
            const days = computeTurnaroundDays(c, referenceNow);
            return {
              reference:
                c.rc_number || c.tracking_code || `CAC-${String(c.id).slice(0, 6)}`,
              business_name:
                c.proposed_name_1 || c.business_name || "CAC Application",
              type: String(
                c.registration_type || c.application_type || "incorporation"
              ).replace(/_/g, " "),
              officer: officer?.full_name || "Unassigned",
              turnaround: days !== null ? Number(days.toFixed(1)) : 0,
              queries: Number(c.query_count || 0),
              stage: formatBusinessStatusLabel(
                c.current_stage || c.stage || c.status || "intake"
              ),
            };
          }),
          emptyMessage: "No CAC registration filings in the selected period.",
        },
        {
          id: "table_ops_service_requests",
          title: "Service Delivery Request Queue",
          subtitle: "Client service requests, assigned officers, and ageing",
          drillDownRoute: "/admin/service-requests",
          columns: [
            { key: "request_number", header: "Request #", format: "mono" },
            { key: "service", header: "Service Title" },
            { key: "client", header: "Client" },
            { key: "officer", header: "Assigned Officer" },
            { key: "age_days", header: "Age (Days)", align: "right", format: "number" },
            { key: "status", header: "Status", align: "center", format: "badge" },
          ],
          rows: curServiceRequests.map((sr) => {
            const officer = staffById.get(sr.assigned_to || sr.assigned_officer_id);
            const days = computeTurnaroundDays(sr, referenceNow);
            return {
              request_number:
                sr.request_number || `SR-${String(sr.id).slice(0, 6)}`,
              service: sr.service_name || sr.title || "Corporate Service",
              client:
                clientById.get(sr.client_id)?.full_name ||
                sr.client_name ||
                "Client",
              officer: officer?.full_name || "Unassigned",
              age_days: days !== null ? Number(days.toFixed(1)) : 0,
              status: formatBusinessStatusLabel(sr.status || "pending"),
            };
          }),
          emptyMessage: "No service requests found in the selected period.",
        }
      );
    }
  } else if (report.category === "hr") {
    kpis.push(
      {
        id: "hr_active_staff",
        metricId: "active_staff_count",
        label: "Active Staff Headcount",
        unit: "count",
        comparison: computePeriodComparison(activeStaffList.length, null, "count"),
        tone: "navy",
        interpretation: `Scoped across ${scopedStaff.length} total staff profiles.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/hr",
      },
      {
        id: "hr_tasks_completed",
        metricId: "staff_task_completion_rate",
        label: "Task Completion Rate",
        unit: "percentage",
        comparison: computePeriodComparison(
          taskCompletionRatePct ?? 0,
          null,
          "percentage"
        ),
        tone: "emerald",
        interpretation: `${completedTasks.length} of ${scopedTasks.length} assigned tasks completed.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/hr",
      },
      {
        id: "hr_overdue_tasks",
        label: "Overdue Staff Tasks",
        unit: "count",
        comparison: computePeriodComparison(overdueTasks.length, null, "count"),
        tone: overdueTasks.length > 0 ? "rose" : "slate",
        interpretation: "Tasks past their due date requiring supervisor review.",
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/hr",
      },
      {
        id: "hr_leave_requests",
        label: "Leave Applications",
        unit: "count",
        comparison: computePeriodComparison(scopedLeaves.length, null, "count"),
        tone: "blue",
        interpretation: `${scopedLeaves.filter((l) => String(l.status || "").toLowerCase() === "approved").length} approved leave request(s).`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/hr",
      }
    );

    if (report.id === "hr_attendance" || report.id === "attendance_report") {
      dataLimitations.push(
        "Biometric or daily clock-in attendance logs are not currently enabled; staff activity is measured using verified leave records, assigned operational workload, and system activity timestamps."
      );
    }

    const workloadByStaff = scopedStaff.map((st) => {
      const stTasks = scopedTasks.filter((t) => t.assigned_to === st.id);
      const stSr = scopedServiceRequests.filter(
        (sr) => sr.assigned_to === st.id || sr.assigned_officer_id === st.id
      );
      const stCac = scopedCacRegistrations.filter(
        (c) => c.assigned_officer_id === st.id || c.assigned_to === st.id
      );
      const completedCount =
        stTasks.filter((t) => t.status === "completed").length +
        stSr.filter(isCompletedRequest).length +
        stCac.filter(isCompletedRequest).length;
      const totalAssigned = stTasks.length + stSr.length + stCac.length;
      return {
        staffId: st.id,
        name: st.full_name || st.email || "Staff Member",
        role: ROLE_CONFIGS[normalizeStaffRole(st.role) || "viewer"]?.title || st.role || "Staff",
        department: st.department || "Operations",
        status: st.approval_status || (st.is_active !== false ? "approved" : "inactive"),
        tasksAssigned: stTasks.length,
        requestsAssigned: stSr.length + stCac.length,
        totalAssigned,
        completedCount,
        completionPct:
          totalAssigned > 0 ? (completedCount / totalAssigned) * 100 : 0,
      };
    });

    charts.push({
      id: "chart_hr_workload",
      title: "Staff Workload & Completion Distribution",
      subtitle: "Transparent count of assigned vs completed items per staff member (no opaque ranking)",
      type: "horizontal_bar",
      unit: "count",
      primarySeriesLabel: "Total Assigned Items",
      secondarySeriesLabel: "Completed Items",
      points: workloadByStaff.slice(0, 12).map((w) => ({
        label: w.name,
        value: w.totalAssigned,
        secondaryValue: w.completedCount,
        formattedValue: `${w.completedCount}/${w.totalAssigned} Completed`,
        color: "#1e3a8a",
      })),
      emptyMessage: "No staff profiles in the selected scope.",
    });

    tables.push({
      id: "table_hr_staff_performance",
      title: "Staff Directory & Transparent Workload Matrix",
      subtitle: canSeeSensitiveHr
        ? "Full administrative HR and operational workload breakdown"
        : "Departmental / personal workload breakdown (sensitive HR fields masked)",
      drillDownRoute: "/admin/hr",
      columns: [
        { key: "name", header: "Staff Name" },
        { key: "role", header: "Canonical Role" },
        { key: "department", header: "Department" },
        {
          key: "tasksAssigned",
          header: "HR Tasks",
          align: "right",
          format: "number",
        },
        {
          key: "requestsAssigned",
          header: "Service / CAC Filings",
          align: "right",
          format: "number",
        },
        {
          key: "completedCount",
          header: "Completed Total",
          align: "right",
          format: "number",
        },
        {
          key: "completionPct",
          header: "Completion Rate",
          align: "right",
          format: "percentage",
        },
      ],
      rows: workloadByStaff,
      emptyMessage: "No staff workload records available.",
    });
  } else if (report.category === "marketing") {
    kpis.push(
      {
        id: "mkt_campaign_registrations",
        metricId: "campaign_discounted_registrations",
        label: "Campaign Discounted Sales",
        unit: "count",
        comparison: computePeriodComparison(
          curDiscounts.length,
          prevDiscounts ? prevDiscounts.length : null,
          "count"
        ),
        tone: "emerald",
        interpretation: `Original Value: ${formatMetricValue(campaignOriginalTotal, "NGN")} | Net Billed: ${formatMetricValue(campaignNetRevenue, "NGN")}.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/campaigns",
        drillDownKey: "campaigns",
      },
      {
        id: "mkt_campaign_revenue",
        metricId: "campaign_revenue_generated",
        label: "Campaign Net Revenue",
        unit: "NGN",
        comparison: computePeriodComparison(campaignNetRevenue, null, "NGN"),
        tone: "navy",
        interpretation: `Promotional Savings Granted: ${formatMetricValue(campaignSavingsGranted, "NGN")}.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/campaigns",
        drillDownKey: "campaigns",
      },
      {
        id: "mkt_verified_referrals",
        metricId: "verified_referrals_count",
        label: "Verified Successful Referrals",
        unit: "count",
        comparison: computePeriodComparison(
          verifiedCurReferrals.length,
          prevReferrals
            ? prevReferrals.filter((r) => r.payment_verified === true).length
            : null,
          "count"
        ),
        tone: "blue",
        interpretation: `${pendingVerificationReferrals.length} unverified referral(s) excluded from reward milestones.`,
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/campaigns",
      },
      {
        id: "mkt_referral_liability",
        metricId: "referral_reward_liability",
        label: "Payable Referral Liability",
        unit: "NGN",
        comparison: computePeriodComparison(
          totalReferralLiabilityPayable,
          null,
          "NGN"
        ),
        tone: totalReferralLiabilityPayable > 0 ? "amber" : "slate",
        interpretation: `Cumulative Earned: ${formatMetricValue(totalCumulativeReferralRewardsEarned, "NGN")} | Paid Out: ${formatMetricValue(totalReferralRewardsPaid, "NGN")}.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/campaigns",
      }
    );

    const byPromoService = new Map<string, { count: number; net: number; savings: number }>();
    for (const d of curDiscounts) {
      const svc = String(d.service_name || d.service_slug || "Campaign Service");
      const cur = byPromoService.get(svc) || { count: 0, net: 0, savings: 0 };
      cur.count += 1;
      cur.net += Number(d.discounted_price || 0);
      cur.savings += Number(
        d.discount_amount ??
          Math.max(0, Number(d.original_price || 0) - Number(d.discounted_price || 0))
      );
      byPromoService.set(svc, cur);
    }

    charts.push({
      id: "chart_mkt_campaign_services",
      title: "Office Opening Campaign Performance by Service",
      subtitle: "Net promotional revenue (₦) across eligible campaign services",
      type: "horizontal_bar",
      unit: "NGN",
      primarySeriesLabel: "Campaign Net Revenue (₦)",
      points: Array.from(byPromoService.entries())
        .sort((a, b) => b[1].net - a[1].net)
        .map(([svc, stats]) => ({
          label: `${svc} (${stats.count})`,
          value: stats.net,
          formattedValue: `${formatMetricValue(stats.net, "NGN")} (${stats.count} sales)`,
          color: "#059669",
        })),
      emptyMessage: "No promotional service redemptions in the selected period.",
    });

    tables.push({
      id: "table_mkt_referrers",
      title: "Referral Programme Cumulative Milestone & Liability Ledger",
      subtitle:
        "Evaluated strictly using cumulative milestone rules (1=₦2,000, 3=₦7,500, 5=₦15,000, 10=₦35,000 + Free Business Name + Gold Partner)",
      drillDownRoute: "/admin/campaigns",
      columns: [
        { key: "code", header: "Referral Code", format: "mono" },
        { key: "name", header: "Participant Name" },
        {
          key: "total_referrals",
          header: "Total Submitted",
          align: "right",
          format: "number",
        },
        {
          key: "verified_referrals",
          header: "Verified Paid",
          align: "right",
          format: "number",
        },
        { key: "tier", header: "Unlocked Milestone Tier" },
        {
          key: "cumulative_reward",
          header: "Cumulative Reward (₦)",
          align: "right",
          format: "currency_ngn",
        },
      ],
      rows: (rawDataset.referrers || []).map((ref) => {
        const verifiedCount = Number(ref.verified_referrals_count || 0);
        const calc = calculateReferralMilestoneReward(verifiedCount);
        const tierLabel =
          calc.milestoneReached >= 10
            ? "Gold Champion (10+)"
            : calc.milestoneReached >= 5
            ? "Silver Milestone (5+)"
            : calc.milestoneReached >= 3
            ? "Bronze Milestone (3+)"
            : calc.milestoneReached >= 1
            ? "Starter Milestone (1+)"
            : "Below Threshold";
        return {
          code: ref.referral_code || "—",
          name: ref.full_name || "Referrer",
          total_referrals: Number(ref.total_referrals_count || verifiedCount),
          verified_referrals: verifiedCount,
          tier: tierLabel,
          cumulative_reward: calc.totalRewardEarned,
        };
      }),
      emptyMessage: "No registered referral participants found.",
    });
  } else if (report.category === "compliance") {
    // Data integrity & financial control exception checks
    const unverifiedPaymentsCount = (rawDataset.payments || []).filter(
      (p) => p.is_verified === false
    ).length;
    const unassignedRequestsCount = scopedServiceRequests.filter(
      (sr) => !sr.assigned_to && !sr.assigned_officer_id
    ).length;
    const pendingStaffApprovals = (rawDataset.staffProfiles || []).filter(
      (s) => String(s.approval_status || "").toLowerCase() === "pending"
    ).length;

    kpis.push(
      {
        id: "comp_audit_events",
        label: "Audit Log Events Recorded",
        unit: "count",
        comparison: computePeriodComparison(curAuditLogs.length, null, "count"),
        tone: "navy",
        interpretation: "Immutable audit trail entries captured in period.",
        isPositiveWhenUp: true,
        drillDownRoute: "/admin/audit-logs",
      },
      {
        id: "comp_pending_approvals",
        label: "Pending Administrative Approvals",
        unit: "count",
        comparison: computePeriodComparison(
          pendingStaffApprovals + pendingVerificationReferrals.length,
          null,
          "count"
        ),
        tone:
          pendingStaffApprovals + pendingVerificationReferrals.length > 0
            ? "amber"
            : "emerald",
        interpretation: `${pendingStaffApprovals} staff onboarding(s) & ${pendingVerificationReferrals.length} referral verification(s).`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/team",
      },
      {
        id: "comp_data_exceptions",
        label: "Operational & Control Exceptions",
        unit: "count",
        comparison: computePeriodComparison(
          unassignedRequestsCount + unverifiedPaymentsCount + queriedCurCac.length,
          null,
          "count"
        ),
        tone:
          unassignedRequestsCount + unverifiedPaymentsCount + queriedCurCac.length >
          0
            ? "rose"
            : "emerald",
        interpretation: `${unassignedRequestsCount} unassigned requests, ${unverifiedPaymentsCount} unverified payments, ${queriedCurCac.length} CAC queries.`,
        isPositiveWhenUp: false,
        drillDownRoute: "/admin/audit-logs",
      }
    );

    const byAction = new Map<string, number>();
    for (const log of curAuditLogs) {
      const act = String(log.action || log.event_type || "system_action");
      byAction.set(act, (byAction.get(act) || 0) + 1);
    }

    charts.push({
      id: "chart_comp_audit_actions",
      title: "Audit Log Activity by Action Type",
      subtitle: "Distribution of administrative and operational events",
      type: "horizontal_bar",
      unit: "count",
      primarySeriesLabel: "Events",
      points: Array.from(byAction.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([act, cnt]) => ({
          label: act.replace(/_/g, " ").toUpperCase(),
          value: cnt,
          formattedValue: `${cnt}`,
          color: "#475569",
        })),
      emptyMessage: "No audit log events recorded in the selected window.",
    });

    if (canSeeDetailedRecords && canSeeSecurityAudit) {
      tables.push({
        id: "table_comp_audit_logs",
        title: "Immutable Security & Governance Audit Trail",
        subtitle: "Recent administrative, role, export, and record-mutation events",
        drillDownRoute: "/admin/audit-logs",
        columns: [
          { key: "created_at", header: "Timestamp", format: "date" },
          { key: "actor", header: "Actor / User" },
          { key: "action", header: "Action", format: "mono" },
          { key: "entity", header: "Target Module / Entity" },
          { key: "summary", header: "Details" },
        ],
        rows: curAuditLogs.slice(0, 50).map((log) => ({
          created_at: log.created_at || "—",
          actor:
            log.actor_name ||
            log.actor_email ||
            staffById.get(log.actor_id || log.user_id)?.full_name ||
            "System / Staff",
          action: String(log.action || "event").toUpperCase(),
          entity: `${log.entity_type || log.table_name || "system"}`,
          summary:
            typeof log.details === "string"
              ? log.details
              : JSON.stringify(log.details || log.metadata || {}).slice(0, 80),
        })),
        emptyMessage: "No audit log entries in the selected period.",
      });
    }
  }

  // Generate Data-Grounded Business Intelligence Insights (Part 6C)
  const insights = buildGroundedInsights({
    reportTitle: report.title,
    periodLabel: periodWindow.label,
    canSeeSensitiveFinance,
    cashCollectedAmount,
    prevCashCollectedAmount,
    invoicesIssuedAmount,
    outstandingReceivablesAmount,
    overdueReceivablesAmount,
    overdueCount: overdueInvoicesList.length,
    expensesIncurredAmount,
    netProfitCashBasis,
    netProfitMarginPct,
    newClientsCount: curClients.length,
    leadsCount: curLeads.length,
    convertedLeadsCount: convertedCurLeads.length,
    leadConversionRatePct,
    serviceTotalCount: curServiceRequests.length,
    serviceCompletedCount: completedCurRequests.length,
    servicePendingCount: pendingCurRequests.length,
    cacTotalCount: curCac.length,
    cacQueriedCount: queriedCurCac.length,
    avgCacTurnaroundDays,
    campaignSalesCount: curDiscounts.length,
    campaignNetRevenue,
    verifiedReferralsCount: verifiedCurReferrals.length,
    pendingReferralsCount: pendingVerificationReferrals.length,
    referralLiabilityPayable: totalReferralLiabilityPayable,
    overdueTasksCount: overdueTasks.length,
  });

  // Build human-readable filter summary
  const filterParts: string[] = [`Period: ${periodWindow.label}`];
  if (filters.comparisonMode !== "none") {
    filterParts.push(`Comparison: ${periodWindow.comparisonLabel}`);
  }
  if (filters.department !== "all") {
    filterParts.push(`Department: ${filters.department}`);
  }
  if (filters.staffId !== "all") {
    filterParts.push(
      `Staff: ${staffById.get(filters.staffId)?.full_name || filters.staffId}`
    );
  }
  if (filters.serviceCategory !== "all") {
    filterParts.push(`Service Category: ${filters.serviceCategory}`);
  }
  if (filters.status !== "all") {
    filterParts.push(`Status: ${filters.status}`);
  }

  const totalSourceRecords =
    curInvoices.length +
    curPayments.length +
    curExpenses.length +
    curClients.length +
    curLeads.length +
    curServiceRequests.length +
    curCac.length +
    curDiscounts.length +
    curReferrals.length;

  const docRandom = Math.floor(1000 + (referenceNow.getTime() % 9000));
  const documentNumber = `ABL-RPT-${referenceNow.getFullYear()}${String(
    referenceNow.getMonth() + 1
  ).padStart(2, "0")}-${docRandom}`;

  return {
    reportId: report.id,
    category: report.category,
    categoryLabel: report.categoryLabel,
    title: report.title,
    subtitle: report.description,
    documentNumber,
    generatedAtIso: referenceNow.toISOString(),
    generatedAtFormatted: referenceNow.toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    generatedBy: {
      staffId: caller.staffId,
      name: caller.fullName || "Authorized Staff",
      role,
      roleTitle: ROLE_CONFIGS[role]?.title || role,
      department: caller.department || ROLE_CONFIGS[role]?.department || "Management",
    },
    scopeApplied: effectiveScope,
    scopeDescription:
      effectiveScope === "organisation"
        ? "Organisation-Wide Authorised Records"
        : effectiveScope === "department"
        ? `Departmental Scope (${caller.department || ROLE_CONFIGS[role]?.department || "Assigned Unit"})`
        : `Personal Scope (Assigned to ${caller.fullName || "Current Officer"})`,
    periodWindow,
    filtersApplied: filters,
    filterSummaryText: filterParts.join(" • "),
    authoritativeSources: report.authoritativeSources,
    totalSourceRecords,
    kpis,
    healthAssessment:
      report.category === "executive" ? orgHealth : undefined,
    charts,
    tables,
    insights,
    dataLimitations,
    metricDefinitionsUsed: getMetricDefinitionsByIds(report.primaryMetrics),
    drillDownGroups,
  };
}

function buildGroundedInsights(ctx: {
  reportTitle: string;
  periodLabel: string;
  canSeeSensitiveFinance: boolean;
  cashCollectedAmount: number;
  prevCashCollectedAmount: number | null;
  invoicesIssuedAmount: number;
  outstandingReceivablesAmount: number;
  overdueReceivablesAmount: number;
  overdueCount: number;
  expensesIncurredAmount: number;
  netProfitCashBasis: number;
  netProfitMarginPct: number | null;
  newClientsCount: number;
  leadsCount: number;
  convertedLeadsCount: number;
  leadConversionRatePct: number;
  serviceTotalCount: number;
  serviceCompletedCount: number;
  servicePendingCount: number;
  cacTotalCount: number;
  cacQueriedCount: number;
  avgCacTurnaroundDays: number;
  campaignSalesCount: number;
  campaignNetRevenue: number;
  verifiedReferralsCount: number;
  pendingReferralsCount: number;
  referralLiabilityPayable: number;
  overdueTasksCount: number;
}): ReportBusinessInsights {
  const keyAchievements: string[] = [];
  const significantChanges: string[] = [];
  const growthOpportunities: string[] = [];
  const decliningPerformance: string[] = [];
  const operationalBottlenecks: string[] = [];
  const financialRisks: string[] = [];
  const areasRequiringAttention: string[] = [];
  const recommendedActions: string[] = [];

  if (ctx.canSeeSensitiveFinance) {
    if (ctx.cashCollectedAmount > 0) {
      keyAchievements.push(
        `Verified cash collections reached ${formatMetricValue(ctx.cashCollectedAmount, "NGN")} against ${formatMetricValue(ctx.invoicesIssuedAmount, "NGN")} in billable invoices issued.`
      );
    }
    if (ctx.netProfitCashBasis > 0 && ctx.netProfitMarginPct !== null) {
      keyAchievements.push(
        `Positive net cash operating surplus of ${formatMetricValue(ctx.netProfitCashBasis, "NGN")} (${ctx.netProfitMarginPct.toFixed(1)}% net margin).`
      );
    } else if (ctx.netProfitCashBasis < 0) {
      financialRisks.push(
        `Operating expenses (${formatMetricValue(ctx.expensesIncurredAmount, "NGN")}) exceeded verified cash inflows (${formatMetricValue(ctx.cashCollectedAmount, "NGN")}), resulting in a cash deficit of ${formatMetricValue(Math.abs(ctx.netProfitCashBasis), "NGN")}.`
      );
      recommendedActions.push(
        "Accelerate collection on issued invoices and review discretionary operating expense vouchers before approval."
      );
    }

    if (ctx.overdueReceivablesAmount > 0) {
      financialRisks.push(
        `${formatMetricValue(ctx.overdueReceivablesAmount, "NGN")} across ${ctx.overdueCount} invoice(s) is past due date (out of ${formatMetricValue(ctx.outstandingReceivablesAmount, "NGN")} total receivables).`
      );
      areasRequiringAttention.push(
        `Follow up on ${ctx.overdueCount} overdue client invoice(s) to convert billed revenue into verified cash.`
      );
      recommendedActions.push(
        "Issue automated payment reminders and require milestone deposit verification prior to final CAC certificate release."
      );
    }

    if (
      ctx.prevCashCollectedAmount !== null &&
      ctx.prevCashCollectedAmount > 0
    ) {
      const diffPct =
        ((ctx.cashCollectedAmount - ctx.prevCashCollectedAmount) /
          ctx.prevCashCollectedAmount) *
        100;
      if (diffPct >= 10) {
        significantChanges.push(
          `Verified cash collection increased by +${diffPct.toFixed(1)}% compared to the prior baseline (${formatMetricValue(ctx.prevCashCollectedAmount, "NGN")}).`
        );
      } else if (diffPct <= -10) {
        decliningPerformance.push(
          `Verified cash collection declined by ${diffPct.toFixed(1)}% relative to the prior period (${formatMetricValue(ctx.prevCashCollectedAmount, "NGN")}).`
        );
      }
    }
  }

  if (ctx.newClientsCount > 0) {
    keyAchievements.push(
      `Onboarded ${ctx.newClientsCount} new client(s) with a ${ctx.leadConversionRatePct.toFixed(1)}% cohort lead conversion rate (${ctx.convertedLeadsCount}/${ctx.leadsCount} leads).`
    );
  }
  if (ctx.leadsCount > ctx.convertedLeadsCount) {
    const unconverted = ctx.leadsCount - ctx.convertedLeadsCount;
    growthOpportunities.push(
      `${unconverted} open lead(s) captured in the period remain unconverted in the CRM pipeline and represent immediate conversion opportunity.`
    );
    recommendedActions.push(
      `Assign client service officers to contact the ${unconverted} unconverted lead(s) within 24 hours.`
    );
  }

  if (ctx.serviceCompletedCount > 0) {
    keyAchievements.push(
      `Completed ${ctx.serviceCompletedCount} of ${ctx.serviceTotalCount} client service requests in the reporting period.`
    );
  }
  if (ctx.servicePendingCount > 5) {
    operationalBottlenecks.push(
      `${ctx.servicePendingCount} service requests remain pending in the active delivery queue.`
    );
    areasRequiringAttention.push(
      "Rebalance pending service request assignments across registration and client service officers."
    );
  }

  if (ctx.cacQueriedCount > 0) {
    operationalBottlenecks.push(
      `${ctx.cacQueriedCount} of ${ctx.cacTotalCount} CAC registration filing(s) received official queries or rejections.`
    );
    recommendedActions.push(
      "Conduct pre-submission document checklists and object-clause reviews to reduce CAC query frequency."
    );
  }

  if (ctx.campaignSalesCount > 0 || ctx.verifiedReferralsCount > 0) {
    growthOpportunities.push(
      `Campaign & Referral channels generated ${ctx.campaignSalesCount} promotional service registration(s) (${formatMetricValue(ctx.campaignNetRevenue, "NGN")}) and ${ctx.verifiedReferralsCount} verified referral(s).`
    );
  }
  if (ctx.pendingReferralsCount > 0) {
    areasRequiringAttention.push(
      `${ctx.pendingReferralsCount} referral conversion(s) are awaiting payment verification before milestone rewards can be unlocked.`
    );
  }
  if (ctx.referralLiabilityPayable > 0 && ctx.canSeeSensitiveFinance) {
    financialRisks.push(
      `Outstanding verified referral reward liability of ${formatMetricValue(ctx.referralLiabilityPayable, "NGN")} is payable to referrers.`
    );
  }

  if (ctx.overdueTasksCount > 0) {
    operationalBottlenecks.push(
      `${ctx.overdueTasksCount} internal staff task(s) are currently past their assigned due date.`
    );
  }

  // Fallbacks when period has minimal activity so sections are never blank or fabricated
  if (keyAchievements.length === 0) {
    keyAchievements.push(
      `No completed revenue or service milestones were recorded inside ${ctx.periodLabel}; expand the period filter (e.g., This Year or All Time) to inspect historical completions.`
    );
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push(
      "Maintain daily verification of payment receipts, monitor CAC filing turnaround times, and review weekly lead conversion rates."
    );
  }

  const executiveNarrative = canSeeSummaryNarrative(ctx);

  return {
    executiveNarrative,
    keyAchievements,
    significantChanges,
    growthOpportunities,
    decliningPerformance,
    operationalBottlenecks,
    financialRisks,
    areasRequiringAttention,
    recommendedActions,
  };
}

function canSeeSummaryNarrative(ctx: {
  reportTitle: string;
  periodLabel: string;
  canSeeSensitiveFinance: boolean;
  cashCollectedAmount: number;
  invoicesIssuedAmount: number;
  outstandingReceivablesAmount: number;
  expensesIncurredAmount: number;
  netProfitCashBasis: number;
  newClientsCount: number;
  leadsCount: number;
  leadConversionRatePct: number;
  serviceCompletedCount: number;
  servicePendingCount: number;
  cacTotalCount: number;
  cacQueriedCount: number;
}): string {
  const parts: string[] = [
    `This ${ctx.reportTitle} evaluates verified ABLEBIZ Suite operational records for ${ctx.periodLabel}.`,
  ];
  if (ctx.canSeeSensitiveFinance) {
    parts.push(
      `During this window, billable invoices issued totalled ${formatMetricValue(ctx.invoicesIssuedAmount, "NGN")}, while verified cash collected totalled ${formatMetricValue(ctx.cashCollectedAmount, "NGN")}, leaving ${formatMetricValue(ctx.outstandingReceivablesAmount, "NGN")} in outstanding receivables. Approved operating expenses stood at ${formatMetricValue(ctx.expensesIncurredAmount, "NGN")}, yielding a net cash operating position of ${formatMetricValue(ctx.netProfitCashBasis, "NGN")}.`
    );
  }
  parts.push(
    `Operationally, ${ctx.newClientsCount} new client(s) were onboarded (${ctx.leadConversionRatePct.toFixed(1)}% cohort lead conversion across ${ctx.leadsCount} leads), ${ctx.serviceCompletedCount} service request(s) were completed (${ctx.servicePendingCount} pending), and ${ctx.cacTotalCount} CAC registration filing(s) were tracked (${ctx.cacQueriedCount} queried).`
  );
  return parts.join(" ");
}

/**
 * Fetches the authorized reporting dataset from Supabase based on the caller's role and permissions.
 */
export async function fetchAuthorizedReportingDataset(
  supabaseClient: any,
  caller: ReportingCallerContext
): Promise<ReportingRawDataset> {
  const dataset = createEmptyReportingDataset();
  dataset.failedSources = [];
  dataset.queryDiagnostics = [];
  const role = normalizeStaffRole(caller.role) || "viewer";
  const profile = getRoleReportAccessProfile(role, caller.hasPermission);

  const safeFetch = async (
    table: string,
    friendlyLabel?: string,
    limit = 1000
  ): Promise<any[]> => {
    try {
      const { data, error } = await supabaseClient
        .from(table)
        .select("*")
        .limit(limit);
      if (error) {
        const msg = String(error.message || "");
        const isMissingOptionalTable =
          msg.includes("does not exist") || msg.includes("schema cache");
        if (friendlyLabel && !isMissingOptionalTable) {
          dataset.failedSources?.push(friendlyLabel);
          dataset.queryDiagnostics?.push(`${friendlyLabel} (${table}): ${msg}`);
        }
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data;
    } catch (err: any) {
      if (friendlyLabel) {
        dataset.failedSources?.push(friendlyLabel);
        dataset.queryDiagnostics?.push(
          `${friendlyLabel} (${table}): ${err?.message || "Unexpected error"}`
        );
      }
      return [];
    }
  };

  const safeFetchWithFallback = async (
    primaryTable: string,
    fallbackTable: string,
    friendlyLabel: string,
    limit = 1000
  ): Promise<any[]> => {
    const primaryData = await safeFetch(primaryTable, friendlyLabel, limit);
    if (primaryData.length > 0) return primaryData;
    return safeFetch(fallbackTable, undefined, limit);
  };

  const tasks: Promise<void>[] = [];

  // Operational & CRM tables accessible to authorized roles
  tasks.push(
    safeFetch("clients", "Client Records").then((r) => {
      dataset.clients = r;
    }),
    safeFetch("leads", "Lead Records").then((r) => {
      dataset.leads = r;
    }),
    safeFetch("businesses").then((r) => {
      dataset.businesses = r;
    }),
    safeFetch("service_requests", "Service Requests").then((r) => {
      dataset.serviceRequests = r;
    }),
    safeFetchWithFallback(
      "cac_applications",
      "cac_registrations",
      "CAC Registration Records"
    ).then((r) => {
      dataset.cacRegistrations = r;
    }),
    safeFetchWithFallback(
      "services_catalog",
      "services",
      "Service Catalogue"
    ).then((r) => {
      dataset.services = r;
    }),
    safeFetch("staff_profiles", "Staff Records").then((r) => {
      dataset.staffProfiles = r;
    }),
    safeFetchWithFallback("tasks", "hr_tasks", "Staff Task Records").then(
      (r) => {
        dataset.hrTasks = r;
      }
    ),
    safeFetchWithFallback(
      "hr_leave_requests",
      "leave_requests",
      "Leave Records"
    ).then((r) => {
      dataset.leaveRequests = r;
    }),
    safeFetch("campaigns").then((r) => {
      dataset.campaigns = r;
    }),
    safeFetch("campaign_discounts").then((r) => {
      dataset.campaignDiscounts = r;
    }),
    safeFetch("referrers").then((r) => {
      dataset.referrers = r;
    }),
    safeFetchWithFallback(
      "referral_events",
      "referral_conversions",
      "Referral Records"
    ).then((r) => {
      dataset.referralConversions = r.map((ev: any) => ({
        ...ev,
        payment_verified:
          ev.payment_verified ?? ev.is_verified === true,
        verification_status:
          ev.verification_status ??
          (ev.is_verified ? "verified" : ev.status || "pending"),
        referrer_code: ev.referrer_code || ev.referral_code,
      }));
    }),
    safeFetchWithFallback(
      "campaign_referral_payouts",
      "referral_reward_ledger",
      "Referral Reward Records"
    ).then((r) => {
      dataset.referralRewardLedger = r.map((p: any) => ({
        ...p,
        payout_status: p.payout_status || p.status || "pending",
        reward_amount:
          p.reward_amount ?? p.total_amount_paid ?? p.cash_reward_earned ?? 0,
      }));
    }),
    safeFetchWithFallback("spin_entries", "spin_the_wheel_entries", "Promotional Spin Entries").then((r) => {
      dataset.spinEntries = r;
    })
  );

  if (profile.canViewSensitiveFinancials) {
    tasks.push(
      safeFetch("invoices", "Invoice Records").then((r) => {
        dataset.invoices = r;
      }),
      safeFetch("payments", "Payment Records").then((r) => {
        dataset.payments = r;
      }),
      safeFetch("expenses", "Expense Records").then((r) => {
        dataset.expenses = r;
      }),
      safeFetch("quotations", "Quotation Records").then((r) => {
        dataset.quotations = r;
      }),
      safeFetch("vendors", "Vendor Records").then((r) => {
        dataset.vendors = r;
      })
    );
  }

  if (profile.canViewSecurityAudit) {
    tasks.push(
      safeFetch("audit_logs", "System Activity Logs", 500).then((r) => {
        dataset.auditLogs = r;
      })
    );
  }

  await Promise.all(tasks);
  return dataset;
}
