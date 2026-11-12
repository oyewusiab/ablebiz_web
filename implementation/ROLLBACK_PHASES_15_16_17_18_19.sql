-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19 ROLLBACK SCRIPT
-- File: implementation/ROLLBACK_PHASES_15_16_17_18_19.sql
-- Non-destructive of earlier phase schema and preserves financial histories.
-- ==============================================================================

begin;

-- 1. Drop validation and audit triggers
drop trigger if exists trg_validate_expense_amount_reduction on public.expenses;
drop function if exists public.validate_expense_amount_reduction();

drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
drop function if exists public.validate_expense_allocation_cap();

drop trigger if exists trg_log_expense_allocation_audit on public.expense_receipt_allocations;
drop function if exists public.log_expense_allocation_audit();

-- 2. Drop Phase 19 Profitability & Allocation Tables
drop table if exists public.expense_allocation_audit_logs cascade;
drop table if exists public.expense_receipt_allocations cascade;

-- 3. Drop reconciliation conflicts table if created
drop table if exists public.quotation_reconciliation_conflicts cascade;

-- 4. Rollback Phase 18 Marketing Lead Attributions
alter table public.leads
  drop column if exists campaign_id,
  drop column if exists conversion_date,
  drop column if exists conversion_revenue;

alter table public.campaigns
  drop column if exists budget_ngn,
  drop column if exists actual_spend_ngn,
  drop column if exists ad_spend_ngn;

-- 5. Rollback Phase 17 Quotation Intelligence (Preserves item_type and statutory_fee_total from earlier phases)
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

drop table if exists public.service_bundles cascade;

-- 6. Rollback Phase 16 Business Continuity Tables
drop table if exists public.business_continuity_settings cascade;
drop table if exists public.restore_drills cascade;
drop table if exists public.backup_records cascade;

-- 7. Rollback Phase 15 Notifications & Escalations
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
