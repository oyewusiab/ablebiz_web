import type { MetricDefinition, ReportCategoryId } from "./types";

/**
 * Central Authoritative Metric Definition Registry (Part 7)
 * Defines every major reporting metric across ABLEBIZ Suite to guarantee
 * mathematical consistency across dashboards, reports, exports, and AI summaries.
 */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // ============================================================================
  // FINANCIAL METRICS
  // ============================================================================
  invoices_issued_total: {
    id: "invoices_issued_total",
    name: "Valid Invoices Issued (Contractual Billing)",
    category: "financial",
    description:
      "Total contractual value of valid client invoices issued within the reporting period. Strictly excludes draft, cancelled, and refunded invoices. Does NOT represent cash collected.",
    calculationFormula:
      "SUM(invoices.total_amount) WHERE status NOT IN ('draft', 'cancelled', 'refunded') AND issue_date IN period",
    authoritativeSource: "public.invoices",
    applicableDateField: "issue_date (fallback: created_at)",
    defaultFilters: "status NOT IN ('draft', 'cancelled', 'refunded')",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Represents contractual billing obligations issued to clients, not actual cash received in the bank.",
  },

  cash_collected_revenue: {
    id: "cash_collected_revenue",
    name: "Verified Cash Collected (Realized Revenue)",
    category: "financial",
    description:
      "Total verified cash inflows received from clients and reconciled against invoices during the reporting period.",
    calculationFormula:
      "SUM(payments.amount) WHERE is_verified = true AND payment_date IN period",
    authoritativeSource: "public.payments",
    applicableDateField: "payment_date (fallback: created_at)",
    defaultFilters: "is_verified = true",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Reflects cash-basis collections verified by finance staff. Unverified payment entries are excluded from realized revenue.",
  },

  recognized_earned_revenue: {
    id: "recognized_earned_revenue",
    name: "Earned Service Revenue (Paid & Partially Paid Billing)",
    category: "financial",
    description:
      "Total paid amount recorded on valid invoices (excluding cancelled/refunded/draft), representing reconciled revenue earned against billed engagements.",
    calculationFormula:
      "SUM(invoices.amount_paid) WHERE status IN ('paid', 'partially_paid', 'sent', 'overdue') AND issue_date IN period",
    authoritativeSource: "public.invoices, public.payments",
    applicableDateField: "issue_date / payment_date",
    defaultFilters: "status NOT IN ('draft', 'cancelled', 'refunded')",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "ABLEBIZ Suite operates cash-and-invoice milestone accounting; full accrual deferred-revenue schedules by percentage-of-completion are approximated via service_requests.progress_percent where linked.",
  },

  outstanding_receivables: {
    id: "outstanding_receivables",
    name: "Outstanding Accounts Receivable",
    category: "financial",
    description:
      "Total unpaid balance remaining on valid issued invoices. Never treated as collected revenue.",
    calculationFormula:
      "SUM(invoices.balance_due) WHERE status NOT IN ('draft', 'paid', 'cancelled', 'refunded') AND balance_due > 0",
    authoritativeSource: "public.invoices",
    applicableDateField: "issue_date",
    defaultFilters: "status IN ('sent', 'partially_paid', 'overdue') AND balance_due > 0",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Synchronized via database trigger trg_recalculate_invoice_payment from verified payment records.",
  },

  overdue_receivables: {
    id: "overdue_receivables",
    name: "Overdue Accounts Receivable",
    category: "financial",
    description:
      "Portion of outstanding invoice balances where the contractual due_date has passed without full settlement.",
    calculationFormula:
      "SUM(invoices.balance_due) WHERE status NOT IN ('draft', 'paid', 'cancelled', 'refunded') AND balance_due > 0 AND due_date < CURRENT_DATE",
    authoritativeSource: "public.invoices",
    applicableDateField: "due_date",
    defaultFilters: "balance_due > 0 AND due_date < now()",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Requires accurate due_date entry at invoice creation (defaults to 7 days after issue_date).",
  },

  recorded_expenses: {
    id: "recorded_expenses",
    name: "Actual Recorded Expenses (Disbursements Paid)",
    category: "financial",
    description:
      "Total verified operational expenses and statutory filing disbursements recorded in the expenses ledger.",
    calculationFormula: "SUM(expenses.amount) WHERE expense_date IN period",
    authoritativeSource: "public.expenses",
    applicableDateField: "expense_date (fallback: created_at)",
    defaultFilters: "amount > 0",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "All rows in public.expenses represent paid disbursements. Unpaid vendor bills/accrued liabilities without an expense entry are not tracked in a separate accounts-payable table.",
  },

  catalog_estimated_cost: {
    id: "catalog_estimated_cost",
    name: "Estimated Direct Service Cost Baseline",
    category: "financial",
    description:
      "Standard internal statutory/direct cost baseline defined in the Services Catalogue or snapshotted on campaign invoice items.",
    calculationFormula:
      "SUM(services_catalog.internal_cost_estimate) across active service requests or invoice_items.direct_cost_snapshot",
    authoritativeSource: "public.services_catalog, public.service_requests, public.invoice_items",
    applicableDateField: "service_requests.created_at",
    defaultFilters: "service_requests.status <> 'cancelled'",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Represents standard cost estimates for budgeting/variance comparison; actual profitability uses public.expenses where recorded.",
  },

  gross_profit: {
    id: "gross_profit",
    name: "Gross Operating Profit",
    category: "financial",
    description:
      "Verified cash collected minus direct statutory and service delivery expenses linked to client engagements.",
    calculationFormula:
      "Cash Collected Revenue - Direct Statutory/Service Expenses (or Total Recorded Expenses when direct/overhead split is not tagged)",
    authoritativeSource: "public.payments, public.expenses",
    applicableDateField: "payment_date / expense_date",
    defaultFilters: "is_verified = true",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Corporate income tax, depreciation, and unrecorded payroll accruals outside public.expenses are not automatically deducted.",
  },

  net_operating_profit: {
    id: "net_operating_profit",
    name: "Net Operating Profit (Cash Basis)",
    category: "financial",
    description:
      "Total verified cash collections minus all recorded statutory and operational expenses in the period.",
    calculationFormula: "Cash Collected Revenue - Total Recorded Expenses",
    authoritativeSource: "public.payments, public.expenses",
    applicableDateField: "payment_date / expense_date",
    defaultFilters: "payments.is_verified = true",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Cash-basis operating margin based on recorded payments and expenses in ABLEBIZ Suite. Excludes unrecorded external bank charges or tax provisions.",
  },

  profit_margin_percent: {
    id: "profit_margin_percent",
    name: "Net Operating Profit Margin (%)",
    category: "financial",
    description:
      "Percentage of verified collected revenue retained after deducting all recorded expenses.",
    calculationFormula: "(Net Operating Profit ÷ Cash Collected Revenue) × 100 (when Cash Collected Revenue > 0)",
    authoritativeSource: "public.payments, public.expenses",
    applicableDateField: "payment_date / expense_date",
    defaultFilters: "Cash Collected Revenue > 0",
    unit: "percentage",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Returns N/A (0%) when Cash Collected Revenue is zero in the selected period to avoid division-by-zero distortion.",
  },

  // ============================================================================
  // CRM & CLIENT METRICS
  // ============================================================================
  total_leads_captured: {
    id: "total_leads_captured",
    name: "Inbound Leads Captured",
    category: "crm",
    description:
      "Total prospective client enquiries captured across consultation forms, checklists, Spin & Win, and partner referrals.",
    calculationFormula: "COUNT(leads.id) WHERE created_at IN period",
    authoritativeSource: "public.leads",
    applicableDateField: "created_at",
    defaultFilters: "All lead records in period",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations: "Includes all inbound lead channels prior to qualification.",
  },

  qualified_leads_count: {
    id: "qualified_leads_count",
    name: "Qualified & Converted Leads",
    category: "crm",
    description:
      "Leads that have progressed to 'qualified' or 'converted' status or have a linked client record.",
    calculationFormula:
      "COUNT(leads.id) WHERE qualification_status IN ('qualified', 'converted') OR is_converted = true OR converted_client_id IS NOT NULL",
    authoritativeSource: "public.leads",
    applicableDateField: "created_at",
    defaultFilters: "qualification_status IN ('qualified', 'converted') OR is_converted = true",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations: "Relies on staff updating lead qualification status or executing Convert Lead.",
  },

  lead_conversion_rate: {
    id: "lead_conversion_rate",
    name: "Lead-to-Client Conversion Rate (%)",
    category: "crm",
    description:
      "Percentage of eligible leads in the reporting cohort that formally converted into paying/registered clients.",
    calculationFormula:
      "(COUNT(leads WHERE is_converted = true OR converted_client_id IS NOT NULL OR qualification_status = 'converted') ÷ COUNT(eligible leads)) × 100",
    authoritativeSource: "public.leads, public.clients",
    applicableDateField: "leads.created_at",
    defaultFilters: "All leads in selected cohort (excluding duplicate test rows)",
    unit: "percentage",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Cohort-based calculation: measures conversion of leads created within the period (unlike dividing all-time clients by leads).",
  },

  new_clients_acquired: {
    id: "new_clients_acquired",
    name: "New Clients Acquired",
    category: "crm",
    description: "Number of new client profiles onboarded in the Client 360° directory during the period.",
    calculationFormula: "COUNT(clients.id) WHERE created_at IN period",
    authoritativeSource: "public.clients",
    applicableDateField: "created_at",
    defaultFilters: "is_active = true",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations: "Includes both converted leads and direct walk-in client creations.",
  },

  repeat_client_engagement_rate: {
    id: "repeat_client_engagement_rate",
    name: "Multi-Service / Repeat Client Rate (%)",
    category: "crm",
    description:
      "Percentage of active clients who have engaged ABLEBIZ for two or more service requests or registered multiple businesses.",
    calculationFormula:
      "(COUNT(clients with >= 2 service_requests OR >= 2 businesses) ÷ COUNT(clients with >= 1 service_request OR business)) × 100",
    authoritativeSource: "public.clients, public.service_requests, public.businesses",
    applicableDateField: "service_requests.created_at",
    defaultFilters: "service_requests.status <> 'cancelled'",
    unit: "percentage",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Measures repeat service engagement rather than subscription churn, as ABLEBIZ provides transactional & annual statutory services rather than recurring monthly subscriptions.",
  },

  // ============================================================================
  // CAC OPERATIONS & SERVICE DELIVERY METRICS
  // ============================================================================
  cac_completion_rate: {
    id: "cac_completion_rate",
    name: "CAC Registration Completion Rate (%)",
    category: "operations",
    description:
      "Percentage of valid CAC filing applications (excluding cancelled) in the cohort that reached 'approved', 'documents_received', or 'completed'.",
    calculationFormula:
      "(COUNT(cac_applications WHERE current_stage IN ('approved', 'documents_received', 'completed')) ÷ COUNT(cac_applications WHERE current_stage <> 'cancelled')) × 100",
    authoritativeSource: "public.cac_applications",
    applicableDateField: "created_at",
    defaultFilters: "current_stage <> 'cancelled'",
    unit: "percentage",
    permissionsRequired: ["operations.view"],
    knownLimitations: "Recent applications submitted near the end of a period may still be in progress.",
  },

  cac_average_turnaround_days: {
    id: "cac_average_turnaround_days",
    name: "Average CAC Filing Turnaround Time (Days)",
    category: "operations",
    description:
      "Mean calendar days elapsed from filing submission/creation to approval/completion for completed or approved CAC applications with valid timestamps.",
    calculationFormula:
      "AVG(COALESCE(approval_date, updated_at) - COALESCE(submission_date, created_at)) in days for completed/approved records",
    authoritativeSource: "public.cac_applications",
    applicableDateField: "created_at / submission_date / approval_date",
    defaultFilters: "current_stage IN ('approved', 'documents_received', 'completed') with valid timestamps",
    unit: "days",
    permissionsRequired: ["operations.view"],
    knownLimitations:
      "Records missing explicit submission_date or approval_date fall back to created_at / updated_at and are flagged in data completeness notes.",
  },

  service_request_completion_rate: {
    id: "service_request_completion_rate",
    name: "Service Request Completion Rate (%)",
    category: "operations",
    description:
      "Percentage of non-cancelled service requests in the period that have been marked 'completed'.",
    calculationFormula:
      "(COUNT(service_requests WHERE status = 'completed') ÷ COUNT(service_requests WHERE status <> 'cancelled')) × 100",
    authoritativeSource: "public.service_requests",
    applicableDateField: "created_at",
    defaultFilters: "status <> 'cancelled'",
    unit: "percentage",
    permissionsRequired: ["operations.view"],
    knownLimitations: "Reflects operational closure in Suite.",
  },

  // ============================================================================
  // STAFF & HR METRICS
  // ============================================================================
  staff_task_completion_rate: {
    id: "staff_task_completion_rate",
    name: "Operational Task Completion Rate (%)",
    category: "hr",
    description:
      "Percentage of assigned non-cancelled operational tasks completed within the reporting period.",
    calculationFormula:
      "(COUNT(tasks WHERE status = 'completed') ÷ COUNT(tasks WHERE status <> 'cancelled')) × 100",
    authoritativeSource: "public.tasks",
    applicableDateField: "created_at",
    defaultFilters: "status <> 'cancelled'",
    unit: "percentage",
    permissionsRequired: ["operations.view", "hr.view"],
    knownLimitations:
      "Measures logged task completion in public.tasks; does not rank staff on unlogged offline work.",
  },

  staff_attendance_rate: {
    id: "staff_attendance_rate",
    name: "Attendance Punctuality & Presence Rate (%)",
    category: "hr",
    description:
      "Percentage of recorded attendance logs where staff status is 'present' or 'remote' (on-time presence).",
    calculationFormula:
      "(COUNT(hr_attendance_records WHERE status IN ('present', 'remote', 'late')) ÷ COUNT(hr_attendance_records)) × 100",
    authoritativeSource: "public.hr_attendance_records",
    applicableDateField: "attendance_date",
    defaultFilters: "All recorded attendance logs in period",
    unit: "percentage",
    permissionsRequired: ["hr.view"],
    knownLimitations:
      "Calculated strictly from logged attendance rows; if attendance logging is not yet populated for a period, reports state 'Insufficient attendance logs'.",
  },

  // ============================================================================
  // MARKETING, CAMPAIGN & REFERRAL METRICS
  // ============================================================================
  verified_successful_referrals: {
    id: "verified_successful_referrals",
    name: "Verified Successful Referrals",
    category: "marketing",
    description:
      "Count of deduplicated referrals strictly verified as 'successful' after meeting all 5 qualification criteria (new customer, eligible service, full payment in window, prior attribution, not cancelled/refunded).",
    calculationFormula:
      "COUNT(DISTINCT deduplicated customer referrals WHERE verification_status = 'successful')",
    authoritativeSource: "public.referral_events, public.campaign_referral_payouts",
    applicableDateField: "created_at",
    defaultFilters: "verification_status = 'successful' (deduplicated per customer)",
    unit: "count",
    permissionsRequired: ["crm.view", "reports.view"],
    knownLimitations:
      "Pending, under_review, disputed, disqualified, and cancelled_refunded referrals are strictly excluded.",
  },

  referral_reward_liability: {
    id: "referral_reward_liability",
    name: "Cumulative Referral Reward Liability (Earned vs Payable)",
    category: "marketing",
    description:
      "Total cumulative milestone rewards earned by referrers based on verified successful referral counts (1=₦2,000; 3=₦7,500; 5=₦15,000; 10=₦35,000 cumulative, never additive).",
    calculationFormula:
      "SUM(ablebiz_calculate_referral_milestone_reward(verified_referrals_per_referrer).totalRewardEarned)",
    authoritativeSource: "public.campaign_referral_payouts, public.referral_events",
    applicableDateField: "created_at",
    defaultFilters: "verification_status = 'successful'",
    unit: "NGN",
    permissionsRequired: ["reports.view"],
    knownLimitations:
      "Milestones are cumulative totals (e.g. reaching 3 referrals yields ₦7,500 total, NOT ₦2,000 + ₦7,500).",
  },

  // ============================================================================
  // ORGANISATIONAL HEALTH METRIC
  // ============================================================================
  organisational_health_score: {
    id: "organisational_health_score",
    name: "Composite Organisational Health Score",
    category: "executive",
    description:
      "Transparent, weighted 0–100 composite index across up to 8 operational, financial, CRM, staffing, and governance dimensions using only verified available data.",
    calculationFormula:
      "SUM(DimensionScore_i × Weight_i) ÷ SUM(Weight_i for dimensions with available data)",
    authoritativeSource:
      "public.invoices, public.payments, public.expenses, public.clients, public.leads, public.service_requests, public.cac_applications, public.tasks, public.documents",
    applicableDateField: "Selected reporting period",
    defaultFilters: "Dimensions without data are excluded from denominator",
    unit: "score",
    permissionsRequired: ["reports.view"],
    knownLimitations:
      "Requires at least 3 dimensions with active data to compute a composite score; otherwise outputs 'Insufficient data for assessment'.",
  },
};

export const METRIC_DEFINITIONS_LIST: MetricDefinition[] = Object.values(METRIC_DEFINITIONS);

export function getMetricDefinitionsByCategory(category?: ReportCategoryId): MetricDefinition[] {
  const all = Object.values(METRIC_DEFINITIONS);
  if (!category) return all;
  return all.filter((m) => m.category === category);
}

const METRIC_ID_ALIASES: Record<string, string> = {
  cash_collected: "cash_collected_revenue",
  invoices_issued: "invoices_issued_total",
  expenses_incurred: "recorded_expenses",
  net_profit: "net_operating_profit",
  net_profit_margin: "profit_margin_percent",
  total_leads: "total_leads_captured",
  cac_avg_turnaround_days: "cac_average_turnaround_days",
  service_completion_rate: "service_request_completion_rate",
  verified_referrals_count: "verified_successful_referrals",
};

export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  const canonical = METRIC_ID_ALIASES[metricId] || metricId;
  return METRIC_DEFINITIONS[canonical] || METRIC_DEFINITIONS[metricId];
}

export function getMetricDefinitionsByIds(metricIds: string[]): MetricDefinition[] {
  if (!Array.isArray(metricIds) || metricIds.length === 0) {
    return Object.values(METRIC_DEFINITIONS).slice(0, 6);
  }
  const found: MetricDefinition[] = [];
  for (const id of metricIds) {
    const def = getMetricDefinition(id);
    if (def) {
      found.push(def);
    }
  }
  return found.length > 0 ? found : Object.values(METRIC_DEFINITIONS).slice(0, 6);
}
