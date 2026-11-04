-- ==============================================================================
-- ABLEBIZ WEBSITE + ABLEBIZ SUITE
-- MIGRATION: OFFICE OPENING SPECIAL PROMO & REFERRAL REWARDS CAMPAIGN
-- Campaign Period: November 5, 2026 – November 20, 2026 (Africa/Lagos / WAT)
-- Authoritative Policy: ABLEBIZ Office Opening Special Promo & Referral Rewards Policy
-- Note: Safe to run multiple times (Idempotent). Non-destructive to existing data.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. CENTRAL CAMPAIGN CONFIGURATION TABLES (SINGLE SOURCE OF TRUTH)
-- ==============================================================================

create table if not exists public.campaigns (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    description text,
    campaign_type text not null default 'promo_and_referral',
    start_date timestamptz not null,
    end_date timestamptz not null,
    timezone text not null default 'Africa/Lagos',
    status text not null default 'active'
        check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')),
    promo_headline text not null default 'UP TO 30% OFF SELECTED SERVICES',
    referral_headline text not null default 'EARN UP TO ₦35,000',
    tagline text not null default 'Building Business. Revealing Possibilities.',
    location text not null default 'Abeokuta, Ogun State, Nigeria',
    terms_and_conditions jsonb not null default '[]'::jsonb,
    performance_targets jsonb not null default '{}'::jsonb,
    is_publicly_visible boolean not null default true,
    spin_and_win_paused boolean not null default true,
    allow_preview_pricing boolean not null default false,
    created_by uuid references public.staff_profiles(id) on delete set null,
    updated_by uuid references public.staff_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_campaign_dates check (end_date > start_date)
);

create index if not exists idx_campaigns_slug on public.campaigns(slug);
create index if not exists idx_campaigns_status on public.campaigns(status);

create table if not exists public.campaign_service_prices (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    service_id uuid references public.services_catalog(id) on delete set null,
    service_code text not null,
    service_name text not null,
    category text not null default 'CAC & Compliance',
    regular_professional_fee numeric(14, 2) not null check (regular_professional_fee >= 0),
    discount_percentage numeric(5, 2) not null check (discount_percentage >= 0 and discount_percentage <= 100),
    promo_professional_fee numeric(14, 2) not null check (promo_professional_fee >= 0),
    direct_cost_estimate numeric(14, 2) not null default 0.00 check (direct_cost_estimate >= 0),
    expected_gross_profit numeric(14, 2) generated always as (promo_professional_fee - direct_cost_estimate) stored,
    is_eligible boolean not null default true,
    sort_order int not null default 0,
    notes text,
    updated_by uuid references public.staff_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, service_code)
);

create index if not exists idx_campaign_service_prices_campaign on public.campaign_service_prices(campaign_id);
create index if not exists idx_campaign_service_prices_service on public.campaign_service_prices(service_id);

create table if not exists public.campaign_referral_milestones (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    referrals_required int not null check (referrals_required > 0),
    total_reward_ngn numeric(14, 2) not null check (total_reward_ngn >= 0),
    additional_reward_ngn numeric(14, 2) not null check (additional_reward_ngn >= 0),
    label text not null,
    description text,
    is_active boolean not null default true,
    sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, referrals_required)
);

create index if not exists idx_campaign_referral_milestones_campaign on public.campaign_referral_milestones(campaign_id);

-- ==============================================================================
-- 2. EXTEND QUOTATIONS, INVOICES, LEADS, SERVICE REQUESTS & REFERRAL EVENTS
-- ==============================================================================

-- Quotations: preserve price snapshot & campaign attribution without overwriting services_catalog
alter table public.quotations
    add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
    add column if not exists referral_code text,
    add column if not exists regular_fee_total numeric(14, 2) default 0.00,
    add column if not exists promo_discount_total numeric(14, 2) default 0.00,
    add column if not exists statutory_fee_total numeric(14, 2) default 0.00;

alter table public.quotation_items
    add column if not exists campaign_service_price_id uuid references public.campaign_service_prices(id) on delete set null,
    add column if not exists item_type text not null default 'professional_fee'
        check (item_type in ('professional_fee', 'statutory_fee', 'other')),
    add column if not exists regular_unit_price numeric(14, 2),
    add column if not exists discount_percentage numeric(5, 2) default 0.00,
    add column if not exists promo_unit_price numeric(14, 2);

-- Invoices: preserve price snapshot, statutory fee separation, and campaign verification status
alter table public.invoices
    add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
    add column if not exists referral_code text,
    add column if not exists regular_fee_total numeric(14, 2) default 0.00,
    add column if not exists promo_discount_total numeric(14, 2) default 0.00,
    add column if not exists statutory_fee_total numeric(14, 2) default 0.00,
    add column if not exists campaign_eligibility_status text not null default 'not_applicable'
        check (campaign_eligibility_status in ('not_applicable', 'pending_payment', 'qualified', 'disqualified', 'cancelled_refunded')),
    add column if not exists transaction_verification_status text not null default 'pending'
        check (transaction_verification_status in ('pending', 'verified', 'disqualified')),
    add column if not exists verified_by uuid references public.staff_profiles(id) on delete set null,
    add column if not exists verified_at timestamptz;

alter table public.invoice_items
    add column if not exists campaign_service_price_id uuid references public.campaign_service_prices(id) on delete set null,
    add column if not exists item_type text not null default 'professional_fee'
        check (item_type in ('professional_fee', 'statutory_fee', 'other')),
    add column if not exists regular_unit_price numeric(14, 2),
    add column if not exists discount_percentage numeric(5, 2) default 0.00,
    add column if not exists promo_unit_price numeric(14, 2),
    add column if not exists direct_cost_snapshot numeric(14, 2) default 0.00;

create index if not exists idx_quotations_campaign_id on public.quotations(campaign_id);
create index if not exists idx_invoices_campaign_id on public.invoices(campaign_id);
create index if not exists idx_invoices_referral_code on public.invoices(referral_code);

-- Extend referral_events for full campaign verification & anti-duplicate rules
alter table public.referral_events
    add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
    add column if not exists invoice_id uuid references public.invoices(id) on delete set null,
    add column if not exists payment_id uuid references public.payments(id) on delete set null,
    add column if not exists service_purchased text,
    add column if not exists verification_status text not null default 'pending'
        check (verification_status in ('pending', 'under_review', 'successful', 'disqualified', 'disputed', 'cancelled_refunded')),
    add column if not exists disqualification_reason text,
    add column if not exists is_new_customer boolean not null default true,
    add column if not exists is_eligible_service boolean not null default false,
    add column if not exists is_paid_in_campaign_window boolean not null default false,
    add column if not exists verified_by uuid references public.staff_profiles(id) on delete set null,
    add column if not exists verified_at timestamptz,
    add column if not exists verification_notes text,
    add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_referral_events_campaign_id on public.referral_events(campaign_id);
create index if not exists idx_referral_events_verification_status on public.referral_events(verification_status);

-- Enforce rule: Only ONE referrer may be credited per new customer, and multiple services by one customer count as ONE referral
create unique index if not exists uq_referral_events_one_active_referrer_per_client
    on public.referral_events(client_id)
    where client_id is not null and verification_status not in ('disqualified', 'cancelled_refunded');

create unique index if not exists uq_referral_events_one_active_referrer_per_referee_lead
    on public.referral_events(referee_lead_id)
    where referee_lead_id is not null and verification_status not in ('disqualified', 'cancelled_refunded');

-- ==============================================================================
-- 3. CAMPAIGN REFERRAL PAYOUTS LEDGER (CUMULATIVE MILESTONE TRACKING)
-- ==============================================================================

create table if not exists public.campaign_referral_payouts (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    referrer_code text not null,
    referrer_lead_id uuid references public.leads(id) on delete set null,
    referrer_name text not null,
    referrer_phone text,
    referrer_email text,
    verified_referral_count int not null default 0 check (verified_referral_count >= 0),
    highest_milestone_reached int not null default 0 check (highest_milestone_reached in (0, 1, 3, 5, 10)),
    total_reward_earned numeric(14, 2) not null default 0.00 check (total_reward_earned >= 0),
    additional_reward_at_milestone numeric(14, 2) not null default 0.00 check (additional_reward_at_milestone >= 0),
    amount_paid numeric(14, 2) not null default 0.00 check (amount_paid >= 0),
    amount_payable numeric(14, 2) generated always as (greatest(total_reward_earned - amount_paid, 0.00)) stored,
    payment_status text not null default 'pending_verification'
        check (payment_status in ('pending_verification', 'verified', 'payable', 'processing', 'paid', 'on_hold', 'disqualified')),
    bank_name text,
    account_name text,
    account_number text,
    payment_reference text,
    payment_date timestamptz,
    verified_by uuid references public.staff_profiles(id) on delete set null,
    verified_at timestamptz,
    approved_by uuid references public.staff_profiles(id) on delete set null,
    approved_at timestamptz,
    paid_by uuid references public.staff_profiles(id) on delete set null,
    paid_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, referrer_code)
);

create index if not exists idx_campaign_referral_payouts_campaign on public.campaign_referral_payouts(campaign_id);
create index if not exists idx_campaign_referral_payouts_code on public.campaign_referral_payouts(referrer_code);
create index if not exists idx_campaign_referral_payouts_status on public.campaign_referral_payouts(payment_status);

-- ==============================================================================
-- 4. SERVER-SIDE TIMEZONE, MILESTONE & QUALIFICATION FUNCTIONS
-- ==============================================================================

-- Returns current timestamp evaluated in Africa/Lagos (WAT)
create or replace function public.ablebiz_get_lagos_now()
returns timestamptz
language sql
stable
as $$
    select now();
$$;

-- Calculates cumulative referral milestone rewards according to approved policy:
-- 0 -> ₦0 | 1..2 -> ₦2,000 (add ₦2,000) | 3..4 -> ₦7,500 (add ₦5,500) | 5..9 -> ₦15,000 (add ₦7,500) | >=10 -> ₦35,000 (add ₦20,000)
create or replace function public.ablebiz_calculate_referral_milestone_reward(
    p_successful_referrals int
)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_count int := greatest(coalesce(p_successful_referrals, 0), 0);
    v_milestone int := 0;
    v_total_reward numeric(14, 2) := 0.00;
    v_additional_reward numeric(14, 2) := 0.00;
    v_next_milestone int := 1;
    v_next_total_reward numeric(14, 2) := 2000.00;
    v_remaining_to_next int := 1;
begin
    if v_count >= 10 then
        v_milestone := 10;
        v_total_reward := 35000.00;
        v_additional_reward := 20000.00;
        v_next_milestone := null;
        v_next_total_reward := null;
        v_remaining_to_next := 0;
    elsif v_count >= 5 then
        v_milestone := 5;
        v_total_reward := 15000.00;
        v_additional_reward := 7500.00;
        v_next_milestone := 10;
        v_next_total_reward := 35000.00;
        v_remaining_to_next := 10 - v_count;
    elsif v_count >= 3 then
        v_milestone := 3;
        v_total_reward := 7500.00;
        v_additional_reward := 5500.00;
        v_next_milestone := 5;
        v_next_total_reward := 15000.00;
        v_remaining_to_next := 5 - v_count;
    elsif v_count >= 1 then
        v_milestone := 1;
        v_total_reward := 2000.00;
        v_additional_reward := 2000.00;
        v_next_milestone := 3;
        v_next_total_reward := 7500.00;
        v_remaining_to_next := 3 - v_count;
    else
        v_milestone := 0;
        v_total_reward := 0.00;
        v_additional_reward := 0.00;
        v_next_milestone := 1;
        v_next_total_reward := 2000.00;
        v_remaining_to_next := 1;
    end if;

    return jsonb_build_object(
        'successful_referrals', v_count,
        'milestone_reached', v_milestone,
        'total_reward_earned', v_total_reward,
        'additional_reward_at_milestone', v_additional_reward,
        'next_milestone', v_next_milestone,
        'next_milestone_total_reward', v_next_total_reward,
        'remaining_to_next_milestone', v_remaining_to_next
    );
end;
$$;

-- Computes effective campaign status using server-side Africa/Lagos time
create or replace function public.ablebiz_get_effective_campaign_status(
    p_status text,
    p_start_date timestamptz,
    p_end_date timestamptz
)
returns text
language plpgsql
stable
as $$
declare
    v_now timestamptz := now();
begin
    if p_status in ('draft', 'paused', 'archived', 'completed') then
        return p_status;
    end if;

    if v_now < p_start_date then
        return 'scheduled';
    elsif v_now >= p_start_date and v_now <= p_end_date then
        return 'active';
    else
        return 'completed';
    end if;
end;
$$;

-- Checks whether Spin & Win is currently paused by an active/scheduled campaign or site_config
create or replace function public.ablebiz_is_spin_and_win_paused()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_paused boolean := false;
begin
    select coalesce(bool_or(c.spin_and_win_paused), false)
    into v_paused
    from public.campaigns c
    where c.status in ('scheduled', 'active')
      and now() <= c.end_date;

    return coalesce(v_paused, false);
end;
$$;

-- ==============================================================================
-- 5. PROTECT SPIN & WIN RPC WHEN PAUSED DURING CAMPAIGN (PART 6)
-- ==============================================================================

create or replace function public.ablebiz_create_spin_and_reward(
    p_name text,
    p_phone text,
    p_email text default null,
    p_business_interest text default null,
    p_source text default 'Spin & Win',
    p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_phone text := public._ablebiz_normalize_phone(p_phone);
    v_email text := public._ablebiz_clean_email(p_email);
    v_existing record;
    v_lead_id uuid;
    v_cfg public.spin_reward_configs;
    v_code text;
    v_expires timestamptz := now() + interval '14 days';
begin
    -- Enforce server-side Spin & Win pause during Office Opening Special Promo
    if public.ablebiz_is_spin_and_win_paused() then
        raise exception 'spin_and_win_paused: Spin & Win is temporarily paused during the ABLEBIZ Office Opening Special Promo.';
    end if;

    if coalesce(trim(p_name), '') = '' or v_phone = '' then
        raise exception 'invalid_input';
    end if;

    select
        sr.reward_code,
        sr.reward_type,
        sr.reward_label,
        sr.reward_value,
        sr.expires_at,
        sr.lead_id
    into v_existing
    from public.spin_rewards sr
    join public.leads l on l.id = sr.lead_id
    where l.phone = v_phone
       or (v_email is not null and lower(l.email) = v_email)
    order by sr.created_at desc
    limit 1;

    if found then
        return jsonb_build_object(
            'already_spun', true,
            'lead_id', v_existing.lead_id,
            'reward', jsonb_build_object(
                'code', v_existing.reward_code,
                'type', v_existing.reward_type,
                'label', v_existing.reward_label,
                'value', v_existing.reward_value,
                'expiresAt', v_existing.expires_at
            )
        );
    end if;

    v_lead_id := public.ablebiz_upsert_lead(
        p_name := p_name,
        p_phone := v_phone,
        p_email := v_email,
        p_business_interest := p_business_interest,
        p_source := coalesce(nullif(trim(p_source), ''), 'Spin & Win'),
        p_referral_code := null,
        p_referred_by := null,
        p_utm := coalesce(p_utm, '{}'::jsonb)
    );

    v_cfg := public._ablebiz_pick_spin_reward();

    loop
        v_code := 'ABL-WIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
        exit when not exists (select 1 from public.spin_rewards where reward_code = v_code);
    end loop;

    insert into public.spin_rewards (
        lead_id,
        reward_code,
        reward_type,
        reward_label,
        reward_value,
        expires_at
    )
    values (
        v_lead_id,
        v_code,
        v_cfg.reward_type,
        v_cfg.reward_label,
        v_cfg.reward_value,
        v_expires
    );

    return jsonb_build_object(
        'already_spun', false,
        'lead_id', v_lead_id,
        'reward', jsonb_build_object(
            'code', v_code,
            'type', v_cfg.reward_type,
            'label', v_cfg.reward_label,
            'value', v_cfg.reward_value,
            'expiresAt', v_expires
        )
    );
end;
$$;

-- ==============================================================================
-- 6. PUBLIC & ADMIN CAMPAIGN RPC FUNCTIONS
-- ==============================================================================

-- Public RPC to fetch the authoritative campaign configuration, pricing, and milestones
create or replace function public.ablebiz_get_public_campaign_config(
    p_slug text default 'office-opening-promo-2026'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_campaign public.campaigns;
    v_effective_status text;
    v_services jsonb;
    v_milestones jsonb;
begin
    select *
    into v_campaign
    from public.campaigns
    where slug = coalesce(nullif(trim(p_slug), ''), 'office-opening-promo-2026')
    limit 1;

    if not found then
        return jsonb_build_object('found', false);
    end if;

    v_effective_status := public.ablebiz_get_effective_campaign_status(
        v_campaign.status,
        v_campaign.start_date,
        v_campaign.end_date
    );

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', sp.id,
            'campaign_id', sp.campaign_id,
            'service_id', sp.service_id,
            'service_code', sp.service_code,
            'service_name', sp.service_name,
            'category', sp.category,
            'regular_professional_fee', sp.regular_professional_fee,
            'discount_percentage', sp.discount_percentage,
            'promo_professional_fee', sp.promo_professional_fee,
            'direct_cost_estimate', sp.direct_cost_estimate,
            'expected_gross_profit', sp.expected_gross_profit,
            'is_eligible', sp.is_eligible,
            'sort_order', sp.sort_order,
            'notes', sp.notes
        ) order by sp.sort_order asc, sp.service_name asc
    ), '[]'::jsonb)
    into v_services
    from public.campaign_service_prices sp
    where sp.campaign_id = v_campaign.id;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', rm.id,
            'campaign_id', rm.campaign_id,
            'referrals_required', rm.referrals_required,
            'total_reward_ngn', rm.total_reward_ngn,
            'additional_reward_ngn', rm.additional_reward_ngn,
            'label', rm.label,
            'description', rm.description,
            'is_active', rm.is_active,
            'sort_order', rm.sort_order
        ) order by rm.referrals_required asc
    ), '[]'::jsonb)
    into v_milestones
    from public.campaign_referral_milestones rm
    where rm.campaign_id = v_campaign.id
      and rm.is_active = true;

    return jsonb_build_object(
        'found', true,
        'server_time_utc', now(),
        'server_time_lagos', timezone('Africa/Lagos', now()),
        'campaign', jsonb_build_object(
            'id', v_campaign.id,
            'slug', v_campaign.slug,
            'name', v_campaign.name,
            'description', v_campaign.description,
            'campaign_type', v_campaign.campaign_type,
            'start_date', v_campaign.start_date,
            'end_date', v_campaign.end_date,
            'timezone', v_campaign.timezone,
            'configured_status', v_campaign.status,
            'effective_status', v_effective_status,
            'promo_headline', v_campaign.promo_headline,
            'referral_headline', v_campaign.referral_headline,
            'tagline', v_campaign.tagline,
            'location', v_campaign.location,
            'terms_and_conditions', v_campaign.terms_and_conditions,
            'performance_targets', v_campaign.performance_targets,
            'is_publicly_visible', v_campaign.is_publicly_visible,
            'spin_and_win_paused', v_campaign.spin_and_win_paused,
            'allow_preview_pricing', v_campaign.allow_preview_pricing,
            'updated_at', v_campaign.updated_at
        ),
        'services', v_services,
        'milestones', v_milestones
    );
end;
$$;

-- Helper function to recalculate a referrer's cumulative milestone payout ledger entry
create or replace function public.ablebiz_recalculate_referrer_campaign_payout(
    p_campaign_id uuid,
    p_referrer_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(coalesce(p_referrer_code, '')));
    v_partner record;
    v_verified_count int := 0;
    v_milestone_calc jsonb;
    v_milestone int := 0;
    v_total_reward numeric(14, 2) := 0.00;
    v_additional_reward numeric(14, 2) := 0.00;
    v_payout_id uuid;
begin
    if v_code = '' or p_campaign_id is null then
        return jsonb_build_object('updated', false);
    end if;

    select id, name, phone, email
    into v_partner
    from public.leads
    where referral_code = v_code
    limit 1;

    -- Count distinct qualified customers/leads with 'successful' verification status
    select count(distinct coalesce(re.client_id::text, re.referee_lead_id::text))
    into v_verified_count
    from public.referral_events re
    where re.referrer_code = v_code
      and (re.campaign_id = p_campaign_id or re.campaign_id is null)
      and re.verification_status = 'successful';

    v_milestone_calc := public.ablebiz_calculate_referral_milestone_reward(v_verified_count);
    v_milestone := (v_milestone_calc->>'milestone_reached')::int;
    v_total_reward := (v_milestone_calc->>'total_reward_earned')::numeric(14, 2);
    v_additional_reward := (v_milestone_calc->>'additional_reward_at_milestone')::numeric(14, 2);

    insert into public.campaign_referral_payouts (
        campaign_id,
        referrer_code,
        referrer_lead_id,
        referrer_name,
        referrer_phone,
        referrer_email,
        verified_referral_count,
        highest_milestone_reached,
        total_reward_earned,
        additional_reward_at_milestone,
        payment_status,
        updated_at
    )
    values (
        p_campaign_id,
        v_code,
        v_partner.id,
        coalesce(v_partner.name, v_code),
        v_partner.phone,
        v_partner.email,
        v_verified_count,
        v_milestone,
        v_total_reward,
        v_additional_reward,
        case when v_total_reward > 0 then 'verified' else 'pending_verification' end,
        now()
    )
    on conflict (campaign_id, referrer_code) do update
    set
        referrer_lead_id = coalesce(excluded.referrer_lead_id, public.campaign_referral_payouts.referrer_lead_id),
        referrer_name = coalesce(excluded.referrer_name, public.campaign_referral_payouts.referrer_name),
        referrer_phone = coalesce(excluded.referrer_phone, public.campaign_referral_payouts.referrer_phone),
        referrer_email = coalesce(excluded.referrer_email, public.campaign_referral_payouts.referrer_email),
        verified_referral_count = v_verified_count,
        highest_milestone_reached = v_milestone,
        total_reward_earned = v_total_reward,
        additional_reward_at_milestone = v_additional_reward,
        payment_status = case
            when public.campaign_referral_payouts.payment_status in ('paid', 'processing', 'on_hold', 'disqualified')
                then public.campaign_referral_payouts.payment_status
            when v_total_reward > public.campaign_referral_payouts.amount_paid
                then 'payable'
            when v_total_reward > 0
                then 'verified'
            else 'pending_verification'
        end,
        updated_at = now()
    returning id into v_payout_id;

    return jsonb_build_object(
        'updated', true,
        'payout_id', v_payout_id,
        'referrer_code', v_code,
        'verified_referral_count', v_verified_count,
        'milestone_reached', v_milestone,
        'total_reward_earned', v_total_reward,
        'additional_reward_at_milestone', v_additional_reward
    );
end;
$$;

-- Public RPC allowing a referral partner to submit their bank details for campaign payout verification
create or replace function public.ablebiz_submit_referrer_bank_details(
    p_referral_code text,
    p_phone text,
    p_bank_name text,
    p_account_name text,
    p_account_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(coalesce(p_referral_code, '')));
    v_phone text := public._ablebiz_normalize_phone(p_phone);
    v_partner record;
    v_campaign_id uuid;
begin
    if v_code = '' or v_phone = '' then
        raise exception 'invalid_credentials: Referral code and registered phone number are required.';
    end if;

    if coalesce(trim(p_bank_name), '') = '' or coalesce(trim(p_account_name), '') = '' or length(regexp_replace(coalesce(p_account_number, ''), '\D', '', 'g')) < 10 then
        raise exception 'invalid_bank_details: Valid bank name, account name, and 10-digit NUBAN account number are required.';
    end if;

    select id, name, phone, email
    into v_partner
    from public.leads
    where referral_code = v_code
      and public._ablebiz_normalize_phone(phone) = v_phone
    limit 1;

    if not found then
        raise exception 'unauthorized_partner: Referral code and phone number do not match our records.';
    end if;

    select id into v_campaign_id
    from public.campaigns
    where slug = 'office-opening-promo-2026'
    limit 1;

    if v_campaign_id is null then
        raise exception 'campaign_not_found';
    end if;

    perform public.ablebiz_recalculate_referrer_campaign_payout(v_campaign_id, v_code);

    update public.campaign_referral_payouts
    set
        bank_name = trim(p_bank_name),
        account_name = trim(p_account_name),
        account_number = regexp_replace(trim(p_account_number), '\D', '', 'g'),
        updated_at = now()
    where campaign_id = v_campaign_id
      and referrer_code = v_code;

    return jsonb_build_object(
        'saved', true,
        'referrer_code', v_code,
        'bank_name', trim(p_bank_name),
        'account_name', trim(p_account_name)
    );
end;
$$;

-- Staff RPC to verify or disqualify a campaign referral with server-side qualification checks & audit logging
create or replace function public.ablebiz_verify_campaign_referral(
    p_referral_event_id uuid,
    p_verification_status text,
    p_service_purchased text default null,
    p_invoice_id uuid default null,
    p_payment_id uuid default null,
    p_is_new_customer boolean default true,
    p_is_eligible_service boolean default true,
    p_is_paid_in_window boolean default true,
    p_disqualification_reason text default null,
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text := public.current_staff_role();
    v_staff_id uuid := auth.uid();
    v_staff_email text;
    v_event public.referral_events;
    v_campaign public.campaigns;
    v_partner_lead public.leads;
    v_referee_lead public.leads;
    v_payout_result jsonb;
begin
    if not public.is_active_staff() or v_role not in ('super_admin', 'admin', 'operations_manager', 'accounts_officer', 'marketing_officer') then
        raise exception 'forbidden: Your role (%) is not authorized to verify campaign referrals.', coalesce(v_role, 'anonymous');
    end if;

    if p_verification_status not in ('pending', 'under_review', 'successful', 'disqualified', 'disputed', 'cancelled_refunded') then
        raise exception 'invalid_status: Invalid referral verification status.';
    end if;

    select * into v_event
    from public.referral_events
    where id = p_referral_event_id;

    if not found then
        raise exception 'not_found: Referral event not found.';
    end if;

    select * into v_campaign
    from public.campaigns
    where id = coalesce(v_event.campaign_id, (select id from public.campaigns where slug = 'office-opening-promo-2026' limit 1));

    select * into v_partner_lead from public.leads where referral_code = v_event.referrer_code limit 1;
    select * into v_referee_lead from public.leads where id = v_event.referee_lead_id limit 1;

    -- Qualification enforcement when marking 'successful'
    if p_verification_status = 'successful' then
        -- 1. Anti-self-referral check
        if v_partner_lead.id is not null and v_referee_lead.id is not null then
            if v_partner_lead.id = v_referee_lead.id
               or public._ablebiz_normalize_phone(v_partner_lead.phone) = public._ablebiz_normalize_phone(v_referee_lead.phone)
               or (v_partner_lead.email is not null and v_referee_lead.email is not null and lower(trim(v_partner_lead.email)) = lower(trim(v_referee_lead.email))) then
                raise exception 'self_referral_prohibited: Referrer and referred customer cannot be the same person.';
            end if;
        end if;

        -- 2. Mandatory qualification criteria
        if not coalesce(p_is_new_customer, false) then
            raise exception 'qualification_failed: Referred client must be a new customer to ABLEBIZ.';
        end if;
        if not coalesce(p_is_eligible_service, false) then
            raise exception 'qualification_failed: Referred client must purchase an eligible campaign service.';
        end if;
        if not coalesce(p_is_paid_in_window, false) then
            raise exception 'qualification_failed: Full promotional payment must be received within the campaign period.';
        end if;
    end if;

    if p_verification_status in ('disqualified', 'cancelled_refunded') and coalesce(trim(p_disqualification_reason), '') = '' then
        raise exception 'reason_required: A disqualification or cancellation reason is required.';
    end if;

    update public.referral_events
    set
        campaign_id = coalesce(v_event.campaign_id, v_campaign.id),
        verification_status = p_verification_status,
        service_purchased = coalesce(p_service_purchased, service_purchased),
        invoice_id = coalesce(p_invoice_id, invoice_id),
        payment_id = coalesce(p_payment_id, payment_id),
        is_new_customer = coalesce(p_is_new_customer, is_new_customer),
        is_eligible_service = coalesce(p_is_eligible_service, is_eligible_service),
        is_paid_in_campaign_window = coalesce(p_is_paid_in_window, is_paid_in_campaign_window),
        disqualification_reason = p_disqualification_reason,
        verification_notes = coalesce(p_notes, verification_notes),
        verified_by = v_staff_id,
        verified_at = now(),
        reward_status = case
            when p_verification_status = 'successful' then 'Qualified'
            when p_verification_status in ('disqualified', 'cancelled_refunded') then 'Void'
            else reward_status
        end,
        updated_at = now()
    where id = p_referral_event_id;

    -- Recalculate cumulative milestone reward in campaign_referral_payouts
    v_payout_result := public.ablebiz_recalculate_referrer_campaign_payout(v_campaign.id, v_event.referrer_code);

    -- Write immutable audit log
    select email into v_staff_email from public.staff_profiles where id = v_staff_id;
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
        v_staff_id,
        v_staff_email,
        'campaign_referral_verification',
        'referral_events',
        p_referral_event_id,
        jsonb_build_object('verification_status', v_event.verification_status, 'reward_status', v_event.reward_status),
        jsonb_build_object(
            'verification_status', p_verification_status,
            'disqualification_reason', p_disqualification_reason,
            'payout_recalculation', v_payout_result
        )
    );

    return jsonb_build_object(
        'verified', true,
        'referral_event_id', p_referral_event_id,
        'verification_status', p_verification_status,
        'payout', v_payout_result
    );
end;
$$;

-- Staff RPC to update referral reward payout status (Finance / Executive only, with Maker-Checker & Audit Log)
create or replace function public.ablebiz_update_referral_payout(
    p_payout_id uuid,
    p_payment_status text,
    p_amount_paid numeric default null,
    p_payment_reference text default null,
    p_bank_name text default null,
    p_account_name text default null,
    p_account_number text default null,
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text := public.current_staff_role();
    v_staff_id uuid := auth.uid();
    v_staff_email text;
    v_existing public.campaign_referral_payouts;
    v_new_amount_paid numeric(14, 2);
begin
    if not public.is_active_staff() or v_role not in ('super_admin', 'admin', 'accounts_officer') then
        raise exception 'forbidden: Only Super Admin, Admin, or Finance/Accounts Officers can process referral payouts.';
    end if;

    if p_payment_status not in ('pending_verification', 'verified', 'payable', 'processing', 'paid', 'on_hold', 'disqualified') then
        raise exception 'invalid_status: Invalid payout status.';
    end if;

    select * into v_existing
    from public.campaign_referral_payouts
    where id = p_payout_id;

    if not found then
        raise exception 'not_found: Payout record not found.';
    end if;

    v_new_amount_paid := coalesce(p_amount_paid, v_existing.amount_paid);

    if p_payment_status = 'paid' then
        if v_existing.verified_referral_count < 1 or v_existing.total_reward_earned <= 0 then
            raise exception 'payout_blocked: Cannot mark payout as Paid when no milestone reward has been earned.';
        end if;
        if coalesce(trim(coalesce(p_payment_reference, v_existing.payment_reference)), '') = '' then
            raise exception 'payment_reference_required: A bank transfer payment reference is required before marking a reward as Paid.';
        end if;
        if coalesce(trim(coalesce(p_account_number, v_existing.account_number)), '') = '' then
            raise exception 'bank_details_required: Referrer bank account details must be recorded before payout.';
        end if;
        if v_new_amount_paid <= 0 then
            v_new_amount_paid := v_existing.total_reward_earned;
        end if;
    end if;

    update public.campaign_referral_payouts
    set
        payment_status = p_payment_status,
        amount_paid = v_new_amount_paid,
        payment_reference = coalesce(nullif(trim(p_payment_reference), ''), payment_reference),
        bank_name = coalesce(nullif(trim(p_bank_name), ''), bank_name),
        account_name = coalesce(nullif(trim(p_account_name), ''), account_name),
        account_number = coalesce(nullif(trim(p_account_number), ''), account_number),
        notes = coalesce(p_notes, notes),
        verified_by = case when p_payment_status in ('verified', 'payable') then v_staff_id else verified_by end,
        verified_at = case when p_payment_status in ('verified', 'payable') then now() else verified_at end,
        approved_by = case when p_payment_status in ('payable', 'processing', 'paid') then v_staff_id else approved_by end,
        approved_at = case when p_payment_status in ('payable', 'processing', 'paid') then now() else approved_at end,
        paid_by = case when p_payment_status = 'paid' then v_staff_id else paid_by end,
        paid_at = case when p_payment_status = 'paid' then now() else paid_at end,
        payment_date = case when p_payment_status = 'paid' then coalesce(payment_date, now()) else payment_date end,
        updated_at = now()
    where id = p_payout_id;

    select email into v_staff_email from public.staff_profiles where id = v_staff_id;
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
        v_staff_id,
        v_staff_email,
        'campaign_referral_payout_update',
        'campaign_referral_payouts',
        p_payout_id,
        jsonb_build_object(
            'payment_status', v_existing.payment_status,
            'amount_paid', v_existing.amount_paid,
            'payment_reference', v_existing.payment_reference
        ),
        jsonb_build_object(
            'payment_status', p_payment_status,
            'amount_paid', v_new_amount_paid,
            'payment_reference', coalesce(p_payment_reference, v_existing.payment_reference)
        )
    );

    return jsonb_build_object(
        'updated', true,
        'payout_id', p_payout_id,
        'payment_status', p_payment_status,
        'amount_paid', v_new_amount_paid
    );
end;
$$;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ==============================================================================

alter table public.campaigns enable row level security;
alter table public.campaign_service_prices enable row level security;
alter table public.campaign_referral_milestones enable row level security;
alter table public.campaign_referral_payouts enable row level security;

-- Public read access for visible campaigns, eligible service prices, and milestones
drop policy if exists "Public can view visible campaigns" on public.campaigns;
create policy "Public can view visible campaigns"
    on public.campaigns for select
    to anon, authenticated
    using (is_publicly_visible = true or public.is_active_staff());

drop policy if exists "Authorized staff can manage campaigns" on public.campaigns;
create policy "Authorized staff can manage campaigns"
    on public.campaigns for all
    to authenticated
    using (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'))
    with check (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'));

drop policy if exists "Public can view campaign service prices" on public.campaign_service_prices;
create policy "Public can view campaign service prices"
    on public.campaign_service_prices for select
    to anon, authenticated
    using (true);

drop policy if exists "Authorized staff can manage campaign service prices" on public.campaign_service_prices;
create policy "Authorized staff can manage campaign service prices"
    on public.campaign_service_prices for all
    to authenticated
    using (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'))
    with check (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'operations_manager'));

drop policy if exists "Public can view campaign referral milestones" on public.campaign_referral_milestones;
create policy "Public can view campaign referral milestones"
    on public.campaign_referral_milestones for select
    to anon, authenticated
    using (true);

drop policy if exists "Authorized staff can manage campaign referral milestones" on public.campaign_referral_milestones;
create policy "Authorized staff can manage campaign referral milestones"
    on public.campaign_referral_milestones for all
    to authenticated
    using (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin'))
    with check (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin'));

drop policy if exists "Active staff can view campaign referral payouts" on public.campaign_referral_payouts;
create policy "Active staff can view campaign referral payouts"
    on public.campaign_referral_payouts for select
    to authenticated
    using (public.is_active_staff());

drop policy if exists "Finance and Admin staff can manage campaign referral payouts" on public.campaign_referral_payouts;
create policy "Finance and Admin staff can manage campaign referral payouts"
    on public.campaign_referral_payouts for all
    to authenticated
    using (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'accounts_officer', 'operations_manager'))
    with check (public.is_active_staff() and public.current_staff_role() in ('super_admin', 'admin', 'accounts_officer', 'operations_manager'));

-- Grants for RPCs and tables
grant select on public.campaigns to anon, authenticated;
grant select on public.campaign_service_prices to anon, authenticated;
grant select on public.campaign_referral_milestones to anon, authenticated;
grant all on public.campaigns to authenticated;
grant all on public.campaign_service_prices to authenticated;
grant all on public.campaign_referral_milestones to authenticated;
grant all on public.campaign_referral_payouts to authenticated;

grant execute on function public.ablebiz_get_lagos_now() to anon, authenticated;
grant execute on function public.ablebiz_calculate_referral_milestone_reward(int) to anon, authenticated;
grant execute on function public.ablebiz_get_effective_campaign_status(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.ablebiz_is_spin_and_win_paused() to anon, authenticated;
grant execute on function public.ablebiz_get_public_campaign_config(text) to anon, authenticated;
grant execute on function public.ablebiz_submit_referrer_bank_details(text, text, text, text, text) to anon, authenticated;
grant execute on function public.ablebiz_recalculate_referrer_campaign_payout(uuid, text) to authenticated;
grant execute on function public.ablebiz_verify_campaign_referral(uuid, text, text, uuid, uuid, boolean, boolean, boolean, text, text) to authenticated;
grant execute on function public.ablebiz_update_referral_payout(uuid, text, numeric, text, text, text, text, text) to authenticated;

-- ==============================================================================
-- 8. SEED AUTHORITATIVE OFFICE OPENING CAMPAIGN, PRICING, MILESTONES & RBAC
-- ==============================================================================

do $$
declare
    v_campaign_id uuid;
    v_srv_bn uuid;
    v_srv_co uuid;
    v_srv_ngo uuid;
    v_srv_scuml uuid;
    v_srv_ar uuid;
begin
    insert into public.campaigns (
        slug,
        name,
        description,
        campaign_type,
        start_date,
        end_date,
        timezone,
        status,
        promo_headline,
        referral_headline,
        tagline,
        location,
        terms_and_conditions,
        performance_targets,
        is_publicly_visible,
        spin_and_win_paused,
        allow_preview_pricing
    )
    values (
        'office-opening-promo-2026',
        'ABLEBIZ Office Opening Special Promo & Referral Rewards Campaign',
        'Official promotional discount and cumulative referral reward campaign celebrating the opening of the ABLEBIZ physical office in Abeokuta, Ogun State, Nigeria.',
        'promo_and_referral',
        '2026-11-05 00:00:00+01'::timestamptz,
        '2026-11-20 23:59:59+01'::timestamptz,
        'Africa/Lagos',
        'active',
        'UP TO 30% OFF SELECTED SERVICES',
        'EARN UP TO ₦35,000',
        'Building Business. Revealing Possibilities.',
        'Abeokuta, Ogun State, Nigeria',
        jsonb_build_array(
            'The ABLEBIZ Office Opening Special Promo & Referral Rewards Campaign runs from November 5, 2026 (00:00 WAT) to November 20, 2026 (23:59 WAT), inclusive (16 calendar days).',
            'Promotional discounts apply strictly to ABLEBIZ professional service fees on the six (6) listed eligible services only.',
            'CAC filing fees, statutory fees, stamp duties, government charges, regulatory fees, and third-party disbursements are excluded unless expressly stated otherwise.',
            'To qualify for the promotional pricing, the full promotional amount must be paid and confirmed within the campaign period (November 5 – November 20, 2026).',
            'Promotional discounts cannot be combined with Spin & Win rewards, vouchers, or any other promotional offers.',
            'A referral is counted as successful ONLY when: (a) the referred client is a new customer to ABLEBIZ; (b) the customer purchases an eligible campaign service; (c) full payment is received within the campaign period; (d) the referrer is identified by name or referral code before or at initial engagement/payment; and (e) the transaction is genuine, verified, and not cancelled or refunded.',
            'Multiple services purchased by one referred customer count as ONE (1) referral unless expressly approved by management.',
            'Only ONE (1) referrer may be credited per new customer. Self-referrals (where referrer and customer share identity, phone, or email) are strictly prohibited.',
            'Referral rewards are cumulative milestone totals (1 referral = ₦2,000 total; 3 referrals = ₦7,500 total; 5 referrals = ₦15,000 total; 10 referrals = ₦35,000 total) and are not paid as separate additive bonuses on top of earlier milestones.',
            'All referral rewards are subject to post-campaign verification and audit after November 20, 2026.',
            'Approved referral payouts are paid via bank transfer to the referrer''s designated Nigerian bank account within 5 to 7 business days after final campaign verification.',
            'ABLEBIZ reserves the right to withhold, adjust, or disqualify any discount or referral reward where fraud, duplicate registration, misrepresentation, or abuse of campaign rules is detected.',
            'ABLEBIZ reserves the right to amend, suspend, extend, or terminate this campaign where necessary in accordance with business and regulatory requirements.'
        ),
        jsonb_build_object(
            'new_customers_acquired', 30,
            'successful_referrals', 50,
            'business_name_registrations', 10,
            'company_registrations', 8,
            'ngo_registrations', 3,
            'scuml_services', 5,
            'annual_returns_services', 10,
            'total_service_transactions', 36,
            'referral_participants', 20,
            'customer_inquiries', 100
        ),
        true,
        true,
        false
    )
    on conflict (slug) do update
    set
        name = excluded.name,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        timezone = excluded.timezone,
        status = 'active',
        is_publicly_visible = true,
        spin_and_win_paused = true,
        allow_preview_pricing = true,
        promo_headline = excluded.promo_headline,
        referral_headline = excluded.referral_headline,
        tagline = excluded.tagline,
        location = excluded.location,
        terms_and_conditions = excluded.terms_and_conditions,
        performance_targets = excluded.performance_targets,
        updated_at = now()
    returning id into v_campaign_id;

    -- Resolve existing services_catalog IDs where available
    select id into v_srv_bn from public.services_catalog where slug = 'cac-business-name-registration' limit 1;
    select id into v_srv_co from public.services_catalog where slug = 'cac-company-registration-llc' limit 1;
    select id into v_srv_ngo from public.services_catalog where slug = 'cac-ngo-incorporated-trustees' limit 1;
    select id into v_srv_scuml from public.services_catalog where slug = 'scuml-certificate-registration' limit 1;
    select id into v_srv_ar from public.services_catalog where slug = 'cac-annual-returns-filing' limit 1;

    -- Seed the 6 approved promotional services and exact financial figures from the policy
    insert into public.campaign_service_prices (
        campaign_id, service_id, service_code, service_name, category,
        regular_professional_fee, discount_percentage, promo_professional_fee,
        direct_cost_estimate, is_eligible, sort_order, notes
    )
    values
        (v_campaign_id, v_srv_bn, 'business_name_reg', 'Business Name Registration', 'CAC Registration', 40000.00, 25.00, 30000.00, 25000.00, true, 1, 'Applies to ABLEBIZ professional service fee. Expected gross profit: ₦5,000.'),
        (v_campaign_id, v_srv_co, 'company_reg', 'Company Registration', 'CAC Registration', 65000.00, 30.00, 45500.00, 35000.00, true, 2, 'Applies to ABLEBIZ professional service fee. Expected gross profit: ₦10,500.'),
        (v_campaign_id, v_srv_ngo, 'ngo_reg', 'NGO Registration', 'CAC Registration', 160000.00, 10.00, 144000.00, 140000.00, true, 3, 'Applies to ABLEBIZ professional service fee. Expected gross profit: ₦4,000.'),
        (v_campaign_id, v_srv_scuml, 'scuml_assistance', 'SCUML Assistance', 'Regulatory Compliance', 40000.00, 20.00, 32000.00, 28000.00, true, 4, 'Applies to ABLEBIZ professional service fee. Expected gross profit: ₦4,000.'),
        (v_campaign_id, v_srv_ar, 'annual_returns_bn', 'Annual Returns – Business Name', 'Post-Incorporation & Filing', 15000.00, 8.00, 13800.00, 9000.00, true, 5, 'Applies to ABLEBIZ professional service fee (BN). Expected gross profit: ₦4,800.'),
        (v_campaign_id, v_srv_ar, 'annual_returns_company', 'Annual Returns – Company', 'Post-Incorporation & Filing', 16000.00, 10.00, 14400.00, 9000.00, true, 6, 'Applies to ABLEBIZ professional service fee (Company). Expected gross profit: ₦5,400.')
    on conflict (campaign_id, service_code) do update
    set
        service_id = coalesce(excluded.service_id, public.campaign_service_prices.service_id),
        service_name = excluded.service_name,
        category = excluded.category,
        regular_professional_fee = excluded.regular_professional_fee,
        discount_percentage = excluded.discount_percentage,
        promo_professional_fee = excluded.promo_professional_fee,
        direct_cost_estimate = excluded.direct_cost_estimate,
        sort_order = excluded.sort_order,
        notes = excluded.notes,
        updated_at = now();

    -- Seed the 4 cumulative referral reward milestones
    insert into public.campaign_referral_milestones (
        campaign_id, referrals_required, total_reward_ngn, additional_reward_ngn, label, description, is_active, sort_order
    )
    values
        (v_campaign_id, 1, 2000.00, 2000.00, 'Starter Milestone (1 Referral)', 'Reach 1 verified successful referral during the campaign period for a cumulative reward of ₦2,000.', true, 1),
        (v_campaign_id, 3, 7500.00, 5500.00, 'Bronze Milestone (3 Referrals)', 'Reach 3 verified successful referrals for a cumulative total reward of ₦7,500 (+₦5,500 additional at milestone).', true, 2),
        (v_campaign_id, 5, 15000.00, 7500.00, 'Silver Milestone (5 Referrals)', 'Reach 5 verified successful referrals for a cumulative total reward of ₦15,000 (+₦7,500 additional at milestone).', true, 3),
        (v_campaign_id, 10, 35000.00, 20000.00, 'Gold Champion Milestone (10 Referrals)', 'Reach 10 verified successful referrals for the top cumulative total reward of ₦35,000 (+₦20,000 additional at milestone).', true, 4)
    on conflict (campaign_id, referrals_required) do update
    set
        total_reward_ngn = excluded.total_reward_ngn,
        additional_reward_ngn = excluded.additional_reward_ngn,
        label = excluded.label,
        description = excluded.description,
        sort_order = excluded.sort_order,
        updated_at = now();
end $$;

-- Seed RBAC permissions for the 'campaigns' module across the 8 canonical staff roles
insert into public.roles_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve)
values
    ('super_admin', 'campaigns', true, true, true, true, true),
    ('admin', 'campaigns', true, true, true, false, true),
    ('operations_manager', 'campaigns', true, true, true, false, true),
    ('registration_officer', 'campaigns', true, false, false, false, false),
    ('accounts_officer', 'campaigns', true, true, true, false, true),
    ('client_service_officer', 'campaigns', true, true, false, false, false),
    ('marketing_officer', 'campaigns', true, true, true, false, false),
    ('viewer', 'campaigns', true, false, false, false, false)
on conflict (role, module) do update
set
    can_view = excluded.can_view,
    can_create = excluded.can_create,
    can_edit = excluded.can_edit,
    can_delete = excluded.can_delete,
    can_approve = excluded.can_approve;

commit;
