import { normalizeStaffRole, type CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  ClientContactContext,
  MessageTemplate,
  TemplateCategoryId,
  WorkflowContextType,
} from "./types";

export interface CommunicationRolePolicy {
  role: CanonicalStaffRole;
  canSendCommunications: boolean;
  canViewAllHistory: boolean;
  canManageAllTemplates: boolean;
  canManageOperationalTemplates: boolean;
  canUpdateClientContact: boolean;
  canSendOfficialEmail: boolean;
  allowedWorkflowContexts: WorkflowContextType[];
  allowedTemplateCategories: TemplateCategoryId[];
}

const ALL_CATEGORIES: TemplateCategoryId[] = [
  "welcome_onboarding",
  "registration_updates",
  "approval_congratulations",
  "document_delivery",
  "information_document_requests",
  "service_progress_updates",
  "payment_invoice_notifications",
  "feedback_reviews",
  "referral_requests",
  "followup_reminders",
  "service_completion",
  "general_communication",
];

const OPERATIONAL_CATEGORIES: TemplateCategoryId[] = [
  "welcome_onboarding",
  "registration_updates",
  "approval_congratulations",
  "document_delivery",
  "information_document_requests",
  "service_progress_updates",
  "feedback_reviews",
  "followup_reminders",
  "service_completion",
  "general_communication",
];

export const COMMUNICATION_ROLE_POLICIES: Record<
  CanonicalStaffRole,
  CommunicationRolePolicy
> = {
  super_admin: {
    role: "super_admin",
    canSendCommunications: true,
    canViewAllHistory: true,
    canManageAllTemplates: true,
    canManageOperationalTemplates: true,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "finance",
      "leads",
      "general",
    ],
    allowedTemplateCategories: ALL_CATEGORIES,
  },
  admin: {
    role: "admin",
    canSendCommunications: true,
    canViewAllHistory: true,
    canManageAllTemplates: true,
    canManageOperationalTemplates: true,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "finance",
      "leads",
      "general",
    ],
    allowedTemplateCategories: ALL_CATEGORIES,
  },
  operations_manager: {
    role: "operations_manager",
    canSendCommunications: true,
    canViewAllHistory: true,
    canManageAllTemplates: false,
    canManageOperationalTemplates: true,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "finance",
      "leads",
      "general",
    ],
    allowedTemplateCategories: ALL_CATEGORIES,
  },
  registration_officer: {
    role: "registration_officer",
    canSendCommunications: true,
    canViewAllHistory: false,
    canManageAllTemplates: false,
    canManageOperationalTemplates: false,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "general",
    ],
    allowedTemplateCategories: [
      "welcome_onboarding",
      "registration_updates",
      "approval_congratulations",
      "document_delivery",
      "information_document_requests",
      "service_progress_updates",
      "feedback_reviews",
      "followup_reminders",
      "service_completion",
      "general_communication",
    ],
  },
  accounts_officer: {
    role: "accounts_officer",
    canSendCommunications: true,
    canViewAllHistory: false,
    canManageAllTemplates: false,
    canManageOperationalTemplates: false,
    canUpdateClientContact: false,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: ["finance", "client_360", "service_request", "general"],
    allowedTemplateCategories: [
      "payment_invoice_notifications",
      "followup_reminders",
      "general_communication",
    ],
  },
  client_service_officer: {
    role: "client_service_officer",
    canSendCommunications: true,
    canViewAllHistory: true,
    canManageAllTemplates: false,
    canManageOperationalTemplates: false,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "leads",
      "general",
    ],
    allowedTemplateCategories: [
      "welcome_onboarding",
      "registration_updates",
      "approval_congratulations",
      "document_delivery",
      "information_document_requests",
      "service_progress_updates",
      "feedback_reviews",
      "referral_requests",
      "followup_reminders",
      "service_completion",
      "general_communication",
    ],
  },
  marketing_officer: {
    role: "marketing_officer",
    canSendCommunications: true,
    canViewAllHistory: false,
    canManageAllTemplates: false,
    canManageOperationalTemplates: false,
    canUpdateClientContact: true,
    canSendOfficialEmail: true,
    allowedWorkflowContexts: ["leads", "client_360", "general"],
    allowedTemplateCategories: [
      "welcome_onboarding",
      "feedback_reviews",
      "referral_requests",
      "followup_reminders",
      "general_communication",
    ],
  },
  viewer: {
    role: "viewer",
    canSendCommunications: false,
    canViewAllHistory: false,
    canManageAllTemplates: false,
    canManageOperationalTemplates: false,
    canUpdateClientContact: false,
    canSendOfficialEmail: false,
    allowedWorkflowContexts: [],
    allowedTemplateCategories: [],
  },
};

export function getCommunicationRolePolicy(
  rawRole?: string | null
): CommunicationRolePolicy {
  const canonical = normalizeStaffRole(rawRole);
  if (!canonical) {
    return COMMUNICATION_ROLE_POLICIES.viewer;
  }
  return COMMUNICATION_ROLE_POLICIES[canonical] || COMMUNICATION_ROLE_POLICIES.viewer;
}

export function canSendCommunication(rawRole?: string | null): boolean {
  return getCommunicationRolePolicy(rawRole).canSendCommunications;
}

export function canManageTemplates(
  rawRole?: string | null,
  category?: TemplateCategoryId
): boolean {
  const policy = getCommunicationRolePolicy(rawRole);
  if (policy.canManageAllTemplates) return true;
  if (policy.canManageOperationalTemplates) {
    if (!category) return true;
    return OPERATIONAL_CATEGORIES.includes(category);
  }
  return false;
}

export function canUpdateClientContactInfo(rawRole?: string | null): boolean {
  return getCommunicationRolePolicy(rawRole).canUpdateClientContact;
}

export function canUseTemplate(
  rawRole: string | null | undefined,
  template: MessageTemplate
): boolean {
  const policy = getCommunicationRolePolicy(rawRole);
  if (!policy.canSendCommunications) return false;
  if (!template.isActive) return false;
  if (
    template.allowedRoles &&
    template.allowedRoles.length > 0 &&
    !template.allowedRoles.includes(policy.role)
  ) {
    return false;
  }
  return policy.allowedTemplateCategories.includes(template.category);
}

export interface VerificationGuardCheckResult {
  allowed: boolean;
  guardType: "cac_approved" | "cac_submitted" | "payment_verified" | null;
  reason?: string;
}

const APPROVED_CAC_STAGES = new Set([
  "approved",
  "documents_received",
  "completed",
  "delivered_to_client",
]);

const SUBMITTED_OR_LATER_CAC_STAGES = new Set([
  "submitted_to_cac",
  "queried_by_cac",
  "approved",
  "documents_received",
  "completed",
  "delivered_to_client",
]);

/**
 * Enforces workflow truthfulness rules:
 * - Never allow sending congratulatory/approval messages unless approval is confirmed.
 * - Never allow sending CAC submission confirmations unless submitted.
 * - Never allow sending payment confirmations unless payment is verified & reconciled.
 */
export function checkTemplateVerificationGuard(
  template: MessageTemplate | null | undefined,
  context: ClientContactContext
): VerificationGuardCheckResult {
  if (!template || !template.verificationGuard) {
    return { allowed: true, guardType: null };
  }

  const guard = template.verificationGuard;

  if (guard === "cac_approved") {
    const stageLower = (context.cacStage || "").toLowerCase().trim();
    const statusLower = (context.serviceStatus || "").toLowerCase().trim();
    const isApproved =
      APPROVED_CAC_STAGES.has(stageLower) ||
      statusLower === "completed" ||
      statusLower === "delivered_to_client" ||
      Boolean(context.cacApprovalDate?.trim()) ||
      Boolean(context.cacCertificateNumber?.trim()) ||
      Boolean(context.businessRegNumber?.trim());

    if (!isApproved) {
      return {
        allowed: false,
        guardType: "cac_approved",
        reason:
          "Registration approval has not yet been confirmed for this record. Congratulatory or approval notifications may only be sent after CAC approval is verified.",
      };
    }
    return { allowed: true, guardType: "cac_approved" };
  }

  if (guard === "cac_submitted") {
    const stageLower = (context.cacStage || "").toLowerCase().trim();
    const isSubmitted =
      SUBMITTED_OR_LATER_CAC_STAGES.has(stageLower) ||
      Boolean(context.cacSubmissionDate?.trim());

    if (!isSubmitted) {
      return {
        allowed: false,
        guardType: "cac_submitted",
        reason:
          "This application has not yet been marked as Submitted to CAC. Submission confirmation messages may only be sent after filing is confirmed.",
      };
    }
    return { allowed: true, guardType: "cac_submitted" };
  }

  if (guard === "payment_verified") {
    const isVerified =
      context.isPaymentVerified === true ||
      Boolean(context.verifiedPaymentDate?.trim()) ||
      Boolean(context.receiptNumber?.trim());

    if (!isVerified) {
      return {
        allowed: false,
        guardType: "payment_verified",
        reason:
          "Payment has not been verified and reconciled yet. Payment confirmation messages may only be sent for verified payments.",
      };
    }
    return { allowed: true, guardType: "payment_verified" };
  }

  return { allowed: true, guardType: null };
}
