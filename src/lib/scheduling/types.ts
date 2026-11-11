import type { CanonicalStaffRole } from "../../auth/roleConfig";

export type MeetingLocationType =
  | "office"
  | "google_meet"
  | "zoom"
  | "phone_call"
  | "whatsapp_call"
  | "client_premises"
  | "other";

export type AppointmentStatus =
  | "requested"
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "client_did_not_attend"
  | "staff_unavailable";

export interface AppointmentTypeRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  default_duration: number; // minutes
  buffer_minutes: number; // minutes
  eligible_roles: CanonicalStaffRole[];
  location_options: MeetingLocationType[];
  reminder_schedule: number[]; // minutes before
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StaffAvailabilityRuleRecord {
  id: string;
  staff_id: string;
  working_days: number[]; // 1=Mon, 5=Fri
  work_start_time: string; // HH:mm:ss
  work_end_time: string; // HH:mm:ss
  break_start_time?: string | null;
  break_end_time?: string | null;
  buffer_minutes: number;
  unavailable_dates?: string[]; // YYYY-MM-DD
  notes?: string | null;
  is_active: boolean;
}

export interface AppointmentRecord {
  id: string;
  reference_code: string;
  title: string;
  appointment_type_id?: string | null;
  appointment_type?: AppointmentTypeRecord | null;
  client_id?: string | null;
  client?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
  } | null;
  lead_id?: string | null;
  lead?: {
    id: string;
    contact_name: string;
    phone: string;
    email?: string | null;
  } | null;
  assigned_staff_id?: string | null;
  assigned_staff?: {
    id: string;
    full_name: string;
    role: CanonicalStaffRole;
    email?: string;
  } | null;
  service_request_id?: string | null;
  compliance_obligation_id?: string | null;
  appointment_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string; // HH:mm:ss or HH:mm
  duration_minutes: number;
  timezone: string; // "Africa/Lagos"
  meeting_location: MeetingLocationType;
  meeting_link?: string | null;
  purpose?: string | null;
  status: AppointmentStatus;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  completion_outcome?: string | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  next_action?: string | null;
  follow_up_task_id?: string | null;
  internal_notes?: string | null;
  client_notes?: string | null;
  is_public_booking: boolean;
  client_contact_name?: string | null;
  client_contact_phone?: string | null;
  client_contact_email?: string | null;
  rescheduled_from_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentFilterOptions {
  dateRangePreset?: "today" | "this_week" | "this_month" | "upcoming" | "history" | "all";
  startDate?: string;
  endDate?: string;
  staffId?: string;
  appointmentTypeId?: string;
  clientId?: string;
  status?: AppointmentStatus | "all";
  meetingLocation?: MeetingLocationType | "all";
  searchTerm?: string;
}

export interface AppointmentSummaryMetrics {
  totalAppointments: number;
  todayCount: number;
  upcomingCount: number;
  unconfirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  missedCount: number; // client_did_not_attend or staff_unavailable
  completionRate: number; // percentage
}

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  available: boolean;
  reasonUnavailable?: string;
}
