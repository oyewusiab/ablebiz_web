-- ==============================================================================
-- ABLEBIZ SUITE — STAFF AUTH PROVISIONING & RECONCILIATION MIGRATION
-- File: implementation/MIGRATION_STAFF_AUTH_PROVISIONING.sql
-- Idempotent, safe, non-destructive, zero SQL-manufactured auth.users records.
-- ==============================================================================

begin;

-- 1. Ensure must_change_password column exists on public.staff_profiles
alter table public.staff_profiles
  add column if not exists must_change_password boolean not null default false;

-- 2. Add auth_status column on public.staff_profiles
alter table public.staff_profiles
  add column if not exists auth_status text not null default 'not_provisioned';

-- 3. Set verified operational Super Admin as 'provisioned'
update public.staff_profiles
set auth_status = 'provisioned'
where email = 'oyewusi.adebayo1@gmail.com';

-- 4. Mark known orphaned accounts as 'not_provisioned' requiring Edge Function provisioning
update public.staff_profiles
set auth_status = 'not_provisioned',
    must_change_password = true
where email in (
  'ablebizconsult@gmail.com',
  'ejisquare1@gmail.com',
  'hay@gmail.com',
  'salako@gmail.com'
);

-- 5. Drop NOT NULL on auth_uid to allow safe unlinked / pending states
alter table public.staff_profiles
  alter column auth_uid drop not null;

-- 6. Ensure unique constraint on auth_uid (enforces strict one-to-one Auth linkage)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_staff_profiles_auth_uid'
  ) then
    create unique index if not exists idx_staff_profiles_auth_uid_unique 
    on public.staff_profiles(auth_uid) where auth_uid is not null;
  end if;
end $$;

-- 7. Diagnostic verification view
select 
  id, 
  full_name, 
  email, 
  role, 
  auth_uid, 
  auth_status, 
  is_active, 
  must_change_password 
from public.staff_profiles
order by created_at asc;

commit;
