-- ==============================================================================
-- ABLEBIZ SUITE — ROLLBACK SCRIPT FOR PHASES 6, 7 & 8
-- File: implementation/ROLLBACK_PHASES_6_7_8_FINANCIAL_AND_COMPLIANCE.sql
-- ==============================================================================

begin;

-- Rollback Compliance tables (Phase 8)
drop table if exists public.compliance_reminders cascade;
drop table if exists public.compliance_obligations cascade;
drop table if exists public.compliance_rules cascade;

-- Rollback Financial Planning tables (Phase 7)
drop table if exists public.financial_budgets cascade;
drop table if exists public.projected_expenses cascade;

-- Rollback invoices collection columns (Phase 7)
alter table public.invoices drop column if exists expected_payment_date;
alter table public.invoices drop column if exists collection_notes;
alter table public.invoices drop column if exists collection_confidence;

-- Rollback expenses cost attribution columns (Phase 6)
alter table public.expenses drop column if exists service_id;
alter table public.expenses drop column if exists client_id;
alter table public.expenses drop column if exists cac_application_id;
alter table public.expenses drop column if exists cost_type;

commit;

notify pgrst, 'reload schema';
