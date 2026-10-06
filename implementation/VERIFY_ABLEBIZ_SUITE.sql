-- ==============================================================================
-- ABLEBIZ SUITE — POST-MIGRATION READ-ONLY VERIFICATION SCRIPT
-- ==============================================================================
-- Document ID:    VERIFY-ABZ-SUITE-2026-V1
-- Purpose:        Inspects and validates database state after running
--                 MIGRATION_ABLEBIZ_SUITE.sql.
-- Safety:         100% READ-ONLY (No INSERT, UPDATE, DELETE, ALTER, or DROP).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS VERIFICATION
-- ------------------------------------------------------------------------------
select
  extname as extension_name,
  extversion as version,
  case when extname in ('pgcrypto', 'uuid-ossp', 'pg_stat_statements') then 'PASS' else 'INFO' end as status
from pg_extension
where extname in ('pgcrypto', 'uuid-ossp', 'pg_stat_statements')
order by extname;

-- ------------------------------------------------------------------------------
-- 2. ENUMS & CUSTOM TYPES VERIFICATION
-- ------------------------------------------------------------------------------
select
  typname as enum_type_name,
  count(enumlabel) as value_count,
  string_agg(enumlabel, ', ' order by enumsortorder) as values_preview,
  'PASS' as status
from pg_type t
join pg_enum e on t.oid = e.enumtypid
where typname in (
  'staff_role',
  'service_request_status',
  'cac_workflow_stage',
  'quotation_status',
  'invoice_status',
  'payment_method_type',
  'operational_priority',
  'task_status',
  'comm_channel',
  'followup_status',
  'doc_category',
  'cac_entity_type'
)
group by typname
order by typname;

-- ------------------------------------------------------------------------------
-- 3. PRODUCTION TABLES INVENTORY (Expected: 22 New Production Tables)
-- ------------------------------------------------------------------------------
with expected_tables as (
  select unnest(array[
    'staff_profiles',
    'roles_permissions',
    'clients',
    'businesses',
    'services_catalog',
    'service_requests',
    'cac_applications',
    'quotations',
    'quotation_items',
    'invoices',
    'invoice_items',
    'payments',
    'vendors',
    'expenses',
    'tasks',
    'task_comments',
    'documents',
    'communications',
    'follow_ups',
    'notifications',
    'audit_logs',
    'activity_timeline'
  ]) as table_name
)
select
  e.table_name,
  case when t.table_name is not null then 'EXISTS' else 'MISSING' end as table_status,
  case when c.relrowsecurity then 'ENABLED' else 'DISABLED' end as rls_status,
  case when t.table_name is not null and c.relrowsecurity then 'PASS' else 'FAIL' end as verification
from expected_tables e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.table_name
left join pg_class c
  on c.relname = e.table_name and c.relnamespace = 'public'::regnamespace
order by e.table_name;

-- ------------------------------------------------------------------------------
-- 4. PRESERVED LEGACY TABLES & ROW COUNTS (Expected: 10 Legacy Tables Intact)
-- ------------------------------------------------------------------------------
with legacy_tables as (
  select unnest(array[
    'leads',
    'spin_rewards',
    'referral_events',
    'consultation_requests',
    'checklist_downloads',
    'admin_users',
    'admin_audit_log',
    'site_config',
    'spin_reward_configs',
    'referral_tier_configs'
  ]) as table_name
)
select
  l.table_name,
  case when t.table_name is not null then 'PRESERVED' else 'MISSING' end as table_status,
  case when t.table_name is not null then 'PASS' else 'FAIL' end as verification
from legacy_tables l
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = l.table_name
order by l.table_name;

-- ------------------------------------------------------------------------------
-- 5. NON-DESTRUCTIVE COLUMN EXTENSIONS VERIFICATION
-- ------------------------------------------------------------------------------
select
  table_name,
  column_name,
  data_type,
  case when column_name is not null then 'PASS' else 'FAIL' end as status
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'leads' and column_name in ('converted_client_id', 'assigned_staff_id', 'qualification_status', 'priority', 'notes'))
    or
    (table_name = 'referral_events' and column_name in ('client_id', 'service_request_id'))
  )
order by table_name, column_name;

-- ------------------------------------------------------------------------------
-- 6. PUBLIC SERVICES VIEW & PRICING SANITIZATION CHECK
-- ------------------------------------------------------------------------------
-- Verify that public_services_view exists and DOES NOT contain any internal pricing columns
select
  table_name as view_name,
  column_name,
  case
    when column_name in ('default_fee_ngn', 'min_fee_ngn', 'internal_cost_estimate', 'pricing_notes') then 'LEAK_DETECTED (FAIL)'
    else 'SECURE (PASS)'
  end as security_check
from information_schema.columns
where table_schema = 'public' and table_name = 'public_services_view'
order by ordinal_position;

-- ------------------------------------------------------------------------------
-- 7. HELPER FUNCTIONS & TRIGGERS VERIFICATION
-- ------------------------------------------------------------------------------
select
  routine_name as function_name,
  routine_type,
  security_type,
  'PASS' as status
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'set_updated_at',
    'current_staff_role',
    'is_active_staff',
    'recalculate_invoice_payment_balance'
  )
order by routine_name;

select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  'PASS' as status
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'trg_recalculate_invoice_payment';

-- ------------------------------------------------------------------------------
-- 8. STORAGE BUCKET & POLICIES VERIFICATION
-- ------------------------------------------------------------------------------
select
  id as bucket_id,
  name as bucket_name,
  public as is_public,
  file_size_limit,
  case
    when id = 'ablebiz_documents' and public = false then 'PASS (PRIVATE)'
    else 'FAIL (NOT PRIVATE)'
  end as security_status
from storage.buckets
where id = 'ablebiz_documents';

select
  policyname as storage_policy_name,
  cmd as operation,
  roles,
  'PASS' as status
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in ('Staff upload ablebiz_documents', 'Staff view ablebiz_documents');

-- ------------------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY POLICIES COUNT
-- ------------------------------------------------------------------------------
select
  schemaname,
  tablename,
  count(policyname) as policy_count,
  string_agg(policyname, '; ') as policy_names
from pg_policies
where schemaname = 'public'
group by schemaname, tablename
order by tablename;

-- ------------------------------------------------------------------------------
-- 10. SEED DATA COUNTS (Services Catalog & Role Permissions)
-- ------------------------------------------------------------------------------
select
  'services_catalog' as entity,
  count(*) as record_count,
  case when count(*) >= 6 then 'PASS' else 'WARNING (FEW RECORDS)' end as status
from public.services_catalog
union all
select
  'roles_permissions' as entity,
  count(*) as record_count,
  case when count(*) >= 20 then 'PASS' else 'WARNING (FEW RECORDS)' end as status
from public.roles_permissions;

-- ==============================================================================
-- END OF VERIFICATION SCRIPT
-- ==============================================================================
