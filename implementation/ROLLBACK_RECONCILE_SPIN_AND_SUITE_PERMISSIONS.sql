-- ==============================================================================
-- ABLEBIZ SUITE — COMPLETE SECURITY ROLLBACK SCRIPT
-- File: implementation/ROLLBACK_RECONCILE_SPIN_AND_SUITE_PERMISSIONS.sql
-- Target: Supabase Production (https://ksjphkqxudtkduuhnyvn.supabase.co)
-- Purpose: Restores pre-migration security configuration, grants, and helpers
--          without corrupting data, dropping records, or re-opening insecure access.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. DROP POST-MIGRATION POLICIES APPLIED BY THE MIGRATION
-- ------------------------------------------------------------------------------
drop policy if exists "leads_select_active_staff" on public.leads;
drop policy if exists "leads_update_crm_staff" on public.leads;

drop policy if exists "spin_rewards_select_active_staff" on public.spin_rewards;
drop policy if exists "spin_rewards_update_executives" on public.spin_rewards;

drop policy if exists "referral_events_select_active_staff" on public.referral_events;
drop policy if exists "referral_events_insert_authorized_staff" on public.referral_events;
drop policy if exists "referral_events_update_executives" on public.referral_events;

drop policy if exists "consultation_requests_select_active_staff" on public.consultation_requests;
drop policy if exists "checklist_downloads_select_active_staff" on public.checklist_downloads;

-- ------------------------------------------------------------------------------
-- 2. RESTORE PRE-MIGRATION POLICIES (FROM MIGRATION_ABLEBIZ_SUITE.sql)
-- ------------------------------------------------------------------------------
-- Active staff full access on operational tables (Standard Stage-D Baseline)
create policy "Active staff full access on leads"
on public.leads for all to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "Active staff full access on spin_rewards"
on public.spin_rewards for all to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "Active staff full access on referral_events"
on public.referral_events for all to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "Active staff full access on consultation_requests"
on public.consultation_requests for all to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "Active staff full access on checklist_downloads"
on public.checklist_downloads for all to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

-- ------------------------------------------------------------------------------
-- 3. DROP TRIGGER ON STAFF PROFILES
-- ------------------------------------------------------------------------------
drop trigger if exists trg_sync_executive_staff_to_admin_users on public.staff_profiles;
drop function if exists public.sync_executive_staff_to_admin_users();

-- ------------------------------------------------------------------------------
-- 4. RESTORE ORIGINAL BASELINE HELPER DEFINITIONS (SUPABASE_BACKEND.sql baseline)
-- ------------------------------------------------------------------------------
create or replace function public._ablebiz_require_admin()
returns public.admin_users
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  select * into v_admin
  from public.admin_users
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if not found then
    raise exception 'not_authorized';
  end if;

  return v_admin;
end;
$$;

commit;
