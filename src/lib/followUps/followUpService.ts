import { supabase } from "../supabaseClient";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../communications/emailConfig";

export type FollowUpChannel = "whatsapp" | "phone_call" | "email" | "in_person";

export type FollowUpOutcome =
  | "client_contacted"
  | "client_responded"
  | "awaiting_response"
  | "info_received"
  | "meeting_scheduled"
  | "interested_in_service"
  | "not_interested"
  | "service_requested"
  | "followup_required"
  | "completed";

export interface FollowUpOutcomeConfig {
  id: FollowUpOutcome;
  label: string;
  description: string;
  requiresNextFollowUp: boolean;
  badgeTone: "emerald" | "blue" | "amber" | "slate" | "purple";
}

export const FOLLOW_UP_OUTCOMES: FollowUpOutcomeConfig[] = [
  {
    id: "client_contacted",
    label: "Client Contacted",
    description: "Communication was initiated via phone call, WhatsApp, or official email.",
    requiresNextFollowUp: false,
    badgeTone: "blue",
  },
  {
    id: "client_responded",
    label: "Client Responded",
    description: "Client has replied to our inquiry or consultation message.",
    requiresNextFollowUp: false,
    badgeTone: "emerald",
  },
  {
    id: "awaiting_response",
    label: "Awaiting Client Response",
    description: "Client was contacted; reply or documentation is pending.",
    requiresNextFollowUp: true,
    badgeTone: "amber",
  },
  {
    id: "info_received",
    label: "Information Received",
    description: "Client submitted the requested documentation or particulars.",
    requiresNextFollowUp: false,
    badgeTone: "emerald",
  },
  {
    id: "meeting_scheduled",
    label: "Meeting Scheduled",
    description: "A formal in-person or virtual consultation has been booked.",
    requiresNextFollowUp: true,
    badgeTone: "purple",
  },
  {
    id: "interested_in_service",
    label: "Interested in Service",
    description: "Client expressed firm interest in proceeding with registration or service.",
    requiresNextFollowUp: true,
    badgeTone: "emerald",
  },
  {
    id: "not_interested",
    label: "Not Interested",
    description: "Client declined to proceed at this time.",
    requiresNextFollowUp: false,
    badgeTone: "slate",
  },
  {
    id: "service_requested",
    label: "Service Requested",
    description: "Client officially commissioned a service request or quotation.",
    requiresNextFollowUp: false,
    badgeTone: "emerald",
  },
  {
    id: "followup_required",
    label: "Follow-Up Required",
    description: "Further discussion or follow-up is necessary at a specified future date.",
    requiresNextFollowUp: true,
    badgeTone: "amber",
  },
  {
    id: "completed",
    label: "Completed",
    description: "The purpose of this follow-up has been fully resolved.",
    requiresNextFollowUp: false,
    badgeTone: "slate",
  },
];

export interface ClientEngagementEvent {
  id: string;
  timestamp: string;
  type:
    | "lead_created"
    | "client_registered"
    | "service_submitted"
    | "followup_scheduled"
    | "communication_prepared"
    | "communication_opened"
    | "communication_confirmed_sent"
    | "client_response_recorded"
    | "documents_requested"
    | "documents_received"
    | "cac_stage_changed"
    | "invoice_issued"
    | "payment_verified"
    | "service_completed"
    | "feedback_received"
    | "referral_recorded";
  title: string;
  description?: string | null;
  channel?: string | null;
  actorName?: string | null;
  badgeTone: "emerald" | "blue" | "amber" | "slate" | "purple";
  badgeLabel: string;
}

/**
 * Creates or schedules a new client or lead follow-up.
 */
export async function createFollowUp(params: {
  clientId?: string | null;
  leadId?: string | null;
  serviceRequestId?: string | null;
  businessId?: string | null;
  assignedStaffId: string;
  scheduledAt: string;
  type?: string;
  channel?: FollowUpChannel;
  notes?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  actorStaffId?: string | null;
}): Promise<any> {
  if (!supabase) return null;

  const payload: any = {
    client_id: params.clientId || null,
    lead_id: params.leadId || null,
    service_request_id: params.serviceRequestId || null,
    business_id: params.businessId || null,
    assigned_staff_id: params.assignedStaffId,
    scheduled_at: params.scheduledAt,
    type: params.type || "consultation_call",
    channel: params.channel || "phone_call",
    status: "pending",
    outcome_notes: params.notes || null,
    priority: params.priority || "normal",
  };

  const { data, error } = await supabase.from("follow_ups").insert(payload).select().single();
  if (error) throw error;

  // Log in timeline
  const targetEntity = params.clientId ? "client" : "lead";
  const targetId = params.clientId || params.leadId || data.id;

  await supabase.from("activity_timeline").insert({
    entity_type: targetEntity,
    entity_id: targetId,
    actor_type: "staff",
    actor_id: params.actorStaffId || params.assignedStaffId,
    event_type: "followup_scheduled",
    event_title: `Follow-up scheduled (${params.channel || "phone call"} on ${new Date(params.scheduledAt).toLocaleDateString()})`,
    metadata: {
      follow_up_id: data.id,
      channel: params.channel,
      type: params.type,
    },
  });

  return data;
}

/**
 * Records an outcome for an existing follow-up and executes next-step automations.
 */
export async function recordFollowUpOutcome(params: {
  followUpId: string;
  outcome: FollowUpOutcome;
  outcomeNotes: string;
  actorStaffId?: string | null;
  nextFollowUpDate?: string | null;
  nextFollowUpChannel?: FollowUpChannel;
  nextFollowUpNotes?: string;
}): Promise<void> {
  if (!supabase) return;

  const { followUpId, outcome, outcomeNotes, actorStaffId, nextFollowUpDate, nextFollowUpChannel, nextFollowUpNotes } = params;

  // 1. Fetch current follow-up
  const { data: current, error: fetchErr } = await supabase
    .from("follow_ups")
    .select("*, client:clients(full_name), lead:leads(name)")
    .eq("id", followUpId)
    .single();

  if (fetchErr || !current) throw new Error("Follow-up record not found.");

  const outcomeConfig = FOLLOW_UP_OUTCOMES.find((o) => o.id === outcome);
  const outcomeLabel = outcomeConfig?.label || outcome;

  // 2. Mark this follow-up as completed
  await supabase
    .from("follow_ups")
    .update({
      status: "completed",
      outcome,
      outcome_notes: outcomeNotes ? `${outcomeLabel}: ${outcomeNotes}` : outcomeLabel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followUpId);

  // 3. Log timeline event
  const targetEntity = current.client_id ? "client" : "lead";
  const targetId = current.client_id || current.lead_id || current.id;
  const targetName = current.client?.full_name || current.lead?.name || "Client";

  await supabase.from("activity_timeline").insert({
    entity_type: targetEntity,
    entity_id: targetId,
    actor_type: "staff",
    actor_id: actorStaffId || current.assigned_staff_id,
    event_type: "followup_completed",
    event_title: `Follow-up completed: ${outcomeLabel} (${targetName})`,
    metadata: {
      outcome,
      notes: outcomeNotes,
    },
  });

  // 4. Automated Next Step: Schedule Next Follow-Up if indicated
  if (outcomeConfig?.requiresNextFollowUp && nextFollowUpDate) {
    await createFollowUp({
      clientId: current.client_id,
      leadId: current.lead_id,
      serviceRequestId: current.service_request_id,
      businessId: current.business_id,
      assignedStaffId: current.assigned_staff_id,
      scheduledAt: nextFollowUpDate,
      type: "scheduled_callback",
      channel: nextFollowUpChannel || current.channel || "whatsapp",
      notes: nextFollowUpNotes || `Follow-up following outcome: ${outcomeLabel}`,
      priority: current.priority || "normal",
      actorStaffId,
    });
  }

  // 5. Automated Next Step: If Information Received, notify assigned officer
  if (outcome === "info_received" && current.service_request_id) {
    const { data: sr } = await supabase
      .from("service_requests")
      .select("assigned_staff_id, tracking_code")
      .eq("id", current.service_request_id)
      .single();

    if (sr?.assigned_staff_id) {
      await supabase.from("notifications").insert({
        recipient_staff_id: sr.assigned_staff_id,
        title: "Client Information Received",
        message: `Client has submitted the required information for ${sr.tracking_code || "service request"}. Operational tasks can now resume.`,
        link: "/admin/service-requests",
        priority: "normal",
        is_read: false,
      });
    }
  }
}

/**
 * Automates initial follow-up creation when a new lead enters the CRM pipeline.
 */
export async function scheduleLeadInitialFollowUp(lead: any, assignedStaffId?: string | null): Promise<void> {
  if (!supabase || !lead?.id) return;

  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 2); // Schedule within 2 business hours

  const targetStaffId = assignedStaffId || lead.assigned_staff_id;
  if (!targetStaffId) return;

  try {
    await supabase.from("follow_ups").insert({
      lead_id: lead.id,
      assigned_staff_id: targetStaffId,
      scheduled_at: scheduledAt.toISOString(),
      type: "lead_nurture",
      channel: "phone_call",
      status: "pending",
      priority: "high",
      outcome_notes: `Initial contact for new lead ${lead.name}. Interested in: ${lead.business_type || lead.source || "Business Services"}.`,
    });
  } catch (err) {
    console.error("[FollowUpService] Lead auto-followup error:", err);
  }
}

/**
 * Compiles a rich, chronological Client Engagement History for Client 360 Workspace,
 * strictly distinguishing between prepared, opened, sent, and client responses.
 */
export async function buildClientEngagementHistory(
  clientId: string
): Promise<ClientEngagementEvent[]> {
  if (!supabase || !clientId) return [];

  try {
    const [timelineRes, commsRes, followupsRes, srsRes, invsRes, paysRes] = await Promise.all([
      supabase.from("activity_timeline").select("*").eq("entity_id", clientId),
      supabase.from("communications").select("*").eq("client_id", clientId),
      supabase.from("follow_ups").select("*").eq("client_id", clientId),
      supabase.from("service_requests").select("id, tracking_code, status, created_at, completed_at").eq("client_id", clientId),
      supabase.from("invoices").select("id, invoice_number, total_amount, status, created_at").eq("client_id", clientId),
      supabase.from("payments").select("id, receipt_number, amount, payment_date, created_at").eq("client_id", clientId),
    ]);

    const events: ClientEngagementEvent[] = [];

    // 1. Communications logs
    (commsRes.data || []).forEach((c: any) => {
      let type: ClientEngagementEvent["type"] = "communication_prepared";
      let badgeLabel = "Message Prepared";
      let badgeTone: ClientEngagementEvent["badgeTone"] = "slate";

      if (c.status === "opened" || c.status === "launched") {
        type = "communication_opened";
        badgeLabel = "Opened in WhatsApp / Email";
        badgeTone = "blue";
      } else if (c.status === "sent" || c.status === "confirmed") {
        type = "communication_confirmed_sent";
        badgeLabel = "Confirmed Sent";
        badgeTone = "emerald";
      } else if (c.status === "delivered") {
        type = "communication_confirmed_sent";
        badgeLabel = "Delivered";
        badgeTone = "emerald";
      } else if (c.status === "failed") {
        type = "communication_prepared";
        badgeLabel = "Delivery Failed";
        badgeTone = "amber";
      }

      events.push({
        id: `comm-${c.id}`,
        timestamp: c.created_at,
        type,
        title: `${c.channel === "whatsapp" ? "WhatsApp" : c.channel === "email" ? "Email" : "Communication"}: ${c.subject || c.template_name || "Client Message"}`,
        description: c.message_preview || c.notes,
        channel: c.channel,
        badgeTone,
        badgeLabel,
      });

      // If client response is recorded on this communication
      if (c.client_response) {
        events.push({
          id: `comm-resp-${c.id}`,
          timestamp: c.updated_at || c.created_at,
          type: "client_response_recorded",
          title: "Client Response Recorded",
          description: c.client_response,
          channel: c.channel,
          badgeTone: "emerald",
          badgeLabel: "Client Responded",
        });
      }
    });

    // 2. Follow-ups
    (followupsRes.data || []).forEach((f: any) => {
      if (f.status === "completed") {
        events.push({
          id: `fu-${f.id}`,
          timestamp: f.updated_at || f.scheduled_at,
          type: "client_response_recorded",
          title: `Follow-Up Concluded: ${f.outcome ? f.outcome.replace(/_/g, " ") : "Completed"}`,
          description: f.outcome_notes,
          channel: f.channel,
          badgeTone: "purple",
          badgeLabel: "Follow-Up Outcome",
        });
      } else {
        events.push({
          id: `fu-${f.id}`,
          timestamp: f.scheduled_at,
          type: "followup_scheduled",
          title: `Follow-Up Scheduled (${f.channel || "Phone"})`,
          description: f.outcome_notes || "Scheduled interaction with client.",
          channel: f.channel,
          badgeTone: "amber",
          badgeLabel: "Scheduled",
        });
      }
    });

    // 3. Service Requests
    (srsRes.data || []).forEach((sr: any) => {
      events.push({
        id: `sr-${sr.id}`,
        timestamp: sr.created_at,
        type: "service_submitted",
        title: `Service Request Initiated (${sr.tracking_code || "SR"})`,
        description: `Current status: ${sr.status.replace(/_/g, " ")}`,
        badgeTone: "blue",
        badgeLabel: "Service Order",
      });

      if (sr.completed_at) {
        events.push({
          id: `sr-comp-${sr.id}`,
          timestamp: sr.completed_at,
          type: "service_completed",
          title: `Service Delivered (${sr.tracking_code || "SR"})`,
          description: "Service request completed and verified.",
          badgeTone: "emerald",
          badgeLabel: "Completed",
        });
      }
    });

    // 4. Invoices & Payments
    (invsRes.data || []).forEach((inv: any) => {
      events.push({
        id: `inv-${inv.id}`,
        timestamp: inv.created_at,
        type: "invoice_issued",
        title: `Invoice Issued (${inv.invoice_number})`,
        description: `Total amount: ₦${Number(inv.total_amount).toLocaleString()} • Status: ${inv.status}`,
        badgeTone: "slate",
        badgeLabel: "Billing",
      });
    });

    (paysRes.data || []).forEach((pay: any) => {
      events.push({
        id: `pay-${pay.id}`,
        timestamp: pay.payment_date || pay.created_at,
        type: "payment_verified",
        title: `Payment Verified (${pay.receipt_number})`,
        description: `Amount collected: ₦${Number(pay.amount).toLocaleString()}`,
        badgeTone: "emerald",
        badgeLabel: "Verified Payment",
      });
    });

    // 5. Timeline entries
    (timelineRes.data || []).forEach((act: any) => {
      // Avoid duplicate keys
      if (!events.some((e) => e.title === act.event_title)) {
        events.push({
          id: `act-${act.id}`,
          timestamp: act.created_at,
          type: "documents_received",
          title: act.event_title,
          description: null,
          badgeTone: "slate",
          badgeLabel: "Activity Log",
        });
      }
    });

    // Sort descending by timestamp
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error("[FollowUpService] Engagement history error:", err);
    return [];
  }
}
