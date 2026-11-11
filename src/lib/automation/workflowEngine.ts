import { supabase } from "../supabaseClient";
import type { CanonicalStaffRole } from "../../auth/roleConfig";

export type WorkflowTriggerEvent =
  | "service_request_created"
  | "missing_client_info"
  | "payment_verified"
  | "cac_stage_changed"
  | "service_completed"
  | "task_overdue";

export type WorkflowActionType =
  | "create_task"
  | "create_follow_up"
  | "notify_officer"
  | "escalate_to_manager";

export type WorkflowAssignmentRule =
  | "role_workload"
  | "direct_role"
  | "service_owner"
  | "manager_queue";

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string | null;
  trigger_event: WorkflowTriggerEvent;
  applicable_service_id?: string | null;
  applicable_category?: string | null;
  conditions?: Record<string, any>;
  action_type: WorkflowActionType;
  action_payload?: Record<string, any>;
  assignment_rule: WorkflowAssignmentRule;
  target_role?: CanonicalStaffRole | string | null;
  due_days: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowExecutionLog {
  id: string;
  idempotency_key: string;
  rule_id?: string | null;
  trigger_event: string;
  entity_type: string;
  entity_id: string;
  action_taken: string;
  status: "success" | "failed" | "retried";
  details?: Record<string, any>;
  error_message?: string | null;
  created_at: string;
}

const LOCAL_STORAGE_RULES_KEY = "ablebiz_workflow_rules_v1";
const LOCAL_STORAGE_LOGS_KEY = "ablebiz_workflow_logs_v1";

// Standard Default Operational Workflow Rules
export const DEFAULT_WORKFLOW_RULES: Omit<WorkflowRule, "id">[] = [
  {
    name: "New Service Request Intake Review",
    description: "Automatically creates an intake compliance task when a client submits a new service request.",
    trigger_event: "service_request_created",
    applicable_category: "all",
    action_type: "create_task",
    assignment_rule: "role_workload",
    target_role: "registration_officer",
    due_days: 1,
    is_active: true,
    action_payload: {
      task_title_template: "Review requirements and verify intake documents for {service_name}",
      category: "compliance_review",
      priority: "normal",
    },
  },
  {
    name: "Missing Information Follow-Up",
    description: "Generates an urgent client follow-up task whenever documents or particulars are marked missing.",
    trigger_event: "missing_client_info",
    applicable_category: "all",
    action_type: "create_follow_up",
    assignment_rule: "direct_role",
    target_role: "client_service_officer",
    due_days: 1,
    is_active: true,
    action_payload: {
      channel: "whatsapp",
      purpose: "Contact client to request missing registration details and statutory documents",
      priority: "high",
    },
  },
  {
    name: "Filing Commencement on Verified Payment",
    description: "Triggers statutory CAC or operational filing task once an invoice payment is verified.",
    trigger_event: "payment_verified",
    applicable_category: "all",
    action_type: "create_task",
    assignment_rule: "role_workload",
    target_role: "registration_officer",
    due_days: 2,
    is_active: true,
    action_payload: {
      task_title_template: "Initiate filing & documentation processing for {client_name} (Receipt {receipt_number})",
      category: "filing",
      priority: "high",
    },
  },
  {
    name: "CAC Stage Advance Next Action",
    description: "Automatically schedules next required filing step when a CAC application progresses to another stage.",
    trigger_event: "cac_stage_changed",
    applicable_category: "all",
    action_type: "create_task",
    assignment_rule: "service_owner",
    target_role: "registration_officer",
    due_days: 2,
    is_active: true,
    action_payload: {
      task_title_template: "Execute next operational step for {approved_name} at stage {next_stage}",
      category: "filing",
      priority: "normal",
    },
  },
  {
    name: "Post-Service Client Appreciation & Feedback",
    description: "Creates client relationship follow-up to send appreciation and gather feedback after service delivery.",
    trigger_event: "service_completed",
    applicable_category: "all",
    action_type: "create_follow_up",
    assignment_rule: "direct_role",
    target_role: "client_service_officer",
    due_days: 3,
    is_active: true,
    action_payload: {
      channel: "whatsapp",
      purpose: "Send post-service appreciation, request customer satisfaction review, and share referral link",
      priority: "normal",
    },
  },
  {
    name: "Overdue Task Management Escalation",
    description: "Notifies Operations Manager when an operational deadline has been breached.",
    trigger_event: "task_overdue",
    applicable_category: "all",
    action_type: "escalate_to_manager",
    assignment_rule: "manager_queue",
    target_role: "operations_manager",
    due_days: 0,
    is_active: true,
    action_payload: {
      priority: "urgent",
    },
  },
];

/**
 * Reads all active and inactive workflow rules from Supabase or localStorage fallback.
 */
export async function getWorkflowRules(): Promise<WorkflowRule[]> {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("workflow_rules")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as WorkflowRule[];
      }
    }
  } catch (err) {
    console.warn("[WorkflowEngine] Supabase rules read fallback:", err);
  }

  // Local storage fallback
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  // Populate default baseline rules
  const defaultList: WorkflowRule[] = DEFAULT_WORKFLOW_RULES.map((rule, idx) => ({
    ...rule,
    id: `wf-rule-${idx + 1}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(defaultList));
  }

  return defaultList;
}

/**
 * Saves or updates a workflow automation rule.
 */
export async function saveWorkflowRule(rule: Partial<WorkflowRule> & { id?: string }): Promise<WorkflowRule> {
  const currentRules = await getWorkflowRules();
  const id = rule.id || `wf-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const savedRule: WorkflowRule = {
    id,
    name: rule.name || "Custom Automation Rule",
    description: rule.description || null,
    trigger_event: rule.trigger_event || "service_request_created",
    applicable_service_id: rule.applicable_service_id || null,
    applicable_category: rule.applicable_category || "all",
    conditions: rule.conditions || {},
    action_type: rule.action_type || "create_task",
    action_payload: rule.action_payload || {},
    assignment_rule: rule.assignment_rule || "role_workload",
    target_role: rule.target_role || "registration_officer",
    due_days: Number(rule.due_days) || 2,
    is_active: rule.is_active !== false,
    created_at: rule.created_at || nowIso,
    updated_at: nowIso,
  };

  if (supabase) {
    try {
      const payload: any = {
        name: savedRule.name,
        description: savedRule.description,
        trigger_event: savedRule.trigger_event,
        applicable_service_id: savedRule.applicable_service_id,
        applicable_category: savedRule.applicable_category,
        conditions: savedRule.conditions,
        action_type: savedRule.action_type,
        action_payload: savedRule.action_payload,
        assignment_rule: savedRule.assignment_rule,
        target_role: savedRule.target_role,
        due_days: savedRule.due_days,
        is_active: savedRule.is_active,
        updated_at: nowIso,
      };

      if (rule.id && !rule.id.startsWith("wf-rule-") && !rule.id.startsWith("wf-")) {
        await supabase.from("workflow_rules").update(payload).eq("id", rule.id);
      } else {
        const { data } = await supabase.from("workflow_rules").insert(payload).select().single();
        if (data?.id) savedRule.id = data.id;
      }
    } catch (e) {
      console.warn("[WorkflowEngine] Supabase rule save fallback:", e);
    }
  }

  const existingIdx = currentRules.findIndex((r) => r.id === id);
  let updatedRules: WorkflowRule[];
  if (existingIdx >= 0) {
    updatedRules = [...currentRules];
    updatedRules[existingIdx] = savedRule;
  } else {
    updatedRules = [...currentRules, savedRule];
  }

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(updatedRules));
  }

  return savedRule;
}

/**
 * Checks whether an execution log already exists for the given idempotency key.
 */
export async function checkIdempotency(key: string): Promise<boolean> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from("workflow_execution_logs")
        .select("id")
        .eq("idempotency_key", key)
        .maybeSingle();

      if (data?.id) return true;
    } catch (err) {
      console.warn("[WorkflowEngine] Idempotency DB check fallback:", err);
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (raw) {
      try {
        const logs: WorkflowExecutionLog[] = JSON.parse(raw);
        if (logs.some((l) => l.idempotency_key === key)) return true;
      } catch {}
    }
  }

  return false;
}

/**
 * Records a completed or failed workflow execution log.
 */
export async function recordExecutionLog(log: Omit<WorkflowExecutionLog, "id" | "created_at">): Promise<void> {
  const fullLog: WorkflowExecutionLog = {
    ...log,
    id: `wfl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from("workflow_execution_logs").insert({
        idempotency_key: fullLog.idempotency_key,
        rule_id: fullLog.rule_id || null,
        trigger_event: fullLog.trigger_event,
        entity_type: fullLog.entity_type,
        entity_id: fullLog.entity_id,
        action_taken: fullLog.action_taken,
        status: fullLog.status,
        details: fullLog.details || {},
        error_message: fullLog.error_message || null,
      });
    } catch (err) {
      console.warn("[WorkflowEngine] Supabase log insert fallback:", err);
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      const existing: WorkflowExecutionLog[] = raw ? JSON.parse(raw) : [];
      existing.unshift(fullLog);
      // Keep recent 200 logs
      window.localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(existing.slice(0, 200)));
    } catch {}
  }
}

/**
 * Fetches recent execution logs for manager audit & retry screen.
 */
export async function getWorkflowExecutionLogs(): Promise<WorkflowExecutionLog[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("workflow_execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data as WorkflowExecutionLog[];
      }
    } catch (err) {
      console.warn("[WorkflowEngine] Supabase logs fetch fallback:", err);
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  return [];
}

/**
 * Smart Staff Assignment:
 * Identifies eligible active staff by target role, analyzes current workload,
 * and returns the staff member with the lowest open task burden.
 * Falls back to manager queue if no eligible staff is available.
 */
export async function resolveSmartStaffAssignment(
  targetRole: string | null | undefined,
  fallbackStaffId?: string | null
): Promise<{ assignedStaffId: string | null; isManagerQueue: boolean; reason: string }> {
  try {
    if (!supabase) {
      return {
        assignedStaffId: fallbackStaffId || null,
        isManagerQueue: !fallbackStaffId,
        reason: "Offline / Local mode fallback",
      };
    }

    // 1. Fetch active staff matching target role
    let staffQuery = supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true);
    if (targetRole && targetRole !== "all") {
      staffQuery = staffQuery.eq("role", targetRole);
    }

    const { data: staffList, error: staffErr } = await staffQuery;

    if (staffErr || !staffList || staffList.length === 0) {
      // Find operations_manager or admin as manager queue
      const { data: managers } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role")
        .eq("is_active", true)
        .in("role", ["operations_manager", "admin", "super_admin"])
        .limit(1);

      const managerId = managers?.[0]?.id || fallbackStaffId || null;
      return {
        assignedStaffId: managerId,
        isManagerQueue: true,
        reason: `No active staff member found with role '${targetRole || "specialist"}'. Routed to Manager Attention Queue.`,
      };
    }

    if (staffList.length === 1) {
      return {
        assignedStaffId: staffList[0].id,
        isManagerQueue: false,
        reason: `Assigned to sole active ${staffList[0].role}: ${staffList[0].full_name}`,
      };
    }

    // 2. Multi-staff workload assessment: count open (non-completed) tasks for each candidate
    const staffIds = staffList.map((s) => s.id);
    const { data: openTasks } = await supabase
      .from("tasks")
      .select("assigned_to")
      .in("assigned_to", staffIds)
      .neq("status", "completed")
      .neq("status", "cancelled");

    const counts: Record<string, number> = {};
    staffIds.forEach((id) => (counts[id] = 0));
    (openTasks || []).forEach((t: any) => {
      if (t.assigned_to && counts[t.assigned_to] !== undefined) {
        counts[t.assigned_to]++;
      }
    });

    // Sort ascending by workload count
    const sorted = [...staffList].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
    const selected = sorted[0];

    return {
      assignedStaffId: selected.id,
      isManagerQueue: false,
      reason: `Assigned based on workload balance (${counts[selected.id] || 0} open tasks) to ${selected.full_name} (${selected.role})`,
    };
  } catch (err: any) {
    console.error("[WorkflowEngine] Smart staff resolution error:", err);
    return {
      assignedStaffId: fallbackStaffId || null,
      isManagerQueue: true,
      reason: "Automated assignment deferred to Manager Attention Queue.",
    };
  }
}

/**
 * ==============================================================================
 * BUSINESS EVENT AUTOMATION TRIGGERS
 * ==============================================================================
 */

/**
 * 1. TRIGGER: New Client Service Request Created
 */
export async function triggerOnServiceRequestCreated(params: {
  serviceRequest: any;
  client?: any;
  service?: any;
  actorStaffId?: string | null;
}): Promise<void> {
  const { serviceRequest, client, service, actorStaffId } = params;
  if (!serviceRequest?.id) return;

  const idempotencyKey = `sr_create_${serviceRequest.id}`;
  if (await checkIdempotency(idempotencyKey)) return;

  const rules = await getWorkflowRules();
  const matchedRules = rules.filter(
    (r) => r.is_active && r.trigger_event === "service_request_created"
  );

  for (const rule of matchedRules) {
    try {
      const targetRole = rule.target_role || "registration_officer";
      const assignment = await resolveSmartStaffAssignment(targetRole, serviceRequest.assigned_staff_id);

      const serviceName = service?.name || "Client Service";
      const clientName = client?.full_name || "Client";
      const title = `Review intake requirements and prepare filing for ${serviceName} (${clientName})`;

      const dueDays = rule.due_days || 1;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      let createdTaskId: string | null = null;
      if (supabase) {
        const { data: newTask } = await supabase
          .from("tasks")
          .insert({
            title,
            description: `Automated operational task created upon submission of service request ${serviceRequest.tracking_code || serviceRequest.id}. Verify all initial documentation and requirements.`,
            service_request_id: serviceRequest.id,
            client_id: serviceRequest.client_id,
            business_id: serviceRequest.business_id || null,
            assigned_to: assignment.assignedStaffId,
            created_by: actorStaffId || null,
            priority: serviceRequest.priority || "normal",
            status: "todo",
            due_date: dueDate.toISOString(),
            start_date: new Date().toISOString(),
            category: "compliance_review",
            source: "automation",
          })
          .select("id")
          .single();

        createdTaskId = newTask?.id || null;

        // Create notification for assigned officer
        if (assignment.assignedStaffId) {
          await supabase.from("notifications").insert({
            recipient_staff_id: assignment.assignedStaffId,
            title: "New Operational Task Assigned",
            message: `You have been assigned to verify intake requirements for ${serviceName} (${clientName}).`,
            link: "/admin/tasks",
            priority: serviceRequest.priority || "normal",
            is_read: false,
          });
        }

        // Timeline entry
        await supabase.from("activity_timeline").insert({
          entity_type: "service_request",
          entity_id: serviceRequest.id,
          actor_type: "system",
          actor_id: actorStaffId || null,
          event_type: "workflow_task_created",
          event_title: `Automated task generated: ${title}`,
          metadata: {
            task_id: createdTaskId,
            assigned_to: assignment.assignedStaffId,
            assignment_reason: assignment.reason,
          },
        });
      }

      await recordExecutionLog({
        idempotency_key: idempotencyKey,
        rule_id: rule.id,
        trigger_event: "service_request_created",
        entity_type: "service_request",
        entity_id: serviceRequest.id,
        action_taken: `Task created: ${title}`,
        status: "success",
        details: { taskId: createdTaskId, assignment },
      });
    } catch (err: any) {
      console.error("[WorkflowEngine] SR task creation error:", err);
      await recordExecutionLog({
        idempotency_key: idempotencyKey,
        rule_id: rule.id,
        trigger_event: "service_request_created",
        entity_type: "service_request",
        entity_id: serviceRequest.id,
        action_taken: "Create intake verification task",
        status: "failed",
        error_message: err?.message || String(err),
      });
    }
  }
}

/**
 * 2. TRIGGER: Missing Information or Incomplete Documents Identified
 */
export async function triggerOnMissingInformation(params: {
  entityType: "service_request" | "cac_application";
  entityId: string;
  clientId: string;
  clientName?: string;
  missingDetails: string;
  assignedStaffId?: string | null;
  actorStaffId?: string | null;
}): Promise<void> {
  const { entityType, entityId, clientId, clientName, missingDetails, assignedStaffId, actorStaffId } = params;
  const idempotencyKey = `missing_info_${entityType}_${entityId}_${Date.now().toString().slice(0, 7)}`;

  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // 24-hour follow-up

    const assignment = await resolveSmartStaffAssignment("client_service_officer", assignedStaffId);
    const title = `Contact ${clientName || "Client"} — Request Missing Information`;
    const notes = `Missing information identified: ${missingDetails}. Reach out via WhatsApp or phone to request missing items.`;

    let createdTaskId: string | null = null;
    if (supabase) {
      // 1. Create Operational Task
      const { data: newTask } = await supabase
        .from("tasks")
        .insert({
          title,
          description: notes,
          client_id: clientId,
          service_request_id: entityType === "service_request" ? entityId : null,
          cac_application_id: entityType === "cac_application" ? entityId : null,
          assigned_to: assignment.assignedStaffId,
          created_by: actorStaffId || null,
          priority: "high",
          status: "todo",
          due_date: dueDate.toISOString(),
          category: "document_collection",
          source: "automation",
          notes,
        })
        .select("id")
        .single();

      createdTaskId = newTask?.id || null;

      // 2. Schedule CRM Follow-Up
      await supabase.from("follow_ups").insert({
        client_id: clientId,
        service_request_id: entityType === "service_request" ? entityId : null,
        assigned_staff_id: assignment.assignedStaffId || actorStaffId,
        scheduled_at: dueDate.toISOString(),
        type: "document_request",
        channel: "whatsapp",
        status: "pending",
        outcome_notes: notes,
        priority: "high",
      });

      // 3. Notify Officer
      if (assignment.assignedStaffId) {
        await supabase.from("notifications").insert({
          recipient_staff_id: assignment.assignedStaffId,
          title: "Urgent Document Request Follow-Up",
          message: `${clientName || "Client"} has missing registration requirements: ${missingDetails}. Please follow up promptly.`,
          link: "/admin/follow-ups",
          priority: "high",
          is_read: false,
        });
      }
    }

    await recordExecutionLog({
      idempotency_key: idempotencyKey,
      trigger_event: "missing_client_info",
      entity_type: entityType,
      entity_id: entityId,
      action_taken: `Task & Follow-up scheduled: ${title}`,
      status: "success",
      details: { taskId: createdTaskId, missingDetails },
    });
  } catch (err: any) {
    console.error("[WorkflowEngine] Missing info trigger error:", err);
  }
}

/**
 * 3. TRIGGER: Verified Payment Recorded in Finance
 */
export async function triggerOnPaymentVerified(params: {
  payment: any;
  invoice?: any;
  serviceRequest?: any;
  actorStaffId?: string | null;
}): Promise<void> {
  const { payment, invoice, serviceRequest, actorStaffId } = params;
  if (!payment?.id) return;

  const idempotencyKey = `pay_verify_${payment.id}`;
  if (await checkIdempotency(idempotencyKey)) return;

  try {
    const receiptNum = payment.receipt_number || "REC";
    const amountStr = `₦${Number(payment.amount || 0).toLocaleString()}`;
    const clientName = payment.client?.full_name || invoice?.client?.full_name || "Client";
    const title = `Commence Filing — Verified Payment ${amountStr} (${receiptNum})`;

    const assignment = await resolveSmartStaffAssignment("registration_officer", serviceRequest?.assigned_staff_id);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    let createdTaskId: string | null = null;
    if (supabase) {
      const { data: newTask } = await supabase
        .from("tasks")
        .insert({
          title,
          description: `Payment of ${amountStr} verified against receipt ${receiptNum}. Proceed with statutory filing preparation and submission for ${clientName}.`,
          service_request_id: serviceRequest?.id || invoice?.service_request_id || null,
          client_id: payment.client_id || invoice?.client_id || null,
          assigned_to: assignment.assignedStaffId,
          created_by: actorStaffId || null,
          priority: "high",
          status: "todo",
          due_date: dueDate.toISOString(),
          category: "filing",
          source: "automation",
        })
        .select("id")
        .single();

      createdTaskId = newTask?.id || null;

      if (assignment.assignedStaffId) {
        await supabase.from("notifications").insert({
          recipient_staff_id: assignment.assignedStaffId,
          title: "Payment Verified — Filing Action Required",
          message: `Payment of ${amountStr} confirmed for ${clientName}. Operational task has been assigned.`,
          link: "/admin/tasks",
          priority: "high",
          is_read: false,
        });
      }
    }

    await recordExecutionLog({
      idempotency_key: idempotencyKey,
      trigger_event: "payment_verified",
      entity_type: "payment",
      entity_id: payment.id,
      action_taken: `Task created: ${title}`,
      status: "success",
      details: { taskId: createdTaskId, receiptNumber: receiptNum },
    });
  } catch (err: any) {
    console.error("[WorkflowEngine] Payment verified trigger error:", err);
  }
}

/**
 * 4. TRIGGER: CAC Application Stage Changed
 */
export async function triggerOnCacStageChanged(params: {
  application: any;
  previousStage: string;
  nextStage: string;
  actorStaffId?: string | null;
}): Promise<void> {
  const { application, previousStage, nextStage, actorStaffId } = params;
  if (!application?.id || previousStage === nextStage) return;

  const idempotencyKey = `cac_stage_${application.id}_${nextStage}`;
  if (await checkIdempotency(idempotencyKey)) return;

  try {
    const appName = application.approved_name || application.proposed_name_1 || "CAC Application";
    let title = `CAC Filing Action: ${appName} moved to ${nextStage.replace(/_/g, " ")}`;
    let category = "filing";
    let priority: "normal" | "high" | "urgent" = "normal";
    let dueDays = 2;

    if (nextStage === "name_reserved") {
      title = `Prepare statutory registration forms for ${appName} (Name Reserved)`;
      priority = "high";
      dueDays = 1;
    } else if (nextStage === "approved") {
      title = `Download official certificate & status report from CAC portal for ${appName}`;
      category = "compliance_review";
      priority = "high";
      dueDays = 1;
    } else if (nextStage === "documents_received") {
      title = `Verify seal, dispatch certificate, and archive statutory documents for ${appName}`;
      category = "compliance_review";
      dueDays = 2;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    const assignment = await resolveSmartStaffAssignment(
      "registration_officer",
      application.assigned_officer_id
    );

    let createdTaskId: string | null = null;
    if (supabase) {
      const { data: newTask } = await supabase
        .from("tasks")
        .insert({
          title,
          description: `Stage transition from ${previousStage} to ${nextStage} recorded for ${appName}. Execute statutory steps.`,
          cac_application_id: application.id,
          service_request_id: application.service_request_id || null,
          client_id: application.client_id || null,
          business_id: application.business_id || null,
          assigned_to: assignment.assignedStaffId,
          created_by: actorStaffId || null,
          priority,
          status: "todo",
          due_date: dueDate.toISOString(),
          category,
          source: "automation",
        })
        .select("id")
        .single();

      createdTaskId = newTask?.id || null;

      if (assignment.assignedStaffId) {
        await supabase.from("notifications").insert({
          recipient_staff_id: assignment.assignedStaffId,
          title: `Filing Stage Advanced: ${nextStage.replace(/_/g, " ")}`,
          message: `CAC Application for ${appName} moved to ${nextStage.replace(/_/g, " ")}. Task scheduled.`,
          link: "/admin/cac-operations",
          priority,
          is_read: false,
        });
      }
    }

    await recordExecutionLog({
      idempotency_key: idempotencyKey,
      trigger_event: "cac_stage_changed",
      entity_type: "cac_application",
      entity_id: application.id,
      action_taken: `Task created: ${title}`,
      status: "success",
      details: { taskId: createdTaskId, previousStage, nextStage },
    });
  } catch (err: any) {
    console.error("[WorkflowEngine] CAC stage changed trigger error:", err);
  }
}

/**
 * 5. TRIGGER: Service Completed
 */
export async function triggerOnServiceCompleted(params: {
  serviceRequest: any;
  client?: any;
  actorStaffId?: string | null;
}): Promise<void> {
  const { serviceRequest, client, actorStaffId } = params;
  if (!serviceRequest?.id) return;

  const idempotencyKey = `svc_complete_${serviceRequest.id}`;
  if (await checkIdempotency(idempotencyKey)) return;

  try {
    const clientName = client?.full_name || "Client";
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3 days after completion

    const assignment = await resolveSmartStaffAssignment("client_service_officer", serviceRequest.assigned_staff_id);

    if (supabase) {
      // 1. Create Follow-Up in CRM
      await supabase.from("follow_ups").insert({
        client_id: serviceRequest.client_id,
        service_request_id: serviceRequest.id,
        business_id: serviceRequest.business_id || null,
        assigned_staff_id: assignment.assignedStaffId || actorStaffId,
        scheduled_at: dueDate.toISOString(),
        type: "post_service_feedback",
        channel: "whatsapp",
        status: "pending",
        outcome_notes: `Service completed. Reach out to ${clientName} to check client satisfaction, share referral link, and verify additional business needs.`,
        priority: "normal",
      });

      // 2. Create Task
      await supabase.from("tasks").insert({
        title: `Post-Delivery Follow-Up & Feedback — ${clientName}`,
        description: `Service request ${serviceRequest.tracking_code || serviceRequest.id} concluded. Contact client for feedback and referral invitation.`,
        client_id: serviceRequest.client_id,
        service_request_id: serviceRequest.id,
        assigned_to: assignment.assignedStaffId,
        created_by: actorStaffId || null,
        priority: "normal",
        status: "todo",
        due_date: dueDate.toISOString(),
        category: "post_service_followup",
        source: "automation",
      });

      if (assignment.assignedStaffId) {
        await supabase.from("notifications").insert({
          recipient_staff_id: assignment.assignedStaffId,
          title: "Post-Service Client Follow-Up Scheduled",
          message: `Service completed for ${clientName}. Please conduct post-delivery follow-up.`,
          link: "/admin/follow-ups",
          priority: "normal",
          is_read: false,
        });
      }
    }

    await recordExecutionLog({
      idempotency_key: idempotencyKey,
      trigger_event: "service_completed",
      entity_type: "service_request",
      entity_id: serviceRequest.id,
      action_taken: `Post-service follow-up scheduled for ${clientName}`,
      status: "success",
    });
  } catch (err: any) {
    console.error("[WorkflowEngine] Service completed trigger error:", err);
  }
}

/**
 * 6. TRIGGER: Task Overdue Escalation
 */
export async function triggerOnTaskOverdue(params: {
  task: any;
  actorStaffId?: string | null;
}): Promise<void> {
  const { task, actorStaffId } = params;
  if (!task?.id || task.is_escalated) return;

  const idempotencyKey = `task_overdue_${task.id}_${new Date().toISOString().slice(0, 10)}`;
  if (await checkIdempotency(idempotencyKey)) return;

  try {
    const overdueDays = Math.max(1, Math.floor((Date.now() - new Date(task.due_date).getTime()) / (3600 * 1000 * 24)));
    const escalationNote = `Deadline missed by ${overdueDays} day(s). Escalated to Operations Management for review.`;

    if (supabase) {
      // Mark task as escalated
      await supabase
        .from("tasks")
        .update({
          is_escalated: true,
          escalated_at: new Date().toISOString(),
          escalation_notes: escalationNote,
        })
        .eq("id", task.id);

      // Find Operations Managers to notify
      const { data: managers } = await supabase
        .from("staff_profiles")
        .select("id")
        .in("role", ["operations_manager", "admin", "super_admin"])
        .eq("is_active", true);

      if (managers && managers.length > 0) {
        for (const mgr of managers) {
          await supabase.from("notifications").insert({
            recipient_staff_id: mgr.id,
            title: "Task Escalated — Deadline Missed",
            message: `Task "${task.title}" assigned to ${task.assigned_staff?.full_name || "staff"} is ${overdueDays} day(s) overdue.`,
            link: "/admin/tasks",
            priority: "urgent",
            is_read: false,
          });
        }
      }
    }

    await recordExecutionLog({
      idempotency_key: idempotencyKey,
      trigger_event: "task_overdue",
      entity_type: "task",
      entity_id: task.id,
      action_taken: `Escalated overdue task to managers: ${task.title}`,
      status: "success",
      details: { overdueDays },
    });
  } catch (err: any) {
    console.error("[WorkflowEngine] Overdue task escalation error:", err);
  }
}
