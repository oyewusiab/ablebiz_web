import { supabase } from "../supabaseClient";
import { canManageTemplates, canSendCommunication, canUpdateClientContactInfo } from "./communicationPermissions";
import { formatPhoneForCommunication, validateEmailAddress } from "./contactUtils";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "./emailConfig";
import { INITIAL_MESSAGE_TEMPLATES } from "./templateCatalogue";
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLogRecord,
  CommunicationStatus,
  MessageTemplate,
} from "./types";
import { extractTemplateVariables, validateTemplateContentSafety } from "./variableEngine";

const TEMPLATES_STORAGE_KEY = "ablebiz_communication_templates_v1";
const COMM_EXTENDED_META_KEY = "ablebiz_communications_extended_meta_v1";

interface LocalExtendedCommMeta {
  id: string;
  lead_id?: string | null;
  business_id?: string | null;
  cac_application_id?: string | null;
  invoice_id?: string | null;
  payment_id?: string | null;
  status: CommunicationStatus;
  template_id?: string | null;
  template_name?: string | null;
  subject?: string | null;
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
  updated_at?: string;
}

function readLocalTemplates(): MessageTemplate[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return [...INITIAL_MESSAGE_TEMPLATES];
    }
    const raw = window.localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        TEMPLATES_STORAGE_KEY,
        JSON.stringify(INITIAL_MESSAGE_TEMPLATES)
      );
      return [...INITIAL_MESSAGE_TEMPLATES];
    }
    const parsed = JSON.parse(raw) as MessageTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...INITIAL_MESSAGE_TEMPLATES];
    }
    // Merge any newly added system seed templates so nothing is missing
    const bySlug = new Map<string, MessageTemplate>();
    for (const item of parsed) {
      bySlug.set(item.slug, item);
    }
    for (const seed of INITIAL_MESSAGE_TEMPLATES) {
      if (!bySlug.has(seed.slug)) {
        bySlug.set(seed.slug, seed);
      }
    }
    return Array.from(bySlug.values());
  } catch {
    return [...INITIAL_MESSAGE_TEMPLATES];
  }
}

function writeLocalTemplates(templates: MessageTemplate[]): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    }
  } catch {
    // Ignore storage quota issues
  }
}

function readLocalExtendedCommMap(): Record<string, LocalExtendedCommMeta> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(COMM_EXTENDED_META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, LocalExtendedCommMeta>;
  } catch {
    return {};
  }
}

function writeLocalExtendedCommMeta(meta: LocalExtendedCommMeta): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const map = readLocalExtendedCommMap();
    map[meta.id] = meta;
    window.localStorage.setItem(COMM_EXTENDED_META_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

function mapDbRowToTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: String(row.id || ""),
    slug: String(row.slug || ""),
    name: String(row.name || ""),
    category: (row.category as MessageTemplate["category"]) || "general_communication",
    description: String(row.description || ""),
    defaultChannel: (row.default_channel as CommunicationChannel) || "whatsapp",
    supportedChannels: Array.isArray(row.supported_channels)
      ? (row.supported_channels as CommunicationChannel[])
      : ["whatsapp", "email"],
    subject: row.subject ? String(row.subject) : undefined,
    body: String(row.body || ""),
    supportedVariables: Array.isArray(row.supported_variables)
      ? (row.supported_variables as string[])
      : extractTemplateVariables(String(row.body || "")),
    isActive: row.is_active !== false,
    isSystemSeed: Boolean(row.is_system_seed),
    createdBy: String(row.created_by || "system"),
    createdByName: String(row.created_by_name || "ABLEBIZ System"),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    allowedRoles: Array.isArray(row.allowed_roles)
      ? (row.allowed_roles as MessageTemplate["allowedRoles"])
      : [
          "super_admin",
          "admin",
          "operations_manager",
          "registration_officer",
          "client_service_officer",
        ],
    workflowContexts: Array.isArray(row.workflow_contexts)
      ? (row.workflow_contexts as MessageTemplate["workflowContexts"])
      : ["client_360", "general"],
    isDefaultForWorkflow: row.is_default_for_workflow
      ? String(row.is_default_for_workflow)
      : null,
    verificationGuard:
      (row.verification_guard as MessageTemplate["verificationGuard"]) || null,
    usageCount: Number(row.usage_count || 0),
  };
}

/**
 * Loads all prepared message templates from Supabase `communication_templates` with resilient fallback to seed + local storage.
 */
export async function loadMessageTemplates(): Promise<MessageTemplate[]> {
  const local = readLocalTemplates();
  try {
    const { data, error } = await supabase
      .from("communication_templates")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return local;
    }

    const dbTemplates = (data as Record<string, unknown>[]).map(mapDbRowToTemplate);
    // Merge with any local/seed templates that aren't in DB yet
    const mergedMap = new Map<string, MessageTemplate>();
    for (const tpl of local) {
      mergedMap.set(tpl.slug, tpl);
    }
    for (const dbTpl of dbTemplates) {
      mergedMap.set(dbTpl.slug, dbTpl);
    }
    const merged = Array.from(mergedMap.values());
    writeLocalTemplates(merged);
    return merged;
  } catch {
    return local;
  }
}

export interface SaveTemplateInput {
  id?: string;
  slug?: string;
  name: string;
  category: MessageTemplate["category"];
  description: string;
  defaultChannel: CommunicationChannel;
  supportedChannels: CommunicationChannel[];
  subject?: string;
  body: string;
  isActive: boolean;
  allowedRoles: MessageTemplate["allowedRoles"];
  workflowContexts: MessageTemplate["workflowContexts"];
  isDefaultForWorkflow?: string | null;
  verificationGuard?: MessageTemplate["verificationGuard"];
}

export interface SaveTemplateResult {
  success: boolean;
  template?: MessageTemplate;
  error?: string;
  warnings?: string[];
}

/**
 * Creates or updates a prepared message template with RBAC check, content safety check, and audit log.
 */
export async function saveMessageTemplate(
  input: SaveTemplateInput,
  actor: {
    staffId: string;
    staffName: string;
    role?: string | null;
  }
): Promise<SaveTemplateResult> {
  if (!canManageTemplates(actor.role, input.category)) {
    return {
      success: false,
      error: "You do not have permission to create or modify templates in this category.",
    };
  }

  const trimmedName = input.name.trim();
  const trimmedBody = input.body.trim();
  if (!trimmedName || !trimmedBody) {
    return {
      success: false,
      error: "Template name and message body are required.",
    };
  }

  const bodySafety = validateTemplateContentSafety(trimmedBody);
  const subjectSafety = validateTemplateContentSafety(input.subject || "");
  if (!bodySafety.isSafe || !subjectSafety.isSafe) {
    return {
      success: false,
      error: [...bodySafety.errors, ...subjectSafety.errors].join(" "),
    };
  }

  const extractedVars = Array.from(
    new Set([
      ...extractTemplateVariables(trimmedBody),
      ...extractTemplateVariables(input.subject || ""),
    ])
  );

  const localTemplates = readLocalTemplates();
  const existing = input.id
    ? localTemplates.find((t) => t.id === input.id)
    : undefined;

  const slug =
    input.slug?.trim() ||
    existing?.slug ||
    trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36).slice(-4);

  const nowIso = new Date().toISOString();

  const updatedTemplate: MessageTemplate = {
    id: existing?.id || input.id || `tpl-${Date.now().toString(36)}`,
    slug,
    name: trimmedName,
    category: input.category,
    description: input.description.trim(),
    defaultChannel: input.defaultChannel,
    supportedChannels:
      input.supportedChannels.length > 0
        ? input.supportedChannels
        : [input.defaultChannel],
    subject: input.subject?.trim() || undefined,
    body: trimmedBody,
    supportedVariables: extractedVars,
    isActive: input.isActive,
    isSystemSeed: existing?.isSystemSeed ?? false,
    createdBy: existing?.createdBy || actor.staffId,
    createdByName: existing?.createdByName || actor.staffName,
    updatedAt: nowIso,
    allowedRoles: input.allowedRoles,
    workflowContexts: input.workflowContexts,
    isDefaultForWorkflow: input.isDefaultForWorkflow ?? existing?.isDefaultForWorkflow ?? null,
    verificationGuard: input.verificationGuard ?? existing?.verificationGuard ?? null,
    usageCount: existing?.usageCount ?? 0,
  };

  // Persist to local storage
  const nextTemplates = existing
    ? localTemplates.map((t) => (t.id === existing.id ? updatedTemplate : t))
    : [updatedTemplate, ...localTemplates];
  writeLocalTemplates(nextTemplates);

  // Attempt DB upsert into communication_templates
  try {
    await supabase.from("communication_templates").upsert(
      {
        slug: updatedTemplate.slug,
        name: updatedTemplate.name,
        category: updatedTemplate.category,
        description: updatedTemplate.description,
        default_channel: updatedTemplate.defaultChannel,
        supported_channels: updatedTemplate.supportedChannels,
        subject: updatedTemplate.subject || null,
        body: updatedTemplate.body,
        supported_variables: updatedTemplate.supportedVariables,
        is_active: updatedTemplate.isActive,
        is_system_seed: updatedTemplate.isSystemSeed,
        created_by_name: updatedTemplate.createdByName,
        allowed_roles: updatedTemplate.allowedRoles,
        workflow_contexts: updatedTemplate.workflowContexts,
        is_default_for_workflow: updatedTemplate.isDefaultForWorkflow,
        verification_guard: updatedTemplate.verificationGuard,
        usage_count: updatedTemplate.usageCount,
        updated_at: nowIso,
      },
      { onConflict: "slug" }
    );
  } catch {
    // Non-blocking if migration is not yet applied
  }

  // Record audit log
  try {
    await supabase.from("audit_logs").insert([
      {
        actor_id: actor.staffId,
        action: existing ? "UPDATE_COMMUNICATION_TEMPLATE" : "CREATE_COMMUNICATION_TEMPLATE",
        entity_type: "communication_template",
        entity_id: updatedTemplate.id,
        new_data: {
          slug: updatedTemplate.slug,
          name: updatedTemplate.name,
          category: updatedTemplate.category,
          isActive: updatedTemplate.isActive,
        },
      },
    ]);
  } catch {
    // Non-blocking
  }

  const unknownVars = Array.from(
    new Set([...bodySafety.unknownVariables, ...subjectSafety.unknownVariables])
  );

  return {
    success: true,
    template: updatedTemplate,
    warnings:
      unknownVars.length > 0
        ? [
            `Custom placeholder(s) detected: ${unknownVars
              .map((v) => `{{${v}}}`)
              .join(", ")}. Staff will be prompted to fill these manually before sending.`,
          ]
        : undefined,
  };
}

/**
 * Toggles active/inactive status of a template.
 */
export async function toggleMessageTemplateActive(
  templateId: string,
  isActive: boolean,
  actor: { staffId: string; staffName: string; role?: string | null }
): Promise<SaveTemplateResult> {
  const local = readLocalTemplates();
  const target = local.find((t) => t.id === templateId);
  if (!target) {
    return { success: false, error: "Template not found." };
  }
  return saveMessageTemplate(
    {
      ...target,
      isActive,
    },
    actor
  );
}

/**
 * Duplicates an existing template as a new editable template.
 */
export async function duplicateMessageTemplate(
  templateId: string,
  actor: { staffId: string; staffName: string; role?: string | null }
): Promise<SaveTemplateResult> {
  const local = readLocalTemplates();
  const target = local.find((t) => t.id === templateId);
  if (!target) {
    return { success: false, error: "Source template not found." };
  }

  return saveMessageTemplate(
    {
      name: `${target.name} (Copy)`,
      category: target.category,
      description: target.description,
      defaultChannel: target.defaultChannel,
      supportedChannels: [...target.supportedChannels],
      subject: target.subject,
      body: target.body,
      isActive: true,
      allowedRoles: [...target.allowedRoles],
      workflowContexts: [...target.workflowContexts],
      isDefaultForWorkflow: null,
      verificationGuard: target.verificationGuard,
    },
    actor
  );
}

/**
 * Protects templates that are system seeds or have been used in communication history from hard deletion.
 * If used in history or a system seed, deactivates the template instead of hard-deleting it.
 */
export async function deleteOrDeactivateTemplate(
  templateId: string,
  actor: { staffId: string; staffName: string; role?: string | null }
): Promise<{
  success: boolean;
  actionTaken: "deleted" | "deactivated";
  message: string;
}> {
  const local = readLocalTemplates();
  const target = local.find((t) => t.id === templateId);
  if (!target) {
    return {
      success: false,
      actionTaken: "deactivated",
      message: "Template not found.",
    };
  }

  if (!canManageTemplates(actor.role, target.category)) {
    return {
      success: false,
      actionTaken: "deactivated",
      message: "You do not have permission to delete or deactivate this template.",
    };
  }

  // Check if template is a system seed or has usage history
  if (target.isSystemSeed || target.usageCount > 0) {
    await toggleMessageTemplateActive(templateId, false, actor);
    return {
      success: true,
      actionTaken: "deactivated",
      message:
        "Templates with communication history or core system templates cannot be permanently deleted. The template has been safely deactivated instead.",
    };
  }

  const remaining = local.filter((t) => t.id !== templateId);
  writeLocalTemplates(remaining);

  try {
    await supabase
      .from("communication_templates")
      .delete()
      .eq("slug", target.slug);
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    actionTaken: "deleted",
    message: "Unused custom template deleted.",
  };
}

export interface RecordCommunicationInput {
  clientId?: string | null;
  leadId?: string | null;
  businessId?: string | null;
  serviceRequestId?: string | null;
  cacApplicationId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  staffId: string;
  staffName?: string;
  staffRole?: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  templateId?: string | null;
  templateName?: string | null;
  subject?: string | null;
  summary: string;
  messageBody: string;
  htmlBody?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  ccEmails?: string[] | null;
  providerName?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  outcomeNotes?: string | null;
  clientResponse?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Records a communication activity in `public.communications`, `public.activity_timeline`, and `public.audit_logs`.
 * Preserves full extended fields even if the remote database schema is still on the base columns.
 */
export async function recordCommunicationActivity(
  input: RecordCommunicationInput
): Promise<{ success: boolean; record?: CommunicationLogRecord; error?: string }> {
  if (!canSendCommunication(input.staffRole)) {
    return {
      success: false,
      error: "Your role is read-only and cannot record or send client communications.",
    };
  }

  const nowIso = new Date().toISOString();
  const senderName = OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName;
  const senderEmail = OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail;
  const replyToEmail = OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail;

  // Build structured details fallback string so base `details` column always carries rich context
  const structuredDetailsLines = [
    input.messageBody,
    "",
    `--- Metadata ---`,
    `Status: ${input.status}`,
    input.templateName ? `Template: ${input.templateName}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    input.recipientName ? `Recipient: ${input.recipientName}` : null,
    input.recipientPhone ? `Phone: ${input.recipientPhone}` : null,
    input.recipientEmail ? `Email: ${input.recipientEmail}` : null,
    input.channel === "email" ? `From: ${senderName} <${senderEmail}>` : null,
    input.providerMessageId ? `Provider ID: ${input.providerMessageId}` : null,
    input.outcomeNotes ? `Outcome: ${input.outcomeNotes}` : null,
  ].filter(Boolean);

  const fallbackDetailsText = structuredDetailsLines.join("\n");

  let insertedId = `comm-${Date.now().toString(36)}`;
  let dbRow: Record<string, unknown> | null = null;

  try {
    // 1. Try extended insert first
    const extendedPayload: Record<string, unknown> = {
      client_id: input.clientId || null,
      lead_id: input.leadId || null,
      business_id: input.businessId || null,
      service_request_id: input.serviceRequestId || null,
      cac_application_id: input.cacApplicationId || null,
      invoice_id: input.invoiceId || null,
      payment_id: input.paymentId || null,
      staff_id: input.staffId,
      channel: input.channel,
      direction: input.direction,
      status: input.status,
      template_id: input.templateId || null,
      template_name: input.templateName || null,
      subject: input.subject || null,
      summary: input.summary,
      details: input.messageBody,
      message_body: input.messageBody,
      html_body: input.htmlBody || null,
      recipient_name: input.recipientName || null,
      recipient_phone: input.recipientPhone || null,
      recipient_email: input.recipientEmail || null,
      cc_emails: input.ccEmails || null,
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to_email: replyToEmail,
      provider_name: input.providerName || null,
      provider_message_id: input.providerMessageId || null,
      error_message: input.errorMessage || null,
      outcome_notes: input.outcomeNotes || null,
      client_response: input.clientResponse || null,
      sent_at: input.status === "sent" ? nowIso : null,
      idempotency_key: input.idempotencyKey || null,
    };

    const { data: extData, error: extError } = await supabase
      .from("communications")
      .insert([extendedPayload])
      .select("*")
      .single();

    if (!extError && extData) {
      dbRow = extData as Record<string, unknown>;
      insertedId = String(dbRow.id);
    } else {
      // 2. Fallback to base columns of `public.communications`
      const basePayload = {
        client_id: input.clientId || null,
        service_request_id: input.serviceRequestId || null,
        staff_id: input.staffId,
        channel: input.channel,
        direction: input.direction,
        summary: input.summary,
        details: fallbackDetailsText,
      };
      const { data: baseData, error: baseError } = await supabase
        .from("communications")
        .insert([basePayload])
        .select("*")
        .single();

      if (!baseError && baseData) {
        dbRow = baseData as Record<string, unknown>;
        insertedId = String(dbRow.id);
      }
    }
  } catch {
    // Keep local record if offline
  }

  // Save rich metadata locally keyed by communication ID
  const localMeta: LocalExtendedCommMeta = {
    id: insertedId,
    lead_id: input.leadId || null,
    business_id: input.businessId || null,
    cac_application_id: input.cacApplicationId || null,
    invoice_id: input.invoiceId || null,
    payment_id: input.paymentId || null,
    status: input.status,
    template_id: input.templateId || null,
    template_name: input.templateName || null,
    subject: input.subject || null,
    message_body: input.messageBody,
    html_body: input.htmlBody || null,
    recipient_name: input.recipientName || null,
    recipient_phone: input.recipientPhone || null,
    recipient_email: input.recipientEmail || null,
    cc_emails: input.ccEmails || null,
    sender_name: senderName,
    sender_email: senderEmail,
    reply_to_email: replyToEmail,
    provider_name: input.providerName || null,
    provider_message_id: input.providerMessageId || null,
    error_message: input.errorMessage || null,
    outcome_notes: input.outcomeNotes || null,
    client_response: input.clientResponse || null,
    sent_at: input.status === "sent" ? nowIso : null,
    updated_at: nowIso,
  };
  writeLocalExtendedCommMeta(localMeta);

  // Increment template usage count if a template was used
  if (input.templateId) {
    const localTemplates = readLocalTemplates();
    const updated = localTemplates.map((t) =>
      t.id === input.templateId || t.slug === input.templateId
        ? { ...t, usageCount: (t.usageCount || 0) + 1 }
        : t
    );
    writeLocalTemplates(updated);
  }

  // Record in activity_timeline & audit_logs
  try {
    await supabase.from("activity_timeline").insert([
      {
        actor_id: input.staffId,
        client_id: input.clientId || null,
        lead_id: input.leadId || null,
        service_request_id: input.serviceRequestId || null,
        action_type: "COMMUNICATION_LOGGED",
        description: `${input.channel.toUpperCase()} (${input.status.replace(/_/g, " ")}): ${input.summary}`,
        metadata: {
          communication_id: insertedId,
          channel: input.channel,
          status: input.status,
          template_name: input.templateName || null,
          recipient_email: input.recipientEmail || null,
          recipient_phone: input.recipientPhone || null,
        },
      },
    ]);

    await supabase.from("audit_logs").insert([
      {
        actor_id: input.staffId,
        action: "CLIENT_COMMUNICATION_ACTIVITY",
        entity_type: "communication",
        entity_id: insertedId,
        new_data: {
          client_id: input.clientId || null,
          service_request_id: input.serviceRequestId || null,
          cac_application_id: input.cacApplicationId || null,
          invoice_id: input.invoiceId || null,
          channel: input.channel,
          status: input.status,
          template_name: input.templateName || null,
          summary: input.summary,
        },
      },
    ]);
  } catch {
    // Non-blocking
  }

  const record: CommunicationLogRecord = {
    id: insertedId,
    client_id: input.clientId || null,
    lead_id: input.leadId || null,
    business_id: input.businessId || null,
    service_request_id: input.serviceRequestId || null,
    cac_application_id: input.cacApplicationId || null,
    invoice_id: input.invoiceId || null,
    payment_id: input.paymentId || null,
    staff_id: input.staffId,
    channel: input.channel,
    direction: input.direction,
    status: input.status,
    template_id: input.templateId || null,
    template_name: input.templateName || null,
    subject: input.subject || null,
    summary: input.summary,
    details: input.messageBody,
    message_body: input.messageBody,
    html_body: input.htmlBody || null,
    recipient_name: input.recipientName || null,
    recipient_phone: input.recipientPhone || null,
    recipient_email: input.recipientEmail || null,
    cc_emails: input.ccEmails || null,
    sender_name: senderName,
    sender_email: senderEmail,
    reply_to_email: replyToEmail,
    provider_name: input.providerName || null,
    provider_message_id: input.providerMessageId || null,
    error_message: input.errorMessage || null,
    outcome_notes: input.outcomeNotes || null,
    client_response: input.clientResponse || null,
    sent_at: input.status === "sent" ? nowIso : null,
    created_at: dbRow?.created_at ? String(dbRow.created_at) : nowIso,
    updated_at: nowIso,
  };

  return { success: true, record };
}

/**
 * Updates the status, outcome notes, or client response on an existing communication entry.
 * For example, after opening WhatsApp (`opened_in_whatsapp`), staff can confirm it was `sent`
 * or `confirmed_by_client` and log the client's response.
 */
export async function updateCommunicationStatusAndOutcome(
  communicationId: string,
  updates: {
    status: CommunicationStatus;
    outcomeNotes?: string;
    clientResponse?: string;
  },
  actor: { staffId: string; role?: string | null }
): Promise<{ success: boolean; error?: string }> {
  if (!canSendCommunication(actor.role)) {
    return {
      success: false,
      error: "You do not have permission to update communication records.",
    };
  }

  const nowIso = new Date().toISOString();
  const localMap = readLocalExtendedCommMap();
  const existingMeta = localMap[communicationId] || {
    id: communicationId,
    status: updates.status,
  };

  const nextMeta: LocalExtendedCommMeta = {
    ...existingMeta,
    status: updates.status,
    outcome_notes:
      updates.outcomeNotes !== undefined
        ? updates.outcomeNotes
        : existingMeta.outcome_notes,
    client_response:
      updates.clientResponse !== undefined
        ? updates.clientResponse
        : existingMeta.client_response,
    sent_at:
      updates.status === "sent" && !existingMeta.sent_at
        ? nowIso
        : existingMeta.sent_at,
    delivered_at:
      updates.status === "delivered" && !existingMeta.delivered_at
        ? nowIso
        : existingMeta.delivered_at,
    confirmed_at:
      updates.status === "confirmed_by_client" && !existingMeta.confirmed_at
        ? nowIso
        : existingMeta.confirmed_at,
    updated_at: nowIso,
  };
  writeLocalExtendedCommMeta(nextMeta);

  try {
    await supabase
      .from("communications")
      .update({
        status: updates.status,
        outcome_notes: nextMeta.outcome_notes || null,
        client_response: nextMeta.client_response || null,
        sent_at: nextMeta.sent_at || null,
        delivered_at: nextMeta.delivered_at || null,
        confirmed_at: nextMeta.confirmed_at || null,
        updated_at: nowIso,
      })
      .eq("id", communicationId);
  } catch {
    // Ignore if extended columns are not yet applied on remote DB
  }

  try {
    await supabase.from("audit_logs").insert([
      {
        actor_id: actor.staffId,
        action: "UPDATE_COMMUNICATION_STATUS",
        entity_type: "communication",
        entity_id: communicationId,
        new_data: {
          status: updates.status,
          outcome_notes: updates.outcomeNotes || null,
          client_response: updates.clientResponse || null,
        },
      },
    ]);
  } catch {
    // Non-blocking
  }

  return { success: true };
}

function hydrateCommRecord(row: Record<string, unknown>): CommunicationLogRecord {
  const id = String(row.id || "");
  const localMap = readLocalExtendedCommMap();
  const meta = localMap[id];

  // Parse embedded metadata if stored in base `details` column
  const rawDetails = row.details ? String(row.details) : "";
  const bodyBeforeMeta = rawDetails.includes("\n\n--- Metadata ---\n")
    ? rawDetails.split("\n\n--- Metadata ---\n")[0]
    : rawDetails;

  let parsedStatusFromDetails: CommunicationStatus | undefined;
  const statusMatch = rawDetails.match(/Status:\s*([a-z_]+)/i);
  if (statusMatch) {
    parsedStatusFromDetails = statusMatch[1] as CommunicationStatus;
  }

  let parsedTemplateFromDetails: string | undefined;
  const tplMatch = rawDetails.match(/Template:\s*(.+)/i);
  if (tplMatch) {
    parsedTemplateFromDetails = tplMatch[1].trim();
  }

  let parsedSubjectFromDetails: string | undefined;
  const subjMatch = rawDetails.match(/Subject:\s*(.+)/i);
  if (subjMatch) {
    parsedSubjectFromDetails = subjMatch[1].trim();
  }

  const resolvedStatus: CommunicationStatus =
    (row.status as CommunicationStatus) ||
    meta?.status ||
    parsedStatusFromDetails ||
    "sent";

  return {
    id,
    client_id: (row.client_id as string) || null,
    lead_id: (row.lead_id as string) || meta?.lead_id || null,
    business_id: (row.business_id as string) || meta?.business_id || null,
    service_request_id: (row.service_request_id as string) || null,
    cac_application_id:
      (row.cac_application_id as string) || meta?.cac_application_id || null,
    invoice_id: (row.invoice_id as string) || meta?.invoice_id || null,
    payment_id: (row.payment_id as string) || meta?.payment_id || null,
    staff_id: String(row.staff_id || ""),
    channel: (row.channel as CommunicationChannel) || "whatsapp",
    direction: (row.direction as CommunicationDirection) || "outbound",
    status: resolvedStatus,
    template_id: (row.template_id as string) || meta?.template_id || null,
    template_name:
      (row.template_name as string) ||
      meta?.template_name ||
      parsedTemplateFromDetails ||
      null,
    subject:
      (row.subject as string) ||
      meta?.subject ||
      parsedSubjectFromDetails ||
      null,
    summary: String(row.summary || ""),
    details: bodyBeforeMeta || null,
    message_body:
      (row.message_body as string) || meta?.message_body || bodyBeforeMeta || null,
    html_body: (row.html_body as string) || meta?.html_body || null,
    recipient_name: (row.recipient_name as string) || meta?.recipient_name || null,
    recipient_phone:
      (row.recipient_phone as string) || meta?.recipient_phone || null,
    recipient_email:
      (row.recipient_email as string) || meta?.recipient_email || null,
    cc_emails: (row.cc_emails as string[]) || meta?.cc_emails || null,
    sender_name:
      (row.sender_name as string) ||
      meta?.sender_name ||
      OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName,
    sender_email:
      (row.sender_email as string) ||
      meta?.sender_email ||
      OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail,
    reply_to_email:
      (row.reply_to_email as string) ||
      meta?.reply_to_email ||
      OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail,
    provider_name: (row.provider_name as string) || meta?.provider_name || null,
    provider_message_id:
      (row.provider_message_id as string) || meta?.provider_message_id || null,
    error_message: (row.error_message as string) || meta?.error_message || null,
    outcome_notes: (row.outcome_notes as string) || meta?.outcome_notes || null,
    client_response:
      (row.client_response as string) || meta?.client_response || null,
    sent_at: (row.sent_at as string) || meta?.sent_at || null,
    delivered_at: (row.delivered_at as string) || meta?.delivered_at || null,
    confirmed_at: (row.confirmed_at as string) || meta?.confirmed_at || null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: (row.updated_at as string) || meta?.updated_at || undefined,
    client: (row.client as CommunicationLogRecord["client"]) || null,
    staff: (row.staff as CommunicationLogRecord["staff"]) || null,
    service_request:
      (row.service_request as CommunicationLogRecord["service_request"]) || null,
  };
}

/**
 * Loads communication history with optional filters by client, service request, CAC application, invoice, or lead.
 */
export async function loadCommunicationsHistory(filters?: {
  clientId?: string | null;
  serviceRequestId?: string | null;
  cacApplicationId?: string | null;
  invoiceId?: string | null;
  leadId?: string | null;
  limit?: number;
}): Promise<CommunicationLogRecord[]> {
  try {
    let query = supabase
      .from("communications")
      .select(
        `
        *,
        client:clients(id, full_name, phone, email),
        staff:staff_profiles(id, full_name, email, role),
        service_request:service_requests(id, tracking_code, status)
      `
      )
      .order("created_at", { ascending: false })
      .limit(filters?.limit || 200);

    if (filters?.clientId) {
      query = query.eq("client_id", filters.clientId);
    }
    if (filters?.serviceRequestId) {
      query = query.eq("service_request_id", filters.serviceRequestId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    let hydrated = (data as Record<string, unknown>[]).map(hydrateCommRecord);

    if (filters?.cacApplicationId) {
      hydrated = hydrated.filter(
        (item) =>
          item.cac_application_id === filters.cacApplicationId ||
          (filters.serviceRequestId &&
            item.service_request_id === filters.serviceRequestId) ||
          (filters.clientId && item.client_id === filters.clientId)
      );
    }

    if (filters?.invoiceId) {
      hydrated = hydrated.filter(
        (item) =>
          item.invoice_id === filters.invoiceId ||
          (filters.clientId && item.client_id === filters.clientId)
      );
    }

    if (filters?.leadId && !filters?.clientId) {
      hydrated = hydrated.filter((item) => item.lead_id === filters.leadId);
    }

    return hydrated;
  } catch {
    return [];
  }
}

export interface UpdateClientContactInput {
  clientId?: string | null;
  leadId?: string | null;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  wasPreviouslyVerified?: boolean;
  confirmVerifiedOverwrite?: boolean;
  actor: {
    staffId: string;
    role?: string | null;
  };
}

/**
 * Validates and updates client or lead contact details without silently overwriting verified details,
 * and logs the change in `public.audit_logs`.
 */
export async function updateClientContactDetails(
  input: UpdateClientContactInput
): Promise<{
  success: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  updatedPhone?: string;
  updatedAltPhone?: string | null;
  updatedEmail?: string | null;
}> {
  if (!canUpdateClientContactInfo(input.actor.role)) {
    return {
      success: false,
      error: "You do not have permission to modify client contact details.",
    };
  }

  if (input.wasPreviouslyVerified && !input.confirmVerifiedOverwrite) {
    return {
      success: false,
      requiresConfirmation: true,
      error:
        "This client's contact details were previously verified. Please confirm that you intend to overwrite verified contact information.",
    };
  }

  const phoneResult = formatPhoneForCommunication(input.phone);
  if (!phoneResult.valid) {
    return {
      success: false,
      error: phoneResult.error || "Please enter a valid primary phone number.",
    };
  }

  let formattedAltPhone: string | null = null;
  if (input.altPhone && input.altPhone.trim().length > 0) {
    const altResult = formatPhoneForCommunication(input.altPhone);
    if (!altResult.valid) {
      return {
        success: false,
        error: `WhatsApp / Alternate number invalid: ${altResult.error}`,
      };
    }
    formattedAltPhone = altResult.e164;
  }

  let normalizedEmail: string | null = null;
  if (input.email && input.email.trim().length > 0) {
    const emailResult = validateEmailAddress(input.email);
    if (!emailResult.valid) {
      return {
        success: false,
        error: emailResult.error || "Please enter a valid email address.",
      };
    }
    normalizedEmail = emailResult.normalized;
  }

  if (input.clientId) {
    const { error } = await supabase
      .from("clients")
      .update({
        phone: phoneResult.e164,
        alt_phone: formattedAltPhone,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.clientId);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update client contact details.",
      };
    }

    try {
      await supabase.from("audit_logs").insert([
        {
          actor_id: input.actor.staffId,
          action: "UPDATE_CLIENT_CONTACT_DETAILS",
          entity_type: "client",
          entity_id: input.clientId,
          new_data: {
            phone: phoneResult.e164,
            alt_phone: formattedAltPhone,
            email: normalizedEmail,
            overwrote_verified: Boolean(input.wasPreviouslyVerified),
          },
        },
      ]);
    } catch {
      // Non-blocking
    }
  } else if (input.leadId) {
    const { error } = await supabase
      .from("leads")
      .update({
        phone: phoneResult.e164,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update lead contact details.",
      };
    }

    try {
      await supabase.from("audit_logs").insert([
        {
          actor_id: input.actor.staffId,
          action: "UPDATE_LEAD_CONTACT_DETAILS",
          entity_type: "lead",
          entity_id: input.leadId,
          new_data: {
            phone: phoneResult.e164,
            email: normalizedEmail,
          },
        },
      ]);
    } catch {
      // Non-blocking
    }
  } else {
    return {
      success: false,
      error: "No client or lead record ID was provided.",
    };
  }

  return {
    success: true,
    updatedPhone: phoneResult.e164,
    updatedAltPhone: formattedAltPhone,
    updatedEmail: normalizedEmail,
  };
}
