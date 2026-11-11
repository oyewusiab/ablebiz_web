import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateSlaStatus,
  trackCacStageDuration,
  DEFAULT_SLA_CONFIGS,
} from "../sla/slaEngine";

import {
  DEFAULT_WORKFLOW_RULES,
  resolveSmartStaffAssignment,
} from "../automation/workflowEngine";

import {
  FOLLOW_UP_OUTCOMES,
} from "../followUps/followUpService";

import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../communications/emailConfig";

// ==============================================================================
// 1. SLA & DEADLINE MANAGEMENT TESTS
// ==============================================================================

test("SLA Engine — Calculates On-Track status when elapsed time is under warning threshold", () => {
  const start = new Date("2026-05-01T09:00:00Z");
  const referenceNow = new Date("2026-05-02T09:00:00Z"); // 1 day elapsed out of 5 days (20%)

  const res = calculateSlaStatus({
    startDate: start,
    expectedDurationDays: 5,
    warningThresholdPct: 75,
    referenceNow,
  });

  assert.equal(res.status, "on_track");
  assert.equal(res.statusLabel, "On Track");
  assert.equal(res.isWarning, false);
  assert.equal(res.isOverdue, false);
  assert.equal(res.elapsedDays, 1);
  assert.equal(res.remainingDays, 4);
  assert.equal(res.badgeTone, "emerald");
});

test("SLA Engine — Triggers 'Due Soon' warning when 75% or more of duration is consumed", () => {
  const start = new Date("2026-05-01T09:00:00Z");
  const referenceNow = new Date("2026-05-04T21:00:00Z"); // 3.5 days elapsed out of 4 days (87.5%)

  const res = calculateSlaStatus({
    startDate: start,
    expectedDurationDays: 4,
    warningThresholdPct: 75,
    referenceNow,
  });

  assert.equal(res.status, "due_soon");
  assert.equal(res.statusLabel, "Due Soon");
  assert.equal(res.isWarning, true);
  assert.equal(res.isOverdue, false);
  assert.equal(res.badgeTone, "amber");
  assert.match(res.remainingText, /remaining/i);
});

test("SLA Engine — Flags 'Deadline Missed' (Overdue) when 100% or more of expected duration is consumed", () => {
  const start = new Date("2026-05-01T09:00:00Z");
  const referenceNow = new Date("2026-05-07T09:00:00Z"); // 6 days elapsed on a 4-day SLA (2 days overdue)

  const res = calculateSlaStatus({
    startDate: start,
    expectedDurationDays: 4,
    warningThresholdPct: 75,
    referenceNow,
  });

  assert.equal(res.status, "overdue");
  assert.equal(res.statusLabel, "Deadline Missed");
  assert.equal(res.isOverdue, true);
  assert.equal(res.badgeTone, "rose");
  assert.match(res.remainingText, /2d overdue/i);
});

test("SLA Engine — Correctly identifies Paused state while awaiting client information", () => {
  const start = new Date("2026-05-01T09:00:00Z");
  const referenceNow = new Date("2026-05-03T09:00:00Z");

  const res = calculateSlaStatus({
    startDate: start,
    status: "awaiting_client",
    expectedDurationDays: 5,
    referenceNow,
  });

  assert.equal(res.status, "paused");
  assert.equal(res.statusLabel, "Paused (Awaiting Client)");
  assert.equal(res.badgeTone, "blue");
});

test("SLA Engine — Correctly evaluates Completed service delivered on time", () => {
  const start = new Date("2026-05-01T09:00:00Z");
  const targetEnd = new Date("2026-05-06T09:00:00Z"); // 5 days
  const completedAt = new Date("2026-05-04T12:00:00Z"); // 3.1 days (Delivered ahead of time)

  const res = calculateSlaStatus({
    startDate: start,
    targetCompletionDate: targetEnd,
    completedAt,
    status: "completed",
  });

  assert.equal(res.status, "completed");
  assert.equal(res.statusLabel, "Completed on Time");
  assert.equal(res.isOverdue, false);
  assert.equal(res.badgeTone, "emerald");
});

test("SLA Engine — CAC Stage Duration Tracking tracks time and flags prolonged stages", () => {
  const stageUpdated = new Date("2026-05-01T10:00:00Z");
  const referenceNow = new Date("2026-05-05T10:00:00Z"); // 4 days at stage

  const result = trackCacStageDuration("name_search", stageUpdated, referenceNow);

  assert.equal(result.stage, "name_search");
  assert.equal(result.stageLabel, "CAC Name Availability Search");
  assert.equal(result.daysAtStage, 4);
  assert.equal(result.isProlonged, true); // > 3 days at single stage is flagged as prolonged
  assert.match(result.formattedDuration, /4 days at this stage/i);
});

test("SLA Engine — Contains standard baseline service delivery configurations", () => {
  assert.ok(DEFAULT_SLA_CONFIGS.length >= 5);
  const bizName = DEFAULT_SLA_CONFIGS.find((c) => c.service_category.includes("Business Name"));
  const company = DEFAULT_SLA_CONFIGS.find((c) => c.service_category.includes("Company"));
  const ngo = DEFAULT_SLA_CONFIGS.find((c) => c.service_category.includes("NGO"));

  assert.ok(bizName);
  assert.equal(bizName.expected_duration_days, 4);
  assert.ok(company);
  assert.equal(company.expected_duration_days, 7);
  assert.ok(ngo);
  assert.equal(ngo.expected_duration_days, 21);
});

// ==============================================================================
// 2. SMART TASK & WORKFLOW AUTOMATION TESTS
// ==============================================================================

test("Workflow Automation — Default rules cover all 6 required business triggers", () => {
  const triggers = DEFAULT_WORKFLOW_RULES.map((r) => r.trigger_event);

  assert.ok(triggers.includes("service_request_created"));
  assert.ok(triggers.includes("missing_client_info"));
  assert.ok(triggers.includes("payment_verified"));
  assert.ok(triggers.includes("cac_stage_changed"));
  assert.ok(triggers.includes("service_completed"));
  assert.ok(triggers.includes("task_overdue"));
});

test("Workflow Automation — Rules assign tasks based on canonical staff roles", () => {
  const srRule = DEFAULT_WORKFLOW_RULES.find((r) => r.trigger_event === "service_request_created");
  const missingInfoRule = DEFAULT_WORKFLOW_RULES.find((r) => r.trigger_event === "missing_client_info");
  const paymentRule = DEFAULT_WORKFLOW_RULES.find((r) => r.trigger_event === "payment_verified");
  const postServiceRule = DEFAULT_WORKFLOW_RULES.find((r) => r.trigger_event === "service_completed");

  assert.equal(srRule?.target_role, "registration_officer");
  assert.equal(missingInfoRule?.target_role, "client_service_officer");
  assert.equal(paymentRule?.target_role, "registration_officer");
  assert.equal(postServiceRule?.target_role, "client_service_officer");
});

test("Workflow Automation — Fallback assignment gracefully routes to Manager Queue when no matching staff", async () => {
  const res = await resolveSmartStaffAssignment("non_existent_role", null);

  assert.equal(res.isManagerQueue, true);
  assert.ok(res.reason.includes("Manager Attention Queue") || res.reason.includes("Offline"));
});

// ==============================================================================
// 3. CLIENT FOLLOW-UP & RELATIONSHIPS AUTOMATION TESTS
// ==============================================================================

test("Client Follow-Ups — Standard outcome catalogue specifies required follow-up transitions", () => {
  assert.ok(FOLLOW_UP_OUTCOMES.length >= 8);

  const awaiting = FOLLOW_UP_OUTCOMES.find((o) => o.id === "awaiting_response");
  const infoReceived = FOLLOW_UP_OUTCOMES.find((o) => o.id === "info_received");
  const completed = FOLLOW_UP_OUTCOMES.find((o) => o.id === "completed");

  assert.ok(awaiting);
  assert.equal(awaiting.requiresNextFollowUp, true); // Awaiting response requires scheduling next follow-up

  assert.ok(infoReceived);
  assert.equal(infoReceived.requiresNextFollowUp, false);

  assert.ok(completed);
  assert.equal(completed.requiresNextFollowUp, false);
});

test("Client Follow-Ups — Communication Center strictly enforces official business email identity", () => {
  assert.equal(OFFICIAL_BUSINESS_EMAIL_CONFIG.senderEmail, "hello@ablebiz.com.ng");
  assert.equal(OFFICIAL_BUSINESS_EMAIL_CONFIG.replyToEmail, "hello@ablebiz.com.ng");
  assert.equal(OFFICIAL_BUSINESS_EMAIL_CONFIG.senderName, "ABLEBIZ BUSINESS SERVICES");
});
