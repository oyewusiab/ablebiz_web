-- ==============================================================================
-- ABLEBIZ SUITE & PROMOTION ENGINE: CANONICAL LEAST-PRIVILEGE MIGRATION
-- File: implementation/MIGRATION_RECONCILE_SPIN_AND_SUITE_PERMISSIONS.sql
-- ==============================================================================
-- Target: Supabase production database (https://ksjphkqxudtkduuhnyvn.supabase.co)
-- Security Standard: Zero-Trust & Canonical Role-Based Access Control (RBAC)
--
-- Audit & Security Hardening Summary:
--   1. Strict Canonical Staff Verification in _ablebiz_require_admin():
--      - Every administrative call MUST resolve to an active, canonical staff_profiles record
--        holding an executive role ('super_admin' or 'admin').
--      - If a staff member is missing, inactive, demoted, or conflicting, authorization is REJECTED.
--      - Admin_users is treated strictly as an operational cache; canonical staff_profiles governs.
--      - Preserves public._ablebiz_require_admin() return type (public.admin_users)
--        to prevent PostgreSQL error 42P13.
--   2. Explicit Function Execution Grants & Revocations:
--      - Revokes default PUBLIC and ANON execution on internal helpers:
--        _ablebiz_require_admin(), _ablebiz_require_superadmin(), sync_executive_staff_to_admin_users().
--      - Grants EXECUTE on helper functions strictly to authenticated callers.
--      - Revokes public/anon execute on all administrative RPCs.
--      - Grants public execute ONLY to validated intake RPCs and public leaderboards.
--   3. Preservation of Verified Production Spin RPC:
--      - The working production ablebiz_create_spin_and_reward is preserved intact.
--   4. Identity Conflict Protection:
--      - Aborts if conflicting auth_uids exist between staff_profiles and admin_users.
--   5. Documented Policy Transition & Canonical RBAC:
--      - Replaces blanket active-staff policies with granular, operation-level policies (SELECT, INSERT, UPDATE).
--      - Hard deletion is blocked across all operational tables (leads, spin_rewards, referral_events).
--   6. Decoupled Promotional Fulfillment:
--      - ablebiz_admin_fulfill_reward marks spin_rewards.status = 'fulfilled',
--        records staff identity, timestamp, and audit notes into admin_audit_log,
--        and leaves leads.is_converted = false.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. PREFLIGHT IDENTITY SAFETY CHECK & SYNCHRONIZATION
-- ==============================================================================

-- A. Safety Check: Abort if there are conflicting auth_uids for the same email
do $$
declare
  v_conflict_count int;
begin
  select count(*) into v_conflict_count
  from public.staff_profiles sp
  join public.admin_users au on lower(trim(au.email)) = lower(trim(sp.email))
  where sp.auth_uid is not null
    and au.auth_uid is not null
    and sp.auth_uid <> au.auth_uid;

  if v_conflict_count > 0 then
    raise exception 'IDENTITY_CONFLICT_DETECTED: % staff profile(s) have conflicting auth_uids with admin_users. Manual resolution required before migration.', v_conflict_count;
  end if;
end $$;

-- B. Safe Executive Synchronization (Inserts only bona-fide super_admin & admin)
insert into public.admin_users (auth_uid, email, name, role, is_active)
select
  sp.auth_uid,
  lower(trim(sp.email)),
  sp.full_name,
  (case
    when sp.role::text = 'super_admin' then 'superadmin'::public.admin_role
    else 'admin'::public.admin_role
  end),
  coalesce(sp.is_active, true)
from public.staff_profiles sp
where sp.auth_uid is not null
  and sp.role in ('super_admin', 'admin')
on conflict (email) do update set
  auth_uid  = coalesce(admin_users.auth_uid, excluded.auth_uid),
  name      = excluded.name,
  role      = excluded.role,
  is_active = excluded.is_active
where admin_users.auth_uid is null or admin_users.auth_uid = excluded.auth_uid;

-- C. Trigger to keep executive admin_users synchronized without privilege escalation
create or replace function public.sync_executive_staff_to_admin_users()
returns trigger language plpgsql security definer as $$
begin
  -- 1. If staff email changed, update existing admin_users record if present
  if tg_op = 'UPDATE' and old.email is distinct from new.email then
    update public.admin_users
    set email = lower(trim(new.email)), updated_at = now()
    where (email = lower(trim(old.email)) or auth_uid = new.auth_uid)
      and (auth_uid is null or auth_uid = new.auth_uid);
  end if;

  -- 2. If staff is active and has an executive role, upsert into admin_users
  if new.auth_uid is not null and new.is_active = true and new.role in ('super_admin', 'admin') then
    insert into public.admin_users (auth_uid, email, name, role, is_active)
    values (
      new.auth_uid,
      lower(trim(new.email)),
      new.full_name,
      (case when new.role::text = 'super_admin' then 'superadmin'::public.admin_role else 'admin'::public.admin_role end),
      true
    )
    on conflict (email) do update set
      auth_uid  = coalesce(admin_users.auth_uid, excluded.auth_uid),
      name      = excluded.name,
      role      = excluded.role,
      is_active = true,
      updated_at = now()
    where admin_users.auth_uid is null or admin_users.auth_uid = excluded.auth_uid;

  -- 3. If staff was demoted to an operational role or deactivated, deactivate in admin_users
  elsif (new.role not in ('super_admin', 'admin') or new.is_active = false) then
    update public.admin_users
    set is_active = false, updated_at = now()
    where (auth_uid = new.auth_uid or email = lower(trim(new.email)));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_executive_staff_to_admin_users on public.staff_profiles;
create trigger trg_sync_executive_staff_to_admin_users
after insert or update on public.staff_profiles
for each row execute function public.sync_executive_staff_to_admin_users();

-- D. Strictly Hardened Administrative Identity Resolution:
-- Every authorization requires an active canonical staff_profiles record with role 'super_admin' or 'admin'.
-- Rejects unverified email fallbacks, missing profiles, inactive accounts, and demoted staff.
create or replace function public._ablebiz_require_admin()
returns public.admin_users
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
  v_staff public.staff_profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  -- 1. Verify caller in canonical staff_profiles: MUST be active and have executive role
  select * into v_staff
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
    and role in ('super_admin', 'admin')
  limit 1;

  if not found then
    -- If caller exists in admin_users but was demoted/deactivated in staff_profiles, deactivate cache
    update public.admin_users
    set is_active = false, updated_at = now()
    where auth_uid = auth.uid() and is_active = true;

    raise exception 'not_authorized';
  end if;

  -- 2. Synchronize and retrieve the active admin_users record
  select * into v_admin
  from public.admin_users
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if not found then
    insert into public.admin_users (auth_uid, email, name, role, is_active)
    values (
      v_staff.auth_uid,
      lower(trim(v_staff.email)),
      v_staff.full_name,
      (case when v_staff.role = 'super_admin' then 'superadmin'::public.admin_role else 'admin'::public.admin_role end),
      true
    )
    on conflict (email) do update set
      auth_uid  = coalesce(admin_users.auth_uid, excluded.auth_uid),
      name      = excluded.name,
      role      = excluded.role,
      is_active = true,
      updated_at = now()
    where admin_users.auth_uid is null or admin_users.auth_uid = excluded.auth_uid
    returning * into v_admin;
  end if;

  return v_admin;
end;
$$;


-- ==============================================================================
-- 2. REWARD FULFILLMENT (DECOUPLED FROM CLIENT CONVERSION)
-- ==============================================================================
create or replace function public.ablebiz_admin_fulfill_reward(
  p_reward_id       uuid,
  p_fulfillment_note text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin  public.admin_users;
  v_reward public.spin_rewards;
begin
  -- Enforce canonical executive authorization inside the function
  v_admin := public._ablebiz_require_admin();

  select * into v_reward from public.spin_rewards where id = p_reward_id;
  if not found then raise exception 'reward_not_found'; end if;

  if v_reward.status = 'fulfilled' then
    return jsonb_build_object('success', true, 'status', 'already_fulfilled');
  end if;

  -- Fulfill reward strictly on spin_rewards (leaves leads.is_converted = false)
  update public.spin_rewards
  set
    status           = 'fulfilled',
    fulfilled_at     = now(),
    fulfilled_by     = v_admin.id,
    fulfillment_note = coalesce(p_fulfillment_note, 'Fulfilled by staff'),
    updated_at       = now()
  where id = p_reward_id;

  -- Audit log entry
  insert into public.admin_audit_log(admin_id, admin_email, action, target_table, target_id, new_value)
  values (
    v_admin.id, v_admin.email, 'reward_fulfilled', 'spin_rewards', p_reward_id,
    jsonb_build_object('note', p_fulfillment_note, 'reward_type', v_reward.reward_type)
  );

  return jsonb_build_object('success', true, 'status', 'fulfilled');
end;
$$;


-- ==============================================================================
-- 3. REVOCATION OF UNINTENDED PRIVILEGES & EXPLICIT TABLE GRANTS
-- ==============================================================================

-- Revoke all privileges on private operational tables from public and anon
revoke all on table public.leads from public, anon;
revoke all on table public.spin_rewards from public, anon;
revoke all on table public.referral_events from public, anon;
revoke all on table public.consultation_requests from public, anon;
revoke all on table public.checklist_downloads from public, anon;
revoke all on table public.admin_users from public, anon;
revoke all on table public.admin_audit_log from public, anon;
revoke all on table public.site_config from public, anon;
revoke all on table public.spin_reward_configs from public;
revoke all on table public.referral_tier_configs from public;

-- Grant minimal necessary table privileges to authenticated staff
grant select, update on table public.leads to authenticated;
grant select, update on table public.spin_rewards to authenticated;
grant select, insert, update on table public.referral_events to authenticated;
grant select on table public.consultation_requests to authenticated;
grant select on table public.checklist_downloads to authenticated;

-- Public read access strictly to active public configurations
grant select on table public.spin_reward_configs to anon, authenticated;
grant select on table public.referral_tier_configs to anon, authenticated;


-- ==============================================================================
-- 4. FUNCTION EXECUTION PRIVILEGES (LEAST PRIVILEGE)
-- ==============================================================================

-- Internal Helper Functions: Revoke default PUBLIC execution, restrict to authenticated
revoke all on function public._ablebiz_require_admin() from public, anon;
grant execute on function public._ablebiz_require_admin() to authenticated;

revoke all on function public._ablebiz_require_superadmin() from public, anon;
grant execute on function public._ablebiz_require_superadmin() to authenticated;

revoke all on function public.sync_executive_staff_to_admin_users() from public, anon;
grant execute on function public.sync_executive_staff_to_admin_users() to authenticated;

-- Public RPCs: Callable by anonymous visitors and authenticated users
revoke all on function public.ablebiz_create_spin_and_reward(text,text,text,text,boolean,text,text,text,text,text,text) from public;
grant execute on function public.ablebiz_create_spin_and_reward(text,text,text,text,boolean,text,text,text,text,text,text) to anon, authenticated;

revoke all on function public.ablebiz_create_consultation_request(text,text,text,text,public.preferred_contact_method,public.urgency_level,public.budget_range,text,boolean,public.reminder_topic[],text,boolean,text,text,text,text,text,text) from public;
grant execute on function public.ablebiz_create_consultation_request(text,text,text,text,public.preferred_contact_method,public.urgency_level,public.budget_range,text,boolean,public.reminder_topic[],text,boolean,text,text,text,text,text,text) to anon, authenticated;

revoke all on function public.ablebiz_create_checklist_download(text,text,text,text,text,boolean,text,text,text,text,text,text) from public;
grant execute on function public.ablebiz_create_checklist_download(text,text,text,text,text,boolean,text,text,text,text,text,text) to anon, authenticated;

revoke all on function public.ablebiz_get_monthly_leaderboard(int) from public;
grant execute on function public.ablebiz_get_monthly_leaderboard(int) to anon, authenticated;

revoke all on function public.ablebiz_get_referral_stats(text) from public;
grant execute on function public.ablebiz_get_referral_stats(text) to anon, authenticated;

-- Administrative RPCs: Strictly authenticated only
revoke all on function public.ablebiz_admin_get_dashboard_stats() from public, anon;
grant execute on function public.ablebiz_admin_get_dashboard_stats() to authenticated;

revoke all on function public.ablebiz_admin_get_leads(text,text,boolean,int,int) from public, anon;
grant execute on function public.ablebiz_admin_get_leads(text,text,boolean,int,int) to authenticated;

revoke all on function public.ablebiz_admin_get_rewards(text,int,int) from public, anon;
grant execute on function public.ablebiz_admin_get_rewards(text,int,int) to authenticated;

revoke all on function public.ablebiz_admin_fulfill_reward(uuid,text) from public, anon;
grant execute on function public.ablebiz_admin_fulfill_reward(uuid,text) to authenticated;

revoke all on function public.ablebiz_admin_link_referral(uuid,text,int) from public, anon;
grant execute on function public.ablebiz_admin_link_referral(uuid,text,int) to authenticated;

revoke all on function public.ablebiz_admin_get_referral_report() from public, anon;
grant execute on function public.ablebiz_admin_get_referral_report() to authenticated;

revoke all on function public.ablebiz_admin_upsert_site_config(text,jsonb) from public, anon;
grant execute on function public.ablebiz_admin_upsert_site_config(text,jsonb) to authenticated;

revoke all on function public.ablebiz_admin_get_site_config(text) from public, anon;
grant execute on function public.ablebiz_admin_get_site_config(text) to authenticated;

revoke all on function public.ablebiz_admin_sync_spin_rewards(jsonb) from public, anon;
grant execute on function public.ablebiz_admin_sync_spin_rewards(jsonb) to authenticated;

revoke all on function public.ablebiz_admin_sync_referral_tiers(jsonb) from public, anon;
grant execute on function public.ablebiz_admin_sync_referral_tiers(jsonb) to authenticated;


-- ==============================================================================
-- 5. CANONICAL ROLE-BASED ACCESS CONTROL (RLS POLICIES)
-- ==============================================================================

-- Enable RLS across all operational tables
alter table public.leads enable row level security;
alter table public.spin_rewards enable row level security;
alter table public.referral_events enable row level security;
alter table public.consultation_requests enable row level security;
alter table public.checklist_downloads enable row level security;

-- Drop all existing / legacy policies safely across affected tables
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('leads', 'spin_rewards', 'referral_events', 'consultation_requests', 'checklist_downloads')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- A. LEADS TABLE (CRM Domain)
-- ------------------------------------------------------------------------------
-- SELECT: All active staff may view leads in the CRM pipeline and workbench.
create policy "leads_select_active_staff"
on public.leads for select
to authenticated
using (public.is_active_staff());

-- UPDATE: Only CRM operational staff can modify leads (qualification, assigned staff, notes).
create policy "leads_update_crm_staff"
on public.leads for update
to authenticated
using (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'marketing_officer')
)
with check (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'marketing_officer')
);

-- NO DELETE policy on leads. Preserves complete customer acquisition history and audit trail.


-- ------------------------------------------------------------------------------
-- B. SPIN REWARDS TABLE (Promotions Domain)
-- ------------------------------------------------------------------------------
-- SELECT: All active staff may view reward redemptions.
create policy "spin_rewards_select_active_staff"
on public.spin_rewards for select
to authenticated
using (public.is_active_staff());

-- UPDATE: Only executive management can directly update spin rewards.
-- (Regular fulfillment routes via the audited RPC ablebiz_admin_fulfill_reward).
create policy "spin_rewards_update_executives"
on public.spin_rewards for update
to authenticated
using (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin')
)
with check (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin')
);

-- NO DELETE policy on spin_rewards.


-- ------------------------------------------------------------------------------
-- C. REFERRAL EVENTS TABLE (Growth & Partner Domain)
-- ------------------------------------------------------------------------------
-- SELECT: All active staff may view referral conversion history.
create policy "referral_events_select_active_staff"
on public.referral_events for select
to authenticated
using (public.is_active_staff());

-- INSERT: Only executive and marketing staff may author manual referral linkages.
create policy "referral_events_insert_authorized_staff"
on public.referral_events for insert
to authenticated
with check (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin', 'marketing_officer', 'operations_manager')
);

-- UPDATE: Only executive management can modify referral events.
create policy "referral_events_update_executives"
on public.referral_events for update
to authenticated
using (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin')
)
with check (
  public.is_active_staff() and
  public.current_staff_role() in ('super_admin', 'admin')
);

-- NO DELETE policy on referral_events.


-- ------------------------------------------------------------------------------
-- D. CONSULTATION REQUESTS & CHECKLIST DOWNLOADS
-- ------------------------------------------------------------------------------
create policy "consultation_requests_select_active_staff"
on public.consultation_requests for select
to authenticated
using (public.is_active_staff());

create policy "checklist_downloads_select_active_staff"
on public.checklist_downloads for select
to authenticated
using (public.is_active_staff());

-- NO DIRECT INSERT/UPDATE/DELETE policies for authenticated staff on intake records.
-- Ingestion happens strictly via validated public RPCs.

commit;
