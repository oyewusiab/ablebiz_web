-- ==============================================================================
-- ABLEBIZ WEBSITE + ABLEBIZ SUITE
-- SAFE ROLLBACK SCRIPT: OFFICE OPENING SPECIAL PROMO & REFERRAL REWARDS CAMPAIGN
-- Restores Spin & Win RPC and cleanly removes campaign-specific objects if needed,
-- while preserving all historical customer, lead, quotation, invoice, and payment data.
-- ==============================================================================

begin;

-- 1. Restore Spin & Win availability immediately
update public.campaigns
set spin_and_win_paused = false,
    status = 'paused',
    is_publicly_visible = false,
    updated_at = now()
where slug = 'office-opening-promo-2026';

-- 2. Restore original ablebiz_create_spin_and_reward without campaign pause check
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

-- Note: To preserve financial and audit integrity, quotation_items, invoice_items,
-- referral_events, and campaign_referral_payouts columns are retained intact.

commit;
