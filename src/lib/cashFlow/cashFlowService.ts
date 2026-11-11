import { supabase } from "../supabaseClient";

export interface ProjectedExpenseRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  expected_payment_date: string;
  recurrence: "none" | "weekly" | "monthly" | "quarterly" | "annually";
  status: "projected" | "confirmed" | "paid" | "cancelled";
  responsible_officer_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  responsible_officer?: { full_name: string };
}

export interface FinancialBudgetRecord {
  id: string;
  period_type: "monthly" | "quarterly" | "annual";
  period_key: string; // e.g. '2026-05'
  category_type: "income" | "expense";
  category_name: string;
  budgeted_amount: number;
  notes?: string | null;
}

export interface BudgetVsActualItem {
  categoryType: "income" | "expense";
  categoryName: string;
  budgetedAmount: number;
  actualAmount: number;
  varianceAmount: number; // For income: Actual - Budget. For expense: Budget - Actual.
  variancePercent: number;
  status: "on_track" | "warning" | "alert";
  statusLabel: string;
}

export interface BudgetVsActualSummary {
  periodKey: string;
  totalBudgetedIncome: number;
  totalActualIncome: number;
  incomeVariance: number;
  totalBudgetedExpense: number;
  totalActualExpense: number;
  expenseVariance: number;
  budgetedNetSurplus: number;
  actualNetSurplus: number;
  surplusVariance: number;
  items: BudgetVsActualItem[];
  insights: string[];
}

export interface ExpectedCollectionItem {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  expectedPaymentDate: string;
  collectionConfidence: "high" | "standard" | "at_risk" | "doubtful";
  isOverdue: boolean;
  notes?: string | null;
  daysRemainingOrOverdue: number;
}

export interface ActiveServiceRequestPipelineItem {
  serviceRequestId: string;
  trackingCode: string;
  serviceId: string;
  serviceName: string;
  clientId: string;
  clientName: string;
  estimatedFee: number;
  targetCompletionDate?: string | null;
  status: string;
}

export interface ForecastPeriodSummary {
  periodKey: string; // e.g. 'Week 1', 'Week 2' or 'May 2026'
  periodLabel: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  expectedCollections: number;
  potentialPipelineRevenue: number;
  totalProjectedInflow: number;
  projectedExpenses: number;
  netCashFlow: number;
  projectedClosingBalance: number;
  hasShortageRisk: boolean;
  shortageDeficit: number;
}

export interface CashFlowScenarioConfig {
  name: "expected" | "conservative" | "optimistic" | "custom";
  label: string;
  collectionRatePercent: number; // e.g. 85
  collectionDelayDays: number; // e.g. 0 or 14
  expenseMultiplierPercent: number; // e.g. 100 or 115
  pipelineConversionRatePercent: number; // e.g. 50
}

export interface CashFlowForecastResult {
  currentCashPosition: number;
  openingBalanceDate: string;
  safeReserveThreshold: number;
  
  // 30, 60, 90, 180 Days Horizons
  horizon30Days: ForecastPeriodSummary;
  horizon60Days: ForecastPeriodSummary;
  horizon90Days: ForecastPeriodSummary;
  horizon180Days: ForecastPeriodSummary;

  // Breakdown periods
  weeklyBreakdown: ForecastPeriodSummary[]; // Next 8 weeks
  monthlyBreakdown: ForecastPeriodSummary[]; // Next 6 months

  // Component collections & pipeline
  expectedCollections: ExpectedCollectionItem[];
  pipelineOpportunities: ActiveServiceRequestPipelineItem[];
  projectedExpenses: ProjectedExpenseRecord[];

  // Scenario comparisons
  scenario: CashFlowScenarioConfig;
  scenarioComparisons: {
    expectedClosingBalance30d: number;
    conservativeClosingBalance30d: number;
    optimisticClosingBalance30d: number;
    expectedClosingBalance90d: number;
    conservativeClosingBalance90d: number;
    optimisticClosingBalance90d: number;
  };

  // Warnings & Alert Banners
  shortageWarnings: Array<{
    periodLabel: string;
    projectedClosingBalance: number;
    deficitAmount: number;
    suggestedAction: string;
  }>;
}

export const DEFAULT_SCENARIOS: Record<string, CashFlowScenarioConfig> = {
  expected: {
    name: "expected",
    label: "Expected Scenario (Baseline)",
    collectionRatePercent: 85,
    collectionDelayDays: 0,
    expenseMultiplierPercent: 100,
    pipelineConversionRatePercent: 50,
  },
  conservative: {
    name: "conservative",
    label: "Conservative Scenario (Stress Test)",
    collectionRatePercent: 65,
    collectionDelayDays: 14,
    expenseMultiplierPercent: 115,
    pipelineConversionRatePercent: 15,
  },
  optimistic: {
    name: "optimistic",
    label: "Optimistic Scenario (Growth)",
    collectionRatePercent: 95,
    collectionDelayDays: 0,
    expenseMultiplierPercent: 95,
    pipelineConversionRatePercent: 85,
  },
};

/**
 * Calculates current actual cash position from verified payments received minus actual expenses paid.
 */
export function calculateCurrentCashPosition(
  payments: any[],
  expenses: any[],
  initialReserveBalance: number = 0
): number {
  const verifiedInflows = payments
    .filter((p) => p.is_verified !== false)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const approvedOutflows = expenses
    .filter((e) => (e.status || "").toLowerCase() !== "rejected")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return initialReserveBalance + verifiedInflows - approvedOutflows;
}

/**
 * Generates recurrence occurrences for projected expenses across the forecast horizon.
 */
export function expandRecurringExpenses(
  projectedExpenses: ProjectedExpenseRecord[],
  horizonEndDate: Date
): Array<ProjectedExpenseRecord & { effectiveDate: string }> {
  const expanded: Array<ProjectedExpenseRecord & { effectiveDate: string }> = [];

  for (const exp of projectedExpenses) {
    if (exp.status === "cancelled" || exp.status === "paid") continue;
    const baseDate = new Date(exp.expected_payment_date);
    if (isNaN(baseDate.getTime())) continue;

    // First instance
    if (baseDate <= horizonEndDate) {
      expanded.push({ ...exp, effectiveDate: exp.expected_payment_date });
    }

    if (exp.recurrence === "none") continue;

    // Generate future instances
    let nextDate = new Date(baseDate);
    const maxIterations = 52;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      if (exp.recurrence === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (exp.recurrence === "monthly") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (exp.recurrence === "quarterly") {
        nextDate.setMonth(nextDate.getMonth() + 3);
      } else if (exp.recurrence === "annually") {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      if (nextDate > horizonEndDate) break;

      const dateStr = nextDate.toISOString().split("T")[0];
      expanded.push({
        ...exp,
        id: `${exp.id}_rec_${iteration}`,
        effectiveDate: dateStr,
      });
    }
  }

  return expanded.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
}

/**
 * Computes Cash Flow Forecast across 30, 60, 90, and 180-day horizons.
 */
export function generateCashFlowForecast(params: {
  currentCashPosition: number;
  invoices: any[];
  serviceRequests: any[];
  servicesCatalog: any[];
  projectedExpenses: ProjectedExpenseRecord[];
  scenarioConfig?: CashFlowScenarioConfig;
  safeReserveThreshold?: number;
  referenceNow?: Date;
}): CashFlowForecastResult {
  const {
    currentCashPosition,
    invoices,
    serviceRequests,
    servicesCatalog,
    projectedExpenses,
    scenarioConfig = DEFAULT_SCENARIOS.expected,
    safeReserveThreshold = 500_000, // ₦500k default operational safety cushion
    referenceNow = new Date(),
  } = params;

  const refDateStr = referenceNow.toISOString().split("T")[0];
  const horizon180Date = new Date(referenceNow);
  horizon180Date.setDate(horizon180Date.getDate() + 180);

  // 1. Process Outstanding Invoices for Expected Collections
  // Only invoices with balance_due > 0, status not 'paid' or 'cancelled' or 'draft'
  const expectedCollections: ExpectedCollectionItem[] = [];
  const invoicedServiceRequestIds = new Set<string>();

  for (const inv of invoices) {
    if (inv.service_request_id) {
      invoicedServiceRequestIds.add(inv.service_request_id);
    }
    const status = String(inv.status || "").toLowerCase();
    if (status === "paid" || status === "cancelled" || status === "draft") continue;

    const balanceDue = Number(inv.balance_due || (Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)));
    if (balanceDue <= 0) continue;

    const dueDate = inv.due_date || refDateStr;
    const baseExpectedDate = inv.expected_payment_date || dueDate;
    
    // Apply scenario collection delay
    const effectiveExpectedDateObj = new Date(baseExpectedDate);
    if (scenarioConfig.collectionDelayDays > 0) {
      effectiveExpectedDateObj.setDate(effectiveExpectedDateObj.getDate() + scenarioConfig.collectionDelayDays);
    }
    const effectiveExpectedDate = effectiveExpectedDateObj.toISOString().split("T")[0];

    const diffMs = new Date(dueDate).getTime() - referenceNow.getTime();
    const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = daysDiff < 0 || status === "overdue";

    const confidence = (inv.collection_confidence || (isOverdue ? "at_risk" : "standard")) as any;

    expectedCollections.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      clientId: inv.client_id,
      clientName: inv.client?.full_name || "Client",
      totalAmount: Number(inv.total_amount || 0),
      amountPaid: Number(inv.amount_paid || 0),
      balanceDue,
      dueDate,
      expectedPaymentDate: effectiveExpectedDate,
      collectionConfidence: confidence,
      isOverdue,
      notes: inv.collection_notes || inv.notes,
      daysRemainingOrOverdue: daysDiff,
    });
  }

  // 2. Process Active Service Requests Pipeline
  // Uninvoiced active service requests (status not 'completed', not in invoicedServiceRequestIds)
  const serviceById = new Map<string, any>();
  for (const s of servicesCatalog) {
    serviceById.set(s.id, s);
  }

  const pipelineOpportunities: ActiveServiceRequestPipelineItem[] = [];
  for (const sr of serviceRequests) {
    if (invoicedServiceRequestIds.has(sr.id)) continue; // Avoid double-counting with invoices
    const status = String(sr.status || "").toLowerCase();
    if (status === "completed" || status === "cancelled") continue;

    const svc = serviceById.get(sr.service_id);
    const estimatedFee = Number(svc?.default_fee_ngn || 0);
    if (estimatedFee <= 0) continue;

    pipelineOpportunities.push({
      serviceRequestId: sr.id,
      trackingCode: sr.tracking_code,
      serviceId: sr.service_id,
      serviceName: svc?.name || "Service",
      clientId: sr.client_id,
      clientName: sr.client?.full_name || "Client",
      estimatedFee,
      targetCompletionDate: sr.target_completion_date,
      status: sr.status,
    });
  }

  // 3. Expand Recurring & Projected Expenses
  const expandedExpenses = expandRecurringExpenses(projectedExpenses, horizon180Date);

  // Helper to build a window summary
  const buildWindowSummary = (
    key: string,
    label: string,
    windowStartDate: Date,
    windowEndDate: Date,
    openingBal: number
  ): ForecastPeriodSummary => {
    const startStr = windowStartDate.toISOString().split("T")[0];
    const endStr = windowEndDate.toISOString().split("T")[0];

    // Filter collections in window
    let windowRawCollections = 0;
    for (const item of expectedCollections) {
      if (item.expectedPaymentDate >= startStr && item.expectedPaymentDate <= endStr) {
        // Adjust by confidence & scenario rate
        let confidenceFactor = 1.0;
        if (item.collectionConfidence === "high") confidenceFactor = 1.0;
        else if (item.collectionConfidence === "standard") confidenceFactor = 0.9;
        else if (item.collectionConfidence === "at_risk") confidenceFactor = 0.5;
        else if (item.collectionConfidence === "doubtful") confidenceFactor = 0.2;

        const effectiveCollection = item.balanceDue * confidenceFactor * (scenarioConfig.collectionRatePercent / 100);
        windowRawCollections += effectiveCollection;
      }
    }

    // Filter pipeline revenue in window
    let windowPipelineRevenue = 0;
    for (const pipe of pipelineOpportunities) {
      const date = pipe.targetCompletionDate || endStr;
      if (date >= startStr && date <= endStr) {
        windowPipelineRevenue += pipe.estimatedFee * (scenarioConfig.pipelineConversionRatePercent / 100);
      }
    }

    const totalProjectedInflow = windowRawCollections + windowPipelineRevenue;

    // Filter projected expenses in window
    let windowExpenses = 0;
    for (const exp of expandedExpenses) {
      if (exp.effectiveDate >= startStr && exp.effectiveDate <= endStr) {
        windowExpenses += Number(exp.amount || 0) * (scenarioConfig.expenseMultiplierPercent / 100);
      }
    }

    const netCashFlow = totalProjectedInflow - windowExpenses;
    const projectedClosingBalance = openingBal + netCashFlow;
    const hasShortageRisk = projectedClosingBalance < safeReserveThreshold;
    const shortageDeficit = hasShortageRisk ? Math.max(0, safeReserveThreshold - projectedClosingBalance) : 0;

    return {
      periodKey: key,
      periodLabel: label,
      startDate: startStr,
      endDate: endStr,
      openingBalance: openingBal,
      expectedCollections: Math.round(windowRawCollections),
      potentialPipelineRevenue: Math.round(windowPipelineRevenue),
      totalProjectedInflow: Math.round(totalProjectedInflow),
      projectedExpenses: Math.round(windowExpenses),
      netCashFlow: Math.round(netCashFlow),
      projectedClosingBalance: Math.round(projectedClosingBalance),
      hasShortageRisk,
      shortageDeficit: Math.round(shortageDeficit),
    };
  };

  // Cumulative Horizons: 30, 60, 90, 180 Days
  const d30 = new Date(referenceNow); d30.setDate(d30.getDate() + 30);
  const d60 = new Date(referenceNow); d60.setDate(d60.getDate() + 60);
  const d90 = new Date(referenceNow); d90.setDate(d90.getDate() + 90);
  const d180 = new Date(referenceNow); d180.setDate(d180.getDate() + 180);

  const horizon30Days = buildWindowSummary("30d", "Next 30 Days", referenceNow, d30, currentCashPosition);
  const horizon60Days = buildWindowSummary("60d", "Next 60 Days", referenceNow, d60, currentCashPosition);
  const horizon90Days = buildWindowSummary("90d", "Next 90 Days", referenceNow, d90, currentCashPosition);
  const horizon180Days = buildWindowSummary("180d", "Next 180 Days", referenceNow, d180, currentCashPosition);

  // Weekly Breakdown for Next 8 Weeks (56 Days)
  const weeklyBreakdown: ForecastPeriodSummary[] = [];
  let rollingWeeklyOpening = currentCashPosition;
  for (let w = 0; w < 8; w++) {
    const wStart = new Date(referenceNow);
    wStart.setDate(wStart.getDate() + (w * 7));
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 6);

    const weekSummary = buildWindowSummary(`w_${w + 1}`, `Week ${w + 1}`, wStart, wEnd, rollingWeeklyOpening);
    weeklyBreakdown.push(weekSummary);
    rollingWeeklyOpening = weekSummary.projectedClosingBalance;
  }

  // Monthly Breakdown for Next 6 Months
  const monthlyBreakdown: ForecastPeriodSummary[] = [];
  let rollingMonthlyOpening = currentCashPosition;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let m = 0; m < 6; m++) {
    const mStart = new Date(referenceNow.getFullYear(), referenceNow.getMonth() + m, 1);
    const mEnd = new Date(referenceNow.getFullYear(), referenceNow.getMonth() + m + 1, 0);
    const label = `${monthNames[mStart.getMonth()]} ${mStart.getFullYear()}`;

    const monthSummary = buildWindowSummary(`m_${m + 1}`, label, mStart, mEnd, rollingMonthlyOpening);
    monthlyBreakdown.push(monthSummary);
    rollingMonthlyOpening = monthSummary.projectedClosingBalance;
  }

  // Scenario Comparisons (Expected vs Conservative vs Optimistic)
  const exp30 = buildWindowSummary("exp_30", "30d", referenceNow, d30, currentCashPosition);
  const conParams = { ...params, scenarioConfig: DEFAULT_SCENARIOS.conservative };
  const optParams = { ...params, scenarioConfig: DEFAULT_SCENARIOS.optimistic };

  const conForecast = generateCashFlowForecastDirect(conParams);
  const optForecast = generateCashFlowForecastDirect(optParams);

  // Shortage Warnings across horizons and months
  const shortageWarnings: Array<{
    periodLabel: string;
    projectedClosingBalance: number;
    deficitAmount: number;
    suggestedAction: string;
  }> = [];

  for (const m of monthlyBreakdown) {
    if (m.hasShortageRisk) {
      shortageWarnings.push({
        periodLabel: m.periodLabel,
        projectedClosingBalance: m.projectedClosingBalance,
        deficitAmount: m.shortageDeficit,
        suggestedAction: m.projectedClosingBalance < 0
          ? "CRITICAL: Urgent collection of overdue receivables and deferral of discretionary capital expenditure required."
          : "ADVISORY: Cash reserve dips below safety cushion. Expedite high-value service completion and invoice follow-ups.",
      });
    }
  }

  return {
    currentCashPosition,
    openingBalanceDate: refDateStr,
    safeReserveThreshold,
    horizon30Days,
    horizon60Days,
    horizon90Days,
    horizon180Days,
    weeklyBreakdown,
    monthlyBreakdown,
    expectedCollections: expectedCollections.sort((a, b) => a.expectedPaymentDate.localeCompare(b.expectedPaymentDate)),
    pipelineOpportunities,
    projectedExpenses: expandedExpenses,
    scenario: scenarioConfig,
    scenarioComparisons: {
      expectedClosingBalance30d: exp30.projectedClosingBalance,
      conservativeClosingBalance30d: conForecast.horizon30Days.projectedClosingBalance,
      optimisticClosingBalance30d: optForecast.horizon30Days.projectedClosingBalance,
      expectedClosingBalance90d: horizon90Days.projectedClosingBalance,
      conservativeClosingBalance90d: conForecast.horizon90Days.projectedClosingBalance,
      optimisticClosingBalance90d: optForecast.horizon90Days.projectedClosingBalance,
    },
    shortageWarnings,
  };
}

// Internal helper to avoid infinite recursion when computing scenario comparisons
function generateCashFlowForecastDirect(params: {
  currentCashPosition: number;
  invoices: any[];
  serviceRequests: any[];
  servicesCatalog: any[];
  projectedExpenses: ProjectedExpenseRecord[];
  scenarioConfig?: CashFlowScenarioConfig;
  safeReserveThreshold?: number;
  referenceNow?: Date;
}): { horizon30Days: ForecastPeriodSummary; horizon90Days: ForecastPeriodSummary } {
  const {
    currentCashPosition,
    invoices,
    serviceRequests,
    servicesCatalog,
    projectedExpenses,
    scenarioConfig = DEFAULT_SCENARIOS.expected,
    safeReserveThreshold = 500_000,
    referenceNow = new Date(),
  } = params;

  const refDateStr = referenceNow.toISOString().split("T")[0];
  const horizon180Date = new Date(referenceNow);
  horizon180Date.setDate(horizon180Date.getDate() + 180);

  const invoicedServiceRequestIds = new Set<string>();
  const expectedCollections: ExpectedCollectionItem[] = [];

  for (const inv of invoices) {
    if (inv.service_request_id) invoicedServiceRequestIds.add(inv.service_request_id);
    const status = String(inv.status || "").toLowerCase();
    if (status === "paid" || status === "cancelled" || status === "draft") continue;

    const balanceDue = Number(inv.balance_due || (Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)));
    if (balanceDue <= 0) continue;

    const dueDate = inv.due_date || refDateStr;
    const baseExpectedDate = inv.expected_payment_date || dueDate;
    const effectiveExpectedDateObj = new Date(baseExpectedDate);
    if (scenarioConfig.collectionDelayDays > 0) {
      effectiveExpectedDateObj.setDate(effectiveExpectedDateObj.getDate() + scenarioConfig.collectionDelayDays);
    }
    const effectiveExpectedDate = effectiveExpectedDateObj.toISOString().split("T")[0];
    const isOverdue = new Date(dueDate) < referenceNow;

    expectedCollections.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      clientId: inv.client_id,
      clientName: inv.client?.full_name || "Client",
      totalAmount: Number(inv.total_amount || 0),
      amountPaid: Number(inv.amount_paid || 0),
      balanceDue,
      dueDate,
      expectedPaymentDate: effectiveExpectedDate,
      collectionConfidence: inv.collection_confidence || (isOverdue ? "at_risk" : "standard"),
      isOverdue,
      daysRemainingOrOverdue: 0,
    });
  }

  const serviceById = new Map<string, any>();
  for (const s of servicesCatalog) serviceById.set(s.id, s);

  const pipelineOpportunities: ActiveServiceRequestPipelineItem[] = [];
  for (const sr of serviceRequests) {
    if (invoicedServiceRequestIds.has(sr.id)) continue;
    const status = String(sr.status || "").toLowerCase();
    if (status === "completed" || status === "cancelled") continue;
    const svc = serviceById.get(sr.service_id);
    const estimatedFee = Number(svc?.default_fee_ngn || 0);
    if (estimatedFee > 0) {
      pipelineOpportunities.push({
        serviceRequestId: sr.id,
        trackingCode: sr.tracking_code,
        serviceId: sr.service_id,
        serviceName: svc?.name || "Service",
        clientId: sr.client_id,
        clientName: sr.client?.full_name || "Client",
        estimatedFee,
        targetCompletionDate: sr.target_completion_date,
        status: sr.status,
      });
    }
  }

  const expandedExpenses = expandRecurringExpenses(projectedExpenses, horizon180Date);

  const computeQuickWindow = (days: number): ForecastPeriodSummary => {
    const wEnd = new Date(referenceNow);
    wEnd.setDate(wEnd.getDate() + days);
    const endStr = wEnd.toISOString().split("T")[0];

    let collections = 0;
    for (const item of expectedCollections) {
      if (item.expectedPaymentDate <= endStr) {
        collections += item.balanceDue * (scenarioConfig.collectionRatePercent / 100);
      }
    }

    let pipeline = 0;
    for (const pipe of pipelineOpportunities) {
      if ((pipe.targetCompletionDate || endStr) <= endStr) {
        pipeline += pipe.estimatedFee * (scenarioConfig.pipelineConversionRatePercent / 100);
      }
    }

    let expTotal = 0;
    for (const exp of expandedExpenses) {
      if (exp.effectiveDate <= endStr) {
        expTotal += Number(exp.amount || 0) * (scenarioConfig.expenseMultiplierPercent / 100);
      }
    }

    const net = (collections + pipeline) - expTotal;
    const closing = currentCashPosition + net;

    return {
      periodKey: `${days}d`,
      periodLabel: `Next ${days} Days`,
      startDate: refDateStr,
      endDate: endStr,
      openingBalance: currentCashPosition,
      expectedCollections: Math.round(collections),
      potentialPipelineRevenue: Math.round(pipeline),
      totalProjectedInflow: Math.round(collections + pipeline),
      projectedExpenses: Math.round(expTotal),
      netCashFlow: Math.round(net),
      projectedClosingBalance: Math.round(closing),
      hasShortageRisk: closing < safeReserveThreshold,
      shortageDeficit: Math.max(0, safeReserveThreshold - closing),
    };
  };

  return {
    horizon30Days: computeQuickWindow(30),
    horizon90Days: computeQuickWindow(90),
  };
}

/**
 * Computes Budget-versus-Actual analysis for a specified period (e.g. '2026-05' or '2026')
 */
export function calculateBudgetVsActual(params: {
  periodKey: string;
  budgets: FinancialBudgetRecord[];
  payments: any[];
  expenses: any[];
}): BudgetVsActualSummary {
  const { periodKey, budgets, payments, expenses } = params;

  // Filter budgets for this period
  const periodBudgets = budgets.filter((b) => b.period_key === periodKey);

  // Actual income for period (payments verified in period)
  const periodPayments = payments.filter((p) => {
    if (p.is_verified === false) return false;
    const date = p.payment_date || p.created_at;
    return date && date.startsWith(periodKey);
  });

  // Group actual income by method / general
  const actualIncomeTotal = periodPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Actual expenses for period
  const periodExpenses = expenses.filter((e) => {
    if ((e.status || "").toLowerCase() === "rejected") return false;
    const date = e.expense_date || e.created_at;
    return date && date.startsWith(periodKey);
  });

  const actualExpenseByCategory = new Map<string, number>();
  for (const exp of periodExpenses) {
    const cat = exp.category || "General Operational";
    const cur = actualExpenseByCategory.get(cat) || 0;
    actualExpenseByCategory.set(cat, cur + Number(exp.amount || 0));
  }
  const actualExpenseTotal = periodExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const items: BudgetVsActualItem[] = [];

  // Income budgets
  const incomeBudgets = periodBudgets.filter((b) => b.category_type === "income");
  let budgetedIncomeTotal = 0;

  if (incomeBudgets.length > 0) {
    for (const b of incomeBudgets) {
      budgetedIncomeTotal += Number(b.budgeted_amount || 0);
      const actual = actualIncomeTotal; // Standard single revenue line or apportioned
      const variance = actual - Number(b.budgeted_amount || 0);
      const variancePct = Number(b.budgeted_amount || 0) > 0 ? (variance / Number(b.budgeted_amount)) * 100 : 0;
      const status = variance >= 0 ? "on_track" : variancePct > -15 ? "warning" : "alert";

      items.push({
        categoryType: "income",
        categoryName: b.category_name,
        budgetedAmount: Number(b.budgeted_amount),
        actualAmount: actual,
        varianceAmount: variance,
        variancePercent: Number(variancePct.toFixed(1)),
        status,
        statusLabel: variance >= 0 ? "On Target / Exceeded" : "Below Target",
      });
    }
  } else {
    // Default income item if no custom budget set
    items.push({
      categoryType: "income",
      categoryName: "Client Service Revenue",
      budgetedAmount: 0,
      actualAmount: actualIncomeTotal,
      varianceAmount: actualIncomeTotal,
      variancePercent: 100,
      status: "on_track",
      statusLabel: "Actual Recorded",
    });
  }

  // Expense budgets
  const expenseBudgets = periodBudgets.filter((b) => b.category_type === "expense");
  let budgetedExpenseTotal = 0;

  const processedExpenseCategories = new Set<string>();

  for (const b of expenseBudgets) {
    const budgeted = Number(b.budgeted_amount || 0);
    budgetedExpenseTotal += budgeted;
    const actual = actualExpenseByCategory.get(b.category_name) || 0;
    processedExpenseCategories.add(b.category_name);

    // For expense: positive variance means under budget (favorable)
    const variance = budgeted - actual;
    const variancePct = budgeted > 0 ? (variance / budgeted) * 100 : 0;
    const status = actual <= budgeted ? "on_track" : actual <= budgeted * 1.15 ? "warning" : "alert";

    items.push({
      categoryType: "expense",
      categoryName: b.category_name,
      budgetedAmount: budgeted,
      actualAmount: actual,
      varianceAmount: variance,
      variancePercent: Number(variancePct.toFixed(1)),
      status,
      statusLabel: actual <= budgeted ? "Under Budget (Favorable)" : "Over Budget (Attention)",
    });
  }

  // Add actual expense categories that had no budget configured
  for (const [cat, amt] of actualExpenseByCategory.entries()) {
    if (!processedExpenseCategories.has(cat)) {
      items.push({
        categoryType: "expense",
        categoryName: cat,
        budgetedAmount: 0,
        actualAmount: amt,
        varianceAmount: -amt,
        variancePercent: -100,
        status: "warning",
        statusLabel: "Unbudgeted Expense",
      });
    }
  }

  const incomeVariance = actualIncomeTotal - budgetedIncomeTotal;
  const expenseVariance = budgetedExpenseTotal - actualExpenseTotal;
  const budgetedNetSurplus = budgetedIncomeTotal - budgetedExpenseTotal;
  const actualNetSurplus = actualIncomeTotal - actualExpenseTotal;
  const surplusVariance = actualNetSurplus - budgetedNetSurplus;

  const insights: string[] = [];
  if (actualIncomeTotal < budgetedIncomeTotal && budgetedIncomeTotal > 0) {
    insights.push(`Revenue is currently ₦${(budgetedIncomeTotal - actualIncomeTotal).toLocaleString()} below the budgeted target for ${periodKey}.`);
  } else if (actualIncomeTotal >= budgetedIncomeTotal && budgetedIncomeTotal > 0) {
    insights.push(`Revenue exceeded budgeted target by ₦${(actualIncomeTotal - budgetedIncomeTotal).toLocaleString()} (${Number(((actualIncomeTotal / budgetedIncomeTotal) * 100).toFixed(1))} % achieved).`);
  }

  const overBudgetCategories = items.filter((i) => i.categoryType === "expense" && i.status === "alert");
  if (overBudgetCategories.length > 0) {
    const names = overBudgetCategories.map((i) => i.categoryName).join(", ");
    insights.push(`Expenses exceeding budget limits (>15% over): ${names}. Management review recommended.`);
  }

  return {
    periodKey,
    totalBudgetedIncome: budgetedIncomeTotal,
    totalActualIncome: actualIncomeTotal,
    incomeVariance,
    totalBudgetedExpense: budgetedExpenseTotal,
    totalActualExpense: actualExpenseTotal,
    expenseVariance,
    budgetedNetSurplus,
    actualNetSurplus,
    surplusVariance,
    items,
    insights,
  };
}

/**
 * Fetch all finance data needed for Cash Flow Forecasting directly from Supabase
 */
export async function fetchCashFlowDataset(): Promise<{
  payments: any[];
  expenses: any[];
  invoices: any[];
  serviceRequests: any[];
  servicesCatalog: any[];
  projectedExpenses: ProjectedExpenseRecord[];
  budgets: FinancialBudgetRecord[];
}> {
  const [payRes, expRes, invRes, srRes, svcRes, projRes, budRes] = await Promise.all([
    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("invoices").select("*, client:clients(full_name, phone, email)").order("due_date", { ascending: true }),
    supabase.from("service_requests").select("*, client:clients(full_name)").order("created_at", { ascending: false }),
    supabase.from("services_catalog").select("*").order("name"),
    supabase.from("projected_expenses").select("*, responsible_officer:staff_profiles(full_name)").order("expected_payment_date", { ascending: true }),
    supabase.from("financial_budgets").select("*"),
  ]);

  return {
    payments: payRes.data || [],
    expenses: expRes.data || [],
    invoices: invRes.data || [],
    serviceRequests: srRes.data || [],
    servicesCatalog: svcRes.data || [],
    projectedExpenses: projRes.data || [],
    budgets: budRes.data || [],
  };
}
