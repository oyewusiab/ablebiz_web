-- ============================================================
--  ABLEBIZ SUPABASE BACKEND  —  Full Setup Script
--  Copy and paste this entire file into the Supabase SQL Editor
--  and click "Run". It is fully idempotent (safe to re-run).
--
--  Covers:
--    1. Extensions
--    2. Enums / Types
--    3. Utility functions
--    4. Core tables:
--         leads, spin_rewards, referral_events,
--         consultation_requests, checklist_downloads
--    5. Admin system:
--         admin_users, admin_audit_log
--    6. Dynamic configuration:
--         site_config, spin_reward_configs, referral_tier_configs
--    7. Row-Level Security + grants
--    8. Public RPCs (called from the frontend, no auth required)
--         – ablebiz_create_spin_and_reward
--         – ablebiz_create_consultation_request
--         – ablebiz_create_checklist_download
--         – ablebiz_get_monthly_leaderboard
--         – ablebiz_get_referral_stats
--    9. Admin RPCs (called from admin portal, authenticated)
--         – ablebiz_admin_get_dashboard_stats
--         – ablebiz_admin_get_leads
--         – ablebiz_admin_get_rewards
--         – ablebiz_admin_fulfill_reward
--         – ablebiz_admin_link_referral
--         – ablebiz_admin_get_referral_report
--         – ablebiz_admin_upsert_site_config
--         – ablebiz_admin_get_site_config
--   10. Triggers (auto-housekeeping)
--   11. Seed data (default spin rewards + referral tiers)
-- ============================================================

begin;

-- ============================================================
-- 1) EXTENSIONS
-- ============================================================
create extension if not exists pgcrypto;
create extension if not exists pg_stat_statements; -- optional: for query monitoring


-- ============================================================
-- 2) ENUMS / TYPES (all idempotent)
-- ============================================================
do $$
begin
  -- Lead source
  if not exists (select 1 from pg_type where typname = 'lead_source') then
    create type public.lead_source as enum (
      'spin',
      'consultation',
      'checklist',
      'referral_signup',
      'direct'
    );
  end if;

  -- Contact preference
  if not exists (select 1 from pg_type where typname = 'preferred_contact_method') then
    create type public.preferred_contact_method as enum ('whatsapp','phone','email');
  end if;

  -- Consultation urgency
  if not exists (select 1 from pg_type where typname = 'urgency_level') then
    create type public.urgency_level as enum ('today','this_week','this_month','just_info');
  end if;

  -- Budget bracket
  if not exists (select 1 from pg_type where typname = 'budget_range') then
    create type public.budget_range as enum ('under_25k','25k_40k','50k_80k','100k_plus','not_sure');
  end if;

  -- Compliance reminder topics
  if not exists (select 1 from pg_type where typname = 'reminder_topic') then
    create type public.reminder_topic as enum (
      'annual_returns',
      'scuml',
      'tax',
      'trademark',
      'ngo_returns',
      'general_compliance'
    );
  end if;

  -- Reward fulfillment status
  if not exists (select 1 from pg_type where typname = 'reward_status') then
    create type public.reward_status as enum ('pending','fulfilled','expired','cancelled');
  end if;

  -- Admin role
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('admin','superadmin');
  end if;

  -- Audit action type
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type public.audit_action as enum (
      'reward_fulfilled',
      'reward_cancelled',
      'lead_updated',
      'referral_linked',
      'config_updated',
      'admin_created',
      'admin_deactivated'
    );
  end if;

end $$;


-- ============================================================
-- 3) UTILITY FUNCTIONS
-- ============================================================

create or replace function public.ablebiz_normalize_email(p text)
returns text language sql immutable as $$
  select lower(trim(coalesce(p, '')));
$$;

create or replace function public.ablebiz_normalize_phone(p text)
returns text language sql immutable as $$
  select regexp_replace(trim(coalesce(p, '')), '[^0-9+]+', '', 'g');
$$;

create or replace function public.ablebiz_secure_random_int(p_mod int)
returns int language plpgsql volatile as $$
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
returns text language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
  idx   int;
  b     bytea;
begin
  for i in 1..10 loop
    b   := gen_random_bytes(1);
    idx := (get_byte(b, 0)::int % length(chars)) + 1;
    code := code || substr(chars, idx, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.ablebiz_generate_reward_code()
returns text language plpgsql volatile as $$
begin
  return 'ABLE-' || upper(replace(substring(gen_random_uuid()::text, 1, 8), '-', ''));
end;
$$;

create or replace function public.ablebiz_mask_name(p text)
returns text language plpgsql immutable as $$
declare
  t           text;
  first_name  text;
  second_name text;
begin
  t := trim(coalesce(p, ''));
  if t = '' then return 'Anonymous'; end if;
  first_name  := split_part(t, ' ', 1);
  second_name := split_part(t, ' ', 2);
  if trim(second_name) = '' then
    return initcap(first_name);
  end if;
  return initcap(first_name) || ' ' || upper(left(second_name, 1)) || '.';
end;
$$;


-- ============================================================
-- 4) CORE TABLES
-- ============================================================

-- leads
-- Central table for every person who interacts with ABLEBIZ
create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  source             public.lead_source not null,

  name               text not null,
  email              text not null,
  phone              text not null,

  normalized_email   text generated always as (public.ablebiz_normalize_email(email)) stored,
  normalized_phone   text generated always as (public.ablebiz_normalize_phone(phone)) stored,

  -- Referral program
  referral_code      text unique,
  referred_by        text,

  -- Business info (collected after initial engagement)
  business_name      text,
  business_type      text,
  state_of_operation text,

  -- Lifecycle tracking
  is_converted       boolean not null default false,
  converted_at       timestamptz,
  conversion_notes   text,

  -- Lead scoring
  engagement_score   int not null default 0,

  -- UTM / Tracking
  page_path          text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_term           text,
  utm_content        text,

  consent_marketing  boolean not null default false
);

create index if not exists leads_created_at_idx        on public.leads (created_at desc);
create index if not exists leads_source_idx            on public.leads (source);
create index if not exists leads_referral_code_idx     on public.leads (referral_code);
create index if not exists leads_referred_by_idx       on public.leads (referred_by);
create index if not exists leads_normalized_email_idx  on public.leads (normalized_email);
create index if not exists leads_normalized_phone_idx  on public.leads (normalized_phone);
create index if not exists leads_is_converted_idx      on public.leads (is_converted);

-- One spin per email/phone
create unique index if not exists leads_spin_unique_email_idx
  on public.leads (normalized_email) where source = 'spin';
create unique index if not exists leads_spin_unique_phone_idx
  on public.leads (normalized_phone) where source = 'spin';


-- spin_rewards
-- Each spin lead gets exactly one reward.
-- reward_type is now TEXT (not enum) so the admin can add custom prize types dynamically.
create table if not exists public.spin_rewards (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  lead_id      uuid not null references public.leads(id) on delete cascade,

  -- Flexible reward type: matches the 'type' field in spin_reward_configs
  reward_type  text not null,
  reward_title text not null,            -- human-readable label at time of award
  reward_code  text not null unique,

  status           public.reward_status not null default 'pending',
  fulfilled_at     timestamptz,
  fulfilled_by     uuid,                 -- references admin_users(id)
  fulfillment_note text
);

create index if not exists spin_rewards_lead_id_idx on public.spin_rewards (lead_id);
create index if not exists spin_rewards_status_idx  on public.spin_rewards (status);
create unique index if not exists spin_rewards_one_per_lead_idx on public.spin_rewards (lead_id);


-- referral_events
-- Logged whenever a referee signs up using someone's referral code
create table if not exists public.referral_events (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  referrer_code    text not null,
  referee_lead_id  uuid not null references public.leads(id) on delete cascade,
  points           int not null default 50,

  -- Admin can manually link a lead to a referrer after the fact
  is_manual_link   boolean not null default false,
  linked_by        uuid,                  -- references admin_users(id)

  unique (referrer_code, referee_lead_id)
);

create index if not exists referral_events_referrer_idx    on public.referral_events (referrer_code);
create index if not exists referral_events_created_at_idx  on public.referral_events (created_at desc);


-- consultation_requests
create table if not exists public.consultation_requests (
  id                         uuid primary key default gen_random_uuid(),
  created_at                 timestamptz not null default now(),

  lead_id                    uuid not null references public.leads(id) on delete cascade,

  service_needed             text not null,
  preferred_contact_method   public.preferred_contact_method not null,
  urgency                    public.urgency_level,
  budget                     public.budget_range,
  message                    text,

  reminders_opt_in           boolean not null default false,
  reminder_topics            public.reminder_topic[] not null default '{}'::public.reminder_topic[]
);

create index if not exists consultation_requests_lead_idx on public.consultation_requests (lead_id);


-- checklist_downloads
create table if not exists public.checklist_downloads (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  lead_id        uuid not null references public.leads(id) on delete cascade,
  checklist_key  text not null
);

create index if not exists checklist_downloads_lead_idx on public.checklist_downloads (lead_id);


-- ============================================================
-- 5) ADMIN SYSTEM
-- ============================================================

-- admin_users
-- Stores admin portal accounts. Linked to Supabase Auth via auth_uid.
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  auth_uid      uuid unique,            -- references auth.users(id) — set after invite accepted
  email         text not null unique,
  name          text not null,
  role          public.admin_role not null default 'admin',
  is_active     boolean not null default true,

  -- Metadata
  last_login_at timestamptz,
  invited_by    uuid references public.admin_users(id)
);

create index if not exists admin_users_email_idx    on public.admin_users (email);
create index if not exists admin_users_auth_uid_idx on public.admin_users (auth_uid);
create index if not exists admin_users_role_idx     on public.admin_users (role);


-- admin_audit_log
-- Immutable record of every sensitive action a superadmin/admin performs
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  admin_id     uuid references public.admin_users(id),
  admin_email  text,
  action       public.audit_action not null,

  target_table text,
  target_id    uuid,

  old_value    jsonb,
  new_value    jsonb,
  note         text
);

create index if not exists audit_log_admin_idx      on public.admin_audit_log (admin_id);
create index if not exists audit_log_action_idx     on public.admin_audit_log (action);
create index if not exists audit_log_created_at_idx on public.admin_audit_log (created_at desc);


-- ============================================================
-- 6) DYNAMIC CONFIGURATION TABLES
-- ============================================================

-- site_config
-- Key-value store for global site settings managed from admin portal
create table if not exists public.site_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id)
);


-- spin_reward_configs
-- Admin-managed list of prizes on the Spin & Win wheel (replaces hardcoded enums)
create table if not exists public.spin_reward_configs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  type         text not null unique,        -- internal ID, e.g. 'discount_1000'
  title        text not null,               -- public label, e.g. '₦1,000 Discount'
  short        text not null default '',    -- short description shown on wheel
  weight       int not null default 25,     -- probability weight (relative, not %)
  is_active    boolean not null default true,
  sort_order   int not null default 0,

  updated_by   uuid references public.admin_users(id)
);

create index if not exists spin_reward_configs_active_idx on public.spin_reward_configs (is_active, sort_order);


-- referral_tier_configs
-- Admin-managed referral milestones that unlock rewards for referrers
create table if not exists public.referral_tier_configs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  referrals_required  int not null,
  title               text not null,
  note                text not null default '',
  is_active           boolean not null default true,
  sort_order          int not null default 0,

  updated_by          uuid references public.admin_users(id)
);

create index if not exists referral_tier_configs_active_idx on public.referral_tier_configs (is_active, sort_order);


-- ============================================================
-- 7) ROW-LEVEL SECURITY + GRANTS
-- ============================================================

-- Enable RLS on all tables
alter table public.leads                   enable row level security;
alter table public.spin_rewards            enable row level security;
alter table public.referral_events         enable row level security;
alter table public.consultation_requests   enable row level security;
alter table public.checklist_downloads     enable row level security;
alter table public.admin_users             enable row level security;
alter table public.admin_audit_log         enable row level security;
alter table public.site_config             enable row level security;
alter table public.spin_reward_configs     enable row level security;
alter table public.referral_tier_configs   enable row level security;

-- Schema usage
grant usage on schema public to anon, authenticated;

-- Revoke direct table access from public — all access goes through RPC
revoke all on table public.leads                 from anon, authenticated;
revoke all on table public.spin_rewards          from anon, authenticated;
revoke all on table public.referral_events       from anon, authenticated;
revoke all on table public.consultation_requests from anon, authenticated;
revoke all on table public.checklist_downloads   from anon, authenticated;
revoke all on table public.admin_users           from anon, authenticated;
revoke all on table public.admin_audit_log       from anon, authenticated;
revoke all on table public.site_config           from anon, authenticated;
revoke all on table public.spin_reward_configs   from anon, authenticated;
revoke all on table public.referral_tier_configs from anon, authenticated;

-- Allow INSERT on tables used directly from the frontend (policies guard the rest)
grant insert on table public.leads                 to anon, authenticated;
grant insert on table public.consultation_requests to anon, authenticated;
grant insert on table public.checklist_downloads   to anon, authenticated;

-- Public INSERT policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='leads' and policyname='public_insert_leads'
  ) then
    create policy public_insert_leads on public.leads
      for insert to anon, authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='consultation_requests' and policyname='public_insert_consultation_requests'
  ) then
    create policy public_insert_consultation_requests on public.consultation_requests
      for insert to anon, authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='checklist_downloads' and policyname='public_insert_checklist_downloads'
  ) then
    create policy public_insert_checklist_downloads on public.checklist_downloads
      for insert to anon, authenticated with check (true);
  end if;
end $$;

-- Admin users: can see their own row
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admin_users' and policyname='admin_users_select_own'
  ) then
    create policy admin_users_select_own on public.admin_users
      for select to authenticated
      using (auth_uid = auth.uid());
  end if;
end $$;

-- Config tables: authenticated admins can read (superadmin write goes through RPC)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='spin_reward_configs' and policyname='spin_configs_authenticated_read'
  ) then
    create policy spin_configs_authenticated_read on public.spin_reward_configs
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='referral_tier_configs' and policyname='referral_tier_configs_authenticated_read'
  ) then
    create policy referral_tier_configs_authenticated_read on public.referral_tier_configs
      for select to authenticated using (true);
  end if;

  -- Allow anon reads on active spin configs (for the public spin wheel)
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='spin_reward_configs' and policyname='spin_configs_anon_read'
  ) then
    create policy spin_configs_anon_read on public.spin_reward_configs
      for select to anon using (is_active = true);
  end if;
end $$;


-- ============================================================
-- 8) PUBLIC RPCs (no authentication required)
-- ============================================================

-- Helper: validate & resolve a referral code (shared logic)
create or replace function public._ablebiz_resolve_referral(
  p_referred_by text,
  p_email       text,
  p_phone       text
)
returns text  -- returns the validated code or NULL
language plpgsql security definer set search_path = public
as $$
declare
  v_valid   text;
  v_ref_email text;
  v_ref_phone text;
begin
  if p_referred_by is null or trim(p_referred_by) = '' then
    return null;
  end if;

  -- Code must exist
  if not exists (select 1 from public.leads where referral_code = trim(p_referred_by)) then
    return null;
  end if;

  v_valid := trim(p_referred_by);

  -- Prevent self-referral
  select normalized_email, normalized_phone
    into v_ref_email, v_ref_phone
  from public.leads
  where referral_code = v_valid
  limit 1;

  if v_ref_email = public.ablebiz_normalize_email(p_email)
     or v_ref_phone = public.ablebiz_normalize_phone(p_phone) then
    return null;
  end if;

  return v_valid;
end;
$$;


-- 8a) Spin & Win
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
        page_path, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) values (
        'spin', trim(p_name), trim(p_email), trim(p_phone),
        v_referral_code, v_valid_ref,
        coalesce(p_consent_marketing, false),
        p_page_path, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
      ) returning id into v_lead_id;

      exit; -- success

    exception when unique_violation then
      -- User already spun? Return existing reward.
      select l.id, l.referral_code, r.reward_type, r.reward_title, r.reward_code
        into x_lead_id, x_referral_code, x_reward_type, x_reward_title, x_reward_code
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
          'lead_id',      x_lead_id,
          'referral_code', x_referral_code,
          'reward_type',  x_reward_type,
          'reward_title', x_reward_title,
          'reward_code',  x_reward_code,
          'note',         'existing_spin'
        );
      end if;

      -- Otherwise: referral_code collision — retry
    end;
  end loop;

  -- Pick reward using weighted probability from spin_reward_configs
  select sum(weight) into v_total_weight
  from public.spin_reward_configs
  where is_active = true;

  if coalesce(v_total_weight, 0) = 0 then
    -- Fallback if no active configs exist
    v_reward_type  := 'general_reward';
    v_reward_title := 'Special Reward';
  else
    v_roll       := public.ablebiz_secure_random_int(v_total_weight);
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
  end if;

  -- Insert reward (retry unique code collision)
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

  -- Credit referrer
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


-- 8b) Consultation request
create or replace function public.ablebiz_create_consultation_request(
  p_name                     text,
  p_email                    text,
  p_phone                    text,
  p_service_needed           text,
  p_preferred_contact_method public.preferred_contact_method,
  p_urgency                  public.urgency_level  default null,
  p_budget                   public.budget_range   default null,
  p_message                  text                  default null,
  p_reminders_opt_in         boolean               default false,
  p_reminder_topics          public.reminder_topic[] default '{}'::public.reminder_topic[],
  p_referred_by              text                  default null,
  p_consent_marketing        boolean               default false,
  p_page_path                text                  default null,
  p_utm_source               text                  default null,
  p_utm_medium               text                  default null,
  p_utm_campaign             text                  default null,
  p_utm_term                 text                  default null,
  p_utm_content              text                  default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_lead_id          uuid;
  v_referral_code    text;
  v_valid_ref        text;
  v_consultation_id  uuid;
  v_try              int := 0;
begin
  if coalesce(trim(p_name),         '') = '' then raise exception 'name_required'; end if;
  if coalesce(trim(p_email),        '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone),        '') = '' then raise exception 'phone_required'; end if;
  if coalesce(trim(p_service_needed), '') = '' then raise exception 'service_needed_required'; end if;

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
        page_path, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) values (
        'consultation', trim(p_name), trim(p_email), trim(p_phone),
        v_referral_code, v_valid_ref,
        coalesce(p_consent_marketing, false),
        p_page_path, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
      ) returning id into v_lead_id;

      exit;
    exception when unique_violation then
      -- retry
    end;
  end loop;

  insert into public.consultation_requests(
    lead_id, service_needed, preferred_contact_method,
    urgency, budget, message,
    reminders_opt_in, reminder_topics
  ) values (
    v_lead_id, trim(p_service_needed), p_preferred_contact_method,
    p_urgency, p_budget, p_message,
    coalesce(p_reminders_opt_in, false),
    coalesce(p_reminder_topics, '{}'::public.reminder_topic[])
  ) returning id into v_consultation_id;

  if v_valid_ref is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_ref, v_lead_id, 50)
    on conflict do nothing;
  end if;

  update public.leads set engagement_score = engagement_score + 20 where id = v_lead_id;

  return jsonb_build_object(
    'lead_id',         v_lead_id,
    'consultation_id', v_consultation_id,
    'referral_code',   v_referral_code
  );
end;
$$;


-- 8c) Checklist download
create or replace function public.ablebiz_create_checklist_download(
  p_name              text,
  p_email             text,
  p_phone             text,
  p_checklist_key     text,
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
  v_lead_id        uuid;
  v_referral_code  text;
  v_valid_ref      text;
  v_download_id    uuid;
  v_try            int := 0;
begin
  if coalesce(trim(p_name),          '') = '' then raise exception 'name_required'; end if;
  if coalesce(trim(p_email),         '') = '' then raise exception 'email_required'; end if;
  if coalesce(trim(p_phone),         '') = '' then raise exception 'phone_required'; end if;
  if coalesce(trim(p_checklist_key), '') = '' then raise exception 'checklist_key_required'; end if;

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
        page_path, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) values (
        'checklist', trim(p_name), trim(p_email), trim(p_phone),
        v_referral_code, v_valid_ref,
        coalesce(p_consent_marketing, false),
        p_page_path, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
      ) returning id into v_lead_id;

      exit;
    exception when unique_violation then
      -- retry
    end;
  end loop;

  insert into public.checklist_downloads(lead_id, checklist_key)
  values (v_lead_id, trim(p_checklist_key))
  returning id into v_download_id;

  if v_valid_ref is not null then
    insert into public.referral_events(referrer_code, referee_lead_id, points)
    values (v_valid_ref, v_lead_id, 50)
    on conflict do nothing;
  end if;

  update public.leads set engagement_score = engagement_score + 5 where id = v_lead_id;

  return jsonb_build_object(
    'lead_id',       v_lead_id,
    'download_id',   v_download_id,
    'referral_code', v_referral_code
  );
end;
$$;


-- 8d) Public monthly leaderboard (masked names — safe to expose)
create or replace function public.ablebiz_get_monthly_leaderboard(
  p_limit int default 5
)
returns table(
  rank          int,
  display_name  text,
  referral_code text,
  points        int,
  referrals     int
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with month_events as (
    select
      referrer_code,
      count(*)::int       as referrals,
      sum(points)::int    as points
    from public.referral_events
    where created_at >= date_trunc('month', now())
      and created_at <  date_trunc('month', now()) + interval '1 month'
    group by referrer_code
  ),
  ref_names as (
    select l.referral_code, min(l.name) as name
    from public.leads l
    join month_events m on m.referrer_code = l.referral_code
    group by l.referral_code
  ),
  ranked as (
    select
      row_number() over (order by m.points desc, m.referrals desc)::int as rank,
      public.ablebiz_mask_name(rn.name)                                  as display_name,
      m.referrer_code                                                     as referral_code,
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


-- 8e) Public: get referral stats by code (for client-facing referral dashboard)
create or replace function public.ablebiz_get_referral_stats(
  p_referral_code text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_lead       record;
  v_total_ref  int;
  v_total_pts  int;
  v_tier       record;
  v_next_tier  record;
begin
  if coalesce(trim(p_referral_code), '') = '' then
    raise exception 'referral_code_required';
  end if;

  -- Fetch the referrer's lead record (masked)
  select
    public.ablebiz_mask_name(name) as display_name,
    referral_code
  into v_lead
  from public.leads
  where referral_code = trim(p_referral_code)
  limit 1;

  if not found then
    raise exception 'referral_code_not_found';
  end if;

  -- Count referrals (all time)
  select
    count(*)::int     as total,
    sum(points)::int  as pts
  into v_total_ref, v_total_pts
  from public.referral_events
  where referrer_code = trim(p_referral_code);

  -- Find which tier they've reached
  select * into v_tier
  from public.referral_tier_configs
  where is_active = true
    and referrals_required <= coalesce(v_total_ref, 0)
  order by referrals_required desc
  limit 1;

  -- Find next tier
  select * into v_next_tier
  from public.referral_tier_configs
  where is_active = true
    and referrals_required > coalesce(v_total_ref, 0)
  order by referrals_required asc
  limit 1;

  return jsonb_build_object(
    'referral_code',    v_lead.referral_code,
    'display_name',     v_lead.display_name,
    'total_referrals',  coalesce(v_total_ref, 0),
    'total_points',     coalesce(v_total_pts, 0),
    'current_tier',     case when v_tier is not null then
                          jsonb_build_object('title', v_tier.title, 'note', v_tier.note)
                        else null end,
    'next_tier',        case when v_next_tier is not null then
                          jsonb_build_object(
                            'title',      v_next_tier.title,
                            'note',       v_next_tier.note,
                            'referrals_required', v_next_tier.referrals_required,
                            'remaining',  v_next_tier.referrals_required - coalesce(v_total_ref, 0)
                          )
                        else null end
  );
end;
$$;


-- ============================================================
-- 9) ADMIN RPCs (called from admin portal — authenticated)
--    All functions use SECURITY DEFINER and verify the calling
--    user's role by looking up public.admin_users.
-- ============================================================

-- Helper: assert that auth.uid() maps to an active admin user
-- Returns the admin_users row or raises 'not_authorized'
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

-- Helper: assert superadmin
create or replace function public._ablebiz_require_superadmin()
returns public.admin_users
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  v_admin := public._ablebiz_require_admin();

  if v_admin.role <> 'superadmin' then
    raise exception 'superadmin_required';
  end if;

  return v_admin;
end;
$$;


-- 9a) Dashboard stats
create or replace function public.ablebiz_admin_get_dashboard_stats()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  v_admin := public._ablebiz_require_admin();

  return jsonb_build_object(
    'total_leads',          (select count(*) from public.leads),
    'leads_this_month',     (select count(*) from public.leads
                             where created_at >= date_trunc('month', now())),
    'spin_participants',    (select count(*) from public.leads where source = 'spin'),
    'consultations',        (select count(*) from public.consultation_requests),
    'checklist_downloads',  (select count(*) from public.checklist_downloads),
    'total_referrals',      (select count(*) from public.referral_events),
    'referrals_this_month', (select count(*) from public.referral_events
                             where created_at >= date_trunc('month', now())),
    'rewards_pending',      (select count(*) from public.spin_rewards where status = 'pending'),
    'rewards_fulfilled',    (select count(*) from public.spin_rewards where status = 'fulfilled'),
    'converted_leads',      (select count(*) from public.leads where is_converted = true),
    'conversion_rate',      round(
                              case when (select count(*) from public.leads) = 0 then 0
                              else (select count(*) from public.leads where is_converted = true)::numeric
                                   / (select count(*) from public.leads)::numeric * 100
                              end, 2
                            ),
    'leads_by_source',      (
                              select jsonb_object_agg(source, cnt)
                              from (
                                select source::text, count(*)::int as cnt
                                from public.leads
                                group by source
                              ) s
                            )
  );
end;
$$;


-- 9b) Admin read: paginated leads list
create or replace function public.ablebiz_admin_get_leads(
  p_search    text    default null,
  p_source    text    default null,
  p_converted boolean default null,
  p_page      int     default 1,
  p_page_size int     default 50
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin  public.admin_users;
  v_offset int;
  v_total  int;
  v_rows   jsonb;
begin
  v_admin  := public._ablebiz_require_admin();
  v_offset := (greatest(coalesce(p_page, 1), 1) - 1) * greatest(coalesce(p_page_size, 50), 1);

  select count(*) into v_total
  from public.leads l
  where (p_source is null or l.source::text = p_source)
    and (p_converted is null or l.is_converted = p_converted)
    and (
      p_search is null
      or l.name  ilike '%' || p_search || '%'
      or l.email ilike '%' || p_search || '%'
      or l.phone ilike '%' || p_search || '%'
    );

  select jsonb_agg(row_to_json(q)) into v_rows
  from (
    select
      l.id, l.created_at, l.source, l.name, l.email, l.phone,
      l.referral_code, l.referred_by,
      l.business_name, l.business_type, l.state_of_operation,
      l.is_converted, l.converted_at, l.conversion_notes,
      l.engagement_score, l.utm_source, l.page_path,
      r.reward_type, r.reward_title, r.reward_code, r.status as reward_status,
      (select count(*) from public.referral_events re where re.referrer_code = l.referral_code)::int as referral_count
    from public.leads l
    left join public.spin_rewards r on r.lead_id = l.id
    where (p_source is null or l.source::text = p_source)
      and (p_converted is null or l.is_converted = p_converted)
      and (
        p_search is null
        or l.name  ilike '%' || p_search || '%'
        or l.email ilike '%' || p_search || '%'
        or l.phone ilike '%' || p_search || '%'
      )
    order by l.created_at desc
    limit greatest(coalesce(p_page_size, 50), 1)
    offset v_offset
  ) q;

  return jsonb_build_object(
    'total',     v_total,
    'page',      coalesce(p_page, 1),
    'page_size', coalesce(p_page_size, 50),
    'data',      coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;


-- 9c) Admin read: reward/redemption requests
create or replace function public.ablebiz_admin_get_rewards(
  p_status    text default null,   -- 'pending' | 'fulfilled' | 'expired' | 'cancelled'
  p_page      int  default 1,
  p_page_size int  default 50
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin  public.admin_users;
  v_offset int;
  v_total  int;
  v_rows   jsonb;
begin
  v_admin  := public._ablebiz_require_admin();
  v_offset := (greatest(coalesce(p_page, 1), 1) - 1) * greatest(coalesce(p_page_size, 50), 1);

  select count(*) into v_total
  from public.spin_rewards r
  where (p_status is null or r.status::text = p_status);

  select jsonb_agg(row_to_json(q)) into v_rows
  from (
    select
      r.id, r.created_at, r.reward_type, r.reward_title, r.reward_code,
      r.status, r.fulfilled_at, r.fulfillment_note,
      l.name, l.email, l.phone, l.referral_code
    from public.spin_rewards r
    join public.leads l on l.id = r.lead_id
    where (p_status is null or r.status::text = p_status)
    order by
      case r.status when 'pending' then 0 else 1 end,
      r.created_at desc
    limit greatest(coalesce(p_page_size, 50), 1)
    offset v_offset
  ) q;

  return jsonb_build_object(
    'total',     v_total,
    'page',      coalesce(p_page, 1),
    'page_size', coalesce(p_page_size, 50),
    'data',      coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;


-- 9d) SUPERADMIN ONLY: fulfill a reward
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
  v_admin := public._ablebiz_require_superadmin(); -- Only superadmins may fulfill

  select * into v_reward from public.spin_rewards where id = p_reward_id;
  if not found then raise exception 'reward_not_found'; end if;
  if v_reward.status <> 'pending' then raise exception 'reward_not_pending'; end if;

  update public.spin_rewards
  set
    status           = 'fulfilled',
    fulfilled_at     = now(),
    fulfilled_by     = v_admin.id,
    fulfillment_note = p_fulfillment_note,
    updated_at       = now()
  where id = p_reward_id;

  -- Mark parent lead as converted
  update public.leads
  set
    is_converted     = true,
    converted_at     = coalesce(converted_at, now()),
    conversion_notes = coalesce(conversion_notes, 'Spin reward fulfilled: ' || v_reward.reward_title),
    updated_at       = now()
  where id = v_reward.lead_id;

  -- Audit log
  insert into public.admin_audit_log(admin_id, admin_email, action, target_table, target_id, new_value)
  values (
    v_admin.id, v_admin.email, 'reward_fulfilled', 'spin_rewards', p_reward_id,
    jsonb_build_object('note', p_fulfillment_note, 'reward_type', v_reward.reward_type)
  );

  return jsonb_build_object('success', true, 'reward_id', p_reward_id);
end;
$$;


-- 9e) Admin: manually link a lead to a referrer
create or replace function public.ablebiz_admin_link_referral(
  p_referee_lead_id uuid,
  p_referrer_code   text,
  p_points          int default 50
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  v_admin := public._ablebiz_require_admin();

  if not exists (select 1 from public.leads where id = p_referee_lead_id) then
    raise exception 'referee_lead_not_found';
  end if;
  if not exists (select 1 from public.leads where referral_code = trim(p_referrer_code)) then
    raise exception 'referrer_code_not_found';
  end if;

  insert into public.referral_events(referrer_code, referee_lead_id, points, is_manual_link, linked_by)
  values (trim(p_referrer_code), p_referee_lead_id, coalesce(p_points, 50), true, v_admin.id)
  on conflict (referrer_code, referee_lead_id) do nothing;

  -- Audit
  insert into public.admin_audit_log(admin_id, admin_email, action, target_table, target_id, new_value)
  values (
    v_admin.id, v_admin.email, 'referral_linked', 'referral_events', p_referee_lead_id,
    jsonb_build_object('referrer_code', p_referrer_code, 'points', p_points)
  );

  return jsonb_build_object('success', true);
end;
$$;


-- 9f) Admin: referral ecosystem report
create or replace function public.ablebiz_admin_get_referral_report()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin      public.admin_users;
  v_referrers  jsonb;
  v_conversions jsonb;
begin
  v_admin := public._ablebiz_require_admin();

  -- Top referrers (all time)
  select jsonb_agg(row_to_json(q)) into v_referrers
  from (
    select
      l.referral_code,
      l.name,
      l.email,
      l.phone,
      l.created_at,
      count(re.id)::int       as total_referrals,
      sum(re.points)::int     as total_points,
      sum(case when rf.is_converted then 1 else 0 end)::int as conversions
    from public.leads l
    left join public.referral_events re on re.referrer_code = l.referral_code
    left join public.leads rf on rf.id = re.referee_lead_id
    where l.referral_code is not null
    group by l.referral_code, l.name, l.email, l.phone, l.created_at
    having count(re.id) > 0
    order by total_referrals desc, total_points desc
    limit 100
  ) q;

  -- Conversion events
  select jsonb_agg(row_to_json(q)) into v_conversions
  from (
    select
      re.id,
      re.created_at,
      re.referrer_code,
      re.points,
      re.is_manual_link,
      referee.name    as referee_name,
      referee.email   as referee_email,
      referee.source  as referee_source
    from public.referral_events re
    join public.leads referee on referee.id = re.referee_lead_id
    order by re.created_at desc
    limit 200
  ) q;

  return jsonb_build_object(
    'referrers',   coalesce(v_referrers,  '[]'::jsonb),
    'conversions', coalesce(v_conversions, '[]'::jsonb)
  );
end;
$$;


-- 9g) SUPERADMIN ONLY: upsert site configuration (spin rewards, referral tiers, site settings)
create or replace function public.ablebiz_admin_upsert_site_config(
  p_key   text,
  p_value jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  v_admin := public._ablebiz_require_superadmin();

  insert into public.site_config(key, value, updated_at, updated_by)
  values (p_key, p_value, now(), v_admin.id)
  on conflict (key) do update
    set value      = excluded.value,
        updated_at = now(),
        updated_by = v_admin.id;

  -- Audit
  insert into public.admin_audit_log(admin_id, admin_email, action, target_table, new_value)
  values (v_admin.id, v_admin.email, 'config_updated', 'site_config',
          jsonb_build_object('key', p_key, 'value', p_value));

  return jsonb_build_object('success', true, 'key', p_key);
end;
$$;


-- 9h) Admin: read site configuration value(s)
create or replace function public.ablebiz_admin_get_site_config(
  p_key text default null  -- null = return all
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
  v_result jsonb;
begin
  v_admin := public._ablebiz_require_admin();

  if p_key is not null then
    select value into v_result from public.site_config where key = p_key;
  else
    select jsonb_object_agg(key, value) into v_result from public.site_config;
  end if;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;


-- 9i) SUPERADMIN ONLY: sync spin wheel prizes from admin portal
create or replace function public.ablebiz_admin_sync_spin_rewards(
  p_rewards jsonb  -- array of {type, title, short, weight, is_active, sort_order}
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin  public.admin_users;
  v_item   jsonb;
begin
  v_admin := public._ablebiz_require_superadmin();

  for v_item in select * from jsonb_array_elements(p_rewards)
  loop
    insert into public.spin_reward_configs(type, title, short, weight, is_active, sort_order, updated_at, updated_by)
    values (
      v_item->>'type',
      v_item->>'title',
      coalesce(v_item->>'short', ''),
      coalesce((v_item->>'weight')::int, 25),
      coalesce((v_item->>'is_active')::boolean, true),
      coalesce((v_item->>'sort_order')::int, 0),
      now(),
      v_admin.id
    )
    on conflict (type) do update
      set title      = excluded.title,
          short      = excluded.short,
          weight     = excluded.weight,
          is_active  = excluded.is_active,
          sort_order = excluded.sort_order,
          updated_at = now(),
          updated_by = v_admin.id;
  end loop;

  insert into public.admin_audit_log(admin_id, admin_email, action, target_table, new_value)
  values (v_admin.id, v_admin.email, 'config_updated', 'spin_reward_configs', p_rewards);

  return jsonb_build_object('success', true, 'synced', jsonb_array_length(p_rewards));
end;
$$;


-- 9j) SUPERADMIN ONLY: sync referral tiers from admin portal
create or replace function public.ablebiz_admin_sync_referral_tiers(
  p_tiers jsonb  -- array of {referrals_required, title, note, is_active, sort_order}
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin public.admin_users;
  v_item  jsonb;
begin
  v_admin := public._ablebiz_require_superadmin();

  -- Deactivate all existing tiers (will be re-activated if present in new list)
  update public.referral_tier_configs set is_active = false, updated_at = now();

  for v_item in select * from jsonb_array_elements(p_tiers)
  loop
    insert into public.referral_tier_configs(referrals_required, title, note, is_active, sort_order, updated_at, updated_by)
    values (
      (v_item->>'referrals_required')::int,
      v_item->>'title',
      coalesce(v_item->>'note', ''),
      coalesce((v_item->>'is_active')::boolean, true),
      coalesce((v_item->>'sort_order')::int, 0),
      now(),
      v_admin.id
    )
    on conflict do nothing;

    -- Reactivate if exists
    update public.referral_tier_configs
    set
      title      = v_item->>'title',
      note       = coalesce(v_item->>'note', ''),
      is_active  = coalesce((v_item->>'is_active')::boolean, true),
      sort_order = coalesce((v_item->>'sort_order')::int, 0),
      updated_at = now(),
      updated_by = v_admin.id
    where referrals_required = (v_item->>'referrals_required')::int;
  end loop;

  return jsonb_build_object('success', true, 'synced', jsonb_array_length(p_tiers));
end;
$$;


-- ============================================================
-- 10) TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
create or replace function public.ablebiz_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger leads_updated_at
  before update on public.leads
  for each row execute function public.ablebiz_set_updated_at();

create or replace trigger spin_rewards_updated_at
  before update on public.spin_rewards
  for each row execute function public.ablebiz_set_updated_at();

create or replace trigger admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.ablebiz_set_updated_at();

create or replace trigger spin_reward_configs_updated_at
  before update on public.spin_reward_configs
  for each row execute function public.ablebiz_set_updated_at();

create or replace trigger referral_tier_configs_updated_at
  before update on public.referral_tier_configs
  for each row execute function public.ablebiz_set_updated_at();


-- ============================================================
-- 11) GRANTS: allow anon / authenticated to call RPC functions
-- ============================================================

-- Public functions (no auth needed)
revoke all on function public.ablebiz_create_spin_and_reward(text,text,text,text,boolean,text,text,text,text,text,text)          from public;
revoke all on function public.ablebiz_create_consultation_request(text,text,text,text,public.preferred_contact_method,public.urgency_level,public.budget_range,text,boolean,public.reminder_topic[],text,boolean,text,text,text,text,text,text) from public;
revoke all on function public.ablebiz_create_checklist_download(text,text,text,text,text,boolean,text,text,text,text,text,text)  from public;
revoke all on function public.ablebiz_get_monthly_leaderboard(int)                                                                from public;
revoke all on function public.ablebiz_get_referral_stats(text)                                                                    from public;

grant execute on function public.ablebiz_create_spin_and_reward(text,text,text,text,boolean,text,text,text,text,text,text)          to anon, authenticated;
grant execute on function public.ablebiz_create_consultation_request(text,text,text,text,public.preferred_contact_method,public.urgency_level,public.budget_range,text,boolean,public.reminder_topic[],text,boolean,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.ablebiz_create_checklist_download(text,text,text,text,text,boolean,text,text,text,text,text,text)  to anon, authenticated;
grant execute on function public.ablebiz_get_monthly_leaderboard(int)                                                                to anon, authenticated;
grant execute on function public.ablebiz_get_referral_stats(text)                                                                    to anon, authenticated;

-- Admin-only functions (require authenticated + valid admin_users row)
revoke all on function public.ablebiz_admin_get_dashboard_stats()                                          from public;
revoke all on function public.ablebiz_admin_get_leads(text,text,boolean,int,int)                           from public;
revoke all on function public.ablebiz_admin_get_rewards(text,int,int)                                      from public;
revoke all on function public.ablebiz_admin_fulfill_reward(uuid,text)                                      from public;
revoke all on function public.ablebiz_admin_link_referral(uuid,text,int)                                   from public;
revoke all on function public.ablebiz_admin_get_referral_report()                                          from public;
revoke all on function public.ablebiz_admin_upsert_site_config(text,jsonb)                                 from public;
revoke all on function public.ablebiz_admin_get_site_config(text)                                          from public;
revoke all on function public.ablebiz_admin_sync_spin_rewards(jsonb)                                       from public;
revoke all on function public.ablebiz_admin_sync_referral_tiers(jsonb)                                     from public;

grant execute on function public.ablebiz_admin_get_dashboard_stats()                                       to authenticated;
grant execute on function public.ablebiz_admin_get_leads(text,text,boolean,int,int)                        to authenticated;
grant execute on function public.ablebiz_admin_get_rewards(text,int,int)                                   to authenticated;
grant execute on function public.ablebiz_admin_fulfill_reward(uuid,text)                                   to authenticated;
grant execute on function public.ablebiz_admin_link_referral(uuid,text,int)                                to authenticated;
grant execute on function public.ablebiz_admin_get_referral_report()                                       to authenticated;
grant execute on function public.ablebiz_admin_upsert_site_config(text,jsonb)                              to authenticated;
grant execute on function public.ablebiz_admin_get_site_config(text)                                       to authenticated;
grant execute on function public.ablebiz_admin_sync_spin_rewards(jsonb)                                    to authenticated;
grant execute on function public.ablebiz_admin_sync_referral_tiers(jsonb)                                  to authenticated;


-- ============================================================
-- 12) SEED DATA — Default spin rewards and referral tiers
--     (Only inserted if the tables are empty)
-- ============================================================

insert into public.spin_reward_configs (type, title, short, weight, sort_order)
select * from (values
  ('discount_1000',      '₦1,000 Discount',          'Save ₦1,000 on your registration fee',       30, 0),
  ('free_consultation',  'Free Consultation',         'Get a free 30-min business guidance session', 25, 1),
  ('free_name_search',   'Free Name Search',          'We will search your preferred business name', 25, 2),
  ('free_ebook',         'Free Business E-book',      'Download our exclusive business starter guide', 20, 3)
) as t(type, title, short, weight, sort_order)
where not exists (select 1 from public.spin_reward_configs limit 1);

insert into public.referral_tier_configs (referrals_required, title, note, sort_order)
select * from (values
  (3,  'Bronze Referrer', 'Unlock a free business name search',           0),
  (5,  'Silver Referrer', 'Unlock a free 30-minute consultation session', 1),
  (10, 'Gold Referrer',   'Unlock a ₦5,000 discount on any service',      2),
  (20, 'Platinum Referrer','Unlock a full free CAC registration package', 3)
) as t(referrals_required, title, note, sort_order)
where not exists (select 1 from public.referral_tier_configs limit 1);


commit;

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- NEXT STEPS after running this script:
--
-- 1. Create your first Superadmin account:
--    a. Sign up via Supabase Auth Dashboard (Authentication > Users > Invite User)
--    b. Once accepted, grab the auth.uid() of the user and run:
--
--       INSERT INTO public.admin_users (auth_uid, email, name, role)
--       VALUES (
--         '<paste auth uid here>',
--         'admin@yourdomain.com',
--         'Your Name',
--         'superadmin'
--       );
--
-- 2. The admin portal login will now authenticate against Supabase Auth
--    and the admin_users table for role verification.
--
-- 3. All Spin Wheel reward configurations can be managed from the
--    Admin Portal → Settings → Spin Wheel tab. Changes are synced
--    to the spin_reward_configs table via ablebiz_admin_sync_spin_rewards().
--
-- 4. Referral tiers can be managed from:
--    Admin Portal → Settings → Referrals tab, which calls
--    ablebiz_admin_sync_referral_tiers().
-- ============================================================
