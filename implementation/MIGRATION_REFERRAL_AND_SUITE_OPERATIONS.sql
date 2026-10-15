-- ==============================================================================
-- ABLEBIZ SUITE & REFER & EARN: AUTHORITATIVE REFERRAL & OPERATIONS REPAIR
-- File: implementation/MIGRATION_REFERRAL_AND_SUITE_OPERATIONS.sql
-- ==============================================================================
-- Scope:
--   1. Authoritative unauthenticated Referral Registration RPC:
--      public.ablebiz_register_referral_partner()
--      - Fixes ERROR 42501 (permission denied for table leads)
--      - Safe deduplication by email/phone without duplicate points/rewards
--      - Generates/retrieves stable referral codes
--   2. Authoritative "Refer Someone" Partner Submission RPC:
--      public.ablebiz_submit_referral()
--      - Validates referrer code on backend
--      - Self-referral protection (referee phone/email cannot match referrer)
--      - Idempotent attribution & duplicate lead handling
--   3. Referral Code Recovery RPC:
--      public.ablebiz_recover_referral_code()
--      - Allows partners to recover their referral link via phone or email
--   4. Enhanced Referral Partner Dashboard RPC:
--      public.ablebiz_get_referral_stats()
--      - Returns stats, tiers, conversions, and privacy-masked referee history
--   5. Suite Operational Permissions & Grants:
--      - Grants SELECT, INSERT, UPDATE to authenticated staff on operational tables
--        (services_catalog, service_requests, cac_applications, activity_timeline)
--      - Enforces least-privilege role boundaries across the 8 canonical roles
--      - Hard deletion blocked across all operational entities
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. ENUM SAFETY CHECK
-- ==============================================================================
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.lead_source'::regtype
      and enumlabel = 'referral'
  ) then
    alter type public.lead_source add value if not exists 'referral';
  end if;
end $$;

-- ==============================================================================
-- 2. AUTHORITATIVE REFERRAL REGISTRATION RPC
-- ==============================================================================
create or replace function public.ablebiz_register_referral_partner(
  p_name        text,
  p_email       text,
  p_phone       text,
  p_referred_by text default null,
  p_page_path   text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_norm_email    text;
  v_norm_phone    text;
  v_existing_lead record;
  v_referral_code text;
  v_valid_ref     text;
  v_lead_id       uuid;
  v_try           int := 0;
begin
  -- Validate required inputs
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'phone_required';
  end if;

  v_norm_email := public.ablebiz_normalize_email(p_email);
  v_norm_phone := public.ablebiz_normalize_phone(p_phone);

  if v_norm_phone = '' then
    raise exception 'invalid_phone_number';
  end if;

  -- 1. Deduplication Rule: If customer already registered in leads, return existing profile
  select id, referral_code, name, email, phone
  into v_existing_lead
  from public.leads
  where normalized_phone = v_norm_phone
     or (v_norm_email <> '' and normalized_email = v_norm_email)
  order by created_at asc
  limit 1;

  if v_existing_lead.id is not null then
    -- If lead exists but somehow lacks a referral code, generate one safely
    if coalesce(v_existing_lead.referral_code, '') = '' then
      v_referral_code := public.ablebiz_generate_referral_code();
      update public.leads
      set referral_code = v_referral_code, updated_at = now()
      where id = v_existing_lead.id;
    else
      v_referral_code := v_existing_lead.referral_code;
    end if;

    return jsonb_build_object(
      'lead_id',       v_existing_lead.id,
      'referral_code', v_referral_code,
      'display_name',  v_existing_lead.name,
      'is_existing',   true,
      'message',       'Existing referral profile retrieved successfully'
    );
  end if;

  -- 2. Resolve referring partner if provided (enforces anti-self-referral and code validity)
  if p_referred_by is not null and trim(p_referred_by) <> '' then
    v_valid_ref := public._ablebiz_resolve_referral(trim(p_referred_by), p_email, p_phone);
  end if;

  -- 3. Collision-safe code generation & insert
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'referral_code_generation_failed';
    end if;

    v_referral_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads (
        source,
        name,
        email,
        phone,
        referral_code,
        referred_by,
        page_path,
        qualification_status,
        priority,
        notes
      ) values (
        'referral_signup',
        trim(p_name),
        trim(coalesce(p_email, '')),
        trim(p_phone),
        v_referral_code,
        v_valid_ref,
        p_page_path,
        'new',
        'normal',
        'Referral Partner signup via website /refer-and-earn'
      )
      returning id into v_lead_id;

      exit; -- Insert succeeded
    exception when unique_violation then
      -- Code or phone collision; loop and retry
    end;
  end loop;

  -- 4. Attribute referral event if valid referrer exists (prevent duplicate rewards via unique constraint)
  if v_valid_ref is not null then
    insert into public.referral_events (
      referrer_code,
      referee_lead_id,
      points
    ) values (
      v_valid_ref,
      v_lead_id,
      50
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'lead_id',       v_lead_id,
    'referral_code', v_referral_code,
    'display_name',  trim(p_name),
    'is_existing',   false,
    'message',       'Referral partner registered successfully'
  );
end;
$$;


-- ==============================================================================
-- 3. AUTHORITATIVE "REFER SOMEONE" SUBMISSION RPC
-- ==============================================================================
create or replace function public.ablebiz_submit_referral(
  p_referrer_code    text,
  p_referee_name     text,
  p_referee_phone    text,
  p_referee_email    text default null,
  p_service_interest text default null,
  p_notes            text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_referrer_code      text;
  v_referrer           record;
  v_norm_referee_phone text;
  v_norm_referee_email text;
  v_existing_referee   record;
  v_referee_code       text;
  v_referee_lead_id    uuid;
  v_try                int := 0;
begin
  -- 1. Validate Referrer Code
  if coalesce(trim(p_referrer_code), '') = '' then
    raise exception 'referrer_code_required';
  end if;

  v_referrer_code := upper(trim(p_referrer_code));

  select id, name, referral_code, normalized_email, normalized_phone
  into v_referrer
  from public.leads
  where referral_code = v_referrer_code
  limit 1;

  if v_referrer.id is null then
    raise exception 'invalid_referral_code';
  end if;

  -- 2. Validate Referee details
  if coalesce(trim(p_referee_name), '') = '' then
    raise exception 'referee_name_required';
  end if;
  if coalesce(trim(p_referee_phone), '') = '' then
    raise exception 'referee_phone_required';
  end if;

  v_norm_referee_phone := public.ablebiz_normalize_phone(p_referee_phone);
  v_norm_referee_email := public.ablebiz_normalize_email(p_referee_email);

  if v_norm_referee_phone = '' then
    raise exception 'invalid_referee_phone';
  end if;

  -- 3. Prevent Self-Referral
  if v_referrer.normalized_phone = v_norm_referee_phone
     or (v_norm_referee_email <> '' and v_referrer.normalized_email = v_norm_referee_email) then
    raise exception 'self_referral_not_allowed';
  end if;

  -- 4. Check if referee already exists in leads
  select id, referral_code, is_converted, notes
  into v_existing_referee
  from public.leads
  where normalized_phone = v_norm_referee_phone
     or (v_norm_referee_email <> '' and normalized_email = v_norm_referee_email)
  order by created_at asc
  limit 1;

  if v_existing_referee.id is not null then
    -- Record referral attribution event if not already rewarded for this referrer
    insert into public.referral_events (
      referrer_code,
      referee_lead_id,
      points
    ) values (
      v_referrer.referral_code,
      v_existing_referee.id,
      50
    ) on conflict do nothing;

    -- Append note to existing lead record for Suite staff follow-up
    update public.leads
    set notes = concat_ws(
      ' | ',
      v_existing_referee.notes,
      'Direct referral submitted by partner ' || v_referrer.referral_code ||
      ' (Service: ' || coalesce(p_service_interest, 'General') ||
      case when coalesce(p_notes, '') <> '' then ', Note: ' || p_notes else '' end ||
      ' on ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ')'
    ),
    updated_at = now()
    where id = v_existing_referee.id;

    return jsonb_build_object(
      'success',       true,
      'is_duplicate',  true,
      'message',       'Referral recorded for contact already on file',
      'lead_id',       v_existing_referee.id,
      'referral_code', v_existing_referee.referral_code
    );
  end if;

  -- 5. Create new referee lead with their own unique referral code
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'referee_code_generation_failed';
    end if;

    v_referee_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads (
        source,
        name,
        email,
        phone,
        referral_code,
        referred_by,
        qualification_status,
        priority,
        notes
      ) values (
        'referral_signup',
        trim(p_referee_name),
        trim(coalesce(p_referee_email, '')),
        trim(p_referee_phone),
        v_referee_code,
        v_referrer.referral_code,
        'new',
        'normal',
        'Direct referral from partner ' || v_referrer.referral_code ||
        ' (Service: ' || coalesce(p_service_interest, 'General') || ')' ||
        case when coalesce(p_notes, '') <> '' then ' - Note: ' || p_notes else '' end
      )
      returning id into v_referee_lead_id;

      exit;
    exception when unique_violation then
      -- collision; retry
    end;
  end loop;

  -- 6. Attribute 50 points to the referring partner
  insert into public.referral_events (
    referrer_code,
    referee_lead_id,
    points
  ) values (
    v_referrer.referral_code,
    v_referee_lead_id,
    50
  ) on conflict do nothing;

  return jsonb_build_object(
    'success',       true,
    'is_duplicate',  false,
    'message',       'Referral successfully recorded',
    'lead_id',       v_referee_lead_id,
    'referral_code', v_referee_code
  );
end;
$$;


-- ==============================================================================
-- 4. REFERRAL CODE RECOVERY RPC (UNAUTHENTICATED)
-- ==============================================================================
create or replace function public.ablebiz_recover_referral_code(
  p_identifier text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_clean text;
  v_norm_phone text;
  v_norm_email text;
  v_lead record;
begin
  if coalesce(trim(p_identifier), '') = '' then
    raise exception 'identifier_required';
  end if;

  v_clean := trim(p_identifier);
  v_norm_phone := public.ablebiz_normalize_phone(v_clean);
  v_norm_email := public.ablebiz_normalize_email(v_clean);

  select referral_code, name
  into v_lead
  from public.leads
  where (v_norm_phone <> '' and normalized_phone = v_norm_phone)
     or (v_norm_email <> '' and normalized_email = v_norm_email)
  order by created_at asc
  limit 1;

  if v_lead.referral_code is not null then
    return jsonb_build_object(
      'found',         true,
      'referral_code', v_lead.referral_code,
      'display_name',  public.ablebiz_mask_name(v_lead.name)
    );
  end if;

  return jsonb_build_object('found', false);
end;
$$;


-- ==============================================================================
-- 5. ENHANCED REFERRAL STATS & DASHBOARD RPC
-- ==============================================================================
create or replace function public.ablebiz_get_referral_stats(
  p_referral_code text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_code              text;
  v_lead              record;
  v_total_ref         int := 0;
  v_total_pts         int := 0;
  v_conversions_count int := 0;
  v_tier              record;
  v_next_tier         record;
  v_recent            jsonb := '[]'::jsonb;
begin
  if coalesce(trim(p_referral_code), '') = '' then
    raise exception 'referral_code_required';
  end if;

  v_code := upper(trim(p_referral_code));

  -- Fetch referrer lead
  select
    public.ablebiz_mask_name(name) as display_name,
    referral_code
  into v_lead
  from public.leads
  where referral_code = v_code
  limit 1;

  if not found then
    raise exception 'referral_code_not_found';
  end if;

  -- Count referrals and points from referral_events
  select
    count(*)::int                    as total,
    coalesce(sum(points), 0)::int    as pts
  into v_total_ref, v_total_pts
  from public.referral_events
  where referrer_code = v_code;

  -- Count converted leads
  select count(*)::int
  into v_conversions_count
  from public.leads
  where referred_by = v_code
    and (is_converted = true or qualification_status = 'converted');

  -- Determine unlocked tier
  select * into v_tier
  from public.referral_tier_configs
  where is_active = true
    and referrals_required <= v_total_ref
  order by referrals_required desc
  limit 1;

  -- Determine next tier
  select * into v_next_tier
  from public.referral_tier_configs
  where is_active = true
    and referrals_required > v_total_ref
  order by referrals_required asc
  limit 1;

  -- Recent referee history (Privacy-masked: never exposes raw phone/email)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'created_at',   to_char(l.created_at, 'YYYY-MM-DD'),
        'display_name', public.ablebiz_mask_name(l.name),
        'status',       coalesce(l.qualification_status, 'new'),
        'is_converted', l.is_converted,
        'points',       coalesce(re.points, 50)
      ) order by l.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from public.leads l
  left join public.referral_events re
    on re.referee_lead_id = l.id and re.referrer_code = v_code
  where l.referred_by = v_code;

  return jsonb_build_object(
    'referral_code',     v_lead.referral_code,
    'display_name',      v_lead.display_name,
    'total_referrals',   v_total_ref,
    'total_points',      v_total_pts,
    'conversions_count', v_conversions_count,
    'current_tier',      case when v_tier is not null then
                           jsonb_build_object('title', v_tier.title, 'note', v_tier.note)
                         else null end,
    'next_tier',         case when v_next_tier is not null then
                           jsonb_build_object(
                             'title',              v_next_tier.title,
                             'referrals_required', v_next_tier.referrals_required,
                             'note',               v_next_tier.note
                           )
                         else null end,
    'recent_referrals',  v_recent
  );
end;
$$;


-- ==============================================================================
-- 6. RPC EXECUTION GRANTS
-- ==============================================================================
grant execute on function public.ablebiz_register_referral_partner(text,text,text,text,text) to anon, authenticated;
grant execute on function public.ablebiz_submit_referral(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.ablebiz_recover_referral_code(text) to anon, authenticated;
grant execute on function public.ablebiz_get_referral_stats(text) to anon, authenticated;


-- ==============================================================================
-- 7. SUITE OPERATIONAL TABLE GRANTS & RLS POLICIES
-- ==============================================================================

-- Explicit table-level grants to authenticated staff
grant select, insert, update on table public.services_catalog to authenticated;
grant select, insert, update on table public.service_requests to authenticated;
grant select, insert, update on table public.cac_applications to authenticated;
grant select, insert, update on table public.activity_timeline to authenticated;
grant select, insert, update on table public.tasks to authenticated;
grant select, insert, update on table public.documents to authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select, insert, update on table public.businesses to authenticated;

-- Ensure RLS is enabled on all Suite operational tables
alter table public.services_catalog enable row level security;
alter table public.service_requests enable row level security;
alter table public.cac_applications enable row level security;
alter table public.activity_timeline enable row level security;

-- 7.1 Services Catalog Policies
drop policy if exists "Active staff can view services catalog" on public.services_catalog;
create policy "Active staff can view services catalog"
  on public.services_catalog for select
  to authenticated
  using (public.is_active_staff());

drop policy if exists "Management and Operations can insert services catalog" on public.services_catalog;
create policy "Management and Operations can insert services catalog"
  on public.services_catalog for insert
  to authenticated
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'));

drop policy if exists "Management and Operations can update services catalog" on public.services_catalog;
create policy "Management and Operations can update services catalog"
  on public.services_catalog for update
  to authenticated
  using (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'))
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'));

-- 7.2 Service Requests Policies
drop policy if exists "Active staff can view service requests" on public.service_requests;
create policy "Active staff can view service requests"
  on public.service_requests for select
  to authenticated
  using (public.is_active_staff());

drop policy if exists "Authorized staff can insert service requests" on public.service_requests;
create policy "Authorized staff can insert service requests"
  on public.service_requests for insert
  to authenticated
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'registration_officer'));

drop policy if exists "Authorized staff can update service requests" on public.service_requests;
create policy "Authorized staff can update service requests"
  on public.service_requests for update
  to authenticated
  using (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'registration_officer'))
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'client_service_officer', 'registration_officer'));

-- 7.3 CAC Applications Policies
drop policy if exists "Active staff can view cac applications" on public.cac_applications;
create policy "Active staff can view cac applications"
  on public.cac_applications for select
  to authenticated
  using (public.is_active_staff());

drop policy if exists "Authorized staff can insert cac applications" on public.cac_applications;
create policy "Authorized staff can insert cac applications"
  on public.cac_applications for insert
  to authenticated
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer', 'client_service_officer'));

drop policy if exists "Authorized staff can update cac applications" on public.cac_applications;
create policy "Authorized staff can update cac applications"
  on public.cac_applications for update
  to authenticated
  using (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer'))
  with check (public.current_staff_role() in ('super_admin', 'admin', 'operations_manager', 'registration_officer'));

-- 7.4 Activity Timeline Policies
drop policy if exists "Active staff can view activity timeline" on public.activity_timeline;
create policy "Active staff can view activity timeline"
  on public.activity_timeline for select
  to authenticated
  using (public.is_active_staff());

drop policy if exists "Active staff can insert activity timeline" on public.activity_timeline;
create policy "Active staff can insert activity timeline"
  on public.activity_timeline for insert
  to authenticated
  with check (public.is_active_staff());

commit;

-- Force PostgREST to reload its schema cache immediately
notify pgrst, 'reload schema';
