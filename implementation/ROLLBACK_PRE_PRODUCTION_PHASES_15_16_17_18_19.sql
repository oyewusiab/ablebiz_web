-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19
-- PRE-PRODUCTION SCHEMA ROLLBACK SCRIPT (TEARDOWN ONLY)
-- File: implementation/ROLLBACK_PRE_PRODUCTION_PHASES_15_16_17_18_19.sql
-- ==============================================================================
-- CAUTION / WARNING:
-- This script completely tears down and drops the database objects created for
-- Phases 15 through 19.
--
-- STRICT PRE-CONDITION:
-- ONLY execute this script in a PRE-PRODUCTION / STAGING sandbox environment
-- prior to operational go-live.
--
-- DO NOT EXECUTE THIS SCRIPT IN PRODUCTION IF LIVE OPERATIONAL RECORDS OR
-- FINANCIAL AUDIT HISTORIES EXIST. For production rollbacks, execute:
-- implementation/ROLLBACK_POST_PRODUCTION_SAFE_PHASES_15_16_17_18_19.sql
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. DROP CONCURRENCY & AUDIT TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------------------------
drop trigger if exists trg_validate_expense_amount_reduction on public.expenses;
drop function if exists public.validate_expense_amount_reduction();

drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
drop function if exists public.validate_expense_allocation_cap();

drop trigger if exists trg_log_expense_allocation_audit on public.expense_receipt_allocations;
drop function if exists public.log_expense_allocation_audit();

-- ------------------------------------------------------------------------------
-- 2. DROP PHASE 19: EXPENSE ALLOCATION & PROFITABILITY TABLES
-- ------------------------------------------------------------------------------
drop table if exists public.expense_allocation_audit_logs cascade;
drop table if exists public.expense_receipt_allocations cascade;

-- ------------------------------------------------------------------------------
-- 3. DROP PHASE 17: QUOTATION RECONCILIATION CONFLICTS & SERVICE BUNDLES
-- ------------------------------------------------------------------------------
drop table if exists public.quotation_reconciliation_conflicts cascade;
drop table if exists public.service_bundles cascade;

alter table public.quotation_items
  drop column if exists statutory_fee,
  drop column if exists internal_cost;

alter table public.quotations
  drop constraint if exists fk_quotations_approval_request,
  drop column if exists internal_cost_total,
  drop column if exists margin_amount,
  drop column if exists margin_percentage,
  drop column if exists approval_request_id,
  drop column if exists requires_approval,
  drop column if exists rejection_reason,
  drop column if exists converted_invoice_id,
  drop column if exists converted_at,
  drop column if exists converted_by;

-- Note: We DO NOT drop statutory_fee_total as it was created in earlier phases.

-- ------------------------------------------------------------------------------
-- 4. DROP PHASE 18: MARKETING CAMPAIGNS & LEAD ATTRIBUTIONS
-- ------------------------------------------------------------------------------
alter table public.leads
  drop column if exists campaign_id,
  drop column if exists conversion_date,
  drop column if exists conversion_revenue;

alter table public.campaigns
  drop column if exists budget_ngn,
  drop column if exists actual_spend_ngn,
  drop column if exists ad_spend_ngn;

-- ------------------------------------------------------------------------------
-- 5. DROP PHASE 16: BUSINESS CONTINUITY & BACKUP TABLES
-- ------------------------------------------------------------------------------
drop table if exists public.business_continuity_settings cascade;
drop table if exists public.restore_drills cascade;
drop table if exists public.backup_records cascade;

-- ------------------------------------------------------------------------------
-- 6. DROP PHASE 15: NOTIFICATIONS & ESCALATION ENGINE
-- ------------------------------------------------------------------------------
drop table if exists public.escalation_logs cascade;
drop table if exists public.escalation_rules cascade;
drop table if exists public.staff_notification_preferences cascade;

alter table public.notifications
  drop column if exists category,
  drop column if exists event_type,
  drop column if exists record_id,
  drop column if exists record_type,
  drop column if exists action_url,
  drop column if exists metadata;

commit;
