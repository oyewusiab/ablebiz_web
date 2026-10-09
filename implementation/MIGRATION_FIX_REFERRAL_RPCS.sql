-- ============================================================================
-- ABLEBIZ SUITE & WEBSITE: STAGE C REFERRAL RPC & PERMISSION HARDENING
-- Description:
--   1. Replaces ablebiz_generate_referral_code() with a pure PostgreSQL implementation.
--      This immediately fixes ablebiz_create_consultation_request, ablebiz_create_checklist_download,
--      and ablebiz_create_spin_and_reward without needing to redefine their complex signatures.
--   2. Resolves ERROR 42P13 & ambiguous column references in ablebiz_get_monthly_leaderboard().
--   3. Grants necessary read/write capabilities on referral_events and tier configs
--      for authenticated Suite staff and anon public tiers.
-- ============================================================================

-- 1. Pure PostgreSQL referral code generator (10-char alphanumeric, zero extension dependency)
create or replace function public.ablebiz_generate_referral_code()
returns text language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
  idx   int;
begin
  for i in 1..10 loop
    idx := floor(random() * length(chars))::int + 1;
    code := code || substr(chars, idx, 1);
  end loop;
  return code;
end;
$$;

-- 2. Reward code generator (pure PostgreSQL)
create or replace function public.ablebiz_generate_reward_code()
returns text language plpgsql volatile as $$
begin
  return 'ABLE-' || upper(replace(substring(gen_random_uuid()::text, 1, 8), '-', ''));
end;
$$;

-- 3. Leaderboard query: drop old overloads first to avoid ERROR 42P13
drop function if exists public.ablebiz_get_monthly_leaderboard(int);
drop function if exists public.ablebiz_get_monthly_leaderboard(integer);
drop function if exists public.ablebiz_get_monthly_leaderboard();

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
language plpgsql security definer set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  return query
  with month_events as (
    select
      re.referrer_code,
      count(*)::int                    as total_count,
      coalesce(sum(re.points), 0)::int as total_pts
    from public.referral_events re
    where re.created_at >= date_trunc('month', now())
      and re.created_at <  date_trunc('month', now()) + interval '1 month'
    group by re.referrer_code
  ),
  ref_names as (
    select l.referral_code, min(l.name) as raw_name
    from public.leads l
    join month_events m on m.referrer_code = l.referral_code
    group by l.referral_code
  ),
  ranked as (
    select
      row_number() over (order by m.total_pts desc, m.total_count desc)::int as r_rank,
      public.ablebiz_mask_name(rn.raw_name)                                  as r_display_name,
      m.referrer_code                                                         as r_referral_code,
      m.total_pts                                                            as r_points,
      m.total_count                                                           as r_referrals
    from month_events m
    join ref_names rn on rn.referral_code = m.referrer_code
  )
  select
    r.r_rank          as rank,
    r.r_display_name  as display_name,
    r.r_referral_code as referral_code,
    r.r_points        as points,
    r.r_referrals     as referrals
  from ranked r
  order by r.r_rank
  limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

-- 4. Permissions and Grants
grant execute on function public.ablebiz_generate_referral_code() to anon, authenticated;
grant execute on function public.ablebiz_generate_reward_code() to anon, authenticated;
grant execute on function public.ablebiz_get_monthly_leaderboard(int) to anon, authenticated;
grant select on public.referral_tier_configs to anon, authenticated;
grant select, insert, update on public.referral_events to authenticated;

-- Ensure authenticated staff can read and manage referral_events via RLS
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='referral_events' and policyname='authenticated_staff_referral_events'
  ) then
    create policy authenticated_staff_referral_events on public.referral_events
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;
