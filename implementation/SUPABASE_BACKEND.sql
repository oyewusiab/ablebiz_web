-- ABLEBIZ Supabase Backend (copy/paste into Supabase SQL Editor)
-- Purpose: Leads + Spin & Win rewards + referrals + consultation requests + checklist downloads + compliance reminders + leaderboard.
-- Security: RLS enabled, public inserts via policies + public reads only via security definer RPC.

begin;

-- 1) Extensions
create extension if not exists pgcrypto;

-- 2) Types (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_source') then
    create type public.lead_source as enum ('spin','consultation','checklist');
  end if;

  if not exists (select 1 from pg_type where typname = 'preferred_contact_method') then
    create type public.preferred_contact_method as enum ('whatsapp','phone','email');
  end if;

  if not exists (select 1 from pg_type where typname = 'urgency_level') then
    create type public.urgency_level as enum ('today','this_week','this_month','just_info');
  end if;

  if not exists (select 1 from pg_type where typname = 'budget_range') then
    create type public.budget_range as enum ('under_25k','25k_40k','50k_80k','100k_plus','not_sure');
  end if;

  if not exists (select 1 from pg_type where typname = 'reward_type') then
    create type public.reward_type as enum ('discount_1000','free_consultation','free_name_search','free_ebook');
  end if;

  if not exists (select 1 from pg_type where typname = 'reminder_topic') then
    create type public.reminder_topic as enum ('annual_returns','scuml','tax','trademark','ngo_returns','general_compliance');
  end if;
end $$;

-- 3) Utility functions
create or replace function public.ablebiz_normalize_email(p text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p, '')));
$$;

create or replace function public.ablebiz_normalize_phone(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(coalesce(p, '')), '[^0-9]+', '', 'g');
$$;

create or replace function public.ablebiz_secure_random_int(p_mod int)
returns int
language plpgsql
volatile
as $$
declare
  b bytea;
  n int;
begin
  if p_mod is null or p_mod <= 0 then
    raise exception 'invalid_mod';
  end if;

  b := gen_random_bytes(2);
  n := (get_byte(b, 0)::int * 256) + get_byte(b, 1)::int;
  return (n % p_mod);
end;
$$;

create or replace function public.ablebiz_generate_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
  idx int;
  b bytea;
begin
  for i in 1..10 loop
    b := gen_random_bytes(1);
    idx := (get_byte(b, 0)::int % length(chars)) + 1;
    code := code || substr(chars, idx, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.ablebiz_mask_name(p text)
returns text
language plpgsql
immutable
as $$
declare
  t text;
  first_name text;
  second_name text;
begin
  t := trim(coalesce(p, ''));
  if t = '' then
    return 'Anonymous';
  end if;

  first_name := split_part(t, ' ', 1);
  second_name := split_part(t, ' ', 2);

  if trim(second_name) = '' then
    return initcap(first_name);
  end if;

  return initcap(first_name) || ' ' || upper(left(second_name, 1)) || '.';
end;
$$;

-- 4) Tables
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  source public.lead_source not null,

  name text not null,
  email text not null,
  phone text not null,

  normalized_email text generated always as (public.ablebiz_normalize_email(email)) stored,
  normalized_phone text generated always as (public.ablebiz_normalize_phone(phone)) stored,

  -- Referral program
  referral_code text unique,
  referred_by text,

  -- Light metadata (optional, safe)
  page_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  consent_marketing boolean not null default false
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_referral_code_idx on public.leads (referral_code);
create index if not exists leads_referred_by_idx on public.leads (referred_by);

-- Fairness: one spin per phone AND per email (only for spin entries)
create unique index if not exists leads_spin_unique_email_idx
  on public.leads (normalized_email)
  where source = 'spin';

create unique index if not exists leads_spin_unique_phone_idx
  on public.leads (normalized_phone)
  where source = 'spin';

create table if not exists public.spin_rewards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  lead_id uuid not null references public.leads(id) on delete cascade,
  reward_type public.reward_type not null,
  reward_code text not null unique,

  redeemed boolean not null default false,
  redeemed_at timestamptz
);

create index if not exists spin_rewards_lead_id_idx on public.spin_rewards (lead_id);

-- Ensure one reward per spin lead
create unique index if not exists spin_rewards_one_per_lead_idx on public.spin_rewards (lead_id);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  referrer_code text not null,
  referee_lead_id uuid not null references public.leads(id) on delete cascade,
  points int not null default 50,

  unique (referrer_code, referee_lead_id)
);

create index if not exists referral_events_referrer_idx on public.referral_events (referrer_code);
create index if not exists referral_events_created_at_idx on public.referral_events (created_at desc);

create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  lead_id uuid not null references public.leads(id) on delete cascade,

  service_needed text not null,
  preferred_contact_method public.preferred_contact_method not null,
  urgency public.urgency_level,
  budget public.budget_range,
  message text,

  reminders_opt_in boolean not null default false,
  reminder_topics public.reminder_topic[] not null default '{}'::public.reminder_topic[]
);

create index if not exists consultation_requests_lead_idx on public.consultation_requests (lead_id);

create table if not exists public.checklist_downloads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  lead_id uuid not null references public.leads(id) on delete cascade,
  checklist_key text not null
);

create index if not exists checklist_downloads_lead_idx on public.checklist_downloads (lead_id);

-- 5) RLS + privileges
alter table public.leads enable row level security;
alter table public.spin_rewards enable row level security;
alter table public.referral_events enable row level security;
alter table public.consultation_requests enable row level security;
alter table public.checklist_downloads enable row level security;

-- Ensure public roles can access the public schema for RPC execution
grant usage on schema public to anon, authenticated;

-- Default: revoke everything from public roles
revoke all on table public.leads from anon, authenticated;
revoke all on table public.spin_rewards from anon, authenticated;
revoke all on table public.referral_events from anon, authenticated;
revoke all on table public.consultation_requests from anon, authenticated;
revoke all on table public.checklist_downloads from anon, authenticated;

-- Allow public INSERT where appropriate (policies still required)
grant insert on table public.leads to anon, authenticated;
grant insert on table public.consultation_requests to anon, authenticated;
grant insert on table public.checklist_downloads to anon, authenticated;

-- Policies: allow insert-only for public roles
-- (No SELECT policies are created, so public cannot read private tables.)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='leads' and policyname='public_insert_leads'
  ) then
    create policy public_insert_leads on public.leads
      for insert to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='consultation_requests' and policyname='public_insert_consultation_requests'
  ) then
    create policy public_insert_consultation_requests on public.consultation_requests
      for insert to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='checklist_downloads' and policyname='public_insert_checklist_downloads'
  ) then
    create policy public_insert_checklist_downloads on public.checklist_downloads
      for insert to anon, authenticated
      with check (true);
  end if;
end $$;

-- 6) RPC: Spin & Win (creates lead + reward + referral credit)
create or replace function public.ablebiz_create_spin_and_reward(
  p_name text,
  p_email text,
  p_phone text,
  p_referred_by text default null,
  p_consent_marketing boolean default false,
  p_page_path text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_referral_code text;
  v_reward_type public.reward_type;
  v_reward_code text;
  v_idx int;
  v_valid_referred_by text;
  v_referrer_email text;
  v_referrer_phone text;

  -- For returning existing spin (if the user already spun)
  x_lead_id uuid;
  x_referral_code text;
  x_reward_type public.reward_type;
  x_reward_code text;

  v_try int := 0;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'email_required';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'phone_required';
  end if;

  -- Validate referral code (if supplied)
  if p_referred_by is not null and exists(select 1 from public.leads where referral_code = trim(p_referred_by)) then
    v_valid_referred_by := trim(p_referred_by);
  else
    v_valid_referred_by := null;
  end if;

  -- Prevent self-referral (same email or phone as the referrer)
  if v_valid_referred_by is not null then
    select l.normalized_email, l.normalized_phone
      into v_referrer_email, v_referrer_phone
    from public.leads l
    where l.referral_code = v_valid_referred_by
    limit 1;

    if v_referrer_email = public.ablebiz_normalize_email(p_email)
       or v_referrer_phone = public.ablebiz_normalize_phone(p_phone) then
      v_valid_referred_by := null;
    end if;
  end if;

  -- Insert lead with retry to handle rare referral_code collisions or race conditions.
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'insert_failed_try_again';
    end if;

    v_referral_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads(
        source,
        name,
        email,
        phone,
        referral_code,
        referred_by,
        consent_marketing,
        page_path,
        utm_source,
        utm_medium,
        utm_campaign
      ) values (
        'spin',
        trim(p_name),
        trim(p_email),
        trim(p_phone),
        v_referral_code,
        v_valid_referred_by,
        coalesce(p_consent_marketing, false),
        p_page_path,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign
      ) returning id into v_lead_id;

      exit; -- success

    exception
      when unique_violation then
        -- If the user already spun (same email/phone), return the existing reward.
        select l.id, l.referral_code, r.reward_type, r.reward_code
          into x_lead_id, x_referral_code, x_reward_type, x_reward_code
        from public.leads l
        join public.spin_rewards r on r.lead_id = l.id
        where l.source = 'spin'
          and (
            l.normalized_email = public.ablebiz_normalize_email(p_email)
            or l.normalized_phone = public.ablebiz_normalize_phone(p_phone)
          )
        order by l.created_at desc
        limit 1;

        if x_lead_id is not null then
          return jsonb_build_object(
            'lead_id', x_lead_id,
            'referral_code', x_referral_code,
            'reward_type', x_reward_type,
            'reward_code', x_reward_code,
            'note', 'existing_spin'
          );
        end if;

        -- Otherwise: likely referral_code collision; retry.
    end;
  end loop;

  -- Equal odds: 0..3
  v_idx := public.ablebiz_secure_random_int(4);
  v_reward_type := case v_idx
    when 0 then 'discount_1000'
    when 1 then 'free_consultation'
    when 2 then 'free_name_search'
    else 'free_ebook'
  end::public.reward_type;

  -- Insert reward with retry (very rare unique collision)
  v_try := 0;
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'reward_code_generation_failed';
    end if;

    v_reward_code := 'ABLE-' || upper(replace(substring(gen_random_uuid()::text, 1, 8), '-', ''));

    begin
      insert into public.spin_rewards(lead_id, reward_type, reward_code)
      values (v_lead_id, v_reward_type, v_reward_code);
      exit;
    exception
      when unique_violation then
        -- retry with a new code
    end;
  end loop;

  if v_valid_referred_by is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_referred_by, v_lead_id, 50)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'referral_code', v_referral_code,
    'reward_type', v_reward_type,
    'reward_code', v_reward_code
  );
end;
$$;

-- 7) RPC: Consultation request (creates lead + consultation row + referral credit)
create or replace function public.ablebiz_create_consultation_request(
  p_name text,
  p_email text,
  p_phone text,
  p_service_needed text,
  p_preferred_contact_method public.preferred_contact_method,
  p_urgency public.urgency_level default null,
  p_budget public.budget_range default null,
  p_message text default null,
  p_reminders_opt_in boolean default false,
  p_reminder_topics public.reminder_topic[] default '{}'::public.reminder_topic[],
  p_referred_by text default null,
  p_consent_marketing boolean default false,
  p_page_path text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_referral_code text;
  v_valid_referred_by text;
  v_referrer_email text;
  v_referrer_phone text;
  v_consultation_id uuid;
  v_try int := 0;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required'; end if;
  if coalesce(trim(p_service_needed), '') = '' then raise exception 'service_needed_required'; end if;

  if p_referred_by is not null and exists(select 1 from public.leads where referral_code = trim(p_referred_by)) then
    v_valid_referred_by := trim(p_referred_by);
  else
    v_valid_referred_by := null;
  end if;

  -- Prevent self-referral
  if v_valid_referred_by is not null then
    select l.normalized_email, l.normalized_phone
      into v_referrer_email, v_referrer_phone
    from public.leads l
    where l.referral_code = v_valid_referred_by
    limit 1;

    if v_referrer_email = public.ablebiz_normalize_email(p_email)
       or v_referrer_phone = public.ablebiz_normalize_phone(p_phone) then
      v_valid_referred_by := null;
    end if;
  end if;

  -- Insert lead with retry to handle rare referral_code collisions
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'insert_failed_try_again';
    end if;

    v_referral_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads(
        source,
        name,
        email,
        phone,
        referral_code,
        referred_by,
        consent_marketing,
        page_path,
        utm_source,
        utm_medium,
        utm_campaign
      ) values (
        'consultation',
        trim(p_name),
        trim(p_email),
        trim(p_phone),
        v_referral_code,
        v_valid_referred_by,
        coalesce(p_consent_marketing, false),
        p_page_path,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign
      ) returning id into v_lead_id;

      exit;
    exception
      when unique_violation then
        -- retry (likely referral_code collision)
    end;
  end loop;

  insert into public.consultation_requests(
    lead_id,
    service_needed,
    preferred_contact_method,
    urgency,
    budget,
    message,
    reminders_opt_in,
    reminder_topics
  ) values (
    v_lead_id,
    trim(p_service_needed),
    p_preferred_contact_method,
    p_urgency,
    p_budget,
    p_message,
    coalesce(p_reminders_opt_in, false),
    coalesce(p_reminder_topics, '{}'::public.reminder_topic[])
  ) returning id into v_consultation_id;

  if v_valid_referred_by is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_referred_by, v_lead_id, 50)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'consultation_id', v_consultation_id,
    'referral_code', v_referral_code
  );
end;
$$;

-- 8) RPC: Checklist download (creates lead + download record + referral credit)
create or replace function public.ablebiz_create_checklist_download(
  p_name text,
  p_email text,
  p_phone text,
  p_checklist_key text,
  p_referred_by text default null,
  p_consent_marketing boolean default false,
  p_page_path text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_referral_code text;
  v_valid_referred_by text;
  v_referrer_email text;
  v_referrer_phone text;
  v_download_id uuid;
  v_try int := 0;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required'; end if;
  if coalesce(trim(p_checklist_key), '') = '' then raise exception 'checklist_key_required'; end if;

  if p_referred_by is not null and exists(select 1 from public.leads where referral_code = trim(p_referred_by)) then
    v_valid_referred_by := trim(p_referred_by);
  else
    v_valid_referred_by := null;
  end if;

  -- Prevent self-referral
  if v_valid_referred_by is not null then
    select l.normalized_email, l.normalized_phone
      into v_referrer_email, v_referrer_phone
    from public.leads l
    where l.referral_code = v_valid_referred_by
    limit 1;

    if v_referrer_email = public.ablebiz_normalize_email(p_email)
       or v_referrer_phone = public.ablebiz_normalize_phone(p_phone) then
      v_valid_referred_by := null;
    end if;
  end if;

  -- Insert lead with retry to handle rare referral_code collisions
  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'insert_failed_try_again';
    end if;

    v_referral_code := public.ablebiz_generate_referral_code();

    begin
      insert into public.leads(
        source,
        name,
        email,
        phone,
        referral_code,
        referred_by,
        consent_marketing,
        page_path,
        utm_source,
        utm_medium,
        utm_campaign
      ) values (
        'checklist',
        trim(p_name),
        trim(p_email),
        trim(p_phone),
        v_referral_code,
        v_valid_referred_by,
        coalesce(p_consent_marketing, false),
        p_page_path,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign
      ) returning id into v_lead_id;

      exit;
    exception
      when unique_violation then
        -- retry
    end;
  end loop;

  insert into public.checklist_downloads(lead_id, checklist_key)
  values (v_lead_id, trim(p_checklist_key))
  returning id into v_download_id;

  if v_valid_referred_by is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_referred_by, v_lead_id, 50)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'download_id', v_download_id,
    'referral_code', v_referral_code
  );
end;
$$;

-- 9) RPC: Public monthly leaderboard (masked names; safe to expose)
create or replace function public.ablebiz_get_monthly_leaderboard(
  p_limit int default 5
)
returns table(
  rank int,
  display_name text,
  referral_code text,
  points int,
  referrals int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with month_events as (
    select
      referrer_code,
      count(*)::int as referrals,
      sum(points)::int as points
    from public.referral_events
    where created_at >= date_trunc('month', now())
      and created_at < (date_trunc('month', now()) + interval '1 month')
    group by referrer_code
  ),
  ref_names as (
    select
      l.referral_code,
      min(l.name) as name
    from public.leads l
    join month_events m on m.referrer_code = l.referral_code
    group by l.referral_code
  ),
  ranked as (
    select
      row_number() over (order by m.points desc, m.referrals desc, m.referrer_code asc)::int as rank,
      public.ablebiz_mask_name(rn.name) as display_name,
      m.referrer_code as referral_code,
      m.points,
      m.referrals
    from month_events m
    join ref_names rn on rn.referral_code = m.referrer_code
  )
  select * from ranked
  order by rank
  limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

-- 10) Grants: allow anon/authenticated to call RPC functions
revoke all on function public.ablebiz_create_spin_and_reward(
  text, text, text, text, boolean, text, text, text, text
) from public;
revoke all on function public.ablebiz_create_consultation_request(
  text, text, text, text, public.preferred_contact_method, public.urgency_level, public.budget_range, text, boolean, public.reminder_topic[], text, boolean, text, text, text, text
) from public;
revoke all on function public.ablebiz_create_checklist_download(
  text, text, text, text, text, boolean, text, text, text, text
) from public;
revoke all on function public.ablebiz_get_monthly_leaderboard(int) from public;

grant execute on function public.ablebiz_create_spin_and_reward(
  text, text, text, text, boolean, text, text, text, text
) to anon, authenticated;

grant execute on function public.ablebiz_create_consultation_request(
  text, text, text, text, public.preferred_contact_method, public.urgency_level, public.budget_range, text, boolean, public.reminder_topic[], text, boolean, text, text, text, text
) to anon, authenticated;

grant execute on function public.ablebiz_create_checklist_download(
  text, text, text, text, text, boolean, text, text, text, text
) to anon, authenticated;

grant execute on function public.ablebiz_get_monthly_leaderboard(int) to anon, authenticated;

commit;
