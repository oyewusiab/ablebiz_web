-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 9, 10 & 11 DATABASE MIGRATION
-- PHASE 9: Appointment & Consultation Scheduling
-- PHASE 10: Client Satisfaction & Service Quality Management
-- PHASE 11: Staff Performance & Workload Analytics
-- File: implementation/MIGRATION_PHASES_9_10_11_SCHEDULING_QUALITY_PERFORMANCE.sql
-- ==============================================================================

begin;

-- ==============================================================================
-- 0. PREFLIGHT SECURITY HARDENING: REMEDIATION OF PHASES 6-8 RLS POLICIES
-- ==============================================================================

-- 0.1 Harden Projected Expenses Policy (Restricted to Authorized Finance & Executives)
drop policy if exists "Staff can view projected expenses" on public.projected_expenses;
drop policy if exists "projected_expenses_select_authorized" on public.projected_expenses;
create policy "projected_expenses_select_authorized" on public.projected_expenses
  for select to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'accounts_officer')
  );

-- 0.2 Harden Financial Budgets Policy (Restricted to Authorized Finance & Executives)
drop policy if exists "Staff can view financial budgets" on public.financial_budgets;
drop policy if exists "financial_budgets_select_authorized" on public.financial_budgets;
create policy "financial_budgets_select_authorized" on public.financial_budgets
  for select to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'accounts_officer')
  );

-- 0.3 Harden Compliance Obligations Policies
drop policy if exists "Staff can view compliance obligations" on public.compliance_obligations;
drop policy if exists "Staff can manage compliance obligations" on public.compliance_obligations;
drop policy if exists "compliance_obligations_select_authorized" on public.compliance_obligations;
drop policy if exists "compliance_obligations_manage_authorized" on public.compliance_obligations;

create policy "compliance_obligations_select_authorized" on public.compliance_obligations
  for select to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer', 'accounts_officer')
  );

create policy "compliance_obligations_manage_authorized" on public.compliance_obligations
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer')
  );

-- 0.4 Harden Compliance Reminders Policies (Restricted to Active Operational Staff)
drop policy if exists "Staff can view and manage compliance reminders" on public.compliance_reminders;
drop policy if exists "compliance_reminders_select_authorized" on public.compliance_reminders;
drop policy if exists "compliance_reminders_manage_authorized" on public.compliance_reminders;

create policy "compliance_reminders_select_authorized" on public.compliance_reminders
  for select to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer')
  );

create policy "compliance_reminders_manage_authorized" on public.compliance_reminders
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer')
  );


-- ==============================================================================
-- 1. PHASE 9 — APPOINTMENT & CONSULTATION SCHEDULING
-- ==============================================================================

-- 1.1 Configurable Appointment Types
create table if not exists public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  default_duration integer not null default 45 check (default_duration > 0 and default_duration <= 480),
  buffer_minutes integer not null default 15 check (buffer_minutes >= 0 and buffer_minutes <= 120),
  eligible_roles text[] not null default array['super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer'],
  location_options text[] not null default array['office', 'google_meet', 'phone_call', 'whatsapp_call'],
  reminder_schedule integer[] not null default array[1440, 120, 30], -- in minutes before (24h, 2h, 30m)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointment_types_active on public.appointment_types(is_active);

-- Seed Baseline Configurable Appointment Types
insert into public.appointment_types (name, slug, description, default_duration, buffer_minutes, eligible_roles, location_options, reminder_schedule, is_active)
values
  ('Business Registration Consultation', 'business-registration-consultation', 'Initial client advisory on business name registration, documentation requirements, and timeline.', 45, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('Company Registration Advisory', 'company-registration-advisory', 'Comprehensive advisory session covering share capital structuring, directorship, objects, and incorporation.', 60, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('NGO Registration Advisory', 'ngo-registration-advisory', 'Advisory for NGOs, foundations, associations, and religious bodies on Incorporated Trustee registration under CAMA 2020.', 60, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer'], array['office', 'google_meet', 'phone_call'], array[1440, 120, 30], true),
  ('Annual Returns Consultation', 'annual-returns-consultation', 'Statutory compliance advisory assessing historical CAC filings, outstanding annual returns, and penalty mitigation.', 45, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('SCUML Compliance Consultation', 'scuml_compliance-consultation', 'Guidance on anti-money laundering certification, designated non-financial business filing, and statutory documentation.', 45, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('Tax and Documentation Advisory', 'tax-and-documentation-advisory', 'Advisory on Tax Clearance Certificates (TCC), FIRS compliance, TIN generation, and documentation readiness.', 45, 15, array['super_admin', 'admin', 'accounts_officer', 'operations_manager'], array['office', 'google_meet', 'phone_call'], array[1440, 120, 30], true),
  ('General Business Consultation', 'general-business-consultation', 'General advisory session addressing business formalization, corporate compliance, and expansion services.', 30, 15, array['super_admin', 'admin', 'operations_manager', 'client_service_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('Client Service Meeting', 'client-service-meeting', 'Progress review, document verification check-in, or resolution session with an existing client.', 30, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer'], array['office', 'google_meet', 'phone_call', 'whatsapp_call'], array[1440, 120, 30], true),
  ('Internal Staff Meeting', 'internal-staff-meeting', 'Internal operations briefing, case review, or management sync.', 30, 15, array['super_admin', 'admin', 'operations_manager', 'registration_officer', 'accounts_officer', 'client_service_officer', 'marketing_officer', 'viewer'], array['office', 'google_meet'], array[120, 15], true),
  ('Other Consultation', 'other-consultation', 'Custom or unclassified advisory session.', 30, 15, array['super_admin', 'admin', 'operations_manager', 'client_service_officer'], array['office', 'google_meet', 'phone_call'], array[1440, 120, 30], true)
on conflict (slug) do nothing;

-- 1.2 Staff Availability Rules
create table if not exists public.staff_availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade unique,
  working_days integer[] not null default array[1, 2, 3, 4, 5], -- 1=Monday, 5=Friday
  work_start_time time not null default '08:30:00',
  work_end_time time not null default '17:00:00',
  break_start_time time default '13:00:00',
  break_end_time time default '14:00:00',
  buffer_minutes integer not null default 15 check (buffer_minutes >= 0 and buffer_minutes <= 60),
  unavailable_dates date[] default array[]::date[],
  special_availability jsonb default '[]'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_avail_staff on public.staff_availability_rules(staff_id);

-- 1.3 Appointments & Consultations
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique, -- e.g. APT-2026-0001
  title text not null,
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null default 45 check (duration_minutes > 0),
  timezone text not null default 'Africa/Lagos',
  meeting_location text not null default 'office' check (meeting_location in ('office', 'google_meet', 'zoom', 'phone_call', 'whatsapp_call', 'client_premises', 'other')),
  meeting_link text,
  purpose text,
  status text not null default 'scheduled' check (status in ('requested', 'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'client_did_not_attend', 'staff_unavailable')),
  cancellation_reason text,
  cancelled_by uuid references public.staff_profiles(id) on delete set null,
  cancelled_at timestamptz,
  completion_outcome text,
  completion_notes text,
  completed_at timestamptz,
  next_action text,
  follow_up_task_id uuid references public.tasks(id) on delete set null,
  internal_notes text,
  client_notes text,
  is_public_booking boolean not null default false,
  client_contact_name text,
  client_contact_phone text,
  client_contact_email text,
  rescheduled_from_id uuid references public.appointments(id) on delete set null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_appointment_time check (end_time > start_time)
);

create index if not exists idx_appointments_date on public.appointments(appointment_date);
create index if not exists idx_appointments_staff on public.appointments(assigned_staff_id);
create index if not exists idx_appointments_client on public.appointments(client_id);
create index if not exists idx_appointments_lead on public.appointments(lead_id);
create index if not exists idx_appointments_status on public.appointments(status);
create index if not exists idx_appointments_type on public.appointments(appointment_type_id);

-- 1.4 Appointment Reminders Dispatch Log
create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'notification', 'phone')),
  minutes_before integer not null default 120,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'prepared', 'sent', 'cancelled', 'failed')),
  recipient_email text,
  recipient_phone text,
  message_preview text,
  sent_at timestamptz,
  sent_by uuid references public.staff_profiles(id) on delete set null,
  idempotency_key text unique,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointment_reminders_appt on public.appointment_reminders(appointment_id);
create index if not exists idx_appointment_reminders_sched on public.appointment_reminders(scheduled_at);
create index if not exists idx_appointment_reminders_status on public.appointment_reminders(status);


-- ==============================================================================
-- 2. PHASE 10 — CLIENT SATISFACTION & SERVICE QUALITY MANAGEMENT
-- ==============================================================================

-- 2.1 Survey Templates
create table if not exists public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  service_category text not null default 'all',
  questions jsonb not null default '[]'::jsonb,
  rating_scale integer not null default 5,
  is_active boolean not null default true,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed Baseline Post-Service Satisfaction Survey
insert into public.survey_templates (name, description, service_category, questions, rating_scale, is_active)
values (
  'Standard Post-Service Client Satisfaction Survey',
  'Primary survey dispatched to clients following service completion to measure satisfaction, timeliness, professionalism, and recommendation propensity.',
  'all',
  '[
    {"id": "overall_satisfaction", "question": "How satisfied are you with the service you received?", "type": "rating", "required": true},
    {"id": "staff_professionalism", "question": "How would you rate the professionalism and helpfulness of our staff?", "type": "rating", "required": true},
    {"id": "timeline_adherence", "question": "Was the service completed within the expected timeline?", "type": "rating", "required": false},
    {"id": "communication_clarity", "question": "Was our communication clear, responsive, and easy to understand?", "type": "rating", "required": true},
    {"id": "nps_recommendation", "question": "How likely are you to recommend ABLEBIZ to a colleague or business owner? (1-10)", "type": "nps", "required": false},
    {"id": "improvement_suggestions", "question": "What could we improve to serve you better next time?", "type": "text", "required": false}
  ]'::jsonb,
  5,
  true
)
on conflict do nothing;

-- 2.2 Client Feedback Records
create table if not exists public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  service_id uuid references public.services_catalog(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  cac_application_id uuid references public.cac_applications(id) on delete set null,
  assigned_officer_id uuid references public.staff_profiles(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  professionalism_rating integer check (professionalism_rating is null or (professionalism_rating >= 1 and professionalism_rating <= 5)),
  timeliness_rating integer check (timeliness_rating is null or (timeliness_rating >= 1 and timeliness_rating <= 5)),
  communication_rating integer check (communication_rating is null or (communication_rating >= 1 and communication_rating <= 5)),
  recommendation_score integer check (recommendation_score is null or (recommendation_score >= 1 and recommendation_score <= 10)),
  comments text,
  survey_response jsonb default '{}'::jsonb,
  source text not null default 'in_suite_survey' check (source in ('in_suite_survey', 'external_bitly_form', 'client_portal', 'manual_call', 'email_reply')),
  submission_token text unique,
  client_name text,
  client_phone text,
  client_email text,
  service_date date default current_date,
  is_verified boolean not null default true,
  status text not null default 'published' check (status in ('published', 'under_review', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_feedback_client on public.client_feedback(client_id);
create index if not exists idx_client_feedback_service on public.client_feedback(service_id);
create index if not exists idx_client_feedback_request on public.client_feedback(service_request_id);
create index if not exists idx_client_feedback_officer on public.client_feedback(assigned_officer_id);
create index if not exists idx_client_feedback_rating on public.client_feedback(rating);
create index if not exists idx_client_feedback_date on public.client_feedback(created_at);

-- 2.3 Client Complaints & Resolution Workflow
create table if not exists public.client_complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique, -- e.g. CMP-2026-0001
  client_id uuid not null references public.clients(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  service_id uuid references public.services_catalog(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  feedback_id uuid references public.client_feedback(id) on delete set null,
  category text not null default 'service_quality' check (category in ('delayed_service', 'communication_issue', 'documentation_error', 'incorrect_information', 'billing_concern', 'service_quality', 'staff_conduct', 'other')),
  title text not null,
  description text not null,
  date_received date not null default current_date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_officer_id uuid references public.staff_profiles(id) on delete set null,
  responsible_manager_id uuid references public.staff_profiles(id) on delete set null,
  response_target_hours integer not null default 24,
  resolution_target_hours integer not null default 72,
  status text not null default 'received' check (status in ('received', 'under_review', 'assigned', 'awaiting_client_response', 'resolution_in_progress', 'resolved', 'closed', 'reopened')),
  root_cause text,
  corrective_action text,
  resolution_notes text,
  resolution_date timestamptz,
  client_response text,
  is_verified_defect boolean default false,
  is_escalated boolean not null default false,
  escalated_at timestamptz,
  escalation_notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_complaints_client on public.client_complaints(client_id);
create index if not exists idx_client_complaints_officer on public.client_complaints(assigned_officer_id);
create index if not exists idx_client_complaints_manager on public.client_complaints(responsible_manager_id);
create index if not exists idx_client_complaints_status on public.client_complaints(status);
create index if not exists idx_client_complaints_category on public.client_complaints(category);
create index if not exists idx_client_complaints_priority on public.client_complaints(priority);

-- 2.4 Complaint Activity & Resolution Audit History
create table if not exists public.complaint_activity_logs (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.client_complaints(id) on delete cascade,
  action_type text not null, -- 'received', 'assigned', 'status_changed', 'escalated', 'note_added', 'resolved', 'reopened'
  from_status text,
  to_status text,
  notes text not null,
  performed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_complaint_activity_complaint on public.complaint_activity_logs(complaint_id);

-- 2.5 Service Quality Reviews (Internal Quality Audit)
create table if not exists public.service_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  review_number text not null unique, -- QREV-2026-0001
  service_request_id uuid references public.service_requests(id) on delete cascade,
  cac_application_id uuid references public.cac_applications(id) on delete set null,
  reviewed_officer_id uuid not null references public.staff_profiles(id) on delete cascade,
  reviewer_id uuid not null references public.staff_profiles(id) on delete cascade,
  review_date date not null default current_date,
  outcome text not null default 'passed' check (outcome in ('passed', 'passed_with_minor_notes', 'correction_required', 'failed_rework_needed')),
  documentation_accuracy_score integer check (documentation_accuracy_score between 1 and 5),
  statutory_compliance_score integer check (statutory_compliance_score between 1 and 5),
  timeline_compliance_score integer check (timeline_compliance_score between 1 and 5),
  findings text,
  corrections_specified text,
  is_correction_resolved boolean default false,
  correction_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sq_reviews_officer on public.service_quality_reviews(reviewed_officer_id);
create index if not exists idx_sq_reviews_request on public.service_quality_reviews(service_request_id);
create index if not exists idx_sq_reviews_outcome on public.service_quality_reviews(outcome);


-- ==============================================================================
-- 3. PHASE 11 — STAFF PERFORMANCE & WORKLOAD ANALYTICS
-- ==============================================================================

-- 3.1 Staff Workload Capacities & Configuration
create table if not exists public.staff_workload_capacities (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade unique,
  max_active_tasks integer not null default 15 check (max_active_tasks > 0),
  max_active_service_requests integer not null default 8 check (max_active_service_requests > 0),
  max_active_cac_filings integer not null default 10 check (max_active_cac_filings > 0),
  target_completion_days numeric(4,1) not null default 3.0 check (target_completion_days > 0),
  complexity_weights jsonb default '{"low": 1, "medium": 2, "high": 3, "very_high": 5}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workload_capacity_staff on public.staff_workload_capacities(staff_id);

-- 3.2 Extend public.tasks with Complexity & Detailed Context Columns
alter table public.tasks 
  add column if not exists complexity text not null default 'medium';

alter table public.tasks 
  drop constraint if exists tasks_complexity_check;

alter table public.tasks 
  add constraint tasks_complexity_check check (complexity in ('low', 'medium', 'high', 'very_high'));

alter table public.tasks 
  add column if not exists estimated_effort_hours numeric(5,1) default 2.0;

alter table public.tasks 
  add column if not exists external_wait_time_minutes integer default 0;

alter table public.tasks 
  add column if not exists client_wait_time_minutes integer default 0;

alter table public.tasks 
  add column if not exists quality_score integer;

alter table public.tasks 
  add column if not exists rework_count integer not null default 0;

create index if not exists idx_tasks_complexity on public.tasks(complexity);


-- ==============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) FOR PHASES 9, 10 & 11
-- ==============================================================================

alter table public.appointment_types enable row level security;
alter table public.staff_availability_rules enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_reminders enable row level security;
alter table public.survey_templates enable row level security;
alter table public.client_feedback enable row level security;
alter table public.client_complaints enable row level security;
alter table public.complaint_activity_logs enable row level security;
alter table public.service_quality_reviews enable row level security;
alter table public.staff_workload_capacities enable row level security;

-- 4.1 Appointment Types (Active staff can read, management can edit)
drop policy if exists "appointment_types_select_active_staff" on public.appointment_types;
create policy "appointment_types_select_active_staff" on public.appointment_types
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "appointment_types_manage_management" on public.appointment_types;
create policy "appointment_types_manage_management" on public.appointment_types
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

-- 4.2 Staff Availability Rules
drop policy if exists "staff_availability_select_active_staff" on public.staff_availability_rules;
create policy "staff_availability_select_active_staff" on public.staff_availability_rules
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "staff_availability_manage_authorized" on public.staff_availability_rules;
create policy "staff_availability_manage_authorized" on public.staff_availability_rules
  for all to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      staff_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    )
  )
  with check (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      staff_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    )
  );

-- 4.3 Appointments (Active staff view, operational staff manage)
drop policy if exists "appointments_select_active_staff" on public.appointments;
create policy "appointments_select_active_staff" on public.appointments
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "appointments_manage_authorized_staff" on public.appointments;
create policy "appointments_manage_authorized_staff" on public.appointments
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer', 'accounts_officer')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer', 'accounts_officer')
  );

-- 4.4 Appointment Reminders
drop policy if exists "appointment_reminders_select_active_staff" on public.appointment_reminders;
create policy "appointment_reminders_select_active_staff" on public.appointment_reminders
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "appointment_reminders_manage_authorized" on public.appointment_reminders;
create policy "appointment_reminders_manage_authorized" on public.appointment_reminders
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer')
  );

-- 4.5 Survey Templates
drop policy if exists "survey_templates_select_active_staff" on public.survey_templates;
create policy "survey_templates_select_active_staff" on public.survey_templates
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "survey_templates_manage_management" on public.survey_templates;
create policy "survey_templates_manage_management" on public.survey_templates
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

-- 4.6 Client Feedback (All active staff may view; management may curate)
drop policy if exists "client_feedback_select_active_staff" on public.client_feedback;
create policy "client_feedback_select_active_staff" on public.client_feedback
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists "client_feedback_insert_active_staff" on public.client_feedback;
create policy "client_feedback_insert_active_staff" on public.client_feedback
  for insert to authenticated
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'registration_officer', 'marketing_officer')
  );

drop policy if exists "client_feedback_update_management" on public.client_feedback;
create policy "client_feedback_update_management" on public.client_feedback
  for update to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

-- 4.7 Client Complaints (STRICT RBAC: Sensitive Client & Staff Information)
drop policy if exists "client_complaints_select_authorized" on public.client_complaints;
create policy "client_complaints_select_authorized" on public.client_complaints
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer') or
      assigned_officer_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    )
  );

drop policy if exists "client_complaints_insert_authorized" on public.client_complaints;
create policy "client_complaints_insert_authorized" on public.client_complaints
  for insert to authenticated
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer')
  );

drop policy if exists "client_complaints_update_authorized" on public.client_complaints;
create policy "client_complaints_update_authorized" on public.client_complaints
  for update to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      (public.current_staff_role() in ('client_service_officer', 'registration_officer') and assigned_officer_id in (select id from public.staff_profiles where auth_uid = auth.uid()))
    )
  )
  with check (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      (public.current_staff_role() in ('client_service_officer', 'registration_officer') and assigned_officer_id in (select id from public.staff_profiles where auth_uid = auth.uid()))
    )
  );

-- 4.8 Complaint Activity Logs
drop policy if exists "complaint_activity_select_authorized" on public.complaint_activity_logs;
create policy "complaint_activity_select_authorized" on public.complaint_activity_logs
  for select to authenticated
  using (
    public.is_active_staff() and
    exists (
      select 1 from public.client_complaints cc
      where cc.id = complaint_id
        and (
          public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer') or
          cc.assigned_officer_id in (select id from public.staff_profiles where auth_uid = auth.uid())
        )
    )
  );

drop policy if exists "complaint_activity_insert_authorized" on public.complaint_activity_logs;
create policy "complaint_activity_insert_authorized" on public.complaint_activity_logs
  for insert to authenticated
  with check (public.is_active_staff());

-- 4.9 Service Quality Reviews (STRICT RBAC: Management & Reviewed Staff Only)
drop policy if exists "sq_reviews_select_authorized" on public.service_quality_reviews;
create policy "sq_reviews_select_authorized" on public.service_quality_reviews
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      reviewed_officer_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    )
  );

drop policy if exists "sq_reviews_manage_management" on public.service_quality_reviews;
create policy "sq_reviews_manage_management" on public.service_quality_reviews
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

-- 4.10 Staff Workload Capacities (STRICT RBAC: Management & Self View)
drop policy if exists "workload_capacities_select_authorized" on public.staff_workload_capacities;
create policy "workload_capacities_select_authorized" on public.staff_workload_capacities
  for select to authenticated
  using (
    public.is_active_staff() and (
      public.current_staff_role() in ('super_admin', 'admin', 'operations_manager') or
      staff_id in (select id from public.staff_profiles where auth_uid = auth.uid())
    )
  );

drop policy if exists "workload_capacities_manage_management" on public.staff_workload_capacities;
create policy "workload_capacities_manage_management" on public.staff_workload_capacities
  for all to authenticated
  using (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  )
  with check (
    public.is_active_staff() and
    public.current_staff_role() in ('super_admin', 'admin', 'operations_manager')
  );

commit;

-- Notify schema reload for PostgREST
notify pgrst, 'reload schema';
