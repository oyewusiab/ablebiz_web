-- ==============================================================================
-- ABLEBIZ SUITE — PHASE 1 READ-ONLY DIAGNOSTIC SCRIPT
-- File: implementation/DIAGNOSTIC_SPIN_AND_SUITE_PERMISSIONS.sql
-- Target: Supabase Production (https://ksjphkqxudtkduuhnyvn.supabase.co)
-- Safety: 100% READ-ONLY (No INSERT, UPDATE, DELETE, ALTER, DROP, or GRANT)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCTIONS AUDIT: Check parameter types, return type, security & search_path
-- ------------------------------------------------------------------------------
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as argument_signature,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as is_security_definer,
  array_to_string(p.proconfig, ', ') as function_config,
  case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER' end as mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_active_staff',
    'current_staff_role',
    '_ablebiz_require_admin',
    '_ablebiz_require_superadmin',
    'ablebiz_create_spin_and_reward',
    'ablebiz_admin_fulfill_reward',
    'ablebiz_admin_get_rewards',
    'ablebiz_admin_get_leads',
    'ablebiz_admin_get_dashboard_stats',
    'ablebiz_admin_link_referral',
    'ablebiz_admin_get_referral_report',
    'ablebiz_admin_upsert_site_config',
    'ablebiz_admin_get_site_config',
    'ablebiz_admin_sync_spin_rewards',
    'ablebiz_admin_sync_referral_tiers',
    'ablebiz_create_consultation_request',
    'ablebiz_create_checklist_download',
    'ablebiz_get_monthly_leaderboard',
    'ablebiz_get_referral_stats',
    '_ablebiz_resolve_referral'
  )
order by p.proname;

-- ------------------------------------------------------------------------------
-- 2. EXISTING RLS POLICIES AUDIT
-- ------------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'leads',
    'spin_rewards',
    'referral_events',
    'consultation_requests',
    'checklist_downloads',
    'staff_profiles',
    'admin_users',
    'admin_audit_log',
    'spin_reward_configs',
    'referral_tier_configs'
  )
order by tablename, policyname;

-- ------------------------------------------------------------------------------
-- 3. CONSTRAINTS & UNIQUE INDEXES AUDIT
-- ------------------------------------------------------------------------------
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.table_name in ('staff_profiles', 'admin_users', 'leads', 'spin_rewards', 'referral_events')
order by tc.table_name, tc.constraint_type, kcu.column_name;

-- ------------------------------------------------------------------------------
-- 4. IDENTITY LINKAGE & CONFLICT DETECTION AUDIT
-- ------------------------------------------------------------------------------
-- A. Conflicting auth_uid assignments between staff_profiles and admin_users
select
  sp.id as staff_profile_id,
  sp.email,
  sp.full_name,
  sp.role as staff_role,
  sp.auth_uid as staff_auth_uid,
  au.id as admin_user_id,
  au.auth_uid as admin_auth_uid,
  au.role as admin_role,
  au.is_active as admin_is_active,
  case
    when sp.auth_uid is not null and au.auth_uid is not null and sp.auth_uid <> au.auth_uid then 'CONFLICT'
    when au.auth_uid is null then 'UNLINKED_ADMIN'
    when sp.auth_uid is null then 'UNLINKED_STAFF'
    else 'MATCHED'
  end as linkage_status
from public.staff_profiles sp
full outer join public.admin_users au on lower(trim(au.email)) = lower(trim(sp.email))
order by sp.email;

-- ------------------------------------------------------------------------------
-- 5. TRIGGERS AUDIT
-- ------------------------------------------------------------------------------
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation as event,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('staff_profiles', 'admin_users', 'leads', 'spin_rewards', 'referral_events')
order by event_object_table, trigger_name;

-- Specifically verify the superadmin protection trigger
select tgname, proname
from pg_trigger
join pg_proc on pg_proc.oid = pg_trigger.tgfoid
where tgname = 'trg_protect_last_super_admin';

-- ------------------------------------------------------------------------------
-- 6. TABLE AND SCHEMA PERMISSIONS (GRANTS) AUDIT
-- ------------------------------------------------------------------------------
select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in (
    'leads',
    'spin_rewards',
    'referral_events',
    'consultation_requests',
    'checklist_downloads',
    'admin_users',
    'admin_audit_log',
    'spin_reward_configs',
    'referral_tier_configs'
  )
  and grantee in ('anon', 'authenticated', 'public')
group by grantee, table_name
order by table_name, grantee;

-- ------------------------------------------------------------------------------
-- 7. FUNCTION EXECUTION GRANTS AUDIT
-- ------------------------------------------------------------------------------
select
  p.proname as function_name,
  d.grantee,
  d.privilege_type
from information_schema.routine_privileges d
join pg_proc p on p.proname = d.routine_name
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and d.grantee in ('anon', 'authenticated', 'public')
  and p.proname in (
    'ablebiz_create_spin_and_reward',
    'ablebiz_admin_fulfill_reward',
    'ablebiz_admin_get_rewards',
    'ablebiz_admin_get_leads',
    '_ablebiz_require_admin'
  )
order by p.proname, d.grantee;
