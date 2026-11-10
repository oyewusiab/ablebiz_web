import { supabase, supabaseEnabled } from "../supabaseClient";
import { validateEmailAddress } from "./contactUtils";
import {
  OFFICIAL_BUSINESS_EMAIL_CONFIG,
  buildOfficialEmailHtml,
  buildOfficialEmailPlainText,
  enforceOfficialSenderIdentity,
} from "./emailConfig";
import type { CommunicationStatus } from "./types";

export interface SendOfficialEmailRequest {
  recipientEmail?: string;
  toEmail?: string;
  recipientName?: string | null;
  toName?: string | null;
  ccEmails?: string[];
  subject: string;
  body?: string;
  plainTextBody?: string;
  htmlBody?: string;
  referenceCode?: string | null;
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  clientId?: string | null;
  leadId?: string | null;
  businessId?: string | null;
  serviceRequestId?: string | null;
  cacApplicationId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  idempotencyKey?: string;
}

export interface SendOfficialEmailResult {
  success: boolean;
  status: CommunicationStatus;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  recipientEmail: string;
  ccEmails: string[];
  subject: string;
  plainTextBody: string;
  htmlBody: string;
  providerName?: string | null;
  providerMessageId?: string | null;
  configurationRequired?: boolean;
  error?: string;
  errorMessage?: string;
  idempotencyKey: string;
}

export interface EmailProviderDiagnosticResult {
  configured: boolean;
  provider: string;
  providerName: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  domain: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  message: string;
}

// In-memory idempotency guard to prevent duplicate sends on rapid clicks
const recentIdempotencyKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 45_000; // 45 seconds window

export function generateEmailIdempotencyKey(params: {
  recipientEmail: string;
  subject: string;
  body: string;
  clientId?: string | null;
}): string {
  const raw = `${(params.recipientEmail || "").toLowerCase().trim()}|${(
    params.subject || ""
  ).trim()}|${(params.body || "").trim().slice(0, 120)}|${
    params.clientId || ""
  }`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `abz_mail_${Math.abs(hash).toString(36)}_${Math.floor(
    Date.now() / 30000
  )}`;
}

export function isDuplicateEmailSubmission(idempotencyKey: string): boolean {
  const now = Date.now();
  for (const [k, ts] of recentIdempotencyKeys.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      recentIdempotencyKeys.delete(k);
    }
  }
  return recentIdempotencyKeys.has(idempotencyKey);
}

export function clearIdempotencyCacheForTesting(): void {
  recentIdempotencyKeys.clear();
}

/**
 * Prepares and dispatches an official client email from ABLEBIZ BUSINESS SERVICES (hello@ablebiz.com.ng)
 * via the secure server-side Supabase Edge Function (`send-client-email`).
 *
 * Security & Integrity Guarantees:
 * - Always uses `ABLEBIZ BUSINESS SERVICES <hello@ablebiz.com.ng>` and `Reply-To: hello@ablebiz.com.ng`
 * - Never exposes SMTP credentials or API keys to browser code
 * - Rejects duplicate rapid-click submissions
 * - Never marks an email as "sent" unless verified by the server-side email provider
 */
export async function sendOfficialClientEmail(
  req: SendOfficialEmailRequest
): Promise<SendOfficialEmailResult> {
  const officialSender = enforceOfficialSenderIdentity();
  const effectiveRecipientEmail = req.recipientEmail || req.toEmail || "";
  const effectiveRecipientName = req.recipientName || req.toName || null;
  const effectiveBody = req.body || req.plainTextBody || "";
  const idempotencyKey =
    req.idempotencyKey ||
    generateEmailIdempotencyKey({
      recipientEmail: effectiveRecipientEmail,
      subject: req.subject,
      body: effectiveBody,
      clientId: req.clientId,
    });

  // 1. Validate recipient email
  const recipientCheck = validateEmailAddress(effectiveRecipientEmail);
  if (!recipientCheck.valid) {
    return {
      success: false,
      status: "failed",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: effectiveRecipientEmail,
      ccEmails: [],
      subject: req.subject,
      plainTextBody: "",
      htmlBody: "",
      error: recipientCheck.error || "Invalid client recipient email address.",
      idempotencyKey,
    };
  }

  // 2. Validate optional CC emails
  const validCcEmails: string[] = [];
  if (req.ccEmails && req.ccEmails.length > 0) {
    for (const rawCc of req.ccEmails) {
      if (!rawCc.trim()) continue;
      const ccCheck = validateEmailAddress(rawCc);
      if (!ccCheck.valid) {
        return {
          success: false,
          status: "failed",
          senderName: officialSender.senderName,
          senderEmail: officialSender.senderEmail,
          replyToEmail: officialSender.replyToEmail,
          recipientEmail: recipientCheck.normalized,
          ccEmails: [],
          subject: req.subject,
          plainTextBody: "",
          htmlBody: "",
          error: `Invalid CC email address: "${rawCc}".`,
          idempotencyKey,
        };
      }
      validCcEmails.push(ccCheck.normalized);
    }
  }

  // 3. Validate subject and body
  const cleanSubject = (req.subject || "").trim();
  const cleanBody = effectiveBody.trim();
  if (!cleanSubject) {
    return {
      success: false,
      status: "failed",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: "",
      plainTextBody: "",
      htmlBody: "",
      error: "Email subject is required.",
      idempotencyKey,
    };
  }

  if (!cleanBody) {
    return {
      success: false,
      status: "failed",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: cleanSubject,
      plainTextBody: "",
      htmlBody: "",
      error: "Email message body cannot be empty.",
      idempotencyKey,
    };
  }

  // 4. Duplicate click protection
  if (isDuplicateEmailSubmission(idempotencyKey)) {
    return {
      success: false,
      status: "failed",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: cleanSubject,
      plainTextBody: "",
      htmlBody: "",
      error:
        "Duplicate email submission blocked: An identical email was just initiated. Please wait before resending.",
      idempotencyKey,
    };
  }

  // 5. Build HTML & Plain-text bodies
  const plainTextBody =
    req.plainTextBody || buildOfficialEmailPlainText(cleanBody, req.staffName);
  const htmlBody =
    req.htmlBody ||
    buildOfficialEmailHtml({
      subject: cleanSubject,
      body: cleanBody,
      recipientName: effectiveRecipientName,
      referenceCode: req.referenceCode,
      staffName: req.staffName,
    });

  if (!supabaseEnabled || !supabase) {
    return {
      success: false,
      status: "prepared",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: cleanSubject,
      plainTextBody,
      htmlBody,
      configurationRequired: true,
      error:
        "Server-side email service is not reachable because Supabase is not configured.",
      idempotencyKey,
    };
  }

  recentIdempotencyKeys.set(idempotencyKey, Date.now());

  try {
    const { data, error } = await supabase.functions.invoke(
      "send-client-email",
      {
        body: {
          action: "send_email",
          to: recipientCheck.normalized,
          cc: validCcEmails,
          subject: cleanSubject,
          plainTextBody,
          htmlBody,
          recipientName: req.recipientName || null,
          referenceCode: req.referenceCode || null,
          clientId: req.clientId || null,
          leadId: req.leadId || null,
          businessId: req.businessId || null,
          serviceRequestId: req.serviceRequestId || null,
          cacApplicationId: req.cacApplicationId || null,
          invoiceId: req.invoiceId || null,
          paymentId: req.paymentId || null,
          templateId: req.templateId || null,
          templateName: req.templateName || null,
          idempotencyKey,
        },
      }
    );

    if (error) {
      recentIdempotencyKeys.delete(idempotencyKey);
      const isNotDeployed =
        error.message?.includes("not found") ||
        error.message?.includes("404") ||
        error.message?.includes("Failed to send a request to the Edge Function");

      return {
        success: false,
        status: isNotDeployed ? "prepared" : "failed",
        senderName: officialSender.senderName,
        senderEmail: officialSender.senderEmail,
        replyToEmail: officialSender.replyToEmail,
        recipientEmail: recipientCheck.normalized,
        ccEmails: validCcEmails,
        subject: cleanSubject,
        plainTextBody,
        htmlBody,
        configurationRequired: isNotDeployed,
        error: isNotDeployed
          ? "Official Email Edge Function (send-client-email) or SMTP/API provider secrets are not yet deployed on the Supabase server. Message has been saved as 'Prepared' (not Sent)."
          : error.message || "Email dispatch failed.",
        idempotencyKey,
      };
    }

    if (data?.configurationRequired) {
      recentIdempotencyKeys.delete(idempotencyKey);
      return {
        success: false,
        status: "prepared",
        senderName: officialSender.senderName,
        senderEmail: officialSender.senderEmail,
        replyToEmail: officialSender.replyToEmail,
        recipientEmail: recipientCheck.normalized,
        ccEmails: validCcEmails,
        subject: cleanSubject,
        plainTextBody,
        htmlBody,
        configurationRequired: true,
        error:
          data.error ||
          "Server-side email provider secret (RESEND_API_KEY / BREVO_API_KEY / SMTP) is required in Supabase Edge Function secrets for hello@ablebiz.com.ng.",
        idempotencyKey,
      };
    }

    if (!data?.success) {
      recentIdempotencyKeys.delete(idempotencyKey);
      return {
        success: false,
        status: "failed",
        senderName: officialSender.senderName,
        senderEmail: officialSender.senderEmail,
        replyToEmail: officialSender.replyToEmail,
        recipientEmail: recipientCheck.normalized,
        ccEmails: validCcEmails,
        subject: cleanSubject,
        plainTextBody,
        htmlBody,
        providerName: data?.providerName || null,
        error: data?.error || "Provider rejected email transmission.",
        idempotencyKey,
      };
    }

    const verifiedStatus: CommunicationStatus =
      data.status === "delivered"
        ? "delivered"
        : data.status === "queued"
        ? "queued"
        : "sent";

    return {
      success: true,
      status: verifiedStatus,
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: cleanSubject,
      plainTextBody,
      htmlBody,
      providerName: data.providerName || "official_provider",
      providerMessageId: data.messageId || null,
      idempotencyKey,
    };
  } catch (err: any) {
    recentIdempotencyKeys.delete(idempotencyKey);
    return {
      success: false,
      status: "prepared",
      senderName: officialSender.senderName,
      senderEmail: officialSender.senderEmail,
      replyToEmail: officialSender.replyToEmail,
      recipientEmail: recipientCheck.normalized,
      ccEmails: validCcEmails,
      subject: cleanSubject,
      plainTextBody,
      htmlBody,
      configurationRequired: true,
      error:
        err?.message ||
        "Could not connect to server-side email gateway. Message recorded as Prepared.",
      idempotencyKey,
    };
  }
}

/**
 * Runs a live diagnostic against the server-side email service to check provider secret configuration
 * and domain authentication status for hello@ablebiz.com.ng.
 */
export async function checkOfficialEmailServiceStatus(): Promise<EmailProviderDiagnosticResult> {
  const baseResult: EmailProviderDiagnosticResult = {
    configured: false,
    provider: "Not Configured",
    providerName: "Not Configured",
    senderName: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName,
    senderEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail,
    replyToEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail,
    domain: OFFICIAL_BUSINESS_EMAIL_CONFIG.domain,
    spfStatus: "Pending verification in DNS (v=spf1 ...)",
    dkimStatus: "Pending verification in DNS",
    dmarcStatus: "Pending verification in DNS (_dmarc.ablebiz.com.ng)",
    message:
      "Server-side email provider secret (RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials) is required in Supabase Edge Function secrets to enable direct server dispatch from hello@ablebiz.com.ng.",
  };

  if (!supabaseEnabled || !supabase) {
    return baseResult;
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "send-client-email",
      {
        body: { action: "diagnostic" },
      }
    );

    if (error || !data) {
      return baseResult;
    }

    const providerStr = data.provider || data.providerName || baseResult.providerName;
    return {
      configured: Boolean(data.configured),
      provider: providerStr,
      providerName: providerStr,
      senderName: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName,
      senderEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail,
      replyToEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail,
      domain: OFFICIAL_BUSINESS_EMAIL_CONFIG.domain,
      spfStatus: data.spfStatus || baseResult.spfStatus,
      dkimStatus: data.dkimStatus || baseResult.dkimStatus,
      dmarcStatus: data.dmarcStatus || baseResult.dmarcStatus,
      message: data.message || baseResult.message,
    };
  } catch {
    return baseResult;
  }
}
