import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OFFICIAL_SENDER_NAME = "ABLEBIZ BUSINESS SERVICES";
const OFFICIAL_SENDER_EMAIL = "hello@ablebiz.com.ng";
const OFFICIAL_REPLY_TO_EMAIL = "hello@ablebiz.com.ng";

const ALLOWED_SENDER_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "registration_officer",
  "accounts_officer",
  "client_service_officer",
  "marketing_officer",
]);

const processedIdempotencyKeys = new Map<
  string,
  { timestamp: number; providerMessageId: string; communicationId?: string }
>();

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

function detectConfiguredProvider(): {
  configured: boolean;
  providerName: "resend" | "brevo" | "sendgrid" | null;
  apiKey: string | null;
} {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (resendKey) {
    return { configured: true, providerName: "resend", apiKey: resendKey };
  }
  const brevoKey = Deno.env.get("BREVO_API_KEY")?.trim();
  if (brevoKey) {
    return { configured: true, providerName: "brevo", apiKey: brevoKey };
  }
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY")?.trim();
  if (sendgridKey) {
    return { configured: true, providerName: "sendgrid", apiKey: sendgridKey };
  }
  return { configured: false, providerName: null, apiKey: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed. Use POST." },
      405
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Server environment is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Missing or invalid Authorization Bearer token.",
      },
      401
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify caller JWT
  const {
    data: { user: callerUser },
    error: callerAuthError,
  } = await userClient.auth.getUser();

  if (callerAuthError || !callerUser) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Unauthorized: Invalid or expired staff session token.",
      },
      401
    );
  }

  // 2. Verify caller's active staff profile & role
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("staff_profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", callerUser.id)
    .single();

  if (callerProfileError || !callerProfile || !callerProfile.is_active) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Forbidden: Active staff profile required to send official client emails.",
      },
      403
    );
  }

  const callerRole = String(callerProfile.role || "").toLowerCase();
  if (!ALLOWED_SENDER_ROLES.has(callerRole)) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: `Forbidden: Role "${callerProfile.role}" is read-only and cannot dispatch official client emails.`,
      },
      403
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { success: false, status: "failed", error: "Invalid JSON request body." },
      400
    );
  }

  const action = String(body.action || "send_email");
  const providerInfo = detectConfiguredProvider();

  // Diagnostic endpoint for checking email service readiness
  if (action === "diagnostic") {
    return jsonResponse({
      success: true,
      configured: providerInfo.configured,
      provider: providerInfo.providerName || "unconfigured",
      senderEmail: OFFICIAL_SENDER_EMAIL,
      senderName: OFFICIAL_SENDER_NAME,
      replyToEmail: OFFICIAL_REPLY_TO_EMAIL,
      message: providerInfo.configured
        ? `Official email service (${OFFICIAL_SENDER_EMAIL}) is active via ${providerInfo.providerName.toUpperCase()}.`
        : `Server-side email provider secret (RESEND_API_KEY, BREVO_API_KEY, or SENDGRID_API_KEY) is not yet configured in Supabase Edge Function secrets for ${OFFICIAL_SENDER_EMAIL}. Staff can still open messages in the default email client or WhatsApp.`,
    });
  }

  // Validate recipient & message payload
  const toEmail = String(body.toEmail || "").trim().toLowerCase();
  const toName = String(body.toName || "Valued Client").trim();
  const subject = String(body.subject || "").trim();
  const plainTextBody = String(body.plainTextBody || "").trim();
  const htmlBody = String(body.htmlBody || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  const rawCcList = Array.isArray(body.ccEmails) ? body.ccEmails : [];
  const ccEmails = rawCcList
    .map((c) => String(c || "").trim().toLowerCase())
    .filter((c) => c.length > 0 && isValidEmail(c));

  if (!toEmail || !isValidEmail(toEmail)) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "A valid recipient email address is required.",
      },
      400
    );
  }

  if (!subject) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Email subject is required.",
      },
      400
    );
  }

  if (!plainTextBody) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        error: "Email body cannot be empty.",
      },
      400
    );
  }

  // Duplicate click / idempotency protection
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    const prev = processedIdempotencyKeys.get(idempotencyKey)!;
    return jsonResponse({
      success: true,
      status: "sent",
      providerName: providerInfo.providerName || "cached",
      providerMessageId: prev.providerMessageId,
      communicationId: prev.communicationId,
      senderName: OFFICIAL_SENDER_NAME,
      senderEmail: OFFICIAL_SENDER_EMAIL,
      replyToEmail: OFFICIAL_REPLY_TO_EMAIL,
    });
  }

  // If no provider secret is configured on the server, never fake "sent"
  if (!providerInfo.configured || !providerInfo.apiKey) {
    return jsonResponse({
      success: false,
      status: "prepared",
      configurationRequired: true,
      senderName: OFFICIAL_SENDER_NAME,
      senderEmail: OFFICIAL_SENDER_EMAIL,
      replyToEmail: OFFICIAL_REPLY_TO_EMAIL,
      error:
        "Server-side email provider credentials (RESEND_API_KEY, BREVO_API_KEY, or SENDGRID_API_KEY) are not configured yet for hello@ablebiz.com.ng. Use 'Open in Email App' or configure the Edge Function secret to enable direct server dispatch.",
    });
  }

  // Dispatch through configured transactional email provider with enforced official sender identity
  let providerMessageId = "";
  let dispatchError = "";

  try {
    if (providerInfo.providerName === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerInfo.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${OFFICIAL_SENDER_NAME} <${OFFICIAL_SENDER_EMAIL}>`,
          to: [toEmail],
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          reply_to: OFFICIAL_REPLY_TO_EMAIL,
          subject,
          text: plainTextBody,
          html: htmlBody || undefined,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatchError =
          resJson.message || resJson.error || `Resend HTTP ${res.status}`;
      } else {
        providerMessageId = String(resJson.id || `resend-${Date.now()}`);
      }
    } else if (providerInfo.providerName === "brevo") {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": providerInfo.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: OFFICIAL_SENDER_NAME,
            email: OFFICIAL_SENDER_EMAIL,
          },
          replyTo: {
            name: OFFICIAL_SENDER_NAME,
            email: OFFICIAL_REPLY_TO_EMAIL,
          },
          to: [{ email: toEmail, name: toName }],
          cc:
            ccEmails.length > 0
              ? ccEmails.map((email) => ({ email }))
              : undefined,
          subject,
          textContent: plainTextBody,
          htmlContent: htmlBody || undefined,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatchError =
          resJson.message || `Brevo HTTP ${res.status}`;
      } else {
        providerMessageId = String(resJson.messageId || `brevo-${Date.now()}`);
      }
    } else if (providerInfo.providerName === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerInfo.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: toEmail, name: toName }],
              cc:
                ccEmails.length > 0
                  ? ccEmails.map((email) => ({ email }))
                  : undefined,
              subject,
            },
          ],
          from: {
            email: OFFICIAL_SENDER_EMAIL,
            name: OFFICIAL_SENDER_NAME,
          },
          reply_to: {
            email: OFFICIAL_REPLY_TO_EMAIL,
            name: OFFICIAL_SENDER_NAME,
          },
          content: [
            { type: "text/plain", value: plainTextBody },
            ...(htmlBody ? [{ type: "text/html", value: htmlBody }] : []),
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        dispatchError = errText || `SendGrid HTTP ${res.status}`;
      } else {
        providerMessageId =
          res.headers.get("x-message-id") || `sendgrid-${Date.now()}`;
      }
    }
  } catch (err) {
    dispatchError =
      err instanceof Error
        ? err.message
        : "Unexpected error communicating with email provider.";
  }

  const finalStatus = dispatchError ? "failed" : "sent";
  let communicationId: string | undefined;

  // Record in communications table
  try {
    const { data: commRow } = await adminClient
      .from("communications")
      .insert([
        {
          client_id: body.clientId || null,
          service_request_id: body.serviceRequestId || null,
          staff_id: callerProfile.id,
          channel: "email",
          direction: "outbound",
          summary: `${subject} (To: ${toEmail})`,
          details: plainTextBody,
        },
      ])
      .select("id")
      .single();

    if (commRow?.id) {
      communicationId = String(commRow.id);
    }
  } catch {
    // Non-blocking
  }

  // Record in audit_logs
  try {
    await adminClient.from("audit_logs").insert([
      {
        actor_id: callerProfile.id,
        action: dispatchError
          ? "OFFICIAL_EMAIL_SEND_FAILED"
          : "OFFICIAL_EMAIL_SENT",
        entity_type: "communication",
        entity_id: communicationId || callerProfile.id,
        new_data: {
          sender: `${OFFICIAL_SENDER_NAME} <${OFFICIAL_SENDER_EMAIL}>`,
          recipient: toEmail,
          cc: ccEmails,
          subject,
          templateName: body.templateName || null,
          provider: providerInfo.providerName,
          providerMessageId: providerMessageId || null,
          status: finalStatus,
          error: dispatchError || null,
        },
      },
    ]);
  } catch {
    // Non-blocking
  }

  if (dispatchError) {
    return jsonResponse(
      {
        success: false,
        status: "failed",
        providerName: providerInfo.providerName,
        communicationId,
        senderName: OFFICIAL_SENDER_NAME,
        senderEmail: OFFICIAL_SENDER_EMAIL,
        replyToEmail: OFFICIAL_REPLY_TO_EMAIL,
        error: dispatchError,
      },
      502
    );
  }

  if (idempotencyKey) {
    processedIdempotencyKeys.set(idempotencyKey, {
      timestamp: Date.now(),
      providerMessageId,
      communicationId,
    });
  }

  return jsonResponse({
    success: true,
    status: "sent",
    providerName: providerInfo.providerName,
    providerMessageId,
    communicationId,
    senderName: OFFICIAL_SENDER_NAME,
    senderEmail: OFFICIAL_SENDER_EMAIL,
    replyToEmail: OFFICIAL_REPLY_TO_EMAIL,
  });
});
