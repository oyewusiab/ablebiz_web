export type ExecutivePeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface ExecutiveDashboardFilters {
  period: ExecutivePeriodPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  category: string;
  department: string;
  staffId: string;
}

export interface MetricWithComparison {
  value: number;
  formatted: string;
  priorValue: number | null;
  percentageChange: number | null;
  changeDirection: "positive" | "negative" | "neutral";
  isFavorable: boolean;
  definition: string;
}

export interface FinancialHealthMetrics {
  invoicedRevenue: MetricWithComparison;
  cashCollected: MetricWithComparison;
  verifiedExpenses: MetricWithComparison;
  netCashProfit: MetricWithComparison;
  outstandingReceivables: MetricWithComparison;
  overdueReceivables: MetricWithComparison;
  collectionRate: MetricWithComparison;
  projectedRevenue?: number;
  projectedExpenses?: number;
  revenueByService: { serviceName: string; amount: number; percentage: number }[];
  monthlyCashTrend: { month: string; collected: number; expenses: number; profit: number }[];
  // Phase 19: Receipt-Linked Profitability & Allocations
  totalAllocatedExpenses?: number;
  unallocatedExpenses?: number;
  netReceiptContribution?: number;
  receiptProfitabilityRatio?: number;
}

export interface ClientGrowthMetrics {
  totalActiveClients: MetricWithComparison;
  newClients: MetricWithComparison;
  totalLeads: MetricWithComparison;
  leadConversionRate: MetricWithComparison;
  repeatClients: MetricWithComparison;
  retentionRate?: number | null;
  leadsBySource: { source: string; count: number; percentage: number }[];
  clientsByCategory: { category: string; count: number }[];
}

export interface OperationalHealthMetrics {
  activeServiceRequests: MetricWithComparison;
  activeCacApplications: MetricWithComparison;
  completedRequests: MetricWithComparison;
  overdueTasks: MetricWithComparison;
  slaComplianceRate: MetricWithComparison;
  averageInternalTurnaroundDays: MetricWithComparison;
  awaitingClientDocs: number;
  awaitingStatutoryAuthority: number;
  operationalBottlenecks: { stage: string; count: number; averageDays: number }[];
  requestsByStatus: { status: string; count: number }[];
}

export interface GrowthMarketingMetrics {
  activeCampaigns: number;
  campaignLeads: MetricWithComparison;
  referralLeads: MetricWithComparison;
  referralConversions: MetricWithComparison;
  campaignAttributedRevenue: MetricWithComparison;
  referralRewardsPayable: number;
  topPerformingCampaigns: { name: string; leads: number; conversions: number; revenue: number }[];
}

export interface ServiceQualityMetrics {
  averageCsat: MetricWithComparison;
  npsScore: MetricWithComparison;
  totalFeedbackCount: number;
  activeComplaints: MetricWithComparison;
  overdueComplaints: MetricWithComparison;
  averageResolutionHours: MetricWithComparison;
  verifiedDefects: number;
  hasSufficientSample: boolean; // sample size guardrail (e.g. >= 5 responses)
}

export interface TeamWorkloadMetrics {
  totalActiveStaff: number;
  averageCapacityUtilization: MetricWithComparison;
  overdueTaskDistribution: { staffName: string; overdueCount: number; role: string }[];
  workloadDistribution: { staffName: string; activeTasks: number; capacityPercent: number; role: string }[];
  bottlenecksCount: number;
}

export interface ApprovalsOverviewMetrics {
  pendingApprovalsCount: number;
  awaitingExecutiveAction: number;
  recentlyApprovedCount: number;
  recentlyRejectedCount: number;
  overdueApprovalsCount: number;
  highPriorityPending: {
    id: string;
    referenceNumber: string;
    title: string;
    category: string;
    amount?: number | null;
    requesterName: string;
    dateSubmitted: string;
  }[];
}

export interface ExecutiveDashboardData {
  filters: ExecutiveDashboardFilters;
  calculatedAt: string;
  organizationalHealthScore: {
    score: number | null;
    status: "healthy" | "attention" | "critical" | "insufficient_data";
    dimensionsEvaluated: number;
  };
  financial: FinancialHealthMetrics | null; // null if role is restricted from finance
  clients: ClientGrowthMetrics;
  operations: OperationalHealthMetrics;
  marketing: GrowthMarketingMetrics;
  quality: ServiceQualityMetrics;
  workload: TeamWorkloadMetrics;
  approvals: ApprovalsOverviewMetrics;
  lastRefreshed: string;
}
