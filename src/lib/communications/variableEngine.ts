import type {
  BusinessBankAccount,
  BusinessProfile,
} from "../../types/businessProfile";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "./emailConfig";
import type {
  ClientContactContext,
  DynamicVariableContext,
  DynamicVariableDefinition,
} from "./types";

export const OFFICIAL_FEEDBACK_URL = "http://bit.ly/ablefeedback";

export const VARIABLE_REGISTRY: DynamicVariableDefinition[] = [
  // Client Variables
  {
    key: "client_name",
    token: "{{client_name}}",
    label: "Client Name",
    group: "client",
    description: "Full name of the client or lead",
    example: "Adebayo Ogunlesi",
  },
  {
    key: "client_phone",
    token: "{{client_phone}}",
    label: "Client Phone",
    group: "client",
    description: "Primary telephone number of the client",
    example: "+234 803 123 4567",
  },
  {
    key: "client_email",
    token: "{{client_email}}",
    label: "Client Email",
    group: "client",
    description: "Registered email address of the client",
    example: "client@example.com",
  },
  {
    key: "client_business_name",
    token: "{{client_business_name}}",
    label: "Client Business Name",
    group: "client",
    description: "Associated business or company name on the client profile",
    example: "Primegate Ventures",
  },
  {
    key: "contact_person",
    token: "{{contact_person}}",
    label: "Contact Person",
    group: "client",
    description: "Designated contact person for the client or company",
    example: "Mrs. Funke Adeyemi",
  },

  // Business Variables
  {
    key: "business_name",
    token: "{{business_name}}",
    label: "Business Name",
    group: "business",
    description: "Approved or proposed business/company name",
    example: "Apex Global Logistics Ltd",
  },
  {
    key: "business_type",
    token: "{{business_type}}",
    label: "Business Type",
    group: "business",
    description: "Entity classification (Business Name, Limited Liability Company, Incorporated Trustees)",
    example: "Business Name",
  },
  {
    key: "business_registration_number",
    token: "{{business_registration_number}}",
    label: "Registration Number (BN/RC/IT)",
    group: "business",
    description: "Official CAC registration number when issued",
    example: "BN 3948210",
  },

  // Service Request Variables
  {
    key: "service_name",
    token: "{{service_name}}",
    label: "Service Name",
    group: "service_request",
    description: "Name of the service requested by the client",
    example: "Business Name Registration",
  },
  {
    key: "service_request_reference",
    token: "{{service_request_reference}}",
    label: "Service Request Reference",
    group: "service_request",
    description: "Unique tracking reference code for the service request",
    example: "SR-2026-0142",
  },
  {
    key: "assigned_officer",
    token: "{{assigned_officer}}",
    label: "Assigned Officer",
    group: "service_request",
    description: "Name of the ABLEBIZ officer handling the service request",
    example: "Chidinma Okafor",
  },
  {
    key: "current_status",
    token: "{{current_status}}",
    label: "Current Service Status",
    group: "service_request",
    description: "Current operational status of the service request",
    example: "In Progress",
  },
  {
    key: "request_date",
    token: "{{request_date}}",
    label: "Request Date",
    group: "service_request",
    description: "Date the service request was initiated",
    example: "10 Nov 2026",
  },
  {
    key: "relevant_next_step",
    token: "{{relevant_next_step}}",
    label: "Relevant Next Step",
    group: "service_request",
    description: "Clear description of the next step in the workflow",
    example: "Verification of uploaded identification documents and CAC filing.",
  },
  {
    key: "missing_information_list",
    token: "{{missing_information_list}}",
    label: "Missing Information List",
    group: "service_request",
    description: "Bullet list of missing client details required to proceed",
    example: "• Residential Street Address and LGA\n• Date of Birth\n• Functional Email Address",
  },

  // CAC Operations Variables
  {
    key: "registration_type",
    token: "{{registration_type}}",
    label: "CAC Registration Type",
    group: "cac_operations",
    description: "CAC registration category (Business Name, Limited Company, NGO/IT)",
    example: "Business Name Registration",
  },
  {
    key: "application_reference",
    token: "{{application_reference}}",
    label: "CAC Application Reference",
    group: "cac_operations",
    description: "Application tracking reference or filing code",
    example: "CAC-BN-2026-089",
  },
  {
    key: "current_stage",
    token: "{{current_stage}}",
    label: "Current CAC Stage",
    group: "cac_operations",
    description: "Human-readable CAC pipeline stage",
    example: "Submitted to CAC",
  },
  {
    key: "approval_date",
    token: "{{approval_date}}",
    label: "Approval Date",
    group: "cac_operations",
    description: "Confirmed date of registration approval",
    example: "10 Nov 2026",
  },
  {
    key: "submission_date",
    token: "{{submission_date}}",
    label: "Submission Date",
    group: "cac_operations",
    description: "Confirmed date the application was submitted to CAC",
    example: "08 Nov 2026",
  },
  {
    key: "certificate_number",
    token: "{{certificate_number}}",
    label: "Certificate / RC / BN Number",
    group: "cac_operations",
    description: "Issued CAC Certificate or BN/RC number",
    example: "BN 4102938",
  },
  {
    key: "missing_documents",
    token: "{{missing_documents}}",
    label: "Missing Supporting Documents",
    group: "cac_operations",
    description: "Bullet list of missing or unclear supporting documents",
    example: "• Clear copy of Valid Government ID\n• Recent Passport Photograph\n• Signature on plain white paper",
  },
  {
    key: "correction_reason",
    token: "{{correction_reason}}",
    label: "Reason for Query / Return",
    group: "cac_operations",
    description: "Reason an application was queried or returned for correction",
    example: "The uploaded ID card image was blurry and the surname spelling differed from the form.",
  },
  {
    key: "required_correction",
    token: "{{required_correction}}",
    label: "Required Correction Action",
    group: "cac_operations",
    description: "Specific action required from the client to resolve the query",
    example: "Kindly send a clear scan/photo of your valid ID card and confirm the exact surname spelling.",
  },

  // Finance Variables
  {
    key: "invoice_number",
    token: "{{invoice_number}}",
    label: "Invoice Number",
    group: "finance",
    description: "Official ABLEBIZ invoice number",
    example: "INV-2026-0045",
  },
  {
    key: "invoice_amount",
    token: "{{invoice_amount}}",
    label: "Invoice Total Amount",
    group: "finance",
    description: "Formatted total invoice amount in NGN",
    example: "₦35,000.00",
  },
  {
    key: "outstanding_balance",
    token: "{{outstanding_balance}}",
    label: "Outstanding Balance",
    group: "finance",
    description: "Formatted unpaid balance remaining on the invoice",
    example: "₦15,000.00",
  },
  {
    key: "due_date",
    token: "{{due_date}}",
    label: "Invoice Due Date",
    group: "finance",
    description: "Payment due date for the invoice",
    example: "17 Nov 2026",
  },
  {
    key: "verified_payment_date",
    token: "{{verified_payment_date}}",
    label: "Verified Payment Date",
    group: "finance",
    description: "Date the client's payment was verified and reconciled",
    example: "10 Nov 2026",
  },
  {
    key: "receipt_number",
    token: "{{receipt_number}}",
    label: "Receipt Number",
    group: "finance",
    description: "Official payment receipt reference number",
    example: "RCP-2026-0118",
  },
  {
    key: "payment_instructions",
    token: "{{payment_instructions}}",
    label: "Approved Payment Instructions",
    group: "finance",
    description: "Approved ABLEBIZ bank account details from Business Profile",
    example: "Bank: Moniepoint MFB | Account Name: ABLEBIZ BUSINESS SERVICES | Account No: 8122399110",
  },

  // Communication, Delivery & Staff Variables
  {
    key: "delivery_email",
    token: "{{delivery_email}}",
    label: "Delivery Email Address",
    group: "communication",
    description: "Email address to which official documents were delivered",
    example: "client@example.com",
  },
  {
    key: "delivery_date",
    token: "{{delivery_date}}",
    label: "Delivery Date",
    group: "communication",
    description: "Date documents were delivered to the client",
    example: "10 Nov 2026",
  },
  {
    key: "feedback_link",
    token: "{{feedback_link}}",
    label: "Official Feedback Link",
    group: "communication",
    description: "ABLEBIZ client feedback link",
    example: OFFICIAL_FEEDBACK_URL,
  },
  {
    key: "referral_code",
    token: "{{referral_code}}",
    label: "Client Referral Code",
    group: "communication",
    description: "Client's actual referral code (only populated if assigned)",
    example: "ABLE-REF-904",
  },
  {
    key: "referral_link",
    token: "{{referral_link}}",
    label: "Client Referral Link",
    group: "communication",
    description: "Client's actual referral link (only populated if assigned)",
    example: "https://ablebiz.com.ng/?ref=ABLE-REF-904",
  },
  {
    key: "staff_name",
    token: "{{staff_name}}",
    label: "Staff Member Name",
    group: "communication",
    description: "Full name of the staff member sending the communication",
    example: "Oluwaseun Adewale",
  },
  {
    key: "staff_designation",
    token: "{{staff_designation}}",
    label: "Staff Designation / Role",
    group: "communication",
    description: "Role or title of the staff member",
    example: "Client Service Officer",
  },
  {
    key: "business_contact_info",
    token: "{{business_contact_info}}",
    label: "Official Business Contact Info",
    group: "communication",
    description: "Official ABLEBIZ email and telephone contact summary",
    example: "hello@ablebiz.com.ng | +234 812 239 9110",
  },
];

const KNOWN_VARIABLE_KEYS = new Set(VARIABLE_REGISTRY.map((v) => v.key));

export interface TemplateSafetyValidationResult {
  isSafe: boolean;
  errors: string[];
  unknownVariables: string[];
}

/**
 * Validates that template subject/body contains no executable expressions,
 * script tags, SQL fragments, or malformed placeholders.
 */
export function validateTemplateContentSafety(
  text: string
): TemplateSafetyValidationResult {
  const errors: string[] = [];
  const unknownVariables: string[] = [];

  if (!text) {
    return { isSafe: true, errors: [], unknownVariables: [] };
  }

  // Block dangerous script/code patterns
  const dangerousPatterns: Array<{ pattern: RegExp; reason: string }> = [
    {
      pattern: /<\s*script\b/i,
      reason: "Executable <script> tags are forbidden in communication templates.",
    },
    {
      pattern: /javascript\s*:/i,
      reason: "javascript: URLs are forbidden in communication templates.",
    },
    {
      pattern: /\bon(error|load|click|mouseover|focus)\s*=/i,
      reason: "Inline DOM event handlers are forbidden in communication templates.",
    },
    {
      pattern: /\b(eval|Function|setTimeout|setInterval)\s*\(/,
      reason: "Executable JavaScript expressions are forbidden in templates.",
    },
    {
      pattern: /\$\{[^}]+\}/,
      reason: "JavaScript template literal interpolation (${...}) is forbidden; use {{variable_name}} syntax.",
    },
    {
      pattern: /\b(DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|UNION\s+SELECT)\b/i,
      reason: "SQL statements are forbidden inside message templates.",
    },
  ];

  for (const rule of dangerousPatterns) {
    if (rule.pattern.test(text)) {
      errors.push(rule.reason);
    }
  }

  // Inspect all {{...}} tokens
  const tokenMatches = text.matchAll(/\{\{([^}]+)\}\}/g);
  for (const match of tokenMatches) {
    const rawInside = match[1].trim();
    if (!/^[a-z0-9_]+$/i.test(rawInside)) {
      errors.push(
        `Invalid placeholder syntax "{{${rawInside}}}". Placeholders may only contain letters, numbers, and underscores.`
      );
      continue;
    }
    const normalizedKey = rawInside.toLowerCase();
    if (!KNOWN_VARIABLE_KEYS.has(normalizedKey)) {
      unknownVariables.push(normalizedKey);
    }
  }

  return {
    isSafe: errors.length === 0,
    errors,
    unknownVariables: Array.from(new Set(unknownVariables)),
  };
}

/**
 * Extracts all unique variable keys referenced in a template string (e.g. ["client_name", "business_name"]).
 */
export function extractTemplateVariables(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  for (const match of matches) {
    found.add(match[1].toLowerCase());
  }
  return Array.from(found);
}

export interface VariableResolutionResult {
  resolvedText: string;
  resolvedSubject: string;
  usedVariables: string[];
  missingVariables: DynamicVariableDefinition[];
  unresolvedTokens: string[];
  hasUnresolvedVariables: boolean;
}

/**
 * Resolves {{variable}} tokens in a template body and optional subject using actual values.
 * Never invents missing values: if a value is empty/missing, the {{variable}} token remains intact
 * so the staff member is explicitly warned and can fill it in or edit the sentence before sending.
 */
export function resolveTemplateVariables(
  body: string,
  context: DynamicVariableContext,
  options?: {
    subject?: string;
    manualOverrides?: Record<string, string>;
  }
): VariableResolutionResult {
  const mergedContext: Record<string, string> = {};

  for (const [k, v] of Object.entries(context)) {
    if (typeof v === "string" && v.trim().length > 0) {
      mergedContext[k.toLowerCase()] = v.trim();
    }
  }

  if (options?.manualOverrides) {
    for (const [k, v] of Object.entries(options.manualOverrides)) {
      if (typeof v === "string" && v.trim().length > 0) {
        mergedContext[k.toLowerCase()] = v.trim();
      }
    }
  }

  const usedVariables = new Set<string>();
  const unresolvedKeySet = new Set<string>();

  const replaceTokens = (input: string): string => {
    if (!input) return "";
    return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (fullMatch, rawKey: string) => {
      const key = rawKey.toLowerCase();
      usedVariables.add(key);
      const value = mergedContext[key];
      if (value !== undefined && value.trim().length > 0) {
        return value;
      }
      unresolvedKeySet.add(key);
      return `{{${key}}}`;
    });
  };

  const resolvedSubject = replaceTokens(options?.subject || "");
  const resolvedText = replaceTokens(body || "");

  const missingVariables: DynamicVariableDefinition[] = Array.from(unresolvedKeySet).map(
    (key) =>
      VARIABLE_REGISTRY.find((v) => v.key === key) || {
        key,
        token: `{{${key}}}`,
        label: key
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        group: "communication",
        description: `Custom placeholder {{${key}}}`,
        example: "",
      }
  );

  return {
    resolvedText,
    resolvedSubject,
    usedVariables: Array.from(usedVariables),
    missingVariables,
    unresolvedTokens: Array.from(unresolvedKeySet).map((k) => `{{${k}}}`),
    hasUnresolvedVariables: unresolvedKeySet.size > 0,
  };
}

function formatNaira(amount?: number | null): string | undefined {
  if (typeof amount !== "number" || Number.isNaN(amount)) return undefined;
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatReadableDate(isoOrDate?: string | null): string | undefined {
  if (!isoOrDate) return undefined;
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function humanizeStageOrStatus(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const map: Record<string, string> = {
    new_request: "New Request",
    awaiting_client_details: "Awaiting Client Details",
    awaiting_documents: "Awaiting Supporting Documents",
    awaiting_payment: "Awaiting Payment",
    ready_for_processing: "Ready for Processing",
    in_progress: "In Progress",
    submitted_to_cac: "Submitted to CAC",
    queried_by_cac: "Queried / Returned for Correction",
    approved: "Approved",
    documents_received: "Documents Received",
    completed: "Completed",
    delivered_to_client: "Delivered to Client",
    on_hold: "On Hold",
    cancelled: "Cancelled",
    business_name: "Business Name Registration",
    limited_company: "Limited Liability Company Registration",
    incorporated_trustees: "Incorporated Trustees Registration",
  };
  const lower = raw.toLowerCase().trim();
  if (map[lower]) return map[lower];
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Formats approved bank payment instructions strictly from the authorized Business Profile bank accounts.
 * Never invents bank accounts.
 */
export function formatApprovedPaymentInstructions(
  bankAccounts?: BusinessBankAccount[] | null
): string | undefined {
  if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return undefined;
  }
  const activeAccounts = bankAccounts.filter(
    (acc) => acc.is_active && acc.bank_name && acc.account_number && acc.account_name
  );
  if (activeAccounts.length === 0) {
    return undefined;
  }
  const primary =
    activeAccounts.find((acc) => acc.is_default) || activeAccounts[0];
  return `Bank: ${primary.bank_name}\nAccount Name: ${primary.account_name}\nAccount Number: ${primary.account_number}`;
}

/**
 * Builds a DynamicVariableContext strictly from verified records passed in.
 * Never fabricates missing registration numbers, approval dates, referral codes, or bank accounts.
 */
export function buildVariableContextFromRecords(
  contact: ClientContactContext,
  staff?: {
    fullName?: string | null;
    roleLabel?: string | null;
  } | null,
  businessProfile?: BusinessProfile | null,
  bankAccounts?: BusinessBankAccount[] | null
): DynamicVariableContext {
  const todayFormatted = formatReadableDate(new Date().toISOString());
  const resolvedBusinessName =
    contact.businessName?.trim() || undefined;
  const resolvedClientEmail =
    contact.email?.trim() || undefined;

  const missingListFormatted =
    contact.missingItems && contact.missingItems.length > 0
      ? contact.missingItems.map((item) => `• ${item}`).join("\n")
      : undefined;

  const paymentInstructions = formatApprovedPaymentInstructions(bankAccounts);

  const officialPhone =
    businessProfile?.primary_phone || "+234 816 048 6023";
  const officialEmail = OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail;

  const referralCode = contact.referralCode?.trim() || undefined;
  const referralLink = referralCode
    ? `https://ablebiz.com.ng/?ref=${encodeURIComponent(referralCode)}`
    : undefined;

  return {
    // Client
    client_name: contact.clientName?.trim() || undefined,
    client_phone: contact.phone?.trim() || contact.whatsappPhone?.trim() || undefined,
    client_email: resolvedClientEmail,
    client_business_name: resolvedBusinessName,
    contact_person: contact.contactPerson?.trim() || contact.clientName?.trim() || undefined,

    // Business
    business_name: resolvedBusinessName,
    business_type: humanizeStageOrStatus(contact.businessType || contact.cacRegistrationType),
    business_registration_number:
      contact.businessRegNumber?.trim() ||
      contact.cacCertificateNumber?.trim() ||
      undefined,

    // Service Request
    service_name:
      contact.serviceName?.trim() ||
      humanizeStageOrStatus(contact.cacRegistrationType) ||
      undefined,
    service_request_reference:
      contact.serviceRequestCode?.trim() ||
      contact.cacApplicationRef?.trim() ||
      undefined,
    assigned_officer:
      contact.assignedOfficerName?.trim() ||
      staff?.fullName?.trim() ||
      undefined,
    current_status: humanizeStageOrStatus(
      contact.serviceStatus || contact.cacStage
    ),
    request_date: formatReadableDate(contact.requestDate),
    relevant_next_step: contact.nextStep?.trim() || undefined,
    missing_information_list: missingListFormatted,

    // CAC Operations
    registration_type: humanizeStageOrStatus(
      contact.cacRegistrationType || contact.businessType || contact.serviceName
    ),
    application_reference:
      contact.cacApplicationRef?.trim() ||
      contact.serviceRequestCode?.trim() ||
      undefined,
    current_stage: humanizeStageOrStatus(contact.cacStage || contact.serviceStatus),
    approval_date: formatReadableDate(contact.cacApprovalDate),
    submission_date: formatReadableDate(contact.cacSubmissionDate),
    certificate_number:
      contact.cacCertificateNumber?.trim() ||
      contact.businessRegNumber?.trim() ||
      undefined,
    missing_documents: missingListFormatted,
    correction_reason: contact.cacRejectionReason?.trim() || undefined,
    required_correction: contact.cacRectificationNotes?.trim() || undefined,

    // Finance
    invoice_number: contact.invoiceNumber?.trim() || undefined,
    invoice_amount: formatNaira(contact.invoiceTotalAmount),
    outstanding_balance: formatNaira(contact.invoiceBalanceDue),
    due_date: formatReadableDate(contact.invoiceDueDate),
    verified_payment_date: formatReadableDate(contact.verifiedPaymentDate),
    receipt_number: contact.receiptNumber?.trim() || undefined,
    payment_instructions: paymentInstructions,

    // Delivery & Engagement
    delivery_email: resolvedClientEmail,
    delivery_date: todayFormatted,
    feedback_link: OFFICIAL_FEEDBACK_URL,
    referral_code: referralCode,
    referral_link: referralLink,

    // Staff & Official Identity
    staff_name: staff?.fullName?.trim() || "ABLEBIZ Operations Team",
    staff_designation: staff?.roleLabel?.trim() || "Client Services",
    business_contact_info: `${officialEmail} | ${officialPhone}`,
  };
}
