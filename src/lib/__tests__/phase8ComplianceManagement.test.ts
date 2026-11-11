import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateComplianceDeadlineStatus,
  computeComplianceSummary,
  composeComplianceReminderMessage,
  calculateNextComplianceDueDate,
  DEFAULT_COMPLIANCE_RULES,
  ComplianceObligationRecord,
} from "../compliance/complianceService";

test("Phase 8 — Compliance: Dynamic 30, 60, 90-day deadline categorization and overdue calculation", () => {
  const refNow = new Date("2026-05-01T00:00:00Z");

  // 1. Due in 10 days (May 11) -> Due in 30 days
  const status10d = calculateComplianceDeadlineStatus("2026-05-11", "pending", refNow);
  assert.equal(status10d.computedStatus, "due_soon");
  assert.equal(status10d.isOverdue, false);
  assert.equal(status10d.daysDiff, 10);
  assert.equal(status10d.badgeTone, "amber");

  // 2. Due in 45 days (June 15) -> Due in 60 days
  const status45d = calculateComplianceDeadlineStatus("2026-06-15", "upcoming", refNow);
  assert.equal(status45d.computedStatus, "upcoming");
  assert.equal(status45d.isOverdue, false);
  assert.equal(status45d.daysDiff, 45);
  assert.equal(status45d.badgeTone, "blue");

  // 3. Past due date (April 20) -> Overdue
  const statusOverdue = calculateComplianceDeadlineStatus("2026-04-20", "upcoming", refNow);
  assert.equal(statusOverdue.computedStatus, "overdue");
  assert.equal(statusOverdue.isOverdue, true);
  assert.equal(statusOverdue.badgeTone, "rose");
  assert.match(statusOverdue.statusLabel, /overdue by 11d/i);

  // 4. Completed status
  const statusCompleted = calculateComplianceDeadlineStatus("2026-04-10", "completed", refNow);
  assert.equal(statusCompleted.computedStatus, "completed");
  assert.equal(statusCompleted.isOverdue, false);
  assert.equal(statusCompleted.badgeTone, "emerald");
});

test("Phase 8 — Compliance: Evaluates compliance summary metrics across obligations correctly", () => {
  const refNow = new Date("2026-05-01T00:00:00Z");

  const obligations: any[] = [
    // Due in 15 days (<= 30d, <= 60d, <= 90d)
    { id: "o1", due_date: "2026-05-16", status: "upcoming", opportunity_status: "identified", verification_status: "verified" },
    // Due in 45 days (<= 60d, <= 90d)
    { id: "o2", due_date: "2026-06-15", status: "upcoming", opportunity_status: "contacted", verification_status: "verified" },
    // Due in 75 days (<= 90d)
    { id: "o3", due_date: "2026-07-15", status: "upcoming", opportunity_status: "none", verification_status: "verified" },
    // Overdue
    { id: "o4", due_date: "2026-04-10", status: "upcoming", opportunity_status: "interested", verification_status: "requires_verification" },
    // Completed this year
    { id: "o5", due_date: "2026-03-01", status: "completed", last_completed_date: "2026-03-05", opportunity_status: "converted", verification_status: "verified" },
  ];

  const summary = computeComplianceSummary(obligations, refNow);

  assert.equal(summary.dueNext30Days, 1);
  assert.equal(summary.dueNext60Days, 2); // o1 + o2
  assert.equal(summary.dueNext90Days, 3); // o1 + o2 + o3
  assert.equal(summary.overdueCount, 1); // o4
  assert.equal(summary.completedThisYear, 1); // o5
  assert.equal(summary.recurringOpportunitiesIdentified, 3); // o1, o2, o4
  assert.equal(summary.recurringOpportunitiesConverted, 1); // o5
  assert.equal(summary.requiresVerificationCount, 1); // o4
});

test("Phase 8 — Compliance: Calculates next statutory due date based on recurrence frequency", () => {
  // Annual: May 15, 2026 -> May 15, 2027
  const nextAnnual = calculateNextComplianceDueDate("2026-05-15", "annual");
  assert.equal(nextAnnual, "2027-05-15");

  // Quarterly: May 15, 2026 -> Aug 15, 2026
  const nextQuarterly = calculateNextComplianceDueDate("2026-05-15", "quarterly");
  assert.equal(nextQuarterly, "2026-08-15");

  // Semi-annual: May 15, 2026 -> Nov 15, 2026
  const nextSemi = calculateNextComplianceDueDate("2026-05-15", "semi_annual");
  assert.equal(nextSemi, "2026-11-15");

  // One-time: no next due date
  const nextOneTime = calculateNextComplianceDueDate("2026-05-15", "one_time");
  assert.equal(nextOneTime, null);
});

test("Phase 8 — Compliance: Client reminder composition enforces official email identity and unconfirmed draft safety", () => {
  const reminder = composeComplianceReminderMessage({
    clientName: "Babajide Sanwo",
    businessName: "Eko Digital Solutions",
    obligationName: "CAC Annual Returns",
    dueDate: "2026-06-30",
    channel: "email",
    serviceFee: 35_000,
  });

  assert.match(reminder.subject, /statutory compliance advisory.*cac annual returns.*eko digital solutions/i);
  assert.match(reminder.body, /hello@ablebiz\.com\.ng/);
  assert.match(reminder.body, /35,000/);
  assert.match(reminder.body, /2026-06-30/);

  // WhatsApp click-to-chat
  const waReminder = composeComplianceReminderMessage({
    clientName: "Babajide Sanwo",
    businessName: "Eko Digital Solutions",
    obligationName: "CAC Annual Returns",
    dueDate: "2026-06-30",
    channel: "whatsapp",
  });

  assert.ok(waReminder.whatsappUrl);
  assert.match(waReminder.whatsappUrl!, /wa\.me/);
  assert.match(waReminder.whatsappUrl!, /CAC%20Annual%20Returns/);
});

test("Phase 8 — Compliance: Baseline rules verify CAMA 2020 legal citations and distinguish unverified rules", () => {
  const bnRule = DEFAULT_COMPLIANCE_RULES.find((r) => r.name.includes("Business Name"))!;
  assert.ok(bnRule.statutory_reference.includes("CAMA 2020 s. 822"));
  assert.equal(bnRule.verification_status, "verified");

  const ltdRule = DEFAULT_COMPLIANCE_RULES.find((r) => r.name.includes("Private Limited Company"))!;
  assert.ok(ltdRule.statutory_reference.includes("CAMA 2020 s. 377"));
  assert.equal(ltdRule.verification_status, "verified");

  const itRule = DEFAULT_COMPLIANCE_RULES.find((r) => r.name.includes("Incorporated Trustee"))!;
  assert.ok(itRule.statutory_reference.includes("CAMA 2020 s. 848"));
  assert.equal(itRule.verification_status, "verified");

  const trademarkRule = DEFAULT_COMPLIANCE_RULES.find((r) => r.name.includes("Trademark"))!;
  assert.equal(trademarkRule.verification_status, "requires_verification");
});
