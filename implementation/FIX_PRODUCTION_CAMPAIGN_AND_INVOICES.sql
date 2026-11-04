-- ==============================================================================
-- ABLEBIZ WEBSITE + SUITE
-- FIX MIGRATION: CAMPAIGN ACTIVATION, SPIN & WIN PAUSE & INVOICE INTEGRATION
-- Target: Supabase Production PostgreSQL
-- Campaign: ABLEBIZ Office Opening Special Promo & Referral Rewards Campaign
-- Period: November 5, 2026 (00:00 WAT) – November 20, 2026 (23:59 WAT)
-- ==============================================================================

begin;

-- 1. ACTIVATE CAMPAIGN CONFIGURATION & ENFORCE SPIN & WIN PAUSE
-- Restores active campaign status, enables public visibility, and pauses Spin & Win
update public.campaigns
set
    status = 'active',
    is_publicly_visible = true,
    spin_and_win_paused = true,
    allow_preview_pricing = true,
    promo_headline = 'UP TO 30% OFF SELECTED SERVICES',
    referral_headline = 'EARN UP TO ₦35,000',
    tagline = 'Building Business. Revealing Possibilities.',
    location = 'Abeokuta, Ogun State, Nigeria',
    updated_at = now()
where slug = 'office-opening-promo-2026';

-- If campaign row does not exist, insert it cleanly
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
select
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
    true
where not exists (
    select 1 from public.campaigns where slug = 'office-opening-promo-2026'
);

-- 2. HARDEN SERVER-SIDE SPIN & WIN PAUSE RPC
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
    -- 1. Check campaigns table for explicit pause setting
    select coalesce(bool_or(c.spin_and_win_paused), false)
    into v_paused
    from public.campaigns c
    where c.status in ('scheduled', 'active')
      and now() <= c.end_date;

    -- 2. Also hard-guard the official campaign period: Nov 5 – Nov 20, 2026 (WAT)
    if not v_paused and now() >= '2026-11-05 00:00:00+01'::timestamptz and now() <= '2026-11-20 23:59:59+01'::timestamptz then
        v_paused := true;
    end if;

    return coalesce(v_paused, false);
end;
$$;

grant execute on function public.ablebiz_is_spin_and_win_paused() to anon, authenticated;

-- 3. ENSURE SPIN & WIN CREATION BLOCKED WHEN PAUSED
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
        raise exception 'invalid_input: Name and a valid Nigerian phone number are required.';
    end if;

    select
        sr.reward_code,
        sr.reward_type,
        sr.reward_label,
        sr.reward_value,
        sr.expires_at,
        sr.used_at,
        sr.created_at
    into v_existing
    from public.spin_rewards sr
    where sr.phone = v_phone
    order by sr.created_at desc
    limit 1;

    if v_existing.reward_code is not null then
        return jsonb_build_object(
            'status', 'already_spun',
            'reward_code', v_existing.reward_code,
            'reward_type', v_existing.reward_type,
            'reward_label', v_existing.reward_label,
            'reward_value', v_existing.reward_value,
            'expires_at', v_existing.expires_at,
            'is_used', (v_existing.used_at is not null),
            'message', 'You have already participated in Spin & Win. Here is your active voucher.'
        );
    end if;

    select *
    into v_cfg
    from public.spin_reward_configs
    where is_active = true
    order by random()
    limit 1;

    if v_cfg.reward_code is null then
        select * into v_cfg
        from public.spin_reward_configs
        where is_active = true
        limit 1;
    end if;

    v_code := 'ABZ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    insert into public.leads (
        full_name,
        phone,
        email,
        source,
        notes,
        raw_meta
    ) values (
        trim(p_name),
        v_phone,
        v_email,
        coalesce(p_source, 'Spin & Win'),
        'Lead captured via Spin & Win wheel promo.',
        jsonb_build_object(
            'business_interest', p_business_interest,
            'utm', coalesce(p_utm, '{}'::jsonb),
            'won_reward_code', v_cfg.reward_code,
            'voucher_code', v_code
        )
    )
    returning id into v_lead_id;

    insert into public.spin_rewards (
        reward_code,
        lead_id,
        phone,
        email,
        reward_type,
        reward_label,
        reward_value,
        expires_at
    ) values (
        v_code,
        v_lead_id,
        v_phone,
        v_email,
        v_cfg.reward_type,
        v_cfg.reward_label,
        v_cfg.reward_value,
        v_expires
    );

    return jsonb_build_object(
        'status', 'success',
        'reward_code', v_code,
        'reward_type', v_cfg.reward_type,
        'reward_label', v_cfg.reward_label,
        'reward_value', v_cfg.reward_value,
        'expires_at', v_expires,
        'is_used', false,
        'message', 'Congratulations! Your discount voucher has been generated successfully.'
    );
end;
$$;

grant execute on function public.ablebiz_create_spin_and_reward(text, text, text, text, text, jsonb) to anon, authenticated;

-- 4. ENSURE CAMPAIGN CONFIG RPC REFLECTS ACTIVE CAMPAIGN ACCURATELY
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
    v_campaign jsonb;
    v_services jsonb;
    v_milestones jsonb;
    v_status text;
    v_start timestamptz;
    v_end timestamptz;
    v_eff text;
begin
    select
        status, start_date, end_date
    into
        v_status, v_start, v_end
    from public.campaigns
    where slug = p_slug;

    if v_status is null then
        return jsonb_build_object(
            'found', false,
            'slug', p_slug,
            'message', 'Campaign configuration not found'
        );
    end if;

    v_eff := public.ablebiz_get_effective_campaign_status(v_status, v_start, v_end);

    select jsonb_build_object(
        'id', c.id,
        'slug', c.slug,
        'name', c.name,
        'description', c.description,
        'campaign_type', c.campaign_type,
        'start_date', c.start_date,
        'end_date', c.end_date,
        'timezone', c.timezone,
        'configured_status', c.status,
        'effective_status', v_eff,
        'promo_headline', c.promo_headline,
        'referral_headline', c.referral_headline,
        'tagline', c.tagline,
        'location', c.location,
        'terms_and_conditions', c.terms_and_conditions,
        'performance_targets', c.performance_targets,
        'is_publicly_visible', c.is_publicly_visible,
        'spin_and_win_paused', c.spin_and_win_paused,
        'allow_preview_pricing', c.allow_preview_pricing,
        'updated_at', c.updated_at
    )
    into v_campaign
    from public.campaigns c
    where c.slug = p_slug;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'campaign_id', s.campaign_id,
                'service_id', s.service_id,
                'service_code', s.service_code,
                'service_name', s.service_name,
                'category', s.category,
                'regular_professional_fee', s.regular_professional_fee,
                'discount_percentage', s.discount_percentage,
                'promo_professional_fee', s.promo_professional_fee,
                'direct_cost_estimate', s.direct_cost_estimate,
                'expected_gross_profit', s.expected_gross_profit,
                'is_eligible', s.is_eligible,
                'sort_order', s.sort_order,
                'notes', s.notes
            ) order by s.sort_order asc
        ),
        '[]'::jsonb
    )
    into v_services
    from public.campaign_service_prices s
    where s.campaign_id = (v_campaign->>'id')::uuid
      and s.is_eligible = true;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'campaign_id', m.campaign_id,
                'referrals_required', m.referrals_required,
                'total_reward_ngn', m.total_reward_ngn,
                'additional_reward_ngn', m.additional_reward_ngn,
                'label', m.label,
                'description', m.description,
                'is_active', m.is_active,
                'sort_order', m.sort_order
            ) order by m.sort_order asc
        ),
        '[]'::jsonb
    )
    into v_milestones
    from public.campaign_referral_milestones m
    where m.campaign_id = (v_campaign->>'id')::uuid
      and m.is_active = true;

    return jsonb_build_object(
        'found', true,
        'campaign', v_campaign,
        'services', v_services,
        'milestones', v_milestones,
        'server_time_utc', now(),
        'server_time_lagos', public.ablebiz_get_lagos_now()
    );
end;
$$;

grant execute on function public.ablebiz_get_public_campaign_config(text) to anon, authenticated;

commit;
