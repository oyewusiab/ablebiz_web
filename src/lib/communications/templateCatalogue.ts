import type { CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  CommunicationActionIntent,
  MessageTemplate,
  TemplateCategoryId,
  TemplateCategoryMeta,
  WorkflowContextType,
} from "./types";

export const TEMPLATE_CATEGORIES: TemplateCategoryMeta[] = [
  {
    id: "welcome_onboarding",
    name: "Welcome & Onboarding",
    description: "Warm welcome messages and onboarding guidance for new clients and leads.",
    badgeTone: "emerald",
  },
  {
    id: "registration_updates",
    name: "Registration Updates",
    description: "CAC application progress, submission confirmations, and correction queries.",
    badgeTone: "blue",
  },
  {
    id: "approval_congratulations",
    name: "Approval & Congratulations",
    description: "Celebratory and formal notifications for verified registration approvals.",
    badgeTone: "emerald",
  },
  {
    id: "document_delivery",
    name: "Document Delivery",
    description: "Notifications confirming official certificates and status documents have been delivered.",
    badgeTone: "purple",
  },
  {
    id: "information_document_requests",
    name: "Information & Document Requests",
    description: "Structured checklists for registration requirements, missing details, and unclear uploads.",
    badgeTone: "amber",
  },
  {
    id: "service_progress_updates",
    name: "Service Progress Updates",
    description: "Milestone updates across active client service requests.",
    badgeTone: "blue",
  },
  {
    id: "payment_invoice_notifications",
    name: "Payment & Invoice Notifications",
    description: "Invoice notifications, outstanding balance reminders, and verified payment receipts.",
    badgeTone: "amber",
  },
  {
    id: "feedback_reviews",
    name: "Feedback & Reviews",
    description: "Invitations for clients to rate their experience with ABLEBIZ.",
    badgeTone: "purple",
  },
  {
    id: "referral_requests",
    name: "Referral Requests",
    description: "Invitations to refer friends, partners, and business owners to ABLEBIZ.",
    badgeTone: "emerald",
  },
  {
    id: "followup_reminders",
    name: "Follow-up & Reminders",
    description: "Polite follow-ups on pending information, documents, or client decisions.",
    badgeTone: "slate",
  },
  {
    id: "service_completion",
    name: "Service Completion",
    description: "Closing appreciation and post-completion support notifications.",
    badgeTone: "emerald",
  },
  {
    id: "general_communication",
    name: "General Client Communication",
    description: "Flexible professional templates for custom client correspondence.",
    badgeTone: "slate",
  },
];

const ALL_OPERATIONAL_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "accounts_officer",
  "client_service_officer",
  "marketing_officer",
];

const CLIENT_AND_OPS_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "client_service_officer",
];

const CAC_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "client_service_officer",
];

const FINANCE_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "accounts_officer",
];

const MARKETING_AND_CS_ROLES: CanonicalStaffRole[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "client_service_officer",
  "marketing_officer",
];

export const INITIAL_MESSAGE_TEMPLATES: MessageTemplate[] = [
  // =========================================================================
  // PART 3 — TEMPLATE 1: DOCUMENT DELIVERY & FEEDBACK REQUEST
  // =========================================================================
  {
    id: "tpl-doc-delivery-feedback",
    slug: "document-delivery-and-feedback-request",
    name: "Document Delivery & Feedback Request",
    category: "document_delivery",
    description:
      "Notifies the client that their official documents have been delivered to their email and invites feedback and referrals.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Your Documents Are Ready — ABLEBIZ BUSINESS SERVICES",
    body: `Dear {{client_name}},

Congratulations! Your documents for {{business_name}} ({{service_name}}) are ready and have been delivered to the email address provided ({{delivery_email}}) on {{delivery_date}}.

Kindly check your Spam or Junk folder if you cannot find them in your Primary Inbox. If you find the email in your Spam or Junk folder, please move it back to your Primary Inbox to ensure you receive future communications from us.

We sincerely appreciate the trust you have placed in ABLEBIZ BUSINESS SERVICES.

If you are satisfied with our service, we kindly invite you to recommend us to your friends and family.

Your feedback is important to us. Please share your comments using the link below:

http://bit.ly/ablefeedback

Thank you once again for choosing ABLEBIZ BUSINESS SERVICES. We look forward to serving you again.`,
    supportedVariables: [
      "client_name",
      "business_name",
      "service_name",
      "delivery_email",
      "delivery_date",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations"],
    isDefaultForWorkflow: "send_document_delivery",
    verificationGuard: null,
    usageCount: 24,
  },

  // =========================================================================
  // PART 3 — TEMPLATE 2: REGISTRATION APPROVAL & CONGRATULATIONS
  // =========================================================================
  {
    id: "tpl-reg-approval-congrats",
    slug: "registration-approval-congratulations",
    name: "Registration Approval & Congratulations",
    category: "approval_congratulations",
    description:
      "Celebratory WhatsApp milestone message when a client's CAC registration approval has been confirmed.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Congratulations! Your Registration Has Been Approved — {{business_name}}",
    body: `✨ *A Very Good Day to You, {{client_name}}!* ✨

I am delighted to inform you that your registration has been approved!

You are now the official CEO of *{{business_name}}*.

👏🏻👏🏻👏🏻 *Congratulations!*

Other post-registration processes are currently underway and will be concluded shortly.

*We celebrate this milestone with you!*

Welcome to a new chapter of growth, vision and success.

🎉 *Congratulations once again!* 🎉

Warm regards,
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "business_name",
      "registration_type",
      "approval_date",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request", "client_360"],
    isDefaultForWorkflow: "send_congratulations",
    verificationGuard: "cac_approved",
    usageCount: 31,
  },

  // =========================================================================
  // PART 3 — TEMPLATE 3: BUSINESS NAME REGISTRATION REQUIREMENTS
  // =========================================================================
  {
    id: "tpl-bn-registration-requirements",
    slug: "business-name-registration-requirements",
    name: "Business Name Registration Requirements",
    category: "information_document_requests",
    description:
      "Official checklist of Personal, Residential, Business, and Supporting Document requirements for Business Name Registration.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Requirements for Business Name Registration — ABLEBIZ",
    body: `Dear {{client_name}},

To proceed with your Business Name Registration, kindly provide the information and supporting documents listed below.

Please use any ONE of the options provided in the form, where applicable. Kindly select just one option and let us know if you have any questions.

### REQUIREMENTS FOR BUSINESS NAME REGISTRATION

*PERSONAL INFORMATION*

1. Surname
2. First Name
3. Other Name(s)
4. Date of Birth
5. Gender
6. Phone Number
7. Functional Email Address

*RESIDENTIAL ADDRESS*

1. House Number / Building Name
2. Street Name
3. City / Town / Village
4. Local Government Area (LGA)
5. State

*BUSINESS ADDRESS*

1. House Number / Building Name
2. Street Name
3. City / Town / Village
4. Local Government Area (LGA)
5. State

*BUSINESS INFORMATION*

1. Nature of Business
2. Proposed Business Name — Option 1
3. Proposed Business Name — Option 2
4. Functional Email Address

*SUPPORTING DOCUMENTS*

All documents must be clear and readable.

1. *Valid Identification:* Take a clear picture of your ID card or use a document-scanning application.
2. *Passport Photograph:* Provide a clear passport photograph.
3. *Signature:* Sign on a plain piece of paper and take a clear picture of your signature.

Kindly ensure that all information provided is accurate and all documents are legible.

If you have any questions or need assistance, please do not hesitate to contact us.

Thank you for choosing ABLEBIZ BUSINESS SERVICES.`,
    supportedVariables: ["client_name", "service_name", "staff_name"],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request", "client_360", "leads"],
    isDefaultForWorkflow: "send_registration_requirements",
    verificationGuard: null,
    usageCount: 42,
  },

  // =========================================================================
  // PART 4 — A. WELCOME TO ABLEBIZ
  // =========================================================================
  {
    id: "tpl-welcome-ablebiz",
    slug: "welcome-to-ablebiz",
    name: "Welcome to ABLEBIZ",
    category: "welcome_onboarding",
    description:
      "Warm welcome message acknowledging a new client and explaining the next step in their onboarding journey.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Welcome to ABLEBIZ BUSINESS SERVICES — {{client_name}}",
    body: `Dear {{client_name}},

Welcome to *ABLEBIZ BUSINESS SERVICES*! We are honoured to partner with you on your corporate and business compliance journey.

Your profile has been set up for *{{service_name}}*, and {{assigned_officer}} has been assigned to support you through every step of the process.

*Next Step:*
{{relevant_next_step}}

If you have any questions at any time, simply reply to this message or reach us via {{business_contact_info}}.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "assigned_officer",
      "relevant_next_step",
      "business_contact_info",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: ALL_OPERATIONAL_ROLES,
    workflowContexts: ["client_360", "leads", "service_request"],
    isDefaultForWorkflow: "send_onboarding",
    verificationGuard: null,
    usageCount: 19,
  },

  // =========================================================================
  // PART 4 — B. REQUEST FOR MISSING INFORMATION
  // =========================================================================
  {
    id: "tpl-request-missing-info",
    slug: "request-missing-information",
    name: "Request for Missing Information",
    category: "information_document_requests",
    description:
      "Dynamic template allowing staff to list specific missing details needed to proceed with a client's request.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Action Required: Information Needed for {{service_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

Thank you for choosing ABLEBIZ BUSINESS SERVICES for your *{{service_name}}* (Ref: {{service_request_reference}}).

To enable our team to proceed without delay, kindly provide the following pending information:

{{missing_information_list}}

Once we receive these details, we will immediately advance your application to the next stage.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "service_request_reference",
      "missing_information_list",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations"],
    isDefaultForWorkflow: "request_information",
    verificationGuard: null,
    usageCount: 18,
  },

  // =========================================================================
  // PART 4 — C. REQUEST FOR SUPPORTING DOCUMENTS
  // =========================================================================
  {
    id: "tpl-request-supporting-docs",
    slug: "request-supporting-documents",
    name: "Request for Supporting Documents",
    category: "information_document_requests",
    description:
      "Dynamic template for requesting missing or clearer supporting documents (ID card, passport photo, signature, etc.).",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Supporting Documents Required for {{business_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

We are currently reviewing your *{{service_name}}* file for *{{business_name}}*.

To complete your documentation, kindly provide clear and legible copies of the following supporting documents:

{{missing_documents}}

*Tip:* Ensure all corners of your ID card are visible, your passport photograph has a plain background, and your signature is signed clearly on plain white paper.

Kindly send them in reply to this message so we can proceed promptly.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "business_name",
      "missing_documents",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations"],
    isDefaultForWorkflow: "request_documents",
    verificationGuard: null,
    usageCount: 22,
  },

  // =========================================================================
  // PART 4 — D. REGISTRATION IN PROGRESS
  // =========================================================================
  {
    id: "tpl-registration-in-progress",
    slug: "registration-in-progress",
    name: "Registration In Progress",
    category: "registration_updates",
    description:
      "Reassures the client that their registration is actively being processed without inventing unverified completion dates.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Registration Update for {{business_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

This is a status update regarding your *{{registration_type}}* for *{{business_name}}* (Ref: {{application_reference}}).

Your application is currently in the *{{current_stage}}* stage and is actively being processed by our operations team.

*Next Step:*
{{relevant_next_step}}

We will notify you immediately as soon as the next milestone is reached. Thank you for your patience and trust in ABLEBIZ BUSINESS SERVICES.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "registration_type",
      "business_name",
      "application_reference",
      "current_stage",
      "relevant_next_step",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request", "client_360"],
    isDefaultForWorkflow: null,
    verificationGuard: null,
    usageCount: 15,
  },

  // =========================================================================
  // PART 4 — E. APPLICATION SUBMITTED
  // =========================================================================
  {
    id: "tpl-application-submitted",
    slug: "application-submitted",
    name: "Application Submitted to CAC",
    category: "registration_updates",
    description:
      "Notifies the client that their registration application has been formally submitted for official review.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Application Submitted: {{business_name}} ({{application_reference}}) — ABLEBIZ",
    body: `Dear {{client_name}},

We are pleased to inform you that your *{{registration_type}}* application for *{{business_name}}* (Ref: {{application_reference}}) has been officially submitted on {{submission_date}}.

Your filing is now undergoing official review. Our registration team is monitoring the progress closely and will update you as soon as a decision or approval is issued.

Thank you for choosing ABLEBIZ BUSINESS SERVICES.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "registration_type",
      "business_name",
      "application_reference",
      "submission_date",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request"],
    isDefaultForWorkflow: "send_submission_update",
    verificationGuard: "cac_submitted",
    usageCount: 14,
  },

  // =========================================================================
  // PART 4 — F. APPLICATION RETURNED FOR CORRECTION
  // =========================================================================
  {
    id: "tpl-application-returned-correction",
    slug: "application-returned-for-correction",
    name: "Application Returned for Correction",
    category: "registration_updates",
    description:
      "Politely informs the client when an application is queried or requires a correction, stating the reason, required action, and next steps.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Urgent Attention: Update Required for {{business_name}} Registration — ABLEBIZ",
    body: `Dear {{client_name}},

Regarding your *{{registration_type}}* application for *{{business_name}}* (Ref: {{application_reference}}), a review query has been raised that requires a quick adjustment before approval can be finalized.

*Reason for Query:*
{{correction_reason}}

*Required Correction / Action:*
{{required_correction}}

*Next Steps:*
{{relevant_next_step}}

Kindly share the updated information or document at your earliest convenience so our team can re-submit immediately.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "registration_type",
      "business_name",
      "application_reference",
      "correction_reason",
      "required_correction",
      "relevant_next_step",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request", "client_360"],
    isDefaultForWorkflow: "send_correction_request",
    verificationGuard: null,
    usageCount: 9,
  },

  // =========================================================================
  // PART 4 — G. REGISTRATION APPROVED (FORMAL)
  // =========================================================================
  {
    id: "tpl-registration-approved-formal",
    slug: "registration-approved-formal",
    name: "Registration Approved (Formal Notification)",
    category: "approval_congratulations",
    description:
      "Formal email and WhatsApp notification confirming official CAC approval, approved name, and registration number.",
    defaultChannel: "email",
    supportedChannels: ["email", "whatsapp"],
    subject: "Official Registration Approval: {{business_name}} ({{certificate_number}}) — ABLEBIZ",
    body: `Dear {{client_name}},

We are pleased to formally notify you that your *{{registration_type}}* has been officially approved!

*Approved Business Name:* {{business_name}}
*Registration / Certificate Number:* {{certificate_number}}
*Approval Date:* {{approval_date}}

Our operations team is now finalizing the extraction and quality check of your official registration certificate and status report for delivery to you.

Congratulations on this achievement, and thank you for trusting ABLEBIZ BUSINESS SERVICES.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "registration_type",
      "business_name",
      "certificate_number",
      "approval_date",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CAC_ROLES,
    workflowContexts: ["cac_operations", "service_request", "client_360"],
    isDefaultForWorkflow: null,
    verificationGuard: "cac_approved",
    usageCount: 16,
  },

  // =========================================================================
  // PART 4 — H. DOCUMENTS DELIVERED
  // =========================================================================
  {
    id: "tpl-documents-delivered",
    slug: "documents-delivered-confirmation",
    name: "Documents Delivered Confirmation",
    category: "document_delivery",
    description:
      "Confirms that official documents have been dispatched to the client with the exact delivery destination and date.",
    defaultChannel: "email",
    supportedChannels: ["email", "whatsapp"],
    subject: "Official Documents Dispatched for {{business_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

Your official documents for *{{business_name}}* (*{{service_name}}*) have been dispatched.

*Delivery Destination:* {{delivery_email}}
*Delivery Date:* {{delivery_date}}
*Registration Reference:* {{certificate_number}}

Please download and keep both digital and printed copies of your registration documents in a safe place. If you cannot locate the email in your Primary Inbox, kindly check your Spam/Junk folder and mark it as "Not Spam".

We would also love to hear about your experience with us:
{{feedback_link}}

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "business_name",
      "service_name",
      "delivery_email",
      "delivery_date",
      "certificate_number",
      "feedback_link",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations"],
    isDefaultForWorkflow: null,
    verificationGuard: null,
    usageCount: 12,
  },

  // =========================================================================
  // PART 4 — I. PAYMENT CONFIRMATION
  // =========================================================================
  {
    id: "tpl-payment-confirmation",
    slug: "payment-confirmation",
    name: "Payment Confirmation",
    category: "payment_invoice_notifications",
    description:
      "Confirms a payment that has been verified and reconciled in the ABLEBIZ Finance module.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Payment Confirmation — Invoice {{invoice_number}} ({{receipt_number}}) — ABLEBIZ",
    body: `Dear {{client_name}},

We confirm with thanks the receipt and verification of your payment for *{{service_name}}*.

*Invoice Number:* {{invoice_number}}
*Receipt Number:* {{receipt_number}}
*Invoice Total:* {{invoice_amount}}
*Outstanding Balance:* {{outstanding_balance}}
*Verified Date:* {{verified_payment_date}}

Your service request is actively being processed by our operations team. Thank you for your prompt payment and continued trust in ABLEBIZ BUSINESS SERVICES.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "invoice_number",
      "receipt_number",
      "invoice_amount",
      "outstanding_balance",
      "verified_payment_date",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: FINANCE_ROLES,
    workflowContexts: ["finance", "client_360", "service_request"],
    isDefaultForWorkflow: "send_payment_confirmation",
    verificationGuard: "payment_verified",
    usageCount: 20,
  },

  // =========================================================================
  // PART 4 — J. OUTSTANDING PAYMENT REMINDER
  // =========================================================================
  {
    id: "tpl-outstanding-payment-reminder",
    slug: "outstanding-payment-reminder",
    name: "Outstanding Payment Reminder",
    category: "payment_invoice_notifications",
    description:
      "Polite reminder for an unpaid or partially paid invoice, including approved ABLEBIZ bank account details.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Payment Reminder: Invoice {{invoice_number}} for {{service_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

We hope you are doing well. This is a friendly reminder regarding the outstanding balance on your invoice for *{{service_name}}*.

*Invoice Number:* {{invoice_number}}
*Total Invoice Amount:* {{invoice_amount}}
*Amount Outstanding:* {{outstanding_balance}}
*Due Date:* {{due_date}}

*Approved Payment Details:*
{{payment_instructions}}

Kindly share your payment receipt once transfer is completed so our Finance team can reconcile your account and advance your service request immediately.

If you have already made this payment, please disregard this reminder and share the receipt with us.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "invoice_number",
      "invoice_amount",
      "outstanding_balance",
      "due_date",
      "payment_instructions",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: FINANCE_ROLES,
    workflowContexts: ["finance", "client_360", "service_request"],
    isDefaultForWorkflow: "send_payment_reminder",
    verificationGuard: null,
    usageCount: 17,
  },

  // =========================================================================
  // PART 4 — K. SERVICE COMPLETION & APPRECIATION
  // =========================================================================
  {
    id: "tpl-service-completion-appreciation",
    slug: "service-completion-appreciation",
    name: "Service Completion & Appreciation",
    category: "service_completion",
    description:
      "Closes a completed service request with appreciation and information on ongoing compliance support.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Service Completed: {{service_name}} for {{business_name}} — ABLEBIZ",
    body: `Dear {{client_name}},

We are pleased to confirm that your *{{service_name}}* (Ref: {{service_request_reference}}) for *{{business_name}}* has now been formally completed.

It has been a pleasure serving you. Should you require additional support—such as Annual Returns filing, TIN/Tax clearance, SCUML, trademark registration, or corporate advisory—our team is always ready to assist.

We truly appreciate your business and wish *{{business_name}}* continued growth and success!

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "service_request_reference",
      "business_name",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["service_request", "client_360", "cac_operations"],
    isDefaultForWorkflow: null,
    verificationGuard: null,
    usageCount: 14,
  },

  // =========================================================================
  // PART 4 — L. FEEDBACK REQUEST
  // =========================================================================
  {
    id: "tpl-feedback-request",
    slug: "feedback-request",
    name: "Client Feedback Request",
    category: "feedback_reviews",
    description:
      "Invites the client to share their experience using the official ABLEBIZ feedback link.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "We Value Your Feedback — ABLEBIZ BUSINESS SERVICES",
    body: `Dear {{client_name}},

Thank you for choosing *ABLEBIZ BUSINESS SERVICES* for your *{{service_name}}*.

We are committed to delivering exceptional service to every business owner we work with, and your feedback helps us serve you even better.

Kindly take 60 seconds to share your thoughts using our official feedback link below:

http://bit.ly/ablefeedback

Thank you for your time and support!

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "feedback_link",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: ALL_OPERATIONAL_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations"],
    isDefaultForWorkflow: "send_feedback_request",
    verificationGuard: null,
    usageCount: 21,
  },

  // =========================================================================
  // PART 4 — M. REFERRAL REQUEST
  // =========================================================================
  {
    id: "tpl-referral-request",
    slug: "referral-request",
    name: "Client Referral Invitation",
    category: "referral_requests",
    description:
      "Invites satisfied clients to refer friends, colleagues, and entrepreneurs using their actual referral code.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Refer a Business Owner to ABLEBIZ BUSINESS SERVICES",
    body: `Dear {{client_name}},

Thank you for trusting *ABLEBIZ BUSINESS SERVICES* with *{{business_name}}*.

Do you know a friend, partner, or entrepreneur who needs seamless CAC Business Registration, Company Incorporation, NGO Registration, or Regulatory Compliance support?

You can refer them directly using your referral code: *{{referral_code}}*
Referral Link: {{referral_link}}

We promise to give everyone you refer the same dedicated, professional care. Thank you for spreading the word!

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "business_name",
      "referral_code",
      "referral_link",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: MARKETING_AND_CS_ROLES,
    workflowContexts: ["client_360", "leads", "service_request"],
    isDefaultForWorkflow: "send_referral_request",
    verificationGuard: null,
    usageCount: 8,
  },

  // =========================================================================
  // PART 4 — N. FOLLOW-UP MESSAGE
  // =========================================================================
  {
    id: "tpl-followup-message",
    slug: "followup-pending-response",
    name: "Follow-up on Pending Client Request",
    category: "followup_reminders",
    description:
      "Polite follow-up when a client has not yet responded or submitted pending items for a specific service request.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Following Up on Your {{service_name}} Request ({{service_request_reference}}) — ABLEBIZ",
    body: `Dear {{client_name}},

I hope your week is going well.

I am following up regarding your *{{service_name}}* request (Ref: *{{service_request_reference}}*). We are currently awaiting your response on the next step below so we can keep your application moving smoothly:

*Pending Step:*
{{relevant_next_step}}

Please let us know if you have any questions or if you would like a quick phone call from our team to assist you.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "service_request_reference",
      "relevant_next_step",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: ALL_OPERATIONAL_ROLES,
    workflowContexts: ["client_360", "service_request", "cac_operations", "leads"],
    isDefaultForWorkflow: null,
    verificationGuard: null,
    usageCount: 16,
  },

  // =========================================================================
  // PART 4 — O. GENERAL CLIENT UPDATE
  // =========================================================================
  {
    id: "tpl-general-client-update",
    slug: "general-client-update",
    name: "General Client Update",
    category: "general_communication",
    description:
      "Clean, adaptable template for general professional updates and correspondence with a client.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Update Regarding {{business_name}} — ABLEBIZ BUSINESS SERVICES",
    body: `Dear {{client_name}},

Greetings from *ABLEBIZ BUSINESS SERVICES*.

We are reaching out with an update regarding *{{business_name}}* (*{{service_name}}*):

{{relevant_next_step}}

Should you require any clarification, please reply directly to this message or contact us via {{business_contact_info}}.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "business_name",
      "service_name",
      "relevant_next_step",
      "business_contact_info",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: ALL_OPERATIONAL_ROLES,
    workflowContexts: [
      "client_360",
      "service_request",
      "cac_operations",
      "finance",
      "leads",
      "general",
    ],
    isDefaultForWorkflow: "send_prepared_message",
    verificationGuard: null,
    usageCount: 25,
  },

  // =========================================================================
  // ADDITIONAL WORKFLOW TEMPLATES: SERVICE PROGRESS UPDATE & INVOICE NOTIFICATION
  // =========================================================================
  {
    id: "tpl-service-progress-milestone",
    slug: "service-progress-update",
    name: "Service Request Progress Update",
    category: "service_progress_updates",
    description:
      "Updates the client on the current status and next step of their active service request.",
    defaultChannel: "whatsapp",
    supportedChannels: ["whatsapp", "email"],
    subject: "Service Update: {{service_name}} ({{service_request_reference}}) — ABLEBIZ",
    body: `Dear {{client_name}},

Here is the latest progress update on your *{{service_name}}* request (Ref: *{{service_request_reference}}*):

*Current Status:* {{current_status}}
*Assigned Officer:* {{assigned_officer}}

*Next Step:*
{{relevant_next_step}}

Thank you for choosing ABLEBIZ BUSINESS SERVICES.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "service_request_reference",
      "current_status",
      "assigned_officer",
      "relevant_next_step",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: CLIENT_AND_OPS_ROLES,
    workflowContexts: ["service_request", "client_360"],
    isDefaultForWorkflow: "send_service_update",
    verificationGuard: null,
    usageCount: 19,
  },
  {
    id: "tpl-invoice-issued-notification",
    slug: "invoice-issued-notification",
    name: "New Invoice Notification",
    category: "payment_invoice_notifications",
    description:
      "Shares invoice details and approved ABLEBIZ bank account instructions with a client.",
    defaultChannel: "email",
    supportedChannels: ["email", "whatsapp"],
    subject: "Invoice {{invoice_number}} for {{service_name}} — ABLEBIZ BUSINESS SERVICES",
    body: `Dear {{client_name}},

Please find below the invoice summary for your *{{service_name}}* with *ABLEBIZ BUSINESS SERVICES*:

*Invoice Number:* {{invoice_number}}
*Total Amount:* {{invoice_amount}}
*Balance Due:* {{outstanding_balance}}
*Due Date:* {{due_date}}

*Approved Bank Payment Details:*
{{payment_instructions}}

Kindly reference your Invoice Number (*{{invoice_number}}*) when making the transfer and share your payment receipt with us for immediate confirmation.

Warm regards,
*{{staff_name}}*
ABLEBIZ BUSINESS SERVICES`,
    supportedVariables: [
      "client_name",
      "service_name",
      "invoice_number",
      "invoice_amount",
      "outstanding_balance",
      "due_date",
      "payment_instructions",
      "staff_name",
    ],
    isActive: true,
    isSystemSeed: true,
    createdBy: "system",
    createdByName: "ABLEBIZ System",
    updatedAt: "2026-11-10T09:00:00.000Z",
    allowedRoles: FINANCE_ROLES,
    workflowContexts: ["finance", "client_360", "service_request"],
    isDefaultForWorkflow: "send_invoice_notification",
    verificationGuard: null,
    usageCount: 13,
  },
];

export function getCategoryMeta(
  categoryId: TemplateCategoryId
): TemplateCategoryMeta {
  return (
    TEMPLATE_CATEGORIES.find((c) => c.id === categoryId) || {
      id: "general_communication",
      name: "General Client Communication",
      description: "General client correspondence",
      badgeTone: "slate",
    }
  );
}

export function findDefaultTemplateForIntent(
  templates: MessageTemplate[],
  intent?: CommunicationActionIntent | null
): MessageTemplate | undefined {
  if (!intent) return undefined;
  const active = templates.filter((t) => t.isActive);

  const byWorkflowFlag = active.find((t) => t.isDefaultForWorkflow === intent);
  if (byWorkflowFlag) return byWorkflowFlag;

  const fallbackSlugMap: Partial<Record<CommunicationActionIntent, string>> = {
    send_document_delivery: "document-delivery-and-feedback-request",
    send_congratulations: "registration-approval-congratulations",
    send_registration_requirements: "business-name-registration-requirements",
    send_onboarding: "welcome-to-ablebiz",
    request_information: "request-missing-information",
    request_documents: "request-supporting-documents",
    send_submission_update: "application-submitted",
    send_correction_request: "application-returned-for-correction",
    send_payment_confirmation: "payment-confirmation",
    send_payment_reminder: "outstanding-payment-reminder",
    send_invoice_notification: "invoice-issued-notification",
    send_feedback_request: "feedback-request",
    send_referral_request: "referral-request",
    send_service_update: "service-progress-update",
    send_prepared_message: "general-client-update",
  };

  const targetSlug = fallbackSlugMap[intent];
  if (targetSlug) {
    return active.find((t) => t.slug === targetSlug);
  }
  return undefined;
}

export function filterTemplates(
  templates: MessageTemplate[],
  options: {
    searchQuery?: string;
    category?: TemplateCategoryId | "all";
    workflowContext?: WorkflowContextType | "all";
    includeInactive?: boolean;
    role?: CanonicalStaffRole | null;
  }
): MessageTemplate[] {
  const query = (options.searchQuery || "").trim().toLowerCase();

  return templates.filter((tpl) => {
    if (!options.includeInactive && !tpl.isActive) {
      return false;
    }
    if (
      options.category &&
      options.category !== "all" &&
      tpl.category !== options.category
    ) {
      return false;
    }
    if (
      options.workflowContext &&
      options.workflowContext !== "all" &&
      !tpl.workflowContexts.includes(options.workflowContext) &&
      !tpl.workflowContexts.includes("general")
    ) {
      return false;
    }
    if (
      options.role &&
      tpl.allowedRoles.length > 0 &&
      !tpl.allowedRoles.includes(options.role)
    ) {
      return false;
    }
    if (query) {
      const hay = `${tpl.name} ${tpl.slug} ${tpl.description} ${tpl.subject || ""} ${tpl.body}`.toLowerCase();
      if (!hay.includes(query)) {
        return false;
      }
    }
    return true;
  });
}
