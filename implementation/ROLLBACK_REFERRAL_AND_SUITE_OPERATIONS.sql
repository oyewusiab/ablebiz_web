-- ==============================================================================
-- ROLLBACK SCRIPT FOR MIGRATION_REFERRAL_AND_SUITE_OPERATIONS.sql
-- File: implementation/ROLLBACK_REFERRAL_AND_SUITE_OPERATIONS.sql
-- ==============================================================================

begin;

-- 1. Drop added public RPCs
drop function if exists public.ablebiz_register_referral_partner(text,text,text,text,text);
drop function if exists public.ablebiz_submit_referral(text,text,text,text,text,text);
drop function if exists public.ablebiz_recover_referral_code(text);

-- 2. Restore original version of ablebiz_get_referral_stats
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

  select
    count(*)::int     as total,
    sum(points)::int  as pts
  into v_total_ref, v_total_pts
  from public.referral_events
  where referrer_code = trim(p_referral_code);

  select * into v_tier
  from public.referral_tier_configs
  where is_active = true
    and referrals_required <= coalesce(v_total_ref, 0)
  order by referrals_required desc
  limit 1;

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
                            'title',              v_next_tier.title,
                            'referrals_required', v_next_tier.referrals_required,
                            'note',               v_next_tier.note
                          )
                        else null end
  );
end;
$$;

grant execute on function public.ablebiz_get_referral_stats(text) to anon, authenticated;

commit;
