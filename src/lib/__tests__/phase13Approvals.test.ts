import test from "node:test";
import assert from "node:assert/strict";

import {
  canUserApprove,
  canUserWithdraw,
  DEFAULT_APPROVAL_RULES,
} from "../approvals/approvalService";
import type {
  ApprovalRequest,
  ApprovalRule,
} from "../../types/approvals";

test("Phase 13 — Approvals: Maker-Checker safeguard strictly prevents requester from self-approving", () => {
  const request: ApprovalRequest = {
    id: "req-001",
    reference_number: "APP-2026-0001",
    category: "finance",
    request_type: "expense",
    title: "Office Generator Maintenance & Fuel",
    description: "Scheduled servicing and 200L diesel purchase.",
    justification: "Critical business continuity for office operations.",
    amount: 85000,
    currency: "NGN",
    requested_by: "user-alice", // Alice submitted
    current_stage: 1,
    total_stages: 1,
    assigned_approver_roles: ["operations_manager", "accounts_officer"],
    supporting_documents: [],
    status: "pending_approval",
    execution_status: "not_required",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  };

  // Alice is an Operations Manager, but she is the REQUESTER!
  const aliceCheck = canUserApprove(request, "operations_manager", "user-alice");
  assert.equal(aliceCheck.canApprove, false);
  assert.match(aliceCheck.reason || "", /maker-checker violation.*cannot approve/i);

  // Bob is an Operations Manager and is NOT the requester
  const bobCheck = canUserApprove(request, "operations_manager", "user-bob");
  assert.equal(bobCheck.canApprove, true);

  // Charlie is a Registration Officer (not an assigned role)
  const charlieCheck = canUserApprove(request, "registration_officer", "user-charlie");
  assert.equal(charlieCheck.canApprove, false);
  assert.match(charlieCheck.reason || "", /not authorized/i);

  // Super Admin can approve if not the requester
  const adminCheck = canUserApprove(request, "super_admin", "user-boss");
  assert.equal(adminCheck.canApprove, true);
});

test("Phase 13 — Approvals: Status immutability prevents double-decisions on terminal states", () => {
  const approvedRequest: ApprovalRequest = {
    id: "req-002",
    reference_number: "APP-2026-0002",
    category: "finance",
    request_type: "refund",
    title: "Client Overpayment Refund",
    description: "Client paid twice for Ltd registration.",
    justification: "Client account reconciliation.",
    amount: 15000,
    currency: "NGN",
    requested_by: "user-david",
    current_stage: 1,
    total_stages: 1,
    assigned_approver_roles: ["super_admin", "admin"],
    supporting_documents: [],
    status: "approved", // Terminal state
    execution_status: "pending_execution",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-02T12:00:00Z",
  };

  // Even Super Admin cannot approve an already-approved or terminal request
  const check = canUserApprove(approvedRequest, "super_admin", "user-boss");
  assert.equal(check.canApprove, false);
  assert.match(check.reason || "", /cannot be approved in its current status/i);
});

test("Phase 13 — Approvals: Request withdrawal is permitted only for requester or Super Admin on pending items", () => {
  const pendingRequest: ApprovalRequest = {
    id: "req-003",
    reference_number: "APP-2026-0003",
    category: "commercial",
    request_type: "discount",
    title: "15% High-Volume Client Discount",
    description: "Discount for batch incorporation of 5 entities.",
    justification: "Volume discount incentive.",
    amount: 25000,
    currency: "NGN",
    requested_by: "user-marketing",
    current_stage: 1,
    total_stages: 1,
    assigned_approver_roles: ["super_admin", "admin"],
    supporting_documents: [],
    status: "pending_approval",
    execution_status: "not_required",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  };

  // Requester can withdraw
  assert.equal(canUserWithdraw(pendingRequest, "user-marketing", "marketing_officer"), true);

  // Other staff cannot withdraw
  assert.equal(canUserWithdraw(pendingRequest, "user-charlie", "registration_officer"), false);

  // Super Admin can withdraw/abort
  assert.equal(canUserWithdraw(pendingRequest, "user-boss", "super_admin"), true);

  // Non-pending cannot be withdrawn
  const rejectedRequest = { ...pendingRequest, status: "rejected" as const };
  assert.equal(canUserWithdraw(rejectedRequest, "user-marketing", "marketing_officer"), false);
});

test("Phase 13 — Approvals: Default approval rules cover financial, commercial, operational, and administrative decisions", () => {
  assert.ok(DEFAULT_APPROVAL_RULES.length >= 6);

  const categories = DEFAULT_APPROVAL_RULES.map((r) => r.category);
  assert.ok(categories.includes("finance"), "Includes financial category");
  assert.ok(categories.includes("commercial"), "Includes commercial category");
  assert.ok(categories.includes("operations"), "Includes operations category");
  assert.ok(categories.includes("administration"), "Includes administration category");

  // Verify critical rules
  const expenseRule = DEFAULT_APPROVAL_RULES.find((r) => r.request_type === "expense");
  assert.ok(expenseRule, "Expense rule must exist");
  assert.ok(expenseRule.required_approver_roles.includes("admin"));
  assert.equal(expenseRule.mandatory_comments, true);

  const refundRule = DEFAULT_APPROVAL_RULES.find((r) => r.request_type === "refund");
  assert.ok(refundRule, "Refund rule must exist");
  assert.ok(refundRule.sequential_stages >= 2, "Refunds should enforce multi-stage review");

  const staffRule = DEFAULT_APPROVAL_RULES.find((r) => r.request_type === "staff_change");
  assert.ok(staffRule, "Staff profile changes must require executive authorization");
  assert.deepEqual(staffRule.required_approver_roles, ["super_admin"]);
});
