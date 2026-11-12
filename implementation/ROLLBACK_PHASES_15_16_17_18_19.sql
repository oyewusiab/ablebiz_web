-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19 ROLLBACK SCRIPT
-- File: implementation/ROLLBACK_PHASES_15_16_17_18_19.sql
-- ==============================================================================

begin;

drop trigger if exists trg_validate_expense_allocation on public.expense_receipt_allocations;
drop function if exists public.validate_expense_allocation_cap();

drop table if exists public.expense_allocation_audit_logs cascade;
drop table if exists public.expense_receipt_allocations cascade;

alter table public.leads
  drop column if exists campaign_id,
  drop column if exists conversion_date,
  drop column if exists conversion_revenue;

alter table public.campaigns
  drop column if exists budget_ngn,
  drop column if exists actual_spend_ngn,
  drop column if exists ad_spend_ngn;

alter table public.quotation_items
  drop column if exists item_type,
  drop column if exists statutory_fee,
  drop column if exists internal_cost;

alter table public.quotations
  drop column if exists statutory_fees_total,
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
drop table if exists public.business_continuity_settings cascade;
drop table if exists public.restore_drills cascade;
drop table if exists public.backup_records cascade;

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
