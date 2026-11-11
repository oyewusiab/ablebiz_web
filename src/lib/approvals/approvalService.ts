import { supabase } from "../supabaseClient";
import type { CanonicalStaffRole } from "../../auth/roleConfig";
import type {
  ApprovalDecisionHistory,
  ApprovalInboxFilters,
  ApprovalRequest,
  ApprovalRequestType,
  ApprovalRule,
  CreateApprovalRequestInput,
} from "../../types/approvals";

export const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    id: "rule-expense",
    category: "finance",
    request_type: "expense",
    name: "Operational Expense Approval",
    description: "Approval requirement for corporate disbursements and operational expenses.",
    min_amount: 50000,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin", "accounts_officer"],
    sequential_stages: 1,
    requires_supporting_documents: true,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-refund",
    category: "finance",
    request_type: "refund",
    name: "Client Refund Approval",
    description: "Rigorous review and sign-off for client payment refunds.",
    min_amount: 1,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin"],
    sequential_stages: 2,
    requires_supporting_documents: true,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-invoice-adj",
    category: "finance",
    request_type: "invoice_adjustment",
    name: "Invoice Adjustment & Credit Note",
    description: "Approval for modifying issued invoices or issuing write-offs.",
    min_amount: 1,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin", "accounts_officer"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-discount",
    category: "commercial",
    request_type: "discount",
    name: "Quotation Discount Approval",
    description: "Approval for granting service fee discounts exceeding standard promotional rates.",
    min_amount: 10000,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-campaign",
    category: "commercial",
    request_type: "campaign_pricing",
    name: "Campaign Special Pricing",
    description: "Approval for non-standard promotional tariffs or bundled packages.",
    min_amount: 0,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-doc-release",
    category: "operations",
    request_type: "document_release",
    name: "Sensitive Document Release",
    description: "Release sign-off for original client incorporation certificates and statutory documents.",
    min_amount: 0,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin", "operations_manager"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-exception",
    category: "operations",
    request_type: "process_exception",
    name: "Operational Process Exception",
    description: "Waiver or deadline extension for statutory filings or expedited turnaround.",
    min_amount: 0,
    max_amount: null,
    required_approver_roles: ["super_admin", "admin", "operations_manager"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
  {
    id: "rule-staff-change",
    category: "administration",
    request_type: "staff_change",
    name: "Staff Profile & Role Modification",
    description: "Executive authorization for changing staff access levels, departments, or employment states.",
    min_amount: 0,
    max_amount: null,
    required_approver_roles: ["super_admin"],
    sequential_stages: 1,
    requires_supporting_documents: false,
    mandatory_comments: true,
    is_active: true,
  },
];

/**
 * Checks if a user is legally permitted to approve a request.
 * Enforces Maker-Checker controls: Requester CANNOT approve their own request.
 */
export function canUserApprove(
  request: ApprovalRequest,
  userRole?: CanonicalStaffRole | null,
  userId?: string | null
): { canApprove: boolean; reason?: string } {
  if (!userRole || !userId) {
    return { canApprove: false, reason: "You must be signed in as active staff." };
  }

  // Maker-checker check: requester cannot approve own request
  if (request.requested_by === userId) {
    return {
      canApprove: false,
      reason: "Maker-checker violation: You cannot approve a request that you submitted.",
    };
  }

  // Request must be in a pending state
  if (request.status !== "pending_approval" && request.status !== "submitted") {
    return {
      canApprove: false,
      reason: `Request cannot be approved in its current status (${request.status}).`,
    };
  }

  // Super admin and admin can approve all operational & financial requests
  if (userRole === "super_admin" || userRole === "admin") {
    return { canApprove: true };
  }

  // Check if user's role is in the assigned approver roles
  if (request.assigned_approver_roles && request.assigned_approver_roles.includes(userRole)) {
    return { canApprove: true };
  }

  return {
    canApprove: false,
    reason: `Your role (${userRole}) is not authorized to approve this request type.`,
  };
}

/**
 * Checks if user can withdraw a request.
 */
export function canUserWithdraw(
  request: ApprovalRequest,
  userId?: string | null,
  userRole?: CanonicalStaffRole | null
): boolean {
  if (!userId) return false;
  if (request.status !== "pending_approval" && request.status !== "submitted") return false;
  return request.requested_by === userId || userRole === "super_admin";
}

/**
 * Fetches all active approval rules.
 */
export async function fetchApprovalRules(): Promise<ApprovalRule[]> {
  if (!supabase) return DEFAULT_APPROVAL_RULES;

  try {
    const { data, error } = await supabase
      .from("approval_rules")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_APPROVAL_RULES;
    }

    return data as ApprovalRule[];
  } catch {
    return DEFAULT_APPROVAL_RULES;
  }
}

/**
 * Generates next unique approval reference number (e.g. APP-2026-0001).
 */
export async function generateNextApprovalReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `APP-${year}`;

  if (!supabase) {
    return `${prefix}-0001`;
  }

  try {
    const { count, error } = await supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true });

    if (error || count === null) {
      return `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    const nextSeq = (count || 0) + 1;
    return `${prefix}-${nextSeq.toString().padStart(4, "0")}`;
  } catch {
    return `${prefix}-0001`;
  }
}

/**
 * Fetches approval requests matching filters and user permissions.
 */
export async function fetchApprovalRequests(
  filters: ApprovalInboxFilters,
  userRole?: CanonicalStaffRole | null,
  userId?: string | null
): Promise<ApprovalRequest[]> {
  if (!supabase) {
    return [];
  }

  try {
    let query = supabase
      .from("approval_requests")
      .select(`
        *,
        requester:staff_profiles!requested_by(id, full_name, email, role),
        decision_maker:staff_profiles!decision_by(id, full_name, email, role)
      `)
      .order("created_at", { ascending: false });

    // Filter by tab
    if (filters.tab === "pending") {
      query = query.in("status", ["pending_approval", "submitted"]);
    } else if (filters.tab === "my_submissions") {
      if (userId) {
        query = query.eq("requested_by", userId);
      }
    } else if (filters.tab === "approved") {
      query = query.in("status", ["approved", "executed"]);
    } else if (filters.tab === "rejected") {
      query = query.eq("status", "rejected");
    } else if (filters.tab === "returned") {
      query = query.eq("status", "returned_for_revision");
    }

    // Filter by category
    if (filters.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }

    // Filter by status if tab is 'all'
    if (filters.status && filters.status !== "all" && filters.tab === "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    let results = data as ApprovalRequest[];

    // If 'pending' tab, ensure approver is assigned or super admin
    if (filters.tab === "pending" && userRole && userRole !== "super_admin" && userRole !== "admin") {
      results = results.filter((r) => r.assigned_approver_roles?.includes(userRole));
    }

    // Search term filtering
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.reference_number.toLowerCase().includes(term) ||
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          (r.requester && r.requester.full_name.toLowerCase().includes(term))
      );
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Fetches full details for an approval request including history.
 */
export async function fetchApprovalRequestDetails(
  requestId: string
): Promise<{ request: ApprovalRequest | null; history: ApprovalDecisionHistory[] }> {
  if (!supabase) {
    return { request: null, history: [] };
  }

  try {
    const { data: requestData, error: reqErr } = await supabase
      .from("approval_requests")
      .select(`
        *,
        requester:staff_profiles!requested_by(id, full_name, email, role),
        decision_maker:staff_profiles!decision_by(id, full_name, email, role)
      `)
      .eq("id", requestId)
      .single();

    if (reqErr || !requestData) {
      return { request: null, history: [] };
    }

    const { data: historyData } = await supabase
      .from("approval_decision_history")
      .select(`
        *,
        actor:staff_profiles!actor_id(id, full_name, email, role)
      `)
      .eq("approval_request_id", requestId)
      .order("created_at", { ascending: true });

    return {
      request: requestData as ApprovalRequest,
      history: (historyData || []) as ApprovalDecisionHistory[],
    };
  } catch {
    return { request: null, history: [] };
  }
}

/**
 * Submits a new approval request.
 */
export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
  requesterId: string
): Promise<{ ok: boolean; request?: ApprovalRequest; message?: string }> {
  if (!input.title || !input.description || !input.justification) {
    return { ok: false, message: "Title, description, and justification are mandatory." };
  }

  // Look up matching rule
  const rules = await fetchApprovalRules();
  const rule = rules.find((r) => r.request_type === input.request_type && r.is_active);

  if (rule?.requires_supporting_documents && (!input.supporting_documents || input.supporting_documents.length === 0)) {
    return {
      ok: false,
      message: `Supporting documents are required for ${rule.name}.`,
    };
  }

  const assignedRoles: CanonicalStaffRole[] = rule ? rule.required_approver_roles : ["super_admin", "admin"];
  const totalStages = rule ? rule.sequential_stages : 1;
  const refNumber = await generateNextApprovalReference();

  if (!supabase) {
    const mockReq: ApprovalRequest = {
      id: `mock-app-${Date.now()}`,
      reference_number: refNumber,
      category: input.category,
      request_type: input.request_type,
      title: input.title,
      description: input.description,
      justification: input.justification,
      requested_by: requesterId,
      amount: input.amount || null,
      currency: input.currency || "NGN",
      related_module: input.related_module || null,
      related_record_id: input.related_record_id || null,
      supporting_documents: input.supporting_documents || [],
      assigned_approver_roles: assignedRoles,
      current_stage: 1,
      total_stages: totalStages,
      status: "pending_approval",
      execution_status: "not_required",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { ok: true, request: mockReq };
  }

  try {
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        reference_number: refNumber,
        category: input.category,
        request_type: input.request_type,
        title: input.title,
        description: input.description,
        justification: input.justification,
        requested_by: requesterId,
        amount: input.amount || null,
        currency: input.currency || "NGN",
        related_module: input.related_module || null,
        related_record_id: input.related_record_id || null,
        supporting_documents: input.supporting_documents || [],
        assigned_approver_roles: assignedRoles,
        current_stage: 1,
        total_stages: totalStages,
        status: "pending_approval",
        execution_status: input.category === "finance" ? "pending_execution" : "not_required",
      })
      .select()
      .single();

    if (error || !data) {
      return { ok: false, message: error?.message || "Failed to submit approval request." };
    }

    // Insert into decision history
    await supabase.from("approval_decision_history").insert({
      approval_request_id: data.id,
      stage: 1,
      actor_id: requesterId,
      action: "submitted",
      comments: input.justification,
      previous_status: "draft",
      new_status: "pending_approval",
    });

    return { ok: true, request: data as ApprovalRequest };
  } catch (err: any) {
    return { ok: false, message: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Processes an approval decision (Approve, Reject, Return, Withdraw, Execute).
 * Uses atomic Supabase RPC if available, with maker-checker enforcement.
 */
export async function processApprovalDecision(
  requestId: string,
  action: "approved" | "rejected" | "returned_for_revision" | "withdrawn" | "executed",
  comments: string,
  callerStaffId: string,
  callerRole: CanonicalStaffRole,
  executionNotes?: string
): Promise<{ ok: boolean; message?: string }> {
  if (!comments || !comments.trim()) {
    return { ok: false, message: "Comments are mandatory for this decision." };
  }

  // Preflight Maker-Checker in client code as well
  const { request } = await fetchApprovalRequestDetails(requestId);
  if (!request) {
    return { ok: false, message: "Approval request not found." };
  }

  if (action === "approved" && request.requested_by === callerStaffId) {
    return {
      ok: false,
      message: "Maker-checker violation: Requester cannot approve their own request.",
    };
  }

  if (!supabase) {
    return { ok: true };
  }

  try {
    // Attempt database RPC
    const { data, error } = await supabase.rpc("process_approval_decision", {
      p_request_id: requestId,
      p_action: action,
      p_comments: comments.trim(),
      p_execution_notes: executionNotes || null,
    });

    if (error) {
      // Fallback manual transactional steps if RPC is not yet loaded in DB
      return await fallbackProcessDecision(request, action, comments, callerStaffId, callerRole, executionNotes);
    }

    return { ok: true };
  } catch {
    return await fallbackProcessDecision(request, action, comments, callerStaffId, callerRole, executionNotes);
  }
}

async function fallbackProcessDecision(
  request: ApprovalRequest,
  action: "approved" | "rejected" | "returned_for_revision" | "withdrawn" | "executed",
  comments: string,
  callerStaffId: string,
  callerRole: CanonicalStaffRole,
  executionNotes?: string
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  try {
    const newStatus =
      action === "approved"
        ? "approved"
        : action === "rejected"
        ? "rejected"
        : action === "returned_for_revision"
        ? "returned_for_revision"
        : action === "withdrawn"
        ? "withdrawn"
        : "executed";

    const { error: updateErr } = await supabase
      .from("approval_requests")
      .update({
        status: newStatus,
        decision_by: callerStaffId,
        decision_at: new Date().toISOString(),
        decision_comments: comments,
        execution_status: action === "executed" ? "executed" : request.execution_status,
        execution_notes: executionNotes || request.execution_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateErr) return { ok: false, message: updateErr.message };

    await supabase.from("approval_decision_history").insert({
      approval_request_id: request.id,
      stage: request.current_stage,
      actor_id: callerStaffId,
      action: action,
      comments: comments,
      previous_status: request.status,
      new_status: newStatus,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to record approval decision." };
  }
}
