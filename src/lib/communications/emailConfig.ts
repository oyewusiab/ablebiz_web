/**
 * OFFICIAL ABLEBIZ BUSINESS EMAIL CONFIGURATION
 * Single centralized, immutable sender identity for all client-facing email communications.
 *
 * Staff must never send client-facing emails through personal email accounts when using ABLEBIZ Suite.
 */

export const OFFICIAL_BUSINESS_EMAIL_CONFIG = {
  senderName: "ABLEBIZ BUSINESS SERVICES",
  senderEmail: "hello@ablebiz.com.ng",
  replyToEmail: "hello@ablebiz.com.ng",
  domain: "ablebiz.com.ng",
  formattedDisplayFrom: "ABLEBIZ BUSINESS SERVICES — hello@ablebiz.com.ng",
  formattedFromHeader: "ABLEBIZ BUSINESS SERVICES — hello@ablebiz.com.ng",
  rfc5322From: '"ABLEBIZ BUSINESS SERVICES" <hello@ablebiz.com.ng>',
  officialWebsite: "https://www.ablebiz.com.ng",
  officialAddress:
    "Along M.K.O. Abiola Way, Leme, Abeokuta, Ogun State, Nigeria",
  officialPhone: "+234 816 048 6023",
  feedbackUrl: "http://bit.ly/ablefeedback",
} as const;

export interface OfficialEmailEnvelope {
  fromName: typeof OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName;
  fromEmail: typeof OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail;
  replyTo: typeof OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail;
  to: string;
  cc?: string[];
  subject: string;
  plainTextBody: string;
  htmlBody: string;
  idempotencyKey: string;
}

/**
 * Enforces that any outgoing email envelope strictly uses the official ABLEBIZ BUSINESS SERVICES
 * sender identity and reply-to address, rejecting or stripping any personal staff sender overrides.
 */
export function enforceOfficialSenderIdentity(
  _attemptedOverrides?: Record<string, unknown>
) {
  return {
    senderName: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName,
    senderEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail,
    replyToEmail: OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail,
    formattedDisplayFrom: OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom,
    formattedFromHeader: OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedFromHeader,
    rfc5322From: OFFICIAL_BUSINESS_EMAIL_CONFIG.rfc5322From,
  };
}

/**
 * Escapes HTML special characters to prevent XSS in generated HTML email bodies.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts a plain-text / WhatsApp-styled message body into clean plain text
 * suitable for multipart/alternative text/plain fallback.
 */
export function buildOfficialEmailPlainText(
  bodyOrParams:
    | string
    | { body?: string; bodyText?: string; staffName?: string | null },
  staffNameArg?: string | null
): string {
  const rawBody =
    typeof bodyOrParams === "string"
      ? bodyOrParams
      : bodyOrParams.bodyText || bodyOrParams.body || "";
  const staffName =
    typeof bodyOrParams === "string" ? staffNameArg : bodyOrParams.staffName;
  const cleanBody = rawBody.trim();
  const footerLines = [
    "",
    "------------------------------------------------------------",
    `${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName}`,
    `Email: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}`,
    `Phone / WhatsApp: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialPhone}`,
    `Office: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialAddress}`,
    `Website: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialWebsite}`,
    staffName ? `Prepared by: ${staffName}` : "",
  ].filter((line, idx, arr) => !(line === "" && idx === arr.length - 1));

  return `${cleanBody}\n${footerLines.join("\n")}`;
}

/**
 * Converts a message body (supporting ### headings, *bold*, numbered lists, bullet lists, and URLs)
 * into a professional, branded HTML email template for ABLEBIZ BUSINESS SERVICES.
 */
export function buildOfficialEmailHtml(params: {
  subject: string;
  body?: string;
  bodyText?: string;
  recipientName?: string | null;
  referenceCode?: string | null;
  staffName?: string | null;
}): string {
  const effectiveBody = params.bodyText ?? params.body ?? "";
  const lines = effectiveBody.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;

  const closeLists = () => {
    if (inOrderedList) {
      htmlBlocks.push("</ol>");
      inOrderedList = false;
    }
    if (inUnorderedList) {
      htmlBlocks.push("</ul>");
      inUnorderedList = false;
    }
  };

  const formatInline = (text: string): string => {
    let escaped = escapeHtml(text);
    // Bold **text** or *text*
    escaped = escaped.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong style="color:#0A2558;font-weight:700;">$1</strong>'
    );
    escaped = escaped.replace(
      /\*([^*\n]+)\*/g,
      '<strong style="color:#0A2558;font-weight:700;">$1</strong>'
    );
    // Clickable http/https links
    escaped = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#047857;font-weight:600;text-decoration:underline;">$1</a>'
    );
    return escaped;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      htmlBlocks.push('<div style="height:10px;"></div>');
      continue;
    }

    // Heading ###
    if (trimmed.startsWith("### ")) {
      closeLists();
      const headingText = formatInline(trimmed.slice(4));
      htmlBlocks.push(
        `<h3 style="margin:18px 0 8px 0;font-size:15px;font-weight:700;color:#0A2558;text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">${headingText}</h3>`
      );
      continue;
    }

    // All-caps bold section header like *PERSONAL INFORMATION*
    if (/^\*[A-Z\s&/]+\*$/.test(trimmed)) {
      closeLists();
      const secTitle = escapeHtml(trimmed.replace(/^\*|\*$/g, ""));
      htmlBlocks.push(
        `<h4 style="margin:16px 0 6px 0;font-size:13px;font-weight:700;color:#0A2558;background:#F8FAFC;padding:6px 10px;border-left:3px solid #047857;border-radius:4px;">${secTitle}</h4>`
      );
      continue;
    }

    // Ordered list item (e.g., "1. Surname")
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inUnorderedList) {
        htmlBlocks.push("</ul>");
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        htmlBlocks.push(
          '<ol style="margin:6px 0 12px 20px;padding:0;color:#1E293B;font-size:14px;line-height:1.6;">'
        );
        inOrderedList = true;
      }
      htmlBlocks.push(
        `<li style="margin-bottom:4px;">${formatInline(olMatch[2])}</li>`
      );
      continue;
    }

    // Unordered list item (e.g., "- Item" or "• Item")
    const ulMatch = trimmed.match(/^[-•]\s+(.*)$/);
    if (ulMatch) {
      if (inOrderedList) {
        htmlBlocks.push("</ol>");
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        htmlBlocks.push(
          '<ul style="margin:6px 0 12px 20px;padding:0;color:#1E293B;font-size:14px;line-height:1.6;">'
        );
        inUnorderedList = true;
      }
      htmlBlocks.push(
        `<li style="margin-bottom:4px;">${formatInline(ulMatch[1])}</li>`
      );
      continue;
    }

    closeLists();
    htmlBlocks.push(
      `<p style="margin:0 0 10px 0;font-size:14px;line-height:1.65;color:#1E293B;">${formatInline(
        trimmed
      )}</p>`
    );
  }

  closeLists();

  const refBadgeHtml = params.referenceCode
    ? `<span style="display:inline-block;background:#EFF6FF;color:#0A2558;border:1px solid #BFDBFE;border-radius:6px;padding:3px 8px;font-size:11px;font-family:monospace;font-weight:700;">Ref: ${escapeHtml(
        params.referenceCode
      )}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(15,23,42,0.05);">
          <!-- Official Corporate Header -->
          <tr>
            <td style="background-color:#0A2558;padding:20px 24px;border-bottom:3px solid #D97706;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:17px;font-weight:800;color:#FFFFFF;letter-spacing:0.02em;">
                      ${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName}
                    </div>
                    <div style="font-size:11px;color:#CBD5E1;margin-top:3px;">
                      Corporate Affairs, Business Registration &amp; Statutory Compliance
                    </div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    ${refBadgeHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Content -->
          <tr>
            <td style="padding:24px;">
              ${htmlBlocks.join("\n              ")}
            </td>
          </tr>

          <!-- Official Corporate Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:18px 24px;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;line-height:1.5;">
              <div style="font-weight:700;color:#0F172A;margin-bottom:4px;">
                ${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName}
              </div>
              <div>
                Official Email: <a href="mailto:${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}" style="color:#0A2558;text-decoration:none;font-weight:600;">${OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail}</a>
                &nbsp;|&nbsp; Phone / WhatsApp: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialPhone}
              </div>
              <div>
                Office: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialAddress}
              </div>
              <div style="margin-top:6px;font-size:11px;color:#94A3B8;">
                Please reply directly to <a href="mailto:${OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail}" style="color:#0A2558;">${OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail}</a> for any inquiries regarding this communication.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
