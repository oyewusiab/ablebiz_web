import type {
  AppointmentRecord,
  AppointmentStatus,
  AppointmentSummaryMetrics,
  StaffAvailabilityRuleRecord,
  TimeSlot,
} from "./types";
import { OFFICIAL_BUSINESS_EMAIL_CONFIG } from "../communications/emailConfig";

/**
 * Standard business working hours in Nigeria (Africa/Lagos)
 */
export const DEFAULT_WORKING_HOURS = {
  start: "08:30",
  end: "17:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  bufferMinutes: 15,
  workingDays: [1, 2, 3, 4, 5], // Monday through Friday
};

/**
 * Converts HH:mm or HH:mm:ss string to total minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from midnight to HH:mm string
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Generates an idempotent human-readable appointment reference code
 * Format: APT-YYYY-XXXX (e.g. APT-2026-4821)
 */
export function generateAppointmentReferenceCode(seed?: number | string): string {
  const year = new Date().getFullYear();
  let randomPart: string;
  if (seed !== undefined && seed !== null) {
    const numericSeed = Math.abs(typeof seed === "number" ? seed : seed.split("").reduce((a, b) => a + b.charCodeAt(0), 0));
    randomPart = (numericSeed % 9000 + 1000).toString();
  } else {
    randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return `APT-${year}-${randomPart}`;
}

/**
 * Checks whether two time intervals on the same day overlap
 * Returns true if [start1, end1) overlaps with [start2, end2)
 */
export function doTimeIntervalsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeStringToMinutes(start1);
  const e1 = timeStringToMinutes(end1);
  const s2 = timeStringToMinutes(start2);
  const e2 = timeStringToMinutes(end2);
  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Verifies staff member availability for a specified date and time window
 * Evaluates working days, hours, lunch breaks, unavailable dates, approved HR leave,
 * and existing overlapping appointments.
 */
export function checkStaffAvailability(params: {
  staffId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  availabilityRule?: StaffAvailabilityRuleRecord | null;
  approvedLeaveIntervals?: Array<{ startDate: string; endDate: string; reason?: string }>;
  existingAppointments?: AppointmentRecord[];
  excludeAppointmentId?: string;
}): {
  isAvailable: boolean;
  reason?: string;
} {
  const {
    staffId,
    date,
    startTime,
    endTime,
    availabilityRule,
    approvedLeaveIntervals = [],
    existingAppointments = [],
    excludeAppointmentId,
  } = params;

  // 1. Day of Week Check
  // Date string parsing in UTC to avoid local timezone offset drift
  const [y, m, d] = date.split("-").map((v) => parseInt(v, 10));
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  let dayOfWeek = dateObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (dayOfWeek === 0) dayOfWeek = 7; // ISO convention: 7=Sun

  const workingDays = availabilityRule?.working_days || DEFAULT_WORKING_HOURS.workingDays;
  if (!workingDays.includes(dayOfWeek)) {
    return {
      isAvailable: false,
      reason: "Staff member is not scheduled to work on this day.",
    };
  }

  // 2. Working Hours Check
  const workStart = availabilityRule?.work_start_time || DEFAULT_WORKING_HOURS.start;
  const workEnd = availabilityRule?.work_end_time || DEFAULT_WORKING_HOURS.end;
  const reqStart = timeStringToMinutes(startTime);
  const reqEnd = timeStringToMinutes(endTime);

  if (reqStart < timeStringToMinutes(workStart) || reqEnd > timeStringToMinutes(workEnd)) {
    return {
      isAvailable: false,
      reason: `Selected time is outside staff working hours (${workStart.slice(0, 5)} - ${workEnd.slice(0, 5)}).`,
    };
  }

  // 3. Break Period Check
  const breakStart = availabilityRule?.break_start_time || DEFAULT_WORKING_HOURS.breakStart;
  const breakEnd = availabilityRule?.break_end_time || DEFAULT_WORKING_HOURS.breakEnd;
  if (breakStart && breakEnd && doTimeIntervalsOverlap(startTime, endTime, breakStart, breakEnd)) {
    return {
      isAvailable: false,
      reason: `Selected time overlaps with scheduled break period (${breakStart.slice(0, 5)} - ${breakEnd.slice(0, 5)}).`,
    };
  }

  // 4. Explicit Unavailable Dates Check
  if (availabilityRule?.unavailable_dates && availabilityRule.unavailable_dates.includes(date)) {
    return {
      isAvailable: false,
      reason: "Staff member has marked this specific date as unavailable.",
    };
  }

  // 5. Approved HR Leave Check (Seamless integration with Phase 1 / HR workspace)
  const onLeave = approvedLeaveIntervals.some(
    (leave) => date >= leave.startDate && date <= leave.endDate
  );
  if (onLeave) {
    return {
      isAvailable: false,
      reason: "Staff member is on approved statutory or official leave on this date.",
    };
  }

  // 6. Overlapping Existing Appointments Check
  const bufferMins = availabilityRule?.buffer_minutes ?? DEFAULT_WORKING_HOURS.bufferMinutes;
  const conflicting = existingAppointments.find((appt) => {
    if (appt.id === excludeAppointmentId) return false;
    if (appt.assigned_staff_id !== staffId) return false;
    if (appt.appointment_date !== date) return false;
    if (["cancelled", "client_did_not_attend", "staff_unavailable"].includes(appt.status)) {
      return false; // Inactive or cancelled appointments do not block slots
    }

    // Apply buffer between appointments
    const apptStartMins = Math.max(0, timeStringToMinutes(appt.start_time) - bufferMins);
    const apptEndMins = timeStringToMinutes(appt.end_time) + bufferMins;

    return Math.max(reqStart, apptStartMins) < Math.min(reqEnd, apptEndMins);
  });

  if (conflicting) {
    return {
      isAvailable: false,
      reason: `Staff member has a conflicting appointment (${conflicting.title}) from ${conflicting.start_time.slice(0, 5)} to ${conflicting.end_time.slice(0, 5)}.`,
    };
  }

  return { isAvailable: true };
}

/**
 * Computes available discrete time slots for a given staff member on a specific date
 */
export function generateAvailableTimeSlots(params: {
  staffId: string;
  date: string;
  slotDurationMinutes: number; // e.g. 30, 45, 60
  availabilityRule?: StaffAvailabilityRuleRecord | null;
  approvedLeaveIntervals?: Array<{ startDate: string; endDate: string }>;
  existingAppointments?: AppointmentRecord[];
}): TimeSlot[] {
  const {
    staffId,
    date,
    slotDurationMinutes,
    availabilityRule,
    approvedLeaveIntervals = [],
    existingAppointments = [],
  } = params;

  const workStart = availabilityRule?.work_start_time || DEFAULT_WORKING_HOURS.start;
  const workEnd = availabilityRule?.work_end_time || DEFAULT_WORKING_HOURS.end;
  const buffer = availabilityRule?.buffer_minutes ?? DEFAULT_WORKING_HOURS.bufferMinutes;

  const startMins = timeStringToMinutes(workStart);
  const endMins = timeStringToMinutes(workEnd);

  const slots: TimeSlot[] = [];
  let currentStart = startMins;

  while (currentStart + slotDurationMinutes <= endMins) {
    const currentEnd = currentStart + slotDurationMinutes;
    const startStr = minutesToTimeString(currentStart);
    const endStr = minutesToTimeString(currentEnd);

    const check = checkStaffAvailability({
      staffId,
      date,
      startTime: startStr,
      endTime: endStr,
      availabilityRule,
      approvedLeaveIntervals,
      existingAppointments,
    });

    slots.push({
      startTime: startStr,
      endTime: endStr,
      available: check.isAvailable,
      reasonUnavailable: check.reason,
    });

    // Advance by slot duration plus buffer
    currentStart += slotDurationMinutes + buffer;
  }

  return slots;
}

/**
 * Validates lifecycle status transitions for appointments
 */
export function validateAppointmentStatusTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus,
  options?: { cancellationReason?: string }
): { isValid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { isValid: true };
  }

  if (["completed", "cancelled"].includes(currentStatus)) {
    return {
      isValid: false,
      error: `Cannot transition an appointment that is already ${currentStatus}.`,
    };
  }

  if (targetStatus === "cancelled" && !options?.cancellationReason?.trim()) {
    return {
      isValid: false,
      error: "Cancellation reason is required when cancelling an appointment.",
    };
  }

  return { isValid: true };
}

/**
 * Composes an appointment notification and reminder message
 * Enforces official business identity and prepares click-to-chat WhatsApp link
 */
export function composeAppointmentReminder(params: {
  appointment: AppointmentRecord;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  minutesBefore: number;
}): {
  emailSubject: string;
  emailPlainBody: string;
  whatsappMessage: string;
  whatsappClickUrl: string;
  fromIdentity: string;
} {
  const { appointment, clientName, clientPhone, minutesBefore } = params;

  const timeLabel = minutesBefore >= 1440
    ? "tomorrow"
    : minutesBefore >= 60
    ? `in ${Math.round(minutesBefore / 60)} hour(s)`
    : `in ${minutesBefore} minutes`;

  const dateFormatted = appointment.appointment_date;
  const timeFormatted = `${appointment.start_time.slice(0, 5)} - ${appointment.end_time.slice(0, 5)} (WAT)`;
  const locationText = appointment.meeting_location === "office"
    ? `At our office: ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialAddress}`
    : appointment.meeting_link
    ? `Online via: ${appointment.meeting_link}`
    : `Online / Phone consultation (${appointment.meeting_location.replace("_", " ")})`;

  const emailSubject = `Appointment Reminder: ${appointment.title} (${appointment.reference_code}) scheduled for ${dateFormatted} — ABLEBIZ`;

  const emailPlainBody = `Dear ${clientName},

This is a scheduled reminder that your consultation with ABLEBIZ BUSINESS SERVICES is scheduled ${timeLabel}.

Appointment Details:
- Consultation: ${appointment.title}
- Reference Code: ${appointment.reference_code}
- Date: ${dateFormatted}
- Time: ${timeFormatted}
- Location / Channel: ${locationText}
${appointment.meeting_link ? `- Meeting Link: ${appointment.meeting_link}\n` : ""}
If you need to reschedule or have questions before our session, please contact our office directly at ${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialPhone} or reply to hello@ablebiz.com.ng.

Best regards,
Client Relations Team
ABLEBIZ BUSINESS SERVICES LIMITED
${OFFICIAL_BUSINESS_EMAIL_CONFIG.officialWebsite}
`;

  const whatsappMessage = `*Appointment Reminder — ABLEBIZ BUSINESS SERVICES*

Hello ${clientName}, this is a gentle reminder that your session is scheduled ${timeLabel}.

📋 *${appointment.title}*
🔖 Ref: ${appointment.reference_code}
📅 Date: ${dateFormatted}
⏰ Time: ${timeFormatted}
📍 Location: ${appointment.meeting_location === "office" ? "ABLEBIZ Office, Abeokuta" : locationText}
${appointment.meeting_link ? `🔗 Link: ${appointment.meeting_link}\n` : ""}
Need help or need to adjust your time? Call or reply directly here.`;

  const cleanedPhone = (clientPhone || "").replace(/\D/g, "");
  const formattedPhone = cleanedPhone.startsWith("0")
    ? `234${cleanedPhone.slice(1)}`
    : cleanedPhone.startsWith("234")
    ? cleanedPhone
    : `234${cleanedPhone}`;

  const whatsappClickUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  return {
    emailSubject,
    emailPlainBody,
    whatsappMessage,
    whatsappClickUrl,
    fromIdentity: OFFICIAL_BUSINESS_EMAIL_CONFIG.formattedDisplayFrom,
  };
}

/**
 * Computes high-level appointment summary metrics across a collection of appointments
 */
export function computeAppointmentSummary(
  appointments: AppointmentRecord[],
  referenceDateString?: string
): AppointmentSummaryMetrics {
  const todayStr = referenceDateString || new Date().toISOString().slice(0, 10);

  let todayCount = 0;
  let upcomingCount = 0;
  let unconfirmedCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let missedCount = 0;

  for (const appt of appointments) {
    if (appt.appointment_date === todayStr && !["cancelled", "completed"].includes(appt.status)) {
      todayCount++;
    }

    if (appt.appointment_date > todayStr && !["cancelled", "completed"].includes(appt.status)) {
      upcomingCount++;
    }

    if (appt.status === "scheduled" || appt.status === "requested") {
      unconfirmedCount++;
    }

    if (appt.status === "completed") {
      completedCount++;
    }

    if (appt.status === "cancelled") {
      cancelledCount++;
    }

    if (appt.status === "client_did_not_attend" || appt.status === "staff_unavailable") {
      missedCount++;
    }
  }

  const concludedCount = completedCount + missedCount;
  const completionRate = concludedCount > 0
    ? Math.round((completedCount / concludedCount) * 100)
    : appointments.length > 0
    ? 100
    : 0;

  return {
    totalAppointments: appointments.length,
    todayCount,
    upcomingCount,
    unconfirmedCount,
    completedCount,
    cancelledCount,
    missedCount,
    completionRate,
  };
}
