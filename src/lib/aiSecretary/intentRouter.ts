import {
  AssistantCallerContext,
  ClassifiedIntent,
  ConversationContext,
  SuiteModuleId,
} from "./types";
import { parseQueryDateRange } from "./dateUtils";
import { matchGuideTopic } from "./suiteGuideRegistry";

interface UnsupportedFeaturePattern {
  pattern: RegExp;
  moduleId: SuiteModuleId;
  reason: string;
}

const UNSUPPORTED_FEATURE_PATTERNS: UnsupportedFeaturePattern[] = [
  {
    pattern: /\b(payroll|payslip|pay slip|salary disbursement|tax deduction|paye|pension calculation)\b/i,
    moduleId: "hr",
    reason:
      "Automated payroll calculation, tax/pension deductions, and payslip generation are not implemented in ABLEBIZ SUITE. The HR module currently supports Staff Directory, Leave Management, Attendance & Shift Settings, HR Documents, and Staff Announcements.",
  },
  {
    pattern: /\b(biometric|fingerprint|facial recognition|gps check[- ]?in|geofence attendance)\b/i,
    moduleId: "hr",
    reason:
      "Hardware biometric or GPS geofenced attendance is not connected. Attendance in ABLEBIZ SUITE is recorded via the interactive Check In / Check Out controls in the HR & Staff Portal (`/admin/hr`).",
  },
  {
    pattern: /\b(paystack|flutterwave|stripe|auto[- ]?reconcil|bank webhook|direct debit|online payment gateway)\b/i,
    moduleId: "payments",
    reason:
      "Automated payment gateway webhooks and live bank API feeds are not integrated. Payments are recorded and verified manually against bank transfer references or receipts in `/admin/payments`.",
  },
  {
    pattern: /\b(client login|customer portal|client self[- ]?service password|customer account login)\b/i,
    moduleId: "clients",
    reason:
      "ABLEBIZ SUITE does not provide a password-authenticated client self-service portal. Public visitors can submit leads, service requests, and referral codes via the public website, while authenticated staff manage client records in `/admin/clients`.",
  },
];

const ROLE_SPOOF_PATTERNS: RegExp[] = [
  /\b(i am|i'm|act as|pretend i am|treat me as|switch my role to|my role is|override role to|as a)\s+(a\s+)?(super_admin|super admin|managing_director|managing director|operations_admin|operations admin|accounts_officer|accounts officer|hr_manager|admin)\b/i,
  /\b(ignore|bypass|override|disable)\s+(my\s+)?(rls|role|permissions?|access control|security|authorization)\b/i,
  /\buse\s+service[_ ]role\b/i,
];

const WRITE_MUTATION_PATTERNS: RegExp[] = [
  /^(please\s+)?(approve|reject|delete|remove|cancel|create|insert|update|modify|mark|assign|convert|issue|send)\s+(this|the|a|an|all|my)\s+(leave|invoice|quotation|payment|cac|application|task|client|lead|service request|staff|expense|reward)/i,
  /\b(approve|reject|delete|update|mark)\s+(it|them|this record|this invoice|this leave|this application)\s+(for me|now|immediately|in the database)\b/i,
];

const FOLLOW_UP_PATTERNS: RegExp[] = [
  /^(what about|how about|and for|and what about|same for|also show|filter by|narrow to|only show)\b/i,
  /^(which ones|which of them|who among them|how many of those|are any of them)\b/i,
  /^(how do i (create|process|update|approve|fix|do) (one|that|it|them))\b/i,
  /^(why can't i|why cannot i|why is the button)\b/i,
];

/**
 * Detects target module from query text with priority ordering.
 */
export function detectModuleFromText(
  normalizedQuery: string,
  fallbackModule?: SuiteModuleId
): { moduleId: SuiteModuleId; subIntent?: string } {
  const q = normalizedQuery.toLowerCase();

  // 1. HR & Staff Leave / Attendance / HR Documents / Announcements
  if (
    /\b(on leave|leave request|annual leave|sick leave|maternity|paternity|compassionate|unpaid leave|study leave|attendance|check[- ]?in|check[- ]?out|late arrival|shift setting|hr document|staff announcement|employment detail|employment status)\b/.test(
      q
    )
  ) {
    if (/\b(leave|on leave|vacation|time off|absence)\b/.test(q)) {
      return { moduleId: "hr", subIntent: "leave" };
    }
    if (/\b(attendance|check[- ]?in|check[- ]?out|late|absent|present|shift)\b/.test(q)) {
      return { moduleId: "hr", subIntent: "attendance" };
    }
    if (/\b(announcement|notice)\b/.test(q)) {
      return { moduleId: "hr", subIntent: "announcements" };
    }
    if (/\b(hr document|handbook|policy|contract)\b/.test(q)) {
      return { moduleId: "hr", subIntent: "hr_documents" };
    }
    return { moduleId: "hr", subIntent: "overview" };
  }

  // 2. CAC Operations & Filing Pipeline
  if (
    /\b(cac|incorporation|business name registration|company registration|name reservation|availability check|certificate issued|filing|queried application|stalled application)\b/.test(
      q
    ) ||
    (/\b(application|applications)\b/.test(q) &&
      !/\b(leave application)\b/.test(q))
  ) {
    if (/\b(overdue|stalled|queried|delayed|attention)\b/.test(q)) {
      return { moduleId: "cac_operations", subIntent: "overdue_or_queried" };
    }
    if (/\b(review|awaiting|waiting|pending|submission)\b/.test(q)) {
      return { moduleId: "cac_operations", subIntent: "waiting_review" };
    }
    return { moduleId: "cac_operations", subIntent: "summary" };
  }

  // 3. Service Catalogue vs Service Requests
  if (/\b(service catalog|services catalog|service catalogue|services catalogue|base price|turnaround|service offering)\b/.test(q)) {
    return { moduleId: "services_catalog", subIntent: "summary" };
  }
  if (/\b(service request|service requests|intake request|intervention)\b/.test(q)) {
    return { moduleId: "service_requests", subIntent: "summary" };
  }

  // 4. Finance: Quotations, Invoices, Payments, Expenses, Vendors
  if (/\b(quotation|quotations|quote|quotes)\b/.test(q)) {
    return { moduleId: "quotations", subIntent: "summary" };
  }
  if (/\b(invoice|invoices|unpaid bill|receivable|outstanding balance|overdue invoice)\b/.test(q)) {
    return { moduleId: "invoices", subIntent: "summary" };
  }
  if (/\b(payment|payments|reconcil|receipt|collection|collected|revenue|paid amount)\b/.test(q)) {
    return { moduleId: "payments", subIntent: "summary" };
  }
  if (/\b(expense|expenses|expenditure|outflow|cost|operating cost)\b/.test(q)) {
    return { moduleId: "expenses", subIntent: "summary" };
  }
  if (/\b(vendor|vendors|supplier|suppliers)\b/.test(q)) {
    return { moduleId: "vendors", subIntent: "summary" };
  }
  if (/\b(finance|financial|cashflow|net cash|billing|accounting)\b/.test(q)) {
    return { moduleId: "invoices", subIntent: "finance_overview" };
  }

  // 5. Referrals & Spin & Earn
  if (/\b(referral|referrals|referred|spin|wheel|reward|rewards|partner|commission|fulfillment|fulfilment)\b/.test(q)) {
    if (/\b(reward|spin|fulfil|awaiting)\b/.test(q)) {
      return { moduleId: "referrals", subIntent: "rewards" };
    }
    return { moduleId: "referrals", subIntent: "summary" };
  }

  // 6. CRM: Leads, Follow-ups, Communications, Clients, Businesses
  if (/\b(follow[- ]?up|follow[- ]?ups|callback|scheduled call)\b/.test(q)) {
    return { moduleId: "follow_ups", subIntent: "summary" };
  }
  if (/\b(lead|leads|prospect|crm pipeline|inquiry|inquiries)\b/.test(q)) {
    return { moduleId: "leads", subIntent: "summary" };
  }
  if (/\b(communication|communications|message log|whatsapp log|email log|call log)\b/.test(q)) {
    return { moduleId: "communications", subIntent: "summary" };
  }
  if (/\b(registered business|businesses|rc number|bn number|tin|annual return)\b/.test(q)) {
    return { moduleId: "businesses", subIntent: "summary" };
  }
  if (/\b(client|clients|customer|customers|kyc)\b/.test(q)) {
    return { moduleId: "clients", subIntent: "summary" };
  }

  // 7. Tasks & SLA
  if (/\b(task|tasks|sla|deadline|deadlines|to[- ]?do|assigned to me|blocked task)\b/.test(q)) {
    return { moduleId: "tasks", subIntent: "summary" };
  }

  // 8. Documents Vault
  if (/\b(document|documents|vault|upload|certificate file|status report file)\b/.test(q)) {
    return { moduleId: "documents", subIntent: "summary" };
  }

  // 9. Staff Provisioning, RBAC & Approvals
  if (
    /\b(staff approval|maker[- ]?checker|staff change request|role permission|rbac|provision staff|invite staff|team member|staff directory|staff profile)\b/.test(
      q
    )
  ) {
    return { moduleId: "team", subIntent: "summary" };
  }

  // 10. Audit Logs & Activity Timeline
  if (/\b(audit logs?|audit trail|activity timeline|security logs?|security audit|who changed|history of changes)\b/.test(q)) {
    return { moduleId: "audit_logs", subIntent: "summary" };
  }

  // 11. Settings & Bank Accounts
  if (/\b(bank account|company setting|business profile|invoice prefix|tax rate|stamp|signature)\b/.test(q)) {
    return { moduleId: "settings", subIntent: "summary" };
  }

  // 12. Password & Account Security
  if (/\b(change password|reset password|update password|my password)\b/.test(q)) {
    return { moduleId: "change_password", subIntent: "summary" };
  }

  // 13. Notifications
  if (/\b(notification|notifications|unread alert|alerts)\b/.test(q)) {
    return { moduleId: "notifications", subIntent: "summary" };
  }

  // 14. Executive Reports
  if (/\b(executive report|operational summary|analytics|kpi report|monthly report)\b/.test(q)) {
    return { moduleId: "reports", subIntent: "summary" };
  }

  // 15. Attention / Workbench / Overview
  if (
    /\b(attention|urgent|priority|workbench|dashboard|today|overview|summary|overdue|pending approval)\b/.test(
      q
    )
  ) {
    return { moduleId: "dashboard", subIntent: "attention" };
  }

  if (fallbackModule) {
    return { moduleId: fallbackModule, subIntent: "summary" };
  }

  return { moduleId: "dashboard", subIntent: "attention" };
}

/**
 * Classifies a user query into a structured intent with module, date range,
 * security flags, and conversational follow-up awareness.
 */
export function classifyAssistantIntent(
  rawQuery: string,
  caller: AssistantCallerContext,
  context?: ConversationContext,
  referenceDate: Date = new Date()
): ClassifiedIntent {
  const normalizedQuery = rawQuery.trim();
  const lower = normalizedQuery.toLowerCase();

  // Check for role spoofing attempts
  let isRoleSpoofingAttempt = false;
  for (const pattern of ROLE_SPOOF_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      // If they claim to be a role they are not, or ask to bypass RLS/permissions
      if (
        lower.includes("bypass") ||
        lower.includes("ignore") ||
        lower.includes("override") ||
        lower.includes("service_role") ||
        !lower.includes(caller.role.toLowerCase())
      ) {
        isRoleSpoofingAttempt = true;
        break;
      }
    }
  }

  // Check for direct write / mutation commands
  const isWriteMutationAttempt = WRITE_MUTATION_PATTERNS.some((p) =>
    p.test(normalizedQuery)
  );

  // Check for unsupported features first so we never fabricate results
  for (const item of UNSUPPORTED_FEATURE_PATTERNS) {
    if (item.pattern.test(normalizedQuery)) {
      return {
        intentType: "unsupported_feature",
        primaryModule: item.moduleId,
        secondaryModules: [],
        dateRange: parseQueryDateRange(normalizedQuery, referenceDate),
        normalizedQuery,
        isFollowUp: false,
        isRoleSpoofingAttempt,
        isWriteMutationAttempt,
        unsupportedReason: item.reason,
      };
    }
  }

  // Check if this is a follow-up question referencing previous turn context
  const isFollowUp =
    Boolean(context?.lastModuleId) &&
    (FOLLOW_UP_PATTERNS.some((p) => p.test(normalizedQuery)) ||
      normalizedQuery.split(/\s+/).length <= 5);

  const detected = detectModuleFromText(
    normalizedQuery,
    isFollowUp ? context?.lastModuleId : undefined
  );

  // Parse date range; if follow-up doesn't specify a new date range and is asking a filter question, inherit or default
  let dateRange = parseQueryDateRange(normalizedQuery, referenceDate);
  if (
    isFollowUp &&
    dateRange.preset === "all_time" &&
    context?.lastDateRange &&
    context.lastDateRange.preset !== "all_time" &&
    !/\b(all time|ever|total)\b/i.test(normalizedQuery)
  ) {
    dateRange = context.lastDateRange;
  }

  // Check for capability / "what can you do" / modules inventory query
  if (
    /\b(what can you do|what modules|your capabilities|help me use the suite|list modules|available features)\b/i.test(
      normalizedQuery
    )
  ) {
    return {
      intentType: "capability_overview",
      primaryModule: "dashboard",
      secondaryModules: [],
      dateRange,
      normalizedQuery,
      isFollowUp,
      isRoleSpoofingAttempt,
      isWriteMutationAttempt,
    };
  }

  // Check for permission / RBAC explanation questions ("Why is a button unavailable to my role?", "What can my role do?")
  if (
    /\b(why is (a |the )?button|unavailable to my role|missing button|can't i click|cannot click|what are my permissions|what can my role|permission matrix|who can approve|why don't i see)\b/i.test(
      normalizedQuery
    )
  ) {
    return {
      intentType: "permission_explanation",
      primaryModule: detected.moduleId,
      secondaryModules: [],
      dateRange,
      normalizedQuery,
      isFollowUp,
      isRoleSpoofingAttempt,
      isWriteMutationAttempt,
      subIntent: detected.subIntent,
    };
  }

  // Check for troubleshooting questions ("How do I correct a failed operation?", "error when saving", "queried application fix")
  if (
    /\b(correct a failed|failed operation|troubleshoot|fix an error|something went wrong|rls error|maker[- ]?checker error|rejected request|correction requested|how do i fix)\b/i.test(
      normalizedQuery
    )
  ) {
    return {
      intentType: "troubleshooting",
      primaryModule: detected.moduleId,
      secondaryModules: [],
      dateRange,
      normalizedQuery,
      isFollowUp,
      isRoleSpoofingAttempt,
      isWriteMutationAttempt,
      subIntent: detected.subIntent,
    };
  }

  // Check for Suite Guide ("How do I...", "Where can I...", "Steps to...", or write-mutation redirect)
  const matchedGuide = matchGuideTopic(normalizedQuery);
  const isExplicitHowTo =
    /^(how do i|how can i|how to|where can i|where do i|steps to|guide me|explain how|walk me through)\b/i.test(
      normalizedQuery
    );

  if (isExplicitHowTo || (matchedGuide && !/\b(which|how many|show|list|count|total|who is)\b/i.test(normalizedQuery))) {
    return {
      intentType: "suite_guide",
      primaryModule: matchedGuide?.moduleId || detected.moduleId,
      secondaryModules: [],
      dateRange,
      normalizedQuery,
      isFollowUp,
      isRoleSpoofingAttempt,
      isWriteMutationAttempt,
      guideTopicId: matchedGuide?.id,
      subIntent: detected.subIntent,
    };
  }

  // Otherwise route to operational database report
  return {
    intentType: "operational_report",
    primaryModule: detected.moduleId,
    secondaryModules: [],
    dateRange,
    normalizedQuery,
    isFollowUp,
    isRoleSpoofingAttempt,
    isWriteMutationAttempt,
    guideTopicId: matchedGuide?.id,
    subIntent: detected.subIntent,
  };
}
