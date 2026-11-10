import type { MetricDefinition, ReportCategoryId } from "./types";

/**
 * Translates technical database table identifiers into clear business-facing data source labels.
 */
const DATA_SOURCE_LABEL_MAP: Record<string, string> = {
  "public.payments": "Payment Records",
  payments: "Payment Records",
  "public.invoices": "Invoice Records",
  invoices: "Invoice Records",
  "public.invoice_items": "Invoice Line Items",
  invoice_items: "Invoice Line Items",
  "public.quotations": "Quotation Records",
  quotations: "Quotation Records",
  "public.expenses": "Expense Records",
  expenses: "Expense Records",
  "public.vendors": "Vendor Records",
  vendors: "Vendor Records",
  "public.clients": "Client Records",
  clients: "Client Records",
  "public.businesses": "Registered Business Records",
  businesses: "Registered Business Records",
  "public.leads": "Lead Records",
  leads: "Lead Records",
  "public.consultation_requests": "Consultation Requests",
  consultation_requests: "Consultation Requests",
  "public.checklist_submissions": "Checklist Submissions",
  checklist_submissions: "Checklist Submissions",
  "public.service_requests": "Service Requests",
  service_requests: "Service Requests",
  "public.services_catalog": "Service Catalogue",
  services_catalog: "Service Catalogue",
  "public.services": "Service Catalogue",
  services: "Service Catalogue",
  "public.cac_applications": "CAC Registration Records",
  cac_applications: "CAC Registration Records",
  "public.cac_registrations": "CAC Registration Records",
  cac_registrations: "CAC Registration Records",
  "public.staff_profiles": "Staff Records",
  staff_profiles: "Staff Records",
  "public.tasks": "Staff Task Records",
  tasks: "Staff Task Records",
  "public.hr_tasks": "Staff Task Records",
  hr_tasks: "Staff Task Records",
  "public.hr_attendance_records": "Staff Attendance Records",
  hr_attendance_records: "Staff Attendance Records",
  "public.referral_events": "Referral Records",
  referral_events: "Referral Records",
  "public.referral_conversions": "Referral Records",
  referral_conversions: "Referral Records",
  "public.referral_reward_ledger": "Referral Reward Records",
  referral_reward_ledger: "Referral Reward Records",
  "public.campaign_referral_payouts": "Referral Reward Records",
  campaign_referral_payouts: "Referral Reward Records",
  "public.campaign_discounts": "Campaign Discount Records",
  campaign_discounts: "Campaign Discount Records",
  "public.campaigns": "Campaign Records",
  campaigns: "Campaign Records",
  "public.campaign_service_prices": "Campaign Service Pricing",
  campaign_service_prices: "Campaign Service Pricing",
  "public.documents": "Client & Compliance Documents",
  documents: "Client & Compliance Documents",
  "public.audit_logs": "Audit Log Records",
  audit_logs: "Audit Log Records",
  "public.roles_permissions": "Role & Permission Records",
  roles_permissions: "Role & Permission Records",
};

export function formatDataSourceLabel(rawSource?: string | null): string {
  const clean = String(rawSource || "").trim();
  if (!clean) return "System Records";

  const parts = clean
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const mapped = parts.map((part) => {
    const lower = part.toLowerCase();
    if (DATA_SOURCE_LABEL_MAP[lower]) {
      return DATA_SOURCE_LABEL_MAP[lower];
    }
    const withoutSchema = lower.replace(/^public\./, "");
    if (DATA_SOURCE_LABEL_MAP[withoutSchema]) {
      return DATA_SOURCE_LABEL_MAP[withoutSchema];
    }
    return part
      .replace(/^public\./i, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  });

  return Array.from(new Set(mapped)).join(", ");
}

/**
 * Translates raw database status values into readable business labels at the presentation layer
 * without altering underlying database records.
 */
export function formatBusinessStatusLabel(rawStatus?: string | null): string {
  const key = String(rawStatus || "").trim().toLowerCase();
  switch (key) {
    case "verified":
    case "successful":
      return "Confirmed";
    case "unverified":
      return "Awaiting Verification";
    case "pending_verification":
      return "Awaiting Verification";
    case "pending":
      return "Pending";
    case "pending_payment":
      return "Awaiting Payment";
    case "in_progress":
    case "processing":
      return "In Progress";
    case "under_review":
      return "Under Review";
    case "completed":
      return "Completed";
    case "approved":
      return "Approved";
    case "documents_received":
      return "Approved (Documents Received)";
    case "application_submitted":
    case "submitted":
      return "Submitted";
    case "under_cac_review":
      return "In Progress (Under CAC Review)";
    case "new_request":
      return "In Progress (New Request)";
    case "documents_required":
    case "awaiting_client_docs":
    case "awaiting_client":
      return "In Progress (Awaiting Client Documents)";
    case "documents_verified":
      return "In Progress (Documents Verified)";
    case "name_search":
      return "In Progress (Name Search)";
    case "name_reserved":
      return "In Progress (Name Reserved)";
    case "application_prepared":
      return "In Progress (Application Prepared)";
    case "queried":
      return "Queried by CAC";
    case "rejected":
      return "Rejected / Returned";
    case "cancelled":
      return "Cancelled";
    case "cancelled_refunded":
      return "Cancelled / Refunded";
    case "refunded":
      return "Refunded";
    case "paid":
      return "Paid";
    case "partially_paid":
      return "Partially Paid";
    case "unpaid":
    case "sent":
      return "Unpaid";
    case "overdue":
      return "Overdue";
    case "draft":
      return "Draft";
    case "qualified":
      return "Qualified";
    case "converted":
      return "Converted";
    case "disqualified":
      return "Disqualified";
    case "disputed":
      return "Under Dispute";
    case "payable":
      return "Ready for Payout";
    case "on_hold":
      return "On Hold";
    case "insufficient_data":
      return "Insufficient Data";
    case "query_failed":
      return "Unable to Retrieve Data";
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    default:
      if (!key) return "Not Available";
      return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

/**
 * Central Authoritative Metric Definition Registry
 * Written in clear, plain business language so executives, managers, and staff
 * can understand how every figure is calculated and where it comes from.
 */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // ============================================================================
  // FINANCIAL METRICS
  // ============================================================================
  invoices_issued_total: {
    id: "invoices_issued_total",
    name: "Invoices Issued",
    category: "financial",
    description:
      "Total value of valid customer invoices issued during the selected reporting period. Excludes draft, cancelled, and refunded invoices.",
    calculationFormula:
      "Adds together the total billed amount on all valid invoices issued during the selected period.",
    authoritativeSource: "Invoice Records",
    applicableDateField: "Invoice Issue Date",
    defaultFilters: "Valid issued invoices only (excludes draft, cancelled, and refunded invoices)",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Shows total customer billing issued during the period, not cash already received in the bank.",
  },

  cash_collected_revenue: {
    id: "cash_collected_revenue",
    name: "Verified Cash Collected",
    category: "financial",
    description:
      "Total payments received and confirmed during the selected reporting period.",
    calculationFormula:
      "Adds together all confirmed payments received during the selected period.",
    authoritativeSource: "Payment Records",
    applicableDateField: "Payment Date",
    defaultFilters: "Confirmed customer payments only",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Includes only payments that have been confirmed by Finance. Unconfirmed payment entries are listed separately until verified.",
  },

  recognized_earned_revenue: {
    id: "recognized_earned_revenue",
    name: "Earned Service Revenue",
    category: "financial",
    description:
      "Total payments recorded against valid customer invoices issued during the reporting period.",
    calculationFormula:
      "Adds together the paid portion of all valid customer invoices for the selected period.",
    authoritativeSource: "Invoice and Payment Records",
    applicableDateField: "Invoice Issue Date and Payment Date",
    defaultFilters: "Valid active and paid invoices (excludes draft, cancelled, and refunded invoices)",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Reflects payments matched to valid customer invoices in ABLEBIZ Suite.",
  },

  outstanding_receivables: {
    id: "outstanding_receivables",
    name: "Outstanding Customer Payments",
    category: "financial",
    description:
      "Total unpaid balances customers still owe ABLEBIZ.",
    calculationFormula:
      "Adds together the remaining balances on valid unpaid invoices.",
    authoritativeSource: "Invoice Records",
    applicableDateField: "Invoice Issue Date",
    defaultFilters: "Unpaid and partially paid valid invoices with an outstanding balance",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Outstanding balances are never counted as cash collected until payment is received and confirmed.",
  },

  overdue_receivables: {
    id: "overdue_receivables",
    name: "Overdue Customer Payments",
    category: "financial",
    description:
      "Total unpaid invoice balances that have passed their agreed payment due date.",
    calculationFormula:
      "Adds together the remaining balances on valid unpaid invoices whose payment due date has passed.",
    authoritativeSource: "Invoice Records",
    applicableDateField: "Invoice Due Date",
    defaultFilters: "Unpaid and partially paid invoices past their due date",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Requires a payment due date to be recorded when the invoice is issued.",
  },

  recorded_expenses: {
    id: "recorded_expenses",
    name: "Expenses Paid",
    category: "financial",
    description:
      "Total recorded expenses paid by ABLEBIZ during the selected reporting period.",
    calculationFormula:
      "Adds together recorded expenses for the selected period using the system's expense date.",
    authoritativeSource: "Expense Records",
    applicableDateField: "Expense Date",
    defaultFilters: "All recorded operational and statutory expenses in the period",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Reflects expenses recorded in the Expense Register. External costs not yet entered into the system are not included.",
  },

  catalog_estimated_cost: {
    id: "catalog_estimated_cost",
    name: "Estimated Direct Service Costs",
    category: "financial",
    description:
      "Standard estimated filing and direct delivery costs defined in the Service Catalogue for active service requests.",
    calculationFormula:
      "Adds together the standard direct cost estimates for active services delivered during the selected period.",
    authoritativeSource: "Service Catalogue and Service Requests",
    applicableDateField: "Service Request Date",
    defaultFilters: "Active and completed service requests (excludes cancelled requests)",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Used as a baseline cost estimate for service margin comparisons alongside actual recorded expenses.",
  },

  gross_profit: {
    id: "gross_profit",
    name: "Gross Operating Profit",
    category: "financial",
    description:
      "Confirmed cash received minus direct statutory filing and service delivery costs for the selected period.",
    calculationFormula:
      "Confirmed cash received less direct service and statutory filing expenses.",
    authoritativeSource: "Payment and Expense Records",
    applicableDateField: "Payment Date and Expense Date",
    defaultFilters: "Confirmed payments and recorded direct expenses",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Based on confirmed payments and recorded expenses in ABLEBIZ Suite.",
  },

  net_operating_profit: {
    id: "net_operating_profit",
    name: "Net Operating Profit (Cash Basis)",
    category: "financial",
    description:
      "Cash received minus recorded expenses for the selected period.",
    calculationFormula:
      "Confirmed cash received less recorded expenses.",
    authoritativeSource: "Payment and Expense Records",
    applicableDateField: "Payment Date and Expense Date",
    defaultFilters: "Confirmed payments and all recorded expenses in the selected period",
    unit: "NGN",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Cash-basis operating result based on confirmed payments and recorded expenses in ABLEBIZ Suite.",
  },

  profit_margin_percent: {
    id: "profit_margin_percent",
    name: "Net Profit Margin",
    category: "financial",
    description:
      "Shows the percentage of confirmed cash received that remains after recorded expenses.",
    calculationFormula:
      "Net operating profit divided by confirmed cash received, multiplied by 100. If cash collected is zero, shows Not Available.",
    authoritativeSource: "Payment and Expense Records",
    applicableDateField: "Payment Date and Expense Date",
    defaultFilters: "Requires confirmed cash received to be greater than zero",
    unit: "percentage",
    permissionsRequired: ["finance.view"],
    knownLimitations:
      "Displays Not Available when confirmed cash received is zero for the selected period.",
  },

  // ============================================================================
  // CRM & CLIENT METRICS
  // ============================================================================
  total_leads_captured: {
    id: "total_leads_captured",
    name: "Customer Enquiries (Leads)",
    category: "crm",
    description:
      "Total prospective customer enquiries received across consultations, checklists, promotional campaigns, and referrals.",
    calculationFormula:
      "Counts all new lead enquiries recorded during the selected period.",
    authoritativeSource: "Lead Records",
    applicableDateField: "Enquiry Date",
    defaultFilters: "All lead enquiries recorded in the selected period",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Includes all incoming enquiries before qualification or conversion into paying clients.",
  },

  qualified_leads_count: {
    id: "qualified_leads_count",
    name: "Qualified & Converted Enquiries",
    category: "crm",
    description:
      "Number of prospective customer enquiries that have been qualified by staff or converted into registered clients.",
    calculationFormula:
      "Counts enquiries marked as Qualified or Converted, or linked to a registered client profile.",
    authoritativeSource: "Lead Records",
    applicableDateField: "Enquiry Date",
    defaultFilters: "Enquiries marked Qualified or Converted",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Depends on staff updating enquiry status or converting leads to client profiles.",
  },

  lead_conversion_rate: {
    id: "lead_conversion_rate",
    name: "Enquiry-to-Client Conversion Rate",
    category: "crm",
    description:
      "Percentage of prospective customer enquiries from the selected period that became registered clients.",
    calculationFormula:
      "Converted enquiries divided by total enquiries received in the selected period, multiplied by 100.",
    authoritativeSource: "Lead and Client Records",
    applicableDateField: "Enquiry Date",
    defaultFilters: "All customer enquiries in the selected period",
    unit: "percentage",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Measures conversion of enquiries received within the selected reporting period.",
  },

  new_clients_acquired: {
    id: "new_clients_acquired",
    name: "New Clients",
    category: "crm",
    description:
      "Number of clients registered with ABLEBIZ during the selected reporting period.",
    calculationFormula:
      "Counts new client records created during the selected period.",
    authoritativeSource: "Client Records",
    applicableDateField: "Client Registration Date",
    defaultFilters: "Active client profiles registered in the period",
    unit: "count",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Includes both converted enquiries and direct walk-in client registrations.",
  },

  repeat_client_engagement_rate: {
    id: "repeat_client_engagement_rate",
    name: "Repeat Client Rate",
    category: "crm",
    description:
      "Percentage of active clients who have engaged ABLEBIZ for two or more services or business registrations.",
    calculationFormula:
      "Clients with two or more service requests or registered businesses divided by all clients with at least one service or business, multiplied by 100.",
    authoritativeSource: "Client Records and Service Requests",
    applicableDateField: "Service Request Date",
    defaultFilters: "Active non-cancelled service engagements",
    unit: "percentage",
    permissionsRequired: ["crm.view"],
    knownLimitations:
      "Measures repeat service requests and multi-business engagements across the client base.",
  },

  // ============================================================================
  // CAC OPERATIONS & SERVICE DELIVERY METRICS
  // ============================================================================
  cac_completion_rate: {
    id: "cac_completion_rate",
    name: "CAC Registration Progress Rate",
    category: "operations",
    description:
      "Shows the percentage of eligible CAC registration applications that have reached the defined progress milestones.",
    calculationFormula:
      "Counts eligible CAC registration applications that have reached Approved or Completed status, divided by all non-cancelled CAC applications in the period, multiplied by 100. Detailed CAC reports also show Submitted, In Progress, Approved, Completed, and Cancelled applications separately.",
    authoritativeSource: "CAC Registration Records",
    applicableDateField: "Application Date",
    defaultFilters: "All eligible CAC applications (excludes cancelled applications)",
    unit: "percentage",
    permissionsRequired: ["operations.view"],
    knownLimitations:
      "Applications submitted near the end of the reporting period may still be under CAC review.",
  },

  cac_average_turnaround_days: {
    id: "cac_average_turnaround_days",
    name: "Average CAC Processing Time (Days)",
    category: "operations",
    description:
      "Average number of calendar days taken from application submission to approval or completion for CAC registrations.",
    calculationFormula:
      "Calculates the average number of days between submission date and approval or completion date across finalized CAC applications.",
    authoritativeSource: "CAC Registration Records",
    applicableDateField: "Submission Date and Approval Date",
    defaultFilters: "Approved and completed CAC registration applications",
    unit: "days",
    permissionsRequired: ["operations.view"],
    knownLimitations:
      "Uses recorded application and approval dates when explicit filing timestamps are not entered separately.",
  },

  service_request_completion_rate: {
    id: "service_request_completion_rate",
    name: "Service Delivery Completion Rate",
    category: "operations",
    description:
      "Percentage of active customer service requests during the period that have been fully completed.",
    calculationFormula:
      "Completed service requests divided by all non-cancelled service requests in the period, multiplied by 100.",
    authoritativeSource: "Service Requests",
    applicableDateField: "Service Request Date",
    defaultFilters: "All non-cancelled service requests",
    unit: "percentage",
    permissionsRequired: ["operations.view"],
    knownLimitations:
      "Reflects service requests marked as Completed in the Service Delivery workspace.",
  },

  // ============================================================================
  // STAFF & HR METRICS
  // ============================================================================
  staff_task_completion_rate: {
    id: "staff_task_completion_rate",
    name: "Staff Task Completion Rate",
    category: "hr",
    description:
      "Percentage of assigned staff tasks completed during the selected reporting period.",
    calculationFormula:
      "Completed staff tasks divided by all non-cancelled tasks assigned in the period, multiplied by 100.",
    authoritativeSource: "Staff Task Records",
    applicableDateField: "Task Creation Date",
    defaultFilters: "All non-cancelled staff tasks",
    unit: "percentage",
    permissionsRequired: ["operations.view", "hr.view"],
    knownLimitations:
      "Measures tasks logged in the system and does not include offline activities not entered as tasks.",
  },

  staff_attendance_rate: {
    id: "staff_attendance_rate",
    name: "Staff Attendance Rate",
    category: "hr",
    description:
      "Percentage of recorded attendance entries where staff were present or working remotely.",
    calculationFormula:
      "Present and remote attendance entries divided by total recorded attendance entries in the period, multiplied by 100.",
    authoritativeSource: "Staff Attendance Records",
    applicableDateField: "Attendance Date",
    defaultFilters: "All recorded attendance entries in the selected period",
    unit: "percentage",
    permissionsRequired: ["hr.view"],
    knownLimitations:
      "Calculated from recorded attendance logs; shows Insufficient Data if attendance records are not yet logged for the period.",
  },

  // ============================================================================
  // MARKETING, CAMPAIGN & REFERRAL METRICS
  // ============================================================================
  verified_successful_referrals: {
    id: "verified_successful_referrals",
    name: "Successful Referrals",
    category: "marketing",
    description:
      "Number of unique referrals that have been verified as successful under the approved referral programme rules.",
    calculationFormula:
      "Counts unique referred customers whose referrals have been confirmed after meeting all programme qualification rules (new customer, eligible service, full payment within campaign window, prior referral attribution, and not cancelled or refunded).",
    authoritativeSource: "Referral Records",
    applicableDateField: "Referral Date",
    defaultFilters: "Confirmed referrals only (one referral counted per unique new customer)",
    unit: "count",
    permissionsRequired: ["crm.view", "reports.view"],
    knownLimitations:
      "Referrals awaiting verification, under review, disputed, disqualified, or cancelled are excluded from confirmed totals.",
  },

  referral_reward_liability: {
    id: "referral_reward_liability",
    name: "Referral Rewards Earned",
    category: "marketing",
    description:
      "Total cumulative milestone rewards earned by referrers from confirmed successful referrals (1 referral = ₦2,000; 3 referrals = ₦7,500; 5 referrals = ₦15,000; 10 referrals = ₦35,000 total).",
    calculationFormula:
      "Calculates each referrer's cumulative milestone reward based on their confirmed referral count and adds the totals together.",
    authoritativeSource: "Referral Records and Referral Reward Records",
    applicableDateField: "Referral Date",
    defaultFilters: "Confirmed referrals only",
    unit: "NGN",
    permissionsRequired: ["reports.view"],
    knownLimitations:
      "Milestone rewards are cumulative totals rather than separate bonuses added on top of earlier milestones.",
  },

  // ============================================================================
  // ORGANISATIONAL HEALTH METRIC
  // ============================================================================
  organisational_health_score: {
    id: "organisational_health_score",
    name: "Organisational Health Score",
    category: "executive",
    description:
      "Overall 0–100 business health score combining financial performance, payment collection, customer growth, service delivery, CAC processing, staff execution, and compliance.",
    calculationFormula:
      "Calculates a weighted average across all business health dimensions that have verified data available for the period.",
    authoritativeSource:
      "Invoice Records, Payment Records, Expense Records, Client Records, Lead Records, Service Requests, CAC Registration Records, Staff Task Records",
    applicableDateField: "Selected Reporting Period",
    defaultFilters: "Includes only dimensions with verified data in the period",
    unit: "score",
    permissionsRequired: ["reports.view"],
    knownLimitations:
      "Requires at least three business dimensions with active records to calculate a combined score; otherwise displays Insufficient Data.",
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
