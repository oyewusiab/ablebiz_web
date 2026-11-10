import type { CanonicalStaffRole } from "../../auth/roleConfig";

export type CommunicationChannel =
  | "whatsapp"
  | "phone_call"
  | "email"
  | "in_person"
  | "sms";

export type CommunicationDirection = "inbound" | "outbound";

/**
 * Accurate communication lifecycle statuses.
 * Opening WhatsApp or an external email client records "opened_in_whatsapp" / "opened_in_email",
 * NEVER falsely claiming "sent" or "delivered".
 */
export type CommunicationStatus =
  | "draft"
  | "prepared"
  | "queued"
  | "opened_in_whatsapp"
  | "opened_in_email"
  | "opened_in_phone"
  | "sent"
  | "delivered"
  | "failed"
  | "opened"
  | "confirmed_by_client";

export type TemplateCategoryId =
  | "welcome_onboarding"
  | "registration_updates"
  | "approval_congratulations"
  | "document_delivery"
  | "information_document_requests"
  | "service_progress_updates"
  | "payment_invoice_notifications"
  | "feedback_reviews"
  | "referral_requests"
  | "followup_reminders"
  | "service_completion"
  | "general_communication";

export interface TemplateCategoryMeta {
  id: TemplateCategoryId;
  name: string;
  description: string;
  badgeTone: "emerald" | "blue" | "amber" | "purple" | "slate" | "rose";
}

export type WorkflowContextType =
  | "client_360"
  | "service_request"
  | "cac_operations"
  | "finance"
  | "leads"
  | "general";

export type VerificationGuardType =
  | "cac_approved"
  | "cac_submitted"
  | "payment_verified"
  | null;

export type CommunicationActionIntent =
  | "call_client"
  | "whatsapp_client"
  | "email_client"
  | "send_prepared_message"
  | "request_information"
  | "request_documents"
  | "send_service_update"
  | "send_document_delivery"
  | "send_feedback_request"
  | "send_congratulations"
  | "send_registration_requirements"
  | "send_submission_update"
  | "send_correction_request"
  | "send_invoice_notification"
  | "send_payment_reminder"
  | "send_payment_confirmation"
  | "send_onboarding"
  | "send_referral_request"
  | "view_history";

export interface MessageTemplate {
  id: string;
  slug: string;
  name: string;
  category: TemplateCategoryId;
  description: string;
  defaultChannel: CommunicationChannel;
  supportedChannels: CommunicationChannel[];
  subject?: string;
  body: string;
  supportedVariables: string[];
  isActive: boolean;
  isSystemSeed: boolean;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  allowedRoles: CanonicalStaffRole[];
  workflowContexts: WorkflowContextType[];
  isDefaultForWorkflow?: string | null;
  verificationGuard?: VerificationGuardType;
  usageCount: number;
}

export interface DynamicVariableDefinition {
  key: string; // e.g. "client_name"
  token: string; // e.g. "{{client_name}}"
  label: string;
  group:
    | "client"
    | "business"
    | "service_request"
    | "cac_operations"
    | "finance"
    | "communication";
  description: string;
  example: string;
}

export interface DynamicVariableContext {
  // Client
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_business_name?: string;
  contact_person?: string;

  // Business
  business_name?: string;
  business_type?: string;
  business_registration_number?: string;

  // Service Request
  service_name?: string;
  service_request_reference?: string;
  assigned_officer?: string;
  current_status?: string;
  request_date?: string;
  relevant_next_step?: string;
  missing_information_list?: string;

  // CAC Operations
  registration_type?: string;
  application_reference?: string;
  current_stage?: string;
  approval_date?: string;
  submission_date?: string;
  certificate_number?: string;
  missing_documents?: string;
  correction_reason?: string;
  required_correction?: string;

  // Finance
  invoice_number?: string;
  invoice_amount?: string;
  outstanding_balance?: string;
  due_date?: string;
  verified_payment_date?: string;
  receipt_number?: string;
  payment_instructions?: string;

  // Delivery & Engagement
  delivery_email?: string;
  delivery_date?: string;
  feedback_link?: string;
  referral_code?: string;
  referral_link?: string;

  // Staff & Business Identity
  staff_name?: string;
  staff_designation?: string;
  business_contact_info?: string;
}

export interface CommunicationLogRecord {
  id: string;
  client_id?: string | null;
  lead_id?: string | null;
  business_id?: string | null;
  service_request_id?: string | null;
  cac_application_id?: string | null;
  invoice_id?: string | null;
  payment_id?: string | null;
  staff_id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  template_id?: string | null;
  template_name?: string | null;
  subject?: string | null;
  summary: string;
  details?: string | null;
  message_body?: string | null;
  html_body?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  cc_emails?: string[] | null;
  sender_name?: string | null;
  sender_email?: string | null;
  reply_to_email?: string | null;
  provider_name?: string | null;
  provider_message_id?: string | null;
  error_message?: string | null;
  outcome_notes?: string | null;
  client_response?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  confirmed_at?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at?: string;
  // Joins
  client?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
  } | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  } | null;
  business?: {
    id: string;
    name: string;
    registration_number?: string | null;
  } | null;
  staff?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
  service_request?: {
    id: string;
    tracking_code: string;
    status?: string;
  } | null;
  cac_application?: {
    id: string;
    proposed_name_1?: string | null;
    approved_name?: string | null;
    current_stage?: string;
  } | null;
  invoice?: {
    id: string;
    invoice_number: string;
    total_amount?: number;
    balance_due?: number;
  } | null;
}

export interface ClientContactContext {
  clientId?: string | null;
  leadId?: string | null;
  clientName: string;
  phone?: string | null;
  whatsappPhone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  businessId?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  businessRegNumber?: string | null;
  contactPerson?: string | null;
  referralCode?: string | null;
  contactVerified?: boolean;
  // Contextual Operational Links
  serviceRequestId?: string | null;
  serviceRequestCode?: string | null;
  serviceName?: string | null;
  serviceStatus?: string | null;
  assignedOfficerName?: string | null;
  requestDate?: string | null;
  nextStep?: string | null;
  missingItems?: string[];
  // CAC Context
  cacApplicationId?: string | null;
  cacRegistrationType?: string | null;
  cacApplicationRef?: string | null;
  cacStage?: string | null;
  cacApprovalDate?: string | null;
  cacSubmissionDate?: string | null;
  cacCertificateNumber?: string | null;
  cacRejectionReason?: string | null;
  cacRectificationNotes?: string | null;
  // Finance Context
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceTotalAmount?: number | null;
  invoiceBalanceDue?: number | null;
  invoiceAmountPaid?: number | null;
  invoiceDueDate?: string | null;
  paymentId?: string | null;
  receiptNumber?: string | null;
  verifiedPaymentDate?: string | null;
  isPaymentVerified?: boolean;
}
