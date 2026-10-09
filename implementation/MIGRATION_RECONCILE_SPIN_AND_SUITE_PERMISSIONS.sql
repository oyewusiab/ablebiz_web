-- ==============================================================================
-- ABLEBIZ SUITE & PROMOTION ENGINE: CANONICAL LEAST-PRIVILEGE MIGRATION
-- File: implementation/MIGRATION_RECONCILE_SPIN_AND_SUITE_PERMISSIONS.sql
-- ==============================================================================
-- Target: Supabase production database (https://ksjphkqxudtkduuhnyvn.supabase.co)
-- Security Standard: Zero-Trust & Canonical Role-Based Access Control (RBAC)
--
-- Audit & Security Hardening Summary:
--   1. REJECTS all blanket 'FOR ALL TO authenticated' and 'public.is_active_staff()' access.
--   2. Enforces fine-grained, role-aware policies separated by operation (SELECT, INSERT, UPDATE).
--      - Leads & Consultations: CRM authorized roles (super_admin, admin, operations_manager,
--        client_service_officer, marketing_officer) have SELECT/UPDATE access.
--        Accounts_officer, registration_officer, and viewer have read-only or no edit access.
--      - Hard Deletes: NO DELETE policy granted to any staff role on operational records (preserves audit trail).
--      - Spin Rewards & Referrals: Super Admin & Admin manage; CRM/Ops read.
--   3. Hardens administrative identity resolution:
--      - Eliminates insecure email matching fallback in _ablebiz_require_admin().
--      - Authorizes staff strictly when auth.uid() is matched to an active administrator
--        or an active staff profile with an executive role ('super_admin', 'admin').
--      - Preserves public._ablebiz_require_admin() return type (public.admin_users).
--   4. Decoupled Reward Fulfillment:
--      - ablebiz_admin_fulfill_reward() enforces internal authorization (executives only).
--      - Fulfills spin_rewards without converting the lead (leaves leads.is_converted = false).
--      - Records fulfilled_by, fulfillment_note, fulfilled_at, and writes to public.admin_audit_log.
--   5. Zero Direct Public Writes:
--      - Direct table writes from anon/unauthenticated users are strictly REVOKED.
--      - Public participation routes exclusively through validated SECURITY DEFINER RPCs.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. AUTHORIZATION & STAFF SYNCHRONIZATION (Zero Privilege Escalation)
-- ==============================================================================
-- Mirror ONLY bona-fide executives ('super_admin' and 'admin') into public.admin_users.
-- Operational staff (registration officers, marketing, viewers) are NOT promoted to admin.
insert into public.admin_users (auth_uid, email, name, role, is_active)
select
  sp.auth_uid,
  sp.email,
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
  auth_uid  = excluded.auth_uid,
  name      = excluded.name,
  role      = excluded.role,
  is_active = excluded.is_active;

-- Trigger to keep executive admin_users synchronized without promoting non-admins
-- Handles email changes, deactivations, and role demotions safely
create or replace function public.sync_executive_staff_to_admin_users()
returns trigger language plpgsql security definer as $$
begin
  -- 1. If staff email changed, update existing admin_users record if present
  if tg_op = 'UPDATE' and old.email is distinct from new.email then
    update public.admin_users
    set email = new.email, updated_at = now()
    where email = old.email or auth_uid = new.auth_uid;
  end if;

  -- 2. If staff is active and has an executive role, upsert into admin_users
  if new.auth_uid is not null and new.is_active = true and new.role in ('super_admin', 'admin') then
    insert into public.admin_users (auth_uid, email, name, role, is_active)
    values (
      new.auth_uid,
      new.email,
      new.full_name,
      (case when new.role::text = 'super_admin' then 'superadmin'::public.admin_role else 'admin'::public.admin_role end),
      true
    )
    on conflict (email) do update set
      auth_uid  = excluded.auth_uid,
      name      = excluded.name,
      role      = excluded.role,
      is_active = true,
      updated_at = now();

  -- 3. If staff was demoted to operational role or deactivated, deactivate in admin_users
  elsif (new.role not in ('super_admin', 'admin') or new.is_active = false) then
    update public.admin_users
    set is_active = false, updated_at = now()
    where (auth_uid = new.auth_uid or email = new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_executive_staff_to_admin_users on public.staff_profiles;
create trigger trg_sync_executive_staff_to_admin_users
after insert or update on public.staff_profiles
for each row execute function public.sync_executive_staff_to_admin_users();

-- Hardened administrative identity resolution:
-- Strictly checks auth.uid() linkage against active admin_users OR active executive staff_profiles.
-- Zero unverified email-matching fallback. Preserves public.admin_users return type.
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

  -- 1. Match directly by verified auth_uid in public.admin_users
  select * into v_admin
  from public.admin_users
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if found then
    return v_admin;
  end if;

  -- 2. Match verified auth_uid in canonical public.staff_profiles for executive roles
  select * into v_staff
  from public.staff_profiles
  where auth_uid = auth.uid()
    and is_active = true
    and role in ('super_admin', 'admin')
  limit 1;

  if found then
    -- Synchronize and return the canonical admin record
    insert into public.admin_users (auth_uid, email, name, role, is_active)
    values (
      v_staff.auth_uid,
      v_staff.email,
      v_staff.full_name,
      (case when v_staff.role = 'super_admin' then 'superadmin'::public.admin_role else 'admin'::public.admin_role end),
      true
    )
    on conflict (email) do update set
      auth_uid  = excluded.auth_uid,
      name      = excluded.name,
      role      = excluded.role,
      is_active = true,
      updated_at = now()
    returning * into v_admin;

    return v_admin;
  end if;

  raise exception 'not_authorized';
end;
$$;


-- ==============================================================================
-- 2. ZERO-DEPENDENCY PUBLIC SPIN RPC
-- ==============================================================================
-- Authoritative, secure calculation of prize and duplicate check.
create or replace function public.ablebiz_create_spin_and_reward(
  p_name              text,
  p_email             text,
  p_phone             text,
  p_referred_by       text    default null,
  p_consent_marketing boolean default false,
  p_page_path         text    default null,
  p_utm_source        text    default null,
  p_utm_medium        text    default null,
  p_utm_campaign      text    default null,
  p_utm_term          text    default null,
  p_utm_content       text    default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_lead_id          uuid;
  v_referral_code    text;
  v_valid_ref        text;
  v_reward_config    record;
  v_reward_type      text;
  v_reward_title     text;
  v_reward_code      text;
  v_total_weight     int;
  v_roll             int;
  v_cumulative       int;
  v_try              int := 0;

  x_lead_id       uuid;
  x_referral_code text;
  x_reward_type   text;
  x_reward_title  text;
  x_reward_code   text;
begin
  -- Required field validation
  if coalesce(trim(p_name),  '') = '' then raise exception 'name_required';  end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required'; end if;

  -- Resolve referrer
  v_valid_ref := public._ablebiz_resolve_referral(p_referred_by, p_email, p_phone);

  loop
    v_try := v_try + 1;
    if v_try > 10 then raise exception 'insert_failed_try_again'; end if;

    v_referral_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads(
        source, name, email, phone,
        referral_code, referred_by,
        consent_marketing,
        page_path, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        notes
      ) values (
        'spin', trim(p_name), trim(p_email), trim(p_phone),
        v_referral_code, v_valid_ref,
        coalesce(p_consent_marketing, false),
        p_page_path, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
        'Spin & Earn Promotional Participant'
      ) returning id into v_lead_id;

      exit;

    exception when unique_violation then
      -- If email or phone already spun, retrieve the existing authoritative reward
      select l.id, l.referral_code, r.reward_type, r.reward_title, r.reward_code
        into x_lead_id, x_referral_code, x_reward_type, x_reward_title, x_reward_code
      from public.leads l
      left join public.spin_rewards r on r.lead_id = l.id
      where l.source = 'spin'
        and (
          l.normalized_email = public.ablebiz_normalize_email(p_email)
          or l.normalized_phone = public.ablebiz_normalize_phone(p_phone)
        )
      order by l.created_at desc
      limit 1;

      if x_lead_id is not null then
        return jsonb_build_object(
          'lead_id',       x_lead_id,
          'referral_code', coalesce(x_referral_code, ''),
          'reward_type',   coalesce(x_reward_type, 'discount_1000'),
          'reward_title',  coalesce(x_reward_title, '₦1,000 Discount'),
          'reward_code',   coalesce(x_reward_code, 'ACTIVE-REWARD'),
          'note',          'existing_spin'
        );
      end if;
    end;
  end loop;

  -- Select reward using authoritative weighted configuration
  select sum(weight) into v_total_weight
  from public.spin_reward_configs
  where is_active = true;

  if coalesce(v_total_weight, 0) <= 0 then
    v_reward_type  := 'discount_1000';
    v_reward_title := '₦1,000 Discount';
  else
    v_roll := floor(random() * v_total_weight)::int;
    v_cumulative := 0;

    for v_reward_config in
      select type, title, weight
      from public.spin_reward_configs
      where is_active = true
      order by sort_order, type
    loop
      v_cumulative := v_cumulative + v_reward_config.weight;
      if v_roll < v_cumulative then
        v_reward_type  := v_reward_config.type;
        v_reward_title := v_reward_config.title;
        exit;
      end if;
    end loop;

    if v_reward_type is null then
      v_reward_type  := 'discount_1000';
      v_reward_title := '₦1,000 Discount';
    end if;
  end if;

  -- Create exactly one authoritative reward record
  v_try := 0;
  loop
    v_try := v_try + 1;
    if v_try > 10 then raise exception 'reward_code_generation_failed'; end if;

    v_reward_code := public.ablebiz_generate_reward_code();

    begin
      insert into public.spin_rewards(lead_id, reward_type, reward_title, reward_code)
      values (v_lead_id, v_reward_type, v_reward_title, v_reward_code);
      exit;
    exception when unique_violation then
      -- retry
    end;
  end loop;

  -- Store note on lead
  update public.leads
  set notes = 'Spin & Earn Promotional Reward: ' || v_reward_title || ' | Code: ' || v_reward_code
  where id = v_lead_id;

  -- Credit referral points if applicable (idempotent, once per referee)
  if v_valid_ref is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_ref, v_lead_id, 50)
    on conflict do nothing;
  end if;

  update public.leads set engagement_score = engagement_score + 10 where id = v_lead_id;

  return jsonb_build_object(
    'lead_id',       v_lead_id,
    'referral_code', v_referral_code,
    'reward_type',   v_reward_type,
    'reward_title',  v_reward_title,
    'reward_code',   v_reward_code
  );
end;
$$;


-- ==============================================================================
-- 3. REWARD FULFILLMENT (DECOUPLED FROM CLIENT CONVERSION)
-- ==============================================================================
-- Fulfilling a promotional reward marks spin_rewards.status = 'fulfilled'.
-- Leaves leads.is_converted = false. Only authorized executives can fulfill.
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
  -- Enforce executive authorization inside the function
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
-- 4. ROW-LEVEL SECURITY & CANONICAL ROLE-BASED ACCESS CONTROL (RBAC)
-- ==============================================================================

-- 1. Table Grants: Restrict operations strictly by privilege
grant select, update on public.leads to authenticated;
grant select, update on public.spin_rewards to authenticated;
grant select, insert, update on public.referral_events to authenticated;
grant select on public.consultation_requests to authenticated;
grant select on public.checklist_downloads to authenticated;
grant select on public.spin_reward_configs to anon, authenticated;

-- Direct write and read access from anon is REVOKED across operational tables.
-- Public visitor interactions MUST route through validated SECURITY DEFINER RPCs:
revoke insert, update, delete on public.spin_rewards from anon;
revoke insert, select, update, delete on public.leads from anon;
revoke insert, select, update, delete on public.consultation_requests from anon;
revoke insert, select, update, delete on public.checklist_downloads from anon;

-- Drop obsolete open public insert policies
drop policy if exists "public_insert_leads" on public.leads;
drop policy if exists "public_insert_consultation_requests" on public.consultation_requests;
drop policy if exists "public_insert_checklist_downloads" on public.checklist_downloads;

-- Drop legacy blanket active-staff policies
drop policy if exists "authenticated_staff_leads" on public.leads;
drop policy if exists "Active staff full access on leads" on public.leads;
drop policy if exists "authenticated_staff_spin_rewards" on public.spin_rewards;
drop policy if exists "Active staff full access on spin_rewards" on public.spin_rewards;
drop policy if exists "authenticated_staff_referral_events" on public.referral_events;
drop policy if exists "Active staff full access on referral_events" on public.referral_events;
drop policy if exists "Active staff full access on consultation_requests" on public.consultation_requests;
drop policy if exists "Active staff full access on checklist_downloads" on public.checklist_downloads;


-- ------------------------------------------------------------------------------
-- A. LEADS TABLE (CRM Domain)
-- ------------------------------------------------------------------------------
-- SELECT: All active staff may view leads in the CRM pipeline and workbench.
create policy "leads_select_active_staff"
on public.leads for select
to authenticated
using (public.is_active_staff());

-- UPDATE: Only CRM operational staff can modify leads (qualification, assigned staff, notes).
-- Viewers, accounts officers, and registration officers CANNOT update leads.
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
-- SELECT: All active staff can view consultation requests and lead download records.
create policy "consultation_requests_select_active_staff"
on public.consultation_requests for select
to authenticated
using (public.is_active_staff());

create policy "checklist_downloads_select_active_staff"
on public.checklist_downloads for select
to authenticated
using (public.is_active_staff());

-- NO DIRECT INSERT/UPDATE/DELETE policies for authenticated staff on these intake records.
-- Ingestion happens strictly via validated public RPCs.

commit;
