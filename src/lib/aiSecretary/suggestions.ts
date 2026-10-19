import {
  AssistantCallerContext,
  AssistantTopicFilterId,
  ConversationContext,
  SuiteModuleId,
  SuggestedQuestionChip,
  SuggestedQuestionGroup,
} from "./types";
import { canCallerAccessModule } from "./capabilityCatalogue";

const ALL_SUGGESTION_GROUPS: SuggestedQuestionGroup[] = [
  {
    id: "management",
    label: "Management",
    iconName: "ShieldCheck",
    questions: [
      {
        id: "mgmt_attention",
        label: "What requires attention today?",
        prompt: "What requires attention today across tasks, approvals, and operations?",
        category: "Management",
        moduleId: "dashboard",
        intentType: "operational_report",
      },
      {
        id: "mgmt_overdue",
        label: "Which tasks or approvals are overdue?",
        prompt: "Which tasks, follow-ups, or staff/HR approvals are currently overdue or pending?",
        category: "Management",
        moduleId: "tasks",
        intentType: "operational_report",
      },
      {
        id: "mgmt_sr_intervention",
        label: "Which service requests need intervention?",
        prompt: "Which service requests are currently awaiting action or need intervention?",
        category: "Management",
        moduleId: "service_requests",
        intentType: "operational_report",
      },
      {
        id: "mgmt_summary",
        label: "Show the latest operational summary",
        prompt: "Show the latest executive operational summary across active modules.",
        category: "Management",
        moduleId: "reports",
        intentType: "operational_report",
      },
    ],
  },
  {
    id: "cac_operations",
    label: "CAC Operations",
    iconName: "Briefcase",
    questions: [
      {
        id: "cac_overdue",
        label: "Which applications are overdue?",
        prompt: "Which CAC applications are overdue, stalled, or queried?",
        category: "CAC Operations",
        moduleId: "cac_operations",
        intentType: "operational_report",
      },
      {
        id: "cac_review",
        label: "Which applications are waiting for review?",
        prompt: "Which CAC applications are currently waiting for internal review or submission?",
        category: "CAC Operations",
        moduleId: "cac_operations",
        intentType: "operational_report",
      },
      {
        id: "cac_next_stage_guide",
        label: "How do I move an application to its next stage?",
        prompt: "How do I process a CAC application and move it to its next stage?",
        category: "CAC Operations",
        moduleId: "cac_operations",
        intentType: "suite_guide",
      },
      {
        id: "cac_create_sr_guide",
        label: "How do I create a service request?",
        prompt: "How do I create a service request?",
        category: "CAC Operations",
        moduleId: "service_requests",
        intentType: "suite_guide",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    iconName: "DollarSign",
    questions: [
      {
        id: "fin_outstanding_inv",
        label: "Show outstanding invoices",
        prompt: "Show outstanding and overdue invoices with total balances.",
        category: "Finance",
        moduleId: "invoices",
        intentType: "operational_report",
      },
      {
        id: "fin_reconcile_pay",
        label: "Which payments need reconciliation?",
        prompt: "Which payments are pending verification or need reconciliation?",
        category: "Finance",
        moduleId: "payments",
        intentType: "operational_report",
      },
      {
        id: "fin_record_pay_guide",
        label: "How do I record a payment?",
        prompt: "How do I record or verify a payment?",
        category: "Finance",
        moduleId: "payments",
        intentType: "suite_guide",
      },
      {
        id: "fin_quote_invoice_guide",
        label: "How do I create a quotation or issue an invoice?",
        prompt: "How do I create or revise a quotation and issue an invoice?",
        category: "Finance",
        moduleId: "quotations",
        intentType: "suite_guide",
      },
    ],
  },
  {
    id: "referrals_crm",
    label: "Referrals & CRM",
    iconName: "Gift",
    questions: [
      {
        id: "ref_followup",
        label: "Which referrals need follow-up?",
        prompt: "Which referrals and referred leads need follow-up or conversion?",
        category: "Referrals & CRM",
        moduleId: "referrals",
        intentType: "operational_report",
      },
      {
        id: "ref_rewards",
        label: "Which rewards are awaiting fulfillment?",
        prompt: "Which Spin & Earn rewards are awaiting approval or fulfillment?",
        category: "Referrals & CRM",
        moduleId: "referrals",
        intentType: "operational_report",
      },
      {
        id: "ref_register_guide",
        label: "How do I register a referred customer?",
        prompt: "How do I manage a referral or fulfil a reward?",
        category: "Referrals & CRM",
        moduleId: "referrals",
        intentType: "suite_guide",
      },
      {
        id: "crm_leads_summary",
        label: "Show active leads and scheduled follow-ups",
        prompt: "Show active CRM leads and upcoming or overdue client follow-ups.",
        category: "Referrals & CRM",
        moduleId: "leads",
        intentType: "operational_report",
      },
    ],
  },
  {
    id: "staff_hr",
    label: "Staff & HR",
    iconName: "Users",
    questions: [
      {
        id: "hr_leave_next_3w",
        label: "Who is on leave in the next 3 weeks?",
        prompt: "Which staff will be on leave in the next three weeks?",
        category: "Staff & HR",
        moduleId: "hr",
        intentType: "operational_report",
      },
      {
        id: "hr_submit_leave_guide",
        label: "How do I submit a leave request?",
        prompt: "How do I submit a leave request?",
        category: "Staff & HR",
        moduleId: "hr",
        intentType: "suite_guide",
      },
      {
        id: "hr_employment_details",
        label: "Where can I view my employment details?",
        prompt: "Where can I view my employment details?",
        category: "Staff & HR",
        moduleId: "hr",
        intentType: "suite_guide",
      },
      {
        id: "hr_check_attendance",
        label: "How do I check my attendance?",
        prompt: "How do I check my attendance?",
        category: "Staff & HR",
        moduleId: "hr",
        intentType: "suite_guide",
      },
    ],
  },
  {
    id: "suite_guide",
    label: "Suite Guide & Help",
    iconName: "BookOpen",
    questions: [
      {
        id: "guide_assign_task",
        label: "How do I assign a task?",
        prompt: "How do I assign a task?",
        category: "Suite Guide & Help",
        moduleId: "tasks",
        intentType: "suite_guide",
      },
      {
        id: "guide_submit_approval",
        label: "How do I submit a request for approval?",
        prompt: "How do I submit a request for approval?",
        category: "Suite Guide & Help",
        moduleId: "team",
        intentType: "suite_guide",
      },
      {
        id: "guide_button_unavailable",
        label: "Why is a button unavailable to my role?",
        prompt: "Why is a button unavailable to my role?",
        category: "Suite Guide & Help",
        moduleId: "team",
        intentType: "permission_explanation",
      },
      {
        id: "guide_correct_failed",
        label: "How do I correct a failed operation?",
        prompt: "How do I correct a failed operation?",
        category: "Suite Guide & Help",
        moduleId: "dashboard",
        intentType: "troubleshooting",
      },
    ],
  },
];

/**
 * Returns role-filtered suggestion groups so users only see suggestions
 * for modules and operations permitted for their canonical role.
 */
export function getRoleAwareSuggestionGroups(
  caller: AssistantCallerContext
): SuggestedQuestionGroup[] {
  return ALL_SUGGESTION_GROUPS.map((group) => {
    const filteredQuestions = group.questions.filter((q) => {
      if (
        q.intentType === "permission_explanation" ||
        q.intentType === "troubleshooting"
      ) {
        return true;
      }
      if (group.id === "finance" && !caller.hasPermission("finance", "view")) {
        return false;
      }
      if (
        q.id === "mgmt_summary" &&
        !caller.hasPermission("reports", "view") &&
        !caller.isManagement
      ) {
        return false;
      }
      return canCallerAccessModule(caller, q.moduleId);
    });

    return {
      ...group,
      questions: filteredQuestions,
    };
  }).filter((group) => group.questions.length > 0);
}

/**
 * Returns the compact topic selector options with "All topics" first as the default.
 */
export function getTopicSelectorOptions(
  caller: AssistantCallerContext
): Array<{ id: AssistantTopicFilterId; label: string }> {
  const groups = getRoleAwareSuggestionGroups(caller);
  return [
    { id: "all", label: "All topics" },
    ...groups.map((g) => ({ id: g.id, label: g.label })),
  ];
}

/**
 * Returns starter prompt chips for the selected topic (or a balanced cross-suite mix for "All topics").
 */
export function getStarterPromptsForTopic(
  caller: AssistantCallerContext,
  topicId: AssistantTopicFilterId = "all"
): SuggestedQuestionChip[] {
  const groups = getRoleAwareSuggestionGroups(caller);
  if (topicId !== "all") {
    const matched = groups.find((g) => g.id === topicId);
    if (matched) return matched.questions;
  }

  // For "All topics", pick the top prompt from each accessible category (up to 5 chips)
  const mixed: SuggestedQuestionChip[] = [];
  for (const group of groups) {
    if (group.questions[0]) {
      mixed.push(group.questions[0]);
    }
  }
  return mixed.slice(0, 5);
}

/**
 * Generates contextual follow-up chips based on the module and intent just answered,
 * strictly filtered by the caller's role permissions.
 */
export function getContextualFollowUpQuestions(
  caller: AssistantCallerContext,
  moduleId: SuiteModuleId,
  context?: ConversationContext
): string[] {
  const candidates: { prompt: string; moduleId: SuiteModuleId; requiresFinance?: boolean }[] = [];

  switch (moduleId) {
    case "cac_operations":
      candidates.push(
        { prompt: "Which CAC applications are currently queried or stalled?", moduleId: "cac_operations" },
        { prompt: "How do I process a CAC application and move it to its next stage?", moduleId: "cac_operations" },
        { prompt: "Which service requests need intervention?", moduleId: "service_requests" }
      );
      break;
    case "service_requests":
    case "services_catalog":
      candidates.push(
        { prompt: "How do I create a service request?", moduleId: "service_requests" },
        { prompt: "Which CAC applications are waiting for review?", moduleId: "cac_operations" },
        { prompt: "Show active services in the Service Catalogue", moduleId: "services_catalog" }
      );
      break;
    case "invoices":
    case "payments":
    case "quotations":
    case "expenses":
    case "vendors":
      candidates.push(
        { prompt: "Show outstanding invoices", moduleId: "invoices", requiresFinance: true },
        { prompt: "Which payments need reconciliation?", moduleId: "payments", requiresFinance: true },
        { prompt: "How do I record or verify a payment?", moduleId: "payments", requiresFinance: true },
        { prompt: "Show expenses and active vendors summary", moduleId: "expenses", requiresFinance: true }
      );
      break;
    case "hr":
    case "hr_workspace":
      candidates.push(
        { prompt: "Which staff will be on leave in the next three weeks?", moduleId: "hr" },
        { prompt: "How do I submit a leave request?", moduleId: "hr" },
        { prompt: "How do I check my attendance?", moduleId: "hr" },
        { prompt: "Where can I view my employment details?", moduleId: "hr" }
      );
      break;
    case "referrals":
      candidates.push(
        { prompt: "Which rewards are awaiting fulfillment?", moduleId: "referrals" },
        { prompt: "Which referrals need follow-up?", moduleId: "referrals" },
        { prompt: "How do I manage a referral or fulfil a reward?", moduleId: "referrals" }
      );
      break;
    case "leads":
    case "follow_ups":
    case "clients":
    case "businesses":
    case "communications":
      candidates.push(
        { prompt: "Show active CRM leads and scheduled follow-ups", moduleId: "leads" },
        { prompt: "Show client and registered businesses summary", moduleId: "clients" },
        { prompt: "Show recent client communications", moduleId: "communications" }
      );
      break;
    case "tasks":
      candidates.push(
        { prompt: "Which tasks are overdue or blocked?", moduleId: "tasks" },
        { prompt: "How do I assign a task?", moduleId: "tasks" },
        { prompt: "What requires attention today?", moduleId: "dashboard" }
      );
      break;
    case "team":
    case "staff_rbac":
    case "audit_logs":
      candidates.push(
        { prompt: "Are there any pending staff approval requests?", moduleId: "team" },
        { prompt: "Why is a button unavailable to my role?", moduleId: "team" },
        { prompt: "How do I submit a request for approval?", moduleId: "team" }
      );
      break;
    default:
      candidates.push(
        { prompt: "What requires attention today?", moduleId: "dashboard" },
        { prompt: "Which CAC applications are overdue?", moduleId: "cac_operations" },
        { prompt: "Which staff will be on leave in the next three weeks?", moduleId: "hr" },
        { prompt: "Why is a button unavailable to my role?", moduleId: "team" }
      );
      break;
  }

  return candidates
    .filter((item) => {
      if (item.requiresFinance && !caller.hasPermission("finance", "view")) {
        return false;
      }
      if (context?.lastQueryText && item.prompt.toLowerCase() === context.lastQueryText.toLowerCase()) {
        return false;
      }
      return canCallerAccessModule(caller, item.moduleId);
    })
    .map((item) => item.prompt)
    .slice(0, 3);
}
