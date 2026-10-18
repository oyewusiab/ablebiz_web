-- ==============================================================================
-- ABLEBIZ SUITE — HUMAN RESOURCES (HR) WORKSPACE & SELF-SERVICE PORTAL MIGRATION
-- File: implementation/MIGRATION_HR_WORKSPACE.sql
-- ==============================================================================
-- Document ID:    MIG-ABZ-HR-2026-V1
-- Target Schema:  ABLEBIZ SUITE Production Enterprise Specification
-- Safe Mode:      100% NON-DESTRUCTIVE, IDEMPOTENT & LEAST-PRIVILEGE
--
-- ARCHITECTURAL GUARANTEES:
--   1. Reuses canonical public.staff_profiles identity and 8-tier public.staff_role.
--   2. Preserves maker-checker governance in public.staff_change_requests and
--      last-active-super-admin safeguard on public.staff_profiles.
--   3. Isolates private employee HR details (residential address, emergency contact,
--      date of birth, internal HR notes) in public.hr_staff_details with strict RLS
--      so ordinary staff can never query another employee's private data.
--   4. Enforces separation of duties on leave decisions and attendance corrections
--      at the database trigger and RLS layer.
--   5. Configures private storage bucket 'ablebiz_hr_documents' with path/ownership
--      access control and zero public URLs for confidential employee records.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. NON-DESTRUCTIVE EMPLOYMENT METADATA COLUMNS ON public.staff_profiles
-- ==============================================================================
alter table public.staff_profiles
  add column if not exists job_title text,
  add column if not exists employment_type text not null default 'full_time',
  add column if not exists employment_status text not null default 'active',
  add column if not exists reporting_manager_id uuid references public.staff_profiles(id) on delete set null,
  add column if not exists hire_date date,
  add column if not exists work_location text default 'Abeokuta Head Office';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_staff_profiles_employment_type'
  ) then
    alter table public.staff_profiles
      add constraint chk_staff_profiles_employment_type
      check (employment_type in ('full_time', 'part_time', 'contract', 'intern'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_staff_profiles_employment_status'
  ) then
    alter table public.staff_profiles
      add constraint chk_staff_profiles_employment_status
      check (employment_status in ('active', 'probation', 'on_leave', 'suspended', 'deprovisioned'));
  end if;
end $$;

create index if not exists idx_staff_profiles_manager on public.staff_profiles(reporting_manager_id);
create index if not exists idx_staff_profiles_department on public.staff_profiles(department);

-- ==============================================================================
-- 2. CANONICAL HR IDENTITY & AUTHORIZATION HELPER FUNCTIONS
-- ==============================================================================

-- Retrieve current authenticated active staff profile ID
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;
$$;

-- Retrieve current authenticated active staff department
create or replace function public.current_staff_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;
$$;

-- Check if caller holds an HR management role (super_admin, admin, operations_manager)
create or replace function public.has_hr_management_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles
    where auth_uid = auth.uid()
      and is_active = true
      and role in ('super_admin', 'admin', 'operations_manager')
  );
$$;

-- Check if caller holds an executive HR role (super_admin, admin)
create or replace function public.has_hr_executive_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles
    where auth_uid = auth.uid()
      and is_active = true
      and role in ('super_admin', 'admin')
  );
$$;

revoke all on function public.current_staff_id() from public, anon;
grant execute on function public.current_staff_id() to authenticated;

revoke all on function public.current_staff_department() from public, anon;
grant execute on function public.current_staff_department() to authenticated;

revoke all on function public.has_hr_management_role() from public, anon;
grant execute on function public.has_hr_management_role() to authenticated;

revoke all on function public.has_hr_executive_role() from public, anon;
grant execute on function public.has_hr_executive_role() to authenticated;

-- ==============================================================================
-- 3. HR TABLES & CONSTRAINTS
-- ==============================================================================

-- 3.1 HR Policy & Workspace Configuration (Singleton id = 1)
create table if not exists public.hr_policy_settings (
  id integer primary key default 1 check (id = 1),
  attendance_enabled boolean not null default true,
  allow_self_clock_in boolean not null default true,
  workday_start_time time not null default '08:30:00',
  workday_end_time time not null default '17:00:00',
  late_threshold_minutes integer not null default 15 check (late_threshold_minutes between 0 and 240),
  leave_balances_enabled boolean not null default false,
  require_maker_checker_leave boolean not null default true,
  policy_notes text default 'Standard ABLEBIZ SUITE HR operational policy. Leave entitlements become authoritative only when enabled and verified by Super Admin.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);

insert into public.hr_policy_settings (id)
values (1)
on conflict (id) do nothing;

-- 3.2 Private Employee HR Details (1:1 with staff_profiles, isolated by strict RLS)
create table if not exists public.hr_staff_details (
  staff_id uuid primary key references public.staff_profiles(id) on delete cascade,
  date_of_birth date,
  residential_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  hr_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);

drop trigger if exists trg_hr_staff_details_updated_at on public.hr_staff_details;
create trigger trg_hr_staff_details_updated_at
  before update on public.hr_staff_details
  for each row execute function public.set_updated_at();

-- 3.3 Leave Policy Categories & Entitlements
create table if not exists public.hr_leave_policies (
  id uuid primary key default gen_random_uuid(),
  leave_type text not null unique,
  display_name text not null,
  annual_entitlement_days integer check (annual_entitlement_days is null or (annual_entitlement_days >= 0 and annual_entitlement_days <= 365)),
  requires_reason boolean not null default true,
  requires_document boolean not null default false,
  is_paid boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);

drop trigger if exists trg_hr_leave_policies_updated_at on public.hr_leave_policies;
create trigger trg_hr_leave_policies_updated_at
  before update on public.hr_leave_policies
  for each row execute function public.set_updated_at();

-- Seed canonical leave categories (annual_entitlement_days left NULL until explicitly configured)
insert into public.hr_leave_policies (leave_type, display_name, annual_entitlement_days, requires_reason, requires_document, is_paid, is_active)
values
  ('annual', 'Annual Leave', null, true, false, true, true),
  ('sick', 'Sick / Medical Leave', null, true, true, true, true),
  ('casual', 'Casual / Personal Leave', null, true, false, true, true),
  ('maternity', 'Maternity Leave', null, true, true, true, true),
  ('paternity', 'Paternity Leave', null, true, false, true, true),
  ('compassionate', 'Compassionate / Bereavement Leave', null, true, false, true, true),
  ('study', 'Study / Examination Leave', null, true, true, true, true),
  ('unpaid', 'Unpaid Leave', null, true, false, false, true)
on conflict (leave_type) do nothing;

-- 3.4 Leave Requests
create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  leave_type text not null references public.hr_leave_policies(leave_type) on update cascade,
  start_date date not null,
  end_date date not null,
  days_count numeric(5,1) not null check (days_count > 0 and days_count <= 365),
  reason text not null,
  supporting_document_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'correction_requested', 'cancelled')),
  reviewed_by uuid references public.staff_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  reviewer_comment text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_hr_leave_valid_dates check (end_date >= start_date)
);

create index if not exists idx_hr_leave_requests_staff on public.hr_leave_requests(staff_id);
create index if not exists idx_hr_leave_requests_status on public.hr_leave_requests(status);
create index if not exists idx_hr_leave_requests_dates on public.hr_leave_requests(start_date, end_date);

drop trigger if exists trg_hr_leave_requests_updated_at on public.hr_leave_requests;
create trigger trg_hr_leave_requests_updated_at
  before update on public.hr_leave_requests
  for each row execute function public.set_updated_at();

-- 3.5 Attendance Records
create table if not exists public.hr_attendance_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  attendance_date date not null default current_date,
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'half_day', 'on_leave', 'remote', 'excused')),
  absence_type text check (absence_type is null or absence_type in ('sick', 'authorized_absence', 'unexcused', 'official_assignment', 'public_holiday', 'other')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  notes text,
  recorded_by uuid references public.staff_profiles(id) on delete set null,
  source text not null default 'self_portal' check (source in ('self_portal', 'manual_management')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_hr_attendance_staff_date unique (staff_id, attendance_date),
  constraint chk_hr_attendance_checkout check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);

create index if not exists idx_hr_attendance_staff_date on public.hr_attendance_records(staff_id, attendance_date desc);
create index if not exists idx_hr_attendance_date on public.hr_attendance_records(attendance_date desc);

drop trigger if exists trg_hr_attendance_records_updated_at on public.hr_attendance_records;
create trigger trg_hr_attendance_records_updated_at
  before update on public.hr_attendance_records
  for each row execute function public.set_updated_at();

-- 3.6 Attendance Correction Requests
create table if not exists public.hr_attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.hr_attendance_records(id) on delete set null,
  staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  attendance_date date not null,
  requested_status text not null default 'present' check (requested_status in ('present', 'late', 'absent', 'half_day', 'on_leave', 'remote', 'excused')),
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.staff_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  reviewer_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_attendance_corrections_staff on public.hr_attendance_corrections(staff_id);
create index if not exists idx_hr_attendance_corrections_status on public.hr_attendance_corrections(status);

drop trigger if exists trg_hr_attendance_corrections_updated_at on public.hr_attendance_corrections;
create trigger trg_hr_attendance_corrections_updated_at
  before update on public.hr_attendance_corrections
  for each row execute function public.set_updated_at();

-- 3.7 HR Employment & Policy Documents
create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff_profiles(id) on delete restrict,
  title text not null,
  category text not null check (category in (
    'employment_contract',
    'offer_letter',
    'identification',
    'certification_qualification',
    'performance_appraisal',
    'disciplinary_record',
    'compensation_salary',
    'hr_policy_handbook',
    'leave_supporting_doc',
    'other'
  )),
  visibility_scope text not null default 'employee_and_hr' check (visibility_scope in (
    'employee_and_hr',
    'hr_management_only',
    'super_admin_only',
    'company_wide'
  )),
  file_path text not null,
  bucket_id text not null default 'ablebiz_hr_documents',
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  mime_type text not null,
  uploaded_by uuid not null references public.staff_profiles(id) on delete restrict,
  is_verified boolean not null default false,
  verified_by uuid references public.staff_profiles(id) on delete set null,
  verified_at timestamptz,
  expiry_date date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_hr_doc_staff_or_company check (visibility_scope = 'company_wide' or staff_id is not null)
);

create index if not exists idx_hr_documents_staff on public.hr_documents(staff_id);
create index if not exists idx_hr_documents_category on public.hr_documents(category);
create index if not exists idx_hr_documents_visibility on public.hr_documents(visibility_scope);

drop trigger if exists trg_hr_documents_updated_at on public.hr_documents;
create trigger trg_hr_documents_updated_at
  before update on public.hr_documents
  for each row execute function public.set_updated_at();

-- 3.8 HR Announcements
create table if not exists public.hr_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'general' check (category in ('general', 'policy_update', 'holiday_notice', 'training', 'leadership', 'urgent')),
  priority public.operational_priority not null default 'normal',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  target_department text,
  target_role public.staff_role,
  is_pinned boolean not null default false,
  effective_date date default current_date,
  expires_at date,
  attachment_path text,
  attachment_name text,
  created_by uuid not null references public.staff_profiles(id) on delete restrict,
  published_by uuid references public.staff_profiles(id) on delete set null,
  published_at timestamptz,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_announcements_status on public.hr_announcements(status, is_pinned desc, created_at desc);

drop trigger if exists trg_hr_announcements_updated_at on public.hr_announcements;
create trigger trg_hr_announcements_updated_at
  before update on public.hr_announcements
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 4. BUSINESS LOGIC & MAKER-CHECKER TRIGGERS
-- ==============================================================================

-- 4.1 Leave Request Overlap & Separation-of-Duties Trigger
create or replace function public.validate_hr_leave_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role public.staff_role;
  v_target_role public.staff_role;
  v_overlap_count integer;
  v_other_approvers_count integer;
begin
  v_caller_id := public.current_staff_id();
  v_caller_role := public.current_staff_role();

  if new.end_date < new.start_date then
    raise exception 'INVALID_DATE_RANGE: Leave end date cannot be earlier than start date.';
  end if;

  -- Prevent overlapping active leave requests for the same staff member
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (new.start_date <> old.start_date or new.end_date <> old.end_date or new.status in ('pending', 'approved'))) then
    if new.status in ('pending', 'approved', 'correction_requested') then
      select count(*) into v_overlap_count
      from public.hr_leave_requests lr
      where lr.staff_id = new.staff_id
        and lr.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and lr.status in ('pending', 'approved', 'correction_requested')
        and daterange(lr.start_date, lr.end_date, '[]') && daterange(new.start_date, new.end_date, '[]');

      if v_overlap_count > 0 then
        raise exception 'OVERLAPPING_LEAVE_REQUEST: An active or pending leave request already overlaps with the selected dates.';
      end if;
    end if;
  end if;

  -- Enforce authorization and separation of duties on status transitions
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Requester may cancel their own pending or correction_requested leave
    if new.status = 'cancelled' then
      if v_caller_id <> old.staff_id and v_caller_role not in ('super_admin', 'admin') then
        raise exception 'UNAUTHORIZED_LEAVE_CANCEL: Only the requester or executive HR can cancel a leave request.';
      end if;
      if old.status not in ('pending', 'correction_requested') and v_caller_role <> 'super_admin' then
        raise exception 'INVALID_LEAVE_TRANSITION: Only pending or correction-requested applications can be cancelled by staff.';
      end if;

    -- Requester resubmitting after correction_requested
    elsif old.status = 'correction_requested' and new.status = 'pending' then
      if v_caller_id <> old.staff_id then
        raise exception 'UNAUTHORIZED_LEAVE_RESUBMIT: Only the requester can resubmit a corrected leave request.';
      end if;

    -- Management decision: approved, rejected, or correction_requested
    elsif new.status in ('approved', 'rejected', 'correction_requested') then
      if v_caller_role not in ('super_admin', 'admin', 'operations_manager') then
        raise exception 'UNAUTHORIZED_LEAVE_DECISION: Your role is not authorized to review or decide leave requests.';
      end if;

      select role into v_target_role from public.staff_profiles where id = old.staff_id;

      -- Hierarchy enforcement
      if v_caller_role = 'operations_manager' and v_target_role in ('super_admin', 'admin', 'operations_manager') then
        raise exception 'UNAUTHORIZED_LEAVE_SCOPE: Operations Manager can only review leave requests for operational officers.';
      end if;

      if v_caller_role = 'admin' and v_target_role = 'super_admin' then
        raise exception 'UNAUTHORIZED_LEAVE_SCOPE: System Administrator cannot review leave requests for a Super Admin.';
      end if;

      -- Maker-Checker separation of duties: requester cannot approve/decide their own request
      if v_caller_id = old.staff_id then
        if v_caller_role = 'super_admin' then
          select count(*) into v_other_approvers_count
          from public.staff_profiles
          where role = 'super_admin' and is_active = true and id <> v_caller_id;

          if v_other_approvers_count > 0 then
            raise exception 'MAKER_CHECKER_VIOLATION: You cannot approve your own leave request while another Super Admin is active.';
          end if;
        else
          raise exception 'MAKER_CHECKER_VIOLATION: Separation of duties prohibits deciding your own leave request.';
        end if;
      end if;

      new.reviewed_by := v_caller_id;
      new.reviewed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_hr_leave_request on public.hr_leave_requests;
create trigger trg_validate_hr_leave_request
  before insert or update on public.hr_leave_requests
  for each row execute function public.validate_hr_leave_request_lifecycle();

-- 4.2 Attendance Correction Separation-of-Duties Trigger
create or replace function public.validate_hr_attendance_correction_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role public.staff_role;
  v_other_super_count integer;
begin
  v_caller_id := public.current_staff_id();
  v_caller_role := public.current_staff_role();

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if v_caller_role not in ('super_admin', 'admin', 'operations_manager') then
      raise exception 'UNAUTHORIZED_ATTENDANCE_DECISION: Your role cannot decide attendance correction requests.';
    end if;

    if v_caller_id = old.staff_id then
      if v_caller_role = 'super_admin' then
        select count(*) into v_other_super_count
        from public.staff_profiles
        where role = 'super_admin' and is_active = true and id <> v_caller_id;
        if v_other_super_count > 0 then
          raise exception 'MAKER_CHECKER_VIOLATION: Cannot approve your own attendance correction.';
        end if;
      else
        raise exception 'MAKER_CHECKER_VIOLATION: Separation of duties prohibits approving your own attendance correction.';
      end if;
    end if;

    new.reviewed_by := v_caller_id;
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_hr_attendance_correction on public.hr_attendance_corrections;
create trigger trg_validate_hr_attendance_correction
  before update on public.hr_attendance_corrections
  for each row execute function public.validate_hr_attendance_correction_decision();

-- ==============================================================================
-- 5. SECURE RPCs FOR SELF-SERVICE PROFILE UPDATES, ADMIN HR EDITS & MILESTONES
-- ==============================================================================

-- 5.1 Self-Service Personal Details Update (Strictly scoped to own permitted fields)
create or replace function public.hr_update_own_personal_details(
  p_phone text default null,
  p_date_of_birth date default null,
  p_residential_address text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_emergency_contact_relationship text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff_profiles;
begin
  select * into v_staff
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if not found then
    raise exception 'UNAUTHORIZED: Active staff profile not found for current session.';
  end if;

  if p_phone is not null then
    update public.staff_profiles
    set phone = nullif(trim(p_phone), ''),
        updated_at = now()
    where id = v_staff.id;
  end if;

  insert into public.hr_staff_details (
    staff_id,
    date_of_birth,
    residential_address,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    updated_by
  )
  values (
    v_staff.id,
    p_date_of_birth,
    nullif(trim(coalesce(p_residential_address, '')), ''),
    nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
    nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
    nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
    v_staff.id
  )
  on conflict (staff_id) do update set
    date_of_birth = coalesce(excluded.date_of_birth, public.hr_staff_details.date_of_birth),
    residential_address = excluded.residential_address,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    emergency_contact_relationship = excluded.emergency_contact_relationship,
    updated_by = v_staff.id,
    updated_at = now();

  insert into public.audit_logs (
    staff_id,
    staff_email,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    v_staff.id,
    v_staff.email,
    'hr_self_profile_updated',
    'staff_profile',
    v_staff.id,
    jsonb_build_object(
      'phone', p_phone,
      'emergency_contact_updated', (p_emergency_contact_name is not null)
    )
  );

  return jsonb_build_object('success', true, 'staff_id', v_staff.id);
end;
$$;

revoke all on function public.hr_update_own_personal_details(text, date, text, text, text, text) from public, anon;
grant execute on function public.hr_update_own_personal_details(text, date, text, text, text, text) to authenticated;

-- 5.2 Management HR Employment Profile Update (Non-privileged fields only; preserves maker-checker for role/is_active)
create or replace function public.hr_admin_update_employment_profile(
  p_target_staff_id uuid,
  p_job_title text default null,
  p_department text default null,
  p_employment_type text default null,
  p_employment_status text default null,
  p_reporting_manager_id uuid default null,
  p_hire_date date default null,
  p_work_location text default null,
  p_hr_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.staff_profiles;
  v_target public.staff_profiles;
begin
  select * into v_caller
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if not found or v_caller.role not in ('super_admin', 'admin') then
    raise exception 'FORBIDDEN: Only authorized HR executives (super_admin, admin) may update employment metadata.';
  end if;

  select * into v_target
  from public.staff_profiles
  where id = p_target_staff_id
  limit 1;

  if not found then
    raise exception 'NOT_FOUND: Target staff profile does not exist.';
  end if;

  if v_caller.role = 'admin' and v_target.role = 'super_admin' then
    raise exception 'FORBIDDEN: System Administrator cannot modify employment records of a Super Admin.';
  end if;

  update public.staff_profiles
  set
    job_title = nullif(trim(coalesce(p_job_title, '')), ''),
    department = coalesce(nullif(trim(coalesce(p_department, '')), ''), department),
    employment_type = coalesce(p_employment_type, employment_type),
    employment_status = coalesce(p_employment_status, employment_status),
    reporting_manager_id = p_reporting_manager_id,
    hire_date = p_hire_date,
    work_location = coalesce(nullif(trim(coalesce(p_work_location, '')), ''), work_location),
    updated_at = now()
  where id = p_target_staff_id;

  if p_hr_notes is not null then
    insert into public.hr_staff_details (staff_id, hr_notes, updated_by)
    values (p_target_staff_id, nullif(trim(p_hr_notes), ''), v_caller.id)
    on conflict (staff_id) do update set
      hr_notes = excluded.hr_notes,
      updated_by = v_caller.id,
      updated_at = now();
  end if;

  insert into public.audit_logs (
    staff_id,
    staff_email,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  )
  values (
    v_caller.id,
    v_caller.email,
    'hr_employment_metadata_updated',
    'staff_profile',
    v_target.id,
    jsonb_build_object(
      'job_title', v_target.job_title,
      'department', v_target.department,
      'employment_type', v_target.employment_type,
      'employment_status', v_target.employment_status,
      'reporting_manager_id', v_target.reporting_manager_id,
      'hire_date', v_target.hire_date,
      'work_location', v_target.work_location
    ),
    jsonb_build_object(
      'job_title', p_job_title,
      'department', p_department,
      'employment_type', p_employment_type,
      'employment_status', p_employment_status,
      'reporting_manager_id', p_reporting_manager_id,
      'hire_date', p_hire_date,
      'work_location', p_work_location
    )
  );

  insert into public.activity_timeline (
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    event_type,
    event_title,
    metadata
  )
  values (
    'staff_profile',
    v_target.id,
    'staff',
    v_caller.id,
    'hr_employment_metadata_updated',
    'HR employment profile updated for ' || v_target.full_name,
    jsonb_build_object('updated_by', v_caller.full_name)
  );

  return jsonb_build_object('success', true, 'staff_id', v_target.id);
end;
$$;

revoke all on function public.hr_admin_update_employment_profile(uuid, text, text, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.hr_admin_update_employment_profile(uuid, text, text, text, text, uuid, date, text, text) to authenticated;

-- 5.3 Safe Milestones RPC (Returns month/day birthdays & work anniversaries without exposing birth year)
create or replace function public.hr_get_upcoming_milestones()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_birthdays jsonb := '[]'::jsonb;
  v_anniversaries jsonb := '[]'::jsonb;
begin
  if not public.has_hr_management_role() then
    raise exception 'FORBIDDEN: HR Management permission required.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'staff_id', sp.id,
    'full_name', sp.full_name,
    'department', sp.department,
    'month_day', to_char(hd.date_of_birth, 'MM-DD'),
    'display_date', to_char(hd.date_of_birth, 'FMMonth DD')
  )), '[]'::jsonb)
  into v_birthdays
  from public.staff_profiles sp
  join public.hr_staff_details hd on hd.staff_id = sp.id
  where sp.is_active = true
    and hd.date_of_birth is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'staff_id', sp.id,
    'full_name', sp.full_name,
    'department', sp.department,
    'hire_date', sp.hire_date,
    'month_day', to_char(sp.hire_date, 'MM-DD'),
    'display_date', to_char(sp.hire_date, 'FMMonth DD'),
    'years_of_service', greatest(0, extract(year from age(current_date, sp.hire_date))::int)
  )), '[]'::jsonb)
  into v_anniversaries
  from public.staff_profiles sp
  where sp.is_active = true
    and sp.hire_date is not null;

  return jsonb_build_object(
    'birthdays', v_birthdays,
    'anniversaries', v_anniversaries
  );
end;
$$;

revoke all on function public.hr_get_upcoming_milestones() from public, anon;
grant execute on function public.hr_get_upcoming_milestones() to authenticated;

-- ==============================================================================
-- 6. PRIVATE SUPABASE STORAGE BUCKET FOR HR DOCUMENTS
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ablebiz_hr_documents',
  'ablebiz_hr_documents',
  false,
  20971520, -- 20 MB limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Helper to evaluate storage path access for ablebiz_hr_documents
create or replace function public.can_access_hr_storage_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role public.staff_role;
begin
  if not public.is_active_staff() then
    return false;
  end if;

  v_caller_id := public.current_staff_id();
  v_caller_role := public.current_staff_role();

  if v_caller_role in ('super_admin', 'admin') then
    return true;
  end if;

  -- Company-wide policy documents or announcement attachments
  if p_object_name like 'company_wide/%' or p_object_name like 'announcements/%' then
    return true;
  end if;

  -- Employee's own folder prefix: {staff_id}/...
  if v_caller_id is not null and p_object_name like (v_caller_id::text || '/%') then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_hr_storage_object(text) from public, anon;
grant execute on function public.can_access_hr_storage_object(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'HR upload ablebiz_hr_documents'
  ) then
    create policy "HR upload ablebiz_hr_documents"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'ablebiz_hr_documents'
      and public.can_access_hr_storage_object(name)
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'HR view ablebiz_hr_documents'
  ) then
    create policy "HR view ablebiz_hr_documents"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'ablebiz_hr_documents'
      and public.can_access_hr_storage_object(name)
    );
  end if;
end $$;

-- ==============================================================================
-- 7. SEED HR MODULE IN public.roles_permissions
-- ==============================================================================
insert into public.roles_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_export)
values
  ('super_admin', 'hr', true, true, true, true, true, true),
  ('admin', 'hr', true, true, true, false, true, true),
  ('operations_manager', 'hr', true, false, false, false, true, false),
  ('registration_officer', 'hr', true, true, false, false, false, false),
  ('accounts_officer', 'hr', true, true, false, false, false, false),
  ('client_service_officer', 'hr', true, true, false, false, false, false),
  ('marketing_officer', 'hr', true, true, false, false, false, false),
  ('viewer', 'hr', true, true, false, false, false, false)
on conflict (role, module) do nothing;

-- ==============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES & GRANTS
-- ==============================================================================

alter table public.hr_policy_settings enable row level security;
alter table public.hr_staff_details enable row level security;
alter table public.hr_leave_policies enable row level security;
alter table public.hr_leave_requests enable row level security;
alter table public.hr_attendance_records enable row level security;
alter table public.hr_attendance_corrections enable row level security;
alter table public.hr_documents enable row level security;
alter table public.hr_announcements enable row level security;

-- Revoke anonymous access on all HR tables
revoke all on table public.hr_policy_settings from public, anon;
revoke all on table public.hr_staff_details from public, anon;
revoke all on table public.hr_leave_policies from public, anon;
revoke all on table public.hr_leave_requests from public, anon;
revoke all on table public.hr_attendance_records from public, anon;
revoke all on table public.hr_attendance_corrections from public, anon;
revoke all on table public.hr_documents from public, anon;
revoke all on table public.hr_announcements from public, anon;

-- Grant authenticated privileges (governed by RLS)
grant select, insert, update on table public.hr_policy_settings to authenticated;
grant select, insert, update on table public.hr_staff_details to authenticated;
grant select, insert, update on table public.hr_leave_policies to authenticated;
grant select, insert, update on table public.hr_leave_requests to authenticated;
grant select, insert, update on table public.hr_attendance_records to authenticated;
grant select, insert, update on table public.hr_attendance_corrections to authenticated;
grant select, insert, update on table public.hr_documents to authenticated;
grant select, insert, update on table public.hr_announcements to authenticated;

-- 8.1 hr_policy_settings RLS
drop policy if exists "Active staff read hr_policy_settings" on public.hr_policy_settings;
create policy "Active staff read hr_policy_settings"
on public.hr_policy_settings for select
to authenticated
using (public.is_active_staff());

drop policy if exists "Superadmin manage hr_policy_settings" on public.hr_policy_settings;
create policy "Superadmin manage hr_policy_settings"
on public.hr_policy_settings for all
to authenticated
using (public.current_staff_role() = 'super_admin')
with check (public.current_staff_role() = 'super_admin');

-- 8.2 hr_staff_details RLS (Strict privacy: Own row OR Super Admin / Admin)
drop policy if exists "Select own or executive hr_staff_details" on public.hr_staff_details;
create policy "Select own or executive hr_staff_details"
on public.hr_staff_details for select
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_executive_role()
  )
);

drop policy if exists "Insert own or executive hr_staff_details" on public.hr_staff_details;
create policy "Insert own or executive hr_staff_details"
on public.hr_staff_details for insert
to authenticated
with check (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_executive_role()
  )
);

drop policy if exists "Update own or executive hr_staff_details" on public.hr_staff_details;
create policy "Update own or executive hr_staff_details"
on public.hr_staff_details for update
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_executive_role()
  )
)
with check (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_executive_role()
  )
);

-- 8.3 hr_leave_policies RLS
drop policy if exists "Active staff read hr_leave_policies" on public.hr_leave_policies;
create policy "Active staff read hr_leave_policies"
on public.hr_leave_policies for select
to authenticated
using (public.is_active_staff());

drop policy if exists "Superadmin manage hr_leave_policies" on public.hr_leave_policies;
create policy "Superadmin manage hr_leave_policies"
on public.hr_leave_policies for all
to authenticated
using (public.current_staff_role() = 'super_admin')
with check (public.current_staff_role() = 'super_admin');

-- 8.4 hr_leave_requests RLS
drop policy if exists "Select own or management hr_leave_requests" on public.hr_leave_requests;
create policy "Select own or management hr_leave_requests"
on public.hr_leave_requests for select
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

drop policy if exists "Insert own hr_leave_requests" on public.hr_leave_requests;
create policy "Insert own hr_leave_requests"
on public.hr_leave_requests for insert
to authenticated
with check (
  public.is_active_staff()
  and staff_id = public.current_staff_id()
  and status = 'pending'
);

drop policy if exists "Update own or management hr_leave_requests" on public.hr_leave_requests;
create policy "Update own or management hr_leave_requests"
on public.hr_leave_requests for update
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
)
with check (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

-- 8.5 hr_attendance_records RLS
drop policy if exists "Select own or management hr_attendance_records" on public.hr_attendance_records;
create policy "Select own or management hr_attendance_records"
on public.hr_attendance_records for select
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

drop policy if exists "Insert own or management hr_attendance_records" on public.hr_attendance_records;
create policy "Insert own or management hr_attendance_records"
on public.hr_attendance_records for insert
to authenticated
with check (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

drop policy if exists "Update own or management hr_attendance_records" on public.hr_attendance_records;
create policy "Update own or management hr_attendance_records"
on public.hr_attendance_records for update
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
)
with check (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

-- 8.6 hr_attendance_corrections RLS
drop policy if exists "Select own or management hr_attendance_corrections" on public.hr_attendance_corrections;
create policy "Select own or management hr_attendance_corrections"
on public.hr_attendance_corrections for select
to authenticated
using (
  public.is_active_staff()
  and (
    staff_id = public.current_staff_id()
    or public.has_hr_management_role()
  )
);

drop policy if exists "Insert own hr_attendance_corrections" on public.hr_attendance_corrections;
create policy "Insert own hr_attendance_corrections"
on public.hr_attendance_corrections for insert
to authenticated
with check (
  public.is_active_staff()
  and staff_id = public.current_staff_id()
  and status = 'pending'
);

drop policy if exists "Update management hr_attendance_corrections" on public.hr_attendance_corrections;
create policy "Update management hr_attendance_corrections"
on public.hr_attendance_corrections for update
to authenticated
using (public.has_hr_management_role())
with check (public.has_hr_management_role());

-- 8.7 hr_documents RLS (Strict ownership and confidentiality scoping)
drop policy if exists "Select authorized hr_documents" on public.hr_documents;
create policy "Select authorized hr_documents"
on public.hr_documents for select
to authenticated
using (
  public.is_active_staff()
  and (
    public.current_staff_role() = 'super_admin'
    or (
      public.current_staff_role() = 'admin'
      and visibility_scope <> 'super_admin_only'
    )
    or (
      is_archived = false
      and (
        visibility_scope = 'company_wide'
        or (staff_id = public.current_staff_id() and visibility_scope = 'employee_and_hr')
      )
    )
  )
);

drop policy if exists "Insert authorized hr_documents" on public.hr_documents;
create policy "Insert authorized hr_documents"
on public.hr_documents for insert
to authenticated
with check (
  public.is_active_staff()
  and uploaded_by = public.current_staff_id()
  and (
    public.current_staff_role() = 'super_admin'
    or (
      public.current_staff_role() = 'admin'
      and visibility_scope <> 'super_admin_only'
    )
    or (
      staff_id = public.current_staff_id()
      and visibility_scope = 'employee_and_hr'
      and category in ('identification', 'certification_qualification', 'leave_supporting_doc', 'other')
    )
  )
);

drop policy if exists "Update executive hr_documents" on public.hr_documents;
create policy "Update executive hr_documents"
on public.hr_documents for update
to authenticated
using (
  public.current_staff_role() = 'super_admin'
  or (public.current_staff_role() = 'admin' and visibility_scope <> 'super_admin_only')
)
with check (
  public.current_staff_role() = 'super_admin'
  or (public.current_staff_role() = 'admin' and visibility_scope <> 'super_admin_only')
);

-- 8.8 hr_announcements RLS (Drafts/archived strictly hidden from non-executive staff)
drop policy if exists "Select authorized hr_announcements" on public.hr_announcements;
create policy "Select authorized hr_announcements"
on public.hr_announcements for select
to authenticated
using (
  public.is_active_staff()
  and (
    public.has_hr_executive_role()
    or (
      status = 'published'
      and (expires_at is null or expires_at >= current_date)
      and (target_department is null or target_department = public.current_staff_department())
      and (target_role is null or target_role = public.current_staff_role())
    )
  )
);

drop policy if exists "Insert executive hr_announcements" on public.hr_announcements;
create policy "Insert executive hr_announcements"
on public.hr_announcements for insert
to authenticated
with check (
  public.has_hr_executive_role()
  and created_by = public.current_staff_id()
);

drop policy if exists "Update executive hr_announcements" on public.hr_announcements;
create policy "Update executive hr_announcements"
on public.hr_announcements for update
to authenticated
using (public.has_hr_executive_role())
with check (public.has_hr_executive_role());

commit;
