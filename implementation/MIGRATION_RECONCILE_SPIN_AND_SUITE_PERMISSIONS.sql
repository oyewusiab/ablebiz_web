-- ==============================================================================
-- ABLEBIZ SUITE & PROMOTION ENGINE: RECONCILIATION MIGRATION (REV 2)
-- File: implementation/MIGRATION_RECONCILE_SPIN_AND_SUITE_PERMISSIONS.sql
-- ==============================================================================
-- Target: Supabase production database
-- Objectives:
--   1. Replace ablebiz_create_spin_and_reward() with a zero-dependency PostgreSQL
--      function, eliminating gen_random_bytes(int) failure.
--   2. Grant permissions on public.leads, public.spin_rewards, and public.referral_events
--      to authenticated staff so ABLEBIZ Suite (/admin/leads & /admin/referrals)
--      can view, filter, and manage promotional leads and rewards.
--   3. Add RLS policies for authenticated staff on leads and spin_rewards.
--   4. Allow anon insert on public.leads for public marketing flows (spin, consult, checklist).
--   5. Synchronize staff authentication by ensuring staff_profiles are seamlessly
--      mirrored/available in admin_users so that all existing RPCs returning
--      public.admin_users work without altering function signatures or triggering ERROR 42P13.
--   6. Decouple promotional reward fulfillment from lead conversion.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. SYNC ACTIVE STAFF INTO ADMIN_USERS (Preserves Return Type public.admin_users)
-- ==============================================================================
-- Avoids PostgreSQL 42P13 ("cannot change return type of existing function")
-- Ensures every active staff member in public.staff_profiles has a matching record
-- in public.admin_users with their real auth_uid, email, and name.
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
on conflict (email) do update set
  auth_uid = excluded.auth_uid,
  name     = excluded.name,
  role     = excluded.role,
  is_active = excluded.is_active;

-- Trigger to keep public.admin_users synchronized whenever staff_profiles change
create or replace function public.sync_staff_to_admin_user()
returns trigger language plpgsql security definer as $$
begin
  if new.auth_uid is not null then
    insert into public.admin_users (auth_uid, email, name, role, is_active)
    values (
      new.auth_uid,
      new.email,
      new.full_name,
      (case when new.role::text = 'super_admin' then 'superadmin'::public.admin_role else 'admin'::public.admin_role end),
      coalesce(new.is_active, true)
    )
    on conflict (email) do update set
      auth_uid = excluded.auth_uid,
      name = excluded.name,
      role = excluded.role,
      is_active = excluded.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_staff_to_admin_user on public.staff_profiles;
create trigger trg_sync_staff_to_admin_user
after insert or update on public.staff_profiles
for each row execute function public.sync_staff_to_admin_user();


-- ==============================================================================
-- 2. HELPER FUNCTIONS (_ablebiz_require_admin & _ablebiz_require_superadmin)
-- ==============================================================================
-- Retains existing return type "public.admin_users" to avoid 42P13
create or replace function public._ablebiz_require_admin()
returns public.admin_users
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  -- 1. Direct match on auth_uid
  select * into v_admin
  from public.admin_users
  where auth_uid = auth.uid()
    and is_active = true
  limit 1;

  if found then
    return v_admin;
  end if;

  -- 2. Fallback: match by email via auth.jwt()
  select * into v_admin
  from public.admin_users
  where lower(email) = lower(auth.jwt()->>'email')
    and is_active = true
  limit 1;

  if found then
    -- Self-heal: link auth_uid if missing
    update public.admin_users set auth_uid = auth.uid() where id = v_admin.id;
    return v_admin;
  end if;

  raise exception 'not_authorized';
end;
$$;


-- ==============================================================================
-- 3. ZERO-DEPENDENCY PUBLIC SPIN RPC
-- ==============================================================================
-- Eliminates gen_random_bytes(int) runtime dependency using PostgreSQL random()
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

  -- For returning existing spin
  x_lead_id       uuid;
  x_referral_code text;
  x_reward_type   text;
  x_reward_title  text;
  x_reward_code   text;
begin
  -- Validations
  if coalesce(trim(p_name),  '') = '' then raise exception 'name_required';  end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required'; end if;

  -- Resolve referral
  v_valid_ref := public._ablebiz_resolve_referral(p_referred_by, p_email, p_phone);

  -- Insert lead (with retry for referral_code collision)
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

      exit; -- success

    exception when unique_violation then
      -- User already spun? Return existing reward.
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

      -- Otherwise referral_code collision; retry loop
    end;
  end loop;

  -- Pick reward using weighted probability from spin_reward_configs
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

  -- Insert reward
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

  -- Update notes on lead for immediate diagnostic reference
  update public.leads
  set notes = 'Spin & Earn Promotional Reward: ' || v_reward_title || ' | Code: ' || v_reward_code
  where id = v_lead_id;

  -- Credit referrer if valid
  if v_valid_ref is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_ref, v_lead_id, 50)
    on conflict do nothing;
  end if;

  -- Bump engagement score on the lead
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
-- 4. SUITE REWARD FULFILLMENT (Decoupled from Lead Conversion)
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
  v_admin := public._ablebiz_require_admin();

  select * into v_reward from public.spin_rewards where id = p_reward_id;
  if not found then raise exception 'reward_not_found'; end if;

  if v_reward.status = 'fulfilled' then
    return jsonb_build_object('success', true, 'status', 'already_fulfilled');
  end if;

  update public.spin_rewards
  set
    status           = 'fulfilled',
    fulfilled_at     = now(),
    fulfilled_by     = v_admin.id,
    fulfillment_note = coalesce(p_fulfillment_note, 'Fulfilled by staff')
  where id = p_reward_id;

  return jsonb_build_object('success', true, 'status', 'fulfilled');
end;
$$;


-- ==============================================================================
-- 5. PERMISSIONS, GRANTS & RLS POLICIES
-- ==============================================================================
grant execute on function public.ablebiz_create_spin_and_reward(text, text, text, text, boolean, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.ablebiz_admin_get_rewards(text, int, int) to authenticated;
grant execute on function public.ablebiz_admin_fulfill_reward(uuid, text) to authenticated;
grant execute on function public._ablebiz_require_admin() to authenticated;

-- Direct table access for authenticated staff (for Suite frontend views)
grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.spin_rewards to authenticated;
grant select, insert, update on public.referral_events to authenticated;
grant select on public.spin_reward_configs to anon, authenticated;

-- Public insert permissions for website visitors
grant insert on public.leads to anon;

-- Ensure RLS policies exist on public.leads for authenticated staff
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='leads' and policyname='authenticated_staff_leads'
  ) then
    create policy authenticated_staff_leads on public.leads
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Ensure RLS policies exist on public.spin_rewards for authenticated staff
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='spin_rewards' and policyname='authenticated_staff_spin_rewards'
  ) then
    create policy authenticated_staff_spin_rewards on public.spin_rewards
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

commit;
