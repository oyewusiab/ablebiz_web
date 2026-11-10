export interface PhoneFormatResult {
  valid: boolean;
  isValid: boolean;
  raw: string;
  waDigits: string; // Digits only without '+', suitable for https://wa.me/<waDigits>
  e164: string; // With '+' prefix, e.g. "+2348031234567"
  display: string; // Human-readable display, e.g. "+234 803 123 4567"
  displayInternational: string;
  displayLocal: string;
  isNigerian: boolean;
  error?: string;
  warning?: string;
}

export interface TelLinkResult {
  valid: boolean;
  isValid: boolean;
  href: string;
  url: string;
  display: string;
  e164: string;
  formattedPhone: PhoneFormatResult;
  error?: string;
  warning?: string;
}

export interface WhatsAppLinkResult {
  valid: boolean;
  isValid: boolean;
  url: string;
  phoneDisplay: string;
  waDigits: string;
  formattedPhone: PhoneFormatResult;
  error?: string;
  warning?: string;
}

export interface EmailValidationResult {
  valid: boolean;
  isValid: boolean;
  normalized: string;
  error?: string;
  warning?: string;
}

export interface MailtoLinkResult {
  valid: boolean;
  isValid: boolean;
  href: string;
  url: string;
  emailValidation: EmailValidationResult;
  error?: string;
  warning?: string;
}

export interface ContactQualityIssue {
  field: "phone" | "whatsapp" | "email" | "name";
  severity: "error" | "warning";
  message: string;
}

export interface ContactQualityAssessment {
  status: "complete" | "partial" | "invalid";
  overallStatus: "complete" | "incomplete";
  canCall: boolean;
  canWhatsApp: boolean;
  canEmail: boolean;
  formattedPhone: PhoneFormatResult;
  formattedWhatsApp: PhoneFormatResult;
  emailValidation: EmailValidationResult;
  phone: PhoneFormatResult;
  whatsapp: PhoneFormatResult;
  email: EmailValidationResult;
  issues: string[];
  detailedIssues: ContactQualityIssue[];
}

function makePhoneResult(params: {
  valid: boolean;
  raw: string;
  waDigits: string;
  e164: string;
  display: string;
  displayLocal?: string;
  isNigerian: boolean;
  error?: string;
}): PhoneFormatResult {
  return {
    valid: params.valid,
    isValid: params.valid,
    raw: params.raw,
    waDigits: params.waDigits,
    e164: params.e164,
    display: params.display,
    displayInternational: params.display,
    displayLocal: params.displayLocal || params.display,
    isNigerian: params.isNigerian,
    error: params.error,
    warning: params.error,
  };
}

/**
 * Formats and validates a phone number for Nigerian (+234) and international callers.
 *
 * Rules:
 * - Correctly formats local Nigerian numbers (e.g., 08031234567 -> +2348031234567 / 2348031234567)
 * - Handles common Nigerian "+234 080..." or "234080..." trunk-zero prefix mistakes -> 23480...
 * - Handles 10-digit Nigerian numbers starting with 7, 8, or 9 (e.g., 8031234567 -> 2348031234567)
 * - Does NOT blindly prepend +234 to numbers already formatted internationally (e.g., +44..., +1..., +233..., 0044...)
 */
export function formatPhoneForCommunication(
  rawPhone: string | null | undefined
): PhoneFormatResult {
  const raw = (rawPhone || "").trim();
  if (!raw) {
    return makePhoneResult({
      valid: false,
      raw: "",
      waDigits: "",
      e164: "",
      display: "Not provided",
      isNigerian: false,
      error: "Telephone number is missing.",
    });
  }

  // Strip spaces, hyphens, parentheses, dots
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // Reject if contains letters or unexpected characters besides leading '+'
  if (!/^\+?\d+$/.test(cleaned)) {
    return makePhoneResult({
      valid: false,
      raw,
      waDigits: "",
      e164: "",
      display: raw,
      isNigerian: false,
      error: "Telephone number contains invalid characters.",
    });
  }

  const hasPlus = cleaned.startsWith("+");
  const hasDoubleZero = !hasPlus && cleaned.startsWith("00");
  let digits = cleaned.replace(/^\+/, "");
  if (hasDoubleZero) {
    digits = digits.slice(2);
  }

  // Case 1: Explicitly international non-Nigerian number (e.g. +44..., +1..., +233..., 0044...)
  if ((hasPlus || hasDoubleZero) && !digits.startsWith("234")) {
    if (digits.length < 7 || digits.length > 15) {
      return makePhoneResult({
        valid: false,
        raw,
        waDigits: "",
        e164: "",
        display: raw,
        isNigerian: false,
        error: "International telephone number must be between 7 and 15 digits.",
      });
    }
    return makePhoneResult({
      valid: true,
      raw,
      waDigits: digits,
      e164: `+${digits}`,
      display: `+${digits}`,
      displayLocal: `+${digits}`,
      isNigerian: false,
    });
  }

  // Case 2: Nigerian number already starting with 234
  if (digits.startsWith("234")) {
    if (digits.length === 14 && digits[3] === "0") {
      digits = "234" + digits.slice(4);
    }

    if (digits.length !== 13) {
      return makePhoneResult({
        valid: false,
        raw,
        waDigits: "",
        e164: "",
        display: raw,
        isNigerian: true,
        error:
          "Nigerian international number (+234) must have 10 digits after the country code.",
      });
    }

    const subscriber = digits.slice(3);
    return makePhoneResult({
      valid: true,
      raw,
      waDigits: digits,
      e164: `+${digits}`,
      display: `+234 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`,
      displayLocal: `0${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`,
      isNigerian: true,
    });
  }

  // Case 3: Local Nigerian 11-digit number starting with 0 (e.g. 08031234567)
  if (digits.startsWith("0")) {
    if (digits.length !== 11) {
      return makePhoneResult({
        valid: false,
        raw,
        waDigits: "",
        e164: "",
        display: raw,
        isNigerian: true,
        error:
          "Local Nigerian phone number starting with 0 must be 11 digits (e.g. 08031234567).",
      });
    }
    const subscriber = digits.slice(1);
    const waDigits = `234${subscriber}`;
    return makePhoneResult({
      valid: true,
      raw,
      waDigits,
      e164: `+${waDigits}`,
      display: `+234 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`,
      displayLocal: `0${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`,
      isNigerian: true,
    });
  }

  // Case 4: 10-digit Nigerian subscriber number without leading 0 (e.g. 8031234567)
  if (digits.length === 10 && /^[789][01]\d{8}$/.test(digits)) {
    const waDigits = `234${digits}`;
    return makePhoneResult({
      valid: true,
      raw,
      waDigits,
      e164: `+${waDigits}`,
      display: `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`,
      displayLocal: `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`,
      isNigerian: true,
    });
  }

  // Case 5: Other international numbers entered without '+' (11-15 digits not starting with 0)
  if (digits.length >= 11 && digits.length <= 15) {
    return makePhoneResult({
      valid: true,
      raw,
      waDigits: digits,
      e164: `+${digits}`,
      display: `+${digits}`,
      displayLocal: `+${digits}`,
      isNigerian: false,
    });
  }

  return makePhoneResult({
    valid: false,
    raw,
    waDigits: "",
    e164: "",
    display: raw,
    isNigerian: false,
    error:
      "Invalid telephone number format. Expected 11-digit Nigerian number (e.g. 08031234567) or valid international format (+234...).",
  });
}

/**
 * Builds a properly formatted tel: link for opening the device's native phone dialer.
 */
export function buildTelLink(rawPhone: string | null | undefined): TelLinkResult {
  const formatted = formatPhoneForCommunication(rawPhone);
  if (!formatted.valid) {
    const errMsg = formatted.error || "Client phone number is missing or invalid.";
    return {
      valid: false,
      isValid: false,
      href: "",
      url: "",
      display: formatted.display,
      e164: "",
      formattedPhone: formatted,
      error: errMsg,
      warning: errMsg,
    };
  }

  const href = `tel:${formatted.e164}`;
  return {
    valid: true,
    isValid: true,
    href,
    url: href,
    display: formatted.display,
    e164: formatted.e164,
    formattedPhone: formatted,
  };
}

/**
 * Builds a universal WhatsApp click-to-chat deep link (https://wa.me/<digits>?text=<encoded>)
 * that supports both desktop (WhatsApp Desktop / WhatsApp Web) and mobile devices.
 */
export function buildWhatsAppLink(
  rawPhone: string | null | undefined,
  message?: string | null
): WhatsAppLinkResult {
  const formatted = formatPhoneForCommunication(rawPhone);
  if (!formatted.valid) {
    const errMsg =
      formatted.error || "Client WhatsApp phone number is missing or invalid.";
    return {
      valid: false,
      isValid: false,
      url: "",
      phoneDisplay: formatted.display,
      waDigits: "",
      formattedPhone: formatted,
      error: errMsg,
      warning: errMsg,
    };
  }

  const cleanText = (message || "").trim();
  const query = cleanText ? `?text=${encodeURIComponent(cleanText)}` : "";
  return {
    valid: true,
    isValid: true,
    url: `https://wa.me/${formatted.waDigits}${query}`,
    phoneDisplay: formatted.display,
    waDigits: formatted.waDigits,
    formattedPhone: formatted,
  };
}

/**
 * Validates an email address without inventing or fabricating missing addresses.
 */
export function validateEmailAddress(
  rawEmail: string | null | undefined
): EmailValidationResult {
  const trimmed = (rawEmail || "").trim().toLowerCase();
  if (!trimmed) {
    return {
      valid: false,
      isValid: false,
      normalized: "",
      error: "Email address is missing.",
      warning: "Email address is missing.",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      isValid: false,
      normalized: trimmed,
      error: "Email address format is invalid.",
      warning: "Email address format is invalid.",
    };
  }

  return {
    valid: true,
    isValid: true,
    normalized: trimmed,
  };
}

/**
 * Builds a properly encoded RFC 6068 mailto: link with recipient, optional CC, subject, and body.
 */
export function buildMailtoLink(params: {
  to: string | null | undefined;
  subject?: string | null;
  body?: string | null;
  cc?: string[] | string | null;
  replyTo?: string | null;
}): MailtoLinkResult {
  const toCheck = validateEmailAddress(params.to);
  if (!toCheck.valid) {
    const errMsg = toCheck.error || "Recipient email address is required.";
    return {
      valid: false,
      isValid: false,
      href: "",
      url: "",
      emailValidation: toCheck,
      error: errMsg,
      warning: errMsg,
    };
  }

  const queryParts: string[] = [];

  if (params.cc) {
    const ccList = Array.isArray(params.cc)
      ? params.cc
      : params.cc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const validCcs = ccList
      .map((c) => validateEmailAddress(c))
      .filter((r) => r.valid)
      .map((r) => r.normalized);
    if (validCcs.length > 0) {
      queryParts.push(`cc=${encodeURIComponent(validCcs.join(","))}`);
    }
  }

  if (params.replyTo) {
    const replyCheck = validateEmailAddress(params.replyTo);
    if (replyCheck.valid) {
      queryParts.push(`reply-to=${encodeURIComponent(replyCheck.normalized)}`);
    }
  }

  if (params.subject && params.subject.trim()) {
    queryParts.push(`subject=${encodeURIComponent(params.subject.trim())}`);
  }

  if (params.body && params.body.trim()) {
    const normalizedBody = params.body.replace(/\r?\n/g, "\r\n");
    queryParts.push(`body=${encodeURIComponent(normalizedBody)}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const href = `mailto:${toCheck.normalized}${queryString}`;
  return {
    valid: true,
    isValid: true,
    href,
    url: href,
    emailValidation: toCheck,
  };
}

/**
 * Assesses the completeness and validity of a client's contact information.
 */
export function assessClientContactQuality(input: {
  clientName?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  businessName?: string | null;
  contactPerson?: string | null;
}): ContactQualityAssessment {
  const detailedIssues: ContactQualityIssue[] = [];

  if (input.clientName !== undefined && (!input.clientName || !input.clientName.trim())) {
    detailedIssues.push({
      field: "name",
      severity: "error",
      message: "Client name is missing.",
    });
  }

  const primaryPhone = input.phone || input.altPhone || "";
  const whatsappCandidate = input.whatsappPhone || input.altPhone || primaryPhone;

  const formattedPhone = formatPhoneForCommunication(primaryPhone);
  const formattedWhatsApp = formatPhoneForCommunication(whatsappCandidate);
  const emailValidation = validateEmailAddress(input.email);

  if (!primaryPhone) {
    detailedIssues.push({
      field: "phone",
      severity: "error",
      message: "Phone number is missing.",
    });
  } else if (!formattedPhone.valid) {
    detailedIssues.push({
      field: "phone",
      severity: "error",
      message: formattedPhone.error || "Phone number is invalid.",
    });
  }

  if (input.whatsappPhone && !formattedWhatsApp.valid) {
    detailedIssues.push({
      field: "whatsapp",
      severity: "warning",
      message: formattedWhatsApp.error || "Dedicated WhatsApp number is invalid.",
    });
  }

  if (!input.email || !input.email.trim()) {
    detailedIssues.push({
      field: "email",
      severity: "warning",
      message:
        "Email address is missing. Add a verified email to send official email notifications.",
    });
  } else if (!emailValidation.valid) {
    detailedIssues.push({
      field: "email",
      severity: "error",
      message: emailValidation.error || "Email address is invalid.",
    });
  }

  const canCall = formattedPhone.valid;
  const canWhatsApp = formattedWhatsApp.valid;
  const canEmail = emailValidation.valid;

  let status: "complete" | "partial" | "invalid" = "complete";
  if (!canCall && !canWhatsApp && !canEmail) {
    status = "invalid";
  } else if (detailedIssues.length > 0) {
    status = "partial";
  }

  const overallStatus: "complete" | "incomplete" =
    status === "complete" ? "complete" : "incomplete";

  return {
    status,
    overallStatus,
    canCall,
    canWhatsApp,
    canEmail,
    formattedPhone,
    formattedWhatsApp,
    emailValidation,
    phone: formattedPhone,
    whatsapp: formattedWhatsApp,
    email: emailValidation,
    issues: detailedIssues.map((i) => i.message),
    detailedIssues,
  };
}
