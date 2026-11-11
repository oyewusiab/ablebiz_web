import { supabase } from "../supabaseClient";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../communications/emailConfig";

export type ComplianceObligationType =
  | "cac_annual_returns"
  | "scuml_periodic_filing"
  | "tax_clearance_renewal"
  | "trademark_renewal"
  | "other_compliance";

export type ApplicableEntityType =
  | "business_name"
  | "company"
  | "incorporated_trustee"
  | "individual"
  | "all";

export type ComplianceStatus =
  | "pending"
  | "upcoming"
  | "due_soon"
  | "overdue"
  | "in_progress"
  | "completed"
  | "exempt";

export type OpportunityStatus =
  | "none"
  | "identified"
  | "contacted"
  | "interested"
  | "quoted"
  | "converted"
  | "declined";

export interface ComplianceRule {
  id: string;
  name: string;
  obligation_type: ComplianceObligationType;
  applicable_entity_type: ApplicableEntityType;
  service_id?: string | null;
  statutory_reference: string;
  verification_status: "verified" | "requires_verification";
  verified_by?: string | null;
  date_last_verified?: string | null;
  default_recurrence: "annual" | "semi_annual" | "quarterly" | "monthly" | "one_time";
  default_reminder_days: number[];
  description?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface ComplianceObligationRecord {
  id: string;
  client_id: string;
  business_id?: string | null;
  rule_id?: string | null;
  obligation_name: string;
  obligation_type: ComplianceObligationType;
  applicable_entity_type: ApplicableEntityType;
  service_id?: string | null;
  due_date: string; // YYYY-MM-DD
  recurrence_frequency: "annual" | "semi_annual" | "quarterly" | "monthly" | "one_time";
  reminder_schedule: number[];
  assigned_officer_id?: string | null;
  status: ComplianceStatus;
  statutory_source?: string | null;
  verification_status: "verified" | "requires_verification";
  verified_by?: string | null;
  date_last_verified?: string | null;
  last_completed_date?: string | null;
  next_due_date?: string | null;
  linked_service_request_id?: string | null;
  opportunity_status: OpportunityStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins
  client?: { id: string; full_name: string; phone: string; email?: string | null };
  business?: { id: string; name: string; registration_number?: string | null };
  service?: { id: string; name: string; default_fee_ngn?: number };
  assigned_officer?: { id: string; full_name: string; role: string };
  rule?: ComplianceRule;
}

export interface ComplianceReminderRecord {
  id: string;
  obligation_id: string;
  client_id: string;
  days_before_due: number;
  scheduled_date: string;
  channel: "email" | "whatsapp" | "phone" | "notification";
  status: "scheduled" | "sent" | "opened" | "cancelled" | "failed";
  sent_at?: string | null;
  sent_by?: string | null;
  recipient_contact?: string | null;
  message_preview?: string | null;
  notes?: string | null;
}

export interface ComplianceCalendarItem {
  id: string;
  obligationId: string;
  title: string;
  dueDate: string;
  clientName: string;
  businessName?: string;
  obligationType: string;
  status: ComplianceStatus;
  opportunityStatus: OpportunityStatus;
  assignedOfficerName: string;
  isOverdue: boolean;
  daysRemainingOrOverdue: number;
  badgeTone: "emerald" | "blue" | "amber" | "rose" | "purple" | "slate";
}

export interface ComplianceSummaryMetrics {
  totalActiveObligations: number;
  dueNext30Days: number;
  dueNext60Days: number;
  dueNext90Days: number;
  overdueCount: number;
  completedThisYear: number;
  recurringOpportunitiesIdentified: number;
  recurringOpportunitiesConverted: number;
  requiresVerificationCount: number;
}

// Baseline Statutory Rules
export const DEFAULT_COMPLIANCE_RULES: Omit<ComplianceRule, "id">[] = [
  {
    name: "CAC Annual Returns — Business Name",
    obligation_type: "cac_annual_returns",
    applicable_entity_type: "business_name",
    statutory_reference: "CAMA 2020 s. 822 / CAC Annual Return Guidelines (Due annually not later than 30th June)",
    verification_status: "verified",
    verified_by: "Legal & Compliance Department",
    date_last_verified: "2026-01-15",
    default_recurrence: "annual",
    default_reminder_days: [90, 60, 30, 14, 7, 0],
    description: "Statutory requirement to file CAC annual returns to maintain active enterprise status.",
    is_active: true,
  },
  {
    name: "CAC Annual Returns — Private Limited Company (LTD)",
    obligation_type: "cac_annual_returns",
    applicable_entity_type: "company",
    statutory_reference: "CAMA 2020 s. 377 / CAC Filing Regulations (Due within 42 days of Annual General Meeting)",
    verification_status: "verified",
    verified_by: "Legal & Compliance Department",
    date_last_verified: "2026-01-15",
    default_recurrence: "annual",
    default_reminder_days: [90, 60, 30, 14, 7, 0],
    description: "Annual return filing for limited companies accompanied by financial summary or audited accounts.",
    is_active: true,
  },
  {
    name: "CAC Annual Returns — Incorporated Trustee (NGO / Foundation / Association)",
    obligation_type: "cac_annual_returns",
    applicable_entity_type: "incorporated_trustee",
    statutory_reference: "CAMA 2020 s. 848 (Due between 30th June and 31st December each year)",
    verification_status: "verified",
    verified_by: "Legal & Compliance Department",
    date_last_verified: "2026-01-15",
    default_recurrence: "annual",
    default_reminder_days: [90, 60, 30, 14, 7, 0],
    description: "Annual filing and financial statement report for NGOs, trusts, and registered foundations.",
    is_active: true,
  },
  {
    name: "SCUML Anti-Money Laundering Periodic Compliance",
    obligation_type: "scuml_periodic_filing",
    applicable_entity_type: "company",
    statutory_reference: "Money Laundering (Prevention and Prohibition) Act 2022 / SCUML Guidelines",
    verification_status: "verified",
    verified_by: "Legal & Compliance Department",
    date_last_verified: "2026-02-01",
    default_recurrence: "quarterly",
    default_reminder_days: [30, 14, 7, 0],
    description: "Quarterly transaction return and compliance maintenance for Designated Non-Financial Businesses (DNFBs).",
    is_active: true,
  },
  {
    name: "Tax Clearance Certificate (TCC) Renewal",
    obligation_type: "tax_clearance_renewal",
    applicable_entity_type: "all",
    statutory_reference: "Companies Income Tax Act (CITA) / Personal Income Tax Act (PITA)",
    verification_status: "verified",
    verified_by: "Finance & Tax Advisory",
    date_last_verified: "2026-01-20",
    default_recurrence: "annual",
    default_reminder_days: [60, 30, 14, 7, 0],
    description: "Annual renewal of 3-year statutory Tax Clearance Certificate for corporate tenders and banking.",
    is_active: true,
  },
  {
    name: "Trademark Certificate 7-Year Statutory Renewal",
    obligation_type: "trademark_renewal",
    applicable_entity_type: "all",
    statutory_reference: "Trade Marks Act (Cap T13 LFN 2004) s. 23 (Requires verification of initial filing date)",
    verification_status: "requires_verification",
    verified_by: "Intellectual Property Unit",
    date_last_verified: "2026-03-01",
    default_recurrence: "one_time",
    default_reminder_days: [90, 60, 30, 0],
    description: "Statutory renewal of registered Nigerian trademark before expiration of 7-year term.",
    is_active: true,
  },
];

/**
 * Calculates dynamic days remaining or overdue from current reference date (in Africa/Lagos)
 */
export function calculateComplianceDeadlineStatus(dueDateStr: string, status: ComplianceStatus, refNow = new Date()): {
  daysDiff: number;
  isOverdue: boolean;
  computedStatus: ComplianceStatus;
  statusLabel: string;
  badgeTone: "emerald" | "blue" | "amber" | "rose" | "purple" | "slate";
} {
  if (status === "completed") {
    return {
      daysDiff: 0,
      isOverdue: false,
      computedStatus: "completed",
      statusLabel: "Completed",
      badgeTone: "emerald",
    };
  }

  if (status === "exempt") {
    return {
      daysDiff: 0,
      isOverdue: false,
      computedStatus: "exempt",
      statusLabel: "Exempt",
      badgeTone: "slate",
    };
  }

  const dueDate = new Date(dueDateStr);
  const diffMs = dueDate.getTime() - refNow.getTime();
  const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysDiff < 0;

  let computedStatus: ComplianceStatus = status;
  let statusLabel = "Upcoming";
  let badgeTone: "emerald" | "blue" | "amber" | "rose" | "purple" | "slate" = "blue";

  if (isOverdue) {
    computedStatus = "overdue";
    statusLabel = `Overdue by ${Math.abs(daysDiff)}d`;
    badgeTone = "rose";
  } else if (daysDiff <= 30) {
    computedStatus = "due_soon";
    statusLabel = `Due in ${daysDiff}d`;
    badgeTone = "amber";
  } else {
    computedStatus = "upcoming";
    statusLabel = `Due in ${daysDiff}d`;
    badgeTone = "blue";
  }

  if (status === "in_progress") {
    statusLabel = "Filing In Progress";
    badgeTone = "purple";
  }

  return {
    daysDiff,
    isOverdue,
    computedStatus,
    statusLabel,
    badgeTone,
  };
}

/**
 * Computes summary metrics across all compliance obligations dynamically
 */
export function computeComplianceSummary(
  obligations: ComplianceObligationRecord[],
  refNow = new Date()
): ComplianceSummaryMetrics {
  let dueNext30Days = 0;
  let dueNext60Days = 0;
  let dueNext90Days = 0;
  let overdueCount = 0;
  let completedThisYear = 0;
  let recurringOpportunitiesIdentified = 0;
  let recurringOpportunitiesConverted = 0;
  let requiresVerificationCount = 0;

  const currentYear = refNow.getFullYear();

  for (const ob of obligations) {
    if (ob.verification_status === "requires_verification") {
      requiresVerificationCount++;
    }

    if (ob.opportunity_status === "identified" || ob.opportunity_status === "contacted" || ob.opportunity_status === "interested") {
      recurringOpportunitiesIdentified++;
    } else if (ob.opportunity_status === "converted") {
      recurringOpportunitiesConverted++;
    }

    if (ob.status === "completed") {
      if (ob.last_completed_date && new Date(ob.last_completed_date).getFullYear() === currentYear) {
        completedThisYear++;
      }
      continue;
    }

    if (ob.status === "exempt") continue;

    const { daysDiff, isOverdue } = calculateComplianceDeadlineStatus(ob.due_date, ob.status, refNow);

    if (isOverdue) {
      overdueCount++;
    } else {
      if (daysDiff <= 30) dueNext30Days++;
      if (daysDiff <= 60) dueNext60Days++;
      if (daysDiff <= 90) dueNext90Days++;
    }
  }

  return {
    totalActiveObligations: obligations.filter((o) => o.status !== "completed" && o.status !== "exempt").length,
    dueNext30Days,
    dueNext60Days,
    dueNext90Days,
    overdueCount,
    completedThisYear,
    recurringOpportunitiesIdentified,
    recurringOpportunitiesConverted,
    requiresVerificationCount,
  };
}

/**
 * Formats a pre-composed compliance reminder message for WhatsApp, official email, or phone script.
 */
export function composeComplianceReminderMessage(params: {
  clientName: string;
  businessName?: string;
  obligationName: string;
  dueDate: string;
  channel: "email" | "whatsapp" | "phone";
  companyName?: string;
  serviceFee?: number;
}): { subject: string; body: string; whatsappUrl?: string; mailtoUrl?: string } {
  const {
    clientName,
    businessName,
    obligationName,
    dueDate,
    channel,
    companyName = "ABLEBIZ BUSINESS SERVICES LIMITED",
    serviceFee,
  } = params;

  const entityRef = businessName ? `for ${businessName}` : "";
  const feeLine = serviceFee ? `\nOur standard service fee for complete statutory processing is ₦${serviceFee.toLocaleString()}.` : "";

  const subject = `Statutory Compliance Advisory: Upcoming ${obligationName} ${entityRef}`;
  
  const body = `Dear ${clientName},\n\n` +
    `We hope this message finds your business thriving.\n\n` +
    `This is an official compliance reminder from ${companyName}. ` +
    `Our records indicate that your annual compliance obligation—${obligationName} ${entityRef}—is scheduled for completion on or before ${dueDate}.\n\n` +
    `Timely statutory filing prevents post-incorporation penalties, protects your entity from regulatory default, and keeps your corporate status fully active for banking and tenders.${feeLine}\n\n` +
    `To authorize ABLEBIZ to handle your filing promptly, please reply to this email (hello@ablebiz.com.ng) or call/WhatsApp our compliance desk on +234 813 038 9580.\n\n` +
    `Warm regards,\n` +
    `Compliance & Corporate Governance Desk\n` +
    `${companyName}`;

  let whatsappUrl = undefined;
  if (channel === "whatsapp") {
    const encodedText = encodeURIComponent(
      `Hello ${clientName},\n\nThis is ABLEBIZ Compliance Desk regarding your upcoming *${obligationName}* ${entityRef} due on *${dueDate}*. Keeping your statutory filings up to date protects your entity from penalties. Would you like our team to proceed with processing your annual filing?`
    );
    whatsappUrl = `https://wa.me/?text=${encodedText}`;
  }

  let mailtoUrl = undefined;
  if (channel === "email") {
    mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return { subject, body, whatsappUrl, mailtoUrl };
}

/**
 * Converts an upcoming obligation into a Recurring Service Opportunity:
 * 1. Updates obligation opportunity_status to 'contacted' or 'interested'.
 * 2. Idempotently creates an operational follow-up task for the assigned staff.
 * 3. Logs a follow-up record under Client CRM.
 */
export async function createComplianceFollowUpOpportunity(params: {
  obligation: ComplianceObligationRecord;
  assignedStaffId: string;
  notes?: string;
}): Promise<{ ok: boolean; message: string; taskId?: string }> {
  const { obligation, assignedStaffId, notes } = params;

  try {
    const idempotencyKey = `comp_opp_${obligation.id}_${obligation.due_date.substring(0, 4)}`;

    // 1. Check if a task already exists for this obligation cycle
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", obligation.client_id)
      .ilike("title", `%${obligation.obligation_name}%${obligation.due_date.substring(0, 4)}%`)
      .limit(1);

    let taskId: string | undefined = existingTasks?.[0]?.id;

    if (!taskId) {
      // Create operational follow-up task
      const { data: newTask, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          title: `Compliance Follow-Up: ${obligation.obligation_name} (${obligation.due_date})`,
          description: `Contact ${obligation.client?.full_name || "client"} regarding upcoming ${obligation.obligation_name}. Statutory Due Date: ${obligation.due_date}. Notes: ${notes || "Recurring service renewal opportunity."}`,
          client_id: obligation.client_id,
          business_id: obligation.business_id,
          assigned_to: assignedStaffId,
          priority: "high",
          status: "todo",
          category: "compliance",
          source: "compliance_automation",
        })
        .select()
        .single();

      if (taskErr) {
        console.warn("[Compliance] Task creation notice:", taskErr.message);
      } else {
        taskId = newTask?.id;
      }
    }

    // 2. Create client follow-up record
    await supabase.from("follow_ups").insert({
      client_id: obligation.client_id,
      business_id: obligation.business_id,
      assigned_to: assignedStaffId,
      due_date: new Date().toISOString().split("T")[0],
      priority: "normal",
      channel: "phone_call",
      status: "pending",
      notes: `Recurring compliance opportunity: ${obligation.obligation_name}. Statutory due date: ${obligation.due_date}. ${notes || ""}`,
    });

    // 3. Update obligation opportunity_status
    await supabase
      .from("compliance_obligations")
      .update({
        opportunity_status: "contacted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", obligation.id);

    return {
      ok: true,
      message: taskId ? "Follow-up task and CRM record created successfully." : "Follow-up record logged.",
      taskId,
    };
  } catch (err: any) {
    console.error("[Compliance] Opportunity creation error:", err);
    return { ok: false, message: err?.message || "Could not create follow-up opportunity" };
  }
}

/**
 * Calculates next statutory due date after a compliance service is completed
 */
export function calculateNextComplianceDueDate(
  completedDateStr: string,
  recurrence: "annual" | "semi_annual" | "quarterly" | "monthly" | "one_time"
): string | null {
  if (recurrence === "one_time") return null;
  const d = new Date(completedDateStr);
  if (isNaN(d.getTime())) return null;

  if (recurrence === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else if (recurrence === "semi_annual") {
    d.setMonth(d.getMonth() + 6);
  } else if (recurrence === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (recurrence === "monthly") {
    d.setMonth(d.getMonth() + 1);
  }

  return d.toISOString().split("T")[0];
}

/**
 * Fetch authoritative compliance data from Supabase
 */
export async function fetchComplianceDataset(): Promise<{
  obligations: ComplianceObligationRecord[];
  rules: ComplianceRule[];
  reminders: ComplianceReminderRecord[];
  clients: any[];
  businesses: any[];
  services: any[];
  staffProfiles: any[];
}> {
  const [obRes, ruleRes, remRes, clRes, bizRes, svcRes, stRes] = await Promise.all([
    supabase
      .from("compliance_obligations")
      .select(`
        *,
        client:clients(id, full_name, phone, email),
        business:businesses(id, name, registration_number),
        service:services_catalog(id, name, default_fee_ngn),
        assigned_officer:staff_profiles(id, full_name, role)
      `)
      .order("due_date", { ascending: true }),
    supabase.from("compliance_rules").select("*").order("name"),
    supabase.from("compliance_reminders").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("clients").select("id, full_name, phone, email").order("full_name"),
    supabase.from("businesses").select("id, name, client_id, registration_number").order("name"),
    supabase.from("services_catalog").select("id, name, category, default_fee_ngn").order("name"),
    supabase.from("staff_profiles").select("id, full_name, role, department").eq("is_active", true),
  ]);

  return {
    obligations: obRes.data || [],
    rules: ruleRes.data || [],
    reminders: remRes.data || [],
    clients: clRes.data || [],
    businesses: bizRes.data || [],
    services: svcRes.data || [],
    staffProfiles: stRes.data || [],
  };
}
