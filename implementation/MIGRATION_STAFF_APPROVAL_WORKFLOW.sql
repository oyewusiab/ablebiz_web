-- ==============================================================================
-- ABLEBIZ SUITE — STAFF MANAGEMENT & SUPER ADMIN APPROVAL WORKFLOW MIGRATION
-- File: implementation/MIGRATION_STAFF_APPROVAL_WORKFLOW.sql
-- Idempotent, safe, and non-destructive.
-- ==============================================================================

begin;

-- 1. Create Enums for Staff Change Requests (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_change_request_type') then
    create type public.staff_change_request_type as enum (
      'create_staff',
      'deactivate_staff',
      'reactivate_staff',
      'change_role',
      'deprovision_staff'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'staff_change_request_status') then
    create type public.staff_change_request_status as enum (
      'pending',
      'approved',
      'rejected',
      'executed',
      'failed',
      'cancelled'
    );
  end if;
end $$;

-- 2. Create staff_change_requests table
-- Rule: requested_by uses ON DELETE RESTRICT to preserve historical governance records.
create table if not exists public.staff_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.staff_change_request_type not null,
  requested_by uuid not null references public.staff_profiles(id) on delete restrict,
  target_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  current_role public.staff_role,
  requested_role public.staff_role,
  requested_changes jsonb default '{}'::jsonb,
  reason text not null,
  status public.staff_change_request_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  execution_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes for efficient filtering and lifecycle queries
create index if not exists idx_staff_change_requests_status on public.staff_change_requests(status);
create index if not exists idx_staff_change_requests_requested_by on public.staff_change_requests(requested_by);
create index if not exists idx_staff_change_requests_target on public.staff_change_requests(target_staff_profile_id);
create index if not exists idx_staff_change_requests_created_at on public.staff_change_requests(created_at desc);

-- 3. Universal updated_at Trigger
drop trigger if exists staff_change_requests_set_updated_at on public.staff_change_requests;
create trigger staff_change_requests_set_updated_at
  before update on public.staff_change_requests
  for each row execute function public.set_updated_at();

-- 4. Last Active Super Admin Protection Trigger on staff_profiles
create or replace function public.check_last_super_admin_safeguard()
returns trigger language plpgsql as $$
declare
  v_active_super_count integer;
begin
  -- Only evaluate if role or active state is being modified on a super_admin
  if (old.role = 'super_admin' and (new.role <> 'super_admin' or new.is_active = false)) then
    select count(*) into v_active_super_count
    from public.staff_profiles
    where role = 'super_admin'
      and is_active = true
      and id <> old.id;

    if (v_active_super_count = 0) then
      raise exception 'SECURITY_VIOLATION: Cannot deactivate, deprovision, or change role of the last active super_admin.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_last_super_admin on public.staff_profiles;
create trigger trg_protect_last_super_admin
  before update on public.staff_profiles
  for each row execute function public.check_last_super_admin_safeguard();

-- 5. Row-Level Security on staff_change_requests
alter table public.staff_change_requests enable row level security;

-- Active staff view policy:
-- Super Admins can view all requests; Admins can only view their own submitted requests
drop policy if exists "Staff view change requests" on public.staff_change_requests;
create policy "Staff view change requests"
on public.staff_change_requests for select
to authenticated
using (
  public.current_staff_role() = 'super_admin'
  or requested_by = (select id from public.staff_profiles where auth_uid = auth.uid() limit 1)
);

-- Insert policy:
-- Active staff can insert requests where requested_by is their own staff profile ID
drop policy if exists "Staff insert change requests" on public.staff_change_requests;
create policy "Staff insert change requests"
on public.staff_change_requests for insert
to authenticated
with check (
  public.is_active_staff()
  and requested_by = (select id from public.staff_profiles where auth_uid = auth.uid() limit 1)
);

-- Update policy:
-- Strictly Super Admin can review, approve, reject, or update requests
drop policy if exists "Superadmin update change requests" on public.staff_change_requests;
create policy "Superadmin update change requests"
on public.staff_change_requests for update
to authenticated
using (public.current_staff_role() = 'super_admin')
with check (public.current_staff_role() = 'super_admin');

-- Delete policy:
-- Delete is disallowed to ensure immutable audit and compliance history
drop policy if exists "Disallow deletion of change requests" on public.staff_change_requests;
-- (No delete policy granted = denied by default)

-- Grant usage to authenticated users
grant select, insert on public.staff_change_requests to authenticated;
grant update on public.staff_change_requests to authenticated;

commit;
