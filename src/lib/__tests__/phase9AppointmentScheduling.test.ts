import test from "node:test";
import assert from "node:assert/strict";

import {
  generateAppointmentReferenceCode,
  doTimeIntervalsOverlap,
  checkStaffAvailability,
  generateAvailableTimeSlots,
  validateAppointmentStatusTransition,
  composeAppointmentReminder,
  computeAppointmentSummary,
} from "../scheduling/schedulingService";
import type { AppointmentRecord, StaffAvailabilityRuleRecord } from "../scheduling/types";

test("Phase 9 — Appointments: Reference code generation follows APT-YYYY-XXXX format", () => {
  const ref1 = generateAppointmentReferenceCode(1234);
  const ref2 = generateAppointmentReferenceCode(5678);
  assert.match(ref1, /^APT-\d{4}-\d{4}$/);
  assert.match(ref2, /^APT-\d{4}-\d{4}$/);
  assert.notEqual(ref1, ref2);
});

test("Phase 9 — Appointments: Time interval overlap detection is mathematically exact", () => {
  // Overlapping
  assert.equal(doTimeIntervalsOverlap("09:00", "10:00", "09:30", "10:30"), true);
  assert.equal(doTimeIntervalsOverlap("09:00", "11:00", "09:30", "10:00"), true); // Subset
  assert.equal(doTimeIntervalsOverlap("09:30", "10:00", "09:00", "11:00"), true); // Superset

  // Non-overlapping (adjacent)
  assert.equal(doTimeIntervalsOverlap("09:00", "10:00", "10:00", "11:00"), false);
  // Non-overlapping (separated)
  assert.equal(doTimeIntervalsOverlap("09:00", "10:00", "11:00", "12:00"), false);
});

test("Phase 9 — Appointments: Staff availability detects working hours, breaks, and weekends", () => {
  const rule: StaffAvailabilityRuleRecord = {
    id: "rule-1",
    staff_id: "staff-adebayo",
    working_days: [1, 2, 3, 4, 5], // Mon-Fri
    work_start_time: "08:30:00",
    work_end_time: "17:00:00",
    break_start_time: "13:00:00",
    break_end_time: "14:00:00",
    buffer_minutes: 15,
    is_active: true,
  };

  // Valid weekday during business hours: 2026-05-11 is Monday
  const valid = checkStaffAvailability({
    staffId: "staff-adebayo",
    date: "2026-05-11",
    startTime: "10:00",
    endTime: "11:00",
    availabilityRule: rule,
  });
  assert.equal(valid.isAvailable, true);

  // Overlap with lunch break (13:00 - 14:00)
  const breakConflict = checkStaffAvailability({
    staffId: "staff-adebayo",
    date: "2026-05-11",
    startTime: "13:30",
    endTime: "14:30",
    availabilityRule: rule,
  });
  assert.equal(breakConflict.isAvailable, false);
  assert.match(breakConflict.reason || "", /break period/i);

  // Weekend (2026-05-10 is Sunday)
  const weekend = checkStaffAvailability({
    staffId: "staff-adebayo",
    date: "2026-05-10",
    startTime: "10:00",
    endTime: "11:00",
    availabilityRule: rule,
  });
  assert.equal(weekend.isAvailable, false);
  assert.match(weekend.reason || "", /not scheduled to work/i);
});

test("Phase 9 — Appointments: Staff availability respects approved HR leave & existing bookings", () => {
  const rule: StaffAvailabilityRuleRecord = {
    id: "rule-1",
    staff_id: "staff-folake",
    working_days: [1, 2, 3, 4, 5],
    work_start_time: "08:30:00",
    work_end_time: "17:00:00",
    buffer_minutes: 15,
    is_active: true,
  };

  const approvedLeaves = [
    { startDate: "2026-06-01", endDate: "2026-06-05", reason: "Annual Leave" },
  ];

  // Date during approved leave
  const leaveConflict = checkStaffAvailability({
    staffId: "staff-folake",
    date: "2026-06-03",
    startTime: "10:00",
    endTime: "11:00",
    availabilityRule: rule,
    approvedLeaveIntervals: approvedLeaves,
  });
  assert.equal(leaveConflict.isAvailable, false);
  assert.match(leaveConflict.reason || "", /approved statutory or official leave/i);

  // Existing appointment conflict
  const existingAppt: any = {
    id: "appt-1",
    assigned_staff_id: "staff-folake",
    appointment_date: "2026-05-12",
    start_time: "14:00:00",
    end_time: "15:00:00",
    status: "confirmed",
    title: "Company Registration Advisory",
  };

  const apptConflict = checkStaffAvailability({
    staffId: "staff-folake",
    date: "2026-05-12",
    startTime: "14:30",
    endTime: "15:30",
    availabilityRule: rule,
    existingAppointments: [existingAppt],
  });
  assert.equal(apptConflict.isAvailable, false);
  assert.match(apptConflict.reason || "", /conflicting appointment/i);
});

test("Phase 9 — Appointments: Generates available time slots with buffers", () => {
  const rule: StaffAvailabilityRuleRecord = {
    id: "rule-1",
    staff_id: "staff-1",
    working_days: [1, 2, 3, 4, 5],
    work_start_time: "09:00:00",
    work_end_time: "12:00:00", // 3 hours window
    buffer_minutes: 15,
    is_active: true,
  };

  // 45 min slots + 15 min buffer = 60 min intervals (09:00-09:45, 10:00-10:45, 11:00-11:45)
  const slots = generateAvailableTimeSlots({
    staffId: "staff-1",
    date: "2026-05-11", // Monday
    slotDurationMinutes: 45,
    availabilityRule: rule,
  });

  assert.equal(slots.length, 3);
  assert.equal(slots[0].startTime, "09:00");
  assert.equal(slots[0].endTime, "09:45");
  assert.equal(slots[0].available, true);

  assert.equal(slots[1].startTime, "10:00");
  assert.equal(slots[1].endTime, "10:45");
  assert.equal(slots[1].available, true);
});

test("Phase 9 — Appointments: Enforces status transitions and cancellation reasons", () => {
  // Normal scheduled -> confirmed
  const validTransition = validateAppointmentStatusTransition("scheduled", "confirmed");
  assert.equal(validTransition.isValid, true);

  // Cancellation requires reason
  const missingReason = validateAppointmentStatusTransition("scheduled", "cancelled");
  assert.equal(missingReason.isValid, false);
  assert.match(missingReason.error || "", /cancellation reason is required/i);

  // Completed cannot be rescheduled
  const completedResched = validateAppointmentStatusTransition("completed", "rescheduled");
  assert.equal(completedResched.isValid, false);
  assert.match(completedResched.error || "", /cannot transition/i);
});

test("Phase 9 — Appointments: Reminder composer enforces official email identity & WhatsApp link", () => {
  const sampleAppt: any = {
    reference_code: "APT-2026-9041",
    title: "CAC Annual Returns Advisory",
    appointment_date: "2026-05-15",
    start_time: "11:00:00",
    end_time: "12:00:00",
    meeting_location: "office",
  };

  const reminder = composeAppointmentReminder({
    appointment: sampleAppt,
    clientName: "Engr. Nnamdi Kanu",
    clientPhone: "08031234567",
    minutesBefore: 120, // 2 hours
  });

  assert.match(reminder.fromIdentity, /hello@ablebiz.com.ng/i);
  assert.match(reminder.emailSubject, /appointment reminder.*apt-2026-9041/i);
  assert.match(reminder.whatsappClickUrl, /wa\.me\/2348031234567/);
  assert.match(decodeURIComponent(reminder.whatsappClickUrl), /APT-2026-9041/);
});

test("Phase 9 — Appointments: Evaluates appointment summary metrics accurately", () => {
  const appointments: any[] = [
    { appointment_date: "2026-05-11", status: "confirmed" },
    { appointment_date: "2026-05-11", status: "scheduled" },
    { appointment_date: "2026-05-12", status: "scheduled" },
    { appointment_date: "2026-05-10", status: "completed" },
    { appointment_date: "2026-05-10", status: "cancelled" },
    { appointment_date: "2026-05-10", status: "client_did_not_attend" },
  ];

  const summary = computeAppointmentSummary(appointments, "2026-05-11");
  assert.equal(summary.totalAppointments, 6);
  assert.equal(summary.todayCount, 2);
  assert.equal(summary.upcomingCount, 1);
  assert.equal(summary.unconfirmedCount, 2); // 2 scheduled
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.missedCount, 1); // client_did_not_attend
});
