-- =============================================================================
-- ABLEBIZ SUITE — BI & EXECUTIVE REPORTING EXPANSION ROLLBACK SCRIPT
-- File: implementation/ROLLBACK_BI_REPORTING_EXPANSION.sql
-- Safely reverts reporting metadata tables & indexes created by MIGRATION_BI_REPORTING_EXPANSION.sql
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_campaign_payouts_reporting_status;
DROP INDEX IF EXISTS public.idx_referral_events_reporting_verified;
DROP INDEX IF EXISTS public.idx_cac_applications_reporting_stage;
DROP INDEX IF EXISTS public.idx_service_requests_reporting_status;
DROP INDEX IF EXISTS public.idx_leads_reporting_created_status;
DROP INDEX IF EXISTS public.idx_expenses_reporting_date_category;
DROP INDEX IF EXISTS public.idx_payments_reporting_date_verified;
DROP INDEX IF EXISTS public.idx_invoices_reporting_date_status;

DROP INDEX IF EXISTS public.idx_report_schedules_active_next;
DROP INDEX IF EXISTS public.idx_report_history_staff_date;
DROP INDEX IF EXISTS public.idx_report_saved_configs_staff;

DROP TABLE IF EXISTS public.report_schedules CASCADE;
DROP TABLE IF EXISTS public.report_execution_history CASCADE;
DROP TABLE IF EXISTS public.report_saved_configs CASCADE;

COMMIT;
